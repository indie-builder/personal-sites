# 作者文件大小审查

审查基线：`1739562`（2026-10-18）。按完整文件字节数 / 4 估算 token，严格大于 20,000 bytes 才超限。日常 pre-commit 仅检查本次暂存变更；本轮另外扫描了全部已跟踪文件。

## 审查发现

1. **暂存检查器漏检文本。** 原 `git diff --cached --numstat` 二进制判定同时受旧版本和工作区属性影响：未暂存的 `-diff` 属性可以隐藏超限文本，二进制替换为文本也会漏检。修复为读取暂存路径、完整 blob 大小及新 blob 前 8,000 字节的 NUL 判定；生成属性继续通过 `check-attr --cached` 读取。blob 引用显式指定 stage 0，避免 `0:source.ts` 这类文件名被解释为索引语法。回归覆盖两种漏检、相反方向替换和索引前缀文件名。
2. **11 个作者文件超过限制。** 职责混合集中在 AppService 测试运行环境与场景验证、头像采样与 React 生命周期、全局 CSS 不同阅读区域，以及跨功能测试和长篇设计参考。按真实职责拆分，保持公开界面、样式级联顺序、测试名称与断言。
3. **19 个非作者文件缺少来源标记。** 16 个第三方技能文件、OpenUI 生成提示词、导出的 SVG 帧序列和 Xcode 工程序列化文件，改用精确的 `.gitattributes` 来源标记，保留原文件内容。第三方来源见 `skills-lock.json`；自研技能继续接受检查。

## 拆分清单

| 原文件 | 基线 bytes | token（bytes / 4） | module 或文档职责 |
| --- | ---: | ---: | --- |
| `apps/miniprogram/scripts/e2e.ts` | 47,993 | 11,998.25 | AppService 运行环境、公开包校验、各阅读与问答场景 |
| `DESIGN.md` | 38,979 | 9,744.75 | 设计入口与按阅读、身份、问答划分的参考 |
| `apps/web/src/styles/foundation.css` | 34,024 | 8,506 | 基础令牌、身份与列表、详情排版 |
| `apps/miniprogram/tests/portfolio.test.ts` | 30,680 | 7,670 | 作品集公开契约、原生动作、集合状态 |
| `apps/web/components/particle-avatar.tsx` | 29,651 | 7,412.75 | 头像采样、入场序列与 React 生命周期 |
| `apps/web/e2e/ask-flow.e2e.ts` | 28,477 | 7,119.25 | 问答输入与流式状态、引用阅读与布局 |
| `apps/miniprogram/tests/core.test.ts` | 24,458 | 6,114.5 | 请求适配、分页阅读与问答状态 |
| `apps/web/e2e/avatar-name-intro.e2e.ts` | 24,015 | 6,003.75 | 名字入场序列、可见性与暂停恢复 |
| `android/app/src/main/java/cn/lovemyrmb/personalsite/ui/ask/AskScreen.kt` | 22,014 | 5,503.5 | 对话编排、推荐问题、引用阅读 |
| `docs/frontend-architecture.md` | 20,999 | 5,249.75 | 前端入口、布局与动效实现约定 |
| `apps/web/e2e/reduced-motion-styles.spec.ts` | 20,783 | 5,195.75 | 减少动态效果与触屏样式契约 |

## 完成结果

全仓复扫：按排除规则未发现超过 20,000 bytes 的作者文件。代表文件：小程序回归 CLI 从 47,993 降至 1,262 bytes，运行环境为 12,497 bytes；头像入口从 29,651 降至 19,986 bytes；基础 CSS 从 34,024 降至 14,965 bytes；Android 问答页从 22,014 降至 18,186 bytes；设计入口从 38,979 降至 19,268 bytes。头像入口仅余 14 bytes 预算，后续扩展应继续按职责调整内部实现。

- 全仓 typecheck、lint、test 与生产构建通过。小程序回归拆分过程中暴露的 Request 类型问题已修正后重跑检查。
- Web 受影响 e2e 44 项、Playwright 触屏/减少动态效果 16 项通过；e2e/Playwright 全体收集数量保持 110/16，原有 212 处 matcher 调用保留。
- 小程序单测保持 142 项、2,020 个 expectation；原两个大测试的 43 个测试及 260 行断言保留；AppService 首页、问答和作品集契约回归通过；本机 wcc/wcsc 的 8 个页面模板编译通过。
- Android assembleDebug、30 项单测、lintDebug、仪器测试编译与字号检查通过。
- CSS 三份文件按原顺序拼接与旧文件逐字一致。实时 Web 验收覆盖头像切换、问答草稿/关闭恢复、详情阅读，以及桌面、320/390px 与横屏；未见编译错误、横向溢出或采集到的浏览器异常。
- 独立审查按规范与需求两轴检查 module 拆分及断言保留；发现的索引文件名前缀和迁移后文档引用问题已修正。

本轮未重新执行原生设备、微信模拟器或生产模型调用。iOS 工程内容未更改；仅标记其工具维护属性。原设计文档中的旧 Next.js 路径、问答局部样式冲突和个别历史测试文件名保留为既有文档问题，未把拆分扩展为产品重新设计。

## 设计约束

采用 [codebase-design](../.agents/skills/codebase-design/SKILL.md) 的 module / interface / seam 术语：保留调用方需要理解的小 interface，把完整行为留在所属 module；内部按一起变化的职责建立 seam，不新增只转发的层。测试通过真实 interface 验证行为，拆分不减少断言、不增加兼容层。CSS 保持声明内容与导入顺序，文档保留规则并使用相对链接披露参考。

文件预算不等于逻辑复杂度评估，也不能证明安全性或性能改善。二进制识别采用 Git 的前 8,000 字节启发式；Git 没有可靠的代理作者元数据，作者范围依靠文件命名与明确的生成/供应商属性。公开 SQLite、媒体和第三方上游文件不进行机械拆分。
