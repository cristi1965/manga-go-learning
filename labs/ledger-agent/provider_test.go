package ledgeragent

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestStrictDecisionParsing(t *testing.T) {
	tests := []struct {
		name string
		body string
		ok   bool
	}{
		{"answer", `{"kind":"answer","answer":"ok"}`, true},
		{"tool", `{"kind":"tool","tool":"reports.read","arguments":{"path":"a"}}`, true},
		{"unknown field", `{"kind":"answer","answer":"ok","confidence":1}`, false},
		{"wrong type", `{"kind":"answer","answer":42}`, false},
		{"two values", `{"kind":"answer","answer":"ok"} {}`, false},
		{"mixed modes", `{"kind":"tool","tool":"x","answer":"also","arguments":{}}`, false},
		{"missing args", `{"kind":"tool","tool":"x"}`, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := parseDecision([]byte(test.body))
			if (err == nil) != test.ok {
				t.Fatalf("parse error = %v, want ok %v", err, test.ok)
			}
		})
	}
}

func TestMilestone01ProviderCancellationContract(t *testing.T) {
	exited := make(chan struct{})
	engine := Engine{Timeout: 5 * time.Millisecond, Provider: ProviderFunc(func(ctx context.Context, _ ProviderRequest) ([]byte, error) {
		defer close(exited)
		<-ctx.Done()
		return nil, ctx.Err()
	})}
	_, err := engine.Decide(context.Background(), ProviderRequest{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("timeout error = %v", err)
	}
	select {
	case <-exited:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("provider did not return after cancellation")
	}
}

func TestEngineResponseLimit(t *testing.T) {
	engine := Engine{Timeout: time.Second, MaxResponse: 4, Provider: staticProvider(`{"kind":"answer","answer":"ok"}`)}
	if _, err := engine.Decide(context.Background(), ProviderRequest{}); !errors.Is(err, ErrInvalidDecision) {
		t.Fatalf("oversize error = %v", err)
	}
}
