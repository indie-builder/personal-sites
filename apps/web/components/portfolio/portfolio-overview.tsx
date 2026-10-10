import Link from "next/link";
import type { Route } from "next";

import type { PortfolioProduct } from "@site/public-data/portfolio/products.mjs";

import styles from "./portfolio-overview.module.css";

type Preview =
  | { kind: "image"; src: string; alt: string }
  | { kind: "text"; text: string };

export type PortfolioOverviewProduct = PortfolioProduct & { preview: Preview[] };

// 七个作品以连续分隔的整行呈现（非卡片网格）：日期、真实预览、名称与简介纵向分隔。
export function PortfolioOverview({ products }: { products: readonly PortfolioOverviewProduct[] }) {
  return (
    <ul className={styles.list}>
      {products.map((product) => (
        <li className={styles.row} key={product.slug}>
          <Link className={styles.rowLink} href={product.href as Route}>
            <span className={styles.meta}>
              <time dateTime={product.date}>{product.date.slice(0, 10).replace(/-/g, ".")}</time>
              <span>{product.dateLabel}</span>
            </span>
            {product.preview.length ? (
              <span className={styles.previews}>
                {product.preview.map((preview, index) =>
                  preview.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Local committed preview assets.
                    <img
                      alt={preview.alt}
                      className={styles.previewImage}
                      key={`${product.slug}-${index}`}
                      loading={index === 0 ? "eager" : "lazy"}
                      src={preview.src}
                    />
                  ) : (
                    <span className={styles.previewText} key={`${product.slug}-${index}`}>
                      {preview.text}
                    </span>
                  ),
                )}
              </span>
            ) : null}
            <span className={styles.copy}>
              <span className={styles.name}>{product.name}</span>
              <span className={styles.tagline}>{product.tagline}</span>
              <span className={styles.description}>{product.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
