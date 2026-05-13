## v1.2.28 — 增强安卓端下载入口与活跃统计

### 中文

#### 安卓端下载入口

- 在网页、Vercel 部署和桌面端顶栏新增醒目的“安卓端 APK”入口
- 下载弹窗提供安卓 APK 二维码、直接下载按钮、Release 页面入口、QQ 群链接和 QQ 群二维码
- 二维码会解析 GitHub 最新 Release 中真实的 Android APK 文件，避免跳到未部署接口导致 404
- 弹窗明确标注安卓端支持云同步、离线使用、时间线和关系图谱功能
- 调整顶栏弹窗层级，避免被编辑器工具栏遮挡

#### 发布与构建稳定性

- 移动端发布 workflow 增加 `author-mobile-latest.apk` 别名产物，后续可用于固定下载入口
- Electron 打包排除 `dist-*` 临时构建目录，避免失败构建残留混入安装包

#### 使用统计

- 登录后会发送每日活跃心跳，用于统计 Web / 桌面端活跃情况
- Firebase Analytics 在桌面端也可初始化，便于统一统计多端访问

本次发布包含 Windows 安装包；Android APK 由移动端私有仓库构建后上传到同一 GitHub Release。

---

### English

#### Android Download Entry

- Added a prominent Android APK entry to the web app, Vercel deployments, and the desktop client header
- The download popover now includes an Android APK QR code, direct download button, Release link, QQ group link, and QQ group QR code
- The QR code resolves the real Android APK asset from the latest GitHub Release, avoiding 404s caused by undeployed app routes
- The popover now clearly states that the Android app supports cloud sync, offline use, timeline, and relationship graph features
- Raised the popover layer so it is no longer covered by the editor toolbar

#### Release And Build Reliability

- The mobile release workflow now also uploads an `author-mobile-latest.apk` alias for future fixed download links
- Electron packaging excludes temporary `dist-*` build folders to keep failed build leftovers out of installers

#### Activity Analytics

- Signed-in sessions now send a daily activity heartbeat for Web and desktop usage statistics
- Firebase Analytics can initialize in the desktop client, improving multi-platform analytics coverage

This release includes the Windows installer. The Android APK is built from the private mobile repository and uploaded to the same GitHub Release.
