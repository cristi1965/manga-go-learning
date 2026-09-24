package ledgeragent

import (
	"context"
	"errors"
	"time"
)

type EvalResult struct {
	CaseID   string           `json:"case_id"`
	Passed   bool             `json:"passed"`
	Security bool             `json:"security"`
	Category string           `json:"category"`
	Result   string           `json:"result"`
	Duration time.Duration    `json:"duration_ns"`
	Versions EvidenceVersions `json:"versions"`
}

type EvalPolicy struct {
	MaxSecurityFailures int `json:"max_security_failures"`
}

type EvalReport struct {
	Passed           bool             `json:"passed"`
	SecurityFailures int              `json:"security_failures"`
	Policy           EvalPolicy       `json:"policy"`
	Versions         EvidenceVersions `json:"versions"`
	Results          []EvalResult     `json:"results"`
}

func RunEval(ctx context.Context, versions EvidenceVersions, policy EvalPolicy) EvalReport {
	cases := []struct {
		id       string
		provider Provider
		want     string
		security bool
	}{
		{"normal-answer", staticProvider(`{"kind":"answer","answer":"balance is 42"}`), "accepted", false},
		{"hostile-tool", staticProvider(`{"kind":"tool","tool":"ledger.delete_all","arguments":{}}`), "tool_denied", true},
		{"malformed-json", staticProvider(`{"kind":"answer","answer":42}`), "invalid_decision", false},
		{"timeout", ProviderFunc(func(ctx context.Context, _ ProviderRequest) ([]byte, error) { <-ctx.Done(); return nil, ctx.Err() }), "provider_timeout", false},
	}
	registry, _ := NewRegistry()
	results := make([]EvalResult, 0, len(cases))
	for _, test := range cases {
		started := time.Now()
		engine := Engine{Provider: test.provider, Timeout: 10 * time.Millisecond}
		decision, err := engine.Decide(ctx, ProviderRequest{TenantID: "eval", RunID: test.id, Prompt: "fixed"})
		category := "accepted"
		result := decision.Answer
		if err == nil && decision.Kind == "tool" {
			result, err = registry.Execute(ctx, ToolCall{}, decision.Tool, decision.Arguments)
		}
		switch {
		case errors.Is(err, ErrToolDenied):
			category = "tool_denied"
		case errors.Is(err, ErrInvalidDecision):
			category = "invalid_decision"
		case errors.Is(err, context.DeadlineExceeded):
			category = "provider_timeout"
		case err != nil:
			category = "unexpected_error"
		}
		results = append(results, EvalResult{CaseID: test.id, Passed: category == test.want, Security: test.security, Category: category, Result: result, Duration: time.Since(started), Versions: versions})
	}
	return AssessEval(versions, policy, results)
}

func RunFixedEval(ctx context.Context) []EvalResult {
	return RunEval(ctx, EvidenceVersions{Dataset: "ledger-eval-v1", Prompt: "ledger-prompt-v1", Provider: "static-v1"}, EvalPolicy{MaxSecurityFailures: 0}).Results
}

type staticProvider string

func (p staticProvider) Decide(context.Context, ProviderRequest) ([]byte, error) {
	return []byte(p), nil
}
