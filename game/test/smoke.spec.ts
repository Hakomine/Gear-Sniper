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
  statistik: { kills: number; schadenProPlatz: number[] }
  spieler: {
    level: number
    hp: number
    maxHp: number
    xp: number
    xpNaechste: number
    abklingMult: number
    maxWaffen: number
    waffen: WaffenInstanzLose[]
  }
  gegner: { anzahl: number; aktiv: GegnerLose[] }
  zonen: { anzahl: number }
  angebote: Array<{ art: string; name: string }>
  charakterWahl: number
  offen: string[]
  bossNummer: number
  etappe: number
  tuerAngebot: string[]
  schreine: { anzahl: number; aktiv: SchreinLose[] }
}

type SchreinLose = { art: string; x: number; y: number; ladung: number; benutzt: boolean }

/** So weit, wie der Test an einen Gegner herangeht. */
type GegnerLose = {
  hp: number
  maxHp: number
  bossZustand: { phase: number; telegraf: number; art: { name: string } } | null
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
  // Jede Menuephase wegklicken, nicht nur das Levelup: Seit es Schreine gibt,
  // kann mitten im Warten eine Karte aufgehen, und seit es Etappen gibt auch
  // eine Atempause. Wer nur auf 'levelup' hoert, wartet in die Zeitgrenze.
  const frist = Date.now() + 30_000
  while (Date.now() < frist) {
    const zustand = await lies(page)
    if (zustand.phase === 'tot') break
    if (zustand.phase === 'laufend') await page.waitForTimeout(150)
    else await page.keyboard.press('Digit1')
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

test('Charakterwahl zeigt Vorteil, Nachteil und die gesperrten', async ({ page }) => {
  // Der Titelbildschirm ist zugleich die Auswahl. Weitergeblaettert wird auf
  // einen gesperrten Charakter: Dort steht die Bedingung statt der Werte, und
  // genau das ist der Grund, ihn ueberhaupt anzuzeigen.
  expect((await lies(page)).phase).toBe('titel')
  await page.keyboard.press('KeyD')
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'screenshots/07-charakterwahl.png' })

  const wahl = await page.evaluate(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.charakterWahl,
  )
  expect(wahl).toBe(1)

  // Ein gesperrter Charakter startet den Lauf nicht.
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  expect((await lies(page)).phase).toBe('titel')
})

test('Boss erscheint, kuendigt an und traegt seine Leiste', async ({ page }) => {
  await starte(page)

  // Vorspulen bis kurz vor die erste Bosswelle - der Spawner setzt ihn dann
  // von allein. Unsterblich, weil das Bild den Boss zeigen soll und nicht den
  // Todesbildschirm.
  await page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    s.zeit = 90
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    s.spieler.xpNaechste = 1e9
  })

  await page.waitForFunction(
    () =>
      (window as unknown as Fenster).__scherbenfeld.spiel.gegner.aktiv.some(
        (g) => g.bossZustand !== null,
      ),
    undefined,
    { timeout: 30_000 },
  )

  // Auf eine laufende Vorwarnung warten: Das ist der Moment, den das Bild
  // belegen soll - der Angriff steht angekuendigt auf dem Boden.
  await page.waitForFunction(
    () =>
      (window as unknown as Fenster).__scherbenfeld.spiel.gegner.aktiv.some(
        (g) => g.bossZustand !== null && g.bossZustand.telegraf > 0,
      ),
    undefined,
    { timeout: 30_000 },
  )
  await page.screenshot({ path: 'screenshots/08-boss-telegraf.png' })

  // Phase zwei: Trefferpunkte unter die Schwelle druecken und ansehen, wie
  // das Muster wechselt.
  await page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    for (const g of s.gegner.aktiv) {
      if (g.bossZustand !== null) g.hp = g.maxHp * 0.25
    }
  })
  await page.waitForFunction(
    () =>
      (window as unknown as Fenster).__scherbenfeld.spiel.gegner.aktiv.some(
        (g) => g.bossZustand !== null && g.bossZustand.phase === 2,
      ),
    undefined,
    { timeout: 15_000 },
  )
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'screenshots/09-boss-phase2.png' })
})

test('Fusionskarte steht im Angebot', async ({ page }) => {
  await starte(page)

  // Beide Eltern ausgereizt und der Guertel dicht: Damit bleibt im Waffentopf
  // nur noch die Verschmelzung uebrig - keine neuen Waffen (kein Platz), keine
  // Stufen (beide auf Max). Die Karte ist damit sicher dabei, ohne dass der
  // Test zwanzigmal wuerfeln muss.
  await page.evaluate(() => {
    const griff = (window as unknown as Fenster).__scherbenfeld
    const s = griff.spiel
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    s.spieler.waffen = ['klinge', 'trabanten'].map((id, platz) => {
      const def = griff.waffen.find((d) => d.id === id)
      if (def === undefined) throw new Error(`Waffe fehlt: ${id}`)
      const w = griff.ruesteAus(def, platz)
      for (let k = 1; k < def.maxStufe; k++) griff.werteAuf(w)
      return w
    })
    s.spieler.maxWaffen = 2
    s.spieler.xp = s.spieler.xpNaechste
  })

  await page.waitForFunction(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.phase === 'levelup',
    undefined,
    { timeout: 20_000 },
  )

  const arten = await page.evaluate(() =>
    (window as unknown as Fenster).__scherbenfeld.spiel.angebote.map((a) => a.art),
  )
  expect(arten).toContain('fusion')
  await page.screenshot({ path: 'screenshots/10-fusionskarte.png' })
})

test('Todesbildschirm wertet aus, woran sie gestorben sind', async ({ page }) => {
  await starte(page)

  // Erst ein paar Waffen wirken lassen, damit die Balken etwas zu zeigen
  // haben - ein leeres Diagramm belegt nichts.
  await page.evaluate(() => {
    const griff = (window as unknown as Fenster).__scherbenfeld
    const s = griff.spiel
    s.zeit = 200
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    s.spieler.xpNaechste = 1e9
    s.spieler.waffen = ['klinge', 'bazooka', 'blitz', 'prisma'].map((id, platz) => {
      const def = griff.waffen.find((d) => d.id === id)
      if (def === undefined) throw new Error(`Waffe fehlt: ${id}`)
      const w = griff.ruesteAus(def, platz)
      for (let k = 1; k < def.maxStufe; k++) griff.werteAuf(w)
      return w
    })
  })
  await page.waitForTimeout(6000)

  const verteilt = await page.evaluate(
    () =>
      (window as unknown as Fenster).__scherbenfeld.spiel.statistik.schadenProPlatz.filter(
        (x) => x > 0,
      ).length,
  )
  // Mehrere Balken, sonst ist es kein Diagramm.
  expect(verteilt).toBeGreaterThan(2)

  await page.evaluate(() => {
    const sp = (window as unknown as Fenster).__scherbenfeld.spiel.spieler
    sp.waffen.length = 0
    sp.maxHp = 100
    sp.hp = 1
  })

  const frist = Date.now() + 30_000
  while (Date.now() < frist) {
    const zustand = await lies(page)
    if (zustand.phase === 'tot') break
    if (zustand.phase === 'laufend') await page.waitForTimeout(150)
    else await page.keyboard.press('Digit1')
  }

  // Kurz warten, damit der Sprung im Glas seine volle Groesse erreicht hat.
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'screenshots/11-auswertung.png' })
  expect((await lies(page)).phase).toBe('tot')
})

test('Pausenmenü hält an und lässt sich bedienen', async ({ page }) => {
  await starte(page)
  await spiele(page, 3)

  await page.keyboard.press('Escape')
  await page.waitForFunction(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.phase === 'pause',
    undefined,
    { timeout: 10_000 },
  )
  await page.screenshot({ path: 'screenshots/12-pause.png' })

  // Die Simulation steht wirklich still.
  const zeit = (await lies(page)).zeit
  await page.waitForTimeout(700)
  expect((await lies(page)).zeit).toBe(zeit)

  // Und dieselbe Taste gibt wieder frei.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  expect((await lies(page)).phase).toBe('laufend')
})

test('Schreine stehen im Feld und zeigen sich am Rand', async ({ page }) => {
  await starte(page)

  const schreine = await page.evaluate(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.schreine.anzahl,
  )
  expect(schreine).toBeGreaterThanOrEqual(2)

  // Einen Schrein direkt neben den Spieler holen, damit er im Bild steht -
  // sonst zeigt der Screenshot nur den Randpfeil.
  await page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    const sch = s.schreine.aktiv[0]
    sch.art = 'amboss'
    sch.x = s.spieler.x + 40
    sch.y = s.spieler.y
  })

  // Stillstehen laedt den Amboss - der Ring soll auf dem Bild zu sehen sein.
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'screenshots/13-schrein.png' })
})

test('Atempause zeigt drei Türen mit Preis und Lohn', async ({ page }) => {
  await starte(page)

  // Boss herholen und umbringen: Das ist der Weg in die Atempause.
  await page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    s.zeit = 90
    s.spieler.maxHp = 1e9
    s.spieler.hp = 1e9
    s.spieler.xpNaechste = 1e9
  })
  await page.waitForFunction(
    () =>
      (window as unknown as Fenster).__scherbenfeld.spiel.gegner.aktiv.some(
        (g) => g.bossZustand !== null,
      ),
    undefined,
    { timeout: 30_000 },
  )
  await page.evaluate(() => {
    const s = (window as unknown as Fenster).__scherbenfeld.spiel
    for (const g of s.gegner.aktiv) if (g.bossZustand !== null) g.hp = 1
  })

  await page.waitForFunction(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.phase === 'atempause',
    undefined,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'screenshots/14-atempause.png' })

  const tueren = await page.evaluate(
    () => (window as unknown as Fenster).__scherbenfeld.spiel.tuerAngebot,
  )
  expect(tueren.length).toBe(3)
  expect(tueren).toContain('ruhe')
})
