# Ask 内容护栏与相关技术事实

本文记录 Ask 内容护栏的实现约定，以及实现过程中验证过、可复用的技术事实（含根因与依据），供 `AGENTS.md` 与后续维护引用。版本与阈值会随栈升级变化，引用时以代码为准。

## 护栏是什么

`apps/web/lib/ask-guardrail.server.ts` 在公开问答（`POST /api/ask`）检索之前，用 TypeSafe 的三个 `noul` 判断拦截三类请求：

| 判断 | 拦截对象 |
| --- | --- |
| `jailbreak` | 覆盖/套取系统指令、角色扮演绕过、假扮开发者解除限制 |
| `sensitive` | 索取 API key、密钥、环境变量、`data/sensitive` 等私密目录内容、未发布草稿 |
| `offtopic` | 通用编程/写作/常识问答等把助手当通用 LLM 的请求 |

命中阈值 0.7 时返回 400 + `guardrailMessage(reason)`，不进入检索与生成。

## 关键约定

### state 必须带站点公开语料范围

`offtopic` 判断需要知道「站点有什么」，否则宽泛的正常提问（如「有哪些开源项目值得关注」）会被误判为离题。标注集实验里这是误拦的主要来源：只喂问题文本时误拦 6/8，补上 `SITE_CORPUS` 后降到 2/8。**改动护栏时不要删掉 `SITE_CORPUS`。**

### fail-open：失败即放行

个人站宁可漏放不可误拦。护栏调用失败（网络、超时、缺 key）只记录不阻断。调用带 4s 超时与零重试。

**易错点：TypeSafe client 的构造必须在 Effect 内。** SDK 在缺 API key 时构造函数**同步抛错**；若在 `Effect.gen` 外调用，会绕过路由的 `Effect.catch`（fail-open）直接冒泡，导致无 key 环境（CI、未配置的部署）下整个问答挂掉。这个 bug 曾在 `bun run test` 的 Turbo 环境隔离下暴露（本地 shell 恰好有 key，直接跑 vitest 不报）。回归测试见 `tests/ask-guardrail.test.ts` 的「no API key」用例。

### 阈值是产品决策，需按标注集重定

阈值 0.7 取自 18 条自建标注集实验，该样本零误拦零漏放。**这是小样本，可能过拟合**；扩大样本后必须重新标注、重定阈值，不要直接沿用。

## 技术事实（含根因）

### TypeSafe SDK 在 Bun 下抛 `Body already used`

- **现象**：SDK 请求返回 200 后，解析响应体抛 `TypeError: Body already used`。
- **根因**：SDK 的 `bufferResponse` 同时持有 `response.clone()` 与原始 body 的 reader。**Bun 里 `response.body.getReader()` 之后，原始 body 即被标记消费**（即使 reader 没读），后续 `text()` 抛错；Node 允许。最小复现：对同一 Response 取 `clone().body.getReader()` 与 `body.getReader()` 后 `text()`，Bun 抛错、Node 正常。
- **解法**：给 `TypeSafeClient` 传自定义 `fetch`，返回 `body: null` 但 `text()`/`json()` 可用的响应 shim，让 SDK 的 `bufferResponse` 因无 reader 提前返回。见 `bunSafeFetch`。Node 与 Bun 均通过。
- **影响面**：dev 由 Bun 启动（`bun scripts/prepare-data.mjs && bun --import ... vite.js`），生产由 Node 启动（`node --import ./scripts/load-env.mjs ...`）。shim 让两条路径都可用。

### Vite dev 因 resvg 原生模块启动失败

- **现象**：`bun run dev` 报 `UNLOADABLE_DEPENDENCY`，指向 `@resvg/resvg-js` 的 `.node` 文件，「stream did not contain valid UTF-8」。
- **根因**：`@resvg/resvg-js` 带原生 `.node` 二进制，Vite 的依赖预打包（`optimizeDeps`）试图解析它；该文件非有效 UTF-8。生产 build 走 nitro 打包，原生模块被正确外置，不受影响。
- **解法**：`apps/web/vite.config.ts` 加 `optimizeDeps: { exclude: ["@resvg/resvg-js"] }`。
- **验证**：修复后 dev 首页与 `/opengraph-image` 均 200；生产 OG 端点实测 200 + 有效 PNG（1200×630），确认生产路径本就正常。

### 候选重排：已验证无收益，不采用

- **实验**：以 `tests/ask-search-quality.test.ts` 的 6 个已知预期文档为基准，忠实复刻 `fuseAskSearchDocuments` 的 RRF 融合取 24 条候选池，对每条跑 `noul` 重排后对比。
- **结论**：基线 top-6 命中 **6/6**；`noul` 重排同为 6/6，排名**零提前、2 例退后**。现有 BM25（title 权重 6×）+ RRF（精确 query 权重 2×）在该语料规模下已足够好。
- **教训**：`noul` 准确度对问法极度敏感——问「能否直接回答」时重排仅 4/6（期望文档在池中却被判 0.27–0.33，错误文档 0.62–0.84），改问「是否正是该问题所问的主题」才回到 6/6。调好问法后也只是追平基线。重排只能重排已有结果，召回好时是纯成本。

### E2E 既有不稳定性（非升级回归）

`bun run test:e2e` 中 `open-source-motion.e2e.ts`、`avatar-mascot.e2e.ts` 在**升级前的基线**上同样失败（用 `git stash` 清空改动后复现）；`avatar-name-intro.e2e.ts` 单独运行通过。三者均为既有不稳定性，不是依赖升级引入。改动 E2E 前先确认基线状态，避免误判为回归。

## 验证方式

- 单元测试：`bun run test`（mock client，不花钱）。
- 真实 API 分类：临时 vitest 宿主（解 `@/` 别名，走 Node runtime），对标注集跑 `checkAskGuardrail`。注意实验文件会真花钱，勿入默认测试套件。
- 端到端：生产服务器（`bun run build && bun run start`）或 dev，对 `/api/ask` 发真实 HTTP 请求，验证拦截/放行与 SSE 流。
