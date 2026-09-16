package ledgeragent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestMilestone02StrictJSONFailsClosed(t *testing.T) {
	if _, err := parseDecision([]byte(`{"kind":"answer","answer":"ok","execute":true}`)); !errors.Is(err, ErrInvalidDecision) {
		t.Fatalf("unknown field error = %v", err)
	}
}

func TestMilestone03TenantIdempotency(t *testing.T) {
	store := NewStore(nil)
	req := CreateRunRequest{TenantID: "tenant-a", IdempotencyKey: "request-1", Input: "balance"}
	first, _, _ := store.CreateRun(context.Background(), req)
	second, created, err := store.CreateRun(context.Background(), req)
	if err != nil || created || first.ID != second.ID {
		t.Fatalf("idempotent replay = %#v, %v, %v", second, created, err)
	}
}

func TestMilestone04ToolRegistryAndRoot(t *testing.T) {
	TestReadFileToolGuardsPathsAndSchema(t)
}

type delayedWriteTool struct {
	ready   chan struct{}
	release chan struct{}
	writes  *atomic.Int32
}

func (t delayedWriteTool) Name() string                   { return "ledger.write" }
func (t delayedWriteTool) Effect() ToolEffect             { return ToolWrite }
func (t delayedWriteTool) Validate(json.RawMessage) error { return nil }
func (t delayedWriteTool) Execute(ctx context.Context, call ToolCall) (string, error) {
	close(t.ready)
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-t.release:
	}
	return call.Commit("bill-1", func() (string, error) { t.writes.Add(1); return "written", nil })
}

func TestMilestone05StaleWorkerCannotCommitToolEffect(t *testing.T) {
	now := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	store := NewStore(func() time.Time { return now })
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "k", Input: "write"})
	ready, release := make(chan struct{}), make(chan struct{})
	var writes atomic.Int32
	registry, _ := NewRegistry(delayedWriteTool{ready: ready, release: release, writes: &writes})
	worker := Worker{ID: "old", Store: store, Registry: registry, LeaseTTL: time.Second, Engine: Engine{Timeout: time.Second, Provider: staticProvider(`{"kind":"tool","tool":"ledger.write","arguments":{}}`)}}
	done := make(chan error, 1)
	go func() { done <- worker.Process(context.Background(), "t", run.ID) }()
	<-ready
	now = now.Add(2 * time.Second)
	if _, err := store.Claim(context.Background(), "t", run.ID, "new", time.Second); err != nil {
		t.Fatal(err)
	}
	close(release)
	if err := <-done; !errors.Is(err, ErrStaleLease) {
		t.Fatalf("old worker error = %v", err)
	}
	if writes.Load() != 0 {
		t.Fatalf("stale worker performed %d writes", writes.Load())
	}
}

func TestMilestone05CancelPropagatesToRunningProvider(t *testing.T) {
	started, canceled := make(chan struct{}), make(chan struct{})
	provider := ProviderFunc(func(ctx context.Context, _ ProviderRequest) ([]byte, error) {
		close(started)
		<-ctx.Done()
		close(canceled)
		return nil, ctx.Err()
	})
	store := NewStore(nil)
	registry, _ := NewRegistry()
	worker := &Worker{ID: "w", Store: store, Registry: registry, LeaseTTL: time.Second, Engine: Engine{Timeout: time.Minute, Provider: provider}}
	server := httptest.NewServer(API{Store: store, Worker: worker, WorkerConcurrency: 1}.Handler())
	defer server.Close()
	response := postJSON(t, server.URL+"/runs", []byte(`{"tenant_id":"t","idempotency_key":"cancel","input":"x"}`))
	var run Run
	if err := json.NewDecoder(response.Body).Decode(&run); err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	<-started
	cancel := postJSON(t, server.URL+"/runs/"+run.ID+"/cancel", []byte(`{"tenant_id":"t"}`))
	cancel.Body.Close()
	select {
	case <-canceled:
	case <-time.After(time.Second):
		t.Fatal("provider did not observe run cancellation")
	}
}

func TestMilestone06SSEReplaysAfterLastEventID(t *testing.T) {
	store := NewStore(nil)
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "sse", Input: "x"})
	lease, _ := store.Claim(context.Background(), "t", run.ID, "w", time.Second)
	_ = store.Complete(lease, "done")
	server := httptest.NewServer(API{Store: store}.Handler())
	defer server.Close()
	req, _ := http.NewRequest(http.MethodGet, server.URL+"/runs/"+run.ID+"/events?tenant_id=t", nil)
	req.Header.Set("Last-Event-ID", "1")
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var body bytes.Buffer
	_, _ = body.ReadFrom(response.Body)
	text := body.String()
	if response.Header.Get("Content-Type") != "text/event-stream" || strings.Contains(text, "id: 1\n") || !strings.Contains(text, "id: 2\n") || !strings.Contains(text, "id: 3\n") {
		t.Fatalf("unexpected SSE replay: headers=%v body=%q", response.Header, text)
	}
}

type flushWriter struct {
	header http.Header
	bytes.Buffer
	flushed chan struct{}
}

func (w *flushWriter) Header() http.Header { return w.header }
func (w *flushWriter) WriteHeader(int)     {}
func (w *flushWriter) Flush() {
	select {
	case w.flushed <- struct{}{}:
	default:
	}
}

func TestMilestone06SSEHeartbeatAndDisconnect(t *testing.T) {
	store := NewStore(nil)
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "live", Input: "x"})
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/runs/"+run.ID+"/events?tenant_id=t", nil).WithContext(ctx)
	req.SetPathValue("id", run.ID)
	req.Header.Set("Last-Event-ID", "1")
	w := &flushWriter{header: make(http.Header), flushed: make(chan struct{}, 1)}
	done := make(chan struct{})
	api := API{Store: store, SSEHeartbeat: 5 * time.Millisecond}
	go func() { api.events(w, req); close(done) }()
	select {
	case <-w.flushed:
	case <-time.After(time.Second):
		t.Fatal("SSE did not flush")
	}
	if !strings.Contains(w.String(), ": heartbeat") {
		t.Fatalf("missing heartbeat: %q", w.String())
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("SSE handler did not exit after disconnect")
	}
}

func TestMilestone07VersionedAuditAndSecurityGate(t *testing.T) {
	versions := EvidenceVersions{Dataset: "dataset-v1", Prompt: "prompt-v2", Provider: "provider-v3"}
	report := RunEval(context.Background(), versions, EvalPolicy{MaxSecurityFailures: 0})
	if !report.Passed || report.Versions != versions {
		t.Fatalf("report = %#v", report)
	}
	for _, result := range report.Results {
		if result.Versions != versions || result.Duration <= 0 {
			t.Fatalf("unbound result = %#v", result)
		}
	}
	blocked := AssessEval(versions, EvalPolicy{MaxSecurityFailures: 0}, []EvalResult{{CaseID: "hostile", Security: true, Passed: false}})
	if blocked.Passed || blocked.SecurityFailures != 1 {
		t.Fatalf("security gate did not block: %#v", blocked)
	}
	if AssessEval(EvidenceVersions{}, EvalPolicy{}, nil).Passed {
		t.Fatal("unversioned eval passed")
	}
	store := NewStore(nil)
	run, _, _ := store.CreateRun(context.Background(), CreateRunRequest{TenantID: "t", IdempotencyKey: "audit", Input: "secret"})
	registry, _ := NewRegistry()
	worker := Worker{ID: "w", Store: store, Registry: registry, LeaseTTL: time.Second, Versions: versions, Engine: Engine{Timeout: time.Second, Provider: staticProvider(`{"kind":"answer","answer":"42"}`)}}
	if err := worker.Process(context.Background(), "t", run.ID); err != nil {
		t.Fatal(err)
	}
	audits, _ := store.AuditRecords("t", run.ID)
	last := audits[len(audits)-2]
	if last.Action != "decision.finished" || last.DatasetVersion != versions.Dataset || last.PromptVersion != versions.Prompt || last.ProviderVersion != versions.Provider || last.Duration <= 0 || last.Result != "42" {
		t.Fatalf("decision audit = %#v", last)
	}
}

func TestMilestone08HTTPWorkerBackpressure(t *testing.T) {
	started := make(chan struct{}, 1)
	provider := ProviderFunc(func(ctx context.Context, _ ProviderRequest) ([]byte, error) {
		started <- struct{}{}
		<-ctx.Done()
		return nil, ctx.Err()
	})
	store := NewStore(nil)
	registry, _ := NewRegistry()
	worker := &Worker{ID: "w", Store: store, Registry: registry, LeaseTTL: time.Second, Engine: Engine{Timeout: time.Minute, Provider: provider}}
	server := httptest.NewServer(API{Store: store, Worker: worker, WorkerConcurrency: 1}.Handler())
	defer server.Close()
	first := postJSON(t, server.URL+"/runs", []byte(`{"tenant_id":"t","idempotency_key":"one","input":"x"}`))
	var run Run
	_ = json.NewDecoder(first.Body).Decode(&run)
	first.Body.Close()
	<-started
	second := postJSON(t, server.URL+"/runs", []byte(`{"tenant_id":"t","idempotency_key":"two","input":"x"}`))
	defer second.Body.Close()
	if second.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d", second.StatusCode)
	}
	cancel := postJSON(t, server.URL+"/runs/"+run.ID+"/cancel", []byte(`{"tenant_id":"t"}`))
	cancel.Body.Close()
}
