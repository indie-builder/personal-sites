---
version: 1
slug: "cn-lovemyrmb-personalsite-ui-about-aboutscreen-kt"
primary_target: "android/app/src/main/java/cn/lovemyrmb/personalsite/ui/about/AboutScreen.kt"
related_targets: []
---

## Scope and mode
Android Compose AboutScreen; Read. Visitors recognize Chen Yuan, understand the supplied engineering biography, inspect native career history, and optionally leave for GitHub or Yuque.

## Direction
Personal introduction spread: quiet GitHub/Yuque links sit above the right-aligned original portrait, which balances name and handle; the factual 2014—至今 line is the full-width career affordance, not a detached icon or pill. Ink lead paragraph followed by muted supporting prose gives reading hierarchy. Retained technical motion closes the page with no footer actions.

## Constraints
Keep exact public biography and original avatar. No invented headings, slogans, metrics, or profile Ask CTA. Keep native career sheet, existing bottom navigation, and system Back. GitHub/Yuque remain external destinations above the portrait: muted 12sp text, 14dp icons, minimum 48dp targets and 16dp between targets. The page starts with 12dp top padding and leaves 8dp between links and identity. Follow light/dark theme and system font scale; verify narrow phone header links and scrolled technical field. Technical canvas remains existing decorative fixed-size text with semantic summary.

## Verification
Android 16 emulator; normal phone, dark theme, 320dp at 1.3 font scale including scrolled end. Independent finish review required for the current header-link placement. Scope excludes tablet, landscape and physical-hardware motion verification. Source avatar is public/images/ample-avatar.png copied without edits to drawable-nodpi/profile_avatar.png.
