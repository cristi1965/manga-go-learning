//go:build !learner03

package ledgeragent

import "fmt"

func idempotencyIdentity(req CreateRunRequest) (key string, digest string, err error) {
	if req.TenantID == "" || req.IdempotencyKey == "" || req.Input == "" {
		return "", "", fmt.Errorf("tenant_id, idempotency_key and input are required")
	}
	return req.TenantID + "\x00" + req.IdempotencyKey, digestString(req.Input), nil
}
