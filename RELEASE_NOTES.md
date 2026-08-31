## v1.2.55 — 改进 AI 设定与移动端联网搜索、历史和备份

### 中文

#### 桌面端与网页版

- AI 设定操作现在会优先补充已有内容，避免在意图不明确时覆盖原设定。
- 替换已有字段前会展示新旧内容供确认；应用后的修改可以单独撤销。
- “移除卡片”现在只隐藏该条建议，不会删除角色或设定；删除设定时会再次确认。
- 补全默认作品名称在导入、清理和删除界面中的多语言显示。

#### Android 端

- 新增模型原生搜索、Tavily 和 Exa 联网搜索配置，可在每个 AI 会话中自由切换。
- API 配置改为分类目录，并提供更清晰的提供商选择与搜索界面。
- 修复历史版本页面可能一直加载的问题，读取失败时可以重试，异常旧记录不会阻塞其他版本。
- ZIP 备份不再包含 API Key、登录信息或 WebDAV 密码；导入旧备份时也会跳过这些内容。
- 自定义搜索服务仅接受 HTTPS 地址，并在界面中明确提示 Key 与查询内容的发送对象。

---

### English

#### Desktop and Web

- AI lore actions now append to existing content by default, avoiding unintended overwrites when the request is ambiguous.
- Existing and proposed values are shown before replacement, and applied changes can be undone individually.
- **Remove card** now hides only the suggestion without deleting the character or lore entry; deleting lore requires confirmation.
- Improved localized display of the default work name in import, cleanup, and deletion screens.

#### Android

- Added provider-native, Tavily, and Exa web search, with per-chat switching.
- Reorganized API configuration into categories with a cleaner provider picker and search interface.
- Fixed revision history getting stuck while loading, added retry feedback, and kept malformed legacy entries from blocking valid snapshots.
- ZIP backups no longer include API keys, sign-in details, or WebDAV passwords; those fields are also skipped when importing older backups.
- Custom search services now require HTTPS, with clear notice of where search keys and queries are sent.
