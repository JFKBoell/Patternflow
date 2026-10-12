# Patternflow Web

The Next.js app behind [patternflow.work](https://patternflow.work) — landing page, the interactive guide (`/guide`: Build, Play, Make, Audio, in English and Korean), Live Editor, Pattern Lab, the pattern community (on the community host only), browser flasher, edition shelf and feature catalogue, device update handoff, journal, and roadmap.

For how the app is put together (routes, pattern system, content pipeline), see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build — must pass before merging (CI hard gate)
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run check:ci   # every smoke suite CI runs (check:module wants the Xtensa toolchain and stays local)
npm start          # serve the production build
```

Requires Node 20+ (matches CI).

## Environment variables

None are required — the site runs fully without them. The community host needs more; `.env.example` lists every variable, and [ARCHITECTURE.md](./ARCHITECTURE.md#environment-variables) groups them.

| Var | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog analytics (no-op when absent) |
| `GITHUB_TOKEN` | Higher GitHub rate limit for `/api/roadmap` (optional) |

## Where things live

- `src/app/` — routes (App Router). `/pattern-lab` is the pattern workspace (noindex, not internal). The breadboard build guide is `src/app/build/breadboard/page.tsx` — React, not markdown. The interactive guide is `src/app/guide/` (one page per guide, each with a `ko/` twin) over one 3D stage in `src/components/guide/`; its words, in both languages, are `src/components/guide/copy.ts` (Play) and `copy/` (the others), and the firmware simulator it runs is `src/lib/guide/`.
- `src/components/` — 3D viewer, landing sections, journal renderer, the community UI. The build map's pins are `src/components/sections/InsideGlobe/builds.ts` plus photos in `public/builds/<slug>/`. The Build panel's case cards are `src/components/sections/build-cases-data.ts` plus photos in `public/cases/<id>/` (CC BY-SA, resized from the remix's own folder, or for the official case from `docs/build-guide/`); the same folder holds the case's 3D model for the preview, `model.glb`, built by [`tools/case-models`](../tools/case-models/README.md).
- `src/lib/presets/` — JS pattern library; **source of truth** for the firmware preset headers (`firmware/toolchain/check_presets.py` keeps the two in step).
- `content/` — markdown/MDX site copy (`build.md`, `pattern.md`, `inside.md`) and the journal. The journal is the maintainer's own writing.
- `public/flash/` — esp-web-tools manifest + firmware binaries for the browser flasher (there is no `/flash` page: the **Flash Patternflow** button lives on the Pattern tab and in the Play guide). `public/packs/` — the Basics pack. `public/guide/` — the guide's models, its flasher captures, and the live console and editor demos (`firmware/toolchain/console_demo.py`, `editor_demo.py`).
- `scripts/` — build-time helpers (`build-sandbox.ts`, `import-patterns.ts`, ...), the build worker, and the `check:*` smoke suites (`*-smoke.ts`, run with `tsx`); `test/setup.ts` — the setup for the Vitest component tests that sit beside the code (`src/**/*.test.ts(x)`, `npm run check:panels`); `drizzle/` — community DB migrations; `.env.example` — every variable the community host reads.
- `AGENTS.md` here is a block `next dev` writes for AI agents; `CLAUDE.md` is a one-line shim to it. The project's own agent context is the root `AGENTS.md`.

## Contributing

See the repo-level [CONTRIBUTING.md](../CONTRIBUTING.md). Web changes go through a PR into `main`; CI runs lint, typecheck, the `check:*` suites and `next build` on anything under `web/`.

Code in `web/` is MIT licensed ([LICENSE-MIT](../LICENSE-MIT)).
