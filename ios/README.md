# 陈远小站 · iOS 客户端

「陈远小站」的原生 iOS 客户端，业务逻辑与 `android/`（Kotlin + Jetpack Compose）对齐：
五栏目信息流、三种详情页、问一问（SSE 流式问答 + 应用内引用阅读）、个人介绍页与开场动画。

## 技术栈

- **Swift 6**（严格并发 + Approachable Concurrency + MainActor 默认隔离）
- **SwiftUI + `@Observable`**（iOS 26+，底栏使用 Liquid Glass `glassEffect`）
- **零第三方依赖**：网络用 `URLSession`（SSE 用 `AsyncBytes` 手工按帧切行），图片用 `AsyncImage`，视频用 `AVPlayer`，Markdown 为自研轻量解析器（`UI/Ask/MarkdownView.swift`，语法范围与安卓端 commonmark 渲染对齐）

## 目录结构

```
ios/
├── ChenYuanSite/
│   ├── ChenYuanSiteApp.swift     # 入口 + 开场覆盖层
│   ├── AppEnvironment.swift      # 手写轻量 DI（API/Ask 客户端/访客 id/跳转载体）
│   ├── Data/                     # Models / SiteAPI / PagedFeed / AskClient / AskController / EntryHolder
│   ├── UI/                       # Theme / RootView(玻璃底栏) / Opening / Home / Detail / Ask / About
│   ├── Assets.xcassets           # App 图标 + 头像
│   └── opening_character.gif     # 开场人物序列（与 Web/安卓同素材）
├── ChenYuanSiteTests/            # Swift Testing 单元测试（分页/去重/失败恢复、SSE 帧、问答状态机、Markdown、时间文案）
└── ChenYuanSiteUITests/          # XCUITest 无障碍回归（栏目 Tab / 底栏选中语义）
```

## 与安卓端的契约对齐

- 同一套站点公共 GET API（`{ hasMore, items }` 分页）与 `POST /api/ask`（SSE），无鉴权
- `PagedFeed` 逐条移植安卓分页语义：按 id 去重、offset=items.count 追加、失败不丢数据、刷新/追加/首屏互斥、首屏重载防重入
- `AskController` 的代次隔离（generation）、空回答兜底文案、取消即 STOPPED 等状态机与安卓一致
- 文案、间距、字号令牌（SiteTheme/SiteText/SiteSpace）取自安卓 `ui/theme/Theme.kt`；深浅色跟随系统
- 行为差异点：外链直接打开 Safari（iOS 无 Custom Tabs）；详情/关于用系统导航返回（保留右滑手势）

## 开发与验证

```bash
# 编译（模拟器）
xcodebuild -project ios/ChenYuanSite.xcodeproj -scheme ChenYuanSite \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' build

# 单元测试（39 例）+ 无障碍 UI 测试（2 例）
xcodebuild -project ios/ChenYuanSite.xcodeproj -scheme ChenYuanSite \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' test

# 安装到已启动的模拟器
xcrun simctl install <UDID> ios/build/Sym/Debug-iphonesimulator/ChenYuanSite.app
xcrun simctl launch <UDID> cn.lovemyrmb.personalsite
```

无触控环境（如 CI 截图）可用启动参数直达页面：

| 参数 | 行为 |
| --- | --- |
| `-route-ask` | 打开问一问 |
| `-route-about` | 打开关于我 |
| `-route-detail` | 拉取每日动态第一条并进入详情 |
| `-ask-demo` | 打开问一问并自动发送「介绍一下陈远」（实测 SSE 链路） |
| `-ask-reset` | `-ask-demo` 基础上，回答开始后再弹出「新对话」确认（验证重置流程） |
| `-skip-opening` | 跳过开场动画（UI 测试/无触控截图用） |

推送含 `ios/` 变更会自动触发 GitHub Actions 跑同一套测试
（`.github/workflows/ios-tests.yml`，macOS runner）。

## 已知边界

- 问一问草稿仅存于内存（与安卓一致，进程死亡不恢复）；安卓的 Ctrl+Enter 发送在 iOS 触屏上无对应项
- 开场 GIF 通过 ImageIO 抽帧播放一次；「减弱动态动态效果」开启时直接跳过开场
- 未做：iPad 专属布局（当前为兼容性自适应）、推送、App Store 图标集细分尺寸（单尺寸 1024）
