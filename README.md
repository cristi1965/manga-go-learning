# 漫画Go学习

这是一个面向 Go、后端工程与 Harness AI 工程实践的互动教材工程。

## 一封留在主页上的信 · A Note Left Here

有些账号像旧路标，曾经指向一段很长的路。后来路还在，路标却再也回不去了。

`suoutsky` 是我曾经使用过的账号，如今已经无法找回；`cristi1965` 是我现在继续写下去的名字。两个账号属于同一段创作轨迹，也共同见证了这个项目从最初的想法，走到今天的模样。

我把这段话留在这里，不是为了证明什么，只是想给那段丢失的登录、未能取回的旧日，留一个安静的位置。旧账号没有回来，但代码还可以继续生长，故事也还没有写完。

Some accounts are like old signposts. The road remains, but the sign is no longer within reach.

`suoutsky` was the account I once used, and I can no longer recover it. `cristi1965` is the name under which I continue this work today. They belong to the same creative path, carrying the memory of how this project began and how it keeps moving forward.

I leave this note here not as proof, but as a quiet place for something I lost: an old login, a former chapter, a door that would not open again. The account is gone, but the code can still grow, and the story is not finished.

## 内容

- Go 基础、错误处理、测试、并发与工程化
- HTTP、JSON、认证、领域建模、存储与异步任务
- Harness AI、Tool Calling、Run/Step、审批、幂等与恢复
- Wails + React 路线，用桌面应用场景练习 Go 语法
- 数据库基础、MySQL 与 Redis，共 23 个独立练习单元
- 漫画式对话、术语点击解释、Mermaid 流程图/领域图/时序图
- CodeMirror 代码编辑器、本地运行器与固定测试

## 当前学习主线

当前学习体验基线是 **v24**。Go、后端与 AI 共 79 个章节/补充单元；单课界面使用“看现象 / 懂规则 / 动手过关”三个稳定任务，但底层教学合同仍按预测、修改、运行、解释和迁移等语义动作记录证据。

推荐从首页按自己的起点进入：

- 第一次接触后端：数据库基础 -> MySQL -> Redis -> Go 基础。
- 主要学习 Go：Go 基础 -> 后端工程 -> Wails + React 实践。
- 已有 Go 基础：Harness AI -> Agent 工程 -> 可恢复项目实验。

跨单元导航不会强制锁课；“已完成”状态则必须由该单元声明的预测、代码改动、真实运行、固定测试或迁移任务证据支持，不能只靠点击或本地勾选获得。

## 运行

打开 `interactive/index.html` 可阅读静态课程。完整的代码编译、固定测试和项目验收需要启动本地预览服务：

```sh
./run-preview.sh
```

课程网站的 GitHub Pages 版本是静态阅读版；本地版才提供 Go 运行与判题服务。

## 能力边界

- 静态 Pages：用于阅读、目录浏览和不依赖本地 runner 的交互。
- 本地预览：提供受限 Go 运行、固定测试和课程完成证明。
- 教学 SQL 校验器不等同于真实 MySQL/InnoDB；没有真实 Redis 服务时，不把内存行为描述成真实 Redis 验证。
- 自动化审计证明内容结构、运行约束、浏览器交互和教学代理指标，不等于真人保持率或迁移效果已经得到验证。

## 验收

验收需要 Go 工具链、Chrome 和 Node.js 18 或更高版本。先启动本地预览，再在另一个终端运行需要浏览器的检查：

```sh
./run-preview.sh
npm run verify:course
```

也可以分别运行：

```sh
npm run test:runner       # Go runner 与固定测试
npm run audit:learning    # 单课连续学习流
npm run audit:navigation  # 首页、目录、跨单元和数据库导航
npm run audit:enterprise  # AI 项目里程碑与运行证明
npm run audit:browser     # 全单元桌面/移动/暗色/无障碍回归
```

这些命令分别生成或输出自己的证据，不能用其中一个通过替代其他层面的验收。当前设计与通用 Skill 沉淀边界见 [`specs/interactive-tutorial-skill-v25.md`](specs/interactive-tutorial-skill-v25.md)。
