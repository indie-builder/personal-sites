# 微信小程序

模式：Read；问一问为 Operate。面向微信内的日常阅读者与初次访客，参考 iOS 客户端，读取既有公开内容接口。

## Direction contract

THESIS：让读者在微信内直接阅读陈远的动态、策展与开源判断，完成提问并核对引用。以连续内容流为核心。

OWN-WORLD：继承站点黑白灰、系统字体、细分割线与真实头像。正文 15–16px、辅助 12–13px，触达区域至少 44px；使用微信原生导航和安全区。

STORY：首页五栏目通过横栏和总菜单进入，各自保留阅读位置；详情区分解析和来源，媒体按实际比例呈现。问一问保留草稿、停止和失败重试，正文引用就地打开资料，长问题可多行编辑。作品集以分类数量和图片浏览组织独立 API 内容，工具与网站介绍采用原生返回；关于我使用已发布个人介绍。

FIRST VIEWPORT：对照当前 iOS，首页仅紧凑头像、姓名与横向栏目导航，直接接内容流；完整介绍位于关于页。底部四项图标导航：动态、问一问、作品集、关于我。新闻两行题名与两行摘要，元信息为相对时间与来源。问答采用独立问题胶囊与柔和底色紧凑输入区。切栏目保留各自结果，详情原生返回。来源出口明确为复制链接。

FORM：用户指定 iOS 功能结构，在既有视觉世界中适配微信原生页面；code-led；seed: none (user-pinned)。轻量加载反馈服务真实请求，不新增强制开场仪式。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 验证边界

需覆盖分页、刷新、筛选、详情、Ask 分块中文解码与取消、引用返回、作品集合、窄屏和横屏。微信 AppID、合法域名、后台类目及发布审核属于真实账号的上线条件；本地验证必须与真实发布明确区分。
