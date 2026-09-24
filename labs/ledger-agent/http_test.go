package ledgeragent

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAPIIdempotencyAndTenantIsolation(t *testing.T) {
	store := NewStore(nil)
	server := httptest.NewServer(API{Store: store}.Handler())
	defer server.Close()
	body := []byte(`{"tenant_id":"t1","idempotency_key":"key","input":"private"}`)
	first := postJSON(t, server.URL+"/runs", body)
	defer first.Body.Close()
	if first.StatusCode != http.StatusAccepted {
		t.Fatalf("first status = %d", first.StatusCode)
	}
	var run Run
	if err := json.NewDecoder(first.Body).Decode(&run); err != nil {
		t.Fatal(err)
	}
	second := postJSON(t, server.URL+"/runs", body)
	defer second.Body.Close()
	if second.StatusCode != http.StatusOK {
		t.Fatalf("second status = %d", second.StatusCode)
	}
	response, err := http.Get(server.URL + "/runs/" + run.ID + "?tenant_id=t2")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNotFound {
		t.Fatalf("cross tenant status = %d", response.StatusCode)
	}
}

func TestAPIAcceptedRunCompletesAfterRequestReturns(t *testing.T) {
	store := NewStore(nil)
	registry, _ := NewRegistry()
	worker := &Worker{ID: "http-worker", Store: store, Registry: registry, LeaseTTL: time.Second, Engine: Engine{Timeout: time.Second, Provider: staticProvider(`{"kind":"answer","answer":"done"}`)}}
	server := httptest.NewServer(API{Store: store, Worker: worker}.Handler())
	defer server.Close()
	response := postJSON(t, server.URL+"/runs", []byte(`{"tenant_id":"t","idempotency_key":"k","input":"x"}`))
	var run Run
	if err := json.NewDecoder(response.Body).Decode(&run); err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	deadline := time.Now().Add(time.Second)
	for {
		got, _, err := store.GetRun("t", run.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Status == StatusCompleted {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("run remained %s", got.Status)
		}
		time.Sleep(time.Millisecond)
	}
}

func TestAPIRejectsUnknownFields(t *testing.T) {
	server := httptest.NewServer(API{Store: NewStore(nil)}.Handler())
	defer server.Close()
	response := postJSON(t, server.URL+"/runs", []byte(`{"tenant_id":"t","idempotency_key":"k","input":"x","admin":true}`))
	defer response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d", response.StatusCode)
	}
}

func postJSON(t *testing.T, url string, body []byte) *http.Response {
	t.Helper()
	response, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	return response
}
