---
description: Launch the Til Valhall dev server locally and drive it in a browser
---

# Run

Start the dev server in the background, wait for it to be ready, then drive it with
Playwright.

## Start

```bash
./dev.sh &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null' EXIT
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null 2>&1; do sleep 0.5; done'
```

Default URL: **http://localhost:5173**. `dev.sh` forwards its arguments to Vite, so
`./dev.sh --port 4000` or `./dev.sh --host` work.

## Drive (Playwright)

Playwright is a dev dependency here, so require it from `node_modules` and run the
snippet from the project root.

```javascript
// Run as: node -e "..." from the project root
const { chromium } = require('./node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  // The design frame: 390 x 844, touch-first, dark-only.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.goto('http://localhost:5173/heute');
  await page.waitForSelector('.vh-screen');
  // interact here
  await page.screenshot({ path: 'til-valhall-screenshot.png', fullPage: true });
  await browser.close();
})();
```

If the browser binary is missing: `npx playwright install chromium`.

The app is German and mobile-first. The four tabs are **Heute · Plan · Chronik ·
Ränge** at `/heute`, `/plan`, `/chronik`, `/raenge`; the router is in history mode,
so deep links work. Reach a tab with `nav a[aria-label="Plan"]` — that is the
selector `e2e/smoke.spec.ts` uses, and the visible label is an icon plus text.

State lives in `localStorage` under two keys, `til-valhall.training` and
`til-valhall.ranks`. Clear **both** or neither; clearing one leaves the app
inconsistent. A fresh browser context starts from the seed plan.

## Local deployment of the built app

The dev server does not serve the PWA service worker. To exercise the real build:

```bash
./build.sh
npm run preview
```

## Stop

```bash
pkill -f 'vite' 2>/dev/null || true
```
