package main

import (
	"errors"
	"strings"
	"testing"
)

func TestDatabaseFoundationSolutions(t *testing.T) {
	tests := map[string]string{
		"db-01": "SELECT id, drink, amount_cents FROM orders;",
		"db-02": "SELECT id, drink FROM orders WHERE id = 'o101';",
		"db-03": "SELECT id, note FROM orders WHERE note IS NULL;",
		"db-04": "SELECT orders.id, customers.name FROM orders JOIN customers ON customers.id = orders.customer_id;",
		"db-05": "SELECT id, drink, amount_cents FROM orders WHERE status = 'paid' ORDER BY created_at DESC LIMIT 1;",
		"db-06": "CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY, customer_id VARCHAR(32) NOT NULL, amount_cents BIGINT NOT NULL, note VARCHAR(200) NULL);",
	}
	for unitID, code := range tests {
		t.Run(unitID, func(t *testing.T) {
			result, err := runDatabaseFoundation(unitID, code)
			if err != nil {
				t.Fatal(err)
			}
			if result.ArtifactDigest == "" || result.Output == "" || result.VerifierVersion != databaseFoundationVerifierVersion {
				t.Fatalf("incomplete result: %+v", result)
			}
		})
	}
}

func TestDatabaseFoundationRejectsStarterMistakes(t *testing.T) {
	tests := map[string]string{
		"db-01": "SELECT * FROM orders;",
		"db-02": "SELECT id FROM orders WHERE id = 'o999';",
		"db-03": "SELECT id FROM orders WHERE note = NULL;",
		"db-04": "SELECT orders.id FROM orders JOIN customers ON customers.id = orders.id;",
		"db-05": "SELECT id FROM orders WHERE status = 'paid' ORDER BY created_at DESC LIMIT 2;",
		"db-06": "CREATE TABLE orders (id VARCHAR(32), customer_id VARCHAR(32), amount_cents BIGINT);",
	}
	for unitID, code := range tests {
		t.Run(unitID, func(t *testing.T) {
			_, err := runDatabaseFoundation(unitID, code)
			if !errors.Is(err, errInvalidDatabaseFoundation) {
				t.Fatalf("error = %v, want foundation failure", err)
			}
			if err == nil || strings.TrimSpace(err.Error()) == "" {
				t.Fatal("missing actionable feedback")
			}
		})
	}
}

func TestDatabaseFoundationRejectsConstraintsOnWrongColumns(t *testing.T) {
	for _, code := range []string{
		"CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY, customer_id VARCHAR(32), amount_cents BIGINT NOT NULL, note VARCHAR(200) NOT NULL);",
		"CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY, customer_id VARCHAR(32) NOT NULL, amount_cents BIGINT, note VARCHAR(200) NOT NULL);",
	} {
		if _, err := runDatabaseFoundation("db-06", code); !errors.Is(err, errInvalidDatabaseFoundation) {
			t.Fatalf("error = %v, want foundation failure for %q", err, code)
		}
	}
}
