import { FARBEN } from '../render/palette'
import type { Spielstand } from './state'
import { MAX_WAFFEN } from './weapons'

/**
 * Verhexungen - Schwierigkeit als Regler.
 *
 * Der Griff stammt aus dem Pakt der Strafe in *Hades*: Der Spieler stellt
 * sich die Schwierigkeit selbst ein und bekommt dafuer mehr Wertung. Dort ist
 * daraus die ganze Bestenlisten-Kultur des Spiels gewachsen, und hier passt
 * er genau, weil es keine dauerhaften Aufwertungen gibt - die Punktzahl ist
 * also schon ohne ihn ehrlich.
 *
 * Ohne so einen Regler beantwortet eine Bestenliste nur die Frage "wer hat am
 * laengsten durchgehalten". Mit ihm lautet sie "wer hat sich am meisten
 * zugemutet und es trotzdem geschafft" - und das ist die interessantere.
 *
 * **Keine Verhexung darf einen Lauf leichter machen.** Ein Test haelt das
 * fest, weil genau diese Regel beim Balancing als Erstes aufweicht: Sobald
 * eine von ihnen einen versteckten Vorteil hat, ist der Punktefaktor kein
 * Ausgleich mehr, sondern ein Geschenk.
 *
 * Der Faktor ist bewusst **additiv** (`1 + Summe`) und nicht multiplikativ:
 * Man soll ihn im Kopf ausrechnen koennen, waehrend man vor der Auswahl
 * steht. Alle sechs zusammen ergeben ×2,25.
 */
export type VerhexungId =
  | 'hast'
  | 'enge'
  | 'kargheit'
  | 'blindheit'
  | 'zoll'
  | 'gezeichnet'

export type Verhexung = {
  readonly id: VerhexungId
  readonly name: string
  readonly wirkung: string
  /** Was sie auf den Punktefaktor legt. */
  readonly bonus: number
  readonly farbe: string
  /**
   * Wird auf den frisch gestarteten Lauf angewendet - nach dem Charakter.
   *
   * Sie greifen ueber Felder am Spielstand und am Spieler, nicht ueber
   * Sonderfaelle im Code: dasselbe Muster wie die Charaktermechaniken und die
   * regelveraendernden Gegenstaende. Eine Verhexung, die eine neue Verzweigung
   * in die heisse Schleife legt, waere die Punkte nicht wert.
   */
  readonly anwenden: (s: Spielstand) => void
}

/** Um wie viel "Enge" das Rissfenster verkuerzt. */
export const ENGE_ABZUG = 0.7

/** Wie viele maximale Leben "Zoll" je Etappe nimmt. */
export const ZOLL_PRO_ETAPPE = 12

export const VERHEXUNGEN: readonly Verhexung[] = [
  {
    id: 'hast',
    name: 'Hast',
    wirkung: 'Gegner laufen 20 % schneller',
    bonus: 0.15,
    farbe: FARBEN.gefahr,
    anwenden: (s) => {
      s.tempoFeind = 1.2
    },
  },
  {
    id: 'enge',
    name: 'Enge',
    wirkung: 'Das Rissfenster schrumpft von 1,6 s auf 0,9 s',
    bonus: 0.3,
    farbe: FARBEN.krit,
    anwenden: (s) => {
      /*
       * Die interessanteste der sechs - und die billigste im Code.
       *
       * `rissSetzen` addiert ohnehin schon einen Zuschlag vom Spieler (den
       * Gegenstand "Nachhall"). Ein negativer Zuschlag ist derselbe Weg
       * rueckwaerts: kein neuer Parameter, kein globaler Wert, keine zweite
       * Stelle, die man beim naechsten Umbau vergisst.
       *
       * Sie greift dieselbe Regel an wie das Zeichen "Klammer", nur fuer den
       * ganzen Lauf: Wer gemischt baut, merkt kaum etwas; wer zwei ausgereizte
       * Waffen traegt, kommt an keine Zersplitterung mehr heran.
       */
      s.spieler.rissDauer -= ENGE_ABZUG
    },
  },
  {
    id: 'kargheit',
    name: 'Kargheit',
    wirkung: 'Ein Waffenplatz weniger',
    bonus: 0.25,
    farbe: FARBEN.koerperLeicht,
    anwenden: (s) => {
      // Nie unter drei: Drei ist die Zersplitterungs-Schwelle, und ein Lauf,
      // der die Kernregel gar nicht mehr ausloesen kann, ist kein schwerer
      // Lauf, sondern ein kaputter.
      s.spieler.maxWaffen = Math.max(3, Math.min(MAX_WAFFEN, s.spieler.maxWaffen) - 1)
    },
  },
  {
    id: 'blindheit',
    name: 'Blindheit',
    wirkung: 'Keine Minikarte, keine Zeiger auf Schreine',
    bonus: 0.1,
    farbe: FARBEN.koerperLeicht,
    anwenden: (s) => {
      s.blind = true
    },
  },
  {
    id: 'zoll',
    name: 'Zoll',
    wirkung: `Jede Etappe kostet ${ZOLL_PRO_ETAPPE} maximale Leben`,
    bonus: 0.25,
    farbe: FARBEN.gefahr,
    anwenden: (s) => {
      s.zoll = ZOLL_PRO_ETAPPE
    },
  },
  {
    id: 'gezeichnet',
    name: 'Gezeichnet',
    wirkung: 'Doppelt so viele gezeichnete Gegner',
    bonus: 0.2,
    farbe: FARBEN.koerperMittel,
    anwenden: (s) => {
      s.zeichenMult = 2
    },
  },
]

export function verhexungMit(id: VerhexungId): Verhexung | undefined {
  return VERHEXUNGEN.find((v) => v.id === id)
}

/** Der Punktefaktor aus den aktiven Verhexungen. Ohne eine: genau 1. */
export function verhexungsFaktor(aktive: readonly VerhexungId[]): number {
  let summe = 1
  for (const id of aktive) summe += verhexungMit(id)?.bonus ?? 0
  return summe
}

/** Alle aktiven anwenden - genau einmal, beim Start eines Laufs. */
export function wendeVerhexungenAn(s: Spielstand): void {
  for (const id of s.verhexungen) verhexungMit(id)?.anwenden(s)
}
