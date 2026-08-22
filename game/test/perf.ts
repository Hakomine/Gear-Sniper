import { TICK_DT } from '../src/core/loop'
import { bossWelle, findeBoss, naechsteBossZeit } from '../src/game/bosse'
import type { GegnerArt } from '../src/game/enemies'
import { GEGNER_ARTEN, gewichtFuer } from '../src/game/enemies'
import { legeGegner, MAX_GEGNER } from '../src/game/spawner'
import { ruesteAus, WAFFEN, werteAuf } from '../src/game/weapons'
import type { Befehle } from '../src/game/state'
import { erzeugeSpielstand, leereBefehle, starteLauf, tick } from '../src/game/state'

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

  const b: Befehle = leereBefehle()
  // Levelups von selbst wegraeumen und dauerhaft nach rechts laufen: Die
  // Messung soll den Dauerzustand treffen, nicht ein offenes Menue.
  b.wahl = 0
  b.x = 1
  const zeiten = new Float64Array(TICKS)
  let feindSpitze = 0

  for (let i = 0; i < TICKS; i++) {
    // Der Boss zuerst: `auffuellen` fuellt bis zum Deckel, und ein voller Pool
    // liefert keinen Platz mehr fuer ihn.
    bossHalten(s)
    auffuellen(s)
    const w = i * 0.02
    b.x = Math.cos(w)
    b.y = Math.sin(w)

    const t0 = performance.now()
    tick(s, b, TICK_DT)
    zeiten[i] = performance.now() - t0

    // Spitzenwert, nicht Endstand: Bossgeschosse leben nur wenige Sekunden,
    // und der letzte Tick trifft fast nie eine Salve.
    if (s.feindSchuesse.anzahl > feindSpitze) feindSpitze = s.feindSchuesse.anzahl
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
  console.log(`  Bosse erlegt     ${s.statistik.bosse}`)
  console.log(`  Feindgeschosse   ${feindSpitze} (Spitze)`)
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

/**
 * Immer ein Boss auf dem Feld.
 *
 * Ein Boss kostet mehr als ein Gegner: Vorwarnungen legen Effekte an, Salven
 * fuellen den Geschosspool des Feindes, und der Bruchruf setzt achtmal
 * Gegner nach. Ohne ihn misst die Zahl den halben Ernstfall.
 *
 * Die Spielzeit wird fuer den Aufruf kurz vorgestellt und danach zurueckgesetzt
 * - sonst schoebe die Messung selbst die Schwierigkeitskurve nach vorn und die
 * Zahlen waeren mit frueheren Laeufen nicht mehr vergleichbar. Weil
 * `bossWelle` bei jedem Auftritt weiterzaehlt, steht nach den ersten beiden
 * dauerhaft der Zerbrecher mit allen vier Angriffen da: der teuerste Fall.
 */
function bossHalten(s: ReturnType<typeof erzeugeSpielstand>): void {
  if (findeBoss(s) !== null) return
  const echteZeit = s.zeit
  s.zeit = naechsteBossZeit(s.bossNummer)
  bossWelle(s)
  s.zeit = echteZeit
}

/**
 * Alle Arten, die im Spiel wirklich vorkommen.
 *
 * `gewicht: 0` haben nur Arten, die der Spawner nie zieht - das Bruchstueck
 * entsteht ausschliesslich, wenn ein Teiler zerfaellt, und darf die Messung
 * nicht kuenstlich verduennen.
 */
/*
 * Gewichtet wie im Spiel, nicht gleichverteilt.
 *
 * Zuerst lief die Messung reihum durch alle Arten - damit bestand ein Sechstel
 * des Feldes aus Speiern, die es im Spiel nie in dieser Menge gibt. Gemessen
 * wurden so 1871 Feindgeschosse gleichzeitig und ein p95 von 4,5 ms: ein
 * Zustand, den das Spiel gar nicht erreichen kann. Eine Messung an einem
 * unmoeglichen Zustand beweist nichts.
 *
 * Die Gewichte der zehnten Minute, weil dort die Mischung am schwersten ist.
 */
const SPAETE_ZEIT = 600
const MISCHUNG: GegnerArt[] = []
for (const art of GEGNER_ARTEN) {
  if (art.gewicht <= 0) continue
  const anteil = Math.max(1, Math.round(gewichtFuer(art, SPAETE_ZEIT) / 4))
  for (let i = 0; i < anteil; i++) MISCHUNG.push(art)
}

/**
 * Nachlegen, bis wieder die Zielzahl steht - gemessen wird der Dauerzustand.
 *
 * Reihum durch *alle* Arten, nicht nur Splitter. Das ist der teurere Fall und
 * der einzig ehrliche: Der Schwaermer kreist, der Stuermer legt Effekte an,
 * der Speier fuellt den Geschosspool, und der Kitt fragt jede gute Sekunde
 * seinen Umkreis ab. Eine Messung mit 1400 Splittern wuerde von alledem
 * nichts sehen.
 */
function auffuellen(s: ReturnType<typeof erzeugeSpielstand>): void {
  while (s.gegner.anzahl < ZIEL_GEGNER) {
    const art = MISCHUNG[s.gegner.anzahl % MISCHUNG.length]
    const w = s.rng.next() * Math.PI * 2
    const r = s.rng.range(60, s.sichtRadius)
    if (legeGegner(s, art, s.spieler.x + Math.cos(w) * r, s.spieler.y + Math.sin(w) * r) === null) {
      break
    }
  }
}

messen()
