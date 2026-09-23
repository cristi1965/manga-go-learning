# 中文术语帮助
正文术语提供可聚焦按钮，hover短释义，点击/Enter/手机触摸打开详细对话框。说明包含中文名、用途机制、具体例子、误区和来源。
词库为显式审核定义+现有课程glossary条目（后者标明简释）；不自动猜测任意英文的含义。长别名优先、英文边界匹配，避免把Repository误匹配进SQLRepository。
排除代码编辑器、代码块、链接和表单，保证编辑与复制代码不受干扰。弹窗支持Escape、关闭、焦点归还、明暗主题和小屏滚动。
验证：截图术语能打开准确说明、hover/点击、键盘、小屏无溢出、导航无重复包装、编辑器功能保持。

已实现：66项显式详细词条+本章既有简释；参考源区分教材自定义名称与语言API。适用正文/讲解/对白，代码编辑区不自动插入术语按钮。术语按钮含aria-label，桌面hover短解释，click/Enter详细dialog，Escape回焦；手机点击。
验证：verify_terms.mjs覆盖截图7词×2尺寸×2主题、hover/click/键盘/关闭/无嵌套重复/编辑器不被包装，报告evidence/terms.json与截图。verify_codemirror.mjs验证草稿、还原、撤销、Go FAIL/PASS、起步练习。
维护：编辑interactive/term-definitions.js扩充词条。不要用自动机翻猜测程序任意标识符。当前不是全书每个英文都覆盖，也不声称替代Go语言服务器的符号悬停。
