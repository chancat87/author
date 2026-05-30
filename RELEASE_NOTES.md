## v1.2.34 — 新增便携同步与移动端阅读模式

### 中文

#### 桌面端 / Web

- 新增 WebDAV 同步，可在「偏好设置 → 云同步」中配置坚果云、123 云盘或自建 NAS/Nextcloud 等服务。
- 新增局域网临时同步，可在同一 Wi-Fi 下生成分享链接，将作品、章节和设定迁移到另一台设备。
- 同步入口统一调整为「同步方式」，未登录或未配置 Firebase 时会直接进入同步设置，不再只引导登录。
- WebDAV 应用密码在桌面端使用 Electron 安全存储保存，网页版仅保存在本机浏览器。
- WebDAV 服务端代理增加公网安全限制，公网部署不会代理访问 localhost 或内网地址。
- 便携同步继续沿用隐私优先 allowlist，仅同步作品索引、章节和设定节点；AI 会话、API 配置、快照、调试信息和本地偏好保持本地私有。
- 诊断系统增加键盘事件保护和重复初始化清理，降低异常输入事件导致的诊断报错风险。
- README 和帮助页面已同步更新 Firebase、WebDAV、局域网同步说明。
- 发版流程新增 preflight 检查，确保每次发版前都能发现并阅读本地 release workflow。

#### Android 端

- Android 版本更新为 `1.2.34+1234`。
- 修复桌面端同步分割线后，移动端编辑器显示大块灰色占位的问题。
- 移动端编辑器和专注写作页现在能正确渲染分割线等 Quill embed，并对未知 embed 使用安全文本回退。
- 阅读模式新增「连续滚动 / 左右分页 / 上下分页」布局选项。
- 阅读模式新增「无动画 / 滑动 / 经典 / 魔方」翻页效果，并修复滑动到一半页面消失的问题。
- 阅读模式设置会记住字号、行距、主题、阅读方式和翻页效果。
- 优化阅读模式分页估算和长段落拆分，减少单页内容过长导致的分页不稳定。

---

### English

#### Desktop / Web

- Added WebDAV sync in **Preferences → Cloud Sync**, supporting Jianguoyun, 123 Cloud Drive, and self-hosted NAS/Nextcloud-style services.
- Added temporary LAN sync for transferring works, chapters, and lore/settings between devices on the same Wi-Fi network.
- Unified sync entry points under “Sync methods”, so users without Firebase login/configuration are taken to sync settings instead of only being prompted to log in.
- WebDAV app passwords are stored with Electron secure storage on desktop and remain local to the browser in web builds.
- The WebDAV server proxy now blocks localhost and private-network targets when running from public deployments.
- Portable sync keeps the privacy-first allowlist: only work indexes, chapters, and settings nodes sync. AI chats, API configs, snapshots, diagnostics, and local preferences remain local-only.
- Improved diagnostics with keyboard event guards and cleanup for repeated initialization, reducing noise from malformed input events.
- README files and the Help panel now describe Firebase, WebDAV, and LAN sync consistently.
- Added a release preflight guard so local release workflow docs are discovered and read before future releases.

#### Android

- Android version is now `1.2.34+1234`.
- Fixed large gray placeholders in the mobile editor after syncing divider blocks from desktop.
- Mobile editor and focus writing pages now render divider-style Quill embeds correctly and use safe text fallbacks for unknown embeds.
- Reading mode now supports **continuous scroll**, **horizontal pagination**, and **vertical pagination**.
- Reading mode now supports **instant**, **slide**, **classic cover**, and **cube** page effects, and fixes the half-swipe disappearing page issue.
- Reading mode preferences now persist font size, line height, theme, layout, and page effect.
- Improved reading page estimation and long paragraph splitting for more stable pagination.
