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
