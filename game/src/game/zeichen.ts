import { FARBEN } from '../render/palette'
import type { Gegner, Spielstand } from './state'
import { legeEffekt, legeZone, MAX_ZONEN } from './welt'

/**
 * Zeichen - Abzeichen, die auf *jeden* vorhandenen Gegner passen.
 *
 * Neun Arten mal fuenf Zeichen sind fuenfundvierzig Begegnungen statt neun,
 * und der Preis dafuer ist ein Datenfeld am Gegner. Das ist der billigste Weg
 * zu Vielfalt, den dieses Genre kennt - Risk of Rain 2 baut sein halbes
 * Spaetspiel darauf.
 *
 * Der eigentliche Griff liegt aber nicht in der Zahl, sondern darin, *was*
 * ein Zeichen aendert: Es greift das **raeumliche Verhaeltnis** zwischen
 * Spieler und Gegner an, nicht dessen Werte. Ein Gegner mit doppelten
 * Trefferpunkten ist derselbe Gegner in laenger. Ein Gegner, der einen zu
 * sich zieht oder eine brennende Spur legt, ist ein anderes Problem.
 *
 * Zwei der fuenf gehen direkt an die Kernregel:
 *
 * - Die **Klammer** laesst ihre Risse dreimal so schnell verfallen. Ein Bau,
 *   der Risse langsam ansammelt, kommt an ihr nicht vorbei - man muss alle
 *   Waffen in einem Fenster auf sie bringen. Dieselbe Zielfrage, die der Kitt
 *   gestellt hat, nur an einem einzelnen Koerper.
 * - Das **Echo** zerfaellt in zwei ungezeichnete Kopien und straft damit das
 *   gedankenlose Wegraeumen mit Flaeche.
 *
 * **Kosten:** `Gegner.zeichen` ist ein Index in diese Tabelle, `-1` heisst
 * keins. Eine Ganzzahl, kein String und kein Objekt - `if (g.zeichen < 0)`
 * ist der vollstaendige Aufwand fuer alle ungezeichneten Gegner, und das sind
 * bei jeder Anteilskurve die allermeisten.
 */
export type ZeichenId = 'zunder' | 'frostmal' | 'klammer' | 'echo' | 'zieher'

export type Zeichen = {
  readonly id: ZeichenId
  readonly name: string
  readonly farbe: string
  /** Was das Zeichen dem Traeger an Trefferpunkten aufschlaegt. */
  readonly hpFaktor: number
  /** Und was es dafuer einbringt. Ein Zeichen ist ein *Ziel*, kein Aergernis. */
  readonly xpFaktor: number
  /** Ab welcher Etappe es ueberhaupt gezogen werden darf. */
  readonly abEtappe: number
  /** Faktor auf den Rissverfall des Traegers. 1 = normal. */
  readonly rissZerfall: number
  /** Jeden Tick, solange er lebt. */
  readonly tick?: (s: Spielstand, g: Gegner, dt: number) => void
  /** Beim Tod, bevor der Pool ihn einzieht. */
  readonly beiTod?: (s: Spielstand, g: Gegner) => void
}

/** Der Wert in `Gegner.zeichen`, wenn keins gesetzt ist. */
export const OHNE_ZEICHEN = -1

/**
 * Wie viele gezeichnete Gegner hoechstens gleichzeitig auf dem Feld stehen.
 *
 * Gezeichnete kosten echte Rechenzeit - eine Spur, ein Sog, eine Abfrage -
 * waehrend ungewoehnliche Gegner sonst nur eine Ganzzahlpruefung kosten. Der
 * Deckel haelt diesen Posten unabhaengig davon, wie hoch die Anteilskurve
 * spaeter noch steigt, und er haelt das Bild lesbar: Ein Feld, auf dem alles
 * leuchtet, hat keine Abzeichen mehr, sondern nur noch Rauschen.
 */
export const MAX_GEZEICHNET = 70

const ZUNDER_TAKT = 0.4
const ZUNDER_RADIUS = 36

/** Wie weit das Frostmal beim Platzen reicht und wie lange es bremst. */
const FROSTMAL_RADIUS = 145
const FROSTMAL_DAUER = 1.8

/** Wie weit der Zieher greift und mit welcher Kraft. */
const ZIEHER_REICHWEITE = 330
const ZIEHER_KRAFT = 62

export const ZEICHEN: readonly Zeichen[] = [
  {
    id: 'zunder',
    name: 'Zunder',
    farbe: '#ff7a2f',
    hpFaktor: 2.1,
    xpFaktor: 5,
    abEtappe: 1,
    rissZerfall: 1,
    tick(s, g, dt) {
      g.zeichenTakt -= dt
      if (g.zeichenTakt > 0) return
      g.zeichenTakt = ZUNDER_TAKT
      // Derselbe Deckel wie beim Splitterfeld: Selbsttaetige Zonenquellen
      // teilen sich ein Gesamtbudget, Waffenzonen pruefen es nicht.
      if (s.zonen.anzahl >= MAX_ZONEN) return

      const z = legeZone(s, 'brand', g.x, g.y, ZUNDER_RADIUS, 2.4, g.schaden * 0.55, -1, '#ff7a2f')
      z.feindlich = true
    },
  },
  {
    id: 'frostmal',
    name: 'Frostmal',
    farbe: '#63d4ff',
    hpFaktor: 2.2,
    xpFaktor: 5,
    abEtappe: 2,
    rissZerfall: 1,
    beiTod(s, g) {
      legeEffekt(s, 'ring', g.x, g.y, FROSTMAL_RADIUS, 0.45, '#63d4ff', 3)
      const sp = s.spieler
      const dx = sp.x - g.x
      const dy = sp.y - g.y
      if (dx * dx + dy * dy > FROSTMAL_RADIUS * FROSTMAL_RADIUS) return
      // Straft genau das, was sonst immer richtig ist: alles direkt vor den
      // eigenen Fuessen wegzuraeumen.
      sp.gebremst = Math.max(sp.gebremst, FROSTMAL_DAUER)
      s.klaenge.melde('warnung', 0.4)
    },
  },
  {
    id: 'klammer',
    name: 'Klammer',
    farbe: '#ffd24a',
    hpFaktor: 2.4,
    xpFaktor: 6,
    abEtappe: 3,
    // Der einzige Eingriff direkt in die Kernregel. Kein neuer Code noetig -
    // `bewegeGegner` multipliziert den Zerfall ohnehin schon mit einem Wert
    // aus den Etappenwerten.
    rissZerfall: 3,
  },
  {
    id: 'echo',
    name: 'Echo',
    farbe: '#c86bff',
    hpFaktor: 2,
    xpFaktor: 5,
    abEtappe: 4,
    rissZerfall: 1,
    beiTod(s, g) {
      for (let i = 0; i < 2; i++) {
        const w = (i / 2) * Math.PI * 2 + s.rng.next() * 0.7
        const k = legeGegnerHilfe(s, g, Math.cos(w) * 22, Math.sin(w) * 22)
        if (k === null) return
        k.maxHp *= 0.5
        k.hp = k.maxHp
        k.radius = g.radius * 0.75
      }
    },
  },
  {
    id: 'zieher',
    name: 'Zieher',
    farbe: '#a6ff4d',
    hpFaktor: 2.3,
    xpFaktor: 6,
    abEtappe: 5,
    rissZerfall: 1,
    tick(s, g, dt) {
      const sp = s.spieler
      const dx = g.x - sp.x
      const dy = g.y - sp.y
      const d2 = dx * dx + dy * dy
      if (d2 > ZIEHER_REICHWEITE * ZIEHER_REICHWEITE || d2 < 1) return
      const d = Math.sqrt(d2)
      // Naeher zieht staerker - so bleibt Weglaufen eine Loesung, wenn man
      // frueh genug anfaengt.
      const kraft = ZIEHER_KRAFT * (1 - (d / ZIEHER_REICHWEITE) * 0.55)
      sp.zugX += (dx / d) * kraft * dt
      sp.zugY += (dy / d) * kraft * dt
    },
  },
]

/**
 * Eine ungezeichnete Kopie desselben Gegners danebensetzen - fuers Echo.
 *
 * Warum hereingereicht und nicht importiert: `spawner.ts` braucht diese Datei
 * (es zieht beim Spawn ein Zeichen), also darf diese Datei nicht ihrerseits
 * `spawner.ts` importieren - das waere der erste gegenseitige Import im
 * ganzen Projekt, und die sternfoermige Richtung ist genau das, was den
 * Aufbau lesbar haelt. `spawner.ts` reicht die Funktion beim Laden einmal
 * herein; ein Test haelt fest, dass das Echo tatsaechlich Kopien setzt -
 * sonst waere ein vergessener Aufruf im Spiel unsichtbar.
 */
let leger: ((s: Spielstand, g: Gegner, dx: number, dy: number) => Gegner | null) | null = null

/** Wird einmal von `spawner.ts` gesetzt - siehe `legeGegnerHilfe`. */
export function setzeLeger(
  fn: (s: Spielstand, g: Gegner, dx: number, dy: number) => Gegner | null,
): void {
  leger = fn
}

function legeGegnerHilfe(s: Spielstand, g: Gegner, dx: number, dy: number): Gegner | null {
  return leger === null ? null : leger(s, g, dx, dy)
}

/**
 * Wie hoch der Anteil gezeichneter Gegner gerade ist.
 *
 * Steigt mit der Etappe, weil die Etappe der Fortschrittsbalken des Laufs ist,
 * und mit der Zerruettung, weil das ihr ganzer Zweck ist. Gedeckelt, damit ein
 * Lauf in der zwoelften Minute nicht in ein Feld aus lauter Sonderfaellen
 * kippt - die Grundmasse muss Grundmasse bleiben, sonst faellt das Besondere
 * nicht mehr auf.
 */
export function zeichenAnteil(s: Spielstand): number {
  const roh = 0.03 + (s.etappe - 1) * 0.022 + s.zerruettung * 0.12
  return Math.min(0.22 + s.zerruettung * 0.12, roh) * s.zeichenMult
}

/**
 * Ein Zeichen ziehen - oder `OHNE_ZEICHEN`.
 *
 * Laeuft ueber `s.rng` und nicht `rngOptik`: Ein Zeichen veraendert den Lauf,
 * und derselbe Saatwert muss dieselben Gegner ergeben.
 */
export function waehleZeichen(s: Spielstand): number {
  if (s.gezeichnet >= MAX_GEZEICHNET) return OHNE_ZEICHEN
  if (s.rng.next() >= zeichenAnteil(s)) return OHNE_ZEICHEN

  let letzter = OHNE_ZEICHEN
  for (let i = 0; i < ZEICHEN.length; i++) {
    if (ZEICHEN[i].abEtappe <= s.etappe || s.zerruettung > 0) letzter = i
  }
  if (letzter === OHNE_ZEICHEN) return OHNE_ZEICHEN
  return Math.floor(s.rng.next() * (letzter + 1))
}

/**
 * Das Zeichen setzen und Buch fuehren.
 *
 * Der Zaehler ist der Grund, warum das eine eigene Funktion ist: Er muss an
 * genau einer Stelle steigen und an genau den Stellen fallen, an denen ein
 * Gegner in den Pool zurueckgeht. Ein Test vergleicht ihn nach simulierten
 * Sekunden mit einem vollen Durchlauf, weil ein auseinandergelaufener Zaehler
 * still den Deckel aushebelt - entweder gibt es dann keine Zeichen mehr oder
 * beliebig viele.
 */
export function setzeZeichen(s: Spielstand, g: Gegner, index: number): void {
  if (index < 0 || index >= ZEICHEN.length) return
  const z = ZEICHEN[index]
  g.zeichen = index
  g.zeichenTakt = 0
  g.maxHp *= z.hpFaktor
  g.hp = g.maxHp
  g.xp = Math.round(g.xp * z.xpFaktor)
  s.gezeichnet++
}

/** Beim Freigeben eines Gegners aufrufen - hier faellt der Zaehler. */
export function loeseZeichen(s: Spielstand, g: Gegner): void {
  if (g.zeichen < 0) return
  g.zeichen = OHNE_ZEICHEN
  s.gezeichnet--
}

/** Die Farbe des Zeichens - fuer Ring und Minikarte. */
export function zeichenFarbe(index: number): string {
  return index >= 0 && index < ZEICHEN.length ? ZEICHEN[index].farbe : FARBEN.text
}
