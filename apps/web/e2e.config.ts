import { createAnthropic } from "@ai-sdk/anthropic";
import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BIGMODEL_BASE_URL, requireBigModelApiKey, resolveBigModel } from "../../config/bigmodel.mjs";

// e2e 不读取任何 .env 文件；模型 key 从仓库根 .env.local 注入（已导出的 shell 变量优先）。
const envLocalPath = fileURLToPath(new URL("../../.env.local", import.meta.url));
if (existsSync(envLocalPath)) process.loadEnvFile(envLocalPath);

const hasBigModelKey = Boolean(process.env.BIGMODEL_API_KEY?.trim());

export default {
  // 宽匹配一次定型：波次搬迁只增删 e2e/*.e2e.ts 文件，零配置改动。
  tests: ["e2e/*.e2e.ts", "e2e/agent/**/*.e2e.ts"],
  targets: [
    {
      engine: web(),
      app: {
        url: "http://127.0.0.1:7100/curation",
        command: {
          executable: "pnpm",
          args: ["start", "--port", "7100"],
          // 不复用 7100 上已在跑的服务器：冒烟必须验证当前构建，端口被占就以 APP_ALREADY_RUNNING 显式失败。
          log: ".e2e/logs/app.log",
        },
      },
    },
  ],
  // 缺 BIGMODEL_API_KEY 时省略 agents，配合用例注册期的 skip 选项优雅跳过，而不是配置加载即失败。
  ...(hasBigModelKey
    ? {
        agents: {
          default: {
            model: createAnthropic({
              baseURL: `${BIGMODEL_BASE_URL}/v1`,
              apiKey: requireBigModelApiKey(),
            })(resolveBigModel(process.env.ASK_MODEL)),
            context:
              "站点是中文个人网站「陈远小站」。左侧身份栏导航里「每日关注」是精选剪报流，「开源关注」是开源仓库列表，界面文案均为中文。",
          },
        },
      }
    : {}),
} satisfies E2EConfig;
