package main

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	redisLessonTimeout = 8 * time.Second
	redisStartTimeout  = 3 * time.Second
	redisMaxScript     = 16 << 10
	redisMaxCommands   = 64
	redisMaxArguments  = 64
	redisMaxArgument   = 4 << 10
	redisMaxReply      = 1 << 20
)

var errRedisUnavailable = errors.New("本机未找到 redis-server，真实 Redis 运行不可用；请安装 Redis 后重试")

// runRedisLesson executes a lesson script against a fresh, loopback-only Redis.
// The caller gets real Redis replies; there is intentionally no in-memory fallback.
func runRedisLesson(ctx context.Context, unitID, code string) (command, output string, err error) {
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, redisLessonTimeout)
	defer cancel()

	commands, err := parseRedisLessonScript(code)
	if err != nil {
		return "Redis 8 真实实例（隔离临时进程）", err.Error(), err
	}
	if err := validateRedisLesson(unitID, commands); err != nil {
		return "Redis 8 真实实例（隔离临时进程）", err.Error(), err
	}

	instance, err := startRedisInstance(ctx)
	if err != nil {
		return "Redis 8 真实实例（隔离临时进程）", err.Error(), err
	}
	defer instance.stop()

	output, err = executeRedisCommands(ctx, instance.address, commands)
	return "redis-server --bind 127.0.0.1 --port <random> --save '' --appendonly no", output, err
}

type redisCommand struct {
	args []string
	line int
}

func parseRedisLessonScript(source string) ([]redisCommand, error) {
	if len(source) > redisMaxScript {
		return nil, fmt.Errorf("Redis 脚本不能超过 %dKB", redisMaxScript>>10)
	}
	source = strings.ReplaceAll(source, "\r\n", "\n")
	lines := strings.Split(source, "\n")
	commands := make([]redisCommand, 0, len(lines))
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		args, err := splitRedisCommand(trimmed)
		if err != nil {
			return nil, fmt.Errorf("第 %d 行：%w", index+1, err)
		}
		if len(args) > redisMaxArguments {
			return nil, fmt.Errorf("第 %d 行参数过多", index+1)
		}
		for _, arg := range args {
			if len(arg) > redisMaxArgument {
				return nil, fmt.Errorf("第 %d 行单个参数不能超过 %dKB", index+1, redisMaxArgument>>10)
			}
		}
		commands = append(commands, redisCommand{args: args, line: index + 1})
		if len(commands) > redisMaxCommands {
			return nil, fmt.Errorf("一次最多执行 %d 条 Redis 命令", redisMaxCommands)
		}
	}
	if len(commands) == 0 {
		return nil, errors.New("请至少写一条 Redis 命令")
	}
	return commands, nil
}

func splitRedisCommand(line string) ([]string, error) {
	var args []string
	var token strings.Builder
	var quote rune
	escaped := false
	started := false
	flush := func() {
		if started {
			args = append(args, token.String())
			token.Reset()
			started = false
		}
	}
	for _, char := range line {
		if escaped {
			switch char {
			case 'n':
				token.WriteByte('\n')
			case 'r':
				token.WriteByte('\r')
			case 't':
				token.WriteByte('\t')
			default:
				token.WriteRune(char)
			}
			escaped = false
			started = true
			continue
		}
		if char == '\\' {
			escaped = true
			started = true
			continue
		}
		if quote != 0 {
			if char == quote {
				quote = 0
			} else {
				token.WriteRune(char)
			}
			started = true
			continue
		}
		switch char {
		case '\'', '"':
			quote = char
			started = true
		case ' ', '\t':
			flush()
		default:
			token.WriteRune(char)
			started = true
		}
	}
	if escaped {
		return nil, errors.New("行末的转义符后缺少字符")
	}
	if quote != 0 {
		return nil, errors.New("引号没有闭合")
	}
	flush()
	return args, nil
}

var redisLessonCommands = map[string]map[string]bool{
	"redis-01": commandSet("SET", "GET", "EXISTS", "DEL", "TYPE"),
	"redis-02": commandSet("SET", "GET", "EXISTS", "DEL", "TYPE", "EXPIRE", "PEXPIRE", "TTL", "PTTL", "PERSIST"),
	"redis-03": commandSet("SET", "GET", "DEL", "TYPE", "HSET", "HGET", "HMGET", "HGETALL", "HINCRBY"),
	"redis-04": commandSet("DEL", "TYPE", "SADD", "SISMEMBER", "SMEMBERS", "SCARD", "SREM"),
	"redis-05": commandSet("DEL", "TYPE", "ZADD", "ZRANGE", "ZRANK", "ZREM", "ZSCORE"),
	"redis-06": commandSet("SET", "GET", "DEL", "TYPE", "INCR", "INCRBY"),
	"redis-07": commandSet("SET", "GET", "EXISTS", "DEL", "TYPE", "TTL", "PTTL"),
	"redis-08": commandSet("SET", "GET", "EXISTS", "DEL", "TYPE", "TTL", "PTTL", "HSET", "HGET", "HGETALL"),
}

func commandSet(commands ...string) map[string]bool {
	result := make(map[string]bool, len(commands))
	for _, command := range commands {
		result[command] = true
	}
	return result
}

func validateRedisLesson(unitID string, commands []redisCommand) error {
	allowed, ok := redisLessonCommands[unitID]
	if !ok {
		return fmt.Errorf("Redis 课时 %q 不存在", unitID)
	}
	seen := make(map[string]int)
	for _, command := range commands {
		name := strings.ToUpper(command.args[0])
		if !allowed[name] {
			return fmt.Errorf("第 %d 行：%s 不在本课安全白名单中；不允许 CONFIG、EVAL、MODULE、CLIENT 和网络目标命令", command.line, name)
		}
		if err := validateRedisCommandShape(name, command); err != nil {
			return err
		}
		seen[name]++
	}
	missing := func(message string) error { return errors.New(message) }
	switch unitID {
	case "redis-01":
		if !hasRedisCommand(commands, "SET", "shop:a:order:o102:status", "pending") || !hasRedisCommand(commands, "GET", "shop:a:order:o102:status") || !hasRedisCommand(commands, "EXISTS", "shop:a:order:o102:status") {
			return missing("请把状态写成 pending，再用 GET 读回并用 EXISTS 检查同一个 key")
		}
	case "redis-02":
		if !hasRedisCommand(commands, "SET", "shop:a:checkout:hold-88", "1", "EX", "30") || !hasRedisCommand(commands, "TTL", "shop:a:checkout:hold-88") {
			return missing("用 SET key 1 EX 30 设置 30 秒过期，再对同一个 key 执行 TTL")
		}
	case "redis-03":
		if !hasRedisCommand(commands, "HSET", "shop:a:order:o102", "status", "pending", "amount_cents", "1800") || !hasRedisCommand(commands, "HMGET", "shop:a:order:o102", "status", "amount_cents") {
			return missing("Hash 字段应是 status=pending、amount_cents=1800，再用 HMGET 一次读取两项")
		}
	case "redis-04":
		if !hasRedisCommand(commands, "SADD", "shop:a:order:o102:tags", "new", "pickup") || !hasRedisCommand(commands, "SISMEMBER", "shop:a:order:o102:tags", "pickup") {
			return missing("用 SADD 添加 new 和 pickup，再用 SISMEMBER 检查 pickup")
		}
	case "redis-05":
		if !hasRedisCommand(commands, "ZADD", "shop:a:drink:sales", "42", "jasmine", "51", "oolong") || !hasRedisCommand(commands, "ZRANGE", "shop:a:drink:sales", "0", "-1", "WITHSCORES") {
			return missing("加入 jasmine=42、oolong=51，再用 ZRANGE 0 -1 WITHSCORES 查看")
		}
	case "redis-06":
		if countRedisCommand(commands, "INCR", "shop:a:daily:orders:2026-10-21") != 3 || !hasRedisCommand(commands, "GET", "shop:a:daily:orders:2026-10-21") {
			return missing("把同一个今日订单计数器连续 INCR 三次，最后再 GET")
		}
	case "redis-07":
		if countRedisCommand(commands, "SET", "shop:a:checkout:req-88", "processing", "NX", "EX", "20") != 2 || !hasRedisCommand(commands, "TTL", "shop:a:checkout:req-88") {
			return missing("连续执行两次 SET ... NX EX 20，再用 TTL 检查 req-88；第二次必须得到 nil")
		}
	case "redis-08":
		if !hasRedisCommand(commands, "GET", "shop:a:order:o102") || !hasRedisCommand(commands, "SET", "shop:a:order:o102", "{\"status\":\"pending\"}", "EX", "60") || !hasRedisCommand(commands, "DEL", "shop:a:order:o102") {
			return missing("先 GET；miss 后 SET JSON EX 60；数据库提交后 DEL 同一个缓存 key")
		}
	}
	return nil
}

func hasRedisCommand(commands []redisCommand, name string, args ...string) bool {
	for _, command := range commands {
		if len(command.args) != len(args)+1 || !strings.EqualFold(command.args[0], name) {
			continue
		}
		matched := true
		for index, wanted := range args {
			actual := command.args[index+1]
			if index >= 3 || strings.EqualFold(name, "SET") && index >= 2 {
				matched = matched && strings.EqualFold(actual, wanted)
			} else {
				matched = matched && actual == wanted
			}
		}
		if matched {
			return true
		}
	}
	return false
}

func countRedisCommand(commands []redisCommand, name string, args ...string) int {
	count := 0
	for _, command := range commands {
		if len(command.args) != len(args)+1 || !strings.EqualFold(command.args[0], name) {
			continue
		}
		matched := true
		for index, wanted := range args {
			matched = matched && command.args[index+1] == wanted
		}
		if matched {
			count++
		}
	}
	return count
}

func validateRedisCommandShape(name string, command redisCommand) error {
	wantAtLeast := map[string]int{
		"SET": 3, "GET": 2, "EXISTS": 2, "DEL": 2, "TYPE": 2,
		"EXPIRE": 3, "PEXPIRE": 3, "TTL": 2, "PTTL": 2, "PERSIST": 2,
		"HSET": 4, "HGET": 3, "HMGET": 3, "HGETALL": 2, "HINCRBY": 4,
		"SADD": 3, "SISMEMBER": 3, "SMEMBERS": 2, "SCARD": 2, "SREM": 3,
		"ZADD": 4, "ZRANGE": 4, "ZRANK": 3, "ZREM": 3, "ZSCORE": 3,
		"INCR": 2, "INCRBY": 3,
	}
	if len(command.args) < wantAtLeast[name] {
		return fmt.Errorf("第 %d 行：%s 参数不足", command.line, name)
	}
	if name == "SET" {
		allowedOptions := map[string]int{"NX": 0, "XX": 0, "EX": 1, "PX": 1, "KEEPTTL": 0}
		for index := 3; index < len(command.args); index++ {
			option := strings.ToUpper(command.args[index])
			consume, ok := allowedOptions[option]
			if !ok {
				return fmt.Errorf("第 %d 行：SET 只允许 NX、XX、EX、PX 或 KEEPTTL 选项", command.line)
			}
			if index+consume >= len(command.args) {
				return fmt.Errorf("第 %d 行：SET %s 后缺少时间值", command.line, option)
			}
			index += consume
		}
	}
	return nil
}

func hasExpiringSet(commands []redisCommand) bool {
	for _, command := range commands {
		if strings.EqualFold(command.args[0], "SET") && hasRedisOption(command.args[3:], "EX", "PX") {
			return true
		}
	}
	return false
}

func hasNXExpiringSet(commands []redisCommand) bool {
	for _, command := range commands {
		if strings.EqualFold(command.args[0], "SET") && hasRedisOption(command.args[3:], "NX") && hasRedisOption(command.args[3:], "EX", "PX") {
			return true
		}
	}
	return false
}

func hasRedisOption(options []string, wanted ...string) bool {
	for _, option := range options {
		for _, target := range wanted {
			if strings.EqualFold(option, target) {
				return true
			}
		}
	}
	return false
}

type redisInstance struct {
	address  string
	dir      string
	cmd      *exec.Cmd
	done     chan error
	logPath  string
	stopOnce sync.Once
}

func startRedisInstance(ctx context.Context) (*redisInstance, error) {
	binary, err := exec.LookPath("redis-server")
	if err != nil {
		return nil, errRedisUnavailable
	}
	for attempt := 0; attempt < 3; attempt++ {
		instance, err := startRedisAttempt(ctx, binary)
		if err == nil {
			return instance, nil
		}
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, err
		}
	}
	return nil, errors.New("真实 Redis 临时实例启动失败，请检查 redis-server")
}

func startRedisAttempt(ctx context.Context, binary string) (*redisInstance, error) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("分配 Redis 临时端口：%w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	_ = listener.Close()

	dir, err := os.MkdirTemp("", "manga-go-redis-*")
	if err != nil {
		return nil, fmt.Errorf("创建 Redis 临时目录：%w", err)
	}
	logPath := filepath.Join(dir, "redis.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		_ = os.RemoveAll(dir)
		return nil, fmt.Errorf("创建 Redis 日志：%w", err)
	}
	cmd := exec.Command(binary,
		"--bind", "127.0.0.1",
		"--port", strconv.Itoa(port),
		"--protected-mode", "yes",
		"--save", "",
		"--appendonly", "no",
		"--dir", dir,
		"--dbfilename", "lesson.rdb",
		"--loglevel", "warning",
		"--daemonize", "no",
	)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		_ = logFile.Close()
		_ = os.RemoveAll(dir)
		return nil, fmt.Errorf("启动 redis-server：%w", err)
	}
	_ = logFile.Close()
	instance := &redisInstance{
		address: net.JoinHostPort("127.0.0.1", strconv.Itoa(port)),
		dir:     dir, cmd: cmd, done: make(chan error, 1), logPath: logPath,
	}
	go func() { instance.done <- cmd.Wait() }()

	startDeadline := time.Now().Add(redisStartTimeout)
	for {
		if err := pingRedis(ctx, instance.address); err == nil {
			return instance, nil
		}
		select {
		case err := <-instance.done:
			logOutput, _ := os.ReadFile(logPath)
			_ = os.RemoveAll(dir)
			return nil, fmt.Errorf("redis-server 提前退出：%v；%s", err, strings.TrimSpace(string(logOutput)))
		default:
		}
		if ctx.Err() != nil {
			instance.stop()
			return nil, ctx.Err()
		}
		if time.Now().After(startDeadline) {
			instance.stop()
			return nil, errors.New("redis-server 启动超时")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func (instance *redisInstance) stop() {
	if instance == nil {
		return
	}
	instance.stopOnce.Do(func() {
		if instance.cmd != nil && instance.cmd.Process != nil {
			_ = syscall.Kill(-instance.cmd.Process.Pid, syscall.SIGTERM)
			select {
			case <-instance.done:
			case <-time.After(2 * time.Second):
				_ = syscall.Kill(-instance.cmd.Process.Pid, syscall.SIGKILL)
				select {
				case <-instance.done:
				case <-time.After(time.Second):
				}
			}
		}
		_ = os.RemoveAll(instance.dir)
	})
}

func pingRedis(ctx context.Context, address string) error {
	value, err := sendRedisCommand(ctx, address, []string{"PING"})
	if err != nil {
		return err
	}
	if value.kind != '+' || value.text != "PONG" {
		return errors.New("Redis PING 未返回 PONG")
	}
	return nil
}

func executeRedisCommands(ctx context.Context, address string, commands []redisCommand) (string, error) {
	var output strings.Builder
	for _, command := range commands {
		if ctx.Err() != nil {
			return output.String(), ctx.Err()
		}
		fmt.Fprintf(&output, "> %s\n", displayRedisCommand(command.args))
		value, err := sendRedisCommand(ctx, address, command.args)
		if err != nil {
			fmt.Fprintf(&output, "(error) %v\n", err)
			return output.String(), fmt.Errorf("第 %d 行 Redis 执行失败：%w", command.line, err)
		}
		output.WriteString(formatRedisValue(value, ""))
		output.WriteByte('\n')
	}
	return strings.TrimSpace(output.String()), nil
}

func displayRedisCommand(args []string) string {
	displayed := make([]string, len(args))
	for index, arg := range args {
		if strings.ContainsAny(arg, " \t\r\n\"") || arg == "" {
			displayed[index] = strconv.Quote(arg)
		} else {
			displayed[index] = arg
		}
	}
	return strings.Join(displayed, " ")
}

type redisValue struct {
	kind   byte
	text   string
	number int64
	items  []redisValue
	null   bool
}

func sendRedisCommand(ctx context.Context, address string, args []string) (redisValue, error) {
	dialer := net.Dialer{Timeout: time.Second}
	connection, err := dialer.DialContext(ctx, "tcp4", address)
	if err != nil {
		return redisValue{}, err
	}
	defer connection.Close()
	deadline := time.Now().Add(2 * time.Second)
	if contextDeadline, ok := ctx.Deadline(); ok && contextDeadline.Before(deadline) {
		deadline = contextDeadline
	}
	_ = connection.SetDeadline(deadline)

	var request bytes.Buffer
	fmt.Fprintf(&request, "*%d\r\n", len(args))
	for _, arg := range args {
		fmt.Fprintf(&request, "$%d\r\n%s\r\n", len(arg), arg)
	}
	if _, err := connection.Write(request.Bytes()); err != nil {
		return redisValue{}, err
	}
	reader := bufio.NewReaderSize(io.LimitReader(connection, redisMaxReply), 4096)
	return readRedisValue(reader, 0)
}

func readRedisValue(reader *bufio.Reader, depth int) (redisValue, error) {
	if depth > 8 {
		return redisValue{}, errors.New("Redis 响应嵌套过深")
	}
	prefix, err := reader.ReadByte()
	if err != nil {
		return redisValue{}, err
	}
	line, err := readRedisLine(reader)
	if err != nil {
		return redisValue{}, err
	}
	switch prefix {
	case '+':
		return redisValue{kind: prefix, text: line}, nil
	case '-':
		return redisValue{}, errors.New(line)
	case ':':
		number, err := strconv.ParseInt(line, 10, 64)
		return redisValue{kind: prefix, number: number}, err
	case '$':
		length, err := strconv.Atoi(line)
		if err != nil || length < -1 || length > redisMaxReply {
			return redisValue{}, errors.New("Redis bulk 长度非法")
		}
		if length == -1 {
			return redisValue{kind: prefix, null: true}, nil
		}
		payload := make([]byte, length+2)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return redisValue{}, err
		}
		if !bytes.HasSuffix(payload, []byte("\r\n")) {
			return redisValue{}, errors.New("Redis bulk 缺少 CRLF")
		}
		return redisValue{kind: prefix, text: string(payload[:length])}, nil
	case '*':
		length, err := strconv.Atoi(line)
		if err != nil || length < -1 || length > 1024 {
			return redisValue{}, errors.New("Redis array 长度非法")
		}
		if length == -1 {
			return redisValue{kind: prefix, null: true}, nil
		}
		items := make([]redisValue, 0, length)
		for index := 0; index < length; index++ {
			item, err := readRedisValue(reader, depth+1)
			if err != nil {
				return redisValue{}, err
			}
			items = append(items, item)
		}
		return redisValue{kind: prefix, items: items}, nil
	default:
		return redisValue{}, fmt.Errorf("不支持的 Redis RESP 类型 %q", prefix)
	}
}

func readRedisLine(reader *bufio.Reader) (string, error) {
	line, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	if len(line) < 2 || !strings.HasSuffix(line, "\r\n") {
		return "", errors.New("Redis 响应行缺少 CRLF")
	}
	return line[:len(line)-2], nil
}

func formatRedisValue(value redisValue, indent string) string {
	switch value.kind {
	case '+':
		return value.text
	case ':':
		return fmt.Sprintf("(integer) %d", value.number)
	case '$':
		if value.null {
			return "(nil)"
		}
		return strconv.Quote(value.text)
	case '*':
		if value.null {
			return "(nil)"
		}
		if len(value.items) == 0 {
			return "(empty array)"
		}
		lines := make([]string, 0, len(value.items))
		for index, item := range value.items {
			lines = append(lines, fmt.Sprintf("%s%d) %s", indent, index+1, formatRedisValue(item, indent+"   ")))
		}
		return strings.Join(lines, "\n")
	default:
		return "(unknown)"
	}
}
