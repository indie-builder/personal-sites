# 微信小程序

模式：Read；问一问为 Operate。面向微信内的日常阅读者与初次访客，参考 iOS 客户端，读取既有公开内容接口。

## Direction contract

THESIS：让读者在微信内直接阅读陈远的动态、策展与开源判断，完成提问并核对引用。以连续内容流为核心。

OWN-WORLD：继承站点黑白灰、系统字体、细分割线与真实头像。正文 15–16px、辅助 12–13px，触达区域至少 44px；使用微信原生导航和安全区。

STORY：首页看身份与五栏目，进入详情区分解析和来源；问一问保留草稿、停止和失败重试；作品集读取既有独立站点公开接口，关于我使用已发布个人介绍。

FIRST VIEWPORT：首页紧凑头像与姓名、介绍，下接横向栏目导航与当前内容流。底部四项导航：动态、问一问、作品集、关于我。切栏目保留各自结果，详情原生返回。来源出口明确为复制链接。

FORM：用户指定 iOS 功能结构，在既有视觉世界中适配微信原生页面；code-led；seed: none (user-pinned)。轻量加载反馈服务真实请求，不新增强制开场仪式。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 验证边界

需覆盖分页、刷新、筛选、详情、Ask 分块中文解码与取消、引用返回、作品集合、窄屏和横屏。微信 AppID、合法域名、后台类目及发布审核属于真实账号的上线条件；本地验证必须与真实发布明确区分。
