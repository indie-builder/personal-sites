# 问答模型配置

公开 `/api/ask` 使用 AI SDK 的 `streamText` 与 Anthropic Provider，连接 BigModel 的兼容接口：

- Provider：`@ai-sdk/anthropic`，使用智谱兼容端点
- Base URL：`https://open.bigmodel.cn/api/anthropic/v1`
- 默认模型：`glm-5.3-flash`，通过服务端 `ASK_MODEL` 覆盖
- 凭据：服务端 `BIGMODEL_API_KEY`，仅置于本地忽略的 `.env.local` 或部署平台的加密环境变量

问答保留 `/api/ask` 的 `sources`、`text`、`done`、`error` SSE 契约。检索公开资料后，AI SDK 接收本轮资料包、历史问答与可选的历史摘要；历史超过 64,000 字符时自动总结较早轮次并保留最近四轮原文。阈值可用服务端 `ASK_COMPACT_AFTER_CHARACTERS` 调整；压缩失败不覆盖原会话。会话以一行 JSON 格式的 NDJSON 保存于私有 Supabase Storage，本地开发保存在 `var/ask-sessions/`。问答不加载 Pi、工具或技能。X、GitHub Star、抖音的离线资料解析仍使用 Pi 运行时和同一 `BIGMODEL_API_KEY`。

统一默认模型由 `BIGMODEL_MODEL` 配置；问答可用 `ASK_MODEL` 指定另一款 GLM。不回退到其他供应商或按量端点。

旧供应商的读取函数、快捷命令和本地凭据已移除。缺少智谱 Key 时直接报错；模型只接受 `glm-*`，旧 `PI_PROVIDER` / `PI_MODEL` 不再生效。部署平台的旧模型环境变量也应移除。`curation:sync:glm` 是新的快捷命令；历史内容中的模型出处不改写。

Android 与 Web 都只请求站点 `/api/ask`，不持有模型 Key。修改本地配置不会改变已部署的服务；上线时需同步服务端环境变量并重新部署。客户端无需因模型切换更新 APK。

API 连通不代表套餐抵扣已验证；实际额度归属以供应商账户账单为准。
