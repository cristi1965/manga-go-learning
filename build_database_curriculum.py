from __future__ import annotations

import json
from pathlib import Path
from typing import Any


PROJECT = Path(__file__).resolve().parent
VERSION = "22.0.0"
INTERACTIVE_OUT = PROJECT / "interactive" / "data" / "database_curriculum.json"
RUNNER_OUT = PROJECT / "runner" / "database_curriculum.json"


def unit(
    *,
    unit_id: str,
    track: str,
    number: int,
    title: str,
    goal: str,
    analogy: str,
    example_code: str,
    example_caption: str,
    example_output: str,
    prediction_question: str,
    prediction_options: list[str],
    prediction_correct: int,
    prediction_explanation: str,
    prompt: str,
    starter_code: str,
    language: str,
    success_message: str,
    hints: list[str],
    rule: str,
    steps: list[str],
    pitfall: str,
    quiz_question: str,
    quiz_options: list[str],
    quiz_correct: int,
    quiz_explanation: str,
    next_label: str,
    next_target: str,
    validator: str,
) -> dict[str, Any]:
    track_offset = {"database": 0, "mysql": 1, "redis": 2}[track]

    def rotated(options: list[str], correct_index: int, shift: int) -> tuple[list[str], int]:
        shift %= len(options)
        return options[shift:] + options[:shift], (correct_index - shift) % len(options)

    prediction_options, prediction_correct = rotated(
        prediction_options, prediction_correct, number + track_offset
    )
    quiz_options, quiz_correct = rotated(
        quiz_options, quiz_correct, number + track_offset + 1
    )
    return {
        "id": unit_id,
        "track": track,
        "title": title,
        "number": number,
        "goal": goal,
        "frontendAnalogy": analogy,
        "example": {
            "code": example_code,
            "caption": example_caption,
            "output": example_output,
        },
        "prediction": {
            "question": prediction_question,
            "options": prediction_options,
            "correctIndex": prediction_correct,
            "explanation": prediction_explanation,
        },
        "challenge": {
            "prompt": prompt,
            "starterCode": starter_code,
            "language": language,
            "successMessage": success_message,
            "hints": hints,
            "validator": validator,
        },
        "explanation": {
            "rule": rule,
            "steps": steps,
            "pitfall": pitfall,
        },
        "quiz": {
            "question": quiz_question,
            "options": quiz_options,
            "correctIndex": quiz_correct,
            "explanation": quiz_explanation,
        },
        "next": {"label": next_label, "target": next_target},
    }


DATABASE_UNITS = [
    unit(
        unit_id="db-01", track="database", number=1,
        title="一张表，就是一组形状固定的对象",
        goal="把 React 列表映射成表、行和列，先建立数据库的画面感。",
        analogy="React 里的 orders 数组像一张表：每个对象是一行，同名属性是列。区别是数据库会约束每一行的列和类型。",
        example_code="""const orders = [
  { id: "o101", drink: "茉莉奶绿", amount_cents: 1600 },
  { id: "o102", drink: "黑糖珍珠", amount_cents: 1800 }
];

-- 同一份数据在数据库里
SELECT id, drink, amount_cents FROM orders;""",
        example_caption="先认形状：orders 是表，一条订单是一行，id 是一列。",
        example_output="| id | drink | amount_cents |\n| --- | --- | ---: |\n| o101 | 茉莉奶绿 | 1600 |\n| o102 | 黑糖珍珠 | 1800 |",
        prediction_question="再插入一条同样有 id、drink、amount_cents 的订单，表会多出什么？",
        prediction_options=["一行", "一列", "一张新表"], prediction_correct=0,
        prediction_explanation="新增一个对象对应新增一行；列仍是三列。",
        prompt="把星号改成三个明确列名，让查询只返回 id、drink、amount_cents。",
        starter_code="SELECT * FROM orders;", language="sql",
        success_message="你已经把前端对象的字段选择，翻译成了 SQL 列选择。",
        hints=["SELECT 后写要读取的列。", "列名之间用逗号分隔。", "FROM 后仍然是 orders。"],
        rule="表规定数据的共同形状；行保存一条记录；列描述一个属性。",
        steps=["先找 React 数组中的一个对象。", "把对象属性横向排成列。", "把每个对象纵向放成一行。"],
        pitfall="把表想成一个超大 JSON 文档，会忽略数据库对列类型和约束的检查。",
        quiz_question="orders 表中 `{ id: 'o101', drink: '茉莉奶绿' }` 对应什么？",
        quiz_options=["一行", "一列", "一个数据库"], quiz_correct=0,
        quiz_explanation="一条完整订单是行；id 和 drink 才是列。",
        next_label="下一课：用主键找到它", next_target="db-02", validator="select-explicit-columns",
    ),
    unit(
        unit_id="db-02", track="database", number=2,
        title="主键不是数组下标",
        goal="理解主键为什么能在排序、翻页和删除后仍然稳定定位一行。",
        analogy="React 列表的 key 应来自稳定 id，而不是 index；数据库主键也用稳定身份区分每一行。",
        example_code="SELECT id, drink FROM orders WHERE id = 'o102';",
        example_caption="WHERE 像数组的 find，但数据库会利用主键快速定位。",
        example_output="| id | drink |\n| --- | --- |\n| o102 | 黑糖珍珠 |",
        prediction_question="删除第一行后，第二行的数组下标会变；它的主键 o102 会怎样？",
        prediction_options=["仍是 o102", "自动变成 o101", "变成 0"], prediction_correct=0,
        prediction_explanation="主键代表记录身份，不随显示位置变化。",
        prompt="把占位值改为 o101，只查询这笔订单。",
        starter_code="SELECT id, drink FROM orders WHERE id = 'o999';", language="sql",
        success_message="你用稳定身份找到了订单，不再依赖会变化的位置。",
        hints=["保留单引号。", "目标主键是 o101。", "只修改问号部分。"],
        rule="主键必须唯一且不能为空；同一张表里不能有两行共用一个主键。",
        steps=["先给每行分配稳定 id。", "再用 WHERE id = ... 精确查询。", "更新和删除也优先带上主键。"],
        pitfall="用自增数字并不自动等于安全；接口仍要按租户校验这条记录是否属于当前请求。",
        quiz_question="为什么不该把数组 index 当数据库记录的身份？",
        quiz_options=["排序或删除后 index 会变化", "index 不能显示在页面", "数据库不支持数字"], quiz_correct=0,
        quiz_explanation="位置会变，身份不该跟着变。",
        next_label="下一课：类型与空值", next_target="db-03", validator="select-by-primary-key",
    ),
    unit(
        unit_id="db-03", track="database", number=3,
        title="类型与 NULL：没填不是空字符串",
        goal="区分字符串、整数、时间和 NULL，并正确查询缺失值。",
        analogy="TypeScript 会区分 `string`、`number`、`null`；数据库列类型也限制能存什么，NULL 表示未知或未提供。",
        example_code="SELECT id, note FROM orders WHERE note IS NULL;",
        example_caption="查询未填写备注的订单要用 IS NULL。",
        example_output="| id | note |\n| --- | --- |\n| o102 | NULL |",
        prediction_question="`note = NULL` 能找出未填写备注的行吗？",
        prediction_options=["不能，应写 IS NULL", "能，和空字符串相同", "只能查数字列"], prediction_correct=0,
        prediction_explanation="NULL 不是普通值，不能用等号比较。",
        prompt="只找 note 没有填写的订单。",
        starter_code="SELECT id, note FROM orders WHERE note = NULL;", language="sql",
        success_message="你已经区分了未知值、空字符串和数字 0。",
        hints=["NULL 使用 IS 判断。", "不要给 NULL 加引号。", "把等号替换成 IS。"],
        rule="金额用整数分避免浮点误差；时间用时间类型；允许缺失的列才考虑 NULL。",
        steps=["先判断业务上是否允许缺失。", "再选择能表达数据的类型。", "查询 NULL 时使用 IS NULL 或 IS NOT NULL。"],
        pitfall="把金额存成浮点数，或把未填写、空字符串和 0 混成一个含义，会让计算和校验失真。",
        quiz_question="订单备注未填写，最准确的值是什么？",
        quiz_options=["NULL", "0", "'NULL'"], quiz_correct=0,
        quiz_explanation="NULL 表示没有已知值；字符串 'NULL' 只是四个普通字符。",
        next_label="下一课：表之间的关系", next_target="db-04", validator="select-null",
    ),
    unit(
        unit_id="db-04", track="database", number=4,
        title="关系：顾客一行，订单多行",
        goal="用 customer_id 连接顾客和订单，理解一对多而不重复顾客资料。",
        analogy="前端状态里常把 `customerId` 存在 order，再从 customers 字典取详情；关系数据库也用外键表达引用。",
        example_code="""SELECT orders.id, customers.name
FROM orders
JOIN customers ON customers.id = orders.customer_id;""",
        example_caption="orders.customer_id 指向 customers.id。",
        example_output="| id | name |\n| --- | --- |\n| o101 | 小林 |\n| o102 | 小林 |",
        prediction_question="同一位顾客下两笔订单，customers 表需要保存几行小林？",
        prediction_options=["一行", "两行", "每个商品一行"], prediction_correct=0,
        prediction_explanation="顾客资料保存一次，两笔订单都引用同一个 customer_id。",
        prompt="补上连接条件，让每笔订单找到自己的顾客。",
        starter_code="""SELECT orders.id, customers.name
FROM orders
JOIN customers ON customers.id = orders.id;""", language="sql",
        success_message="你用 id 连接了两张表，没有复制顾客资料。",
        hints=["orders 表保存的是 customer_id。", "连接两侧都应是顾客身份。", "把空白替换为 customer_id。"],
        rule="一对多关系把“一”的主键放到“多”的一侧作为外键。",
        steps=["先找谁是“一”：customers。", "再找谁是“多”：orders。", "在 orders 保存 customer_id 并连接 customers.id。"],
        pitfall="把顾客姓名、电话复制进每笔订单会造成更新不一致；但历史快照字段要按业务需求另行设计。",
        quiz_question="customer_id 应保存在哪一侧？",
        quiz_options=["orders 表", "customers 表每个订单一列", "浏览器 localStorage"], quiz_correct=0,
        quiz_explanation="多的一侧保存外键，因此每笔订单都能指向顾客。",
        next_label="下一课：列表页就是查询", next_target="db-05", validator="join-customer-relation",
    ),
    unit(
        unit_id="db-05", track="database", number=5,
        title="列表页的四个动作，就是一条查询",
        goal="把字段选择、筛选、排序和分页映射为 SELECT、WHERE、ORDER BY、LIMIT。",
        analogy="React 列表页会选择展示字段、应用筛选条件、排序再截取一页；SQL 把这四步交给数据库。",
        example_code="""SELECT id, drink, amount_cents
FROM orders
WHERE status = 'paid'
ORDER BY created_at DESC
LIMIT 2;""",
        example_caption="读取最新两笔已付款订单。",
        example_output="| id | drink | amount_cents |\n| --- | --- | ---: |\n| o103 | 乌龙奶茶 | 1700 |\n| o101 | 茉莉奶绿 | 1600 |",
        prediction_question="把 DESC 改成 ASC，第一行会变成什么？",
        prediction_options=["最早的已付款订单", "金额最高的订单", "任意一笔订单"], prediction_correct=0,
        prediction_explanation="ORDER BY created_at ASC 按时间从早到晚排列。",
        prompt="把列表改成只返回最新 1 笔已付款订单。",
        starter_code="""SELECT id, drink, amount_cents
FROM orders
WHERE status = 'paid'
ORDER BY created_at DESC
LIMIT 2;""", language="sql",
        success_message="你已经把常见列表页需求完整翻译成一条查询。",
        hints=["最新顺序已经由 DESC 保证。", "只需修改 LIMIT 后的数量。", "筛选条件保持 paid。"],
        rule="先决定返回哪些列，再筛选行、排序结果、限制数量。",
        steps=["SELECT 选择页面需要的字段。", "WHERE 缩小数据范围。", "ORDER BY 保证顺序，LIMIT 控制返回数量。"],
        pitfall="没有 ORDER BY 的 LIMIT 不保证每次返回相同顺序；前端看到的“第一页”可能漂移。",
        quiz_question="哪个子句保证“最新订单在前”？",
        quiz_options=["ORDER BY created_at DESC", "WHERE status = 'paid'", "SELECT id"], quiz_correct=0,
        quiz_explanation="WHERE 决定哪些行，ORDER BY 才决定它们的顺序。",
        next_label="下一课：设计第一张表", next_target="db-06", validator="select-filter-sort-limit",
    ),
    unit(
        unit_id="db-06", track="database", number=6,
        title="阶段挑战：设计可查询的订单表",
        goal="把表、主键、类型、空值和关系组合成一张最小订单表。",
        analogy="这像给 TypeScript interface 加上运行时约束：不仅描述形状，还拒绝缺 id、金额非法的数据。",
        example_code="""CREATE TABLE orders (
  id VARCHAR(32) PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  amount_cents BIGINT NOT NULL,
  note VARCHAR(200) NULL
);""",
        example_caption="最小表结构先守住身份、关系和金额。",
        example_output="Table orders created\ncolumns: id, customer_id, amount_cents, note\nprimary key: id",
        prediction_question="第二次插入相同 id 的订单，数据库应怎样处理？",
        prediction_options=["拒绝重复主键", "覆盖旧订单", "自动合并金额"], prediction_correct=0,
        prediction_explanation="PRIMARY KEY 的唯一约束会拒绝重复身份。",
        prompt="补全主键和两个必填约束，让 id 唯一，customer_id 与 amount_cents 不能为空。",
        starter_code="""CREATE TABLE orders (
  id VARCHAR(32),
  customer_id VARCHAR(32),
  amount_cents BIGINT,
  note VARCHAR(200) NULL
);""", language="sql",
        success_message="数据库基础完成：你已经能从页面数据反推一张受约束的表。",
        hints=["id 后需要 PRIMARY KEY。", "两个业务必填列使用 NOT NULL。", "note 可以保留 NULL。"],
        rule="表结构先表达不会轻易改变的业务事实：身份、引用、类型和必填性。",
        steps=["用主键定义订单身份。", "用 customer_id 保存关系。", "用整数金额和 NOT NULL 拒绝模糊数据。"],
        pitfall="一次把所有可能字段都塞进表，会增加空值和语义混乱；先从真实查询与约束出发。",
        quiz_question="哪一项同时保证 id 非空且唯一？",
        quiz_options=["PRIMARY KEY", "VARCHAR(32)", "NULL"], quiz_correct=0,
        quiz_explanation="主键同时具备唯一与非空语义。",
        next_label="进入 MySQL：读取指定列", next_target="mysql-01", validator="create-foundation-orders-table",
    ),
]


MYSQL_UNITS = [
    unit(
        unit_id="mysql-01", track="mysql", number=1,
        title="SELECT：只取页面真正使用的列", goal="写出明确列名的 SELECT，读懂结果集。",
        analogy="像 GraphQL 明确选择字段，SQL 也应优先列出页面需要的列，而不是长期依赖 `*`。",
        example_code="SELECT id, drink, amount_cents FROM orders;",
        example_caption="订单列表只取三个展示字段。",
        example_output="| id | drink | amount_cents |\n| --- | --- | ---: |\n| o101 | 茉莉奶绿 | 1600 |\n| o102 | 黑糖珍珠 | 1800 |",
        prediction_question="查询只写 SELECT drink，会返回几列？",
        prediction_options=["一列", "orders 的全部列", "零列"], prediction_correct=0,
        prediction_explanation="SELECT 后列出的字段决定结果集列数。",
        prompt="让查询只返回订单 id 和 drink。", starter_code="SELECT * FROM orders;", language="sql",
        success_message="查询只返回页面需要的两列。",
        hints=["把星号替换成列名。", "两个列名用逗号分开。", "FROM orders 保持不变。"],
        rule="SELECT 定义结果集的列，FROM 定义数据来源。",
        steps=["从页面组件列出实际使用字段。", "把字段写在 SELECT 后。", "运行并核对表头。"],
        pitfall="SELECT * 会让接口结果随表结构扩张，还可能读取不该暴露的列。",
        quiz_question="想返回 id 和 drink，应写什么？",
        quiz_options=["SELECT id, drink FROM orders", "SELECT orders FROM id, drink", "FROM orders SELECT *"], quiz_correct=0,
        quiz_explanation="SELECT 后是列，FROM 后是表。",
        next_label="下一课：按租户筛选", next_target="mysql-02", validator="mysql-select-columns",
    ),
    unit(
        unit_id="mysql-02", track="mysql", number=2,
        title="WHERE：租户条件不能丢", goal="用多个条件只读取当前租户的已付款订单。",
        analogy="前端路由参数不是权限边界；服务端查询像给数组 filter 加上 tenantId 和 status 两个不可省略的条件。",
        example_code="""SELECT id, drink
FROM orders
WHERE tenant_id = 'shop-a' AND status = 'paid';""",
        example_caption="先限制租户，再限制订单状态。",
        example_output="| id | drink |\n| --- | --- |\n| o101 | 茉莉奶绿 |",
        prediction_question="只写 status = 'paid' 的主要风险是什么？",
        prediction_options=["读到其他店铺的订单", "无法使用字符串", "结果一定为空"], prediction_correct=0,
        prediction_explanation="共享表中的每次业务查询都必须守住租户边界。",
        prompt="补上租户条件，只查 shop-a 的 paid 订单。",
        starter_code="""SELECT id, drink
FROM orders
WHERE status = 'paid';""", language="sql",
        success_message="查询同时守住了数据范围和业务状态。",
        hints=["新增 tenant_id = 'shop-a'。", "两个条件用 AND 连接。", "不要删除 status 条件。"],
        rule="WHERE 决定哪些行进入结果；多租户查询必须把 tenant_id 当成固定边界。",
        steps=["先写 tenant_id 条件。", "再用 AND 追加业务条件。", "用不同租户样本验证不会串数据。"],
        pitfall="相信前端只会提交自己的 tenant_id，无法替代服务端身份校验和带租户查询。",
        quiz_question="多租户订单查询最先不能漏掉哪个条件？",
        quiz_options=["tenant_id", "drink", "created_at"], quiz_correct=0,
        quiz_explanation="tenant_id 是数据隔离边界。",
        next_label="下一课：稳定排序与分页", next_target="mysql-03", validator="mysql-where-tenant-status",
    ),
    unit(
        unit_id="mysql-03", track="mysql", number=3,
        title="ORDER BY + LIMIT：让第一页稳定", goal="使用复合排序和 LIMIT 得到确定的最新列表。",
        analogy="React 渲染需要稳定 key；数据库分页也需要稳定排序。时间相同的记录再按 id 排序，结果才不会抖动。",
        example_code="""SELECT id, created_at
FROM orders
WHERE tenant_id = 'shop-a'
ORDER BY created_at DESC, id DESC
LIMIT 2;""",
        example_caption="created_at 相同时用 id 打破平局。",
        example_output="| id | created_at |\n| --- | --- |\n| o103 | 2026-10-21 10:30 |\n| o102 | 2026-10-21 10:10 |",
        prediction_question="两笔订单 created_at 完全相同，只按时间排序会怎样？",
        prediction_options=["它们之间的顺序不稳定", "MySQL 自动按 id", "两行会合并"], prediction_correct=0,
        prediction_explanation="排序字段相同就没有规定相对顺序，需要第二排序键。",
        prompt="把查询改成最新 3 笔，并在时间相同后按 id 倒序。",
        starter_code="""SELECT id, created_at
FROM orders
WHERE tenant_id = 'shop-a'
ORDER BY created_at DESC
LIMIT 10;""", language="sql",
        success_message="第一页有了明确数量和稳定顺序。",
        hints=["ORDER BY 可以写多个列。", "在 created_at DESC 后添加 id DESC。", "把 LIMIT 改为 3。"],
        rule="LIMIT 必须配合能唯一确定顺序的 ORDER BY。",
        steps=["选主排序字段。", "追加主键作为平局规则。", "最后用 LIMIT 限制数量。"],
        pitfall="只有 LIMIT 没有稳定排序时，同一页在多次请求中可能出现重复或遗漏。",
        quiz_question="为什么排序末尾常追加主键？",
        quiz_options=["打破其他排序列的平局", "让主键自动增长", "绕过 WHERE"], quiz_correct=0,
        quiz_explanation="唯一主键能让每两行都有确定先后。",
        next_label="下一课：聚合统计", next_target="mysql-04", validator="mysql-order-limit",
    ),
    unit(
        unit_id="mysql-04", track="mysql", number=4,
        title="聚合：把订单变成看板数字", goal="使用 COUNT、SUM、AVG 和 GROUP BY 按状态统计。",
        analogy="这像在前端 reduce 订单数组，但数据库能在传输前完成分组与计算，只返回看板需要的结果。",
        example_code="""SELECT status, COUNT(*) AS order_count,
       SUM(amount_cents) AS total_cents
FROM orders
WHERE tenant_id = 'shop-a'
GROUP BY status;""",
        example_caption="每个状态得到一行统计。",
        example_output="| status | order_count | total_cents |\n| --- | ---: | ---: |\n| paid | 2 | 3300 |\n| pending | 1 | 1800 |",
        prediction_question="GROUP BY status 后，COUNT(*) 表示什么？",
        prediction_options=["每个状态的订单数", "所有列数量", "每单商品数"], prediction_correct=0,
        prediction_explanation="分组后聚合函数分别计算每组数据。",
        prompt="按 status 统计订单数和平均金额，并保留租户条件。",
        starter_code="""SELECT status, COUNT(*) AS order_count
FROM orders
WHERE tenant_id = 'shop-a'
GROUP BY status;""", language="sql",
        success_message="你让数据库直接返回了每个状态的数量与平均金额。",
        hints=["平均值使用 AVG。", "金额列是 amount_cents。", "给结果起名 avg_cents。"],
        rule="GROUP BY 决定分组维度，COUNT/SUM/AVG 计算每组指标。",
        steps=["先确定看板按什么维度分组。", "再选择计数、求和或平均。", "最后确认 WHERE 已限制租户和时间范围。"],
        pitfall="忘记过滤租户或日期，会得到看似合理但范围错误的统计。",
        quiz_question="想计算每种状态的平均金额，应组合什么？",
        quiz_options=["GROUP BY status 与 AVG(amount_cents)", "ORDER BY status 与 LIMIT", "JOIN 与 DELETE"], quiz_correct=0,
        quiz_explanation="status 是分组维度，AVG 是组内指标。",
        next_label="下一课：连接顾客", next_target="mysql-05", validator="mysql-group-aggregate",
    ),
    unit(
        unit_id="mysql-05", track="mysql", number=5,
        title="JOIN：在查询时组合两张表", goal="区分 INNER JOIN 与 LEFT JOIN，并写出明确连接条件。",
        analogy="像用 customerId 从 normalized Redux state 中取顾客对象；JOIN 把这次查找交给数据库批量完成。",
        example_code="""SELECT orders.id, customers.name
FROM orders
LEFT JOIN customers ON customers.id = orders.customer_id
WHERE orders.tenant_id = 'shop-a';""",
        example_caption="LEFT JOIN 会保留暂时找不到顾客资料的订单。",
        example_output="| id | name |\n| --- | --- |\n| o101 | 小林 |\n| o104 | NULL |",
        prediction_question="改成 INNER JOIN 后，o104 会怎样？",
        prediction_options=["从结果消失", "name 自动变空字符串", "创建新顾客"], prediction_correct=0,
        prediction_explanation="INNER JOIN 只保留两侧都匹配的行。",
        prompt="保留所有 shop-a 订单，即使顾客资料缺失；补全 JOIN 类型和连接条件。",
        starter_code="""SELECT orders.id, customers.name
FROM orders
INNER JOIN customers ON customers.id = orders.id
WHERE orders.tenant_id = 'shop-a';""", language="sql",
        success_message="你保留了全部订单，并正确组合顾客名称。",
        hints=["保留左侧 orders 使用 LEFT JOIN。", "订单里的外键是 customer_id。", "租户条件使用 orders.tenant_id。"],
        rule="INNER JOIN 只要匹配；LEFT JOIN 保留左表全部行，缺失的右表列返回 NULL。",
        steps=["先选必须保留的主表。", "再选择 INNER 或 LEFT。", "ON 明确主键与外键如何相等。"],
        pitfall="漏写或写错 ON 条件会造成行数成倍膨胀，结果看似丰富却完全错误。",
        quiz_question="订单必须保留、顾客可能缺失，应使用什么？",
        quiz_options=["LEFT JOIN", "INNER JOIN", "DELETE JOIN"], quiz_correct=0,
        quiz_explanation="orders 放左侧，LEFT JOIN 保留它的全部行。",
        next_label="下一课：建表约束", next_target="mysql-06", validator="mysql-left-join",
    ),
    unit(
        unit_id="mysql-06", track="mysql", number=6,
        title="CREATE TABLE：让坏数据进不来", goal="使用复合主键、NOT NULL 和 CHECK 表达订单底线。",
        analogy="Zod 可以在接口入口校验对象；数据库约束是所有写入路径共同经过的最后一道校验。",
        example_code="""CREATE TABLE orders (
  tenant_id VARCHAR(32) NOT NULL,
  id VARCHAR(32) NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status VARCHAR(16) NOT NULL,
  PRIMARY KEY (tenant_id, id)
);""",
        example_caption="同一个订单号可存在于不同租户，但金额必须为正。",
        example_output="Table orders created\nprimary key: tenant_id, id\ncheck: amount_cents > 0",
        prediction_question="shop-a/o101 已存在，再插入相同 tenant_id 和 id 会怎样？",
        prediction_options=["违反主键约束", "覆盖旧行", "金额自动相加"], prediction_correct=0,
        prediction_explanation="复合主键要求这一对值唯一。",
        prompt="补全复合主键，并让 amount_cents 只能为正数。",
        starter_code="""CREATE TABLE orders (
  tenant_id VARCHAR(32) NOT NULL,
  id VARCHAR(32) NOT NULL,
  amount_cents BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,
  PRIMARY KEY (id)
);""", language="sql",
        success_message="表结构同时守住了租户身份、订单身份和金额底线。",
        hints=["金额约束写 CHECK (amount_cents > 0)。", "复合主键包含 tenant_id 与 id。", "两个主键列用逗号分隔。"],
        rule="约束表达数据库永远不该接受的状态，而不是只依赖某一个前端表单。",
        steps=["先确定业务身份的所有组成部分。", "对必填列添加 NOT NULL。", "用 CHECK 拒绝明确非法的范围。"],
        pitfall="MySQL 的 CHECK 行为与版本有关；真实环境必须固定和验证服务版本，教学验证器不冒充 InnoDB。",
        quiz_question="为什么订单主键包含 tenant_id 和 id？",
        quiz_options=["同一订单号可在不同租户独立存在", "让金额自动增长", "让所有查询不用 WHERE"], quiz_correct=0,
        quiz_explanation="订单身份处在租户作用域中，复合主键直接表达这件事。",
        next_label="下一课：插入订单", next_target="mysql-07", validator="mysql-create-table-constraints",
    ),
    unit(
        unit_id="mysql-07", track="mysql", number=7,
        title="INSERT：列和值要一一对应", goal="明确 INSERT 列表，并理解约束失败不会产生半行数据。",
        analogy="像调用一个参数明确的函数：列名是参数名，VALUES 是实参，数量和顺序必须对应。",
        example_code="""INSERT INTO orders
  (tenant_id, id, amount_cents, status)
VALUES
  ('shop-a', 'o105', 1900, 'pending');""",
        example_caption="明确写列名，避免表结构变化时错位。",
        example_output="1 row inserted\nid=o105, status=pending, amount_cents=1900",
        prediction_question="把 amount_cents 改成 -1，会发生什么？",
        prediction_options=["CHECK 拒绝整次 INSERT", "插入后自动改成 1", "只保存其他三列"], prediction_correct=0,
        prediction_explanation="一条 INSERT 要么整行成功，要么失败，不会留下半行。",
        prompt="插入 shop-a 的 o106，金额 2100，状态 paid。",
        starter_code="""INSERT INTO orders
  (tenant_id, id, amount_cents, status)
VALUES
  ('shop-a', 'o000', 100, 'draft');""", language="sql",
        success_message="新订单通过了列对应和表约束检查。",
        hints=["订单号是 o106。", "金额用整数 2100，不加引号。", "状态是字符串 paid。"],
        rule="INSERT 显式写列名；数据库在写入前统一检查主键、非空和 CHECK 约束。",
        steps=["列出本次写入的列。", "按相同顺序提供 VALUES。", "同时测试成功与约束失败。"],
        pitfall="省略列名依赖表的物理列顺序，迁移后容易把值写错位置。",
        quiz_question="INSERT 为什么应显式列出列名？",
        quiz_options=["让值的含义和对应关系清晰", "让主键不再唯一", "让 WHERE 可以省略"], quiz_correct=0,
        quiz_explanation="列名让每个值的目标明确，也降低表结构变化带来的风险。",
        next_label="下一课：安全更新与删除", next_target="mysql-08", validator="mysql-insert-order",
    ),
    unit(
        unit_id="mysql-08", track="mysql", number=8,
        title="UPDATE / DELETE：没有 WHERE 就先停下", goal="使用租户和主键限制写操作，拒绝整表误改。",
        analogy="这像 reducer 必须带目标 item id；没有 id 就直接修改整个数组，是危险操作而不是快捷方式。",
        example_code="""UPDATE orders
SET status = 'paid'
WHERE tenant_id = 'shop-a' AND id = 'o105';""",
        example_caption="更新条件同时包含租户和订单主键。",
        example_output="1 row updated\nshop-a/o105: pending -> paid",
        prediction_question="删除语句没有 WHERE，会影响什么？",
        prediction_options=["整张表的所有行", "只影响最后一行", "不会执行任何行"], prediction_correct=0,
        prediction_explanation="无 WHERE 的 DELETE 会删除表中所有行。",
        prompt="把 o105 标记为 cancelled；必须同时限制 shop-a 和订单 id。",
        starter_code="""UPDATE orders
SET status = 'cancelled'
WHERE tenant_id = 'shop-b' AND id = 'o105';""", language="sql",
        success_message="更新只命中目标租户的一笔订单。",
        hints=["先写 tenant_id = 'shop-a'。", "再用 AND 连接 id = 'o105'。", "不能删除 WHERE。"],
        rule="业务 UPDATE / DELETE 至少带租户边界和稳定身份；运行前先用同条件 SELECT 预览。",
        steps=["用 SELECT 检查将命中的行。", "复用同一个 WHERE 执行写操作。", "核对 affected rows 是否符合预期。"],
        pitfall="只按 id 更新在多租户表中仍可能越界；完全没有 WHERE 则会整表修改或删除。",
        quiz_question="安全更新一笔订单最关键的组合是什么？",
        quiz_options=["tenant_id 和 id 的 WHERE 条件", "ORDER BY 和 LIMIT", "只写 status"], quiz_correct=0,
        quiz_explanation="租户守住边界，主键锁定目标。",
        next_label="下一课：事务与幂等", next_target="mysql-09", validator="mysql-safe-update",
    ),
    unit(
        unit_id="mysql-09", track="mysql", number=9,
        title="事务与幂等：多步写入只算一次", goal="理解 START TRANSACTION、COMMIT、ROLLBACK 与幂等记录如何组合。",
        analogy="像一次 UI 提交要么所有状态一起更新，要么全部恢复；但数据库事务还必须处理重试，不能把双击变成两笔订单。",
        example_code="""START TRANSACTION;
INSERT INTO idempotency_records (tenant_id, request_key)
VALUES ('shop-a', 'checkout-77');
INSERT INTO order_events (tenant_id, order_id, event_type)
VALUES ('shop-a', 'o105', 'paid');
COMMIT;""",
        example_caption="唯一幂等键先占位，事件和占位在同一事务提交。",
        example_output="transaction committed\nidempotency: shop-a/checkout-77\nevent: o105 paid",
        prediction_question="第二条 INSERT 失败且执行 ROLLBACK，第一条幂等记录会怎样？",
        prediction_options=["一起回滚", "永久保留", "自动改成成功"], prediction_correct=0,
        prediction_explanation="同一事务中的未提交修改会一起回滚。",
        prompt="补上事务边界：开始事务，写入两条记录，最后提交。",
        starter_code="""START TRANSACTION;
INSERT INTO idempotency_records (tenant_id, request_key)
VALUES ('shop-a', 'checkout-88');
INSERT INTO order_events (tenant_id, order_id, event_type)
VALUES ('shop-a', 'o106', 'paid');
ROLLBACK;""", language="sql",
        success_message="两步写入现在共享一个提交边界；这一课只验证事务结构，真正的重复请求判定在 Go 第 11 章完成。",
        hints=["第一处是 START TRANSACTION。", "成功末尾使用 COMMIT。", "真实代码还要在错误分支执行 ROLLBACK。"],
        rule="本课先证明事务边界：相关写入一起 COMMIT 或一起 ROLLBACK。幂等还需要唯一键、请求摘要、冲突处理和原结果回放。",
        steps=["把相关写入放进同一事务。", "成功 COMMIT，失败 ROLLBACK。", "到 Go 第 11 章再实现唯一键冲突、请求摘要和原结果回放。"],
        pitfall="事务不等于幂等：同一请求执行两次、两次都成功提交，仍会产生重复副作用。",
        quiz_question="事务和幂等分别解决什么？",
        quiz_options=["多步原子性；重复请求去重", "页面样式；网络加速", "排序；分页"], quiz_correct=0,
        quiz_explanation="事务约束一次执行内部，幂等约束多次执行之间。",
        next_label="回到 Go 第 11 章：事务与幂等", next_target="chapter-11", validator="mysql-transaction-idempotency",
    ),
]


REDIS_UNITS = [
    unit(
        unit_id="redis-01", track="redis", number=1,
        title="Key-Value：先学会命名和读写", goal="在真实 Redis 中运行 SET、GET、EXISTS、DEL，并读懂返回值。",
        analogy="像 localStorage 的 key-value，但 Redis 在独立服务中，多个后端实例能共享，并提供原子命令和过期能力。",
        example_code="SET shop:a:order:o101:status paid\nGET shop:a:order:o101:status",
        example_caption="key 从大范围到小范围命名，避免不同租户互相覆盖。",
        example_output="OK\npaid",
        prediction_question="DEL 后再 GET 同一个 key，会返回什么？",
        prediction_options=["nil", "paid", "0"], prediction_correct=0,
        prediction_explanation="key 被删除后不存在，GET 返回 nil。",
        prompt="保存 o102 的状态 pending，读取它，再检查它是否存在。",
        starter_code="SET shop:a:order:o102:status draft\nGET shop:a:order:o102:status\nGET shop:a:order:o102:status", language="redis",
        success_message="命令已在隔离的真实 Redis 进程中完成读写。",
        hints=["状态值是 pending。", "检查存在使用 EXISTS。", "每行一条命令。"],
        rule="Redis key 应包含业务域、租户和对象身份；SET 写入，GET 读取，EXISTS 检查，DEL 删除。",
        steps=["先设计不会碰撞的 key。", "SET 后立即 GET 核对值。", "用 EXISTS 与 DEL 观察生命周期。"],
        pitfall="把 Redis 当浏览器 localStorage 会忽略共享并发、内存容量和服务故障。",
        quiz_question="哪个 key 更能避免多租户碰撞？",
        quiz_options=["shop:a:order:o102:status", "status", "o102"], quiz_correct=0,
        quiz_explanation="key 包含租户、业务对象和字段语义。",
        next_label="下一课：过期时间", next_target="redis-02", validator="redis-string-basics",
    ),
    unit(
        unit_id="redis-02", track="redis", number=2,
        title="TTL：让临时数据自己过期", goal="使用 EX、TTL、PTTL 与 PERSIST 理解 key 的过期语义。",
        analogy="像前端缓存给数据记录 expiresAt，但 Redis 由服务端时钟主动清理，不需要每个页面自己判断。",
        example_code="SET shop:a:otp:login-7 482913 EX 60\nTTL shop:a:otp:login-7",
        example_caption="验证码写入时一次设置 60 秒过期。",
        example_output="OK\n60",
        prediction_question="对没有过期时间的已存在 key 执行 TTL，常见返回是什么？",
        prediction_options=["-1", "0", "nil"], prediction_correct=0,
        prediction_explanation="-1 表示 key 存在但没有到期时间；-2 表示 key 不存在。",
        prompt="写入占位 key 并设置 30 秒过期，然后查看 TTL。",
        starter_code="SET shop:a:checkout:hold-88 1\nTTL shop:a:checkout:hold-88", language="redis",
        success_message="临时占位已经带上明确生命周期。",
        hints=["秒级过期使用 EX。", "过期秒数是 30。", "查看剩余秒数使用 TTL。"],
        rule="临时 key 在创建时就设置 TTL，避免服务异常后留下永不过期的数据。",
        steps=["判断数据是否天然临时。", "SET 时一起传 EX 或 PX。", "用 TTL/PTTL 验证，再了解 PERSIST 会移除过期。"],
        pitfall="先 SET、稍后再 EXPIRE 中间存在崩溃窗口；能在一条命令里设置就不要拆开。",
        quiz_question="TTL 返回 -2 表示什么？",
        quiz_options=["key 不存在", "key 永不过期", "还剩 2 秒"], quiz_correct=0,
        quiz_explanation="Redis 用 -2 表示 key 不存在，用 -1 表示存在但无过期。",
        next_label="下一课：Hash 保存订单摘要", next_target="redis-03", validator="redis-ttl",
    ),
    unit(
        unit_id="redis-03", track="redis", number=3,
        title="Hash：一个 key 下保存多个字段", goal="使用 HSET、HGET、HMGET、HGETALL 与 HINCRBY 操作订单摘要。",
        analogy="Hash 像一个可局部更新的 JS 对象；key 找到对象，field 找到对象属性。",
        example_code="HSET shop:a:order:o101 status paid amount_cents 1600\nHGETALL shop:a:order:o101",
        example_caption="同一订单的少量摘要字段放在一个 Hash。",
        example_output="status\npaid\namount_cents\n1600",
        prediction_question="HINCRBY ... retry_count 1 会做什么？",
        prediction_options=["原子增加 retry_count", "重命名 key", "删除整个 Hash"], prediction_correct=0,
        prediction_explanation="HINCRBY 对 Hash 中的整数字段执行原子增量。",
        prompt="保存 o102 的 status=pending 与 amount_cents=1800，再一次读取两个字段。",
        starter_code="HSET shop:a:order:o102 state pending amount 1800\nHMGET shop:a:order:o102 status amount_cents", language="redis",
        success_message="订单摘要的两个字段已在同一个 Hash 中写入并读取。",
        hints=["第一个字段名是 status。", "第二个字段名是 amount_cents。", "HMGET 可以一次取多个字段。"],
        rule="Hash 适合字段数量有限、需要局部读写的小对象摘要。",
        steps=["用一个业务 key 标识对象。", "用 field 表达摘要属性。", "只缓存读取需要的字段，并为整个 key 设计过期。"],
        pitfall="把无限增长的明细塞进单个 Hash 会形成大 key，影响延迟和迁移。",
        quiz_question="想一次读取 Hash 的 status 和 amount_cents，用什么？",
        quiz_options=["HMGET", "SMEMBERS", "ZRANGE"], quiz_correct=0,
        quiz_explanation="HMGET 一次读取多个 Hash field。",
        next_label="下一课：Set 去重", next_target="redis-04", validator="redis-hash",
    ),
    unit(
        unit_id="redis-04", track="redis", number=4,
        title="Set：天然不重复的成员集合", goal="使用 SADD、SISMEMBER、SMEMBERS、SCARD 和 SREM 管理订单标签。",
        analogy="像 JavaScript Set：成员没有重复，适合标签、权限和已处理标识，不负责保存顺序。",
        example_code="SADD shop:a:order:o101:tags vip delivery vip\nSCARD shop:a:order:o101:tags",
        example_caption="重复添加 vip 只保留一个成员。",
        example_output="2\n2",
        prediction_question="再次 SADD vip，集合成员数会怎样？",
        prediction_options=["仍是 2", "变成 3", "集合被清空"], prediction_correct=0,
        prediction_explanation="Set 自动去重，已有成员不会重复保存。",
        prompt="给 o102 添加 new 和 pickup 两个标签，再检查 pickup 是否存在。",
        starter_code="SADD shop:a:order:o102:tags new new\nSISMEMBER shop:a:order:o102:tags new", language="redis",
        success_message="两个标签已去重保存，并完成成员检查。",
        hints=["两个成员是 new 和 pickup。", "SISMEMBER 最后也检查 pickup。", "成员不需要逗号。"],
        rule="Set 只表达“是否属于集合”，不保证业务顺序。",
        steps=["确认成员只需唯一、不需字段。", "SADD 添加，SISMEMBER 判断。", "用 SCARD 计数，SREM 删除。"],
        pitfall="依赖 SMEMBERS 的返回顺序会产生不稳定界面；需要排名时改用 Sorted Set。",
        quiz_question="哪个命令检查 pickup 是否属于标签集合？",
        quiz_options=["SISMEMBER", "HGET", "TTL"], quiz_correct=0,
        quiz_explanation="SISMEMBER 返回成员是否存在。",
        next_label="下一课：Sorted Set 排名", next_target="redis-05", validator="redis-set",
    ),
    unit(
        unit_id="redis-05", track="redis", number=5,
        title="Sorted Set：成员唯一，还能按分数排序", goal="使用 ZADD、ZRANGE、ZRANK 和 ZREM 构建销量榜。",
        analogy="像把 `{ id, score }` 列表交给一个始终按 score 排序的容器；member 唯一，score 可更新。",
        example_code="ZADD shop:a:drink:sales 42 jasmine 65 brown_sugar 51 oolong\nZRANGE shop:a:drink:sales 0 -1 WITHSCORES",
        example_caption="按销量分数从低到高读取全部饮品。",
        example_output="jasmine\n42\noolong\n51\nbrown_sugar\n65",
        prediction_question="再次 ZADD brown_sugar 70，会新增重复成员吗？",
        prediction_options=["不会，只更新分数", "会新增第二个成员", "会删除整个榜单"], prediction_correct=0,
        prediction_explanation="Sorted Set member 唯一，再次 ZADD 更新它的 score。",
        prompt="加入 jasmine=42、oolong=51，并按从低到高读取成员和分数。",
        starter_code="ZADD shop:a:drink:sales 1 jasmine 1 oolong\nZRANGE shop:a:drink:sales 0 -1 WITHSCORES", language="redis",
        success_message="两个唯一成员已按销量分数稳定排序。",
        hints=["jasmine 分数是 42。", "oolong 分数是 51。", "范围读取使用 ZRANGE。"],
        rule="Sorted Set 用唯一 member 表示对象，用 score 表示可排序数字。",
        steps=["选稳定 member。", "把排名指标写成 score。", "用 ZRANGE 读取范围，用 ZRANK 查名次。"],
        pitfall="score 是浮点数，不适合直接保存复杂对象；对象详情应在数据库或其他结构中。",
        quiz_question="同一 member 再次 ZADD 会怎样？",
        quiz_options=["更新 score", "保存重复 member", "把 score 变成字符串"], quiz_correct=0,
        quiz_explanation="member 唯一，因此新 score 替换旧 score。",
        next_label="下一课：原子计数", next_target="redis-06", validator="redis-sorted-set",
    ),
    unit(
        unit_id="redis-06", track="redis", number=6,
        title="INCR：并发请求共享一个原子计数器", goal="使用 INCR 递增计数，理解单命令原子性。",
        analogy="前端 `count++` 只在当前页面内；多个后端实例同时计数需要服务端原子操作，不能各自 GET 后再 SET。",
        example_code="SET shop:a:daily:orders:2026-10-21 0\nINCR shop:a:daily:orders:2026-10-21\nINCR shop:a:daily:orders:2026-10-21",
        example_caption="每次 INCR 是一个不可分割的 Redis 命令。",
        example_output="OK\n1\n2",
        prediction_question="两个客户端同时 INCR 一个值为 0 的 key，最终值是什么？",
        prediction_options=["2", "1", "不确定且经常丢失"], prediction_correct=0,
        prediction_explanation="Redis 顺序执行每个原子 INCR，不会把两次递增合并成一次。",
        prompt="把今日订单计数从 0 连续递增三次，最后读取结果。",
        starter_code="SET shop:a:daily:orders:2026-10-21 0\nINCR shop:a:daily:orders:2026-10-21\nINCR shop:a:daily:orders:2026-10-21\nGET shop:a:daily:orders:2026-10-21", language="redis",
        success_message="真实 Redis 完成三次原子递增，最终计数为 3。",
        hints=["三处都使用 INCR。", "不要拆成 GET 后 SET。", "最后一行 GET 只负责观察。"],
        rule="优先使用 Redis 提供的单条原子命令，不要用客户端读改写拼出竞态。",
        steps=["确认操作能否由单命令表达。", "让每个客户端直接 INCR。", "通过并发测试核对没有丢计数。"],
        pitfall="GET 当前值、客户端加一、再 SET 会在并发时覆盖别人的递增。",
        quiz_question="为什么 INCR 比 GET 后 SET 更适合并发计数？",
        quiz_options=["INCR 是 Redis 的原子命令", "INCR 不需要 key", "INCR 永远不占内存"], quiz_correct=0,
        quiz_explanation="单命令原子执行，避免读改写窗口。",
        next_label="下一课：NX 占位", next_target="redis-07", validator="redis-incr",
    ),
    unit(
        unit_id="redis-07", track="redis", number=7,
        title="SET NX EX：只让第一个请求占位", goal="使用 NX 和 EX 建立有时限的首次占位，并理解它不是完整幂等方案。",
        analogy="像按钮第一次点击后加锁，但锁必须有过期时间；更重要的是，后端还要保存可恢复的业务结果。",
        example_code="SET shop:a:checkout:req-77 processing NX EX 30\nSET shop:a:checkout:req-77 processing NX EX 30",
        example_caption="第一个请求成功，第二个因为 key 已存在而失败。",
        example_output="OK\n(nil)",
        prediction_question="占位成功后服务崩溃，只有这个 key 足够恢复订单结果吗？",
        prediction_options=["不够，还需数据库中的幂等记录和结果", "足够，key 就是完整订单", "Redis 会自动提交 MySQL"], prediction_correct=0,
        prediction_explanation="短期占位只协调并发，不能替代持久化业务状态与结果回放。",
        prompt="连续尝试两次占用 req-88，并检查 TTL：第一次成功，第二次必须被拒绝，20 秒后可释放。",
        starter_code="SET shop:a:checkout:req-88 processing\nSET shop:a:checkout:req-88 processing\nTTL shop:a:checkout:req-88", language="redis",
        success_message="真实 Redis 返回了第一次 OK、第二次 nil，并显示了剩余 TTL。",
        hints=["两行 SET 都要加 NX。", "两行 SET 都要加 EX 20。", "最后对同一个 key 执行 TTL。"],
        rule="SET key value NX EX seconds 能原子完成“仅首次设置 + 过期”，适合短期协调。",
        steps=["key 绑定租户和请求身份。", "NX 保证只有首次成功。", "EX 防止异常后永久占位，业务结果仍写入数据库。"],
        pitfall="把 Redis 占位当成最终幂等记录，会在过期、故障或淘汰后失去可恢复结果。",
        quiz_question="SET NX EX 最准确的定位是什么？",
        quiz_options=["短期并发占位", "永久业务真相", "MySQL 事务替代品"], quiz_correct=0,
        quiz_explanation="它协调短期并发，但最终状态和结果应持久化。",
        next_label="下一课：缓存与故障", next_target="redis-08", validator="redis-set-nx-ex",
    ),
    unit(
        unit_id="redis-08", track="redis", number=8,
        title="Cache Aside：数据库才是真相源", goal="验证缓存 miss、限时回填和删除命令顺序，并区分缓存未命中与 Redis 故障。",
        analogy="像 React Query：先看缓存，miss 时请求服务端；但后端还要明确谁是真相源，并防止旧响应覆盖新数据。",
        example_code="""GET shop:a:order:o101
# nil -> 从 MySQL 读取
SET shop:a:order:o101 '{"status":"paid"}' EX 60
# MySQL 事务更新成功后
DEL shop:a:order:o101""",
        example_caption="读时回填，写提交后删除缓存；数据库状态优先。",
        example_output="(nil)\nOK\n1",
        prediction_question="应在 MySQL COMMIT 前还是后删除缓存？",
        prediction_options=["COMMIT 成功后", "COMMIT 前且不管结果", "永远不删除"], prediction_correct=0,
        prediction_explanation="先确认真相源写入成功，再让旧缓存失效。",
        prompt="补全 Cache Aside 顺序：缓存 miss 后回填 60 秒；数据库提交成功后删除旧缓存。",
        starter_code="GET shop:a:order:o102\nSET shop:a:order:o102 '{\"status\":\"pending\"}'\nGET shop:a:order:o102", language="redis",
        success_message="真实 Redis 已验证 GET、限时回填和 DEL 的命令顺序；这里没有执行 MySQL COMMIT。",
        hints=["秒级过期使用 EX。", "时间是 60。", "提交后失效使用 DEL。"],
        rule="Cache Aside 的命令顺序是：明确 miss 后查数据库并限时回填；数据库提交成功后删除缓存。Redis 超时或断连不是 miss。",
        steps=["GET 返回 nil 才是 miss；超时和断连走故障策略。", "回填设置短 TTL，防止旧查询迟到覆盖新值。", "本课只验证 Redis 命令；Go 第 12 章再实现 COMMIT 后 DEL 与限流降级。"],
        pitfall="把 Redis 故障当成 miss 会把全部流量压向数据库；缓存不是事务真相，也不能伪造数据库已经提交。",
        quiz_question="Cache Aside 中订单最终状态以哪里为准？",
        quiz_options=["MySQL", "浏览器缓存", "任意 Redis 副本"], quiz_correct=0,
        quiz_explanation="Redis 用于加速读取，持久数据库才是业务真相源。",
        next_label="回到 Go 第 12 章：缓存与并发", next_target="chapter-12", validator="redis-cache-aside",
    ),
]


TRACKS = [
    {
        "id": "database",
        "title": "数据库基础",
        "description": "从 React 数组和 JSON 出发，先看懂表、行、列、主键、类型与关系。",
        "units": DATABASE_UNITS,
    },
    {
        "id": "mysql",
        "title": "MySQL 与 SQL",
        "description": "从列表查询走到约束、写入、事务与幂等，练习使用 MySQL 语法。",
        "units": MYSQL_UNITS,
    },
    {
        "id": "redis",
        "title": "Redis",
        "description": "在真实 Redis 上学习数据结构、过期、原子操作与 Cache Aside。",
        "units": REDIS_UNITS,
    },
]


def build_database_curriculum() -> dict[str, Any]:
    return {"version": VERSION, "tracks": TRACKS}


def write_database_curriculum() -> dict[str, Any]:
    curriculum = build_database_curriculum()
    encoded = json.dumps(curriculum, ensure_ascii=False, indent=2) + "\n"
    for target in (INTERACTIVE_OUT, RUNNER_OUT):
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(encoded, encoding="utf-8")
    return curriculum


def main() -> None:
    curriculum = write_database_curriculum()
    print(json.dumps({
        "status": "pass",
        "version": curriculum["version"],
        "tracks": len(curriculum["tracks"]),
        "units": sum(len(track["units"]) for track in curriculum["tracks"]),
        "outputs": [str(INTERACTIVE_OUT), str(RUNNER_OUT)],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
