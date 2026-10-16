import "@tanstack/react-start/server-only";

import Database from "better-sqlite3";
import { Schema } from "effect";

import { loadBundledData, resolveLocalDataFile } from "@/lib/bundled-file";

export const contentJsonRowSchema = Schema.Struct({ content_json: Schema.String.check(Schema.isMinLength(1)) });

// 插件与 SSR 渲染器是独立 bundle，单例挂 globalThis 跨 bundle 共享。
const globalStore = globalThis as typeof globalThis & { __sitePublicDatabase?: Database.Database };

/**
 * 函数运行时须在启动插件中先 await 本函数（内联字节加载）；dev / vitest / 本地
 * 预览无字节可载，直接按 cwd 文件打开。
 */
export async function ensurePublicDatabase(): Promise<Database.Database> {
  if (!globalStore.__sitePublicDatabase) {
    const localFile = resolveLocalDataFile("curation.sqlite");
    if (localFile) {
      globalStore.__sitePublicDatabase = new Database(localFile, { fileMustExist: true, readonly: true });
    } else {
      const bundled = await loadBundledData();
      if (!bundled) throw new Error("缺少 data/curation.sqlite：本地请先运行 prepare-data 生成投影。");
      globalStore.__sitePublicDatabase = new Database(bundled.curation, { readonly: true });
    }
  }
  return globalStore.__sitePublicDatabase;
}

/** 同步读取：本地模式懒开库（dev/vitest/本地预览）；函数运行时依赖启动预热，
 * 未预热即调用属于编程错误。 */
export function getPublicDatabase(): Database.Database {
  let database = globalStore.__sitePublicDatabase;
  if (!database) {
    const localFile = resolveLocalDataFile("curation.sqlite");
    if (!localFile) throw new Error("公开数据库尚未初始化：服务端启动时需先 await ensurePublicDatabase()。");
    database = globalStore.__sitePublicDatabase = new Database(localFile, { fileMustExist: true, readonly: true });
  }
  return database;
}
