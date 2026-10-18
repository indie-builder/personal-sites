# Agent Skills Tracking Policy

代理技能(agent skills)分为两类,只有一类进入 git:

- **自研或轻量技能**(SKILL.md 加少量脚本):保持跟踪,继续放在 `.agents/skills/`,`.claude/skills/` 是指向该目录的单一目录软链接(新增技能自动可见),`.pi/skills/` 以逐技能符号链接指向它们。
- **第三方重型安装包**:只留在本机磁盘,git 不跟踪。当前包括 `video-shotcraft`(约 50M 演示资产)与 `impeccable`(约 6.7 万行 vendored 设计/检测工具,v4.1.1)。忽略规则见根 `.gitignore`。

## 为什么

`impeccable` 一个目录曾占全仓库跟踪源码的约 66%,且产品代码、CI、文档均无运行时引用——它是纯代理环境工具,属于可重装的供应商依赖,不是需要评审的作者代码。跟踪它让仓库 LOC 与评审噪音失衡(见 `.audit/simplification-2026-10.tsv` 2026-10 简化战役)。

## 新机器恢复

impeccable 无公开上游安装源(随提交 `8d7a16a` 入库),从 git 历史恢复:

```bash
git checkout 09faa85 -- .agents/skills/impeccable
ln -s ../../.agents/skills/impeccable .pi/skills/impeccable
```

`.claude/skills` 的目录软链接已覆盖 impeccable,无需额外建链。

技能文件在本机保持可用;`PRODUCT.md` 的 `impeccable:product-schema` 标记与 `.impeccable/` 评审产物维持跟踪,不受此策略影响。

根 `.gitattributes` 按具体技能目录标记已核实上游来源的供应商内容，来源记录见 `skills-lock.json`。这些文件保持跟踪，但不参与作者文件的 5,000 token 检查；项目自研技能不做全目录豁免。

## 工具与路径核实

引用 skill、CLI、workspace SDK 或环境变量前先核实存在性,再下结论:

- skill:先查当前会话的技能目录与已启用的用户级插件,再查项目 `.agents/skills/<name>/SKILL.md`。项目目录未找到只能说明未在该位置发现;确认安装范围后再建议安装。
- CLI:用 `command -v <工具>` 和已找到工具的 `--help` 核实入口;CLI 与同名 skill 分别判断。能力发现阶段使用已安装入口,避免 `bunx` 隐式下载安装。
- workspace SDK:从实际消费它的 workspace 解析包入口并核对该工作区 manifest;用户级插件、CLI 和项目运行时依赖分别报告。
- 环境变量:先检查当前进程是否设置,再核对项目声明的加载来源;只输出存在性,不输出值或凭据文件内容。未检查的来源标为未核实。
- 仓库路径:脚本用 `fileURLToPath(import.meta.url)` 或 `new URL("../", import.meta.url)` 计算绝对路径(内容脚本见 `tools/content/scripts/lib/repo-root.mjs`)。委派任务携带绝对 `repo_root` 和 workspace;命令用 `git -C <绝对路径>`、`bun --cwd <绝对路径>` 或绝对文件路径,不依赖持久 cwd。
