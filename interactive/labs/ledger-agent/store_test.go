package ledgeragent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCreateRunIsTenantScopedAndIdempotent(t *testing.T) {
	store := NewStore(nil)
	req := CreateRunRequest{TenantID: "tenant-a", IdempotencyKey: "request-1", Input: "secret account 123"}
	first, created, err := store.CreateRun(context.Background(), req)
	if err != nil || !created {
		t.Fatalf("first create = (%v, %v)", created, err)
	}
	second, created, err := store.CreateRun(context.Background(), req)
	if err != nil || created || second.ID != first.ID {
		t.Fatalf("idempotent create = id %q created %v err %v", second.ID, created, err)
	}
	req.Input = "different"
	if _, _, err := store.CreateRun(context.Background(), req); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("different input error = %v", err)
	}
	req.TenantID = "tenant-b"
	other, created, err := store.CreateRun(context.Background(), req)
	if err != nil || !created || other.ID == first.ID {
		t.Fatalf("tenant scoped key = %#v, %v, %v", other, created, err)
	}
	if _, _, err := store.GetRun("tenant-b", first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-tenant get error = %v", err)
	}
}

func TestConcurrentCreateReturnsOneRun(t *testing.T) {
	store := NewStore(nil)
	req := CreateRunRequest{TenantID: "tenant-a", IdempotencyKey: "same", Input: "prompt"}
	const count = 32
	ids := make(chan string, count)
	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			run, _, err := store.CreateRun(context.Background(), req)
			if err != nil {
				t.Errorf("create: %v", err)
				return
			}
			ids <- run.ID
		}()
	}
	wg.Wait()
	close(ids)
	var first string
	for id := range ids {
		if first == "" {
			first = id
		}
		if id != first {
			t.Fatalf("got multiple runs: %q and %q", first, id)
		}
	}
}

func TestLeaseTakeoverFencesOldWorker(t *testing.T) {
	now := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	store := NewStore(func() time.Time { return now })
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "k", Input: "p"})
	old, err := store.Claim(context.Background(), "t", run.ID, "worker-old", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Claim(context.Background(), "t", run.ID, "worker-new", time.Minute); !errors.Is(err, ErrLeaseHeld) {
		t.Fatalf("active lease claim = %v", err)
	}
	now = now.Add(2 * time.Minute)
	fresh, err := store.Claim(context.Background(), "t", run.ID, "worker-new", time.Minute)
	if err != nil || fresh.Fence <= old.Fence {
		t.Fatalf("takeover = %#v, %v", fresh, err)
	}
	if err := store.Complete(old, "stale"); !errors.Is(err, ErrStaleLease) {
		t.Fatalf("old complete = %v", err)
	}
	if err := store.Complete(fresh, "fresh"); err != nil {
		t.Fatal(err)
	}
}

func TestCancelInvalidatesLease(t *testing.T) {
	store := NewStore(nil)
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "k", Input: "p"})
	lease, _ := store.Claim(context.Background(), "t", run.ID, "w", time.Minute)
	if _, err := store.Cancel(context.Background(), "t", run.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.Complete(lease, "late"); !errors.Is(err, ErrStaleLease) {
		t.Fatalf("complete after cancel = %v", err)
	}
	got, step, _ := store.GetRun("t", run.ID)
	if got.Status != StatusCanceled || step.Status != StatusCanceled {
		t.Fatalf("statuses = %s/%s", got.Status, step.Status)
	}
}

func TestEventsReplayAndAuditDoNotExposeInput(t *testing.T) {
	store := NewStore(nil)
	secret := "card=4111111111111111"
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "k", Input: secret})
	lease, _ := store.Claim(context.Background(), "t", run.ID, "w", time.Minute)
	_ = store.Complete(lease, "done")
	events, err := store.EventsAfter("t", run.ID, 1)
	if err != nil || len(events) != 2 || events[0].Sequence != 2 || events[1].Sequence != 3 {
		t.Fatalf("events = %#v, %v", events, err)
	}
	audits, err := store.AuditRecords("t", run.ID)
	if err != nil || len(audits) != 3 {
		t.Fatalf("audits = %#v, %v", audits, err)
	}
	b, _ := json.Marshal(audits)
	if strings.Contains(string(b), secret) || !strings.Contains(string(b), "sha256:") {
		t.Fatalf("unsafe audit payload: %s", b)
	}
}
