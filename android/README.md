# 陈远小站 · Android

「陈远｜运行中的工程档案」的安卓客户端，Kotlin + Jetpack Compose 原生实现。复刻站点移动端的信息流阅读体验：顶部五个栏目、原生详情页、底部磨砂玻璃身份栏与「问一问」流式问答。

## 功能

- **五个栏目**：每日动态 / 每日关注 / 设计收藏 / 抖音收藏 / 开源关注，顶部横滑 Tab + 页面滑动，下拉刷新、触底加载（分页契约与站点客户端一致：动态每页 50，其余 20，按 id 去重）。
- **原生详情**：每日动态走 `GET /api/ai-news/[id]`；每日关注、设计收藏、抖音收藏直接渲染列表携带的全文与媒体（图片网格 + ExoPlayer 视频，X 平台视频经站内 `/api/x-media` 代理）；开源关注为轻详情，仓库浏览跳站点网页。
- **底部磨砂玻璃栏**：GitHub / 语雀 / 作品集（Chrome Custom Tabs）+ 关于我（原生履历小票）。
- **问一问**：`POST /api/ask` SSE 流式问答，答案附来源，429 限流有中文提示。
- 深浅色跟随系统；minSdk 31（Android 12+，磨砂 RenderEffect 全覆盖）。

## 数据源

只读站点公共 GET API（`https://default-coder.lovemyrmb.cn`），无需鉴钥；不直连 Supabase、不读敏感本地数据。接口契约见仓库根 `docs/` 与 `lib/paginated-route.ts`。

## 构建与运行

要求：JDK 17+、Android SDK（compileSdk 35）。

```bash
cd android
./gradlew :app:assembleDebug        # 构建 APK：app/build/outputs/apk/debug/
./gradlew :app:installDebug         # 安装到已连接设备/模拟器
```

- `gradle.properties` 里 `org.gradle.java.home` 指向本机 JDK 17 路径，换机器需调整。
- `local.properties` 由 Android Studio 生成（`sdk.dir`），不入库。

## 工程结构

```
app/src/main/java/cn/lovemyrmb/personalsite/
├── MainActivity.kt / SiteApplication
├── AppContainer.kt            # 手写轻量 DI：JSON/OkHttp/Retrofit/访客 id
├── data/                      # 模型、Retrofit 接口、分页 PagedFeed、AskClient(SSE)
└── ui/
    ├── theme/                 # 站点黑白灰单色体系（DESIGN.md 令牌）
    ├── home/                  # 五栏目 Tab + Pager + 三类信息流行
    ├── detail/                # 三种详情页
    ├── about/                 # 履历小票 Sheet
    ├── ask/                   # 问一问对话 Sheet
    └── components/            # 视频卡、时间工具、Custom Tabs
```
