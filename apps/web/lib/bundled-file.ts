import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 公开数据文件的运行时定位。
 *
 * - dev / vitest：cwd 相对（prepare-data 复制到 `data/`），与 @site/public-data 的
 *   cwd 契约一致。
 * - 部署产物：bundle-server-assets.mjs 把 `data/` 拷进 `.output/server/`，
 *   以模块自身位置向上定位（函数 cwd 无论如何设置都能找到）。
 */
export function resolvePublicDataFile(name: string): string {
  const local = path.join(process.cwd(), "data", name);
  if (existsSync(local)) return local;

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8 && dir !== path.dirname(dir); i++) {
    const candidate = path.join(dir, "data", name);
    if (existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error(`缺少公开数据文件 ${name}：本地请先运行 prepare-data 生成投影，部署产物需包含 data 目录（bundle-server-assets）。`);
}

/** OG 分享图内嵌字体的运行时定位（同一套候选：cwd → 产物内 assets/fonts）。 */
export function resolveBundledFontFile(name: string): string {
  const local = path.join(process.cwd(), "assets", "fonts", name);
  if (existsSync(local)) return local;

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8 && dir !== path.dirname(dir); i++) {
    const candidate = path.join(dir, "assets", "fonts", name);
    if (existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error(`缺少内嵌字体 ${name}：部署产物需包含 assets/fonts（bundle-server-assets）。`);
}
