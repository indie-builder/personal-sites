import { registerHooks } from "node:module";

/**
 * CLI 入口测试共用的模块 mock 机制：resolve 命中 matches(parentURL, specifier) 且
 * 说明符在 mockExports 中时，重写到 `${scheme}:${key}/…` 合成模块；合成导出从
 * globalThis[key] 读取，missingName 为 state 缺失的导出生成兜底表达式；
 * rewrite 额外把说明符重写到指定 URL（如带场景查询串的真实模块）。
 */
export function registerCliMocks({ key, scheme, matches, mockExports, missingName, rewrite }) {
  const sources = new Map();
  for (const [specifier, names] of mockExports) {
    sources.set(
      `${scheme}:${key}/${encodeURIComponent(specifier)}`,
      names.map((name) =>
        `export const ${name} = globalThis[${JSON.stringify(key)}].${missingName ? missingName(name) : name};`,
      ).join("\n"),
    );
  }
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      const rewritten = rewrite?.(specifier, context.parentURL);
      if (rewritten) return { url: rewritten, shortCircuit: true };
      if (matches(context.parentURL, specifier) && mockExports.has(specifier)) {
        return { url: `${scheme}:${key}/${encodeURIComponent(specifier)}`, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (sources.has(url)) return { format: "module", source: sources.get(url), shortCircuit: true };
      return nextLoad(url, context);
    },
  });
}
