# 作品集维护

作品集与信息流由同一个 `apps/web` 应用部署。`/portfolio` 展示七个作品，`/products/*` 提供原有功能。Android 与 iOS 从同一站点读取 `/api/portfolio`。旧作品集仓库不参与构建、运行或日常内容同步。

## 修改作品入口

在 `packages/public-data/src/portfolio/products.mjs` 修改作品名称、日期、简介与路径。该注册表同时用于 Web 总览、公开 API 与 Sitemap。页面实现在 `apps/web/app/products/`，组件和产品逻辑分别位于 `apps/web/components/portfolio/` 与 `apps/web/lib/portfolio/`。

作品外壳复用身份轨。`apps/web/app/styles/portfolio.css` 只定义作用域内的产品令牌，组件 CSS Modules 承担各自布局。新增样式必须检查作品页返回信息流后的主题和布局。

## 更新公开内容

以下命令会访问上游或写入数据，不是验证命令。先用 `--help` 查看参数。

```bash
pnpm portfolio:sync --help
pnpm portfolio:project --help
pnpm portfolio:sync inspora
pnpm portfolio:sync layouts
pnpm portfolio:sync tools
pnpm portfolio:project
```

同步工作库位于被忽略的 `data/sensitive/portfolio/`。首次同步灵感集会创建本机数据库；布局目录和修正表可从工具包内的公开种子初始化。本机已有工作数据不会被种子覆盖。源站返回的原始载荷不会进入发布文件。

发布命令生成 `data/portfolio.sqlite` 和 `packages/public-data/src/portfolio/data/` 的图鉴、工具目录。发布前核对可见作品、媒体顺序、预览选择、数据库完整性和文件大小。普通失败会恢复旧文件；同一输出库的并发发布会明确拒绝。断电或强制杀进程期间不保证多个文件同时切换，应重新执行发布并检查产物。

数据库只保存去重后的可见作品与批准的公开字段。轻量视频预览和本地媒体存在性在发布时计算。Web 运行时只读 `apps/web/data/portfolio.sqlite`，不访问工作库。构建准备脚本只复制明确批准的三份 SQLite 文件。

本地公开媒体位于 `apps/web/public/` 下各作品目录。灵感原图、视频与部分布局图片仍使用上游 CDN；合仓不表示这些媒体能离线播放。保留作者、原作链接及布局参考的 CC BY 4.0 署名。

更新公开快照或媒体后，运行相关测试并重新构建部署。ISR 不会替换已打包的 SQLite 文件。

## 维护视频与头像

```bash
pnpm portfolio:render --help
pnpm portfolio:render
pnpm portfolio:sync site
pnpm portfolio:sync avatars -- /absolute/path/young-avatars-20.zip
```

视频工程和已公开的冻结截图位于 `tools/content/modules/portfolio/personal-sites/promo/`。渲染产物写入本机 `data/sensitive/portfolio/personal-sites/promo-out/`，`site` 同步将审核后的成片和截图转为 Web 资源。截图输入位于该本机目录的 `assets/`，缺失时命令失败，不读取旧仓库作为回退。

词典是随仓库保存的静态运行快照，位于 `apps/web/public/ai-coding-atlas/`。其桥接适配代码保留在 `tools/content/modules/portfolio/dictionary-runtime/`。当前没有自动重新抓取上游词典的命令。

## 配置作品聊天

作品 `/products/ai-chat` 使用独立的 `/api/ai-chat`，保留智能体、自定义提示词、浏览器会话、OpenUI 和问数工具。站点抽屉“问一问”继续使用 `/api/ask`，两者不共享会话或检索范围。

作品聊天复用服务端 `BIGMODEL_API_KEY` 和 `BIGMODEL_MODEL`。问数智能体还需要 `ANALYTICS_MCP_URL` 和 `ANALYTICS_MCP_TOKEN`。所有凭据由本机环境或部署平台注入，不复制旧项目的环境文件。更新 OpenUI 依赖后运行 `pnpm portfolio:openui` 重新生成产品提示词，再验证交互回答。

浏览器历史按来源隔离。旧作品集域名上的聊天记录不会自动迁入主站来源，也不会被迁移代码删除。

## 验证与上线

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e e2e/portfolio-integrated.e2e.ts e2e/portfolio-interactions.e2e.ts
pnpm git:safety
```

检查桌面、320px、390px 与横屏下的左侧「作品集 / 信息集」切换、画册、灵感详情返回、词典、聊天输入与游戏控制。聊天回归使用合成公开响应，不能据此声称真实模型或问数服务已配置成功。

部署继续使用现有 Web 项目和 `apps/web` 根目录。先验证主站全部作品与原生 API，再决定旧域名跳转和旧仓库归档。归档、DNS 修改和生产部署不由内容同步命令执行。
