import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const forbidden = () => assert.fail("unexpected remote call");
export const content = { expandUrl: forbidden, fetchGithubRepo: forbidden, fetchArticleText: forbidden, collectDesignEvidenceImages: forbidden };

export async function withQueue(items, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-enrich-"));
  const queuePath = path.join(directory, "queue.json");
  const bytes = `${JSON.stringify({ version: 1, items }, null, 2)}\n`;
  const logs = [];
  const logger = { log: (line) => logs.push(line), error: (line) => logs.push(line) };
  try {
    await writeFile(queuePath, bytes);
    await run({ queuePath, bytes, logs, logger });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
