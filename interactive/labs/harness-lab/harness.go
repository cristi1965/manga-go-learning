package harness

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
)

var (
	ErrApprovalRequired = errors.New("approval required")
	ErrBindingMismatch  = errors.New("execution binding mismatch")
	ErrUnknownOutcome   = errors.New("unknown outcome")
)

type State string

const (
	Pending     State = "pending"
	Approved    State = "approved"
	Executing   State = "executing"
	Unknown     State = "unknown"
	Completed   State = "completed"
	Quarantined State = "quarantined"
)

type Command struct {
	TenantID, SubjectID, Tool, Input string
}

type Binding struct {
	RunID, StepID, ApprovalID, CallID string
	TenantID, SubjectID, Tool         string
	CommandDigest, GrantNonce         string
	Fence, Version                    uint64
}

type Receipt struct {
	BindingDigest, OutputDigest string
	Committed                   bool
}

type Step struct {
	Binding Binding
	State   State
	Output  string
}

type FakeTool struct {
	mu      sync.Mutex
	calls   map[string]int
	outputs map[string]string
}

func NewFakeTool() *FakeTool {
	return &FakeTool{calls: map[string]int{}, outputs: map[string]string{}}
}

func (t *FakeTool) Execute(binding Binding, cmd Command) (string, Receipt) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if output, ok := t.outputs[binding.CallID]; ok {
		return output, makeReceipt(binding, output)
	}
	t.calls[binding.CallID]++
	output := "bill:" + cmd.Input
	t.outputs[binding.CallID] = output
	return output, makeReceipt(binding, output)
}

func (t *FakeTool) Calls(callID string) int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.calls[callID]
}

type Engine struct {
	mu    sync.Mutex
	steps map[string]*Step
	tool  *FakeTool
}

func NewEngine(tool *FakeTool) *Engine {
	return &Engine{steps: map[string]*Step{}, tool: tool}
}

func (e *Engine) Preflight(runID, stepID, callID string, cmd Command) Binding {
	return Binding{
		RunID: runID, StepID: stepID, CallID: callID,
		TenantID: cmd.TenantID, SubjectID: cmd.SubjectID, Tool: cmd.Tool,
		CommandDigest: digest(cmd.TenantID, cmd.SubjectID, cmd.Tool, cmd.Input),
		GrantNonce:    "server-held-nonce", Fence: 1, Version: 1,
	}
}

func (e *Engine) Approve(binding Binding, principal string) Binding {
	if principal != binding.SubjectID {
		return binding
	}
	binding.ApprovalID = "approval:" + principal
	e.mu.Lock()
	e.steps[binding.StepID] = &Step{Binding: binding, State: Approved}
	e.mu.Unlock()
	return binding
}

func (e *Engine) Execute(binding Binding, cmd Command, loseReceipt bool) (string, error) {
	e.mu.Lock()
	step := e.steps[binding.StepID]
	if step == nil {
		e.mu.Unlock()
		return "", ErrApprovalRequired
	}
	if !sameBinding(step.Binding, binding) || binding.CommandDigest != digest(cmd.TenantID, cmd.SubjectID, cmd.Tool, cmd.Input) {
		e.mu.Unlock()
		return "", ErrBindingMismatch
	}
	if step.State == Completed {
		output := step.Output
		e.mu.Unlock()
		return output, nil
	}
	if step.State != Approved && step.State != Unknown && step.State != Executing {
		e.mu.Unlock()
		return "", ErrApprovalRequired
	}
	step.State = Executing
	e.mu.Unlock()

	output, receipt := e.tool.Execute(binding, cmd)
	if loseReceipt {
		e.mu.Lock()
		step.State = Unknown
		e.mu.Unlock()
		return "", ErrUnknownOutcome
	}
	return e.Settle(binding, output, receipt)
}

func (e *Engine) Reconcile(binding Binding, cmd Command) (string, error) {
	return e.Execute(binding, cmd, false)
}

func (e *Engine) Settle(binding Binding, output string, receipt Receipt) (string, error) {
	if receipt.BindingDigest != bindingDigest(binding) || receipt.OutputDigest != digest(output) || !receipt.Committed {
		return "", ErrBindingMismatch
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	step := e.steps[binding.StepID]
	if step == nil || !sameBinding(step.Binding, binding) {
		return "", ErrBindingMismatch
	}
	step.State, step.Output = Completed, output
	return output, nil
}

func sameBinding(a, b Binding) bool { return bindingDigest(a) == bindingDigest(b) }
func bindingDigest(b Binding) string {
	return digest(b.RunID, b.StepID, b.ApprovalID, b.CallID, b.TenantID, b.SubjectID, b.Tool, b.CommandDigest, b.GrantNonce, fmt.Sprint(b.Fence), fmt.Sprint(b.Version))
}
func makeReceipt(binding Binding, output string) Receipt {
	return Receipt{BindingDigest: bindingDigest(binding), OutputDigest: digest(output), Committed: true}
}
func digest(parts ...string) string {
	var canonical strings.Builder
	for _, part := range parts {
		canonical.WriteString(strconv.Itoa(len(part)))
		canonical.WriteByte(':')
		canonical.WriteString(part)
	}
	return fmt.Sprintf("%x", sha256.Sum256([]byte(canonical.String())))
}
