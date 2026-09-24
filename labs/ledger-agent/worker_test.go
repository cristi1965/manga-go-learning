package ledgeragent

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestWorkerCompletesAnswer(t *testing.T) {
	store := NewStore(nil)
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "k", Input: "balance?"})
	registry, _ := NewRegistry()
	worker := Worker{ID: "w", Store: store, Registry: registry, LeaseTTL: time.Second, Engine: Engine{Timeout: time.Second, Provider: staticProvider(`{"kind":"answer","answer":"42"}`)}}
	if err := worker.Process(context.Background(), "t", run.ID); err != nil {
		t.Fatal(err)
	}
	got, step, _ := store.GetRun("t", run.ID)
	if got.Status != StatusCompleted || step.Status != StatusCompleted || got.Result != "42" {
		t.Fatalf("result = %#v / %#v", got, step)
	}
}

func TestWorkerFailsClosedOnUnregisteredTool(t *testing.T) {
	store := NewStore(nil)
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "k", Input: "delete"})
	registry, _ := NewRegistry()
	worker := Worker{ID: "w", Store: store, Registry: registry, LeaseTTL: time.Second, Engine: Engine{Timeout: time.Second, Provider: staticProvider(`{"kind":"tool","tool":"ledger.delete","arguments":{}}`)}}
	err := worker.Process(context.Background(), "t", run.ID)
	if !errors.Is(err, ErrToolDenied) {
		t.Fatalf("worker error = %v", err)
	}
	got, _, _ := store.GetRun("t", run.ID)
	if got.Status != StatusFailed || got.ErrorCategory != "tool_denied" {
		t.Fatalf("run = %#v", got)
	}
}

func TestFixedEvalCases(t *testing.T) {
	results := RunFixedEval(context.Background())
	if len(results) != 4 {
		t.Fatalf("result count = %d", len(results))
	}
	for _, result := range results {
		if !result.Passed {
			t.Errorf("case failed: %#v", result)
		}
	}
}
