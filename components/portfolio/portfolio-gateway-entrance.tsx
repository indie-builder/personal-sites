"use client";

import { useLayoutEffect } from "react";

let activeGatewayAnimation: Animation | null = null;

export function PortfolioGatewayEntrance({ direction }: { direction: "forward" | "back" }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.dataset.portfolioEnter !== direction) return;
    delete root.dataset.portfolioEnter;
    if (root.dataset.input === "keyboard" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The canvas survives streaming updates to either page, so the entrance cannot be cancelled by a child remount.
    const target = document.querySelector<HTMLElement>("#site-canvas");
    if (!target) return;
    activeGatewayAnimation?.cancel();
    const animation = target.animate(
      [
        { opacity: 0.55, transform: `translateX(${direction === "forward" ? 24 : -24}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: 240, easing: getComputedStyle(target).getPropertyValue("--ease-out").trim() },
    );
    activeGatewayAnimation = animation;
    const clear = () => {
      if (activeGatewayAnimation === animation) activeGatewayAnimation = null;
      animation.cancel();
    };
    void animation.finished.then(clear, clear);
  }, [direction]);
  return null;
}
