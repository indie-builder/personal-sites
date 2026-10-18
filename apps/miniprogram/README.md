# 陈远小站 · 微信小程序

参考 [iOS 客户端](../../ios/README.md) 的原生微信小程序：五栏目信息流、详情阅读、流式问一问、独立作品集浏览与关于我。使用 TypeScript、WXML、WXSS 和微信原生导航；业务 I/O 与公开响应校验使用项目固定的 Effect，不引入跨端 UI 框架。实际检查结果与平台缺口见[交付记录](DELIVERY.md)，本端设计约定见 [DESIGN.md](DESIGN.md)。

## 开发

需要仓库规定的 Bun `1.4.3` 和 Node.js `>=24.21.0 <25`，以及微信开发者工具。仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run --filter @site/miniprogram build
```

在微信开发者工具中导入 **`apps/miniprogram`**，不是 `dist`。`project.config.json` 已将 `miniprogramRoot` 指向构建结果 `dist/`。修改源码后重新构建，再在工具中编译。生成文件、个人工具配置和 LoopX 执行状态不提交。

Bun 运行构建脚本，esbuild 直接生成微信预览打包可解析的 ES2018 CommonJS 包，并保留运行环境支持的原生 BigInt。构建上下文、临时目录和模板编译器进程由 Effect 作用域管理，取消时清理。保持项目配置中的 `es6: false`、`enhance: false`、`minified: false`，不再启用微信的 ES5 转换或重复压缩：额外的 Babel 降级会把 Effect 的 BigInt 幂运算转成 `Math.pow`，而旧压缩器不接受可选链、空值合并等现代语法。

项目配置里的 `touristappid` 只是公开占位符，不能上传，也不保证当前开发者工具允许游客模式。打开项目时填入自己的小程序 AppID；个人 AppID 可以放在被忽略的 `project.private.config.json`，不提交凭据、工具 ticket 或账号资料。若工具要求登录，先在开发者工具中扫码。

```json
{
  "appid": "你的小程序AppID"
}
```

主站默认连接 `https://default-coder.lovemyrmb.cn`，作品集连接 `https://portfolio.default-coder.lovemyrmb.cn`。两者均为无鉴权公开读取面。小程序不需要服务端模型密钥、Supabase 密钥、微信 AppSecret，也不打包 SQLite 或本地原始资料。

## 功能与平台取舍

| 功能 | 小程序行为 |
| --- | --- |
| 动态 | 每日动态、每日关注、设计收藏、抖音收藏、开源关注；横栏与栏目总菜单、独立分页与阅读位置、下拉刷新、失败恢复 |
| 详情 | 原生返回、导读与来源摘录、单图完整阅读／多图预览、按来源比例播放视频、来源和完整网页的复制入口 |
| 问一问 | 文本 SSE、检索范围、停止、重试、新对话确认、正文引用与原生资料阅读；多行草稿、表格和基础 Markdown；切 tab 保留会话和草稿 |
| 作品集 | 读取独立作品集 API；带数量的布局分类入口、图片集合、搜索/分类/主题/分页与详情；在已加载结果内连续阅读并显示集合真实序号；工具目录与网站介绍使用原生子页面 |
| 关于我 | 复用公开身份、介绍和经历；GitHub、语雀等外部链接通过明确按钮复制 |
| 外链 | 使用微信剪贴板复制链接，用户在浏览器打开；不假设任意第三方域名可用 `web-view` |
| 导航与外观 | 四项原生 tabBar、系统返回、安全区、黑白阅读流；深浅色跟随系统；轻量按压、履历展开、作品追加与问答状态反馈 |
| 减少动态效果 | 关于页开关保存在本机，跨页面生效；同时响应 WebView 系统偏好样式。具体动效取舍和验证见 [MOTION.md](MOTION.md) |

策展、设计、抖音和开源接口当前只有列表投影，没有按 ID 的 JSON 详情。小程序复用列表数据阅读；分享这些内容时回到相应栏目，避免生成冷启动失效的详情链接。每日动态和作品集拥有按 ID 接口，可以重新获取详情。完整策展解析仍可通过复制站点链接阅读。

问答按现有 `POST /api/ask` 的 `format: "text"` 协议消费 `text → sources → done`。请求通过 `wx.request(enableChunked)` 接收，支持跨块 UTF-8 中文、表情和 SSE 帧。停止会取消底层请求；不会自动重试模型调用。访客随机标识存于本机，仅用于匿名问答上下文；问题和回答由现有服务器会话策略处理。聊天内容和草稿仅在当前进程保留，不做额外本地历史库。

构建只复制明确列出的 WXML/WXSS/JSON、现有公开头像和原创导航图标，并生成一个共享业务模块和页面 JS；检查主包不超过 2 MiB。列表向视图传递展示字段，问答来源全文留在控制器；分页和流式更新按变化路径提交，避免整段历史重复传输。`src/encoding.ts` 在共享模块之前补齐老版本 AppService 缺失的 UTF-8 编解码器；网络适配使用微信 RequestTask 取消，不依赖浏览器 fetch、EventSource 或 AbortController。

## 验证

```bash
# 已接入根目录同名 Turbo 任务
bun run typecheck
bun run lint
bun run test
bun run build

# 小程序专项
bun run --filter @site/miniprogram test:e2e
bun run --filter @site/miniprogram check:templates
```

默认 `test` 会先构建当前源码再执行单测，产物缺失时不会跳过构建契约。`test:e2e` 的定位是 **构建产物的 AppService 契约回归**：在受限 JS 环境中加载实际 CommonJS 包、模拟微信平台 API，验证真实页面生命周期与公开 HTTP/SSE 契约。固定内容是测试夹具，不进入产品。它不等同于微信模拟器、真机或发布验收。

`check:templates` 调用本机微信开发者工具的真实 `wcc` 和 `wcsc` 编译器，无需线上模型或数据库。macOS 默认读取 `/Applications/wechatwebdevtools.app`；其他安装位置用 `WECHAT_COMPILER_ROOT` 指向含 `wcc`/`wcsc`（Windows 为 `.exe`）的目录。不在仓库分发平台编译器。

2026-10-18 已使用本地测试账号 AppID 和有效登录打开微信模拟器：首页成功读取 50 条内容，问一问初始界面与作品集四项入口正常渲染；修复编译降级和原生按钮默认宽度后，未见运行错误。这次检查未覆盖真机、生产模型问答、完整窄屏/深色/横屏验收或上传发布。

有效 AppID 和登录就绪后，可使用安装工具的 CLI 做模拟器检查：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project "$PWD/apps/miniprogram"
```

依次验证栏目切换与触底、下拉刷新、详情返回、图片预览与视频、问答输入和来源返回、作品集搜索与筛选；覆盖 320px/390px、横屏、深色和微信字体放大。检查控制台与网络错误。真实模型问答会调用现有生产服务，只做必要的单次冒烟，失败测试使用夹具。

## 正式发布前

1. 使用真实 AppID、有效开发者身份与微信登录，完成小程序主体、名称、服务类目及所需备案。是否允许个人主体、AI 问答或外部内容展示，以微信后台实际审核要求为准。
2. 在微信后台配置 HTTPS **request 合法域名**：`default-coder.lovemyrmb.cn` 与 `portfolio.default-coder.lovemyrmb.cn`。发布环境保持域名校验开启；本地关闭校验不能作为发布证据。
3. 核对公开响应中的图片、视频和重定向目标域名。当前包含第三方直连媒体；本次作品集读取观察到 `cdn.jsdelivr.net`、`pbs.twimg.com`、`cdn.collectui.com`、`cdn.bestdesignsonx.com`、`media.inspora.design` 和作品集域名。此列表不是全库媒体域名的完整清单；按实际资源配置平台所需的媒体/下载域名，真机验证可达性。X 视频只使用现有 `/api/x-media` 受限代理，不新增任意 URL 代理。
4. 根据实际匿名会话与剪贴板等能力完成微信隐私保护指引和必要声明。禁止在客户端放服务端凭据，不增加设备指纹或登录授权。
5. 在 iOS 与 Android 微信真机上，开启合法域名校验，验证 SSE 中文分块、停止/后台中断、输入法与键盘安全区、媒体预览和外部来源复制。确认独立作品集接口已部署并可访问。
6. 在开发者工具上传体验版，完成真机验收后提交微信审核并发布。仓库代码和本地构建通过不代表已上传、审核或发布。

头像来源：复用本仓库 `ios/ChenYuanSite/Assets.xcassets/profile_avatar.imageset/profile_avatar.png`，构建时复制为 `dist/assets/avatar.png`，不生成替代头像。视觉沿用根 [DESIGN.md](../../DESIGN.md) 与 iOS 字号/间距；不移植玻璃底栏、强制开屏或装饰性逐帧动画。
