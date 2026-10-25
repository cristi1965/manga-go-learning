package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"unicode"
)

const mysqlTeachingVerifierVersion = "mysql-teaching-v1"

var (
	errUnsupportedMySQLLesson = errors.New("不支持的 MySQL 教学单元")
	errInvalidMySQLSQL        = errors.New("MySQL 教学 SQL 未通过验收")
	errUnsafeMySQLWrite       = errors.New("拒绝危险的 MySQL 写操作")
)

// mysqlLessonResult is deterministic evidence from the teaching verifier. It
// proves only the SQL structure and fixed lesson state described in the v22
// course; it is not evidence of real InnoDB locking, isolation, or concurrency.
type mysqlLessonResult struct {
	UnitID          string
	Command         string
	Output          string
	ArtifactDigest  string
	VerifierVersion string
}

type mysqlTokenKind uint8

const (
	mysqlWord mysqlTokenKind = iota
	mysqlString
	mysqlSymbol
)

type mysqlToken struct {
	kind  mysqlTokenKind
	value string
}

type mysqlStatement []mysqlToken

// runMySQLLesson validates a deliberately small MySQL 8 teaching subset. It
// never forwards learner SQL to a database and never substitutes SQLite for
// MySQL. Fixed outputs help beginners connect a valid statement to table state.
func runMySQLLesson(unitID, code string) (mysqlLessonResult, error) {
	if len(code) == 0 {
		return mysqlLessonResult{}, mysqlLessonFailure("请先写入本课 SQL")
	}
	if len(code) > maxCode {
		return mysqlLessonResult{}, mysqlLessonFailure("SQL 超过 64 KiB 上限")
	}

	statements, normalized, err := tokenizeMySQL(code)
	if err != nil {
		return mysqlLessonResult{}, mysqlLessonFailure(err.Error())
	}
	if len(statements) == 0 {
		return mysqlLessonResult{}, mysqlLessonFailure("没有找到可执行的 SQL 语句")
	}
	if err := validateMySQLSafety(statements); err != nil {
		return mysqlLessonResult{}, err
	}

	validator, ok := mysqlLessonValidators[unitID]
	if !ok {
		return mysqlLessonResult{}, fmt.Errorf("%w: %s", errUnsupportedMySQLLesson, unitID)
	}
	output, err := validator(statements)
	if err != nil {
		return mysqlLessonResult{}, err
	}
	digest := sha256.Sum256([]byte(unitID + "\x00" + normalized))
	return mysqlLessonResult{
		UnitID:          unitID,
		Command:         "mysql-teaching-verifier " + unitID,
		Output:          output + "\n\n证据边界：已验证 MySQL 语句结构和固定教学数据；未连接真实 MySQL，不代表 InnoDB 锁、隔离级别或并发行为。",
		ArtifactDigest:  fmt.Sprintf("sha256:%x", digest),
		VerifierVersion: mysqlTeachingVerifierVersion,
	}, nil
}

var mysqlLessonValidators = map[string]func([]mysqlStatement) (string, error){
	"mysql-01": validateMySQLSelect,
	"mysql-02": validateMySQLWhere,
	"mysql-03": validateMySQLOrderLimit,
	"mysql-04": validateMySQLAggregate,
	"mysql-05": validateMySQLJoin,
	"mysql-06": validateMySQLCreateTable,
	"mysql-07": validateMySQLInsert,
	"mysql-08": validateMySQLSafeWrite,
	"mysql-09": validateMySQLTransaction,
}

func validateMySQLSelect(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "SELECT")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") {
		return "", mysqlLessonFailure("本课需要用 SELECT ... FROM orders 读取订单")
	}
	selectEnd := mysqlWordIndex(stmt, "from", 1)
	if selectEnd < 0 || hasMySQLToken(stmt[:selectEnd], "*") || !hasMySQLWord(stmt[:selectEnd], "id") {
		return "", mysqlLessonFailure("请明确选择 id 等字段，不要用 SELECT *")
	}
	return "id         | amount_cents\norder-1001 | 1200\norder-1002 | 1800\norder-1003 | 1500", nil
}

func validateMySQLWhere(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "SELECT + WHERE")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") || !hasMySQLWord(stmt, "where") {
		return "", mysqlLessonFailure("先从 orders 查询，再用 WHERE 限定范围")
	}
	if !whereHasMySQLWords(stmt, "tenant_id", "status") || !whereHasMySQLWord(stmt, "and") {
		return "", mysqlLessonFailure("WHERE 必须同时限定 tenant_id 和 status，并用 AND 组合")
	}
	whereClause := mysqlClause(stmt, "where", "group", "order", "limit", "returning")
	if !mysqlWordEqualsLiteral(whereClause, "tenant_id", "'shop-a'") || !mysqlWordEqualsLiteral(whereClause, "status", "'paid'") {
		return "", mysqlLessonFailure("请使用 tenant_id = 'shop-a' AND status = 'paid'；不能用 <> 或其他值替代")
	}
	return "id         | status | amount_cents\norder-1001 | paid   | 1200\norder-1003 | paid   | 1500\n\n其他租户的订单未进入结果。", nil
}

func validateMySQLOrderLimit(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "ORDER BY + LIMIT")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") {
		return "", mysqlLessonFailure("本课需要查询 orders")
	}
	if !hasMySQLSequence(stmt, "order", "by") || !hasMySQLWordAfter(stmt, "created_at", "by") {
		return "", mysqlLessonFailure("请先用 ORDER BY created_at DESC 按时间倒序排列")
	}
	orderClause := mysqlClause(stmt, "by", "limit")
	if !hasMySQLWord(orderClause, "desc") {
		return "", mysqlLessonFailure("需要 DESC，让最新订单排在前面")
	}
	if !hasMySQLSequence(stmt, "order", "by", "created_at", "desc", "id", "desc") {
		return "", mysqlLessonFailure("时间相同时还要按 id DESC 稳定排序")
	}
	if !hasMySQLSequence(stmt, "limit", "3") {
		return "", mysqlLessonFailure("本课要求 LIMIT 3，只返回最新三笔")
	}
	return "id         | created_at\norder-1003 | 2026-10-21 10:15:00\norder-1002 | 2026-10-21 10:10:00\norder-1001 | 2026-10-21 10:05:00\n\n结果已按 created_at 倒序排列并限制数量；真实分页可再加 id 作为同时间排序键。", nil
}

func validateMySQLAggregate(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "GROUP BY")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "from", "orders") || !hasMySQLSequence(stmt, "group", "by") {
		return "", mysqlLessonFailure("请使用 SELECT ... FROM orders ... GROUP BY 完成分组统计")
	}
	if !hasMySQLWords(stmt, "count", "avg", "amount_cents") {
		return "", mysqlLessonFailure("本课同时用 COUNT(*) 和 AVG(amount_cents) 统计数量与平均金额")
	}
	if !hasMySQLWordAfter(stmt, "status", "by") || !whereHasMySQLWord(stmt, "tenant_id") {
		return "", mysqlLessonFailure("保留 tenant_id 条件，并按 status 分组")
	}
	return "status    | order_count | avg_cents\npaid      | 3           | 1833.33\npending   | 1           | 1600.00", nil
}

func validateMySQLJoin(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "JOIN")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "select") || !hasMySQLSequence(stmt, "left", "join") || !hasMySQLWord(stmt, "on") {
		return "", mysqlLessonFailure("请使用 LEFT JOIN，让缺少顾客资料的订单仍然保留")
	}
	if !hasMySQLWord(stmt, "orders") || !hasMySQLWord(stmt, "customers") {
		return "", mysqlLessonFailure("JOIN 需要同时出现 orders 和 customers")
	}
	if !onHasMySQLWords(stmt, "customer_id", "id", "tenant_id") || !whereHasMySQLWord(stmt, "tenant_id") {
		return "", mysqlLessonFailure("ON 条件需要按 customer_id = id 关联，并保留 tenant_id 租户边界")
	}
	return "order_id  | customer_name | amount_cents\norder-1001 | 阿宁            | 1200\norder-1002 | 小林            | 1800\norder-1003 | 阿宁            | 1500", nil
}

func validateMySQLCreateTable(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "CREATE TABLE")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "create", "table") || !hasMySQLWord(stmt, "orders") {
		return "", mysqlLessonFailure("请使用 CREATE TABLE orders 定义订单表")
	}
	for _, words := range [][]string{{"primary", "key"}, {"not", "null"}, {"check"}} {
		if !hasMySQLSequence(stmt, words...) {
			return "", mysqlLessonFailure("订单表需要 PRIMARY KEY、NOT NULL 和 CHECK 约束")
		}
	}
	if !hasMySQLWord(stmt, "tenant_id") || !hasMySQLWord(stmt, "id") || !hasMySQLWord(stmt, "amount_cents") {
		return "", mysqlLessonFailure("订单表至少要定义 tenant_id、id 和 amount_cents")
	}
	primaryKey := mysqlParenthesizedAfter(stmt, "primary", "key")
	if !hasMySQLWords(primaryKey, "tenant_id", "id") {
		return "", mysqlLessonFailure("PRIMARY KEY 需要同时包含 tenant_id 和 id，避免订单身份脱离租户")
	}
	return "Table: orders\nPRIMARY KEY: (tenant_id, id)\nRequired fields: enforced with NOT NULL\nBusiness rule: enforced with CHECK\n\n教学验证器已确认表结构，未在真实 MySQL 创建表。", nil
}

func validateMySQLInsert(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "INSERT")
	if err != nil {
		return "", err
	}
	if !startsMySQLWith(stmt, "insert", "into", "orders") || !hasMySQLWord(stmt, "values") {
		return "", mysqlLessonFailure("请使用 INSERT INTO orders (...) VALUES (...) 新增订单")
	}
	valuesAt := mysqlWordIndex(stmt, "values", 0)
	if valuesAt < 0 {
		return "", mysqlLessonFailure("INSERT 缺少 VALUES")
	}
	columns := stmt[:valuesAt]
	for _, column := range []string{"tenant_id", "id", "amount_cents", "status"} {
		if !hasMySQLWord(columns, column) {
			return "", mysqlLessonFailure("INSERT 请显式列出 tenant_id、id、amount_cents 和 status")
		}
	}
	if !statementContainsString(stmt, "shop-a") || !statementContainsString(stmt, "o106") || !statementContainsString(stmt, "paid") || !hasMySQLWord(stmt, "2100") {
		return "", mysqlLessonFailure("本课要插入 shop-a 的 o106，金额 2100，状态 paid")
	}
	return "affected_rows: 1\n\nid   | tenant_id | amount_cents | status\no106 | shop-a    | 2100         | paid", nil
}

func validateMySQLSafeWrite(statements []mysqlStatement) (string, error) {
	stmt, err := oneMySQLStatement(statements, "UPDATE / DELETE")
	if err != nil {
		return "", err
	}
	if startsMySQLWith(stmt, "update") {
		if !hasMySQLWord(stmt, "orders") || !hasMySQLWord(stmt, "set") {
			return "", mysqlLessonFailure("UPDATE 需要指定 orders 和 SET 修改内容")
		}
		if err := requireScopedMySQLWhere(stmt); err != nil {
			return "", err
		}
		if !statementContainsString(stmt, "shop-a") || !statementContainsString(stmt, "o105") || !statementContainsString(stmt, "cancelled") {
			return "", mysqlLessonFailure("只把 shop-a 的 o105 状态改为 cancelled")
		}
		return "affected_rows: 1\no105.status: paid -> cancelled\n\n租户和主键条件保证了只修改目标订单。", nil
	}
	if startsMySQLWith(stmt, "delete") {
		if !hasMySQLSequence(stmt, "from", "orders") {
			return "", mysqlLessonFailure("请使用 DELETE FROM orders 删除订单")
		}
		if err := requireScopedMySQLWhere(stmt); err != nil {
			return "", err
		}
		return "affected_rows: 1\norder-1002: deleted\n\n租户和主键条件保证了只删除目标订单。", nil
	}
	return "", mysqlLessonFailure("本课需要编写 UPDATE 或 DELETE")
}

func validateMySQLTransaction(statements []mysqlStatement) (string, error) {
	if len(statements) < 4 {
		return "", mysqlLessonFailure("可靠提交至少需要开始事务、写入幂等记录、写入订单和 COMMIT")
	}
	if !(startsMySQLWith(statements[0], "start", "transaction") || startsMySQLWith(statements[0], "begin")) {
		return "", mysqlLessonFailure("第一条语句请用 START TRANSACTION 或 BEGIN 开始事务")
	}
	if !startsMySQLWith(statements[len(statements)-1], "commit") {
		return "", mysqlLessonFailure("最后用 COMMIT 提交这组写入")
	}
	var hasEventInsert, hasIdempotencyInsert bool
	for _, stmt := range statements[1 : len(statements)-1] {
		if !startsMySQLWith(stmt, "insert", "into") {
			return "", mysqlLessonFailure("事务中间步骤只保留本课的幂等记录和订单 INSERT")
		}
		if startsMySQLWith(stmt, "insert", "into", "order_events") && hasMySQLWords(stmt, "tenant_id", "order_id", "event_type") {
			hasEventInsert = true
		}
		if startsMySQLWith(stmt, "insert", "into", "idempotency_records") && hasMySQLWords(stmt, "tenant_id", "request_key") {
			hasIdempotencyInsert = true
		}
	}
	if !hasIdempotencyInsert {
		return "", mysqlLessonFailure("事务内需向 idempotency_records 写入 tenant_id + request_key")
	}
	if !hasEventInsert {
		return "", mysqlLessonFailure("事务内还需要向 order_events 写入订单事件")
	}
	return "transaction: committed\nidempotency record: shop-a / checkout-88\norder event: o106 / paid\n\n结构验收通过：幂等记录与订单事件处于同一提交边界。", nil
}

func validateMySQLSafety(statements []mysqlStatement) error {
	for _, stmt := range statements {
		if len(stmt) == 0 {
			continue
		}
		forbidden := []string{"drop", "truncate", "alter", "grant", "revoke", "outfile", "dumpfile", "load_file", "sleep", "benchmark"}
		for _, word := range forbidden {
			if hasMySQLWord(stmt, word) {
				return fmt.Errorf("%w：教学环境不允许 %s", errUnsafeMySQLWrite, strings.ToUpper(word))
			}
		}
		if startsMySQLWith(stmt, "update") || startsMySQLWith(stmt, "delete") {
			if !hasMySQLWord(stmt, "where") {
				return fmt.Errorf("%w：UPDATE / DELETE 必须带 WHERE，避免整表误操作", errUnsafeMySQLWrite)
			}
		}
	}
	return nil
}

func requireScopedMySQLWhere(stmt mysqlStatement) error {
	if !hasMySQLWord(stmt, "where") {
		return fmt.Errorf("%w：UPDATE / DELETE 必须带 WHERE", errUnsafeMySQLWrite)
	}
	if !whereHasMySQLWords(stmt, "tenant_id", "id") || !whereHasMySQLWord(stmt, "and") {
		return fmt.Errorf("%w：WHERE 必须同时使用 tenant_id 和 id，并用 AND 限定单条订单", errUnsafeMySQLWrite)
	}
	whereClause := mysqlClause(stmt, "where", "group", "order", "limit", "returning")
	if !mysqlWordComparedWithEquality(whereClause, "tenant_id") || !mysqlWordComparedWithEquality(whereClause, "id") {
		return fmt.Errorf("%w：tenant_id 和 id 都要使用 = 精确定位，不能用宽条件代替", errUnsafeMySQLWrite)
	}
	if whereIsMySQLTautology(stmt) {
		return fmt.Errorf("%w：WHERE 1 = 1 不是安全的业务定位条件", errUnsafeMySQLWrite)
	}
	return nil
}

func oneMySQLStatement(statements []mysqlStatement, goal string) (mysqlStatement, error) {
	if len(statements) != 1 {
		return nil, mysqlLessonFailure("本课只提交一条 " + goal + " 语句")
	}
	return statements[0], nil
}

func mysqlLessonFailure(message string) error {
	return fmt.Errorf("%w：%s", errInvalidMySQLSQL, message)
}

func tokenizeMySQL(code string) ([]mysqlStatement, string, error) {
	var statements []mysqlStatement
	var current mysqlStatement
	var normalized strings.Builder
	runes := []rune(code)
	for i := 0; i < len(runes); {
		r := runes[i]
		if unicode.IsSpace(r) {
			i++
			continue
		}
		if r == '#' || (r == '-' && i+1 < len(runes) && runes[i+1] == '-') {
			i++
			if r == '-' {
				i++
			}
			for i < len(runes) && runes[i] != '\n' {
				i++
			}
			continue
		}
		if r == '/' && i+1 < len(runes) && runes[i+1] == '*' {
			i += 2
			closed := false
			for i+1 < len(runes) {
				if runes[i] == '*' && runes[i+1] == '/' {
					i += 2
					closed = true
					break
				}
				i++
			}
			if !closed {
				return nil, "", errors.New("块注释 /* ... */ 没有结束")
			}
			continue
		}
		if r == '\'' || r == '"' || r == '`' {
			quote := r
			start := i
			i++
			closed := false
			for i < len(runes) {
				if runes[i] == '\\' && quote != '`' && i+1 < len(runes) {
					i += 2
					continue
				}
				if runes[i] == quote {
					if i+1 < len(runes) && runes[i+1] == quote {
						i += 2
						continue
					}
					i++
					closed = true
					break
				}
				i++
			}
			if !closed {
				return nil, "", errors.New("引号没有闭合")
			}
			kind := mysqlString
			value := string(runes[start:i])
			if quote == '`' {
				kind = mysqlWord
				value = strings.ToLower(string(runes[start+1 : i-1]))
			}
			current = append(current, mysqlToken{kind: kind, value: value})
			continue
		}
		if unicode.IsLetter(r) || r == '_' || unicode.IsDigit(r) {
			start := i
			for i < len(runes) && (unicode.IsLetter(runes[i]) || unicode.IsDigit(runes[i]) || runes[i] == '_' || runes[i] == '$') {
				i++
			}
			current = append(current, mysqlToken{kind: mysqlWord, value: strings.ToLower(string(runes[start:i]))})
			continue
		}
		if r == ';' {
			appendMySQLStatement(&statements, &current, &normalized)
			i++
			continue
		}
		current = append(current, mysqlToken{kind: mysqlSymbol, value: string(r)})
		i++
	}
	appendMySQLStatement(&statements, &current, &normalized)
	return statements, normalized.String(), nil
}

func appendMySQLStatement(statements *[]mysqlStatement, current *mysqlStatement, normalized *strings.Builder) {
	if len(*current) == 0 {
		return
	}
	if normalized.Len() > 0 {
		normalized.WriteString(" ; ")
	}
	for i, token := range *current {
		if i > 0 {
			normalized.WriteByte(' ')
		}
		normalized.WriteString(token.value)
	}
	*statements = append(*statements, *current)
	*current = nil
}

func startsMySQLWith(stmt mysqlStatement, words ...string) bool {
	values := mysqlWordValues(stmt)
	if len(values) < len(words) {
		return false
	}
	for i, word := range words {
		if values[i] != word {
			return false
		}
	}
	return true
}

func hasMySQLWord(stmt mysqlStatement, word string) bool {
	for _, token := range stmt {
		if token.kind == mysqlWord && token.value == word {
			return true
		}
	}
	return false
}

func hasMySQLToken(stmt mysqlStatement, value string) bool {
	for _, token := range stmt {
		if token.value == value {
			return true
		}
	}
	return false
}

func hasMySQLWords(stmt mysqlStatement, words ...string) bool {
	for _, word := range words {
		if !hasMySQLWord(stmt, word) {
			return false
		}
	}
	return true
}

func hasAnyMySQLWord(stmt mysqlStatement, words ...string) bool {
	for _, word := range words {
		if hasMySQLWord(stmt, word) {
			return true
		}
	}
	return false
}

func hasMySQLSequence(stmt mysqlStatement, words ...string) bool {
	values := mysqlWordValues(stmt)
	for i := 0; i+len(words) <= len(values); i++ {
		matched := true
		for j, word := range words {
			if values[i+j] != word {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}

func mysqlWordValues(stmt mysqlStatement) []string {
	values := make([]string, 0, len(stmt))
	for _, token := range stmt {
		if token.kind == mysqlWord {
			values = append(values, token.value)
		}
	}
	return values
}

func mysqlWordIndex(stmt mysqlStatement, word string, start int) int {
	for i := start; i < len(stmt); i++ {
		if stmt[i].kind == mysqlWord && stmt[i].value == word {
			return i
		}
	}
	return -1
}

func hasMySQLWordAfter(stmt mysqlStatement, wanted, anchor string) bool {
	anchorAt := mysqlWordIndex(stmt, anchor, 0)
	return anchorAt >= 0 && hasMySQLWord(stmt[anchorAt+1:], wanted)
}

func mysqlClause(stmt mysqlStatement, start string, ends ...string) mysqlStatement {
	startAt := mysqlWordIndex(stmt, start, 0)
	if startAt < 0 {
		return nil
	}
	clause := stmt[startAt+1:]
	for i, token := range clause {
		if token.kind == mysqlWord {
			for _, end := range ends {
				if token.value == end {
					return clause[:i]
				}
			}
		}
	}
	return clause
}

func whereHasMySQLWord(stmt mysqlStatement, word string) bool {
	return hasMySQLWord(mysqlClause(stmt, "where", "group", "order", "limit", "returning"), word)
}

func whereHasMySQLWords(stmt mysqlStatement, words ...string) bool {
	return hasMySQLWords(mysqlClause(stmt, "where", "group", "order", "limit", "returning"), words...)
}

func onHasMySQLWord(stmt mysqlStatement, word string) bool {
	return hasMySQLWord(mysqlClause(stmt, "on", "where", "group", "order", "limit"), word)
}

func onHasMySQLWords(stmt mysqlStatement, words ...string) bool {
	return hasMySQLWords(mysqlClause(stmt, "on", "where", "group", "order", "limit"), words...)
}

func whereIsMySQLTautology(stmt mysqlStatement) bool {
	clause := mysqlClause(stmt, "where", "group", "order", "limit", "returning")
	for i := 0; i+2 < len(clause); i++ {
		if clause[i].kind == mysqlWord && clause[i].value == "1" && clause[i+1].value == "=" && clause[i+2].kind == mysqlWord && clause[i+2].value == "1" {
			return true
		}
	}
	return false
}

func mysqlParenthesizedAfter(stmt mysqlStatement, words ...string) mysqlStatement {
	valuesSeen := 0
	start := -1
	for i, token := range stmt {
		if token.kind != mysqlWord {
			continue
		}
		if token.value == words[valuesSeen] {
			valuesSeen++
			if valuesSeen == len(words) {
				start = i + 1
				break
			}
		} else {
			valuesSeen = 0
		}
	}
	if start < 0 {
		return nil
	}
	for start < len(stmt) && stmt[start].value != "(" {
		start++
	}
	if start == len(stmt) {
		return nil
	}
	depth := 0
	for i := start; i < len(stmt); i++ {
		switch stmt[i].value {
		case "(":
			depth++
		case ")":
			depth--
			if depth == 0 {
				return stmt[start+1 : i]
			}
		}
	}
	return nil
}

func mysqlWordComparedWithEquality(stmt mysqlStatement, word string) bool {
	for i, token := range stmt {
		if token.kind != mysqlWord || token.value != word {
			continue
		}
		for j := i + 1; j < len(stmt) && j <= i+2; j++ {
			if stmt[j].value == "=" {
				return true
			}
			if stmt[j].kind == mysqlWord {
				break
			}
		}
	}
	return false
}

func mysqlWordEqualsLiteral(stmt mysqlStatement, word, literal string) bool {
	for i := 0; i+2 < len(stmt); i++ {
		if stmt[i].kind == mysqlWord && stmt[i].value == word && stmt[i+1].value == "=" && stmt[i+2].kind == mysqlString && strings.EqualFold(stmt[i+2].value, literal) {
			return true
		}
	}
	return false
}
