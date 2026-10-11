import { describe, expect, it } from "vitest";

import {
  ADVENTURE_CHAPTERS,
  ADVENTURE_LOOP_SECONDS,
  ADVENTURE_NATURAL_CAPACITY,
  ADVENTURE_STATIC_TIME,
  adventureState,
  writeAdventureFrame,
} from "@/components/particle-avatar-adventure";

function frame(time: number, count = 700) {
  const out = new Float32Array(count * 2);
  const scene = writeAdventureFrame(time, count, out);
  return { out, scene };
}

describe("writeAdventureFrame", () => {
  it("fills exactly count finite in-view points whatever the time", () => {
    for (const time of [0, 0.6, 5, 12, 37.3, 42, 73, 95, 99.999, ADVENTURE_LOOP_SECONDS, 123.456]) {
      for (const count of [1, 3, 700, 4000]) {
        const { out } = frame(time, count);
        expect(out).toHaveLength(count * 2);
        for (let i = 0; i < out.length; i += 1) {
          expect(Number.isFinite(out[i]), `time=${time} count=${count} i=${i}`).toBe(true);
          // 视口裁剪留 3px 内边距，坐标必然严格落在画布内。
          expect(out[i]).toBeGreaterThan(0);
          expect(out[i]).toBeLessThan(1);
        }
      }
    }
  });

  it("walks the ten chapters in order and wraps rounds each 100s loop", () => {
    ADVENTURE_CHAPTERS.forEach((chapter, i) => {
      expect(frame(5 + i * 10).scene.chapter).toBe(chapter);
      expect(frame(5 + i * 10).scene.round).toBe(1);
    });
    expect(frame(9.9999).scene.chapter).toBe("hurdle");
    expect(frame(10).scene.chapter).toBe("gap");
    expect(frame(ADVENTURE_LOOP_SECONDS - 0.0001).scene.chapter).toBe("gate");
    expect(frame(ADVENTURE_LOOP_SECONDS).scene).toMatchObject({ chapter: "hurdle", round: 2 });
    expect(frame(ADVENTURE_LOOP_SECONDS + 55).scene).toMatchObject({ chapter: "lift", round: 2 });
    // 定格帧契约：键盘/减少动态取第一段 5s。
    expect(frame(ADVENTURE_STATIC_TIME).scene).toMatchObject({ chapter: "hurdle", round: 1 });
  });

  it("is deterministic and leaves no buffer state between calls", () => {
    const first = frame(5).out;
    const again = frame(5).out;
    expect([...again]).toEqual([...first]);
    frame(55.7, 4000);
    frame(0.3, 1);
    const third = frame(5).out;
    expect([...third]).toEqual([...first]);
  });

  it("repeats the same scenery every full loop", () => {
    const a = frame(37.3).out;
    const b = frame(37.3 + ADVENTURE_LOOP_SECONDS).out;
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i += 97) {
      expect(Math.abs(b[i] - a[i])).toBeLessThan(1e-6);
    }
  });

  it("keeps natural points bounded across a dense sweep", () => {
    let max = 0;
    for (let t = 0; t < 110; t += 0.25) {
      const { scene } = frame(t);
      expect(scene.points).toBeGreaterThan(0);
      if (scene.points > max) max = scene.points;
    }
    // 伙伴 ≤621 点 + 三章同屏布景最密约 1600：缓冲余量不允许被顶满。
    expect(max).toBeLessThan(ADVENTURE_NATURAL_CAPACITY);
    expect(max).toBeGreaterThan(600);
  });

  it("renders ten distinct frames, one per chapter", () => {
    const frames = ADVENTURE_CHAPTERS.map((_, i) => frame(5 + i * 10).out);
    for (let i = 0; i < frames.length; i += 1) {
      for (let j = i + 1; j < frames.length; j += 1) {
        const differsAt = frames[i].findIndex((v, k) => frames[j][k] !== v);
        expect(differsAt, `chapters ${i} and ${j}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("leaves the broken bridge chapter without ground dots inside the pit", () => {
    // 断桥章地面只有两岸：pit 横向区间内不得出现地面点行（y≈195）。
    const { out } = frame(12);
    const groundY = 195 / 240;
    for (let i = 0; i < out.length; i += 2) {
      const x = out[i];
      const y = out[i + 1];
      if (Math.abs(y - groundY) <= 1 / 240) {
        expect(x < 0.57 || x > 0.93, `ground dot inside pit at x=${x}`).toBe(true);
      }
    }
  });
});

describe("adventureState physics", () => {
  it("hands the mascot from one chapter to the next at the seam", () => {
    expect(adventureState(9.9999).x).toBeGreaterThan(419);
    expect(adventureState(10.0001).x).toBeLessThan(1);
    expect(adventureState(1).y).toBe(192);
    expect(adventureState(1).pose).toBeGreaterThanOrEqual(0);
  });

  it("jumps the hurdle wall instead of clipping through it", () => {
    for (let t = 4.2; t < 7; t += 0.02) {
      const s = adventureState(t);
      if (s.x >= 144 && s.x <= 178) {
        // 墙块占 y∈[154,192]：越过墙段时脚部必须高于墙顶。
        expect(s.y, `t=${t}`).toBeLessThan(154);
      }
    }
    expect(adventureState(7).y).toBe(192);
  });

  it("stays airborne while crossing the broken bridge pit", () => {
    for (let t = 13; t < 17; t += 0.02) {
      const s = adventureState(t);
      if (s.x >= 130 && s.x <= 220) {
        expect(s.y, `t=${t}`).toBeLessThan(190);
      }
    }
  });

  it("climbs the stairs without sinking into the first step", () => {
    for (let t = 23; t < 26.9; t += 0.02) {
      const s = adventureState(t);
      if (s.x >= 128 && s.x <= 166) {
        expect(s.y, `t=${t}`).toBeLessThanOrEqual(166.5);
      }
    }
  });

  it("keeps the trailing foot above the last stair until it clears the edge", () => {
    for (let time = 25.88; time < 27; time += 0.01) {
      const state = adventureState(time);
      if (state.x - 10 < 242) expect(state.y).toBeLessThanOrEqual(114);
    }
  });

  it("crouches below the low door", () => {
    const crouching = adventureState(75);
    expect(crouching.crouch).toBeLessThan(0.5);
    expect(crouching.x).toBeGreaterThan(133);
    expect(crouching.x).toBeLessThan(239);
    expect(adventureState(73.1).crouch).toBeGreaterThan(crouching.crouch);
  });

  it("rides the moving platform at platform height", () => {
    const riding = adventureState(65);
    expect(riding.y).toBe(180);
    expect(riding.x).toBeGreaterThanOrEqual(146);
    expect(riding.x).toBeLessThanOrEqual(220);
  });

  it("clears the high wall on the spring launch", () => {
    for (let t = 84.44; t < 87; t += 0.02) {
      const s = adventureState(t);
      if (s.x >= 185 && s.x <= 215) {
        expect(s.y, `t=${t}`).toBeLessThan(133);
      }
    }
  });
});
