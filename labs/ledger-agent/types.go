package ledgeragent

import (
	"encoding/json"
	"errors"
	"time"
)

var (
	ErrNotFound            = errors.New("not found")
	ErrIdempotencyConflict = errors.New("idempotency key reused with different input")
	ErrLeaseHeld           = errors.New("step lease is still held")
	ErrStaleLease          = errors.New("stale or expired lease")
	ErrTerminal            = errors.New("run is already terminal")
	ErrToolDenied          = errors.New("tool is not registered by the server")
	ErrInvalidDecision     = errors.New("invalid provider decision")
	ErrBackpressure        = errors.New("worker capacity exhausted")
)

type Status string

const (
	StatusQueued    Status = "queued"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusCanceled  Status = "canceled"
)

func (s Status) Terminal() bool {
	return s == StatusCompleted || s == StatusFailed || s == StatusCanceled
}

type Run struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	IdempotencyKey string    `json:"idempotency_key"`
	InputDigest    string    `json:"input_digest"`
	TraceID        string    `json:"trace_id"`
	Status         Status    `json:"status"`
	StepID         string    `json:"step_id"`
	Result         string    `json:"result,omitempty"`
	ErrorCategory  string    `json:"error_category,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Step struct {
	ID         string    `json:"id"`
	RunID      string    `json:"run_id"`
	Status     Status    `json:"status"`
	Attempt    int       `json:"attempt"`
	Fence      uint64    `json:"fence"`
	LeaseOwner string    `json:"lease_owner,omitempty"`
	LeaseUntil time.Time `json:"lease_until,omitempty"`
}

type Lease struct {
	RunID      string
	StepID     string
	TenantID   string
	WorkerID   string
	Token      string
	Fence      uint64
	LeaseUntil time.Time
}

type Event struct {
	Sequence int64           `json:"sequence"`
	RunID    string          `json:"run_id"`
	Type     string          `json:"type"`
	At       time.Time       `json:"at"`
	Data     json.RawMessage `json:"data,omitempty"`
}

type AuditRecord struct {
	ID              string        `json:"id"`
	TenantID        string        `json:"tenant_id"`
	RunID           string        `json:"run_id"`
	Action          string        `json:"action"`
	InputDigest     string        `json:"input_digest,omitempty"`
	TraceID         string        `json:"trace_id"`
	DatasetVersion  string        `json:"dataset_version,omitempty"`
	PromptVersion   string        `json:"prompt_version,omitempty"`
	ProviderVersion string        `json:"provider_version,omitempty"`
	Duration        time.Duration `json:"duration_ns,omitempty"`
	Result          string        `json:"result,omitempty"`
	Category        string        `json:"category,omitempty"`
	At              time.Time     `json:"at"`
}

type EvidenceVersions struct {
	Dataset  string `json:"dataset"`
	Prompt   string `json:"prompt"`
	Provider string `json:"provider"`
}

type ToolEffect string

const (
	ToolRead  ToolEffect = "read"
	ToolWrite ToolEffect = "write"
)

type CreateRunRequest struct {
	TenantID       string `json:"tenant_id"`
	IdempotencyKey string `json:"idempotency_key"`
	Input          string `json:"input"`
}

type Decision struct {
	Kind      string          `json:"kind"`
	Answer    string          `json:"answer,omitempty"`
	Tool      string          `json:"tool,omitempty"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}
