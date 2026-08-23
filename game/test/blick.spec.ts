import { test } from '@playwright/test'

/**
 * Arbeitsbrille - nur zum Hinsehen waehrend des Umbaus.
 *
 * Steht bewusst neben `smoke.spec.ts` und macht keine Zusicherungen: Sie
 * liefert schnell ein sauberes Bild vom Getuemmel, ohne dass ein Menue davor
 * steht. Wird am Ende der Runde geloescht.
 */
test('blick', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '__scherbenfeld' in window)
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)

  await page.evaluate(() => {
    const g = (window as unknown as { __scherbenfeld: any }).__scherbenfeld
    const s = g.spiel
    s.zeit = 260
    s.etappe = 3
    s.bossNummer = 40
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    s.spieler.xpNaechste = 1e12
    s.spieler.waffen = g.waffen.slice(0, 5).map((def: any, i: number) => {
      const w = g.ruesteAus(def, i)
      for (let k = 1; k < 3; k++) g.werteAuf(w)
      return w
    })
    s.spieler.abklingMult = 0.7
  })

  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'screenshots/blick-getuemmel.png' })

  // Ein paar gezeichnete Gegner dazu, damit man das Leuchten beurteilen kann.
  await page.evaluate(() => {
    const g = (window as unknown as { __scherbenfeld: any }).__scherbenfeld
    const s = g.spiel
    let n = 0
    for (let i = 0; i < s.gegner.aktiv.length && n < 30; i += 9) {
      if (s.gegner.aktiv[i].zeichen >= 0) continue
      g.setzeZeichen(s, s.gegner.aktiv[i], n % 5)
      n++
    }
  })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'screenshots/blick-zeichen.png' })
})
