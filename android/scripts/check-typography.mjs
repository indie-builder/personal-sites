import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../app/src/main/java/cn/lovemyrmb/personalsite');
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]); }
for (const path of walk(root).filter(path => path.endsWith('.kt') && !path.endsWith('/theme/Theme.kt'))) {
  const source = readFileSync(path, 'utf8');
  assert.ok(!/\b(?:fontSize|lineHeight|letterSpacing|fontFamily)\s*=/.test(source), `Page-level typography override: ${path}`);
  assert.ok(!/FontFamily\.Monospace|Typeface\.MONOSPACE/.test(source), `Unapproved font family: ${path}`);
}
const theme = readFileSync(join(root, 'ui/theme/Theme.kt'), 'utf8');
assert.match(theme, /typography = SiteTypography/);
assert.match(theme, /fontFamily = FontFamily.SansSerif, letterSpacing = 0.sp/);
console.log('PASS: native typography is centralized and Material components share the theme');
