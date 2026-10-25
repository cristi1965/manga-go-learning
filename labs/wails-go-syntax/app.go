package wailsgosyntax

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
)

var ErrInvalidAmount = errors.New("amount must be positive")

// Bill is the value React receives through the generated Wails binding.
type Bill struct {
	ID          string `json:"id"`
	AmountCents int64  `json:"amount_cents"`
}

type BillStore interface {
	Save(context.Context, Bill) error
}

type App struct {
	mu    sync.RWMutex
	ctx   context.Context
	store BillStore
	count int
}

func NewApp(store BillStore) *App {
	return &App{store: store}
}

// OnStartup matches the lifecycle function passed to Wails options.App.
func (a *App) OnStartup(ctx context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.ctx = ctx
}

func (a *App) PreviewBill(id string, amountCents int64) (Bill, error) {
	if amountCents <= 0 {
		return Bill{}, fmt.Errorf("preview bill %s: %w", id, ErrInvalidAmount)
	}
	return Bill{ID: id, AmountCents: amountCents}, nil
}

func (a *App) PreviewJSON(id string, amountCents int64) (string, error) {
	bill, err := a.PreviewBill(id, amountCents)
	if err != nil {
		return "", err
	}
	raw, err := json.Marshal(bill)
	if err != nil {
		return "", fmt.Errorf("encode bill: %w", err)
	}
	return string(raw), nil
}

func (a *App) SaveBill(id string, amountCents int64) (Bill, error) {
	bill, err := a.PreviewBill(id, amountCents)
	if err != nil {
		return Bill{}, err
	}
	ctx := a.startupContext()
	if err := a.store.Save(ctx, bill); err != nil {
		return Bill{}, fmt.Errorf("save bill %s: %w", id, err)
	}
	return bill, nil
}

func (a *App) WaitForCancel() error {
	ctx := a.startupContext()
	<-ctx.Done()
	return ctx.Err()
}

func (a *App) RefreshCount() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.count++
	return a.count
}

func (a *App) startupContext() context.Context {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.ctx == nil {
		return context.Background()
	}
	return a.ctx
}

type MemoryStore struct {
	mu    sync.Mutex
	bills []Bill
}

func (s *MemoryStore) Save(ctx context.Context, bill Bill) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bills = append(s.bills, bill)
	return nil
}

func (s *MemoryStore) Count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.bills)
}
