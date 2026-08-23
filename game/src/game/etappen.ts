import { FARBEN } from '../render/palette'
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
  | 'kern'
  | 'tiefer'

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
    farbe: FARBEN.koerperLeicht,
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
    farbe: FARBEN.gefahr,
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
    farbe: FARBEN.koerperMittel,
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
    farbe: FARBEN.gefahr,
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
    farbe: FARBEN.koerperMittel,
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
    farbe: FARBEN.krit,
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
  {
    id: 'kern',
    name: 'Zum Kern',
    preis: 'Hier endet der Lauf — so oder so',
    lohn: 'Der letzte Gegner. Sieg zählt 4000 Punkte',
    farbe: FARBEN.krit,
    karten: 0,
    gute: false,
    anwenden: () => {
      // Der Kern selbst wird in `state.ts` gerufen. Hier steht nichts, weil an
      // der Etappe nichts mehr zu drehen ist - sie ist die letzte.
    },
  },
  {
    id: 'tiefer',
    name: 'Tiefer ins Feld',
    preis: 'Eine Stufe Zerrüttung: zäher, mehr Zeichen, mehr Bosse',
    lohn: 'Zwei bessere Karten und die Hälfte mehr auf alle Punkte',
    farbe: FARBEN.koerperMittel,
    karten: 2,
    gute: true,
    anwenden: () => {
      // Die Zerruettung selbst zaehlt `state.ts` hoch: Sie gilt fuer den
      // ganzen Rest des Laufs, nicht fuer eine Etappe, und gehoert damit nicht
      // in die Etappenwerte.
    },
  },
]

/**
 * Das Kern-Tor - es ersetzt nach der sechsten Etappe die drei gewoehnlichen.
 *
 * Zwei Seiten, kein Zwang: Wer aufhoeren will, geht zum Kern und beendet den
 * Lauf so oder so. Wer weiter will, nimmt eine Stufe Zerruettung und laeuft
 * dieselben sechs Etappen noch einmal, nur haerter.
 *
 * Der Unterschied zu einem festen Zeitlimit ist der ganze Punkt: Ein Lauf,
 * der nach dreissig Minuten von selbst endet, nimmt dem Spieler die
 * Entscheidung ab. Hier ist der Ausstieg die Entscheidung - und weil beide
 * Seiten Punkte bringen, ist keine davon die feige.
 */
export const KERN_TUEREN: readonly TuerId[] = ['kern', 'tiefer']

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

/**
 * Was eine Stufe Zerruettung an den Trefferpunkten aendert.
 *
 * Multiplikativ und kumulativ: Die zweite Runde ist eineinhalbmal so zaeh wie
 * die erste, die dritte gut doppelt so zaeh. Steil genug, dass eine Schleife
 * kein Leerlauf wird, flach genug, dass die vierte Runde nicht in derselben
 * Sekunde endet, in der sie anfaengt.
 *
 * Bewusst *nur* die Zaehigkeit und nicht die Menge: Die Menge steht ohnehin am
 * Deckel, mehr davon gaebe es gar nicht.
 */
export function zerruettungsFaktor(stufe: number): number {
  return Math.pow(1.45, stufe)
}
