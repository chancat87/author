## 📋 本次焕新简报 / Release Overview

本次更新（v1.2.13）修复了外置搜索功能无法自定义 API 地址的问题，现在用户可以在设置面板中填入自定义的搜索 API 地址（如 Tavily/Exa 中转站），并在 API Key 输入框中使用逗号分隔多个 Key 实现号池轮询。

### 🇨🇳 中文更新概览

- 🔗 **外置搜索自定义地址**：修复了外置搜索（Tavily/Exa）配置区域缺少 API 地址输入框的问题。用户现在可以填入自建中转站或第三方代理地址，后端已支持但前端 UI 此前缺失，本版本补齐。
- 🔄 **搜索 Key 号池提示**：API Key 输入框新增号池使用提示（"多个用逗号分隔可轮询"），引导用户充分利用已有的 Key 轮转负载均衡能力。

📦 点击下方 `.exe` 安装包即可体验完整升级。

---

### 🇺🇸 English Release Notes

Version 1.2.13 fixes the external search tool configuration UI that was missing the Base URL input field. Users can now configure custom API endpoints (e.g., Tavily/Exa proxies or relay servers) directly from the settings panel.

- 🔗 **Custom Search API URL:** Fixed the missing Base URL input in the external search (Tavily/Exa) configuration section. Users can now enter custom relay or proxy endpoints — the backend already supported this field, but the frontend UI was missing it.
- 🔄 **Key Pool Hint:** The API Key input now includes a placeholder hint about key pooling ("separate multiple keys with commas for round-robin rotation"), guiding users to leverage the existing key rotation feature.

📦 Grab the `.exe` installer below for the full upgrade experience.
