package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	ledgeragent "example.com/ledger-agent"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "eval" {
		report := ledgeragent.RunEval(context.Background(), ledgeragent.EvidenceVersions{Dataset: "ledger-eval-v1", Prompt: "ledger-prompt-v1", Provider: "static-v1"}, ledgeragent.EvalPolicy{MaxSecurityFailures: 0})
		_ = json.NewEncoder(os.Stdout).Encode(report)
		if !report.Passed {
			os.Exit(1)
		}
		return
	}
	provider := ledgeragent.ProviderFunc(func(_ context.Context, req ledgeragent.ProviderRequest) ([]byte, error) {
		body, _ := json.Marshal(ledgeragent.Decision{Kind: "answer", Answer: "accepted: " + req.Prompt})
		return body, nil
	})
	registry, err := ledgeragent.NewRegistry()
	if err != nil {
		log.Fatal(err)
	}
	store := ledgeragent.NewStore(nil)
	worker := &ledgeragent.Worker{ID: "demo-worker", Store: store, Engine: ledgeragent.Engine{Provider: provider, Timeout: 2 * time.Second}, Registry: registry, LeaseTTL: 10 * time.Second, Versions: ledgeragent.EvidenceVersions{Dataset: "demo-dataset-v1", Prompt: "demo-prompt-v1", Provider: "local-static-v1"}}
	server := &http.Server{Addr: "127.0.0.1:8080", Handler: ledgeragent.API{Store: store, Worker: worker}.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
	log.Printf("ledger-agent listening on http://%s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
