"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInView } from "motion/react";
import { ProfileTextLines } from "@/components/profile-text-lines";
import { GrowingParagraph } from "@/components/growing-paragraph";
import { createTypewriterDriver } from "@/components/profile-typewriter";
import { useMediaQuery } from "@/components/use-media-query";

type ProfileIntroductionProps = {
  assistant?: ReactNode;
  animateOnFirstHomeVisit?: boolean;
  englishParagraphs: readonly string[];
  paragraphs: readonly string[];
};

const ENGLISH_CHARACTER_DELAY = 5.5;
const CHINESE_CHARACTER_DELAY = 6.5;
const PAUSE_DELAY = 280;
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
type DisplayPhase = "english" | "erasing" | "chinese" | "complete";

export function ProfileIntroduction({
  assistant,
  animateOnFirstHomeVisit = false,
  englishParagraphs,
  paragraphs,
}: ProfileIntroductionProps) {
  const introductionRef = useRef<HTMLElement>(null);
  const isVisible = useInView(introductionRef);
  // 手机优先完整阅读，桌面保留逐字语言切换。
  const motionPreference = useMediaQuery("(prefers-reduced-motion: reduce)");
  const compactLayout = useMediaQuery("(max-width: 900px)");
  const reduceMotion = motionPreference || compactLayout;
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

  const typeTitleText = async (driver: ReturnType<typeof createTypewriterDriver>, text: string, characterDelay: number, isCancelled: () => boolean) => {
    setTitleIsTyping(true);
    await driver.typeText(text, characterDelay, TITLE_PUNCTUATION, setTitleVisibleCount);
    if (isCancelled()) return;
    setTitleIsTyping(false);
  };

  useEffect(() => {
    let cancelled = false;

    if (phase !== "complete") {
      return undefined;
    }
    if (!isVisible || reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 离场/减少动效时同步落回中文标题终态
      resetTitleToChinese();
      return undefined;
    }

    const driver = createTypewriterDriver();

    const cycleGreetings = async () => {
      let nextGreetingIndex = 1;

      while (!cancelled) {
        await driver.wait(GREETING_HOLD_DELAY);
        if (cancelled) return;

        setGreetingIndex(nextGreetingIndex);
        setTitleVisibleCount(0);
        await typeTitleText(driver, GREETINGS[nextGreetingIndex], GREETING_CHARACTER_DELAY, () => cancelled);
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
      await typeTitleText(driver, ENGLISH_TITLE, ENGLISH_CHARACTER_DELAY, () => cancelled);
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
      await typeTitleText(driver, CHINESE_TITLE, CHINESE_CHARACTER_DELAY, () => cancelled);
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
