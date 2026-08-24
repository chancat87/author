## v1.2.53 — 安全、同步与编辑体验更新

### 中文

#### 桌面端 / Web

- 停用旧版 Firebase / Google 登录与同步入口；官方 Author Cloud 账号服务仅在官方网页端提供，桌面端继续支持本地写作、WebDAV、局域网与用户自有服务器。
- 桌面端的 AI 密钥与同步会话改用操作系统安全存储，并加强本地应用与浏览器之间的访问隔离。
- 加强 API、WebDAV、局域网、文件导入和在线更新的地址校验、权限校验与内容过滤，降低异常请求或恶意内容的影响。
- 改进章节保存状态与退出流程，避免未完成的本地保存被旧数据覆盖。
- 提升 AI 章节概要的结构兼容性与指令边界，并完善导入导出、设置恢复和帮助内容的安全处理。

#### Android 端

- 修复章节标题自动排版后撤销、换行、光标与加粗状态异常的问题。
- 保留 AI 对话未发送的输入草稿，切换页面后返回不再丢失。
- 改进 OCR、作品导入导出、ZIP 备份与数据恢复的错误处理。
- 移除旧版 Firebase / Google 登录与 Firestore 同步依赖；移动端继续支持本地写作、WebDAV 和局域网传输。
- 同步版本号为 `1.2.53+1253`。

---

### English

#### Desktop / Web

- Retired the legacy Firebase / Google sign-in and sync entry points. Official Author Cloud accounts are now available only on the official web app; desktop continues to support local writing, WebDAV, LAN transfer, and user-owned servers.
- Moved desktop AI credentials and sync sessions to operating-system secure storage, with stronger isolation between the local app and browser contexts.
- Hardened address validation, authorization, and content filtering for APIs, WebDAV, LAN transfer, file import, and source updates to reduce the impact of abnormal requests or malicious content.
- Improved chapter save status and exit handling so pending local saves are not overwritten by stale data.
- Improved structured compatibility and instruction boundaries for AI chapter synopses, along with safer import/export, settings restore, and help-content handling.

#### Android

- Fixed undo, newline, cursor, and bold-state issues after automatic chapter-title formatting.
- Preserved unsent AI chat drafts when switching away from and returning to a page.
- Improved error handling for OCR, work import/export, ZIP backups, and data restore.
- Removed the legacy Firebase / Google sign-in and Firestore sync dependencies. Mobile continues to support local writing, WebDAV, and LAN transfer.
- Synchronized the version to `1.2.53+1253`.
