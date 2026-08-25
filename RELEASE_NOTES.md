## v1.2.54 — 修复桌面端升级后本地作品不可见

### 中文

#### 桌面端

- 修复从旧版本升级后，本地作品可能暂时显示为空的问题；原有本地作品数据会重新正常显示。
- 固定桌面端本地数据的访问地址，避免地址变化产生新的空白数据空间。
- 当本地服务端口被占用时提供明确提示，不再静默切换端口。

#### Android 端

- 本次仅同步版本号，功能与 v1.2.53 保持一致。

---

### English

#### Desktop

- Fixed an issue where local works could temporarily appear empty after upgrading from an earlier version. Existing local work data is shown normally again.
- Kept the desktop local-data address stable to prevent address changes from opening a separate empty data space.
- Added a clear startup message when the local service port is occupied instead of silently switching ports.

#### Android

- This release only synchronizes the version number; functionality remains unchanged from v1.2.53.
