## v1.2.44 — 桌面/移动端国际化与云同步稳定性完善

### 中文

#### 桌面端 / Web

- 完善桌面端英文/俄文国际化覆盖，补齐设置集、帮助文档、云同步、作品信息、AI 侧栏、摘要中心、模型选择和错误提示等界面的固定文案。
- 调整设定集内置分类、服务商列表、主题提示、帮助内容和安全提示词展示，使切换语言后不再残留中文固定文本。
- 修复编辑器恢复光标位置时 TipTap view 尚未挂载导致的运行时错误，并增强空白编辑区点击后的焦点恢复。
- 优化 Firebase/便携同步的数据覆盖、快照恢复和本地刷新路径，减少桌面与移动端同步后章节、分卷、设定集内容不一致的情况。
- 作品管理默认以窗口模式打开，避免进入即全屏；章节列表统计去掉与字数重复的 token 展示。

#### Android 端

- 新增移动端应用级国际化基础设施，补齐书架、编辑器、设定集、AI、个人中心、同步状态、导入导出和法务页面的大量固定文案。
- 内置设定分类、上下文引用、AI 模板、模型选择、写作评估和工具菜单支持随语言切换显示。
- 修复移动端云同步拉取后 UI 状态没有及时刷新、需要强制覆盖才能看到云端内容的同步体验问题。
- 同步键策略与桌面端保持一致，降低不同端之间章节、设定集、作品信息映射错乱的风险。
- Android 版本号对齐为 `1.2.44+1244`。

---

### English

#### Desktop / Web

- Expanded English and Russian localization coverage across settings, help, cloud sync, book info, the AI sidebar, synopsis center, model selection, and error states.
- Localized built-in setting categories, provider lists, theme prompts, help content, and safety-prompt displays so fixed Chinese copy no longer remains after changing languages.
- Fixed a TipTap runtime crash when restoring editor position before the editor view is mounted, and made blank-editor focus recovery more robust.
- Improved Firebase and portable-sync overwrite, snapshot restore, and local refresh paths to reduce chapter, volume, and setting-data mismatches between desktop and mobile.
- Work management now opens in windowed mode by default, and the desktop chapter list no longer shows token counts that duplicate word counts.

#### Android

- Added the mobile app-level localization foundation and filled in fixed copy across bookshelf, editor, lore/settings, AI, profile, sync status, import/export, and legal pages.
- Built-in setting categories, context references, AI templates, model selection, writing review, and tool menus now follow the selected language.
- Fixed the mobile cloud-pull refresh path so pulled cloud data is reflected without requiring a forced overwrite in common cases.
- Aligned sync-key policy with desktop to reduce cross-device mapping mismatches for chapters, settings, and book information.
- Android is now version `1.2.44+1244`.
