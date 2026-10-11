import { describe, expect, it } from "vitest";

import {
  ARRIVE_DWELL_MS,
  FORM_MORPH_MS,
  FORM_STAGGER,
  FORM_STATIC_DWELL_MS,
  FUN_SHAPE_IDS,
  FUN_TRACKS,
  GESTURE_SHAPES,
  POSE_BACK_DWELL_MS,
  POSE_DWELL_MS,
  POSE_MORPH_MS,
  RETURN_MORPH_MS,
  RETURN_STAGGER,
  SHAPE_DRAW,
  SHAPE_POINT_MAX,
  SHAPE_POINT_MIN,
  SHAPE_SRC,
  buildShapeTargets,
  mulberry32,
  nextStaticForm,
  nextTrack,
  planSurpriseStages,
  sampleInkPoints,
  type FunShapeId,
  type FunTrack,
  type ShapeCtx,
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

// 固定序列的随机源：先耗尽给定值，再恒返回 fallback。
function seqRand(values: number[], fallback = 0.999) {
  let i = 0;
  return () => (i < values.length ? values[i++] : fallback);
}

function recorder() {
  const trace: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    trace.push(args.length ? `${name}:${args.join(",")}` : name);
  };
  const ctx: ShapeCtx = {
    beginPath: rec("beginPath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    bezierCurveTo: rec("bezier"),
    quadraticCurveTo: rec("quad"),
    closePath: rec("closePath"),
    arc: rec("arc"),
    ellipse: rec("ellipse"),
    roundRect: rec("roundRect"),
    fillRect: rec("fillRect"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    save: rec("save"),
    restore: rec("restore"),
    translate: rec("translate"),
    rotate: rec("rotate"),
    scale: rec("scale"),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "round",
    lineJoin: "round",
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

describe("surprise playlist", () => {
  it("covers all ten forms across the six curated tracks without inner repeats", () => {
    expect(FUN_TRACKS).toHaveLength(6);
    expect([...new Set(FUN_TRACKS.flat())].sort()).toEqual([...FUN_SHAPE_IDS].sort());
    for (const track of FUN_TRACKS) {
      expect(new Set(track).size).toBe(track.length);
    }
  });

  it("deals each track once per bag and never repeats a form adjacently across refills", () => {
    let bag: FunTrack[] | null = null;
    let last: FunShapeId | null = null;
    const seen: FunShapeId[] = [];
    const rand = mulberry32(0xc0ffee);
    for (let cycle = 0; cycle < 12; cycle += 1) {
      const dealt: string[] = [];
      for (let i = 0; i < FUN_TRACKS.length; i += 1) {
        const draw = nextTrack(bag, last, rand);
        bag = draw.bag;
        if (last !== null) expect(draw.track[0]).not.toBe(last);
        dealt.push(draw.track.join(">"));
        last = draw.track[draw.track.length - 1];
        seen.push(...draw.track);
      }
      expect(new Set(dealt).size).toBe(FUN_TRACKS.length);
    }
    expect([...new Set(seen)].sort()).toEqual([...FUN_SHAPE_IDS].sort());
  });

  it("never starts a refilled bag with the form just shown", () => {
    // 恒等洗牌（不交换）下首轨为 terminal 轨，用 lastForm=terminal 逼出换轨。
    expect(nextTrack([], "terminal", seqRand([])).track).toBe(FUN_TRACKS[1]);
    // 首抽把单形的吉祥物轨换到袋首（i=5 与 j=0 交换），边界保护必须把它换走。
    const mascotFirst = nextTrack([], "mascot", seqRand([0.1]));
    expect(mascotFirst.track[0]).not.toBe("mascot");
  });

  it("preserves a nonconflicting shuffle order at refill", () => {
    expect(nextTrack([], "robot", seqRand([])).track).toBe(FUN_TRACKS[0]);
  });

  it("avoids the actual last form when switching input modes before a bag is empty", () => {
    expect(nextTrack([FUN_TRACKS[0], FUN_TRACKS[1]], "terminal", seqRand([])).track).toBe(FUN_TRACKS[1]);
    expect(nextStaticForm(["robot", "plane"], "robot", seqRand([])).form).toBe("plane");
  });

  it("refills when the only remaining draw would repeat a displayed form", () => {
    expect(nextTrack([FUN_TRACKS[4]], "fish", seqRand([])).track[0]).not.toBe("fish");
    expect(nextTrack([FUN_TRACKS[5]], "mascot", seqRand([])).track[0]).not.toBe("mascot");
    expect(nextStaticForm(["robot"], "robot", seqRand([])).form).not.toBe("robot");
  });

  it("deals all forms in static mode without adjacent repeats", () => {
    let bag: readonly FunShapeId[] | null = null;
    let last: FunShapeId | null = null;
    const rand = mulberry32(42);
    const seen: FunShapeId[] = [];
    for (let draw = 0; draw < 90; draw += 1) {
      const got = nextStaticForm(bag, last, rand);
      if (last !== null) expect(got.form).not.toBe(last);
      last = got.form;
      bag = got.bag;
      seen.push(got.form);
    }
    expect([...new Set(seen)].sort()).toEqual([...FUN_SHAPE_IDS].sort());
  });

  it("never reuses the just-shown form at a static bag refill", () => {
    expect(nextStaticForm([], "terminal", seqRand([])).form).toBe("robot");
  });
});

describe("planSurpriseStages", () => {
  it("keeps every track, gestures included, under 4s with the return leg", () => {
    for (const track of FUN_TRACKS) {
      const stages = planSurpriseStages(track);
      const total = stages.reduce((sum, s) => sum + s.morphMs + s.stagger + s.dwellMs, 0) + RETURN_MORPH_MS + RETURN_STAGGER;
      expect(total).toBeGreaterThan(1500);
      expect(total).toBeLessThanOrEqual(4000);
      // 手势拍姿是同形的连续段，折叠后应恰好按轨道顺序访问各形态。
      const visited = stages.map((s) => s.shape).filter((shape, i, all) => i === 0 || shape !== all[i - 1]);
      expect(visited.join(",")).toBe(track.join(","));
      expect(stages[stages.length - 1].pose).toBe(0);
    }
  });

  it("gives gesture shapes one bounded alternate-pose beat and others a static dwell", () => {
    for (const shape of FUN_SHAPE_IDS) {
      const stages = planSurpriseStages([shape]);
      if (GESTURE_SHAPES.has(shape)) {
        expect(stages).toHaveLength(3);
        expect(stages[0]).toMatchObject({ pose: 0, morphMs: FORM_MORPH_MS, stagger: FORM_STAGGER, dwellMs: ARRIVE_DWELL_MS });
        expect(stages[1]).toMatchObject({ pose: 1, morphMs: POSE_MORPH_MS, stagger: 0, dwellMs: POSE_DWELL_MS });
        expect(stages[2]).toMatchObject({ pose: 0, morphMs: POSE_MORPH_MS, stagger: 0, dwellMs: POSE_BACK_DWELL_MS });
      } else {
        expect(stages).toHaveLength(1);
        expect(stages[0]).toMatchObject({ pose: 0, morphMs: FORM_MORPH_MS, stagger: FORM_STAGGER, dwellMs: FORM_STATIC_DWELL_MS });
      }
    }
  });
});

describe("SHAPE_DRAW silhouettes", () => {
  const traceOf = (id: FunShapeId, pose: 0 | 1) => {
    const { ctx, trace } = recorder();
    SHAPE_DRAW[id](ctx, pose);
    return trace;
  };

  it("draws each form as a distinct silhouette with finite coordinates inside the raster box", () => {
    // 仅坐标类指令受栅格边界约束；rotate/scale 的参数是角度与比例。
    const coordCommands = new Set(["moveTo", "lineTo", "bezier", "quad", "arc", "ellipse", "roundRect", "fillRect"]);
    const traces = FUN_SHAPE_IDS.map((id) => traceOf(id, 0).join("|"));
    expect(new Set(traces).size).toBe(FUN_SHAPE_IDS.length);
    for (const id of FUN_SHAPE_IDS) {
      const trace = traceOf(id, 0);
      expect(trace.some((entry) => ["fill", "stroke", "fillRect"].includes(entry.split(":")[0]))).toBe(true);
      for (const entry of trace) {
        const name = entry.split(":")[0];
        if (!coordCommands.has(name)) continue;
        for (const value of entry.match(/-?\d+(?:\.\d+)?/g) ?? []) {
          const n = Number(value);
          expect(Number.isFinite(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(SHAPE_SRC);
        }
      }
    }
  });

  it("changes geometry for gesture poses and stays identical for static forms", () => {
    for (const id of FUN_SHAPE_IDS) {
      const base = traceOf(id, 0).join("|");
      const alt = traceOf(id, 1).join("|");
      expect(alt === base).toBe(!GESTURE_SHAPES.has(id));
    }
  });

  it("redraws the assistant sprite pixels with its own two feet frames as the pose", () => {
    const fillRects = (pose: 0 | 1) => traceOf("mascot", pose).filter((entry) => entry.startsWith("fillRect:"));
    const expected = (rects: readonly SpriteRect[]) => rects.map(([x, y, width, height]) => `fillRect:${x},${y},${width},${height}`);
    expect(fillRects(0)).toEqual([...expected(SPRITE_BODY_RECTS), ...expected(SPRITE_FEET_A_RECTS)]);
    expect(fillRects(1)).toEqual([...expected(SPRITE_BODY_RECTS), ...expected(SPRITE_FEET_B_RECTS)]);
  });

  it("fits the mascot inside the sampling bounds at a pixel-aligned uniform scale", () => {
    const trace = traceOf("mascot", 0);
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

describe("buildShapeTargets", () => {
  it("degrades to no shapes when the raster context is unavailable", () => {
    // jsdom 无 2D 上下文：全部形态缺位时点击彩蛋应当静默不可用。
    expect(buildShapeTargets(120)).toEqual({});
  });
});
