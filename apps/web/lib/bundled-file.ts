import { existsSync } from "node:fs";
import path from "node:path";

const localDataDir = path.join(process.cwd(), "data");

/** dev / vitest / 本地预览下的数据文件路径；函数运行时返回 null（走内联字节）。 */
export function resolveLocalDataFile(name: string): string | null {
  const local = path.join(localDataDir, name);
  return existsSync(local) ? local : null;
}

type BundledData = { curation: Buffer; aiNews: Buffer; font: Buffer };

// 插件与 SSR 渲染器是两个独立 bundle，模块级单例不共享；内联数据挂在 globalThis
// 上，保证启动插件加载后，渲染器内的同步 getter 读到同一份。
const globalStore = globalThis as typeof globalThis & { __siteBundledData?: BundledData };

/**
 * 加载内联数据字节（generated 模块由 prepare-data 生成，rolldown 会把它拆成懒加载
 * chunk：dev / vitest 走本地文件不会触发加载；Vercel 函数在启动插件里预热一次）。
 */
export async function loadBundledData(): Promise<BundledData | null> {
  if (resolveLocalDataFile("curation.sqlite")) return null;
  const loaded: BundledData = globalStore.__siteBundledData
    ?? (await import("../assets/bundle/bundled-data.generated.mjs").then((m) => ({
      curation: Buffer.from(m.curationDatabaseB64, "base64"),
      aiNews: Buffer.from(m.aiNewsArchiveB64, "base64"),
      font: Buffer.from(m.ogFontB64, "base64"),
    })));
  globalStore.__siteBundledData = loaded;
  return loaded;
}

/** 内联字体字节（未加载或本地模式时为 null，调用方落回磁盘路径）。 */
export function bundledFont(): Buffer | null {
  return globalStore.__siteBundledData?.font ?? null;
}
