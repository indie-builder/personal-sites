---
name: maintain-stack
description: Maintains the personal-sites technology stack using its repository SOP, from dependency inventory and safe upgrades through verification, PRs, and authorized merges. Use when the user invokes /maintain-stack, asks to maintain or upgrade this project's dependencies/toolchains, or requests a stack health check; use check mode for assessment-only requests. Not for content synchronization or redesigning the architecture.
---

# Maintain Stack

## Quick start

```text
/maintain-stack                 # 核查并执行适合本轮的维护，验证后 PR / 合并
/maintain-stack check           # 只读盘点，不安装、不改文件、不提交或合并
/maintain-stack android         # 只维护 Android 及其必要关联工具链
/maintain-stack check web       # 只读核查 Web 依赖与运行环境
```

## 执行入口

1. 从当前项目根定位 `AGENTS.md`，读取其中的当前约束。
2. 读取 [技术栈维护 SOP](../../../docs/tech-stack-maintenance.md)。它是维护范围、版本选择、授权、验证和完成条件的唯一详细规则来源；本文件只定义触发入口。
3. 解析 `$ARGUMENTS`：`check` 为只读；其余可选范围是 `web`、`android`、`ios`、`video`。无范围则覆盖整个项目，独立工程不存在时记录为不适用。自然语言只问“有哪些可升级”时也使用只读模式；明确要求处理时执行维护。
4. 未知参数、互相矛盾的范围或其他仓库中缺少 SOP 时，不猜测并执行变更；说明缺项。需要用户决定的项目单独搁置，继续不依赖它的工作。
5. 按 SOP 的七步流程执行。复用当前已有 PR 和验证证据，避免重复创建相同维护任务。不要把预发布版本、弃用公告或“检查失败”误报为可直接升级或已是最新。
6. 按 SOP 的结果模板报告。没有值得升级的内容也是完成；不要为了产出改动而换框架、添加依赖或重写业务。

## 使用边界

- Skill 是用户触发的一次维护入口，不是定时器；不要默认为已建立后台巡检。
- 本项目的常规维护授权不扩展为强推、直接写主分支、绕过检查、数据发布或新增费用的权限；以 SOP 和用户当次更具体的要求为准。
- 只读模式和“只建 PR、不合并”等当次限制优先于默认执行方式。
- 在创建或修改本 Skill 时使用只读情景检查，不实际执行示例中的安装、推送或合并。
