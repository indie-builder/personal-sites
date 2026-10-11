# 陈远小站 · 运行中的工程档案

[English](README.md) · [中文](README.zh-CN.md)

陈远的个人网站，一份持续运转的工程档案：用不断更新的阅读、策展和个人判断呈现真实的工程实践。Web 是主要产品，桌面端是身份轨加连续内容流，手机浏览器使用同一套栏目。

**线上地址：** https://default-coder.lovemyrmb.cn/

从首页进入任意栏目即可阅读。想体验问一问，在个人资料区点击像素角色直接提问：回答流式输出，并只引用已发布资料的编号来源。

## 站点版块

| 版块 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 个人简介与内容入口；桌面默认呈现每日动态，手机先呈现完整个人资料 |
| 每日动态 | `/ai-news` | AI 与 Agent 资讯 |
| 每日关注 | `/curation` | X 书签与点赞的中文策展、来源和详情 |
| 设计收藏 | `/design` | 从 X 策展中筛出的设计相关内容 |
| 抖音收藏 | `/douyin` | 基于收藏视频转写与屏幕文字整理的关注条目 |
| 开源关注 | `/open-source` | 已选择公开的 GitHub Star，提供原始 README 或仓库结构、中文阅读版与个人判读 |
| 关于我与问一问 | 个人资料区 | 站内履历打印稿；点击像素角色展开基于公开资料的匿名问答，无独立 `/ask` 页面 |

个人资料区提供 GitHub、语雀和站内作品集入口；作品集内该入口变为「信息集」，返回信息流，在同一站点浏览七个可用作品。每日动态可按精选或分类筛选，开源关注可按主题筛选；内容流按日期阅读并支持继续加载，详情保留来源出口。

公开发现入口包括 `/sitemap.xml`、`/robots.txt`、`/feed.xml` 与全站 Open Graph 图片；RSS 聚合每日动态、每日关注、开源关注的最近更新。

## 本地运行

使用 Node.js `>=24.21.0 <25` 与 `package.json` 指定的 pnpm 12.10.1。

```bash
git clone https://github.com/indie-builder/personal-sites.git
cd personal-sites
pnpm install
cp .env.example .env.local
```

参照 [`.env.example`](.env.example) 填写根目录 `.env.local`。Supabase 用于获取最新每日动态，问一问需要模型与会话凭据；部署和同步所需的其他服务端凭据见示例文件。凭据只放在被 Git 忽略的本机文件中，不使用 `NEXT_PUBLIC_` 前缀。

```bash
pnpm dev:domain
```

打开 https://personal-site.localhost。不使用本地域名时，改用 `pnpm dev` 启动端口服务。

构建、测试和浏览器 e2e 命令见[工作区说明](docs/monorepo.md)，数据操作与健康检查见[数据同步总览](docs/data-sync.md)。

## 原生客户端

[Android](android/README.md)（Kotlin + Jetpack Compose，Android 12+，JDK 17+）与 [iOS](ios/README.md)（Swift 6 + SwiftUI，iOS 26+，无第三方依赖）复用公开内容 GET API，并通过 `POST /api/ask` 使用问答；构建与验证以各自 README 为准。

## 数据与隐私

原始个人资料、X/抖音/GitHub 抓取快照及本地转写只留在被 Git 忽略的敏感目录；浏览器只接触公开投影。匿名问答会话在部署端存于私有 Supabase Storage。完整边界见[敏感数据说明](docs/sensitive-data.md)。

公开数据分两路。每日动态从只读 `data/ai-news.sqlite` 历史归档与 Supabase 公开增量合并读取，条目落库后下一次页面请求即可读到；X、抖音、开源关注与本地问答全文索引从随 Git 部署的只读 `data/curation.sqlite` 读取，需要重建公开投影并重新部署才会更新。

## 技术栈

Next.js（App Router）配 React、Tailwind CSS 与 Motion，部署在 Vercel；业务 I/O 使用 Effect；公开数据来自 Supabase 与只读 SQLite 快照；问一问由智谱 GLM 流式输出；测试使用 Vitest、Playwright 与 e2e 运行器。带日期的版本基线与遗留审计项记录在[技术栈维护](docs/tech-stack-maintenance.md)；精确依赖见各工作区 `package.json`、`pnpm-lock.yaml` 和 `android/gradle/libs.versions.toml`。

## 文档

- [PRODUCT.md](PRODUCT.md) 说明产品定位与功能边界。
- [GLOSSARY.md](GLOSSARY.md) 定义公开内容、收录与问答的领域术语。
- [DESIGN.md](DESIGN.md) 规定视觉与交互规则。
- [前端架构](docs/frontend-architecture.md) 说明页面和数据读取职责。
- [工作区说明](docs/monorepo.md) 覆盖目录、功能到代码路径、缓存与 Vercel。
- [数据同步总览](docs/data-sync.md) 汇总维护同步命令与调度。
- [技术栈维护](docs/tech-stack-maintenance.md) 记录维护流程与遗留审计项。
- [敏感数据说明](docs/sensitive-data.md) 划分私有输入与公开投影的边界。
- [AGENTS.md](AGENTS.md) 约定协作与工程规范。

## 参与贡献

个人项目，公开开发。问题请提 GitHub Issues；改动的工程约定见 [AGENTS.md](AGENTS.md)。

## 许可

未声明开源许可证。这是个人项目，保留所有权利；复用代码或内容前请先联系作者。
