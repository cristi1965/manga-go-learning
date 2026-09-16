package ledgeragent

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type Worker struct {
	ID       string
	Store    *Store
	Engine   Engine
	Registry *Registry
	LeaseTTL time.Duration
	Versions EvidenceVersions
}

func (w Worker) Process(ctx context.Context, tenantID, runID string) error {
	if w.Store == nil || w.Registry == nil || w.ID == "" || w.LeaseTTL <= 0 {
		return errors.New("worker is not configured")
	}
	lease, err := w.Store.Claim(ctx, tenantID, runID, w.ID, w.LeaseTTL)
	if err != nil {
		return err
	}
	input, err := w.Store.InputForLease(lease)
	if err != nil {
		return err
	}
	runCtx, err := w.Store.RunContext(tenantID, runID)
	if err != nil {
		return err
	}
	execCtx, cancel := context.WithCancel(ctx)
	stop := context.AfterFunc(runCtx, cancel)
	defer func() { stop(); cancel() }()
	started := time.Now()
	decision, err := w.Engine.Decide(execCtx, ProviderRequest{TenantID: tenantID, RunID: runID, Prompt: input})
	if err != nil {
		category := "provider_error"
		if errors.Is(err, context.DeadlineExceeded) {
			category = "provider_timeout"
		} else if errors.Is(err, ErrInvalidDecision) {
			category = "invalid_decision"
		}
		_ = w.Store.RecordDecision(lease, w.Versions, time.Since(started), "failed", category)
		if failErr := w.Store.Fail(lease, category); failErr != nil {
			return failErr
		}
		return err
	}
	var result string
	if decision.Kind == "answer" {
		result = decision.Answer
	} else {
		// Fencing is checked immediately before the server-owned tool boundary.
		call := ToolCall{TenantID: tenantID, RunID: runID, StepID: lease.StepID, Fence: lease.Fence}
		call.commit = func(effectID string, apply func() (string, error)) (string, error) {
			return w.Store.CommitEffect(lease, effectID, apply)
		}
		result, err = w.Registry.Execute(execCtx, call, decision.Tool, decision.Arguments)
		if err != nil {
			category := "tool_error"
			if errors.Is(err, ErrToolDenied) {
				category = "tool_denied"
			}
			_ = w.Store.RecordDecision(lease, w.Versions, time.Since(started), "failed", category)
			if failErr := w.Store.Fail(lease, category); failErr != nil {
				return failErr
			}
			return err
		}
	}
	if err := w.Store.RecordDecision(lease, w.Versions, time.Since(started), result, "accepted"); err != nil {
		return err
	}
	if err := w.Store.Complete(lease, result); err != nil {
		return fmt.Errorf("commit result: %w", err)
	}
	return nil
}
