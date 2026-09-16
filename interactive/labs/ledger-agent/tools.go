package ledgeragent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
)

type Tool interface {
	Name() string
	Effect() ToolEffect
	Validate(json.RawMessage) error
	// Write tools must perform their irreversible operation inside call.Commit.
	Execute(context.Context, ToolCall) (string, error)
}

type ToolCall struct {
	TenantID  string
	RunID     string
	StepID    string
	Fence     uint64
	Arguments json.RawMessage
	commit    func(string, func() (string, error)) (string, error)
}

func (c ToolCall) Commit(effectID string, apply func() (string, error)) (string, error) {
	if c.commit == nil {
		return "", ErrStaleLease
	}
	return c.commit(effectID, apply)
}

type Registry struct {
	tools map[string]Tool
}

func NewRegistry(tools ...Tool) (*Registry, error) {
	r := &Registry{tools: make(map[string]Tool, len(tools))}
	for _, tool := range tools {
		if tool == nil || tool.Name() == "" {
			return nil, errors.New("tool name is required")
		}
		if _, exists := r.tools[tool.Name()]; exists {
			return nil, fmt.Errorf("duplicate tool %q", tool.Name())
		}
		r.tools[tool.Name()] = tool
	}
	return r, nil
}

func (r *Registry) Execute(ctx context.Context, call ToolCall, name string, args json.RawMessage) (string, error) {
	tool, ok := r.tools[name]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrToolDenied, name)
	}
	if err := tool.Validate(args); err != nil {
		return "", fmt.Errorf("invalid arguments for %s: %w", name, err)
	}
	call.Arguments = append(json.RawMessage(nil), args...)
	if tool.Effect() == ToolWrite && call.commit == nil {
		return "", ErrStaleLease
	}
	return tool.Execute(ctx, call)
}

type ReadFileTool struct {
	Root     string
	MaxBytes int64
}

func (t ReadFileTool) Name() string       { return "reports.read" }
func (t ReadFileTool) Effect() ToolEffect { return ToolRead }

type readFileArgs struct {
	Path string `json:"path"`
}

func (t ReadFileTool) Validate(raw json.RawMessage) error {
	_, err := decodeReadFileArgs(raw)
	return err
}

func (t ReadFileTool) Execute(ctx context.Context, call ToolCall) (string, error) {
	args, err := decodeReadFileArgs(call.Arguments)
	if err != nil {
		return "", err
	}
	if err := validateToolPath(args.Path); err != nil {
		return "", err
	}
	root, err := os.OpenRoot(t.Root)
	if err != nil {
		return "", err
	}
	defer root.Close()
	file, err := resolve(root, args.Path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	limit := t.MaxBytes
	if limit <= 0 {
		limit = 64 << 10
	}
	reader := io.LimitReader(file, limit+1)
	data, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	if int64(len(data)) > limit {
		return "", fmt.Errorf("report exceeds %d bytes", limit)
	}
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
		return string(data), nil
	}
}

// resolve stays platform-owned: learner04 controls path policy, but cannot
// replace the race-safe os.Root open boundary.
func resolve(root *os.Root, path string) (*os.File, error) {
	return root.Open(path)
}

func decodeReadFileArgs(raw json.RawMessage) (readFileArgs, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var args readFileArgs
	if err := decoder.Decode(&args); err != nil {
		return args, err
	}
	if err := ensureEOF(decoder); err != nil {
		return args, err
	}
	if args.Path == "" {
		return args, errors.New("path is required")
	}
	return args, nil
}
