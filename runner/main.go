package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed exercises.json
var embeddedExercises []byte

//go:embed rubrics.json
var embeddedRubrics []byte

//go:embed database_curriculum.json
var embeddedDatabaseCurriculum []byte

const maxOutput = 32 << 10
const maxCode = 64 << 10

type unit struct {
	ID               string            `json:"id"`
	Code             string            `json:"code"`
	Goal             string            `json:"goal"`
	Task             string            `json:"task"`
	Accept           string            `json:"accept"`
	FoundationLesson *foundationLesson `json:"foundationLesson"`
	Supplements      []unit            `json:"supplements"`
	SelfCheck        []struct {
		CorrectIndex int `json:"correctIndex"`
	} `json:"selfCheck"`
	ProjectLab struct {
		ID string `json:"id"`
	} `json:"projectLab"`
}

type foundationLesson struct {
	Code               string `json:"code"`
	ChangeMarker       string `json:"changeMarker"`
	ChangedOutputCheck string `json:"changedOutputCheck"`
	Prediction         struct {
		CorrectIndex int `json:"correctIndex"`
	} `json:"prediction"`
}

type book struct {
	Version  string `json:"version"`
	Chapters []unit `json:"chapters"`
}

type databaseCurriculum struct {
	Version string `json:"version"`
	Tracks  []struct {
		Units []databaseCourseUnit `json:"units"`
	} `json:"tracks"`
}

type databaseCourseUnit struct {
	ID         string `json:"id"`
	Prediction struct {
		CorrectIndex int `json:"correctIndex"`
	} `json:"prediction"`
	Quiz struct {
		CorrectIndex int `json:"correctIndex"`
	} `json:"quiz"`
}

type runRequest struct {
	UnitID string `json:"unitId"`
	Code   string `json:"code"`
}

type runResponse struct {
	OK              bool   `json:"ok"`
	Command         string `json:"command"`
	Output          string `json:"output"`
	Duration        int64  `json:"durationMs"`
	ArtifactDigest  string `json:"artifactDigest,omitempty"`
	RunProof        string `json:"runProof,omitempty"`
	VerifierVersion string `json:"verifierVersion"`
}

type checkRequest struct {
	UnitID                     string   `json:"unitId"`
	Answers                    []string `json:"answers"`
	QuizAnswers                []int    `json:"quizAnswers,omitempty"`
	CodeDigest                 string   `json:"codeDigest,omitempty"`
	RunProof                   string   `json:"runProof,omitempty"`
	FoundationBaselineDigest   string   `json:"foundationBaselineDigest,omitempty"`
	FoundationBaselineRunProof string   `json:"foundationBaselineRunProof,omitempty"`
	FoundationChangedDigest    string   `json:"foundationChangedDigest,omitempty"`
	FoundationChangedRunProof  string   `json:"foundationChangedRunProof,omitempty"`
	FoundationPrediction       *int     `json:"foundationPrediction,omitempty"`
	ChallengeDigest            string   `json:"challengeDigest,omitempty"`
	ChallengeRunProof          string   `json:"challengeRunProof,omitempty"`
}

type checkResponse struct {
	OK               bool   `json:"ok"`
	Message          string `json:"message"`
	ArtifactDigest   string `json:"artifactDigest,omitempty"`
	CompletionDigest string `json:"completionDigest,omitempty"`
	VerifierVersion  string `json:"verifierVersion"`
}

type codeExercise struct {
	Code string `json:"code"`
	Test string `json:"test"`
	Race bool   `json:"race"`
}

type projectSeam struct {
	Number   string
	LabName  string
	Function string
	Inputs   []string
	Outputs  []string
}

var projectSeams = []projectSeam{
	{Number: "01", LabName: "provider", Function: "invokeProvider", Inputs: []string{"context.Context", "Provider", "time.Duration", "ProviderRequest"}, Outputs: []string{"[]byte", "error"}},
	{Number: "02", LabName: "decision", Function: "decodeDecisionStrict", Inputs: []string{"[]byte"}, Outputs: []string{"Decision", "error"}},
	{Number: "03", LabName: "run", Function: "idempotencyIdentity", Inputs: []string{"CreateRunRequest"}, Outputs: []string{"string", "string", "error"}},
	{Number: "04", LabName: "tool", Function: "validateToolPath", Inputs: []string{"string"}, Outputs: []string{"error"}},
	{Number: "05", LabName: "worker", Function: "validateFence", Inputs: []string{"time.Time", "*record", "Lease"}, Outputs: []string{"error"}},
	{Number: "06", LabName: "events", Function: "copyEventsAfter", Inputs: []string{"[]Event", "int64"}, Outputs: []string{"[]Event"}},
	{Number: "07", LabName: "eval", Function: "AssessEval", Inputs: []string{"EvidenceVersions", "EvalPolicy", "[]EvalResult"}, Outputs: []string{"EvalReport"}},
	{Number: "08", LabName: "backpressure", Function: "reserveWorkerSlot", Inputs: []string{"chan struct{}"}, Outputs: []string{"bool"}},
}

const milestone01LearnerContract = `package ledgeragent

import (
	"context"
	"errors"
	"testing"
	"time"
)

type learnerDeadlineProvider func(context.Context, ProviderRequest) ([]byte, error)

func (f learnerDeadlineProvider) Decide(ctx context.Context, req ProviderRequest) ([]byte, error) {
	return f(ctx, req)
}

func TestLearner01ProviderDeadline(t *testing.T) {
	call := func(parent context.Context, timeout time.Duration) <-chan error {
		result := make(chan error, 1)
		probe := learnerDeadlineProvider(func(ctx context.Context, _ ProviderRequest) ([]byte, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		})
		go func() {
			_, err := invokeProvider(parent, probe, timeout, ProviderRequest{})
			result <- err
		}()
		return result
	}

	select {
	case err := <-call(context.Background(), 5*time.Millisecond):
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("derived timeout was not propagated: got %v, want context deadline exceeded", err)
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatal("invokeProvider did not return within 250ms; derive a timeout context and pass it to Provider.Decide")
	}

	parent, cancel := context.WithCancel(context.Background())
	cancel()
	select {
	case err := <-call(parent, time.Second):
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("parent cancellation was not propagated: got %v, want context canceled", err)
		}
	case <-time.After(250 * time.Millisecond):
		t.Fatal("invokeProvider ignored an already canceled parent context")
	}
}
`

const milestone01Support = `package ledgeragent

import "context"

type ProviderRequest struct {
	TenantID string
	RunID string
	Prompt string
}

type Provider interface {
	Decide(context.Context, ProviderRequest) ([]byte, error)
}
`

const capstoneFlowContract = `package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"reflect"
	"testing"
)

func TestCapstoneInputDraftConfirmBillReceipt(t *testing.T) {
	events := []string{"input"}
	calls := 0
	receipt, err := CoordinateAndReceipt(RunRequest{
		TenantID: "tenant-shop", RunID: "run-entry-0827", Input: "milk-tea:1200",
	}, "call-create-bill-0827", func(input string) (string, error) {
		calls++
		if input != "milk-tea:1200" {
			t.Fatalf("pipeline input = %q, want original request input", input)
		}
		events = append(events, "draft", "confirm", "bill")
		return "bill-0827", nil
	})
	events = append(events, "receipt")
	if err != nil {
		t.Fatalf("successful pipeline returned error: %v", err)
	}
	if calls != 1 {
		t.Fatalf("trusted draft-confirm-bill pipeline called %d times, want exactly once", calls)
	}
	if want := []string{"input", "draft", "confirm", "bill", "receipt"}; !reflect.DeepEqual(events, want) {
		t.Fatalf("pipeline events = %v, want %v", events, want)
	}
	wantDigest := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte("bill-0827")))
	if receipt.TenantID != "tenant-shop" || receipt.RunID != "run-entry-0827" || receipt.CallID != "call-create-bill-0827" || receipt.Outcome != "succeeded" || receipt.Digest != wantDigest {
		t.Fatalf("success receipt does not preserve identity and bill digest: %#v", receipt)
	}
}

func TestCapstoneRejectsInvalidIdentityBeforeDraft(t *testing.T) {
	called := false
	_, err := CoordinateAndReceipt(RunRequest{RunID: "run-entry-0827", Input: "milk-tea:1200"}, "call-create-bill-0827", func(string) (string, error) {
		called = true
		return "bill-0827", nil
	})
	if !errors.Is(err, ErrInvalidRun) {
		t.Fatalf("invalid identity error = %v, want ErrInvalidRun", err)
	}
	if called {
		t.Fatal("draft-confirm-bill pipeline ran before tenant identity validation")
	}
}

func TestCapstoneFailedBillHasNoSuccessDigest(t *testing.T) {
	receipt, err := CoordinateAndReceipt(RunRequest{
		TenantID: "tenant-shop", RunID: "run-entry-0827", Input: "milk-tea:1200",
	}, "call-create-bill-0827", func(string) (string, error) {
		return "", errors.New("confirmation required")
	})
	if err != nil {
		t.Fatalf("failed pipeline should be recorded as a receipt outcome, got error: %v", err)
	}
	if receipt.TenantID != "tenant-shop" || receipt.RunID != "run-entry-0827" || receipt.CallID != "call-create-bill-0827" || receipt.Outcome != "failed" || receipt.Digest != "" {
		t.Fatalf("failed bill forged a success receipt: %#v", receipt)
	}
}
`

const capstoneTestPattern = `^(TestCoordinateAndReceipt|TestCapstoneInputDraftConfirmBillReceipt|TestCapstoneRejectsInvalidIdentityBeforeDraft|TestCapstoneFailedBillHasNoSuccessDigest)$`

var projectSeamImports = map[string]map[string]bool{
	"01": {"context": true, "time": true},
	"02": {"bytes": true, "encoding/json": true, "fmt": true},
	"03": {"fmt": true},
	"04": {"errors": true, "path/filepath": true},
	"05": {"time": true},
	"06": {"encoding/json": true},
	"07": {},
	"08": {},
}

type server struct {
	root      string
	book      book
	exercises map[string]codeExercise
	rubrics   map[string][][]string
	database  map[string]databaseCourseUnit
	dbVersion string
	slots     chan struct{}
	proofMu   sync.Mutex
	runProofs map[string]runProof
}

type runProof struct {
	UnitID    string
	Digest    string
	Binding   string
	ExpiresAt time.Time
}

type cappedBuffer struct {
	buffer bytes.Buffer
	limit  int
}

func (w *cappedBuffer) Write(value []byte) (int, error) {
	original := len(value)
	remaining := w.limit - w.buffer.Len()
	if remaining > 0 {
		if len(value) > remaining {
			value = value[:remaining]
		}
		_, _ = w.buffer.Write(value)
	}
	return original, nil
}

func (w *cappedBuffer) String() string { return w.buffer.String() }

func main() {
	root, err := filepath.Abs(".")
	if err != nil {
		log.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "interactive")); errors.Is(err, os.ErrNotExist) {
		root = filepath.Dir(root)
	}
	data, err := os.ReadFile(filepath.Join(root, "interactive", "data", "book.json"))
	if err != nil {
		log.Fatal(err)
	}
	var content book
	if err := json.Unmarshal(data, &content); err != nil {
		log.Fatal(err)
	}
	exercises := make(map[string]codeExercise)
	if err := json.Unmarshal(embeddedExercises, &exercises); err != nil {
		log.Fatal(err)
	}
	rubrics := make(map[string][][]string)
	if err := json.Unmarshal(embeddedRubrics, &rubrics); err != nil {
		log.Fatal(err)
	}
	var databaseContent databaseCurriculum
	if err := json.Unmarshal(embeddedDatabaseCurriculum, &databaseContent); err != nil {
		log.Fatal(err)
	}
	databaseUnits := make(map[string]databaseCourseUnit)
	for _, track := range databaseContent.Tracks {
		for _, lesson := range track.Units {
			databaseUnits[lesson.ID] = lesson
		}
	}

	s := &server{root: root, book: content, exercises: exercises, rubrics: rubrics, database: databaseUnits, dbVersion: databaseContent.Version, slots: make(chan struct{}, 2), runProofs: make(map[string]runProof)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": content.Version, "root": root})
	})
	mux.HandleFunc("POST /api/run", s.run)
	mux.HandleFunc("POST /api/check", s.check)
	mux.Handle("/", noCache(http.FileServer(http.Dir(filepath.Join(root, "interactive")))))
	address := os.Getenv("MANGA_GO_ADDR")
	if address == "" {
		address = "127.0.0.1:4173"
	}
	log.Printf("GO GOOD: http://%s/", address)
	httpServer := &http.Server{
		Addr:              address,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      75 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Fatal(httpServer.ListenAndServe())
}

func (s *server) check(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "拒绝非同源页面调用本机验收器")
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "只接受 JSON 请求")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	var request checkRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "验收答案格式不正确")
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "请求只能包含一个 JSON 对象")
		return
	}
	if lesson, ok := s.database[request.UnitID]; ok {
		predictionOK := request.FoundationPrediction != nil && *request.FoundationPrediction == lesson.Prediction.CorrectIndex
		quizOK := len(request.QuizAnswers) == 1 && request.QuizAnswers[0] == lesson.Quiz.CorrectIndex
		runOK := s.validRunProof(request.RunProof, request.UnitID, request.CodeDigest)
		if !predictionOK || !quizOK || !runOK {
			writeError(w, http.StatusUnprocessableEntity, "预测、运行凭证或迁移题不一致，请在当前课重新完成")
			return
		}
		digest := sha256.Sum256([]byte(s.dbVersion + "\x00" + request.UnitID + "\x00" + request.CodeDigest + "\x00" + strconv.Itoa(*request.FoundationPrediction) + "\x00" + strconv.Itoa(request.QuizAnswers[0])))
		_ = json.NewEncoder(w).Encode(checkResponse{OK: true, Message: "预测、运行与迁移理解均已通过。", ArtifactDigest: request.CodeDigest, CompletionDigest: fmt.Sprintf("sha256:%x", digest), VerifierVersion: s.dbVersion})
		return
	}
	item, ok := s.find(request.UnitID)
	if !ok {
		writeError(w, http.StatusNotFound, "未找到本章演练")
		return
	}
	if item.ProjectLab.ID != "" {
		quizOK := len(request.QuizAnswers) == len(item.SelfCheck)
		for index, quiz := range item.SelfCheck {
			if !quizOK || request.QuizAnswers[index] != quiz.CorrectIndex {
				quizOK = false
				break
			}
		}
		_, hasChallenge := s.exercises[request.UnitID]
		challengeOK := hasChallenge && s.validRunProof(request.ChallengeRunProof, request.UnitID, request.ChallengeDigest)
		labOK := true
		if strings.HasPrefix(request.UnitID, "chapter-") {
			labOK = s.validBoundRunProof(request.RunProof, item.ProjectLab.ID, request.CodeDigest, request.ChallengeDigest)
		}
		if !quizOK || !challengeOK || !labOK {
			writeError(w, http.StatusUnprocessableEntity, "里程碑答案或代码凭证无效，请重新验收")
			return
		}
		quizJSON, _ := json.Marshal(request.QuizAnswers)
		digest := sha256.Sum256([]byte(s.book.Version + "\x00" + request.UnitID + "\x00" + string(quizJSON) + "\x00" + request.ChallengeDigest + "\x00" + request.CodeDigest))
		response := checkResponse{OK: true, Message: "里程碑代码、真实项目测试与理解证据均已通过。", ArtifactDigest: request.ChallengeDigest, CompletionDigest: fmt.Sprintf("sha256:%x", digest), VerifierVersion: s.book.Version}
		_ = json.NewEncoder(w).Encode(response)
		return
	}
	if !strings.HasPrefix(request.UnitID, "chapter-") {
		writeError(w, http.StatusNotFound, "未找到本章演练")
		return
	}
	if item.FoundationLesson != nil {
		quizOK := len(request.QuizAnswers) == len(item.SelfCheck)
		for index, quiz := range item.SelfCheck {
			if !quizOK || request.QuizAnswers[index] != quiz.CorrectIndex {
				quizOK = false
				break
			}
		}
		predictionOK := request.FoundationPrediction != nil && *request.FoundationPrediction == item.FoundationLesson.Prediction.CorrectIndex
		baselineOK := s.validBoundRunProof(request.FoundationBaselineRunProof, request.UnitID, request.FoundationBaselineDigest, "foundation-baseline")
		changedOK := s.validBoundRunProof(request.FoundationChangedRunProof, request.UnitID, request.FoundationChangedDigest, "foundation-change")
		codeOK := s.validRunProof(request.RunProof, request.UnitID, request.CodeDigest)
		if !predictionOK || !quizOK || !baselineOK || !changedOK || !codeOK || request.FoundationBaselineDigest == request.FoundationChangedDigest {
			writeError(w, http.StatusUnprocessableEntity, "需要原例运行、不同代码的改动后运行、固定测试和迁移题四项证据")
			return
		}
		quizJSON, _ := json.Marshal(request.QuizAnswers)
		digest := sha256.Sum256([]byte(s.book.Version + "\x00" + request.UnitID + "\x00" + request.FoundationBaselineDigest + "\x00" + request.FoundationChangedDigest + "\x00" + request.CodeDigest + "\x00" + string(quizJSON)))
		response := checkResponse{OK: true, Message: "原例、改动、独立测试与迁移理解均已通过。", ArtifactDigest: request.CodeDigest, CompletionDigest: fmt.Sprintf("sha256:%x", digest), VerifierVersion: s.book.Version}
		_ = json.NewEncoder(w).Encode(response)
		return
	}
	expected := []string{item.Goal, item.Task, item.Accept}
	passed := len(request.Answers) == len(expected)
	if rubric, structured := s.rubrics[request.UnitID]; structured {
		passed = len(request.Answers) == len(rubric)
		for index, decision := range rubric {
			if !passed || request.Answers[index] != decision[0] {
				passed = false
				break
			}
		}
	} else {
		for index := range expected {
			if !passed || request.Answers[index] != expected[index] {
				passed = false
				break
			}
		}
	}
	response := checkResponse{OK: passed, VerifierVersion: s.book.Version}
	status := http.StatusUnprocessableEntity
	if passed {
		status = http.StatusOK
		response.Message = "三步路线成立，过关凭证已生成。"
		normalized := make([]string, len(request.Answers))
		for index, answer := range request.Answers {
			normalized[index] = strings.ToLower(strings.Join(strings.Fields(answer), " "))
		}
		digest := sha256.Sum256([]byte(s.book.Version + "\x00" + request.UnitID + "\x00" + strings.Join(normalized, "\x00")))
		response.ArtifactDigest = fmt.Sprintf("sha256:%x", digest)
		if request.QuizAnswers != nil {
			quizOK := len(request.QuizAnswers) == len(item.SelfCheck)
			for index, quiz := range item.SelfCheck {
				if !quizOK || request.QuizAnswers[index] != quiz.CorrectIndex {
					quizOK = false
					break
				}
			}
			if !quizOK {
				response.OK = false
				response.Message = "三道自测答案与当前教材不一致。"
				response.ArtifactDigest = ""
				w.WriteHeader(http.StatusUnprocessableEntity)
				_ = json.NewEncoder(w).Encode(response)
				return
			}
			if _, requiresCode := s.exercises[request.UnitID]; requiresCode {
				if !s.validRunProof(request.RunProof, request.UnitID, request.CodeDigest) {
					response.OK = false
					response.Message = "代码运行凭证无效或已过期，请重新运行固定测试。"
					response.ArtifactDigest = ""
					w.WriteHeader(http.StatusUnprocessableEntity)
					_ = json.NewEncoder(w).Encode(response)
					return
				}
			}
			quizJSON, _ := json.Marshal(request.QuizAnswers)
			completion := sha256.Sum256([]byte(response.ArtifactDigest + "\x00" + string(quizJSON) + "\x00" + request.CodeDigest))
			response.CompletionDigest = fmt.Sprintf("sha256:%x", completion)
		}
	} else {
		response.Message = "路线里还有一步经不起失败验证，请重新检查边界、动作和证据。"
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response)
}

func (s *server) run(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "拒绝非同源页面调用本机编译器")
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "只接受 JSON 请求")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxCode+(4<<10))
	var request runRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "代码不能超过 64KB")
			return
		}
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "请求只能包含一个 JSON 对象")
		return
	}
	if len(request.Code) > maxCode {
		writeError(w, http.StatusRequestEntityTooLarge, "代码不能超过 64KB")
		return
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	default:
		writeError(w, http.StatusTooManyRequests, "已有代码正在运行，请稍后再试")
		return
	}

	timeout := 30 * time.Second
	if strings.HasPrefix(request.UnitID, "ledger-agent-lab/") {
		timeout = 60 * time.Second
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()
	started := time.Now()
	command, output, err := s.execute(ctx, request.UnitID, request.Code)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		output = fmt.Sprintf("运行超过 %d 秒，已停止。", int(timeout.Seconds()))
	}
	if len(output) > maxOutput {
		output = output[:maxOutput] + "\n…输出过长，已截断"
	}
	status := http.StatusOK
	if err != nil {
		status = http.StatusUnprocessableEntity
	}
	w.WriteHeader(status)
	verifierVersion := s.book.Version
	if strings.HasPrefix(request.UnitID, "db-") {
		verifierVersion = databaseFoundationVerifierVersion
	} else if strings.HasPrefix(request.UnitID, "mysql-") {
		verifierVersion = mysqlTeachingVerifierVersion
	} else if strings.HasPrefix(request.UnitID, "redis-") {
		verifierVersion = "redis-real-v1"
	}
	response := runResponse{OK: err == nil, Command: command, Output: output, Duration: time.Since(started).Milliseconds(), VerifierVersion: verifierVersion}
	if err == nil && (strings.HasPrefix(request.UnitID, "chapter-") || strings.HasPrefix(request.UnitID, "exercise-") || strings.HasPrefix(request.UnitID, "ledger-agent-lab/") || isDatabaseCourseUnit(request.UnitID)) {
		digestInput := s.book.Version + "\x00" + request.UnitID + "\x00" + request.Code
		binding := ""
		if strings.HasPrefix(request.UnitID, "chapter-") {
			if item, ok := s.find(request.UnitID); ok && item.FoundationLesson != nil {
				source := strings.TrimSpace(request.Code)
				switch {
				case source == strings.TrimSpace(item.FoundationLesson.Code):
					binding = "foundation-baseline"
				case foundationChangeMatches(request.UnitID, item.FoundationLesson, request.Code, output):
					binding = "foundation-change"
				default:
					binding = "foundation-unverified"
				}
			}
		}
		if strings.HasPrefix(request.UnitID, "ledger-agent-lab/") {
			digestInput = s.book.Version + "\x00" + request.UnitID + "\x00" + request.Code + "\x00" + output
			if projectID, ok := s.projectForLab(request.UnitID); ok {
				challenge := sha256.Sum256([]byte(s.book.Version + "\x00exercise-" + projectID + "\x00" + request.Code))
				binding = fmt.Sprintf("sha256:%x", challenge)
			}
		}
		digest := sha256.Sum256([]byte(digestInput))
		response.ArtifactDigest = fmt.Sprintf("sha256:%x", digest)
		proofUnit := strings.TrimPrefix(request.UnitID, "exercise-")
		response.RunProof = s.issueRunProof(proofUnit, response.ArtifactDigest, binding)
	}
	_ = json.NewEncoder(w).Encode(response)
}

func foundationChangeMatches(unitID string, lesson *foundationLesson, source, output string) bool {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "main.go", source, 0)
	if err != nil {
		return false
	}
	if unitID == "chapter-5" {
		hasNumberField := false
		hasNumberSelector := false
		hasNumberLiteralKey := false
		ast.Inspect(file, func(node ast.Node) bool {
			switch value := node.(type) {
			case *ast.TypeSpec:
				if value.Name.Name == "Bill" {
					if structure, ok := value.Type.(*ast.StructType); ok {
						for _, field := range structure.Fields.List {
							for _, name := range field.Names {
								hasNumberField = hasNumberField || name.Name == "Number"
							}
						}
					}
				}
			case *ast.SelectorExpr:
				hasNumberSelector = hasNumberSelector || value.Sel.Name == "Number"
			case *ast.KeyValueExpr:
				if key, ok := value.Key.(*ast.Ident); ok {
					hasNumberLiteralKey = hasNumberLiteralKey || key.Name == "Number"
				}
			}
			return true
		})
		return hasNumberField && hasNumberSelector && hasNumberLiteralKey && strings.Contains(output, lesson.ChangedOutputCheck)
	}
	var normalized bytes.Buffer
	if err := format.Node(&normalized, fset, file); err != nil {
		return false
	}
	return lesson.ChangeMarker != "" && strings.Contains(normalized.String(), lesson.ChangeMarker) && strings.Contains(output, lesson.ChangedOutputCheck)
}

func (s *server) issueRunProof(unitID, digest string, binding ...string) string {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return ""
	}
	token := fmt.Sprintf("run:%x", value)
	s.proofMu.Lock()
	defer s.proofMu.Unlock()
	if s.runProofs == nil {
		s.runProofs = make(map[string]runProof)
	}
	now := time.Now()
	for key, proof := range s.runProofs {
		if now.After(proof.ExpiresAt) {
			delete(s.runProofs, key)
		}
	}
	linked := ""
	if len(binding) > 0 {
		linked = binding[0]
	}
	s.runProofs[token] = runProof{UnitID: unitID, Digest: digest, Binding: linked, ExpiresAt: time.Now().Add(30 * time.Minute)}
	return token
}

func (s *server) validBoundRunProof(token, unitID, digest, binding string) bool {
	if !s.validRunProof(token, unitID, digest) {
		return false
	}
	s.proofMu.Lock()
	defer s.proofMu.Unlock()
	return s.runProofs[token].Binding == binding && binding != ""
}

func (s *server) projectForLab(labID string) (string, bool) {
	for _, chapter := range s.book.Chapters {
		if chapter.ProjectLab.ID == labID {
			return chapter.ID, true
		}
		for _, supplement := range chapter.Supplements {
			if supplement.ProjectLab.ID == labID {
				return supplement.ID, true
			}
		}
	}
	return "", false
}

func (s *server) validRunProof(token, unitID, digest string) bool {
	if token == "" || digest == "" {
		return false
	}
	s.proofMu.Lock()
	defer s.proofMu.Unlock()
	proof, ok := s.runProofs[token]
	if ok && time.Now().After(proof.ExpiresAt) {
		delete(s.runProofs, token)
		ok = false
	}
	if !ok || proof.UnitID != unitID || proof.Digest != digest {
		return false
	}
	return true
}

func (s *server) execute(ctx context.Context, id, editedCode string) (string, string, error) {
	if strings.HasPrefix(id, "db-") {
		result, err := runDatabaseFoundation(id, editedCode)
		if err != nil {
			return "database-foundation-verifier " + id, err.Error(), err
		}
		return result.Command, result.Output, err
	}
	if strings.HasPrefix(id, "mysql-") {
		result, err := runMySQLLesson(id, editedCode)
		if err != nil {
			return "mysql-teaching-verifier " + id, err.Error(), err
		}
		return result.Command, result.Output, err
	}
	if strings.HasPrefix(id, "redis-") {
		return runRedisLesson(ctx, id, editedCode)
	}
	if chapterID, ok := strings.CutPrefix(id, "exercise-"); ok {
		if seam, project := projectSeamForUnit(chapterID); project {
			return s.runProjectSeam(ctx, seam, editedCode)
		}
		exercise, exists := s.exercises[chapterID]
		if !exists {
			return "", "这个练习不存在。", errors.New("exercise missing")
		}
		if strings.TrimSpace(editedCode) == "" {
			editedCode = exercise.Code
		}
		args := []string{"test"}
		if exercise.Race {
			args = []string{"test", "-race"}
		}
		return runFiles(ctx, map[string]string{
			"go.mod":           "module manga-go-exercise\n\ngo 1.22\n",
			"exercise.go":      editedCode,
			"exercise_test.go": exercise.Test,
		}, "go", args...)
	}
	if lesson, ok := strings.CutPrefix(id, "wails-go-syntax/"); ok {
		tests := map[string]struct {
			name string
			race bool
		}{
			"all":         {race: true},
			"struct-json": {name: "TestStructJSON"},
			"method":      {name: "TestMethodReceiver"},
			"interface":   {name: "TestInterfaceBoundary"},
			"errors":      {name: "TestErrorChain"},
			"concurrency": {name: "TestConcurrentRefresh", race: true},
			"context":     {name: "TestContextCancellation", race: true},
		}
		test, exists := tests[lesson]
		if !exists {
			return "", "Wails Go 语法实验不存在。", errors.New("wails go lesson missing")
		}
		args := []string{"test", "-v", "-run", "^" + test.name + "$", "./..."}
		if lesson == "all" {
			args = []string{"test", "-race", "-v", "./..."}
		} else if test.race {
			args = []string{"test", "-race", "-v", "-run", "^" + test.name + "$", "./..."}
		}
		return runExternalCommand(ctx, filepath.Join(s.root, "labs", "wails-go-syntax"), "go", args...)
	}
	switch id {
	case "chapter-1", "chapter-2", "chapter-3", "chapter-4", "chapter-5", "chapter-6", "chapter-7", "chapter-8":
		item, ok := s.find(id)
		if !ok {
			return "", "教材单元不存在", errors.New("unit missing")
		}
		if strings.TrimSpace(editedCode) != "" {
			item.Code = editedCode
		}
		return runFiles(ctx, map[string]string{"main.go": item.Code}, "go", "run", "main.go")
	case "supplement-go-real-test-file":
		chapter, _ := s.find("chapter-1")
		test, _ := s.find(id)
		if strings.TrimSpace(editedCode) != "" {
			test.Code = editedCode
		}
		return runFiles(ctx, map[string]string{
			"go.mod":         "module manga-go-settle\n\ngo 1.22\n",
			"main.go":        chapter.Code,
			"settle_test.go": test.Code,
		}, "go", "test")
	case "harness-lab":
		return runExternalCommand(ctx, filepath.Join(s.root, "labs", "harness-lab"), "go", "test", "./...")
	case "ledger-agent-quickstart":
		return runExternalCommand(ctx, filepath.Join(s.root, "labs", "ledger-agent"), "go", "test", "-v", "-run", "^(TestWorkerCompletesAnswer|TestAPIAcceptedRunCompletesAfterRequestReturns)$", "./...")
	case "ledger-agent-lab/capstone":
		return s.runCapstone(ctx, editedCode)
	default:
		if seam, ok := projectSeamForLab(id); ok {
			return s.runProjectSeam(ctx, seam, editedCode)
		}
		return "", "这个单元是讲解片段，暂不支持直接运行。", errors.New("unit not allowed")
	}
}

func isDatabaseCourseUnit(id string) bool {
	return strings.HasPrefix(id, "db-") || strings.HasPrefix(id, "mysql-") || strings.HasPrefix(id, "redis-")
}

func projectSeamForUnit(unitID string) (projectSeam, bool) {
	prefix := "supplement-go-ai-"
	if !strings.HasPrefix(unitID, prefix) {
		return projectSeam{}, false
	}
	number := strings.TrimPrefix(unitID, prefix)
	for _, seam := range projectSeams {
		if seam.Number == number {
			return seam, true
		}
	}
	return projectSeam{}, false
}

func projectSeamForLab(labID string) (projectSeam, bool) {
	name, ok := strings.CutPrefix(labID, "ledger-agent-lab/")
	if !ok {
		return projectSeam{}, false
	}
	for _, seam := range projectSeams {
		if seam.LabName == name {
			return seam, true
		}
	}
	return projectSeam{}, false
}

func (s *server) runProjectSeam(ctx context.Context, seam projectSeam, source string) (string, string, error) {
	if strings.TrimSpace(source) == "" {
		return "source policy", "企业项目代码不能为空，请实现当前关卡的函数。", errors.New("empty project source")
	}
	fileName := "seam_" + seam.Number + "_learner.go"
	if err := validateProjectSeamSource(fileName, source, seam); err != nil {
		return "source policy", err.Error(), err
	}

	sandboxRoot := "/private/var/tmp/manga-go-sandboxes"
	if err := os.MkdirAll(sandboxRoot, 0o700); err != nil {
		return "", err.Error(), err
	}
	dir, err := os.MkdirTemp(sandboxRoot, "ledger-agent-*")
	if err != nil {
		return "", err.Error(), err
	}
	defer os.RemoveAll(dir)
	if err := copyRegularTree(filepath.Join(s.root, "labs", "ledger-agent"), dir); err != nil {
		return "prepare ledger-agent", err.Error(), err
	}
	learnerFile, err := os.OpenFile(filepath.Join(dir, fileName), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return "prepare ledger-agent", err.Error(), err
	}
	if _, err := learnerFile.WriteString(source); err != nil {
		_ = learnerFile.Close()
		return "prepare ledger-agent", err.Error(), err
	}
	if err := learnerFile.Close(); err != nil {
		return "prepare ledger-agent", err.Error(), err
	}
	projectID := "supplement-go-ai-" + seam.Number
	exercise, ok := s.exercises[projectID]
	if !ok || strings.TrimSpace(exercise.Test) == "" {
		return "prepare ledger-agent", "当前关卡缺少受信的固定契约测试。", errors.New("project contract test missing")
	}
	contractSource := exercise.Test
	if seam.Number == "01" {
		contractSource = milestone01LearnerContract
	}
	contractFile := filepath.Join(dir, "seam_"+seam.Number+"_contract_test.go")
	if err := os.WriteFile(contractFile, []byte(contractSource), 0o600); err != nil {
		return "prepare ledger-agent", err.Error(), err
	}

	pattern := "^(TestMilestone" + seam.Number + "|TestLearner" + seam.Number + ")"
	if seam.Number == "01" {
		contractCommand, contractOutput, contractErr := runFiles(ctx, map[string]string{
			"go.mod":                   "module manga-go-provider-contract\n\ngo 1.22\n",
			"provider.go":              milestone01Support,
			"seam_01_learner.go":       source,
			"seam_01_contract_test.go": milestone01LearnerContract,
		}, "go", "test", "-tags", "learner01", "-timeout", "2s", "-v", "-run", "^TestLearner01", ".")
		if contractErr != nil {
			return contractCommand, contractOutput, contractErr
		}
		milestoneArgs := []string{"test", "-race", "-tags", "learner01", "-timeout", "2s", "-v", "-run", "^TestMilestone01", "./..."}
		milestoneCommand, milestoneOutput, milestoneErr := runSandboxedProjectCommand(ctx, dir, "go", milestoneArgs...)
		command := contractCommand + " && " + milestoneCommand
		output := contractOutput + "\n" + milestoneOutput
		if milestoneErr != nil {
			return command, output, milestoneErr
		}
		if err := validateProjectTestOutput(seam.Number, output); err != nil {
			return command, output + "\n" + err.Error(), err
		}
		return command, output, nil
	}
	args := []string{"test", "-race", "-tags", "learner" + seam.Number, "-v", "-run", pattern, "./..."}
	command, output, err := runSandboxedProjectCommand(ctx, dir, "go", args...)
	if err != nil {
		return command, output, err
	}
	if err := validateProjectTestOutput(seam.Number, output); err != nil {
		return command, output + "\n" + err.Error(), err
	}
	return command, output, nil
}

func (s *server) runCapstone(ctx context.Context, source string) (string, string, error) {
	if strings.TrimSpace(source) == "" {
		return "source policy", "第 24 章总装代码不能为空，请实现 StartOrResume。", errors.New("empty capstone source")
	}
	if err := validateCapstoneSource(source); err != nil {
		return "source policy", err.Error(), err
	}
	exercise, ok := s.exercises["chapter-24"]
	if !ok || strings.TrimSpace(exercise.Test) == "" {
		return "prepare capstone", "第 24 章缺少受信的固定契约测试。", errors.New("capstone contract test missing")
	}
	command, output, err := runFiles(ctx, map[string]string{
		"go.mod":                      "module manga-go-capstone\n\ngo 1.22\n",
		"capstone.go":                 source,
		"chapter_24_contract_test.go": exercise.Test,
		"capstone_flow_test.go":       capstoneFlowContract,
	}, "go", "test", "-race", "-timeout", "5s", "-v", "-run", capstoneTestPattern)
	if err != nil {
		return command, output, err
	}
	for _, name := range []string{
		"TestCoordinateAndReceipt",
		"TestCapstoneInputDraftConfirmBillReceipt",
		"TestCapstoneRejectsInvalidIdentityBeforeDraft",
		"TestCapstoneFailedBillHasNoSuccessDigest",
	} {
		if !strings.Contains(output, "--- PASS: "+name) {
			err := fmt.Errorf("总装验收输出不完整：缺少 %s", name)
			return command, output + "\n" + err.Error(), err
		}
	}
	sandboxRoot := "/private/var/tmp/manga-go-sandboxes"
	if err := os.MkdirAll(sandboxRoot, 0o700); err != nil {
		return command, output, err
	}
	projectDir, err := os.MkdirTemp(sandboxRoot, "capstone-project-")
	if err != nil {
		return command, output, err
	}
	defer os.RemoveAll(projectDir)
	if err := copyRegularTree(filepath.Join(s.root, "labs", "ledger-agent"), projectDir); err != nil {
		return command, output, err
	}
	projectCommand, projectOutput, projectErr := runSandboxedProjectCommand(ctx, projectDir, "go", "test", "-race", "./...")
	command += " && " + projectCommand
	output += "\n\n完整订单 Agent 回归：\n" + projectOutput
	if projectErr != nil {
		return command, output, projectErr
	}
	return command, output, nil
}

func validateCapstoneSource(source string) error {
	parsed, err := parser.ParseFile(token.NewFileSet(), "capstone.go", source, 0)
	if err != nil {
		return fmt.Errorf("第 24 章代码无法解析: %w", err)
	}
	if parsed.Name.Name != "main" {
		return errors.New("第 24 章总装代码必须使用 package main")
	}
	allowedImports := map[string]bool{"crypto/sha256": true, "errors": true, "fmt": true}
	for _, item := range parsed.Imports {
		path, unquoteErr := strconv.Unquote(item.Path.Value)
		if unquoteErr != nil || !allowedImports[path] {
			return fmt.Errorf("第 24 章总装代码禁止导入 %s", item.Path.Value)
		}
	}
	for _, declaration := range parsed.Decls {
		function, ok := declaration.(*ast.FuncDecl)
		if !ok {
			continue
		}
		if function.Name.Name == "main" || function.Name.Name == "init" || strings.HasPrefix(function.Name.Name, "Test") {
			return fmt.Errorf("第 24 章总装代码禁止声明函数 %s", function.Name.Name)
		}
	}
	return nil
}

func validateProjectTestOutput(number, output string) error {
	for _, required := range []string{"--- PASS: TestMilestone" + number, "--- PASS: TestLearner" + number} {
		if !strings.Contains(output, required) {
			return fmt.Errorf("项目验收输出不完整：缺少 %s: %w", required, errors.New("project tests did not complete"))
		}
	}
	return nil
}

func validateProjectSeamSource(name, source string, seam projectSeam) error {
	parsed, err := parser.ParseFile(token.NewFileSet(), name, source, 0)
	if err != nil {
		return fmt.Errorf("当前关卡代码无法解析: %w", err)
	}
	if parsed.Name.Name != "ledgeragent" {
		return errors.New("企业项目代码必须使用 package ledgeragent")
	}
	allowedImports, ok := projectSeamImports[seam.Number]
	if !ok {
		return errors.New("当前关卡缺少导入白名单")
	}
	for _, item := range parsed.Imports {
		path, unquoteErr := strconv.Unquote(item.Path.Value)
		if unquoteErr != nil || !allowedImports[path] {
			return fmt.Errorf("企业项目代码禁止导入 %s", item.Path.Value)
		}
	}
	declared := ""
	for _, declaration := range parsed.Decls {
		switch value := declaration.(type) {
		case *ast.GenDecl:
			if value.Tok != token.IMPORT {
				return errors.New("当前关卡只允许声明目标函数；请勿复制类型、变量或参考实现")
			}
		case *ast.FuncDecl:
			if value.Recv != nil || declared != "" || value.Name.Name != seam.Function {
				return fmt.Errorf("当前关卡只能声明函数 %s", seam.Function)
			}
			inputs, err := fieldTypeNames(value.Type.Params)
			if err != nil || !equalStrings(inputs, seam.Inputs) {
				return fmt.Errorf("函数 %s 的参数必须是 %s", seam.Function, strings.Join(seam.Inputs, ", "))
			}
			outputs, err := fieldTypeNames(value.Type.Results)
			if err != nil || !equalStrings(outputs, seam.Outputs) {
				return fmt.Errorf("函数 %s 的返回值必须是 %s", seam.Function, strings.Join(seam.Outputs, ", "))
			}
			declared = value.Name.Name
		default:
			return errors.New("当前关卡包含不允许的顶层声明")
		}
	}
	if declared == "" {
		return fmt.Errorf("缺少当前关卡函数 %s", seam.Function)
	}
	if err := validateLearningSource(name, source); err != nil {
		return err
	}
	return nil
}

func fieldTypeNames(fields *ast.FieldList) ([]string, error) {
	if fields == nil {
		return nil, nil
	}
	var names []string
	for _, field := range fields.List {
		var formatted bytes.Buffer
		if err := format.Node(&formatted, token.NewFileSet(), field.Type); err != nil {
			return nil, err
		}
		count := len(field.Names)
		if count == 0 {
			count = 1
		}
		for index := 0; index < count; index++ {
			names = append(names, formatted.String())
		}
	}
	return names, nil
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func copyRegularTree(sourceRoot, destinationRoot string) error {
	return filepath.WalkDir(sourceRoot, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 || (!info.Mode().IsRegular() && !info.IsDir()) {
			return fmt.Errorf("ledger-agent 包含不允许的文件类型: %s", entry.Name())
		}
		relative, err := filepath.Rel(sourceRoot, path)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return errors.New("ledger-agent 文件路径越界")
		}
		destination := filepath.Join(destinationRoot, relative)
		if info.IsDir() {
			return os.MkdirAll(destination, 0o700)
		}
		input, err := os.Open(path)
		if err != nil {
			return err
		}
		defer input.Close()
		output, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(output, input)
		closeErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		return nil
	})
}

func (s *server) find(id string) (unit, bool) {
	for _, chapter := range s.book.Chapters {
		if chapter.ID == id {
			return chapter, true
		}
		for _, supplement := range chapter.Supplements {
			if supplement.ID == id {
				return supplement, true
			}
		}
	}
	return unit{}, false
}

func runFiles(ctx context.Context, files map[string]string, name string, args ...string) (string, string, error) {
	sandboxRoot := "/private/var/tmp/manga-go-sandboxes"
	if err := os.MkdirAll(sandboxRoot, 0o700); err != nil {
		return "", err.Error(), err
	}
	dir, err := os.MkdirTemp(sandboxRoot, "run-*")
	if err != nil {
		return "", err.Error(), err
	}
	defer os.RemoveAll(dir)
	tempDir := filepath.Join(dir, ".tmp")
	if err := os.MkdirAll(tempDir, 0o700); err != nil {
		return "", err.Error(), err
	}
	for name, content := range files {
		if strings.HasSuffix(name, ".go") {
			if err := validateLearningSource(name, content); err != nil {
				return "source policy", err.Error(), err
			}
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			return "", err.Error(), err
		}
	}
	profile := fmt.Sprintf(`(version 1)
(allow default)
(deny network*)
(deny file-read* (subpath "/Users"))
(deny file-read* (subpath "/etc"))
(deny file-read* (subpath "/private/etc"))
(deny file-read* (subpath "/private/tmp"))
(deny file-read* (subpath "/Volumes"))
(deny file-read* (subpath "/Applications"))
(deny file-write*)
(allow file-write* (literal "/dev/null"))
(allow file-write* (subpath %q))`, dir)
	command := strings.Join(append([]string{name}, args...), " ")
	// On macOS RLIMIT_NPROC counts every process owned by the login user, so a
	// small `ulimit -u` can prevent the Go compiler itself from starting. The
	// server's semaphore and wall-clock timeout bound exercise process usage.
	shell := "ulimit -t 8; ulimit -n 64; ulimit -f 131072; exec " + shellJoin(name, args...)
	env := []string{"PATH=" + os.Getenv("PATH"), "LANG=C.UTF-8", "LC_ALL=C.UTF-8", "CGO_ENABLED=0", "GO111MODULE=on", "GOWORK=off", "GOPROXY=off", "GOSUMDB=off", "GOTELEMETRY=off", "GOMAXPROCS=2", "HOME=" + dir, "TMPDIR=" + tempDir, "GOCACHE=" + filepath.Join(dir, "go-cache"), "GOMODCACHE=" + filepath.Join(dir, "go-mod-cache")}
	return runCommandFiles(ctx, dir, env, command, "sandbox-exec", "-p", profile, "/bin/sh", "-c", shell)
}

func runSandboxedProjectCommand(ctx context.Context, dir, name string, args ...string) (string, string, error) {
	tempDir := filepath.Join(dir, ".tmp")
	if err := os.MkdirAll(tempDir, 0o700); err != nil {
		return "", err.Error(), err
	}
	profile := fmt.Sprintf(`(version 1)
(allow default)
(deny network*)
(allow network-inbound (local ip "localhost:*"))
(allow network-outbound (remote ip "localhost:*"))
(deny file-read* (subpath "/Users"))
(deny file-read* (subpath "/etc"))
(deny file-read* (subpath "/private/etc"))
(deny file-read* (subpath "/private/tmp"))
(deny file-read* (subpath "/Volumes"))
(deny file-read* (subpath "/Applications"))
(deny file-write*)
(allow file-write* (literal "/dev/null"))
(allow file-write* (subpath %q))`, dir)
	command := strings.Join(append([]string{name}, args...), " ")
	shell := "ulimit -t 55; ulimit -n 128; ulimit -f 131072; exec " + shellJoin(name, args...)
	env := []string{
		"PATH=" + os.Getenv("PATH"),
		"LANG=C.UTF-8",
		"LC_ALL=C.UTF-8",
		"CGO_ENABLED=1",
		"GO111MODULE=on",
		"GOWORK=off",
		"GOPROXY=off",
		"GOSUMDB=off",
		"GOTELEMETRY=off",
		"GOMAXPROCS=2",
		"HOME=" + dir,
		"TMPDIR=" + tempDir,
		"GOCACHE=" + filepath.Join(dir, "go-cache"),
		"GOMODCACHE=" + filepath.Join(dir, "go-mod-cache"),
	}
	return runCommandFiles(ctx, dir, env, command, "sandbox-exec", "-p", profile, "/bin/sh", "-c", shell)
}

func shellJoin(name string, args ...string) string {
	parts := append([]string{name}, args...)
	for index, part := range parts {
		parts[index] = "'" + strings.ReplaceAll(part, "'", `'"'"'`) + "'"
	}
	return strings.Join(parts, " ")
}

func runExternalCommand(ctx context.Context, dir, name string, args ...string) (string, string, error) {
	command := strings.Join(append([]string{name}, args...), " ")
	env := []string{
		"PATH=" + os.Getenv("PATH"),
		"LANG=C.UTF-8",
		"LC_ALL=C.UTF-8",
		"CGO_ENABLED=1",
		"GOWORK=off",
		"GOTELEMETRY=off",
		"GOMAXPROCS=2",
		"HOME=" + os.Getenv("HOME"),
		"TMPDIR=" + os.TempDir(),
	}
	return runCommandFiles(ctx, dir, env, command, name, args...)
}

func runCommandFiles(ctx context.Context, dir string, env []string, command, name string, args ...string) (string, string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	cmd.Env = env
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return os.ErrProcessDone
		}
		err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if errors.Is(err, syscall.ESRCH) {
			return os.ErrProcessDone
		}
		return err
	}
	cmd.WaitDelay = 2 * time.Second
	output := cappedBuffer{limit: maxOutput + 1}
	cmd.Stdout, cmd.Stderr = &output, &output
	err := cmd.Run()
	if ctx.Err() != nil {
		return command, output.String(), ctx.Err()
	}
	return command, output.String(), err
}

func validateLearningSource(name, source string) error {
	parsed, err := parser.ParseFile(token.NewFileSet(), name, source, 0)
	if err != nil {
		return err
	}
	forbidden := map[string]bool{"os/exec": true, "syscall": true, "unsafe": true, "plugin": true}
	osAliases := map[string]bool{}
	for _, item := range parsed.Imports {
		path, err := strconv.Unquote(item.Path.Value)
		if err != nil || forbidden[path] {
			return fmt.Errorf("教学运行器禁止导入 %s", item.Path.Value)
		}
		if path == "os" {
			alias := "os"
			if item.Name != nil {
				alias = item.Name.Name
			}
			osAliases[alias] = true
		}
	}
	blocked := false
	ast.Inspect(parsed, func(node ast.Node) bool {
		switch value := node.(type) {
		case *ast.SelectorExpr:
			name, ok := value.X.(*ast.Ident)
			blocked = blocked || (ok && osAliases[name.Name] && value.Sel.Name == "StartProcess")
		case *ast.Ident:
			blocked = blocked || (osAliases["."] && value.Name == "StartProcess")
		}
		return !blocked
	})
	if blocked {
		return errors.New("教学运行器禁止创建子进程")
	}
	return nil
}

func sameOrigin(r *http.Request) bool {
	if !loopbackHost(r.Host) {
		return false
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	return err == nil && parsed.Scheme == "http" && strings.EqualFold(parsed.Host, r.Host)
}

func loopbackHost(host string) bool {
	hostname := host
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		hostname = parsed
	}
	hostname = strings.Trim(hostname, "[]")
	return strings.EqualFold(hostname, "localhost") || net.ParseIP(hostname).IsLoopback()
}

func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	_, _ = io.WriteString(w, fmt.Sprintf(`{"ok":false,"output":%q}`, message))
}
