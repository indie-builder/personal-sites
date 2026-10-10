import type { ReactNode } from "react";

import { SiteModeNavigation } from "@/components/site-mode-navigation";
import { SiteProfile } from "@/components/site-profile";
import styles from "./portfolio-shell.module.css";

type PortfolioShellProps = {
  children: ReactNode;
  /** 顶部当前作品名；缺省显示「作品集」。 */
  label?: string;
  /** 详情等次级页面隐藏刊名行，由产品自身提供返回导航。 */
  hideMasthead?: boolean;
};

// 作品集共用壳：目标身份轨 + 宽内容列 + 「信息流 / 作品流」模式切换。
// 不复用源站 workspace 外壳；main 地标由此壳唯一提供。
export function PortfolioShell({ children, label = "作品集", hideMasthead = false }: PortfolioShellProps) {
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
            <SiteModeNavigation current="portfolio" />
          </div>
        )}
        {children}
      </section>
    </main>
  );
}
