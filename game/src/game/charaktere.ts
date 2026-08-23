import type { Rng } from '../core/rng'
import { FARBEN, SELTENHEIT_FARBE } from '../render/palette'
import type { Spieler, Statistik } from './state'
import { istVollendet, ruesteAus, waffeMit, WAFFEN } from './weapons'

/**
 * Charaktere.
 *
 * **Die wichtigste Regel dieser Datei:** Charaktere sind
 * Seitwaertsbewegungen, keine Stufenleiter. Jeder hat einen echten Vorteil
 * *und* einen echten Nachteil.
 *
 * Der Grund ist die Bestenliste. Jeder Lauf startet bei null - deshalb gibt es
 * keine dauerhaften Aufwertungen, sondern nur Zugang zu anderen Spielstilen.
 * Waere ein Charakter schlicht besser, wuerde die Liste nur noch messen, wer am
 * meisten freigeschaltet hat, und der Vergleich waere wertlos. Ein Test haelt
 * das fest, weil genau diese Regel beim Balancing als Erstes aufweicht.
 *
 * Der `punkteFaktor` ist die Stellschraube dafuer: Wer sich mit 60 Leben ins
 * Getuemmel stellt, soll fuer dieselbe Zeit mehr Punkte bekommen.
 */
export type CharakterId =
  | 'splitter'
  | 'schleiferin'
  | 'sammler'
  | 'riss'
  | 'koloss'
  | 'prismatikerin'
  | 'kernscherbe'

export type Bedingung = {
  readonly text: string
  readonly erfuellt: (st: Statistik, sp: Spieler) => boolean
}

export type Charakter = {
  readonly id: CharakterId
  readonly name: string
  readonly beschreibung: string
  readonly vorteil: string
  readonly nachteil: string
  readonly farbe: string
  readonly punkteFaktor: number
  /** Wird auf den frisch erzeugten Spieler angewendet. */
  readonly anwenden: (sp: Spieler, rng: Rng) => void
  /** `null` heisst: von Anfang an spielbar. */
  readonly bedingung: Bedingung | null
}

/** Wie stark ein Schliff-Stapel wirkt und wie viele es hoechstens werden. */
export const SCHLIFF_MAX = 25
/** Wie schnell der Schliff abfaellt, wenn niemand mehr in der Naehe stirbt. */
export const SCHLIFF_ZERFALL = 3.5
/** Wie nah ein Kill sein muss, um zu zaehlen. */
export const SCHLIFF_NAEHE = 130

export const CHARAKTERE: readonly Charakter[] = [
  {
    id: 'splitter',
    name: 'Splitter',
    beschreibung: 'Der Grundzustand. Nichts geschenkt, nichts genommen.',
    vorteil: '—',
    nachteil: '—',
    farbe: FARBEN.kontur,
    punkteFaktor: 1,
    anwenden: () => {},
    bedingung: null,
  },
  {
    id: 'schleiferin',
    name: 'Schleiferin',
    beschreibung: 'Belohnt, mitten hineinzugehen.',
    vorteil: 'Startet mit der Klinge · Nahe Kills stapeln Schaden',
    nachteil: '−25 Leben',
    farbe: FARBEN.koerperLeicht,
    punkteFaktor: 1.15,
    anwenden: (sp) => {
      sp.maxHp -= 25
      sp.hp = sp.maxHp
      sp.schliffProNah = 1
      const klinge = waffeMit('klinge')
      if (klinge !== undefined) sp.waffen = [ruesteAus(klinge, 0)]
    },
    bedingung: {
      text: '500 Gegner in einem Lauf erledigen',
      erfuellt: (st) => st.kills >= 500,
    },
  },
  {
    id: 'sammler',
    name: 'Sammler',
    beschreibung: 'Viele Karten, schwache Waffen. Ein Bau-Charakter.',
    vorteil: 'Doppelter Einzugsradius · +60 % Erfahrung',
    nachteil: '−30 % Schaden',
    farbe: FARBEN.koerperMittel,
    punkteFaktor: 1.1,
    anwenden: (sp) => {
      sp.magnetRadius *= 2
      sp.xpMult = 1.6
      sp.schadenMult = 0.7
    },
    bedingung: {
      text: 'Stufe 25 in einem Lauf erreichen',
      erfuellt: (st) => st.level >= 25,
    },
  },
  {
    id: 'riss',
    name: 'Riss',
    beschreibung: 'Sauber ausweichen wird belohnt. Ein Fehler kostet fast alles.',
    vorteil: 'Drei Sekunden ohne Treffer: zersplittert mit zwei Waffen statt drei',
    nachteil: 'Nur 60 Leben',
    farbe: FARBEN.gefahr,
    punkteFaktor: 1.4,
    anwenden: (sp) => {
      sp.maxHp = 60
      sp.hp = 60
      sp.stillstandSchwelle = 3
    },
    bedingung: {
      text: '250 Gegner in einem Lauf zersplittern',
      erfuellt: (st) => st.zersplittert >= 250,
    },
  },
  {
    id: 'koloss',
    name: 'Koloss',
    beschreibung: 'Wird nicht totgeklopft, kommt aber schwer aus dem Gedränge.',
    vorteil: '220 Leben · verletzt alles, was ihn berührt',
    nachteil: '−25 % Tempo · nur 4 Waffenplätze',
    farbe: FARBEN.krit,
    punkteFaktor: 1.05,
    anwenden: (sp) => {
      sp.maxHp = 220
      sp.hp = 220
      sp.tempoMult = 0.75
      sp.dornen = 34
      sp.maxWaffen = 4
    },
    bedingung: {
      text: '5 Minuten überleben',
      erfuellt: (st) => st.zeit >= 300,
    },
  },
  {
    id: 'prismatikerin',
    name: 'Prismatikerin',
    beschreibung: 'Drei Plätze sind genau die Zersplitterungs-Schwelle. Jeder ist heilig.',
    vorteil: 'Startet mit einer zufälligen legendären Waffe auf Stufe 3',
    nachteil: 'Nur 3 Waffenplätze',
    farbe: SELTENHEIT_FARBE.legendaer,
    punkteFaktor: 1.25,
    anwenden: (sp, rng) => {
      sp.maxWaffen = 3
      const legendaer = WAFFEN.filter((w) => w.seltenheit === 'legendaer')
      const def = rng.pick(legendaer)
      const w = ruesteAus(def, 0)
      w.stufe = 3
      sp.waffen = [w]
    },
    bedingung: {
      text: 'Eine Waffe bis zur Vollendung bringen',
      erfuellt: (_st, sp) => sp.waffen.some((w) => istVollendet(w.def, w.stufe)),
    },
  },
  {
    /*
     * Die Kernscherbe - die Kernregel zeigt zum ersten Mal auf den Spieler.
     *
     * Sie ist selbst aus Glas: Drei Treffer von drei *verschiedenen*
     * Gegnerarten innerhalb von vier Sekunden lassen sie zerspringen. Das
     * kostet ein knappes Fuenftel ihrer vollen Leben - reisst dafuer aber
     * alles im Umkreis auf und schleudert es weg. Ihre Schwaeche ist damit
     * zugleich ihre staerkste Waffe, und die Frage "welche Art trifft mich
     * gerade" wird zum ersten Mal eine, die man beim Ausweichen mitdenkt.
     *
     * Der Preis steht auch in den *Zahlen* und nicht nur im Mechaniktext: 30
     * Leben weniger. Ein Charakter, dessen ganzer Nachteil in einer
     * Sondermechanik steckt, waere genau die Aufweichung, die diese Datei
     * verhindern soll.
     *
     * Freigeschaltet wird sie durch den Sieg ueber den Kern - die schwerste
     * Leistung des Spiels ist die einzige, die sie oeffnet. Bis dahin war der
     * Kern ein Ende ohne Folge.
     */
    id: 'kernscherbe',
    name: 'Kernscherbe',
    beschreibung: 'Sie ist selbst aus Glas. Was sie umbringt, räumt für sie auf.',
    vorteil: '+45 % Schaden · Risse halten eine Sekunde länger',
    nachteil: '−30 Leben · drei verschiedene Gegnerarten lassen sie zersplittern',
    farbe: FARBEN.koerperLeicht,
    punkteFaktor: 1.45,
    anwenden: (sp) => {
      sp.maxHp -= 30
      sp.hp = sp.maxHp
      sp.schadenMult *= 1.45
      sp.rissDauer += 1
      sp.istGlas = true
    },
    bedingung: {
      text: 'Den Kern legen',
      erfuellt: (st) => st.kernGelegt,
    },
  },
]

export function charakterMit(id: string): Charakter {
  return CHARAKTERE.find((c) => c.id === id) ?? CHARAKTERE[0]
}

/**
 * Punkte fuer einen Lauf.
 *
 * Zeit wiegt am schwersten, weil "wie weit bin ich gekommen" die Frage ist,
 * die eine Bestenliste beantworten soll. Kills und Stufe stuetzen sie nur ab,
 * damit reines Weglaufen nicht die beste Strategie wird. Bosse zaehlen
 * deutlich - sie sind die einzige Huerde, die man nicht umlaufen kann.
 */
export function punkteFuer(st: Statistik, faktor: number): number {
  const roh =
    st.zeit * 10 + st.kills + st.level * 50 + st.zersplittert * 2 + st.bosse * 500
  return Math.round(roh * faktor)
}

/** Welche Charaktere dieser Lauf freigeschaltet hat. */
export function freigeschaltetDurch(st: Statistik, sp: Spieler): CharakterId[] {
  return CHARAKTERE.filter((c) => c.bedingung !== null && c.bedingung.erfuellt(st, sp)).map(
    (c) => c.id,
  )
}
