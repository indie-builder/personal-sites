import { animate } from "motion/react";

const PUNCTUATION_DELAY = 70;
const DELETE_CHARACTER_DELAY = 2;
const STEP_EPSILON = 1e-6;

// Folds per-character delays into one stepped ease curve so a single value
// animation can time a whole typewriter run: the animated value only moves
// in whole-character steps, at the same rhythm as the old per-character waits.
function createCharacterTimeline(delays: readonly number[]) {
  const boundaries: number[] = [];
  let total = 0;

  for (const delay of delays) {
    total += delay;
    boundaries.push(total);
  }

  return {
    duration: total / 1000,
    ease: (progress: number) => {
      const elapsed = progress * total;
      let step = 0;
      while (step < boundaries.length && boundaries[step] <= elapsed + STEP_EPSILON) {
        step += 1;
      }
      return step / boundaries.length;
    },
  };
}

// Drives the typewriter with Motion value animations. The live animation is
// paused while the tab is hidden so a background tab never advances the
// typewriter, and stopped on dispose so unmounts leave no controls behind.
export function createTypewriterDriver() {
  let activeControls: ReturnType<typeof animate> | null = null;

  const onVisibilityChange = () => {
    if (document.hidden) {
      activeControls?.pause();
    } else {
      activeControls?.play();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const run = async (controls: ReturnType<typeof animate>) => {
    activeControls = controls;
    if (document.hidden) controls.pause();
    await controls;
    if (activeControls === controls) activeControls = null;
  };

  const wait = (delay: number) => run(animate(0, 1, { duration: delay / 1000, ease: "linear" }));

  const animateCharacters = (
    length: number,
    delays: number[],
    countAt: (step: number) => number,
    onCount: (count: number) => void,
  ) => {
    if (length === 0) return Promise.resolve();
    const { duration, ease } = createCharacterTimeline(delays);
    let appliedCount: number | null = null;
    return run(animate(0, length, {
      duration,
      ease,
      onUpdate: (latest) => {
        const count = countAt(Math.floor(latest + STEP_EPSILON));
        if (count !== appliedCount) {
          appliedCount = count;
          onCount(count);
        }
      },
    }));
  };

  const typeText = (text: string, characterDelay: number, punctuation: RegExp, onCount: (count: number) => void) =>
    animateCharacters(
      text.length,
      Array.from({ length: text.length }, (_, index) => punctuation.test(text[index]) ? PUNCTUATION_DELAY : characterDelay),
      (step) => Math.min(step + 1, text.length),
      onCount,
    );

  const eraseText = (length: number, onCount: (count: number) => void) =>
    animateCharacters(length, Array(length).fill(DELETE_CHARACTER_DELAY), (step) => Math.max(length - 1 - step, 0), onCount);

  const dispose = () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    activeControls?.stop();
    activeControls = null;
  };

  return { wait, typeText, eraseText, dispose };
}
