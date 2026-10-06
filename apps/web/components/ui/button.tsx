import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 动效按属性分档（DESIGN.md 动效决策）：颜色与透明度 160ms ease，位移/缩放 120ms 强 ease-out。
// Tailwind v4 的 scale 工具输出独立 scale 属性，transition 清单与时长/曲线列表按位一一对应。
const buttonBase = "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform,scale] duration-[160ms,160ms,160ms,160ms,120ms,120ms] ease-[ease,ease,ease,ease,cubic-bezier(.23,1,.32,1),cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-focus-visible:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const variants = {
  ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
  secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
} as const;
const sizes = {
  "sm": "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
} as const;

export function Button({
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants; size?: keyof typeof sizes }) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonBase, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
