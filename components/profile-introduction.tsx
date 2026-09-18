"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { animate, useInView } from "motion/react";
import { ProfileTextLines } from "@/components/profile-text-lines";

type ProfileIntroductionProps = {
  assistant?: ReactNode;
  animateOnFirstHomeVisit?: boolean;
  englishParagraphs: readonly string[];
  paragraphs: readonly string[];
};

const ENGLISH_CHARACTER_DELAY = 5.5;
const CHINESE_CHARACTER_DELAY = 6.5;
const DELETE_CHARACTER_DELAY = 2;
const PAUSE_DELAY = 280;
const PUNCTUATION_DELAY = 70;
const LANGUAGE_TRANSITION_DELAY = 720;
const CURSOR_BLINK_DELAY = 1520;
const ENGLISH_TITLE = "Hello,";
const CHINESE_TITLE = "你好，";
const GREETING_CHARACTER_DELAY = 72;
const GREETING_HOLD_DELAY = 2_600;
const GREETINGS = [
  CHINESE_TITLE,
  ENGLISH_TITLE,
  "Hola,",
  "こんにちは、",
  "안녕하세요,",
  "Bonjour,",
  "नमस्ते,",
  "Ciao,",
  "Olá,",
  "Hallo,",
  "Merhaba,",
  "Привет,",
  "مرحبًا،",
  "สวัสดีครับ,",
];

const TITLE_PUNCTUATION = /[，、,.!?]/u;
const PARAGRAPH_PUNCTUATION = /[，。；、.!?]/u;
const STEP_EPSILON = 1e-6;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void) {
  const queries = [REDUCED_MOTION_QUERY, "(max-width: 900px)"].map((query) => window.matchMedia(query));
  queries.forEach((media) => media.addEventListener("change", onStoreChange));
  return () => queries.forEach((media) => media.removeEventListener("change", onStoreChange));
}

// 手机优先完整阅读，桌面保留逐字语言切换。
const getReducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches
  || window.matchMedia("(max-width: 900px)").matches;
const getServerReducedMotionSnapshot = () => false;

type DisplayPhase = "english" | "erasing" | "chinese" | "complete";

type CharacterTimeline = {
  duration: number;
  ease: (progress: number) => number;
};

// Folds per-character delays into one stepped ease curve so a single value
// animation can time a whole typewriter run: the animated value only moves
// in whole-character steps, at the same rhythm as the old per-character waits.
function createCharacterTimeline(delays: readonly number[]): CharacterTimeline {
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
function createTypewriterDriver() {
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

  const typeText = (
    text: string,
    characterDelay: number,
    punctuation: RegExp,
    onCount: (count: number) => void,
  ) => {
    if (text.length === 0) return Promise.resolve();

    const delays = Array.from({ length: text.length }, (_, index) => (
      punctuation.test(text[index]) ? PUNCTUATION_DELAY : characterDelay
    ));
    const { duration, ease } = createCharacterTimeline(delays);
    let appliedCount: number | null = null;

    return run(animate(0, text.length, {
      duration,
      ease,
      onUpdate: (latest) => {
        const count = Math.min(Math.floor(latest + STEP_EPSILON) + 1, text.length);
        if (count !== appliedCount) {
          appliedCount = count;
          onCount(count);
        }
      },
    }));
  };

  const eraseText = (length: number, onCount: (count: number) => void) => {
    if (length === 0) return Promise.resolve();

    const { duration, ease } = createCharacterTimeline(
      Array.from({ length }, () => DELETE_CHARACTER_DELAY),
    );
    let appliedCount: number | null = null;

    return run(animate(0, length, {
      duration,
      ease,
      onUpdate: (latest) => {
        const count = Math.max(length - 1 - Math.floor(latest + STEP_EPSILON), 0);
        if (count !== appliedCount) {
          appliedCount = count;
          onCount(count);
        }
      },
    }));
  };

  const dispose = () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    activeControls?.stop();
    activeControls = null;
  };

  return { wait, typeText, eraseText, dispose };
}

function GrowingParagraph({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || reduceMotion) return;
    let animation: Animation | undefined;
    let previousHeight = inner.offsetHeight;
    outer.style.height = `${previousHeight}px`;
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      if (nextHeight === previousHeight) return;
      const fromHeight = outer.getBoundingClientRect().height;
      animation?.cancel();
      outer.style.height = `${nextHeight}px`;
      previousHeight = nextHeight;
      // Animate only actual line-height changes, not every typed character.
      if (!reduceMotion) {
        animation = outer.animate([{ height: `${fromHeight}px` }, { height: `${nextHeight}px` }], {
          duration: 220,
          easing: "cubic-bezier(.23,1,.32,1)",
        });
      }
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      animation?.cancel();
      outer.style.removeProperty("height");
    };
  }, [reduceMotion]);

  return <div className="profile-paragraph-growth" ref={outerRef}><div className="profile-paragraph-content" ref={innerRef}>{children}</div></div>;
}

export function ProfileIntroduction({
  assistant,
  animateOnFirstHomeVisit = false,
  englishParagraphs,
  paragraphs,
}: ProfileIntroductionProps) {
  const introductionRef = useRef<HTMLElement>(null);
  const isVisible = useInView(introductionRef);
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
  const [visibleCounts, setVisibleCounts] = useState(() => (
    animateOnFirstHomeVisit
      ? paragraphs.map(() => 0)
      : paragraphs.map((paragraph) => paragraph.length)
  ));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<DisplayPhase>("complete");
  const [titleVisibleCount, setTitleVisibleCount] = useState(CHINESE_TITLE.length);
  const [titleIsTyping, setTitleIsTyping] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [hasCompletedInitialSequence, setHasCompletedInitialSequence] = useState(
    () => !animateOnFirstHomeVisit,
  );
  const [shouldAnimateInitialVisit] = useState(() => animateOnFirstHomeVisit);

  const resetTitleToChinese = () => {
    setGreetingIndex(0);
    setTitleVisibleCount(CHINESE_TITLE.length);
    setTitleIsTyping(false);
  };

  useEffect(() => {
    let cancelled = false;
    const showChinese = () => {
      setGreetingIndex(0);
      setTitleVisibleCount(CHINESE_TITLE.length);
      setTitleIsTyping(false);
    };

    if (phase !== "complete") {
      return undefined;
    }
    if (!isVisible || reduceMotion) {
      showChinese();
      return undefined;
    }

    const driver = createTypewriterDriver();

    const typeGreeting = async (greeting: string) => {
      setTitleIsTyping(true);
      await driver.typeText(greeting, GREETING_CHARACTER_DELAY, TITLE_PUNCTUATION, setTitleVisibleCount);
      if (cancelled) return;
      setTitleIsTyping(false);
    };

    const cycleGreetings = async () => {
      let nextGreetingIndex = 1;

      while (!cancelled) {
        await driver.wait(GREETING_HOLD_DELAY);
        if (cancelled) return;

        setGreetingIndex(nextGreetingIndex);
        setTitleVisibleCount(0);
        await typeGreeting(GREETINGS[nextGreetingIndex]);
        if (cancelled) return;

        nextGreetingIndex = (nextGreetingIndex + 1) % GREETINGS.length;
      }
    };

    void cycleGreetings();

    return () => {
      cancelled = true;
      driver.dispose();
    };
  }, [isVisible, phase, reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | undefined;

    const showAll = () => {
      setVisibleCounts(paragraphs.map((paragraph) => paragraph.length));
      setActiveIndex(null);
      setPhase("complete");
      resetTitleToChinese();
      setHasCompletedInitialSequence(true);
    };

    const shouldPlay = shouldAnimateInitialVisit
      && !hasCompletedInitialSequence
      && !reduceMotion;

    if (!shouldPlay) {
      showAll();
      return;
    }

    const driver = createTypewriterDriver();

    const typeParagraphs = async (copy: readonly string[], characterDelay: number) => {
      for (let paragraphIndex = 0; paragraphIndex < copy.length; paragraphIndex += 1) {
        const paragraph = copy[paragraphIndex];
        setActiveIndex(paragraphIndex);

        await driver.typeText(paragraph, characterDelay, PARAGRAPH_PUNCTUATION, (count) => {
          setVisibleCounts((counts) => counts.map((current, index) => (
            index === paragraphIndex ? count : current
          )));
        });
        if (cancelled) return;

        await driver.wait(PAUSE_DELAY);
        if (cancelled) return;
      }
    };

    const typeTitle = async (title: string, characterDelay: number) => {
      setTitleIsTyping(true);
      await driver.typeText(title, characterDelay, TITLE_PUNCTUATION, setTitleVisibleCount);
      if (cancelled) return;
      setTitleIsTyping(false);
    };

    const eraseParagraphs = async () => {
      setPhase("erasing");

      for (let paragraphIndex = englishParagraphs.length - 1; paragraphIndex >= 0; paragraphIndex -= 1) {
        const paragraph = englishParagraphs[paragraphIndex];
        setActiveIndex(paragraphIndex);

        await driver.eraseText(paragraph.length, (count) => {
          setVisibleCounts((counts) => counts.map((current, index) => (
            index === paragraphIndex ? count : current
          )));
        });
        if (cancelled) return;

        await driver.wait(PAUSE_DELAY);
        if (cancelled) return;
      }
    };

    const eraseTitle = async () => {
      setTitleIsTyping(true);
      await driver.eraseText(ENGLISH_TITLE.length, setTitleVisibleCount);
    };

    const playSequence = async () => {
      setPhase("english");
      setVisibleCounts(englishParagraphs.map(() => 0));
      setTitleVisibleCount(0);
      await typeTitle(ENGLISH_TITLE, ENGLISH_CHARACTER_DELAY);
      if (cancelled) return;

      await typeParagraphs(englishParagraphs, ENGLISH_CHARACTER_DELAY);
      if (cancelled) return;

      await driver.wait(LANGUAGE_TRANSITION_DELAY);
      if (cancelled) return;

      await eraseParagraphs();
      if (cancelled) return;

      setActiveIndex(null);
      await eraseTitle();
      if (cancelled) return;

      await driver.wait(CURSOR_BLINK_DELAY);
      if (cancelled) return;

      setPhase("chinese");
      setVisibleCounts(paragraphs.map(() => 0));
      setTitleVisibleCount(0);
      await typeTitle(CHINESE_TITLE, CHINESE_CHARACTER_DELAY);
      if (cancelled) return;

      await typeParagraphs(paragraphs, CHINESE_CHARACTER_DELAY);
      if (!cancelled) {
        setActiveIndex(null);
        setPhase("complete");
        setHasCompletedInitialSequence(true);
      }
    };

    if (document.querySelector(".opening-loader")) {
      observer = new MutationObserver(() => {
        if (!document.querySelector(".opening-loader")) {
          observer?.disconnect();
          void playSequence();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      void playSequence();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      driver.dispose();
    };
  }, [englishParagraphs, hasCompletedInitialSequence, paragraphs, reduceMotion, shouldAnimateInitialVisit]);

  const displayedParagraphs = phase === "english" || phase === "erasing"
    ? englishParagraphs
    : paragraphs;
  const introductionTitle = phase === "english" || phase === "erasing"
    ? ENGLISH_TITLE
    : phase === "complete"
      ? GREETINGS[greetingIndex]
      : CHINESE_TITLE;

  return (
    <section
      aria-labelledby="profile-introduction"
      className="curation-home__bio"
      data-introduction-phase={hasCompletedInitialSequence ? "complete" : phase === "complete" ? "waiting" : phase}
      ref={introductionRef}
    >
      <div className="profile-greeting-row">
      <h2 className={titleIsTyping ? "is-typing" : undefined} id="profile-introduction">
        {introductionTitle.slice(0, titleVisibleCount)}
      </h2>
      </div>
      {displayedParagraphs.map((paragraph, index) => (
        <GrowingParagraph key={index} reduceMotion={reduceMotion}>
        {index === 0 && hasCompletedInitialSequence ? <div className="profile-body-assistant">{assistant}</div> : null}
        <p className={activeIndex === index ? "is-typing" : undefined} data-empty={!visibleCounts[index] && activeIndex !== index}>
          <span className="sr-only">{paragraph}</span>
          {phase === "complete" ? <ProfileTextLines text={paragraph} /> : <span aria-hidden="true">{paragraph.slice(0, visibleCounts[index])}</span>}
        </p>
        </GrowingParagraph>
      ))}
    </section>
  );
}
