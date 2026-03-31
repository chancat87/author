## 📋 本次焕新简报 / Release Overview

本次更新（v1.2.12）大幅增强了 AI 助手的设定集管理能力和 API 多实例配置体系。AI 现在可以通过对话直接查找、列出和按名称删除设定条目；API 配置支持同一供应商创建多个独立实例，每个实例可配置独立的 URL、Key、模型列表和高级参数；同时修复了 AI 将设定错误归类到"写作规则"的分类混乱 Bug。

### 🇨🇳 中文更新概览

- 🧠 **AI 设定集全知全能**：AI 助手现在拥有当前作品的完整设定索引（包括已禁用的条目），用户可以直接问"有哪些角色"或"列出所有世界观设定"，AI 即刻列出完整条目清单。删除操作也从强制要求 nodeId 升级为按名称智能查找，直接说"删除李白这个角色"即可精准执行。
- 🗂️ **AI 分类归一化引擎**：引入了 60+ 种中英文分类别名映射表（`CATEGORY_ALIASES`），彻底解决了 AI 输出"人物"被归档到"写作规则"、"世界观"进了"自定义"等分类混乱问题。所有 AI 生成的设定卡片现在都能精准落入正确的分类文件夹。
- 🗑️ **AI 对话删除功能**：在设定操作卡片中新增了独立的「🗑 删除」按钮，支持一键删除对应条目。同时 AI 也可以通过对话直接生成删除指令。删除操作会显示真实条目名称（如"已删除「李白」"），不再暴露内部 ID。
- 🔌 **同类型供应商多实例配置**：全面重构 API 配置架构，支持为同一类型供应商（如 OpenAI 兼容）创建多个独立实例。每个实例拥有独立的 URL、API Key、模型列表，解决了"url1 有 a1/a2/a3，url2 有 a1/b1/b2"时快切列表冲突的痛点。
- ⚙️ **模型级高级参数覆盖**：高级模型参数（Temperature、Top P、最大输出 Token、推理强度等）现在支持按模型独立开关和覆盖——同一供应商下不同模型可以有不同的参数配置。
- 🧹 **快切列表模型清理**：修复了快切列表中已配置模型无法清除的问题，用户可以自由管理每个实例的模型库。
- 🔍 **跨类别去重保护**：AI 创建设定时新增跨类别同名检测，即使 AI 给出了不同的分类名，也不会重复创建同名条目。

📦 点击下方 `.exe` 安装包即可体验完整升级。

---

### 🇺🇸 English Release Notes

Version 1.2.12 delivers a major evolution in AI settings management and API multi-instance configuration. The AI assistant now has full awareness of all settings entries and can search, list, and delete them by name through natural conversation. The API system now supports multiple independent instances per provider type, each with its own URL, Key, model list, and advanced parameters.

- 🧠 **AI Full Settings Awareness:** The AI assistant now receives a complete settings index (including disabled entries) for the current work. Users can ask "list all characters" or "what settings do I have?" and get instant, comprehensive answers. Deletion is upgraded from requiring nodeId to intelligent name-based matching — just say "delete Li Bai" and it's done.
- 🗂️ **Category Normalization Engine:** Introduced a 60+ alias mapping table (`CATEGORY_ALIASES`) that resolves Chinese/English category name variants to their canonical form. This fixes the critical bug where AI-generated entries for "characters" or "worldbuilding" would be incorrectly filed under "writing rules".
- 🗑️ **In-Chat Deletion:** Added a dedicated 🗑 Delete button to settings action cards, plus the AI can now generate delete commands through conversation. Deletion feedback shows real entry names (e.g., "Deleted 「Li Bai」") instead of raw internal IDs.
- 🔌 **Multi-Instance Provider Configuration:** Completely refactored the API config architecture to support multiple independent instances per provider type. Each instance has its own URL, API Key, and model list — solving the model list conflict when using multiple endpoints of the same provider type.
- ⚙️ **Per-Model Advanced Parameters:** Advanced model parameters (Temperature, Top P, Max Output Tokens, Reasoning Effort) now support per-model independent toggle and override within the same provider instance.
- 🧹 **Model List Cleanup:** Fixed the issue where models in the quick-switch list couldn't be removed, giving users full control over each instance's model roster.
- 🔍 **Cross-Category Deduplication:** AI-created settings now include cross-category name collision detection, preventing duplicate entries even when the AI uses different category names.

📦 Grab the `.exe` installer below for the full upgrade experience.
