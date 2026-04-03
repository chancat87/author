## v1.2.16 — 存档/读档功能修复 / Save & Load Fix

### 🇨🇳 中文

#### 🐛 关键修复
- **修复存档文件缺失章节和对话数据**：导出存档时改用持久化层读取 IndexedDB，不再依赖 localStorage（此前导出的章节和聊天会话可能为空）
- **修复读档后数据不生效**：导入存档时改用持久化层写入 IndexedDB + 服务端，而非仅写 localStorage
- **修复按作品存储的章节未被导出**：遍历作品索引，逐一收集每个作品的章节和设定集数据

#### 🔒 隐私与安全
- **对话会话不再同步到云端**：聊天记录仅保存在本地 IndexedDB，不参与 Firebase 云同步（体积大 + 隐私敏感）
- **API 配置保持本地存储**：API 密钥等敏感配置从未同步到云端（确认无变化）

#### 📦 存档格式升级
- 存档版本升至 v2，新增 `perWorkChapters` 按作品 ID 索引章节
- 完全向后兼容：v1 旧存档文件仍可正常导入
- 新增导出偏好设置（主题、语言、API 配置文件等）

---

### 🇬🇧 English

#### 🐛 Critical Fixes
- **Fix exported saves missing chapters and chat data**: Export now reads from IndexedDB via persistence layer instead of localStorage (previously chapters and chat sessions could be empty)
- **Fix imported saves not taking effect**: Import now writes through persistence layer to IndexedDB + server, instead of localStorage only
- **Fix per-work chapters not exported**: Iterates works index to collect chapters and settings for each work

#### 🔒 Privacy & Security
- **Chat sessions no longer synced to cloud**: Chat history stays in local IndexedDB only, excluded from Firebase cloud sync (large size + privacy sensitive)
- **API config remains local-only**: API keys and sensitive config never synced to cloud (confirmed unchanged)

#### 📦 Save Format Upgrade
- Save format bumped to v2, with new `perWorkChapters` indexed by work ID
- Fully backward compatible: v1 save files can still be imported
- Now exports user preferences (theme, language, API profiles, etc.)
