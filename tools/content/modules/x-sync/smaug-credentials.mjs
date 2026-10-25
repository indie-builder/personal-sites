import { readFileSync } from "node:fs";

/** 读取本机 smaug 登录态；环境变量优先，缺失时直接失败且不输出凭据。 */
export function readSmaugCredentials(configPath, env = process.env) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const authToken = env.AUTH_TOKEN ?? config.twitter?.authToken ?? "";
  const ct0 = env.CT0 ?? config.twitter?.ct0 ?? "";
  if (!authToken || !ct0) {
    throw new Error("smaug 配置中缺少 X 登录态（auth_token 或 ct0）。");
  }
  return { authToken, ct0 };
}
