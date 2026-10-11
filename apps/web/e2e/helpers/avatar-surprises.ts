import type { Browser } from "@e2e-dev/web";

// 短停留可能被跨进程轮询漏掉，形态与像素在页内记录。
export const FUN_SHAPES = ["terminal", "robot", "infinity", "planet", "plane", "spark", "sprout", "smile", "fish"] as const;

export type AvatarStageEvent = { shape: string; state: string; t: number };
export type AvatarStageLog = { events: AvatarStageEvent[]; pixels: Record<string, string[]> };
export type AvatarMeta = { label: string | null; shape: string | null; state: string | null };

function avatarStageRecorder(): boolean {
  const w = window as typeof window & { __avatarStages?: AvatarStageLog };
  if (w.__avatarStages) return true;
  const button = document.querySelector<HTMLElement>(".curation-home__avatar");
  const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
  if (!button || !canvas) return false;
  const log: AvatarStageLog = { events: [], pixels: {} };
  w.__avatarStages = log;
  let lastKey = "";
  const record = () => {
    const state = button.dataset.avatarState ?? "";
    const shape = button.dataset.avatarShape ?? "";
    const key = `${state}|${shape}`;
    if (key === lastKey) return;
    lastKey = key;
    log.events.push({ t: Math.round(performance.now()), shape, state });
  };
  record();
  new MutationObserver(record).observe(button, { attributes: true, attributeFilter: ["data-avatar-state", "data-avatar-shape"] });
  const digest = (url: string) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < url.length; i += 1) {
      h ^= url.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  };
  // 定格形连续 3 帧后采样一次指纹，之后每 ~30 帧复核（姿态微变会新增摘要）。
  let held = "";
  let frames = 0;
  const stopAt = performance.now() + 60_000;
  const tick = () => {
    if (performance.now() > stopAt) return;
    const shape = button.dataset.avatarShape ?? "";
    if (shape && shape !== "transition") {
      if (shape === held) frames += 1;
      else {
        held = shape;
        frames = 1;
      }
      if (frames >= 3 && (frames - 3) % 30 === 0) {
        const d = digest(canvas.toDataURL());
        const list = log.pixels[shape] ?? (log.pixels[shape] = []);
        if (!list.includes(d)) list.push(d);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}

// e2e 运行器与 Playwright 都以字符串表达式求值同一份记录器源码。
export const AVATAR_STAGE_RECORDER_SOURCE = `(${avatarStageRecorder.toString()})()`;

export function settledStageRuns(events: AvatarStageEvent[]): Array<{ end: number; shape: string; start: number }> {
  const runs: Array<{ end: number; shape: string; start: number }> = [];
  for (const event of events) {
    const prev = runs[runs.length - 1];
    if (prev) prev.end = event.t;
    if (!event.shape || event.shape === "transition") continue;
    if (!prev || prev.shape !== event.shape) runs.push({ end: event.t, shape: event.shape, start: event.t });
  }
  return runs;
}

export const readAvatarMeta = async (browser: Browser): Promise<AvatarMeta | null> => {
  const raw = await browser.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(".curation-home__avatar");
    if (!button) return null;
    return {
      label: button.getAttribute("aria-label"),
      shape: button.getAttribute("data-avatar-shape"),
      state: button.getAttribute("data-avatar-state"),
    };
  });
  return raw as AvatarMeta | null;
};

export const readCanvasDigest = async (browser: Browser): Promise<string | null> => {
  const raw = await browser.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".curation-home__avatar-particles");
    if (!canvas || canvas.width === 0) return null;
    const url = canvas.toDataURL();
    let h = 0x811c9dc5;
    for (let i = 0; i < url.length; i += 1) {
      h ^= url.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  });
  return raw as string | null;
};

export const readAvatarStageLog = async (browser: Browser): Promise<AvatarStageLog | null> => {
  const raw = await browser.evaluate(() =>
    (window as typeof window & { __avatarStages?: AvatarStageLog }).__avatarStages ?? null);
  return raw as AvatarStageLog | null;
};
