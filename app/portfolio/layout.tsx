import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";

import { WorkspaceShell } from "@/components/portfolio/workspace-shell";

import "./portfolio.css";

const albertSans = localFont({
  src: "./AlbertSans-VariableFont_wght.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-albert-sans",
});

export const metadata: Metadata = {
  title: { default: "作品集", template: "%s · 陈远作品集" },
  description: "陈远的作品、设计参考与工具收藏。",
};

export default function PortfolioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div id="portfolio-root" className={albertSans.variable}>
      <Suspense fallback={null}>
        <WorkspaceShell>{children}</WorkspaceShell>
      </Suspense>
    </div>
  );
}
