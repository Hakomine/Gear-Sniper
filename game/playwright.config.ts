import { defineConfig } from '@playwright/test'

/**
 * Normalerweise bringt Playwright seinen eigenen Browser mit, und dann ist
 * hier nichts einzustellen.
 *
 * `CHROMIUM_PFAD` ist fuer Umgebungen mit bereits installiertem Chromium, das
 * nicht zur Playwright-Version passt (etwa dieser Container: Playwright will
 * Build 1234, vorhanden ist 1194). Statt einen zweiten Browser zu laden,
 * zeigt man ihm den vorhandenen:
 *
 *     CHROMIUM_PFAD=/opt/pw-browsers/chromium npx playwright test
 */
const chromiumPfad = process.env.CHROMIUM_PFAD

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.ts',
  // Screenshots sollen vergleichbar sein: eine feste Groesse, ein Worker.
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    // Sonst schneidet Playwright den animierten Hintergrund unterschiedlich.
    deviceScaleFactor: 1,
    ...(chromiumPfad ? { launchOptions: { executablePath: chromiumPfad } } : {}),
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
