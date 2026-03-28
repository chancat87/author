## 📋 本次焕新简报 / Release Overview

在 1.2.7 版本中，为了追求极致的无网环境写作体验和保障本地数据的纯净安全，Author 迎来了极简但至关重要的一次内生进化。

### 🇨🇳 中文更新概览

- 🚀 **零延迟！完全卸载外部字体依赖**：全面本地化字体库与配套 CSS 渲染引擎。告别因极弱网或无网状态下造成的拉取云端字体超时、页面严重白屏卡顿问题，在物理隔离环境下也可真正实现「秒开」。
- 🧰 **内置纯离线 Katex 引擎支持**：系统已内置无差别高级数学公式渲染包，拔网线也能愉快挥洒公式。
- 🛡️ **底层调试日志持久化修复**：程序底层的 Debug 日志输出目录，现已由安装目录强制规避迁移至本机的用户数据目录（User Data），彻底杜绝因系统写入权限不足带来的“吞日志”幽灵 Bug。
- 🔄 **云端与本地同步体验再升级**：对版本快照记录及退出程序的覆盖同步逻辑进行了精细化重构打磨，提示拦截弹窗更加智能清晰。

📦 点击下方 `.exe` 直链下载，无需繁琐配置，双击运行即可开启您的零干涉心流创作。

---

### 🇺🇸 English Release Notes

In version 1.2.7, Author takes a disciplined step entirely towards establishing an extreme offline-writing ecosystem, ensuring zero data delays.

- 🚀 **Zero-latency Startups:** External font CDNs and CSS scripts have been entirely eradicated from the application layout. By utilizing localized typography, the editor will now launch instantly without encountering prolonged white-screen loading hiccups caused by restrictive offline environments.
- 🧰 **Embedded Offline Katex Rendering:** Complete integration of offline Katex modules allows for complex mathematical formula formatting without making a single network request.
- 🛡️ **Debug Logging Persistence Fixed:** Rectified an invisible bug causing local debugging logs to vanish into thin air due to strict Windows Program Files write permissions, by smoothly relocating log emissions directly to the User Data configuration directory.
- 🔄 **Enhanced Cloud Sync UI/UX:** Polished components handling synchronization interceptions and local vs. cloud file diff resolutions, providing a smoother conflict handling experience.

📦 Simply grab the `.exe` installer right below and run it directly. Cloud sync engine is already packed nicely inside.
