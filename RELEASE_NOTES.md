## v1.2.40 — 修复 AI 兼容性、启动存储与移动端思考流

### 中文

#### 桌面端 / Web

- 修复自定义 OpenAI 兼容 Embedding 中转调用 Qwen 等模型时，`encoding_format` 被中转转为空字符串导致 400 的问题；现在会显式请求 `float` 格式，并更清楚地展示中转返回的 `errors.message`。
- 修复 Windows 下本地存储探活写入 `__ping.json` 时偶发 `EPERM`，导致页面初始化一直转圈的问题；存储写入现在会在目标文件短暂占用时安全重试。
- 修复切换章节时编辑器工具栏高度观察反复重建造成的抖动；工具栏高度现在保持稳定。

#### Android 端

- Android 版本更新为 `1.2.40+1240`。
- 修复 Claude / OpenAI 兼容流式输出中 `<think>...</think>` 片段被显示到正文的问题；即使标签被拆在多个 SSE 分片里，也会被归入 thinking。
- 修复 AI 对话顶部模型切换入口首次点击无反应的问题；模型列表为空或仍在加载时也会打开选择面板并刷新模型。

---

### English

#### Desktop / Web

- Fixed custom OpenAI-compatible embedding relays returning 400 for Qwen and similar embedding models when `encoding_format` was forwarded as an empty string. The app now explicitly requests `float` format and surfaces relay `errors.message` details more clearly.
- Fixed an intermittent Windows local-storage `EPERM` while writing `__ping.json`, which could leave the app spinning during startup. Storage writes now retry safely when the destination file is briefly locked.
- Fixed editor toolbar jitter when switching chapters by keeping toolbar height observation stable.

#### Android

- Android is now version `1.2.40+1240`.
- Fixed Claude / OpenAI-compatible streamed `<think>...</think>` fragments leaking into the visible answer; split tags across SSE chunks are now routed into thinking output.
- Fixed the first tap on the AI chat model switcher doing nothing when the model list is empty or still loading; the selector now opens and refreshes models.
