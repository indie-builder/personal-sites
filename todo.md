# 动效端到端交付（2026-10-06，承接全局动效机会调查）

Feature playbook（主控视角）：

- [ ] 1. `how` over the affected subsystem. — skip: 调查阶段已完成同等覆盖（5 线程全量扫描 + 审计，报告已交付）
- [ ] 2. `architect` for parallel design exploration. — skip: 设计无架构分叉，调查报告已给出每行精确值
- [ ] 3. Write the throughput checkpoint as four todo items.
- [ ] 4. Delegate code-writing to a subagent with a specific scope.（每 delegate 独立 worktree）
- [x] 5. Verify on the matching surface.
- [x] 6. Rebase into small, ordered commits. Stack follow-ups.
- [x] 7. 独立评审门：每 PR 至少一名 opus 独立评审 + 修复轮至 RESOLVED / APPROVE
- [x] 8. Run **Opening a PR**.

Throughput checkpoint：

- [x] Blocking first steps — main 干净已确认；各 worker 先装依赖、读技能与 DESIGN.md 再动手
- [x] Independent workstreams — PR1 / PR3 / PR4 文件不相交，第一波并行；PR2 堆叠串行
- [x] Shared mutable state — web 两批经堆叠与一次性合并前移；各分支独立命名，无共享写
- [x] Smallest safe decomposition — 4 个 PR 按平台与批次划分，每 PR 单一 owner + 独立评审

交付批次：

- [x] PR1 feat(web) 动效一致性收尾（sonnet，worktree）— PR #51 评审门已关闭（2603c4c 终版；机制复核解决 + 微修复处方逐字 + 断言转绿 + 亲核差异；硬导航与同条目残留均为已声明限制）
- [x] PR3 feat(安卓) 动效补齐（sonnet，worktree）— PR #50 评审门已关闭（终裁 RESOLVED WITH NITS 于 310a6c5；nit 空焦点停留点由主线落地为 dd15e53，连接测试 20/0 时间戳核实新构建；五轮机制修复 + 一次 429 重组全程留痕）
- [x] PR4 feat(iOS) 动效补齐（sonnet，worktree）— PR #49 评审门已关闭（37e9e73）
- [x] PR2 fix(web) 存量动效修复（opus，基于 PR1 堆叠）— PR #52 评审门已关闭（APPROVE WITH NITS，两条 nit 由主线亲自按处方落地并全量验证：悬停颜色五处 + 按钮列表统一 180ms、曲线专属表述修正；c72f25d，76 e2e 复跑全绿，PR 正文已更新）
- [x] 独立评审 ×4，发现项修复轮 — 全部关闭。PR49 处方逐字；PR51 三轮 + 微修 + 断言转绿亲核；PR52 两 nit 亲落；PR50 五轮 + nit 亲落

注：署名行按仓库历史与 AGENTS.md「实际模型」要求使用 GLM-5.3，后续简报沿用。
- [x] 汇总报告（已交付于会话；遗留项与可翻案裁决列明如下）

明确不做：合并任何 PR（需用户明确指令，就绪顺序 #51 → #52 改 base，#49/#50 独立）；ease-in 出场翻转与 gap 插值（需真机感受，保持现状）；growing-paragraph 高度动画与手机 sticky top 过渡保持登记例外；安卓预测性返回保持库默认；iOS ProfileLink 按压为评审标注的可选机会未做。

已应用的可翻案默认：DESIGN.md 悬停颜色 160→180ms 并全站扫平；AI 新闻入场收窄为仅客户端导航（硬导航即时）；同条目前进后退残留淡入声明接受；Enter 激活阅读器返回键为设计内键盘关闭路径（评审裁定合法）。

---

# Feature: 集成 tester-army/e2e agent 冒烟测试层（2026-10-07）

1. `how` over the affected subsystem. — done（前一回合 inline）: playwright.config.ts、24 spec、turbo.json、apps/web package.json、官方 with-next 示例 e2e.config.ts 均已读。
2. `architect` for parallel design exploration. — condensed: 设计已与用户确认（共存不替换；模型复用 config/bigmodel.mjs 的 Anthropic 兼容端点 + resolveBigModel；目录 e2e/agent/）。替代方案「整体迁移」否决：现有 spec 做 mock SSE、过渡事件断言，agent 做不了。
3. Throughput checkpoint:
   - **Blocking first steps.** pnpm 装依赖 + 通读 node_modules/e2e/docs，gate 全部代码。单 worker。
   - **Independent workstreams.** n/a: code-coupled 单特性，<8 小文件，单 app。
   - **Shared mutable state.** apps/web/package.json 单 owner 独占写；主 checkout 不动，delegate 在自己 worktree。
   - **Smallest safe decomposition.** 单 delegate 最优：test-infra 单子系统，无跨包改动。feature: sonnet（override sheet）。
4. Delegate code-writing to a subagent, worktree, branch off main (b2bb548)。 — done: sonnet delegate，两笔提交 4b9c25d / 4acc970，自验全绿（首次录制 103.3k tokens / 8 次调用转绿，回放 0 调用）。
5. Verify on the matching surface. — done 主控亲验: typecheck/lint 绿；playwright --list 77/24 未混入；e2e list 恰两条；pnpm test:e2e:agent 完整跑（含生产构建）2/2 绿、4 replayed、0 模型调用、39.5s。
6. Rebase into small, ordered commits. — done: 依赖+配置 / 用例 两笔，diff 逐文件复核（baseURL 与 ask-session.server.ts:212 逐字一致；pnpm-workspace.yaml 两行系 pnpm 自动登记）。
7. If the design is contested, `interrogate` before shipping. — skip: 设计无争议，用户已确认。中途用户追问「Playwright 是否都换成 e2e」，已据证答复：不可换（mock SSE、过渡序列、ISR 头等确定性断言 agent 做不到；locator 模式底层同为 Playwright，迁移零收益）。
8. Run **Opening a PR**。 — done: https://github.com/indie-builder/personal-sites/pull/58 。
9. 独立评审修复轮。 — done: opus 首裁 BLOCK（major: reuseExisting 复用未知服务器；minor: 无条件 --pass-with-no-tests），按处方三笔修复（c2c1fe3 / c5dfb4c / f5bd668）；修复轮挖出并根治更深问题：仓库结构面板终态随 GitHub 拉取成败漂移（匿名配额耗尽必炸），browser.route 钉固定树。清缓存重录 + 连续两遍全回放零调用全绿；缺 key 2 skipped exit 0。复裁 APPROVE，门关。
10. 合并前 CI 绿即按 [[merge-autonomy-for-gated-work]] 直接合并并汇报。 — done: CI 全绿（六项 pass），PR #58 已于 2026-10-07 02:39 UTC 合并（merge commit）。

---

# Program: Playwright 回归套件全量搬迁到 e2e 运行器（用户 2026-10-07 拍板，不等 1.0）

规则：行为保持搬迁，断言逐条等价，不加不减覆盖。e2e 版本全程锁 0.18.0。用户指示能并行则并行。拓扑（2026-10-07 定）：W1 串行门槛（一次定型 config 宽 glob、CI 工作流、helpers、axe 胶水）→ W2/W3/W4/W5 四路并行（文件不相交，各自 branch off W1 后 main，各自评审门+独立合并）→ W6 垫底（删 Playwright 依赖全部波次合并）。
Throughput checkpoint: Blocking=W1；Independent=W2–W5 文件不相交并行；Shared=e2e.config.ts/workflow/package.json 仅 W1 与 W6 触碰；Smallest=5+1 波。

- [x] W1 约定层（串行门槛）: PR #59 已合并（2026-10-07 03:35 UTC，5bcefbb）。经历：opus 首裁 BLOCK（viewport 祖先裁剪语义 + helper 开页前求值）+ CI 红（框架只给自起进程白名单环境，SUPABASE 到不了服务器，command.env 显式透传根治）；复裁 APPROVE WITH NITS，nit（reduced-motion 注释过度承诺）主线亲落。CI 同条件复现 1 failed→5 passed。
- [x] W2 助手簇A: ask-flow（SSE mock + axe include）、retired-ask。 — done: PR #64，首裁 BLOCK（定位契约 + networkidle 位置），修复轮恢复契约 + 声明非等价前置 + 移除新增断言，复裁 APPROVE WITH NITS（两 nit 亲落：注释收窄 + PR 正文同步），CI 全绿，2026-10-07 05:26:39 UTC 合并
- [x] W3 助手簇B: assistant-drawer、assistant-motion、ask-scroll-to-latest。 — done: PR #60，首裁 BLOCK（严格单匹配 + commit 时序），修复轮记录器重写 + 双向探针 + 延迟尾部回归，二裁 BLOCK（90s 放宽）亲落时间预算恢复，三裁 APPROVE WITH NITS（注释 nit 亲落），CI 全绿，2026-10-07 05:26:08 UTC 合并
- [x] W4 流簇: home-streaming、stream-load-more-resilience、stream-tag-keyboard-scroll。 — done: PR #62，首裁 BLOCK 一条 major（feed 严格单匹配）主线亲落，复裁 APPROVE，CI 全绿，2026-10-07 04:53 UTC 合并
- [x] W5 内容簇: 五 spec，触摸用例实证留守 Playwright。 — done: PR #61，首裁 BLOCK（fetch 响应完成边界 major + reduce 范围 minor + 注释 nit），修复轮 A/B 双态探针实证 + arrayBuffer 边界 + 严格单匹配加强，复裁 APPROVE，CI 全绿，2026-10-07 05:10 UTC 合并
- [x] W6 动效收尾+拆除: PR #66。首裁 BLOCK（unhandledrejection 漏接 + reduce 滚动断言被挪 + 正则过宽），修复轮双探针证明 + 断言溯源回迁 + 正则收窄；CI 红两根（public-discovery 凭据依赖 → admin 标签排除；runner 安装瞬时故障）修复；复裁 APPROVE WITH NITS（a11y 用例连坐标签 nit 亲落）。CI 全绿，2026-10-07 06:39:56 UTC 合并。**程序收官**：七笔 PR（#58/#59/#64/#60/#62/#61/#66）全部合并；74 用例迁入 e2e 运行器（全量 76 含 2 冒烟），5 用例 4 文件实证留守 Playwright（test:e2e:touch：触摸 1 + CSS @media 断言 4）；@axe-core/playwright 删除；test:e2e 归一为 e2e 入口；issue #65 另案跟踪 route-cache；worktree 与分支全部清理。
- [ ] 附带产出: issue #65（route-cache 跨运行持久致 STALE 偶发，非搬迁引入）
