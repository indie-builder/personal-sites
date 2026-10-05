/** 仓库根目录；scripts/lib 距仓库根四级，脚本入口距三级。 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
