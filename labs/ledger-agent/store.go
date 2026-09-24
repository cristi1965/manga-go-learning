package ledgeragent

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

type Clock func() time.Time

type record struct {
	run    Run
	step   Step
	input  string
	token  string
	ctx    context.Context
	cancel context.CancelFunc
}

type Store struct {
	mu      sync.Mutex
	now     Clock
	runs    map[string]*record
	keys    map[string]string
	events  map[string][]Event
	audits  []AuditRecord
	nextSeq map[string]int64
	updates map[string]chan struct{}
	effects map[string]uint64
}

func NewStore(clock Clock) *Store {
	if clock == nil {
		clock = time.Now
	}
	return &Store{now: clock, runs: make(map[string]*record), keys: make(map[string]string), events: make(map[string][]Event), nextSeq: make(map[string]int64), updates: make(map[string]chan struct{}), effects: make(map[string]uint64)}
}

func (s *Store) CreateRun(_ context.Context, req CreateRunRequest) (Run, bool, error) {
	key, digest, err := idempotencyIdentity(req)
	if err != nil {
		return Run{}, false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.keys[key]; ok {
		r := s.runs[id]
		if r.run.InputDigest != digest {
			return Run{}, false, ErrIdempotencyConflict
		}
		return r.run, false, nil
	}
	now := s.now().UTC()
	id := "run_" + randomID()
	stepID := "step_" + randomID()
	runCtx, cancel := context.WithCancel(context.Background())
	r := &record{
		run:    Run{ID: id, TenantID: req.TenantID, IdempotencyKey: req.IdempotencyKey, InputDigest: digest, TraceID: "trace_" + randomID(), Status: StatusQueued, StepID: stepID, CreatedAt: now, UpdatedAt: now},
		step:   Step{ID: stepID, RunID: id, Status: StatusQueued},
		input:  req.Input,
		ctx:    runCtx,
		cancel: cancel,
	}
	s.runs[id] = r
	s.keys[key] = id
	s.appendEventLocked(r, "run.created", map[string]any{"status": StatusQueued})
	s.auditLocked(r, "run.created")
	return r.run, true, nil
}

func (s *Store) GetRun(tenantID, runID string) (Run, Step, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.recordLocked(tenantID, runID)
	if err != nil {
		return Run{}, Step{}, err
	}
	return r.run, r.step, nil
}

func (s *Store) Claim(_ context.Context, tenantID, runID, workerID string, ttl time.Duration) (Lease, error) {
	if workerID == "" || ttl <= 0 {
		return Lease{}, fmt.Errorf("worker ID and positive lease TTL are required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.recordLocked(tenantID, runID)
	if err != nil {
		return Lease{}, err
	}
	if r.run.Status.Terminal() {
		return Lease{}, ErrTerminal
	}
	now := s.now().UTC()
	if r.step.Status == StatusRunning && now.Before(r.step.LeaseUntil) {
		return Lease{}, ErrLeaseHeld
	}
	r.step.Attempt++
	r.step.Fence++
	r.step.Status = StatusRunning
	r.step.LeaseOwner = workerID
	r.step.LeaseUntil = now.Add(ttl)
	r.token = randomID()
	r.run.Status = StatusRunning
	r.run.UpdatedAt = now
	s.appendEventLocked(r, "step.claimed", map[string]any{"attempt": r.step.Attempt, "fence": r.step.Fence, "worker_id": workerID})
	s.auditLocked(r, "step.claimed")
	return Lease{RunID: runID, StepID: r.step.ID, TenantID: tenantID, WorkerID: workerID, Token: r.token, Fence: r.step.Fence, LeaseUntil: r.step.LeaseUntil}, nil
}

func (s *Store) InputForLease(lease Lease) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.validLeaseLocked(lease)
	if err != nil {
		return "", err
	}
	return r.input, nil
}

func (s *Store) CheckLease(lease Lease) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.validLeaseLocked(lease)
	return err
}

func (s *Store) RunContext(tenantID, runID string) (context.Context, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.recordLocked(tenantID, runID)
	if err != nil {
		return nil, err
	}
	return r.ctx, nil
}

func (s *Store) CommitEffect(lease Lease, effectID string, apply func() (string, error)) (string, error) {
	if effectID == "" || apply == nil {
		return "", errors.New("effect ID and apply function are required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.validLeaseLocked(lease); err != nil {
		return "", err
	}
	key := lease.TenantID + "\x00" + effectID
	if fence := s.effects[key]; fence >= lease.Fence {
		return "", ErrStaleLease
	}
	result, err := apply()
	if err != nil {
		return "", err
	}
	s.effects[key] = lease.Fence
	return result, nil
}

func (s *Store) RecordDecision(lease Lease, versions EvidenceVersions, duration time.Duration, result, category string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.validLeaseLocked(lease)
	if err != nil {
		return err
	}
	s.audits = append(s.audits, AuditRecord{ID: "audit_" + randomID(), TenantID: r.run.TenantID, RunID: r.run.ID, Action: "decision.finished", InputDigest: r.run.InputDigest, TraceID: r.run.TraceID, DatasetVersion: versions.Dataset, PromptVersion: versions.Prompt, ProviderVersion: versions.Provider, Duration: duration, Result: result, Category: category, At: s.now().UTC()})
	return nil
}

func (s *Store) Complete(lease Lease, result string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.validLeaseLocked(lease)
	if err != nil {
		return err
	}
	now := s.now().UTC()
	r.step.Status = StatusCompleted
	r.run.Status = StatusCompleted
	r.run.Result = result
	r.run.UpdatedAt = now
	s.clearLeaseLocked(r)
	s.appendEventLocked(r, "run.completed", map[string]any{"status": StatusCompleted})
	s.auditLocked(r, "run.completed")
	return nil
}

func (s *Store) Fail(lease Lease, category string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.validLeaseLocked(lease)
	if err != nil {
		return err
	}
	r.step.Status = StatusFailed
	r.run.Status = StatusFailed
	r.run.ErrorCategory = category
	r.run.UpdatedAt = s.now().UTC()
	s.clearLeaseLocked(r)
	s.appendEventLocked(r, "run.failed", map[string]any{"category": category})
	s.auditLocked(r, "run.failed")
	return nil
}

func (s *Store) Cancel(_ context.Context, tenantID, runID string) (Run, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.recordLocked(tenantID, runID)
	if err != nil {
		return Run{}, err
	}
	if r.run.Status.Terminal() {
		return Run{}, ErrTerminal
	}
	r.run.Status = StatusCanceled
	r.step.Status = StatusCanceled
	r.run.UpdatedAt = s.now().UTC()
	s.clearLeaseLocked(r)
	r.cancel()
	s.appendEventLocked(r, "run.canceled", map[string]any{"status": StatusCanceled})
	s.auditLocked(r, "run.canceled")
	return r.run, nil
}

func (s *Store) EventsAfter(tenantID, runID string, after int64) ([]Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.recordLocked(tenantID, runID); err != nil {
		return nil, err
	}
	return copyEventsAfter(s.events[runID], after), nil
}

func (s *Store) EventSnapshot(tenantID, runID string, after int64) ([]Event, bool, <-chan struct{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.recordLocked(tenantID, runID)
	if err != nil {
		return nil, false, nil, err
	}
	out := copyEventsAfter(s.events[runID], after)
	wake := s.updates[runID]
	if wake == nil {
		wake = make(chan struct{})
		s.updates[runID] = wake
	}
	return out, r.run.Status.Terminal(), wake, nil
}

func (s *Store) AuditRecords(tenantID, runID string) ([]AuditRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.recordLocked(tenantID, runID); err != nil {
		return nil, err
	}
	var out []AuditRecord
	for _, a := range s.audits {
		if a.TenantID == tenantID && a.RunID == runID {
			out = append(out, a)
		}
	}
	return out, nil
}

func (s *Store) recordLocked(tenantID, runID string) (*record, error) {
	r, ok := s.runs[runID]
	if !ok || r.run.TenantID != tenantID {
		return nil, ErrNotFound
	}
	return r, nil
}

func (s *Store) validLeaseLocked(lease Lease) (*record, error) {
	r, err := s.recordLocked(lease.TenantID, lease.RunID)
	if err != nil {
		return nil, err
	}
	if err := validateFence(s.now().UTC(), r, lease); err != nil {
		return nil, err
	}
	return r, nil
}

func (s *Store) clearLeaseLocked(r *record) {
	r.step.LeaseOwner = ""
	r.step.LeaseUntil = time.Time{}
	r.token = ""
}

func (s *Store) appendEventLocked(r *record, kind string, data any) {
	s.nextSeq[r.run.ID]++
	b, _ := json.Marshal(data)
	s.events[r.run.ID] = append(s.events[r.run.ID], Event{Sequence: s.nextSeq[r.run.ID], RunID: r.run.ID, Type: kind, At: s.now().UTC(), Data: b})
	if wake := s.updates[r.run.ID]; wake != nil {
		close(wake)
	}
	s.updates[r.run.ID] = make(chan struct{})
}

func (s *Store) auditLocked(r *record, action string) {
	s.audits = append(s.audits, AuditRecord{ID: "audit_" + randomID(), TenantID: r.run.TenantID, RunID: r.run.ID, Action: action, InputDigest: r.run.InputDigest, TraceID: r.run.TraceID, At: s.now().UTC()})
}

func digestString(value string) string {
	sum := sha256.Sum256([]byte(value))
	return "sha256:" + hex.EncodeToString(sum[:])
}

func randomID() string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return hex.EncodeToString(b[:])
}
