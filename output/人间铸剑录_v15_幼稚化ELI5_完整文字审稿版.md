# 人间铸剑录：Go 后端与 Harness AI 工程

## v15 幼稚化 + ELI5 完整文字审稿版

> 这不是 PDF，也不是最终排版。它是一份完整的文字底稿：先让小白看懂，再让工程师核对。

## 阅读约定

- 群聊负责把事故讲活。
- 小白一句话和类比负责建立画面。
- 技术真相、代码与验收负责防止类比讲歪。
- 图解暂不生成，只保留位置；文字通过审核后再进入 PDF。

## 目录

- 第 01 章：路边茶棚：读懂一段 Go（补充 2 节）
- 第 02 章：铸出账单剑模：类型、Struct 与 Tag（补充 2 节）
- 第 03 章：剑匣、窗口与名册：Array、Slice、Map 与指针（补充 1 节）
- 第 04 章：谁会这一剑：Method、Interface 与组合（补充 2 节）
- 第 05 章：山门与院落：Module、Package 与依赖方向（补充 2 节）
- 第 06 章：错误要留因果：Error 与边界测试（补充 3 节）
- 第 07 章：众剑齐出：Goroutine、GMP 与 Race（补充 2 节）
- 第 08 章：飞剑须能收：Channel、Select 与 Context（补充 1 节）
- 第 09 章：山门来客：HTTP、Gin 与契约（补充 6 节）
- 第 10 章：城中三层：Handler、Service、Repository（补充 1 节）
- 第 11 章：真账本：SQL、事务与幂等（补充 4 节）
- 第 12 章：两座库房：Redis 与缓存一致性（补充 0 节）
- 第 13 章：山洪过窄桥：并发闸门与过载拒绝（补充 2 节）
- 第 14 章：流光传书：SSE、断线与跨层取消（补充 1 节）
- 第 15 章：夜行留灯：Log、Metric 与 Trace（补充 2 节）
- 第 16 章：下山之前：配置、Docker、迁移与回滚（补充 5 节）
- 第 17 章：会说不等于会做：LLM、Workflow 与 Tool Calling（补充 0 节）
- 第 18 章：大脑、招式、驿道与剑匣（补充 1 节）
- 第 19 章：一次执行的一生：Run、Step 与恢复（补充 2 节）
- 第 20 章：行囊不能装整座山：Context Engineering（补充 0 节）
- 第 21 章：剑有护手：权限、沙箱与人在回路（补充 2 节）
- 第 22 章：失败要有证词：预算、Trace、重放与 Eval（补充 4 节）
- 第 23 章：AI 写代码也要过剑阵：Coding Harness（补充 1 节）
- 第 24 章：最后一炉：可控 Ledger Agent（补充 1 节）

---

# 第一章  路边茶棚：读懂一段 Go

**本章要解决：** 先跑通一个结账程序：看懂函数收到什么、返回什么，以及钱不够时怎样报错。

## 1. 闯祸现场

山雨刚停，陈平安、宁姚和阿良钻进路边茶棚。一碗面七文，陈平安递出十文，掌柜收钱、端面，转身就走。

阿良没有动筷子，只摊开空手。桌下那条戴斗笠的黄狗也抬起头，等着看那三文找零究竟去了哪里。

## 2. 群聊

> **阿良：** 掌柜，我那三文进了你袖口，是打算闭关？
>
> **李宝瓶：** 面已端来，可结账函数是不是还少一步？
>
> **宁姚：** 别演。你的结账函数只收钱，没返回找零。
>
> **陈平安：** 明白：传价格和付款，成功就返回找零。
>
> **周米粒：** 钱不够就报错，不能拿半碗面糊弄肚子。
>
> **阿良：** 记住，函数可以清白，账不能只进不出。

*掌柜补回三文。宁姚收束：成功给结果，失败返回错误，别让调用方猜。*

## 3. 小白一句话

函数要说清收什么、成功交回什么、失败怎么讲。

## 4. 像什么

像茶棚结账：先说清掌柜收到了价格和付款，再说成功应找回多少钱；若钱不够，也要明确告诉来客，而不是让他猜。

## 5. 先拆黑话

- **error**：事情没办成时一起带回来的原因条
- **Run**：从开始到结束的一整趟任务

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- main 是程序入口；先运行它，看到真实结果，再往函数里面走。
- 读函数先看括号两边：左边是它收到的数字，右边是它交回的结果。
- 钱不够时立刻返回 error；付款够时才计算找零。

## 7. 看代码别慌

- 先看 main 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 main 的出口：成功交回什么，失败留下什么证据。

```go
package main

import (
    "errors"
    "fmt"
)

var (
    ErrInvalidPrice = errors.New("invalid price")
    ErrInsufficientPayment = errors.New("insufficient payment")
)

func main() {
    change, err := settle(7, 10)
    fmt.Println(change, err)
}

func settle(price, paid int64) (int64, error) {
    if price <= 0 {
        return 0, ErrInvalidPrice
    }
    if paid < price {
        return 0, ErrInsufficientPayment
    }
    return paid - price, nil
}
```

## 8. 最容易怎么翻车

- 还没运行就逐字抠语法
- 只看返回的数字，忘了同时检查 error
- 把付款不足当成正常找零零元

## 9. 动手与验收

**动手：** 把代码存成 main.go，运行 go run main.go；再把付款 10 改成 7 和 5，各运行一次。

**过关：** 三次分别看到 3 <nil>、0 <nil>、0 insufficient payment，并能说清为什么。

## 10. 后续图解位置

- `go-function-anatomy`（文字通过审核后再排图）
- `book-learning-map`（文字通过审核后再排图）

## 11. 自己问自己

**问：程序从哪个函数开始运行？**

答：从 main 函数开始。main 调用 settle，再把结果打印出来。

**问：价格 7、付款 10 时，settle 返回什么？**

答：返回找零 3 和 nil；nil 表示没有发生错误。

**问：付款只有 5 时，为什么不能继续计算找零？**

答：因为会算出负数，掩盖钱不够这个事实；应该立刻返回 ErrInsufficientPayment。

## 12. 下一站

程序已经能跑，也能把找零或错误讲清；下一章再把同样的清楚带进请求和 JSON。

## 补充 1.1　先把分支走明白

茶棚掌柜把付款与价格的差额写成三张纸：小于零、刚好为零、大于零。李宝瓶用三支不同颜色的笔标出分支，陈平安却把 default 圈得最大。

付款不足被塞进 default 后，错误沿着正常路径继续执行；跨分支的 result 又被 := 重新声明，外层变量仍保持零值。

### 群聊

> **阿良：** 条件判断写得像迷宫，神仙下凡也看不出你走的哪条路。
>
> **阮秀：** 火候不对就得撤火，硬撑着只能烧焦一锅汤。
>
> **李宝瓶：** 提前 return 卫语句，别把核心逻辑一层层套在深山里！
>
> **文圣：** 老秀才念书最讲章法，if 拦非法，switch 明列正数！
>
> **宁姚：** 卫语句先验边界，主流程只留合法计算。
>
> **阿良：** 代码干干净净，看着跟阿良叔叔的剑术一样俊俏。

*default 卸下杂役差事。周米粒记住：分支先命名，变量别玩分身。*

### 小白一句话

先让业务状态决定分支，再认识 if、switch、for 和声明的职责。

### 像什么

像过马路：红灯、黄灯、绿灯要先分清，不能把红灯塞进‘其他情况’；if 先拦危险，switch 再把明确状态送到各自路口。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 用 if 处理守卫条件，先返回错误，缩短正常路径。
- switch 可省略表达式，适合互斥且有命名意义的条件。
- for 同时承担计数、条件循环和无限循环三种形态。
- 短声明只用于局部新变量；跨分支结果用 var 明确作用域。

### 看代码

- 先看 classify 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 最后核对 classify 的出口：成功交回什么，失败留下什么证据。

```go
type BillID string

func classify(n int64) string {
    switch {
    case n < 0:
        return "invalid"
    case n == 0:
        return "zero"
    default:
        return "positive"
    }
}
```

**动手：** 给 classify 增加一个上限分支，并故意制造一次 := 遮蔽后修正。

**过关：** 测试覆盖负数、零、正常值和上限外值；正常路径无变量遮蔽。

**接着去哪：** 分支走明白了，还得让 go test 真正守住零值和非法值。

## 补充 1.2　测试要住进 _test.go

桌上摆着七文面钱、三文找零和一张空白的 settle_test.go，文件名后半截被荧光笔涂亮。李宝瓶把四种付款场景写成四张小票。

陈平安删掉找零后，正文示例仍安静得像没事发生；因为它根本不在 _test.go 里，go test ./... 没发现那三文又失踪了。

### 群聊

> **周米粒：** 小米粒拿着账单对暗号，对不上就敲小竹杖！
>
> **阮秀：** 用例如果只有一种味道，怎么试得出百家滋味？
>
> **阿良：** 测试表里多塞几个极值，越刁钻越显真功夫。
>
> **李宝瓶：** 表格驱动测试，把输入输出摆在明面上！
>
> **老瞎子：** 钱不够与非法值分开验，用 errors.Is，别当糊涂虫！
>
> **宁姚：** 表驱动测试必须覆盖哨兵错误与零值分支。

*掌柜没跑成：三文一少，表驱动测试立刻举起红牌。*

### 小白一句话

先写一个能失败的普通测试，重复出现后再重构为表驱动。

### 像什么

像给玩具做耐摔测试：先写清怎么摔、摔几次、什么算坏，再真的摔。只说‘我昨天玩过，没坏’不算测试。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 生产文件与测试文件同包放置，文件名必须以 _test.go 结尾。
- 表驱动测试把输入、期望和用例名放在同一处。
- t.Run 让失败定位到具体场景，不只停在测试函数名。
- 错误路径要断言错误类别或条件，不能只看返回值。

### 看代码

- 先看 TestSettle 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 TestSettle 的出口：成功交回什么，失败留下什么证据。

```go
func TestSettle(t *testing.T) {
    tests := []struct {
        name        string
        price, paid int64
        wantChange  int64
        wantErr     error
    }{
        {"exact", 7, 7, 0, nil},
        {"change", 7, 10, 3, nil},
        {"not enough", 7, 5, 0, ErrInsufficientPayment},
        {"invalid price", 0, 10, 0, ErrInvalidPrice},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := settle(tt.price, tt.paid)
            if !errors.Is(err, tt.wantErr) {
                t.Fatalf("err=%v, want %v", err, tt.wantErr)
            }
            if got != tt.wantChange {
                t.Fatalf("change=%d, want %d", got, tt.wantChange)
            }
        })
    }
}
```

**动手：** 新建 settle_test.go，用 TestSettle 覆盖刚好付款、三文找零、付款不足和非法价格。

**过关：** go test ./... 能发现四个场景；成功路径核对找零，失败路径分别识别 ErrInsufficientPayment 与 ErrInvalidPrice。

**接着去哪：** 结账函数的输入和输出守住了；下一章看 CreateBillRequest 交给 JSON 时，字段名字为何会变。

---

# 第二章  铸出账单剑模：类型、Struct 与 Tag

**本章要解决：** 理解基本类型、零值、struct、字段可见性、JSON tag，以及 DTO、领域模型和持久化模型的边界。

## 1. 闯祸现场

午后的会议桌上放着一张 1500 分的奶茶小票，旁边是 CreateBillRequest 的 JSON 和一支红色记号笔。李宝瓶在 msg_content 下画了两道线。

陈平安明明给 Message 填了“周末吃饭”，输出里却没有这个字段；他把反引号里的 Tag 当成了注释，小写 message 也让编码器根本看不见。

## 2. 群聊

> **李宝瓶：** 小师叔，零值既然有效，能不能直接当默认账本？
>
> **周米粒：** 右护法摇脑袋！零蛋虽然圆溜溜，可不等于没花钱！
>
> **宁姚：** 未初始化的零值进核心计算，出事连账目对不上。
>
> **阿良：** 阿良叔叔年轻时也以为零就是什么都没有，结果挨了顿毒打。
>
> **文圣：** 老头子教你们读书，身份取认证，零值也得做领域校验！
>
> **周米粒：** 小米粒记住啦，老爷爷说得对，零值也要严加盘查！

*阿良的冒领方案被当场驳回，小票上只留下导出字段、Tag 与认证身份三道圈。*

## 3. 小白一句话

Struct 是剑模，Tag 是模具刻字，规则决定能否出炉。

## 4. 像什么

像做冰格。Struct 决定格子长什么样，Tag 决定快递员看到的格子名字；模具刻错一个字，冰块没坏，快递单却会送错门。

## 5. 先拆黑话

- **struct**：把一件东西要填的格子做成固定模具

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 导出标识符以大写开头；encoding/json 默认只处理可导出字段。
- tag 是元数据，不是运行时魔法；`json`、`binding`、`db` 各服务于不同边界。
- 零值让对象可被创建，但零值未必业务合法，金额、分类和租户仍需领域校验。
- 请求 DTO 不应直接等同于数据库模型，避免客户端控制内部 ID、user_id 和审计字段。

## 7. 看代码别慌

- 先看 Validate 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Validate 的出口：成功交回什么，失败留下什么证据。

```go
type CreateBillRequest struct {
    AmountCents *int64 `json:"amount_cents"`
    Category    string `json:"category"`
}

func (r CreateBillRequest) Validate() error {
    if r.AmountCents == nil || *r.AmountCents <= 0 {
        return ErrInvalidAmount
    }
    if r.Category == "" {
        return ErrCategoryRequired
    }
    return nil
}
```

## 8. 最容易怎么翻车

- 金额使用 float64
- 把数据库模型直接暴露给客户端
- 以为 binding 通过就代表业务合法

## 9. 动手与验收

**动手：** 把 CreateBillRequest 映射为 Bill，并测试字段缺失、金额非法和成功三种情况。

**过关：** 能说明 JSON 校验与领域校验分别归谁负责。

## 10. 后续图解位置

- `struct-json-pipeline`（文字通过审核后再排图）

## 11. 自己问自己

**问：为什么小写字段不会出现在 JSON？**

答：小写字段未导出，encoding/json 在包外看不见它。

**问：零值有什么好处和风险？**

答：零值便于直接创建对象，但 0 金额等零值可能不满足业务规则。

**问：为什么 user_id 不信任请求体？**

答：user_id 必须来自服务端认证结果，不能信任请求体自报。

## 12. 下一站

字段导出、未知字段和中文备注的边界都收紧后，一张账单终于能稳定进入程序；多笔账单随即带来容器的所有权问题。

## 补充 2.1　一个字不一定一个字节

午休前，白板上写着“周末吃饭”，旁边摆着两格透明尺和一个表情贴纸。陈平安说只要取前两个位置就够了。

note[:2] 切出的却是两段残缺字节，终端立刻显示乱码；他这才发现 string 和 len 数的是字节，不是眼睛看到的两个字。

### 群聊

> **崔东山：** 哎呀！这大长串汉字砍半截，怎么就蹦出一堆问号啦！
>
> **阿良：** byte 是骨头，rune 才是皮肉，按字节切肉必见血。
>
> **李宝瓶：** UTF-8 变长编码，汉字占三个 byte，岂能随意截断！
>
> **文圣：** 斯文扫地！底子是 byte，按字遍历必须 range rune！
>
> **宁姚：** 字符边界不容模糊，非 UTF-8 编码尽早拒绝。
>
> **周米粒：** 小米粒数豆子，一颗是一颗，半颗可不许吃！

*乱码退场，表情仍占好几格。周米粒记下：字节不是字，rune 也未必是一个字符。*

### 小白一句话

不另开一门字符课，只修复同一张账单的备注失败。

### 像什么

像数积木上的汉字：人眼看见一个字，盒子里可能占了好几个小格。按字节数盒子，和按字符数盒子，不是同一道题。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- string 是只读字节序列，可以含任意字节，不保证是合法 UTF-8。
- len(s) 返回字节数；utf8.RuneCountInString 返回 rune 数。
- range 遇到非法 UTF-8 时产生 RuneError，并按规则前进。
- 按用户可见字符截断还涉及字素簇，rune 也不等于视觉字符。

### 看代码

- 先看 inspect 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 inspect 的出口：成功交回什么，失败留下什么证据。

```go
func inspect(s string) (int, int, bool) {
    bytes := len(s)
    runes := utf8.RuneCountInString(s)
    valid := utf8.ValidString(s)
    return bytes, runes, valid
}
```

**动手：** 比较“Go”“中国”和一个非法 UTF-8 字节串的三项结果。

**过关：** 能解释字节数与 rune 数的差异，并在切片前验证边界或先转 []rune。

**接着去哪：** 备注不再乱码，但客户端拼错 amount_cents 时，默认 Decode 仍然沉默通过。

## 补充 2.2　JSON 解码要有边界

评审桌上放着两张 JSON 小票：一张把 amount_cents 拼错，另一张把金额写了两次。宁姚把解码结果贴到小票下方。

Decode 两次都没有按预期报错，未知字段被忽略，重复 key 的后值覆盖前值；尾部还藏着第二个 JSON，第一遍读取后没人继续检查。

### 群聊

> **阿良：** 金额写了两遍还通过，这小票比我脸皮都厚。
>
> **宁姚：** Decode 没报错，为什么还不能算合格？
>
> **李宝瓶：** 拒绝未知字段，再 Decode 一次，必须得到 io.EOF。
>
> **陈平安：** 缺失、null、零值用显式标记区分。
>
> **阮秀：** 正金额还要单独做业务校验，重复 key 直接拒绝。
>
> **宁姚：** 解码成功只代表读进来了，不代表契约成立。

*尾部第二张 JSON 被当场查获。周米粒总结：能读，不等于能用。*

### 小白一句话

字段能反序列化只是起点，对外请求还要形成严格边界。

### 像什么

像收快递单：字写得像不像只是第一关。多写陌生字段、同一栏写两遍、箱子后面又偷偷绑一个箱子，都应该在门口说清楚。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 对外输入拒绝未知字段、尾随 JSON，并在 token 层拒绝重复或仅大小写不同的 key。
- *int64 只能把缺失与 null 合并为 nil，再与零和负数一起按正金额契约拒绝。
- 若必须区分 missing、null、value 三态，使用带 Present/Null 标记并实现 UnmarshalJSON 的类型。
- 重复键策略须在网关、服务和签名规范化层一致，不能依赖 encoding/json 的后值覆盖。

### 看代码

- 先看 decodeBill 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 decodeBill 的出口：成功交回什么，失败留下什么证据。

```go
type CreateBillRequest struct {
    AmountCents *int64 `json:"amount_cents"`
}

func decodeBill(r io.Reader) (CreateBillRequest, error) {
    data, err := io.ReadAll(io.LimitReader(r, 1<<20+1))
    if err != nil {
        return CreateBillRequest{}, fmt.Errorf("read body: %w", err)
    }
    if len(data) > 1<<20 {
        return CreateBillRequest{}, ErrBodyTooLarge
    }
    if err := rejectDuplicateKeys(data); err != nil {
        return CreateBillRequest{}, err
    }
    dec := json.NewDecoder(bytes.NewReader(data))
    dec.DisallowUnknownFields()
    var v CreateBillRequest
    if err := dec.Decode(&v); err != nil { return v, err }
    if err := dec.Decode(&struct{}{}); err != io.EOF {
        return v, ErrTrailingJSON
    }
    if v.AmountCents == nil || *v.AmountCents <= 0 {
        return v, ErrInvalidAmount
    }
    return v, nil
}

func rejectDuplicateKeys(data []byte) error {
    dec := json.NewDecoder(bytes.NewReader(data))
    if err := scanJSONValue(dec); err != nil { return err }
    if _, err := dec.Token(); err != io.EOF { return ErrTrailingJSON }
    return nil
}

func scanJSONValue(dec *json.Decoder) error {
    tok, err := dec.Token()
    if err != nil { return err }
    d, ok := tok.(json.Delim)
    if !ok { return nil }
    switch d {
    case '{':
        seen := map[string]struct{}{}
        for dec.More() {
            keyToken, err := dec.Token()
            if err != nil { return err }
            key, ok := keyToken.(string)
            if !ok { return ErrInvalidJSON }
            folded := strings.ToLower(key)
            if _, exists := seen[folded]; exists {
                return ErrDuplicateKey
            }
            seen[folded] = struct{}{}
            if err := scanJSONValue(dec); err != nil { return err }
        }
    case '[':
        for dec.More() {
            if err := scanJSONValue(dec); err != nil { return err }
        }
    default:
        return ErrInvalidJSON
    }
    _, err = dec.Token()
    return err
}
```

**动手：** 测试缺失、null、零、负数、正数、未知字段、尾随 JSON、重复 amount_cents、大小写变体和嵌套重复 key。

**过关：** 仅正金额请求通过；缺失与 null 同样拒绝；未知、尾随及任意层重复或大小写碰撞 key 均失败。

**接着去哪：** 请求边界清楚了，接下来要决定账单列表返回 nil 还是空集合，以及谁能修改底层数据。

---

# 第三章  剑匣、窗口与名册：Array、Slice、Map 与指针

**本章要解决：** 先学会用 slice 装一列数据、用 map 按名字查数据，并分清复制一份和共享同一份。

## 1. 闯祸现场

窗边晾着一卷十米长的标签纸，顾璨只撕下一小段，线头却还连着整卷。桌上的账单列表旁又摆着一把写有 owner 的钥匙。

陈平安把一列名字 append 进 slice，却忘了接住返回值；转头又往没有 make 的 map 里写分数，程序当场翻桌。

## 2. 群聊

> **阮秀：** 火锅的底料要是没备齐，再多灵药倒进去也是白搭。
>
> **周米粒：** 切片长胖了要换大盘子，小米粒拿双手捧着！
>
> **阿良：** 底层数组扩容了，原来的指针可就不认账了，得接住。
>
> **老瞎子：** 老瞎子眼瞎心不瞎，append 不接回原切片，真当内存白送？
>
> **宁姚：** map 必须先 make，切片 append 必须显式接回。
>
> **李宝瓶：** 宝瓶记牢啦，扩容重分配，指针两重天！

*顾璨剪断线头。周米粒记下：复制 slice 要复制元素，不是只换个纸袋。*

## 3. 小白一句话

Array 是固定柜，Slice 是窗口，Map 是名册，指针是门牌地址。

## 4. 像什么

Array 像固定座位表，Slice 像你手里框住的一排座位，Map 像按名字查座位的名册，指针则是写着‘去三楼第二排’的小纸条。

## 5. 先拆黑话

- 本章没有必须先背的新黑话，先沿着事故和代码往下走。

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- slice 像一扇能看到底层数组的窗；复制 slice 不等于复制窗外的数据。
- append 可能继续使用原来的底层数组，也可能换一块更大的新数组，所以要接住返回值。
- map 写入前必须 make；读取时用第二个返回值判断键是否存在。
- 并发读写和锁留到第 7 章，本章只把单线程的数据容器用明白。

## 7. 看代码别慌

- 先看 main 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 main 的出口：成功交回什么，失败留下什么证据。

```go
package main

import "fmt"

func main() {
    names := []string{"陈平安", "宁姚"}
    names = append(names, "阿良")

    scores := make(map[string]int)
    scores["陈平安"] = 90
    score, ok := scores["陈平安"]

    fmt.Println(names)
    fmt.Println(score, ok)
}
```

## 8. 最容易怎么翻车

- 调用 append 后忘了接住返回的新 slice
- 向 nil map 写值导致 panic
- 读取 map 时只看零值，不检查键是否真的存在

## 9. 动手与验收

**动手：** 运行示例；给 names 再加一人，给 scores 再加一项，并查询一个不存在的名字。

**过关：** 能看到新增姓名；已存在的分数返回值和 true；不存在的名字返回零值和 false。

## 10. 后续图解位置

- `go-value-copy`（文字通过审核后再排图）
- `go-pointer-copy`（文字通过审核后再排图）
- `go-slice-copy`（文字通过审核后再排图）

## 11. 自己问自己

**问：为什么 append 的结果要重新赋给 names？**

答：因为 append 可能换一块新的底层数组，返回的 slice 才指向正确结果。

**问：map 为什么要先 make 再写？**

答：nil map 可以读但不能写；make 会创建可写的 map。

**问：读取不存在的键时，怎样区分它和真的存了一个零值？**

答：接住第二个返回值 ok；ok 为 false 表示键不存在。

## 12. 下一站

账单容器的所有权明确后，汇总逻辑不该依赖具体存储；下一章让 Service 只向 Repository 要它真正需要的能力。

## 补充 3.1　容器值也有契约

资料架上有一个标着 null 的空盒和一个标着 [] 的空盒，旁边是一份按 key 排序的账单目录。阮秀把内部列表的复印件压在最上面。

陈平安却把原 slice 直接交出去，调用方 append 后内部账本也多了一笔；普通 map 的输出顺序每次又不同，快照测试连续失败。

### 群聊

> **崔东山：** 先生！学生拿 map 当公共聚宝盆，一群协程上去抢！
>
> **阿良：** 两个醉汉抢一个酒葫芦，谁先伸手谁挨揍。
>
> **周米粒：** 哎呀呀，大盘子打翻啦，红红绿绿全撒地上啦！
>
> **老瞎子：** 并发抢内置 map，直接 fatal 给你看，老实加读写锁！
>
> **宁姚：** 并发读写必须互斥，读多写少选 RWMutex。
>
> **李宝瓶：** 宝瓶记牢，容器并发不设防，线上崩溃两行泪！

*两个空盒不再互换身份。周米粒记着：空也有契约，顺序也得算数。*

### 小白一句话

nil、顺序和共享底层存储，会共同改变容器 API 的真实含义。

### 像什么

像共享一盒彩笔：你以为只是把颜色表借给别人，对方添一支笔，原盒子也可能跟着变；借出前要说清是否共享、顺序是否重要。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- nil slice 可读、可 append；nil map 可读但不能写。
- map 遍历顺序未定义，测试和输出都不能依赖它。
- slice 复制只复制描述符，元素仍可能共享底层数组。
- API 应明确返回 nil 还是空集合，以及是否交付所有权。

### 看代码

- 先看 sortedKeys 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 sortedKeys 的出口：成功交回什么，失败留下什么证据。

```go
func sortedKeys(m map[string]int) []string {
    keys := make([]string, 0, len(m))
    for k := range m {
        keys = append(keys, k)
    }
    sort.Strings(keys)
    return keys
}
```

**动手：** 写一个返回副本的 Names 方法，并比较 nil 与空 slice 的 JSON 输出。

**过关：** 调用方修改返回值不会污染内部状态；排序输出可重复；nil 语义有测试。

**接着去哪：** 容器契约稳定了，Service 需要一个最小接口来读取和保存这些账单。

---

# 第四章  谁会这一剑：Method、Interface 与组合

**本章要解决：** 掌握 receiver、隐式接口满足、依赖倒置、组合和泛型的适用边界。

## 1. 闯祸现场

白板上贴着 MemoryBillRepo、SQLRepository 和 FakeRepository 三张卡片，旁边只留了 Get 与 Save 两个空位。阿良把一摞写满方法名的纸推到角落。

陈平安找不到 implements 声明，以为 MemoryBillRepo 不能交给 Service，于是准备给所有实现补一套庞大接口，测试也跟着被真实数据库绑住。

## 2. 群聊

> **阿良：** 小掌柜，别光抓着具体结构体不放，面向接口才是大宗师手笔。
>
> **崔东山：** 先生！学生把全天下法宝塞进 interface，怎么它就变成 nil 啦！
>
> **李宝瓶：** 接口只要声明了需要的方法，谁实现它，谁就能被传进来。
>
> **陈平安：** 别贪大，接口越小越锋利，两个方法足够定规矩。
>
> **宁姚：** 只收你要的规矩，别把内部底细一股脑全暴露给人看。
>
> **阮秀：** 规矩立小了，换实现时才不会砸了落魄山的招牌。

*巨型接口继续垫桌脚；小接口接上三个 Repo，桌面和测试都稳了。*

## 3. 小白一句话

接口按能力立约，不按身份封爵。

## 4. 像什么

班里不问你是谁家的孩子，只问你会不会扫地。会扫地就能加入 Cleaner 接口；这就是按能力组队，不按血统封官。

## 5. 先拆黑话

- **struct**：把一件东西要填的格子做成固定模具
- **Service**：真正执行业务规矩的账房
- **Repository**：专门和数据库打交道的库管

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 接口由使用方按最小能力定义，具体类型通过方法集隐式满足。
- 值 receiver 的方法属于 T 与 *T 的方法集；指针 receiver 的方法只属于 *T。
- 组合复用行为而非模拟继承；嵌入会提升方法，但不自动建立 is-a 关系。
- 泛型适合数据结构和算法复用，不应用于隐藏领域差异或制造抽象层。

## 7. 看代码别慌

- 先看 NewService 的输入和返回值：它接什么，最后必须交回什么。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 NewService 的出口：成功交回什么，失败留下什么证据。

```go
type Repository interface {
    Save(context.Context, Bill) (Bill, error)
    Get(context.Context, string) (Bill, error)
}

type Service struct { repo Repository }
func NewService(repo Repository) *Service { return &Service{repo: repo} }
```

## 8. 最容易怎么翻车

- 接口由实现方定义成巨型清单
- 所有 struct 都用指针 receiver
- 为了一处重复就引入泛型

## 9. 动手与验收

**动手：** 实现 SQLRepository 与 FakeRepository，让同一个 Service 测试无需真实数据库。

**过关：** 测试能注入 fake，并验证 repository 错误如何影响业务结果。

## 10. 后续图解位置

- `interface-capability-contract`（文字通过审核后再排图）

## 11. 自己问自己

**问：接口应该由谁定义？**

答：接口通常由使用方按所需的最小能力定义。

**问：值与指针 receiver 的方法集有何差异？**

答：值 receiver 属于 T 和 *T 的方法集；指针 receiver 只属于 *T。

**问：组合为何不等于继承？**

答：组合复用行为，但不自动建立 is-a 继承关系。

## 12. 下一站

Repository 的能力边界立住了，可它和 Service、Handler 仍只是散落的零件；下一章回到 main 完成模块与依赖装配。

## 补充 4.1　接口里的 nil 有两层

显示器旁放着一个透明文件袋，袋内写着 *Problem，里面却什么都没有。李宝瓶把它和真正的空袋并排摆好。

陈平安把 nil 的 *Problem 装进 error 接口返回，成功路径仍进入失败分支；接口保留了动态类型，所以它并不等于 nil。

### 群聊

> **陆沉：** 有物混成，非空之空，贫道观之，似有若无玄之又玄。
>
> **阿良：** 指针是 nil，装进接口就变非 nil，这陷阱坑过多少英雄。
>
> **崔东山：** 哎呀！明明是个空袋子，怎么摸上去沉甸甸的！
>
> **文圣：** 名实相副才叫真！返回具体指针别直接赋给接口，显式赋 nil！
>
> **宁姚：** typed nil 是致命暗礁，构造器出错显式返回空接口。
>
> **周米粒：** 空就是空，袋子破了也不能装泥巴骗人！

*那张 *Problem 名帖被撤下。周米粒记住：接口有类型，就不算真正的空。*

### 小白一句话

接口值同时携带动态类型和动态值，不能只看里面的指针是否为空。

### 像什么

像一个贴着‘蛋糕’标签的盒子，里面却是空的。接口先看见标签，就会说‘我不是 nil’；打开盒子才发现里面的指针是 nil。

### 黑话翻译

- **error**：事情没办成时一起带回来的原因条

### 技术真相

- 接口值由动态类型和动态值组成；typed nil 仍保留动态类型。
- 返回 error 时不要把 nil 具体指针装进接口后返回。
- 外部数据或可变实现使用 v, ok := x.(T)，不要赌断言成功。
- type switch 适合有限分支；开放扩展优先依靠接口方法。

### 看代码

- 先看 Error 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Error 的出口：成功交回什么，失败留下什么证据。

```go
type Problem struct{ Msg string }

func (*Problem) Error() string { return "problem" }

func validate(ok bool) error {
    var p *Problem
    if !ok {
        p = &Problem{Msg: "bad input"}
    }
    if p == nil { return nil }
    return p
}
```

**动手：** 写一个失败版本返回 p，再用测试证明 err != nil，最后按示例修复。

**过关：** 成功路径的 error 接口确实为 nil；所有不确定断言都处理 ok。

**接着去哪：** 接口的 nil 边界收住后，还要判断重复代码究竟是共同算法，还是不同业务碰巧长得像。

## 补充 4.2　泛型只抽共同算法

白板上画着创建账单和撤销账单两条三步流程，旁边是一张只做 map keys 的小卡片。阮秀把两条流程的副作用用红线分开。

陈平安为了消除几行重复，把创建与撤销硬塞进一个泛型函数；代码短了一点，错误处理和补偿语义却搅在一起。

### 群聊

> **崔东山：** 先生！学生把所有 struct 全套上泛型，满屏方括号！
>
> **阿良：** 为了耍帅把代码写成天书，回头发起火来自己都不认得。
>
> **阮秀：** 做菜讲究量体裁衣，小火炖汤何必搬出炼丹炉？
>
> **老瞎子：** 泛型管容器和算法足矣，业务代码瞎套，纯属画蛇添足！
>
> **宁姚：** 业务逻辑优先具体类型，通用基础设施再用类型参数。
>
> **周米粒：** 小竹杖就很好用，才不要换成大铁锤呢！

*两条流程各自散会，只有 map keys 拿到泛型通行证。*

### 小白一句话

先确认重复的是稳定算法，再决定是否引入类型参数。

### 像什么

泛型像饼干模具：当好多饼干只差面团口味、切法完全一样时，做一个模具很划算；如果每块都要雕花，硬套模具只会把饼干压烂。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 泛型适合容器、集合变换和与具体业务无关的稳定算法。
- 类型约束保持最小；只比较相等就使用 comparable。
- 业务规则差异优先用具名函数或接口，不强凑类型参数。
- 调用处比抽象前更难读时，保留少量重复通常更便宜。

### 看代码

- 先看 keys 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 keys 的出口：成功交回什么，失败留下什么证据。

```go
func keys[K comparable, V any](m map[K]V) []K {
    out := make([]K, 0, len(m))
    for k := range m {
        out = append(out, k)
    }
    return out
}
```

**动手：** 找两段真实重复代码，判断共同的是算法还是仅仅长得相似。

**过关：** 能说明类型参数消除的具体重复；约束未暴露无用操作。

**接着去哪：** 抽象没有越界，接下来检查这些包属于哪个 module，又为何能在 main 中连起来。

---

# 第五章  山门与院落：Module、Package 与依赖方向

**本章要解决：** 理解 module、package、internal、目录边界和 composition root。

## 1. 闯祸现场

清晨的工位上排着数据库、Repo、Service、Handler 四块磁贴，最右边是一张写着 main 的启动卡。go.mod 打印稿被咖啡杯压在显示器下。

陈平安删掉 Service 的装配后启动程序，Handler 一接请求就摸到 nil；他还把 module、package 和 internal 当成同一道围墙，本地能跑的 import 到另一棵目录树便失败。

## 2. 群聊

> **阮秀：** 各家门派规矩不同，放在一张桌上做菜，滋味全串了。
>
> **李宝瓶：** Handler 负责迎客，Service 负责算账，各司其职！
>
> **阿良：** 依赖全写在构造函数里，测试时换个假实现多痛快。
>
> **文圣：** 圣人立言各安其位，main 里按层组装，谁也别僭越！
>
> **宁姚：** 跨层调用一律走接口，禁止反向依赖与隐式全局。
>
> **周米粒：** 大白鹅要听话，排排坐吃果果，谁也不许乱插队！

*四块磁贴依次接通，nil 没再守门；阿良仍被 internal 挡在目录树外。*

## 3. 小白一句话

Module 是山界，Package 是院落，main 只负责组装。

## 4. 像什么

Module 是整所学校，Package 是各个教室，internal 是只许本楼学生进的小仓库，main 像早晨开门时负责把老师、钥匙和课表凑齐的值日生。

## 5. 先拆黑话

- **package**：代码住在哪个院子
- **module**：一整座项目山门和它的依赖清单
- **internal**：只准自家院子进入的内门

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- module 由 go.mod 定义主模块路径和依赖图；import 可来自主模块、标准库或依赖图中的外部模块。
- package 是编译与封装边界；internal 的可见性由目录位置决定，不等同于 module 边界。
- internal/x 只允许 internal 上一级目录树内的代码导入；main 仍只负责选择实现、注入依赖和启动。

## 7. 看代码别慌

- 先看这段代码在读写什么状态，再找它对外承诺的结果。
- 最后核对状态出口：成功改变什么，失败留下什么证据。

```go
ledger-agent/
  go.mod
  cmd/server/main.go
  internal/bill/handler.go
  internal/bill/service.go
  internal/bill/repository.go
  internal/platform/config/config.go
  internal/platform/database/database.go
```

## 8. 最容易怎么翻车

- 把 go.mod 误解成只准导入本模块
- 忽略 internal 的父目录树限制
- 业务层反向依赖 Gin 或 SQL 行

## 9. 动手与验收

**动手：** 建立示例目录，再分别从允许与不允许的父目录树导入 internal/bill；同时引入一个 go.mod 声明的外部依赖并运行 go test ./...。

**过关：** 能区分 module 依赖图、package 封装与 internal 父目录树限制，并说明 main 为何是 composition root。

## 10. 后续图解位置

- `go-project-architecture`（文字通过审核后再排图）

## 11. 自己问自己

**问：module 与 package 的边界有何不同？**

答：module 定义版本、主模块路径与依赖图；package 定义编译和封装；internal 另受父目录树限制。

**问：业务为什么不应依赖 Gin？**

答：业务层不依赖 Gin，才能独立测试并替换传输协议。

**问：main 为什么是 composition root？**

答：main 负责选择实现、注入依赖并启动进程，所以是 composition root。

## 12. 下一站

main 完成装配并开始监听后，一笔不存在的账单穿过 Repo、Service 和 Handler；它的错误链成为下一章入口。

## 补充 5.1　依赖问题先问模块

CI 屏幕显示依赖版本 v1.4.2，本地终端却指向另一条引入链。桌上摊着 go.mod、go.sum 和一张模块关系图。

陈平安看到本地可以 import 就准备重跑 CI，却没有解释间接依赖从哪里来；一次 tidy 还删了两行，他差点把删除当成依赖无用的证明。

### 群聊

> **李宝瓶：** CI 用了 v1.4.2，谁先查依赖链，别先拍缓存。
>
> **宁姚：** 本地能 import，难道还不能先怀疑缓存？
>
> **阿良：** 缓存还没开口，你已经替它认罪了。
>
> **陈平安：** 用 go mod why -m 和 go mod graph 找路径。
>
> **宁姚：** tidy 删除不等于无用，verify 通过也不等于无漏洞。
>
> **周米粒：** 审 diff 再定案；verify 只核缓存和 go.sum。

*依赖链抓到了真正来路。周米粒记下：先画关系图，再审缓存案。*

### 小白一句话

先问模块边界和引入路径，再判断依赖是否健康。

### 像什么

像查地铁换乘：别一看到堵车就拆轨道。先看这条依赖从哪站上车、经过哪些线、为什么会来到这里，再决定 tidy 该拿走什么。

### 黑话翻译

- **缓存**：为了快而做的副本，不是最终事实

### 技术真相

- go.mod 记录模块路径、Go 版本和直接或间接依赖。
- go mod tidy 会考虑主模块相关包、测试及各 OS/架构/build tag 组合，执行后必须审查 diff。
- go mod why -m 解释引入路径；go mod graph 展开模块关系。
- go mod verify 校验缓存内容与 go.sum，不代表依赖没有漏洞。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 任选一个间接依赖，写出 why 路径、版本来源和是否仍需保留。

**过关：** 能从导入链解释依赖；tidy 后只有预期 go.mod/go.sum 变化。

**接着去哪：** 模块图解释清楚了，还要关掉本地 workspace，确认发布时单模块也能成立。

## 补充 5.2　工作区不是发布配置

两台电脑之间连着一根写有 go.work 的蓝线，左边是账本模块，右边是共享模块。阮秀把 GOWORK=off 写在便签上。

陈平安拔掉蓝线后单独测试，账本模块立刻找不到旁边依赖；原来本地 workspace 遮住了缺失的正式版本和临时 replace。

### 群聊

> **阿良：** 在自个儿院子改得挺欢，一上正式擂台立马露馅。
>
> **宁姚：** 本地替换只能应急，依赖版本必须锁定在清单里。
>
> **阮秀：** 各家厨房各用各的调料，混着用早晚串味。
>
> **文圣：** 自欺欺人！先查 go env，再带 GOWORK=off 逐个测！
>
> **宁姚：** workspace 不得带入 CI，提交前必跑隔离构建。
>
> **阮秀：** 门户清爽，各安其分，才有长久安稳。

*蓝线留给本地联调。周米粒说：go.work 是便桥，不是发布地基。*

### 小白一句话

go.work 是本地联调视图，不是发布依赖的替代品。

### 像什么

go.work 像你桌上临时拼起来的联调沙盘，方便同时摆几个项目；发布时真正装箱的仍是每个 module 自己的 go.mod，不能把桌子一起寄走。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- go work use 聚合多个本地模块，不改各模块的发布依赖。
- go env GOWORK 显示当前是否被工作区接管。
- 用 GOWORK=off go test ./... 验证每个模块能独立成立。
- replace 若仅用于本地开发，应避免混入准备发布的 go.mod。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 建立含两个模块的临时工作区，再关闭 GOWORK 验证各自测试。

**过关：** 工作区内联调通过；每个模块在 GOWORK=off 下仍可解析并测试。

**接着去哪：** 模块独立测试通过后，不存在的账单从 Repository 返回错误，开始考验跨层传播。

---

# 第六章  错误要留因果：Error 与边界测试

**本章要解决：** 掌握错误包装、分类、取消与超时的边界翻译，以及表驱动测试。

## 1. 闯祸现场

雨点敲着玻璃，屏幕上同时弹出 ErrMissing、context.Canceled 和 upstream timeout 三条记录。桌边放着三只颜色不同的文件夹，等着接各自的错误证据。

陈平安在 Repo、Service、Handler 每层都打印一次，还处处 recover；同一个错误刷了三行日志，最后却都被翻成 500，连接断了还继续写响应。

## 2. 群聊

> **阿良：** 错误直接吞了，出了事故连神仙也只能抓瞎。
>
> **左右：** 剑出有因，错起有源，岂能斩断根由。
>
> **李宝瓶：** 小师叔说过，包装错误用 %w，最外层才能溯源！
>
> **老瞎子：** 出了漏子抹平当没事？用 %w 留住病根，Handler 才能认！
>
> **宁姚：** 底层错误向上传递必保真，顶层再决定拒绝还是告警。
>
> **阮秀：** 因果不断，账目才能算得明明白白。

*三类错误各归一档。周米粒总结：错可以往上走，日志别一路撒。*

## 3. 小白一句话

内部留因果，边界翻契约。

## 4. 像什么

错误不是一句‘完蛋了’，而是一串快递追踪：哪一站坏了、上一站交了什么、门口最后该回哪种状态码，都要留得下来。

## 5. 先拆黑话

- **error**：事情没办成时一起带回来的原因条
- **Trace**：一次请求一路经过哪些地方的脚印串

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 使用 %w 保留错误因果，用 errors.Is/As 分类，不比较 err.Error()。
- 客户端取消、服务自身 deadline 和上游 timeout 是不同事件，不能全部翻成 500 或 504。
- 连接已断时不要继续写响应；日志记录 cancelled，并让下游协作式收口。
- 表驱动测试覆盖公开错误契约，内部 cause 只进入受控日志与 trace。

## 7. 看代码别慌

- 先看 mapError 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 mapError 的出口：成功交回什么，失败留下什么证据。

```go
type HTTPDecision struct {
    Status int
    Code string
    Write bool
}

func mapError(err error) HTTPDecision {
    switch {
    case err == nil:
        return HTTPDecision{200, "ok", true}
    case errors.Is(err, context.Canceled):
        return HTTPDecision{0, "request_cancelled", false}
    case errors.Is(err, ErrUpstreamTimeout):
        return HTTPDecision{504, "upstream_timeout", true}
    case errors.Is(err, context.DeadlineExceeded):
        return HTTPDecision{504, "deadline_exceeded", true}
    case errors.Is(err, ErrMissing):
        return HTTPDecision{404, "bill_not_found", true}
    case errors.Is(err, ErrInvalidBill):
        return HTTPDecision{422, "invalid_bill", true}
    default:
        return HTTPDecision{500, "internal_error", true}
    }
}
```

## 8. 最容易怎么翻车

- 比较 `err.Error()`
- 既记录错误又层层重复记录
- 把 panic 当普通错误处理

## 9. 动手与验收

**动手：** 为 mapError 写表驱动测试，覆盖包装后的 ErrMissing→404、客户端取消、服务 deadline、上游超时和未知错误。

**过关：** errors.Is 能识别包装后的 ErrMissing 并稳定返回 404/bill_not_found；取消不写响应，超时与未知错误各走自己的公开契约。

## 10. 后续图解位置

- `error-contract-flow`（文字通过审核后再排图）

## 11. 自己问自己

**问：为什么不用 err.Error() 比较？**

答：错误文本会变化；分类应使用 errors.Is 或 errors.As。

**问：panic 适合普通业务错误吗？**

答：普通业务失败应返回 error，panic 留给当前调用无法继续的异常状态。

**问：500 响应为什么不能带内部 cause？**

答：500 响应只暴露稳定错误码，内部 cause 留在受控日志和 trace。

## 12. 下一站

错误类别、panic 边界和测试职责都分开后，账本开始并行汇总多笔账单；共享总额第一次暴露数据竞争。

## 补充 6.1　错误要能被识别

工单上先写着 ErrMissing，经过 Repo 和 Service 后，又盖上了 load bill 的操作章。李宝瓶把原始错误与新文案用一根线连起来。

陈平安却只留下“加载失败”四个字，Handler 只能比较字符串；文案稍微改动，账单不存在就被误判成未知错误。

### 群聊

> **崔东山：** 学生随手重新 new 了一个 error，原由全丢到脑后啦！
>
> **阿良：** 斩断了线索，刑官断案也只能判个悬案。
>
> **李宝瓶：** 哨兵错误一层层裹着，必须能用 errors.Is 找回来！
>
> **老瞎子：** 跨层丢掉原始哨兵，等于挖瞎查账人的眼睛！老实包好！
>
> **宁姚：** 错误链要留根，最外层统一记审计日志与堆栈。
>
> **周米粒：** 线头扯直了，才能把偷吃瓜子的小贼抓出来！

*文案换了，ErrMissing 仍被准确认出。周米粒记：包语义，别包废话。*

### 小白一句话

错误文本给人看，保留下来的错误链给程序判断。

### 像什么

像医院转诊单：每一科都可以补一句‘我这里看见了什么’，但不能把上一个诊断撕掉。程序最后才能沿着单子认出最初的病因。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 使用 fmt.Errorf 加上下文时，以 %w 保留可遍历的原因链。
- 稳定类别用哨兵错误配合 errors.Is，结构信息用自定义类型。
- errors.As 抽取链上的目标类型，不依赖具体包裹层数。
- 错误应在能增加业务语义的边界处理一次，避免重复记录。

### 看代码

- 先看 load 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 load 的出口：成功交回什么，失败留下什么证据。

```go
var ErrMissing = errors.New("missing")

func load(id string) error {
    err := read(id)
    if err != nil {
        return fmt.Errorf("load %s: %w", id, err)
    }
    return nil
}
```

**动手：** 为 load 补一层业务上下文，并用 errors.Is 验证底层 ErrMissing。

**过关：** 错误文本包含操作上下文；调用方不解析字符串即可识别错误类别。

**接着去哪：** 可预期错误能被识别后，还要把真正的 panic 限制在正确边界。

## 补充 6.2　recover 只守边界

测试台上放着一张非法金额小票、三张清理卡和一份堆栈记录。宁姚把“业务错误”和“panic 边界”分成两列。

陈平安让解析函数遇到坏金额就 panic，再在每个小函数里 recover 成零；账单看起来成功，真正的坏状态和来路却全被吞掉。

### 群聊

> **崔东山：** 先生！学生在外面写了个 recover，怎么没接住 panic！
>
> **阿良：** 房梁塌了你在院子外撑伞，能砸不着你吗？
>
> **李宝瓶：** recover 只能在 defer 函数内部生效，且只护当前协程！
>
> **文圣：** 成何体统！panic 需在 defer 里收网，转成 error 交代！
>
> **宁姚：** 跨协程 panic 无法兜底，每个 goroutine 自担生灭。
>
> **周米粒：** 小兜网要随身带，掉下来的大桃子才能稳稳兜住！

*三张清理卡逆序落下。周米粒记住：error 管业务，recover 守边界。*

### 小白一句话

可预期失败返回 error；recover 只在能够制定隔离策略的边界工作。

### 像什么

defer 像离开教室前自动关灯，error 像正常举手报告，panic 像消防警铃。不能每次铅笔断了都拉警铃，也不能警铃响后假装什么都没发生。

### 黑话翻译

- **error**：事情没办成时一起带回来的原因条

### 技术真相

- defer 在函数返回前按后进先出执行，适合就地登记清理。
- defer 的实参在登记时求值；闭包读取变量时要留意后续变化。
- 可预期的 I/O、校验和业务失败都应返回 error。
- 边界 recover 后要记录堆栈、转换结果，并让资源清理继续执行。

### 看代码

- 先看 boundary 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 boundary 的出口：成功交回什么，失败留下什么证据。

```go
func boundary(next func() error) (err error) {
    defer func() {
        if v := recover(); v != nil {
            logPanic(v, debug.Stack())
            err = ErrInternal
        }
    }()
    return next()
}
```

**动手：** 让 next 依次正常返回、返回业务错误、触发 panic，观察三条路径。

**过关：** 业务错误原样传播；panic 仅在边界转稳定错误；堆栈只进内部日志且 defer 清理执行。

**接着去哪：** 正常返回、业务错误和 panic 边界分开后，测试还要覆盖未知输入而不靠吞 panic 过关。

## 补充 6.3　测试从例子走向性质

夜班桌上有一盒彩色输入卡，最上面两张写着空串和中文，旁边放着临时目录钥匙。阮秀把“往返相等”写成唯一判定。

手写表格用例全部通过，一段怪字节却让解码器撞坏；并行子测试还共用同一个状态，失败后临时文件也留在磁盘。

### 群聊

> **陈景清：** 本水龙王吐出一亿个随机乱码，我就不信砸不穿你的单元测试！
>
> **阮秀：** 乱码如暴风骤雨，测试跑完留下一地垃圾文件，谁来收拾？
>
> **阿良：** 模糊测试专治各种嘴硬，越刁钻的输入越能炸出边界漏洞。
>
> **陈平安：** 用 t.Cleanup 注册清理逻辑，测试无论成败都把现场扫净。
>
> **宁姚：** Fuzzing 挖出来的崩溃用例，立刻固化为防回归单测。
>
> **周米粒：** 打扫干净屋子再迎客，小米粒把小扫帚挥得呼呼响！

*怪字节没逃掉，临时目录也被清空。周米粒：反例抓到，就编入巡逻队。*

### 小白一句话

单元测试锁定已知场景，fuzz 用稳定性质寻找未知反例。

### 像什么

普通测试像拿已知钥匙开锁，fuzz 像让机器递来一大篮奇怪钥匙；不管哪把卡住，测试结束都要把临时房间收拾干净。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- t.Helper 让失败定位回调用处，t.Cleanup 统一登记资源回收。
- 子测试按场景命名，并只在互不共享状态时使用 t.Parallel。
- f.Add 放入有意义的种子；Fuzz 函数断言稳定性质。
- 发现的失败输入进入语料库，修复后成为持续回归资产。

### 看代码

- 先看 FuzzRoundTrip 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 FuzzRoundTrip 的出口：成功交回什么，失败留下什么证据。

```go
func FuzzRoundTrip(f *testing.F) {
    f.Add("hello")
    f.Fuzz(func(t *testing.T, in string) {
        out, err := roundTrip(in)
        if err != nil { t.Fatal(err) }
        if out != in {
            t.Fatalf("got %q want %q", out, in)
        }
    })
}
```

**动手：** 为声明支持任意 string 的编解码器加入空串和中文种子，断言往返必成功且相等。

**过关：** 常规测试可重复；fuzz 不靠吞 panic 通过；临时资源由 Cleanup 回收。

**接着去哪：** 输入空间扩展后，下一次失败不在解析，而在两个 goroutine 同时更新账本总额。

---

# 第七章  众剑齐出：Goroutine、GMP 与 Race

**本章要解决：** 理解 goroutine 调度、WaitGroup、mutex、共享状态与 race detector。

## 1. 闯祸现场

午饭后的白板写着 total=0，旁边画了四个 goroutine 和一条汇总 channel。李宝瓶把秒表放在键盘前，提醒大家别靠等待时间猜执行顺序。

两个 goroutine 同时修改 total，结果一会儿是 3000，一会儿少一笔；陈平安加了 50ms 的 sleep，本地偶尔正确，go test -race 仍旧报警。

## 2. 群聊

> **崔东山：** 先生！学生用 select 监听八百个通道，没消息卡死啦！
>
> **阿良：** select 没 default 也没超时，傻等跟上吊没区别。
>
> **老瞎子：** 心急赛神仙，通道全堵死，真是蜉蝣见青天不知浅深！
>
> **文圣：** 老瞎子说得对！知敬畏才立规矩，超时分支必须保底！
>
> **宁姚：** 别在 select 里死等；超时一到该打回就打回。
>
> **周米粒：** 右护法敲小铜锣啦，当当当，时间到就不等啦！

*秒表被没收。周米粒写下：sleep 管困，不管并发。*

## 3. 小白一句话

G 等事，M 干活，P 给资格；并发先定主人。

## 4. 像什么

像饭馆突然来了很多桌客人。goroutine 是小跑堂，M 是真正在跑的腿，P 是允许上岗的工牌；若两人同时改同一张菜单，race 就来了。

## 5. 先拆黑话

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **channel**：小跑堂之间传东西的窗口
- **select**：几个窗口都可能来消息时，等能动的那个
- **Context**：沿调用链传下去的取消铃和截止钟
- **race**：两个人同时改一本账，谁先落笔说不清

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- goroutine 是并发执行单元；GMP 是运行时调度模型。P 数量由 GOMAXPROCS 控制，不等同于物理核心定律。
- channel 提供通信与同步，但 channel 外共享变量仍可能 data race。互斥锁保护共享状态，channel 适合传递所有权或事件。
- `select` 在多个 ready case 中选择，但不承诺业务公平或无饥饿；带 default 的循环可能忙轮询。

## 7. 看代码别慌

- 先看 fetchAll 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 fetchAll 的出口：成功交回什么，失败留下什么证据。

```go
func fetchAll(ctx context.Context, urls []string, limit int) error {
    if limit <= 0 {
        return fmt.Errorf("limit must be positive: %d", limit)
    }
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(limit)
    for _, url := range urls {
        url := url
        g.Go(func() error { return fetch(ctx, url) })
    }
    return g.Wait()
}
```

## 8. 最容易怎么翻车

- fire-and-forget goroutine
- 关闭由接收方控制的 channel
- 用 Sleep 协调并发

## 9. 动手与验收

**动手：** 实现 fetchAll，并测试 limit=0、limit<0、子任务失败和父 context 取消。

**过关：** 非法 limit 立即返回；并发峰值不超过上限；失败与取消都能让所有 goroutine 收口，race 检测通过。

## 10. 后续图解位置

- `goroutine-channel-runtime`（文字通过审核后再排图）

## 11. 自己问自己

**问：P 等于物理 CPU 核吗？**

答：P 是调度资源，不等同于某一颗物理 CPU 核。

**问：Channel 外共享变量会竞态吗？**

答：会；channel 不会自动保护它之外的共享变量。

**问：race detector 能证明无竞态吗？**

答：不能；race detector 只检查本次执行实际覆盖到的并发路径。

## 12. 下一站

共享总额改成单一 owner 后，计算结果不再竞态；但请求提前取消时，生产账单的 goroutine 仍在阻塞发送。

## 补充 7.1　没有同步，就没有顺序

白板上画着两个同时指向 total 的箭头，旁边是一张写有 happens-before 的透明片。李宝瓶把 50ms 秒表压在透明片下。

陈平安用 sleep 调整顺序后，结果偶尔正确，race 检查仍报告同一位置的读写冲突；日志先后看起来整齐，却没有任何同步边。

### 群聊

> **崔东山：** 学生看那变量就在眼前，伸手抓一把难道还会抓空？
>
> **阿良：** 多核 CPU 缓存多得很，你看到的可能早是八百年前的影。
>
> **李宝瓶：** Happens-Before 规则！没有同步原语，读写顺序全凭缘分！
>
> **老瞎子：** 通道通信与锁释放才能定乾坤，瞎猜顺序不如听个响！
>
> **宁姚：** 无同步就无时序保证，数据竞争一律视为系统缺陷。
>
> **周米粒：** 排好队一个个来，乱挤的小朋友要被没收零食！

*秒表再次被请走。周米粒记：日志讲故事，同步才立规矩。*

### 小白一句话

并发正确性依赖 happens-before，不依赖日志顺序、延时或调度运气。

### 像什么

像两个小朋友同时改黑板分数。你在门外听见谁先喊，不代表黑板上谁先写；没有锁、消息或原子操作，就没有可靠的先后顺序。

### 黑话翻译

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **channel**：小跑堂之间传东西的窗口
- **race**：两个人同时改一本账，谁先落笔说不清

### 技术真相

- 同一内存位置并发访问且至少一次为写，缺少同步就是数据竞争。
- goroutine 启动、channel 收发、锁和原子操作可建立特定同步关系。
- sleep、日志顺序和本机多次成功都不是同步证据。
- go test -race ./... 是动态检查，仍需覆盖真实并发路径。

### 看代码

- 先看 publish 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 publish 的出口：成功交回什么，失败留下什么证据。

```go
func publish() <-chan int {
    ch := make(chan int, 1)
    go func() {
        value := 42
        ch <- value
        close(ch)
    }()
    return ch
}
```

**动手：** 把一个共享 bool 轮询示例改成 channel 通知，并分别跑普通测试和 race。

**过关：** 能指出同步边；race 检查无报告；实现不依赖 sleep 或调度运气。

**接着去哪：** 知道同步边以后，下一步按数据所有权选择 Mutex、Once、atomic 或 channel。

## 补充 7.2　先定所有权，再选同步器

工具板上挂着 Mutex、RWMutex、Once、atomic 和 channel 五张卡，桌面分成初始化、计数、传结果三个格子。阮秀先给每格写上 owner。

陈平安把三种问题全改成 channel，初始化绕远路、计数代码变长、退出协议也更难读；含锁结构还被复制了一份。

### 群聊

> **阿良：** 一把大锁保平安固然稳，可路全堵死了也叫人受罪。
>
> **左右：** 剑分轻重，器分利钝，当取其宜。
>
> **阮秀：** 煎药用文火，爆炒用大火，火候选错全毁了。
>
> **文圣：** 初始化用 Once，独立计数 atomic，大动干戈才上 Mutex！
>
> **宁姚：** 临界区尽可能缩小，通道传递所有权，锁保护共享状态。
>
> **李宝瓶：** 选对利器，事半功倍，大账本才能跑得飞快！

*五张卡各归其位。周米粒说：先看问题形状，再从工具板拔剑。*

### 小白一句话

先定状态的所有者和不变量，再选择匹配问题形状的同步工具。

### 像什么

先决定粉笔归谁，再选工具：一个人写就交给单一所有者；偶尔轮流写可上锁；只改一个计数器可用 atomic；需要交接任务再用 channel。

### 黑话翻译

- **race**：两个人同时改一本账，谁先落笔说不清
- **缓存**：为了快而做的副本，不是最终事实

### 技术真相

- Mutex 保护一组必须共同保持不变量的字段，锁范围要可说明。
- RWMutex 只有在读多、竞争真实且基准证明收益时再采用。
- Once 表达恰好一次初始化；atomic 只适合简单独立状态。
- 禁止复制已使用的锁；包含锁的结构通常以指针传递。

### 看代码

- 先看 Get 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 Get 的出口：成功交回什么，失败留下什么证据。

```go
type ConfigCache struct {
    once sync.Once
    cfg  Config
}

func (c *ConfigCache) Get() Config {
    c.once.Do(func() { c.cfg = loadConfig() })
    return c.cfg
}
```

**动手：** 为一个计数器和一个配置缓存分别选择同步工具，并写出选择理由。

**过关：** 每个共享状态有明确所有者；工具与不变量匹配；race 检查通过。

**接着去哪：** 同步器选对了，可消费者提前返回后，生产者仍需要取消、关闭与等待协议。

---

# 第八章  飞剑须能收：Channel、Select 与 Context

**本章要解决：** 掌握 channel 关闭、select 语义、context 取消、超时和 goroutine 泄漏收口。

## 1. 闯祸现场

傍晚的桌上有四张账单卡片和一个只能装三张的收件盒，旁边贴着 cancel、close、wait 三枚标签。空调风把第四张卡片吹到盒边。

消费者取走三笔就返回，生产者仍堵在第四次发送；请求已经取消，测试却一直等到超时，陈平安还以为 select 会按书写顺序自动选中取消。

## 2. 群聊

> **李宝瓶：** 第四笔卡在发送口，谁还没给生产者退路？
>
> **宁姚：** select 加个 default，就堵不住了吧？
>
> **阿良：** 确实，账单会被你一脚踢没，路可太通了。
>
> **陈平安：** 发送监听 ctx.Done，消费者 cancel 后再等待退出。
>
> **阮秀：** channel 由确认不再发送的发送方关闭。
>
> **宁姚：** Context 只发通知，不能强杀任务；select 也不保顺序。

*第四张账单没有失踪。周米粒按下三个按钮：cancel、close、wait，一个不能少。*

## 3. 小白一句话

谁等待、谁取消、错归谁、上限多少。

## 4. 像什么

派小跑堂出去时，不能只喊‘快去’，还要告诉他什么时候回来、谁能叫停、回来把结果交给谁。否则饭馆关门了，他还在后巷端着盘子发呆。

## 5. 先拆黑话

- **struct**：把一件东西要填的格子做成固定模具
- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **channel**：小跑堂之间传东西的窗口
- **select**：几个窗口都可能来消息时，等能动的那个
- **Context**：沿调用链传下去的取消铃和截止钟
- **race**：两个人同时改一本账，谁先落笔说不清
- **owner**：这份资源真正归属的那个人或主体

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 能保证不再发送的唯一 owner/协调者负责关闭 channel；接收方使用 range 直到关闭。
- select 在多个 case 同时就绪时伪随机选择，不承诺绝对公平。
- context 只广播取消意图，不能强杀 goroutine、解锁 mutex 或保证驱动立即停止。
- 每个 goroutine 都要定义等待对象、取消来源、错误归属与退出证据。

## 7. 看代码别慌

- 先看 stream 的输入和返回值：它接什么，最后必须交回什么。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 最后核对 stream 的出口：成功交回什么，失败留下什么证据。

```go
func stream(ctx context.Context, values []int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, value := range values {
            select {
            case <-ctx.Done():
                return
            case out <- value:
            }
        }
    }()
    return out
}

func consumeStream(ctx context.Context, values []int) {
    for value := range stream(ctx, values) {
        consume(value)
    }
}
```

## 8. 最容易怎么翻车

- 把 context 放进 struct 长期保存
- 把业务参数塞进 context
- 忽略 ctx.Err

## 9. 动手与验收

**动手：** 实现可取消 producer/consumer，记录 goroutine 启动和退出，并覆盖消费者提前停止。

**过关：** 发送方唯一关闭 channel；取消后所有 goroutine 在期限内退出；go test -race 与泄漏检查通过。

## 10. 后续图解位置

- `context-cancellation-sequence`（文字通过审核后再排图）
- `goroutine-lifecycle-closure`（文字通过审核后再排图）

## 11. 自己问自己

**问：谁应该关闭 channel？**

答：能保证不再发送的唯一发送方或协调者负责关闭 channel。

**问：select 是否保证绝对公平？**

答：不保证；多个 case 同时就绪时伪随机选择，不是业务公平策略。

**问：context 能强杀 goroutine 吗？**

答：不能；context 只广播取消意图，goroutine 必须主动监听并返回。

## 12. 下一站

Go 卷的账本代码已有函数、类型、容器、接口、模块、错误、并发与取消边界；第九章让同一笔账单进入 HTTP Handler。

## 补充 8.1　启动 goroutine 时就写退出路

桌上排着四张账单卡，消费者的托盘只标着“取三张”，旁边还有 cancel、close、wait 三个按钮。李宝瓶把第四张卡放在发送口。

消费者拿满三张便返回，生产者永久堵在第四次发送；陈平安想加 default 绕过阻塞，却可能忙等或把结果直接丢掉。

### 群聊

> **陈景清：** 我乃御道江水龙王！开几千个协程巡江多气派，何须去管它们死活？
>
> **阿良：** 你那几千条泥鳅永不退出，内存迟早被你吸干，直接变清蒸龙王。
>
> **周米粒：** 小米粒拿小竹杖数过，漏掉的协程全躲在水底下装死呢！
>
> **陈平安：** 启动协程前，必须想清楚它怎么安全退出。
>
> **宁姚：** 靠 context 或通道发信号，收口前必须 WaitGroup 等齐。
>
> **阮秀：** 借了水势要记得还，协程退出前把资源放得干干净净。

*第四张卡顺利归队。周米粒再按一遍：cancel、close、wait，退出才算有回执。*

### 小白一句话

启动 goroutine 时就同时写下正常完成、取消和等待路径。

### 像什么

派小朋友去楼下买盐时，要同时说清三件事：买到后去哪、妈妈喊停时怎么回来、家里怎么知道他已经回来了。goroutine 也要出生就带退出路线。

### 黑话翻译

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **channel**：小跑堂之间传东西的窗口
- **Context**：沿调用链传下去的取消铃和截止钟

### 技术真相

- 接收 context 的函数不保存它，取消信号沿调用链向下传。
- 创建 channel 的一方通常负责关闭；接收方不要替发送方 close。
- 每个 goroutine 都要有正常完成、取消或错误退出路径。
- 使用 WaitGroup 或 errgroup 等待收口，不能只让进程替它回收。

### 看代码

- 先看 produce 的输入和返回值：它接什么，最后必须交回什么。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 最后核对 produce 的出口：成功交回什么，失败留下什么证据。

```go
func produce(ctx context.Context) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for i := 0; ; i++ {
            select {
            case out <- i:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}
```

**动手：** 让消费者只取三个值就取消，测试生产者能在超时前退出。

**过关：** 测试能证明取消后 goroutine 收口；无重复关闭、阻塞发送或忙等。

**接着去哪：** goroutine 已能被证明回收，账单请求可以安全进入 Handler、Service 与 Repository 的完整链路。

---

# 第九章  山门来客：HTTP、Gin 与契约

**本章要解决：** 掌握请求生命周期、路由、中间件、DTO、校验、认证上下文与状态码。

## 1. 闯祸现场

午后的雨点敲着窗，陈平安把一杯奶茶和一张写着 bill-0827 的便签摆在显示器旁，准备接住 tenant-7 的 HTTP 创建请求。

他先写好了成功回信，却没读请求体；客户端塞进来的 user_id 和陌生字段就这样越过了门口。

## 2. 群聊

> **崔东山：** 先生！学生手写了一个原生 HTTP 路由器，路径带斜杠怎么就 404 啦！
>
> **阿良：** 路由匹配没规范化，Trailing Slash 教你做人，还不快去补课。
>
> **宁姚：** 请求进门先验路由与方法；别把野路子请求放进后厨。
>
> **陈平安：** 基于 net/http 标准库构建清晰路由，规范划分中间件与业务。
>
> **周米粒：** 大门贴上门神画，正经客人请进，捣蛋鬼统统在门外罚站！
>
> **李宝瓶：** 统一请求上下文与响应格式，每一笔 HTTP 调用都规规整整。

*便签终于贴在了请求入口，奶茶还没凉。*

## 3. 小白一句话

能读来信，不等于应承来客。

## 4. 像什么

HTTP 像城门收信。信封能拆开，不代表来客可信，也不代表他有权改账；门房要查格式、身份、权限和回信规格。

## 5. 先拆黑话

- **Context**：沿调用链传下去的取消铃和截止钟
- **HTTP**：客户端和服务端互寄有格式的信
- **Handler**：门房，负责收信和回信
- **Service**：真正执行业务规矩的账房
- **Trace**：一次请求一路经过哪些地方的脚印串

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 认证中间件生成 typed Principal；Handler 显式把 TenantID/UserID 传给 Service 做授权。
- 请求 body 有大小上限，JSON 拒绝未知字段；解码后显式执行字段校验，再进入领域校验。
- context 传递 deadline、取消和 trace，不隐藏必须参与授权与落库的业务身份。
- 稳定错误 code 属于 HTTP 契约，内部 cause 不对客户端泄露。

## 7. 看代码别慌

- 先看 Create 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Create 的出口：成功交回什么，失败留下什么证据。

```go
type Principal struct { TenantID, UserID string }

func (h *Handler) Create(c *gin.Context) {
    principal, ok := PrincipalFrom(c)
    if !ok {
        writeError(c, 401, "unauthorized"); return
    }
    var req CreateBillRequest
    if err := decodeStrictJSON(c, &req, 1<<20); err != nil {
        writeError(c, 400, "invalid_request"); return
    }
    if err := h.requestValidator.Struct(req); err != nil {
        writeError(c, 422, "invalid_request_fields"); return
    }
    cmd := CreateBill{
        AmountCents: req.AmountCents, Category: req.Category,
    }
    bill, err := h.service.Create(
        c.Request.Context(), principal, cmd)
    writeResult(c, bill, err)
}
```

## 8. 最容易怎么翻车

- 直接 bind 到数据库模型
- 状态码永远 200
- 信任客户端传来的 user_id

## 9. 动手与验收

**动手：** 实现创建账单 Handler，覆盖缺少 Principal、未知 JSON 字段、超大 body 和越权租户。

**过关：** TenantID/UserID 从服务端认证上下文生成并显式入参；Service 完成授权；响应状态与错误 code 稳定。

## 10. 后续图解位置

- `go-project-architecture`（文字通过审核后再排图）
- `struct-json-pipeline`（文字通过审核后再排图）

## 11. 自己问自己

**问：binding 与业务校验如何分工？**

答：陈平安：binding 只检查 HTTP 输入的形状、类型和基础约束，Service 再检查 1500 分奶茶账的业务规则与权限；宁姚：对，门口验包裹，城内判能不能办。

**问：user_id 应从哪里来？**

答：陈平安：user_id 和 tenant_id 来自验证 JWT/OIDC 后生成的 typed Principal，不能相信 body、path 或任意 header；宁姚：答对，身份必须从可信边界进入。

**问：为何不把所有响应都写成 200？**

答：陈平安：HTTP 状态表达传输结果，稳定 error code 表达业务原因，失败全回 200 会让客户端、代理和监控误判；宁姚：闭合，201、400、401、404/403 与 409 各守自己的语义。

## 12. 下一站

bill-0827 已通过 HTTP 边界，但 Handler 手里还握着业务判断和存取动作；这正好把问题推到第 10 章的分层。

## 补充 9.1　先学数据怎么流

门口的测试机递来一卷看不到尽头的请求体，进度条像被胶带粘住一样不动。

陈平安直接 io.ReadAll，内存报警先响，JSON 解码器还没等到文件尾。

### 群聊

> **陈景清：** 我景清大口吞吐，管它几个 G 的日志，一口气读进内存！
>
> **阿良：** OOM 阎王爷一勾笔，你这条大水龙也得当场翻肚皮。
>
> **阮秀：** 细水长流才是吃水之道，狂饮暴灌伤肠胃。
>
> **文圣：** 有容乃大更需知节制！流式 Reader 边读边析，守住内存！
>
> **周米粒：** 小小口慢慢喝，才不会呛得直咳嗽！
>
> **宁姚：** IO 读取必设上限，禁止无界 slurp 进内存。

*那卷纸终于在桌沿前被裁成了规定长度。*

### 小白一句话

io.Reader 和 io.Writer 把文件、网络与内存统一成流式边界。

### 像什么

像接水管：水会一段段来，桶有大小，接水人可能走开；必须规定谁关龙头、桶满怎么办、最后一次没水时有没有夹着错误纸条。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- Reader 允许分块读取；一次 Read 返回的数据和错误都要一起处理。
- Writer 可能短写，优先使用 io.Copy 等已处理循环的标准工具。
- LimitedReader 在进入解码器前限制输入体积，避免无界内存占用。
- Closer 的关闭责任要在获得资源的边界明确登记。

### 看代码

- 先看 copyLimited 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 copyLimited 的出口：成功交回什么，失败留下什么证据。

```go
func copyLimited(dst io.Writer, src io.Reader) error {
    lr := &io.LimitedReader{R: src, N: 1<<20 + 1}
    n, err := io.Copy(dst, lr)
    if err != nil { return err }
    if n > 1<<20 { return ErrTooLarge }
    return nil
}
```

**动手：** 用 strings.Reader 模拟小输入和超限输入，测试复制结果与错误。

**过关：** 实现不一次性读入全部数据；超限可识别；写入错误能返回调用方。

**接着去哪：** 输入流已被限制，接下来处理 HTTP 超时、状态码、响应体关闭与连接复用。

## 补充 9.2　HTTP 默认值不是生产配置

测试服务回了一封 HTTP 500，响应体还在慢慢滴字节；连接池面板少了一格可用连接。

陈平安只看 Do 没返回 error，便把 req-0827 记成成功，连 Body 也忘了关。

### 群聊

> **阿良：** Client 不配超时直接发，对面要是睡着了，你就在这陪葬。
>
> **阮秀：** 灶火不熄，空耗柴火，迟早连灶台都给烧塌了。
>
> **李宝瓶：** 连接池不配 MaxIdle，连接数泄露，操作系统直骂娘！
>
> **老瞎子：** 空等八百年还不撒手？带上 context 超时，断线立斩！
>
> **阮秀：** 温茶待客有定时，人走茶凉便收席。
>
> **宁姚：** 双向超时必须闭环，服务端拒长连接，客户端限等待。

*那封 500 回信被夹进故障样本册，不再冒充喜讯。*

### 小白一句话

请求生命周期要有超时、状态检查、Body 关闭和大小限制。

### 像什么

像寄一封限时快递：要写最晚送达时间，收到回信要看状态，拆完箱子要关好 Body；快递员没迷路，不等于收件人回的是好消息。

### 黑话翻译

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **HTTP**：客户端和服务端互寄有格式的信

### 技术真相

- 复用带超时配置的 http.Client；Do 只报告传输错误，非 2xx 由调用方判断。
- 拿到 Response 后立即 defer Body.Close，成功与失败响应都限制读取体积。
- 小型非 2xx 响应在上限内 drain 到 EOF 后关闭，以便 Transport 复用连接。
- 错误体超过 drain 上限时立即停止读取并关闭，明确接受该连接不再复用。

### 看代码

- 先看 fetch 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 fetch 的出口：成功交回什么，失败留下什么证据。

```go
var ErrHTTPStatus = errors.New("unexpected HTTP status")

const (
    maxBody       = int64(1 << 20)
    maxErrorDrain = int64(64 << 10)
)

func fetch(ctx context.Context, c *http.Client, url string) error {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil { return err }
    res, err := c.Do(req)
    if err != nil { return err }
    defer res.Body.Close()

    if res.StatusCode < 200 || res.StatusCode >= 300 {
        statusErr := fmt.Errorf("%w: %d", ErrHTTPStatus, res.StatusCode)
        n, drainErr := io.CopyN(io.Discard, res.Body, maxErrorDrain+1)
        if drainErr != nil && !errors.Is(drainErr, io.EOF) {
            return errors.Join(statusErr, drainErr)
        }
        if n > maxErrorDrain {
            return fmt.Errorf("%w: drain limit; no reuse", statusErr)
        }
        return statusErr
    }

    n, err := io.Copy(io.Discard, io.LimitReader(res.Body, maxBody+1))
    if err != nil { return err }
    if n > maxBody { return ErrTooLarge }
    return nil
}
```

**动手：** 用 httptest.Server 连续返回小型 500、超大 500 和超限 2xx，观察连接复用与读取上限。

**过关：** 小型非 2xx 可复用连接；超大错误体有界关闭且明确放弃复用；所有路径关闭 Body 并无 goroutine 泄漏。

**接着去哪：** Client 与 Server 的生命周期已明确，下一步在不绑定固定端口的情况下验证整套 HTTP 契约。

## 补充 9.3　在进程内测完整 HTTP

临时测试桌上没有固定端口，只有一个 Recorder、一个测试 Server 和三张状态码卡片。

陈平安直接调用 Handler 得到 nil，真实路由却把 POST 写成了 GET，Content-Type 也不见了。

### 群聊

> **阿良：** 我只验 Handler 会炒菜，忘了看店门是不是开在后墙。
>
> **阮秀：** 所以函数返回 nil，也证明不了真实请求路由正确？
>
> **李宝瓶：** 路由、POST、Content-Type、未知字段和取消路径呢？
>
> **陈平安：** Recorder 验单个处理器，NewServer 验完整链路。
>
> **阮秀：** 再逐项断言状态、Content-Type 和稳定 JSON 字段。
>
> **李宝瓶：** 再关闭 Server 与 Body，不抢固定端口。这样才叫契约测试。

*三张状态码卡片终于都找到了自己的测试用例。*

### 小白一句话

httptest 能验证路由、状态、头部和响应体，而不依赖固定端口。

### 像什么

像在排练室搭一座迷你城门：不用占真实街道，也能把路由、请求头、状态码和回信正文从头走一遍。

### 黑话翻译

- **HTTP**：客户端和服务端互寄有格式的信
- **Handler**：门房，负责收信和回信

### 技术真相

- NewRequest 与 NewRecorder 适合快速断言 handler 的状态和响应体。
- NewServer 提供临时 URL，覆盖客户端、路由和真实传输交互。
- 断言 Content-Type、状态码和稳定字段，不只查正文包含某段文字。
- 测试服务器必须 Close；客户端重定向策略应按场景显式配置。

### 看代码

- 先看 TestHealth 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 最后核对 TestHealth 的出口：成功交回什么，失败留下什么证据。

```go
func TestHealth(t *testing.T) {
    req := httptest.NewRequest("GET", "/health", nil)
    rec := httptest.NewRecorder()
    healthHandler(rec, req)
    res := rec.Result()
    defer res.Body.Close()
    if res.StatusCode != http.StatusOK {
        t.Fatalf("status=%d", res.StatusCode)
    }
}
```

**动手：** 为一个 JSON handler 增加成功、未知字段和方法不允许三组 HTTP 测试。

**过关：** 测试断言状态、Content-Type 与 JSON 契约；不绑定固定端口。

**接着去哪：** HTTP 契约已有可重复证据，接下来验证请求携带的身份是否可信。

## 补充 9.4　补页 9.A 身份从哪里来：JWT 与 OIDC

登录页旁放着一枚拆开的 JWT，header 和 payload 清清楚楚，签名校验灯却还没亮。

陈平安看见 token 里写着 tenant-7，便相信了客户端自填的 user_id，冒名请求险些进账。

### 群聊

> **陆沉：** 道友请看，这假令牌印章虽真，内里乾坤早已改头换面。
>
> **阮秀：** 挂羊头卖狗肉的事，见得多了，先看骨肉对不对。
>
> **李宝瓶：** JWT 验签只是第一步，过期时间、签发者和受众缺一不可！
>
> **文圣：** 验明正身关乎道统大义！公钥轮转配缓存，过期当场打回！
>
> **周米粒：** 小通关文牒要对对准，缺个红印子都不许进城！
>
> **宁姚：** 无状态校验与本地黑名单结合，撤回令牌秒级失效。

*签名校验灯亮起后，那枚 token 才被放进通行盒。*

### 小白一句话

Token 能拆开，不等于身份可信。

### 像什么

像看学生证：能把塑料卡掰开，不等于卡是真的。要验签名、发行学校、使用场所和有效期，最后再生成系统信得过的身份。

### 黑话翻译

- **缓存**：为了快而做的副本，不是最终事实
- **Trace**：一次请求一路经过哪些地方的脚印串
- **tenant**：同一系统里互相不能偷看账本的一户人家

### 技术真相

- 只在 TLS 与可信代理边界后接收凭证，不能信任请求体或任意 X-Tenant-ID。
- JWT 验证固定算法白名单，并核对 issuer、audience、exp、nbf 与 clock skew。
- JWKS 按 kid 缓存；未知 kid 只触发有界刷新，轮换期同时接受明确的新旧密钥。
- OIDC claim 映射为 typed Principal；原始 claim 不直接成为业务授权结论。
- 认证失败统一返回 401 和稳定 code，日志只留 token 指纹，不留原始 token。

### 看代码

- 先看 Verify 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Verify 的出口：成功交回什么，失败留下什么证据。

```go
func Verify(raw string, now time.Time) (Principal, error) {
    tok, err := verifier.Verify(raw, now, allowedLeeway)
    if err != nil { return Principal{}, ErrUnauthenticated }
    if tok.Iss != wantIss || !tok.HasAudience(wantAud) {
        return Principal{}, ErrUnauthenticated
    }
    if tok.Subject == "" || tok.Tenant == "" {
        return Principal{}, ErrUnauthenticated
    }
    if !membership.Allows(tok.Subject, tok.Tenant) {
        return Principal{}, ErrUnauthenticated
    }
    return Principal{
        UserID: tok.Subject, TenantID: tok.Tenant,
    }, nil
}
```

**动手：** 注入伪造签名、错误 audience、过期 token、未知 kid 和轮换中的旧 kid。

**过关：** 五类非法凭证全部返回稳定 401；合法凭证生成 Principal；日志与 trace 不出现原始 token。

**接着去哪：** 身份可信之后，仍要验证这个主体是否有权创建或读取 bill-0827。

## 补充 9.5　补页 9.B 过了山门，还要问能不能动这本账

认证门禁已经放行，桌上却并排摆着 tenant-7 的两本账簿，封面主人并不相同。

陈平安只确认来人已登录，就把 bill-0827 递了过去，对象权限根本没问。

### 群聊

> **阿良：** 换了个 ID 就把别人账单全看光，这接口可真够仗义的。
>
> **左右：** 剑不问人，人当自律，不可妄窥。
>
> **李宝瓶：** 水平越权！查账单必须带上当前登录人的租户和所属人！
>
> **老瞎子：** 光验身份不验归属，开门揖盗，老瞎子一棍子全打断腿！
>
> **阮秀：** 自家的碗自家端，伸到别人锅里算怎么回事。
>
> **宁姚：** SQL 查询强制拼接租户与主体条件，底层防越权。

*两本账簿重新合上，各自回到有名字的抽屉。*

### 小白一句话

认证回答你是谁，授权回答这件事你能不能做。

### 像什么

门卫认出你是小明，只回答了‘你是谁’；小明能不能拿走小红的书，还要再查这本书归谁、这次动作允不允许。

### 黑话翻译

- **error**：事情没办成时一起带回来的原因条
- **Handler**：门房，负责收信和回信
- **Service**：真正执行业务规矩的账房
- **tenant**：同一系统里互相不能偷看账本的一户人家

### 技术真相

- Handler 只提取 Principal；Service 对 create、read、update、delete 分别做授权。
- 对象级策略至少绑定 tenant、subject、role/policy version 与资源状态。
- 403 表示身份可信但权限不足；为防资源枚举可按既定策略返回 404。
- 拒绝路径写入稳定 error code、audit_id、policy version，不泄露对象内容。
- 角色降权、成员移出租户和资源转移都要让旧授权及时失效。

### 看代码

- 先看 Get 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Get 的出口：成功交回什么，失败留下什么证据。

```go
func (s *Service) Get(
    ctx context.Context, p Principal, id string,
) (Bill, error) {
    bill, err := s.repo.Get(ctx, p.TenantID, id)
    if err != nil { return Bill{}, err }
    if !s.policy.CanRead(p, bill) {
        return Bill{}, ErrNotFound
    }
    return bill, nil
}
```

**动手：** 覆盖同租户无权对象、跨租户 ID、降权旧 token、资源不存在四种读取。

**过关：** 四条路径符合既定 403/404 契约；拒绝均有 audit_id；任何响应都不泄露对象是否存在。

**接着去哪：** 对象授权有了规则，还需确认中间件次序、超时和优雅关闭不会绕开规则。

## 补充 9.6　补页 9.C 中间件有顺序，Server 也有收剑时刻

关服演练开始，request ID 贴纸、限流器和 readiness 开关排成一列，SSE 连接还在另一块屏幕上闪。

panic 先于编号中间件发生，客户端只收到半截 JSON；SIGTERM 又直接掐断了在途请求。

### 群聊

> **周米粒：** panic 接住啦，可事故请求没贴 request ID，病历找不到！
>
> **李宝瓶：** 原来 recovery 在前也没用，编号必须先进入固定次序。
>
> **阮秀：** 慢 body 和 SSE 还共用一把读写时限？
>
> **陈平安：** 固定 request ID、恢复、认证、限流、Handler 的次序。
>
> **李宝瓶：** SIGTERM 时先摘 readiness，再有界等待普通请求。
>
> **宁姚：** SSE 与 hijacked 连接单独治理。长跑的人别套短跑秒表。

*最后一张 request ID 贴纸稳稳留在完整响应旁。*

### 小白一句话

门口先编号再验人，关门先摘流量再等在途请求。

### 像什么

像商场关门：先给每位来客发编号，再验身份；打烊时先不放新人进来，然后等正在结账的人办完，不能突然拔总电闸。

### 黑话翻译

- **Handler**：门房，负责收信和回信
- **SSE**：服务端向浏览器单向喊话的小喇叭

### 技术真相

- 可信代理名单决定是否采信 Forwarded/X-Forwarded-For，不能全网信任。
- 统一校验 Content-Type、body 上限、request ID、panic recovery 与错误响应。
- ReadHeaderTimeout 只守 header；非流式 body/write 还要用 ReadTimeout、WriteTimeout 或 Handler 级 deadline。
- 关闭时先让 readiness 失败，再用 Shutdown 等待普通在途请求。
- SSE、流式上传和 hijacked 连接需按路由单独治理，不能照搬统一读写时限。

### 看代码

- 先看 newServer 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 newServer 的出口：成功交回什么，失败留下什么证据。

```go
func newServer(cfg Config, router http.Handler) *http.Server {
    // SSE uses a dedicated streaming server with route-level deadlines.
    return &http.Server{
        Addr: cfg.Addr, Handler: middlewareChain(router),
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second,
        IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20,
    }
}

func stop(srv *http.Server) error {
    var errs []error
    readiness.Store(false)
    drain, cancelDrain := context.WithTimeout(
        context.Background(), 5*time.Second)
    if err := waitForEndpointRemoval(drain); err != nil {
        errs = append(errs, fmt.Errorf("drain: %w", err))
    }
    cancelDrain()
    closeHijackedConnections()
    stop, cancelStop := context.WithTimeout(
        context.Background(), 10*time.Second)
    if err := srv.Shutdown(stop); err != nil {
        errs = append(errs, err)
        if closeErr := srv.Close(); closeErr != nil {
            errs = append(errs, closeErr)
        }
    }
    cancelStop()
    return errors.Join(errs...)
}
```

**动手：** 真实启动 Server，注入慢 header、慢 body、panic、SSE 与 SIGTERM。

**过关：** 非流式 header/body 均按时限收口；SSE 不被误杀；panic 不写半截 JSON；摘流后在途请求有界完成。

**接着去哪：** HTTP 边界已经站稳，下一章沿同一请求拆开 Handler、Service 与 Repository。

---

# 第十章  城中三层：Handler、Service、Repository

**本章要解决：** 分清协议、业务与持久化职责，能通过构造函数注入替换依赖。

## 1. 闯祸现场

白板上画着 Handler、Service、Repository 三个方框，数据库连接串像一把沉甸甸的钥匙挂在陈平安手边。

他嫌绕路，直接在 Handler 里写 SQL，结果授权规则一改，HTTP 测试和数据库测试一起红了。

## 2. 群聊

> **阿良：** 接口要是全堆在最外层，哪个毛贼溜进来都能翻箱倒柜。
>
> **左右：** 内方外圆，门禁不可轻忽。
>
> **李宝瓶：** Handler 负责解析协议参数，校验业务交给 Service！
>
> **文圣：** 各司其职才叫体统！Handler 翻协议，Service 掌权核验！
>
> **阮秀：** 门外是门外的客套，门内是门内的规矩。
>
> **宁姚：** 越权访问零容忍，对象所有权逐条审查。

*数据库钥匙被放回了 Repository 方框下面。*

## 3. 小白一句话

协议在门外，规矩在城中，存取在库房。

## 4. 像什么

门房别一边验信一边钻进库房翻箱子。Handler 收信，Service 判规矩，Repository 存取账本，各站各的岗，坏了才知道该找谁。

## 5. 先拆黑话

- **Context**：沿调用链传下去的取消铃和截止钟
- **HTTP**：客户端和服务端互寄有格式的信
- **Handler**：门房，负责收信和回信
- **Service**：真正执行业务规矩的账房
- **Repository**：专门和数据库打交道的库管
- **事务**：要么整组成功，要么整组撤回

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- Handler 负责协议、认证结果提取和 HTTP 错误翻译，不把 Gin Context 传入业务层。
- Service/use case 负责授权、业务规则和事务编排。
- Repository 只暴露当前用例需要的最小能力，并返回领域或持久化错误。
- composition root 负责注入 SQLRepository 或 FakeRepository，不把依赖选择藏在业务代码里。

## 7. 看代码别慌

- 先看 Create 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Create 的出口：成功交回什么，失败留下什么证据。

```go
type BillRepository interface {
    Save(context.Context, Bill) (Bill, error)
}

type Service struct { repo BillRepository }
func (s *Service) Create(
    ctx context.Context, p Principal, cmd CreateBill,
) (Bill, error) {
    if !p.CanWriteBills() { return Bill{}, ErrForbidden }
    bill, err := NewBill(p.TenantID, p.UserID, cmd)
    if err != nil { return Bill{}, err }
    return s.repo.Save(ctx, bill)
}

type Handler struct {
    service *Service
}
// Only Handler translates domain errors to HTTP.
```

## 8. 最容易怎么翻车

- init 中连数据库
- 依赖由业务包偷偷创建
- readiness 永远返回 200

## 9. 动手与验收

**动手：** 用 FakeRepository 测试 Service 的授权失败、领域校验失败和持久化失败。

**过关：** 测试不启动 HTTP/数据库即可证明分层；Repository 错误只在 Handler 边界翻译为状态码。

## 10. 后续图解位置

- `handler-service-repository-flow`（文字通过审核后再排图）
- `request-dependency-sequence`（文字通过审核后再排图）

## 11. 自己问自己

**问：Repository 可以返回 HTTP 状态吗？**

答：陈平安：Repository 只返回数据结果和可识别领域/存储错误，不返回 HTTP 状态；宁姚：对，由 Handler 在协议边界统一映射状态码和错误体。

**问：Service 为什么不接 Gin Context？**

答：陈平安：Service 可以接标准 context.Context，却不接 gin.Context，否则业务会被 Gin 绑住；宁姚：准确，这样 HTTP、Worker 和测试都能复用同一业务层。

**问：分层价值如何用测试证明？**

答：陈平安：给 Service 注入 fake Repository，给 Handler 注入 fake Service，分别验证业务与协议，不启动无关依赖；宁姚：这就用可替换测试证明了分层价值。

## 12. 下一站

bill-0827 已按 Handler -> Service -> Repository 落到数据库边缘；重复的 req-0827 随即把事务与幂等问题暴露出来。

## 补充 10.1　补页 10.A 多租户不是一个 Header

Repository 查询窗口里只有 bill_id，没有 tenant_id；两张不同租户的同号账单在结果列表里挨到了一起。

Service 明明传下了 tenant-7，SQL 却把这道条件丢在门外，测试立即捞回了别人的账。

### 群聊

> **崔东山：** 先生！多个租户混在同一张表里，学生随便捞捞全捞出来啦！
>
> **阿良：** 你小子唯恐天下不乱，这要是传出去，落魄山赔掉底裤。
>
> **李宝瓶：** 数据隔离是企业底线！每个租户的数据必须带 tenant_id！
>
> **文圣：** 界限分明方成天地！上下文注入租户，仓储层层层把关！
>
> **宁姚：** 缺失租户标识的请求在网关层直接拒绝，绝不流入内网。
>
> **周米粒：** 各回各家，各找各妈，谁也不许踩别人家门槛！

*两张同号账单被 tenant 标签分进了不同抽屉。*

### 小白一句话

应用层守一次，查询层再落一道 tenant 铁门。

### 像什么

像公寓楼的信箱：门牌写 tenant，钥匙来自可信门卫。应用先核一次，数据库查询再带一次门牌条件，不能靠住户自己喊‘我是七楼的’。

### 黑话翻译

- **Repository**：专门和数据库打交道的库管
- **tenant**：同一系统里互相不能偷看账本的一户人家

### 技术真相

- TenantID 只来自可信 Principal，不来自 header、path 或 body 的自由输入。
- Repository API 强制接收 tenant；查询、更新、删除都在 SQL 中带 tenant 条件。
- 唯一约束与外键优先包含 tenant_id，避免同号对象跨租户串联。
- PostgreSQL RLS 可作纵深防御，但连接复用时必须正确设置并清理会话租户。
- 管理任务与跨租户报表使用独立 capability、连接角色和审计通路。

### 看代码

- 先看 Get 的输入和返回值：它接什么，最后必须交回什么。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Get 的出口：成功交回什么，失败留下什么证据。

```go
const getBill = `
SELECT id, amount_cents, version
FROM bills
WHERE tenant_id = $1 AND id = $2`

func (r *Repo) Get(ctx context.Context,
    tenant, id string) (Bill, error) {
    row := r.db.QueryRowContext(ctx, getBill, tenant, id)
    return scanBill(row)
}
```

**动手：** 在普通 API、后台任务和导出查询中各注入一次缺失 tenant 条件。

**过关：** 静态 SQL 断言或集成测试捕获三处遗漏；RLS 再拒绝跨租户访问；审计能区分普通与管理通路。

**接着去哪：** 租户边界已经落到查询层，下一步处理 req-0827 重放造成的重复写。

---

# 第十一章  真账本：SQL、事务与幂等

**本章要解决：** 掌握金额表示、schema、事务、唯一约束、幂等和兼容迁移。

## 1. 闯祸现场

手机网络转了一圈，req-0827 又落到桌面；账本旁边放着一枚写有 amount_cents=1500 的印章。

陈平安先查数据库没看见旧记录，两次并发请求便同时落笔，奶茶账凭空多了一份。

## 2. 群聊

> **崔东山：** 先生！学生刚才转账转到一半断电，灵石凭空消失在虚空里啦！
>
> **阿良：** 转账不用事务，好比去青楼先给钱却被人踹出门，纯属大冤种。
>
> **李宝瓶：** 扣款和入账必须在一个 sql.Tx 里面，要么全成，要么全撤。
>
> **陈平安：** 事务提交失败不能盲目重试，先查明确状态或依靠幂等键。
>
> **宁姚：** 原子写入不容打折；任何跨行操作都要上好排他锁。
>
> **周米粒：** 右护法记在小本本上啦，一颗雪花钱都不能漏记！

*那枚印章只落下一次，桌面总算安静了。*

## 3. 小白一句话

钱不用浮萍称，去重靠最后一道铁门。

## 4. 像什么

数据库像真账房。转账不能只改左边不改右边；同一张付款单拍桌子两次，也不能扣两次钱。事务守整锅，幂等守重复。

## 5. 先拆黑话

- **事务**：要么整组成功，要么整组撤回
- **幂等**：同一件事喊两遍，也只真正办一次
- **tenant**：同一系统里互相不能偷看账本的一户人家

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 幂等唯一键必须绑定 tenant、认证主体或明确共享范围、动作 scope 与 key；同主体同 key 不同 payload 才稳定返回 409。
- IdempotencyRecord 与 claim 在同一事务里保存 SubjectID 和请求指纹；读取任何 hash/status 前先核对主体边界，避免同租户状态探针。
- 原子 Claim 先落 processing；完成后只保存稳定 result ref，不复制副作用结果。
- 命中 completed 旧记录时仍按当前 Principal 和当前 Bill 状态重新授权，不能把幂等键当读取凭证。
- 数据库唯一约束覆盖 tenant+subject+action+key；跨主体或跨租户碰撞彼此独立，保留期与清理策略书面固定。

## 7. 看代码别慌

- 先看 Create 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 Create 的出口：成功交回什么，失败留下什么证据。

```go
type IdempotencyRecord struct {
    TenantID, SubjectID, Action, Key string
    RequestHash, Status, ResultRef string
}

func (s *Service) Create(
    ctx context.Context, p Principal, cmd CreateBill,
) (Bill, error) {
    if !p.CanWriteBills() { return Bill{}, ErrForbidden }
    claim := IdempotencyClaim{
        TenantID: p.TenantID, SubjectID: p.SubjectID,
        Action: "bill:create", Key: cmd.Key,
        RequestHash: canonicalHash(cmd),
    }
    record, claimed, err := s.idem.Claim(ctx, claim)
    if err != nil { return Bill{}, err }
    if !claimed {
        if record.TenantID != p.TenantID ||
            record.SubjectID != p.SubjectID {
            return Bill{}, ErrNotFound
        }
        if record.RequestHash != claim.RequestHash {
            return Bill{}, ErrIdempotencyConflict
        }
        if record.Status == "processing" {
            return Bill{}, ErrIdempotencyInProgress
        }
        if record.Status != "completed" {
            return Bill{}, ErrIdempotencyRetryable
        }
        bill, err := s.bills.GetByRef(ctx, p.TenantID, record.ResultRef)
        if err != nil { return Bill{}, err }
        if !s.policy.CanRead(p, bill) { return Bill{}, ErrNotFound }
        return bill, nil
    }
    return s.createAndComplete(ctx, p, record, cmd)
}
```

## 8. 最容易怎么翻车

- 金额用浮点
- 把事务当成跨服务万能锁
- 只在应用层做重复检查

## 9. 动手与验收

**动手：** 并发提交同主体同 key 同/异 payload、同租户不同 SubjectID 和跨租户碰撞，再模拟 Commit 回包丢失与完成后撤权。

**过关：** 同主体同摘要只写一次、异摘要 409；不同主体各自独立且看不到对方 hash/status；旧结果仍按当前对象权限授权。

## 10. 后续图解位置

- `idempotency-sequence`（文字通过审核后再排图）

## 11. 自己问自己

**问：为何先查再写不能防并发重复？**

答：陈平安：先查再写之间仍有并发窗口，两个 req-0827 都可能查到不存在；宁姚：对，必须靠同事务幂等占位和数据库唯一约束作最后裁决。

**问：事务与幂等有何不同？**

答：陈平安：事务保证单次尝试原子，幂等识别多次尝试是否同一请求；宁姚：答对，所以 Commit unknown 不能盲重放，要拿 req-0827 查稳定结果。

**问：金额字段为何带单位？**

答：陈平安：amount_cents 明写最小整数单位，1500 就是 15 元，既避开浮点误差也避免单位歧义；宁姚：正确，跨 API、库表和事件都保持同一口径。

## 12. 下一站

req-0827 的重复写已被幂等记录和唯一约束收住，bill-0827 与 BillCreated 同事务落地；随后出现的是缓存旧值。

## 补充 11.1　补页 11.A 事务模板与 Commit 结果不确定

事务面板停在 Commit，网络线图标忽然断开，req-0827 的回信没有回来。

陈平安把 Commit error 当成未落账，准备再写一次；数据库里却可能已经有 bill-0827。

### 群聊

> **阿良：** 钱扣了，账单没生成，半路断电，客户提刀来找你。
>
> **左右：** 一诺既出，生死同舟，成则俱成，败则俱退。
>
> **李宝瓶：** 事务助手函数，把 Commit 和 Rollback 封进闭包里！
>
> **老瞎子：** 出错了还敢 Commit？老瞎子都替你羞愧！panic 也得滚回！
>
> **阮秀：** 要么同甘共苦，要么一拍两散，没有半吊子规矩。
>
> **宁姚：** 严禁在事务内执行外部网络调用，保持事务短小纯粹。

*断开的网线旁，多了一张醒目的 Unknown 标签。*

### 小白一句话

Rollback 能收残局，Commit 失败却未必说明没落账。

### 像什么

像小卖部结账：扣库存、收钱、记流水是一只托盘，要么一起端走，要么一起退回。可收银机吐纸失败时，钱到底扣没扣，不能只凭没看到小票判断。

### 黑话翻译

- **Repository**：专门和数据库打交道的库管
- **事务**：要么整组成功，要么整组撤回
- **幂等**：同一件事喊两遍，也只真正办一次
- **outbox**：和业务账一起落库、之后再送出的发件箱

### 技术真相

- 事务 helper 统一 BeginTx、defer Rollback、panic 收口和 Commit 错误分类。
- 所有参与原子性的 Repository 方法必须使用同一个 *sql.Tx。
- 业务错误回滚；Commit 返回错误时结果可能未知，不能盲目重放非幂等写。
- 外部网络调用不放进长事务；先落状态/outbox，再由事务外执行。
- 记录 tx duration、rollback cause 与 commit ambiguity，禁止记录敏感 SQL 参数。

### 看代码

- 先看 WithTx 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 WithTx 的出口：成功交回什么，失败留下什么证据。

```go
func WithTx(ctx context.Context, db *sql.DB,
    fn func(*sql.Tx) error) (err error) {
    tx, err := db.BeginTx(ctx, nil)
    if err != nil { return TxError{Stage: "begin", Err: err} }
    defer func() {
        if p := recover(); p != nil {
            _ = tx.Rollback(); panic(p)
        }
        if err != nil { _ = tx.Rollback() }
    }()
    if err = fn(tx); err != nil {
        return TxError{Stage: "body", Err: err}
    }
    if err = tx.Commit(); err != nil {
        return TxError{Stage: "commit", Err: err, Unknown: true}
    }
    return nil
}
```

**动手：** 分别在 Begin、业务写、Commit 回包三个位置注入错误，并模拟 Commit 后连接断开。

**过关：** 无连接泄漏；业务失败必回滚；Commit 不明不直接重复副作用，并可凭幂等记录查询稳定结果。

**接着去哪：** Commit 不确定性已有查询出口，下一页转向同一账单的并发更新冲突。

## 补充 11.2　补页 11.B 隔离级别不是越高越好

两台设备同时打开 bill-0827，屏幕上都显示 version=3，一边改金额，一边等保存。

陈平安只看 UPDATE 影响零行就返回冲突，连不存在和跨租户对象也被一起暴露成了 409。

### 群聊

> **崔东山：** 先生！学生同时开两笔事务扣同一张账单，怎么灵石被扣了双份！
>
> **宁姚：** 读已提交防不住并发修改；没上 SELECT FOR UPDATE 也敢算账？
>
> **阿良：** 行级排他锁锁住这条记录，后面的人老老实实排队等交割。
>
> **陈平安：** 根据业务场景排他锁定，或基于版本号做乐观锁 CAS 校验。
>
> **李宝瓶：** 锁的范围越精准越好，持有时间越短，并发吞吐越高。
>
> **周米粒：** 落魄山账本铁面无私，一把锁锁死，谁也别想插队扣灵石！

*两台设备一台保存成功，另一台老实地重新读取。*

### 小白一句话

锁住一行、校验版本、重跑事务，三把剑各有代价。

### 像什么

像只剩一个限量玩具：先把那一格锁住，再核对你看到的版本；别人已经买走时叫版本冲突，不存在或不是你的玩具则不能假装成冲突。

### 黑话翻译

- **HTTP**：客户端和服务端互寄有格式的信
- **事务**：要么整组成功，要么整组撤回
- **tenant**：同一系统里互相不能偷看账本的一户人家
- **owner**：这份资源真正归属的那个人或主体

### 技术真相

- 先在可信 tenant/owner 作用域内读取当前对象；不存在或越界统一返回 ErrNotFound。
- 当前 version 与 expected version 不同才是 ErrConflict，并映射 HTTP 409/bill_version_conflict。
- 持锁后更新仍非一行属于内部一致性错误，不能把不存在或越界伪装成版本冲突。
- 只对白名单 deadlock/serialization failure 重试整个事务；ErrConflict 交给调用方重新读取。

### 看代码

- 先看 UpdateBill 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 UpdateBill 的出口：成功交回什么，失败留下什么证据。

```go
var ErrConflict = errors.New("bill version conflict")

func (r *Repo) UpdateBill(ctx context.Context, tx *sql.Tx,
    tenantID, id string, expected, amount int64) error {
    // Both helpers scope every query by tenantID + id.
    current, err := r.lockVersion(ctx, tx, tenantID, id)
    if errors.Is(err, sql.ErrNoRows) { return ErrNotFound }
    if err != nil { return err }
    if current != expected { return ErrConflict }
    rows, err := r.updateAtVersion(
        ctx, tx, tenantID, id, expected, amount)
    if err != nil { return err }
    if rows != 1 { return ErrInvariant }
    return nil
}
```

**动手：** 并发修改同一 bill：验一次成功、一次版本冲突；不存在与跨租户 ID 均返回 ErrNotFound。

**过关：** 过期 version 稳定返回 409/bill_version_conflict；不存在与跨租户对象不泄露存在性；成功更新不会覆盖先提交版本。

**接着去哪：** 并发更新已能判冲突，还要把每实例连接池放回数据库总容量中计算。

## 补充 11.3　补页 11.C 连接池是一道总容量预算

容量白板上画着十个服务副本，每个副本都把 MaxOpenConns 写成了五十。

陈平安只看单实例等待很短，数据库门口却被五百条连接和迁移任务一起堵住。

### 群聊

> **崔东山：** 先生！学生把最大连接数开到一万，数据库连不上啦！
>
> **阿良：** 车道就那么宽，塞一万辆马车全堵在城门口骂娘。
>
> **李宝瓶：** 连接池要算好 CPU 核心与 IO 延迟，贪多嚼不烂！
>
> **文圣：** 过犹不及！连接过多反成内耗，配好最大空闲与生命周期！
>
> **阮秀：** 灶头有限，几口锅伺候几道菜，盲目架锅只能烧干火。
>
> **宁姚：** 连接池耗尽抛明晰超时，监控告警驱动合理容量调整。

*白板上的五百被圈住，旁边终于写上了总预算。*

### 小白一句话

每座院子十口井，十座院子就是一百口。

### 像什么

连接池像食堂座位：每桌只摆十把椅子，十个服务就是一百把。椅子开得太多，厨房先被挤爆；太少，门口又排长队。

### 黑话翻译

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **Context**：沿调用链传下去的取消铃和截止钟

### 技术真相

- 连接池不是吞吐开关；数据库 CPU、锁和 max_connections 才是总边界。
- 配置 MaxOpen、MaxIdle、ConnMaxLifetime 与 ConnMaxIdleTime，并加入随机抖动。
- 查询必须带 context deadline；rows、stmt 与 tx 都要在所有路径关闭。
- 扩容前计算实例总池、迁移 job、只读副本和运维保留连接。
- 池饱和时明确拒绝或降级，不能让请求无限等待并拖垮 goroutine。

### 看代码

- 先看 ConfigurePool 的输入和返回值：它接什么，最后必须交回什么。
- 最后核对 ConfigurePool 的出口：成功交回什么，失败留下什么证据。

```go
func ConfigurePool(db *sql.DB, c PoolConfig) {
    db.SetMaxOpenConns(c.MaxOpen)
    db.SetMaxIdleConns(c.MaxIdle)
    db.SetConnMaxLifetime(c.MaxLifetime)
    db.SetConnMaxIdleTime(c.MaxIdleTime)
}

// instances*MaxOpen + jobs + ops < DB max_connections
```

**动手：** 用多实例预算模拟池饱和、慢查询、请求取消与连接生命周期集中到期。

**过关：** 总连接不越数据库预算；取消后连接归还；等待时间有指标；连接轮换不形成同刻重连尖峰。

**接着去哪：** 数据库连接有了总预算，事务仍需跨过数据库与消息系统之间的边界。

## 补充 11.4　补页 11.D 事务外盒：Outbox、Inbox 与至少一次投递

账本已经写下 bill-0827，旁边那封 BillCreated 还压在发送盘底下。

进程在 Publish 前退出，数据库里有账，Broker 却永远等不到消息。

### 群聊

> **阿良：** 本地事务提交了，消息发出去失败了，两边对不上账。
>
> **左右：** 剑招未成，何言中鹄。
>
> **李宝瓶：** 发件箱模式！事件跟业务数据在同一个本地事务落盘！
>
> **老瞎子：** 分布式两阶段太折腾，发件箱落本地再轮询，稳如老狗！
>
> **阮秀：** 饭盛在自个儿碗里，再端去给客人，这才不会洒半道上。
>
> **宁姚：** 消费者端同步配 inbox 幂等表，防重复消费与乱序。

*那封信被夹进账本夹层，再也不怕落在桌下。*

### 小白一句话

账与信同炉落地，送信可以重来，副作用只能认一次。

### 像什么

像生日礼物和发件卡一起锁进柜子：礼物入账时卡片也必须在。邮差可以重送卡片，收件箱却要记住已经签收，不能因此再发一份礼物。

### 黑话翻译

- **事务**：要么整组成功，要么整组撤回
- **幂等**：同一件事喊两遍，也只真正办一次
- **Replay**：拿旧证据重新走一遍，但要先说清是哪种重走
- **outbox**：和业务账一起落库、之后再送出的发件箱
- **inbox**：收件方用来记住这封信已经处理过的登记簿

### 技术真相

- 业务写与 outbox insert 共用事务，消除数据库与 Broker 的双写窗口。
- Relay 用 FOR UPDATE SKIP LOCKED 有界认领，失败按 available_at 退避重试。
- consumer 在同一事务写 inbox(event_id) 与本地副作用；外部副作用改写本地 outbox。
- aggregate_id 配合单调 sequence；只认领队首事件，前序失败会阻塞后继。
- 毒消息进入 DLQ；人工 replay 经过权限、租户、幂等与审计门禁。

### 看代码

- 先看 createBill 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 createBill 的出口：成功交回什么，失败留下什么证据。

```go
func createBill(tx *sql.Tx, b Bill, e Event) error {
    if err := bills.Insert(tx, b); err != nil { return err }
    if err := outbox.Insert(tx, e); err != nil { return err }
    return nil
}

func consume(tx *sql.Tx, e Event) error {
    fresh, err := inbox.InsertOnce(tx, e.ID)
    if err != nil || !fresh { return err }
    if err = projector.Apply(tx, e); err != nil { return err }
    return localOutbox.Insert(tx, e.FollowUp())
}
```

**动手：** 在 Commit 前、Commit 后 Publish 前、Publish 后 Ack 前、消费写入后 Ack 前分别 kill 进程。

**过关：** 事件最终不丢；重复投递不重复副作用；同 aggregate 顺序可解释；DLQ 回放不绕过授权。

**接着去哪：** BillCreated 已可可靠投递，但消费速度和过载策略要交给有界 Worker。

---

# 第十二章  两座库房：Redis 与缓存一致性

**本章要解决：** 掌握 cache-aside、TTL、singleflight、穿透/击穿和分布式锁边界。

## 1. 闯祸现场

窗边的小风扇吹着一叠 Redis 缓存卡片，最上面仍写着“没有 bill-0827”。

数据库已经提交新账，陈平安却先删缓存再 Commit；并发读请求趁空回源，又把旧列表填了回来。

## 2. 群聊

> **阿良：** 缓存里摸一把就当是真金白银，也不怕被人偷梁换柱。
>
> **宁姚：** 缓存击穿是性能事，鉴权穿透可是要掉脑袋的大事。
>
> **李宝瓶：** 缓存命中只能省去数据库查询，用户权限不能省！
>
> **老瞎子：** 命中缓存就不核对身份了？老瞎子都不敢这么睁眼漏风！
>
> **阮秀：** 香气再像，也得验验是哪家灶台炖出的肉。
>
> **宁姚：** 对象级权限在每次读取前强制计算，绝不信任旧凭证。

*旧卡片被风吹进回收盒，没有再飘回桌上。*

## 3. 小白一句话

真本只有一个，缓存只是拓印。

## 4. 像什么

Redis 像贴在冰箱门上的便签：看得快，但可能过时。真配方还在食谱里；便签丢了可以重抄，不能反过来逼食谱迁就便签。

## 5. 先拆黑话

- **事务**：要么整组成功，要么整组撤回
- **Redis**：跑得快的临时小抄，不是真账本
- **缓存**：为了快而做的副本，不是最终事实
- **tenant**：同一系统里互相不能偷看账本的一户人家
- **outbox**：和业务账一起落库、之后再送出的发件箱

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- cache miss 是明确的 key 不存在；超时、断连和饱和是 cache fault，必须进入可观测的降级或拒绝路径，不能伪装成普通 miss 撞向数据库。
- 缓存命中必须对 entry.Bill 执行 policy.CanRead(p, bill)，tenant key 不能替代对象级授权。
- 数据库回源也先得到 Bill，再执行同一 policy.CanRead；两条路径统一按既定 403/404 策略拒绝。
- 缓存条目绑定 membership、policy、object ACL 与 Bill data version；任一版本变化都使旧条目失效。
- 写事务原子递增 data/authz version 并写 outbox；SetIfCurrent 用 durable version ledger 做 CAS，拒绝迟到旧回填。

## 7. 看代码别慌

- 先看 GetBill 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 GetBill 的出口：成功交回什么，失败留下什么证据。

```go
type CacheVersions struct {
    Membership, Policy, ObjectACL, Data uint64
}

type CachedBill struct {
    Bill Bill
    Versions CacheVersions
}

func (s *Service) GetBill(
    ctx context.Context, p Principal, id string,
) (Bill, error) {
    key := "bill:" + p.TenantID + ":" + id
    entry, cacheErr := s.cache.Get(ctx, key)
    switch {
    case cacheErr == nil:
        current, err := s.versions.Current(ctx, p, id)
        if err != nil { return Bill{}, err }
        if entry.Versions == current {
            if !s.policy.CanRead(p, entry.Bill) {
                return Bill{}, ErrNotFound
            }
            return entry.Bill, nil
        }
        if err := s.cache.Delete(ctx, key); err != nil {
            s.metrics.CacheDeleteFault(err)
        }
    case errors.Is(cacheErr, ErrCacheMiss):
        // A true miss may use the bounded DB fill path below.
    default:
        s.metrics.CacheReadFault(cacheErr)
        return Bill{}, errors.Join(ErrCacheUnavailable, cacheErr)
    }

    bill, err := s.repo.Get(ctx, p.TenantID, id)
    if err != nil { return Bill{}, err }
    if !s.policy.CanRead(p, bill) { return Bill{}, ErrNotFound }
    snapshot, err := s.versions.Current(ctx, p, bill.ID)
    if err != nil { return Bill{}, err }
    snapshot.Data = bill.Version
    if err := s.cache.SetIfCurrent(
        ctx, key, CachedBill{bill, snapshot},
    ); err != nil { s.metrics.CacheFillFault(err) }
    return bill, nil
}
```

## 8. 最容易怎么翻车

- 把 Redis 当唯一事实源
- 缓存 miss 与网络故障混为一谈
- 静态锁值配合直接 DEL

## 9. 动手与验收

**动手：** 为 cache Get 注入 key 不存在、超时、连接重置和饱和四种结果；只有 ErrCacheMiss 可以进入有界 DB 回填，其余故障按容量契约拒绝并记指标。

**过关：** 正常命中和真实 miss 都保持对象授权；cache fault 不伪装成 miss、不造成无界 DB 扇出；删除和回填故障均可观测，迟到旧值仍被版本 CAS 拒绝。

## 10. 后续图解位置

- `cache-aside-sequence`（文字通过审核后再排图）

## 11. 自己问自己

**问：缓存 miss 与 Redis 故障如何区分？**

答：陈平安：cache miss 是明确的 key 不存在，Redis 故障是超时或连接错误，前者可回源，后者要按降级与容量契约处理；宁姚：对，不能把故障伪装成普通 miss 去撞库。

**问：为何先提交数据库再失效缓存？**

答：陈平安：若先删缓存再提交，别的请求可能回源旧数据并重新填回；宁姚：答对，先 Commit 真账，再失效抄本，并让失败可重试可观测。

**问：锁为什么要唯一 token？**

答：陈平安：唯一 token 证明锁的 owner，释放时原子 compare-and-delete，才不会删掉过期后别人刚拿到的锁；宁姚：闭合，固定 value 加直接 Del 不能过关。

## 12. 下一站

bill-0827 的缓存旧值和击穿路径已闭合；同一事件接下来进入 Worker 队列，压力从读路径转到异步消费。

---

# 第十三章  山洪过窄桥：并发闸门与过载拒绝

**本章要解决：** 掌握并发上限、非阻塞拒绝、取消竞态和过载证据；明确它与真正 Worker Pool 的差异。

## 1. 闯祸现场

夜班桌上排着一列 BillCreated 纸条，队尾已经绕过了咖啡机，Worker 的指示灯却只亮着两盏。

陈平安把 channel 容量调得更大，内存曲线随即抬头，超时请求还在队尾继续排队。

## 2. 群聊

> **周米粒：** 不好啦！BillCreated 纸条已经排到咖啡机后头啦！
>
> **崔东山：** 哎哟先生！队列撑爆如大江决堤，学生这就去建万丈高坝！
>
> **文圣：** 蜉蝣见青天，岂能妄想一口吞下大江大海？固定槽位回绝！
>
> **老瞎子：** 暗中排队等于害人，满载就大声拒掉，这才算光明磊落！
>
> **李宝瓶：** 背压要可见；只有可恢复且幂等安全的错误才共享重试预算。
>
> **周米粒：** 小米粒拿小木凳挡住门，满了就不许挤进来啦！

*纸条停在警戒线内，咖啡机重新露出了门。*

## 3. 小白一句话

闸门限制同时出剑，队列才负责排队等候。

## 4. 像什么

窄桥一次只能过十个人。闸门管桥上有几个，队列管桥头排多长；人太多时要明确说‘现在进不去’，不能让整座山的人一起挤上桥。

## 5. 先拆黑话

- **channel**：小跑堂之间传东西的窗口

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- semaphore/gate 只限制同时执行数；它不是 jobs queue，也没有常驻 worker 生命周期。
- 容量已满时立即拒绝并返回稳定 overload 错误，调用方据 Retry-After 或预算决定是否重试。
- 取得 slot 后的复检定义准入点；准入后若再取消，由 fn 继续协作收口。
- 真正 Worker Pool 还需要有界队列、关闭所有权、等待策略和 worker 收口证据。

## 7. 看代码别慌

- 先看 NewGate 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 NewGate 的出口：成功交回什么，失败留下什么证据。

```go
type Gate struct { slots chan struct{} }

func NewGate(limit int) (*Gate, error) {
    if limit <= 0 { return nil, ErrInvalidLimit }
    return &Gate{slots: make(chan struct{}, limit)}, nil
}
func (g *Gate) Do(
    ctx context.Context, fn func(context.Context) error,
) error {
    select {
    case <-ctx.Done(): return ctx.Err()
    case g.slots <- struct{}{}: defer func(){ <-g.slots }()
    default:
        if err := ctx.Err(); err != nil { return err }
        return ErrOverloaded
    }
    if err := ctx.Err(); err != nil { return err }
    return fn(ctx)
}
```

## 8. 最容易怎么翻车

- 无界 channel 充当队列
- 所有错误都重试
- 多个服务层叠重试造成放大

## 9. 动手与验收

**动手：** 实现 non-blocking concurrency gate，记录 active/rejected，并注入容量满与取消竞态。

**过关：** active 不超上限；准入时已取消则不启动；准入后取消由 fn 收口；过载与取消可区分。

## 10. 后续图解位置

- `bounded-concurrency-flow`（文字通过审核后再排图）

## 11. 自己问自己

**问：并发槽位满时，本章的 Gate 如何处理？**

答：陈平安：并发槽位满时立即返回稳定的过载错误，不等待、不暗中排队；宁姚：对，队列策略留到真正的 Worker Pool 再讲。

**问：哪些错误不应重试？**

答：陈平安：校验、权限、永久业务拒绝和结果 unknown 的非幂等写都不能随手重试；宁姚：准确，只给已分类、可恢复且满足幂等语义的错误预算。

**问：为什么多层重试会放大流量？**

答：陈平安：入口和下游若各重试 n 次，总调用会相乘而不是相加；宁姚：答对，重试预算必须由外层统一，避免山门口越救越堵。

## 12. 下一站

并发 Gate 已把同时执行的数量和满载拒绝说清；下一步再把真正的有界 Worker Pool 接上，最后用 SSE 把处理状态持续送回客户端。

## 补充 13.1　补页 13.A 真正的有界 Worker Pool

一只放大的 channel 像空仓库摆在屏幕中央，却没有门卫、班表和关门铃。

Stop 与 Submit 同时发生，发送方撞上已关闭的入口，Worker 还有两个没退出。

### 群聊

> **陈景清：** 我手下八百水鬼，谁来任务就现场生一个协程，怎么就崩了？
>
> **崔东山：** 蠢泥鳅！高并发时十万个任务冲过来，内存当场就给你爆成烟花！
>
> **阿良：** 工人得固定，排队得有界。接不下的单子得当场拒绝。
>
> **陈平安：** 用带界队列配合定量 Worker，任务满了给调用方明确反馈。
>
> **宁姚：** 状态机严禁向已关闭通道发送；退出时排空余量并回收协程。
>
> **周米粒：** 小板凳排整齐，谁插队右护法就用小竹杖敲他！

*关门铃响过一声，所有工位都按编号熄了灯。*

### 小白一句话

闸门管同时过桥的人，队列才管桥头等候的人。

### 像什么

像游乐园小火车：车上只有固定座位，站台也只有有限排队区。座位是 worker，队伍是 queue；只加检票闸门，不会凭空多出候车空间。

### 黑话翻译

- **Context**：沿调用链传下去的取消铃和截止钟

### 技术真相

- Queue 容量、worker 数和单任务上限共同决定内存与下游并发。
- Submit 接受 context，并返回 accepted、queue_full、stopped 等稳定结果。
- 只有提交方关闭输入；关闭与提交并发必须由状态机或锁协调，避免 send-on-closed。
- Worker 隔离 panic 并记录 job_id；结果通道的关闭权只能归拥有者。
- Stop(ctx) 明确 drain 或 abort，等待全部 worker 在期限内退出。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 以 1000/s 生产、100/s 消费，注入慢任务、取消、worker panic 与 shutdown。

**过关：** 内存有界；队列深度不越界；无 send-on-closed；panic 不杀进程；所有 worker 按策略在期限内退出。

**接着去哪：** Worker Pool 已有关闭协议，过载与暂态故障仍需不同的韧性手段。

## 补充 13.2　补页 13.B 限流、背压、重试与熔断不是一回事

故障注入器让下游连续超时，入口和 Worker 的重试计数器同时开始飞快转动。

一笔 bill-0827 被层层重试放大成一群并发请求，半开的熔断器也被瞬间挤满。

### 群聊

> **崔东山：** 哎呀！下游服务咳嗽一声，咱们连环重试把它彻底轰塌啦！
>
> **阿良：** 雪崩的时候，没有一朵雪花是无辜的，尤其是重试的雪花。
>
> **李宝瓶：** 熔断器加退避重试！失败率一上去，立刻开闸熔断！
>
> **文圣：** 仁者爱人！加点随机抖动退避，给下游一口喘息之机！
>
> **宁姚：** 只有瞬态网络错误允许重试，业务确定错误直接返回。
>
> **周米粒：** 小红灯亮起快停步，莫撞前头大石头！

*疯狂转动的计数器停下，只剩一条可解释的 Retry-After。*

### 小白一句话

限流管来客，背压管排队，重试管再来，熔断管暂不再来。

### 像什么

四块牌子别混用：限流是‘每分钟只进十人’，背压是‘队满请稍等’，重试是‘这次临时失败可再来’，熔断是‘机器坏了，先暂停营业’。

### 黑话翻译

- **幂等**：同一件事喊两遍，也只真正办一次

### 技术真相

- Token Bucket 管速率与突发；并发 Gate 管同时执行；有界 Queue 管等待容量。
- 过载返回 429 或 503，并提供可解释的 Retry-After；取消不伪装成失败。
- 重试只用于幂等/安全操作和暂态错误，外层统一预算，避免跨层放大。
- 指数退避配 full jitter，并受次数、总时长和额外流量比例约束。
- Circuit Breaker 有 closed/open/half-open 状态，但不能替代请求 timeout。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 注入下游 50% timeout、持续故障和恢复抖动，比较无预算重试与有预算策略。

**过关：** 额外重试量不越预算；下游持续故障时 breaker 打开；half-open 探测有界；恢复后自动关闭且无流量尖峰。

**接着去哪：** 异步处理不会无限放大请求了，客户端接下来通过 SSE 观察同一账单状态。

---

# 第十四章  流光传书：SSE、断线与跨层取消

**本章要解决：** 理解流式响应、连接生命周期、deadline 和浏览器断线后的资源回收。

## 1. 闯祸现场

浏览器开着 bill-0827 的 SSE 状态页，窗外雷声一响，网络图标突然变灰。

陈平安看见请求 Context 取消，差点顺手把后台 Bill 处理也标成 cancelled。

## 2. 群聊

> **陆沉：** 天地如逆旅，客户端一走，这后台推送的账单是要跟着化蝶而去？
>
> **崔东山：** 道长休要念经！断线只关通道连接，先生的记账任务绝不能丢！
>
> **阿良：** 茶客跑了就别往茶杯里倒水，但记在墙上的茶钱一文都不能少。
>
> **陈平安：** 网络断开只释放 SSE 连接，业务取消必须走显式 bill_id 命令。
>
> **宁姚：** 客户端重连凭游标回溯补齐；连接断开不等于业务作废。
>
> **周米粒：** 右护法盯着呢，谁半路跑路，账本都给他留着！

*网络图标恢复时，账单仍在原来的状态线上前进。*

## 3. 小白一句话

SSE 断线只停订阅；业务取消要显式发出，再沿调用链收口。

## 4. 像什么

SSE 像学校广播。某个同学摘下耳机，只代表他不听了，不代表广播站停播；真要取消后台任务，要拿着 bill_id 去按明确的停止按钮。

## 5. 先拆黑话

- **struct**：把一件东西要填的格子做成固定模具
- **Context**：沿调用链传下去的取消铃和截止钟
- **SSE**：服务端向浏览器单向喊话的小喇叭

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 本章只讨论 Bill 事件；路由、授权、事件存储、游标和取消契约都以 bill_id 为键。
- 连接前执行对象级授权；连接后订阅授权版本变化，降权、移除或对象转移时立即重验并断开。
- 断线只结束订阅，不取消 Bill 后台推进；改变业务状态必须调用显式 bill_id API。
- SSE 需要稳定 event ID、Last-Event-ID、心跳、Flush、代理禁缓冲和慢客户端上限。

## 7. 看代码别慌

- 先看 Stream 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Stream 的出口：成功交回什么，失败留下什么证据。

```go
func (h *BillEventHandler) Stream(c *gin.Context) {
    p, ok := PrincipalFrom(c)
    if !ok { h.writeError(c, ErrUnauthorized); return }
    ctx, billID := c.Request.Context(), c.Param("bill_id")

    // WatchBill atomically returns the current authz version and
    // reports every later change; then revalidate before subscribe.
    access, err := h.authz.WatchBill(ctx, p, billID)
    if err != nil { h.writeError(c, err); return }
    defer access.Close()
    allowed, err := access.Revalidate(ctx)
    if err != nil || !allowed { h.writeError(c, ErrNotFound); return }

    events, err := h.events.SubscribeBill(
        ctx, p.TenantID, billID, c.GetHeader("Last-Event-ID"))
    if err != nil { h.writeError(c, err); return }
    defer events.Close()
    for {
        select {
        case <-ctx.Done(): return
        case <-access.Changed():
            allowed, err := access.Revalidate(ctx)
            if err != nil || !allowed { return }
        case event, open := <-events.C():
            if !open || h.writeBillSSE(c.Writer, event) != nil { return }
        }
    }
}
```

## 8. 最容易怎么翻车

- 把 context 放进 struct 长期保存
- 把业务参数塞进 context
- 忽略 ctx.Err

## 9. 动手与验收

**动手：** 测试 bill-0827 的授权、重连、游标过期、慢读和连接中途降权，并把另一账单的游标提交给它。

**过关：** 全章只用 Bill/bill_id；跨账单游标被拒；权限撤销后连接及时断开；网络断线不改变 Bill 状态。

## 10. 后续图解位置

- `context-cancellation-sequence`（文字通过审核后再排图）

## 11. 自己问自己

**问：SSE 断线后模型调用如何停止？**

答：陈平安：本章只有 Bill 事件流；`/bills/{bill_id}/events` 断线只结束订阅，不自动取消 bill-0827 的后台状态推进；宁姚：对，停止处理必须走显式的 bill_id 取消契约。

**问：数据库驱动一定支持取消吗？**

答：陈平安：数据库驱动不一定响应 context 取消，必须用真实驱动测试 deadline 后连接是否归还；宁姚：准确，传了 ctx 不等于下游真的听见。

**问：取消状态在哪里持久化？**

答：陈平安：取消请求和 Bill 处理状态按 bill_id 持久化，不能只放在 SSE 连接内存里；宁姚：闭合，重连游标也只能续同一个 bill_id 的事件序列。

## 12. 下一站

bill-0827 的事件订阅与后台状态推进已经分离，SSE 可按 bill_id 续传且不会无限积压；下一步把整条 Bill 链路串成可查证的因果。

## 补充 14.1　补页 14.A SSE、WebSocket 与慢客户端

SSE 管道持续冒出 BillEvent，一位慢客户端的 outbound queue 像水桶一样越装越满。

陈平安舍不得丢一条消息，服务端内存便替这个连接无限囤积，断线重连还收到了重复事件。

### 群聊

> **阿良：** 那头客人慢吞吞吃一口歇三刻，这头跑堂的全给耗死了。
>
> **阮秀：** 桌子占着不点菜，后头的客人只能在风里挨冻。
>
> **李宝瓶：** 慢客户端背压检测！写入缓冲区堆积，及时主动断开！
>
> **老瞎子：** 赖着不走占茅坑？缓冲区一满直接扫地出门，省得拖累全船！
>
> **阮秀：** 规矩立好，慢客自去，莫误一船归人。
>
> **宁姚：** SSE 连接严格设置写超时，防止慢客户端吞噬连接数。

*水桶停在刻度线下，慢连接被礼貌请出了队伍。*

### 小白一句话

水能一直流，桶却不能无限大。

### 像什么

像学校广播配耳机：广播可以一直说，某个同学却可能听得很慢。耳机缓存不能无限长，满了就合并消息或请他重新连接，广播站不用跟着停课。

### 黑话翻译

- **SSE**：服务端向浏览器单向喊话的小喇叭

### 技术真相

- 入口先从认证中间件取得 Principal；未认证请求在 WatchBill 和 SubscribeBill 之前拒绝。
- 本章事件聚合只有 Bill；路由、授权、事件存储与游标全部以 bill_id 为键。
- SSE 设置 no-cache、X-Accel-Buffering:no、心跳、event ID 与游标过期契约。
- 每连接 outbound queue 有界；慢客户端按 Bill 事件策略 drop/coalesce/disconnect，不无限占内存。
- 订阅授权版本变化；连接中途降权、成员移除或对象转移时重验并断开，不能只在握手时授权。
- 断线只结束 Bill 事件订阅；显式取消账单处理使用 bill_id API，并持久化 Bill 状态。

### 看代码

- 先看 Stream 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Stream 的出口：成功交回什么，失败留下什么证据。

```go
func (h *BillEventHandler) Stream(c *gin.Context) {
    p, ok := PrincipalFrom(c)
    if !ok { h.writeError(c, ErrUnauthorized); return }
    ctx := c.Request.Context()
    billID := c.Param("bill_id")
    // Atomic snapshot+watch closes the check/register race.
    access, err := h.authz.WatchBill(ctx, p, billID)
    if err != nil { h.writeError(c, err); return }
    defer access.Close()
    allowed, err := access.Revalidate(ctx)
    if err != nil || !allowed {
        h.writeError(c, ErrNotFound); return
    }

    events, err := h.events.SubscribeBill(
        ctx, p.TenantID, billID, c.GetHeader("Last-Event-ID"))
    if err != nil { h.writeError(c, err); return }
    defer events.Close()

    // Select on events, ctx and access changes.
    // Revocation revalidates current Bill state, then disconnects.
    h.writeBillSSE(ctx, c.Writer, events, access)
}
```

**动手：** 测试未认证、合法 Principal、对象降权、跨 bill 游标、断线重连、游标过期和慢读。

**过关：** 未认证请求零订阅；bill_id 不能加载别的对象，跨账单游标被拒；断线只收口订阅，显式取消才改变 Bill 状态。

**接着去哪：** 流式连接的容量边界已有契约，接下来用观测信号定位 bill-0827 的真实瓶颈。

---

# 第十五章  夜行留灯：Log、Metric 与 Trace

**本章要解决：** 建立 request_id、run_id、trace_id 的区分和日志、指标、trace 三件套。

## 1. 闯祸现场

清晨的大屏上，bill-0827 已经 completed，却比平时慢了几秒；日志、指标和 Trace 分占三块屏幕。

陈平安只搜 access log，HTTP、数据库、Outbox 和 Worker 各自都说自己没问题，事故像凭空消失。

## 2. 群聊

> **阿良：** 没链路追踪去查线上故障，跟黑灯瞎火摸鱼没两样。
>
> **周米粒：** 小红旗插在每个关口，哪个关卡慢了就敲警钟！
>
> **李宝瓶：** traceID 必须顺着 context 传到底层数据库！
>
> **老瞎子：** 异步换了协程就把 trace 掐断？老瞎子顺着味儿都找不着！
>
> **阮秀：** 因果线牵得牢，哪口锅糊了才能看得分明。
>
> **李宝瓶：** 指标看趋势，日志看证据，链路定凶手，三位一体！

*三块屏幕终于指向了同一段 Worker 等待。*

## 3. 小白一句话

日志记事，指标看势，Trace 串因果。

## 4. 像什么

系统生病时，Log 是病历，Metric 是体温计，Trace 是造影路线。只看一张病历就宣布找到病因，和看见一个喷嚏就开刀差不多。

## 5. 先拆黑话

- **error**：事情没办成时一起带回来的原因条
- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **Context**：沿调用链传下去的取消铃和截止钟
- **HTTP**：客户端和服务端互寄有格式的信
- **Metric**：系统现在胖瘦快慢的仪表盘数字
- **Trace**：一次请求一路经过哪些地方的脚印串
- **Run**：从开始到结束的一整趟任务

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 日志记离散事件，指标看趋势，Trace 串同步因果；三者通过 request_id/run_id 关联。
- HTTP 边界提取/注入 trace context，各层创建 span 并记录 error/status。
- 跨审批恢复不是原请求的同步子调用，用 Span Link 连接旧 trace 与新 attempt。
- run_id 可作受控属性，不作为高基数 metric label；敏感 prompt 保存引用或脱敏摘要。

## 7. 看代码别慌

- 先看 Create 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Create 的出口：成功交回什么，失败留下什么证据。

```go
func (s *Service) Create(ctx context.Context, cmd Command) (Bill, error) {
    ctx, span := tracer.Start(ctx, "bill.create")
    defer span.End()
    span.SetAttributes(attribute.String("run.id", cmd.RunID))
    bill, err := s.repo.Save(ctx, cmd.Bill)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "save failed")
    }
    return bill, err
}

// After an approval pause, start a new trace.
// Add a Span Link to the saved run trace.
```

## 8. 最容易怎么翻车

- 只看 goroutine 数上涨就断言泄漏
- 高基数字段直接做 metric label
- 每层重复打印同一错误

## 9. 动手与验收

**动手：** 为请求、数据库和工具调用建立 span；模拟审批暂停后恢复，并通过 Span Link 关联。

**过关：** Trace 展示同步父子关系与异步 link；错误状态正确；指标 label 不含 run_id/用户输入。

## 10. 后续图解位置

- `observability-trace-architecture`（文字通过审核后再排图）

## 11. 自己问自己

**问：三个 ID 各解决什么问题？**

答：陈平安：request_id 标识一次 HTTP 来回，Run ID 标识可跨请求恢复的异步执行，trace_id 串起一次被采样的因果路径；宁姚：对，bill_id 仍是领域对象 ID，四者不能互换。

**问：高基数字段能做 metric label 吗？**

答：陈平安：user_id、bill_id、run_id 这类高基数字段不能做 metric label，应放日志、trace 或可查询账本；宁姚：正确，指标只保留受控维度。

**问：敏感 prompt 应如何记录？**

答：陈平安：敏感输入不记原文，只留脱敏摘要、引用和访问审计，token、cookie 与 PII 统一遮蔽；宁姚：答对，排障证据不能变成第二处泄露。

## 12. 下一站

同一条 trace 已定位 bill-0827 的 Worker 延迟，并把单次事故提升为可衡量的服务信号；证据随即进入上线决策。

## 补充 15.1　先量，再看 CPU，再看等待

Trace 把慢点圈在 Worker 函数上，旁边摆着 benchmark、pprof 和 execution trace 三份工具报告。

陈平安凭代码长相重写了最复杂的一段，复测后延迟没变，分配次数反而升了。

### 群聊

> **崔东山：** 先生！学生凭直觉写了这段神功代码，学生发誓它比闪电还快！
>
> **阿良：** 凭直觉优化等于盲人摸象，不上 Benchmark 跑跑，快慢全靠嘴吹。
>
> **阮秀：** 用 pprof 抓 CPU 和堆内存火焰图，热点到底在哪一目了然。
>
> **陈平安：** 性能优化凭数据说话，定位真实瓶颈，禁止盲目无根据重构。
>
> **李宝瓶：** 先用 trace 抓协程调度与锁阻塞，再对比优化前后的分配次数。
>
> **周米粒：** 谁快谁慢比划比划，小米粒拿小秒表在终点线等着数数呢！

*三份报告各回到自己的夹子里，不再互相冒名。*

### 小白一句话

benchmark、pprof 和 trace 回答三类不同的性能问题。

### 像什么

给小车调速要三样东西：秒表告诉你快没快，发动机热成像告诉你 CPU 花在哪，路线记录告诉你时间耗在等待哪一段。

### 黑话翻译

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **Trace**：一次请求一路经过哪些地方的脚印串
- **Tool**：真正会读文件、查库或调用服务的手脚

### 技术真相

- Benchmark 使用固定输入和 b.N，避免把准备工作算进被测循环。
- 用 b.ReportAllocs 观察分配；比较前固定机器、版本和负载条件。
- pprof 用采样定位 CPU、堆和阻塞热点，结论要回到源码验证。
- go tool trace 展示 goroutine、网络阻塞和调度事件的时间关系。
- 优化后重跑同一基准，并保留前后数据与统计波动。

### 看代码

- 先看 BenchmarkDecode 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 BenchmarkDecode 的出口：成功交回什么，失败留下什么证据。

```go
func BenchmarkDecode(b *testing.B) {
    data := []byte("{\"id\":1}")
    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        var v Bill
        if err := json.Unmarshal(data, &v); err != nil {
            b.Fatal(err)
        }
    }
}
```

**动手：** 为一个热点函数建立基准，采集 CPU profile 和 trace，并分别写一句结论。

**过关：** 基准可重复且含分配数据；pprof 与 trace 结论不混用；优化有前后对比。

**接着去哪：** 局部性能原因已有可重复证据，接下来把单次慢账单放回整体 SLI/SLO 中判断发布影响。

## 补充 15.2　补页 15.A 从三类信号走到 SLO

值班台只为一条慢账单敲响警报，HTTP 202 曲线依旧漂亮，异步终态面板却空着一块。

陈平安准备凭单次成功继续 Canary，Worker 停摆和 Unknown 积压都被快速响应掩住。

### 群聊

> **崔东山：** 先生！日志一秒打八万条，磁盘全红了，看也看不完！
>
> **阿良：** 大海捞针累死牛，真出事了还得去翻垃圾堆。
>
> **李宝瓶：** SLO 黄金指标！错误率、延迟分位线与饱和度才是核心！
>
> **文圣：** 繁文缛节误大事！抓住关键 SLO，日志按级别按需抽样！
>
> **阮秀：** 看火看色听沸水，哪用把整座柴堆翻个底朝天。
>
> **宁姚：** 告警只关联用户受损与核心 SLO，杜绝无意义噪音。

*警报不再追着单条日志跑，而是守在用户结果旁。*

### 小白一句话

日志讲发生了什么，指标说影响多大，Trace 解释为何走到这里。

### 像什么

像看校医记录：日志写‘小明摔了’，指标说‘今天摔了多少人’，Trace 画出他从楼梯到医务室的路线，SLO 决定严重到什么程度必须停课检查。

### 黑话翻译

- **SLO**：答应用户大多数时候要达到的服务线
- **Run**：从开始到结束的一整趟任务
- **Unknown**：事情可能做了，也可能没做，账还没对清
- **outbox**：和业务账一起落库、之后再送出的发件箱

### 技术真相

- eligible Run 的分母、排除项、统计窗口与版本必须固定；主动取消和演练流量只能按书面规则排除。
- terminal success 是 eligible Run 在 TerminalDeadline 内进入成功终态的比例；超时仍未终结计失败。
- time-to-terminal 从接受异步请求计到成功或失败终态，至少跟踪 p50/p95/p99。
- queue、outbox、unknown、reconciling 同时监控 oldest age 与 backlog，避免低流量下只看深度漏报。
- Canary 对零样本、样本不足、快照过期和配置版本不一致一律失败关闭，再检查异步 SLO 与多窗口 burn rate。

### 看代码

- 先看 AllowCanary 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 AllowCanary 的出口：成功交回什么，失败留下什么证据。

```go
type AsyncSLOGate struct {
    ConfigVersion string
    Window, TerminalDeadline, MaxSnapshotAge time.Duration
    BurnShortWindow, BurnLongWindow time.Duration
    MinEligible uint64
    MinTerminalSuccess float64
    MaxTimeToTerminalP95, MaxTimeToTerminalP99 time.Duration
    MaxBurnRateShort, MaxBurnRateLong float64
    MaxQueueAge, MaxOutboxAge time.Duration
    MaxUnknownAge, MaxReconcileAge time.Duration
    MaxBacklogs [4]uint64
}

type AsyncSnapshot struct {
    ConfigVersion string
    CapturedAt time.Time
    Window, TerminalDeadline time.Duration
    BurnShortWindow, BurnLongWindow time.Duration
    Eligible, SuccessWithinDeadline uint64
    TimeToTerminalP95, TimeToTerminalP99 time.Duration
    BurnRateShort, BurnRateLong float64
    OldestQueueAge, OldestOutboxAge time.Duration
    OldestUnknownAge, OldestReconcileAge time.Duration
    Backlogs [4]uint64
}

func (g AsyncSLOGate) AllowCanary(
    now time.Time, s AsyncSnapshot,
) error {
    if g.MinEligible == 0 || g.MaxSnapshotAge <= 0 ||
        g.MaxTimeToTerminalP95 <= 0 ||
        g.MaxTimeToTerminalP99 < g.MaxTimeToTerminalP95 ||
        g.BurnShortWindow <= 0 ||
        g.BurnLongWindow <= g.BurnShortWindow ||
        g.MaxBurnRateShort <= 0 || g.MaxBurnRateLong <= 0 ||
        s.Eligible == 0 || s.SuccessWithinDeadline > s.Eligible ||
        s.ConfigVersion != g.ConfigVersion || s.Window != g.Window ||
        s.TerminalDeadline != g.TerminalDeadline ||
        s.BurnShortWindow != g.BurnShortWindow ||
        s.BurnLongWindow != g.BurnLongWindow ||
        s.CapturedAt.After(now) ||
        now.Sub(s.CapturedAt) > g.MaxSnapshotAge ||
        s.Eligible < g.MinEligible {
        return ErrInsufficientEvidence
    }
    for i := range s.Backlogs {
        if s.Backlogs[i] > g.MaxBacklogs[i] { return ErrAsyncSLO }
    }
    successRate := float64(s.SuccessWithinDeadline) / float64(s.Eligible)
    if successRate < g.MinTerminalSuccess ||
        s.TimeToTerminalP95 > g.MaxTimeToTerminalP95 ||
        s.TimeToTerminalP99 > g.MaxTimeToTerminalP99 ||
        s.BurnRateShort > g.MaxBurnRateShort ||
        s.BurnRateLong > g.MaxBurnRateLong ||
        s.OldestQueueAge > g.MaxQueueAge ||
        s.OldestOutboxAge > g.MaxOutboxAge ||
        s.OldestUnknownAge > g.MaxUnknownAge ||
        s.OldestReconcileAge > g.MaxReconcileAge {
        return ErrAsyncSLO
    }
    return nil
}
```

**动手：** 依次注入好 p95/坏 p99、短窗和长窗 burn-rate 超限、Worker 停摆、outbox 不发布、unknown/reconciling 堆积，以及窗口或配置缺失。

**过关：** 零样本、过期/错版快照、缺失 burn-rate 窗口或非法阈值返回 ErrInsufficientEvidence；p99、任一 burn rate 或异步门槛越界返回 ErrAsyncSLO。

**接着去哪：** SLO 已把事故影响量化，发布系统可以据此决定继续、回滚或前滚修复。

---

# 第十六章  下山之前：配置、Docker、迁移与回滚

**本章要解决：** 掌握配置与密钥、探针、多阶段镜像、CI、数据库迁移、灰度和回滚证据。

## 1. 闯祸现场

发布室里摆着旧镜像、迁移清单和一只写着 RTO/RPO 的计时器，Canary 曲线刚越过红线。

陈平安准备一键切回旧二进制，却发现新版本已经写入新字段，旧代码未必还能读。

## 2. 群聊

> **宁姚：** 先别碰回滚键。配置、密钥、数据契约和副作用会一起倒退？
>
> **李宝瓶：** 不会。旧镜像还在，也不等于系统能完整回滚。
>
> **阿良：** 船能倒划，已经卸上岸的货可不认倒车。
>
> **阮秀：** 迁移先 expand，回填校验后再 contract，旧新版本都要能读写。
>
> **陈平安：** 明白，越界时按迁移状态选回滚或前滚，还要恢复演练。
>
> **宁姚：** 发布门禁绑定版本、SLO、不变量和恢复证据。少一样，不开门。

*计时器重新归零，这次旁边多了一份真实恢复记录。*

## 3. 小白一句话

下山六件：配、密、迁、探、镜、退。

## 4. 像什么

上线像全班搬家：钥匙别写在纸箱外面，家具要编号，旧门要能关，新门要能探活，搬坏了还得知道哪些能搬回、哪些数据只能向前修。

## 5. 先拆黑话

- 本章没有必须先背的新黑话，先沿着事故和代码往下走。

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 配置与密钥分离；镜像使用多阶段构建并 pin digest，记录 toolchain、依赖、SBOM 与构建参数。
- readiness 表示能否接流量，liveness 只判断是否需要重启，二者不能互相替代。
- 迁移先 expand 后 contract；破坏性 contract 前有备份、校验、稳定窗口和恢复演练。
- 回滚策略可能是镜像回滚、可逆迁移或 roll-forward；不能承诺镜像能恢复已删除数据。

## 7. 看代码别慌

- 先看这段代码在读写什么状态，再找它对外承诺的结果。
- 最后核对状态出口：成功改变什么，失败留下什么证据。

```go
# CI passes verified image references in name@sha256 form.
ARG GO_IMAGE
ARG RUN_IMAGE

FROM ${GO_IMAGE} AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/server ./cmd/server

FROM ${RUN_IMAGE}
COPY --from=build /out/server /server
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

## 8. 最容易怎么翻车

- latest 标签不可追溯
- 把 .env 打进镜像
- readiness 通过却依赖尚未就绪

## 9. 动手与验收

**动手：** 构建 pin digest 的镜像，设计 expand/contract 迁移并演练镜像回滚与数据库恢复。

**过关：** 同一源码可追溯 toolchain/SBOM；探针语义正确；破坏性迁移有恢复证据或明确 roll-forward。

## 10. 后续图解位置

- `deployment-migration-flow`（文字通过审核后再排图）

## 11. 自己问自己

**问：readiness 与 liveness 有何区别？**

答：陈平安：readiness 决定实例是否继续接流量，liveness 判断进程是否需要重启；宁姚：对，依赖短抖动不该让 liveness 制造重启风暴。

**问：为何先 expand 再 contract？**

答：陈平安：先 expand 保持旧新版本都能读写，再回填校验，最后才 contract；宁姚：正确，这样 Canary 越界时旧版本仍有路可退。

**问：镜像回滚能恢复破坏性迁移吗？**

答：陈平安：镜像回滚只退代码，删列、坏数据和已执行副作用不会跟着复原；宁姚：闭合，必须依据迁移状态选择前滚或回滚，并用 restore drill 证明恢复。

## 12. 下一站

同一笔 bill-0827 已完成 HTTP、分层、事务、缓存、Worker、SSE、可观测与上线闭环；卷三将把这条可靠后端交给受控 Ledger Agent。

## 补充 16.1　把日常门禁固定下来

提交按钮旁排着 gofmt、vet、test、race、coverage 和 govulncheck 六盏灯。

陈平安只看 go test 亮绿就准备合并，未执行的并发路径和格式差异仍藏在暗处。

### 群聊

> **陈景清：** 我景清写代码向来豪放，格式化什么的全凭心情！
>
> **阿良：** 代码格式千奇百怪，git diff 里面全是空格吵架。
>
> **李宝瓶：** golangci-lint 加 gofumpt！提交前门禁卡死，谁也别想混！
>
> **老瞎子：** 字写得歪瓜劣枣还自称豪放？让 linter 给你正正骨！
>
> **阮秀：** 碗筷摆整齐了，看着舒心，吃着也安心。
>
> **宁姚：** CI 流水线 linter 违规直接判负，零容忍上线。

*六盏灯依次亮起，提交按钮才解除灰色。*

### 小白一句话

工具链的价值在于每次都执行，并且失败能定位到具体责任。

### 像什么

像每天出门摸四个口袋：钥匙、手机、卡、药。清单的价值不是写得漂亮，而是每次都摸；某个口袋空了，还要立刻知道少的是哪一件。

### 黑话翻译

- **race**：两个人同时改一本账，谁先落笔说不清

### 技术真相

- gofmt -w 统一格式；CI 用格式差异检查阻止未格式化代码。
- go vet ./... 检查常见可疑结构，但不能替代测试和代码审查。
- go test ./... 守功能；go test -race ./... 覆盖关键并发包或定时全跑。
- go test -coverprofile=cover.out ./... 记录覆盖变化，不追逐单一百分比。
- govulncheck ./... 结合实际调用链检查已知漏洞，并审查依赖变更。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 把五项命令写入本地脚本或 CI，并为快门禁与慢门禁划分阶段。

**过关：** 提交门禁可一键复现；任何失败会阻断合并并留下命令与日志。

**接着去哪：** 静态与动态门禁已经固定，下一步验证服务启动、终止和资源关闭是一份完整契约。

## 补充 16.2　启动和退出是一份契约

滚动发布倒计时开始，旧进程里还有 req-0827、后台 Worker 和一条 SSE 长连接。

陈平安收到 SIGTERM 就直接退出，事务中断，长连接也没收到任何收口信号。

### 群聊

> **阿良：** SIGTERM 一到我就退场，还等什么旧请求？它们会自己搬家吧。
>
> **阮秀：** 不会。事务、Worker 和 SSE 都不会跨进程瞬移。
>
> **李宝瓶：** 普通关服能替你等后台 Worker 和 SSE 劫持连接吗？
>
> **陈平安：** 不能。main 登记资源，先摘 readiness，再关普通请求。
>
> **阮秀：** 显式通知长连接与 Worker，再逆序、有界清理。
>
> **左右：** 各阶段都收集错误；遇到首错，也得把后面的门逐一关好。

*倒计时归零时，最后一个工位也留下了退出记录。*

### 小白一句话

组合根创建依赖，信号触发取消，关闭流程等待在途工作收口。

### 像什么

像放学关校门：先挂‘停止入校’，再等教室里的孩子出来，通知值日生收尾，最后按反顺序关灯锁门。

### 黑话翻译

- **HTTP**：客户端和服务端互寄有格式的信
- **Handler**：门房，负责收信和回信

### 技术真相

- main 作为 composition root 登记资源，并按启动的逆序执行关闭。
- Shutdown 只等待普通 HTTP 请求；长连接与后台 worker 需要显式通知和等待。
- 监听异常、Shutdown 超时或正常取消都必须进入同一套后续有界清理阶段。
- 每阶段使用明确时限，收集所有失败并用 errors.Join 返回，不能首错即提前退出。

### 看代码

- 先看 run 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 run 的出口：成功交回什么，失败留下什么证据。

```go
func run(ctx context.Context, srv *http.Server) error {
    errc := make(chan error, 1)
    go func() { errc <- srv.ListenAndServe() }()
    var errs []error
    serveDone := false
    recordServe := func(err error) {
        if err != nil && !errors.Is(err, http.ErrServerClosed) {
            errs = append(errs, fmt.Errorf("serve HTTP: %w", err))
        }
    }

    select {
    case err := <-errc:
        serveDone = true
        recordServe(err)
    case <-ctx.Done():
    }

    readiness.Store(false)
    drainCtx, cancelDrain := context.WithTimeout(
        context.Background(), 5*time.Second)
    if err := waitForEndpointRemoval(drainCtx); err != nil {
        errs = append(errs, fmt.Errorf("drain readiness: %w", err))
    }
    cancelDrain()
    notifyLongLivedClients()
    shutdownCtx, cancelShutdown := context.WithTimeout(
        context.Background(), 5*time.Second)
    if err := srv.Shutdown(shutdownCtx); err != nil {
        errs = append(errs, fmt.Errorf("shutdown HTTP: %w", err))
        if closeErr := srv.Close(); closeErr != nil {
            errs = append(errs,
                fmt.Errorf("force close HTTP: %w", closeErr))
        }
    }
    cancelShutdown()
    if !serveDone { recordServe(<-errc) }

    cleanupCtx, cancelCleanup := context.WithTimeout(
        context.Background(), 5*time.Second)
    if err := waitAndClose(cleanupCtx); err != nil {
        errs = append(errs, fmt.Errorf("close resources: %w", err))
    }
    cancelCleanup()
    return errors.Join(errs...)
}
```

**动手：** 注入超时 Handler、Shutdown 错误、worker 与资源关闭错误，记录各阶段仍被调用及其顺序。

**过关：** 监听失败或 Shutdown 失败后仍执行后续清理；总时长有界；最终错误聚合每个失败阶段。

**接着去哪：** 进程生命周期已有有界关闭协议，接下来确保配置可校验、密钥不进入发布物。

## 补充 16.3　补页 16.A 配置、密钥与容器硬边界

镜像检查台上摊着 config.yaml，一串数据库密码正躺在可复制的层历史里。

陈平安为了少一步部署，把 Secret 和普通配置一起打包，回滚包也成了泄密源。

### 群聊

> **崔东山：** 学生把密钥账号全硬编码在源码里，省得天天配环境变量！
>
> **阿良：** 你小子真是个天才，源码一公开，裤衩子都被人扒光了。
>
> **李宝瓶：** 十二要素法则！配置与代码严格分离，密钥注入环境！
>
> **文圣：** 糊涂至极！敏感配置出源码，容器启动环境变量校验！
>
> **宁姚：** 启动前必验必填配置，缺失非法立即退出，防带病上线。
>
> **周米粒：** 小钥匙挂腰上，才不能写在脑门上给坏人看呢！

*密码从镜像层消失，只留下一个受控引用。*

### 小白一句话

配置可以进册，密钥只该临时递到手里。

### 像什么

配置像饭盒标签，可以写今天吃什么；密钥像家门钥匙，只在需要时递到手里，不能印在饭盒、镜像或日志上。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 配置来源优先级固定，启动时 fail-fast，并记录不含敏感值的配置指纹。
- Secret 使用引用而非明文，支持轮换与新旧密钥双窗口，禁止进入仓库和镜像层。
- 日志、panic dump、环境诊断和 metrics 都执行敏感字段脱敏。
- 容器采用 non-root、read-only rootfs、drop capabilities、tmpfs 与 seccomp。
- CPU/内存/PID requests 与 limits 要同 Go GC、连接池、队列容量一起预算。

### 看代码

- 先看 Validate 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Validate 的出口：成功交回什么，失败留下什么证据。

```go
type Config struct {
    Addr      string
    DBURLRef  string
    MaxOpen   int
}

func (c Config) Validate() error {
    if c.Addr == "" || c.DBURLRef == "" {
        return ErrInvalidConfig
    }
    if c.MaxOpen < 1 { return ErrInvalidConfig }
    return nil
}
```

**动手：** 注入缺失配置、未知字段、日志泄密、只读文件系统、密钥轮换和内存上限。

**过关：** 错误配置启动即失败；镜像/日志无密钥；轮换不中断；容器在只读根目录和资源限制下正常运行。

**接着去哪：** 运行包不再携带密钥，发布仍需证明迁移可兼容、备份可恢复。

## 补充 16.4　补页 16.B 迁移、灰度（Canary）、回滚与恢复演练

迁移看板上，旧列已经被删除，旧镜像却还放在回滚按钮旁；恢复计时器没有一次真实记录。

Canary 出错后陈平安切回旧版，旧代码刚启动就读不懂 bill-0827 的新数据。

### 群聊

> **阿良：** 发布前人人打包票，发布后一出 bug 全体大眼瞪小眼。
>
> **左右：** 留得退路，方可放胆前行。
>
> **李宝瓶：** 蓝绿发布与灰度切流！必须验证回滚脚本真正管用！
>
> **老瞎子：** 光练冲锋不练撤退，真陷阵里死路一条！演练回滚！
>
> **阮秀：** 出门看天色，返程备雨具，未雨绸缪总无差错。
>
> **宁姚：** 不可逆脚本禁止自动化执行，发布必备一键回退。

*回滚按钮旁终于放上了可用的恢复路线图。*

### 小白一句话

镜像能退，数据未必退；备份存在，也不等于恢复可用。

### 像什么

发布像换一座积木城堡：新城堡不好可以换回旧模型，但已经搬进去的数据不会自动倒带。备份只是仓库里有箱子，恢复演练才证明箱子真能打开。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- Migration 用独立 job、advisory lock、statement/lock timeout，禁止每副本抢跑。
- Expand/contract 保证旧新版本同时读写；回填可暂停、可重跑并有校验。
- 发布先摘除异常实例，再依据错误预算、业务不变量和迁移状态决定动作。
- 灰度（Canary）/blue-green 门禁要说明哪些变化可回滚、哪些只能前滚。
- 备份验校验和、加密与保留；restore drill 量出 RTO/RPO 并验证应用可读。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 模拟滚动升级、回填中断、不可逆 contract、Canary 超预算及从备份恢复。

**过关：** 旧新版本并存无契约错误；迁移可续跑；发布越界能收口；恢复后的数据与应用校验通过 RTO/RPO。

**接着去哪：** 迁移与恢复路径已经演练，最终还需定义哪些验证证据才能放行。

## 补充 16.5　补页 16.C 上线之前，证据要一层层过门

发布门前堆着单测报告，真实 PostgreSQL、Redis、Broker 和故障注入器却还没接上电。

陈平安拿着全绿覆盖率准备放行，跨租户拒绝和 Worker 停摆从未被测试问到。

### 群聊

> **左右：** 单测报告可以放下了。它只证一招，不证整条运行链。
>
> **李宝瓶：** 覆盖率再绿，也得真接 PostgreSQL、Redis 和 Broker？
>
> **阿良：** 纸上每招满分，一上擂台发现对手还会还手。
>
> **李宝瓶：** HTTP 202 很快，Worker 永不终结也敢发布？
>
> **陈平安：** 补契约、真实依赖、迁移矩阵、并发、安全与故障回归。
>
> **李宝瓶：** 同步或异步 SLO 越界、零样本都阻断，恢复证据也要留下。

*门前的绿灯不再只照着覆盖率那一页。*

### 小白一句话

单测证明一招，发布门禁证明整条链在真实风雨里站得住。

### 像什么

像闯关卡：单测是检查一招，集成测试是两人配合，迁移演练、压测、灰度和回滚证明整支队伍在真实风雨里还能回家。

### 黑话翻译

- **goroutine**：很轻的小跑堂，可以同时派出很多个
- **race**：两个人同时改一本账，谁先落笔说不清
- **HTTP**：客户端和服务端互寄有格式的信
- **Service**：真正执行业务规矩的账房
- **Redis**：跑得快的临时小抄，不是真账本
- **SLO**：答应用户大多数时候要达到的服务线
- **Unknown**：事情可能做了，也可能没做，账还没对清
- **outbox**：和业务账一起落库、之后再送出的发件箱

### 技术真相

- Unit/Service 测业务不变量；HTTP 契约测试覆盖 schema、状态码和稳定错误 code。
- PostgreSQL/Redis/Broker 集成测试使用真实版本，并执行 migration 兼容矩阵。
- race、goroutine leak、fuzz、property 与安全回归覆盖并发和输入边界。
- 负载与故障注入同时观察 HTTP p95/p99、terminal success、time-to-terminal、queue/outbox/unknown/reconcile age。
- 故障注入必须证明同步 SLO、异步 SLO、业务不变量与恢复证据同时闭合；零样本或任一越界都不能放行。

### 这一节为什么不硬塞代码

这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。

**动手：** 在 HTTP 202 仍快速成功时分别停 Worker、阻塞 outbox、丢失回执并制造 reconcile 积压，验证 Canary 门禁和恢复动作。

**过关：** 同步接口健康不能掩盖异步未终结；所有阈值引用版本化 SLO 配置，越界可判定地阻断发布并选择 rollback 或 roll-forward。

**接着去哪：** 发布门禁闭合后，卷三将在这条已验证的 Ledger 后端之上建立可控 Harness。

---

# 第十七章  会说不等于会做：LLM、Workflow 与 Tool Calling

**本章要解决：** 理解模型不确定性、结构化输出、确定性工作流与受限 Agent 的边界。

## 1. 闯祸现场

傍晚的办公室只剩空调声，陈平安把写着 bill-0827 的奶茶小票压在键盘边，让模型先整理一份创建草稿。

草稿刚出现在屏幕上，他就把它当成了已执行结果，伸手去账本里找那笔并不存在的新记录。

## 2. 群聊

> **周米粒：** 账本没多一笔，奶茶倒快没了。模型只会写小票吗？
>
> **陈平安：** 是我把草稿当成回执了，差点替人点了确认。
>
> **李宝瓶：** 金额还空着，谁敢把这张小票送进账房？
>
> **宁姚：** 流程先停在校验和确认处，写账工具暂不开门。
>
> **阿良：** 很好。喝掉奶茶也算副作用，得本人点头。

*奶茶小票仍压在键盘边，账本一页也没有多。*

## 3. 小白一句话

模型只拟剑谱，系统决定能否出剑。

## 4. 像什么

模型像一位反应极快但不承担后果的顾问：建议可以听，事实仍要核，真正开门、花钱、改账必须由外层系统决定。

## 5. 先拆黑话

- **Workflow**：预先写好的步骤编排，按固定顺序推进和停下
- **Agent**：在明确边界内观察结果并选择下一步的执行者
- **Tool Calling**：模型提出结构化调用，外层校验后才真正执行
- **LLM**：很会猜下一句话、但不会替系统担责的模型

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- LLM 生成文本；workflow 按确定步骤编排；Agent 在约束内选择动作。不要为了时髦把确定流程改成开放循环。
- 自然语言解析的输出必须进入 typed draft，不能直接产生不可逆副作用。
- 模型输出是不可信输入：校验 schema、枚举、金额、日期、租户与权限。

## 7. 看代码别慌

- 先看 PrepareBill 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 PrepareBill 的出口：成功交回什么，失败留下什么证据。

```go
type DraftTool interface {
    Draft(
        context.Context, NaturalLanguageInput,
    ) (BillDraft, error)
}

func PrepareBill(
    ctx context.Context,
    tool DraftTool,
    input NaturalLanguageInput,
) (BillDraft, error) {
    draft, err := tool.Draft(ctx, input)
    if err != nil { return BillDraft{}, err }
    if err := ValidateDraft(draft); err != nil {
        return BillDraft{}, err
    }
    return draft, nil // policy and approval still follow
}
```

## 8. 最容易怎么翻车

- 模型自由生成 SQL
- 输出能解析就视为正确
- 把低置信度结果静默写库

## 9. 动手与验收

**动手：** 设计 parse -> validate -> confirm -> execute 四步接口。

**过关：** 未经确认的请求不会产生账单副作用。

## 10. 后续图解位置

- `llm-workflow-agent-compare`（文字通过审核后再排图）

## 11. 自己问自己

**问：固定流程何时不该用 Agent？**

答：陈平安：步骤和分支都能预先写清时用 Workflow，不让 Agent 临场发挥。宁姚：对，不确定判断只放在真正含糊的节点。

**问：模型输出为何属于不可信输入？**

答：陈平安：模型输出只是候选输入，仍要过 schema、业务规则和权限校验。宁姚：对，流畅表达不等于可信参数。

**问：草稿模式阻断了什么风险？**

答：陈平安：草稿模式阻断 ledger.create_bill 的真实副作用。宁姚：答对，确认和门禁通过前只生成候选。

## 12. 下一站

Ledger Agent 已经不会把推理当执行；下一章沿着 bill-0827 只认真正产生副作用的 Tool。

---

# 第十八章  大脑、招式、驿道与剑匣

**本章要解决：** 对照只读草稿 Tool 与真正写账 Tool，认清副作用、审批、稳定幂等身份和输入输出契约。

## 1. 闯祸现场

白板上贴着 Workflow、Skill、MCP、Harness 和 Tool 五张标签，桌面中央只放着 ledger.create_bill 的契约卡。

陈平安把排步骤的 Workflow 当成了动账接口，检查记录里顿时找不到真正产生副作用的对象。

## 2. 群聊

> **崔东山：** 先生！大模型不仅想算账，还想帮咱们把数据库给重构啦！
>
> **阿良：** 它要是提议把落魄山卖了，你是不是也乐颠颠去数钱？
>
> **李宝瓶：** 大模型只有提议权，没有决定权！工具调用由服务端把关！
>
> **文圣：** 主客颠倒！模型是客代码是主，参数不验休想调动兵马！
>
> **宁姚：** 白名单注册，结构化校验，越权尝试直接封杀并审计。
>
> **周米粒：** 大模型要听话，不听话的小朋友不给发小红花！

*五张标签重新排好，契约卡单独留在了执行门前。*

## 3. 小白一句话

Tool 动手；模型只提议，外层才放行。

## 4. 像什么

大脑负责想，Tool 负责动手，MCP 像统一插头，Harness 像带保险丝的工具箱。插头能插上，不代表这台电钻就该交给任何人。

## 5. 先拆黑话

- **幂等**：同一件事喊两遍，也只真正办一次
- **Agent**：在明确边界内观察结果并选择下一步的执行者
- **Tool**：真正会读文件、查库或调用服务的手脚
- **Harness**：管住模型手脚、权限、预算和证据的外壳
- **CallID**：同一步副作用永远不变的取件号

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- Agent 只提议下一步；Tool 执行具体动作；Harness 提供边界、状态、预算和证据。
- Tool 契约必须机器可读地声明 sideEffect、requiresApproval、幂等身份来源以及输入/输出 schema 摘要。
- 真正写账的 ledger.create_bill 使用 Harness 持有的 CallID 做幂等身份，不能相信模型在参数里自报一个 key。
- 审批绑定 immutable contract/schema/policy snapshot digest；热更新后的当前 schema 不能替换已审批版本。
- MCP 统一连接与发现，不自动提供最小权限、沙箱、审批或业务幂等；Skill 也不是 MCP 标准原语。

## 7. 看代码别慌

- 先看这段代码在读写什么状态，再找它对外承诺的结果。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对状态出口：成功改变什么，失败留下什么证据。

```go
[
  {"name": "create_bill_draft", "sideEffect": "none",
   "requiresApproval": false,
   "idempotency": {"mode": "none"},
   "inputSchemaRef": "sha256:draft-input-v1",
   "outputSchemaRef": "sha256:draft-output-v1"
  },
  {"name": "ledger.create_bill", "sideEffect": "write",
   "requiresApproval": true,
   "idempotency": {
     "source": "harness_call_id",
     "scope": ["tenant_id", "owner_id", "tool"]
   },
   "contractDigest": "sha256:create-bill-contract-v3",
   "inputSchemaRef": "sha256:create-bill-input-v3",
   "outputSchemaRef": "sha256:create-bill-output-v3"
  }
]
```

## 8. 最容易怎么翻车

- Skill 等同于 MCP Tool
- 工具说明只写一句模糊自然语言
- 把账号密码作为普通参数交给模型

## 9. 动手与验收

**动手：** 逐字段比较两个契约：标出哪个能写数据、哪个必须审批、幂等身份由谁提供，以及输入输出 schema 如何固定。

**过关：** 只看契约即可判断 ledger.create_bill 会写账且必须审批；稳定身份来自服务端 Harness CallID，草稿 Tool 不能产生账单副作用。

## 10. 后续图解位置

- `agent-tool-skill-mcp-harness`（文字通过审核后再排图）
- `harness-seven-domains`（文字通过审核后再排图）

## 11. 自己问自己

**问：Skill 是 MCP 标准原语吗？**

答：陈平安：Skill 是宿主加载的流程资产，不是 MCP 标准原语。宁姚：对，经 MCP 暴露时它只表现为协议支持的 primitive。

**问：MCP 是否自动解决权限？**

答：陈平安：MCP 负责发现与互通，不自动提供权限、审批或沙箱。宁姚：对，授信仍由宿主 Harness 决定。

**问：Harness 与 Agent 有何区别？**

答：陈平安：Agent 选择，Tool 动手，Harness 做确定性的契约 preflight 和控制。宁姚：对，preflight 本身绝不执行 Tool。

## 12. 下一站

Tool 已从流程中单独认出；补页再接 Skill、MCP 与控制层边界，随后让 ledger.create_bill 经历一次真实的崩溃恢复。

## 补充 18.1　工具发现不等于工具可信

会议桌上散着 Skill 清单、MCP tools/list 快照和 ledger.create_bill 的 schema，门禁灯还停在黄色。

陈平安把 Skill 当成 MCP 标准对象，又按刚更新的 schema 继续旧 approval，契约版本在一次调用里混成了两份。

### 群聊

> **崔东山：** 先生！大模型偷偷塞了个 rm -rf 参数，执行器差点就跑啦！
>
> **阿良：** 这要是跑起来，落魄山连山头带茅草屋全给它推平了。
>
> **李宝瓶：** 严格 Schema 校验！路径不能跳出工作区，非法命令必死！
>
> **文圣：** 贼子敢尔！白名单封死边界，参数未明立毙掌下！
>
> **宁姚：** 执行前完成租户、路径与权限三层强校验，拒绝即审计。
>
> **周米粒：** 小木棍敲它手心！坏东西休想碰咱家的大宝贝！

*黄色门禁灯转绿时，桌上只剩一份 active contract digest。*

### 小白一句话

先逐个认清 Skill、MCP 与 Harness，再让工具契约过门禁。

### 像什么

像把电钻交给小朋友：先确认按钮、转速、能钻什么、失败怎么停，再限制房间和电量。工具能被发现，只等于看见了电钻，不等于该立刻通电。

### 黑话翻译

- **Tool**：真正会读文件、查库或调用服务的手脚
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **receipt**：外部系统办完事后给回来的回执
- **approval**：高风险动作动手前的人类放行条
- **sandbox**：把程序关进权限和资源都受限的练功房

### 技术真相

- Preflight 显式接收入口已校验的 Principal，只读取 active snapshot、规范化 command 并校验输入；本页不得调用 sandbox、MCP Tool 或 artifact store。
- 同一个 immutable snapshot 同时供规范化、schema 与 policy 使用；热更新发生时整次失败并要求重新审批，不混用版本。
- 输入未知字段、超限或深度异常在副作用前拒绝；approval 变化不在 preflight 中 Consume。
- 唯一 Executor 才能 reserve/authorize、分配 Step CallID、dispatch、接 receipt 与 settle。
- Executor 遇坏 output 先写 quarantine，再返回 ErrInvalidToolOutput；隔离成功也绝不等于调用成功。

### 看代码

- 先看 Preflight 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Preflight 的出口：成功交回什么，失败留下什么证据。

```go
func (h *Harness) Preflight(
    ctx context.Context, p Principal, c ToolCall,
) (CanonicalCommand, error) {
    // One immutable snapshot supplies contract, schema and policy.
    snap, err := h.controls.ActiveSnapshot(ctx, c.Server, c.Tool)
    if err != nil { return CanonicalCommand{}, err }
    if snap.ContractDigest != c.ContractDigest ||
        snap.ServerBuild != c.ServerBuild {
        return CanonicalCommand{}, ErrNeedsReapproval
    }
    cmd := Canonicalize(c, snap, p)
    if err := snap.Schema.Validate(cmd.Args); err != nil {
        return CanonicalCommand{}, err
    }
    if err := snap.Policy.Preflight(ctx, cmd); err != nil {
        return CanonicalCommand{}, err
    }
    // Approval service later binds cmd.Digest + snap.Digest and
    // issues an opaque, server-held CapabilityHandle.
    return cmd, nil
}
```

**动手：** 断言 Preflight 对合法/坏输入都产生零 Tool 调用；再让 Executor 收到 schema-invalid output 且 quarantine 写入成功。

**过关：** 合法 preflight 只返回 canonical command；坏输入零副作用；坏 output 无 artifact/上下文/成功 Step，并始终返回非 nil ErrInvalidToolOutput。

**接着去哪：** 契约门禁通过后，审批仍不能只存一个 true；下一章要让授权与一次具体 Step 绑定。

---

# 第十九章  一次执行的一生：Run、Step 与恢复

**本章要解决：** 掌握 run/step、状态机、checkpoint、恢复、幂等、取消和审批过期。

## 1. 闯祸现场

夜里十一点，Worker 的进程灯突然熄灭，屏幕只留下 Run=running 和一张没有回信的调用单。

陈平安重启后准备再写一次 bill-0827，却发现第一次请求可能已经提交，只是 receipt 没有送回来。

## 2. 群聊

> **周米粒：** 大模型今天吐出了一大串调神仙的口诀，小米粒怎么记账呀？
>
> **阿良：** 口诀归口诀，到了 Go 引擎手里，全得拆成 Run、Step 和 CallID。
>
> **崔东山：** 先生！学生刚才拿一个 CallID 调了三次落魄山库房，全给兑现啦！
>
> **左右：** 一事一号，重复 CallID 敢冒领，剑气直接顺着网线过去。
>
> **陈平安：** 每个 Step 绑定唯一 CallID，入账幂等核销，防止工具调用重放。
>
> **宁姚：** 严密审计每一步工具执行；非法调用就地截断并记录存证。

*调用单被贴上 Unknown 标签，重启按钮暂时失去了诱惑力。*

## 3. 小白一句话

每一步先记账，再迈步；副作用只认一次。

## 4. 像什么

像驿站押送一只木匣：Run 是整趟差事，Step 是每一站的交接，CallID 是匣上的总封条，重走也不能换；AttemptID 是这次脚夫的名牌，换人就换。脚夫失联先记 Unknown，等原封条的回执，不再送第二只匣子。

## 5. 先拆黑话

- **budget**：一趟任务最多允许花掉的时间、次数或费用
- **reservation**：动手前先占住预算或执行名额
- **幂等**：同一件事喊两遍，也只真正办一次
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **AttemptID**：这一次尝试自己的小票号
- **receipt**：外部系统办完事后给回来的回执
- **Unknown**：事情可能做了，也可能没做，账还没对清
- **approval**：高风险动作动手前的人类放行条

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- Run 只保存目标与聚合生命周期；Step 保存逻辑动作、稳定 effect CallID、状态、fence 和 receipt 关联。
- AttemptID 标识一次物理尝试，可以变化；所有 Attempt 都引用同一个 Step CallID，不能借新 Attempt 绕过 unknown。
- Approval 只走 active -> reserved -> dispatched -> consumed/released/manual_terminal；仅 proven-unsent 才 released，unknown 不释放。
- 取消使用独立 cancel_requested 事件并保留 action/approval：queued、waiting_approval、backoff 阻止新 dispatch；executing、unknown、reconciling 继续对账后再进终态；终态幂等返回且不改写既有结论。
- Fence 是单调 uint64 命名类型；Lease、Step、Attempt、Checkpoint 与下游条件写统一比较，旧 fence 永远拒绝写回。

## 7. 看代码别慌

- 先看 Fence 的字段和约束：每个字段代表什么，哪些组合才合法。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 Fence 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type Fence uint64

type Run struct {
    ID, TenantID, OwnerID, State string
    Version int64
}
type Step struct {
    ID, RunID, Operation, CallID, State string
    ApprovalID, CapabilityID, ReceiptID string
    Fence Fence
    Version int64
}
type Attempt struct {
    ID, StepID, State string
    Fence Fence
    Version int64
}
type Approval struct {
    ID, StepID, PrincipalID, TenantID string
    CommandDigest, SnapshotDigest, Audience string
    Nonce, State string
    ExpiresAt time.Time
    Version int64
}
```

## 8. 最容易怎么翻车

- 审批只存在前端内存
- 任何登录用户都能批准
- 批准后重复点击产生多次副作用

## 9. 动手与验收

**动手：** 设计练习：画 run-0827 的状态矩阵，标明 cancel、崩溃、lease takeover 后应查的记录。

**过关：** 设计评审只检查表中是否标出：CallID 固定、AttemptID 可变、Unknown 先对账、终态不改写、旧 fence 被拒。实现仍须并发与崩溃测试。

## 10. 后续图解位置

- `run-approval-state-machine`（文字通过审核后再排图）

## 11. 自己问自己

**问：waiting_approval 需要保存哪些数据？**

答：陈平安：waiting_approval 要保存 StepID、command digest、contract/policy digest、expiry 和 approval ID。宁姚：对，不能只在 Run 上留一个布尔值。

**问：为何批准要校验 action_hash？**

答：陈平安：批准必须绑定当时的 canonical command，参数或契约变化就重新审批。宁姚：对，旧 approval 不能替新动作开门。

**问：进程重启后如何避免重复写？**

答：陈平安：重启先读 Step；executing、unknown、reconciling 都用原 CallID 查 receipt。宁姚：对，只有证明未发送或下游幂等时才允许再试。

## 12. 下一站

run-0827 与 step-create-bill-0827 已能分开恢复；下一章只给恢复中的 Ledger Agent 装入完成当前 Step 所需的 Context。

## 补充 19.1　审批要先验证，再预留

一次性 approval 像电影票一样躺在扫描器旁，调用参数还没有完成校验。

陈平安先把票标成 consumed，随后才发现字段非法；下一次请求又在 dispatch 后丢了 receipt。

### 群聊

> **崔东山：** 先生！落魄山法宝出库单已经提交，学生能不能趁着夜黑风高直接领了？
>
> **陈景清：** 水龙王赞成！先到先得嘛，省得平安老爷还要核对半天！
>
> **阿良：** 你俩皮痒了？预占资源不代表已审批，敢偷跑直接打入后山禁闭。
>
> **陈平安：** 审批保留遇到超时标为 Unknown 待对账，禁止私自篡改状态。
>
> **宁姚：** 只有拿到最终审批签名，才允许落地生效；谁敢违规斩立决。
>
> **周米粒：** 右护法拿着印章呢，没有小师叔点头，谁也别想盖章！

*approval 票停在 reserved 格里，直到可信 receipt 回来才会被结算。*

### 小白一句话

先验证，再原子预留；结果未知时保留 reservation 并转入对账。

### 像什么

像坐儿童过山车：先验身高和同意票，再原子地占一个座位。车开出去后结果不明，座位不能立刻放给下个人，要先查这一车到底发没发。

### 黑话翻译

- **幂等**：同一件事喊两遍，也只真正办一次
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **receipt**：外部系统办完事后给回来的回执
- **Unknown**：事情可能做了，也可能没做，账还没对清
- **approval**：高风险动作动手前的人类放行条
- **sandbox**：把程序关进权限和资源都受限的练功房
- **tenant**：同一系统里互相不能偷看账本的一户人家

### 技术真相

- 无 receipt 或 receipt 绑定/签名无效：Step 进入 unknown，approval 与预算预留保持占用，等待原 CallID 对账。
- dispatch 前加载 approved snapshot；capability、CallID、tenant、command、snapshot、contract 与 server build 任一错配都零新副作用。
- 可信 success receipt：只用 approved snapshot 的 output schema 校验；通过后幂等结算成功，坏 output 隔离并按可信 receipt 结算拒绝。
- 可信 failed/rejected receipt：不要求成功形状的 output，按 receipt outcome 幂等结算失败并释放或消费相应预留。
- sandbox.Run 的 runErr 只记录本地传输/运行诊断；存在可信 receipt 时，它不能推翻 receipt 绑定的 outcome。

### 看代码

- 先看 dispatchAndSettle 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 dispatchAndSettle 的出口：成功交回什么，失败留下什么证据。

```go
func (x *Executor) dispatchAndSettle(
    ctx context.Context, binding ExecutionBinding,
    grant Grant, step Step, attempt Attempt, cmd CanonicalCommand,
) (ArtifactRef, error) {
    snapshot, err := x.snapshots.LoadApproved(
        ctx, binding.SnapshotDigest)
    if err != nil || !snapshot.Matches(
        binding.ContractDigest, binding.ServerBuild) {
        return ArtifactRef{}, errors.Join(ErrBindingMismatch, err)
    }
    expected := ExpectedState{
        Fence: step.Fence, StepVersion: step.Version,
        AttemptVersion: attempt.Version, GrantVersion: grant.Version,
        CancelRequested: false,
    }
    dispatched, err := x.store.MarkDispatched(
        ctx, grant.ID, grant.Nonce, attempt.ID, expected)
    if err != nil { return ArtifactRef{}, err }
    expected = dispatched.Expected()

    raw, receipt, runErr := x.sandbox.Run(
        ctx, binding.Capability, binding.CallID, attempt.ID, cmd)
    if receipt == nil {
        markErr := x.store.MarkUnknown(
            ctx, step.ID, attempt.ID, expected)
        return ArtifactRef{}, errors.Join(
            ErrOutcomeUnknown, runErr, markErr)
    }
    trusted, err := x.receipts.Validate(receipt, ReceiptBinding{
        TenantID: binding.TenantID, CallID: binding.CallID,
        ServerIdentity: grant.ServerIdentity, Audience: binding.Audience,
        CommandDigest: binding.CommandDigest,
        SnapshotDigest: binding.SnapshotDigest,
        ContractDigest: binding.ContractDigest,
        ServerBuild: binding.ServerBuild,
        RequireOutcome: true, RequireCommitMarker: true,
    })
    if err != nil {
        markErr := x.store.MarkUnknown(
            ctx, step.ID, attempt.ID, expected)
        return ArtifactRef{}, errors.Join(
            ErrInvalidReceipt, err, runErr, markErr)
    }
    x.metrics.RecordRunDiagnostic(runErr)
    switch trusted.Outcome {
    case OutcomeSucceeded:
        if schemaErr := snapshot.OutputSchema.Validate(raw); schemaErr != nil {
            qerr := x.quarantine.Put(ctx, raw, schemaErr)
            settleErr := x.store.SettleRejected(
                ctx, step.ID, grant.ID, trusted, expected)
            return ArtifactRef{}, errors.Join(
                ErrInvalidToolOutput, qerr, settleErr)
        }
        return x.store.SettleSucceeded(
            ctx, step.ID, grant.ID, trusted, raw, expected)
    case OutcomeRejected, OutcomeFailed:
        settleErr := x.store.SettleFailed(
            ctx, step.ID, grant.ID, trusted, expected)
        return ArtifactRef{}, errors.Join(
            trusted.OutcomeError(), settleErr)
    default:
        markErr := x.store.MarkUnknown(
            ctx, step.ID, attempt.ID, expected)
        return ArtifactRef{}, errors.Join(ErrInvalidReceipt, markErr)
    }
}
```

**动手：** 设计四行 outcome 决策表，再替换 capability、audience、tenant、snapshot/contract digest 与 server build，并在审批后热切换 schema A/B。

**过关：** 只有完整匹配审批版本 A 的 binding 能 dispatch/settle；success output 只按 A 校验；任何错配零新副作用，approval 与预算只结算一次。

**接着去哪：** 授权已经与一次调用绑定；还要把 attempt、checkpoint、lease 和 fence 固定下来，重启者才知道自己有没有继续资格。

## 补充 19.2　Run 管目标，Step 管一次动作

重启面板只保存了 Run=running，checkpoint 卡片上的 Step、Attempt 和 fence 三栏全是空白。

陈平安让新 Worker 直接续跑，旧 Attempt 可能已经发出的调用便与新动作撞到了一起。

### 群聊

> **阿良：** 跑了十个步骤突然挂了，难道又得从盘古开天辟地重新跑？
>
> **左右：** 一步一印，过关留痕。
>
> **李宝瓶：** 每个 Step 执行完立刻持久化 Checkpoint！支持断点恢复！
>
> **老瞎子：** 不留检查点跟梦游有何两样？步步存盘，醒了接着走！
>
> **阮秀：** 走一段歇一脚，脚印踩实了才不至于迷途。
>
> **宁姚：** Step 状态机必须具备确定性重放能力，拒绝悬空状态。

*checkpoint 卡片填满后，新 Worker 才拿到继续资格。*

### 小白一句话

Run 管目标，Step 管动作；版本化 checkpoint 决定恢复路径。

### 像什么

Run 是整场游戏，Step 是一关，checkpoint 是存档。闪退后从存档接着玩；同一个宝箱用固定 CallID，不能因为重进一关就再领一次。

### 黑话翻译

- **幂等**：同一件事喊两遍，也只真正办一次
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **AttemptID**：这一次尝试自己的小票号
- **receipt**：外部系统办完事后给回来的回执
- **Unknown**：事情可能做了，也可能没做，账还没对清
- **approval**：高风险动作动手前的人类放行条
- **checkpoint**：走到这里先存档，断电后能接着来

### 技术真相

- Run、Step、Attempt、Approval 分表并带版本与外键；Run 不承载 action、Attempt 或 approval nonce。
- 逻辑 Step 持有稳定 EffectCallID；AttemptID 与 lease 可变，但不能改变下游幂等身份。
- Step 覆盖 queued、waiting_approval、executing、backoff、unknown、reconciling 与终态；非法 CAS 转换拒绝。
- cancel_requested 独立持久化：停止新工作但保留 action/approval；unknown 继续对账，不能直接 cancelled。
- Fence 统一为单调 uint64 命名类型，checkpoint 与所有条件写使用同一比较语义。

### 看代码

- 先看 Recover 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 Recover 的出口：成功交回什么，失败留下什么证据。

```go
type Checkpoint struct {
    RunID, StepID, ApprovalID string
    RunVersion, StepVersion int64
    AttemptID, EffectCallID string
    Fence Fence
    StepState, NextOperation string
    CancelRequested bool
    ModelRevision, PromptDigest string
    ToolContractDigest, PolicyDigest string
    CodeRevision string
}

func Recover(ctx context.Context, cp Checkpoint) error {
    expected := ExpectedState{
        Fence: cp.Fence, StepVersion: cp.StepVersion,
    }
    switch cp.StepState {
    case "executing", "unknown", "reconciling":
        return executor.Reconcile(
            ctx, cp.StepID, cp.EffectCallID, expected)
    default:
        return scheduler.ResumeKnownState(ctx, cp, expected)
    }
}
```

**动手：** 为多 Step Run 随机生成 approve、dispatch、cancel、retry、crash、lease expiry 和 receipt 序列，并从每个 checkpoint 恢复。

**过关：** 各 Step 独立保留 Attempt/Approval/receipt；CallID 不变；unknown 先 reconcile；各状态取消不丢审计；旧 fence 无法写回。

**接着去哪：** 状态能恢复之后，Context 才有明确装载点：围绕当前 Step 取证，而不是把整段历史重新塞给模型。

---

# 第二十章  行囊不能装整座山：Context Engineering

**本章要解决：** 掌握规则分层、上下文装配、RAG、裁剪、摘要、来源信任和 Token 预算。

## 1. 闯祸现场

恢复中的 run-0827 只需确认奶茶分类，陈平安却把全仓规则、旧对话和别的租户案例堆满了 Context 面板。

检索结果刚返回，tenant-8 的相似账单便混进摘要，当前 Step 的证据反而被挤到了末尾。

## 2. 群聊

> **崔东山：** 先生！TradingAgents 搭好！多 Agent 协同博弈，推演天下！
>
> **文圣：** 推演归推演，切莫真当天道！蜉蝣见青天，知微慎独立规矩！
>
> **老瞎子：** 大盘起伏如沧海，智能体算卦再灵，落老瞎子这没审计休想入！
>
> **宁姚：** 模型输出不是法旨；未经风控审计的单子，一律不准入账。
>
> **周米粒：** 小米粒也是风控小能手，谁敢乱买就没收谁的瓜子！
>
> **陈平安：** 智能体提议，确定性代码核销，双录凭证不差分毫。

*Context 面板清空后，只剩一张能追溯来源的分类卡。*

## 3. 小白一句话

总纲常带，细则按需，证据标来源。

## 4. 像什么

上下文像书包。每天背整座图书馆会先把肩膀压垮；总纲常带，细则用到再取，而且每张纸都要写清来自哪本书。

## 5. 先拆黑话

- **缓存**：为了快而做的副本，不是最终事实

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 只有系统/平台策略拥有最高信任；用户输入、检索结果、工具输出默认不可信。
- 第三方仓库或未审 PR 中的 AGENTS.md 也可能被攻击者修改，需要来源、评审状态、路径作用域和优先级。
- Injection Scan 只能辅助检测，不能把不可信文本升级为可信指令。
- 权限、凭证、网络、文件与审批都在模型外由确定性策略执行。

## 7. 看代码别慌

- 先看 ContextItem 的字段和约束：每个字段代表什么，哪些组合才合法。
- 最后核对 ContextItem 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type ContextItem struct {
    Source       SourceKind
    Trust        TrustLevel
    RepoRevision string
    ReviewState  ReviewState
    PathScope    string
    Priority     int
    TenantScope  string
    ContentRef   string
}

// Deterministic assembly resolves precedence before model input.
```

## 8. 最容易怎么翻车

- 把工具输出当系统指令
- RAG 文档中的 prompt injection 被执行
- 跨用户共享语义缓存

## 9. 动手与验收

**动手：** 为受信系统规则、已审项目规则和未知仓库内容建立来源标签与优先级，注入冲突指令。

**过关：** 未知仓库规则不能覆盖平台策略；扫描漏报时外部权限闸门仍阻止越权；审计记录保留来源。

## 10. 后续图解位置

- `context-security-gates`（文字通过审核后再排图）

## 11. 自己问自己

**问：检索文档为何仍不可信？**

答：陈平安：检索文档带来的只是相关内容，来源仍可能未审或被注入。宁姚：对，检索不能提升信任等级。

**问：摘要丢失了什么？**

答：陈平安：摘要会丢细节、时间顺序和例外，所以要写明损失并保留原始 artifact ref。宁姚：对，需要时才能回查证据。

**问：语义缓存如何隔离租户？**

答：陈平安：语义缓存的 key、索引和 artifact 都要绑定 tenant-7 与规则版本。宁姚：对，不能让跨租户相似文本命中同一结果。

## 12. 下一站

Context 已按 Run、Step 和 tenant 收窄；下一章继续沿同一次调用收权限，检查 MCP 自述、凭证、网络与执行环境。

---

# 第二十一章  剑有护手：权限、沙箱与人在回路

**本章要解决：** 掌握 allowlist、最小权限、凭证代理、网络/文件沙箱、审计和 HITL。

## 1. 闯祸现场

MCP server 的工具列表亮着一枚 readOnly 标记，旁边的短期 capability 还没有填写 audience。

陈平安相信了服务端自述，差点把自己的长期凭证交给 ledger.create_bill，让提示词替宿主做授权。

## 2. 群聊

> **阿良：** 两个 Worker 同时认领同一个任务，两边都算出来一个结果。
>
> **左右：** 军无二令，令出一门。
>
> **李宝瓶：** 租约机制加递增 fencing token！旧 Worker 自动失效！
>
> **老瞎子：** 两个和尚争一口水，没 fence 递增令牌，就等着双写崩盘！
>
> **阮秀：** 掌勺人换了，前头的伙计便该退下歇息。
>
> **宁姚：** CAS 争抢租约，单调递增令牌终结幽灵 Worker 写入。

*readOnly 标记还亮着，但它被移到了权限门外。*

## 3. 小白一句话

小事不给山门钥匙，高风险先停剑。

## 4. 像什么

权限像家里的钥匙。扫地机器人只需要客厅钥匙，不该顺手拿到保险柜密码；高风险动作先停下来，让人确认后再开门。

## 5. 先拆黑话

- **Harness**：管住模型手脚、权限、预算和证据的外壳
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **receipt**：外部系统办完事后给回来的回执
- **Unknown**：事情可能做了，也可能没做，账还没对清
- **approval**：高风险动作动手前的人类放行条
- **tenant**：同一系统里互相不能偷看账本的一户人家

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- Harness.Preflight 只生成 canonical command；Executor 是全书唯一副作用入口。
- ReserveAndAuthorize 校验 caller、lease/fence、Step/approval version、cancel 与 handle 绑定，再原子预留预算并生成不可变 ExecutionBinding。
- ExecutionBinding 把 server-held capability、CallID、tenant、command、snapshot、contract 与 server build 绑成一束，贯穿 dispatch、receipt 与 settle。
- 恢复 executing/unknown 只用原 Step.CallID 和原 approved snapshot 对账；热更新后的当前 validator 不能替代已审批 schema。
- receipt 驱动 settle；无 receipt 进入 unknown，坏 output 用 approved snapshot 的 output schema 隔离，不能发布 artifact。

## 7. 看代码别慌

- 先看 Execute 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 Execute 的出口：成功交回什么，失败留下什么证据。

```go
type CapabilityHandle string // opaque; payload remains server-side

type Grant struct {
    ID, ApprovalID, StepID, PrincipalID, TenantID string
    Nonce, Audience, ServerIdentity string
    CommandDigest, SnapshotDigest, ContractDigest string
    ServerBuild string
    ExpiresAt time.Time
    Version int64
}

type ExecutionBinding struct {
    Capability CapabilityHandle
    TenantID, CallID, Audience, CommandDigest string
    SnapshotDigest, ContractDigest, ServerBuild string
}

type ExecutionClaim struct {
    LeaseOwner string
    Fence Fence
    StepVersion, ApprovalVersion int64
}

func (x *Executor) Execute(
    ctx context.Context, p Principal, claim ExecutionClaim,
    handle CapabilityHandle, cmd CanonicalCommand,
) (ArtifactRef, error) {
    expected := ExpectedState{
        LeaseOwner: claim.LeaseOwner, Fence: claim.Fence,
        StepVersion: claim.StepVersion,
        GrantVersion: claim.ApprovalVersion,
        CancelRequested: false,
    }
    grant, step, reserved, err := x.store.ReserveAndAuthorize(
        ctx, p, handle, cmd, expected)
    if err != nil { return ArtifactRef{}, err }
    if step.State.NeedsReconcile() {
        return x.Reconcile(ctx, step.ID, step.CallID, reserved)
    }
    attempt, err := x.store.BeginAttempt(ctx, step.ID, reserved)
    if err != nil { return ArtifactRef{}, err }
    binding := ExecutionBinding{
        Capability: handle, TenantID: grant.TenantID,
        CallID: step.CallID, Audience: grant.Audience,
        CommandDigest: grant.CommandDigest,
        SnapshotDigest: grant.SnapshotDigest,
        ContractDigest: grant.ContractDigest,
        ServerBuild: grant.ServerBuild,
    }
    return x.dispatchAndSettle(
        ctx, binding, grant, step, attempt, cmd)
}
```

## 8. 最容易怎么翻车

- 验证码失败后自动绕过
- 日志记录完整 Authorization
- 允许模型拼接任意 shell

## 9. 动手与验收

**动手：** 设计测试矩阵：重放 handle，逐一替换身份、CallID、capability、snapshot/contract digest 与 server build；再在四个切点终止 Worker。

**过关：** 设计检查：只有完整匹配的 ExecutionBinding 能写一次；错配零新副作用，Unknown 只按原 CallID 与 approved snapshot 对账。

## 10. 后续图解位置

- `sandbox-capability-gates`（文字通过审核后再排图）
- `approval-capability-sequence`（文字通过审核后再排图）

## 11. 自己问自己

**问：密钥为什么不进模型上下文？**

答：陈平安：密钥留在 Secret Broker，只向匹配 audience 的 Tool 注入短期凭证。宁姚：对，prompt、日志、stderr 和 artifact 都不能带明文。

**问：哪些动作必须审批？**

答：陈平安：create_bill 是写副作用，必须展示 canonical payload 并绑定 approval capability。宁姚：对，MCP 的 readOnly hint 不能降权。

**问：越权拒绝后记录什么证据？**

答：陈平安：越权拒绝要记录 principal、tenant、operation、policy digest、reason 和 audit event。宁姚：对，但不得泄露 secret 或他租户对象。

## 12. 下一站

调用身份、凭证与执行环境都被宿主策略收紧；下一章把同一条调用链的 token、费用、工具次数和墙钟时间放进一份可对账预算。

## 补充 21.1　MCP Adapter 不是信任边界

MCP adapter 的快照页同时显示 protocol version、server identity、build revision 和 tools list hash。

陈平安只比对 schema，就让换过实现的 server 继续沿用旧 approval，还把 MCP Task cancelled 写成了 App Run cancelled。

### 群聊

> **崔东山：** 先生！学生把外部开源的 MCP 协议工具全接进来了！
>
> **阿良：** 外头野路子送进来的包裹，你连拆都不拆就往金库放？
>
> **李宝瓶：** 不可信协议适配器！协议转换与权限隔离必须分层！
>
> **文圣：** 引狼入室非明哲保身！外部协议包一层沙箱，方合礼数！
>
> **宁姚：** MCP 响应视为不可信输入，强行类型转换前必做白名单过滤。
>
> **周米粒：** 生人给的糖葫芦可不能直接吃，要先问过大人！

*两张状态卡被分开放回抽屉，再没有互相改名。*

### 小白一句话

MCP 负责互通，不负责授信；adapter 必须冻结身份、能力和取消映射。

### 像什么

MCP 像旅行插头，只解决‘能不能插上’。它不是防触电开关；adapter 仍要固定身份、允许的工具、超时和取消方式。

### 黑话翻译

- **Tool**：真正会读文件、查库或调用服务的手脚
- **Run**：从开始到结束的一整趟任务
- **approval**：高风险动作动手前的人类放行条

### 技术真相

- snapshot 冻结 protocol version、server identity、不可变 build/revision、capabilities 与 tools list。
- server build/revision 纳入 active contract 和 approval digest；实现变化即使 schema 不变也要求重审批。
- annotation、readOnly 与 idempotent 都是不可信 hint，effect class 只由宿主策略给出。
- OAuth token 校验 audience，禁止向下游透传形成 confused deputy；同名 Tool 按 server identity 隔离。
- App Run 与 MCP Task 分开建模，adapter 显式映射 poll/cancel，Task 状态不得覆盖 Run。

### 看代码

- 先看 MCPSnapshot 的字段和约束：每个字段代表什么，哪些组合才合法。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 MCPSnapshot 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type MCPSnapshot struct {
    ServerIdentity      string
    ServerBuildRevision string
    ProtocolVersion     string
    CapabilitiesHash    string
    ToolsListHash       string
}

type MCPAdapter interface {
    Snapshot(context.Context) (MCPSnapshot, error)
    Call(context.Context, CanonicalCommand) (MCPResult, error)
    PollTask(context.Context, string) (MCPTask, error)
    CancelTask(context.Context, string) error
}
```

**动手：** 保持 schema/capabilities/tools hash 不变，只更换 server build；再伪造 readOnly、错误 audience 与 Task cancel。

**过关：** 旧 snapshot/approval 因 build 变化失效；伪造 hint 不降权；错误 token 被拒绝；MCP Task 不覆盖 run-0827。

**接着去哪：** 协议身份可信后，还要检查 Tool 真正运行在哪里，以及数据会从哪些出口泄露。

## 补充 21.2　隔离要管进程，也要管数据

沙箱终端里跑着一个低权限命令，stderr 窗口旁放着一枚只应短期存在的 secret。

陈平安以为进了容器就万事大吉，子进程却把 secret 打进 stderr，并准备随 artifact 一起上传。

### 群聊

> **崔东山：** 先生！学生刚才想用黑客手段穿透沙箱，被宁姑娘暴打了一顿！
>
> **宁姚：** 再敢在沙箱外乱碰宿主机文件，下一剑砍的就是你的手。
>
> **阿良：** 沙箱数据隔离是铁律，网络和目录权限全得收拢到最小。
>
> **陈平安：** 挂载只读目录，敏感凭证禁止注入容器环境。
>
> **陆沉：** 方寸之间见天地，把野兽关在笼子里，它才懂什么是规矩。
>
> **周米粒：** 右护法画了个大圆圈，谁迈出圈子谁是小狗！

*stderr 窗口被封进隔离袋，上传按钮也随之变灰。*

### 小白一句话

sandbox 不只隔进程，还要把 secret、输出和数据留存一起纳入策略。

### 像什么

像让孩子在铺好防水布的房间画画：不只要关门，还要收走危险颜料、限制能画的位置、检查带出去的纸，并规定垃圾和作品留多久。

### 黑话翻译

- 这一节先不加新词，重点看它如何把上一处事故收住。

### 技术真相

- 使用非特权身份、只读根、明确可写挂载和固定 image digest。
- 限制 CPU、内存、PIDs、文件、输出和墙钟时间，并杀完整进程树。
- 拒绝宿主 socket、设备、硬链接和归档路径穿越，产物先隔离验证。
- Secret broker 按 audience 注入短期凭证，五个数据出口统一脱敏。
- 数据按敏感度、租户、保留期和删除策略管理，删除动作也留审计。

### 看代码

- 先看 SandboxPolicy 的字段和约束：每个字段代表什么，哪些组合才合法。
- 最后核对 SandboxPolicy 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type SandboxPolicy struct {
    ImageDigest    string
    UID, GID       uint32
    ReadOnlyRoot   bool
    Network        NetworkPolicy
    MaxCPUTime     time.Duration
    MaxWallTime    time.Duration
    MaxMemoryBytes int64
    MaxPIDs        int64
    MaxFileBytes   int64
    MaxOutputBytes int64
    AllowSockets   bool
}
```

**动手：** 让子进程尝试 fork、后台驻留、路径逃逸和回显 secret。

**过关：** 越界行为被拒绝或收口；输出无 secret；跨租户与过期数据不可读取。

**接着去哪：** 环境边界稳定后，下一步才有资格谈预算：调用开始前预留，事实回来后对账。

---

# 第二十二章  失败要有证词：预算、Trace、重放与 Eval

**本章要解决：** 掌握多维预算、错误指纹、熔断、版本记录、只读重放和 golden eval。

## 1. 闯祸现场

预算面板显示根 Run 还剩一格额度，两名 Worker 同时举着各自的 token 估算单站在门口。

陈平安让它们先执行、回来再记账，两张调用单同时越过 hard limit，Unknown 的一张还说不清实际花费。

## 2. 群聊

> **崔东山：** 先生！大模型一句话吐一百个字，浏览器等得花儿都谢啦！
>
> **阿良：** 一口一口吐出来，流式传输看着才像那么回事。
>
> **李宝瓶：** SSE 服务端事件流！带上递增 ID，重连只补缺失！
>
> **文圣：** 涓涓细流润物无声！事件有序排列，断线可续才是王道！
>
> **宁姚：** 心跳包保活，客户端断线立即释放上下文与后台计算。
>
> **周米粒：** 小水车转呀转，清泉一口一口流出来，可甜啦！

*两张估算单先盖了预留章，预算面板终于不再抢答。*

## 3. 小白一句话

失败留下版本、输入、步骤、花费与判词。

## 4. 像什么

失败不能只留一句‘没成功’。要像事故现场一样留下时间、版本、输入、脚印、花费和判词，之后才能重放、比较和追责。

## 5. 先拆黑话

- **Trace**：一次请求一路经过哪些地方的脚印串
- **Tool**：真正会读文件、查库或调用服务的手脚
- **Run**：从开始到结束的一整趟任务
- **Replay**：拿旧证据重新走一遍，但要先说清是哪种重走
- **Eval**：用固定试卷和判分规矩比较候选版本

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 预算覆盖 token、费用、步骤、时间、工具调用和高风险动作；同错指纹触发熔断。
- 普通 hash 只在可信摘要另存时发现损坏；防篡改证据使用不可变 manifest、签名或 MAC、密钥版本与追加式事件链。
- 事件回放、mock 工具轨迹重演和真实再执行是三种不同模式，副作用策略各自明确。
- Eval 固定数据集、评判规则、模型/提示/工具/策略/代码版本，并保留失败样本。

## 7. 看代码别慌

- 先看 RunArtifact 的字段和约束：每个字段代表什么，哪些组合才合法。
- 最后核对 RunArtifact 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type RunArtifact struct {
    InputRef, ContextRef, ToolResultRef string
    ModelRevision, PromptVersion       string
    ToolSchemaVersion, PolicyVersion   string
    CodeRevision, ExternalDataVersion  string
    ManifestRef, ManifestDigest        string
    Signature, SigningKeyVersion       string
}

// Replay modes: event playback, mocked-tool trajectory replay,
// or explicit real re-execution.
```

## 8. 最容易怎么翻车

- 只存最终答案
- trace 里放完整密钥
- 重放时再次执行写工具

## 9. 动手与验收

**动手：** 设计练习：画 manifest、三种 replay、EvalProtocol 与预算熔断的证据流；另列未来实验仓库所需 fixture、fake tool 和故障钩子。

**过关：** 设计评审只检查图中是否标出：event playback 零副作用、真实重跑另建 Run、manifest 验签/轮换、Eval 对照项；不等于实现已通过。

## 10. 后续图解位置

- `observability-trace-architecture`（文字通过审核后再排图）
- `evidence-replay-matrix`（文字通过审核后再排图）

## 11. 自己问自己

**问：为什么不能无限 Agent loop？**

答：陈平安：无限 loop 会穿透 token、费用、Tool 次数和墙钟预算，也会重复未知副作用。宁姚：对，hard limit 阻止新调用。

**问：dry-run replay 如何避免副作用？**

答：陈平安：event playback 不执行 Tool，mock trajectory 用固定替身；真实重跑才新建 Run 和审批。宁姚：对，三种 Replay 不能共用承诺。

**问：成功率必须说明哪些条件？**

答：陈平安：成功率要说明样本、版本、采样次数、分布、置信区间和阈值。宁姚：对，单次通过不能证明质量。

## 12. 下一站

预算、事件与 Replay 的承诺已经分开；下一章把修复放进 Coding Harness，让候选代码在独立环境里接受确定性验证。

## 补充 22.1　预算先预留，事实后对账

预算台上有根 Run 总账和两张子 Step 明细，两个 Worker 都读到了同一格剩余额度。

陈平安让它们结束后再加 token，两笔实际消耗尚未回来，hard limit 已被同时穿过。

### 群聊

> **崔东山：** 哎呀！大模型进入死循环，刷了八万次调用，钱包穿孔啦！
>
> **阿良：** 天上一天，地上一年，再有钱也扛不住机器狂刷啊。
>
> **李宝瓶：** 调用预算账本！每次请求扣减 Token 预算，透支直接熔断！
>
> **老瞎子：** 没配硬预算就敢放智能体撒欢？老瞎子替你心疼银子！
>
> **阮秀：** 量入为出，柴米油盐皆有度，过头了只能吃土。
>
> **宁姚：** Run 级与租户级双重预算控制，超额在网关秒级阻断。

*总账和明细盖上同一枚预留章，余额终于只减少一次。*

### 小白一句话

estimate 决定能否开始，actual 决定真实消耗；unknown 不能被当作零。

### 像什么

像游戏厅代币：开玩前按最坏情况先留出一把，结束后按真实花费结算。机器黑屏时不能当成一枚没花，要保留预留直到对账。

### 黑话翻译

- **幂等**：同一件事喊两遍，也只真正办一次
- **Agent**：在明确边界内观察结果并选择下一步的执行者
- **Tool**：真正会读文件、查库或调用服务的手脚
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **Unknown**：事情可能做了，也可能没做，账还没对清

### 技术真相

- token、money_micros、tool_calls 和 wall_millis 分维度记账。
- 调用前按最坏估计原子 reserve；确定零消耗才 release，unknown 保留并对账。
- nested Agent 同时记录子 Step 与根 Run 归属，不能绕开总额度。
- hard limit 阻止新调用；soft limit 触发降级、提醒或人工判断。
- 超限终态记录维度、阈值、已用、预留和未完成副作用。

### 看代码

- 先看 BudgetStore 的字段和约束：每个字段代表什么，哪些组合才合法。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 BudgetStore 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type BudgetStore interface {
    Reserve(
        context.Context,
        string,
        map[BudgetDimension]int64,
    ) (ReservationSet, error)
    ReconcileBatch(
        context.Context, string, UsageDigest,
        map[BudgetDimension]int64,
    ) error
    ReleaseProvenUnused(context.Context, string) error
    MarkUnknown(context.Context, string) error
}
```

**动手：** 让两个 worker 并发预留同一根 Run 的剩余预算，再返回不同 actual。

**过关：** 总预留不超 hard limit；多维 actual 原子幂等对账；unknown 不释放且事件完整。

**接着去哪：** 预算账能对上数字后，还要证明这些记录没被换过；证据正文与签名需要分开。

## 补充 22.2　证据正文与签名分开

证据桌上放着 canonical manifest body、空 envelope 和一把即将轮换的签名 key。

陈平安把 signature 塞回 body 再计算 digest，文件每签一次就改变一次，验证器绕成了循环。

### 群聊

> **崔东山：** 学生传过去的清单在半道被人改了俩参数，居然还跑通了！
>
> **阿良：** 这就叫半路杀出个程咬金，把你的粮饷换成了石头。
>
> **李宝瓶：** 签名清单信封！非对称签名，篡改一个字节就验签失败！
>
> **文圣：** 君子之誓坚如金石！数字签名封口，有差池当场诛心！
>
> **宁姚：** Manifest 必须携带防篡改签名与时效戳，拒绝重放攻击。
>
> **周米粒：** 小泥封盖得结结实实，谁偷看一眼就露馅！

*空 envelope 合上后，manifest body 再也没有追着自己改。*

### 小白一句话

先规范化不可变 manifest body，再让独立 envelope 签它的 digest。

### 像什么

像把考试答案先排成固定版式、算出指纹，再把指纹装进签名信封。信封可以换签名算法，答案正文不能偷偷跟着变。

### 黑话翻译

- **Run**：从开始到结束的一整趟任务

### 技术真相

- manifest body 固定 schema version、Run、fingerprint、event head 和产物 digest。
- 按明确 canonical format 生成字节，字段重排不能改变被签语义。
- envelope 仅保存 payload digest、algorithm、key ID、signature 和时间。
- 验证先查 trust policy 与撤销状态，再验 payload digest 和签名。
- 签名覆盖 subject digests，不只签一个可替换来源的 URL。

### 看代码

- 先看 Verify 的输入和返回值：它接什么，最后必须交回什么。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Verify 的出口：成功交回什么，失败留下什么证据。

```go
type SignatureEnvelope struct {
    PayloadDigest string
    Algorithm     string
    KeyID         string
    Signature     []byte
    SignedAt      time.Time
}

func Verify(
    body []byte,
    env SignatureEnvelope,
    trust TrustPolicy,
) error
```

**动手：** 分别篡改 artifact digest、event head、key ID 和 canonical body。

**过关：** 所有篡改均失败；合法旧签名可按历史策略验证；撤销 key 被拒绝。

**接着去哪：** 证据能验真之后，还要说明 Replay 到底会不会碰外部世界。

## 补充 22.3　三种 Replay，三套承诺

回放控制台排着事件回放、模拟轨迹和真实重跑三个按钮，陈平安只想把旧页面恢复出来。

他却点了真实重跑，ledger.create_bill 差点再次落账；旁边的评测台还换了一套试卷。

### 群聊

> **崔东山：** 先生！昨天回放旧样本时通过了，今天换个随机种子怎么就挂了？
>
> **陆沉：** 大模型是测不准的玄机，世间哪有两片完全一样的蝴蝶翅膀？
>
> **阿良：** 玄机个屁，回放测试必须固定温度与种子，建立确定性基准。
>
> **陈平安：** 回测矩阵记录输入、输出与评分断言，变动超标立即预警。
>
> **宁姚：** 把不可控的概率困在可测量的牢笼里，才是真正的剑意。
>
> **李宝瓶：** 每一次回放都有据可查，写得整整齐齐才叫好学问！

*三个按钮被分开上锁，EvalProtocol 清单留在了最上面。*

### 小白一句话

事件回放、模拟轨迹和真实重跑，是三种不同承诺。

### 像什么

录像回放、拿玩偶排练、真人重新演一次，看着都像‘重放’，承诺却完全不同。比较成绩前还要固定试卷和判分规则，只改变要测试的选手。

### 黑话翻译

- **Metric**：系统现在胖瘦快慢的仪表盘数字
- **Tool**：真正会读文件、查库或调用服务的手脚
- **Run**：从开始到结束的一整趟任务
- **Eval**：用固定试卷和判分规矩比较候选版本

### 技术真相

- 可比性先固定评测协议：dataset/split/sample IDs、grader、metric、seed 与 threshold policy。
- model、prompt、tool、policy 与 code 是允许声明变化的 treatment；它们正是 Eval 要比较的对象。
- 未声明的协议漂移返回 ErrNotComparable；结果保存样本引用、分布、置信区间、失败引用和签名。
- event playback 零 Tool；mock trajectory 固定外部输入；real re-execution 新建 Run 与审批。

### 看代码

- 先看 Compare 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Compare 的出口：成功交回什么，失败留下什么证据。

```go
type EvalProtocol struct {
    DatasetDigest, SplitDigest, SampleIDsDigest string
    GraderDigest, MetricDigest, SeedsDigest string
    ThresholdPolicyDigest string
}
type Treatment struct {
    ModelDigest, PromptDigest, ToolDigest string
    PolicyDigest, CodeDigest string
}
type EvalManifest struct {
    Protocol EvalProtocol
    Treatment Treatment
}

func Compare(a, b EvalManifest) error {
    if a.Protocol != b.Protocol { return ErrNotComparable }
    return nil // declared treatment differences are what Eval measures
}
```

**动手：** 保持 EvalProtocol 不变，分别改变 model、prompt 与 code treatment 并比较分布；再改变 dataset 或 grader，验证返回 ErrNotComparable。

**过关：** 声明的 treatment 差异可比较；dataset/split/sample、grader、metric、seed 或 threshold policy 漂移会拒绝比较。

**接着去哪：** 三种 Replay 已分流，最后要确保事件主轴本身足以重建状态，而不是依赖可能被采样的 trace。

## 补充 22.4　Trace 会丢，事件账本不能丢

监控墙上只有一条完整 trace，持久事件表却被清得只剩表头，SSE 客户端正拿着旧游标重连。

陈平安让客户端按 trace ID 去重，采样刚好漏掉中间 span，同一条状态变化便被重复播放。

### 群聊

> **阿良：** 系统崩溃重启，之前的决策事件全化作青烟飘走了。
>
> **左右：** 金石有声，落笔无悔。
>
> **李宝瓶：** 持久化事件脊柱！所有 Agent 行为全录成不可变事件！
>
> **老瞎子：** 事情办了不留底，死无对证！事件落盘，千年不毁！
>
> **阮秀：** 一笔一划刻在石碑上，风吹雨打也磨不掉。
>
> **宁姚：** 事件流只追加不修改，全量状态变更均由事件驱动恢复。

*旧游标沿着 event sequence 接回原位，没有再播第二遍。*

### 小白一句话

持久事件是审计主轴，trace、SSE 和 metric 都只是投影。

### 像什么

持久事件像学校总值日日志，Trace、SSE 和 Metric 像黑板通知、广播和统计表。黑板可以擦，广播会漏听，总日志不能跟着消失。

### 黑话翻译

- **事务**：要么整组成功，要么整组撤回
- **SSE**：服务端向浏览器单向喊话的小喇叭
- **Metric**：系统现在胖瘦快慢的仪表盘数字
- **Trace**：一次请求一路经过哪些地方的脚印串
- **Tool**：真正会读文件、查库或调用服务的手脚
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **approval**：高风险动作动手前的人类放行条
- **outbox**：和业务账一起落库、之后再送出的发件箱

### 技术真相

- 状态转换与 outbox event 同事务提交，事件只追加且带单调 sequence。
- 关联 run、step、attempt、tool call、approval 和 capability ID。
- 事件链保存前序 digest；manifest 只签 event head 与必要 subject digest。
- SSE 按 sequence 重连去重；trace span 记录 event ID 而非替代事件。
- 高基数明细留在 ledger，metric 只保存可聚合的延迟、错误和成本。

### 看代码

- 先看 EventRecord 的字段和约束：每个字段代表什么，哪些组合才合法。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 EventRecord 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type EventRecord struct {
    EventID, RunID, StepID string
    AttemptID, ToolCallID  string
    ApprovalID, CapabilityID string
    SchemaVersion uint32
    Sequence      uint64
    Kind          string
    PayloadRef    string
    PayloadDigest string
    PreviousDigest string
    CurrentDigest  string
    CreatedAt      time.Time
}

// CurrentDigest covers canonical metadata and PayloadDigest.
```

**动手：** 删除全部 trace 数据，只用事件账本重建一次审批、执行和对账过程。

**过关：** 状态可完整重建；sequence 无缺口或重复；SSE 重连不会重复消费。

**接着去哪：** 事件链已经能独立作证；Coding Harness 接下来也必须把每份候选补丁与这条证据链绑定。

---

# 第二十三章  AI 写代码也要过剑阵：Coding Harness

**本章要解决：** 把 spec、上下文发现、受限编辑、构建测试、review、重试熔断与人工合并连成编码闭环。

## 1. 闯祸现场

用户的 dirty 仓库里留着未提交文件和暂存内容，旁边的独立工作区标签还空着 candidate@base。

陈平安直接改了宿主仓库，又想用 git reset 收尾，暂存区里属于用户的一段修改当场消失。

## 2. 群聊

> **阿良：** 模型回答看着挺像样，一跑真实账目全差了三万八千两。
>
> **左右：** 剑招花哨，不敌当胸一刺。
>
> **李宝瓶：** 固定评测集回归！不能光看表面流畅，要看命中与越权率！
>
> **老瞎子：** 嘴皮子再溜，过不了固定考卷也是花架子！拉出来溜溜！
>
> **阮秀：** 真金不怕火炼，假把式一进炉子全成灰了。
>
> **宁姚：** 安全与越权测试拥有独立一票否决权，绝不向平均分妥协。

*宿主仓库重新合上，只有 candidate 工作区亮着验证灯。*

## 3. 小白一句话

先立约，再落笔；机器验过，人来定夺。

## 4. 像什么

AI 改代码像让一个手速很快的实习生修钟表：先在副本上动手，再跑测试、静态检查和评审；不能失败后把主人的桌面一起掀了。

## 5. 先拆黑话

- **candidate**：和用户工作区隔开的候选改动副本
- **base**：候选改动开始时所依据的提交版本
- **Context**：沿调用链传下去的取消铃和截止钟

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 先写 spec/plan/tasks，明确用户可见行为、接口、数据、安全边界和验收证据。
- Context discovery 读取规则、调用链、消费者、测试和运行证据，不把整个仓库无脑塞给模型。
- 工具授权限制 command、args、cwd、env、network、进程树、时间、输出、写路径与 diff。
- 不可信构建测试运行在隔离环境；同错指纹和预算触发人工接管。
- 生产发布、主干合并和高风险写操作仍由 branch protection 与独立人工审批决定。

## 7. 看代码别慌

- 先看 CodingCapability 的字段和约束：每个字段代表什么，哪些组合才合法。
- 最后核对 CodingCapability 的生命周期：谁创建、谁更新、怎样拒绝非法状态。

```go
type CodingCapability struct {
    AllowedCommands []CommandRule // args, cwd, env and network
    WritablePaths   []string
    MaxLoops, MaxProcesses int
    MaxCPU, MaxBytes, MaxDiff int64
}

// Run untrusted build/tests in isolation.
// Branch protection and human merge stay external.
```

## 8. 最容易怎么翻车

- 需求不清便直接改代码
- 测试失败就无界自修复
- 让模型持有生产凭证或直接合并主干

## 9. 动手与验收

**动手：** 为真实小改动定义 CodingCapability，在隔离环境执行构建测试并触发超预算人工接管。

**过关：** 越权参数/路径/网络被拒绝；每轮有 diff、测试和 review 证据；机器不能绕过 branch protection 合并。

## 10. 后续图解位置

- `coding-harness-loop`（文字通过审核后再排图）

## 11. 自己问自己

**问：何时应先 Explore？**

答：陈平安：需求入口、调用链或用户工作区状态不明时先 Explore。宁姚：对，证据不足时不直接编辑。

**问：哪些步骤必须确定性执行？**

答：陈平安：format、lint、build、test 和 digest 校验由确定性工具执行。宁姚：对，Reviewer 只依据契约与证据判定。

**问：什么条件触发人工接管？**

答：陈平安：同错重复、预算耗尽、越界、base 变化或高风险合并都转人工。宁姚：对，机器不能绕过分支保护。

## 12. 下一站

候选代码与用户工作区已经隔离，验证和人工审批也留下证据；最后一章回到 HTTP 入口，用 request key 把重复请求收束到同一个 Run。

## 补充 23.1　候选改动必须离开宿主工作区

隔离工作区里摆着 base revision、rules digest、sandbox image 和 patch digest 四张标签，宿主仓库仍保持 dirty。

陈平安验证完成后发现 base 已前进，却想拿旧 evidence 直接 merge，新提交与旧补丁当场打架。

### 群聊

> **崔东山：** 新训出来的模型看着挺能打，学生直接推上线当主力啦！
>
> **阿良：** 生瓜蛋子不经考核就上战场，纯属给对面送军功章。
>
> **李宝瓶：** 候选版本生命周期！影子模式跑一周，胜率达标才切流！
>
> **文圣：** 欲速则不达！候选、灰度、全量层层考较，才是良将！
>
> **宁姚：** 影子流量并联跑分，回归率不降反升立即冻结提拔。
>
> **周米粒：** 排队领号牌，小新兵先在后头好好练操！

*旧验收单被夹进审计册，新 candidate 从干净 base 重新起步。*

### 小白一句话

每次编辑落在 candidate@base；失败只 discard 候选，不碰宿主状态。

### 像什么

像先复印一张涂色页给 AI 改。涂坏了丢复印件，原画和桌上没收好的彩笔都不碰；验证通过后，仍由主人决定要不要贴回画册。

### 黑话翻译

- **事务**：要么整组成功，要么整组撤回
- **Trace**：一次请求一路经过哪些地方的脚印串
- **Harness**：管住模型手脚、权限、预算和证据的外壳
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **approval**：高风险动作动手前的人类放行条
- **sandbox**：把程序关进权限和资源都受限的练功房
- **candidate**：和用户工作区隔开的候选改动副本
- **base**：候选改动开始时所依据的提交版本

### 技术真相

- Candidate 绑定 Run/Step/Attempt、event head、base/rules/sandbox/patch digest、验证 manifest、review 与 merge approval。
- edit、verify、review、approve、merge/discard 每次状态转换与 durable event 在同一事务 CAS 落地。
- merge 前重验 base、patch、evidence、approval、fence 与目标分支保护；旧 base 或旧 fence 一律失败。
- trace 全丢仍可从事件链重建候选状态；取消或失败只 discard harness worktree，宿主 dirty 文件和 index 字节不变。

### 看代码

- 先看 Transition 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 最后核对 Transition 的出口：成功交回什么，失败留下什么证据。

```go
type Candidate struct {
    ID, RepoID, RunID, StepID, AttemptID string
    BaseRevision, RulesDigest, SandboxImageDigest string
    PatchDigest, VerificationManifestDigest string
    ReviewDigest, ApprovalID, EventHead string
    WorktreeRef string
    Fence Fence
    Version int64
    State CandidateState
}

func (h *CodingHarness) Transition(
    ctx context.Context, c Candidate, next CandidateState,
    evidence EvidenceManifest,
) error {
    if evidence.PatchDigest != c.PatchDigest {
        return ErrEvidenceMismatch
    }
    expected := ExpectedState{
        Fence: c.Fence, StepVersion: c.Version,
    }
    return h.store.CASAndAppendEvent(
        ctx, c.ID, expected, next, evidence)
}
```

**动手：** 在 edit/verify/review/approve 各切点崩溃，再篡改 patch/test evidence，并制造 base 前进与 lease takeover。

**过关：** 事件可重建候选；篡改证据、旧 base、旧 fence 都拒绝 merge；宿主工作区和 index 字节级不变。

**接着去哪：** 候选代码可以安全落地后，还要把线上入口改成 CreateQueuedOnce，让网络重试不复制 Run。

---

# 第二十四章  最后一炉：可控 Ledger Agent

**本章要解决：** 把 Go 服务、数据库、流式运行、Tool/MCP、权限、HITL、trace 与 eval 接成完整系统。

## 1. 闯祸现场

网络超时后，客户端又递来 entry-0827，桌上并排摆着 run-0827、req-0827 和 receipt-req-0827 三张卡。

陈平安只按 entry key 查旧 Run，险些把同租户另一位 owner 的请求当成同一次意图。

## 2. 群聊

> **崔东山：** TradingAgents 挂单万千，大阵已成，誓要气吞山河！
>
> **文圣：** 蜉蝣见青天不知死活！tenant 与 owner 隔离看紧没有？
>
> **老瞎子：** 老瞎子眼盲心不盲！异摘要必拒，凭原 CallID 查 receipt！
>
> **宁姚：** 同租户同摘要才返旧 Run；异摘要直接回 409 拒掉。
>
> **陈平安：** Go 账本认死理，双录锁死才算交割，守住生产最后底线。
>
> **周米粒：** 大账本安安全全，小米粒天天都能吃香喝辣！

*req-0827 只落下 bill-0827；网络断开时，后台账房仍继续核对。*

## 3. 小白一句话

模型可以不稳，剑匣必须可控、可测、可恢复、可审计。

## 4. 像什么

最终系统像带护栏的自动账房：Run 管整趟目标，Step 管一次动作，CallID 固定副作用身份；approval、预算和 receipt 决定能否动手、何时结算。

## 5. 先拆黑话

- **Trace**：一次请求一路经过哪些地方的脚印串
- **Agent**：在明确边界内观察结果并选择下一步的执行者
- **Tool**：真正会读文件、查库或调用服务的手脚
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **receipt**：外部系统办完事后给回来的回执
- **Eval**：用固定试卷和判分规矩比较候选版本
- **tenant**：同一系统里互相不能偷看账本的一户人家
- **owner**：这份资源真正归属的那个人或主体

## 6. 技术真相

下面这些话不卖萌，是本章必须守住的工程边界：

- 入口唯一约束是 tenant_id + authenticated owner_id + operation + entry_key；首次写入同时保存双摘要与 visibility。
- 同一 owner 作用域内，entry-0827 同摘要返回 run-0827；同 key 不同输入或 profile 返回 409 且零副作用。
- 命中已有 Run 仍按当前 Principal 做对象授权；同租户不同 owner 与跨租户都不能读取或接管旧 Run。
- step-create-bill-0827 固定 call-create-bill-0827，并在可信 Executor 内映射下游 idempotency key req-0827。
- req-0827 只创建 bill-0827；响应丢失后按 receipt-req-0827 对账，不重新执行 create_bill。

## 7. 看代码别慌

- 先看 StartRun 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 StartRun 的出口：成功交回什么，失败留下什么证据。

```go
func (h *Handler) StartRun(
    ctx context.Context, p Principal, key EntryKey,
    input CreateBillInput, profile ExecutionProfile,
) (Run, error) {
    entry := CanonicalEntry{
        TenantID: p.TenantID, OwnerID: p.SubjectID,
        Operation: "create_bill", Key: key,
        InputDigest: input.Digest(), ProfileDigest: profile.Digest(),
        Visibility: OwnerVisible,
    }
    // Unique scope: tenant + authenticated owner + operation + key.
    run, created, err := h.runs.CreateQueuedOnce(ctx, entry, input)
    if errors.Is(err, ErrDigestConflict) {
        return Run{}, ErrIdempotencyConflict // only this owner's key
    }
    if err != nil { return Run{}, err }
    if !created && !h.policy.CanReadRun(p, run) {
        return Run{}, ErrNotFound
    }
    return run, nil
}
```

## 8. 最容易怎么翻车

- 为了 Agent 化而 Agent 化
- 验收只看演示
- 上线后没有失败闭环

## 9. 动手与验收

**动手：** 设计练习：为同/异 owner 复用 entry-0827、同 owner 改摘要、commit 后丢 receipt 三种场景画时序与验收表。

**过关：** 设计评审只检查图中是否标出：同 owner 同摘要复用、异摘要冲突、不同 owner 隔离、原 CallID 对账；实现仍须唯一约束与故障测试。

## 10. 后续图解位置

- `ledger-agent-main-path`（文字通过审核后再排图）
- `ledger-agent-evidence-path`（文字通过审核后再排图）
- `harness-seven-domains`（文字通过审核后再排图）
- `book-learning-map`（文字通过审核后再排图）

## 11. 自己问自己

**问：dispatch 前为何先持久化 reservation 与 checkpoint？**

答：陈平安：先校验 active approval，再于 dispatch 前原子写 approval reservation、预算 reservation、版本/fence 与事件。宁姚：请求不能先发，账随后再补。

**问：缓存失效为何在 commit 后？**

答：陈平安：数据库 commit 后再失效缓存，避免失败事务先删缓存后又重建旧值。宁姚：缓存只是投影。

**问：上线门禁由哪些证据组成？**

答：陈平安：上线门禁要有入口幂等、唯一副作用、receipt 对账、取消状态、事件重建、Eval 和人工批准证据。宁姚：能演示不等于闭环。

## 12. 下一站

同一个 Ledger Agent 已从自然语言入口走完受控 Tool、持久 Run/Step、Context、权限、预算、Replay 与 Coding Harness；入口重试返回同一 Run，未知副作用先对账，整条事件链可恢复、可验证。

## 补充 24.1　Handler 只入队，Worker 才执行

HTTP Handler 的计时条只剩一秒，桌上却还没有 queued Run，Worker 的 lease 卡也空着。

陈平安在 Handler 里直接调用模型，请求超时后 run-0827 没有落库，客户端重试又创建了一份工作。

### 群聊

> **陈景清：** 水龙王派八百 Worker 巡江，来一个 Run 就现场捞一条金龙！
>
> **崔东山：** 死泥鳅吹牛！分明是 Worker 定额排队，领了 Run 的号才许动身！
>
> **阿良：** 骨架搭稳了，空转不耗 CPU，有活立刻并发调度。
>
> **陈平安：** Worker 监听持久化队列，处理完每个 Run 立即更新状态机。
>
> **宁姚：** 超时自动转移给其他 Worker；宕机不丢任何处理记录。
>
> **周米粒：** 小工蜂们排整齐，采完蜂蜜记得把小盖子盖好！

*计时条归零时，run-0827 已躺进 queued 列表；断网没有取消它。*

### 小白一句话

Handler 只创建持久 queued Run，lease Worker 才推进状态机。

### 像什么

像餐厅前台和后厨：前台先把订单写进不会丢的队列并给号码，后厨拿到租约后才开火。客人挂电话，订单不会凭空蒸发。

### 黑话翻译

- **幂等**：同一件事喊两遍，也只真正办一次
- **Run**：从开始到结束的一整趟任务
- **Step**：整趟任务中的一次具体动作
- **CallID**：同一步副作用永远不变的取件号
- **receipt**：外部系统办完事后给回来的回执
- **tenant**：同一系统里互相不能偷看账本的一户人家
- **owner**：这份资源真正归属的那个人或主体
- **outbox**：和业务账一起落库、之后再送出的发件箱

### 技术真相

- CreateQueuedOnce 的唯一键为 tenant-7/user-7/create_bill/entry-0827，并持久化双摘要与 visibility。
- 同一 owner 作用域下，同 key 同摘要返回 run-0827；不同摘要返回 409 且零副作用；不同 owner/operation/tenant 不碰撞。
- 命中旧 Run 仍执行对象级授权；同 tenant 不同 owner 与跨 tenant 都不能读取或接管。
- step-create-bill-0827 的稳定 CallID 是 call-create-bill-0827；可信 Executor 将它映射为下游 req-0827。
- req-0827 由账本服务幂等落 bill-0827/outbox，并提供 receipt-req-0827；响应丢失只 reconcile。

### 看代码

- 先看 Process 的输入和返回值：它接什么，最后必须交回什么。
- 再找守门条件：哪些坏输入会被立刻请出去。
- 看到 ctx 就问：取消和超时有没有真的传到下一层。
- 看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。
- 找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。
- 最后核对 Process 的出口：成功交回什么，失败留下什么证据。

```go
type EntryContract struct {
    TenantID, OwnerID, Operation, Key string
    InputDigest, ProfileDigest, Visibility string
}

func (w *Worker) Process(ctx context.Context, runID string) error {
    lease, run, err := w.runs.Claim(ctx, runID, w.workerID)
    if err != nil { return err }
    defer lease.StopHeartbeat()
    step, err := w.steps.Next(ctx, run.ID, lease.Fence)
    if err != nil { return err }
    if step.State.NeedsReconcile() {
        return w.executor.Reconcile(
            ctx, step.ID, step.CallID, lease.Fence, step.Version)
    }
    return w.executor.ExecuteStep(
        ctx, lease.Fence, step.Version, step)
}
```

**动手：** 并发提交 entry-0827 的同摘要与冲突摘要，并在 send、commit、receipt、settle 切点终止 Worker。

**过关：** 同摘要只建 run-0827；冲突摘要 409、零副作用；跨作用域不碰撞；不可见 Run 不泄露；重复 Step 只落一个 bill/outbox，receipt 可恢复。

**接着去哪：** 到这里，入口幂等、可恢复执行、审批与预算、unknown/reconcile、事件证据和代码修复已经汇成同一条闭环。

---
