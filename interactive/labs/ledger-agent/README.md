# Ledger Agent Lab

这是一个只依赖 Go 标准库的可运行实验，展示如何把 AI 决策限制在企业后端可审计、可取消、可恢复的边界内。它不是一个让模型直接写账本的聊天示例。

## 已实现的工程边界

- `tenant_id + idempotency_key` 原子创建 Run；同键不同输入返回冲突，跨租户查询表现为不存在。
- Provider 是可替换接口；adapter 必须遵守 `context.Context` 取消契约，Engine 不创建遮掩失控 adapter 的后台 goroutine。调用有超时和响应大小上限，决策使用严格 JSON。
- Tool 只能来自服务端 Registry。写 Tool 接收绑定 tenant/run/step/fence 的 capability，并通过 `Commit` 原子提交副作用；`ReadFileTool` 使用 Go `os.Root` 防止路径检查与打开之间的符号链接竞态。
- Run/Step 分开记录，claim 生成 lease、attempt 和单调 fence。lease 过期可接管，旧 worker 无法提交。
- cancel 会使当前 lease 立即失效，并取消运行中 Worker 使用的 Provider/Tool context；完成、失败和取消都是显式终态。
- 每个 Run 的 SSE 事件序号单调递增，支持 `Last-Event-ID` 重放、心跳和客户端断线取消。
- Audit 保存输入 SHA-256、租户、Run、Trace、dataset/prompt/provider 版本、耗时、结果和类别，不保存原始敏感输入。
- 固定 Eval 覆盖正常回答、恶意越权 Tool、畸形 JSON 和 Provider 超时；安全失败由独立阈值门禁。
- HTTP worker 有固定并发上限；容量耗尽时新 Run 返回 `429`，不会无界创建 goroutine。

存储是并发安全的内存实现，目的是让状态约束可读、可测。生产替换为数据库时，`CreateRun` 的唯一键、claim/fence 比较和事件追加必须放入数据库事务；不能把进程内互斥锁当作分布式一致性。

## 运行

要求 Go 1.24 或更高版本（文件工具使用 `os.Root`）。

```bash
go test ./...
go test -race ./...
go run ./cmd/server
```

服务监听 `127.0.0.1:8080`。默认 Provider 是本地确定性实现，不需要 API Key，也不会访问外网。

```bash
curl -sS -X POST http://127.0.0.1:8080/runs \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":"tenant-7","idempotency_key":"req-0827","input":"查询本月余额"}'

curl -sS 'http://127.0.0.1:8080/runs/RUN_ID?tenant_id=tenant-7'
curl -N -H 'Last-Event-ID: 0' 'http://127.0.0.1:8080/runs/RUN_ID/events?tenant_id=tenant-7'
curl -sS -X POST http://127.0.0.1:8080/runs/RUN_ID/cancel \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":"tenant-7"}'
```

固定评测可独立运行；任一案例不符合预期时进程返回非零状态：

```bash
go run ./cmd/server eval
```

## 八个里程碑的独立验收

每个命令只运行当前里程碑的公开行为测试；最后再运行完整 race 门禁。

```bash
go test -run '^TestMilestone01' ./... # Provider、超时和取消契约
go test -run '^TestMilestone02' ./... # 严格 JSON 与 fail closed
go test -run '^TestMilestone03' ./... # Tenant 与幂等创建
go test -run '^TestMilestone04' ./... # Tool Registry 与 os.Root 文件边界
go test -run '^TestMilestone05' ./... # Worker 取消与 fenced effect
go test -run '^TestMilestone06' ./... # SSE 重放、心跳与断线
go test -run '^TestMilestone07' ./... # 版本化 Audit/Eval 与安全阈值
go test -run '^TestMilestone08' ./... # HTTP worker 并发上限与背压
go test -race ./...
```

## 真实学习接口

八个里程碑都位于真实生产调用链上，不是独立于服务的算法题。默认构建使用
`seam_01_reference.go` 到 `seam_08_reference.go` 中的参考实现；每个文件都带有
对应的否定 build tag，例如第一关是 `//go:build !learner01`。

进入某一关时，课程会提供一个带正向 build tag 的学习者文件。例如第一关的
解答文件使用 `//go:build learner01` 并实现 `invokeProvider`。如果只启用标签却
没有提供实现，构建必须失败：

```bash
go test -tags learner01 -run '^TestMilestone01' ./...
# 缺少学习者文件时：undefined: invokeProvider
```

这条失败是有意设计的红灯证据：生产代码已经调用学习接口。提交实现后，同一
命令必须转绿，并且最后仍要运行 `go test -race ./...`。八关对应关系如下：

| 标签 | 生产调用接口 | 企业约束 |
| --- | --- | --- |
| `learner01` | `invokeProvider` | deadline 与取消必须传到 Provider |
| `learner02` | `decodeDecisionStrict` | 单一 JSON、拒绝未知字段、按 kind fail closed |
| `learner03` | `idempotencyIdentity` | tenant 作用域、输入摘要与冲突检测 |
| `learner04` | `validateToolPath` | 相对路径策略；平台固定使用 `os.Root` 原子解析 |
| `learner05` | `validateFence` | 状态、step、owner、token、fence、lease 全量校验 |
| `learner06` | `copyEventsAfter` | cursor 过滤并深拷贝事件数据 |
| `learner07` | `AssessEval` | 普通失败与安全失败独立门禁 |
| `learner08` | `reserveWorkerSlot` | 非阻塞容量预留与明确背压 |

不要把 reference 文件与 learner 文件同时编译；互斥 build tag 保证同一构建中
每个接口只有一个实现。

## 阅读顺序

1. `types.go`：Run、Step、Lease、Event、Audit 和严格 Decision 契约。
2. `store.go`：幂等创建、租户隔离、状态转换、lease/fencing、取消和事件重放。
3. `provider.go`：可替换 Provider、硬超时、响应上限和 fail-closed JSON 解析。
4. `tools.go`：服务端 Tool 注册表及文件路径边界。
5. `worker.go`：把 claim、AI 决策、Tool 与 fenced commit 串成一个执行回合。
6. `http.go`：HTTP 准入与背压；创建返回持久 Run，状态通过查询和 SSE 观察。
7. `eval.go`：绑定 dataset/prompt/provider 版本并执行独立安全阈值的固定回归样本。

## 生产化替换点

- Store：换成带唯一约束、事务、行锁/CAS 和 outbox 的持久数据库实现。
- Provider：实现真实 HTTP adapter，并保留上下文取消、连接/响应限制和供应商错误分类。
- Worker：由持久队列驱动，加入 lease heartbeat、退避、死信、未知副作用对账和优雅停机。
- 身份：`tenant_id` 必须来自认证中间件，不应信任请求体或查询参数；本 lab 显式传入只为展示隔离规则。
- Tool：写操作还需要审批、预算预留、稳定 effect call ID、下游幂等键和不可变执行绑定。
