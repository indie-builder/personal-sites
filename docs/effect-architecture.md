# Effect 开发规则

本项目的 TypeScript/JavaScript 业务 I/O 和异步流程默认使用 Effect。当前统一固定 `effect@4.0.0`（稳定版），升级时一起更新所有工作区与 lockfile。

## 边界

| 层 | 规则 |
| --- | --- |
| `packages/effect` | 只依赖 Effect；`io` 将 Promise/SDK 失败转为带原始 cause 的 `OperationError`，`attempt` 处理同步 I/O 的失败 |
| `packages/public-data` | 公开数据 Schema、SQLite、新闻同步/归档；异步业务接口直接返回 Effect |
| `apps/web/lib` | 查询、检索、限流、会话、模型调用返回 Effect；不在业务流程中启动独立运行时 |
| `tools/content/modules` | 同步、模型分析、索引、发布返回 Effect；任务并发由 Effect 管理 |
| Next / React / CLI / 测试 | Next / React / 测试入口执行 `Effect.runPromise`；Node CLI 使用 `@site/effect/cli` 的 `runCli` 响应 SIGINT/SIGTERM；将生命周期取消信号传入执行选项 |
| 纯计算与展示 | 排序、文本处理、格式化、React 状态、路由、CSS/Motion 保留普通函数和平台生命周期 |
| Swift / Kotlin / Python | 使用各自平台技术；通过公开 HTTP/SSE 接口与 Web 交互 |

小型 SDK/文件适配器可以内部使用 `async/await`，必须立即转换为 Effect；业务层不能保留同名 Promise 版本，也不能只给整条旧流程套一个 `tryPromise`。

## 组合与错误

```ts
import { Effect } from "effect";
import { io } from "@site/effect";

function readRemote(url: string) {
  return io("remote.read", async (signal) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

// Next / CLI / React 回调等入口执行。
const result = await Effect.runPromise(readRemote(url), { signal });
```

- 在 `Effect.gen` 中使用 `yield*` 组合业务 Effects；同步平台调用使用 `attempt`，原生 Promise/thenable 使用 `io`。
- 预期业务失败用 `Effect.fail` 或 `Data.TaggedError`；按业务含义使用 `catchTag` / `catch`。不要把中断恢复为正常成功，也不要全局吞掉缺陷。
- 输入、公开投影、上游响应、会话快照使用 Effect Schema；输出类型从 Schema 推导。同步读取边界可以用 `decodeUnknownSync`，业务流程使用 `decodeUnknownEffect`。
- HTTP 状态、JSON、SSE、脱敏日志由入口负责；内部错误 cause、密钥、会话与原始资料不能进入公开响应。

## 生命周期

- 并发使用 `Effect.all` / `Effect.forEach` 的明确并发上限；逐条失败收集在单个任务内处理，其他失败中断兄弟任务。
- 锁使用 `Semaphore` 模块。等待锁的任务被取消时，也必须释放等待计数和作用域资源。
- 数据库、临时目录、模型会话、子进程用 `acquireRelease` / `acquireUseRelease` 和 `Effect.scoped`；错误、中断与成功都执行清理。
- 超时使用 `timeoutOrElse`；等待使用 `Effect.sleep`。超时需要通过 AbortSignal 或 finalizer 停止真实底层操作。
- 重试使用明确的 Effect Schedule 和可重试错误条件。数据库写入、收费模型调用、已开始发送的 SSE 流不能默认自动重试；幂等性仍由业务设计保证。
- 原子文件替换与必要的数据提交可以使用小范围 `uninterruptible`；不能让整个网络同步任务不可取消。
- React 请求内复用使用 `cache(() => Effect.runSync(Effect.cached(program)))`；这里 `runSync` 只分配懒执行缓存，不执行 I/O。保持 ISR / `revalidate` 与 Next fetch 缓存策略。

## 验证

迁移后的调用方和测试使用 Effect 接口；覆盖失败、取消、并发上限与清理，继续使用现有 Vitest / Node / Playwright。运行根目录 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`，并按根 `AGENTS.md` 使用 ego lite 验证页面。同步、发布、索引、归档和 Supabase 写入命令不是测试。
