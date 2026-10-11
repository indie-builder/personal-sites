import { copyFileSync, mkdirSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Only approved public snapshots enter the Web deployment. Never copy the data directory recursively.
const destination = new URL("../data/", import.meta.url);
mkdirSync(destination, { recursive: true });
for (const name of ["curation.sqlite", "ai-news.sqlite", "portfolio.sqlite"]) {
  const source = new URL(`../../../data/${name}`, import.meta.url);
  const target = new URL(name, destination);
  const temporary = `${fileURLToPath(target)}.${process.pid}.tmp`;
  copyFileSync(source, temporary);
  renameSync(temporary, target);
}
