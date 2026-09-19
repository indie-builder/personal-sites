---
name: 陈远小站 · Android About
description: Native Compose personal introduction in the existing monochrome reading world.
colors:
  light-background: "#FFFFFF"
  light-ink: "#1C1C1E"
  light-muted: "#656568"
  dark-background: "#181818"
  dark-ink: "#F4F4F4"
  dark-muted: "#A1A1A4"
typography:
  body:
    fontSize: "15sp"
    lineHeight: "26sp"
  summary:
    fontSize: "13sp"
    lineHeight: "21sp"
  meta:
    fontSize: "12sp"
    lineHeight: "18sp"
spacing:
  inline: "8dp"
  identity-gap: "16dp"
  page-gutter: "24dp"
  page-top: "12dp"
---

# Design System: 陈远小站 · Android About

全应用字体与间距以 [typography-and-spacing.md](docs/typography-and-spacing.md) 和 `Theme.kt` 为准：统一系统无衬线、0sp 字距，正文15/26sp、摘要13/21sp、辅助12/18sp。此文保留 About 的布局说明；历史局部字号或间距与全局规范冲突时，以全局规范为准。

## Overview

**Creative North Star: "Personal introduction spread"**

This scoped record describes `AboutScreen.kt` and `TechnicalTerms.kt`, with tokens from `ui/theme/Theme.kt`. It inherits the root visual world; it does not replace the Web design system or prescribe other Android screens. Identity, experience and biography form one continuous native reading composition.

**Key Characteristics:**

- Monochrome text hierarchy and open space.
- Original portrait alongside the name and handle.
- Career entry embedded in the reading flow.
- Quiet external references above the portrait; a technical field closes the page.

## Colors

Ink carries the name, career dates and greeting. Muted text carries the external references, handle, career descriptor and all biography paragraphs. Background and foreground follow the existing system light/dark theme. No added accent palette belongs to this surface.

## Typography

Compose Material typography supplies `headlineLarge` for the name and `labelLarge` for the career dates. All three biography paragraphs use the identical `SiteText.body` style (15sp / 26sp, normal weight). External links use `SiteText.meta`. The greeting uses `SiteText.title` (16sp / 24sp).

Technical terms use Android sans-serif and the shared 12sp meta size. Their canvas height scales with system font scale to preserve lane separation. A semantic description exposes the full term list independently of the drawing.

## Layout

A full-size `LazyColumn` respects the status bar. Side gutters and top inset use the frontmatter tokens; bottom content padding is the caller's `bottomPadding` plus 24dp. Content remains vertically scrollable with no width breakpoint or desktop rail.

The first row right-aligns GitHub and 语雀 above the portrait with 16dp between targets. Each target has a 48dp minimum height, 4dp horizontal padding and a 6dp text/icon gap. After 8dp, the identity row gives the name/handle column remaining width and reserves a 104dp square for the portrait. The career row sits underneath, spans the content width, has a minimum height of 56dp and 12dp vertical padding. Its date, descriptor and trailing arrow form one target.

The biography follows after 24dp: first paragraph, 16dp gap, second paragraph, 16dp gap, final paragraph. A 24dp gap introduces the technical field (140dp at default font scale), followed by a 24dp spacer; there are no footer actions. Long biography text wraps naturally rather than truncating.

## Elevation & Depth

The About composition has no cards, shadows, glass or raised toolbar. Hierarchy comes from text role, tone and spacing. The technical field uses faint dots and outlines, with background-colored fades at its edges.

## Shapes

The portrait keeps its source silhouette without an added clipping shape or container. Technical labels are thin rectangular outlines. Career and external actions are unboxed rows with native click feedback.

## Components

- **Native Ask:** full-screen dialogue with the shared text scale. A rounded tonal composer contains a 1–6 line editor, scope selector and 48dp send/stop action. Inline citation numbers and 48dp source rows open a native source reader with the returned content, never a browser. Long replies follow only while the reader is at the latest content; scrolling away exposes a return-to-latest control. See [ask-experience.md](docs/ask-experience.md) for states, limits and tests.

- **Career sheet:** the career row ends in a forward arrow and opens the original native bottom sheet. The complete receipt appears with the standard bottom-sheet transition and remains scrollable. No printer housing, paper-feed animation or replay controls. Dismiss by dragging down, tapping the scrim or system Back.

- **Greeting:** the biography begins with “你好，”, using `SiteText.title`. An invisible full vocabulary reserves maximum script font metrics so typing never shifts subsequent content. Native playback cycles after 2600ms holds with 72ms character steps; offscreen/background playback stops and disabled system animations show static Chinese. Accessibility announces a stable “你好”, not every typed character. The person's name remains fixed.

- **Identity:** name and handle beside the bundled portrait. `public/images/ample-avatar.png` was copied unchanged to `app/src/main/res/drawable-nodpi/profile_avatar.png`; no new raster was generated. Compose `Image` loads it synchronously with `painterResource` and the description “陈远的头像插画”.
- **Career entry:** “2014—至今 / 个人经历” opens the existing `AboutSheet`. The row has button semantics and the action label “查看个人经历”; the arrow is decorative. The sheet's internal design is outside this record.
- **Biography:** preserve all three existing paragraphs exactly, with identical font, size, line height, weight and muted color.
- **Technical field:** six independently phased, continuously left-moving lanes on a 9dp dot grid. Rectangular labels are at least 22dp high and grow to accommodate scaled font metrics with 8dp side padding and 112dp gaps. Dots use ink at 12% opacity, outlines 25%, lettering 85%, and label backgrounds 96%. Edge fades are 18dp wide. Motion runs only while the field intersects the window and the lifecycle is resumed; cancellation stops its frame loop. Disabled system animators reset elapsed time to a stable static state. See the sidecar for lane timing.
- **External references:** GitHub and 语雀 sit above the portrait and invoke the existing external browser handler. Muted meta text and 14dp auto-mirrored external-link icons keep them quiet. Their action labels identify the destination; icons are decorative.

## Do's and Don'ts

- Do preserve the original portrait, exact biography and monochrome native reading flow.
- Do keep the career row reachable by scrolling and the external references above the portrait at narrow widths and enlarged system text.
- Do retain semantic descriptions and the system-animation-disabled static state.
- Don't restore the previous button toolbar or introduce cards, heavy shadows or broad accent colors into this surface.
- Don't treat the decorative canvas labels as interactive chips or invent Web components for this native screen.
