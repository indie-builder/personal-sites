# 项目技能存放约定

- 所有项目技能的实体文件放在 `skills/<name>/`。
- `.claude/skills/<name>` 使用指向 `../../.agents/skills/<name>` 的相对软链接，包括自定义技能。
- 上游来源与目录散列记录在根目录 `skills-lock.json`；更新时保留非目标来源及本地定制。
- Matt 的技能使用上游名称；Emil 的同名原型技能保留为 `emil-prototype`，同步时保留这一别名。
- 技能的用途、参数和流程写在各自的 `SKILL.md` 及其引用文档中；更新记录由 Git 保存。项目 README 与 AGENTS.md 保持聚焦产品及项目工程约束。
