//go:build !learner01

package ledgeragent

import (
	"context"
	"time"
)

func invokeProvider(parent context.Context, provider Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	body, err := provider.Decide(ctx, req)
	if err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return body, nil
}
