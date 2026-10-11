import { describe, expect, it } from "vitest";

import {
  SHAPE_POINT_MAX,
  SHAPE_POINT_MIN,
  SHAPE_SRC,
  buildMascotTargets,
  drawMascot,
  mulberry32,
  sampleInkPoints,
  type MascotCtx,
} from "@/components/particle-avatar-shapes";
import {
  SPRITE_BODY_RECTS,
  SPRITE_FEET_A_RECTS,
  SPRITE_FEET_B_RECTS,
  type SpriteRect,
} from "@/components/assistant-sprite-geometry";

function inkRgba(side: number, points: Array<[number, number, "ink" | "white"]>): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (const [x, y, kind] of points) {
    const i = (y * side + x) * 4;
    const value = kind === "ink" ? 0 : 255;
    rgba[i] = value;
    rgba[i + 1] = value;
    rgba[i + 2] = value;
    rgba[i + 3] = 255;
  }
  return rgba;
}

function recorder() {
  const trace: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    trace.push(args.length ? `${name}:${args.join(",")}` : name);
  };
  const ctx: MascotCtx = {
    fillRect: rec("fillRect"),
    save: rec("save"),
    restore: rec("restore"),
    translate: rec("translate"),
    scale: rec("scale"),
    fillStyle: "",
  };
  return { ctx, trace };
}

describe("sampleInkPoints", () => {
  const side = 8;

  it("returns exactly count finite points clamped into [.08,.92] whatever the ink", () => {
    // 墨点落在画布极角，归一后越界，由夹紧保证目标点始终有界。
    const points = sampleInkPoints(inkRgba(side, [[0, 0, "ink"], [7, 7, "ink"]]), side, 40, mulberry32(1))!;
    expect(points).toHaveLength(80);
    for (let i = 0; i < points.length; i += 1) {
      expect(Number.isFinite(points[i])).toBe(true);
      expect(points[i]).toBeGreaterThanOrEqual(SHAPE_POINT_MIN);
      expect(points[i]).toBeLessThanOrEqual(SHAPE_POINT_MAX);
    }
  });

  it("is deterministic for the same ink and random sequence", () => {
    const ink = inkRgba(side, [
      [1, 1, "ink"],
      [2, 3, "ink"],
      [5, 6, "ink"],
    ]);
    const first = sampleInkPoints(ink, side, 30, mulberry32(9))!;
    const second = sampleInkPoints(ink, side, 30, mulberry32(9))!;
    expect([...second]).toEqual([...first]);
  });

  it("treats white paint as non-ink and fails on empty ink", () => {
    expect(sampleInkPoints(inkRgba(side, [[3, 3, "white"]]), side, 10, mulberry32(1))).toBeNull();
    expect(sampleInkPoints(new Uint8ClampedArray(side * side * 4), side, 10, mulberry32(1))).toBeNull();
  });
});

describe("drawMascot", () => {
  const traceOf = (pose: 0 | 1) => {
    const { ctx, trace } = recorder();
    drawMascot(ctx, pose);
    return trace;
  };

  it("redraws the assistant sprite pixels with its own two feet frames as the pose", () => {
    const fillRects = (pose: 0 | 1) => traceOf(pose).filter((entry) => entry.startsWith("fillRect:"));
    const expected = (rects: readonly SpriteRect[]) => rects.map(([x, y, width, height]) => `fillRect:${x},${y},${width},${height}`);
    expect(fillRects(0)).toEqual([...expected(SPRITE_BODY_RECTS), ...expected(SPRITE_FEET_A_RECTS)]);
    expect(fillRects(1)).toEqual([...expected(SPRITE_BODY_RECTS), ...expected(SPRITE_FEET_B_RECTS)]);
  });

  it("changes only the feet between the two poses", () => {
    const feet = new Set([...SPRITE_FEET_A_RECTS, ...SPRITE_FEET_B_RECTS].map(([x, y, w, h]) => `fillRect:${x},${y},${w},${h}`));
    const withoutFeet = (pose: 0 | 1) => traceOf(pose).filter((entry) => !entry.startsWith("fillRect:") || !feet.has(entry));
    expect(withoutFeet(1)).toEqual(withoutFeet(0));
  });

  it("fits the mascot inside the sampling bounds at a pixel-aligned uniform scale", () => {
    const trace = traceOf(0);
    const translate = trace.find((entry) => entry.startsWith("translate:"))!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const scale = trace.find((entry) => entry.startsWith("scale:"))!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    // 等比缩放保持 27:32 原始宽高比，整数倍保持像元对齐不产生半覆盖像素。
    expect(scale[0]).toBe(scale[1]);
    expect(Number.isInteger(scale[0])).toBe(true);
    for (const [x, y, width, height] of [...SPRITE_BODY_RECTS, ...SPRITE_FEET_A_RECTS, ...SPRITE_FEET_B_RECTS]) {
      expect(translate[0] + x * scale[0]).toBeGreaterThanOrEqual(SHAPE_SRC * SHAPE_POINT_MIN);
      expect(translate[0] + (x + width) * scale[0]).toBeLessThanOrEqual(SHAPE_SRC * SHAPE_POINT_MAX);
      expect(translate[1] + y * scale[1]).toBeGreaterThanOrEqual(SHAPE_SRC * SHAPE_POINT_MIN);
      expect(translate[1] + (y + height) * scale[1]).toBeLessThanOrEqual(SHAPE_SRC * SHAPE_POINT_MAX);
    }
  });
});

describe("buildMascotTargets", () => {
  it("degrades to no targets when the raster context is unavailable", () => {
    // jsdom 无 2D 上下文：目标缺位时伙伴静默不可用，头像本体不受影响。
    expect(buildMascotTargets(120)).toBeNull();
    expect(buildMascotTargets(0)).toBeNull();
  });
});
