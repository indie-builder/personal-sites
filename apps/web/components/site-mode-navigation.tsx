import Link from "next/link";
import type { Route } from "next";

import styles from "./site-mode-navigation.module.css";

export type SiteMode = "information" | "portfolio";

type SiteModeNavigationProps = {
  current: SiteMode;
  /** 信息流侧返回目标：当前信息版块的 href；作品流页传 "/"。 */
  informationHref?: Route;
};

// 「信息流 / 作品流」是两个普通链接（aria-current 标注当前侧），
// 不引入 tab 语法或客户端状态；信息侧目的地由调用方按当前版块给出。
export function SiteModeNavigation({ current, informationHref = "/" }: SiteModeNavigationProps) {
  return (
    <nav aria-label="站点模式" className={styles.modeNavigation}>
      <Link
        aria-current={current === "information" ? "page" : undefined}
        className={styles.link}
        href={informationHref}
      >
        信息流
      </Link>
      <span aria-hidden="true" className={styles.divider}>
        /
      </span>
      <Link
        aria-current={current === "portfolio" ? "page" : undefined}
        className={styles.link}
        href="/portfolio"
      >
        作品流
      </Link>
    </nav>
  );
}
