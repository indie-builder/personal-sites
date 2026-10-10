import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { personalSitePromo } from "@site/public-data/portfolio/products.mjs";

import { buttonClassName } from "@/components/portfolio/button";
import { PortfolioShell } from "@/components/portfolio/portfolio-shell";
import { SiteShowcaseMedia } from "@/components/portfolio/site-showcase-media";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "个人网站",
  description: "通过网站宣传片，了解陈远的个人工程档案、每日关注与开源收藏。",
};

export default function PersonalSitesPage() {
  return (
    <PortfolioShell label="个人网站">
      <header className={styles.header}>
        <div>
          <p>一份持续更新的个人工程档案。</p>
        </div>
        <Link
          href="/"
          className={buttonClassName({ variant: "primary" })}
          aria-label="打开个人网站"
        >
          打开网站
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <p className={styles.description}>{personalSitePromo.description}</p>
      <SiteShowcaseMedia videoSrc={personalSitePromo.video} poster={personalSitePromo.poster} />
    </PortfolioShell>
  );
}
