import "@tanstack/react-start/server-only";

import Database from "better-sqlite3";
import { Schema } from "effect";

import { resolvePublicDataFile } from "@/lib/bundled-file";

export const contentJsonRowSchema = Schema.Struct({ content_json: Schema.String.check(Schema.isMinLength(1)) });

let database: Database.Database | undefined;

export function getPublicDatabase() {
  database ??= new Database(resolvePublicDataFile("curation.sqlite"), { fileMustExist: true, readonly: true });
  return database;
}
