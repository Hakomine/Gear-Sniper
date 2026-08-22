/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    // Ohne strictPort weicht Vite bei belegtem Port still auf einen anderen
    // aus - dann greift der Playwright-Test ins Leere.
    strictPort: true,
  },
  build: {
    target: 'es2022',
    // Ein Survivor-like ist eine einzige Schleife; Code-Splitting bringt
    // hier nichts und macht das spaetere Verpacken nur unuebersichtlicher.
    modulePreload: false,
  },
  test: {
    // Nur `*.test.ts`. Ohne diese Einschraenkung wuerde Vitest auch
    // `smoke.spec.ts` einsammeln - das gehoert aber Playwright.
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
