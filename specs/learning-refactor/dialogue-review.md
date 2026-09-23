# 对白重构审查

2026-09-22：重写79单元（24主章+47参考补页+8项目），共474条对白。

## 写作与复审
三名分卷作者先读取相应实际示例、原则、固定练习，再重写opening/dialogue/closing。每节保留一个情境，以两位主讲连续追问解释，术语在句中解释，不按人物配额轮换。完成后互相只读复审全卷。

修复：Go mod verify准确语义、defer假设措辞、Context取消不等于已退出；Go章2–7及后端章9–16对接实际固定练习；Harness三处合并句残留；P1明确Decide练习API。

## 验证
sync_dialogue.py从源稿同步79单元；verify_dialogue_quality.py验证结构、完整覆盖和逐字一致，不以角色比例或40字上限打分。
对比本轮前book.json：除opening/dialogue/closing和dialogueTurns外，所有技术/练习/凭证数据不变。
verify_dialogue_browser.mjs：79单元×桌面1440/手机390展开，对比全部对白文字、横向溢出、JS异常。结果及hash保存evidence/dialogue-rewrite-browser.json。三组代表页保留截图。

## 仍存在的课程问题
本轮是全量对白重写，不是全量练习重构。章12缓存正文与租约练习归属不一致；部分固定练习只能验证正文的一小部分，现已明确解释，不能因此称整套契约已通过。旧测验干扰选项质量仍需下一轮改题。没有真人学习耗时数据，不宣称100分或学习效率已量化提高。

## 维护
story-go/backend/harness.json和story-ai-projects.json是维护源；新项目故事层同时接入build_html.py，避免全量构建回退旧对白。sync_dialogue.py只同步叙事，不重跑Go或生成图片。
