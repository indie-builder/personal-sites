# Issue tracker: GitHub

任务与规格存放在 `indie-builder/personal-sites` 的 GitHub Issues，使用 `gh`。操作前核对当前仓库，或显式传 `--repo indie-builder/personal-sites`。

## 操作约定

- 读取任务：`gh issue view <number> --comments`；按需读取标签和关联任务。
- 查找任务：`gh issue list --state open --json number,title,labels`，先按标签或关键词缩小范围，再读正文。
- 发布规格或任务：`gh issue create --title "..." --body-file <file>`；多行正文写入临时文件，保留换行。
- 更新正文、评论或标签：使用 `gh issue edit`、`gh issue comment`；多行内容使用 `--body-file`。
- 完成任务：记录验证结果后关闭，未完成或被阻塞的工作保持打开。具体执行权限服从用户当次指令和项目约定。
- GitHub issue 与 PR 共用编号空间；先确认对象类型再执行写操作。

## PR 分诊

**PRs as a request surface: no.** 外部 PR 不自动进入 issue 分诊队列。

## 关联任务

需要拆分探索或实施任务时，优先使用 GitHub sub-issues 表达父子关系、原生 issue dependencies 表达阻塞；不可用时在正文使用 `Part of #<number>` 与 `Blocked by: #<number>`。

`wayfinder` 使用一个 map issue 及其子任务；标签为 `wayfinder:map` 和 `wayfinder:research` / `wayfinder:prototype` / `wayfinder:grilling` / `wayfinder:task`，实际使用时按需创建。领取前确认任务未被分配且阻塞任务已关闭，领取时分配给执行者；完成后在父任务记录结论与链接。
