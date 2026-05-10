## v1.2.25 — AI 行内差异采纳与移动安装包 | Inline AI diff acceptance and mobile installer

### 🇨🇳 中文

#### ✍️ 编辑器 AI 工作流
- **新增行内 AI 差异采纳**：AI 改写会直接在正文中展示差异，保留原文和建议内容的对照关系
- **支持逐段接受/拒绝**：可一键采用 AI 建议，或拒绝后恢复当前正文，不再需要在聊天面板和编辑器之间来回复制
- **键盘操作更顺手**：保留 `Tab` 接受、`Esc` 拒绝等快捷交互，适合连续审稿和快速改写
- **续写与替换体验统一**：续写仍以幽灵文字方式预览，替换类改写则使用更明确的行内差异展示

#### 🔐 隐私与发布安全
- **新增提交前隐私防线**：根仓库加入 pre-commit 检查入口，提交前自动扫描方案文档、移动端私有资产、密钥形态和敏感调试文件
- **清理敏感调试日志**：移除了设定导入、PDF/PMPX 解析、Firestore 同步、模型拉取等流程中的详细调试输出，避免正文片段、设定名、同步 key 或 payload 出现在日志中
- **继续隔离移动端源码**：移动端仍保留在私有仓库；公开仓库只发布构建产物，不包含 Flutter 源码和私有路线图

#### 📦 安装包
- **Windows 安装包继续自动发布**：推送 `v1.2.25` 标签后会自动构建桌面端安装包
- **新增 Android APK 发布链路**：移动端私有仓库可构建签名 APK，并追加上传到本公开 Release
- **附带校验文件**：Android APK 会同时上传 `.sha256` 校验文件，方便下载后核对完整性

---

### 🇬🇧 English

#### ✍️ Editor AI Workflow
- **Added inline AI diff acceptance**: AI rewrites are now previewed directly in the editor with clear original-vs-suggested text
- **Accept or reject in place**: Apply an AI suggestion with one action, or reject it and keep the current draft without copying text between the chat panel and editor
- **Smoother keyboard flow**: `Tab` to accept and `Esc` to reject remain available for faster review and rewrite sessions
- **Unified continuation and replacement behavior**: Continuations still use ghost text, while replacement rewrites now use explicit inline diff previews

#### 🔐 Privacy And Release Safety
- **Added a pre-commit privacy guard**: The public repository now has a hook entry that runs release safety checks before commits, scanning for internal docs, mobile private assets, secret-looking values, and sensitive debug files
- **Removed sensitive debug logging**: Detailed logs from settings import, PDF/PMPX parsing, Firestore sync, and model fetching were removed to keep draft text, setting names, sync keys, and payloads out of logs
- **Mobile source remains private**: The mobile app stays in its private repository; the public repository only receives build artifacts, not Flutter source or private planning documents

#### 📦 Installers
- **Windows installer continues to publish automatically**: Pushing the `v1.2.25` tag triggers the desktop installer build
- **Added Android APK publishing flow**: The private mobile repository can build a signed APK and attach it to this public Release
- **Checksum included**: The Android APK upload also includes a `.sha256` file for integrity checks
