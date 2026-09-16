# v15 审读计划

本书属于软件工程私人学习材料，风险级别为 standard，不构成受监管专业建议。两轮均为独立 AI-assisted review，不冒充持证专业签字。

## Round 1

- domain：核对 Go、HTTP、事务、并发、可观测性、Harness 身份/授权/副作用/恢复/Eval 契约。
- book：核对事故到问答到行动到回扣是否顺畅，初学者解释是否准确且不幼稚。
- production：核对 PDF 页面、头像连续性、代码高亮、图表、字号、对比度、书签和目录链接。

Round 1 首次检查完整候选；发现问题后只发送 issue、改动页、相邻页和新哈希做闭环。

## Round 2

使用与 Round 1 不同的独立上下文，盲审重建后的完整候选。重点检查回归、残留技术错配、对话连贯性和最终阅读体验。

每个角色输出 `issue_id | severity | claim | artifact:page-or-location | evidence | required_fix | verification`。无问题时必须明确写出 `no findings` 和 residual gaps。
