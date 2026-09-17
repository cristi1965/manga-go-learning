from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from build_capstone_starter import build_starter_zip


PROJECT = Path(__file__).resolve().parent
VERSION = (PROJECT / "VERSION").read_text(encoding="utf-8").strip()
OUT_DIR = PROJECT / "interactive"
DATA_DIR = OUT_DIR / "data"
DATA_OUT = DATA_DIR / "book.json"
AVATAR_DIR = PROJECT / "assets" / "chat-avatars"
INTERACTIVE_AVATAR_DIR = OUT_DIR / "assets" / "chat-avatars"
LAB_DIR = PROJECT / "labs" / "harness-lab"
INTERACTIVE_LAB_DIR = OUT_DIR / "labs" / "harness-lab"
LEDGER_LAB_DIR = PROJECT / "labs" / "ledger-agent"
INTERACTIVE_LEDGER_LAB_DIR = OUT_DIR / "labs" / "ledger-agent"
RUNNER_EXERCISES_OUT = PROJECT / "runner" / "exercises.json"
RUNNER_RUBRICS_OUT = PROJECT / "runner" / "rubrics.json"

GO_AI_PROJECT_MILESTONES = [
    {
        "id": "supplement-go-ai-01", "number": "16.D", "title": "模型适配器：先守住外部边界",
        "kicker": "里程碑 1/8 · Provider、超时与稳定错误",
        "opening": ["账本摘要请求迟迟没有回来，HTTP 连接还占着，后面的请求开始排队。", "问题不在模型会不会回答，而在 Go 服务没有规定它多久必须回答、失败后留下什么。"],
        "dialogue": [("陈平安", "我把 SDK 调通了，为什么还不能接业务？"), ("宁姚", "调通只证明一次成功。接口隔离 Provider，context 传递超时。"), ("陈平安", "空响应和 429 也要变成稳定、可识别的错误。")],
        "closing": "业务依赖小接口；Provider 负责协议转换，context 负责终止等待。",
        "goal": "为模型调用建立可替换、可取消、可测试的 Go 边界。",
        "principles": ["业务层依赖 Provider 接口，不依赖具体 SDK。", "取消、deadline 和 request ID 必须传到底层。", "空响应、429、5xx 和畸形响应分别分类。"],
        "code": "type Provider interface { Complete(context.Context, Request) (Response, error) }",
        "task": "运行企业实验，观察成功、超时与畸形响应如何进入不同结果。",
        "accept": "Provider 可替换；超时停止工作；错误保留类别且不生成伪成功结果。",
        "quiz": ("模型 SDK 已经返回 200，业务层下一步最可靠的判断是什么？", "继续校验响应结构与业务语义，200 只证明传输成功。", ["直接写入账本，SDK 已经成功。", "继续校验响应结构与业务语义，200 只证明传输成功。", "把原始响应完整写入日志再决定。"], 1),
    },
    {
        "id": "supplement-go-ai-02", "number": "16.E", "title": "结构化决策：模型输出仍是不可信输入",
        "kicker": "里程碑 2/8 · 严格 JSON 与 fail closed",
        "opening": ["模型返回了一段看似正确的 JSON，却多出一个 execute 字段。", "若服务只检查能否反序列化，这个字段可能在下一层变成未授权动作。"],
        "dialogue": [("陈平安", "JSON 能解析还不够？"), ("宁姚", "不够。未知字段、非法枚举、越界置信度和空理由都要拒绝。"), ("陈平安", "解析失败时保持原状态，这才叫 fail closed。")],
        "closing": "结构化输出要过语法、结构和业务语义三道门。",
        "goal": "把模型文本转成经过严格校验的 typed decision。",
        "principles": ["拒绝未知字段和尾随 JSON。", "枚举、范围、必填项在服务端校验。", "解析失败不触发任何工具或持久化动作。"],
        "code": "func strictDecoder(r io.Reader) *json.Decoder {\n    dec := json.NewDecoder(r)\n    dec.DisallowUnknownFields()\n    return dec\n}",
        "task": "运行合法、未知字段、置信度越界和缺少理由四组固定用例。",
        "accept": "只有合法 decision 通过，其余样本均 fail closed。",
        "quiz": ("模型返回 action=delete，但业务枚举只有 observe/reject，应该怎样处理？", "拒绝整个 decision，且不执行任何工具。", ["把 delete 自动改成 observe。", "拒绝整个 decision，且不执行任何工具。", "保留文本并让下一层猜测。"], 1),
    },
    {
        "id": "supplement-go-ai-03", "number": "16.F", "title": "Run 与幂等：同一个意图只能创建一次",
        "kicker": "里程碑 3/8 · Tenant、Idempotency 与状态",
        "opening": ["客户端超时后重发创建请求，两条内容相同的 Run 同时进入队列。", "没有租户作用域和输入摘要的幂等键，重试会变成重复副作用。"],
        "dialogue": [("陈平安", "重复请求就返回旧 Run 吗？"), ("阿良", "同租户、同幂等键、同输入可以；输入变了就必须冲突。"), ("陈平安", "原来幂等不是吞掉所有重复，而是识别同一个意图。")],
        "closing": "幂等键必须绑定租户和输入摘要，冲突要显式返回。",
        "goal": "实现跨重试稳定、跨租户隔离的 Run 创建语义。",
        "principles": ["幂等作用域包含 tenant。", "同 key 不同 input hash 返回冲突。", "状态变化留下递增事件。"],
        "code": "func scopedKey(tenantID, idempotencyKey string) string {\n    return tenantID + \"\\x00\" + idempotencyKey\n}",
        "task": "并发创建相同 Run，再用相同 key 提交不同输入。",
        "accept": "相同意图只产生一个 Run；不同输入得到可识别冲突；租户之间互不可见。",
        "quiz": ("相同幂等键再次到达，但输入摘要不同，服务应当怎样做？", "返回冲突，不能复用旧结果或覆盖旧输入。", ["覆盖旧 Run 的输入。", "返回冲突，不能复用旧结果或覆盖旧输入。", "创建第二个 Run 并隐藏重复。"], 1),
    },
    {
        "id": "supplement-go-ai-04", "number": "16.G", "title": "工具契约：模型只能提议，服务端才授权",
        "kicker": "里程碑 4/8 · Registry、参数与工作区边界",
        "opening": ["模型提议读取 ../../secret，工具执行器差点把工作区外文件送回上下文。", "工具名来自模型不代表它有权限，参数也仍然是不可信输入。"],
        "dialogue": [("陈平安", "把允许的工具写进 prompt 不行吗？"), ("宁姚", "prompt 不是权限系统。注册表、参数和路径边界必须由服务端执行。"), ("陈平安", "工具调用还要绑定 tenant、run 和审计记录。")],
        "closing": "模型产生候选动作，确定性代码签发和消费能力。",
        "goal": "建立不可由模型绕过的工具执行契约。",
        "principles": ["工具必须来自服务端 allowlist。", "参数、路径、租户和 run 绑定在执行前校验。", "越权尝试进入审计但不泄露目标内容。"],
        "code": "type Tool interface { Validate(json.RawMessage) error; Run(context.Context, json.RawMessage) ([]byte, error) }",
        "task": "运行合法相对路径、路径穿越、未知工具和跨租户调用。",
        "accept": "只有注册且授权的调用成功；拒绝结果可审计，文件内容不泄露。",
        "quiz": ("模型输出了注册表中不存在的工具名，执行器应该怎样处理？", "在执行前拒绝，并记录不含敏感参数的审计事件。", ["动态加载同名命令。", "在执行前拒绝，并记录不含敏感参数的审计事件。", "让模型再确认一次后直接执行。"], 1),
    },
    {
        "id": "supplement-go-ai-05", "number": "16.H", "title": "并发与恢复：旧 Worker 不能继续写",
        "kicker": "里程碑 5/8 · Lease、Fencing 与取消",
        "opening": ["Worker A 停顿后租约过期，Worker B 接管了任务；A 恢复时仍试图提交旧结果。", "只有状态字段，没有 fencing token，恢复就会制造双写。"],
        "dialogue": [("陈平安", "检查 state=running 还不够？"), ("阿良", "不够。旧 worker 看到的也是 running，必须核对递增 fence。"), ("陈平安", "取消也要进入状态机，不能只停 HTTP 请求。")],
        "closing": "lease 决定谁暂时拥有任务，fence 决定谁仍有写入资格。",
        "goal": "让并发 claim、租约接管和取消具备确定性结果。",
        "principles": ["claim 使用 CAS。", "每次接管提升 fencing token。", "旧 token 的 complete 永远被拒绝。"],
        "code": "func verifyFence(submitted, current uint64) error {\n    if submitted != current { return ErrStaleWorker }\n    return nil\n}",
        "task": "让两个 worker 竞争 claim，并在接管后提交旧 fence。",
        "accept": "仅一个 claim 成功；旧 worker 无法完成 step；取消状态可查询。",
        "quiz": ("Worker A 租约过期后，Worker B 已接管；A 又提交结果，应依据什么拒绝？", "依据单调递增的 fencing token 判定 A 已失去写入资格。", ["依据 A 的进程名。", "依据单调递增的 fencing token 判定 A 已失去写入资格。", "两个结果都保存，稍后人工选择。"], 1),
    },
    {
        "id": "supplement-go-ai-06", "number": "16.I", "title": "事件与流式响应：断线后只补缺失部分",
        "kicker": "里程碑 6/8 · Ordered Events 与 Replay",
        "opening": ["浏览器收到第三段结果后断线，重连时服务又从第一段开始发送。", "如果事件没有稳定 ID，前端无法判断哪些已经处理。"],
        "dialogue": [("陈平安", "SSE 能连上就算完成吗？"), ("宁姚", "还要有递增事件 ID、Last-Event-ID、心跳和断线取消。"), ("陈平安", "重放从已确认 ID 之后开始，不能重复消费。")],
        "closing": "流式传输的正确性来自有序事件和可恢复游标。",
        "goal": "实现可重连、无重复的 Run 事件读取。",
        "principles": ["事件 ID 在单个 Run 内严格递增。", "重连只返回 last ID 之后的事件。", "客户端断线立即停止等待和写入。"],
        "code": "func replay(repo Repository, runID string, lastEventID int64) []Event {\n    return repo.EventsAfter(runID, lastEventID)\n}",
        "task": "读取前三个事件后断线，以最后 ID 重连并检查后续事件。",
        "accept": "事件有序、不重复、不丢失；断线释放 goroutine。",
        "quiz": ("客户端已经确认 event 3，重连请求携带 Last-Event-ID: 3，应从哪里恢复？", "恢复时发送 ID 大于 3 的事件。", ["从 event 1 开始全量重发。", "恢复时发送 ID 大于 3 的事件。", "重复发送 event 3 后结束。"], 1),
    },
    {
        "id": "supplement-go-ai-07", "number": "16.J", "title": "可观测与评测：失败也要留下证词",
        "kicker": "里程碑 7/8 · Audit、Eval 与回归阈值",
        "opening": ["一次回答被投诉，但日志只有“request success”，既不知道模型版本，也不知道用了哪些证据。", "没有固定样本和版本绑定，换 prompt 后连是否退化都无法判断。"],
        "dialogue": [("陈平安", "把 prompt 和原文全写日志最方便吧？"), ("宁姚", "那会泄露敏感信息。记录 hash、版本、类别、耗时和结果，不记录秘密原文。"), ("陈平安", "评测还要覆盖恶意输入，越权率不能被平均分掩盖。")],
        "closing": "用 run_id 串起证据，用固定 eval 阻止无声退化。",
        "goal": "建立可复盘且不泄露敏感输入的审计和评测闭环。",
        "principles": ["审计记录输入摘要而非敏感原文。", "数据集、prompt 和 provider 版本同时绑定。", "安全失败使用独立阻断阈值。"],
        "code": "type Audit struct {\n    RunID string\n    InputHash string\n    Result string\n    Duration time.Duration\n}",
        "task": "运行正常、畸形、超时和越权四类固定评测样本。",
        "accept": "结果可按 run_id 复盘；敏感原文不出现；安全回归能阻断。",
        "quiz": ("一次越权工具调用被拒绝，但最终文字答案正确，这条 eval 应怎样计分？", "安全项失败；文字正确不能抵消越权尝试。", ["整体通过，因为最终答案正确。", "安全项失败；文字正确不能抵消越权尝试。", "从样本集中删除这个异常值。"], 1),
    },
    {
        "id": "supplement-go-ai-08", "number": "16.K", "title": "企业验收：交付一个可控 Ledger Agent",
        "kicker": "里程碑 8/8 · 从测试、race 到故障证据",
        "opening": ["所有功能演示都成功了，但发布前没人试过并发重复、Provider 超时和工具越权。", "企业交付不是再看一次 happy path，而是主动制造失败并证明系统守住边界。"],
        "dialogue": [("陈平安", "全量测试绿了，就算企业级了吗？"), ("阿良", "先看测试覆盖。race、恢复、安全和审计缺一块，就只能说那一块未验证。"), ("陈平安", "最终凭证要绑定代码、测试命令和结果，不能只写自评。")],
        "closing": "企业级不是功能数量，而是失败发生时仍然可控、可解释、可恢复。",
        "goal": "运行完整 Ledger Agent 测试矩阵并理解每条证据的边界。",
        "principles": ["正常测试和 race 测试同时通过。", "故障、安全和恢复用例是发布门禁。", "本地 fake provider 不冒充真实供应商 SLA。"],
        "code": "func verificationCommand() string {\n    return \"go test ./... && go test -race ./...\"\n}",
        "task": "运行完整企业实验，阅读每个测试名并说明它保护的生产风险。",
        "accept": "模型、工具、幂等、租户、fence、事件、审计和 eval 用例全部通过。",
        "quiz": ("本地 fake provider 全部测试通过，能够证明什么？", "证明本地应用边界和失败语义；不能证明真实 Provider 的 SLA。", ["证明任何真实模型都稳定可用。", "证明本地应用边界和失败语义；不能证明真实 Provider 的 SLA。", "证明系统不再需要线上监控。"], 1),
    },
]

GO_AI_PROJECT_PRACTICES_OLD = {
    "supplement-go-ai-01": {
        "title": "实现可取消的 Provider 边界",
        "prompt": "补全 callProvider：从父 context 派生硬超时，把它传给可替换 Provider；拒绝空响应，并保留 Provider 原始错误。",
        "testIntent": "固定测试用阻塞 Provider 观察取消传播，检查硬超时、父级取消、空响应拒绝和 errors.Is 错误保真。",
        "hints": ["用 context.WithTimeout(parent, timeout) 派生调用边界。", "调用 Provider 时必须传派生出的 ctx。", "返回前拒绝空白响应，但不要覆盖 Provider 原始错误。"],
        "failureHint": "若阻塞测试挂住，检查传给 Provider 的是不是派生 ctx；若 errors.Is 失败，不要重建上游错误。",
        "code": '''package main

import (
	"context"
	"errors"
	"time"
)

var errEmptyResponse = errors.New("empty provider response")
type Provider func(context.Context) (string, error)

func callProvider(parent context.Context, timeout time.Duration, provider Provider) (string, error) {
	// TODO: 派生 deadline、传递取消，并拒绝空响应。
	return provider(parent)
}
''',
        "solution": '''package main

import (
	"context"
	"errors"
	"strings"
	"time"
)

var errEmptyResponse = errors.New("empty provider response")
type Provider func(context.Context) (string, error)

func callProvider(parent context.Context, timeout time.Duration, provider Provider) (string, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	value, err := provider(ctx)
	if err != nil { return "", err }
	if strings.TrimSpace(value) == "" { return "", errEmptyResponse }
	return value, nil
}
''',
        "test": '''package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCallProvider(t *testing.T) {
	t.Run("deadline reaches provider", func(t *testing.T) {
		observed := make(chan error, 1)
		provider := func(ctx context.Context) (string, error) { <-ctx.Done(); observed <- ctx.Err(); return "", ctx.Err() }
		result := make(chan error, 1)
		go func() { _, err := callProvider(context.Background(), 15*time.Millisecond, provider); result <- err }()
		select {
		case err := <-result:
			if !errors.Is(err, context.DeadlineExceeded) || !errors.Is(<-observed, context.DeadlineExceeded) { t.Fatalf("deadline was not propagated: %v", err) }
		case <-time.After(200*time.Millisecond):
			t.Fatal("Provider did not receive the derived deadline")
		}
	})
	t.Run("parent cancellation reaches provider", func(t *testing.T) {
		parent, cancel := context.WithCancel(context.Background()); cancel()
		_, err := callProvider(parent, time.Second, func(ctx context.Context) (string, error) { return "", ctx.Err() })
		if !errors.Is(err, context.Canceled) { t.Fatalf("cancel was not preserved: %v", err) }
	})
	t.Run("empty and original error", func(t *testing.T) {
		if _, err := callProvider(context.Background(), time.Second, func(context.Context) (string,error) { return "  ", nil }); !errors.Is(err, errEmptyResponse) { t.Fatalf("empty response accepted: %v", err) }
		upstream := errors.New("provider unavailable")
		if _, err := callProvider(context.Background(), time.Second, func(context.Context) (string,error) { return "", upstream }); !errors.Is(err, upstream) { t.Fatalf("upstream error replaced: %v", err) }
	})
}
''',
    },
    "supplement-go-ai-02": {
        "title": "严格解析模型决策",
        "prompt": "补全 decodeDecision：拒绝未知字段、尾随 JSON、非法 action、越界 confidence 和空 reason。",
        "testIntent": "固定测试证明“能反序列化”不等于“可以执行”；非法输入必须 fail closed。",
        "hints": ["使用 json.Decoder 并开启 DisallowUnknownFields。", "第一次 Decode 后还要确认已经到 EOF。", "结构通过后再校验枚举、范围和必填字段。"],
        "failureHint": "若未知字段仍通过，检查 decoder；若尾随内容通过，再做一次 Decode。",
        "code": '''package main

import "encoding/json"

type Decision struct { Action string `json:"action"`; Confidence float64 `json:"confidence"`; Reason string `json:"reason"` }

func decodeDecision(raw string) (Decision, error) {
	var decision Decision
	err := json.Unmarshal([]byte(raw), &decision)
	// TODO: 严格校验结构和业务语义。
	return decision, err
}
''',
        "solution": '''package main

import (
	"encoding/json"
	"errors"
	"io"
	"strings"
)

type Decision struct { Action string `json:"action"`; Confidence float64 `json:"confidence"`; Reason string `json:"reason"` }

func decodeDecision(raw string) (Decision, error) {
	var decision Decision
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&decision); err != nil { return Decision{}, err }
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) { return Decision{}, errors.New("trailing json") }
	if decision.Action != "observe" && decision.Action != "reject" { return Decision{}, errors.New("invalid action") }
	if decision.Confidence < 0 || decision.Confidence > 1 { return Decision{}, errors.New("invalid confidence") }
	if strings.TrimSpace(decision.Reason) == "" { return Decision{}, errors.New("reason required") }
	return decision, nil
}
''',
        "test": '''package main

import "testing"

func TestDecodeDecision(t *testing.T) {
	valid := `{"action":"observe","confidence":0.8,"reason":"supported"}`
	if _, err := decodeDecision(valid); err != nil { t.Fatalf("valid decision rejected: %v", err) }
	invalid := []string{
		`{"action":"observe","confidence":0.8,"reason":"ok","execute":true}`,
		valid + ` {}`,
		`{"action":"delete","confidence":0.8,"reason":"ok"}`,
		`{"action":"observe","confidence":1.1,"reason":"ok"}`,
		`{"action":"observe","confidence":0.8,"reason":" "}`,
	}
	for _, raw := range invalid { if _, err := decodeDecision(raw); err == nil { t.Fatalf("invalid decision accepted: %s", raw) } }
}
''',
    },
    "supplement-go-ai-03": {
        "title": "实现租户作用域幂等",
        "prompt": "补全 Create：同租户、同 key、同 input hash 复用 Run；同 key 不同输入冲突；不同租户互不影响。",
        "testIntent": "固定测试同时检查重试复用、输入冲突、租户隔离和冲突时不产生额外写入。",
        "hints": ["索引键必须同时包含 tenant 和 idempotency key。", "命中旧记录后先比较 input hash。", "冲突时不要覆盖旧记录。"],
        "failureHint": "若跨租户复用了 Run，先修 scoped key；若冲突被吞掉，再比较 input hash。",
        "code": '''package main

import "errors"

var ErrConflict = errors.New("idempotency conflict")
type runRecord struct { ID, InputHash string }
type runStore struct { byKey map[string]runRecord; writes int }

func (s *runStore) Create(tenant, key, inputHash, newID string) (string, error) {
	// TODO: key 要有租户作用域，且相同 key 必须绑定同一输入。
	if old, ok := s.byKey[key]; ok { return old.ID, nil }
	s.byKey[key] = runRecord{ID: newID, InputHash: inputHash}; s.writes++
	return newID, nil
}
''',
        "solution": '''package main

import "errors"

var ErrConflict = errors.New("idempotency conflict")
type runRecord struct { ID, InputHash string }
type runStore struct { byKey map[string]runRecord; writes int }

func (s *runStore) Create(tenant, key, inputHash, newID string) (string, error) {
	if s.byKey == nil { s.byKey = map[string]runRecord{} }
	scoped := tenant + "\\x00" + key
	if old, ok := s.byKey[scoped]; ok {
		if old.InputHash != inputHash { return "", ErrConflict }
		return old.ID, nil
	}
	s.byKey[scoped] = runRecord{ID: newID, InputHash: inputHash}; s.writes++
	return newID, nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
)

func TestRunIdempotency(t *testing.T) {
	s := &runStore{byKey: map[string]runRecord{}}
	first, err := s.Create("tenant-a", "request-1", "hash-a", "run-1"); if err != nil { t.Fatal(err) }
	retry, err := s.Create("tenant-a", "request-1", "hash-a", "run-2"); if err != nil || retry != first || s.writes != 1 { t.Fatalf("retry created another run: id=%q writes=%d err=%v", retry, s.writes, err) }
	if _, err := s.Create("tenant-a", "request-1", "hash-b", "run-3"); !errors.Is(err, ErrConflict) || s.writes != 1 { t.Fatalf("changed input must conflict without writing: %v", err) }
	other, err := s.Create("tenant-b", "request-1", "hash-a", "run-4"); if err != nil || other != "run-4" || s.writes != 2 { t.Fatalf("tenant isolation failed: id=%q writes=%d err=%v", other, s.writes, err) }
}
''',
    },
    "supplement-go-ai-04": {
        "title": "在服务端授权工具调用",
        "prompt": "补全 authorizeTool：工具必须在 allowlist 中，调用必须绑定 tenant/run，路径必须留在相对工作区内。",
        "testIntent": "固定测试覆盖未知工具、缺失身份、绝对路径和路径穿越；拒绝发生在任何文件读取之前。",
        "hints": ["先校验服务端 allowlist。", "tenant 和 run 不能为空。", "用 filepath.Clean 后拒绝绝对路径、.. 与 ../ 前缀。"],
        "failureHint": "从第一条被误放行的 case 看缺的是工具、身份还是路径边界。",
        "code": '''package main

import "errors"

var ErrDenied = errors.New("tool denied")

func authorizeTool(name, requestedPath, tenant, run string, allow map[string]bool) error {
	// TODO: 所有能力都由服务端签发。
	if !allow[name] { return ErrDenied }
	return nil
}
''',
        "solution": '''package main

import (
	"errors"
	"path/filepath"
	"strings"
)

var ErrDenied = errors.New("tool denied")

func authorizeTool(name, requestedPath, tenant, run string, allow map[string]bool) error {
	if !allow[name] || tenant == "" || run == "" || requestedPath == "" { return ErrDenied }
	clean := filepath.Clean(requestedPath)
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) { return ErrDenied }
	return nil
}
''',
        "test": '''package main

import "testing"

func TestAuthorizeTool(t *testing.T) {
	allow := map[string]bool{"read_ledger": true}
	if err := authorizeTool("read_ledger", "reports/today.json", "tenant-a", "run-1", allow); err != nil { t.Fatalf("valid call rejected: %v", err) }
	denied := [][4]string{
		{"shell", "reports/today.json", "tenant-a", "run-1"},
		{"read_ledger", "reports/today.json", "", "run-1"},
		{"read_ledger", "reports/today.json", "tenant-a", ""},
		{"read_ledger", "../secret", "tenant-a", "run-1"},
		{"read_ledger", "/etc/passwd", "tenant-a", "run-1"},
	}
	for _, c := range denied { if err := authorizeTool(c[0], c[1], c[2], c[3], allow); err == nil { t.Fatalf("unsafe call accepted: %#v", c) } }
}
''',
    },
    "supplement-go-ai-05": {
        "title": "用 fencing token 拦住迟到写入",
        "prompt": "补全 Commit：只有当前 fencing token 能提交副作用；旧 worker 即使恢复，也不能增加 effects。",
        "testIntent": "固定测试在 -race 下并发提交新旧 token，并断言旧 worker 的副作用为零。",
        "hints": ["锁必须覆盖 token 校验和副作用提交。", "先比较 submitted 与 current。", "不匹配时返回 ErrStaleWorker，不能先写后报错。"],
        "failureHint": "若 effects 数量过大，说明 fence 没有和副作用放在同一个临界区。",
        "race": True,
        "code": '''package main

import (
	"errors"
	"sync"
)

var ErrStaleWorker = errors.New("stale worker")
type effectStore struct { mu sync.Mutex; current uint64; effects int }

func (s *effectStore) Commit(submitted uint64) error {
	s.mu.Lock(); defer s.mu.Unlock()
	// TODO: 校验 fence 后才能提交副作用。
	s.effects++
	return nil
}
''',
        "solution": '''package main

import (
	"errors"
	"sync"
)

var ErrStaleWorker = errors.New("stale worker")
type effectStore struct { mu sync.Mutex; current uint64; effects int }

func (s *effectStore) Commit(submitted uint64) error {
	s.mu.Lock(); defer s.mu.Unlock()
	if submitted != s.current { return ErrStaleWorker }
	s.effects++
	return nil
}
''',
        "test": '''package main

import (
	"errors"
	"sync"
	"testing"
)

func TestFenceProtectsEffect(t *testing.T) {
	s := &effectStore{current: 2}
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); if err := s.Commit(1); !errors.Is(err, ErrStaleWorker) { t.Errorf("stale commit: %v", err) } }()
		go func() { defer wg.Done(); if err := s.Commit(2); err != nil { t.Errorf("current commit: %v", err) } }()
	}
	wg.Wait()
	if s.effects != 100 { t.Fatalf("effects=%d, want 100 current-worker effects", s.effects) }
}
''',
    },
    "supplement-go-ai-06": {
        "title": "按游标重放缺失事件",
        "prompt": "补全 eventsAfter：只返回 ID 大于 Last-Event-ID 的事件，保持原顺序且不重复已确认事件。",
        "testIntent": "固定测试模拟客户端确认 event 3 后重连，要求只收到 4、5，并检查源切片不被修改。",
        "hints": ["过滤条件必须是 ID > lastEventID。", "按输入顺序 append 到新切片。", "不要返回底层数组的可变窗口。"],
        "failureHint": "若 event 3 又出现，检查比较符；若修改结果影响源数据，检查是否复制。",
        "code": '''package main

type Event struct { ID int64; Type, Data string }

func eventsAfter(events []Event, lastEventID int64) []Event {
	// TODO: 只复制游标之后的事件。
	return events
}
''',
        "solution": '''package main

type Event struct { ID int64; Type, Data string }

func eventsAfter(events []Event, lastEventID int64) []Event {
	out := make([]Event, 0, len(events))
	for _, event := range events { if event.ID > lastEventID { out = append(out, event) } }
	return out
}
''',
        "test": '''package main

import "testing"

func TestEventsAfter(t *testing.T) {
	source := []Event{{1,"state","queued"},{2,"state","running"},{3,"delta","a"},{4,"delta","b"},{5,"done","ok"}}
	got := eventsAfter(source, 3)
	if len(got) != 2 || got[0].ID != 4 || got[1].ID != 5 { t.Fatalf("unexpected replay: %#v", got) }
	got[0].Data = "changed"
	if source[3].Data != "b" { t.Fatal("replay must not alias mutable source storage") }
}
''',
    },
    "supplement-go-ai-07": {
        "title": "让安全回归成为独立门禁",
        "prompt": "补全 releaseGate：质量分达标仍不够；安全失败必须独立阻断，评测元数据缺失也不能发布。",
        "testIntent": "固定测试证明平均分不能掩盖越权，并校验 dataset、prompt、provider 三个版本均有记录。",
        "hints": ["先检查三类版本元数据非空。", "安全失败数必须等于零。", "最后再比较质量分阈值。"],
        "failureHint": "若安全失败仍通过，不要把 safety 合并进平均分。",
        "code": '''package main

type EvalResult struct { Quality float64; SafetyFailures int; DatasetVersion, PromptVersion, ProviderVersion string }

func releaseGate(result EvalResult, minQuality float64) bool {
	// TODO: 安全与证据元数据都是独立门禁。
	return result.Quality >= minQuality
}
''',
        "solution": '''package main

type EvalResult struct { Quality float64; SafetyFailures int; DatasetVersion, PromptVersion, ProviderVersion string }

func releaseGate(result EvalResult, minQuality float64) bool {
	if result.DatasetVersion == "" || result.PromptVersion == "" || result.ProviderVersion == "" { return false }
	if result.SafetyFailures != 0 { return false }
	return result.Quality >= minQuality
}
''',
        "test": '''package main

import "testing"

func TestReleaseGate(t *testing.T) {
	base := EvalResult{Quality: .95, DatasetVersion: "data-v1", PromptVersion: "prompt-v3", ProviderVersion: "fake-v2"}
	if !releaseGate(base, .9) { t.Fatal("valid evaluation rejected") }
	unsafe := base; unsafe.SafetyFailures = 1
	if releaseGate(unsafe, .9) { t.Fatal("security failure must block independently") }
	low := base; low.Quality = .89
	if releaseGate(low, .9) { t.Fatal("quality regression accepted") }
	missing := base; missing.PromptVersion = ""
	if releaseGate(missing, .9) { t.Fatal("unversioned evaluation accepted") }
}
''',
    },
    "supplement-go-ai-08": {
        "title": "签发有边界的发布结论",
        "prompt": "补全 assessRelease：测试、race、故障、安全、恢复、审计证据缺一不可；fake provider 不能被写成真实 SLA 已验证。",
        "testIntent": "固定测试覆盖缺证据阻断和能力边界，避免把一次本地全绿夸大为真实供应商保障。",
        "hints": ["先逐项检查六类发布证据。", "缺任一项返回 blocked。", "provider 为 fake 时返回 local-boundary，不得返回 production-sla。"],
        "failureHint": "若缺测试仍 ready，先补齐证据门禁；若 fake 被写成 SLA，修正结论边界。",
        "code": '''package main

type ReleaseEvidence struct { Tests, Race, Faults, Security, Recovery, Audit bool; Provider string }

func assessRelease(e ReleaseEvidence) string {
	// TODO: 先验收证据，再声明结论边界。
	return "production-sla"
}
''',
        "solution": '''package main

type ReleaseEvidence struct { Tests, Race, Faults, Security, Recovery, Audit bool; Provider string }

func assessRelease(e ReleaseEvidence) string {
	if !e.Tests || !e.Race || !e.Faults || !e.Security || !e.Recovery || !e.Audit { return "blocked" }
	if e.Provider == "fake" { return "local-boundary" }
	return "production-sla"
}
''',
        "test": '''package main

import "testing"

func TestAssessRelease(t *testing.T) {
	complete := ReleaseEvidence{Tests:true, Race:true, Faults:true, Security:true, Recovery:true, Audit:true, Provider:"fake"}
	if got := assessRelease(complete); got != "local-boundary" { t.Fatalf("fake provider claim=%q", got) }
	missing := complete; missing.Recovery = false
	if got := assessRelease(missing); got != "blocked" { t.Fatalf("missing recovery claim=%q", got) }
	real := complete; real.Provider = "verified-production"
	if got := assessRelease(real); got != "production-sla" { t.Fatalf("verified provider claim=%q", got) }
}
''',
    },
}

GO_AI_PROJECT_PRACTICES = {
    "supplement-go-ai-01": {
        "title": "把超时真正传进 Provider",
        "prompt": "补全生产 seam invokeProvider：从父 context 派生硬超时，在当前 goroutine 调用 Provider，并原样保留取消或上游错误。",
        "seam": "invokeProvider(parent context.Context, provider Provider, timeout time.Duration, req ProviderRequest) ([]byte, error)",
        "buildTag": "learner01",
        "testIntent": "测试直接替换生产 Provider，确认 deadline 可见、父取消可见，且已经过期的调用结果不能被接受。",
        "hints": ["使用 context.WithTimeout(parent, timeout)。", "必须把派生 ctx 传给 provider.Decide。", "Provider 返回后再次检查 ctx.Err，错误不要重新包装。"],
        "failureHint": "若测试提示 no deadline，说明仍把 parent 传给了 Provider；若慢响应被接受，返回前漏查了 ctx.Err。",
        "code": '''//go:build learner01

package ledgeragent

import (
	"context"
	"time"
)

func invokeProvider(parent context.Context, provider Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) {
	// TODO: 派生 deadline，并把同一个调用链传给 Provider。
	return provider.Decide(parent, req)
}
''',
        "solution": '''//go:build learner01

package ledgeragent

import (
	"context"
	"time"
)

func invokeProvider(parent context.Context, provider Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	body, err := provider.Decide(ctx, req)
	if err != nil { return nil, err }
	if err := ctx.Err(); err != nil { return nil, err }
	return body, nil
}
''',
        "test": '''package ledgeragent

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestLearner01ProviderDeadline(t *testing.T) {
	probe := ProviderFunc(func(ctx context.Context, _ ProviderRequest) ([]byte, error) {
		if _, ok := ctx.Deadline(); !ok { return nil, errors.New("no derived deadline") }
		<-ctx.Done()
		return nil, ctx.Err()
	})
	_, err := invokeProvider(context.Background(), probe, 5*time.Millisecond, ProviderRequest{TenantID:"t", RunID:"r"})
	if !errors.Is(err, context.DeadlineExceeded) { t.Fatalf("deadline not propagated: %v", err) }
	parent, cancel := context.WithCancel(context.Background()); cancel()
	_, err = invokeProvider(parent, probe, time.Second, ProviderRequest{})
	if !errors.Is(err, context.Canceled) { t.Fatalf("parent cancellation lost: %v", err) }
}
''',
    },
    "supplement-go-ai-02": {
        "title": "严格解码生产 Decision",
        "prompt": "补全 decodeDecisionStrict：使用生产 Decision 契约，拒绝未知字段、多个 JSON 值和 answer/tool 混合状态。",
        "seam": "decodeDecisionStrict(body []byte) (Decision, error)",
        "buildTag": "learner02",
        "testIntent": "有效 answer 与 tool 可进入系统；未知字段、尾随 JSON、空 answer 和混合字段必须以 ErrInvalidDecision 关闭失败。",
        "hints": ["Decoder 开启 DisallowUnknownFields。", "首个 Decode 后调用现有 ensureEOF。", "按 Kind 校验互斥字段和 JSON arguments。"],
        "failureHint": "若结构错误却通过，不要只用 json.Unmarshal；解析成功后仍要执行领域状态校验。",
        "code": '''//go:build learner02

package ledgeragent

import "encoding/json"

func decodeDecisionStrict(body []byte) (Decision, error) {
	var decision Decision
	// TODO: 这只能证明 JSON 能解码，尚未证明 Decision 可执行。
	err := json.Unmarshal(body, &decision)
	return decision, err
}
''',
        "solution": '''//go:build learner02

package ledgeragent

import (
	"bytes"
	"encoding/json"
	"fmt"
)

func decodeDecisionStrict(body []byte) (Decision, error) {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	var decision Decision
	if err := decoder.Decode(&decision); err != nil { return Decision{}, fmt.Errorf("%w: %v", ErrInvalidDecision, err) }
	if err := ensureEOF(decoder); err != nil { return Decision{}, fmt.Errorf("%w: %v", ErrInvalidDecision, err) }
	switch decision.Kind {
	case "answer":
		if decision.Answer == "" || decision.Tool != "" || len(decision.Arguments) != 0 { return Decision{}, fmt.Errorf("%w: invalid answer", ErrInvalidDecision) }
	case "tool":
		if decision.Tool == "" || decision.Answer != "" || len(decision.Arguments) == 0 || !json.Valid(decision.Arguments) { return Decision{}, fmt.Errorf("%w: invalid tool", ErrInvalidDecision) }
	default:
		return Decision{}, fmt.Errorf("%w: unsupported kind %q", ErrInvalidDecision, decision.Kind)
	}
	return decision, nil
}
''',
        "test": '''package ledgeragent

import (
	"errors"
	"testing"
)

func TestLearner02StrictDecision(t *testing.T) {
	valid := [][]byte{[]byte(`{"kind":"answer","answer":"ok"}`), []byte(`{"kind":"tool","tool":"reports.read","arguments":{"path":"a"}}`)}
	for _, body := range valid { if _, err := decodeDecisionStrict(body); err != nil { t.Fatalf("valid rejected: %v", err) } }
	invalid := [][]byte{[]byte(`{"kind":"answer","answer":"ok","extra":1}`), []byte(`{"kind":"answer","answer":"ok"} {}`), []byte(`{"kind":"answer","answer":""}`), []byte(`{"kind":"answer","answer":"ok","tool":"x"}`)}
	for _, body := range invalid { if _, err := decodeDecisionStrict(body); !errors.Is(err, ErrInvalidDecision) { t.Fatalf("invalid accepted or wrong error: %s: %v", body, err) } }
}
''',
    },
    "supplement-go-ai-03": {
        "title": "生成租户作用域幂等身份",
        "prompt": "补全 idempotencyIdentity：校验生产 CreateRunRequest，返回 tenant+key 作用域和输入摘要，禁止跨租户碰撞。",
        "seam": "idempotencyIdentity(req CreateRunRequest) (key string, digest string, err error)",
        "buildTag": "learner03",
        "testIntent": "同租户同 key 产生稳定 scope，同 key 跨租户必须不同；输入变化只改变 digest，缺字段立即拒绝。",
        "hints": ["三个必填字段先统一校验。", "scope 同时包含 TenantID 和 IdempotencyKey。", "摘要调用生产 digestString，不保存原文。"],
        "failureHint": "若跨租户 scope 相同，租户没有进入索引身份；若输入原文出现在结果里，未使用摘要函数。",
        "code": '''//go:build learner03

package ledgeragent

import "fmt"

func idempotencyIdentity(req CreateRunRequest) (key string, digest string, err error) {
	if req.TenantID == "" || req.IdempotencyKey == "" || req.Input == "" { return "", "", fmt.Errorf("required") }
	// TODO: key 不能脱离 tenant；input 不能作为明文身份保存。
	return req.IdempotencyKey, req.Input, nil
}
''',
        "solution": '''//go:build learner03

package ledgeragent

import "fmt"

func idempotencyIdentity(req CreateRunRequest) (key string, digest string, err error) {
	if req.TenantID == "" || req.IdempotencyKey == "" || req.Input == "" { return "", "", fmt.Errorf("tenant_id, idempotency_key and input are required") }
	return req.TenantID + "\\x00" + req.IdempotencyKey, digestString(req.Input), nil
}
''',
        "test": '''package ledgeragent

import "testing"

func TestLearner03IdempotencyIdentity(t *testing.T) {
	a, da, err := idempotencyIdentity(CreateRunRequest{TenantID:"a", IdempotencyKey:"k", Input:"same"}); if err != nil { t.Fatal(err) }
	b, db, err := idempotencyIdentity(CreateRunRequest{TenantID:"b", IdempotencyKey:"k", Input:"same"}); if err != nil { t.Fatal(err) }
	if a == b || da != db || da == "same" { t.Fatalf("scope/digest boundary failed: %q %q %q %q", a, b, da, db) }
	_, dc, _ := idempotencyIdentity(CreateRunRequest{TenantID:"a", IdempotencyKey:"k", Input:"changed"}); if dc == da { t.Fatal("changed input kept same digest") }
	if _, _, err := idempotencyIdentity(CreateRunRequest{TenantID:"", IdempotencyKey:"k", Input:"x"}); err == nil { t.Fatal("missing tenant accepted") }
}
''',
    },
    "supplement-go-ai-04": {
        "title": "把工具路径限制在 os.Root 内",
        "prompt": "补全 validateToolPath：先拒绝空路径和绝对路径；生产 resolve 继续由 os.Root 在打开时阻断穿越与符号链接逃逸。",
        "seam": "validateToolPath(path string) error",
        "buildTag": "learner04",
        "testIntent": "相对路径可以交给 os.Root；空路径、绝对路径被预检拒绝，../ 逃逸在真实文件打开边界失败。",
        "hints": ["空路径没有业务含义，直接拒绝。", "使用 filepath.IsAbs 拒绝绝对路径。", "不要用字符串拼接路径；resolve 必须调用 root.Open。"],
        "failureHint": "若绝对路径通过，缺少 filepath.IsAbs；若 ../ 能读到根外文件，resolve 没有走 os.Root。",
        "code": '''//go:build learner04

package ledgeragent

func validateToolPath(path string) error {
	// TODO: 在进入 os.Root 前完成廉价、确定的输入拒绝。
	return nil
}
''',
        "solution": '''//go:build learner04

package ledgeragent

import (
	"errors"
	"path/filepath"
)

func validateToolPath(path string) error {
	if path == "" { return errors.New("path is required") }
	if filepath.IsAbs(path) { return errors.New("relative path is required") }
	return nil
}
''',
        "test": '''package ledgeragent

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLearner04ToolPath(t *testing.T) {
	if validateToolPath("reports/today.json") != nil { t.Fatal("relative path rejected") }
	for _, path := range []string{"", filepath.Join(string(filepath.Separator), "etc", "passwd")} { if validateToolPath(path) == nil { t.Fatalf("unsafe path accepted: %q", path) } }
	base := t.TempDir(); rootDir := filepath.Join(base, "root"); if err := os.Mkdir(rootDir, 0700); err != nil { t.Fatal(err) }
	if err := os.WriteFile(filepath.Join(base, "secret"), []byte("secret"), 0600); err != nil { t.Fatal(err) }
	root, err := os.OpenRoot(rootDir); if err != nil { t.Fatal(err) }; defer root.Close()
	if file, err := resolve(root, "../secret"); err == nil { file.Close(); t.Fatal("os.Root escape succeeded") }
}
''',
    },
    "supplement-go-ai-05": {
        "title": "在副作用前验证完整 lease",
        "prompt": "补全 validateFence：当前时间、run/step 状态、step、worker、fence、token 和 lease 到期时间必须共同匹配。",
        "seam": "validateFence(now time.Time, r *record, lease Lease) error",
        "buildTag": "learner05",
        "testIntent": "有效 lease 通过；旧 fence、错误 token、错误 worker 和到期 lease 全部返回 ErrStaleLease。",
        "hints": ["状态必须同时是 running。", "身份比较包含 StepID、WorkerID、Fence 和 Token。", "只有 now.Before(LeaseUntil) 才仍有效。"],
        "failureHint": "若篡改单个字段仍通过，把所有 lease 身份条件收进同一个 fail-closed 判断。",
        "code": '''//go:build learner05

package ledgeragent

import "time"

func validateFence(now time.Time, r *record, lease Lease) error {
	// TODO: fence 不是唯一凭证，必须验证完整 lease。
	if r.step.Fence != lease.Fence { return ErrStaleLease }
	return nil
}
''',
        "solution": '''//go:build learner05

package ledgeragent

import "time"

func validateFence(now time.Time, r *record, lease Lease) error {
	if r.run.Status != StatusRunning || r.step.Status != StatusRunning || r.step.ID != lease.StepID || r.step.LeaseOwner != lease.WorkerID || r.step.Fence != lease.Fence || r.token != lease.Token || !now.Before(r.step.LeaseUntil) { return ErrStaleLease }
	return nil
}
''',
        "test": '''package ledgeragent

import (
	"errors"
	"testing"
	"time"
)

func TestLearner05Fence(t *testing.T) {
	now := time.Now(); r := &record{run:Run{Status:StatusRunning}, step:Step{ID:"s", Status:StatusRunning, LeaseOwner:"w", Fence:2, LeaseUntil:now.Add(time.Minute)}, token:"token"}
	good := Lease{StepID:"s", WorkerID:"w", Fence:2, Token:"token"}
	if err := validateFence(now, r, good); err != nil { t.Fatalf("valid lease rejected: %v", err) }
	bad := []Lease{good, good, good}; bad[0].Fence=1; bad[1].Token="wrong"; bad[2].WorkerID="other"
	for _, lease := range bad { if err := validateFence(now, r, lease); !errors.Is(err, ErrStaleLease) { t.Fatalf("stale lease accepted: %#v %v", lease, err) } }
	if err := validateFence(now.Add(2*time.Minute), r, good); !errors.Is(err, ErrStaleLease) { t.Fatal("expired lease accepted") }
}
''',
        "race": True,
    },
    "supplement-go-ai-06": {
        "title": "按生产 Sequence 深拷贝事件",
        "prompt": "补全 copyEventsAfter：只复制 Sequence 大于游标的 Event，并深拷贝 json.RawMessage，避免重连结果修改事件日志。",
        "seam": "copyEventsAfter(events []Event, after int64) []Event",
        "buildTag": "learner06",
        "testIntent": "Last-Event-ID=3 时只得到 4、5；修改返回 Event.Data 不得改变 Store 的源事件。",
        "hints": ["游标条件是 Sequence > after。", "每个 Event 先做值复制。", "Data 用 append(json.RawMessage(nil), event.Data...) 深拷贝。"],
        "failureHint": "若事件 3 重复出现，比较符错误；若源 Data 被改，RawMessage 仍共享底层数组。",
        "code": '''//go:build learner06

package ledgeragent

func copyEventsAfter(events []Event, after int64) []Event {
	// TODO: 过滤游标并切断 Data 的底层数组别名。
	return events
}
''',
        "solution": '''//go:build learner06

package ledgeragent

import "encoding/json"

func copyEventsAfter(events []Event, after int64) []Event {
	var out []Event
	for _, event := range events {
		if event.Sequence <= after { continue }
		copyEvent := event
		copyEvent.Data = append(json.RawMessage(nil), event.Data...)
		out = append(out, copyEvent)
	}
	return out
}
''',
        "test": '''package ledgeragent

import "testing"

func TestLearner06EventCopy(t *testing.T) {
	source := []Event{{Sequence:3,Data:[]byte(`{"v":3}`)},{Sequence:4,Data:[]byte(`{"v":4}`)},{Sequence:5,Data:[]byte(`{"v":5}`)}}
	got := copyEventsAfter(source, 3)
	if len(got) != 2 || got[0].Sequence != 4 || got[1].Sequence != 5 { t.Fatalf("bad replay: %#v", got) }
	got[0].Data[0] = '['
	if source[1].Data[0] != '{' { t.Fatal("replay aliases source Data") }
}
''',
    },
    "supplement-go-ai-07": {
        "title": "实现独立安全评测门禁",
        "prompt": "补全生产 AssessEval：版本证据缺失、非法策略、普通失败或安全失败超过独立阈值时，报告不得通过。",
        "seam": "AssessEval(versions EvidenceVersions, policy EvalPolicy, results []EvalResult) EvalReport",
        "buildTag": "learner07",
        "testIntent": "安全失败不能被普通通过样本平均掉；阈值、版本元数据和 Results 证据必须原样进入报告。",
        "hints": ["先以 Passed=true 构造完整报告。", "普通失败立即关闭总门禁。", "安全失败单独计数，最后与 MaxSecurityFailures 比较。"],
        "failureHint": "若一个安全失败在阈值 0 时仍通过，说明安全计数没有作为独立门禁。",
        "code": '''//go:build learner07

package ledgeragent

func AssessEval(versions EvidenceVersions, policy EvalPolicy, results []EvalResult) EvalReport {
	// TODO: 不要让平均意义上的成功掩盖安全回归。
	return EvalReport{Passed:true, Policy:policy, Versions:versions, Results:results}
}
''',
        "solution": '''//go:build learner07

package ledgeragent

func AssessEval(versions EvidenceVersions, policy EvalPolicy, results []EvalResult) EvalReport {
	report := EvalReport{Passed:true, Policy:policy, Versions:versions, Results:results}
	if versions.Dataset == "" || versions.Prompt == "" || versions.Provider == "" || policy.MaxSecurityFailures < 0 { report.Passed = false }
	for _, result := range results {
		if result.Passed { continue }
		if result.Security { report.SecurityFailures++ } else { report.Passed = false }
	}
	if report.SecurityFailures > policy.MaxSecurityFailures { report.Passed = false }
	return report
}
''',
        "test": '''package ledgeragent

import "testing"

func TestLearner07EvalGate(t *testing.T) {
	versions := EvidenceVersions{Dataset:"d1", Prompt:"p1", Provider:"provider1"}
	unsafe := []EvalResult{{CaseID:"hostile", Security:true, Passed:false}}
	report := AssessEval(versions, EvalPolicy{MaxSecurityFailures:0}, unsafe)
	if report.Passed || report.SecurityFailures != 1 || len(report.Results) != 1 { t.Fatalf("security gate failed: %#v", report) }
	if !AssessEval(versions, EvalPolicy{MaxSecurityFailures:1}, unsafe).Passed { t.Fatal("explicit threshold ignored") }
	if AssessEval(EvidenceVersions{}, EvalPolicy{}, nil).Passed { t.Fatal("unversioned evidence accepted") }
	if AssessEval(versions, EvalPolicy{}, []EvalResult{{CaseID:"quality", Passed:false}}).Passed { t.Fatal("ordinary failure accepted") }
}
''',
    },
    "supplement-go-ai-08": {
        "title": "非阻塞预留 Worker 容量",
        "prompt": "补全 reserveWorkerSlot：容量可用时立即占位，满载或 nil channel 时立即返回 false，HTTP 层据此返回 429。",
        "seam": "reserveWorkerSlot(slots chan struct{}) bool",
        "buildTag": "learner08",
        "testIntent": "第一请求成功占位，满载第二请求在毫秒级返回 false；释放后容量可复用，nil channel 不得挂住。",
        "hints": ["使用 select，而不是先查询 len。", "发送成功返回 true。", "default 分支返回 false，天然覆盖满载和 nil channel。"],
        "failureHint": "若满载测试挂住，缺少 default；若返回 true 却未占位，只做了容量观察而没有发送。",
        "code": '''//go:build learner08

package ledgeragent

func reserveWorkerSlot(slots chan struct{}) bool {
	// TODO: 尝试真实占位，但永远不能等待。
	return true
}
''',
        "solution": '''//go:build learner08

package ledgeragent

func reserveWorkerSlot(slots chan struct{}) bool {
	select {
	case slots <- struct{}{}: return true
	default: return false
	}
}
''',
        "test": '''package ledgeragent

import (
	"testing"
	"time"
)

func TestLearner08Admission(t *testing.T) {
	slots := make(chan struct{}, 1)
	if !reserveWorkerSlot(slots) || len(slots) != 1 { t.Fatal("available slot not reserved") }
	started := time.Now(); if reserveWorkerSlot(slots) { t.Fatal("full capacity accepted") }; if time.Since(started) > 50*time.Millisecond { t.Fatal("full capacity blocked") }
	<-slots; if !reserveWorkerSlot(slots) { t.Fatal("released capacity not reusable") }
	if reserveWorkerSlot(nil) { t.Fatal("nil capacity accepted") }
}
''',
    },
}

GO_PRACTICES = {
    1: {
        "title": "补全结账函数",
        "prompt": "修改 settle，让正常付款、刚好付款、钱不够和非法价格都通过测试。",
        "code": '''package main

import "errors"

var ErrInvalidPrice = errors.New("invalid price")
var ErrInsufficientPayment = errors.New("insufficient payment")

func settle(price, paid int64) (int64, error) {
    // TODO: 先检查价格和付款，再返回找零。
    return 0, nil
}

''',
        "test": '''package main
import ("errors"; "testing")
func TestSettle(t *testing.T) {
 cases:=[]struct{name string; price,paid,want int64; err error}{
  {"change",7,10,3,nil},{"exact",7,7,0,nil},
  {"short",7,5,0,ErrInsufficientPayment},{"invalid",0,10,0,ErrInvalidPrice},
 }
 for _,c:=range cases { t.Run(c.name,func(t *testing.T){ got,err:=settle(c.price,c.paid); if got!=c.want || !errors.Is(err,c.err){t.Fatalf("got (%d,%v), want (%d,%v)",got,err,c.want,c.err)} }) }
}''',
    },
    2: {
        "title": "让账单 JSON 契约稳定",
        "prompt": "补全字段与 JSON tag，让编码结果只暴露 id 和 amount_cents。",
        "code": '''package main
import "encoding/json"
type Bill struct {
    // TODO: 导出字段，并写出正确的 json tag。
    id string
    amount int64
}
func encodeBill(b Bill) ([]byte,error){ return json.Marshal(b) }
''',
        "test": '''package main
import ("encoding/json"; "testing")
func TestBillJSON(t *testing.T){
 raw,err:=encodeBill(Bill{ID:"b1",AmountCents:1200}); if err!=nil{t.Fatal(err)}
 var got map[string]any; if err:=json.Unmarshal(raw,&got);err!=nil{t.Fatal(err)}
 if len(got)!=2 || got["id"]!="b1" || got["amount_cents"]!=float64(1200){t.Fatalf("unexpected JSON: %s",raw)}
}''',
    },
    3: {
        "title": "复制一份真正独立的剑谱",
        "prompt": "实现 clone，使修改副本不会改到原 slice。",
        "code": '''package main
func clone(src []string) []string {
    // TODO: 不能只把 slice 头复制一份。
    return src
}
''',
        "test": '''package main
import "testing"
func TestCloneIsIndependent(t *testing.T){
 src:=[]string{"a","b"}; got:=clone(src); got[0]="changed"
 if src[0]!="a"{t.Fatalf("source was mutated: %v",src)}
 if len(got)!=2 || got[1]!="b"{t.Fatalf("bad clone: %v",got)}
}''',
    },
    4: {
        "title": "让调用方只依赖需要的本领",
        "prompt": "定义最小 Reader 接口，让 readName 接受任何具有 Get 方法的实现。",
        "code": '''package main
// TODO: 定义 Reader，只要求 Get(id string) (string, error)。

func readName(store Reader, id string) (string,error){
    return store.Get(id)
}
''',
        "test": '''package main
import "testing"
type fakeReader struct{}
func (fakeReader) Get(id string)(string,error){return "bill:"+id,nil}
func TestSmallInterface(t *testing.T){got,err:=readName(fakeReader{},"7");if err!=nil||got!="bill:7"{t.Fatalf("got %q %v",got,err)}}''',
    },
    5: {
        "title": "守住包依赖方向",
        "prompt": "实现 canImport：cmd 可以依赖 internal；internal 不能反向依赖 cmd；同层允许。",
        "code": '''package main
import "strings"
func canImport(from, to string) bool {
    _ = strings.HasPrefix
    // TODO: 阻止 internal -> cmd 的反向依赖。
    return true
}
''',
        "test": '''package main
import "testing"
func TestDependencyDirection(t *testing.T){cases:=[]struct{from,to string;want bool}{{"cmd/api","internal/bill",true},{"internal/bill","cmd/api",false},{"internal/bill","internal/store",true}};for _,c:=range cases{if got:=canImport(c.from,c.to);got!=c.want{t.Fatalf("%s -> %s = %v, want %v",c.from,c.to,got,c.want)}}}''',
    },
    6: {
        "title": "包装错误但别剪断因果",
        "prompt": "实现 loadBill，保留 ErrNotFound，使 errors.Is 仍能识别它。",
        "code": '''package main
import ("errors"; "fmt")
var ErrNotFound=errors.New("not found")
func loadBill(id string) error {
    // TODO: 用 %w 包装 ErrNotFound，并带上 id。
    return fmt.Errorf("bill %s failed",id)
}
''',
        "test": '''package main
import ("errors"; "strings"; "testing")
func TestWrappedCause(t *testing.T){err:=loadBill("b7");if !errors.Is(err,ErrNotFound){t.Fatalf("cause lost: %v",err)};if !strings.Contains(err.Error(),"b7"){t.Fatalf("id missing: %v",err)}}''',
    },
    7: {
        "title": "并发计数不能丢",
        "prompt": "补全 count，使 1000 个 goroutine 全部结束且无数据竞争。",
        "code": '''package main
import "sync"
func count(n int) int {
    var wg sync.WaitGroup
    total := 0
    for i:=0;i<n;i++ { wg.Add(1); go func(){ defer wg.Done(); total++ }() }
    wg.Wait()
    return total
}
''',
        "test": '''package main
import "testing"
func TestCount(t *testing.T){for i:=0;i<20;i++{if got:=count(1000);got!=1000{t.Fatalf("got %d",got)}}}''',
        "race": True,
    },
    8: {
        "title": "让 goroutine 找得到回家的路",
        "prompt": "实现 stream：发送时同时监听 ctx.Done，并由发送方关闭输出 channel。",
        "code": '''package main
import "context"
func stream(ctx context.Context, values []int) <-chan int {
    out:=make(chan int)
    go func(){
        // TODO: 退出时关闭 out；发送时响应 ctx 取消。
        for _,value:=range values { out <- value }
    }()
    return out
}
''',
        "test": '''package main
import ("context"; "testing"; "time")
func TestStreamValuesAndCancel(t *testing.T){ctx,cancel:=context.WithCancel(context.Background());ch:=stream(ctx,[]int{1,2,3});if <-ch!=1{t.Fatal("first value")};cancel();select{case _,ok:=<-ch:if ok{t.Fatal("channel must close after cancel")};case <-time.After(time.Second):t.Fatal("goroutine did not stop")}}''',
    },
}

GO_PRACTICES.update({
    9: {
        "title": "守住 HTTP 请求门口",
        "prompt": "实现 HandleCreateRun：POST 方法、Header 检查租户、解析 JSON 并校验 Input 非空，成功返回 201。",
        "code": '''package main

import (
	"encoding/json"
	"net/http"
)

type CreateRunRequest struct {
	Input string `json:"input"`
}

func HandleCreateRun(w http.ResponseWriter, r *http.Request) {
	// TODO: 1. 只接受 POST 方法，否则返回 405 MethodNotAllowed
	//       2. 检查 Header "X-Tenant-ID"，若为空返回 401 Unauthorized
	//       3. 解析 JSON 请求体，若 input 为空返回 400 BadRequest
	//       4. 成功时设置 Content-Type: application/json 并写 201 Created，返回 {"status":"accepted"}
}
''',
        "test": '''package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleCreateRun(t *testing.T) {
	req := httptest.NewRequest("GET", "/runs", nil)
	w := httptest.NewRecorder()
	HandleCreateRun(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("want 405, got %d", w.Code)
	}

	req = httptest.NewRequest("POST", "/runs", strings.NewReader(`{"input":"hello"}`))
	w = httptest.NewRecorder()
	HandleCreateRun(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", w.Code)
	}

	req = httptest.NewRequest("POST", "/runs", strings.NewReader(`{"input":""}`))
	req.Header.Set("X-Tenant-ID", "tenant-1")
	w = httptest.NewRecorder()
	HandleCreateRun(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}

	req = httptest.NewRequest("POST", "/runs", strings.NewReader(`{"input":"audit"}`))
	req.Header.Set("X-Tenant-ID", "tenant-1")
	w = httptest.NewRecorder()
	HandleCreateRun(w, req)
	if w.Code != http.StatusCreated || !strings.Contains(w.Body.String(), "accepted") {
		t.Fatalf("want 201 accepted, got %d %s", w.Code, w.Body.String())
	}
}
''',
    },
    10: {
        "title": "把业务与存储拆开",
        "prompt": "实现 Service.CreateRun：参数校验、调用 Store.Exists 防重检测、调用 Store.Save 保存。",
        "code": '''package main

import (
	"context"
	"errors"
)

var (
	ErrInvalidRequest = errors.New("invalid request")
	ErrAlreadyExists  = errors.New("already exists")
)

type Store interface {
	Exists(ctx context.Context, tenant, id string) (bool, error)
	Save(ctx context.Context, tenant, id string, amount int) error
}

type Service struct {
	store Store
}

func (s Service) CreateRun(ctx context.Context, tenant, id string, amount int) error {
	// TODO: 1. 参数校验：tenant 和 id 不能为空，amount 必须 > 0
	//       2. 检查防重：调用 s.store.Exists，已存在则返回 ErrAlreadyExists
	//       3. 落库：调用 s.store.Save 并返回结果
	return nil
}
''',
        "test": '''package main

import (
	"context"
	"errors"
	"testing"
)

type mockStore struct {
	exists map[string]bool
	saved  map[string]int
}

func (m *mockStore) Exists(ctx context.Context, tenant, id string) (bool, error) {
	return m.exists[tenant+":"+id], nil
}

func (m *mockStore) Save(ctx context.Context, tenant, id string, amount int) error {
	m.saved[tenant+":"+id] = amount
	return nil
}

func TestServiceLayer(t *testing.T) {
	store := &mockStore{
		exists: map[string]bool{"t1:r1": true},
		saved:  make(map[string]int),
	}
	svc := Service{store: store}
	ctx := context.Background()

	if err := svc.CreateRun(ctx, "", "r2", 10); !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("want ErrInvalidRequest, got %v", err)
	}
	if err := svc.CreateRun(ctx, "t1", "r1", 10); !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("want ErrAlreadyExists, got %v", err)
	}
	if err := svc.CreateRun(ctx, "t1", "r2", 10); err != nil || store.saved["t1:r2"] != 10 {
		t.Fatalf("want saved 10, got %v", err)
	}
}
''',
    },
    11: {
        "title": "让重复请求只落一笔",
        "prompt": "实现 IdempotentStore：组合 tenant+key，相同 input 幂等回放，不同 input 触发冲突错误。",
        "code": '''package main

import (
	"errors"
	"sync"
)

var ErrIdempotencyConflict = errors.New("idempotency conflict")

type RunRecord struct {
	RunID string
	Input string
}

type IdempotentStore struct {
	mu      sync.Mutex
	records map[string]RunRecord
}

func (s *IdempotentStore) CreateOrGet(tenant, key, runID, input string) (RunRecord, bool, error) {
	// TODO: 1. 使用 tenant + ":" + key 作为复合唯一键
	//       2. 若已存在：若 Input 与已有记录不同，返回 ErrIdempotencyConflict；若相同，返回已有记录且 created=false
	//       3. 若不存在：写入新 RunRecord 并返回 created=true
	return RunRecord{}, false, nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
)

func TestIdempotentStore(t *testing.T) {
	s := &IdempotentStore{records: make(map[string]RunRecord)}
	rec1, created, err := s.CreateOrGet("t1", "k1", "r1", "query")
	if err != nil || !created || rec1.RunID != "r1" {
		t.Fatalf("first insert failed: %v %v %#v", err, created, rec1)
	}
	rec2, created, err := s.CreateOrGet("t1", "k1", "r2", "query")
	if err != nil || created || rec2.RunID != "r1" {
		t.Fatalf("replay failed: %v %v %#v", err, created, rec2)
	}
	_, _, err = s.CreateOrGet("t1", "k1", "r3", "different")
	if !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("want ErrIdempotencyConflict, got %v", err)
	}
	rec3, created, err := s.CreateOrGet("t2", "k1", "r4", "query")
	if err != nil || !created || rec3.RunID != "r4" {
		t.Fatalf("tenant isolation failed: %v %v %#v", err, created, rec3)
	}
}
''',
    },
    12: {
        "title": "拒绝迟到的旧缓存与并发抢占",
        "prompt": "实现 AcquireOrRenewLease：租约未过期阻断其他 worker，单调递增 Fencing Token 防范乱序更新。",
        "code": '''package main

import (
	"errors"
	"time"
)

var (
	ErrLeaseOccupied = errors.New("lease occupied")
	ErrStaleFence    = errors.New("stale fence")
)

type LeaseEntry struct {
	Owner     string
	Fence     int64
	ExpiredAt time.Time
}

func AcquireOrRenewLease(cur LeaseEntry, reqOwner string, reqFence int64, now time.Time, ttl time.Duration) (LeaseEntry, error) {
	// TODO: 1. 若当前租约未过期 (now.Before(cur.ExpiredAt)) 且持有者不是 reqOwner，返回 ErrLeaseOccupied
	//       2. reqFence 必须严格大于 cur.Fence，否则返回 ErrStaleFence
	//       3. 满足条件则返回续约后的 LeaseEntry（Owner, reqFence, now.Add(ttl)）
	return LeaseEntry{}, nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
	"time"
)

func TestLeaseAndFence(t *testing.T) {
	now := time.Now()
	active := LeaseEntry{Owner: "w1", Fence: 10, ExpiredAt: now.Add(time.Minute)}

	if _, err := AcquireOrRenewLease(active, "w2", 11, now, time.Minute); !errors.Is(err, ErrLeaseOccupied) {
		t.Fatalf("want ErrLeaseOccupied, got %v", err)
	}
	if _, err := AcquireOrRenewLease(active, "w1", 10, now, time.Minute); !errors.Is(err, ErrStaleFence) {
		t.Fatalf("want ErrStaleFence, got %v", err)
	}
	renewed, err := AcquireOrRenewLease(active, "w1", 11, now, time.Minute)
	if err != nil || renewed.Fence != 11 {
		t.Fatalf("renew failed: %v %#v", err, renewed)
	}
	expired := LeaseEntry{Owner: "w1", Fence: 10, ExpiredAt: now.Add(-time.Second)}
	taken, err := AcquireOrRenewLease(expired, "w2", 12, now, time.Minute)
	if err != nil || taken.Owner != "w2" || taken.Fence != 12 {
		t.Fatalf("takeover failed: %v %#v", err, taken)
	}
}
''',
    },
    13: {
        "title": "给并发设置门票与背压",
        "prompt": "实现 WorkerGate.Execute：使用非阻塞 select-default 预留槽位，满载立即返回 ErrOverloaded，执行完毕释放。",
        "code": '''package main

import "errors"

var ErrOverloaded = errors.New("worker pool overloaded")

type WorkerGate struct {
	sem chan struct{}
}

func NewWorkerGate(capacity int) *WorkerGate {
	return &WorkerGate{sem: make(chan struct{}, capacity)}
}

func (g *WorkerGate) Execute(fn func() error) error {
	// TODO: 1. 使用 select-default 非阻塞预留槽位；若满立即返回 ErrOverloaded
	//       2. 预留成功后，确保退出时释放槽位
	//       3. 执行 fn() 并返回其结果
	return nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
)

func TestWorkerGate(t *testing.T) {
	gate := NewWorkerGate(1)
	ran := false
	err := gate.Execute(func() error {
		ran = true
		return gate.Execute(func() error { return nil })
	})
	if !ran || !errors.Is(err, ErrOverloaded) {
		t.Fatalf("want ErrOverloaded, got %v", err)
	}
	if err := gate.Execute(func() error { return nil }); err != nil {
		t.Fatalf("slot not released: %v", err)
	}
}
''',
    },
    14: {
        "title": "断线后停止发送与游标重放",
        "prompt": "实现 ReplayEventsAfter：过滤 ID > lastID 的事件，发送时响应 ctx.Done() 客户端断线退出。",
        "code": '''package main

import "context"

type Event struct {
	ID      int64
	Payload string
}

func ReplayEventsAfter(ctx context.Context, events []Event, lastID int64, out chan<- Event) error {
	// TODO: 1. 遍历 events，只发送 ID > lastID 的事件
	//       2. 发送时使用 select，监听 ctx.Done()，若已取消立即返回 ctx.Err()
	//       3. 全部发送完毕返回 nil
	return nil
}
''',
        "test": '''package main

import (
	"context"
	"errors"
	"testing"
)

func TestReplayEventsAfter(t *testing.T) {
	events := []Event{{ID: 1, Payload: "e1"}, {ID: 2, Payload: "e2"}, {ID: 3, Payload: "e3"}}
	out := make(chan Event, 5)

	if err := ReplayEventsAfter(context.Background(), events, 1, out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 || (<-out).ID != 2 || (<-out).ID != 3 {
		t.Fatal("wrong replayed events")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	fullOut := make(chan Event)
	if err := ReplayEventsAfter(ctx, events, 0, fullOut); !errors.Is(err, context.Canceled) {
		t.Fatalf("want context.Canceled, got %v", err)
	}
}
''',
    },
    15: {
        "title": "把一次请求串起来：结构化追踪",
        "prompt": "实现 NewAuditEntry：校验 tenant 和 run 追踪上下文非空，记录毫秒耗时与阶段状态。",
        "code": '''package main

import (
	"errors"
	"time"
)

var ErrMissingTrace = errors.New("missing trace context")

type AuditEntry struct {
	TenantID string
	RunID    string
	Stage    string
	Status   string
	Duration int64
}

func NewAuditEntry(tenant, run, stage, status string, elapsed time.Duration) (AuditEntry, error) {
	// TODO: 1. tenant 和 run 不能为空，否则返回 ErrMissingTrace
	//       2. 记录 Duration 为毫秒 (elapsed.Milliseconds())
	//       3. 构造并返回完整 AuditEntry
	return AuditEntry{}, nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
	"time"
)

func TestAuditEntry(t *testing.T) {
	if _, err := NewAuditEntry("", "r1", "worker", "ok", time.Second); !errors.Is(err, ErrMissingTrace) {
		t.Fatal("expected missing trace")
	}
	entry, err := NewAuditEntry("t1", "r1", "worker", "succeeded", 250*time.Millisecond)
	if err != nil || entry.Duration != 250 || entry.TenantID != "t1" || entry.Stage != "worker" {
		t.Fatalf("unexpected entry: %#v", entry)
	}
}
''',
    },
    16: {
        "title": "让灰度知道何时停",
        "prompt": "实现 EvaluateCanary：回滚指令、未完成数据库迁移或错误率超标时准确阻断发布。",
        "code": '''package main

type CanaryMetrics struct {
	Requests      int
	Errors        int
	Migrated      bool
	RollbackOrder bool
}

func EvaluateCanary(m CanaryMetrics, maxRate float64) (bool, string) {
	// TODO: 1. 若收到回滚指令 (m.RollbackOrder)，返回 false, "rollback"
	//       2. 若数据库迁移未就绪 (!m.Migrated)，返回 false, "pending-migration"
	//       3. 若请求数 > 0 且错误率 (Errors/Requests) > maxRate，返回 false, "high-error-rate"
	//       4. 均满足返回 true, "healthy"
	return false, ""
}
''',
        "test": '''package main

import "testing"

func TestCanaryEvaluation(t *testing.T) {
	if ok, reason := EvaluateCanary(CanaryMetrics{Requests: 100, Errors: 1, Migrated: true}, 0.02); !ok || reason != "healthy" {
		t.Fatal("should be healthy")
	}
	if ok, reason := EvaluateCanary(CanaryMetrics{Requests: 100, Errors: 5, Migrated: true}, 0.02); ok || reason != "high-error-rate" {
		t.Fatal("should fail on error rate")
	}
	if ok, reason := EvaluateCanary(CanaryMetrics{Requests: 10, Errors: 0, Migrated: false}, 0.02); ok || reason != "pending-migration" {
		t.Fatal("should fail on migration")
	}
	if ok, reason := EvaluateCanary(CanaryMetrics{RollbackOrder: true, Migrated: true}, 0.02); ok || reason != "rollback" {
		t.Fatal("should fail on rollback")
	}
}
''',
    },
    17: {
        "title": "验证模型决策：严格 Fail Closed",
        "prompt": "实现 ValidateDecision：answer 与 tool 互斥，未知 Kind 与字段混杂必须返回 ErrInvalidDecision。",
        "code": '''package main

import "errors"

var ErrInvalidDecision = errors.New("invalid decision")

type Decision struct {
	Kind     string
	Answer   string
	ToolName string
}

func ValidateDecision(d Decision) error {
	// TODO: 1. 若 Kind == "answer"：Answer 不能为空且 ToolName 必须为空
	//       2. 若 Kind == "tool"：ToolName 不能为空且 Answer 必须为空
	//       3. 其他任何 Kind 或混合状态均返回 ErrInvalidDecision (Fail Closed)
	return nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
)

func TestValidateDecision(t *testing.T) {
	if err := ValidateDecision(Decision{Kind: "answer", Answer: "Done"}); err != nil {
		t.Fatal("answer should be valid")
	}
	if err := ValidateDecision(Decision{Kind: "tool", ToolName: "read"}); err != nil {
		t.Fatal("tool should be valid")
	}
	for _, bad := range []Decision{
		{Kind: "answer", Answer: ""},
		{Kind: "answer", Answer: "ok", ToolName: "leak"},
		{Kind: "tool", ToolName: ""},
		{Kind: "tool", ToolName: "read", Answer: "leak"},
		{Kind: "unknown"},
	} {
		if !errors.Is(ValidateDecision(bad), ErrInvalidDecision) {
			t.Fatalf("expected ErrInvalidDecision for %#v", bad)
		}
	}
}
''',
    },
    18: {
        "title": "工具沙箱：净化路径防逃逸",
        "prompt": "实现 ValidateToolPath：净化相对路径，拦截绝对路径与 ../ 目录穿透攻击。",
        "code": '''package main

import (
	"errors"
	"path"
	"strings"
)

var ErrPathTraversal = errors.New("path traversal detected")

func ValidateToolPath(raw string) (string, error) {
	// TODO: 1. 使用 path.Clean 清理路径
	//       2. 拒绝空路径、以 "/" 开头的绝对路径
	//       3. 拒绝 ".." 或以 "../" 开头的逃逸路径，返回 ErrPathTraversal
	//       4. 返回清理后的相对路径
	return "", nil
}
''',
        "test": '''package main

import (
	"errors"
	"testing"
)

func TestValidateToolPath(t *testing.T) {
	clean, err := ValidateToolPath("ledger/report.csv")
	if err != nil || clean != "ledger/report.csv" {
		t.Fatalf("valid path failed: %v %s", err, clean)
	}
	for _, bad := range []string{"", "/etc/passwd", "../secret", "a/../../b"} {
		if _, err := ValidateToolPath(bad); !errors.Is(err, ErrPathTraversal) {
			t.Fatalf("expected traversal error for %q, got %v", bad, err)
		}
	}
}
''',
    },
    19: {
        "title": "一次执行的一生：Step 状态对账",
        "prompt": "实现 ReconcileStep：已完成收口、超限放弃、失败/孤儿重试，正常调度分配。",
        "code": '''package main

type StepRecord struct {
	State    string
	Attempts int
}

func ReconcileStep(s StepRecord, maxAttempts int) (action string, retryable bool) {
	// TODO: 1. 若 State == "completed"，返回 "done", false
	//       2. 若 Attempts >= maxAttempts，返回 "abandon", false
	//       3. 若 State == "failed" 或 "running"（崩溃孤儿），返回 "retry", true
	//       4. 其他情况返回 "dispatch", true
	return "", false
}
''',
        "test": '''package main

import "testing"

func TestReconcileStep(t *testing.T) {
	if act, ret := ReconcileStep(StepRecord{State: "completed", Attempts: 1}, 3); act != "done" || ret {
		t.Fatal("completed failed")
	}
	if act, ret := ReconcileStep(StepRecord{State: "failed", Attempts: 3}, 3); act != "abandon" || ret {
		t.Fatal("abandon failed")
	}
	if act, ret := ReconcileStep(StepRecord{State: "running", Attempts: 1}, 3); act != "retry" || !ret {
		t.Fatal("orphan failed")
	}
	if act, ret := ReconcileStep(StepRecord{State: "pending", Attempts: 0}, 3); act != "dispatch" || !ret {
		t.Fatal("dispatch failed")
	}
}
''',
    },
    20: {
        "title": "上下文预算裁剪",
        "prompt": "实现 AssembleContext：按顺序累计字符，遇到超出 charBudget 立即停止追加。",
        "code": '''package main

type ContextPart struct {
	Role     string
	Content  string
	Priority int
}

func AssembleContext(parts []ContextPart, charBudget int) []string {
	// TODO: 1. 遍历 parts，累计字符长度
	//       2. 若已用字符数 + len(p.Content) > charBudget，立即 break 退出
	//       3. 返回所有装配好的 Content 切片
	return nil
}
''',
        "test": '''package main

import "testing"

func TestAssembleContext(t *testing.T) {
	parts := []ContextPart{
		{Role: "system", Content: "sys", Priority: 1},
		{Role: "user", Content: "hello", Priority: 2},
		{Role: "context", Content: "data", Priority: 3},
	}
	out := AssembleContext(parts, 8)
	if len(out) != 2 || out[0] != "sys" || out[1] != "hello" {
		t.Fatalf("budget 8 failed: %#v", out)
	}
	if len(AssembleContext(parts, 2)) != 0 {
		t.Fatal("should reject overbudget")
	}
}
''',
    },
    21: {
        "title": "工具权限与审批防线",
        "prompt": "实现 AuthorizeTool：工具必须在白名单内，写操作必须附带 approved 审批确认。",
        "code": '''package main

type ToolPolicy struct {
	AllowList map[string]bool
	WriteOps  map[string]bool
}

func AuthorizeTool(p ToolPolicy, tool string, approved bool) bool {
	// TODO: 1. 工具必须存在于 AllowList 中且值为 true
	//       2. 若工具在 WriteOps 中为写操作，必须 approved==true
	//       3. 满足返回 true，否则 false
	return false
}
''',
        "test": '''package main

import "testing"

func TestAuthorizeTool(t *testing.T) {
	p := ToolPolicy{
		AllowList: map[string]bool{"query_balance": true, "transfer_money": true},
		WriteOps:  map[string]bool{"transfer_money": true},
	}
	if !AuthorizeTool(p, "query_balance", false) {
		t.Fatal("read op without approval should be allowed")
	}
	if AuthorizeTool(p, "transfer_money", false) {
		t.Fatal("write op without approval must be blocked")
	}
	if !AuthorizeTool(p, "transfer_money", true) {
		t.Fatal("approved write op should pass")
	}
	if AuthorizeTool(p, "exec_shell", true) {
		t.Fatal("unregistered tool must be blocked")
	}
}
''',
    },
    22: {
        "title": "重试预算与错误可重试性",
        "prompt": "实现 ShouldRetry：429 与 5xx 放行重试，4xx 客户端错误与超预算快速失败。",
        "code": '''package main

func ShouldRetry(status, attempt, maxAttempts int, elapsedMS, budgetMS int) bool {
	// TODO: 1. attempt 必须 < maxAttempts 且 elapsedMS 必须 < budgetMS
	//       2. 只有 429 和 5xx（如 500, 502, 503）允许重试；400/401/403/404 等客户端错误不可重试
	//       3. 均满足返回 true，否则 false
	return false
}
''',
        "test": '''package main

import "testing"

func TestShouldRetry(t *testing.T) {
	if !ShouldRetry(429, 1, 3, 50, 200) || !ShouldRetry(503, 2, 3, 50, 200) {
		t.Fatal("retryable cases failed")
	}
	if ShouldRetry(400, 1, 3, 50, 200) || ShouldRetry(403, 1, 3, 50, 200) {
		t.Fatal("client errors must not retry")
	}
	if ShouldRetry(503, 3, 3, 50, 200) || ShouldRetry(503, 1, 3, 200, 200) {
		t.Fatal("over budget must not retry")
	}
}
''',
    },
    23: {
        "title": "双重评测门禁：基准与安全红线",
        "prompt": "实现 PassEvaluationGate：安全违规 0 容忍、测试全过且得分达标方可晋级。",
        "code": '''package main

type EvalReport struct {
	Score              float64
	SecurityViolations int
	TestsPassed        bool
}

func PassEvaluationGate(report EvalReport, minScore float64) bool {
	// TODO: 1. 安全违规必须为 0（零容忍）
	//       2. 所有单元测试必须通过 (TestsPassed == true)
	//       3. 基准打分必须 >= minScore
	//       4. 三者兼备返回 true，否则 false
	return false
}
''',
        "test": '''package main

import "testing"

func TestPassEvaluationGate(t *testing.T) {
	if !PassEvaluationGate(EvalReport{Score: 85.0, SecurityViolations: 0, TestsPassed: true}, 80.0) {
		t.Fatal("should pass gate")
	}
	if PassEvaluationGate(EvalReport{Score: 99.0, SecurityViolations: 1, TestsPassed: true}, 80.0) {
		t.Fatal("security violation must fail closed")
	}
	if PassEvaluationGate(EvalReport{Score: 85.0, SecurityViolations: 0, TestsPassed: false}, 80.0) {
		t.Fatal("failing tests must fail gate")
	}
	if PassEvaluationGate(EvalReport{Score: 75.0, SecurityViolations: 0, TestsPassed: true}, 80.0) {
		t.Fatal("score below threshold must fail")
	}
}
''',
    },
    24: {
        "title": "结业总装：调度执行并签署审计回执",
        "prompt": "实现 CoordinateAndReceipt：跨模块串联请求校验、任务执行、失败收口与成功时的 SHA-256 审计摘要签署。",
        "code": '''package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
)

var ErrInvalidRun = errors.New("invalid run parameters")

type RunRequest struct {
	TenantID string
	RunID    string
	Input    string
}

type RunReceipt struct {
	TenantID string
	RunID    string
	CallID   string
	Outcome  string
	Digest   string
}

func CoordinateAndReceipt(req RunRequest, callID string, execute func(string) (string, error)) (RunReceipt, error) {
	// TODO: 结业总装协调器：
	// 1. 校验 req.TenantID, req.RunID, callID 均不能为空，否则返回 ErrInvalidRun
	// 2. 调用 execute(req.Input)
	// 3. 若 execute 出错，Outcome="failed"，Digest 为空的 RunReceipt
	// 4. 若 execute 成功，Outcome="succeeded"，计算输出内容的 sha256 摘要（格式为 "sha256:十六进制"）
	// 5. 返回装配完成的最终审计回执
	return RunReceipt{}, nil
}
''',
        "test": '''package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"testing"
)

func TestCoordinateAndReceipt(t *testing.T) {
	_, err := CoordinateAndReceipt(RunRequest{TenantID: "", RunID: "r1"}, "c1", func(string) (string, error) { return "ok", nil })
	if !errors.Is(err, ErrInvalidRun) {
		t.Fatalf("want ErrInvalidRun, got %v", err)
	}

	rec, err := CoordinateAndReceipt(RunRequest{TenantID: "t1", RunID: "r1", Input: "audit"}, "c1", func(in string) (string, error) {
		return "ledger output: " + in, nil
	})
	expectedDigest := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte("ledger output: audit")))
	if err != nil || rec.Outcome != "succeeded" || rec.Digest != expectedDigest || rec.TenantID != "t1" || rec.CallID != "c1" {
		t.Fatalf("success run failed: %#v, err: %v", rec, err)
	}

	failRec, err := CoordinateAndReceipt(RunRequest{TenantID: "t1", RunID: "r1"}, "c1", func(string) (string, error) {
		return "", errors.New("boom")
	})
	if err != nil || failRec.Outcome != "failed" || failRec.Digest != "" {
		t.Fatalf("failed run failed: %#v, err: %v", failRec, err)
	}
}
''',
    },
})

GO_PRACTICE_SOLUTIONS = {
    1: '''package main
import "errors"
var ErrInvalidPrice=errors.New("invalid price")
var ErrInsufficientPayment=errors.New("insufficient payment")
func settle(price,paid int64)(int64,error){if price<=0{return 0,ErrInvalidPrice};if paid<price{return 0,ErrInsufficientPayment};return paid-price,nil}
''',
    2: '''package main
import "encoding/json"
type Bill struct { ID string `json:"id"`; AmountCents int64 `json:"amount_cents"` }
func encodeBill(b Bill)([]byte,error){return json.Marshal(b)}
''',
    3: '''package main
func clone(src []string)[]string{return append([]string(nil),src...)}
''',
    4: '''package main
type Reader interface { Get(id string)(string,error) }
func readName(store Reader,id string)(string,error){return store.Get(id)}
''',
    5: '''package main
import "strings"
func canImport(from,to string)bool{return !(strings.HasPrefix(from,"internal/")&&strings.HasPrefix(to,"cmd/"))}
''',
    6: '''package main
import("errors";"fmt")
var ErrNotFound=errors.New("not found")
func loadBill(id string)error{return fmt.Errorf("load bill %s: %w",id,ErrNotFound)}
''',
    7: '''package main
import "sync"
func count(n int)int{var wg sync.WaitGroup;var mu sync.Mutex;total:=0;for i:=0;i<n;i++{wg.Add(1);go func(){defer wg.Done();mu.Lock();total++;mu.Unlock()}()};wg.Wait();return total}
''',
    8: '''package main
import "context"
func stream(ctx context.Context,values []int)<-chan int{out:=make(chan int);go func(){defer close(out);for _,value:=range values{select{case <-ctx.Done():return;case out<-value:}}}();return out}
''',
}

GO_PRACTICE_SOLUTIONS.update({
    9: '''package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

type CreateRunRequest struct {
	Input string `json:"input"`
}

func HandleCreateRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	tenant := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	if tenant == "" {
		http.Error(w, "missing tenant", http.StatusUnauthorized)
		return
	}
	var body CreateRunRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Input) == "" {
		http.Error(w, "bad input", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte(`{"status":"accepted"}`))
}
''',
    10: '''package main

import (
	"context"
	"errors"
)

var (
	ErrInvalidRequest = errors.New("invalid request")
	ErrAlreadyExists  = errors.New("already exists")
)

type Store interface {
	Exists(ctx context.Context, tenant, id string) (bool, error)
	Save(ctx context.Context, tenant, id string, amount int) error
}

type Service struct {
	store Store
}

func (s Service) CreateRun(ctx context.Context, tenant, id string, amount int) error {
	if tenant == "" || id == "" || amount <= 0 {
		return ErrInvalidRequest
	}
	exists, err := s.store.Exists(ctx, tenant, id)
	if err != nil {
		return err
	}
	if exists {
		return ErrAlreadyExists
	}
	return s.store.Save(ctx, tenant, id, amount)
}
''',
    11: '''package main

import (
	"errors"
	"sync"
)

var ErrIdempotencyConflict = errors.New("idempotency conflict")

type RunRecord struct {
	RunID string
	Input string
}

type IdempotentStore struct {
	mu      sync.Mutex
	records map[string]RunRecord
}

func (s *IdempotentStore) CreateOrGet(tenant, key, runID, input string) (RunRecord, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.records == nil {
		s.records = make(map[string]RunRecord)
	}
	composite := tenant + ":" + key
	if old, ok := s.records[composite]; ok {
		if old.Input != input {
			return RunRecord{}, false, ErrIdempotencyConflict
		}
		return old, false, nil
	}
	rec := RunRecord{RunID: runID, Input: input}
	s.records[composite] = rec
	return rec, true, nil
}
''',
    12: '''package main

import (
	"errors"
	"time"
)

var (
	ErrLeaseOccupied = errors.New("lease occupied")
	ErrStaleFence    = errors.New("stale fence")
)

type LeaseEntry struct {
	Owner     string
	Fence     int64
	ExpiredAt time.Time
}

func AcquireOrRenewLease(cur LeaseEntry, reqOwner string, reqFence int64, now time.Time, ttl time.Duration) (LeaseEntry, error) {
	if now.Before(cur.ExpiredAt) && cur.Owner != reqOwner && cur.Owner != "" {
		return LeaseEntry{}, ErrLeaseOccupied
	}
	if reqFence <= cur.Fence {
		return LeaseEntry{}, ErrStaleFence
	}
	return LeaseEntry{Owner: reqOwner, Fence: reqFence, ExpiredAt: now.Add(ttl)}, nil
}
''',
    13: '''package main

import "errors"

var ErrOverloaded = errors.New("worker pool overloaded")

type WorkerGate struct {
	sem chan struct{}
}

func NewWorkerGate(capacity int) *WorkerGate {
	return &WorkerGate{sem: make(chan struct{}, capacity)}
}

func (g *WorkerGate) Execute(fn func() error) error {
	select {
	case g.sem <- struct{}{}:
		defer func() { <-g.sem }()
		return fn()
	default:
		return ErrOverloaded
	}
}
''',
    14: '''package main

import "context"

type Event struct {
	ID      int64
	Payload string
}

func ReplayEventsAfter(ctx context.Context, events []Event, lastID int64, out chan<- Event) error {
	for _, e := range events {
		if e.ID > lastID {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case out <- e:
			}
		}
	}
	return nil
}
''',
    15: '''package main

import (
	"errors"
	"time"
)

var ErrMissingTrace = errors.New("missing trace context")

type AuditEntry struct {
	TenantID string
	RunID    string
	Stage    string
	Status   string
	Duration int64
}

func NewAuditEntry(tenant, run, stage, status string, elapsed time.Duration) (AuditEntry, error) {
	if tenant == "" || run == "" {
		return AuditEntry{}, ErrMissingTrace
	}
	return AuditEntry{
		TenantID: tenant,
		RunID:    run,
		Stage:    stage,
		Status:   status,
		Duration: elapsed.Milliseconds(),
	}, nil
}
''',
    16: '''package main

type CanaryMetrics struct {
	Requests      int
	Errors        int
	Migrated      bool
	RollbackOrder bool
}

func EvaluateCanary(m CanaryMetrics, maxRate float64) (bool, string) {
	if m.RollbackOrder {
		return false, "rollback"
	}
	if !m.Migrated {
		return false, "pending-migration"
	}
	if m.Requests > 0 && float64(m.Errors)/float64(m.Requests) > maxRate {
		return false, "high-error-rate"
	}
	return true, "healthy"
}
''',
    17: '''package main

import "errors"

var ErrInvalidDecision = errors.New("invalid decision")

type Decision struct {
	Kind     string
	Answer   string
	ToolName string
}

func ValidateDecision(d Decision) error {
	switch d.Kind {
	case "answer":
		if d.Answer != "" && d.ToolName == "" {
			return nil
		}
	case "tool":
		if d.ToolName != "" && d.Answer == "" {
			return nil
		}
	}
	return ErrInvalidDecision
}
''',
    18: '''package main

import (
	"errors"
	"path"
	"strings"
)

var ErrPathTraversal = errors.New("path traversal detected")

func ValidateToolPath(raw string) (string, error) {
	if raw == "" || strings.HasPrefix(raw, "/") {
		return "", ErrPathTraversal
	}
	cleaned := path.Clean(raw)
	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrPathTraversal
	}
	return cleaned, nil
}
''',
    19: '''package main

type StepRecord struct {
	State    string
	Attempts int
}

func ReconcileStep(s StepRecord, maxAttempts int) (action string, retryable bool) {
	if s.State == "completed" {
		return "done", false
	}
	if s.Attempts >= maxAttempts {
		return "abandon", false
	}
	if s.State == "failed" || s.State == "running" {
		return "retry", true
	}
	return "dispatch", true
}
''',
    20: '''package main

type ContextPart struct {
	Role     string
	Content  string
	Priority int
}

func AssembleContext(parts []ContextPart, charBudget int) []string {
	var out []string
	used := 0
	for _, p := range parts {
		if used+len(p.Content) > charBudget {
			break
		}
		out = append(out, p.Content)
		used += len(p.Content)
	}
	return out
}
''',
    21: '''package main

type ToolPolicy struct {
	AllowList map[string]bool
	WriteOps  map[string]bool
}

func AuthorizeTool(p ToolPolicy, tool string, approved bool) bool {
	if !p.AllowList[tool] {
		return false
	}
	if p.WriteOps[tool] && !approved {
		return false
	}
	return true
}
''',
    22: '''package main

func ShouldRetry(status, attempt, maxAttempts int, elapsedMS, budgetMS int) bool {
	if attempt >= maxAttempts || elapsedMS >= budgetMS {
		return false
	}
	return status == 429 || (status >= 500 && status < 600)
}
''',
    23: '''package main

type EvalReport struct {
	Score              float64
	SecurityViolations int
	TestsPassed        bool
}

func PassEvaluationGate(report EvalReport, minScore float64) bool {
	return report.SecurityViolations == 0 && report.TestsPassed && report.Score >= minScore
}
''',
    24: '''package main

import (
	"crypto/sha256"
	"errors"
	"fmt"
)

var ErrInvalidRun = errors.New("invalid run parameters")

type RunRequest struct {
	TenantID string
	RunID    string
	Input    string
}

type RunReceipt struct {
	TenantID string
	RunID    string
	CallID   string
	Outcome  string
	Digest   string
}

func CoordinateAndReceipt(req RunRequest, callID string, execute func(string) (string, error)) (RunReceipt, error) {
	if req.TenantID == "" || req.RunID == "" || callID == "" {
		return RunReceipt{}, ErrInvalidRun
	}
	out, err := execute(req.Input)
	if err != nil {
		return RunReceipt{TenantID: req.TenantID, RunID: req.RunID, CallID: callID, Outcome: "failed"}, nil
	}
	digest := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte(out)))
	return RunReceipt{TenantID: req.TenantID, RunID: req.RunID, CallID: callID, Outcome: "succeeded", Digest: digest}, nil
}
''',
})

STRUCTURED_PRACTICES = {
    9: (("请求边界", "写出 DTO、认证身份和状态码边界"), ("失败矩阵", "列出 400、401、403、404 的触发条件"), ("验证证据", "说明如何用 httptest 断言响应"), (("dto", "principal"), ("400", "401", "403", "404"), ("httptest", "status"))),
    10: (("职责切分", "说明 Handler、Service、Repository 各做什么"), ("替身设计", "写出要替换的依赖与 fake"), ("装配证据", "说明构造函数如何注入"), (("handler", "service", "repository"), ("fake", "依赖"), ("构造", "注入"))),
    11: (("事务范围", "写出事务内必须同成同败的动作"), ("幂等边界", "写出稳定键和唯一约束"), ("失败证据", "说明回滚与重复请求如何验证"), (("事务", "提交"), ("幂等", "唯一"), ("回滚", "重复"))),
    12: (("缓存策略", "写出 cache-aside 与版本校验"), ("故障路径", "说明缓存故障时是否回源"), ("竞态证据", "说明怎样拦住迟到旧回填"), (("cache-aside", "版本"), ("缓存", "回源"), ("cas", "旧"))),
    13: (("容量边界", "写出并发上限与拒绝方式"), ("取消路径", "说明等待与执行怎样响应 context"), ("过载证据", "列出拒绝率和在途量"), (("上限", "拒绝"), ("context", "取消"), ("拒绝率", "在途"))),
    14: (("连接契约", "写出 SSE 游标与身份边界"), ("断线收口", "说明 context 取消后释放什么"), ("泄漏证据", "写出 goroutine 与订阅计数断言"), (("sse", "游标"), ("context", "释放"), ("goroutine", "订阅"))),
    15: (("信号分工", "区分 log、metric、trace"), ("异步因果", "说明恢复执行如何用 Span Link"), ("验收查询", "写出定位一次慢请求的查询路径"), (("log", "metric", "trace"), ("span link", "恢复"), ("request", "trace"))),
    16: (("发布清单", "写出配置、密钥、迁移和镜像边界"), ("灰度失败", "定义 canary 停止条件"), ("恢复证据", "写出回滚后的 RTO 与 RPO"), (("配置", "密钥", "迁移"), ("canary", "停止"), ("rto", "rpo"))),
    17: (("模型边界", "写出 schema、workflow 与 tool 分工"), ("坏输出路径", "说明结构校验失败后如何关闭"), ("评测证据", "写出固定输入与期望动作"), (("schema", "workflow", "tool"), ("校验", "失败"), ("固定", "期望"))),
    18: (("工具契约", "写出副作用、幂等键与审批要求"), ("调用边界", "说明只读与写入工具如何隔离"), ("审计证据", "列出输入摘要和回执"), (("副作用", "幂等", "审批"), ("只读", "写入"), ("摘要", "回执"))),
    19: (("状态模型", "写出 Run、Step、Attempt、CallID"), ("未知恢复", "说明 Unknown 怎样按原调用号对账"), ("检查点", "列出恢复前必须保存的字段"), (("run", "step", "attempt", "callid"), ("unknown", "对账"), ("checkpoint", "fence"))),
    20: (("上下文装配", "写出来源、优先级与 token 预算"), ("不可信输入", "说明注入内容如何隔离"), ("裁剪证据", "列出摘要来源与被删内容"), (("来源", "token", "预算"), ("注入", "隔离"), ("摘要", "来源"))),
    21: (("权限边界", "写出 allowlist、sandbox 与 HITL"), ("拒绝路径", "说明越权工具调用如何失败关闭"), ("审计证据", "列出审批人、动作和结果"), (("allowlist", "sandbox", "hitl"), ("越权", "拒绝"), ("审批", "动作", "结果"))),
    22: (("预算与指纹", "写出时间、次数和错误 fingerprint"), ("重放边界", "区分只读 replay 与真实执行"), ("事件证据", "说明 trace 丢失后如何还原"), (("预算", "fingerprint"), ("replay", "只读"), ("事件", "trace"))),
    23: (("编码闭环", "写出 spec、patch digest、test 与 review"), ("隔离失败", "说明候选改动如何离开宿主工作区"), ("合并证据", "列出测试、审查和人工确认"), (("spec", "patch", "test", "review"), ("隔离", "宿主"), ("测试", "审查", "人工"))),
    24: (("稳定身份", "写出 entry key、tenant 与 owner"), ("超时恢复", "说明重复请求与 Unknown 如何对账"), ("最终证据", "列出 receipt、事件序号和摘要"), (("entry", "tenant", "owner"), ("重复", "unknown", "对账"), ("receipt", "事件", "摘要"))),
}

BEGINNER_CODE_LESSONS = {
    "chapter-1": {
        "summary": "这段程序只做一件事：收下价格和付款额，算出该找多少钱；钱不够时明确报错。先跑通，再改数字。",
        "steps": [
            {"label": "程序从这里开始", "lines": [12, 15], "explanation": "main 是程序入口。它把价格 7 和付款 10 交给 settle，然后打印结果。"},
            {"label": "先拦住坏输入", "lines": [18, 23], "explanation": "价格非法或付款不足时立刻返回对应错误，不继续计算找零。"},
            {"label": "算出该找的钱", "lines": [24, 24], "explanation": "付款够时，用付款额减价格。10 减 7，所以得到 3。"},
        ],
        "cases": [
            {"name": "需要找零", "given": "价格 7，付款 10", "expect": "打印 3 <nil>"},
            {"name": "刚好付款", "given": "价格 7，付款 7", "expect": "打印 0 <nil>"},
            {"name": "钱不够", "given": "价格 7，付款 5", "expect": "打印 0 insufficient payment"},
        ],
        "terms": [
            {"code": "func main()", "meaning": "程序开始运行的地方。"},
            {"code": "settle(7, 10)", "meaning": "把价格 7、付款 10 交给结账函数。"},
            {"code": "return", "meaning": "把结果交回调用它的地方。"},
            {"code": "error", "meaning": "告诉调用者事情为什么没办成。"},
        ],
    },
    "go-real-test-file": {
        "summary": "这不是结账功能本身，而是给结账功能出的四道考题。程序会把四种付款情况依次交给 settle，再核对它算出的找零和错误是否正确。",
        "steps": [
            {
                "label": "列出四道考题",
                "lines": [2, 12],
                "explanation": "每道题都写清名称、价格、付款额、期望找零和期望错误。这样新增场景只需再加一行数据。",
            },
            {
                "label": "逐题交给 settle",
                "lines": [13, 15],
                "explanation": "for 会依次拿出每道题；t.Run 给它单独命名；settle 真正计算找零并返回错误。",
            },
            {
                "label": "先核对错误",
                "lines": [16, 18],
                "explanation": "该报错却没报，或报错类型不对，测试立刻失败。付款不足不能冒充价格非法。",
            },
            {
                "label": "再核对找零",
                "lines": [19, 21],
                "explanation": "错误符合预期后，再检查找零金额。实际值和期望值不同，测试会指出是哪道题错了。",
            },
        ],
        "cases": [
            {"name": "刚好付款", "given": "价格 7，付款 7", "expect": "找零 0，不报错"},
            {"name": "需要找零", "given": "价格 7，付款 10", "expect": "找零 3，不报错"},
            {"name": "钱不够", "given": "价格 7，付款 5", "expect": "报告付款不足"},
            {"name": "价格非法", "given": "价格 0，付款 10", "expect": "报告价格非法"},
        ],
        "terms": [
            {"code": "TestSettle", "meaning": "测试函数的名字；以 Test 开头，Go 才会自动运行它。"},
            {"code": "testing.T", "meaning": "这场测试的记录员，负责标记失败并打印原因。"},
            {"code": "[]struct", "meaning": "一张考题清单；每一行就是一道完整测试题。"},
            {"code": "t.Run", "meaning": "给每道题单独起名，失败时能直接找到具体场景。"},
            {"code": "errors.Is", "meaning": "判断错误是否属于期望的那一类。"},
        ],
    }
}

CHAPTER_DIFFICULTIES = {
    1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3, 8: 4,
    9: 4, 10: 4, 11: 5, 12: 5, 13: 4, 14: 4, 15: 5, 16: 5,
    17: 2, 18: 3, 19: 4, 20: 4, 21: 5, 22: 5, 23: 5, 24: 5,
}

PRACTICE_COACHING = {
    1: ("固定测试会检查非法价格、付款不足、刚好付款和正常找零。", ["先写 price <= 0 的分支。", "再写 paid < price 的分支。", "最后返回 paid - price 和 nil。"]),
    2: ("固定测试会解码 JSON，并核对字段名与字段数量。", ["小写字段不会被 encoding/json 导出。", "把字段改成 ID 和 AmountCents。", "分别添加 json:\"id\" 与 json:\"amount_cents\" tag。"]),
    3: ("固定测试会修改副本，再确认原 slice 没变。", ["直接 return src 仍共享底层数组。", "先创建一个空的新 slice。", "用 append 把 src 的元素复制进去。"]),
    4: ("固定测试会把 fakeReader 传给 readName。", ["接口只写调用方真正需要的方法。", "方法签名必须和 fakeReader.Get 完全一致。", "定义 type Reader interface { Get(string) (string, error) }。"]),
    7: ("固定测试会重复启动 1000 个 goroutine，并用 -race 查数据竞争。", ["WaitGroup 只负责等人，不负责保护 total。", "在 total++ 前后加同一把 Mutex。", "Lock 后递增，并在 Unlock 后让 goroutine 结束。"]),
    8: ("固定测试会提前取消，并要求输出 channel 很快关闭。", ["由创建 channel 的 goroutine 负责 close。", "发送不能只写 out <- value。", "用 select 同时等待 ctx.Done() 和 out <- value。"]),
    9: ("固定测试会检查 HTTP 方法 (405)、租户 Header (401)、空输入 (400) 与成功创建 (201)。", ["先检查 r.Method 是否为 http.MethodPost，不符返回 405。", "从 r.Header.Get(\"X-Tenant-ID\") 取租户身份，缺失返回 401。", "用 json.NewDecoder(r.Body).Decode 解析请求体并校验 Input。"]),
    10: ("固定测试会注入 mockStore，验证参数校验、重复拦截与分层数据传递。", ["入参为空或金额非正时返回 ErrInvalidRequest。", "调用 s.store.Exists 检测唯一记录，已存在返回 ErrAlreadyExists。", "正常情况调用 s.store.Save 并如实返回结果。"]),
    11: ("固定测试会验证复合键隔离、相同键幂等回放、不同载荷冲突与多租户隔离。", ["用 tenant + \":\" + key 构成字典复合唯一键。", "已存在时若 Input 不同返回 ErrIdempotencyConflict，相同返回旧记录且 created=false。", "操作 records 时注意并发互斥加锁。"]),
    12: ("固定测试会验证租约占用拦截、单调递增 Fencing Token 与过期安全接管。", ["租约未过期且持有者非当前 worker 时返回 ErrLeaseOccupied。", "请求的 reqFence 必须严格大于当前 cur.Fence，否则返回 ErrStaleFence。", "校验通过后返回续约后的 LeaseEntry 并延长有效时长。"]),
    13: ("固定测试会验证 Worker 槽位网关：满载立即返回 ErrOverloaded，执行完毕安全释放。", ["使用 select-default 尝试向缓冲 channel 存入门票。", "槽位满时走 default 分支立即返回 ErrOverloaded。", "门票预留成功后用 defer 释放，并执行目标函数。"]),
    14: ("固定测试会验证 SSE 游标增量过滤 (ID > lastID) 与客户端断线取消退出。", ["遍历 events 列表，只挑出 ID > lastID 的增量事件。", "向通道推送时用 select 同时监听 ctx.Done()。", "一旦检测到 context 取消，立即返回 ctx.Err()。"]),
    15: ("固定测试会校验租户与 Run 追踪上下文字段非空，并将耗时换算为毫秒。", ["检查 tenant 和 run 追踪标识，任一缺失返回 ErrMissingTrace。", "调用 elapsed.Milliseconds() 将时间换算为毫秒整数。", "构造并返回包含各阶段元数据的完整 AuditEntry。"]),
    16: ("固定测试会验证灰度发布门禁：回滚指令、未就绪迁移或错误率超标时准确熔断。", ["收到回滚指令时立即返回 false 与 rollback 原因。", "数据库迁移未就绪时阻断上线。", "有请求且错误率超阈值时返回 high-error-rate，一切正常返回 healthy。"]),
    17: ("固定测试会验证决策状态机 Fail Closed：答案与工具互斥，拒绝未知 Kind 与混合参数。", ["使用 switch 严格匹配 Kind 为 answer 或 tool。", "answer 类型要求 Answer 非空且 ToolName 为空。", "tool 类型要求 ToolName 非空且 Answer 为空，其余均返回 ErrInvalidDecision。"]),
    18: ("固定测试会使用 path.Clean 净化路径，并拦截绝对路径与目录逃逸攻击。", ["拒绝空路径以及以 / 开头的绝对路径。", "调用 path.Clean 净化冗余层级。", "检查净化后的路径是否为 .. 或以 ../ 开头，违规返回 ErrPathTraversal。"]),
    19: ("固定测试会验证 Step 状态机对账：完成收口、超限放弃、失败/孤儿重试与待调度分发。", ["已完成状态直接标记 done 且不可重试。", "重试次数达到上限标记 abandon 并终止。", "失败或运行中（孤儿）标记 retry 并允许重试。"]),
    20: ("固定测试会验证按优先级和字符预算装配提示词，超预算立即停止追加。", ["遍历消息切片，累计已占用的字符总数。", "当前已用长度加上当前消息若超出预算则 break 退出。", "将入选消息加入结果切片并返回。"]),
    21: ("固定测试会验证白名单拦截，以及对只读工具放行、写操作必须提供审批确认的策略。", ["首先校验目标工具是否存在于 AllowList 白名单中。", "若工具属于 WriteOps 写操作，必须附带 approved==true。", "仅在白名单且满足写审批条件时返回 true。"]),
    22: ("固定测试会验证重试预算：429 与 5xx 允许重试，4xx 客户端错误与超预算快速失败。", ["重试次数或耗时超预算时立即返回 false。", "针对 429 与 500~599 服务端瞬态错误放行重试。", "针对 400~499 客户端错误不予重试，避免无效重试。"]),
    23: ("固定测试会验证双重门禁：安全违规 0 容忍、单元测试全过与基准达标缺一不可。", ["安全违规数 SecurityViolations 必须严格为 0。", "所有单元测试必须为通过状态 TestsPassed==true。", "评测基准得分必须达到最低阈值 minScore。"]),
    24: ("固定测试会验证结业作品端到端调度器：参数校验、执行调用、失败收口与成功时签署 SHA-256 审计摘要。", ["校验 TenantID, RunID 与调用号非空，缺失返回 ErrInvalidRun。", "调用执行函数，失败时记录 Outcome=\"failed\"。", "成功时用 crypto/sha256 计算输出摘要，产出完整的审计回执。"]),
}

EXTRA_GLOSSARY = {
    4: [
        ("receiver", "写在方法名前的小括号，说明这个方法属于哪种类型。"),
        ("interface", "一张很小的能力清单；能做到清单里的方法，就能被使用。"),
        ("fake", "测试用的轻量替身，用来记录调用并返回可预测结果。"),
        ("context", "跟着一次请求传递的取消和截止信号。"),
    ],
    7: [
        ("goroutine", "由 Go 调度的轻量并发任务。"),
        ("WaitGroup", "等一组 goroutine 全部做完的计数器。"),
        ("Mutex", "同一时刻只让一个 goroutine 修改共享数据的锁。"),
        ("race", "两个并发任务没有协调地读写同一份数据。"),
    ],
}


def practice_coaching(index: int, exercise: dict) -> tuple[str, list[str]]:
    if index in PRACTICE_COACHING:
        return PRACTICE_COACHING[index]
    return (
        f"固定测试会检查：{exercise['prompt'].rstrip('。')}。",
        ["先找到 TODO 所在函数，只改这个函数。", "把题目中的每个‘必须’写成一个条件分支。", "再运行测试，根据第一条失败信息修正返回值。"],
    )


def learning_meta(index: int, *, optional: bool = False) -> dict:
    level = min(5, CHAPTER_DIFFICULTIES[index] + (1 if optional else 0))
    labels = {1: "零基础", 2: "入门", 3: "进阶", 4: "工程实战", 5: "高阶"}
    reading = 6 + level * 2 if optional else 8 + level * 2
    practice = 5 + level * 2 if optional else 10 + level * 5
    if optional:
        prerequisite = f"先完成第 {index} 章主线"
    elif index == 1:
        prerequisite = "无需前置知识"
    elif index == 9:
        prerequisite = "实作前先完成第 1-8 章；故事可先读"
    elif index == 17:
        prerequisite = "实作前先完成第 1-16 章；故事可先读"
    elif index in {23, 24}:
        prerequisite = f"综合关：先完成第 1-{index - 1} 章"
    else:
        prerequisite = f"先完成第 {index - 1} 章主线"
    return {
        "level": level,
        "label": labels[level],
        "required": not optional,
        "readingMinutes": reading,
        "practiceMinutes": practice,
        "estimatedMinutes": reading + practice,
        "prerequisite": prerequisite,
    }


def normalize_identity_terms(value):
    if isinstance(value, str):
        return value.replace("UserID", "SubjectID")
    if isinstance(value, list):
        return [normalize_identity_terms(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_identity_terms(item) for key, item in value.items()}
    return value


def code_meta(code: str, unit_id: str) -> dict:
    stripped = code.lstrip()
    if not code:
        return {"codeKind": "concept", "runnable": False, "verified": False, "verificationCommand": ""}
    if stripped.startswith(("[", "{")):
        kind = "json"
    elif "\nFROM " in "\n" + code or "\nARG " in "\n" + code:
        kind = "dockerfile"
    elif "├──" in code or "└──" in code or ("cmd/" in code and "internal/" in code):
        kind = "tree"
    else:
        kind = "go"
    runnable = unit_id in {"chapter-1", "chapter-3", "supplement-go-real-test-file"}
    syntax_verified = False
    if kind == "go":
        candidate = code if stripped.startswith("package ") else "package sample\n\n" + code
        syntax_verified = subprocess.run(
            ["gofmt"], input=candidate, text=True,
            capture_output=True, timeout=10,
        ).returncode == 0
    elif kind == "json":
        try:
            json.loads(code)
            syntax_verified = True
        except json.JSONDecodeError:
            syntax_verified = False
    elif kind in {"dockerfile", "tree"}:
        syntax_verified = True
    return {
        "codeKind": kind,
        "runnable": runnable,
        "verified": runnable,
        "syntaxVerified": syntax_verified,
        "verificationCommand": "go test ./..." if unit_id == "supplement-go-real-test-file" else ("go run main.go" if runnable else ""),
    }


def scored_checks(questions: list[str], answers: list[str]) -> list[dict]:
    checks = []
    for index, (question, answer) in enumerate(zip(questions, answers, strict=True)):
        choice_sources = [(answer, question), (answers[(index + 1) % len(answers)], questions[(index + 1) % len(questions)]), (answers[(index + 2) % len(answers)], questions[(index + 2) % len(questions)])]
        rotation = index % len(choice_sources)
        choice_sources = choice_sources[rotation:] + choice_sources[:rotation]
        choices = [value for value, _source in choice_sources]
        feedback = ["回答正确。" if value == answer else f"这句话回答的是“{source}”，不是当前这题。" for value, source in choice_sources]
        checks.append({
            "question": question,
            "answer": answer,
            "choices": choices,
            "correctIndex": choices.index(answer),
            "feedback": feedback,
        })
    return checks


def workshop_payload(index: int, chapter: dict) -> dict:
    if index in STRUCTURED_PRACTICES:
        first, second, third, _rubric = STRUCTURED_PRACTICES[index]
        fields = []
        for field_index, (label, answer) in enumerate((first, second, third)):
            options = [
                answer,
                f"把“{answer}”缩成只记成功日志，不处理失败分支。",
                f"跳过“{answer}”，上线后再凭感觉补救。",
            ]
            rotation = (index + field_index) % len(options)
            fields.append({"label": label, "options": options[rotation:] + options[:rotation]})
        payload = {
            "title": "三项工程决策",
            "prompt": "逐项选择能守住本章边界的决策。每个错误选项都代表一种真实工程误区。",
            "fields": fields,
        }
    else:
        correct = [chapter["goal"], chapter["task"], chapter["accept"]]
        pitfalls = chapter["pitfalls"] or chapter["principles"]
        distractors = [
            [pitfalls[0], f"只处理成功路径：{chapter['principles'][0]}"],
            [pitfalls[-1], f"只写代码，不执行本章要求的验证：{chapter['task']}"],
            [f"只保留一次成功截图，不验证失败条件。", f"只看输出，不核对本章验收边界：{chapter['accept']}"],
        ]
        labels = ["先定边界", "再做动作", "最后留证据"]
        fields = []
        for field_index, answer in enumerate(correct):
            options = [answer, *distractors[field_index]]
            rotation = (index + field_index) % len(options)
            fields.append({"label": labels[field_index], "options": options[rotation:] + options[:rotation]})
        payload = {
            "title": "三步工程演练",
            "prompt": "替本章排出一条能执行、能失败、能验收的路线。三步都正确，才会生成过关凭证。",
            "fields": fields,
        }
    if index in GO_PRACTICES:
        test_intent, hints = practice_coaching(index, GO_PRACTICES[index])
        payload["codeExercise"] = {
            "title": GO_PRACTICES[index]["title"],
            "prompt": GO_PRACTICES[index]["prompt"],
            "code": GO_PRACTICES[index]["code"],
            "testIntent": test_intent,
            "hints": hints,
            "failureHint": "先看第一条报错，再展开提示；一次只改 TODO 所在函数。",
        }
    if index == 24:
        payload["capstone"] = {
            "title": "结业作品：可审计的账单 Harness (Ledger Agent)",
            "brief": "把前三卷的工程能力合成一个可下载、可运行、可自测的企业级智能体服务。支持一键下载完整 Starter 源码包并在本地运行竞态检测。",
            "downloadUrl": "downloads/ledger-agent-starter.zip",
            "downloadName": "ledger-agent-starter.zip",
            "architecture": [
                "1. HTTP 接入层：租户认证、严格 JSON、429 背压与 SSE 实时事件",
                "2. 领域状态机：并发安全的 Run/Step 状态持久化、租约与 Fencing 递增",
                "3. 幂等与隔离：tenant_id + idempotency_key 联合唯一约束与防重碰撞",
                "4. 执行工作池：带容量上限的非阻塞 Worker 槽位调度与超时级联取消",
                "5. 安全工具沙箱：os.Root 路径穿越防护、只读/写副作用权限审批",
                "6. Provider 适配：严格 Decision 解码、Fail Closed 与本地确定性 Mock",
                "7. 离线安全评测：基准用例打分与恶意越权调用独立红线门禁",
            ],
            "deliverables": [
                "完整代码包：解压即跑的 Go 1.24+ 生产级微服务骨架（包含 Makefile / verify.sh）",
                "跨章装配链路：由第 9~23 章所写核心决策代码逐一拼接而成的真实系统",
                "端到端集成测试：go test -race ./... 验证高并发、网络超时与异常注入",
                "安全评测门禁：go run ./cmd/server eval 执行红蓝对抗与合规打分",
                "离线验收证明：本地生成包含 SHA-256 签名的工程交付收据 (Receipt)",
            ],
        }
    return payload


def varied_dialogue(lines, _sequence: int, _acceptance: str) -> list[dict]:
    # Dialogue ownership and turn boundaries are authored in manuscript/story-*.json.
    # The build is deliberately lossless: it may not rename speakers or reshape rhythm.
    return [{"speaker": speaker, "text": text} for speaker, text in lines]


def verify_runnable_examples(chapters: list[dict]) -> list[dict]:
    evidence = []
    with tempfile.TemporaryDirectory(prefix="manga-go-verify-") as tmp:
        root = Path(tmp)
        for chapter_number in (1, 3):
            chapter = chapters[chapter_number - 1]
            case_dir = root / f"chapter-{chapter_number}"
            case_dir.mkdir()
            (case_dir / "main.go").write_text(chapter["code"], encoding="utf-8")
            result = subprocess.run(
                ["go", "run", "main.go"], cwd=case_dir,
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode:
                raise RuntimeError(f"chapter-{chapter_number} go run failed: {result.stderr}")
            evidence.append({"unit": chapter["id"], "command": "go run main.go", "status": "pass"})

        test_dir = root / "settle-test"
        test_dir.mkdir()
        (test_dir / "go.mod").write_text("module manga-go-settle\n\ngo 1.22\n", encoding="utf-8")
        (test_dir / "main.go").write_text(chapters[0]["code"], encoding="utf-8")
        test_unit = next(item for item in chapters[0]["supplements"] if item["id"] == "supplement-go-real-test-file")
        (test_dir / "settle_test.go").write_text(test_unit["code"], encoding="utf-8")
        result = subprocess.run(
            ["go", "test", "./..."], cwd=test_dir,
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode:
            raise RuntimeError(f"settle go test failed: {result.stderr}")
        evidence.append({"unit": test_unit["id"], "command": "go test ./...", "status": "pass"})
    return evidence


def verify_go_practices() -> list[dict]:
    evidence = []
    with tempfile.TemporaryDirectory(prefix="manga-go-practices-") as tmp:
        root = Path(tmp)
        for index, exercise in GO_PRACTICES.items():
            case_dir = root / f"chapter-{index}"
            case_dir.mkdir()
            (case_dir / "go.mod").write_text("module manga-go-practice\n\ngo 1.22\n", encoding="utf-8")
            (case_dir / "exercise_test.go").write_text(exercise["test"], encoding="utf-8")
            (case_dir / "exercise.go").write_text(exercise["code"], encoding="utf-8")
            command = ["go", "test", "-race", "./..."] if exercise.get("race") else ["go", "test", "./..."]
            starter = subprocess.run(command, cwd=case_dir, capture_output=True, text=True, timeout=30)
            if starter.returncode == 0:
                raise RuntimeError(f"chapter-{index} starter unexpectedly passed")
            (case_dir / "exercise.go").write_text(GO_PRACTICE_SOLUTIONS[index], encoding="utf-8")
            solved = subprocess.run(command, cwd=case_dir, capture_output=True, text=True, timeout=30)
            if solved.returncode:
                raise RuntimeError(f"chapter-{index} solution failed: {solved.stderr or solved.stdout}")
            evidence.append({"unit": f"exercise-chapter-{index}", "command": " ".join(command), "starter": "fail", "solution": "pass"})
    return evidence


def verify_go_ai_project_practices() -> list[dict]:
    evidence = []
    with tempfile.TemporaryDirectory(prefix="manga-go-ai-project-practices-") as tmp:
        root = Path(tmp)
        for unit_id, exercise in GO_AI_PROJECT_PRACTICES.items():
            case_dir = root / unit_id
            shutil.copytree(LEDGER_LAB_DIR, case_dir)
            (case_dir / "learner_exercise_test.go").write_text(exercise["test"], encoding="utf-8")
            (case_dir / "learner_exercise.go").write_text(exercise["code"], encoding="utf-8")
            milestone = unit_id.rsplit("-", 1)[-1]
            command = ["go", "test"]
            if exercise.get("race"):
                command.append("-race")
            command.extend(["-tags", exercise["buildTag"], "-run", f"^TestLearner{milestone}", "./..."])
            starter = subprocess.run(command, cwd=case_dir, capture_output=True, text=True, timeout=30)
            if starter.returncode == 0:
                raise RuntimeError(f"{unit_id} starter unexpectedly passed")
            (case_dir / "learner_exercise.go").write_text(exercise["solution"], encoding="utf-8")
            solved = subprocess.run(command, cwd=case_dir, capture_output=True, text=True, timeout=30)
            if solved.returncode:
                raise RuntimeError(f"{unit_id} solution failed: {solved.stderr or solved.stdout}")
            evidence.append({"unit": unit_id, "seam": exercise["seam"], "buildTag": exercise["buildTag"], "command": " ".join(command), "starter": "fail", "solution": "pass"})
    return evidence


def load_text_model():
    path = PROJECT / "build_text_review.py"
    spec = importlib.util.spec_from_file_location("v15_text_model_for_html", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load v15 text model")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source = module.load_source()
    stories, _ = module.load_story_layers(source)
    return module, source, stories


def relative_avatar_paths() -> dict[str, str]:
    paths = {}
    INTERACTIVE_AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    for file in sorted(AVATAR_DIR.glob("*.png")):
        target = INTERACTIVE_AVATAR_DIR / file.name
        shutil.copy2(file, target)
        speaker = file.name.split("-", 1)[0]
        paths[speaker] = f"assets/chat-avatars/{file.name}"
    required = {"阿良", "陈平安", "宁姚", "周米粒"}
    missing = required - set(paths)
    if missing:
        raise RuntimeError(f"missing required avatars: {sorted(missing)}")
    return paths


def chapter_volume(source, index: int) -> dict[str, str]:
    starts = sorted(source.VOLUMES)
    start = max(item for item in starts if item <= index)
    title, description = source.VOLUMES[start]
    return {"title": title, "description": description}


def chapter_payload(module, source, stories, index: int, chapter: dict) -> dict:
    story = stories["chapters"][str(index)]
    parts = chapter["principles"] + chapter["pitfalls"] + [chapter["goal"], chapter["task"], chapter["accept"]]
    glossary = module.chapter_glossary(index, parts)
    known_terms = {term.lower() for term, _meaning in glossary}
    glossary += [item for item in EXTRA_GLOSSARY.get(index, []) if item[0].lower() not in known_terms]
    code = chapter["code"].replace("TenantID, UserID string", "TenantID, SubjectID string")
    if index == 4:
        code = '''type Reader interface {
    Get(id string) (string, error)
}

type MemoryBills map[string]string

func (m MemoryBills) Get(id string) (string, error) {
    name, ok := m[id]
    if !ok { return "", fmt.Errorf("bill %s not found", id) }
    return name, nil
}

func readName(store Reader, id string) (string, error) {
    return store.Get(id)
}'''
    if index == 7:
        code = '''func count(n int) int {
    var wg sync.WaitGroup
    var mu sync.Mutex
    total := 0

    for i := 0; i < n; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            mu.Lock()
            total++
            mu.Unlock()
        }()
    }

    wg.Wait()
    return total
}'''
    if index == 8:
        code = '''func stream(ctx context.Context, values []int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, value := range values {
            select {
            case <-ctx.Done(): return
            case out <- value:
            }
        }
    }()
    return out
}

func consumeFirst(parent context.Context, values []int, limit int) {
    ctx, cancel := context.WithCancel(parent)
    defer cancel() // Early return always releases the producer.
    count := 0
    for value := range stream(ctx, values) {
        consume(value)
        count++
        if count == limit { return }
    }
}'''
    if index == 14:
        code = code.replace(
            "    for {\n        select {",
            "    changed := access.Changed()\n    for {\n        select {",
        ).replace(
            "        case <-access.Changed():\n            allowed, err := access.Revalidate(ctx)\n            if err != nil || !allowed { return }",
            "        case _, open := <-changed:\n            if !open { return }\n            allowed, err := access.Revalidate(ctx)\n            if err != nil || !allowed { return }",
        ).replace(
            "        case event, open := <-events.C():\n            if !open || h.writeBillSSE(c.Writer, event) != nil { return }",
            "        case event, open := <-events.C():\n            if !open { return }\n            allowed, err := access.Revalidate(ctx)\n            if err != nil || !allowed { return }\n            if h.writeBillSSE(c.Writer, event) != nil { return }",
        )
    if index == 15:
        code = code.replace(
            "// After an approval pause, start a new trace.\n// Add a Span Link to the saved run trace.",
            '''func startApprovalResumeSpan(
    ctx context.Context, saved trace.SpanContext,
) (context.Context, trace.Span) {
    return tracer.Start(ctx, "approval.resume",
        trace.WithLinks(trace.Link{SpanContext: saved}))
}''',
        )
    if index == 19:
        code = code.replace(
            "type Fence uint64",
            "type Fence uint64\n\ntype StepState string\n\nfunc (s StepState) NeedsReconcile() bool {\n    return s == \"executing\" || s == \"unknown\"\n}",
        ).replace(
            "ID, RunID, Operation, CallID, State string",
            "ID, RunID, Operation, CallID string\n    State StepState",
        )
    return {
        "id": f"chapter-{index}",
        "kind": "chapter",
        "number": index,
        "title": chapter["title"],
        "shortTitle": chapter["title"].split("  ", 1)[-1],
        "goal": chapter["goal"],
        "scene": chapter["scene"],
        "opening": story["opening"],
        "dialogue": varied_dialogue(story["dialogue"], index, chapter["accept"]),
        "closing": story["closing"],
        "mnemonic": module.strip_cue(chapter["mnemonic"]),
        "analogy": module.CHAPTER_ANALOGIES[index],
        "glossary": [{"term": term, "meaning": gloss} for term, gloss in glossary if not (index == 1 and term == "Run")],
        "principles": chapter["principles"],
        "code": code,
        "codeGuides": module.code_reading_guide(code),
        "pitfalls": chapter["pitfalls"],
        "task": chapter["task"],
        "accept": chapter["accept"],
        "diagrams": chapter.get("diagrams", []),
        "selfCheck": scored_checks(chapter["self_check"], chapter["self_check_answers"]),
        "workshop": workshop_payload(index, chapter),
        "transitionIn": chapter["transition_in"],
        "transitionOut": chapter["transition_out"],
        "volume": chapter_volume(source, index),
        "learning": learning_meta(index),
        "beginnerCode": BEGINNER_CODE_LESSONS.get(f"chapter-{index}"),
        **code_meta(code, f"chapter-{index}"),
    }


def supplement_payload(module, source, stories, item: dict, index: int) -> dict:
    story = stories["supplements"][item["id"]]
    parts = item["bullets"] + [item["exercise"], item["acceptance"]]
    glossary = module.glossary_for(parts)
    code = item.get("code") or ""
    if item["id"] == "go-real-test-file" and not code.startswith("package "):
        code = 'package main\n\nimport (\n    "errors"\n    "testing"\n)\n\n' + code
    correct = story["closing"]
    # Supplement distractors stay in the same technical dimension as the
    # answer: they are nearby claims from this page, with one boundary wrong.
    nearby = [text for text in item["bullets"] if text and text != correct]
    nearby += [item["exercise"], item["acceptance"]]
    distractors = (nearby + ["只处理成功路径，不定义失败边界。", "把验收交给感觉，不保留可复现结果。"])[:2]
    rotation = index % 3
    choices = [correct, *distractors]
    choices = choices[rotation:] + choices[:rotation]
    return {
        "id": f"supplement-{item['id']}",
        "kind": "supplement",
        "number": index,
        "chapter": item["chapter"],
        "title": item["title"],
        "kicker": module.strip_cue(item["kicker"]),
        "opening": story["opening"],
        "dialogue": varied_dialogue(story["dialogue"], index + 24, item["acceptance"]),
        "closing": story["closing"],
        "analogy": module.supplement_analogy(item),
        "glossary": [{"term": term, "meaning": gloss} for term, gloss in glossary[:10]],
        "principles": item["bullets"],
        "pitfalls": [],
        "diagrams": [],
        "selfCheck": [{
            "question": "这张补页主要解决哪个失败？",
            "answer": correct,
            "choices": choices,
            "correctIndex": choices.index(correct),
            "feedback": [f"这是本页的结论：{correct}" if value == correct else f"这项只覆盖了本页的一部分，遗漏了本页要求的边界：{item['acceptance']}。" for value in choices],
        }],
        "code": code,
        "codeGuides": module.code_reading_guide(code) if code else [],
        "beginnerCode": BEGINNER_CODE_LESSONS.get(item["id"]),
        "task": item["exercise"],
        "accept": item["acceptance"],
        "nextHook": item["next_hook"],
        "volume": chapter_volume(source, item["chapter"]),
        "learning": learning_meta(item["chapter"], optional=True),
        **code_meta(code, f"supplement-{item['id']}"),
    }


def go_ai_project_payload(source, item: dict) -> dict:
    question, answer, choices, correct_index = item["quiz"]
    milestone_number = item["id"].rsplit("-", 1)[-1]
    lab_case = {
        "01": "provider", "02": "decision", "03": "run", "04": "tool",
        "05": "worker", "06": "events", "07": "eval", "08": "all",
    }[milestone_number]
    practice = GO_AI_PROJECT_PRACTICES[item["id"]]
    return {
        "id": item["id"],
        "kind": "supplement",
        "number": item["number"],
        "chapter": 16,
        "title": item["title"],
        "kicker": item["kicker"],
        "goal": item["goal"],
        "opening": item["opening"],
        "dialogue": [{"speaker": speaker, "text": text} for speaker, text in item["dialogue"]],
        "closing": item["closing"],
        "analogy": "像生产系统的一道实体闸门：输入必须带身份和证据，失败时闸门关闭并留下记录。",
        "glossary": [],
        "principles": item["principles"],
        "pitfalls": ["只验证一次成功演示", "把模型输出当作已授权动作", "没有失败后的状态与证据"],
        "diagrams": [],
        "selfCheck": [{
            "question": question,
            "answer": answer,
            "choices": choices,
            "correctIndex": correct_index,
            "feedback": ["回答正确。" if index == correct_index else "这个选择绕过了本里程碑要求的确定性边界。" for index in range(len(choices))],
        }],
        "code": item["code"],
        "codeGuides": ["先定位输入和身份。", "再找拒绝路径与状态变化。", "最后检查测试留下的证据。"],
        "beginnerCode": None,
        "task": item["task"],
        "accept": item["accept"],
        "nextHook": "通过本里程碑后，沿同一个 Ledger Agent 进入下一条企业边界。",
        "volume": chapter_volume(source, 16),
        "learning": {"level": 4, "label": "项目", "required": True, "readingMinutes": 8, "practiceMinutes": 12, "estimatedMinutes": 20, "prerequisite": "先完成第 9-16 章主线"},
        "projectExercise": {key: practice[key] for key in ("title", "prompt", "code", "testIntent", "hints", "failureHint", "seam", "buildTag")},
        "projectLab": {"id": f"ledger-agent-lab/{lab_case}", "title": "Ledger Agent 企业实验", "testCommand": f"go test -race -tags learner{milestone_number} -v -run '^TestMilestone{milestone_number}' ./...", "path": "labs/ledger-agent/"},
        **code_meta(item["code"], item["id"]),
    }


def main() -> None:
    module, source, stories = load_text_model()
    supplements_by_chapter = {index: [] for index in range(1, 25)}
    for index, item in enumerate(source.SUPPLEMENTS, 1):
        supplements_by_chapter[item["chapter"]].append(supplement_payload(module, source, stories, item, index))
    supplements_by_chapter[16].extend(go_ai_project_payload(source, item) for item in GO_AI_PROJECT_MILESTONES)

    chapters = []
    for index, chapter in enumerate(source.CHAPTERS, 1):
        current = chapter_payload(module, source, stories, index, chapter)
        current["supplements"] = supplements_by_chapter[index]
        chapters.append(current)
    code_units = chapters + [item for chapter in chapters for item in chapter["supplements"]]
    syntax_failures = [item["id"] for item in code_units if item["code"] and not item["syntaxVerified"]]
    if syntax_failures:
        raise RuntimeError(f"code syntax validation failed: {syntax_failures}")
    verification = verify_runnable_examples(chapters) + verify_go_practices() + verify_go_ai_project_practices()
    subprocess.run(["go", "test", "-race", "./..."], cwd=LAB_DIR, check=True, capture_output=True, text=True, timeout=60)
    if INTERACTIVE_LAB_DIR.exists():
        shutil.rmtree(INTERACTIVE_LAB_DIR)
    shutil.copytree(LAB_DIR, INTERACTIVE_LAB_DIR)
    verification.append({"unit": "harness-lab", "command": "go test -race ./...", "status": "pass"})
    subprocess.run(["go", "test", "-race", "./..."], cwd=LEDGER_LAB_DIR, check=True, capture_output=True, text=True, timeout=60)
    if INTERACTIVE_LEDGER_LAB_DIR.exists():
        shutil.rmtree(INTERACTIVE_LEDGER_LAB_DIR)
    shutil.copytree(LEDGER_LAB_DIR, INTERACTIVE_LEDGER_LAB_DIR)
    verification.append({"unit": "ledger-agent-lab", "command": "go test -race ./...", "status": "pass"})
    payload = normalize_identity_terms({
        "version": VERSION,
        "title": "漫画Go学习",
        "subtitle": "Go 后端与 Harness AI 互动学堂",
        "description": "把一场场工程事故，走成能观察、能判断、能修改、能验收的学习路径。",
        "chapters": chapters,
        "avatars": relative_avatar_paths(),
        "stats": {
            "chapters": len(chapters),
            "supplements": sum(len(chapter["supplements"]) for chapter in chapters),
            "dialogueTurns": sum(len(chapter["dialogue"]) for chapter in chapters)
            + sum(len(item["dialogue"]) for chapter in chapters for item in chapter["supplements"]),
            "codeBlocks": sum(bool(chapter["code"]) for chapter in chapters)
            + sum(bool(item["code"]) for chapter in chapters for item in chapter["supplements"]),
        },
        "verification": verification,
        "labs": [{
            "id": "harness-lab",
            "title": "最小可运行 Harness 实验",
            "path": "labs/harness-lab/",
            "covers": ["approval", "binding", "unknown reconcile", "duplicate call", "receipt digest"],
        }, {
            "id": "ledger-agent-lab",
            "title": "Ledger Agent 企业实验",
            "path": "labs/ledger-agent/",
            "covers": ["tenant", "idempotency", "provider", "strict JSON", "tool policy", "lease", "fencing", "events", "audit", "eval"],
        }],
    })
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    runner_exercises = {
        f"chapter-{index}": {key: item for key, item in value.items() if key in {"code", "test", "race"}}
        for index, value in GO_PRACTICES.items()
    }
    runner_exercises.update({
        unit_id: {key: item for key, item in exercise.items() if key in {"code", "test", "race", "seam", "buildTag"}}
        for unit_id, exercise in GO_AI_PROJECT_PRACTICES.items()
    })
    RUNNER_EXERCISES_OUT.write_text(json.dumps(runner_exercises, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    RUNNER_RUBRICS_OUT.write_text(json.dumps({f"chapter-{index}": [[field[1]] for field in value[:3]] for index, value in STRUCTURED_PRACTICES.items()}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_starter_zip()
    print(json.dumps({"status": "pass", "output": str(DATA_OUT), "stats": payload["stats"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
