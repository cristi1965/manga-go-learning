# Wails + React Go 语法练习线

## 目标

让学习者在可见的桌面界面中理解 Go 语法，而不是把课程变成 Wails 或 React 框架教程。

固定学习顺序：

1. 先运行一段不依赖 Wails 的 Go 代码。
2. 只改一处 Go 语法，用固定测试确认行为。
3. 把同一个公开方法交给 Wails 绑定。
4. React 只收集输入、调用生成的 JavaScript 绑定、展示结果。

## 章节映射

| 章节 | Go 核心 | Wails 只承担 | React 只承担 |
| --- | --- | --- | --- |
| 2 | `struct`、导出字段、JSON tag | 绑定 `App.PreviewBill` | 输入金额并展示 JSON |
| 4 | 方法接收者、接口 | 绑定持有 `BillStore` 的 `App` | 调用 `SaveBill` |
| 5 | 大写导出、小写封装 | 只暴露公开方法 | 只能看到生成的公开绑定 |
| 6 | `%w`、`errors.Is` | 将 Go 错误返回调用方 | 显示可理解的失败状态 |
| 7 | goroutine、Mutex、race | 接受多次方法调用 | 连续触发刷新并显示计数 |
| 8 | `context.Context`、取消 | `OnStartup` 保存上下文 | 触发开始/取消并显示状态 |

## 范围边界

- 使用 Wails v2 的 React 模板形态；不把处于 beta 的 v3 当作基础课程前提。
- 不教 React 状态库、路由、CSS 框架或 Wails 配置大全。
- 每节先有纯 Go 固定测试；桌面窗口是观察层，不是正确性的唯一证据。
- 不声称未实测的启动速度、内存、IPC 开销或跨平台结果。

## 验收

- 首页能直达该路线，且文案明确“主学 Go”。
- 第 2、4、5、6、7、8 章都显示 Go / Wails / React 三层责任。
- 六个语法实验可从页面触发并返回真实 `go test` 结果。
- React 示例调用 Wails 生成的绑定，不手写 HTTP 替代桌面绑定。
