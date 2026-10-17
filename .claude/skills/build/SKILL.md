---
description: Lint, test and build the Til Valhall project for a local deployment
---

# Build

Run the project's `build.sh`, which executes `npm run lint`, `npm test`,
`npm run build` and `npm run test:e2e` in sequence — the CI workflow's `build`
job followed by its `e2e` job.

```bash
./build.sh
```

- Lint is **ESLint 9 + Prettier**. One warning is expected and documented: the
  `as any` cast in [schedule.ts:200](../../../src/model/schedule.ts#L200).
- Tests are **Vitest** (`src/**/*.spec.ts`, `src/model/*.test.ts`), then the
  **Playwright** smoke test (`e2e/`), which starts its own dev server. Where the
  installed Chromium does not match Playwright's revision, point
  `PLAYWRIGHT_CHROMIUM_PATH` at it (`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium ./build.sh`).
- `npm run build` runs `vue-tsc --build` first, so `npm run type-check` is covered.
- Build output lands in `dist/`.
- The script exits non-zero on the first failure, so a passing run means lint,
  tests, type-check, build and the smoke test all succeeded.

## Base path

The build defaults to the domain root (`base: '/'`). GitHub Pages serves the repo
from `/til-valhall/`, which CI passes in via `VITE_BASE`. To reproduce that build
locally:

```bash
VITE_BASE=/til-valhall/ ./build.sh
```

Only do this when debugging a Pages-specific path problem — the resulting `dist/`
will not work when served from a local root.
