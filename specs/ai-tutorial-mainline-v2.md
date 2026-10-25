# AI Agent 教程主线 v2

## 问题

当前路线在第 16 章后先进入 8 个可靠性里程碑，之后第 17 章才解释 LLM、Workflow、Agent 和 Tool。学习者尚未跑通一个最小 Agent，就要理解 deadline、幂等、lease、fencing、SSE 与评测门禁。内容本身有价值，但先修关系倒置，因此更像系统审计清单，而不是教程。

## 学习对象与结果

- 起点：已经完成 Go 基础和后端主线，但没有 AI Agent 经验。
- 结果：沿同一个 Ledger Agent，从一次模型调用逐步做到结构化输出、工具循环、状态恢复、RAG、审批、安全评测和部署验收。
- 每节固定动作：先运行最小例 -> 注入一个失败 -> 查看状态或证据 -> 修复一处 -> 运行固定测试。

## 新主线

1. **最小 Agent 闭环**：启动本地 fake provider，提交请求，看到 Run、Decision 和完成事件。
2. **模型与确定性流程**：区分 LLM、Workflow、Agent 和副作用，模型只产生候选草稿。
3. **Provider 与结构化输出**：加入超时、取消、严格 JSON 和业务校验。
4. **Tool 与最小循环**：手写一次 tool call -> execute -> tool result -> final response，再抽出注册表、最大步数和停止条件。
5. **显式状态与恢复**：加入 Run/Step、幂等、checkpoint、lease、fencing 和重启恢复。
6. **流式状态**：加入事件序号、断线续读和取消。
7. **知识与 RAG**：把检索当作受控工具，验证召回、来源、资料权限和提示注入。
8. **审批与副作用**：加入 capability、人工确认、稳定 operation ID 和未知结果对账。
9. **评测与观测**：固定数据集、fake model/tool、trace、成本、延迟和独立安全阈值。
10. **总装与部署验收**：完成跨重启恢复、故障注入、race、安全和 HTTP/SSE 验收。
11. **Coding Harness 分支**：隔离副本中的代码修改放在主项目完成后，不阻断 Agent 基础主线。

## 信息架构

- 左侧目录按上述顺序展示一个连续的“AI Agent 教程”分组，不再把 8 个里程碑提前放在第 17 章之前。
- 首页 AI 入口首先进入“最小 Agent 闭环”，而不是 Provider 超时专题。
- 多 Agent 只作为单 Agent 可测、可恢复之后的进阶分支。
- 沙箱只出现在需要文件或命令执行的附加小节，不承担 Agent 入门解释。

## 验收

- 新学习者从首页进入后，第一屏能说明输入、模型、工具、状态和输出，并能运行本地闭环。
- 上一节/下一节与左侧目录使用同一顺序。
- 每个可靠性里程碑出现在对应概念之后。
- 生成器重建后顺序不丢失，页面不依赖手改 `interactive/data/book.json`。
- 桌面与移动端都能从目录进入每一步；刷新后保留当前单元。
- 最终实验仍通过普通测试与 race 测试，证据边界不夸大真实 Provider 能力。

## 参考教学结构

- OpenAI：先单次 Responses 调用，再进入结构化输出、function calling、Agent 编排、状态、评测与生产约束。
- Anthropic：先展示完整 tool use 往返，再逐步增加 agent loop、状态和安全边界。
- LangGraph：先掌握 model/tool，再建立显式 state、持久化、interrupt、RAG 与观测。
