# Go + AI 企业级课程交接

## 目标

把这套课程交付为可连续学习、可真实编码、可生成运行证明的 Go + AI 企业级工程课程。质量优先于速度；不要用展示型假测试替代真实编译、竞态检测和浏览器学习流程。

项目目录：

```text
/Applications/workspace/ai管力/账本/go-ai-enterprise-book
```

## 当前状态

- 版本：`18.7.0`。
- 内容：24 章、55 个补充单元、8 个 Go + AI 项目里程碑、32 个代码练习。
- 8 个项目关卡会把学员函数注入真实 `labs/ledger-agent`，用 `learner01` 到 `learner08` build tag 替换参考 seam。
- 每关必须同时出现 `TestMilestoneNN` 和 `TestLearnerNN` 的明确 PASS，才能签发运行证明。
- 学员源码只允许当前关卡需要的最小导入白名单；`C`、`os`、`net/*` 等不能进入项目运行器。
- `go test -race -count=1 ./...` 与 `go vet ./...` 已在最后白名单补丁后通过 `runner/`。
- 4173 预览服务已停止。
- 目录尚未初始化 Git；GitHub 仓库尚未创建或推送。`gh` 当前登录账号是 `cristi1965`。

现有 [v18-engineering-acceptance.json](evidence/v18-engineering-acceptance.json) 显示 100 分，但生成时间早于最后的 `runner/main.go` 与 `runner/main_test.go` 修改。它是过期证据，不能作为当前代码的最终验收结论。

## 权威文件

- `build_html.py`：课程数据、8 个项目挑战、标准答案和固定契约测试的源文件。
- `build_text_review.py` 与 `manuscript/source-model.json`：可移植的基础课程模型及 v15 内容覆盖入口。
- `labs/ledger-agent/`：真实多文件 Ledger Agent 项目和 8 个参考 seam。
- `runner/main.go`：学员代码校验、临时项目注入、沙箱执行、证明签发。
- `runner/main_test.go`：运行器回归测试，包括 `os.Exit`、CGO 和 localhost 网络绕过。
- `verify_v18.py`：完整工程验收，要求两类命名测试均通过。
- `enterprise_learning_audit.mjs`：学习流程、刷新恢复、草稿和导航验收。
- `specs/enterprise-go-ai-learning.md`：学习体验规格。
- `specs/enterprise-go-ai-tasks.md`：实现任务清单。

`interactive/data/book.json`、`interactive/labs/` 和相关静态文件由构建生成。内容修改应落到上述源文件，再运行构建，不要只改生成副本。

## 已完成的核心设计

8 个真实生产 seam：

| 关卡 | 函数 | 企业能力 |
|---|---|---|
| 01 | `invokeProvider` | Provider 超时与取消传播 |
| 02 | `decodeDecisionStrict` | 严格结构化输出解析 |
| 03 | `idempotencyIdentity` | 租户隔离的幂等身份 |
| 04 | `validateToolPath` | 工具路径策略 |
| 05 | `validateFence` | 租约与 fencing token |
| 06 | `copyEventsAfter` | 事件游标与安全复制 |
| 07 | `AssessEval` | 证据版本和评测门禁 |
| 08 | `reserveWorkerSlot` | worker 背压与并发上限 |

运行器已经具备：严格 AST 签名校验、每关导入白名单、真实项目复制、build tag 注入、固定契约测试、`-race`、进程组超时、输出上限、运行证明与完成证明绑定。

## 下一步：必须按顺序完成

### 1. 固定安全回归

```bash
cd /Applications/workspace/ai管力/账本/go-ai-enterprise-book/runner
gofmt -w main.go main_test.go
go test -race -count=1 ./...
go vet ./...
```

完成标准：两个命令退出码均为 0；`main_test.go` 中 CGO `C.exit(0)`、`net/rpc`、`os.Exit(0)`、`net/http` 四类绕过均被拒绝且不生成 proof。

### 2. 重跑完整工程验收

```bash
cd /Applications/workspace/ai管力/账本/go-ai-enterprise-book
./verify-v18.sh
```

这一步耗时约 10 至 15 分钟，不要中断。它会构建课程、运行 Go 测试、执行 24 个普通练习、8 个项目关卡和真实浏览器学习流程。

完成标准：命令退出码为 0；新报告 `status=pass`、`score=100`、`version=18.7.0`；8 个 `project-exercise-*` 项同时满足 `milestoneTestPassed=true` 与 `learnerContractPassed=true`。

### 3. 校验证据绑定当前代码

```bash
python3 - <<'PY'
import hashlib, json
from pathlib import Path

root = Path('/Applications/workspace/ai管力/账本/go-ai-enterprise-book')
report = json.loads((root / 'evidence/v18-engineering-acceptance.json').read_text())
for name in ('runner/main.go', 'runner/main_test.go', 'verify_v18.py'):
    actual = hashlib.sha256((root / name).read_bytes()).hexdigest()
    expected = report['sha256'][name]
    print(name, actual == expected, actual)
PY
```

完成标准：三行均输出 `True`。任意一行为 `False`，都要从步骤 2 重新开始。

### 4. 启动并做最终浏览器检查

```bash
cd /Applications/workspace/ai管力/账本/go-ai-enterprise-book
./run-preview.sh
```

打开 `http://127.0.0.1:4173/#supplement-go-ai-01`，至少实际完成一关：编辑代码、运行、查看失败提示、提交正确答案、完成关卡、刷新页面确认进度恢复，再进入下一关。

完成标准：桌面和手机宽度均无文字遮挡；错误提示可行动；运行期间布局不跳动；刷新后 proof、完成状态和草稿行为符合规格。

### 5. 初始化并推送 GitHub

只有步骤 1 至 4 全部通过后再执行。默认采用私有仓库，避免未确认前公开课程资产和验收截图。

```bash
cd /Applications/workspace/ai管力/账本/go-ai-enterprise-book
git init -b main
git add .
git status --short
git commit -m "Build enterprise Go and AI learning course"
gh repo create cristi1965/go-ai-enterprise-book --private --source=. --remote=origin --push
```

提交前检查 `git status`，确认 `node_modules/`、`.playwright-cli/`、`__pycache__/`、日志和 PID 文件未进入暂存区。当前最大受控文件约 11 MB，不超过 GitHub 单文件 100 MB 限制。

完成标准：`git status --short` 为空；`git branch -vv` 显示 `main` 跟踪 `origin/main`；`gh repo view cristi1965/go-ai-enterprise-book --json url,visibility` 返回正确 URL 且 `visibility` 为 `PRIVATE`。

## 后续质量路线

完成当前交付后，再评估以下增强；不要把它们冒充为当前已验证能力：

1. 用真实 PostgreSQL 替换内存存储，增加事务、唯一约束、迁移和故障恢复实验。
2. 加入 OpenTelemetry trace、结构化日志、指标和跨 Provider 延迟预算。
3. 增加真实模型 Provider 的限流、重试、熔断、成本预算和降级策略。
4. 在容器与 CI 中复跑竞态、集成和浏览器验收，形成可重复发布门禁。
5. 增加多租户权限、审计留痕、数据保留和提示词/模型版本回滚演练。

这些增强的完成标准应包含可执行测试、失败注入和证据文件，而不仅是课程文字或示例代码。

## 交付边界

当前目标是达到企业级开发训练水准：学员修改真实工程 seam，并通过真实契约、竞态和端到端学习流程验证。它不是已经部署到生产的 AI 平台。真实云凭证、生产数据库、外部模型 SLA、生产可观测性和容器基础设施仍属于后续工作。
