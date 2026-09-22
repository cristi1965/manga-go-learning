from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from types import SimpleNamespace


PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT
SOURCE_MODEL = PROJECT / "manuscript" / "source-model.json"
OUT = PROJECT / "output" / "人间铸剑录_v15_幼稚化ELI5_完整文字审稿版.md"
EVIDENCE = PROJECT / "evidence" / "text-review-coverage.json"
CONTENT_OVERRIDES = PROJECT / "manuscript" / "text-content-overrides.json"
STORY_FILES = (
    PROJECT / "manuscript" / "story-go.json",
    PROJECT / "manuscript" / "story-backend.json",
    PROJECT / "manuscript" / "story-harness.json",
)

FEMALE_SPEAKERS = {"宁姚", "李宝瓶", "阮秀", "周米粒", "剑灵"}
STORY_ANCHORS = {
    ("chapter", "8"): ("Context",),
    ("chapter", "9"): ("HTTP",),
    ("chapter", "11"): ("事务", "幂等"),
    ("chapter", "14"): ("SSE", "bill_id"),
    ("chapter", "17"): ("模型",),
    ("chapter", "19"): ("Run", "Step", "CallID"),
    ("chapter", "24"): ("tenant", "owner", "CallID", "receipt"),
    ("supplement", "harness-approval-reservation"): ("Unknown",),
    ("supplement", "harness-handler-worker-skeleton"): ("Run", "Worker"),
}


def load_source():
    payload = json.loads(SOURCE_MODEL.read_text(encoding="utf-8"))
    source = SimpleNamespace(
        CHAPTERS=payload["chapters"],
        SUPPLEMENTS=payload["supplements"],
        VOLUMES={int(key): tuple(value) for key, value in payload["volumes"].items()},
    )
    apply_content_overrides(source)
    return source


def apply_content_overrides(source) -> None:
    payload = json.loads(CONTENT_OVERRIDES.read_text(encoding="utf-8"))
    chapter_map = {str(index): chapter for index, chapter in enumerate(source.CHAPTERS, 1)}
    supplement_map = {item["id"]: item for item in source.SUPPLEMENTS}
    for chapter_id, fields in payload.get("chapters", {}).items():
        if chapter_id not in chapter_map:
            raise ValueError(f"unknown text-review chapter override: {chapter_id}")
        for field, value in fields.items():
            if field not in chapter_map[chapter_id]:
                raise ValueError(f"unknown chapter field: {chapter_id}.{field}")
            chapter_map[chapter_id][field] = value
    for item_id, fields in payload.get("supplements", {}).items():
        if item_id not in supplement_map:
            raise ValueError(f"unknown text-review supplement override: {item_id}")
        for field, value in fields.items():
            if field not in supplement_map[item_id]:
                raise ValueError(f"unknown supplement field: {item_id}.{field}")
            supplement_map[item_id][field] = value


def load_story_layers(source) -> tuple[dict, dict]:
    chapters: dict[str, dict] = {}
    supplements: dict[str, dict] = {}
    hashes = {}
    for path in STORY_FILES:
        if not path.is_file():
            raise FileNotFoundError(f"missing story layer: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        overlap_chapters = set(chapters) & set(payload.get("chapters", {}))
        overlap_supplements = set(supplements) & set(payload.get("supplements", {}))
        if overlap_chapters or overlap_supplements:
            raise ValueError(f"duplicate story units in {path.name}")
        chapters.update(payload.get("chapters", {}))
        supplements.update(payload.get("supplements", {}))

    expected_chapters = {str(index) for index in range(1, len(source.CHAPTERS) + 1)}
    expected_supplements = {item["id"] for item in source.SUPPLEMENTS}
    if set(chapters) != expected_chapters:
        raise ValueError(f"chapter story coverage mismatch: {sorted(expected_chapters - set(chapters))}")
    if set(supplements) != expected_supplements:
        raise ValueError(f"supplement story coverage mismatch: {sorted(expected_supplements - set(supplements))}")

    longest = {"kind": "", "id": "", "chars": 0, "text": ""}
    dialogue_turns = 0
    for kind, units in (("chapter", chapters), ("supplement", supplements)):
        for unit_id, item in units.items():
            opening = item.get("opening")
            turns = item.get("dialogue")
            closing = item.get("closing")
            if not isinstance(opening, list) or len(opening) != 2 or not all(isinstance(x, str) and x.strip() for x in opening):
                raise ValueError(f"{kind}:{unit_id} opening must contain two paragraphs")
            if not isinstance(turns, list) or not 4 <= len(turns) <= 6:
                raise ValueError(f"{kind}:{unit_id} dialogue must contain 4-6 turns")
            dialogue_turns += len(turns)
            if not isinstance(closing, str) or not closing.strip():
                raise ValueError(f"{kind}:{unit_id} missing closing")
            speakers = []
            for turn in turns:
                if not isinstance(turn, list) or len(turn) != 2 or not all(isinstance(x, str) and x.strip() for x in turn):
                    raise ValueError(f"{kind}:{unit_id} invalid dialogue turn")
                speaker, text = turn
                speakers.append(speaker)
                if len(text) > 60:
                    raise ValueError(f"{kind}:{unit_id} dialogue over 60 chars: {text}")
                if len(text) > longest["chars"]:
                    longest = {"kind": kind, "id": unit_id, "chars": len(text), "text": text}
            if not ({"陈平安", "文圣", "老瞎子"} & set(speakers)):
                raise ValueError(f"{kind}:{unit_id} missing core leader turn (陈平安/文圣/老瞎子)")
            if not FEMALE_SPEAKERS.intersection(speakers):
                raise ValueError(f"{kind}:{unit_id} missing substantive female turn")
            combined = "".join(opening) + "".join(text for _, text in turns) + closing
            for anchor in STORY_ANCHORS.get((kind, unit_id), ()):
                if anchor not in combined:
                    raise ValueError(f"{kind}:{unit_id} missing story anchor: {anchor}")
    return {"chapters": chapters, "supplements": supplements}, {
        "story_layer_sha256": hashes,
        "story_chapters": len(chapters),
        "story_supplements": len(supplements),
        "story_dialogue_turns": dialogue_turns,
        "story_longest_turn": longest,
    }


TERM_GLOSSES = {
    "package": "代码住在哪个院子",
    "module": "一整座项目山门和它的依赖清单",
    "internal": "只准自家院子进入的内门",
    "struct": "把一件东西要填的格子做成固定模具",
    "interface": "只问会不会这几招，不查户口",
    "error": "事情没办成时一起带回来的原因条",
    "goroutine": "很轻的小跑堂，可以同时派出很多个",
    "channel": "小跑堂之间传东西的窗口",
    "select": "几个窗口都可能来消息时，等能动的那个",
    "Context": "沿调用链传下去的取消铃和截止钟",
    "race": "两个人同时改一本账，谁先落笔说不清",
    "HTTP": "客户端和服务端互寄有格式的信",
    "Handler": "门房，负责收信和回信",
    "Service": "真正执行业务规矩的账房",
    "Repository": "专门和数据库打交道的库管",
    "transaction": "要么整锅端上桌，要么整锅撤回",
    "事务": "要么整组成功，要么整组撤回",
    "幂等": "同一件事喊两遍，也只真正办一次",
    "Redis": "跑得快的临时小抄，不是真账本",
    "缓存": "为了快而做的副本，不是最终事实",
    "SSE": "服务端向浏览器单向喊话的小喇叭",
    "WebSocket": "两边都能持续说话的对讲机",
    "Log": "发生过什么的文字日记",
    "Metric": "系统现在胖瘦快慢的仪表盘数字",
    "Trace": "一次请求一路经过哪些地方的脚印串",
    "SLO": "答应用户大多数时候要达到的服务线",
    "LLM": "很会猜下一句话、但不会替系统担责的模型",
    "Workflow": "预先写好的步骤编排，按固定顺序推进和停下",
    "Agent": "在明确边界内观察结果并选择下一步的执行者",
    "Tool Calling": "模型提出结构化调用，外层校验后才真正执行",
    "Tool": "真正会读文件、查库或调用服务的手脚",
    "Harness": "管住模型手脚、权限、预算和证据的外壳",
    "Run": "从开始到结束的一整趟任务",
    "Step": "整趟任务中的一次具体动作",
    "CallID": "同一步副作用永远不变的取件号",
    "AttemptID": "这一次尝试自己的小票号",
    "receipt": "外部系统办完事后给回来的回执",
    "Unknown": "事情可能做了，也可能没做，账还没对清",
    "approval": "高风险动作动手前的人类放行条",
    "reservation": "动手前先占住预算或执行名额",
    "budget": "一趟任务最多允许花掉的时间、次数或费用",
    "Replay": "拿旧证据重新走一遍，但要先说清是哪种重走",
    "Eval": "用固定试卷和判分规矩比较候选版本",
    "sandbox": "把程序关进权限和资源都受限的练功房",
    "candidate": "和用户工作区隔开的候选改动副本",
    "base": "候选改动开始时所依据的提交版本",
    "checkpoint": "走到这里先存档，断电后能接着来",
    "tenant": "同一系统里互相不能偷看账本的一户人家",
    "owner": "这份资源真正归属的那个人或主体",
    "outbox": "和业务账一起落库、之后再送出的发件箱",
    "inbox": "收件方用来记住这封信已经处理过的登记簿",
}


CHAPTER_GLOSSARY_FIRST = {
    17: ["Workflow", "Agent", "Tool Calling"],
    19: ["budget", "reservation"],
    23: ["candidate", "base"],
}


CHAPTER_ANALOGIES = {
    1: "像茶棚结账：先说清掌柜收到了价格和付款，再说成功应找回多少钱；若钱不够，也要明确告诉来客，而不是让他猜。",
    2: "像做冰格。Struct 决定格子长什么样，Tag 决定快递员看到的格子名字；模具刻错一个字，冰块没坏，快递单却会送错门。",
    3: "Array 像固定座位表，Slice 像你手里框住的一排座位，Map 像按名字查座位的名册，指针则是写着‘去三楼第二排’的小纸条。",
    4: "班里不问你是谁家的孩子，只问你会不会扫地。会扫地就能加入 Cleaner 接口；这就是按能力组队，不按血统封官。",
    5: "Module 是整所学校，Package 是各个教室，internal 是只许本楼学生进的小仓库，main 像早晨开门时负责把老师、钥匙和课表凑齐的值日生。",
    6: "错误不是一句‘完蛋了’，而是一串快递追踪：哪一站坏了、上一站交了什么、门口最后该回哪种状态码，都要留得下来。",
    7: "像饭馆突然来了很多桌客人。goroutine 是小跑堂，M 是真正在跑的腿，P 是允许上岗的工牌；若两人同时改同一张菜单，race 就来了。",
    8: "派小跑堂出去时，不能只喊‘快去’，还要告诉他什么时候回来、谁能叫停、回来把结果交给谁。否则饭馆关门了，他还在后巷端着盘子发呆。",
    9: "HTTP 像城门收信。信封能拆开，不代表来客可信，也不代表他有权改账；门房要查格式、身份、权限和回信规格。",
    10: "门房别一边验信一边钻进库房翻箱子。Handler 收信，Service 判规矩，Repository 存取账本，各站各的岗，坏了才知道该找谁。",
    11: "数据库像真账房。转账不能只改左边不改右边；同一张付款单拍桌子两次，也不能扣两次钱。事务守整锅，幂等守重复。",
    12: "Redis 像贴在冰箱门上的便签：看得快，但可能过时。真配方还在食谱里；便签丢了可以重抄，不能反过来逼食谱迁就便签。",
    13: "窄桥一次只能过十个人。闸门管桥上有几个，队列管桥头排多长；人太多时要明确说‘现在进不去’，不能让整座山的人一起挤上桥。",
    14: "SSE 像学校广播。某个同学摘下耳机，只代表他不听了，不代表广播站停播；真要取消后台任务，要拿着 bill_id 去按明确的停止按钮。",
    15: "系统生病时，Log 是病历，Metric 是体温计，Trace 是造影路线。只看一张病历就宣布找到病因，和看见一个喷嚏就开刀差不多。",
    16: "上线像全班搬家：钥匙别写在纸箱外面，家具要编号，旧门要能关，新门要能探活，搬坏了还得知道哪些能搬回、哪些数据只能向前修。",
    17: "模型像一位反应极快但不承担后果的顾问：建议可以听，事实仍要核，真正开门、花钱、改账必须由外层系统决定。",
    18: "大脑负责想，Tool 负责动手，MCP 像统一插头，Harness 像带保险丝的工具箱。插头能插上，不代表这台电钻就该交给任何人。",
    19: "像驿站押送一只木匣：Run 是整趟差事，Step 是每一站的交接，CallID 是匣上的总封条，重走也不能换；AttemptID 是这次脚夫的名牌，换人就换。脚夫失联先记 Unknown，等原封条的回执，不再送第二只匣子。",
    20: "上下文像书包。每天背整座图书馆会先把肩膀压垮；总纲常带，细则用到再取，而且每张纸都要写清来自哪本书。",
    21: "权限像家里的钥匙。扫地机器人只需要客厅钥匙，不该顺手拿到保险柜密码；高风险动作先停下来，让人确认后再开门。",
    22: "失败不能只留一句‘没成功’。要像事故现场一样留下时间、版本、输入、脚印、花费和判词，之后才能重放、比较和追责。",
    23: "AI 改代码像让一个手速很快的实习生修钟表：先在副本上动手，再跑测试、静态检查和评审；不能失败后把主人的桌面一起掀了。",
    24: "最终系统像带护栏的自动账房：Run 管整趟目标，Step 管一次动作，CallID 固定副作用身份；approval、预算和 receipt 决定能否动手、何时结算。",
}


SUPPLEMENT_ANALOGIES = {
    "go-control-flow-declarations": "像过马路：红灯、黄灯、绿灯要先分清，不能把红灯塞进‘其他情况’；if 先拦危险，switch 再把明确状态送到各自路口。",
    "go-real-test-file": "像给玩具做耐摔测试：先写清怎么摔、摔几次、什么算坏，再真的摔。只说‘我昨天玩过，没坏’不算测试。",
    "go-utf8-string-byte-rune": "像数积木上的汉字：人眼看见一个字，盒子里可能占了好几个小格。按字节数盒子，和按字符数盒子，不是同一道题。",
    "go-strict-json-contract": "像收快递单：字写得像不像只是第一关。多写陌生字段、同一栏写两遍、箱子后面又偷偷绑一个箱子，都应该在门口说清楚。",
    "go-container-contracts": "像共享一盒彩笔：你以为只是把颜色表借给别人，对方添一支笔，原盒子也可能跟着变；借出前要说清是否共享、顺序是否重要。",
    "go-interface-typed-nil": "像一个贴着‘蛋糕’标签的盒子，里面却是空的。接口先看见标签，就会说‘我不是 nil’；打开盒子才发现里面的指针是 nil。",
    "go-generics-when-useful": "泛型像饼干模具：当好多饼干只差面团口味、切法完全一样时，做一个模具很划算；如果每块都要雕花，硬套模具只会把饼干压烂。",
    "go-module-diagnostics": "像查地铁换乘：别一看到堵车就拆轨道。先看这条依赖从哪站上车、经过哪些线、为什么会来到这里，再决定 tidy 该拿走什么。",
    "go-workspace-boundaries": "go.work 像你桌上临时拼起来的联调沙盘，方便同时摆几个项目；发布时真正装箱的仍是每个 module 自己的 go.mod，不能把桌子一起寄走。",
    "go-error-chain": "像医院转诊单：每一科都可以补一句‘我这里看见了什么’，但不能把上一个诊断撕掉。程序最后才能沿着单子认出最初的病因。",
    "go-defer-panic-recover": "defer 像离开教室前自动关灯，error 像正常举手报告，panic 像消防警铃。不能每次铅笔断了都拉警铃，也不能警铃响后假装什么都没发生。",
    "go-testing-fuzz-cleanup": "普通测试像拿已知钥匙开锁，fuzz 像让机器递来一大篮奇怪钥匙；不管哪把卡住，测试结束都要把临时房间收拾干净。",
    "go-memory-model-race": "像两个小朋友同时改黑板分数。你在门外听见谁先喊，不代表黑板上谁先写；没有锁、消息或原子操作，就没有可靠的先后顺序。",
    "go-sync-tool-choice": "先决定粉笔归谁，再选工具：一个人写就交给单一所有者；偶尔轮流写可上锁；只改一个计数器可用 atomic；需要交接任务再用 channel。",
    "go-goroutine-lifecycle": "派小朋友去楼下买盐时，要同时说清三件事：买到后去哪、妈妈喊停时怎么回来、家里怎么知道他已经回来了。goroutine 也要出生就带退出路线。",
    "go-io-boundaries": "像接水管：水会一段段来，桶有大小，接水人可能走开；必须规定谁关龙头、桶满怎么办、最后一次没水时有没有夹着错误纸条。",
    "go-http-client-server": "像寄一封限时快递：要写最晚送达时间，收到回信要看状态，拆完箱子要关好 Body；快递员没迷路，不等于收件人回的是好消息。",
    "go-httptest-contract": "像在排练室搭一座迷你城门：不用占真实街道，也能把路由、请求头、状态码和回信正文从头走一遍。",
    "backend-09-authn-oidc": "像看学生证：能把塑料卡掰开，不等于卡是真的。要验签名、发行学校、使用场所和有效期，最后再生成系统信得过的身份。",
    "backend-09-object-authz": "门卫认出你是小明，只回答了‘你是谁’；小明能不能拿走小红的书，还要再查这本书归谁、这次动作允不允许。",
    "backend-09-http-boundary": "像商场关门：先给每位来客发编号，再验身份；打烊时先不放新人进来，然后等正在结账的人办完，不能突然拔总电闸。",
    "backend-10-tenant-defense": "像公寓楼的信箱：门牌写 tenant，钥匙来自可信门卫。应用先核一次，数据库查询再带一次门牌条件，不能靠住户自己喊‘我是七楼的’。",
    "backend-11-transaction-helper": "像小卖部结账：扣库存、收钱、记流水是一只托盘，要么一起端走，要么一起退回。可收银机吐纸失败时，钱到底扣没扣，不能只凭没看到小票判断。",
    "backend-11-isolation-locks": "像只剩一个限量玩具：先把那一格锁住，再核对你看到的版本；别人已经买走时叫版本冲突，不存在或不是你的玩具则不能假装成冲突。",
    "backend-11-connection-pool": "连接池像食堂座位：每桌只摆十把椅子，十个服务就是一百把。椅子开得太多，厨房先被挤爆；太少，门口又排长队。",
    "backend-11-outbox-inbox": "像生日礼物和发件卡一起锁进柜子：礼物入账时卡片也必须在。邮差可以重送卡片，收件箱却要记住已经签收，不能因此再发一份礼物。",
    "backend-13-worker-pool": "像游乐园小火车：车上只有固定座位，站台也只有有限排队区。座位是 worker，队伍是 queue；只加检票闸门，不会凭空多出候车空间。",
    "backend-13-resilience": "四块牌子别混用：限流是‘每分钟只进十人’，背压是‘队满请稍等’，重试是‘这次临时失败可再来’，熔断是‘机器坏了，先暂停营业’。",
    "backend-14-stream-slow-client": "像学校广播配耳机：广播可以一直说，某个同学却可能听得很慢。耳机缓存不能无限长，满了就合并消息或请他重新连接，广播站不用跟着停课。",
    "go-benchmark-profile-trace": "给小车调速要三样东西：秒表告诉你快没快，发动机热成像告诉你 CPU 花在哪，路线记录告诉你时间耗在等待哪一段。",
    "backend-15-observability-slo": "像看校医记录：日志写‘小明摔了’，指标说‘今天摔了多少人’，Trace 画出他从楼梯到医务室的路线，SLO 决定严重到什么程度必须停课检查。",
    "go-daily-tooling-gate": "像每天出门摸四个口袋：钥匙、手机、卡、药。清单的价值不是写得漂亮，而是每次都摸；某个口袋空了，还要立刻知道少的是哪一件。",
    "go-lifecycle-graceful-shutdown": "像放学关校门：先挂‘停止入校’，再等教室里的孩子出来，通知值日生收尾，最后按反顺序关灯锁门。",
    "backend-16-config-container": "配置像饭盒标签，可以写今天吃什么；密钥像家门钥匙，只在需要时递到手里，不能印在饭盒、镜像或日志上。",
    "backend-16-deploy-restore": "发布像换一座积木城堡：新城堡不好可以换回旧模型，但已经搬进去的数据不会自动倒带。备份只是仓库里有箱子，恢复演练才证明箱子真能打开。",
    "backend-16-release-gates": "像闯关卡：单测是检查一招，集成测试是两人配合，迁移演练、压测、灰度和回滚证明整支队伍在真实风雨里还能回家。",
    "harness-tool-contract-gate": "像把电钻交给小朋友：先确认按钮、转速、能钻什么、失败怎么停，再限制房间和电量。工具能被发现，只等于看见了电钻，不等于该立刻通电。",
    "harness-approval-reservation": "像坐儿童过山车：先验身高和同意票，再原子地占一个座位。车开出去后结果不明，座位不能立刻放给下个人，要先查这一车到底发没发。",
    "harness-run-step-checkpoint": "Run 是整场游戏，Step 是一关，checkpoint 是存档。闪退后从存档接着玩；同一个宝箱用固定 CallID，不能因为重进一关就再领一次。",
    "harness-mcp-untrusted-adapter": "MCP 像旅行插头，只解决‘能不能插上’。它不是防触电开关；adapter 仍要固定身份、允许的工具、超时和取消方式。",
    "harness-sandbox-data-policy": "像让孩子在铺好防水布的房间画画：不只要关门，还要收走危险颜料、限制能画的位置、检查带出去的纸，并规定垃圾和作品留多久。",
    "harness-budget-ledger": "像游戏厅代币：开玩前按最坏情况先留出一把，结束后按真实花费结算。机器黑屏时不能当成一枚没花，要保留预留直到对账。",
    "harness-signed-manifest-envelope": "像把考试答案先排成固定版式、算出指纹，再把指纹装进签名信封。信封可以换签名算法，答案正文不能偷偷跟着变。",
    "harness-replay-eval-matrix": "录像回放、拿玩偶排练、真人重新演一次，看着都像‘重放’，承诺却完全不同。比较成绩前还要固定试卷和判分规则，只改变要测试的选手。",
    "harness-durable-event-spine": "持久事件像学校总值日日志，Trace、SSE 和 Metric 像黑板通知、广播和统计表。黑板可以擦，广播会漏听，总日志不能跟着消失。",
    "harness-candidate-lifecycle": "像先复印一张涂色页给 AI 改。涂坏了丢复印件，原画和桌上没收好的彩笔都不碰；验证通过后，仍由主人决定要不要贴回画册。",
    "harness-handler-worker-skeleton": "像餐厅前台和后厨：前台先把订单写进不会丢的队列并给号码，后厨拿到租约后才开火。客人挂电话，订单不会凭空蒸发。",
}


def supplement_analogy(item: dict) -> str:
    exact = SUPPLEMENT_ANALOGIES.get(item["id"])
    if exact:
        return exact
    item_id = item["id"].lower()
    tokens = set(item_id.split("-"))
    rules = [
        (("control", "declarations"), "像过马路：红灯、黄灯、绿灯要先分清，不能把红灯塞进‘其他情况’；if 是先拦危险，switch 是把几种明确状态分到不同路口。"),
        (("utf8", "string", "rune"), "像数积木上的字：一个汉字可能由好几个小格子装着。按字节数盒子，和按人眼看到的字符数盒子，不是同一回事。"),
        (("container", "slice", "map"), "像共享一盒彩笔：你以为只是把颜色表借给别人，对方添一支笔，原盒子也可能跟着变；借出前要说清是否共享、顺序是否重要。"),
        (("json", "http", "oidc", "authn", "authz"), "像收快递：箱子能打开，只说明包装没卡住；还要查寄件人、收件人、物品清单和这人有没有权把东西搬走。"),
        (("test", "fuzz", "benchmark", "profile", "trace"), "像给玩具做耐摔测试：先规定怎么摔、摔几次、什么算坏，再记录结果；只说‘我玩过没坏’不算证据。"),
        (("module", "workspace", "interface", "generics"), "像整理积木盒：先确认哪些积木真有共同形状，再决定要不要做通用卡槽；别为了显得高级，把每块积木都磨成一样。"),
        (("error", "panic", "recover"), "像孩子摔倒：能预料的小磕碰要正常告诉大人，只有整层楼要乱套时才拉紧急闸；拉闸后还得知道隔离谁、记录什么。"),
        (("goroutine", "memory", "sync", "worker", "resilience"), "像一群小朋友抢着往黑板写答案。先规定谁拿粉笔、排几个人、铃响怎么停，再谈要不要多发几支粉笔。"),
        (("io", "stream", "sse", "websocket"), "像接水管：水会一段段来，桶有大小，接水人可能走开；必须规定谁关龙头、桶满怎么办、从哪里继续接。"),
        (("transaction", "isolation", "connection", "outbox", "inbox"), "像学校小卖部记账：扣库存和收钱要一起成；广播通知可以重播，但不能因为广播两遍就再扣一包薯片。"),
        (("tenant", "idempot", "cache", "redis"), "像公寓楼的信箱：找得快不等于能开，门牌、住户和钥匙都要对上；同一张取件码扫两次也只能拿走一件。"),
        (("config", "container", "deploy", "release", "lifecycle"), "像搭舞台：道具、钥匙、开场、退场和备用方案都要提前排练；只会把幕布拉开，不算会演出。"),
        (("approval", "budget", "manifest", "replay", "event"), "像坐儿童过山车：先量身高、拿同意票、占一个座位、记住车次；出了状况要查车票和记录，不能凭感觉再发一辆车。"),
        (("mcp", "sandbox", "tool-contract"), "像把电动工具借给小朋友：插头统一只是方便连接，真正安全还得限房间、限电量、限能碰的东西，并有人看着。"),
        (("candidate", "handler-worker", "run-step"), "像打游戏存档：新操作先放进独立存档槽，门口只登记任务，后台玩家再逐关执行；闪退后从存档接，不重领奖励。"),
    ]
    for keys, analogy in rules:
        if any((key in tokens) or ("-" in key and key in item_id) for key in keys):
            return analogy
    return "像教小朋友整理书包：先说清要解决哪件事，再给每件东西固定位置；出错时能找到是哪一格，而不是把整包东西倒在地上。"


def strip_cue(text: str) -> str:
    return re.sub(r"^小白先懂：", "", text).strip()


def glossary_for(parts: list[str]) -> list[tuple[str, str]]:
    joined = "\n".join(parts)
    found = []
    for term, gloss in TERM_GLOSSES.items():
        searchable = joined.replace("t.Run", "") if term == "Run" else joined
        if term.isascii():
            pattern = rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])"
        else:
            pattern = re.escape(term)
        if re.search(pattern, searchable, re.IGNORECASE):
            found.append((term, gloss))
    return found[:10]


def chapter_glossary(index: int, parts: list[str]) -> list[tuple[str, str]]:
    forced = CHAPTER_GLOSSARY_FIRST.get(index, [])
    terms = [(term, TERM_GLOSSES[term]) for term in forced]
    seen = set(forced)
    terms.extend((term, gloss) for term, gloss in glossary_for(parts) if term not in seen)
    return terms[:10]


def dialogue(lines: list[tuple[str, str]]) -> list[str]:
    result = []
    for speaker, text in lines:
        result.append(f"> **{speaker}：** {text}")
        result.append(">")
    if result:
        result.pop()
    return result


def code_reading_guide(code: str) -> list[str]:
    function = re.search(r"\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)", code)
    type_decl = re.search(r"\btype\s+([A-Za-z_]\w*)", code)
    subject = (function or type_decl).group(1) if (function or type_decl) else "这段代码"
    if function:
        guides = [f"先看 {subject} 的输入和返回值：它接什么，最后必须交回什么。"]
    elif type_decl:
        guides = [f"先看 {subject} 的字段和约束：每个字段代表什么，哪些组合才合法。"]
    else:
        guides = ["先看这段代码在读写什么状态，再找它对外承诺的结果。"]
    if "if " in code or "switch " in code:
        guides.append("再找守门条件：哪些坏输入会被立刻请出去。")
    if "context.Context" in code or "ctx" in code:
        guides.append("看到 ctx 就问：取消和超时有没有真的传到下一层。")
    if "error" in code or "err" in code:
        guides.append("看到 err 不要跳过：它有没有被识别、包裹或翻译，而不是悄悄吞掉。")
    if "CallID" in code or "receipt" in code or "idempot" in code.lower():
        guides.append("找到稳定身份：重试时哪个号码绝不能换，回执又和谁绑定。")
    if function:
        guides.append(f"最后核对 {subject} 的出口：成功交回什么，失败留下什么证据。")
    elif type_decl:
        guides.append(f"最后核对 {subject} 的生命周期：谁创建、谁更新、怎样拒绝非法状态。")
    else:
        guides.append("最后核对状态出口：成功改变什么，失败留下什么证据。")
    return guides


def render_chapter(index: int, chapter: dict, supplements: list[dict], stories: dict) -> list[str]:
    story = stories["chapters"][str(index)]
    lines = [f"# {chapter['title']}", "", f"**本章要解决：** {chapter['goal']}", ""]
    lines += ["## 1. 闯祸现场", "", story["opening"][0], "", story["opening"][1], ""]
    lines += ["## 2. 群聊", ""] + dialogue(story["dialogue"]) + ["", f"*{story['closing']}*", ""]
    lines += ["## 3. 小白一句话", "", strip_cue(chapter["mnemonic"]), ""]
    lines += ["## 4. 像什么", "", CHAPTER_ANALOGIES[index], ""]
    source_parts = chapter["principles"] + chapter["pitfalls"] + [chapter["goal"], chapter["task"], chapter["accept"]]
    glossary = chapter_glossary(index, source_parts)
    lines += ["## 5. 先拆黑话", ""]
    if glossary:
        lines += [f"- **{term}**：{gloss}" for term, gloss in glossary]
    else:
        lines.append("- 本章没有必须先背的新黑话，先沿着事故和代码往下走。")
    lines += ["", "## 6. 技术真相", "", "下面这些话不卖萌，是本章必须守住的工程边界：", ""]
    lines += [f"- {item}" for item in chapter["principles"]]
    lines += ["", "## 7. 看代码别慌", ""]
    lines += [f"- {item}" for item in code_reading_guide(chapter["code"])]
    lines += ["", "```go", chapter["code"], "```", ""]
    lines += ["## 8. 最容易怎么翻车", ""] + [f"- {item}" for item in chapter["pitfalls"]] + [""]
    lines += ["## 9. 动手与验收", "", f"**动手：** {chapter['task']}", "", f"**过关：** {chapter['accept']}", ""]
    if chapter.get("diagrams"):
        lines += ["## 10. 后续图解位置", ""] + [f"- `{slug}`（文字通过审核后再排图）" for slug in chapter["diagrams"]] + [""]
    lines += ["## 11. 自己问自己", ""]
    for question, answer in zip(chapter["self_check"], chapter["self_check_answers"]):
        lines += [f"**问：{question}**", "", f"答：{answer}", ""]
    lines += ["## 12. 下一站", "", chapter["transition_out"], ""]
    for number, item in enumerate(supplements, 1):
        lines += render_supplement(index, number, item, stories)
    lines += ["---", ""]
    return lines


def render_supplement(chapter_index: int, number: int, item: dict, stories: dict) -> list[str]:
    story = stories["supplements"][item["id"]]
    lines = [f"## 补充 {chapter_index}.{number}　{item['title']}", ""]
    lines += [story["opening"][0], "", story["opening"][1], ""]
    lines += ["### 群聊", ""] + dialogue(story["dialogue"]) + ["", f"*{story['closing']}*", ""]
    lines += ["### 小白一句话", "", strip_cue(item["kicker"]), ""]
    lines += ["### 像什么", "", supplement_analogy(item), ""]
    parts = item["bullets"] + [item["exercise"], item["acceptance"]]
    glossary = glossary_for(parts)
    lines += ["### 黑话翻译", ""]
    if glossary:
        lines += [f"- **{term}**：{gloss}" for term, gloss in glossary]
    else:
        lines.append("- 这一节先不加新词，重点看它如何把上一处事故收住。")
    lines += ["", "### 技术真相", ""] + [f"- {bullet}" for bullet in item["bullets"]] + [""]
    if item.get("code"):
        lines += ["### 看代码", ""] + [f"- {guide}" for guide in code_reading_guide(item["code"])]
        lines += ["", "```go", item["code"], "```", ""]
    else:
        lines += [
            "### 这一节为什么不硬塞代码",
            "",
            "这里教的是诊断、容量或发布契约。真正的答案在命令输出、状态变化和验收证据里；随手放一段漂亮代码，反而会把小白带去错误的考点。",
            "",
        ]
    lines += [f"**动手：** {item['exercise']}", "", f"**过关：** {item['acceptance']}", "", f"**接着去哪：** {item['next_hook']}", ""]
    return lines


def main() -> None:
    source = load_source()
    stories, story_manifest = load_story_layers(source)
    supplements_by_chapter = {index: [] for index in range(1, 25)}
    for item in source.SUPPLEMENTS:
        supplements_by_chapter[item["chapter"]].append(item)

    lines = [
        "# 人间铸剑录：Go 后端与 Harness AI 工程",
        "",
        "## v15 幼稚化 + ELI5 完整文字审稿版",
        "",
        "> 这不是 PDF，也不是最终排版。它是一份完整的文字底稿：先让小白看懂，再让工程师核对。",
        "",
        "## 阅读约定",
        "",
        "- 群聊负责把事故讲活。",
        "- 小白一句话和类比负责建立画面。",
        "- 技术真相、代码与验收负责防止类比讲歪。",
        "- 图解暂不生成，只保留位置；文字通过审核后再进入 PDF。",
        "",
        "## 目录",
        "",
    ]
    for index, chapter in enumerate(source.CHAPTERS, 1):
        lines.append(f"- 第 {index:02d} 章：{chapter['title'].split('  ')[-1]}（补充 {len(supplements_by_chapter[index])} 节）")
    lines += ["", "---", ""]
    for index, chapter in enumerate(source.CHAPTERS, 1):
        lines += render_chapter(index, chapter, supplements_by_chapter[index], stories)

    text = "\n".join(lines).rstrip() + "\n"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")

    payload = {
        "status": "pass",
        "source": str(SOURCE_MODEL.relative_to(ROOT)),
        "source_sha256": hashlib.sha256(SOURCE_MODEL.read_bytes()).hexdigest(),
        "content_overrides_sha256": hashlib.sha256(CONTENT_OVERRIDES.read_bytes()).hexdigest(),
        "output": str(OUT.relative_to(ROOT)),
        "output_sha256": hashlib.sha256(OUT.read_bytes()).hexdigest(),
        "chapters": len(source.CHAPTERS),
        "supplements": len(source.SUPPLEMENTS),
        "source_dialogue_turns": sum(len(item["dialogue"]) for item in source.CHAPTERS + source.SUPPLEMENTS),
        "dialogue_turns": story_manifest["story_dialogue_turns"],
        "code_blocks": text.count("```go"),
        "beginner_sections": len(re.findall(r"^#{2,3} (?:3\. )?小白一句话$", text, re.MULTILINE)),
        "analogy_sections": len(re.findall(r"^#{2,3} (?:4\. )?像什么$", text, re.MULTILINE)),
        "technical_sections": len(re.findall(r"^#{2,3} (?:6\. )?技术真相$", text, re.MULTILINE)),
        "pdf_changed": False,
        "ppt_changed": False,
        **story_manifest,
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUT)
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
