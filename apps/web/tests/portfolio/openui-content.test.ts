// @vitest-environment node
import assert from "node:assert/strict";
import { test } from "vitest";

import { uniqueOpenUiReferences } from "../../lib/portfolio/openui-content";

type Node = { type: "element"; statementId?: string; props: Record<string, unknown> };

test("same OpenUI statement referenced in a card and root renders once", () => {
  const next: Node = { type: "element", statementId: "next", props: { label: "帮我选一个" } };
  const children: unknown[] = [
    { type: "element", statementId: "card", props: { title: "方案对比", children: [next] } },
    next,
  ];
  const result = uniqueOpenUiReferences(children) as Node[];
  assert.equal(result.length, 1);
  const cardChildren = result[0]!.props.children as Node[];
  assert.equal(cardChildren.length, 1);
  assert.equal(cardChildren[0]!.props.label, "帮我选一个");
  assert.equal((children as Node[]).length, 2, "original model response is preserved");
  assert.deepEqual(uniqueOpenUiReferences(children), result, "each render starts a new reference scope");
});

test("same labels with distinct statement IDs remain separate", () => {
  const result = uniqueOpenUiReferences([
    { type: "element", statementId: "a", props: { label: "继续" } },
    { type: "element", statementId: "b", props: { label: "继续" } },
  ]) as Node[];
  assert.equal(result.length, 2);
});

test("ordinary values and partially streamed nodes are preserved", () => {
  const value = [
    { type: "element", props: { children: ["相同", "相同", null] } },
    { type: "element", props: { label: "未完成" } },
  ];
  assert.deepEqual(uniqueOpenUiReferences(value), value);
});
