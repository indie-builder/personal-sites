import "@tanstack/react-start/server-only";

import { openArchive } from "@site/public-data/ai-news/archive.mjs";

import { loadBundledData, resolveLocalDataFile } from "@/lib/bundled-file";

// 插件与 SSR 渲染器是独立 bundle，单例挂 globalThis 跨 bundle 共享。
const globalStore = globalThis as typeof globalThis & { __siteAiNewsArchive?: ReturnType<typeof openArchive> };

/**
 * 与公开数据库同一初始化契约：函数运行时先经启动插件 await 本函数（加载内联
 * 字节），之后同步 getter 直接可用。openArchive 接受 Buffer 开库。
 */
export async function ensureAiNewsArchive(): Promise<ReturnType<typeof openArchive>> {
  if (!globalStore.__siteAiNewsArchive) {
    const localFile = resolveLocalDataFile("ai-news.sqlite");
    if (localFile) {
      globalStore.__siteAiNewsArchive = openArchive(localFile);
    } else {
      const bundled = await loadBundledData();
      if (!bundled) throw new Error("缺少 data/ai-news.sqlite：本地请先运行 prepare-data 生成投影。");
      globalStore.__siteAiNewsArchive = openArchive(bundled.aiNews);
    }
  }
  return globalStore.__siteAiNewsArchive;
}

/** 同步读取：本地模式懒开库；函数运行时依赖启动预热。 */
export function getAiNewsArchive() {
  let archive = globalStore.__siteAiNewsArchive;
  if (!archive) {
    const localFile = resolveLocalDataFile("ai-news.sqlite");
    if (!localFile) throw new Error("每日动态归档尚未初始化：服务端启动时需先 await ensureAiNewsArchive()。");
    archive = globalStore.__siteAiNewsArchive = openArchive(localFile);
  }
  return archive;
}
