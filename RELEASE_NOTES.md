## v1.2.15 — 代码质量与可维护性重构 / Code Quality & Maintainability Refactor

### 🇨🇳 中文

#### 🔧 代码重构
- **提取 GoogleIcon 共享组件**：消除 LoginModal 与 RegisterModal 中完全重复的 SVG 代码
- **集中化仓库常量**：将 GitHub/Gitee 仓库地址和法律文档 URL 生成逻辑统一收拢到 `constants.js`
- **提取 useAuthAction Hook**：将登录/注册的 4 个认证处理函数中重复的 loading/error/同步流程收拢为 1 个可复用 Hook
- **动态生成法律文档表格**：HelpPanel 中的 8 行硬编码 Markdown 表格改为从语言配置数组循环生成

#### 📝 维护性改进
- 新增语言版本时只需修改 `constants.js` 中的 `LEGAL_LANGUAGES` 数组，RegisterModal 和 HelpPanel 自动适配
- 修改仓库地址时只需改 `REPO` 常量，全局生效

---

### 🇬🇧 English

#### 🔧 Code Refactoring
- **Extract shared GoogleIcon component**: Eliminated duplicated SVG code between LoginModal and RegisterModal
- **Centralize repository constants**: Unified GitHub/Gitee URLs and legal document URL generation into `constants.js`
- **Extract useAuthAction Hook**: Consolidated 4 repeated auth handler patterns (loading/error/sync) into 1 reusable Hook
- **Dynamic legal document table**: Replaced 8 hardcoded Markdown rows in HelpPanel with loop generation from language config array

#### 📝 Maintainability Improvements
- Adding new language versions now only requires updating the `LEGAL_LANGUAGES` array in `constants.js`
- Changing repository URLs only requires modifying the `REPO` constant
