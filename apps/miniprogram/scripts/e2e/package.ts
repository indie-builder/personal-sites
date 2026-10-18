import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const routes = ["home", "ask", "portfolio", "about", "detail", "collection", "work", "project"].map((name) => `pages/${name}/index`);

export function packageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? packageFiles(path.join(directory, entry.name)).map((name) => `${entry.name}/${name}`) : [entry.name]);
}

export function verifyPackage(directory = path.join(root, "dist")): void {
  const app = JSON.parse(readFileSync(path.join(directory, "app.json"), "utf8"));
  assert.deepEqual([...app.pages].sort(), [...routes].sort());
  const expected = ["app.js", "encoding.js", "lib/runtime.js", "app.json", "app.wxss", "theme.json", "sitemap.json", "assets/avatar.png",
    ...["home", "ask", "portfolio", "about"].flatMap(name => ["muted", "light", "dark"].map(tone => `assets/navigation/${name}-${tone}.png`)),
    ...routes.flatMap((route) => ["js", "json", "wxml", "wxss"].map((extension) => `${route}.${extension}`))];
  const actual = packageFiles(directory);
  assert.deepEqual(actual.sort(), expected.sort(), "dist must contain only the public package whitelist");
  assert(actual.reduce((bytes, name) => bytes + statSync(path.join(directory, name)).size, 0) <= 2 * 1024 * 1024, "main package exceeds 2 MiB");
  for (const name of actual.filter((name) => /\.(js|json|wxml|wxss)$/.test(name))) {
    const content = readFileSync(path.join(directory, name), "utf8");
    assert(!/(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]+|sk-proj-[A-Za-z0-9_-]+)/.test(content), `secret material in ${name}`);
    assert(!/(?:data\/sensitive|knowledge\/sensitive|tools\/smaug\/\.state)/.test(content), `sensitive path in ${name}`);
  }
}
