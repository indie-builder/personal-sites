# 当前前端框架与布局对齐

> 基线：2026-08-09 ｜ 对应视觉规范：[DESIGN.md](../DESIGN.md)

本文件描述当前已落地的页面骨架与组件职责。新增页面或改动现有页面时，以这份结构为准；不再按旧知识库/工作台方案扩展。

## 页面骨架

```text
RootLayout
├─ OpeningLoader（全屏遮罩，每个浏览器会话的首次完整页面加载播放）
└─ 路由页面
   ├─ /                         首页（ISR，revalidate = 60）
   │  ├─ Profile rail（sticky，位于数据 Suspense 外）
   │  └─ 右侧每日动态列表（保留 Suspense 边界）
   ├─ /ai-news                  每日动态版块（ISR，revalidate = 60）
   ├─ /curation                 每日关注版块（仅 X 来源，ISR，revalidate = 300）
   ├─ /design                   设计收藏版块（X 高置信设计相关内容，ISR，视频站内播放）
   ├─ /design/[id]              设计收藏详情（ISR，复用策展详情骨架与设计子集相邻导航）
   ├─ /douyin                   抖音收藏版块（仅抖音来源，ISR，revalidate = 300）
   ├─ /open-source              开源关注版块（ISR，revalidate = 300）
   │  ├─ Profile rail（与首页相同）
   │  └─ 内容导航 + 公开资料问答（个人简介、每日关注、开源关注）
   ├─ /portfolio                作品流，七个产品的连续条目
   ├─ /products/*               作品内页，复用身份轨与作用域样式
   ├─ /api/portfolio/*          Web 与原生客户端共享的作品公开 GET API
   ├─ /api/ai-chat              作品聊天，独立于站点 Ask
   ├─ /feed.xml                 最近公开内容的 RSS 2.0 聚合
   ├─ /sitemap.xml              栏目与公开详情页索引
   ├─ /robots.txt               搜索引擎抓取规则
   ├─ /api/health/data          全部公开数据面与部署修订的统一健康状态
   ├─ /curation/[id]            详情页（ISR，revalidate = 300）
   │  ├─ Profile rail（与首页相同）
   │  └─ Curation article
   │     ├─ Back navigation
   │     ├─ Metadata / title / summary / tags
   │     ├─ Original source and media
   │     ├─ Markdown analysis
   │     └─ Source links
   └─ /open-source/[slug]       开源详情页（ISR，revalidate = 300）
      ├─ Profile rail（与首页相同）
      └─ 文档版本切换为客户端状态，中文阅读版服务端渲染
```

首页与每日动态版块在预渲染和再验证时合并 SQLite 历史与 Supabase 增量。命中页面缓存时，首屏直接使用缓存内容，无需每次请求都等待 Supabase。缓存超过 60 秒后，下一次请求仍返回旧页面，并触发后台再验证；成功后，后续请求使用新页面。60 秒是再验证间隔，不是内容陈旧时间的上限。两页保留数据 Suspense 边界与加载状态。分页 API 沿用自身的 HTTP 缓存策略，不受页面 `revalidate` 配置控制。

| 区域 | 主文件 | 责任 | 不应承担的责任 |
|---|---|---|---|
| 全局壳 | `apps/web/app/layout.tsx` | metadata、全局 CSS、Loading 注入 | 路由内容或业务数据 |
| 首页 | `apps/web/app/page.tsx` | 稳定输出身份轨、刊头与每日动态列表，保留数据 Suspense 边界 | 详情内容渲染；在数据 Suspense fallback 中复制身份轨或刊头 |
| 版块页 | `apps/web/app/ai-news/page.tsx`、`apps/web/app/curation/page.tsx`、`apps/web/app/design/page.tsx`、`apps/web/app/douyin/page.tsx`、`apps/web/app/open-source/page.tsx` | 单版块的 ISR 列表页，复用身份轨与刊头 | 第二套侧栏语言 |
| 详情页 | `apps/web/app/curation/[id]/page.tsx`、`apps/web/app/design/[id]/page.tsx` | 条目元信息、原文、媒体、解析、来源；设计上下文使用独立静态路径，避免 ISR 页面读取请求期 query | 第二套个人侧栏 |
| Loading | `apps/web/components/opening-loader.tsx` | 加载阶段、滚动锁定、向上揭幕；每个浏览器会话仅首次播放，水合后移除 | 常规页面配色 |
| 个人简介 | `apps/web/components/profile-introduction.tsx`、`apps/web/components/profile-typewriter.ts`、`apps/web/components/growing-paragraph.tsx` | 双语逐字输入/删除、正文高度过渡与多语言标题轮换 | 静态履历数据源 |
| 内容导航 | `apps/web/components/site-section-navigation.tsx` | 统一内容入口（每日动态、每日关注、设计收藏、抖音收藏、开源关注）的路由跳转与当前页面状态；导航即栏目页头，不重复显示标题与说明 | 外部链接或同页 Tab 语义 |
| 技术信号场 | `apps/web/components/interactive-dot-field.tsx` | AI 术语与技术栈词库、稀疏视觉表达 | 标签过滤或导航 |
| 策展数据 | `apps/web/lib/curation.ts` | Effect Schema 校验、Effect 查询、日期格式化 | 页面布局、问答检索 |
| 本地问答检索 | `apps/web/lib/curation-search.server.ts` | 公开 SQLite 语料缓存、全文匹配与排序 | 策展页面查询 |
| 公开发现 | `apps/web/lib/discovery.server.ts` | 汇总公开 SQLite 与 Supabase，生成 Sitemap/RSS 数据 | 私有原始资料或运行时写入 |
| 数据健康 | `apps/web/app/api/health/data/route.ts` + `packages/public-data/src/data-health/status.mjs` | 汇总远端同步状态与本地公开投影，通过一个接口应用新鲜度规则 | 数据抓取、自动修复或暴露私有洞察 |

统一健康状态会执行 SQLite `quick_check`，并按 `rowid` 双向核对 `ask_documents` 与 FTS5，而不是只比较总数；数据库损坏、缺失索引行或孤儿索引行都会让健康端点返回 503。

“问一问”的本地 FTS 语料由公开个人简介、每日关注和开源关注派生；每日动态合并 SQLite 历史与 Supabase 增量检索。完整问题、拆词结果与不同来源使用排名融合后统一取前六条，并由固定公开语料评测集验证召回。AI SDK 将本轮资料包、历史问答与可选的历史摘要发送给智谱；历史达到 64,000 字符时自动总结较早轮次，保留最近四轮原文。流式结果沿用站点 SSE 协议：Web 请求带 `format: "openui"`，文本 delta 累积为 OpenUI Lang；原生端不传 format，继续使用现有文本输出。官方组件提示词由 `node apps/web/scripts/generate-openui-prompt.mjs` 生成到 `ask-openui-prompt.json`，升级 OpenUI 后同步再生成，避免服务端运行时加载客户端组件。默认组件按钮可继续提问，Tabs 等局部交互由 OpenUI 管理；未接入模型 Query/Mutation 工具。旧浏览器文字快照只在恢复时一次性包入 TextContent，保留历史和草稿。站点问一问继续使用 AI SDK。迁入的独立作品 `/products/ai-chat` 通过 Pi 提供 `/api/ai-chat`，与 Ask 的接口、历史和检索隔离。请求限流在 Supabase 中按 IP 的 HMAC 摘要原子计数，所有 Vercel 实例共享 10 分钟 50 次的窗口；浏览器不持有 service-role key。

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
| 深色模式 | 替换黑白灰令牌 | 不新建独立暗色品牌风格 |

异步业务逻辑与 I/O 默认使用 Effect，开发约定与平台边界见 [Effect 开发规则](effect-architecture.md)。

## 变更准则

1. 新增页面先决定它属于“右栏内容流”还是“详情文章”；默认复用身份轨。
2. 新增组件先检查 `DESIGN.md` 的组件与禁用项；能用分隔线解决的层级，不新增卡片容器。
3. 新增动效必须具备终态、可中断清理和 reduced-motion 方案；动效不能把正文留在空白状态。
4. 调整左栏文本时同时检查可用宽度、长文本换行和词节点碰撞；不能只看单一静态截图。
5. 详情页若新增内容区，只能接在文章顺序中，并继续使用 `.curation-detail__section` / `.curation-detail__sources` 的分隔结构。

## 动效技术分层

角色当前起点改为“十余年……”正文第一行左端：入口绝对定位在第一段的行面上，标题不再承载角色轨道；行走路径只包含正文行。首次入场、末行循环和关闭问答后的重新冒头都从正文起点开始。

关闭问答的角色恢复顺序：先恢复个人轨，此时角色仍隐藏且不可点击；重置到正文第一行起点，重新播放冒头入场，落定后恢复焦点并开始行走。只有指针悬停暂停移动，程序归还焦点不视为悬停，避免关闭后永久停住；减少动态效果直接进入静态可用状态。

问答开合不再逐帧动画整页 width/clip-path。每次仅切换一次最终布局，再以一次前后位置测量驱动阅读流的 transform/opacity 过渡；关闭开始即恢复个人轨并淡入，画布滚动锁在面板退出后释放。中断时从当前可见位置续接，临时 will-change 在结束和卸载时清理。回归测试限制单次开合只能观察到起止两种画布宽度，避免重新引入整页逐帧重排。

问答展开时隐藏左侧完整个人信息轨，并让原阅读流在剩余画布内居中；右侧继续显示聊天。关闭后恢复双栏身份轨、个人轨滚动位置与触发焦点。个人轨仅通过 CSS 隐藏，不卸载助手状态，保证挂载到 body 的聊天区继续工作。

抽屉聊天的欢迎轨道与文字共用 CSS 内容宽度，两者居中同轴并保持 10px 间距。Web 问答统一由 `@openuidev/react-lang` Renderer 和 `@openuidev/react-ui` 官方默认 `openuiLibrary` 渐进渲染，普通文字同样通过默认 TextContent；没有第二套 Markdown 渲染器或自定义组件目录。ThemeProvider 将默认正文、紧凑标题调整为 13px / 14px 并跟随站点深浅色，引用为 12px。回答结束后才显示默认折叠的“参考资料 · N 篇”，访客点击原生 details/summary 后展开来源列表，避免多篇引用挤占回答区域。抽屉使用独立的原生 textarea 组合器：12px 圆角、两侧和底部 18px 外距、30px 圆形上箭头（44px 点击范围），手机输入字号 16px；宽度变化后的高度调整在下一帧执行，避免 ResizeObserver 循环。建议和组合器不使用装饰阴影。抽屉统一检索全部公开资料，独立问答路由及其范围、清空控件已删除；会话快照仅在实例初次恢复时读取，不覆盖正在生成的回答。

助手入场由简介完成状态控制：英文输入 → 英文删除 → 中文完整输出之前不挂载入口；完成后通过独立的 480ms 冒头动画入场，动画落定后才解锁步行与点击。减少动态效果时直接显示可用终态，卸载时取消入场动画。

助手坐标稳定性：问候标题使用固定 8rem 占位，语言轮换不能改变角色的坐标原点。步行轨道仅在真实宽高变化时重新对齐；hover、可见性和暂停恢复保留当前空间位置，不能将进行中的跳跃拉回上一行。`apps/web/e2e/assistant-motion.e2e.ts` 覆盖标题变宽、跳跃被取消以及首跳实际下降和落地回弹的顺序。

像素助手入口不显示常驻感叹号，仅 hover/focus 显示聊天提示。简介完成打字后，`ProfileTextLines` 按浏览器实际换行拆出独立可动画行；入口沿行走到底后交替方向跳到下一行，对落点行播放 4px 下压回弹，末行淡出返回正文第一行。聊天欢迎区仍随机漫步。尺寸变化重新测量路径，减少动态效果时回到正文起点静止，所有移动与落地动画在卸载时取消。

`SiteProfile` 将 `ask-assistant.tsx` 作为插槽传入 `ProfileIntroduction`，定位在“十余年……”正文第一行开头。正文不再通过隐藏副本预留最大高度，而由 `GrowingParagraph` 观察自然内容高度，仅在换行或段落增减时以 220ms 高度过渡推开下文；取消时从当前高度续接，卸载清理 observer 与动画，手机和 reduced-motion 直接落定。角色几何与动作参考 Joey Pescatore 的 Ovid：17px 像素角色随机步进漫步、转身、双帧脚步与悬停暂停。点击后角色先下沉，桌面页面收窄并以圆角露出右侧 420px 的浅灰聊天区，无遮罩；手机聊天区由底部展开。欢迎区角色重新升起并走动，建议按钮直接提交问题。此处按用户指定参考保留浅灰底、白色轻阴影建议与输入框，作为局部视觉例外，不扩散到内容流。`AskChat` 复用公开检索、流式回答、引用和会话快照；关闭恢复入口焦点与页面滚动，Escape 可退出，键盘打开及 reduced-motion 跳过位移。独立 `/ask` 页面已删除，仅保留抽屉问答。

新增动效先归入以下三层之一，不为迁移而迁移：

| 层 | 适用场景 | 现有示例 |
|---|---|---|
| CSS keyframes / transitions | 声明式简单动效、无限循环、hover/focus 过渡 | 进出场 stagger、shimmer、marquee、状态脉冲、开屏 Loading |
| Motion（`motion/react`） | JS 调度的状态驱动动效：值动画、序列、挂载/卸载进出场 | 双语简介打字序列（`profile-introduction.tsx`）、问答消息入场（`ask-chat.tsx`）、身份轨 FLIP 覆盖层飞行与揭幕（`profile-transition-bridge.tsx`） |
| 原生 WAAPI / CSS scroll-driven | 原生 DOM 测量驱动的尺寸过渡、CSS 滚动驱动动效 | 简介正文高度过渡（`growing-paragraph.tsx`） |

约束：

- CSS 能表达的简单动效不引入 Motion；CSS scroll-driven 场景不迁回主线程 rAF。
- Motion 只驱动 transform/opacity/clip-path 及小面积一次性 filter，禁止持续驱动布局属性或大面积绘制属性。
- 各层都必须保留 `prefers-reduced-motion` 终态路径（变更准则 3 不变）。

## 当前对齐结论

- 首页和详情页均采用同一左侧身份轨，避免旧版详情页回退为独立工作台。
- 桌面左侧个人资料是首页锚点，右侧默认显示每日动态；移动端把个人资料展开为默认首页，导航置于身份区与内容区之间，并在内容页随紧凑身份区固定。移动端内容 Grid 必须从顶部自然排布，避免少量内容拉伸身份区与内容区之间的间距。每日动态、每日关注、抖音收藏、开源关注不再重复显示栏目标题或摘要。
- 动效分工保持克制：Loading、技术信号场和双语简介分别承担揭幕、环境与叙事。首访内容揭幕由 `SectionMotionLifecycle` 私有实现；同级栏目直接提交路由，移动端首页与内容页之间保留身份轨桥接；`prefers-reduced-motion` 下即时完成。
- 移动端首页进入内容页时，身份轨不直接动画整体高度：信号场和简介先离场，头像与身份信息通过临时共享覆盖层收拢到紧凑头部，导航与内容流随后落位；从内容页回首页按相反节奏展开。该覆盖层必须 `aria-hidden`、不可交互并在终态后清理。
- 策展内容已从卡片选择器收敛为默认信息流；详情页继承同样的排版语法。
- 开源关注的主题筛选与每日关注共用右侧单选菜单样式，工具栏左侧显示当前结果的项目数，菜单保留各主题的全库计数；当前项由勾选与触发器文字表达，小屏菜单限制在视口内。筛选仍对已载入的完整公开仓库集合执行。
- Loading、技术信号、双语简介属于身份轨的三种不同时间尺度的动效，分别为每会话一次的揭幕、环境信号、个人叙事；它们不应扩散到右侧内容流。
- 旧知识库、语雀同步、表格工作区及相关框架不再属于当前前端信息架构。

## 2026-09-08 设计工程更新

- 同级栏目链接直接提交 Next 路由，键盘导航不经过退出动效；手机身份展开/收拢保留现有桥接。之前描述的桌面淡入换页已被这一规则取代。
- 主题即时应用，图标使用 160ms 可中断反馈；问答输入统一 16px，主要控件统一 44px。
- `apps/web/app/not-found.tsx` 为缺失页面提供共享身份轨、主题与真实阅读出口。


## 2026-09-09 构建功能下线

已删除 `/works` 与详情路由、项目样张和灯箱、项目采集发布脚本、SQLite 项目快照以及对应 Ask 索引。导航、RSS、Sitemap、健康检查与向量索引不再包含项目档案；旧路由直接返回 404。
