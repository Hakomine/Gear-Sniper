import type { Rng } from '../core/rng'
import type { Spielstand } from './state'

/**
 * Schreine — Risiko gegen Lohn, mitten im Feld.
 *
 * Das Spielfeld war eine leere Ebene mit Gegnern darauf. Es gab genau *einen*
 * Grund zu laufen: weg. Ein Schrein gibt einen zweiten - hin. Damit wird aus
 * dem Ausweichen eine Routenwahl, und das ist der Unterschied zwischen
 * "herumlaufen" und "sich entscheiden".
 *
 * Alle drei kosten etwas, das im Getümmel wirklich weh tut, und keiner ist
 * geschenkt.
 */
export type SchreinArt = 'amboss' | 'gierscherbe' | 'bruchmal'

export type Schrein = {
  art: SchreinArt
  x: number
  y: number
  /** Fortschritt von 0 bis 1. Nur der Amboss braucht ihn. */
  ladung: number
  /** Schon ausgeloest - bleibt als Ruine stehen, damit man sie nicht erneut anlaeuft. */
  benutzt: boolean
}

/** Wie nah man sein muss, damit ein Schrein ueberhaupt reagiert. */
export const SCHREIN_RADIUS = 62

/** Wie lange der Amboss Stillstand verlangt. */
export const AMBOSS_DAUER = 3

/**
 * Wie schnell sich der Amboss wieder leert, wenn man weitergeht.
 *
 * Deutlich schneller als er sich fuellt: Sonst koennte man in drei Anlaeufen
 * sammeln, was in einem Stueck gefaehrlich sein soll - und aus der Mutprobe
 * wuerde Buchhaltung.
 */
export const AMBOSS_ZERFALL = 2.5

/** Wie viel schwerer die Gierscherbe die restliche Etappe macht. */
export const GIER_AUFSCHLAG = 0.25

export type SchreinDef = {
  readonly art: SchreinArt
  readonly name: string
  readonly preis: string
  readonly lohn: string
  readonly farbe: string
}

export const SCHREINE: readonly SchreinDef[] = [
  {
    art: 'amboss',
    name: 'Amboss',
    preis: 'Drei Sekunden stillstehen',
    lohn: 'Zwei Karten zur Wahl',
    farbe: '#ffd166',
  },
  {
    art: 'gierscherbe',
    name: 'Gierscherbe',
    preis: 'Die Etappe wird 25 % schwerer',
    lohn: 'Sofort eine Stufe',
    farbe: '#c86bff',
  },
  {
    art: 'bruchmal',
    name: 'Bruchmal',
    preis: 'Ruft sofort einen zweiten Boss',
    lohn: 'Eine Karte aus den besseren Seltenheiten',
    farbe: '#ff4d5e',
  },
]

export function schreinDef(art: SchreinArt): SchreinDef {
  return SCHREINE.find((s) => s.art === art) ?? SCHREINE[0]
}

export function leererSchrein(): Schrein {
  return { art: 'amboss', x: 0, y: 0, ladung: 0, benutzt: false }
}

/**
 * Schreine fuer eine Etappe verteilen.
 *
 * Aus `s.rng` und nicht aus `rngOptik`: Wo ein Schrein steht, veraendert den
 * Lauf. Zwei bis drei Stueck, in einem Ring um den Spieler - nah genug, dass
 * man sie findet, weit genug, dass der Weg dorthin etwas kostet.
 */
export function verteileSchreine(s: Spielstand, rng: Rng): void {
  s.schreine.alleFreigeben()
  const anzahl = 2 + Math.floor(rng.next() * 2)

  for (let i = 0; i < anzahl; i++) {
    const winkel = (i / anzahl) * Math.PI * 2 + rng.next() * 0.9
    const abstand = 420 + rng.next() * 520
    const sch = s.schreine.nimm()
    sch.art = SCHREINE[Math.floor(rng.next() * SCHREINE.length)].art
    sch.x = s.spieler.x + Math.cos(winkel) * abstand
    sch.y = s.spieler.y + Math.sin(winkel) * abstand
    sch.ladung = 0
    sch.benutzt = false
  }
}
