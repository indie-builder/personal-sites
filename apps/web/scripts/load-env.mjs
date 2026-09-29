import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

loadLocalEnv(fileURLToPath(new URL("../../../", import.meta.url)));
