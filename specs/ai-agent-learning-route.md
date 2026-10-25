# Go × AI Agent 学习提升路线

## 目标

把现有 8 个 AI 里程碑组织成 3 个连续项目。学习者不再面对一串孤立概念，而是沿同一条工程路线完成三个可运行、可验证、可复盘的完整 Agent 系统。沙箱不是主线，只是执行层的一个可替换实现。

## 能力范围

主流官方教程反复出现的能力交集是：模型调用、结构化输出、工具协议、Agent 循环、显式状态、RAG、恢复、评测、观测、权限和安全边界。课程按先修关系把这些能力转成学习任务，不复制外部资料的原文。

参考资料：

- [OpenAI：Text generation](https://developers.openai.com/api/docs/guides/text)
- [OpenAI：Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Anthropic：Tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [LangGraph：Quickstart](https://docs.langchain.com/oss/python/langgraph/quickstart)

## 三个核心项目

### 1. 可审计的 Go Agent Harness

入口：第 17 章的“运行最小 Agent”，随后按概念先修关系穿插 8 个 AI 里程碑，最终接入 `labs/ledger-agent/`。

学习结果：能在 Go 中实现目标解析、计划与执行循环、Provider 边界、严格结构化输出、工具注册表、权限校验、短期记忆、取消与超时、重试与幂等、Run/Step 状态机、租约与恢复、审计和安全评测。

验收：正常调用、畸形输出、越权工具、超时、重复提交、断线恢复和旧 worker 竞争都必须有固定测试。只有需要执行文件或命令时，才在附加小节比较 Muse 与 OpenAI 的沙箱接入，不扩展为沙箱选型课。

### 2. 企业知识库研究 Agent

入口：第 20 章的上下文边界，连接第 18 章工具协议和第 22 章评测。

学习结果：能完成任务拆解、文档切分、召回、重排、上下文预算、来源引用、资料权限、过期资料处理和 MCP/API 工具接入，并让 Agent 在证据不足时停下来说明原因。

验收：每条回答都能回指来源；找不到证据时拒答；提示注入、越权资料、未知工具和超出上下文预算的样本必须被拦截。

### 3. 多 Agent 协作与审批系统

入口：第 21～24 章，复用前两个项目的工具和评测基础。

学习结果：能把规划、研究、执行、审查拆成有边界的 Agent，加入共享上下文、人工确认、预算和权限预留、轨迹记录、失败恢复、回归评测和延迟/成本观测。

验收：不允许模型直接越过审批执行副作用；评测集能比较改动前后；失败原因、工具轨迹和最终状态可以还原。

## 共同交付物

每个项目必须留下：

1. 可运行入口和最小架构图。
2. 正常、失败、越权、超时、恢复五类固定样本。
3. Go 测试和一份结果摘要。
4. 一页设计复盘：做了什么、拒绝了什么、证据在哪里。

## 沙箱附加小节

沙箱只回答一个问题：Agent 需要读文件、跑命令或生成产物时，执行层怎样接进来。课程只保留 Muse 与 OpenAI 两个对照，不把沙箱当成 Agent 本身。

- **Muse**：重点观察 Agent 与执行环境、外部动作审批和用户确认之间的边界。
- **OpenAI**：重点观察 Agents SDK / Agents API 的 harness、工具路由、审批、追踪、恢复状态与 sandbox compute 如何分层。OpenAI 官方文档明确把 harness 视为控制面，把 sandbox 视为执行面。[Sandbox Agents](https://developers.openai.com/api/docs/guides/agents/sandboxes)

学习者需要画出“Agent 控制面 → 工具/审批 → 执行环境 → 结果回写”的边界图，并测试：权限撤销、审批后参数变化、执行超时、结果未知时不能自动重复副作用。

这条路线关注的是能力增长和作品质量，不把“能调用模型”当作完成标准。
