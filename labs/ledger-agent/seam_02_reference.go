//go:build !learner02

package ledgeragent

import (
	"bytes"
	"encoding/json"
	"fmt"
)

func decodeDecisionStrict(body []byte) (Decision, error) {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	var decision Decision
	if err := decoder.Decode(&decision); err != nil {
		return Decision{}, fmt.Errorf("%w: %v", ErrInvalidDecision, err)
	}
	if err := ensureEOF(decoder); err != nil {
		return Decision{}, fmt.Errorf("%w: %v", ErrInvalidDecision, err)
	}
	switch decision.Kind {
	case "answer":
		if decision.Answer == "" || decision.Tool != "" || len(decision.Arguments) != 0 {
			return Decision{}, fmt.Errorf("%w: answer requires only a non-empty answer", ErrInvalidDecision)
		}
	case "tool":
		if decision.Tool == "" || decision.Answer != "" || len(decision.Arguments) == 0 || !json.Valid(decision.Arguments) {
			return Decision{}, fmt.Errorf("%w: tool requires a name and JSON arguments", ErrInvalidDecision)
		}
	default:
		return Decision{}, fmt.Errorf("%w: unsupported kind %q", ErrInvalidDecision, decision.Kind)
	}
	return decision, nil
}
