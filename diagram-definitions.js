export const courseDiagrams = {
  go: {
    title: 'Go 学习路线',
    caption: '先看输入，再定规则，最后用测试证明。',
    source: `flowchart LR
      input["输入<br/>数字、JSON、请求"] --> model["数据模型<br/>struct 与类型"]
      model --> rule["业务规则<br/>函数与接口"]
      rule --> concurrent["并发与取消<br/>goroutine 与 Context"]
      concurrent --> proof["测试证明<br/>正常与失败都验证"]
      proof -. "失败后回到对应环节" .-> rule`,
  },
  backend: {
    title: '后端领域图',
    caption: '请求从 HTTP 边界进入记账领域，再落到存储和异步处理。',
    source: `flowchart TB
      client["客户端<br/>发送 HTTP 请求"] --> handler["Handler<br/>读请求、回响应"]
      handler --> service["Service<br/>执行记账规则"]
      service --> bill["账单 Bill<br/>金额、租户、状态"]
      service --> repository["Repository<br/>保存与查询账单"]
      repository --> database[("数据库")]
      service --> outbox["Outbox 事件<br/>记下待发送消息"]
      outbox --> worker["Worker<br/>异步处理"]
      worker --> external["缓存 / 外部服务"]`,
  },
  ai: {
    title: 'AI 任务执行与恢复时序',
    caption: '写请求后断线时，先查原结果，再决定是否重试。',
    source: `sequenceDiagram
      actor User as 用户
      participant API as 接口
      participant Run as 任务记录
      participant Worker as 执行器
      participant Tool as 工具
      User->>API: 发起任务
      API->>Run: 保存 Run 和 Step
      API-->>User: 返回任务编号
      Worker->>Run: 用租约领取 Step
      Worker->>Tool: 带 CallID 执行
      alt 收到成功回执
        Tool-->>Worker: 结果 + receipt
        Worker->>Run: 记为完成
      else 连接中断，结果不明
        Worker->>Run: 先保存 Unknown
      Worker->>Tool: 用原 CallID 查询回执
      Tool-->>Worker: 返回原结果或“未找到”
      alt 已有成功回执
        Worker->>Run: 校验 Binding/Fence 后记为完成
      else 未找到回执
        Worker->>Run: 保持 Unknown，进入人工终止或审批后的新 Attempt
      end
      end
      Run-->>User: 展示可追溯结果`,
  },
};
