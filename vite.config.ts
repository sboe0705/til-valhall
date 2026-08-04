import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * GitHub Pages serves a project repo from /<repo>/, so the CI build passes the
 * prefix in. Locally and in `npm run dev` it stays the domain root — which also
 * keeps the Playwright `baseURL` valid.
 */
const base = process.env.VITE_BASE ?? '/';

/**
 * The build stamps itself so a deployed Pages build can be identified. Resolved
 * once while the config loads, which means `vite dev` freezes it at server start
 * — and a checkout without a `.git` directory still builds.
 */
function commitInfo() {
  try {
    const [hash, date] = execSync('git log -1 --format=%h,%cd --date=short')
      .toString()
      .trim()
      .split(',');
    return { hash, date };
  } catch {
    return { hash: 'dev', date: new Date().toISOString().slice(0, 10) };
  }
}

const { hash: commitHash, date: commitDate } = commitInfo();

// https://vite.dev/config/
export default defineConfig({
  base,
  // `define` substitutes raw text, so the values have to arrive as JSON literals.
  define: {
    __APP_COMMIT__: JSON.stringify(commitHash),
    __APP_COMMIT_DATE__: JSON.stringify(commitDate),
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Til Valhall',
        short_name: 'Til Valhall',
        description:
          'Trainingsplan und Rangleitern – jeder abgehakte Satz füllt Woche, Monat und Jahr.',
        lang: 'de',
        // Must follow `base`, or the installed PWA opens outside its own scope.
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F1416',
        theme_color: '#0F1416',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: 'icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
