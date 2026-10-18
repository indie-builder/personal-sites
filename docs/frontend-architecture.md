# 当前前端框架与布局对齐

> 基线：2026-08-09 ｜ 对应视觉规范：[DESIGN.md](../DESIGN.md)

本文件描述当前已落地的页面骨架与组件职责。新增页面或改动现有页面时，以这份结构为准；不再按旧知识库/工作台方案扩展。

## 页面骨架

```text
根路由（`apps/web/src/routes/__root.tsx`）
├─ OpeningLoader（全屏遮罩，每个浏览器会话的首次完整页面加载播放）
└─ 路由页面
   ├─ /                         首页（CDN 缓存，s-maxage = 60）
   │  ├─ Profile rail（sticky，位于数据 Suspense 外）
   │  └─ 右侧每日动态列表（保留 Suspense 边界）
   ├─ /ai-news                  每日动态版块（CDN 缓存，s-maxage = 60）
   ├─ /curation                 每日关注版块（仅 X 来源，CDN 缓存，s-maxage = 300）
   ├─ /design                   设计收藏版块（X 高置信设计相关内容，CDN 缓存，视频站内播放）
   ├─ /design/[id]              设计收藏详情（CDN 缓存，复用策展详情骨架与设计子集相邻导航）
   ├─ /douyin                   抖音收藏版块（仅抖音来源，CDN 缓存，s-maxage = 300）
   ├─ /open-source              开源关注版块（CDN 缓存，s-maxage = 300）
   │  ├─ Profile rail（与首页相同）
   │  └─ 内容导航 + 公开资料问答（个人简介、每日关注、开源关注）
   ├─ /feed.xml                 最近公开内容的 RSS 2.0 聚合
   ├─ /sitemap.xml              栏目与公开详情页索引
   ├─ /robots.txt               搜索引擎抓取规则
   ├─ /api/health/data          全部公开数据面与部署修订的统一健康状态
   ├─ /curation/[id]            详情页（CDN 缓存，s-maxage = 300）
   │  ├─ Profile rail（与首页相同）
   │  └─ Curation article
   │     ├─ Back navigation
   │     ├─ Metadata / title / summary / tags
   │     ├─ Original source and media
   │     ├─ Markdown analysis
   │     └─ Source links
   └─ /open-source/[slug]       开源详情页（CDN 缓存，s-maxage = 300）
      ├─ Profile rail（与首页相同）
      └─ 文档版本切换为客户端状态，中文阅读版服务端渲染
```

首页与每日动态版块由 TanStack Start 路由 loader 通过 `createServerFn`（`apps/web/src/functions/content.ts`）读取数据，合并 SQLite 历史与 Supabase 增量。loader 在服务端与浏览器端都会执行，SQLite / Supabase 读取只允许经过 server functions。页面响应由各路由的 `headers()` 声明 CDN `Cache-Control`：`public, s-maxage=N, stale-while-revalidate=86400`（见 `apps/web/lib/page-cache.ts`）。CDN 命中时直接返回缓存页面，无需等待数据读取；超过 `s-maxage` 后，下一次请求仍返回旧页面并触发后台再验证，成功后后续请求使用新页面。`s-maxage` 是 CDN 新鲜期，不是内容陈旧时间的上限。两页保留数据 Suspense 边界与加载状态。分页 API 沿用自身的 `PUBLIC_FEED_CACHE_CONTROL`（`s-maxage=300`、`stale-while-revalidate=600`），不受页面缓存头控制。

| 区域 | 主文件 | 责任 | 不应承担的责任 |
|---|---|---|---|
| 全局壳 | `apps/web/src/routes/__root.tsx` | metadata、全局 CSS、Loading 注入 | 路由内容或业务数据 |
| 首页 | `apps/web/src/routes/index.tsx` | 稳定输出身份轨、刊头与每日动态列表，保留数据 Suspense 边界 | 详情内容渲染；在数据 Suspense fallback 中复制身份轨或刊头 |
| 版块页 | `apps/web/src/routes/ai-news/index.tsx`、`apps/web/src/routes/curation/index.tsx`、`apps/web/src/routes/design/index.tsx`、`apps/web/src/routes/douyin.tsx`、`apps/web/src/routes/open-source/index.tsx` | 带 CDN 页面缓存头的单版块列表页，复用身份轨与刊头 | 第二套侧栏语言 |
| 详情页 | `apps/web/src/routes/curation/$id.tsx`、`apps/web/src/routes/design/$id.tsx` | 条目元信息、原文、媒体、解析、来源；设计上下文使用独立静态路径，避免把筛选上下文放入请求期 query | 第二套个人侧栏 |
| Loading | `apps/web/components/opening-loader.tsx` | 加载阶段、滚动锁定、向上揭幕；每个浏览器会话仅首次播放，水合后移除 | 常规页面配色 |
| 个人简介 | `apps/web/components/profile-introduction.tsx`、`apps/web/components/profile-typewriter.ts`、`apps/web/components/growing-paragraph.tsx` | 双语逐字输入/删除、正文高度过渡与多语言标题轮换 | 静态履历数据源 |
| 内容导航 | `apps/web/components/site-section-navigation.tsx` | 统一内容入口（每日动态、每日关注、设计收藏、抖音收藏、开源关注）的路由跳转与当前页面状态；导航即栏目页头，不重复显示标题与说明 | 外部链接或同页 Tab 语义 |
| 技术信号场 | `apps/web/components/interactive-dot-field.tsx` | AI 术语与技术栈词库、稀疏视觉表达 | 标签过滤或导航 |
| 策展数据 | `apps/web/lib/curation.ts` | Effect Schema 校验、Effect 查询、日期格式化 | 页面布局、问答检索 |
| 本地问答检索 | `apps/web/lib/curation-search.server.ts` | 公开 SQLite 语料缓存、全文匹配与排序 | 策展页面查询 |
| 公开发现 | `apps/web/lib/discovery.server.ts` | 汇总公开 SQLite 与 Supabase，生成 Sitemap/RSS 数据 | 私有原始资料或运行时写入 |
| 数据健康 | `apps/web/src/routes/api/health/data.ts` + `packages/public-data/src/data-health/status.mjs` | 汇总远端同步状态与本地公开投影，通过一个接口应用新鲜度规则 | 数据抓取、自动修复或暴露私有洞察 |

统一健康状态会执行 SQLite `quick_check`，并按 `rowid` 双向核对 `ask_documents` 与 FTS5，而不是只比较总数；数据库损坏、缺失索引行或孤儿索引行都会让健康端点返回 503。

“问一问”的本地 FTS 语料由公开个人简介、每日关注和开源关注派生；每日动态合并 SQLite 历史与 Supabase 增量检索。完整问题、拆词结果与不同来源使用排名融合后统一取前六条，并由固定公开语料评测集验证召回。AI SDK 将本轮资料包、历史问答与可选的历史摘要发送给智谱；历史达到 64,000 字符时自动总结较早轮次，保留最近四轮原文。流式结果沿用站点 SSE 协议：Web 请求带 `format: "openui"`，文本 delta 累积为 OpenUI Lang；原生端不传 format，继续使用现有文本输出。官方组件提示词由 `node apps/web/scripts/generate-openui-prompt.mjs` 生成到 `ask-openui-prompt.json`，升级 OpenUI 后同步再生成，避免服务端运行时加载客户端组件。默认组件按钮可继续提问，Tabs 等局部交互由 OpenUI 管理；未接入模型 Query/Mutation 工具。旧浏览器文字快照只在恢复时一次性包入 TextContent，保留历史和草稿。Pi 只用于离线资料解析。请求限流在 Supabase 中按 IP 的 HMAC 摘要原子计数，所有 Vercel 实例共享 10 分钟 50 次的窗口；浏览器不持有 service-role key。

## 交付与移动浏览器

Web 是主要产品，Android 与 iOS 客户端的实现和验证见各自 README。Web 的 320px 与 390px 窄屏、手机横屏均使用同一套路由和数据。列表导航可横滑并保持当前项可见；筛选、导航与详情返回链接提供至少 44px 的触达区域。问答组合器依据可用视口高度排布，输入字号 16px，支持浏览器键盘引发的内容视口缩放，并保留用户缩放能力。

## 桌面布局契约

```text
┌──────────────────── identity rail ────────────────────┬──────── content flow ────────┐
│ avatar · name · GitHub · technical signal · profile    │ curation list / article       │
│ sticky, 100dvh, 30px padding                            │ continuously divided rows      │
└────────────────────────────────────────────────────────┴─────────────────────────────┘
```

| 选择器 | 当前规则 | 对齐要求 |
|---|---|---|
| `.curation-home` | 两栏 Grid；左栏最小 `28rem`、最大 `38vw` | 新首页内容不得破坏此列关系 |
| `.curation-home__profile` | `sticky`、`100dvh`、`1.875rem` padding | 首页与详情页必须视觉一致 |
| `.curation-home__feed` | 最大 `50rem`，右侧连续流 | 使用行与行分隔，不包卡片 |
| `ContentSectionNavigation` | 每日动态、每日关注、设计收藏、抖音收藏、开源关注共享等权内容入口；导航即栏目页头 | 使用站内链接与 `aria-current`，不得伪装为同页 Tab |
| `.curation-detail__article` | 最大 `50rem`，承接右栏阅读 | 详情结构沿用首页的留白与分隔节奏 |
| `.curation-home__bio` | `width: 100%` | 简介正文撑满身份轨，不再限制 `max-width` |
| `.interactive-dot-field` | `11.5rem` 高点阵画布 | AI 术语 12 词 + 技术栈 25 词按 6 条单动画轨道滚动，每条轨道以双序列无缝循环和大间距维持约 12 个同屏词；参数按泳道确定性内联，reduced-motion 收为 3×4 静态网格 |

`900px` 以下收为单列；`560px` 以下策展元信息转为同一行。此项目的评审重点仍是桌面版，两栏首屏优先。

## 视觉与交互对齐

| 主题 | 现状 | 约束 |
|---|---|---|
| 色彩 | 页面主体是黑白灰；绿色仅在 Loading | 禁止在内容页新增黄、绿或渐变点缀 |
| 层级 | 细线 + 留白 + 字重 | 禁止卡片网格、装饰阴影和玻璃效果 |
| 技术感 | 等宽技术节点 + 低幅运动效 | 禁止把页面正文全面等宽化 |
| 简介 | 英文输入、删除、空光标两次、中文输入；完成后标题轮换多语言问候语 | `prefers-reduced-motion` 下保留最终中文状态，不进入轮换 |
| 流式内容 | 双列登记簿行（元信息列 + 内容列），窄屏收为单列；hover 只更新标题颜色 | 禁止 hover 变卡片或填充色块 |
| 主题 | 仅浅色（`color-scheme: light`），无切换控件 | 不新建深色样式或主题切换入口 |

异步业务逻辑与 I/O 默认使用 Effect，开发约定与平台边界见 [Effect 开发规则](effect-architecture.md)。

## 变更准则

1. 新增页面先决定它属于“右栏内容流”还是“详情文章”；默认复用身份轨。
2. 新增组件先检查 `DESIGN.md` 的组件与禁用项；能用分隔线解决的层级，不新增卡片容器。
3. 新增动效必须具备终态、可中断清理和 reduced-motion 方案；动效不能把正文留在空白状态。
4. 调整左栏文本时同时检查可用宽度、长文本换行和词节点碰撞；不能只看单一静态截图。
5. 详情页若新增内容区，只能接在文章顺序中，并继续使用 `.curation-detail__section` / `.curation-detail__sources` 的分隔结构。

## 动效技术分层

修改角色入场与行走、问答抽屉开合、正文高度或动画技术选型时，阅读[动效与助手实现](frontend/motion.md#动效技术分层)，包含测量、焦点恢复、清理与 reduced-motion 契约。

## 当前对齐结论

- 首页和详情页均采用同一左侧身份轨，避免旧版详情页回退为独立工作台。
- 桌面左侧个人资料是首页锚点，右侧默认显示每日动态；移动端把个人资料展开为默认首页，导航置于身份区与内容区之间，并在内容页随紧凑身份区固定。移动端内容 Grid 必须从顶部自然排布，避免少量内容拉伸身份区与内容区之间的间距。每日动态、每日关注、抖音收藏、开源关注不再重复显示栏目标题或摘要。
- 动效分工保持克制：Loading、技术信号场和双语简介分别承担揭幕、环境与叙事。首访内容揭幕由 `SectionMotionLifecycle` 私有实现；同级栏目直接提交路由，移动端首页与内容页之间保留身份轨桥接；`prefers-reduced-motion` 下即时完成。
- 点描头像的输入、十段冒险、可见时钟与回归覆盖见[点描头像](frontend/motion.md#点描头像)。
- 手机首页与内容页间的身份轨过渡、临时覆盖层及清理契约见[手机身份桥接](frontend/motion.md#手机身份桥接)。
- 策展内容已从卡片选择器收敛为默认信息流；详情页继承同样的排版语法。
- 开源关注的主题筛选与每日关注共用右侧单选菜单样式，工具栏左侧显示当前结果的项目数，菜单保留各主题的全库计数；当前项由勾选与触发器文字表达，小屏菜单限制在视口内。筛选仍对已载入的完整公开仓库集合执行。
- Loading、技术信号、双语简介属于身份轨的三种不同时间尺度的动效，分别为每会话一次的揭幕、环境信号、个人叙事；它们不应扩散到右侧内容流。
- 旧知识库、语雀同步、表格工作区及相关框架不再属于当前前端信息架构。

## 2026-09-08 设计工程更新

- 同级栏目链接直接提交 TanStack Router 路由，键盘导航不经过退出动效；手机身份展开/收拢保留现有桥接。之前描述的桌面淡入换页已被这一规则取代。
- 问答输入统一 16px，主要控件统一 44px。
- `apps/web/components/route-fallbacks.tsx` 为缺失页面提供共享身份轨与真实阅读出口。


## 2026-09-09 构建功能下线

已删除 `/works` 与详情路由、项目样张和灯箱、项目采集发布脚本、SQLite 项目快照以及对应 Ask 索引。导航、RSS、Sitemap、健康检查与向量索引不再包含项目档案；旧路由直接返回 404。
