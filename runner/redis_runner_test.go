package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"testing"
	"time"
)

func requireRedisServer(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("redis-server"); err != nil {
		t.Skip("redis-server is not installed")
	}
}

func TestRunRedisLessonUsesRealRedisForCoreDataTypes(t *testing.T) {
	requireRedisServer(t)
	tests := []struct {
		unit string
		code string
		want []string
	}{
		{"redis-01", "SET shop:a:order:o102:status pending\nGET shop:a:order:o102:status\nEXISTS shop:a:order:o102:status", []string{"OK", `"pending"`, "(integer) 1"}},
		{"redis-02", "SET shop:a:checkout:hold-88 1 EX 30\nTTL shop:a:checkout:hold-88", []string{"OK", "(integer)"}},
		{"redis-03", "HSET shop:a:order:o102 status pending amount_cents 1800\nHMGET shop:a:order:o102 status amount_cents", []string{`"pending"`, `"1800"`}},
		{"redis-04", "SADD shop:a:order:o102:tags new pickup\nSISMEMBER shop:a:order:o102:tags pickup", []string{"(integer) 1", "(integer) 2"}},
		{"redis-05", "ZADD shop:a:drink:sales 42 jasmine 51 oolong\nZRANGE shop:a:drink:sales 0 -1 WITHSCORES", []string{`"jasmine"`, `"42"`, `"oolong"`, `"51"`}},
		{"redis-06", "SET shop:a:daily:orders:2026-10-21 0\nINCR shop:a:daily:orders:2026-10-21\nINCR shop:a:daily:orders:2026-10-21\nINCR shop:a:daily:orders:2026-10-21\nGET shop:a:daily:orders:2026-10-21", []string{"(integer) 1", "(integer) 2", "(integer) 3", `"3"`}},
		{"redis-07", "SET shop:a:checkout:req-88 processing NX EX 20\nSET shop:a:checkout:req-88 processing NX EX 20\nTTL shop:a:checkout:req-88", []string{"OK", "(nil)", "(integer)"}},
		{"redis-08", "GET shop:a:order:o102\nSET shop:a:order:o102 '{\"status\":\"pending\"}' EX 60\nGET shop:a:order:o102\nDEL shop:a:order:o102", []string{"(nil)", "OK", `"{\"status\":\"pending\"}"`, "(integer) 1"}},
	}
	for _, test := range tests {
		t.Run(test.unit, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			command, output, err := runRedisLesson(ctx, test.unit, test.code)
			if err != nil {
				t.Fatalf("runRedisLesson() error = %v; output=%s", err, output)
			}
			if !strings.Contains(command, "127.0.0.1") || !strings.Contains(command, "appendonly no") {
				t.Fatalf("command does not describe isolated real Redis: %q", command)
			}
			for _, wanted := range test.want {
				if !strings.Contains(output, wanted) {
					t.Fatalf("output missing %q:\n%s", wanted, output)
				}
			}
		})
	}
}

func TestRedisLessonRejectsUnsafeCommandsBeforeExecution(t *testing.T) {
	for _, code := range []string{
		"CONFIG GET *",
		"EVAL 'return 1' 0",
		"CLIENT PAUSE 10000",
		"MIGRATE example.com 6379 key 0 1000",
	} {
		_, output, err := runRedisLesson(context.Background(), "redis-01", code)
		if err == nil || !strings.Contains(output, "安全白名单") {
			t.Fatalf("unsafe command %q was not rejected clearly: err=%v output=%q", code, err, output)
		}
	}
}

func TestRedisLessonRequiresTheLearningAction(t *testing.T) {
	tests := []struct{ unit, code, want string }{
		{"redis-01", "SET shop:a:order:o102:status draft\nGET shop:a:order:o102:status", "pending"},
		{"redis-02", "SET shop:a:checkout:hold-88 1\nTTL shop:a:checkout:hold-88", "EX 30"},
		{"redis-03", "HSET shop:a:order:o102 state pending amount 1800\nHMGET shop:a:order:o102 status amount_cents", "status=pending"},
		{"redis-04", "SADD shop:a:order:o102:tags new new\nSISMEMBER shop:a:order:o102:tags new", "pickup"},
		{"redis-05", "ZADD shop:a:drink:sales 1 jasmine 1 oolong\nZRANGE shop:a:drink:sales 0 -1 WITHSCORES", "jasmine=42"},
		{"redis-06", "INCR shop:a:daily:orders:2026-10-21\nINCR shop:a:daily:orders:2026-10-21\nGET shop:a:daily:orders:2026-10-21", "三次"},
		{"redis-07", "SET shop:a:checkout:req-88 processing NX EX 20", "连续执行两次"},
		{"redis-08", "SET shop:a:order:o102 value\nGET shop:a:order:o102", "SET JSON EX 60"},
	}
	for _, test := range tests {
		t.Run(test.unit, func(t *testing.T) {
			_, output, err := runRedisLesson(context.Background(), test.unit, test.code)
			if err == nil || !strings.Contains(output, test.want) {
				t.Fatalf("missing contract not reported: err=%v output=%q", err, output)
			}
		})
	}
}

func TestRedisInstancesAreIsolated(t *testing.T) {
	requireRedisServer(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	first, err := startRedisInstance(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer first.stop()
	second, err := startRedisInstance(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer second.stop()
	if first.address == second.address {
		t.Fatalf("instances share address %s", first.address)
	}
	if _, err := sendRedisCommand(ctx, first.address, []string{"SET", "only:first", "yes"}); err != nil {
		t.Fatal(err)
	}
	value, err := sendRedisCommand(ctx, second.address, []string{"GET", "only:first"})
	if err != nil {
		t.Fatal(err)
	}
	if value.kind != '$' || !value.null {
		t.Fatalf("second instance observed first instance state: %+v", value)
	}
}

func TestRedisInstanceStopKillsProcessAndRemovesDirectory(t *testing.T) {
	requireRedisServer(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	instance, err := startRedisInstance(ctx)
	if err != nil {
		t.Fatal(err)
	}
	dir := instance.dir
	pid := instance.cmd.Process.Pid
	instance.stop()
	if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("temporary directory still exists: %s (err=%v)", dir, err)
	}
	if err := syscall.Kill(pid, 0); !errors.Is(err, syscall.ESRCH) {
		t.Fatalf("redis-server process %d still exists: %v", pid, err)
	}
}

func TestRedisLessonReportsMissingBinaryWithoutFallback(t *testing.T) {
	oldPath := os.Getenv("PATH")
	t.Setenv("PATH", t.TempDir())
	_, output, err := runRedisLesson(context.Background(), "redis-01", "SET shop:a:order:o102:status pending\nGET shop:a:order:o102:status\nEXISTS shop:a:order:o102:status")
	t.Setenv("PATH", oldPath)
	if !errors.Is(err, errRedisUnavailable) {
		t.Fatalf("err=%v, want errRedisUnavailable", err)
	}
	if !strings.Contains(output, "真实 Redis 运行不可用") {
		t.Fatalf("missing binary message is unclear: %q", output)
	}
}

func TestSplitRedisCommandSupportsQuotedValues(t *testing.T) {
	commands, err := parseRedisLessonScript("SET tea:order:1001 \"milk tea\"\nGET tea:order:1001")
	if err != nil {
		t.Fatal(err)
	}
	if got := commands[0].args[2]; got != "milk tea" {
		t.Fatalf("quoted value=%q, want milk tea", got)
	}
}
