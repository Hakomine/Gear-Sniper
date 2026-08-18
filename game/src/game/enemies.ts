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
  /** Relative Haeufigkeit gegenueber den anderen dann verfuegbaren Typen. */
  readonly gewicht: number
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
  },
] as const satisfies readonly GegnerArt[]

/**
 * Wie zaeh und wie schnell Gegner mit der Laufzeit werden.
 *
 * Das ist die eigentliche Schwierigkeitskurve - nicht die Spawnrate. Wenn nur
 * die Menge steigt, wird das Spiel ab Minute 10 zu einem Teppich, den die
 * aufgewertete Waffe muehelos wegraeumt. Erst mitwachsende Trefferpunkte
 * halten die Spannung, weil die eigene Aufwertung dagegen anrennen muss.
 */
export function hpFaktor(zeit: number): number {
  return 1 + zeit / 68
}

export function tempoFaktor(zeit: number): number {
  // Deutlich flacher als die Trefferpunkte: Gegner, die schneller laufen als
  // der Spieler, nehmen ihm jede Handlungsmoeglichkeit.
  return Math.min(1.35, 1 + zeit / 420)
}

/** Alle Typen, die zu diesem Zeitpunkt vorkommen duerfen. */
export function verfuegbareArten(zeit: number): GegnerArt[] {
  return GEGNER_ARTEN.filter((a) => zeit >= a.abSekunde)
}
