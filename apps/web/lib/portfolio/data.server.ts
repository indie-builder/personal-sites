import "server-only";

import path from "node:path";

import Database from "better-sqlite3";
import { existsSync } from "node:fs";

export const PORTFOLIO_DATABASE_PATH = path.join(process.cwd(), "data/portfolio.sqlite");

let database: Database.Database | undefined;

export function getPortfolioDatabase() {
  if (!existsSync(PORTFOLIO_DATABASE_PATH)) {
    throw new Error("缺少 data/portfolio.sqlite；请先生成作品集公开投影。");
  }
  database ??= new Database(PORTFOLIO_DATABASE_PATH, { fileMustExist: true, readonly: true });
  return database;
}
