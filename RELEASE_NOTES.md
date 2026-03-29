## 📋 本次焕新简报 / Release Overview

本次常规更新（v1.2.9）为核心模型调度引入了更多自由度量控制机制，大幅优化了本地系统底层对官方 Token Caching 的识别表现。同时，我们修复了由高度估测错算导致的开局向导组件渲染越出屏幕边界的历史沉疴。

### 🇨🇳 中文更新概览

- 🎛️ **开放更自由的底层模型参数配置**：为进阶创作者们特别新增了「高级模型参数配置」组件。现在可在设定面板针对特定的供应商模型**独立修改并覆盖**其专属的 *Temperature*（温度）、*Top P*（核采样约束）、*Max Output Tokens*（最大输出限制）甚至最新的 *Reasoning Effort*（深度思考推理强度）。
- 📉 **Prompt Caching 命中记录可见化**：优化后台长文本统计逻辑的接入，系统底层正式打通最新 API 上下文缓存流的解析链路；右侧 AI 面板「统计」选项卡内现已实时刷新并高亮显示 **缓存命中 Tokens (Cache Hits)**，直观展现为你节省的巨量输入开销。
- 🔧 **修复全屏向导悬浮定位越屏的缺陷**：根绝了在新安装应用触发应用引导功能（TourOverlay）时，因为其组件内部把初始气泡估算高度硬编码为异常庞大的 `460px` ，造成原本指代左下角云同步图标的说明框向飞出窗口顶部错乱的问题。
- 📖 **应用内部语料库补充与热修缮**：重构并充实了应用内按下齿轮选项后弹出的「帮助与指南」面板文档。已详细涵盖 RAG 本地向量机制及相关智能缓存的操作讲解，同时彻底校对梳理了全版本多语环境（特别是英语与俄语）的显示遗漏。

📦 全自动封装构建流程完毕，点击下方 `.exe` 图标立刻开启纯粹自由的写作心流。

---

### 🇺🇸 English Release Notes

The Version 1.2.9 release unlocks a vast grid of low-level LLM parameter tweaks, explicitly surfacing prompt context cache statistics directly onto the UI, alongside a critical UX hotfix correcting heavily misaligned out-of-bound onboarding elements.

- 🎛️ **Independent Advanced Tuning Matrix:** Added dynamic switches allowing deeper configuration logic for specialized writing behaviors! Users can now explicitly force-override *Temperature*, *Top P*, *Max Output Tokens*, and new complex *Reasoning Effort* traits independently per LLM provider right inside API settings.
- 📉 **Native Prompt Caching Visor:** We've heavily tapped into token-spend optimization protocols—meaning you get deep API context-cache metric integrations! A real-time **Cache Hit Rate (Tokens)** tracker has been mapped cleanly inside your AI Sidebar's stat tab highlighting your exact long-context savings dynamically!
- 🔧 **Tour Overlay Off-Canvas Alignment Fix:** Extinguished an annoying long-standing glitch where newly executed application tutorials deployed tooltip overlays using a huge `460px` height-guess threshold causing lower-anchored popups (especially bottom sync menus) to physically fly miles away tracking off-screen bounds. 
- 📖 **Embedded Local Documentation Reworks:** We've comprehensively overhauled inner "Help & Info" document blocks to strictly incorporate the shiny features previously pushed like the intricate offline RAG text vector mechanism or the new parameter bounds. Entire multi-lingual JSON files (EN/RU/ZH) were thoroughly reviewed to align perfectly.

📦 Simply grab the `.exe` installer right below and run it directly. Cloud sync engine is already packed nicely inside.
