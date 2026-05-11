## v1.2.26 — 移动端自动更新与作品关联优化 | Mobile auto updates and work-linked chats

### 🇨🇳 中文

#### 📱 移动端启动、登录与更新
- **启动体验重做**：新增更柔和的 Author Logo 启动动画，并接入首次引导流程
- **离线优先进入**：移动端可以跳过登录直接进入工作台；登录只用于云同步，不再阻挡本机写作
- **应用内更新流程**：新增版本检查、更新日志展示、APK 下载进度和安装器唤起，减少跳转浏览器下载的割裂感
- **更新源增强**：GitHub Release 会读取 APK assets；Gitee Release 支持解析附件和正文里的 APK 下载链接
- **强制更新机制**：Release 说明中加入约定标记后，移动端可禁用“稍后再说”，用于破坏性协议变更场景

#### 🧠 AI 对话与作品上下文
- **明确关联作品入口**：AI 对话顶部显示当前关联作品，未关联时可直接选择作品
- **已有会话可补挂作品**：会话抽屉支持给历史对话关联、更换或取消关联作品
- **流式体验修复**：修复流式生成期间不能自由滚动、轻微抖动以及异步 emit 越界导致的崩溃
- **模型选择优化**：模型名显示更稳，思考等级和模型选择控件在窄屏下更不容易溢出

#### 🔌 API 配置与余额
- **DeepSeek 余额接口修正**：默认余额查询地址改为官方 `GET https://api.deepseek.com/user/balance`
- **余额自动展示**：配置有效 API Key 后会自动刷新余额，也可以手动点“刷新”
- **提供商配置更稳定**：禁用 Gemini 等提供商后会正确持久化，不会退回页面后再次自动启用

#### 🖥️ 桌面端同步优化
- **DeepSeek 配置提示更新**：桌面端同步提示官方余额接口，避免继续使用旧路径
- **余额卡片更即时**：桌面端 API 设置页也会自动展示余额状态，方便判断 Key 是否可用

📦 Windows 安装包由本公开仓库自动构建；Android APK 会由私有移动仓库签名构建后上传到本 Release。

---

### 🇬🇧 English

#### 📱 Mobile startup, sign-in, and updates
- **Redesigned startup flow**: Added a softer Author logo animation and first-run onboarding
- **Offline-first entry**: The mobile app can now skip sign-in and go straight to the workspace; sign-in is only needed for cloud sync
- **In-app update flow**: Added version checks, changelog display, APK download progress, and installer handoff to avoid browser-only downloads
- **Better update sources**: GitHub Release APK assets are parsed directly; Gitee releases can resolve APK links from attachments or release bodies
- **Forced update support**: Release body markers can disable “later” actions for breaking API or data migrations

#### 🧠 AI chats and work context
- **Clear work-link entry point**: AI chat now shows the currently linked work at the top, with a direct selector when none is linked
- **Link existing chats**: Historical sessions can now be linked to, switched between, or detached from works in the session drawer
- **Streaming fixes**: Fixed scrolling during streamed replies, reduced visible jitter, and fixed async emit-after-completion crashes
- **Model selector polish**: Model names, reasoning effort controls, and selector layouts are more stable on narrow screens

#### 🔌 API configuration and balances
- **DeepSeek balance endpoint fixed**: The default balance URL now uses the official `GET https://api.deepseek.com/user/balance`
- **Balances are always visible**: Once a valid API key is configured, balance status refreshes automatically and can still be refreshed manually
- **More reliable provider state**: Disabled providers such as Gemini now remain disabled after leaving and returning to settings

#### 🖥️ Desktop parity updates
- **DeepSeek hints updated**: Desktop settings now point to the official balance endpoint
- **More immediate balance card**: Desktop API settings automatically surface balance status so users can tell whether a key is usable

📦 The Windows installer is built from this public repository. The Android APK is signed in the private mobile repository and uploaded to this public Release afterward.
