---
name: 陈远｜运行中的工程档案
description: 面向 Agent 工程实践的个人身份轨与每日关注信息流。
colors:
  ink: "#1c1c1e"
  surface: "#ffffff"
  muted: "#656568"
  quiet: "#767676"
  summary: "#6f6f72"
  line: "#eeeeee"
  loader-green: "#24cb71"
  loader-red: "#ef4444"
  loader-amber: "#f2c94c"
  paper: "#f8f8f8"
typography:
  display:
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "clamp(2.05rem, 4.2vw, 3.85rem)"
    fontWeight: 610
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "0.95rem"
    fontWeight: 620
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "0.82rem"
    lineHeight: 1.38
  signal:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.62rem"
    fontWeight: 650
  scale:
    caption-xs: "0.67rem"
    caption-sm: "0.72rem"
    caption: "0.74rem"
    caption-lg: "0.76rem"
    body-sm: "0.78rem"
    body-md: "0.88rem"
    mobile-bio: "0.875rem"
    mobile-identity: "1.125rem"
    body-lg: "0.9rem"
    markdown-h3: "1rem"
    markdown-h2: "1.18rem"
    markdown-h1: "1.4rem"
    detail-h1-min: "1.45rem"
    detail-h1-fluid-min: "1.55rem"
    detail-h1-max: "1.85rem"
    detail-h1-fluid-max: "2.15rem"
    stream-h3-min: "0.88rem"
    stream-h3-max: "1rem"
rounded:
  micro: "0.09375rem"
  xs: "0.125rem"
  sm: "0.2rem"
  md: "0.25rem"
  lg: "0.3125rem"
  xl: "0.35rem"
  2xl: "0.4rem"
  3xl: "0.45rem"
  4xl: "0.5rem"
  5xl: "0.7rem"
  machine: "1.4rem"
  avatar: "12px"
  mobile-avatar: "10px"
  media: "12px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "12px"
  mobile-gutter: "16px"
  rail: "30px"
  section: "32px"
  stream-row: "26px"
components:
  external-link:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "9px 13px"
  stream-row:
    textColor: "{colors.ink}"
    padding: "24px 0"
  tag:
    textColor: "#6f6f72"
    rounded: "{rounded.pill}"
    padding: "7px 10px"
---

# Design System: 陈远｜运行中的工程档案

## Overview

### 适用范围与使用方式

本文件用于生成和修改陈远个人站的页面、阅读详情及问答界面。它同时约束信息层级与视觉实现；不是 `/design`「设计收藏」栏目的内容文件。保留当前品牌方向，新增页面先复用既有骨架，再根据读者任务组织内容。

方法参考 Vercel 的 [How our agents build on-brand pages with design.md](https://vercel.com/blog/how-our-agents-build-on-brand-pages-with-design-md)：把设计判断写成可观察规则，把重复样式交给已有 CSS 与组件，把常见失败纳入固定场景验证。本项目采用其方法，不采用 Vercel 的品牌、字体或页面模板。此版是基于项目代码与既有规范的文档整理，尚未进行有／无设计上下文的生成对照实验。

使用顺序：先读 [PRODUCT.md](PRODUCT.md) 确认产品与公开内容边界，再读本文件选择布局与组件，最后用 [前端架构](docs/frontend-architecture.md) 定位实现。历史方案不能覆盖当前设计约束。frontmatter 是设计 token 清单，`app/globals.css` 按顺序导入 `app/styles/` 的实际规则，组件样式使用 CSS Modules；发现二者不一致时记录具体差异，不把偶然实现提升为新设计规则。

### 读者任务

每次生成前写清一句话：“谁打开这页，要理解什么，下一步去哪里？”以现有公开材料回答，不为填满版式补造事实。

| 读者 | 要完成的任务 | 页面必须优先提供 |
|---|---|---|
| 初次到访的同行或合作方 | 了解陈远是谁，工程实践是否可信 | 姓名、中文介绍、真实项目与公开履历入口 |
| 每日阅读者 | 跟踪事件，理解作者为何关注 | 日期、题名、判断或摘要、原始来源、阅读位置 |
| 项目与开源读者 | 判断项目做了什么、为何这样做 | 定位、个人判读、现有公开证据与来源文档、仓库出口 |
| 问一问使用者 | 提问并核对回答依据 | 可用输入、明确状态、可读回答、引用来源 |

### 品牌方向

**Creative North Star: “运行中的工程档案”。** 这是一个以个人工程身份为锚点、以每日判断为主内容的桌面优先站点。页面不把内容包进卡片，也不使用营销式 hero；身份信息作为始终可见的左侧轨道，策展和文章作为右侧连续阅读流。

视觉参考来自 Ample Studio 的克制、轻量和留白节奏，但内容与交互服务于 Agent 工程实践：信号场传达技术广度，逐字叙事传达个人履历，策展流传达持续输入与判断。

**Key Characteristics:**

- 高对比黑白灰为主体；绿色只属于 Loading 动画，不进入常规页面。
- 平面、细分割线、连续流；不要用卡片堆叠制造层级。
- 桌面两栏是主布局；窄屏才收敛为单栏。

### 文案与证据

- 判断流先呈现作者的判断，跟踪流先呈现事件；标题应能独立说明内容，避免“探索无限可能”等空泛口号。
- 区分作者解析、来源摘录和模型回答。来源声音使用引线、署名与出处，不把引用改写成作者经历。
- 保留发布时间、收录日期、资料截至等字段各自含义。没有数据就省略对应部分，不捏造日期、指标、项目状态、推荐理由或客户背书。
- 操作用具体动词：查看原文、返回每日关注、在 GitHub 查看仓库。无来源时不显示失效按钮；异步失败给出可执行的重试或已有来源出口。
- 使用现有头像与经审核的公开媒体；真实截图不以生成图替代。引用外部媒体保留署名和来源，私有资料不进入页面、截图或评测样本。

## Colors

### Primary

- **Ink** (`#1c1c1e`)：标题、链接、按钮和主要内容。默认内容不引入额外品牌色。
- **Loader Green / Red / Amber** (`#24cb71` / `#ef4444` / `#f2c94c`)：仅用于电池充电的 Loading 状态（红→黄→绿充电序列）；加载完成后不可延续为页面装饰色。

### Neutral

- **Surface** (`#ffffff`)：站点唯一底面（仅提供浅色主题，`color-scheme` 固定为 light）。
- **Muted** (`#656568`)：次级信息和正文动效中的低强调文本。白底对比度 ≥4.5:1（WCAG AA），2026-08-15 起按要求加深。
- **Quiet** (`#767676`)：时间、作者、说明性元信息。白底对比度 ≥4.5:1（WCAG AA），2026-08-15 起按要求加深。
- **Summary** (`#6f6f72`)：摘要正文、标签、eyebrow 与 hover 降调文本；介于 Muted 与 Quiet 之间的中间灰。白底对比度 ≥4.5:1（WCAG AA），2026-08-15 起由 `#969699` 加深。
- **Paper** (`#f8f8f8`)：仅关于我打印稿的纸面。
- **Error** (`#994545` 系列）：表单与数据错误的语义色，仅出错时使用。
- **Shadow/Overlay**：遮罩与打印阴影只用 `rgb(0 0 0 / N%)` 黑色透明度阶。
- **Line** (`#eeeeee`)：流式内容和区域之间的唯一分隔方式。

**单色优先规则。** 除 Loading 绿外，不以黄色、渐变或高饱和点缀争夺内容注意力。

**令牌落地规则。** 当前 `:root` 暴露 `--ink`、`--muted`、`--quiet`、`--line`、`--surface`、`--font-sans`；frontmatter 的 `summary` 等名称不是同名 CSS 变量。不要直接引用不存在的变量。站点仅提供浅色主题，不写深色选择器；新控件只核对浅色下的文字、底面、边框和焦点环。

## Typography

系统字体以 SF Pro 与中文系统字体为主，保证身份、策展标题与长文在 macOS 中文环境中的一致字形。技术信号场独立使用等宽字体，且只服务于技术语义。

- **Display**（610，`clamp(2.05rem, 4.2vw, 3.85rem)`，1.04）：仅开屏等非内容场景使用，内容页标题一律用 Detail headline 档；最大负字距为 `-0.04em`。
- **Title**（620，`0.95rem`，1.15）：左侧姓名、列表区标题与轻量区域标题。
- **Stream headline**（500，`clamp(0.88rem, 0.95vw, 1rem)`，1.45，`-0.018em`）：信息流条目标题；使用 `text-wrap: pretty`。信息流标题保持克制，层级靠与摘要的粗细/颜色对比，不靠大字号。
- **Body**（`0.78rem`–`0.96rem`，1.32–1.8）：简介、摘要与 Markdown 正文按阅读密度递进；简介正文可撑满身份轨，不再使用固定窄列。
- **Signal**（650，`0.62rem`）：仅技术词节点，不作为普通 UI 正文字体。
- **Detail headline**（610，`clamp(1.55rem, 2.15vw, 2.15rem)`，1.16，`-0.038em`，`text-wrap: balance`）：内容详情页 h1。

**语义字号规则。** 内容页面的标题不使用 display 级别——长标题在超大字号下会失控；display 档仅保留给开屏等非内容场景。首页内容通过粗细、留白和分隔线建立层级，不依赖超大标题。

**字号阶梯。** frontmatter 的 `typography.scale` 是全站允许的字号清单（caption 0.67–0.76 / 正文 0.78–0.96 / Markdown 1–1.4 / 详情与信息流标题档）；新增字号先进清单再进代码，探测器以此为准。

## Layout

**双端阅读规则。** 桌面保留身份轨与连续内容流；手机按阅读顺序重排，而非缩小桌面两栏。断点为 900px，紧凑边距断点为 560px。

- 桌面身份轨最小 28rem、最大 38vw，保持 sticky；内容流最大 50rem。普通列表与详情随文档滚动，角色问答使用 420px 抽屉与内部消息滚动区。
- 手机首页依次呈现身份与外链、栏目导航、完整中文介绍、技术词条。首页头像 72px，词条区高 128px；阅读栏目使用紧凑身份头部。
- 560px 以下带日期栏的内容流采用 16px 左右边距，与身份区、导航对齐。日期栏直接衔接导航，不再增加独立顶部空白。
- 不以改变文字字号扩大触达区域：手机关键独立按钮、标题链接、筛选与返回入口至少 44px 高。长文本自然换行，代码与媒体只在自己的区域滚动。

### 页面构成选择

| 内容任务 | 采用的构成 | 必须保持的层级 |
|---|---|---|
| 首页身份展示 | 桌面身份轨 + 每日动态；手机完整身份首页 | 手机先读介绍，再看技术词条，不强塞桌面右栏 |
| 每日动态 | 日期工具栏 + 连续跟踪流 | 事件题名 > 摘要 > 元信息 |
| 每日关注／设计收藏／抖音收藏 | 日期工具栏 + 双列登记簿，手机单列 | 判断题名与解析 > 来源摘录 > 标签 |
| 开源关注 | 项目计数与主题单选菜单 + 仓库登记行 | 仓库名与中文判读 > 类型与状态 |
| 策展详情 | 通栏标题 + 原文／解析对页，手机按顺序堆叠 | 原始证据与个人解析可区分，末尾能继续阅读 |
| 角色问答 | 角色入口 + 右侧聊天抽屉 | 输入与回答为主，引用为辅助；无独立问答路由 |

**宽度跟随内容规则。** 普通正文服从阅读宽度；代码、表格和真实样张使用所属内容区域的可用宽度，不因段落限宽而挤成窄条。窄屏只允许这类局部内容横滚，页面本身不横向溢出。此规则不取消策展对页的两列边界。

## Elevation & Depth

本系统是**纯平面**的。层级来自网格、留白、细线与文本对比，不使用卡片阴影、毛玻璃或浮动面板。头像与媒体可使用 `12px` 小圆角承载真实图像，但不能叠加大阴影。

**平面优先规则。** 除媒体缩放与必要的状态反馈外，不为“看起来高级”添加阴影、描边加阴影组合或装饰性背景。唯一例外是关于我打印稿的打印机机身（见[关于我打印稿](docs/design/identity-and-motion.md#关于我打印稿)的受控拟物例外）。

## Shapes

媒体与头像使用轻圆角，普通内容行不包容器。手机首页头像沿用 mobile-avatar 圆角；菜单用细边框与小圆角，实心胶囊仅用于适合强调的详情来源出口，不用于身份区外链。

## Components

按下列任务入口读取完整场景约束；通用 token、布局与交互规则继续以本文件为准。

### 可直接复用的实现

下表是本仓库的实现入口，不是要求另造一套同名组件。沿用现有组件的 props 和样式；CSS Modules 的类名不是可在外部 HTML 直接调用的公共 API。本项目没有独立发布的品牌样式 CDN，仓库外生成稿需自行携带按本规范实现的样式。

| 原语 | 实现入口 | 复用边界 |
|---|---|---|
| 页面壳与身份轨 | `app/page.tsx`、`components/site-profile.tsx` | 列表复用壳；详情复用身份组件，遵循既有手机详情收敛规则 |
| 栏目刊头与手机导航 | `components/site-section-navigation.tsx`、同名 `.module.css` | 路由链接与当前栏目状态，不作筛选 Tab |
| 日期与内容流 | `components/use-stream-date.ts`、`components/ai-news-stream.tsx`、`components/curation-stream.tsx` | 复用日期跟随与行密度；设计视频控件不嵌套进链接 |
| 开源关注 | `components/open-source-stream.tsx` | 仓库判读与主题筛选菜单 |
| 详情阅读 | `components/article-markdown.tsx`、`app/styles/foundation.css`、`app/styles/reading.css` | `.curation-detail__article`、`.curation-detail__section`、`.article-markdown`；对页使用 `--spread` 修饰边界 |
| 问答与输入 | `components/ask-chat.tsx`、`components/ask-chat.module.css` | 仅供角色抽屉使用，保留消息滚动与原生输入组合器 |
| 每日动态分类菜单 | `components/ai-news-stream.tsx`、`app/styles/streams.css`、`app/styles/profile.css` | 直接复用 Radix 单选菜单原语，保留站点自己的菜单样式 |
| 首访揭幕 | `components/opening-loader.tsx` | 复用会话揭幕，不新增页面级 Loading 仪式 |

### 像素助手（指定参考的局部例外）

修改角色入口、抽屉外观或指定参考尺度时，阅读[完整约束](docs/design/assistant.md#像素助手指定参考的局部例外)。

### 身份轨

调整身份区、头像冒险或外链行时，阅读[完整约束](docs/design/identity-and-motion.md#身份轨)。

### 内容导航

修改刊头、栏目路径或筛选入口时，阅读[完整约束](docs/design/reading.md#内容导航)。

### 手机头部与日期工具栏

修改手机头部收拢、日期跟随或菜单时，阅读[完整约束](docs/design/reading.md#手机头部与日期工具栏)。

### 技术信号场

修改词条弹幕、背景点阵或暂停路径时，阅读[完整约束](docs/design/identity-and-motion.md#技术信号场)。

### 双语简介

修改首访叙事、问候轮换或手机简介时，阅读[完整约束](docs/design/identity-and-motion.md#双语简介)。

### 关于我打印稿

修改履历弹层、走纸或拟物例外时，阅读[完整约束](docs/design/identity-and-motion.md#关于我打印稿)。

### 每日关注流

修改 X／抖音判断流的登记栏与证据摘录时，阅读[完整约束](docs/design/reading.md#每日关注流)。

### 设计收藏流

修改设计子集、站内视频或空列表时，阅读[完整约束](docs/design/reading.md#设计收藏流)。

### 策展详情

修改剪报对页、来源与相邻导航时，阅读[完整约束](docs/design/reading.md#策展详情)。

### Markdown 正文（全站统一）

新增或修改长文 Markdown 场景时，阅读[完整约束](docs/design/reading.md#markdown-正文全站统一)。

### 每日动态流

修改事件跟踪流、分页追加或筛选反馈时，阅读[完整约束](docs/design/reading.md#每日动态流)。

### 每日动态详情

修改新闻详情的阅读顺序与原文出口时，阅读[完整约束](docs/design/reading.md#每日动态详情)。

### 开源关注流

修改仓库判读、主题登记或详情出口时，阅读[完整约束](docs/design/reading.md#开源关注流)。

### 角色问答

修改回答渲染、来源、建议或输入状态时，阅读[完整约束](docs/design/assistant.md#角色问答)。

### Loading

修改每会话揭幕与内容入场时，阅读[完整约束](docs/design/identity-and-motion.md#loading)。

## Do's and Don'ts

### Do:

- **Do** 以 `.curation-home` 的“身份轨 + 内容流”作为新页面的默认骨架。
- **Do** 在内容区使用连续分隔线、语义标题与真实元信息表达层级。
- **Do** 将新的技术词、简介内容与策展条目放进既有组件和数据模型，而不是另建展示壳。
- **Do** 为新的动效补齐 `prefers-reduced-motion` 的静态或即时状态。
- **Do** 先在桌面宽度验证两栏节奏、词节点不重叠、正文不留无意义右侧空白。

### Don't:

- **Don't** 恢复知识库、语雀同步、工作台表格或旧 `WorkspaceFrame` 视觉结构。
- **Don't** 用卡片网格、玻璃拟态、大阴影或高饱和装饰色承载策展内容。
- **Don't** 将 Loading 的绿色或此前试验的黄色扩散到加载完成后的页面。
- **Don't** 为技术感滥用等宽字体；等宽字体仅用于技术信号场、代码和已登记的打印稿语义。
- **Don't** 让技术节点、正文文本或详情标题溢出、堆叠或破坏两栏阅读线。

### 固定验收场景

UI 变更评审时，执行[固定验收场景与通过标准](docs/design/review.md#固定验收场景)，覆盖桌面、窄屏、横屏、问答与减少动态效果。

### 如何更新这份规范

修正规范或评估新规则时，遵循[记录、落点与对照评估方法](docs/design/review.md#如何更新这份规范)。

## 全站交互规范

本节统一阅读与操作尺度；具体页面验收场景见[验收参考](docs/design/review.md#固定验收场景)。

### 阅读与操作的统一尺度

- 页面仍采用身份轨与连续内容流；登记栏是索引，题名是入口，摘要是阅读内容。题名行高统一为 1.45，摘要为 1.65；长题名自然换行，详情标题 balance，正文 pretty。日期和计数使用 tabular-nums，更新时不横跳。
- 栏目刊头在中等桌面宽度允许兄弟导航换行，禁止压缩中文为逐字竖排或撑破右栏；每个入口保持整词。手机保留原有可横滑导航。
- 独立按钮、来源出口和返回链接至少 44px 触达；图标不随触达区域放大。键盘焦点用 2px currentColor 轮廓与 3px 间距，不能仅依赖 hover 背景。
- 普通输入字号桌面与手机统一 16px；角色问答的输入、建议与触达尺度遵循[像素助手](docs/design/assistant.md#像素助手指定参考的局部例外)的指定参考规则。

### 动效决策

选择路由、按压、hover、媒体或身份动效时，遵循[动效决策表与例外](docs/design/identity-and-motion.md#动效决策)；实现分层见[前端动效参考](docs/frontend/motion.md#动效技术分层)。
