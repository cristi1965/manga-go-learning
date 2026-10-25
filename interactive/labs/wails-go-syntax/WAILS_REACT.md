# 把纯 Go 核心接到 Wails + React

页面里的五个练习都直接测试 `app.go`。测试通过后，再用 Wails v2 React 模板观察同一个 Go 方法。

```bash
wails init -n billdesk -t react
cd billdesk
wails dev
```

把 `app.go` 中的 `App`、`Bill` 和方法放入模板项目的 Go 包，在 `main.go` 中保持两个薄连接：

```go
app := NewApp(&MemoryStore{})

err := wails.Run(&options.App{
    Title:     "Go 语法观察台",
    OnStartup: app.OnStartup,
    Bind:      []interface{}{app},
})
```

Wails 会为公开 Go 方法生成 JavaScript/TypeScript 绑定。`react/App.tsx` 只展示三步：收集输入、调用 `PreviewBill`、显示返回值或错误。

这条路线的重点仍是 Go：先看 `App` 的方法签名、接收者、接口依赖、错误链和 `context`，最后才看 React 如何触发它。
