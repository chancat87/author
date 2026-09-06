## v1.2.56 — 改进写作保存、快照恢复与更新稳定性

### 中文

#### 桌面端与网页版

- 改进章节切换、中文输入及异步保存时的正文保护，避免迟到的保存结果覆盖正在编辑的内容；遇到同时修改时保留外部版本备份。
- 修复快照恢复可能影响其他作品的问题。现在只恢复目标作品，先保留恢复前备份，并为中断恢复提供重试入口；较新的对话继续保留。
- 加强账号与服务器切换时的同步隔离，避免旧请求写入新会话；改善本地保存失败、同步冲突和重试时的状态反馈。
- 改进 AI 流式回复、停止生成及网络中断处理，保留已经收到的内容，并明确显示未完成或失败状态。
- 修复作品导入时的界面异常，完善 PDF / DOC 文件校验、超时及资源限制处理。
- 修复新手引导与欢迎、登录界面重叠的问题，“跳过”可以正常结束引导。
- 改进桌面退出和安装更新前的保存确认，取消退出后可继续使用应用。
- 修复 Windows 源码部署“一键更新”启动 npm 时可能出现的错误。
- 更新桌面运行时与相关依赖，完善构建检查及自部署入口配置。
- 更新多语言保存、快照恢复和升级说明。

#### Android 端

- 调整 AI 聊天提示的显示时长与排队处理，减少重复提示和旧提示持续堆积。
- 改进键盘开合时输入框与发送按钮的布局，并统一复制等操作的提示反馈。

#### 使用提示

- 来源不明的旧登录记录可能需要重新登录一次，本地作品不会因此被删除。
- 自部署使用 Caddy 时，请按 [部署说明](https://github.com/YuanShiJiLoong/author/blob/main/DOCKER.md) 配置可信入口；未配置时请求会共用限流配额。
- 建议升级前导出一份作品备份，并保持原有访问域名和数据目录。

---

### English

#### Desktop and Web

- Improved draft protection during chapter switches, IME composition, and asynchronous saves. Late save responses no longer replace newer edits, and conflicting external versions are retained as backups.
- Fixed snapshot restoration affecting other works. Restoration now targets only the selected work, keeps a backup first, and provides recovery after interruption while preserving newer conversations.
- Strengthened sync isolation when switching accounts or servers, and improved feedback for local save failures, sync conflicts, and retries.
- Improved streamed AI responses, cancellation, and connection failures. Received content is retained, with explicit incomplete or failed states.
- Fixed the work import dialog and improved PDF / DOC validation, timeouts, and resource limits.
- Fixed onboarding overlapping the welcome and sign-in dialogs, and made Skip end the tour correctly.
- Improved save confirmation before desktop exit and update installation. Canceling exit keeps the application usable.
- Fixed npm startup errors in the Windows source-deployment update flow.
- Updated the desktop runtime and dependencies, with improved build checks and self-hosted ingress configuration.
- Updated multilingual guidance for saving, snapshot recovery, and upgrades.

#### Android

- Adjusted AI chat notification timing and queue handling to reduce repeated and lingering messages.
- Improved input and send-button layout when the keyboard opens or closes, with consistent feedback for actions such as copying messages.

#### Usage Notes

- Older sign-in records without a known server origin may require signing in again. This does not delete local works.
- When self-hosting behind Caddy, configure the trusted ingress as described in the [deployment guide](https://github.com/YuanShiJiLoong/author/blob/main/DOCKER_EN.md). Requests share a rate-limit quota when it is not configured.
- Export a backup before upgrading and keep your existing access domain and data directory.
