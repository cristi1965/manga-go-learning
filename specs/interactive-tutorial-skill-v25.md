# v25 交互教程能力沉淀

## 目标

在不改变当前 Go + AI 学习主线行为的前提下，完成两件事：

1. 为本仓库建立唯一的“当前主线、证据等级、验收入口”说明，降低规格和审计入口分散造成的维护成本。
2. 将已经验证有效的教学合同、练习梯度、运行证明、连续交互和四层验收抽成独立的公开 Codex Skill。

## 当前基线

- 当前学习体验基线是 v24：单元内采用“看现象 / 懂规则 / 动手过关”的界面投影。
- 教学模型不等于三步界面。通用模型使用语义动作，界面可以按课程规模投影成不同数量的任务。
- 当前课程的技术范围、人物、题材、单元编号、固定端口、像素阈值和评分线都属于项目配置，不进入通用 Skill。

## 通用边界

Skill 名称：`interactive-tutorial-builder`。

Skill 负责：

- 定义学习者起点、可观察终点和先修图。
- 对齐场景、机制、动作、反馈和成功证据。
- 设计从预测、局部修改到独立迁移的练习梯度。
- 区分静态演示、受限本地运行、真实服务和远程沙箱的能力边界。
- 验证内容、runtime、浏览器和教学法四个独立层面。
- 校验证据是否绑定同一候选版本。

Skill 不负责：

- 复制本仓库的 Go、Wails、数据库或 AI 课程内容。
- 固定某一种前端框架、runner、界面步数或视觉样式。
- 把自动化通过解释成真人学习效果已经得到证明。
- 替代目标项目自己的安全设计、部署流程或领域专家审查。

## 本仓库优化

- README 增加当前主线、路线入口、运行能力边界和分层验收命令。
- `package.json` 暴露学习流、导航、企业路线、浏览器和 runner 的独立命令，并提供聚合入口。
- 保留现有生成器和运行器行为；本次不重写 3700 行生成链路，也不引入新的课程 Schema 迁移。

## 独立仓库

公开仓库：`cristi1965/interactive-tutorial-builder`。

目录：

```text
README.md
LICENSE
.github/workflows/ci.yml
skills/interactive-tutorial-builder/
  SKILL.md
  agents/openai.yaml
  references/learning-design.md
  references/acceptance-and-evidence.md
  scripts/verify_tutorial_evidence.py
tests/
```

许可证使用 Apache-2.0。所有内容采用 clean-room 方式重写，不复制课程人物、图像、PDF、对话、审稿记录或本机路径。

## 验收

- Skill 通过 `quick_validate.py`。
- 证据校验器通过正例、hash 不一致、文件摘要失效和缺失层级测试。
- CI 配置能在本地对应命令中通过。
- 独立评审使用一个新的技术教程请求执行前向测试，检查是否能产出合理计划且不泄漏 Go 项目私有规则。
- 发布前扫描密钥、本机绝对路径和大文件。
- Go + AI 仓库只提交本次文档与验收入口变化；两个未跟踪 Python 草稿保持不变。
