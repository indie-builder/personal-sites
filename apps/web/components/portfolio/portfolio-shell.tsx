import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";

import type { PortfolioProduct } from "@site/public-data/portfolio/products.mjs";

import { SiteProfile } from "@/components/site-profile";
import styles from "./portfolio-shell.module.css";

type PortfolioShellProps = {
  children: ReactNode;
  /** 顶部当前作品名；缺省显示「作品集」。 */
  label?: string;
  /** 总览与详情页隐藏刊名行：模式切换只在左侧身份轨，右栏直接进入内容。 */
  hideMasthead?: boolean;
  /** 所属作品 slug：渲染唯一的「返回作品集」出口，直达总览对应停靠。 */
  productSlug?: PortfolioProduct["slug"];
};

// 作品集共用壳：目标身份轨 + 宽内容列 + 刊名行；回信息流走身份轨的「信息集」链接。
// 不复用源站 workspace 外壳；main 地标由此壳唯一提供。
export function PortfolioShell({ children, label = "作品集", hideMasthead = false, productSlug }: PortfolioShellProps) {
  return (
    <main className={`curation-home portfolio-home ${styles.home}`} id="site-main" tabIndex={-1}>
      <SiteProfile />
      <section
        aria-label={label}
        className={`portfolio-scope portfolio-home__content site-section-motion ${styles.home}`}
      >
        {hideMasthead ? null : (
          <div className="portfolio-home__mode">
            <span className="portfolio-home__mode-label">{label}</span>
          </div>
        )}
        {productSlug ? (
          <Link
            aria-label="返回作品集"
            className={styles.return}
            data-portfolio-return
            href={`/portfolio#portfolio-work-${productSlug}` as Route}
            scroll={false}
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.6} />
            返回作品集
          </Link>
        ) : null}
        {children}
      </section>
    </main>
  );
}
