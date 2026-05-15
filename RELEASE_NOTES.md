## v1.2.30 — 修复启动、AI 设定应用与同步体验

### 中文

#### 桌面端

- 修复部分环境下客户端提示“内置服务器无法启动”的启动问题，并增强本地服务可用性检测。
- 修复 OpenAI 兼容接口在向量化和模型列表请求中可能拼接出错误地址的问题。
- 修复切换作品后，AI 助手仍把上一部作品的人物、设定或内容写入当前作品的问题。
- 修复 AI 助手生成书籍信息后，作品信息仍显示为空白的问题。
- 修复 AI 助手把设定应用到设定集时，可能放错大分类或子分类的问题。
- 修复帮助文档中 `####` 四级标题无法正确渲染的问题。
- 同步逻辑优化：快照保留在本机，超大的章节或设定数据会自动分片同步，减少单个文件过大导致的失败。
- 修复右上角提示可能被顶部按钮或弹窗遮挡的问题。
- 增强桌面端使用记录与版本信息上报，便于后续定位安装、启动和稳定性问题。

#### Android 端

- 修复 AI 助手输出过程中切换底部导航，再返回后当前消息丢失的问题。
- 修复自定义设定文件夹，例如“细纲”，无法接收 AI 助手写入内容的问题。
- 修复 AI 会话列表右侧菜单显示位置异常、只能在小区域内滑动的问题。
- 增强 Android 端使用记录、崩溃与性能信息上报，便于后续定位问题。
- Android 安装包版本号更新为 `1230`。

---

### English

#### Desktop

- Fixed a startup issue where the desktop client could report that the built-in server failed to start, with stronger local service readiness checks.
- Fixed incorrect URL construction for OpenAI-compatible embedding and model-list requests.
- Fixed AI assistant writes leaking from the previous work into the currently selected work after switching projects.
- Fixed AI-generated book information not being applied back to the work profile.
- Fixed AI-generated settings being placed under the wrong top-level category or subcategory.
- Fixed `####` level headings not rendering correctly in Help documents.
- Improved sync reliability: snapshots stay local, and oversized chapter or settings data is split automatically during cloud sync.
- Fixed top-right notifications being hidden behind header buttons or popups.
- Improved desktop usage and version reporting to help diagnose install, startup, and stability issues.

#### Android

- Fixed the current AI message disappearing after switching bottom navigation tabs during generation.
- Fixed custom settings folders, such as outline/detail folders, not accepting AI-generated content.
- Fixed the AI conversation list menu appearing in a cramped scroll area instead of as a normal popup.
- Improved Android usage, crash, and performance reporting for issue diagnosis.
- Android version code is now `1230`.
