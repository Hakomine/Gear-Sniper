import { TICK_DT } from '../src/core/loop'
import { GEGNER_ARTEN } from '../src/game/enemies'
import { legeGegner, MAX_GEGNER } from '../src/game/spawner'
import { ruesteAus, WAFFEN, werteAuf } from '../src/game/weapons'
import type { Befehle } from '../src/game/state'
import { erzeugeSpielstand, starteLauf, tick } from '../src/game/state'

/**
 * Leistungsmessung ohne Browser.
 *
 * Genau dafuer kennt die Spiellogik kein Canvas: Hier laeuft die vollstaendige
 * Simulation - Spawner, Kollisionen, Auseinanderdruecken, Waffen - ohne dass
 * ein einziger Bildpunkt gezeichnet wird. Was hier gemessen wird, ist die
 * reine Rechenlast; alles darueber hinaus ist Zeichenzeit.
 *
 * Budget: Bei 60 Hz stehen 16,6 ms pro Bild zur Verfuegung. Die Logik soll
 * hoechstens 5 ms davon brauchen, damit fuer das Zeichnen genug uebrig bleibt.
 */

/**
 * Gemessen wird am tatsaechlichen Deckel, nicht an einer Wunschzahl: Mehr
 * Gegner als `MAX_GEGNER` kann das Spiel gar nicht erzeugen, und eine
 * Messung an einem Zustand, den es nie gibt, beweist nichts.
 */
const ZIEL_GEGNER = MAX_GEGNER
const TICKS = 3000
const BUDGET_MS = 5

function messen(): void {
  const s = erzeugeSpielstand(20260818)
  starteLauf(s, 20260818)

  // Unsterblich: Gemessen werden soll die Last, nicht wie schnell der Spieler
  // unter der vollen Gegnerzahl stirbt.
  s.spieler.maxHp = 1e9
  s.spieler.hp = 1e9

  // Der Ernstfall: fuenf Waffen, jede auf halber Stufe, alle gleichzeitig am
  // Feuern. Darunter sind Sternenschlucker und Prismastrahl, die grosse
  // Flaechen abfragen, und die Splitterkaskade laeuft dauernd mit. Mit der
  // Startwaffe allein zu messen waere eine Selbsttaeuschung.
  s.spieler.waffen = WAFFEN.slice(0, 5).map((def, i) => {
    const w = ruesteAus(def, i)
    for (let k = 1; k < Math.ceil(def.maxStufe / 2); k++) werteAuf(w)
    return w
  })
  s.spieler.abklingMult = 0.7

  const b: Befehle = { x: 1, y: 0, bestaetigen: false, links: false, rechts: false, wahl: 0 }
  const zeiten = new Float64Array(TICKS)

  for (let i = 0; i < TICKS; i++) {
    auffuellen(s)
    const w = i * 0.02
    b.x = Math.cos(w)
    b.y = Math.sin(w)

    const t0 = performance.now()
    tick(s, b, TICK_DT)
    zeiten[i] = performance.now() - t0
  }

  const sortiert = Array.from(zeiten).sort((x, y) => x - y)
  const summe = sortiert.reduce((a, x) => a + x, 0)
  const p = (anteil: number): number => sortiert[Math.floor(sortiert.length * anteil)]

  const p95 = p(0.95)
  console.log('')
  console.log(`  Gegner am Ende   ${s.gegner.anzahl}`)
  console.log(`  Geschosse        ${s.geschosse.anzahl}`)
  console.log(`  Partikel         ${s.partikel.anzahl}`)
  console.log(`  Kills            ${s.statistik.kills}`)
  console.log('')
  console.log(`  Mittel           ${(summe / TICKS).toFixed(3)} ms/Tick`)
  console.log(`  Median           ${p(0.5).toFixed(3)} ms/Tick`)
  console.log(`  p95              ${p95.toFixed(3)} ms/Tick`)
  console.log(`  Maximum          ${sortiert[sortiert.length - 1].toFixed(3)} ms/Tick`)
  console.log(`  Budget           ${BUDGET_MS.toFixed(3)} ms/Tick`)
  console.log('')

  // Am p95 gemessen, nicht am Maximum: Ein einzelner Ausreisser ist meist der
  // Muellsammler oder die JIT-Aufwaermphase und sagt nichts ueber das Spiel.
  if (p95 > BUDGET_MS) {
    console.error(`  ✗ p95 ueber Budget (${p95.toFixed(3)} > ${BUDGET_MS})`)
    process.exitCode = 1
  } else {
    console.log(`  ✓ p95 innerhalb des Budgets`)
  }
}

/** Nachlegen, bis wieder die Zielzahl steht - gemessen wird der Dauerzustand. */
function auffuellen(s: ReturnType<typeof erzeugeSpielstand>): void {
  const art = GEGNER_ARTEN[0]
  while (s.gegner.anzahl < ZIEL_GEGNER) {
    const w = s.rng.next() * Math.PI * 2
    const r = s.rng.range(60, s.sichtRadius)
    if (legeGegner(s, art, s.spieler.x + Math.cos(w) * r, s.spieler.y + Math.sin(w) * r) === null) {
      break
    }
  }
}

messen()
