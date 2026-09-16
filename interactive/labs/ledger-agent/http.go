package ledgeragent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	Store             *Store
	Worker            *Worker
	WorkerConcurrency int
	SSEHeartbeat      time.Duration
	workerSlots       chan struct{}
}

func (a API) Handler() http.Handler {
	if a.WorkerConcurrency <= 0 {
		a.WorkerConcurrency = 4
	}
	if a.SSEHeartbeat <= 0 {
		a.SSEHeartbeat = 15 * time.Second
	}
	a.workerSlots = make(chan struct{}, a.WorkerConcurrency)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /runs", a.createRun)
	mux.HandleFunc("GET /runs/{id}", a.getRun)
	mux.HandleFunc("POST /runs/{id}/cancel", a.cancelRun)
	mux.HandleFunc("GET /runs/{id}/events", a.events)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return mux
}

func (a API) createRun(w http.ResponseWriter, r *http.Request) {
	var req CreateRunRequest
	if err := decodeRequest(w, r, &req); err != nil {
		return
	}
	reserved := false
	if a.Worker != nil {
		reserved = reserveWorkerSlot(a.workerSlots)
		if !reserved {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": ErrBackpressure.Error()})
			return
		}
	}
	run, created, err := a.Store.CreateRun(r.Context(), req)
	if err != nil {
		if reserved {
			<-a.workerSlots
		}
		writeStoreError(w, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusAccepted
	}
	writeJSON(w, status, run)
	if created && a.Worker != nil {
		// The accepted Run outlives the HTTP request. Cancellation is a Run command,
		// not an accidental consequence of the client closing this response.
		go func() {
			defer func() { <-a.workerSlots }()
			_ = a.Worker.Process(context.Background(), run.TenantID, run.ID)
		}()
	} else if reserved {
		<-a.workerSlots
	}
}

func (a API) getRun(w http.ResponseWriter, r *http.Request) {
	tenant := r.URL.Query().Get("tenant_id")
	run, step, err := a.Store.GetRun(tenant, r.PathValue("id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run": run, "step": step})
}

func (a API) cancelRun(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string `json:"tenant_id"`
	}
	if err := decodeRequest(w, r, &req); err != nil {
		return
	}
	run, err := a.Store.Cancel(r.Context(), req.TenantID, r.PathValue("id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (a API) events(w http.ResponseWriter, r *http.Request) {
	cursor := r.Header.Get("Last-Event-ID")
	if cursor == "" {
		cursor = r.URL.Query().Get("after")
	}
	after, err := strconv.ParseInt(defaultString(cursor, "0"), 10, 64)
	if err != nil || after < 0 {
		http.Error(w, "invalid after sequence", http.StatusBadRequest)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	heartbeat := time.NewTicker(a.SSEHeartbeat)
	defer heartbeat.Stop()
	for {
		events, terminal, wake, err := a.Store.EventSnapshot(r.URL.Query().Get("tenant_id"), r.PathValue("id"), after)
		if err != nil {
			writeStoreError(w, err)
			return
		}
		for _, event := range events {
			_, _ = fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", event.Sequence, event.Type, event.Data)
			after = event.Sequence
		}
		if len(events) > 0 {
			flusher.Flush()
		}
		if terminal {
			return
		}
		select {
		case <-r.Context().Done():
			return
		case <-wake:
		case <-heartbeat.C:
			_, _ = io.WriteString(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func decodeRequest(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		http.Error(w, "invalid JSON request", http.StatusBadRequest)
		return err
	}
	if err := ensureEOF(decoder); err != nil {
		http.Error(w, "request must contain one JSON value", http.StatusBadRequest)
		return err
	}
	return nil
}

func writeStoreError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, ErrIdempotencyConflict), errors.Is(err, ErrLeaseHeld), errors.Is(err, ErrStaleLease), errors.Is(err, ErrTerminal):
		status = http.StatusConflict
	case strings.Contains(err.Error(), "required"):
		status = http.StatusBadRequest
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
