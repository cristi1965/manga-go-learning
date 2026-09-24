package ledgeragent

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestRegistryDeniesUnregisteredTool(t *testing.T) {
	registry, _ := NewRegistry()
	if _, err := registry.Execute(context.Background(), ToolCall{}, "ledger.write", json.RawMessage(`{}`)); !errors.Is(err, ErrToolDenied) {
		t.Fatalf("denied error = %v", err)
	}
}

func TestMilestone04ReadFileResistsSymlinkSwap(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "safe.txt"), []byte("safe"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "report.txt")
	tool := ReadFileTool{Root: root}
	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
			}
			_ = os.Remove(link)
			_ = os.Symlink("safe.txt", link)
			_ = os.Remove(link)
			_ = os.Symlink(filepath.Join(outside, "secret.txt"), link)
		}
	}()
	for range 500 {
		result, err := tool.Execute(context.Background(), ToolCall{Arguments: json.RawMessage(`{"path":"report.txt"}`)})
		if err == nil && result != "safe" {
			close(stop)
			wg.Wait()
			t.Fatalf("escaped root: %q", result)
		}
	}
	close(stop)
	wg.Wait()
}

func TestReadFileToolGuardsPathsAndSchema(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "report.txt"), []byte("safe"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	tool := ReadFileTool{Root: root}
	result, err := tool.Execute(context.Background(), ToolCall{Arguments: json.RawMessage(`{"path":"report.txt"}`)})
	if err != nil || result != "safe" {
		t.Fatalf("read = %q, %v", result, err)
	}
	if _, err := tool.Execute(context.Background(), ToolCall{Arguments: json.RawMessage(`{"path":"../secret.txt"}`)}); err == nil {
		t.Fatal("path traversal was accepted")
	}
	link := filepath.Join(root, "link.txt")
	if err := os.Symlink(filepath.Join(outside, "secret.txt"), link); err != nil {
		t.Fatal(err)
	}
	if _, err := tool.Execute(context.Background(), ToolCall{Arguments: json.RawMessage(`{"path":"link.txt"}`)}); err == nil {
		t.Fatal("escaping symlink was accepted")
	}
	if err := tool.Validate(json.RawMessage(`{"path":"report.txt","extra":true}`)); err == nil {
		t.Fatal("unknown argument was accepted")
	}
}
