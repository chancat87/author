## v1.2.43 — 桌面章节拆分合并与移动端作品整理增强

### 中文

#### 桌面端 / Web

- 新增章节拆分功能：在编辑器当前光标处将正文拆成两章，光标前内容保留在当前章节，光标后内容自动生成下一章。
- 新增章节合并功能：可将当前章节与下一章节合并，合并后保留内容与字数统计。
- 新增正文默认字体设置，默认宋体可在偏好设置中切换为黑体、楷体、仿宋、Serif 或 Monospace。
- 优化正文之外的界面字号设置，与章节正文的字号调整保持独立。
- 调整 AI 对话历史引用选择逻辑，减少侧栏选择状态与实际请求上下文不一致的情况。

#### Android 端

- 书架新增作品分类、排序、置顶和手动重排能力，便于多作品场景下快速定位。
- 设定页新增条目排序、移动到文件夹、属性增删和模板保存能力。
- 作品页工具入口改为可见的「工具」按钮，工具菜单支持拖拽排序并保存顺序。
- 新增软件界面字号设置，界面字号与章节正文阅读/编辑字号互不影响。
- 修复书架「设置分类」弹窗关闭时可能触发 `TextEditingController` 生命周期红屏的问题。
- Android 版本号对齐为 `1.2.43+1243`。

---

### English

#### Desktop / Web

- Added chapter splitting from the editor cursor position: content before the cursor stays in the current chapter, and content after it becomes the next chapter.
- Added chapter merging so the current chapter can absorb the next chapter while preserving content and word-count updates.
- Added a default writing-font preference so the previous Songti default can be changed to Heiti, Kaiti, Fangsong, Serif, or Monospace.
- Improved non-editor UI font-size settings so they remain independent from chapter body font-size controls.
- Refined AI dialogue-history selection so the sidebar selection and actual request context stay aligned.

#### Android

- Added bookshelf categories, sorting, pinning, and manual reorder for easier navigation across many works.
- Added lore/setting item ordering, move-to-folder, attribute add/remove, and template saving.
- Made the work page tool entry visible as a "工具" button, with drag-and-drop ordering saved for the tool menu.
- Added app UI font-size preferences independent from chapter body reading/editing font size.
- Fixed a red-screen lifecycle crash that could occur after using the bookshelf "设置分类" dialog.
- Android is now version `1.2.43+1243`.
