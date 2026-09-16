package ledgeragent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"
)

type ProviderRequest struct {
	TenantID string
	RunID    string
	Prompt   string
}

type Provider interface {
	// Decide must return when ctx is canceled. Engine deliberately calls it in
	// the current goroutine so a non-compliant adapter cannot be hidden behind a
	// leaked timeout goroutine.
	Decide(context.Context, ProviderRequest) ([]byte, error)
}

type Engine struct {
	Provider    Provider
	Timeout     time.Duration
	MaxResponse int
}

func (e Engine) Decide(parent context.Context, req ProviderRequest) (Decision, error) {
	if e.Provider == nil || e.Timeout <= 0 {
		return Decision{}, fmt.Errorf("provider and positive timeout are required")
	}
	body, err := invokeProvider(parent, e.Provider, e.Timeout, req)
	if err != nil {
		return Decision{}, err
	}
	limit := e.MaxResponse
	if limit <= 0 {
		limit = 64 << 10
	}
	if len(body) > limit {
		return Decision{}, fmt.Errorf("%w: response exceeds %d bytes", ErrInvalidDecision, limit)
	}
	return parseDecision(body)
}

func parseDecision(body []byte) (Decision, error) {
	return decodeDecisionStrict(body)
}

func ensureEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("multiple JSON values")
		}
		return err
	}
	return nil
}

type ProviderFunc func(context.Context, ProviderRequest) ([]byte, error)

func (f ProviderFunc) Decide(ctx context.Context, req ProviderRequest) ([]byte, error) {
	return f(ctx, req)
}
