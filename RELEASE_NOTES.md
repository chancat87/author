## v1.2.41 — 修复编辑器、AI 助手与 WebDAV 双端同步

### 中文

#### 桌面端 / Web

- 修复连续空行导致编辑器光标落入 0 高度段落、看起来消失的问题；保留用户用多空行分隔内容的写作习惯。
- 修复 AI 内联润色偶发 `Selection passed to setSelection must point at the current document` 的选择区异常。
- 修复 AI 生成设定卡时 `content` 被拆成逐字字段的问题，并收紧提示词要求结构化输出。
- 修复 AI 对话气泡和代码块的「复制」按钮在网页端无反应的问题，增加剪贴板权限失败时的兼容兜底与提示。
- 修复网页端中文引号/中文文本优先字体显示不一致的问题，并将编辑器列表、任务、引用、代码按钮换成更统一的图标。
- 修复 Windows 桌面端标题栏偶发持续闪烁的问题，固定窗口标题并关闭菜单栏标题更新干扰。
- 修复章节概要单章生成按钮把点击事件当作章节数据导致的崩溃。
- 新增正文之外的界面文字大小设置，覆盖 AI 助手、历史、参考面板等非正文区域。
- 修复 WebDAV 地址或远端目录包含中文、已编码中文、`%` 或反斜杠路径时，桌面/Web 同步失败或路径不一致的问题。

#### Android 端

- Android 版本更新为 `1.2.41+1241`。
- 修复移动端把长文章引用到 AI 对话时，后半段被省略成三个点的问题。
- 修复移动端 WebDAV 中文路径、混合编码路径与桌面/Web 端路径规则不一致的问题；双端现在使用同一套远端路径和 key 文件名规范。
- 补充 AI 流式输出兼容性测试，覆盖 `<think>` 标签跨分片和工具调用标签过滤。

---

### English

#### Desktop / Web

- Fixed the editor caret disappearing when users insert consecutive blank lines; intentional multi-blank spacing is preserved.
- Fixed an intermittent inline AI polish selection error: `Selection passed to setSelection must point at the current document`.
- Fixed AI-generated settings cards being split into one-character fields, and tightened the prompt contract for structured settings output.
- Fixed the AI chat bubble and code-block Copy buttons doing nothing on web by adding a clipboard fallback and user feedback.
- Fixed web Chinese quote/font rendering priority, and replaced the list/task/quote/code toolbar text buttons with consistent icons.
- Fixed intermittent Windows desktop title-bar flicker by keeping the window title stable and suppressing menu/title update interference.
- Fixed a chapter synopsis single-generation crash caused by treating the click event as the target chapter entry.
- Added a non-editor UI text size setting for AI assistant chats, history, reference panels, and related chrome.
- Fixed WebDAV sync failures or path mismatches when the endpoint or remote directory contains Chinese text, already encoded Chinese, `%`, or backslash path separators.

#### Android

- Android is now version `1.2.41+1241`.
- Fixed long article references inserted into AI chat being truncated with an ellipsis on mobile.
- Fixed mobile WebDAV Chinese and mixed-encoded path handling so it matches the desktop/Web remote path and key filename rules.
- Added AI streaming compatibility coverage for split `<think>` tags and tool-call tag filtering.
