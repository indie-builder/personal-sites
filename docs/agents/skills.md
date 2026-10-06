# Agent Skills Tracking Policy

代理技能(agent skills)分为两类,只有一类进入 git:

- **自研或轻量技能**(SKILL.md 加少量脚本):保持跟踪,继续放在 `.agents/skills/`,`.claude/skills/` 与 `.pi/skills/` 以符号链接指向它们。
- **第三方重型安装包**:只留在本机磁盘,git 不跟踪。当前包括 `video-shotcraft`(约 50M 演示资产)与 `impeccable`(约 6.7 万行 vendored 设计/检测工具,v4.1.1)。忽略规则见根 `.gitignore`。

## 为什么

`impeccable` 一个目录曾占全仓库跟踪源码的约 66%,且产品代码、CI、文档均无运行时引用——它是纯代理环境工具,属于可重装的供应商依赖,不是需要评审的作者代码。跟踪它让仓库 LOC 与评审噪音失衡(见 `.audit/simplification-2026-10.tsv` 2026-10 简化战役)。

## 新机器恢复

impeccable 无公开上游安装源(随提交 `8d7a16a` 入库),从 git 历史恢复:

```bash
git checkout 09faa85 -- .agents/skills/impeccable
ln -s ../../.agents/skills/impeccable .claude/skills/impeccable
ln -s ../../.agents/skills/impeccable .pi/skills/impeccable
```

技能文件在本机保持可用;`PRODUCT.md` 的 `impeccable:product-schema` 标记与 `.impeccable/` 评审产物维持跟踪,不受此策略影响。
