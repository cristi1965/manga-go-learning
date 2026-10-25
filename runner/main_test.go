package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

func testServer() *server {
	return &server{slots: make(chan struct{}, 2), book: book{Chapters: []unit{{
		ID: "chapter-1", Code: "package main\nfunc main() {}\n",
	}}}}
}

func TestRunRejectsCrossOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/run", strings.NewReader(`{"unitId":"chapter-1"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://evil.example")
	response := httptest.NewRecorder()
	testServer().run(response, req)
	if response.Code != http.StatusForbidden {
		t.Fatalf("status=%d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestRunRejectsTrailingJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/run", strings.NewReader(`{"unitId":"chapter-1"} trailing`))
	req.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	testServer().run(response, req)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status=%d, want %d", response.Code, http.StatusBadRequest)
	}
}

func TestRunRejectsWrongContentType(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/run", strings.NewReader(`{"unitId":"chapter-1"}`))
	response := httptest.NewRecorder()
	testServer().run(response, req)
	if response.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status=%d, want %d", response.Code, http.StatusUnsupportedMediaType)
	}
}

func TestRunRejectsNonLoopbackHostWithoutOrigin(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "http://evil.example/api/run", strings.NewReader(`{"unitId":"chapter-1"}`))
	req.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	testServer().run(response, req)
	if response.Code != http.StatusForbidden {
		t.Fatalf("status=%d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestRunRejectsOversizedBody(t *testing.T) {
	body := `{"unitId":"chapter-1","code":"` + strings.Repeat("x", maxCode+(5<<10)) + `"}`
	req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	testServer().run(response, req)
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status=%d, want %d", response.Code, http.StatusRequestEntityTooLarge)
	}
}

func TestDatabaseCompletionRequiresBoundRunProofAndAnswers(t *testing.T) {
	lesson := databaseCourseUnit{ID: "db-01"}
	lesson.Prediction.CorrectIndex = 2
	lesson.Quiz.CorrectIndex = 1
	s := &server{
		database:  map[string]databaseCourseUnit{"db-01": lesson},
		dbVersion: "22.0.0",
		runProofs: make(map[string]runProof),
	}
	digest := "sha256:database-code"
	proof := s.issueRunProof("db-01", digest)
	prediction := 2
	requestBody := checkRequest{UnitID: "db-01", FoundationPrediction: &prediction, QuizAnswers: []int{1}, CodeDigest: digest, RunProof: proof}
	encoded, err := json.Marshal(requestBody)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/check", strings.NewReader(string(encoded)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	s.check(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var result checkResponse
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if !result.OK || result.CompletionDigest == "" || result.VerifierVersion != "22.0.0" {
		t.Fatalf("incomplete database proof: %+v", result)
	}

	requestBody.QuizAnswers = []int{0}
	encoded, _ = json.Marshal(requestBody)
	request = httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/check", strings.NewReader(string(encoded)))
	request.Header.Set("Content-Type", "application/json")
	response = httptest.NewRecorder()
	s.check(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("wrong answer status=%d, want 422", response.Code)
	}
}

func TestProjectCompletionRequiresOneBoundCombinedRunProof(t *testing.T) {
	project := unit{ID: "supplement-go-ai-01"}
	project.ProjectLab.ID = "ledger-agent-lab/provider"
	project.SelfCheck = append(project.SelfCheck, struct {
		CorrectIndex int `json:"correctIndex"`
	}{CorrectIndex: 1})
	server := &server{
		book:      book{Version: "test", Chapters: []unit{{ID: "chapter-16", Supplements: []unit{project}}}},
		exercises: map[string]codeExercise{project.ID: {Code: "package exercise"}},
		runProofs: make(map[string]runProof),
	}
	challengeDigest := "sha256:challenge-verified"
	challengeProof := server.issueRunProof(project.ID, challengeDigest)

	check := func(t *testing.T, body checkRequest, want int) checkResponse {
		t.Helper()
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/check", strings.NewReader(string(encoded)))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		server.check(response, request)
		if response.Code != want {
			t.Fatalf("status=%d, want %d, body=%s", response.Code, want, response.Body.String())
		}
		var result checkResponse
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		return result
	}

	base := checkRequest{UnitID: project.ID, QuizAnswers: []int{1}}
	t.Run("missing challenge proof", func(t *testing.T) {
		check(t, base, http.StatusUnprocessableEntity)
	})
	t.Run("challenge proof bound to wrong unit", func(t *testing.T) {
		request := base
		request.ChallengeDigest = challengeDigest
		request.ChallengeRunProof = server.issueRunProof("supplement-go-ai-02", challengeDigest)
		check(t, request, http.StatusUnprocessableEntity)
	})
	t.Run("complete combined evidence", func(t *testing.T) {
		request := base
		request.ChallengeDigest = challengeDigest
		request.ChallengeRunProof = challengeProof
		result := check(t, request, http.StatusOK)
		if !result.OK || result.CompletionDigest == "" {
			t.Fatalf("expected completion evidence, got %+v", result)
		}
	})
}

func TestRunFilesTimeoutReturns(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, _, err := runFiles(ctx, map[string]string{
		"main.go": "package main\nfunc main(){ for {} }\n",
	}, "go", "run", "main.go")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err=%v, want deadline exceeded", err)
	}
	if elapsed := time.Since(started); elapsed > 4*time.Second {
		t.Fatalf("timeout cleanup took %v", elapsed)
	}
}

func TestRunExternalCommandTimeoutKillsProcessGroup(t *testing.T) {
	dir := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, _, err := runExternalCommand(ctx, dir, "/bin/sh", "-c", "sleep 30 & echo $! > child.pid; wait")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err=%v, want deadline exceeded", err)
	}
	if elapsed := time.Since(started); elapsed > 4*time.Second {
		t.Fatalf("timeout cleanup took %v", elapsed)
	}
	value, err := os.ReadFile(filepath.Join(dir, "child.pid"))
	if err != nil {
		t.Fatal(err)
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(value)))
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		err = syscall.Kill(pid, 0)
		if errors.Is(err, syscall.ESRCH) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("child process %d survived process-group cancellation: %v", pid, err)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestLedgerRunDeadlineReturnsStructuredUnprocessableEntity(t *testing.T) {
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	code := `package ledgeragent
import ("context"; "time")
func invokeProvider(parent context.Context, p Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) { return p.Decide(parent, req) }
`
	body, err := json.Marshal(runRequest{UnitID: "ledger-agent-lab/provider", Code: code})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/run", strings.NewReader(string(body))).WithContext(ctx)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	s := testServer()
	s.root = projectFixture(t)
	s.run(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d, want %d, body=%s", response.Code, http.StatusUnprocessableEntity, response.Body.String())
	}
	var result runResponse
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("response is not structured JSON: %v; body=%s", err, response.Body.String())
	}
	if result.OK || result.VerifierVersion != "" || !strings.Contains(result.Output, "已停止") {
		t.Fatalf("unexpected timeout response: %+v", result)
	}
}

func TestProjectRunCompilesLearnerSourceInsideLedgerAgent(t *testing.T) {
	root := projectFixture(t)
	s := &server{
		root:      root,
		book:      book{Version: "test"},
		exercises: map[string]codeExercise{"supplement-go-ai-01": {Test: fixtureLearnerContract}},
		slots:     make(chan struct{}, 2),
		runProofs: make(map[string]runProof),
	}
	code := `package ledgeragent

import (
	"context"
	"time"
)

func invokeProvider(parent context.Context, p Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	return p.Decide(ctx, req)
}
`

	for _, unitID := range []string{"exercise-supplement-go-ai-01", "ledger-agent-lab/provider"} {
		t.Run(unitID, func(t *testing.T) {
			result, status := runProjectRequest(t, s, unitID, code)
			if status != http.StatusOK || !result.OK {
				t.Fatalf("status=%d result=%+v", status, result)
			}
			if !strings.Contains(result.Command, "-tags learner01") || !strings.Contains(result.Command, "TestMilestone01") || !strings.Contains(result.Command, "TestLearner01") {
				t.Fatalf("command did not select the learner seam: %q", result.Command)
			}
			if !strings.Contains(result.Output, "TestMilestone01LearnerProvider") || !strings.Contains(result.Output, "PASS") {
				t.Fatalf("named milestone did not run:\n%s", result.Output)
			}
			if result.ArtifactDigest == "" || result.RunProof == "" {
				t.Fatalf("successful compiled source did not receive evidence: %+v", result)
			}
		})
	}
}

func TestProjectRunRejectsEmptyWrongPackageAndCrossSeam(t *testing.T) {
	s := &server{
		root:      projectFixture(t),
		book:      book{Version: "test"},
		exercises: map[string]codeExercise{"supplement-go-ai-01": {Test: fixtureLearnerContract}},
		slots:     make(chan struct{}, 2),
		runProofs: make(map[string]runProof),
	}
	tests := []struct {
		name string
		code string
	}{
		{name: "empty submission", code: ""},
		{name: "old standalone package", code: "package main\nfunc main() {}\n"},
		{name: "cross seam helper", code: "package ledgeragent\nfunc validateFence(current, submitted uint64) error { return nil }\n"},
		{name: "extra declaration", code: "package ledgeragent\nvar bypass = true\nfunc invokeProvider() {}\n"},
		{name: "process exit bypass", code: "package ledgeragent\nimport (\"context\";\"os\";\"time\")\nfunc invokeProvider(context.Context, Provider, time.Duration, ProviderRequest) ([]byte,error){os.Exit(0);return nil,nil}\n"},
		{name: "localhost network bypass", code: "package ledgeragent\nimport (\"context\";\"net/http\";\"time\")\nfunc invokeProvider(context.Context, Provider, time.Duration, ProviderRequest) ([]byte,error){_,_=http.Get(\"http://127.0.0.1:4173/api/health\");return nil,nil}\n"},
		{name: "cgo forged pass bypass", code: "package ledgeragent\n/* #include <stdlib.h> */\nimport \"C\"\nimport (\"context\";\"time\")\nfunc invokeProvider(context.Context, Provider, time.Duration, ProviderRequest) ([]byte,error){C.exit(0);return nil,nil}\n"},
		{name: "alternate localhost network bypass", code: "package ledgeragent\nimport (\"context\";\"net/rpc\";\"time\")\nfunc invokeProvider(context.Context, Provider, time.Duration, ProviderRequest) ([]byte,error){_,_=rpc.DialHTTP(\"tcp\",\"127.0.0.1:4173\");return nil,nil}\n"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result, status := runProjectRequest(t, s, "ledger-agent-lab/provider", test.code)
			if status != http.StatusUnprocessableEntity || result.OK || result.RunProof != "" {
				t.Fatalf("status=%d result=%+v", status, result)
			}
		})
	}
	t.Run("compiles but fails deadline contract", func(t *testing.T) {
		code := `package ledgeragent
import ("context"; "time")
func invokeProvider(context.Context, Provider, time.Duration, ProviderRequest) ([]byte, error) { return nil, nil }
`
		result, status := runProjectRequest(t, s, "exercise-supplement-go-ai-01", code)
		if status != http.StatusUnprocessableEntity || result.OK || result.RunProof != "" {
			t.Fatalf("status=%d result=%+v", status, result)
		}
		if !strings.Contains(result.Output, "TestLearner01ProviderDeadline") || !strings.Contains(result.Output, "derived timeout was not propagated") {
			t.Fatalf("wrong implementation did not receive an actionable deadline failure:\n%s", result.Output)
		}
	})
}

func TestValidateProjectTestOutputRequiresBothNamedTests(t *testing.T) {
	complete := "--- PASS: TestMilestone01LearnerProvider (0.00s)\n--- PASS: TestLearner01Contract (0.00s)\n"
	if err := validateProjectTestOutput("01", complete); err != nil {
		t.Fatalf("complete output rejected: %v", err)
	}
	for name, output := range map[string]string{
		"missing milestone": "--- PASS: TestLearner01Contract (0.00s)\n",
		"missing contract":  "--- PASS: TestMilestone01LearnerProvider (0.00s)\n",
		"empty":             "",
	} {
		t.Run(name, func(t *testing.T) {
			if err := validateProjectTestOutput("01", output); err == nil || !strings.Contains(err.Error(), "project tests did not complete") {
				t.Fatalf("incomplete output accepted: %q err=%v", output, err)
			}
		})
	}
}

func TestProjectRunRejectsSymlinkInLedgerSource(t *testing.T) {
	root := projectFixture(t)
	target := filepath.Join(root, "labs", "ledger-agent", "target.go")
	if err := os.WriteFile(target, []byte("package ledgeragent\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, filepath.Join(root, "labs", "ledger-agent", "linked.go")); err != nil {
		t.Fatal(err)
	}
	s := &server{root: root}
	seam, _ := projectSeamForLab("ledger-agent-lab/provider")
	code := `package ledgeragent
import ("context"; "time")
func invokeProvider(parent context.Context, p Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) { return nil, nil }
`
	_, _, err := s.runProjectSeam(context.Background(), seam, code)
	if err == nil || !strings.Contains(err.Error(), "不允许的文件类型") {
		t.Fatalf("symlink was not rejected: %v", err)
	}
}

const fixtureCapstoneContract = `package main

import "testing"

func TestCoordinateAndReceipt(t *testing.T) {
	receipt, err := CoordinateAndReceipt(RunRequest{TenantID: "tenant", RunID: "run", Input: "input"}, "call", func(string) (string, error) {
		return "bill", nil
	})
	if err != nil || receipt.Outcome != "succeeded" || receipt.Digest == "" {
		t.Fatalf("basic receipt failed: %#v err=%v", receipt, err)
	}
}
`

const fixtureCapstoneSolution = `package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
)

var ErrInvalidRun = errors.New("invalid run parameters")

type RunRequest struct {
	TenantID string
	RunID string
	Input string
}

type RunReceipt struct {
	TenantID string
	RunID string
	CallID string
	Outcome string
	Digest string
}

func CoordinateAndReceipt(req RunRequest, callID string, execute func(string) (string, error)) (RunReceipt, error) {
	if req.TenantID == "" || req.RunID == "" || callID == "" {
		return RunReceipt{}, ErrInvalidRun
	}
	receipt := RunReceipt{TenantID: req.TenantID, RunID: req.RunID, CallID: callID}
	output, err := execute(req.Input)
	if err != nil {
		receipt.Outcome = "failed"
		return receipt, nil
	}
	receipt.Outcome = "succeeded"
	receipt.Digest = fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(output)))
	return receipt, nil
}
`

func TestCapstoneLabRunsChapter24ContractAndBindsProof(t *testing.T) {
	chapter := unit{ID: "chapter-24"}
	chapter.ProjectLab.ID = "ledger-agent-lab/capstone"
	s := &server{
		root:      projectFixture(t),
		book:      book{Version: "test", Chapters: []unit{chapter}},
		exercises: map[string]codeExercise{"chapter-24": {Test: fixtureCapstoneContract}},
		slots:     make(chan struct{}, 2),
		runProofs: make(map[string]runProof),
	}
	result, status := runProjectRequest(t, s, "ledger-agent-lab/capstone", fixtureCapstoneSolution)
	if status != http.StatusOK || !result.OK {
		t.Fatalf("status=%d result=%+v", status, result)
	}
	if !strings.Contains(result.Command, "go test -race -timeout 5s -v -run "+capstoneTestPattern) {
		t.Fatalf("unexpected capstone command: %q", result.Command)
	}
	for _, name := range []string{
		"TestCoordinateAndReceipt",
		"TestCapstoneInputDraftConfirmBillReceipt",
		"TestCapstoneRejectsInvalidIdentityBeforeDraft",
		"TestCapstoneFailedBillHasNoSuccessDigest",
	} {
		if !strings.Contains(result.Output, "--- PASS: "+name) {
			t.Fatalf("capstone output missing %s:\n%s", name, result.Output)
		}
	}
	challenge := sha256.Sum256([]byte("test\x00exercise-chapter-24\x00" + fixtureCapstoneSolution))
	if !s.validBoundRunProof(result.RunProof, "ledger-agent-lab/capstone", result.ArtifactDigest, fmt.Sprintf("sha256:%x", challenge)) {
		t.Fatal("capstone proof was not bound to the chapter-24 exercise source")
	}
}

func TestCapstoneAndBackpressureUseDistinctLabIDs(t *testing.T) {
	if _, ok := projectSeamForLab("ledger-agent-lab/capstone"); ok {
		t.Fatal("capstone must not resolve to a milestone seam")
	}
	if _, ok := projectSeamForLab("ledger-agent-lab/all"); ok {
		t.Fatal("legacy all alias must not resolve to milestone 08")
	}
	seam, ok := projectSeamForLab("ledger-agent-lab/backpressure")
	if !ok || seam.Number != "08" || seam.Function != "reserveWorkerSlot" {
		t.Fatalf("backpressure seam = %+v ok=%v", seam, ok)
	}
}

func TestCapstoneRejectsLedgerAgentPackage(t *testing.T) {
	s := &server{
		book:      book{Version: "test"},
		exercises: map[string]codeExercise{"chapter-24": {Test: fixtureCapstoneContract}},
		slots:     make(chan struct{}, 2),
		runProofs: make(map[string]runProof),
	}
	result, status := runProjectRequest(t, s, "ledger-agent-lab/capstone", "package ledgeragent\n")
	if status != http.StatusUnprocessableEntity || result.OK || !strings.Contains(result.Output, "必须使用 package main") {
		t.Fatalf("status=%d result=%+v", status, result)
	}
}

func TestMilestone01BlockingImplementationReturnsConcreteFailureQuickly(t *testing.T) {
	s := &server{
		root:      projectFixture(t),
		book:      book{Version: "test"},
		exercises: map[string]codeExercise{"supplement-go-ai-01": {Test: fixtureLearnerContract}},
		slots:     make(chan struct{}, 2),
		runProofs: make(map[string]runProof),
	}
	code := `package ledgeragent
import ("context"; "time")
func invokeProvider(_ context.Context, provider Provider, _ time.Duration, req ProviderRequest) ([]byte, error) {
	return provider.Decide(context.Background(), req)
}
`
	started := time.Now()
	result, status := runProjectRequest(t, s, "exercise-supplement-go-ai-01", code)
	if elapsed := time.Since(started); elapsed > 15*time.Second {
		t.Fatalf("blocking M1 implementation took %v", elapsed)
	}
	if status != http.StatusUnprocessableEntity || result.OK || result.RunProof != "" {
		t.Fatalf("status=%d result=%+v", status, result)
	}
	if !strings.Contains(result.Output, "invokeProvider did not return within 250ms") {
		t.Fatalf("M1 failure is not actionable:\n%s", result.Output)
	}
	if strings.Contains(result.Output, "运行超过 30 秒") {
		t.Fatalf("M1 fell through to the outer request timeout:\n%s", result.Output)
	}
}

func runProjectRequest(t *testing.T, s *server, unitID, code string) (runResponse, int) {
	t.Helper()
	encoded, err := json.Marshal(runRequest{UnitID: unitID, Code: code})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:4173/api/run", strings.NewReader(string(encoded)))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	s.run(response, request)
	var result runResponse
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, response.Body.String())
	}
	return result, response.Code
}

func projectFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	dir := filepath.Join(root, "labs", "ledger-agent")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"go.mod": "module example.test/ledgeragent\n\ngo 1.22\n",
		"provider.go": `package ledgeragent

import "context"

type ProviderRequest struct { Prompt string }
type Provider interface { Decide(context.Context, ProviderRequest) ([]byte, error) }
`,
		"milestone_01_learner_test.go": `//go:build learner01

package ledgeragent

import (
	"context"
	"testing"
	"time"
)

type fixtureProvider struct{}
func (fixtureProvider) Decide(context.Context, ProviderRequest) ([]byte, error) { return []byte("learner-compiled"), nil }

func TestMilestone01LearnerProvider(t *testing.T) {
	got, err := invokeProvider(context.Background(), fixtureProvider{}, time.Second, ProviderRequest{})
	if err != nil || string(got) != "learner-compiled" { t.Fatalf("got=%q err=%v", got, err) }
}
`,
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

const fixtureLearnerContract = `package ledgeragent

import (
	"context"
	"testing"
	"time"
)

func TestLearner01Contract(t *testing.T) {
	got, err := invokeProvider(context.Background(), fixtureProvider{}, time.Second, ProviderRequest{})
	if err != nil || string(got) != "learner-compiled" { t.Fatalf("got=%q err=%v", got, err) }
}
`
