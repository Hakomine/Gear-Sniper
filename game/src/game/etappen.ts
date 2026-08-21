import type { Spieler } from './state'
import { MAX_WAFFEN } from './weapons'

/**
 * Etappen und die Türen dazwischen.
 *
 * Der Lauf war ein durchgehender Strom: Man lief, bis man starb, ohne eine
 * einzige Atempause und ohne eine Entscheidung, die man in Ruhe treffen
 * konnte. Jetzt endet jede Etappe mit ihrem Boss, das Spiel haelt an, und man
 * waehlt, *wie* die naechste aussehen soll.
 *
 * Der Griff dahinter: Man sieht die Belohnung, bevor man den Preis bezahlt.
 * Auf jeder Tuer steht beides. Damit ist die Pause keine Verschnaufpause,
 * sondern die interessanteste Entscheidung des Laufs - und sie kostet nichts
 * an Rechenzeit, weil die ganze Wirkung in fuenf Zahlen steckt, die der
 * Spawner und die Kernregel ohnehin lesen.
 *
 * **Keine Tuer ist reiner Gewinn.** Jede hat einen Preis *und* einen Lohn -
 * ausser "Ruhe", die beides klein haelt. Ein Test haelt das fest, weil genau
 * diese Regel beim Balancing als Erstes aufweicht.
 */
export type TuerId =
  | 'ruhe'
  | 'gedraenge'
  | 'panzerglas'
  | 'zwillinge'
  | 'duennhaeutig'
  | 'sproedigkeit'

/**
 * Die Stellschrauben einer Etappe.
 *
 * Alle stehen auf 1 und werden zu Beginn jeder Etappe zurueckgesetzt - eine
 * Tuer wirkt genau eine Etappe lang. Was daueehaft bleibt, steht am Spieler
 * und nicht hier.
 */
export type EtappenWerte = {
  /** Faktor auf die Nachschubrate. */
  nachschub: number
  /** Faktor auf die Trefferpunkte neuer Gegner. */
  zaehigkeit: number
  /** Wie viele Bosse die Welle setzt. */
  bosse: number
  /** Faktor darauf, wie schnell Risse verfallen. */
  rissZerfall: number
  /** Faktor auf die Reichweite der Zersplitterung. */
  splitterWeite: number
}

export function leereEtappenWerte(): EtappenWerte {
  return { nachschub: 1, zaehigkeit: 1, bosse: 1, rissZerfall: 1, splitterWeite: 1 }
}

export type Tuer = {
  readonly id: TuerId
  readonly name: string
  /** Was die naechste Etappe kostet. Leer nur bei "Ruhe". */
  readonly preis: string
  readonly lohn: string
  readonly farbe: string
  /** Wie viele Karten die Tuer sofort einbringt. */
  readonly karten: number
  /** Zieht mit den besseren Seltenheiten einer Bosskarte. */
  readonly gute: boolean
  readonly anwenden: (w: EtappenWerte, sp: Spieler) => void
}

export const TUEREN: readonly Tuer[] = [
  {
    id: 'ruhe',
    name: 'Ruhe',
    preis: '',
    lohn: 'Eine Karte',
    farbe: '#8fa4c8',
    karten: 1,
    gute: false,
    anwenden: () => {
      // Die sichere Wahl. Sie muss es geben: Ohne eine Tuer ohne Preis waere
      // die Pause keine Entscheidung, sondern eine Zwangsabgabe.
    },
  },
  {
    id: 'gedraenge',
    name: 'Gedränge',
    preis: 'Doppelter Nachschub',
    lohn: 'Zwei Karten',
    farbe: '#ff8a4d',
    karten: 2,
    gute: false,
    anwenden: (w) => {
      w.nachschub = 2
    },
  },
  {
    id: 'panzerglas',
    name: 'Gepanzertes Glas',
    preis: 'Gegner mit 60 % mehr Leben',
    lohn: 'Eine Karte aus den besseren Seltenheiten',
    farbe: '#5ad1c8',
    karten: 1,
    gute: true,
    anwenden: (w) => {
      w.zaehigkeit = 1.6
    },
  },
  {
    id: 'zwillinge',
    name: 'Zwillinge',
    preis: 'Zwei Bosse statt einem',
    lohn: 'Zwei Karten aus den besseren Seltenheiten',
    farbe: '#ff4d5e',
    karten: 2,
    gute: true,
    anwenden: (w) => {
      w.bosse = 2
    },
  },
  {
    id: 'duennhaeutig',
    name: 'Dünnhäutig',
    preis: 'Du nimmst doppelten Schaden — dauerhaft',
    lohn: 'Ein Waffenplatz mehr, dauerhaft',
    farbe: '#c86bff',
    karten: 1,
    gute: false,
    anwenden: (_w, sp) => {
      // Die einzige Tuer, deren beide Seiten bleiben. Deshalb steht sie auch
      // als Einzige am Spieler und nicht in den Etappenwerten.
      sp.schadenNimmt *= 2
      // Niemals ueber die harte Grenze: Dahinter liegen die reservierten
      // Riss-Plaetze, und eine Waffe auf dem Scherbenbit haebelt die Kernregel
      // still aus.
      sp.maxWaffen = Math.min(MAX_WAFFEN, sp.maxWaffen + 1)
    },
  },
  {
    id: 'sproedigkeit',
    name: 'Sprödigkeit',
    preis: 'Risse verfallen doppelt so schnell',
    lohn: 'Zersplitterung trifft doppelt so weit',
    farbe: '#ffd166',
    karten: 1,
    gute: false,
    anwenden: (w) => {
      // Die interessanteste: Sie greift die Kernregel an und belohnt sie
      // zugleich. Wer gemischt gebaut hat, nimmt sie gern - wer auf zwei
      // Waffen sitzt, kann sie nicht bezahlen.
      w.rissZerfall = 2
      w.splitterWeite = 2
    },
  },
]

export function tuerMit(id: TuerId): Tuer {
  return TUEREN.find((t) => t.id === id) ?? TUEREN[0]
}

/**
 * Wie lange eine Etappe hoechstens dauert, bevor ihr Boss kommt.
 *
 * Deckungsgleich mit dem Bosstakt, der vorher schon galt - die Etappe ist
 * nichts anderes als der Abschnitt zwischen zwei Bossen, jetzt nur mit einem
 * sichtbaren Anfang und Ende.
 */
export const ETAPPEN_PUNKTE = 300
