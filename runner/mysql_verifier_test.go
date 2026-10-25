package main

import (
	"errors"
	"strings"
	"testing"
)

func TestRunMySQLLessonAcceptsCurriculumSolutions(t *testing.T) {
	tests := []struct {
		unitID string
		code   string
		want   string
	}{
		{"mysql-01", `SELECT id, amount_cents FROM orders;`, "order-1001"},
		{"mysql-02", `SELECT id, status, amount_cents FROM orders WHERE tenant_id = 'shop-a' AND status = 'paid';`, "其他租户"},
		{"mysql-03", `SELECT id, created_at FROM orders WHERE tenant_id = 'shop-a' ORDER BY created_at DESC, id DESC LIMIT 3;`, "倒序排列"},
		{"mysql-04", `SELECT status, COUNT(*) AS order_count, AVG(amount_cents) AS avg_cents FROM orders WHERE tenant_id = 'shop-a' GROUP BY status;`, "avg_cents"},
		{"mysql-05", `SELECT o.id, c.name, o.amount_cents FROM orders AS o LEFT JOIN customers AS c ON c.tenant_id = o.tenant_id AND c.id = o.customer_id WHERE o.tenant_id = 'tenant-shop';`, "customer_name"},
		{"mysql-06", `CREATE TABLE orders (tenant_id VARCHAR(64) NOT NULL, id VARCHAR(64) NOT NULL, amount_cents BIGINT NOT NULL, status VARCHAR(24) NOT NULL, PRIMARY KEY (tenant_id, id), CHECK (amount_cents > 0));`, "PRIMARY KEY"},
		{"mysql-07", `INSERT INTO orders (tenant_id, id, amount_cents, status) VALUES ('shop-a', 'o106', 2100, 'paid');`, "affected_rows: 1"},
		{"mysql-08", `UPDATE orders SET status = 'cancelled' WHERE tenant_id = 'shop-a' AND id = 'o105';`, "paid -> cancelled"},
		{"mysql-09", `START TRANSACTION; INSERT INTO idempotency_records (tenant_id, request_key) VALUES ('shop-a', 'checkout-88'); INSERT INTO order_events (tenant_id, order_id, event_type) VALUES ('shop-a', 'o106', 'paid'); COMMIT;`, "transaction: committed"},
	}
	for _, tt := range tests {
		t.Run(tt.unitID, func(t *testing.T) {
			result, err := runMySQLLesson(tt.unitID, tt.code)
			if err != nil {
				t.Fatalf("runMySQLLesson() error = %v", err)
			}
			if result.UnitID != tt.unitID || result.Command == "" || result.ArtifactDigest == "" || result.VerifierVersion != mysqlTeachingVerifierVersion {
				t.Fatalf("incomplete evidence: %+v", result)
			}
			if !strings.Contains(result.Output, tt.want) || !strings.Contains(result.Output, "未连接真实 MySQL") {
				t.Fatalf("output = %q, want lesson output and evidence boundary", result.Output)
			}
		})
	}
}

func TestRunMySQLLessonAcceptsSafeDelete(t *testing.T) {
	result, err := runMySQLLesson("mysql-08", `DELETE FROM orders WHERE tenant_id = 'tenant-shop' AND id = 'order-1002';`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Output, "deleted") {
		t.Fatalf("unexpected output: %s", result.Output)
	}
}

func TestRunMySQLLessonRejectsUnsafeWrites(t *testing.T) {
	tests := []struct {
		name string
		code string
	}{
		{"update without where", `UPDATE orders SET status = 'paid';`},
		{"delete without where", `DELETE FROM orders;`},
		{"write only scoped by id", `UPDATE orders SET status = 'paid' WHERE id = 'order-1002';`},
		{"write only scoped by tenant", `DELETE FROM orders WHERE tenant_id = 'tenant-shop';`},
		{"tautology", `DELETE FROM orders WHERE tenant_id = 'tenant-shop' AND id = 'order-1002' OR 1 = 1;`},
		{"broad predicates", `DELETE FROM orders WHERE tenant_id IS NOT NULL AND id IS NOT NULL;`},
		{"hidden after select", `SELECT id FROM orders; DELETE FROM orders;`},
		{"destructive ddl", `DROP TABLE orders;`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := runMySQLLesson("mysql-08", tt.code)
			if !errors.Is(err, errUnsafeMySQLWrite) {
				t.Fatalf("error = %v, want errUnsafeMySQLWrite", err)
			}
		})
	}
}

func TestRunMySQLLessonRejectsIncompleteLessonSQL(t *testing.T) {
	tests := []struct {
		unitID string
		code   string
	}{
		{"mysql-01", `SELECT * FROM orders;`},
		{"mysql-01", `SELECT *, id FROM orders;`},
		{"mysql-02", `SELECT id FROM orders WHERE status = 'paid';`},
		{"mysql-02", `SELECT id FROM orders WHERE tenant_id <> 'shop-a' AND status <> 'paid';`},
		{"mysql-02", `SELECT id FROM orders WHERE tenant_id = 'shop-b' AND status = 'paid';`},
		{"mysql-03", `SELECT id FROM orders ORDER BY created_at DESC LIMIT 3;`},
		{"mysql-04", `SELECT status, COUNT(*) FROM orders WHERE tenant_id = 'shop-a' GROUP BY status;`},
		{"mysql-05", `SELECT o.id FROM orders o JOIN customers c ON c.id = o.customer_id;`},
		{"mysql-06", `CREATE TABLE orders (tenant_id VARCHAR(64) NOT NULL, id VARCHAR(64) NOT NULL PRIMARY KEY, amount_cents BIGINT NOT NULL CHECK (amount_cents > 0));`},
		{"mysql-07", `INSERT INTO orders VALUES ('tenant-shop', 'order-1004', 1600, 'pending');`},
		{"mysql-08", `SELECT id FROM orders;`},
		{"mysql-09", `BEGIN; INSERT INTO order_events (tenant_id, order_id, event_type) VALUES ('shop-a', 'o106', 'paid'); COMMIT;`},
	}
	for _, tt := range tests {
		t.Run(tt.unitID, func(t *testing.T) {
			_, err := runMySQLLesson(tt.unitID, tt.code)
			if !errors.Is(err, errInvalidMySQLSQL) {
				t.Fatalf("error = %v, want errInvalidMySQLSQL", err)
			}
		})
	}
}

func TestRunMySQLLessonParserHandlesCommentsQuotedWordsAndBackticks(t *testing.T) {
	code := "-- DELETE FROM orders\nSELECT `id`, amount_cents FROM `orders` WHERE note = 'DROP TABLE orders';"
	result, err := runMySQLLesson("mysql-01", code)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Output, "order-1001") {
		t.Fatalf("unexpected output: %s", result.Output)
	}
}

func TestRunMySQLLessonRejectsMalformedAndUnsupportedInput(t *testing.T) {
	if _, err := runMySQLLesson("mysql-01", `SELECT id FROM orders WHERE note = 'oops`); !errors.Is(err, errInvalidMySQLSQL) {
		t.Fatalf("unterminated string error = %v", err)
	}
	if _, err := runMySQLLesson("mysql-10", `SELECT id FROM orders;`); !errors.Is(err, errUnsupportedMySQLLesson) {
		t.Fatalf("unsupported lesson error = %v", err)
	}
	if _, err := runMySQLLesson("mysql-01", strings.Repeat("x", maxCode+1)); !errors.Is(err, errInvalidMySQLSQL) {
		t.Fatalf("oversized input error = %v", err)
	}
}

func TestRunMySQLLessonDigestIsNormalizedAndBoundToUnit(t *testing.T) {
	a, err := runMySQLLesson("mysql-01", "SELECT id, amount_cents FROM orders;")
	if err != nil {
		t.Fatal(err)
	}
	b, err := runMySQLLesson("mysql-01", "  select ID, amount_cents\nFROM orders  ; -- same SQL\n")
	if err != nil {
		t.Fatal(err)
	}
	if a.ArtifactDigest != b.ArtifactDigest {
		t.Fatalf("format-only change altered digest: %s != %s", a.ArtifactDigest, b.ArtifactDigest)
	}
	c, err := runMySQLLesson("mysql-02", `SELECT id FROM orders WHERE tenant_id = 'shop-a' AND status = 'paid';`)
	if err != nil {
		t.Fatal(err)
	}
	if a.ArtifactDigest == c.ArtifactDigest {
		t.Fatal("digest was not bound to unit ID")
	}
	if _, err := runMySQLLesson("mysql-02", `SELECT id FROM orders WHERE tenant_id = 'shop-b' AND status = 'paid';`); !errors.Is(err, errInvalidMySQLSQL) {
		t.Fatalf("wrong tenant error = %v, want errInvalidMySQLSQL", err)
	}
}
