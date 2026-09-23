# 开源编辑器接入
选 CodeMirror 6 + 官方 Go language，MIT。安装锁定依赖并打包为本地ES模块，不依赖浏览器CDN。
步骤：本地依赖→统一适配器→替换练习/起步编辑器→验证编辑、撤销、还原、草稿、运行、明暗主题、手机。
保留textarea作为既有业务接口但隐藏；CodeMirror为唯一显示输入层，双向同步value/input与只读状态。移除旧高亮叠层。卸载页面需销毁实例，主题切换重配置。
不声称接入gopls/完整IDE语义诊断；编译错误仍来自现有Go运行服务。

接入结果：CodeMirror6官方Go插件，本地bundle约443KB（未gzip），锁文件与MIT许可证随项目保留。真实浏览器1440/390验证草稿刷新、还原、撤销、主题切换、未完成代码FAIL→完成代码PASS、起步运行及切步无重复实例。结果 evidence/codemirror.json。build:editor用于重打包。
