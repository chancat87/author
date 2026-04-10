## v1.2.17 — 交互体验与同步引擎升级 | UX & Sync Engine Improvements

### 🇨🇳 中文

#### 🐛 修复
- **修复新手引导提示框被遮挡**：在小窗口/PC 端，引导工具提示可能溢出屏幕边界导致按钮不可见。现在采用精确的边界检测算法（考虑 CSS transform 偏移），确保提示框始终完整显示在视窗内
- **修复作品信息面板闪烁**：关闭面板时不再卸载组件，改用 `display: none` 保持 DOM 状态，消除重新打开时的渲染闪烁

#### 🔄 同步引擎改进
- **云端拉取智能合并**：当本地和云端都有数据时，不再简单跳过。对基于 ID 的数组（章节、设定节点等），按 `id` + `updatedAt` 逐条比较，只合入云端更新的条目，保留本地新增内容
- **解决多设备编辑数据丢失**：跨设备切换时，之前未同步的本地改动不再被忽略

#### 🔒 安全加固
- **发版流程新增移动端泄漏扫描**：自动扫描已追踪文件和暂存区，防止私有移动端代码意外混入开源仓库
- **`.gitignore` 补充规则**：新增 `.gemini/` 排除，避免 AI 工具本地配置被提交

---

### 🇬🇧 English

#### 🐛 Fixes
- **Fix onboarding tour tooltips clipped off-screen**: On small windows/PC, tour tooltips could overflow viewport boundaries, making navigation buttons invisible. Now uses precise boundary detection (accounting for CSS transform offsets) to keep tooltips fully visible
- **Fix BookInfo panel flicker**: Panel now uses `display: none` instead of unmounting, eliminating re-render flash on reopen

#### 🔄 Sync Engine Improvements
- **Smart merge on cloud pull**: When both local and cloud have data, ID-based arrays (chapters, setting nodes, etc.) are now merged item-by-item using `id` + `updatedAt` comparison. Only newer cloud entries are merged in, preserving local additions
- **Fix data loss on multi-device editing**: Previously unsynced local changes are no longer silently skipped when pulling from cloud

#### 🔒 Security Hardening
- **Release workflow now includes mobile asset leak scan**: Automatically scans tracked files and staging area to prevent private mobile code from accidentally entering the open-source repository
- **`.gitignore` updates**: Added `.gemini/` exclusion to prevent AI tool local config from being committed
