// 设计工程工具目录解析：实体解码、外链过滤与同分类去重。

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCatalog } from "../modules/portfolio/design-engineer-tools/sync.ts";

const html = `
<h2>灵感 Inspiration</h2>
<a href="https://60fps.design/">60<span>fps</span></a>
<a href="https://excalidraw.com/">Excalidraw&nbsp;白板</a>
<a href="/relative">相对链接</a>
<a href="https://60fps.design/">60fps 重复</a>
<h2>组件 Components</h2>
<a href="https://ui.example/?a=1&amp;b=2">A&quot;B&quot;</a>
<footer><a href="https://footer.example/">页脚</a></footer>
`;

test("解析分类、解码实体、过滤非 https 与去重", () => {
  const categories = parseCatalog(html);
  assert.deepEqual(
    categories.map((category) => category.id),
    ["灵感 Inspiration", "组件 Components"],
  );
  assert.deepEqual(
    categories[0].tools.map((tool) => tool.name),
    ["60fps", "Excalidraw 白板"],
  );
  // 最后一个分类以页脚收尾；页脚链接不进目录。URL 保持上游原样不解码。
  assert.deepEqual(categories[1].tools, [
    { name: 'A"B"', url: "https://ui.example/?a=1&amp;b=2" },
  ]);
});

test("同一 URL 允许出现在不同分类，仅在分类内去重", () => {
  const categories = parseCatalog(
    `<h2>A</h2><a href="https://same.example/">同</a><h2>B</h2><a href="https://same.example/">同</a>`,
  );
  assert.equal(categories.length, 2);
  assert.equal(categories[0].tools.length, 1);
  assert.equal(categories[1].tools.length, 1);
});
