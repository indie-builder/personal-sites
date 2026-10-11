# 小站 · A running engineering archive

[English](README.md) · [中文](README.zh-CN.md)

The personal site of Chen Yuan, kept as a running engineering archive: real engineering practice shown through continuously updated reading, curation, and personal judgment. The web app is the primary product, with a desktop identity rail over a continuous content flow and the same sections on phone browsers.

**Live site:** https://default-coder.lovemyrmb.cn/

Read any section from the home page. To try Ask (问一问), tap the pixel character in the profile area and ask a question: the answer streams in and cites numbered sources drawn from published material only.

## Site sections

| Section | Path | Content |
| --- | --- | --- |
| Home | `/` | Profile and content entries; desktop leads with daily updates, phones show the full profile first |
| Daily updates | `/ai-news` | AI and agent news |
| Daily curation | `/curation` | Chinese curation of X bookmarks and likes, with sources and details |
| Design saves | `/design` | Design-related items filtered from the X curation |
| Douyin saves | `/douyin` | Followed items built from saved-video transcripts and on-screen text |
| Open source | `/open-source` | GitHub stars chosen for publication, with the original README or repository tree, a Chinese reading edition, and personal commentary |
| About me and Ask (问一问) | profile area | An in-site printable resume; tapping the pixel character opens anonymous Q&A over public material. There is no standalone `/ask` page |

The profile area links GitHub, Yuque, and the in-site [portfolio](https://default-coder.lovemyrmb.cn/portfolio). Switch between the information feed and portfolio to browse seven working products in the same site. Daily updates filter by featured or category, open source filters by topic, the content flow reads by date with loading more, and detail pages keep their source exits.

Public discovery endpoints are `/sitemap.xml`, `/robots.txt`, `/feed.xml`, and site-wide Open Graph images. The RSS feed aggregates the latest updates from daily updates, daily curation, and open source.

## Run it locally

Requires Node.js `>=24.21.0 <25` and pnpm 12.10.1, pinned in `package.json`.

```bash
git clone https://github.com/indie-builder/personal-sites.git
cd personal-sites
pnpm install
cp .env.example .env.local
```

Fill in root `.env.local` using [`.env.example`](.env.example). Supabase enables fresh daily updates; Ask needs model and session credentials. Deployment and sync need additional server-side credentials documented in the example. Keep credentials in ignored local files, never under a `NEXT_PUBLIC_` prefix.

```bash
pnpm dev:domain
```

Open https://personal-site.localhost. Use `pnpm dev` instead for a local-port server.

Build, test, and browser e2e commands are in [workspace notes](docs/monorepo.md). Data operations and health checks are in [data sync](docs/data-sync.md).

## Native clients

[Android](android/README.md) (Kotlin + Jetpack Compose, Android 12+, JDK 17+) and [iOS](ios/README.md) (Swift 6 + SwiftUI, iOS 26+, no third-party dependencies) read the public content GET APIs and ask through `POST /api/ask`. Build and verification follow each client's README.

## Data and privacy

Raw personal material, X, Douyin, and GitHub crawl snapshots, and local transcripts stay in Git-ignored sensitive directories; the browser only touches public projections. Anonymous Ask sessions are stored in private Supabase Storage on the deployed site. The full boundary is in [sensitive data](docs/sensitive-data.md).

Public data splits in two. Daily updates merge the read-only `data/ai-news.sqlite` history with public increments from Supabase, so once items land in Supabase the next page request reads them. X, Douyin, open source, and the local Ask full-text index read the read-only `data/curation.sqlite` bundled with each deploy, so they change only after a rebuilt projection is merged and redeployed.

## Tech stack

Next.js (App Router) with React, Tailwind CSS, and Motion on Vercel; Effect for business I/O; Supabase and read-only SQLite snapshots for public data; Zhipu GLM streaming for Ask; Vitest, Playwright, and the e2e runner for tests. The dated version baseline and open audit items are recorded in [tech-stack maintenance](docs/tech-stack-maintenance.md); exact dependencies live in each workspace `package.json`, `pnpm-lock.yaml`, and `android/gradle/libs.versions.toml`.

## Documentation

- [PRODUCT.md](PRODUCT.md) covers product positioning and feature boundaries.
- [GLOSSARY.md](GLOSSARY.md) defines the domain terms for public content, curation, and Ask.
- [DESIGN.md](DESIGN.md) sets the visual and interaction rules.
- [Frontend architecture](docs/frontend-architecture.md) explains page and data-reading responsibilities.
- [Workspace notes](docs/monorepo.md) cover the layout, the feature-to-code map, caching, and Vercel.
- [Data sync](docs/data-sync.md) summarizes maintainer sync commands and schedules.
- [Tech-stack maintenance](docs/tech-stack-maintenance.md) records the maintenance SOP and open audit items.
- [Sensitive data](docs/sensitive-data.md) draws the boundary between private inputs and public projections.
- [AGENTS.md](AGENTS.md) sets the collaboration and engineering conventions.

## Contributing

This is a personal project developed in the open. Report problems in GitHub Issues; the engineering conventions for changes are in [AGENTS.md](AGENTS.md).

## License

No license is declared. This is a personal project and all rights are reserved; contact the owner before reusing code or content.
