import { expect, test, type Page } from '@playwright/test'

/**
 * Das Spiel wirklich starten, spielen und ansehen.
 *
 * Genau dafuer faellt die Wahl auf Web-Technik: Dieser Lauf startet das
 * fertige Spiel im Browser, drueckt echte Tasten und legt Screenshots ab.
 * Was Zahlen nicht zeigen - ob das Bild lesbar ist, ob die Karten sitzen, ob
 * das Getuemmel als Schwarm oder als Brei ankommt - wird hier sichtbar.
 *
 * Der Saatwert wird vor dem Start festgesetzt, damit dieselben Bilder
 * herauskommen und ein Vergleich zwischen zwei Staenden etwas bedeutet.
 *
 * Achtung bei Aenderungen: Die Funktionen in `page.evaluate` laufen im
 * Browser und sehen nichts aus dieser Datei - jeder Zugriff auf den Spielgriff
 * muss dort ausgeschrieben stehen, Hilfsfunktionen von hier draussen sind
 * darin schlicht nicht vorhanden.
 */

const SAAT = 20260818

/** Nur das, was der Test wissen muss - nicht der ganze Spielstand. */
type Griff = {
  phase: string
  zeit: number
  kills: number
  level: number
  gegner: number
  hp: number
}

/** So weit, wie der Test am Spielstand im Browser herumgreift. */
type Spiel = {
  phase: string
  zeit: number
  saat: number
  statistik: { kills: number }
  spieler: {
    level: number
    hp: number
    maxHp: number
    xpNaechste: number
    abklingMult: number
    waffen: WaffenInstanzLose[]
  }
  gegner: { anzahl: number }
  zonen: { anzahl: number }
}

type WaffenDefLose = { id: string; maxStufe: number }
type WaffenInstanzLose = { stufe: number; werte: unknown }

type Fenster = Window & {
  __scherbenfeld: {
    spiel: Spiel
    waffen: readonly WaffenDefLose[]
    ruesteAus: (def: WaffenDefLose, platz: number) => WaffenInstanzLose
    werteAuf: (w: WaffenInstanzLose) => void
  }
}

async function lies(page: Page): Promise<Griff> {
  return page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    return {
      phase: s.phase,
      zeit: s.zeit,
      kills: s.statistik.kills,
      level: s.spieler.level,
      gegner: s.gegner.anzahl,
      hp: s.spieler.hp,
    }
  })
}

/**
 * Lauf starten und warten, bis er wirklich laeuft.
 *
 * Das Warten ist noetig, nicht hoeflich: `keyboard.press` kehrt zurueck,
 * sobald das Tastenereignis abgeschickt ist - verarbeitet wird es erst im
 * naechsten Tick. Wer sofort danach am Spielstand dreht, schreibt in einen
 * Zustand, den `starteLauf` gleich darauf zurueckstellt. Genau daran ist die
 * Dichte-Pruefung zuerst gescheitert: Die vorgespulte Spielzeit war eine
 * Zehntelsekunde spaeter wieder null.
 */
async function starte(page: Page): Promise<void> {
  await page.keyboard.press('Space')
  await page.waitForFunction(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.phase === 'laufend',
    undefined,
    { timeout: 10_000 },
  )
}

/** Spielt eine Weile und raeumt dabei aufpoppende Levelup-Menues weg. */
async function spiele(page: Page, sekunden: number): Promise<void> {
  const ende = Date.now() + sekunden * 1000
  const richtungen = ['KeyD', 'KeyS', 'KeyA', 'KeyW']
  let i = 0

  while (Date.now() < ende) {
    const zustand = await lies(page)
    if (zustand.phase === 'levelup') {
      await page.keyboard.press('Digit1')
      continue
    }
    if (zustand.phase === 'tot') return

    // Im Kreis laufen: haelt den Spieler in Bewegung und sorgt dafuer, dass
    // die Bilder nicht alle gleich aussehen.
    const taste = richtungen[i++ % richtungen.length]
    await page.keyboard.down(taste)
    await page.waitForTimeout(420)
    await page.keyboard.up(taste)
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => '__scherbenfeld' in window)
  await page.evaluate((saat) => {
    ;(window as unknown as Fenster).__scherbenfeld.spiel.saat = saat
  }, SAAT)
})

test('Titelbild steht', async ({ page }) => {
  expect((await lies(page)).phase).toBe('titel')
  await page.screenshot({ path: 'screenshots/01-titel.png' })
})

test('Lauf startet und laeuft', async ({ page }) => {
  await starte(page)
  await spiele(page, 6)

  const zustand = await lies(page)
  expect(zustand.phase).not.toBe('titel')
  expect(zustand.gegner).toBeGreaterThan(0)
  await page.screenshot({ path: 'screenshots/02-fruehe-welle.png' })
})

test('Levelup-Menue erscheint und laesst sich bedienen', async ({ page }) => {
  await starte(page)

  // Der erste Aufstieg kommt binnen weniger Sekunden - kaeme er spaeter,
  // waere genau das das Problem.
  await page.waitForFunction(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.phase === 'levelup',
    undefined,
    { timeout: 30_000 },
  )

  expect((await lies(page)).level).toBeGreaterThan(1)
  await page.screenshot({ path: 'screenshots/03-levelup.png' })

  await page.keyboard.press('Digit1')
  await page.waitForTimeout(300)
  expect((await lies(page)).phase).toBe('laufend')
})

test('Getuemmel in der spaeten Phase bleibt lesbar', async ({ page }) => {
  await starte(page)

  // Die Spielzeit vorspulen statt vier Minuten zu warten: Spawnrate und
  // Zaehigkeit haengen allein an `zeit`, also entsteht dieselbe Dichte in
  // Sekunden.
  //
  // Der Spieler bleibt dabei bewusst unangetastet - nur unsterblich, sonst
  // Grundausstattung - und er bleibt stehen. Ein erster Versuch mit
  // aufgewerteter Waffe und laufendem Spieler pendelte sich bei 19 Gegnern
  // ein: Die Waffe raeumte schneller ab, als nachkam, und das Weglaufen liess
  // den Rest zurueckfallen. Fuer ein Bild vom Gedraenge ist genau das falsch.
  await page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    s.zeit = 240
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
  })

  // Stehen bleiben und nur die Levelup-Menues wegraeumen.
  const ende = Date.now() + 15_000
  while (Date.now() < ende) {
    if ((await lies(page)).phase === 'levelup') await page.keyboard.press('Digit1')
    else await page.waitForTimeout(250)
  }

  const zustand = await lies(page)
  expect(zustand.gegner).toBeGreaterThan(150)
  expect(zustand.kills).toBeGreaterThan(0)
  await page.screenshot({ path: 'screenshots/04-getuemmel.png' })
})

test('Todesbildschirm zeigt das Ergebnis', async ({ page }) => {
  await starte(page)
  await spiele(page, 4)

  // Waffen abnehmen und Leben auf 1: Geprueft wird der Uebergang in den
  // Todesbildschirm, nicht die Geduld.
  //
  // Das Abnehmen ist noetig geworden, seit die Waffen etwas taugen: Ein
  // stehender Spieler mit zwei Waffen raeumt alles weg, bevor es ihn
  // beruehrt, und wartet dreissig Sekunden vergeblich auf seinen Tod.
  await page.evaluate(() => {
    const sp = (window as unknown as Fenster).__scherbenfeld.spiel.spieler
    sp.waffen.length = 0
    sp.hp = 1
  })

  // Nicht stumpf warten, sondern weiter Levelup-Menues wegraeumen: Steht
  // eines offen, ruht die Simulation - dann kann der Spieler gar nicht
  // sterben und das Warten laeuft in die Zeitgrenze. Genau daran ist der Test
  // zuerst gescheitert, nachdem die Aufstiegskurve schneller wurde.
  const frist = Date.now() + 30_000
  while (Date.now() < frist) {
    const zustand = await lies(page)
    if (zustand.phase === 'tot') break
    if (zustand.phase === 'levelup') await page.keyboard.press('Digit1')
    else await page.waitForTimeout(200)
  }

  await page.waitForTimeout(400)
  await page.screenshot({ path: 'screenshots/05-tod.png' })

  const zustand = await lies(page)
  expect(zustand.phase).toBe('tot')
  expect(zustand.hp).toBe(0)
})

test('Voller Waffenbau zeigt alle Wirkungen', async ({ page }) => {
  await starte(page)

  // Fuenf Waffen auf Maxstufe: Trabanten kreisen, der Prismastrahl schneidet
  // durchs Bild, der Sternenschlucker zieht einen Klumpen zusammen, und die
  // angerissenen Gegner tragen ihre Bruchlinien. Zehn Minuten zu spielen, um
  // dieses eine Bild zu bekommen, waere im Test nicht vertretbar.
  //
  // Gewaehlt sind bewusst die optisch verschiedensten: Hieb, Knall, Bahn,
  // Strahl und Sog. Fuenf Varianten derselben Kugel saehen aus wie eine.
  await page.evaluate(() => {
    const griff = (window as unknown as Fenster).__scherbenfeld
    const s = griff.spiel
    // Spaet genug, dass die Spawnrate am Anschlag steht: Ein fertiger Bau
    // raeumt rund 27 Gegner je Sekunde weg, nachschieben muessen also mehr.
    s.zeit = 500
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9

    const wunsch = ['klinge', 'bazooka', 'trabanten', 'prisma', 'schlucker']
    s.spieler.waffen = wunsch.map((id, platz) => {
      const def = griff.waffen.find((d) => d.id === id)
      if (def === undefined) throw new Error(`Waffe fehlt: ${id}`)
      const w = griff.ruesteAus(def, platz)
      // Ueber `werteAuf` statt die Stufe direkt zu setzen: Nur so werden die
      // Werte mitgerechnet, sonst feuern Maxstufen-Waffen mit Stufe-1-Zahlen.
      for (let k = 1; k < def.maxStufe; k++) griff.werteAuf(w)
      return w
    })
  })

  const ende = Date.now() + 14_000
  while (Date.now() < ende) {
    if ((await lies(page)).phase === 'levelup') await page.keyboard.press('Digit1')
    else await page.waitForTimeout(250)
  }

  // Ein offenes Levelup verdeckt genau das, was das Bild zeigen soll. Mit
  // einem fertigen Bau stroemt so viel Erfahrung herein, dass im Sekundentakt
  // eines aufgeht - deshalb die Schwelle hochdrehen statt wegzuklicken.
  // Reihenfolge zaehlt: `gibXp` rechnet die naechste Schwelle bei jedem
  // Aufstieg aus der Formel neu. Wer sie vorher hochdreht, sieht sie beim
  // naechsten Levelup wieder ueberschrieben - also erst leerraeumen.
  while ((await lies(page)).phase === 'levelup') {
    await page.keyboard.press('Digit1')
    await page.waitForTimeout(200)
  }
  await page.evaluate(() => {
    ;(window as unknown as Fenster).__scherbenfeld.spiel.spieler.xpNaechste = 1e9
  })
  // Kurz laufen lassen, damit Strahl und Sog wieder ausloesen.
  await page.waitForTimeout(2500)

  const zustand = await lies(page)
  expect(zustand.gegner).toBeGreaterThan(40)
  await page.screenshot({ path: 'screenshots/06-vollausbau.png' })
})
