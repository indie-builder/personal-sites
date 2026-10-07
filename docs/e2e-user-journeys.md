# 主用户旅程 e2e 覆盖清单

`apps/web/e2e/` 的浏览器回归按用户旅程组织。本文是覆盖地图：每条旅程由哪些套件守住、跑什么命令、哪些场景明确不在覆盖内。改动信息流、详情页、问一问或身份控件时，先在这里找到所属套件再补用例。

## 命令

```bash
pnpm test:e2e                                  # 总入口：先构建，再跑 e2e 运行器全套
PLAYWRIGHT_REUSE_BUILD=1 pnpm test:e2e:touch   # Playwright 留守件（须先有成功构建，命令才复用；缺省自建）
```

- `test:e2e` 永远先构建（`apps/web` 的 `pnpm build`），用生产构建起 7100 端口专享服务器；`PLAYWRIGHT_REUSE_BUILD` 只对 touch 套件生效。
- `e2e/agent/` 冒烟用例需要 `BIGMODEL_API_KEY`，缺 key 时注册期跳过；`public-discovery` 的 admin 标签用例需要 `SUPABASE_SERVICE_ROLE_KEY`，CI 以 `--exclude-tag admin` 排除。
- 定向运行：`cd apps/web && node scripts/e2e-agent-run.mjs <文件名...>`（位置参数转发给 e2e CLI，同样走当前构建）。

## 覆盖地图

| 旅程 | 套件 | 守住的契约 |
| --- | --- | --- |
| 首页信息流 | `home-streaming` | 首页流式水合：稳定身份壳内逐段就绪 |
| 精选剪报流 | `curation-tags`、`stream-load-more-resilience`、`stream-tag-keyboard-scroll` | 标签筛选与详情往返（320–1440px）、加载更多失败中文兜底与重试恢复、键盘切标签即时回顶 |
| 设计收藏 | `curation-isr` | 列表→详情→相邻剪报→列表全程留在 `/design`；三类详情路径独立 ISR，首读 `MISS\|HIT`、二读 `HIT`；跨板块 ID 404 |
| 抖音收藏 | `curation-isr` | `/douyin` 列表进入 `/curation/[id]` 共享详情，返回链接指向 `/douyin`；相邻剪报同为抖音条目，点击换详情后经返回链接回列表 |
| 每日动态 | `ai-news-filter`、`ai-news-detail-entrance` | 分类菜单窄屏可用、渲染结果按窗口过滤与重置、加载全部历史后的收尾文案不再提 7 天上限；详情入场武装只播一次 |
| 开源关注 | `open-source-filter`、`open-source-motion`、`open-source-repository` | 主题筛选（四视口）、仓库面板 Motion 与入场/隐藏往返、文件树目录展开、文件读取失败原位报错，重选同一文件后正文、路径与 GitHub 直链就位 |
| 详情阅读 | `curation-detail-responsive`、`detail-touch-targets` | 长媒体对页展开（1200px 断点）、移动端返回链接/来源 CTA 触控目标 |
| 问一问 | `ask-flow`、`ask-scroll-to-latest`、`retired-ask` | OpenUI 流式渲染与引用折叠（四视口）、停止保留部分答案且迟到片段不得进入答案、SSE 错误后重试重发原问题且保留未发送草稿、整页刷新后会话与草稿恢复、axe 无违规、独立 `/ask` 已退役 |
| 助手抽屉 | `assistant-drawer`、`assistant-motion`、`ask-scroll-to-latest` | 参考版式对齐、草稿跨关合恢复、移动端模态与焦点圈闭、问候语坐标稳定、步行精灵动效时序 |
| 关于我 / 主题 | `identity-controls`、`profile-motion` | 主题切换经客户端导航与硬刷新持久并可切回；关于我小票展示真实经历、Escape 关闭、焦点回落、背景滚动解锁；打印小票 Motion 与 reduce 终态 |
| 公开元数据 | `entry-metadata`、`public-discovery` | 详情 canonical 归一到 `/curation/[id]`、分享卡带 og:image、列表 canonical 裸路径；`/feed.xml`、`/robots.txt`、`/sitemap.xml` 与健康端点机器可读；精选流 axe 无违规 |
| 站点边界 | `retired-works`、`section-navigation`、`layout-input-regressions`、`portfolio-independent` | 已退役路由 404 无导航、版块切换即时且内容可见、原生 BODY 键盘滚动、作品集仅作外链入口 |

注意区分：**设计收藏**是站内 `/design` 信息流（带设计判读的剪报，上表「设计收藏」行覆盖）；**作品集**是外部独立站点，`portfolio-independent` 只守住它的外链入口，不算设计收藏的覆盖。

## Playwright 留守件

`e2e/*.spec.ts` 五例留在 Playwright：e2e 运行器没有触设备仿真（`hasTouch`/`isMobile`）与 `prefers-reduced-motion` CSS 媒体模拟，涉及这两类计算样式的断言无法等价表达，见各 spec 头注释。其余用例已全部迁移到 e2e 运行器。

## 明确不在覆盖内

- 仓库 tree/file 走 `/api/open-source/*` 到 GitHub 的真实链路会随远端漂移：确定性套件注入受控响应，只证明页面契约；agent 冒烟（`e2e/agent/`）覆盖真实面板切换但不固定远端终态。
- 投影数据每日同步：确定性套件从渲染列表现取目标（开源 slug、设计与抖音详情、动态分类），不断言具体内容条目；仍硬编码投影 ID 的旧用例属已知技术债（#56）。
- ISR 断言接受首读 `MISS|HIT`、二读 `HIT`；跨构建的 `x-nextjs-cache: STALE` 残留是已知问题（#65），不在本套件内解决。
- 生产 Supabase 增量、真实模型回答质量、AI 新闻抓取管线的正确性由各自包的测试与线上巡检守住，不在浏览器 e2e 范围。
