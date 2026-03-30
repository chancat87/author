## 📋 本次焕新简报 / Release Overview

本次常规更新（v1.2.11）带来了底层坚若磐石般的稳定性提升。我们在 Electron 核心模块与 React 渲染层植入了双重“急救系统”，让你面对几百万字史诗级巨著的运算时，不再担心突发的内存溢出或进程卡死。此外，全面启用了更加具有代入感的「沉浸式写作引擎（Ghost Text）」等进阶术语体系。

### 🇨🇳 中文更新概览

- 🛡️ **底层进程失去响应与灾难级抗毁保护**：深入 `electron/main.js` 重构，新增了针对高负荷运算 (`unresponsive` / `crashed`) 的原生级监听器。从现在起，如果你在超大设定集下开启深层 RAG 向量运算导致 CPU 吃紧或界面假死，系统将主动弹出挽救浮窗，允许你继续等待或者安全软重启，再也不必强行结束任务管理器了。
- 🚨 **React 全局错误边界（Error Boundary）**：新增页面防爆错页面（`app/error.js`）。如果因插件冲突或某些罕见的异步时序遇到崩溃，现已能够优雅地显示错误日志与恢复按钮，而非直接白屏。
- ⌨️ **输入法兼容度与回车防抖终极调优**：细节魔鬼！深度修复了 `AiSidebar` 等浮动侧边栏里中英文输入法结束瞬间（\`isComposing\`）与回车发送快捷键的键位冲突（防抖+回车屏蔽换行），彻底告别以前误触发送和意外换行的别扭体验。
- 🌐 **多语言与底层安全链路全面无死角覆盖**：所有的帮助面板与中/英/俄/阿四国语言 README 均统一采用 **「沉浸式写作引擎（Ghost Text）」** 与 **「AI 全局记忆（Context Engine）」** 等专业级系统命名；此外也重构优化了一部分项目存档 IO 的防御能力（`project-io.js` / `storage.js`）。

📦 全自动封装构建流程完毕，点击下方 `.exe` 图标即可立刻感受毫无波澜的顶级稳定。

---

### 🇺🇸 English Release Notes

Version 1.2.11 brings rock-solid stability to the very core of this engine. We've implanted a double-tiered "first aid" rescue system across both the Electron main thread and the React rendering tree to combat intense resource-hogging edge cases, ensuring your creative momentum never crashes.

- 🛡️ **Hardware-Level Unresponsive & Crash Guards:** A deep dive into \`electron/main.js\` introduces highly aggressive native listeners targeting \`unresponsive\` loops and renderer crashes. When dealing with colossal lore-books that bottleneck your CPU during heavy RAG vectorization, instead of a silent white screen freezing, you will now receive an elegant OS-level prompt to safely wait it out or cleanly force-restart the app.
- 🚨 **Global React Error Boundaries:** Deployed a brand-new page-wide fallback module (\`app/error.js\`). Certain harsh async conflicts that previously might've blown up the view as a blank screen will now be elegantly trapped, presenting readable error logs and recovery buttons.
- ⌨️ **IME Composition & Keystroke Finesse:** Ultimate detailing work inside the \`AiSidebar\` textarea handling! We finally eradicated those annoying bugs caused by Asian input method composition (\`isComposing\`) overlapping with Enter-to-Send events. Goodbye to misfires and unintended line breaks while chatting with the AI.
- 🌐 **Terminology Unification & Omni-Lingual Refresh:** Upgraded our core branding to professional standards across internal tooltips and quad-language (EN/RU/AR/ZH) READMEs. Enjoy your interactions with the **"Immersive Writing Engine (Ghost Text)"** and **"Global AI Memory (Context Engine)"**.

📦 Simply grab the \`.exe\` installer right below and bask in top-tier application stability.
