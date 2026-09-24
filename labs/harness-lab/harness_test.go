package harness

import (
	"errors"
	"sync"
	"testing"
)

func fixture() (*Engine, *FakeTool, Binding, Command) {
	tool := NewFakeTool()
	engine := NewEngine(tool)
	cmd := Command{TenantID: "t1", SubjectID: "u1", Tool: "ledger.create", Input: "7"}
	binding := engine.Approve(engine.Preflight("run-1", "step-1", "call-1", cmd), "u1")
	return engine, tool, binding, cmd
}

func TestApprovedExecution(t *testing.T) {
	engine, tool, binding, cmd := fixture()
	got, err := engine.Execute(binding, cmd, false)
	if err != nil || got != "bill:7" || tool.Calls(binding.CallID) != 1 {
		t.Fatalf("got=%q err=%v calls=%d", got, err, tool.Calls(binding.CallID))
	}
}

func TestCompletedCallReturnsStoredResult(t *testing.T) {
	engine, tool, binding, cmd := fixture()
	for range 3 {
		got, err := engine.Execute(binding, cmd, false)
		if err != nil || got != "bill:7" {
			t.Fatalf("got=%q err=%v", got, err)
		}
	}
	if tool.Calls(binding.CallID) != 1 {
		t.Fatalf("want one side effect, got %d", tool.Calls(binding.CallID))
	}
}

func TestRejectsUnapprovedAndTamperedBinding(t *testing.T) {
	engine, tool, binding, cmd := fixture()
	bad := binding
	bad.SubjectID = "attacker"
	if _, err := engine.Execute(bad, cmd, false); !errors.Is(err, ErrBindingMismatch) {
		t.Fatalf("want binding mismatch, got %v", err)
	}
	unapproved := engine.Preflight("run-2", "step-2", "call-2", cmd)
	if _, err := engine.Execute(unapproved, cmd, false); !errors.Is(err, ErrApprovalRequired) {
		t.Fatalf("want approval required, got %v", err)
	}
	if tool.Calls(binding.CallID) != 0 {
		t.Fatal("rejected calls must have zero side effects")
	}
	wrongPrincipal := engine.Approve(engine.Preflight("run-3", "step-3", "call-3", cmd), "attacker")
	if _, err := engine.Execute(wrongPrincipal, cmd, false); !errors.Is(err, ErrApprovalRequired) {
		t.Fatalf("want approval required, got %v", err)
	}
	stale := binding
	stale.Fence++
	if _, err := engine.Execute(stale, cmd, false); !errors.Is(err, ErrBindingMismatch) {
		t.Fatalf("want stale fence rejection, got %v", err)
	}
}

func TestUnknownReconcilesWithSameCallID(t *testing.T) {
	engine, tool, binding, cmd := fixture()
	if _, err := engine.Execute(binding, cmd, true); !errors.Is(err, ErrUnknownOutcome) {
		t.Fatalf("want unknown, got %v", err)
	}
	got, err := engine.Reconcile(binding, cmd)
	if err != nil || got != "bill:7" {
		t.Fatalf("got=%q err=%v", got, err)
	}
	if tool.Calls(binding.CallID) != 1 {
		t.Fatalf("side effect repeated: %d", tool.Calls(binding.CallID))
	}
}

func TestConcurrentDuplicateUsesOneSideEffect(t *testing.T) {
	engine, tool, binding, cmd := fixture()
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got, err := engine.Execute(binding, cmd, false)
			if err == nil && got != "bill:7" {
				err = errors.New("wrong shared result")
			}
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("duplicate call failed: %v", err)
		}
	}
	if tool.Calls(binding.CallID) != 1 {
		t.Fatalf("want one side effect, got %d", tool.Calls(binding.CallID))
	}
}

func TestReceiptAndOutputTamperingAreRejected(t *testing.T) {
	engine, _, binding, _ := fixture()
	good := makeReceipt(binding, "bill:7")
	badReceipt := good
	badReceipt.BindingDigest = "tampered"
	if _, err := engine.Settle(binding, "bill:7", badReceipt); !errors.Is(err, ErrBindingMismatch) {
		t.Fatalf("want receipt rejection, got %v", err)
	}
	if _, err := engine.Settle(binding, "bill:8", good); !errors.Is(err, ErrBindingMismatch) {
		t.Fatalf("want output rejection, got %v", err)
	}
	uncommitted := good
	uncommitted.Committed = false
	if _, err := engine.Settle(binding, "bill:7", uncommitted); !errors.Is(err, ErrBindingMismatch) {
		t.Fatalf("want commit rejection, got %v", err)
	}
}

func TestDigestPreservesFieldBoundaries(t *testing.T) {
	if digest("a b", "c") == digest("a", "b c") {
		t.Fatal("canonical digest collapsed distinct fields")
	}
}
