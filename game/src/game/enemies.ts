import { FARBEN } from '../render/palette'

/**
 * Gegner als Daten.
 *
 * Ein neuer Gegnertyp ist ein Eintrag in dieser Tabelle - kein neuer Code.
 * In diesem Genre *ist* die Inhaltsmenge das Produkt: Wer fuer jeden Gegner
 * eine Klasse schreibt, baut nach dem zwanzigsten keine mehr.
 */
export type Form = 'dreieck' | 'quadrat' | 'sechseck'

export type GegnerArt = {
  readonly id: string
  readonly name: string
  /** Die eigentliche Ansage an den Spieler - siehe palette.ts. */
  readonly form: Form
  readonly farbe: string
  readonly radius: number
  readonly hp: number
  readonly tempo: number
  /** Schaden bei Beruehrung. */
  readonly schaden: number
  readonly xp: number
  /** Wie stark Rueckstoss wirkt: hoch = laesst sich kaum wegschubsen. */
  readonly masse: number
  /** Ab welcher Laufzeit (Sekunden) dieser Typ ueberhaupt auftaucht. */
  readonly abSekunde: number
  /** Relative Haeufigkeit zu Beginn. */
  readonly gewicht: number
  /**
   * Relative Haeufigkeit nach zehn Minuten.
   *
   * Dazwischen wird linear ueberblendet. Ohne diese zweite Zahl bleibt die
   * Mischung ueber den ganzen Lauf gleich, und dann besteht auch Minute zehn
   * noch ueberwiegend aus Splittern - viel Menge, keine Bedrohung.
   */
  readonly gewichtSpaet: number
}

export const GEGNER_ARTEN = [
  {
    id: 'splitter',
    name: 'Splitter',
    form: 'dreieck',
    farbe: FARBEN.splitter,
    radius: 9,
    hp: 10,
    tempo: 78,
    schaden: 7,
    xp: 1,
    masse: 1,
    abSekunde: 0,
    gewicht: 100,
    gewichtSpaet: 18,
  },
  {
    id: 'brocken',
    name: 'Brocken',
    form: 'quadrat',
    farbe: FARBEN.brocken,
    radius: 15,
    hp: 58,
    tempo: 42,
    schaden: 14,
    xp: 4,
    masse: 3.2,
    abSekunde: 55,
    gewicht: 34,
    gewichtSpaet: 55,
  },
  {
    id: 'elite',
    name: 'Kantiger',
    form: 'sechseck',
    farbe: FARBEN.elite,
    radius: 20,
    hp: 165,
    tempo: 58,
    schaden: 22,
    xp: 14,
    masse: 5,
    abSekunde: 130,
    gewicht: 9,
    gewichtSpaet: 62,
  },
] as const satisfies readonly GegnerArt[]

/**
 * Wie zaeh, wie schnell und wie gefaehrlich Gegner mit der Laufzeit werden.
 *
 * Das ist die eigentliche Schwierigkeitskurve - nicht die Spawnrate. Wenn nur
 * die Menge steigt, raeumt eine aufgewertete Waffe jeden Teppich muehelos weg.
 *
 * Die Kurve war zuerst linear (1 + zeit/68) und damit weit hinter dem
 * Spieler: Gemessen ueberlebte eine Figur, die sich **gar nicht bewegt**, zehn
 * Minuten mit 16.000 Kills. In einem Spiel, das nur aus Ausweichen besteht,
 * ist das der Totalschaden. Fuenf Waffen mal fuenf Stufen wachsen ueberlinear,
 * also muss die Gegenseite es auch.
 *
 * Der quadratische Anteil ist bewusst der kleinere: Er greift spuerbar erst ab
 * der dritten Minute und laesst die ersten beiden Minuten in Ruhe - dort soll
 * der Spieler seinen Bau finden, nicht sofort sterben.
 */
export function hpFaktor(zeit: number): number {
  const min = zeit / 60
  return 1 + min * 1.5 + min * min * 0.55
}

export function tempoFaktor(zeit: number): number {
  // Deutlich flacher als die Trefferpunkte: Gegner, die schneller laufen als
  // der Spieler, nehmen ihm jede Handlungsmoeglichkeit.
  return Math.min(1.35, 1 + zeit / 420)
}

/**
 * Beruehrungsschaden ueber die Zeit.
 *
 * Ohne ihn wird ein Treffer spaet im Lauf bedeutungslos, sobald der Spieler
 * zwei Panzerplatten getragen hat - und damit auch das Ausweichen.
 */
export function schadenFaktor(zeit: number): number {
  return 1 + zeit / 150
}

/** Wann die Mischung vollstaendig auf die spaeten Gewichte umgestellt ist. */
const MISCHUNG_ENDE = 600

/**
 * Haeufigkeit einer Art zum Zeitpunkt `zeit`.
 *
 * Der Lauf beginnt als Splitterteppich und endet als Elite-Aufmarsch. Das ist
 * die zweite Haelfte der Schwierigkeitskurve: Nur zaehere Gegner zu machen
 * reicht nicht, es muessen auch andere kommen. Nebenbei loest es die
 * Zersplitterung haeufiger aus - Splitter sterben vor dem dritten Riss,
 * Elite-Gegner leben lange genug, um alle drei zu sammeln.
 */
export function gewichtFuer(art: GegnerArt, zeit: number): number {
  const t = Math.min(1, zeit / MISCHUNG_ENDE)
  return art.gewicht + (art.gewichtSpaet - art.gewicht) * t
}

/** Alle Typen, die zu diesem Zeitpunkt vorkommen duerfen. */
export function verfuegbareArten(zeit: number): GegnerArt[] {
  return GEGNER_ARTEN.filter((a) => zeit >= a.abSekunde)
}
