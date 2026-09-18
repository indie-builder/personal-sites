"use client";

import { Dialog } from "radix-ui";
import { CircleCheck, LoaderCircle, Printer, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const PRINT_DURATION = 2_400;
// 出纸停顿：每个目标位置停留一小段；成对的 Y/时长由同一停顿展开成 keyframe 序列。
const PAPER_FEED_STOPS: Array<[string, number, number]> = [
  ["-91%", 0.075, 0.105],
  ["-81%", 0.18, 0.21],
  ["-70%", 0.285, 0.315],
  ["-58%", 0.39, 0.42],
  ["-45%", 0.495, 0.525],
  ["-32%", 0.6, 0.63],
  ["-20%", 0.705, 0.735],
  ["-10%", 0.81, 0.84],
  ["-3%", 0.915, 0.945],
];
const PAPER_FEED_Y = ["calc(-100% + 2px)", ...PAPER_FEED_STOPS.flatMap(([y]) => [y, y]), "0%"];
const PAPER_FEED_TIMES = [0, ...PAPER_FEED_STOPS.flatMap(([, enter, hold]) => [enter, hold]), 1];
const MotionLoaderCircle = motion.create(LoaderCircle);

const TOOTH_COUNT = 36;
const TOOTH_DEPTH = 5;
const toothPoints = Array.from({ length: TOOTH_COUNT * 2 }, (_, index) => {
  const x = 100 - ((index + 1) * 100) / (TOOTH_COUNT * 2);
  const y = index % 2 === 0 ? "100%" : `calc(100% - ${TOOTH_DEPTH}px)`;
  return `${x}% ${y}`;
}).join(", ");
const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${TOOTH_DEPTH}px), ${toothPoints})`;

const receiptItems = [
  { company: "PLUS数字科技", meta: "2014—2019 · Java · 服务运维", years: "5 年" },
  { company: "红星美凯龙", meta: "2019—2023 · 业务 · 集团架构", years: "4 年" },
  { company: "喜马拉雅", meta: "2023—2026 · 企业 AI 应用", years: "3 年" },
  { company: "PayerMax", meta: "2026— · OPT · 端到端交付", years: "至今" },
];

export function AboutPrint() {
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const reduceMotion = useReducedMotion();
  const printTimerRef = useRef<number | null>(null);

  const clearPrintTimer = useCallback(() => {
    if (printTimerRef.current === null) return;
    window.clearTimeout(printTimerRef.current);
    printTimerRef.current = null;
  }, []);

  useEffect(() => clearPrintTimer, [clearPrintTimer]);

  const close = useCallback(() => {
    clearPrintTimer();
    setPrinting(false);
    setOpen(false);
  }, [clearPrintTimer]);

  const openModal = () => {
    clearPrintTimer();
    setOpen(true);
    setPrinting(!reduceMotion);
    if (!reduceMotion) {
      printTimerRef.current = window.setTimeout(() => {
        printTimerRef.current = null;
        setPrinting(false);
      }, PRINT_DURATION);
    }
  };

  return (
    <Dialog.Root
      onOpenChange={(next) => (next ? openModal() : close())}
      open={open}
    >
      <Dialog.Trigger asChild>
        <button className="curation-home__about-trigger" type="button">
          <Printer aria-hidden="true" />
          关于我
        </button>
      </Dialog.Trigger>
      <Dialog.Portal forceMount>
        <AnimatePresence onExitComplete={() => setPrinting(false)}>
          {open ? (
            <div className="about-modal">
              <Dialog.Overlay asChild forceMount>
                <motion.button
                  animate={{ opacity: 1 }}
                  aria-label="关闭"
                  className="about-modal__backdrop"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  tabIndex={-1}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                  type="button"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  aria-label="关于我：个人经历打印稿"
                  className="about-modal__dialog"
                  exit={{
                    opacity: 0,
                    scale: 0.99,
                    y: "0.4rem",
                    transition: { duration: reduceMotion ? 0 : 0.18, ease: "easeIn" },
                  }}
                  initial={{ opacity: 0, scale: 0.98, y: "0.6rem" }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="about-printer">
                    <div className="about-printer__machine">
                      <div className="about-printer__screen">
                        {printing ? (
                          <MotionLoaderCircle
                            animate={{ rotate: 360 }}
                            aria-hidden="true"
                            initial={{ rotate: 0 }}
                            transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                          />
                        ) : (
                          <CircleCheck aria-hidden="true" />
                        )}
                        <span aria-live="polite" role="status">
                          {printing ? "正在打印个人经历…" : "打印完成 · 请取走小票"}
                        </span>
                        <button aria-label="关闭" className="about-modal__close" onClick={close} type="button">
                          <X aria-hidden="true" />
                        </button>
                      </div>
                      <div aria-hidden="true" className="about-printer__slot" />
                    </div>

                    <div className="about-printer__output">
                      <motion.article
                        animate={{ y: reduceMotion ? "0%" : printing ? PAPER_FEED_Y : "0%" }}
                        className="about-printer__paper"
                        initial={reduceMotion ? false : { y: PAPER_FEED_Y[0] }}
                        style={{ clipPath: receiptClipPath }}
                        transition={printing
                          ? { duration: PRINT_DURATION / 1_000, ease: "linear", times: PAPER_FEED_TIMES }
                          : { duration: 0 }}
                      >
                        <header className="about-receipt__header">
                          <p className="about-receipt__title">陈远 / CHEN YUAN</p>
                          <p className="about-receipt__sub">个人经历 · CAREER RECEIPT</p>
                        </header>
                        <hr className="about-receipt__rule" />
                        <ul className="about-receipt__items">
                          {receiptItems.map((item) => (
                            <li key={item.company}>
                              <span className="about-receipt__line">
                                <span>{item.company}</span>
                                <span>{item.years}</span>
                              </span>
                              <span className="about-receipt__meta">{item.meta}</span>
                            </li>
                          ))}
                        </ul>
                        <hr className="about-receipt__rule" />
                        <p className="about-receipt__total">
                          <span>合计 TOTAL</span>
                          <strong>12 年</strong>
                        </p>
                        <p className="about-receipt__foot">十二年 · 四段路 · 仍在增长</p>
                        <div aria-hidden="true" className="about-receipt__barcode" />
                      </motion.article>
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
