import assert from "node:assert/strict";
import type { AppService } from "./app-service";

export const site = "https://default-coder.lovemyrmb.cn";
export const portfolio = "https://portfolio.default-coder.lovemyrmb.cn";
export const date = "2026-10-18T08:00:00.000Z";
export type Options = Record<string, any>;
export const tap = (dataset: Options) => ({ currentTarget: { dataset }, detail: {} });

export async function settled(check: () => boolean, description: string) {
  for (let turn = 0; turn < 100; turn++) {
    if (check()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail(`AppService did not settle: ${description}`);
}

export async function nextRequest(harness: AppService, pathname: string) {
  await settled(() => harness.requests.some((request) => !request.settled && !request.aborted && new URL(request.options.url).pathname === pathname), pathname);
  return harness.requests.find((request) => !request.settled && !request.aborted && new URL(request.options.url).pathname === pathname)!;
}
