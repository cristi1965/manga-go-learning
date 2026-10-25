package wailsgosyntax

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
)

func TestStructJSON(t *testing.T) {
	app := NewApp(&MemoryStore{})
	raw, err := app.PreviewJSON("b1", 1200)
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal([]byte(raw), &got); err != nil {
		t.Fatal(err)
	}
	if got["id"] != "b1" || got["amount_cents"] != float64(1200) {
		t.Fatalf("unexpected JSON: %s", raw)
	}
}

func TestMethodReceiver(t *testing.T) {
	store := &MemoryStore{}
	app := NewApp(store)
	got, err := app.SaveBill("b2", 2300)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != "b2" || store.Count() != 1 {
		t.Fatalf("method did not update its App dependency: bill=%+v count=%d", got, store.Count())
	}
}

type recordingStore struct{ saved Bill }

func (s *recordingStore) Save(_ context.Context, bill Bill) error {
	s.saved = bill
	return nil
}

func TestInterfaceBoundary(t *testing.T) {
	store := &recordingStore{}
	app := NewApp(store)
	if _, err := app.SaveBill("b3", 3400); err != nil {
		t.Fatal(err)
	}
	if store.saved.ID != "b3" {
		t.Fatalf("interface implementation did not receive bill: %+v", store.saved)
	}
}

func TestErrorChain(t *testing.T) {
	app := NewApp(&MemoryStore{})
	_, err := app.PreviewBill("bad", 0)
	if !errors.Is(err, ErrInvalidAmount) {
		t.Fatalf("wrapped error lost its identity: %v", err)
	}
}

func TestContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	app := NewApp(&MemoryStore{})
	app.OnStartup(ctx)
	done := make(chan error, 1)
	go func() { done <- app.WaitForCancel() }()
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v, want context.Canceled", err)
	}
}

func TestConcurrentRefresh(t *testing.T) {
	app := NewApp(&MemoryStore{})
	var group sync.WaitGroup
	for range 1000 {
		group.Add(1)
		go func() {
			defer group.Done()
			app.RefreshCount()
		}()
	}
	group.Wait()
	if got := app.RefreshCount(); got != 1001 {
		t.Fatalf("got count %d, want 1001", got)
	}
}
