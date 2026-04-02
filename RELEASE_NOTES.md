## 📋 本次焕新简报 / Release Overview

本次更新（v1.2.14）是一次安全合规与国际化的重要升级：新增多语言隐私政策与服务条款、升级 Firestore 安全规则、完成登录/注册模块国际化重构，并修复了桌面端退出无法取消的问题。

### 🇨🇳 中文更新概览

- 📜 **隐私政策 & 服务条款**：新增中/英/俄/阿四语言版本的完整隐私政策和服务条款文档（共 8 个文件），文档顶部内置语言切换导航栏。
- 🌐 **国内可达性**：所有法律文档链接同时提供 GitHub 和 Gitee 镜像地址，注册弹窗和帮助页均提供国内镜像入口，确保中国大陆用户无障碍访问。
- 🔒 **Firestore 安全规则升级**：更新了云端数据库安全规则与项目绑定配置。
- 🌍 **登录/注册国际化**：LoginModal 和 RegisterModal 完成国际化重构，移除硬编码文案，全面接入 i18n 翻译系统（中/英/俄三语）。
- ❌ **退出取消功能**：修复桌面客户端退出同步弹窗无法取消的问题，新增「取消」按钮，重构 Electron IPC 通信逻辑。
- 🖼️ **应用图标更新**：更新了应用图标。

📦 点击下方 `.exe` 安装包即可体验完整升级。

---

### 🇺🇸 English Release Notes

Version 1.2.14 is a major security, compliance, and internationalization upgrade: adds multi-language legal documents, upgrades Firestore security rules, fully internationalizes the login/register flow, and fixes the desktop exit dialog.

- 📜 **Privacy Policy & Terms of Service:** Added complete Privacy Policy and Terms of Service documents in 4 languages (English, Chinese, Russian, Arabic) — 8 new files total, each with a cross-language navigation bar.
- 🌐 **China Accessibility:** All legal document links provide both GitHub and Gitee mirror URLs. The registration modal and help panel include domestic mirror entry points, ensuring barrier-free access for users in mainland China.
- 🔒 **Firestore Security Rules Upgrade:** Updated cloud database security rules and project binding configuration.
- 🌍 **Login/Register i18n:** LoginModal and RegisterModal fully refactored with i18n support, replacing all hardcoded text with translation keys (Chinese/English/Russian).
- ❌ **Exit Cancel Feature:** Fixed the desktop client exit-sync dialog that couldn't be cancelled. Added a "Cancel" button and refactored Electron IPC communication logic.
- 🖼️ **App Icon Update:** Updated the application icon.

📦 Grab the `.exe` installer below for the full upgrade experience.
