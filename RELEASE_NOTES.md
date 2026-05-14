## v1.2.29 — 优化批注、诊断日志与 AI 配置体验

### 中文

#### 正文批注与 AI 插入

- 备注现在保留正文标记，点击标记时才在附近弹出悬浮批注，避免持续遮挡正文阅读
- AI 助手写正文时会优先把可插入内容放入代码块，编辑器插入时可直接取代码块内容
- 插入到正文编辑区的 AI 文本会按纯文本转义，避免 Markdown 或 HTML 片段污染正文格式

#### 桌面端诊断与稳定性

- 诊断日志新增顶层元素、可疑遮罩、点击拦截、主线程长任务等线索，便于定位“界面突然不能点”的问题
- 桌面端主进程会记录 renderer 控制台警告/错误、preload 错误、GPU 子进程异常和恢复响应事件
- 帮助页补充诊断日志说明：可从“帮助 → 关于”导出诊断日志或打开桌面端日志目录
- 移除 AI 悬浮入口的持续动画，降低桌面端空闲 GPU 占用

#### API 与向量重建

- Embedding 重建失败时会展示更明确的中文失败原因
- OpenAI 兼容 Embedding 支持自动尝试 `/embeddings` 与 `/v1/embeddings`，减少自定义接口 404
- DeepSeek / OpenAI 兼容接口的错误提示更精准，便于区分 Key、地址、模型和限流问题

#### 同步与存档

- 退出同步弹窗更清楚地区分本地已保存与云同步失败，降低误解和误操作风险
- 项目存档导出继续保持隐私优先，不包含 API 配置、AI 会话、token 统计或 AI 摘要

#### Android 端

- 移动端 AI 对话补充重发、重新生成、删除消息和分支入口
- 移动端导入解析增强，提升电脑端导出内容在手机端按章节匹配的稳定性
- 移动端 DeepSeek / OpenAI 兼容配置和错误提示同步优化

本次发布包含 Windows 安装包；Android APK 由移动端私有仓库构建后上传到同一 GitHub Release。

---

### English

#### Inline Remarks And AI Insertion

- Remarks now keep an inline marker and only show the floating note after clicking the marker, avoiding persistent reading obstruction
- AI writing responses now prefer putting insertable body text inside a code block, so the editor can insert only that content
- AI text inserted into the editor is escaped as plain text to prevent Markdown or HTML fragments from affecting body formatting

#### Desktop Diagnostics And Stability

- Diagnostic logs now capture top elements, possible blocking overlays, intercepted clicks, and main-thread long tasks to help debug “nothing can be clicked” reports
- The desktop main process now records renderer warnings/errors, preload errors, GPU child-process failures, and responsive recovery events
- The Help page now explains where to export diagnostic logs and where to find the desktop log directory
- Removed the continuous animation from the floating AI entry to reduce idle GPU usage in the desktop client

#### API And Embedding Rebuilds

- Embedding rebuild failures now show clearer Chinese error messages
- OpenAI-compatible embedding endpoints can automatically try both `/embeddings` and `/v1/embeddings`, reducing custom-endpoint 404s
- DeepSeek / OpenAI-compatible API errors are clearer for key, endpoint, model, and rate-limit problems

#### Sync And Archives

- The exit sync dialog now more clearly distinguishes locally saved data from cloud sync failures
- Project archives remain privacy-first and do not include API config, AI conversations, token stats, or AI summaries

#### Android

- Mobile AI chat now supports resending, regenerating, deleting messages, and creating branches
- Mobile import parsing is improved so desktop-exported content maps to chapters more reliably
- Mobile DeepSeek / OpenAI-compatible configuration and error reporting are also improved

This release includes the Windows installer. The Android APK is built from the private mobile repository and uploaded to the same GitHub Release.
