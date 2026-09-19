# Android 字体与间距规范

适用于全应用：动态五栏目、内容详情、问答、关于我、个人经历和底部导航。唯一代码来源为 `ui/theme/Theme.kt` 的 `SiteText`、`SiteTypography`、`SiteSpace`。Web 使用自己的设计规范。

## 字体与字距

- 全应用使用 `FontFamily.SansSerif`。拉丁字符和中文由 Android 系统无衬线字体及语言回退呈现，不另下载字体。不同厂商的具体字形可能不同，但同一设备上各页面保持同一方案。
- 所有文字角色显式使用 `letterSpacing = 0.sp`，不拉开中文、不给按钮额外增加字距。Material 默认组件也通过 `SiteTypography` 接入同一方案。
- 所有字号、行高使用 sp，跟随系统字号；布局与触达使用 dp。禁止在页面里用 `.copy(fontSize / lineHeight / fontFamily / letterSpacing)` 临时改字。
- 履历保留小票结构，但文字使用同一无衬线字体。技术词条画布使用相同系统字体和辅助字号，跟随字体缩放；它是装饰内容，不是另一套字体系统。

## 文字角色

| 角色 | 字号 / 行高 | 字重 | 用途 |
| --- | --- | --- | --- |
| identity | 32 / 40sp | Medium 500 | 仅个人姓名 |
| pageTitle | 22 / 30sp | SemiBold 600 | 详情标题、问答欢迎标题 |
| title | 16 / 24sp | Medium 500 | 动态标题、问候语、区域标题 |
| listTitle | 15 / 22sp | Medium 500 | 策展、开源行标题 |
| body | 15 / 26sp | Normal 400 | 简介三段、详情正文、问答双方正文、输入框 |
| summary | 13 / 21sp | Normal 400 | 列表摘要、次要说明 |
| label | 14 / 20sp | Medium 500 | 按钮、履历日期、交互标签 |
| tab / tabSelected | 14 / 20sp | Normal 400 / SemiBold 600 | 顶部栏目切换 |
| meta / eyebrow | 12 / 18sp | Normal 400 / Medium 500 | 时间来源、底栏标签、说明 |

同一段内容不因所在页面不同改用另一种字体。颜色只表达主次，不替代字号角色。简介三个段落的字体、字重、字号、行高、颜色完全一致。

## 间距尺度

| Token | 值 | 职责 |
| --- | --- | --- |
| micro | 4dp | 图标旁微调、紧密元信息 |
| compact | 8dp | 标题到摘要、同组内容 |
| related | 12dp | 正文到元信息、关联元素 |
| paragraph | 16dp | 同一阅读章节内段落 |
| item | 20dp | 动态条目上下留白 |
| page / section | 24dp | 页面左右边距 / 不同章节间距 |
| touch | 48dp | 最小交互触达区域 |

不把图标尺寸、图片比例、开场动画几何、玻璃底栏外边距强行当作文字间距。它们是组件几何，单独保持。

## 页面规则

| 页面 | 字体分配 | 布局节奏 |
| --- | --- | --- |
| 动态 | title → summary → meta；标题/摘要最多两行 | 左右24dp，上下20dp；标题至摘要8dp，元信息前12dp |
| 每日关注/设计/抖音/开源 | listTitle → summary/meta | 左右24dp；图文列间16dp；条目上下16dp |
| 详情 | pageTitle → meta → body | 左右24dp；标题组12dp；正文段16dp；章节24dp；正文不限行 |
| 问答 | pageTitle/title、双方body、来源meta | 对话左右24dp，消息间16dp；输入区域左右16dp作为独立交互组件；键盘与系统安全区额外计算 |
| 关于我 | identity、label、问候title、三段body | 左右24dp；头部至正文24dp；正文段16dp；词条前24dp |
| 履历弹层 | title、label、summary、meta | 左右24dp；记录内4–8dp，记录间12–16dp；系统底部安全区另计 |
| 底栏 | meta | 不通过增大字号增加触达；图标与文字为同一点击目标 |

## 动态文字与验证

问候语预先测量所有语言的完整字符串，用最大实际文字度量占位，避免切换回退字体时推动正文。不得仅固定 dp 高度来裁切大字号。

新增页面复用语义角色；遇到确实不同的文字用途，先在主题新增角色，再更新本表。跑 `node android/scripts/check-typography.mjs`、Android 构建/Lint，以及模拟器正常字号和1.3倍字号检查。检查标题换行、输入框、履历内容、页尾滚动和导航标签；截图不能代替真机字体差异与 TalkBack 测试。
