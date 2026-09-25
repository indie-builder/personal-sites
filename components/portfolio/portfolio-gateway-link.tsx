"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function PortfolioGatewayLink({ children, className, href }: {
  children: ReactNode;
  className?: string;
  href: "/" | "/portfolio";
}) {
  return (
    <Link
      className={className}
      href={href}
      onClick={(event) => {
        document.documentElement.dataset.input = event.detail === 0 ? "keyboard" : "pointer";
      }}
      onNavigate={() => {
        if (document.documentElement.dataset.input === "keyboard" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const direction = href === "/portfolio" ? "forward" : "back";
        document.documentElement.dataset.portfolioEnter = direction;
        window.setTimeout(() => {
          if (document.documentElement.dataset.portfolioEnter === direction) delete document.documentElement.dataset.portfolioEnter;
        }, 8000);
      }}
    >
      {children}
    </Link>
  );
}
