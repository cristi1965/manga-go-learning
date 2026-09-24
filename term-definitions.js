// 自定义类型与执行状态以教材语境解释；source 为对应机制的官方参考，不声称定义教材字段。
export const termDefinitions = [
  {
    "term": "Handler",
    "aliases": [
      "handler"
    ],
    "chinese": "请求处理器",
    "summary": "接到一个网络请求后，读出参数，再把结果发回去。",
    "explanation": "例如用户提交一笔账单，Handler 先读金额，再调用记账功能，最后返回编号或错误。Go 标准库的 http.Handler 要有 ServeHTTP 方法；各框架的写法不同，记账规则本身不应全写在这里。",
    "example": "func hello(w http.ResponseWriter, r *http.Request) { w.Write([]byte(\"hello\")) }",
    "pitfall": "Handler 不是 Go 关键字；不同框架约定的函数签名不同。",
    "related": [
      "HTTP",
      "Service",
      "Gin Context"
    ],
    "source": "https://pkg.go.dev/net/http#Handler"
  },
  {
    "term": "Service",
    "aliases": [
      "service"
    ],
    "chinese": "业务服务",
    "summary": "把完成一件业务所需的检查和操作放在一起。",
    "explanation": "例如记账先检查金额，再调用保存数据的代码。HTTP 请求和命令行都可以调用同一个 Service。它是教材给这类代码起的名字，不是 Go 内置类型，也不一定单独运行在一个进程里。",
    "example": "记账 Service 检查金额是否合法，然后调用 Repository 保存账目。",
    "pitfall": "Service 不一定是独立进程，也不意味着所有逻辑都放进一个大结构体。",
    "related": [
      "Handler",
      "use case",
      "Repository"
    ],
    "source": "https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis"
  },
  {
    "term": "use case",
    "aliases": [
      "use-case",
      "Use Case"
    ],
    "chinese": "一次完整的业务操作",
    "summary": "说明用户要完成哪件事，以及程序为此要做哪些步骤。",
    "explanation": "例如“创建账目”包括检查金额、确认权限、保存和返回编号。代码把这些步骤串起来，并说明哪一步失败时怎样返回。这里说的是业务操作，不是测试用例，也不是一个按钮的名字。",
    "example": "创建账目：校验金额 → 检查权限 → 保存 → 返回账目编号。",
    "pitfall": "用例不是页面按钮的别名，也不是 Go 语法。",
    "related": [
      "Service",
      "Handler"
    ],
    "source": "https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/ddd-oriented-microservice"
  },
  {
    "term": "Repository",
    "aliases": [
      "repository"
    ],
    "chinese": "读写业务数据的接口",
    "summary": "让业务代码用“查一笔账”“保存一笔账”这样的方法访问数据。",
    "explanation": "业务代码调用这些方法，不必知道数据放在数据库还是内存里。具体实现负责执行 SQL 或读写内存。Repository 是教材自定义的名称，Go 不要求每个项目都采用这种分法；这里也不是指 Git 仓库。",
    "example": "type Reader interface { Get(ctx context.Context, id string) (Entry, error) }",
    "pitfall": "此处不是 Git 仓库，也不是 Go 自带的数据库组件。",
    "related": [
      "interface",
      "SQLRepository",
      "FakeRepository"
    ],
    "source": "https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design"
  },
  {
    "term": "composition root",
    "aliases": [
      "Composition Root"
    ],
    "chinese": "启动时连接各部分的地方",
    "summary": "程序启动时，把数据库、业务功能和请求处理代码连接起来的地方。",
    "explanation": "通常在 main 附近先读配置、准备数据库，再把数据库交给存储实现，把存储实现交给业务服务，最后把服务交给请求处理器。Go 不会自动替你连好这些对象，也不需要每收到一个请求就重新做一遍。",
    "example": "repo := NewSQLRepository(db)\nservice := NewService(repo)\nhandler := NewHandler(service)",
    "pitfall": "不要把依赖装配理解为在每个请求里重新连接数据库。",
    "related": [
      "Service",
      "Repository",
      "main"
    ],
    "source": "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection"
  },
  {
    "term": "SQLRepository",
    "aliases": [
      "SQL Repository"
    ],
    "chinese": "用数据库读写数据的实现",
    "summary": "用 SQL 真正完成查账、存账的那份实现。",
    "explanation": "它保存数据库连接池，并提供业务需要的读取和保存方法。业务服务通过接口调用这些方法，不直接拼 SQL。这个类型名由教材定义；只有方法签名符合要求才算实现接口，起这个名字本身没有特殊作用。",
    "example": "type SQLRepository struct { db *sql.DB }",
    "pitfall": "名字包含 Repository 不会自动满足接口，方法集合必须匹配。",
    "related": [
      "Repository",
      "interface",
      "SQL"
    ],
    "source": "https://pkg.go.dev/database/sql"
  },
  {
    "term": "FakeRepository",
    "aliases": [
      "Fake Repository"
    ],
    "chinese": "测试用的数据存储替身",
    "summary": "测试时暂时代替数据库，让你指定能查到什么或会报什么错。",
    "explanation": "它通常把少量记录放在内存里，提供和真实存储相同的方法。这样测试业务功能时不用启动数据库，也能方便制造失败。它不会完整模拟 SQL、事务和索引，所以这些仍要另外测试。",
    "example": "测试给 FakeRepository 预放一条账目，再验证 Service 能否读取它。",
    "pitfall": "内存替身测试通过，不代表 SQL、事务隔离或索引一定正确。",
    "related": [
      "Repository",
      "SQLRepository",
      "interface"
    ],
    "source": "https://pkg.go.dev/testing"
  },
  {
    "term": "Context",
    "aliases": [
      "context.Context",
      "ctx"
    ],
    "chinese": "取消与截止时间通知",
    "summary": "把“请停止”和“最晚等到什么时候”的通知传给正在做事的函数。",
    "explanation": "例如用户取消请求，相关函数检查 Done 后停止工作，Err 说明是取消还是超时。调用者要把同一个请求的 Context 继续传下去，耗时操作也必须支持取消。它还能携带请求范围的数据，但不是装所有参数的口袋；取消不会撤销已经提交的写入。",
    "example": "ctx, cancel := context.WithTimeout(parent, time.Second)\ndefer cancel()",
    "pitfall": "不要把所有函数参数塞进 Context，也不要把取消当作数据库回滚。",
    "related": [
      "Gin Context",
      "deadline",
      "goroutine"
    ],
    "source": "https://pkg.go.dev/context"
  },
  {
    "term": "Gin Context",
    "aliases": [
      "gin.Context",
      "*gin.Context"
    ],
    "chinese": "Gin 的请求处理对象",
    "summary": "在 Gin 里读取这次请求、填写响应并控制后续处理的对象。",
    "explanation": "可以从它取得路由参数、请求内容和响应写入器。调用业务或数据库时，通常取 c.Request.Context() 传下去，传递标准库的取消和截止时间。它与 context.Context 不是同一种对象，不要跨请求保存。",
    "example": "ctx := c.Request.Context()\nentry, err := service.Get(ctx, c.Param(\"id\"))",
    "pitfall": "*gin.Context 与 context.Context 不能仅凭名字视为同一种对象；也不要跨请求保存它。",
    "related": [
      "Context",
      "Handler",
      "middleware"
    ],
    "source": "https://github.com/gin-gonic/gin/blob/master/context.go"
  },
  {
    "term": "HTTP",
    "aliases": [],
    "chinese": "超文本传输协议",
    "summary": "浏览器和服务器用来约定“怎么问、怎么答”的规则。",
    "explanation": "请求说明要做什么、访问哪里，附上头部和可能的数据；响应带状态码、头部和可能的结果内容。例如提交账单后，服务端返回新编号。HTTP 不保证一个请求只执行一次；超时后服务器可能已经处理完，重试需要防止重复记账。",
    "example": "POST /entries 提交账目，服务器返回 201 和新账目的 JSON。",
    "pitfall": "收到超时不等于服务器没有完成请求。",
    "related": [
      "Handler",
      "JSON",
      "idempotency"
    ],
    "source": "https://www.rfc-editor.org/rfc/rfc9110"
  },
  {
    "term": "init",
    "aliases": [],
    "chinese": "包初始化函数",
    "summary": "在 main 开始前，自动做少量包初始化工作的函数。",
    "explanation": "Go 先初始化依赖包，再准备当前包的变量并执行 init。init 没有参数和返回值，也不能当普通函数主动调用。适合静态注册之类的准备，不适合藏一个可能失败的数据库连接过程；执行过 init 也不代表服务已经能接请求。",
    "example": "func init() { /* 注册静态组件 */ }",
    "pitfall": "init 完成不等于服务已具备接流量所需的数据库和配置。",
    "related": [
      "main",
      "readiness",
      "package"
    ],
    "source": "https://go.dev/ref/spec#Package_initialization"
  },
  {
    "term": "readiness",
    "aliases": [
      "Readiness"
    ],
    "chinese": "就绪状态",
    "summary": "告诉外部：这个服务现在是否真的能接新请求。",
    "explanation": "例如数据库还不可用时，就绪检查返回失败，让请求暂时别发过来。在 Kubernetes 中，这会影响该 Pod 是否被选为 Service 的可用后端；它不是用来触发容器重启的存活检查。进程存在或端口打开，都不够证明业务能用。",
    "example": "数据库连接尚未就绪时，/ready 返回失败，暂不接业务流量。",
    "pitfall": "进程存在、端口已监听或 init 已执行都不必然代表业务就绪。",
    "related": [
      "init",
      "HTTP"
    ],
    "source": "https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/"
  },
  {
    "term": "DTO",
    "aliases": [],
    "chinese": "数据传输对象",
    "summary": "单独列出一次请求允许填写、或一次响应允许返回的字段。",
    "explanation": "例如新建账单只接收金额和分类，不允许客户端自己填写用户身份或内部编号。Go 中通常用结构体和 JSON 标签描述这些字段，之后仍要检查金额与权限。它是设计上的称呼，不是 Go 关键字。",
    "example": "type CreateEntryDTO struct { Amount int64 `json:\"amount\"` }",
    "pitfall": "DTO 不是 Go 关键字；反序列化成功不代表金额或权限合法。",
    "related": [
      "struct",
      "JSON",
      "schema"
    ],
    "source": "https://learn.microsoft.com/en-us/aspnet/web-api/overview/data/using-web-api-with-entity-framework/part-5"
  },
  {
    "term": "interface",
    "aliases": [
      "Interface"
    ],
    "chinese": "接口",
    "summary": "告诉调用方：传进来的对象必须会做哪些事。",
    "explanation": "例如读取函数只要求对象有 Get 方法，就把这个方法写进接口。具体类型的方法签名满足要求，便可直接传入，不用写 implements。值方法和指针方法影响哪些类型能满足接口；接口里装着有类型的空指针时，接口本身也可能不为空。",
    "example": "type Reader interface { Read([]byte) (int, error) }",
    "pitfall": "接口值装着一个带类型的 nil 指针时，接口本身可能不等于 nil。",
    "related": [
      "Repository",
      "nil",
      "method"
    ],
    "source": "https://go.dev/ref/spec#Interface_types"
  },
  {
    "term": "goroutine",
    "aliases": [
      "Goroutine"
    ],
    "chinese": "并发运行的任务",
    "summary": "让一个函数与其他工作同时推进，不必等它做完再往下走。",
    "explanation": "在调用前加 go 就会启动一个由 Go 运行时调度的并发任务。它和其他 goroutine 共享进程内存，因此共同修改数据仍要同步。启动时还要安排何时退出、由谁等待；它会占资源，main 返回也不会自动等它结束。",
    "example": "go func() { fmt.Println(\"后台工作\") }()",
    "pitfall": "goroutine 不是无限免费资源，main 结束也不会自动等待它们完成。",
    "related": [
      "channel",
      "Context",
      "race"
    ],
    "source": "https://go.dev/ref/spec#Go_statements"
  },
  {
    "term": "channel",
    "aliases": [
      "chan",
      "Channel"
    ],
    "chinese": "通道",
    "summary": "在 goroutine 之间发送数据，也让双方按约定等待对方。",
    "explanation": "无缓冲通道要发送与接收双方都准备好才能完成传递；有缓冲通道能先存下有限数量的数据。关闭表示不再发送，接收时的第二个值能说明是否已关闭且读空。向已关闭通道发送会 panic；nil 通道的收发会一直等。",
    "example": "ch := make(chan int, 1)\nch <- 7\nv := <-ch",
    "pitfall": "向关闭的通道发送会 panic，nil 通道的发送和接收会一直阻塞。",
    "related": [
      "goroutine",
      "select",
      "backpressure"
    ],
    "source": "https://go.dev/ref/spec#Channel_types"
  },
  {
    "term": "select",
    "aliases": [],
    "chinese": "通道选择语句",
    "summary": "同时等几种通道操作，哪项能做就选择一项。",
    "explanation": "例如既等结果，也等取消通知。没有可执行分支且没有 default 时会等待；多个分支同时可执行时，Go 均匀伪随机选择，并不按书写顺序分配优先级。在循环中放 default 可能让程序不停空转。",
    "example": "select {\ncase v := <-ch: fmt.Println(v)\ncase <-ctx.Done(): return\n}",
    "pitfall": "select 不按代码顺序设置优先级；循环中的 default 可能导致空转。",
    "related": [
      "channel",
      "Context"
    ],
    "source": "https://go.dev/ref/spec#Select_statements"
  },
  {
    "term": "defer",
    "aliases": [],
    "chinese": "延迟调用",
    "summary": "先记下清理动作，等当前函数退出时再执行。",
    "explanation": "例如打开文件成功后马上登记关闭文件，后面从哪个分支返回都会执行清理。登记时就会计算并保存调用参数；多个 defer 后登记的先执行。它等的是整个函数退出，不是循环的一轮结束。",
    "example": "f, err := os.Open(path)\nif err != nil { return err }\ndefer f.Close()",
    "pitfall": "defer 等的是整个函数退出，不是某次循环结束。",
    "related": [
      "panic",
      "recover"
    ],
    "source": "https://go.dev/ref/spec#Defer_statements"
  },
  {
    "term": "panic",
    "aliases": [],
    "chinese": "异常中断",
    "summary": "遇到不能继续正常执行的异常时，中断当前执行过程。",
    "explanation": "panic 发生后，不会继续执行后面的普通语句，而是沿当前 goroutine 的调用过程退回，并运行已经登记的 defer。若没有合适的 recover，程序会终止。付款不足、参数不合法等日常失败应返回 error。",
    "example": "panic(\"内部状态不可能到达这里\")",
    "pitfall": "panic 不是处理金额不足、参数错误等日常业务结果的首选。",
    "related": [
      "recover",
      "defer",
      "error"
    ],
    "source": "https://go.dev/ref/spec#Handling_panics"
  },
  {
    "term": "recover",
    "aliases": [],
    "chinese": "异常恢复",
    "summary": "在预先安排的处理位置接住 panic，避免它继续向外传播。",
    "explanation": "必须在同一个 goroutine 的 defer 函数里直接调用 recover 才能接住正在发生的 panic。处理后，相应函数结束，不会回到出错那一行继续运行。它也接不住另一个 goroutine 的 panic。",
    "example": "defer func() {\n if v := recover(); v != nil { log.Printf(\"panic: %v\", v) }\n}()",
    "pitfall": "一个 goroutine 的 recover 不能捕获另一个 goroutine 的 panic。",
    "related": [
      "panic",
      "defer",
      "goroutine"
    ],
    "source": "https://go.dev/ref/spec#Handling_panics"
  },
  {
    "term": "nil",
    "aliases": [],
    "chinese": "空值标识",
    "summary": "表示某些类型还没有指向或装入具体内容。",
    "explanation": "指针、切片、map、通道、函数和接口都可以为 nil，但可做的事不同：nil 切片可以取长度和追加元素，nil map 可以读却不能写。接口的类型和值都未设置时才等于 nil。整数和字符串不用 nil，零值分别是 0 和空字符串。",
    "example": "var xs []int\nfmt.Println(len(xs)) // 0",
    "pitfall": "nil 不是所有类型通用的空值；字符串的零值是空字符串。",
    "related": [
      "interface",
      "slice",
      "map"
    ],
    "source": "https://go.dev/ref/spec#The_zero_value"
  },
  {
    "term": "error",
    "aliases": [],
    "chinese": "错误接口",
    "summary": "让函数在返回结果时，同时说明事情为什么没办成。",
    "explanation": "成功通常返回 nil，失败返回实现了 Error() string 的值。调用方先检查错误，再决定返回、重试或转换成对外响应；补充操作说明时要保留原原因。分类用 errors.Is 或 errors.As，不靠比较可能改变的文字。",
    "example": "if err != nil { return fmt.Errorf(\"保存账目: %w\", err) }",
    "pitfall": "错误文本不适合当稳定分类标识，应优先用 errors.Is 或 errors.As。",
    "related": [
      "nil",
      "panic"
    ],
    "source": "https://pkg.go.dev/errors"
  },
  {
    "term": "struct",
    "aliases": [],
    "chinese": "结构体",
    "summary": "把一笔数据的多个字段放在一起，例如账单编号和金额。",
    "explanation": "每个字段有名称和类型，也可以为这个结构体定义方法。赋值会复制结构体本身；但其中的切片、map 和指针可能仍指向同一份数据，所以复制之后不一定能完全独立修改。",
    "example": "type Entry struct { ID string; Amount int64 }",
    "pitfall": "复制结构体不等于把它引用的所有数据都深拷贝一份。",
    "related": [
      "DTO",
      "method",
      "pointer"
    ],
    "source": "https://go.dev/ref/spec#Struct_types"
  },
  {
    "term": "JSON",
    "aliases": [],
    "chinese": "JavaScript 对象表示法",
    "summary": "用一段文本把金额、名称、列表等数据发给另一个程序。",
    "explanation": "Go 的 encoding/json 可以把 JSON 读成结构体，也能把结构体写成 JSON。收到请求后仍要限制大小、拒绝不允许的字段，并检查金额等规则。格式正确不代表业务合法，JSON 数字也不一定是整数；默认解码不会替你完成严格检查。",
    "example": "type Input struct { Amount int64 `json:\"amount\"` }",
    "pitfall": "合法 JSON 不代表合法业务输入；JSON 本身也不要求所有数字都是整数。",
    "related": [
      "DTO",
      "schema",
      "HTTP"
    ],
    "source": "https://pkg.go.dev/encoding/json"
  },
  {
    "term": "transaction",
    "aliases": [
      "Transaction"
    ],
    "chinese": "事务",
    "summary": "让几条数据库修改一起成功，或者一起撤回。",
    "explanation": "例如转账的扣款和入账应放进同一事务。Go 用 sql.Tx 执行这些语句，最后 Commit 提交或 Rollback 回滚；关键语句若仍通过 db 执行，就绕开了事务。已经发出的邮件或外部支付不属于这个数据库事务，不会跟着回滚。",
    "example": "tx, err := db.BeginTx(ctx, nil)\nif err != nil { return err }\ndefer tx.Rollback()\n// 用 tx 执行语句后检查错误并 Commit",
    "pitfall": "开启事务后仍用 db 执行关键语句，会绕开该事务。",
    "related": [
      "SQL",
      "idempotency"
    ],
    "source": "https://go.dev/doc/database/execute-transactions"
  },
  {
    "term": "idempotency",
    "aliases": [
      "Idempotency",
      "idempotent"
    ],
    "chinese": "幂等性",
    "summary": "同一件事因为重试又收到一次，也不要多记一笔。",
    "explanation": "写入请求带一个固定编号，服务端保存编号和处理结果，遇到重复编号就识别为原操作。编号还要绑定原参数，不能拿同一编号改成另一笔金额；并发请求和重启后也要能查到记录。它不保证每次响应一模一样，更不代表任何失败都能盲目重试。",
    "example": "同一个 CallID 的记账重试只形成一条账目，并返回原结果。",
    "pitfall": "幂等不等于每次响应完全相同，也不等于所有失败都可以直接重试。",
    "related": [
      "CallID",
      "transaction",
      "Unknown"
    ],
    "source": "https://docs.stripe.com/api/idempotent_requests"
  },
  {
    "term": "LLM",
    "aliases": [],
    "chinese": "大语言模型",
    "summary": "根据给出的任务和资料，生成文字或指定格式的数据。",
    "explanation": "例如把“午饭二十元”整理成金额和分类的候选值。应用把说明、问题和资料交给模型，再读取它的输出。模型可能理解错或编出事实，因此金额、权限和重要结论仍要检查；说“已经写入”不等于真的执行了写入。",
    "example": "模型把“记录午饭二十元”解释成候选参数，业务代码再校验金额与权限。",
    "pitfall": "流畅回答并不证明内容真实；模型生成的动作提议不等于已经执行。",
    "related": [
      "Agent",
      "Tool Calling",
      "token"
    ],
    "source": "https://docs.anthropic.com/en/docs/about-claude/models/overview"
  },
  {
    "term": "Workflow",
    "aliases": [
      "workflow"
    ],
    "chinese": "工作流",
    "summary": "把一件事预先排成步骤，并规定出错或遇到条件时往哪里走。",
    "explanation": "例如先读请求，再检查金额、等待批准、写账、展示结果。顺序和分支主要由程序决定，每步可以调用模型，也可以调用普通函数。这样能检查是否漏掉某一步；用了模型不代表流程就变成自主 Agent。",
    "example": "解析请求 → 校验参数 → 等待审批 → 写账 → 展示回执。",
    "pitfall": "调用了 LLM 的流程不一定就是自主 Agent。",
    "related": [
      "Agent",
      "Step",
      "Harness"
    ],
    "source": "https://www.anthropic.com/engineering/building-effective-agents"
  },
  {
    "term": "Agent",
    "aliases": [
      "agent"
    ],
    "chinese": "智能体",
    "summary": "让模型看当前情况，再决定下一步要查什么或做什么。",
    "explanation": "它通常反复读取任务信息、提出工具调用、查看结果，再决定继续还是结束。实际程序仍需检查权限、费用预算和停止条件。模型建议撤销一笔账，并不表示用户已经授权；Agent 也不一定全程自主行动。",
    "example": "智能体先查账目，再根据查询结果提出撤销某条记录的请求。",
    "pitfall": "Agent 不必完全自主，也不能因为能调用工具就跳过权限检查。",
    "related": [
      "Workflow",
      "Tool Calling",
      "Harness"
    ],
    "source": "https://www.anthropic.com/engineering/building-effective-agents"
  },
  {
    "term": "Tool Calling",
    "aliases": [
      "function calling",
      "tool calling",
      "Tool"
    ],
    "chinese": "工具调用",
    "summary": "让模型提出一个明确的操作请求，再由程序检查并执行。",
    "explanation": "程序先告诉模型有哪些工具、各做什么、参数怎么写。模型返回工具名称和参数，程序验证后才真正执行，并把结果传回。生成这段请求不会自动完成业务；参数格式正确也不等于有权限写入。",
    "example": "模型提出 create_entry({\"amount\": 20})，服务验证后才执行保存。",
    "pitfall": "参数符合 JSON schema 不代表用户有权执行该操作。",
    "related": [
      "Agent",
      "schema",
      "CallID"
    ],
    "source": "https://developers.openai.com/api/docs/guides/function-calling"
  },
  {
    "term": "Skill",
    "aliases": [
      "skill",
      "Skills"
    ],
    "chinese": "技能包",
    "summary": "把某类任务的做法和所需资料放在一起，方便下次照着做。",
    "explanation": "Agent Skills 使用带 SKILL.md 的目录，里面写任务步骤，也可以附脚本和参考资料。例如核账技能说明检查顺序并附只读脚本。它不会自动增加系统权限，也不是 MCP 协议规定的一种工具；技能说明、工具连接和模型能力是不同的东西。",
    "example": "一个“账目核对”技能包写明检查步骤，并附带只读核对脚本。",
    "pitfall": "Skill、MCP Tool 与模型能力不是同一个层次的概念。",
    "related": [
      "MCP",
      "Agent",
      "Tool Calling"
    ],
    "source": "https://agentskills.io/specification"
  },
  {
    "term": "MCP",
    "aliases": [
      "Model Context Protocol"
    ],
    "chinese": "模型上下文协议",
    "summary": "让 AI 应用按统一的通信方式发现并调用外部工具。",
    "explanation": "客户端先向服务器了解有哪些工具、资料和提示模板，再按约定交换调用消息，减少每个工具各接一套接口的工作。连接成功只说明能通信；业务授权、用户批准、防止重复写入和运行隔离仍需另外实现。",
    "example": "MCP 服务器公开“查询账目”工具，客户端发现后按参数契约调用。",
    "pitfall": "MCP 不会自动提供业务幂等、任意沙箱或用户审批。",
    "related": [
      "Skill",
      "Tool Calling",
      "Harness"
    ],
    "source": "https://modelcontextprotocol.io/specification/2025-06-18/server/index"
  },
  {
    "term": "Harness",
    "aliases": [
      "harness"
    ],
    "chinese": "管理模型执行的程序",
    "summary": "负责把模型的建议变成可检查、可追踪的实际操作的程序。",
    "explanation": "例如模型建议写账，这层程序先检查批准记录和操作编号，执行后再保存可信结果。它还管理任务进度、权限和恢复过程。这里是教材的架构称呼，不是 Go 关键字或统一协议类型，也不是只把提示词写长一点。",
    "example": "模型提议写账，Harness 检查审批与 CallID，再派发并保存回执。",
    "pitfall": "不要把 Harness 理解成更长的一段提示词。",
    "related": [
      "Agent",
      "Run",
      "receipt"
    ],
    "source": "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents"
  },
  {
    "term": "Run",
    "aliases": [
      "run",
      "RunID"
    ],
    "chinese": "一整项任务的运行记录",
    "summary": "记录用户交给系统的一整件任务，从开始到最后的结果。",
    "explanation": "例如“核对并补记今日账目”是一个 Run，里面可以有查账、批准、补记等多个 Step。编号用来在重启后继续查同一任务的进度。它的状态和字段由教材定义，不是 Go 内置类型；进程重启不必另建一件业务任务。",
    "example": "一次“核对并补记今日账目”的任务对应一个 Run。",
    "pitfall": "进程重启可以继续原 Run，不必把一次业务任务换成新的身份。",
    "related": [
      "Step",
      "Harness",
      "checkpoint"
    ],
    "source": "https://docs.temporal.io/workflow-execution"
  },
  {
    "term": "Step",
    "aliases": [
      "step",
      "StepID"
    ],
    "chinese": "任务中的一个步骤",
    "summary": "把大任务拆成能分别记录输入、进度和结果的小步骤。",
    "explanation": "例如同一项核账任务里，“查账”和“补记”是两个 Step。补记步骤如果重试，仍沿用原操作的 CallID；每次重新执行则使用新的 AttemptID。这样能看出是在重做原操作，而不是又新增一笔账。",
    "example": "“查账”和“补记账目”是同一个 Run 中的两个 Step。",
    "pitfall": "步骤重试不代表可以重新创建一个业务写入动作。",
    "related": [
      "Run",
      "CallID",
      "AttemptID"
    ],
    "source": "https://docs.temporal.io/activities"
  },
  {
    "term": "AttemptID",
    "aliases": [],
    "chinese": "每次执行的编号",
    "summary": "区分同一操作第一次发送、第二次发送等各次执行。",
    "explanation": "每次重新派发或合法重试，程序生成一个新编号，日志就能记录这次何时开始、有没有超时。几次尝试仍关联同一个 CallID，例如 A1、A2 都属于 C1。它是教材自定义字段，不是防重复写入的幂等键，也不是 Go 或 MCP 标准字段。",
    "example": "第一次请求超时记 A1，后续合法重试记 A2，两者都关联 CallID C1。",
    "pitfall": "AttemptID 不是幂等键，也不是 Go 或 MCP 规定的标准字段。",
    "related": [
      "CallID",
      "Step",
      "Unknown"
    ],
    "source": "https://docs.temporal.io/encyclopedia/retry-policies"
  },
  {
    "term": "CallID",
    "aliases": [
      "Call ID"
    ],
    "chinese": "业务操作的固定编号",
    "summary": "给“这一次要做的业务操作”一个固定编号，重试时也不换。",
    "explanation": "例如只想补记一笔午饭，第一次请求超时后仍用原编号查询或重试，执行端才能知道不是第二笔午饭。编号由执行控制程序保存，用于防重复与核对结果。它是教材约定，不等同于任意模型 API 中同名 call_id 的含义。",
    "example": "同一笔补记账目始终使用 C1，网络重试不能改为 C2。",
    "pitfall": "换一个 CallID 重试可能把同一笔业务当作两笔新写入。",
    "related": [
      "AttemptID",
      "idempotency",
      "receipt"
    ],
    "source": "https://docs.stripe.com/api/idempotent_requests"
  },
  {
    "term": "receipt",
    "aliases": [
      "Receipt"
    ],
    "chinese": "执行结果记录",
    "summary": "由真正执行操作的一方提供的结果记录，用来核对到底做成了什么。",
    "explanation": "例如执行端记录 C1 已生成账目 E7。控制程序检查记录对应的是原操作、来源可信，再保存下来，决定完成、失败还是继续核对。它的字段和检查规则由应用约定；模型的一句“已完成”、任意成功文本或客户端超时都不能替代这份记录。",
    "example": "执行端返回 CallID C1 已生成账目 E7，系统校验并持久化该回执。",
    "pitfall": "模型说“已完成”或客户端超时都不能替代执行端事实。",
    "related": [
      "CallID",
      "Unknown",
      "Harness"
    ],
    "source": "https://docs.stripe.com/api/idempotent_requests"
  },
  {
    "term": "Unknown",
    "aliases": [
      "unknown"
    ],
    "chinese": "结果未知状态",
    "summary": "请求发出去了，却还不知道服务器到底有没有做成。",
    "explanation": "例如写账后连接断开，可能没写，也可能已经写好但响应丢了。系统保留原 CallID，查执行记录或核对账目，得到可靠结果后再决定结束状态和是否重试。此时不能直接算失败，更不能换个编号再写一次。",
    "example": "转账响应丢失，先查原 CallID 的执行记录，而不是换编号再转一次。",
    "pitfall": "Unknown 不是失败，更不等于“什么都没发生”。",
    "related": [
      "receipt",
      "CallID",
      "idempotency"
    ],
    "source": "https://docs.stripe.com/error-low-level"
  },
  {
    "term": "fence",
    "aliases": [
      "Fence",
      "fencing token"
    ],
    "chinese": "阻止旧工作者写入的版本号",
    "summary": "让存储端拒绝已经失去任务处理权的旧工作者继续写入。",
    "explanation": "每次交给新的工作者时，发一个比以前更大的版本号。写入端核对版本，拒绝旧版本。例如 A 拿到 8 后暂停，B 接管拿到 9，A 恢复后拿 8 写入就应被拒绝。Fence 是教材自定义字段；只发编号却不在写入端检查没有作用。",
    "example": "工作者 A 持版本 8 暂停后，B 获得版本 9；A 恢复后的版本 8 写入应被拒绝。",
    "pitfall": "租约到期不会自动杀死旧进程，必须在资源端落实版本检查。",
    "related": [
      "lease",
      "transaction"
    ],
    "source": "https://etcd.io/docs/v3.5/learning/api/"
  },
  {
    "term": "lease",
    "aliases": [
      "Lease"
    ],
    "chinese": "有期限的任务处理权",
    "summary": "规定某个工作者可以暂时处理任务，到了时间还没续约就允许别人接手。",
    "explanation": "例如领取十秒处理权，工作时不断续约；失联到期后，别的工作者可以竞争接管。旧进程可能只是暂停，之后还会醒来，因此写入时常需配合 fence 版本检查。有效期内不代表任务已经完成，到期也不会撤销已经发生的写入。",
    "example": "工作者领取十秒任务租约，持续续约；失联到期后允许其他工作者接管。",
    "pitfall": "租约尚未过期不代表业务已完成，租约过期也不撤销已发生的写入。",
    "related": [
      "fence",
      "checkpoint"
    ],
    "source": "https://etcd.io/docs/v3.5/learning/api/"
  },
  {
    "term": "checkpoint",
    "aliases": [
      "Checkpoint"
    ],
    "chinese": "供恢复使用的进度存档",
    "summary": "把已经做到哪一步及必要结果存下来，方便中断后继续。",
    "explanation": "例如查账结束后保存结果和步骤状态，重启时从批准步骤继续，不依赖已经丢失的内存。若某步向外部写过数据，还必须核对执行记录并防止重复，否则从存档继续也可能再写一遍。只存聊天记录通常不够安全恢复。",
    "example": "完成查账后保存输出与步骤状态，进程重启时继续审批阶段。",
    "pitfall": "保存聊天记录不必然构成可安全恢复的检查点。",
    "related": [
      "Run",
      "Step",
      "receipt"
    ],
    "source": "https://docs.langchain.com/oss/python/langgraph/persistence"
  },
  {
    "term": "backpressure",
    "aliases": [
      "Backpressure"
    ],
    "chinese": "处理不过来时让上游慢下来",
    "summary": "后面处理不过来时，让前面慢一点、等一等或明确拒绝新任务。",
    "explanation": "例如队列只能放一百条，装满后不能继续无限堆积。程序要选择等待、拒绝或按规则丢弃；有容量上限的 channel 满了会阻塞发送，但还要支持取消。无限加缓存没有提高处理速度，最终可能耗尽内存。",
    "example": "日志队列容量为 100，满时暂停生产或明确拒绝低优先级事件。",
    "pitfall": "增加无界缓存不会消除处理速度差，只会把故障推迟成内存耗尽。",
    "related": [
      "channel",
      "Context",
      "SSE"
    ],
    "source": "https://nodejs.org/en/learn/modules/backpressuring-in-streams"
  },
  {
    "term": "SSE",
    "aliases": [
      "Server-Sent Events"
    ],
    "chinese": "服务器持续推送事件",
    "summary": "让服务器在同一个 HTTP 响应中，陆续发来进度等文本消息。",
    "explanation": "它使用 text/event-stream，每条事件用空行分隔，可以带 data、event 和 id。浏览器 EventSource 能断线重连，但程序仍要编号、记住读到哪里并处理重复事件。这是服务器发给客户端的单向消息，不保证每条只处理一次。",
    "example": "event: progress\nid: 12\ndata: 已完成查账\n\n",
    "pitfall": "SSE 是服务端到客户端的单向流；断线重连不自动保证事件恰好处理一次。",
    "related": [
      "HTTP",
      "backpressure",
      "checkpoint"
    ],
    "source": "https://html.spec.whatwg.org/multipage/server-sent-events.html"
  },
  {
    "term": "package",
    "aliases": [],
    "chinese": "包",
    "summary": "把相关 Go 文件放在一起，按包名使用其中公开的功能。",
    "explanation": "同一目录里的普通 Go 源文件通常声明同一个 package。别的包先 import，再访问首字母大写的导出名称。包名、所在目录和 module 路径有关，但不能把这三个名称当成同一件事。",
    "example": "package ledger\n\ntype Entry struct { Amount int64 }",
    "pitfall": "包名、目录路径与 module 路径相关，但不是同一个概念。",
    "related": [
      "module",
      "import",
      "internal"
    ],
    "source": "https://go.dev/ref/spec#Packages"
  },
  {
    "term": "module",
    "aliases": [],
    "chinese": "模块",
    "summary": "用一份 go.mod 管理一组 Go 包以及它们依赖的版本。",
    "explanation": "模块路径是内部包导入路径的开头；go.mod 还记录 Go 版本要求和依赖。一个模块通常包含多个包，不需要每个目录都建 go.mod。模块既不是某个结构体，也不等于一个包。",
    "example": "module example.com/ledger",
    "pitfall": "module 不是某个 struct，也不等于单个 package。",
    "related": [
      "package",
      "import"
    ],
    "source": "https://go.dev/ref/mod"
  },
  {
    "term": "import",
    "aliases": [],
    "chinese": "导入声明",
    "summary": "在当前文件里声明要使用哪个其他包。",
    "explanation": "声明里写包的导入路径，后续通常通过包名访问它的导出成员。包不能互相绕成循环依赖；普通导入如果没有使用，编译器也会报错。导入不会把对方所有名称直接变成当前文件的名称。",
    "example": "import \"context\"\n// 使用 context.Background()",
    "pitfall": "导入包不会把该包所有名称直接塞进当前命名空间。",
    "related": [
      "package",
      "module"
    ],
    "source": "https://go.dev/ref/spec#Import_declarations"
  },
  {
    "term": "internal",
    "aliases": [],
    "chinese": "内部包目录约束",
    "summary": "限制某些包只供指定目录范围内的代码使用。",
    "explanation": "路径中出现 internal 时，只有它上一级目录树中的代码才能导入其中的包。这个限制由 Go 工具检查，要看真实目录范围，不能只看是否声称属于同一模块。它不是字段访问修饰符，也不会把包里大写字段自动变成私有字段。",
    "example": "example.com/ledger/internal/store 供 ledger 允许目录树内代码使用。",
    "pitfall": "internal 不是普通访问修饰符，也不自动隐藏包中的导出字段。",
    "related": [
      "package",
      "module"
    ],
    "source": "https://go.dev/doc/go1.4#internalpackages"
  },
  {
    "term": "main",
    "aliases": [],
    "chinese": "程序入口",
    "summary": "包初始化完成后，Go 可执行程序从这个函数开始运行。",
    "explanation": "它放在 main 包中，没有参数，也没有返回值，常负责准备配置并启动服务。Go 先初始化依赖包和当前包，再调用 main。main 返回时整个程序退出，不会自动等后台 goroutine 做完。",
    "example": "package main\nfunc main() { println(\"hello\") }",
    "pitfall": "main 退出不会自动等待你启动的 goroutine。",
    "related": [
      "init",
      "goroutine",
      "composition root"
    ],
    "source": "https://go.dev/ref/spec#Program_execution"
  },
  {
    "term": "pointer",
    "aliases": [
      "Pointer"
    ],
    "chinese": "指针",
    "summary": "保存变量的位置，让另一段代码能找到并修改同一个值。",
    "explanation": "& 取得变量地址，* 读取或修改这个地址上的值。例如把 n 的地址存进 p，给 *p 赋值也会改变 n。使用前要确认指针有效，不能解引用 nil；Go 普通指针也不支持任意地址加减。共享指针不自动安全，也不一定更快。",
    "example": "n := 7\np := &n\n*p = 8",
    "pitfall": "传指针并不自动保证并发安全，也不表示一定比传值更快。",
    "related": [
      "nil",
      "struct",
      "method"
    ],
    "source": "https://go.dev/ref/spec#Pointer_types"
  },
  {
    "term": "slice",
    "aliases": [
      "Slice"
    ],
    "chinese": "切片",
    "summary": "用一份可变长度的列表保存元素，但它可能与别的列表共用存储。",
    "explanation": "切片记录底层数组的位置、长度和容量。赋给另一个变量时，通常只复制这份记录，不复制全部元素。append 返回更新后的切片，容量不足时会换新数组，所以要接住返回值。需要独立修改时，另建存储并复制元素。",
    "example": "xs := []int{1, 2}\nxs = append(xs, 3)",
    "pitfall": "把切片赋给新变量通常不会复制所有元素。",
    "related": [
      "nil",
      "map"
    ],
    "source": "https://go.dev/ref/spec#Slice_types"
  },
  {
    "term": "map",
    "aliases": [
      "Map"
    ],
    "chinese": "映射",
    "summary": "给每个值配一个键，方便按名称或编号查找。",
    "explanation": "例如用姓名查分数。找不到时返回该类型的零值，所以要同时读取第二个返回值，判断键是否存在。nil map 可以读，写入前需用 make 或字面量初始化。遍历顺序不固定，共享的并发读写必须同步。",
    "example": "v, ok := amounts[\"lunch\"]",
    "pitfall": "nil map 可读但不能直接写；用 make 初始化后才能添加键。",
    "related": [
      "nil",
      "race"
    ],
    "source": "https://go.dev/ref/spec#Map_types"
  },
  {
    "term": "method",
    "aliases": [
      "receiver"
    ],
    "chinese": "方法",
    "summary": "给某个类型定义它能执行的操作。",
    "explanation": "函数名前的接收者说明操作哪个值，例如账单的 SetAmount 方法修改该账单的金额。值接收者和指针接收者的方法集合不同，会影响 T 或 *T 是否满足接口。能在某个变量上调用指针方法，不代表值类型本身满足该接口。",
    "example": "func (e *Entry) SetAmount(n int64) { e.Amount = n }",
    "pitfall": "能在某个变量上调用指针方法，不代表该值类型本身满足相同接口。",
    "related": [
      "interface",
      "struct",
      "pointer"
    ],
    "source": "https://go.dev/ref/spec#Method_declarations"
  },
  {
    "term": "SQL",
    "aliases": [],
    "chinese": "结构化查询语言",
    "summary": "向数据库说明要查哪些记录，或者怎样新增、修改和删除数据。",
    "explanation": "Go 通常通过 database/sql 和驱动发送 SQL。把用户输入作为参数传入，不直接拼进语句，避免它变成 SQL 指令。不同数据库的占位符、事务细节和可用功能不同，要按所用驱动检查。",
    "example": "db.QueryRowContext(ctx, \"SELECT amount FROM entries WHERE id = ?\", id) // 占位符依驱动而定",
    "pitfall": "不要把用户输入直接拼接到 SQL 字符串中。",
    "related": [
      "SQLRepository",
      "transaction"
    ],
    "source": "https://go.dev/doc/database/sql-injection"
  },
  {
    "term": "schema",
    "aliases": [
      "Schema",
      "JSON Schema"
    ],
    "chinese": "数据字段与填写规则",
    "summary": "写清一份数据允许有哪些字段、什么类型、哪些必填。",
    "explanation": "JSON Schema 可以规定金额为正整数、禁止多余字段；数据库 schema 则描述表等结构。工具参数通过这类检查，只说明格式与规定范围符合要求，余额是否足够、用户是否有权限仍要运行时判断。",
    "example": "工具要求 amount 为正整数，并禁止未声明的字段。",
    "pitfall": "schema 校验通过不代表请求安全或有权执行。",
    "related": [
      "JSON",
      "DTO",
      "Tool Calling"
    ],
    "source": "https://json-schema.org/understanding-json-schema"
  },
  {
    "term": "middleware",
    "aliases": [
      "Middleware"
    ],
    "chinese": "中间件",
    "summary": "把多个请求都要做的检查，放在业务处理前后统一执行。",
    "explanation": "例如先验证登录令牌，再执行请求处理，最后记录耗时。不同框架有不同的继续和中止方法；认证失败时写一个 401 响应，不一定就阻止后续业务运行，还必须按框架规则结束处理。",
    "example": "认证中间件读取令牌，失败时返回 401 并结束请求链。",
    "pitfall": "写入一个错误响应不一定自动停止后续处理，需按框架规则中止。",
    "related": [
      "Handler",
      "Gin Context"
    ],
    "source": "https://gin-gonic.com/en/docs/examples/using-middleware/"
  },
  {
    "term": "deadline",
    "aliases": [
      "timeout",
      "Deadline"
    ],
    "chinese": "截止时间",
    "summary": "给等待设置一个明确的最晚时刻，避免一直等下去。",
    "explanation": "Context 到达这个时刻会发出取消通知；子操作通常继承更早的截止时间，并主动响应。timeout 说的是等多久，deadline 说的是等到几点。超时返回不证明远端没写入，也不会自动回滚已完成的操作。",
    "example": "ctx, cancel := context.WithDeadline(parent, time.Now().Add(time.Second))\ndefer cancel()",
    "pitfall": "timeout 是持续时长，deadline 是具体时刻；二者都不自动回滚外部操作。",
    "related": [
      "Context",
      "Unknown"
    ],
    "source": "https://pkg.go.dev/context#WithDeadline"
  },
  {
    "term": "race",
    "aliases": [
      "data race",
      "Race"
    ],
    "chinese": "数据竞争",
    "summary": "多个 goroutine 没有正确同步就读写同一数据，其中至少一个在写。",
    "explanation": "例如两个任务同时给计数器加一，读和写交错后可能丢掉一次增加。结果不能靠“跑几次都对了”来保证。Go 的 -race 能发现本次实际执行路径中的一些竞争，但不能证明没有执行到的路径也安全。",
    "example": "两个 goroutine 同时执行 count++，需要互斥锁或合适的原子操作。",
    "pitfall": "goroutine 很轻量不代表共享变量可以直接并发写。",
    "related": [
      "goroutine",
      "mutex"
    ],
    "source": "https://go.dev/doc/articles/race_detector"
  },
  {
    "term": "mutex",
    "aliases": [
      "Mutex",
      "sync.Mutex"
    ],
    "chinese": "互斥锁",
    "summary": "让需要访问同一份共享数据的任务轮流执行相关操作。",
    "explanation": "Lock 到 Unlock 之间，同一把锁只允许一个持有者进入。所有相关读写都要遵守同一规则，只锁写入未必足够。锁一旦使用就不要复制，也尽量别在持锁时做无关的耗时操作，让其他任务白等。",
    "example": "mu.Lock()\ncount++\nmu.Unlock()",
    "pitfall": "使用锁的前提是所有相关访问遵守同一保护约定，只锁写入不一定足够。",
    "related": [
      "race",
      "goroutine"
    ],
    "source": "https://pkg.go.dev/sync#Mutex"
  },
  {
    "term": "token",
    "aliases": [
      "Token"
    ],
    "chinese": "模型分词单元",
    "summary": "模型计算输入和输出长度时使用的文本小片段。",
    "explanation": "分词器先把文本切成片段并转成编号，片段可能是字、词的一部分或标点。同一句话有多少 token，要看具体分词器，不能固定按中文字数或英文单词数换算。这里也不是指登录用的令牌。",
    "example": "一段中文不是固定“一个字等于一个 token”，需要按所用模型的分词器计算。",
    "pitfall": "token 在模型语境中不是登录令牌，也不能直接按英文单词数替代。",
    "related": [
      "LLM",
      "prompt"
    ],
    "source": "https://docs.anthropic.com/en/docs/build-with-claude/token-counting"
  },
  {
    "term": "prompt",
    "aliases": [
      "Prompt"
    ],
    "chinese": "模型提示",
    "summary": "交给模型的任务说明，以及完成任务需要的资料。",
    "explanation": "可以写目标、限制、例子和引用内容，例如只提取账单候选，不执行写入。程序要分清可信指令和外部资料，不能让文档里的命令获得系统权限。提示中写“绝不出错”也代替不了校验、授权和测试。",
    "example": "说明“将用户文本提取为账目候选，不执行写入”，并给出输出字段。",
    "pitfall": "在提示里写“绝不出错”不能替代校验、授权和测试。",
    "related": [
      "LLM",
      "Agent"
    ],
    "source": "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview"
  },
  {
    "term": "retry",
    "aliases": [
      "Retry"
    ],
    "chinese": "重试",
    "summary": "一次没成功后，按事先规定的条件再做一次。",
    "explanation": "先判断错误是否值得重试，再限制次数、间隔和总时长。读取暂时失败可以稍后再试；写账超时要先按原编号查结果，确认防重复规则。无间隔无限重试会加重拥堵，换新编号重试可能多记一笔。",
    "example": "读取临时失败后延迟再试；写账超时先按原 CallID 查询结果。",
    "pitfall": "无上限立即重试会加重拥塞，换新幂等键重试会改变业务身份。",
    "related": [
      "AttemptID",
      "idempotency",
      "Unknown"
    ],
    "source": "https://docs.aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
  },
  {
    "term": "graceful shutdown",
    "aliases": [
      "Graceful Shutdown"
    ],
    "chinese": "优雅停机",
    "summary": "准备退出时，先不接新工作，再限时等已有工作完成。",
    "explanation": "HTTP 服务可先停止报告就绪，再调用 Shutdown 等活动请求结束。后台任务还要另外取消并等待；到期仍没完成的工作需保存状态，方便恢复。停止监听不代表 goroutine 都退出，也不代表外部写入结果都已查清。",
    "example": "收到终止信号后停止派发新步骤，等待已有请求结束并保存执行进度。",
    "pitfall": "关闭监听端口不代表后台 goroutine 已结束，也不代表所有外部写入已有结果。",
    "related": [
      "readiness",
      "Context",
      "checkpoint"
    ],
    "source": "https://pkg.go.dev/net/http#Server.Shutdown"
  },
  {
    "term": "connection pool",
    "aliases": [
      "pool"
    ],
    "chinese": "连接池",
    "summary": "保留一组数据库连接反复使用，避免每次请求都重新建立连接。",
    "explanation": "sql.DB 通常管理可并发使用的一组连接，并不是一条永久独占连接。程序应复用它，根据负载设置上限；查询返回的 Rows 仍要及时关闭，释放占用。每个请求都新建 sql.DB 会失去复用好处并增加开销。",
    "example": "db.SetMaxOpenConns(20)\ndb.SetMaxIdleConns(5)",
    "pitfall": "每个请求都创建一个新 sql.DB 会失去连接复用并增加资源开销。",
    "related": [
      "SQL",
      "SQLRepository"
    ],
    "source": "https://pkg.go.dev/database/sql#DB"
  },
  {
    "term": "embedding",
    "aliases": [
      "Embedding",
      "embeddings"
    ],
    "chinese": "向量表示",
    "summary": "把文本变成一串数字，方便找出内容相近的资料。",
    "explanation": "检索时把问题和文档都转换成向量，再比较相似程度，选出候选片段。数字相近只表示模型认为内容接近，不证明事实正确，也不说明用户有权读取。仍需检查访问权限、保留出处并判断资料是否可信。",
    "example": "把账务制度片段建立向量索引，提问时找出相关规定。",
    "pitfall": "相似文本可能包含错误信息；向量检索仍要保留来源和访问控制。",
    "related": [
      "LLM",
      "RAG"
    ],
    "source": "https://docs.cohere.com/docs/embeddings"
  },
  {
    "term": "RAG",
    "aliases": [],
    "chinese": "检索增强生成",
    "summary": "先找相关资料，再把资料和问题一起交给模型回答。",
    "explanation": "例如先查报销制度，再回答某项费用能否报销，并展示来源。这能提供当前任务需要的信息，但检索可能漏找，模型也可能误读。它不保证答案正确，也不会自动阻止资料中夹带的恶意指令。",
    "example": "先检索报销制度，再回答某项费用是否符合规则并展示出处。",
    "pitfall": "RAG 不保证答案正确，也不会自动阻止文档中的提示注入。",
    "related": [
      "embedding",
      "LLM",
      "prompt"
    ],
    "source": "https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html"
  }
];
