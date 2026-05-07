## v1.2.24 — 顶层设定分类重命名 | Rename top-level setting categories

### 🇨🇳 中文

#### 📚 设定集分类管理
- **新增顶层分类重命名**：完整设定集面板的分类卡片现在会在悬停时显示铅笔按钮，可直接重命名顶层分类
- **左侧分类弹窗同步支持**：点击左侧设定集入口，在编辑导航栏模式中也可以通过铅笔按钮重命名分类
- **按作品独立保存**：分类名称写入当前作品的分类根节点，不同作品可以使用不同的分类命名
- **覆盖内置与自定义分类**：人物、地点、世界观、大纲等内置分类，以及用户新建的顶层分类都可以改名

#### 🧭 显示一致性
- **分类详情页标题同步更新**：改名后打开分类详情页会显示新的分类名称
- **侧边栏快捷入口同步更新**：已固定到左侧导航栏的分类会使用新名称作为按钮提示和展开文字
- **作品信息概览同步更新**：作品信息页里的分类统计卡片会读取当前作品的自定义名称
- **导入/导出文案同步更新**：分类导出文件名、导入成功提示等会使用改名后的分类名称

#### 📚 文档同步
- **更新帮助页**：补充顶层分类重命名入口说明
- **同步多语言 README**：中、英、俄、阿 README 均补充顶层分类可按作品重命名的说明

---

### 🇬🇧 English

#### 📚 Setting Category Management
- **Added top-level category renaming**: Category cards in the full settings panel now show a pencil action on hover, letting users rename top-level categories directly
- **Sidebar category popover support**: The sidebar settings popover also supports category renaming from its edit mode
- **Saved per work**: Category names are stored on the current work's category root node, so each work can use its own naming
- **Built-in and custom categories are covered**: Built-in categories such as characters, locations, worldbuilding, and outlines, plus user-created top-level categories, can all be renamed

#### 🧭 Consistent Display
- **Category detail titles stay in sync**: Opening a renamed category shows the new name in the detail view
- **Sidebar shortcuts stay in sync**: Pinned category shortcuts use the renamed label for tooltips and expanded labels
- **Book info overview stays in sync**: Category statistic cards in the book info panel read the current work's custom labels
- **Import/export labels stay in sync**: Category export filenames and import success messages use the renamed category label

#### 📚 Documentation
- **Updated the Help panel**: Added guidance for top-level category renaming
- **Updated multilingual READMEs**: Chinese, English, Russian, and Arabic READMEs now mention per-work top-level category renaming
