## v1.2.18 — 修复退出同步时最后内容丢失，并补充更清晰的保存提醒 | Fixed last-minute text loss on sync exit and added clearer save guidance

### 🇨🇳 中文

#### 🐛 修复
- **修复“同步后退出”时最后输入内容可能丢失的问题**：如果刚写完一段内容就立刻退出，系统现在会先保存当前文字，再执行云同步，避免最后几百字没有被带上
- **修复手动同步、创建快照时可能漏掉最新内容的问题**：这些关键操作现在都会先保存编辑器里正在写的内容，再继续执行
- **修复同步失败后仍然直接退出的问题**：当云同步失败时，退出弹窗会明确提示原因，并允许你选择重试同步，或仅带着本地已保存内容退出

#### 💾 数据安全改进
- **统一了关键操作前的保存方式**：退出、同步、创建快照等操作，现在都会先保存你眼前正在编辑的内容，减少因为操作太快导致的遗漏
- **从云端覆盖本地内容前自动创建备份**：执行“从云端同步”前，会先生成一份本地快照，方便在误覆盖后恢复
- **同步等待更可靠**：如果后台已经在同步，新的退出同步或手动同步会等当前同步完成，不会误以为已经同步结束

#### 📝 文档与说明
- **帮助页已修正同步范围说明**：AI 对话记录仅保存在本地，快照历史默认保存在本地，云端只保留最近一次快照
- **同步相关界面补充了更清楚的提示**：在退出弹窗、账号面板和同步菜单中补充说明，减少对同步范围的误解
- **优化桌面版打包过滤**：进一步排除与运行无关的文档文件，避免它们被带入安装目录

#### 🔧 同版修复
- **修复桌面客户端模型连接测试可能失败的问题**：安装版现在可以正常处理本地模型连接测试，不会在测试开始前就显示内部错误
- **优化模型连接测试失败提示**：网络、代理或 API 地址异常时，会显示更明确的失败原因
- **补充网页版访问统计支持**：官方网页版可在配置后记录基础页面浏览统计；桌面客户端不参与这类统计

---

### 🇬🇧 English

#### 🐛 Fixes
- **Fixed possible loss of the latest text when choosing “Sync and Exit”**: If you exited right after typing, the app now saves the current text first and only then runs cloud sync, preventing the last few hundred characters from being missed
- **Fixed missing latest content during manual sync and snapshot creation**: These important actions now save the text currently being edited before continuing
- **Fixed direct exit after sync failure**: When cloud sync fails, the exit modal now explains the problem clearly and lets you retry sync or exit with the already-saved local content

#### 💾 Data Safety Improvements
- **Unified saving before critical actions**: Exit, sync, and snapshot actions now save what you are currently editing first, reducing the chance of missing recent changes
- **Create a backup before cloud overwrite**: Before “Sync from Cloud” replaces local content, the app now creates a local snapshot for recovery
- **More reliable sync waiting**: If a sync is already running, exit-sync and manual-sync actions now wait for it to finish instead of incorrectly assuming sync is done

#### 📝 Docs and UX Copy
- **Corrected help-page wording about sync scope**: AI chat history is local-only, while snapshot history stays local by default and only the latest snapshot is kept in cloud sync
- **Added clearer messaging in sync-related UI**: The exit modal, account panel, and sync menu now explain the actual sync scope more clearly
- **Refined desktop packaging filters**: Further excluded non-runtime documentation files so they are not bundled into the installed app directory

#### 🔧 Same-Version Hotfix
- **Fixed possible desktop model connection test failures**: The installed desktop app can now handle local model connection tests normally instead of showing an internal error before the test starts
- **Improved model connection test failure messages**: Network, proxy, or API URL problems now show a clearer failure reason
- **Added web page-view analytics support**: The official web version can record basic page-view statistics when configured; the desktop client is excluded from this analytics flow
