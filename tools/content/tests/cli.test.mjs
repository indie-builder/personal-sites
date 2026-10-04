import assert from "node:assert/strict";
import test from "node:test";
import { parseCliOptions } from "../scripts/lib/cli.mjs";

for (const inline of [false, true]) {
  const argsFor = (value) => inline ? [`--limit=${value}`] : ["--limit", value];
  const syntax = inline ? "--limit=value" : "--limit value";

  test(`integer options accept safe positive decimal values with ${syntax}`, () => {
    for (const value of ["1", String(Number.MAX_SAFE_INTEGER)]) {
      assert.equal(parseCliOptions(argsFor(value), { "--limit": "int" }).limit, Number(value));
    }
  });

  test(`integer options reject malformed and unsafe values with ${syntax}`, () => {
    for (const value of ["2.5", "2junk", "1e3", "9007199254740993", "9007199254740992", "0", "-1", "", "+1", " 1", "1 "]) {
      assert.throws(
        () => parseCliOptions(argsFor(value), { "--limit": "int" }),
        { message: "--limit 必须是大于 0 的整数。" },
        `value: ${JSON.stringify(value)}`,
      );
    }
  });
}
