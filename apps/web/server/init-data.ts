import { definePlugin } from "nitro";

import { ensureAiNewsArchive } from "@/lib/ai-news-archive.server";
import { ensurePublicDatabase } from "@/lib/public-database";

// 函数冷启动时预热内联数据（字节 chunk 首次加载 + 开库），请求期的同步 getter
// 从此可用。本地 dev / 预览为无字节模式的空操作。
export default definePlugin(async () => {
  await ensurePublicDatabase();
  await ensureAiNewsArchive();
});
