import { FARBEN } from '../render/palette'

/**
 * Waffen als Daten - Verhalten als Code.
 *
 * Das bisherige Prinzip "Inhalte sind Daten" stoesst hier an eine echte
 * Grenze: Ein Bogenhieb *ist* anderer Code als eine Kugel. Die ehrliche
 * Aufloesung ist eine Registratur (siehe `verhalten.ts`): Jede Waffe nennt ihr
 * Verhalten, und eine Waffe, die ein vorhandenes wiederverwendet, bleibt ein
 * reiner Tabelleneintrag. Nur ein wirklich neues Verhalten kostet Code.
 */

export type Seltenheit = 'gewoehnlich' | 'selten' | 'episch' | 'legendaer'

/**
 * Wie oft eine Seltenheit ueberhaupt angeboten wird.
 *
 * Die Spanne ist Absicht. Ein Sternenschlucker soll ein Ereignis sein, ueber
 * das man redet - nicht die vierte Karte in jedem Lauf. Waeren legendaere
 * Waffen haeufig, waeren sie nur noch die besseren gewoehnlichen.
 */
export const SELTENHEIT_GEWICHT: Record<Seltenheit, number> = {
  gewoehnlich: 100,
  selten: 42,
  episch: 15,
  legendaer: 4,
}

export const SELTENHEIT_NAME: Record<Seltenheit, string> = {
  gewoehnlich: 'Gewöhnlich',
  selten: 'Selten',
  episch: 'Episch',
  legendaer: 'Legendär',
}

export type VerhaltenId =
  | 'gerade'
  | 'schwung'
  | 'suchend'
  | 'kette'
  | 'sprengsatz'
  | 'trabant'
  | 'strahl'
  | 'singularitaet'

/**
 * Alle Zahlen, die eine Waffe ausmachen.
 *
 * `extra` ist bewusst namenlos: Jedes Verhalten legt selbst fest, was es
 * bedeutet - Hiebwinkel, Sprungzahl, Explosionsradius, Sogweite. Ein eigenes
 * Feld je Verhalten waere eine Tabelle voller Nullen.
 */
export type WaffenWerte = {
  schaden: number
  /** Sekunden zwischen zwei Ausloesungen. */
  abklingzeit: number
  /** Geschosse, Hiebe oder Trabanten - je nach Verhalten. Wird abgerundet. */
  anzahl: number
  reichweite: number
  radius: number
  tempo: number
  /** Wird abgerundet. */
  durchschlag: number
  lebensdauer: number
  rueckstoss: number
  streuung: number
  /** Bedeutung siehe `extraName` der jeweiligen Waffe. */
  extra: number
}

export type WaffenDef = {
  readonly id: string
  readonly name: string
  readonly beschreibung: string
  readonly seltenheit: Seltenheit
  readonly verhalten: VerhaltenId
  /** Geschosse und Effekte dieser Waffe tragen diese Farbe. */
  readonly farbe: string
  readonly maxStufe: number
  readonly basis: WaffenWerte
  /** Wird je Stufe aufaddiert. */
  readonly proStufe: Partial<WaffenWerte>
  /** Klartext fuer `extra` auf der Karte. */
  readonly extraName: string
  /**
   * Die letzte Stufe macht die Waffe nicht staerker, sondern zu etwas
   * anderem. Das ist der Moment, der haengenbleibt - und der Unterschied
   * zwischen "Zahl steigt" und "meine Waffe ist jetzt was Neues".
   *
   * Umgesetzt als Datensatz plus eine Abfrage im jeweiligen Verhalten, nicht
   * als acht neue Funktionen.
   */
  readonly vollendung: {
    readonly text: string
    readonly werte?: Partial<WaffenWerte>
  }
}

// Diese Felder sind Stueckzahlen - Zwischenwerte ergeben keinen Sinn.
const GANZE_FELDER: readonly (keyof WaffenWerte)[] = ['anzahl', 'durchschlag']

/**
 * Werte einer Waffe auf einer bestimmten Stufe.
 *
 * Bruchteile in `proStufe` sind erlaubt und der Trick, mit dem eine
 * gleichfoermige Tabelle trotzdem "+1 Geschoss auf Stufe 3" ausdruecken kann:
 * 0,34 pro Stufe ergibt abgerundet 1, 1, 2, 2, 3.
 */
export function werteFuer(def: WaffenDef, stufe: number): WaffenWerte {
  const w = { ...def.basis }
  const stufen = Math.max(0, stufe - 1)

  for (const schluessel of Object.keys(def.proStufe) as (keyof WaffenWerte)[]) {
    w[schluessel] += (def.proStufe[schluessel] ?? 0) * stufen
  }

  if (stufe >= def.maxStufe && def.vollendung.werte) {
    for (const schluessel of Object.keys(def.vollendung.werte) as (keyof WaffenWerte)[]) {
      w[schluessel] += def.vollendung.werte[schluessel] ?? 0
    }
  }

  for (const schluessel of GANZE_FELDER) w[schluessel] = Math.floor(w[schluessel])
  // Eine Abklingzeit von null wuerde jeden Tick feuern und die Schleife fluten.
  w.abklingzeit = Math.max(0.05, w.abklingzeit)
  return w
}

export function istVollendet(def: WaffenDef, stufe: number): boolean {
  return stufe >= def.maxStufe
}

/** Deutsche Zahl mit Komma, ohne ueberfluessige Nullen. */
function zahl(wert: number, stellen = 2): string {
  return wert
    .toFixed(stellen)
    .replace(/\.?0+$/, '')
    .replace('.', ',')
}

/**
 * Was der Sprung von `stufe` auf `stufe + 1` bringt - aus den Daten erzeugt.
 *
 * Von Hand geschrieben waeren das acht Waffen mal vier Stufen, also rund
 * vierzig Textzeilen, die beim ersten Balancing veralten und die niemand
 * nachpflegt. So kann der Text gar nicht luegen.
 */
export function stufenText(def: WaffenDef, stufe: number): string {
  if (stufe + 1 >= def.maxStufe) return def.vollendung.text

  const a = werteFuer(def, stufe)
  const b = werteFuer(def, stufe + 1)
  const teile: string[] = []

  if (b.schaden > a.schaden) teile.push(`+${zahl(b.schaden - a.schaden, 0)} Schaden`)
  if (b.abklingzeit < a.abklingzeit) teile.push(`−${zahl(a.abklingzeit - b.abklingzeit)} s`)
  if (b.anzahl > a.anzahl) teile.push(`+${b.anzahl - a.anzahl} ${def.extraName === 'Trabanten' ? 'Trabant' : 'Geschoss'}`)
  if (b.durchschlag > a.durchschlag) teile.push(`+${b.durchschlag - a.durchschlag} Durchschlag`)
  if (b.reichweite > a.reichweite) teile.push(`+${zahl(b.reichweite - a.reichweite, 0)} Reichweite`)
  if (b.extra > a.extra) teile.push(`+${zahl(b.extra - a.extra, 1)} ${def.extraName}`)

  return teile.join(' · ')
}

export const WAFFEN: readonly WaffenDef[] = [
  {
    id: 'splitter',
    name: 'Splitterwerfer',
    beschreibung: 'Schnelle gerade Schüsse auf den nächsten Gegner',
    seltenheit: 'gewoehnlich',
    verhalten: 'gerade',
    farbe: FARBEN.geschoss,
    maxStufe: 5,
    extraName: 'Streuung',
    basis: {
      schaden: 11,
      abklingzeit: 0.36,
      anzahl: 1,
      reichweite: 520,
      radius: 4,
      tempo: 430,
      durchschlag: 0,
      lebensdauer: 1.1,
      rueckstoss: 120,
      streuung: 0.16,
      extra: 0,
    },
    proStufe: { schaden: 4, abklingzeit: -0.022, anzahl: 0.34, tempo: 18 },
    vollendung: { text: 'Schüsse durchschlagen alles', werte: { durchschlag: 99 } },
  },
  {
    id: 'klinge',
    name: 'Klinge',
    beschreibung: 'Bogenhieb in Laufrichtung, trifft alles in der Nähe',
    seltenheit: 'gewoehnlich',
    verhalten: 'schwung',
    farbe: '#9ef7ff',
    maxStufe: 5,
    extraName: 'Hiebweite',
    basis: {
      schaden: 17,
      abklingzeit: 0.62,
      anzahl: 1,
      // Beim Hieb ist `reichweite` der Radius des Bogens.
      reichweite: 98,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0.18,
      rueckstoss: 210,
      streuung: 0,
      // Halber Oeffnungswinkel im Bogenmass.
      extra: 0.9,
    },
    proStufe: { schaden: 7, abklingzeit: -0.035, reichweite: 12, extra: 0.12 },
    vollendung: { text: 'Der Hieb geht rundum', werte: { extra: Math.PI } },
  },
  {
    id: 'bogen',
    name: 'Kurzbogen',
    beschreibung: 'Zielsuchende Pfeile, die durchschlagen',
    seltenheit: 'selten',
    verhalten: 'suchend',
    farbe: '#b6ff7a',
    maxStufe: 5,
    extraName: 'Lenkung',
    basis: {
      schaden: 23,
      abklingzeit: 0.72,
      anzahl: 1,
      reichweite: 620,
      radius: 5,
      tempo: 330,
      durchschlag: 1,
      lebensdauer: 2.2,
      rueckstoss: 90,
      streuung: 0.24,
      // Wendigkeit im Bogenmass pro Sekunde.
      extra: 5.5,
    },
    proStufe: { schaden: 9, abklingzeit: -0.045, anzahl: 0.34, durchschlag: 0.34, extra: 0.7 },
    vollendung: { text: 'Pfeile prallen zum nächsten Gegner weiter' },
  },
  {
    id: 'blitz',
    name: 'Kettenblitz',
    beschreibung: 'Springt vom getroffenen Gegner zum nächsten',
    seltenheit: 'selten',
    verhalten: 'kette',
    farbe: '#7ad4ff',
    maxStufe: 5,
    extraName: 'Sprünge',
    basis: {
      schaden: 20,
      abklingzeit: 0.85,
      anzahl: 1,
      reichweite: 330,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0.16,
      rueckstoss: 40,
      streuung: 0,
      extra: 3,
    },
    proStufe: { schaden: 8, abklingzeit: -0.05, reichweite: 22, extra: 0.7 },
    vollendung: { text: 'Doppelt so viele Sprünge, jeder schlägt eine Fläche' },
  },
  {
    id: 'bazooka',
    name: 'Bazooka',
    beschreibung: 'Träge Granate mit großem Flächenknall',
    seltenheit: 'episch',
    verhalten: 'sprengsatz',
    farbe: FARBEN.elite,
    maxStufe: 5,
    extraName: 'Knallradius',
    basis: {
      schaden: 34,
      abklingzeit: 1.35,
      anzahl: 1,
      reichweite: 560,
      radius: 7,
      tempo: 250,
      durchschlag: 0,
      lebensdauer: 2.4,
      rueckstoss: 260,
      streuung: 0.25,
      extra: 96,
    },
    proStufe: { schaden: 14, abklingzeit: -0.075, extra: 12, tempo: 10 },
    vollendung: { text: 'Der Knall wirft drei Granaten nach' },
  },
  {
    id: 'trabanten',
    name: 'Trabanten',
    beschreibung: 'Scherben kreisen dauerhaft um dich',
    seltenheit: 'episch',
    verhalten: 'trabant',
    farbe: '#c9a3ff',
    maxStufe: 5,
    extraName: 'Bahnweite',
    basis: {
      schaden: 15,
      // Beim Trabanten ist die Abklingzeit die Pause, bis derselbe Gegner
      // erneut getroffen werden kann - sonst schruppt ein Ring einen
      // stehenden Gegner in Sekundenbruchteilen weg.
      abklingzeit: 0.3,
      anzahl: 2,
      reichweite: 0,
      radius: 11,
      // Umlauf im Bogenmass pro Sekunde.
      tempo: 2.4,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 130,
      streuung: 0,
      extra: 80,
    },
    proStufe: { schaden: 6, anzahl: 0.5, extra: 9, tempo: 0.18 },
    vollendung: { text: 'Ein zweiter Ring läuft gegenläufig' },
  },
  {
    id: 'prisma',
    name: 'Prismastrahl',
    beschreibung: 'Sofort-Laser quer durch das Bild',
    seltenheit: 'legendaer',
    verhalten: 'strahl',
    farbe: FARBEN.splitter,
    maxStufe: 5,
    extraName: 'Strahlbreite',
    basis: {
      schaden: 92,
      abklingzeit: 2.2,
      anzahl: 1,
      reichweite: 900,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0.22,
      rueckstoss: 320,
      streuung: 0,
      extra: 16,
    },
    proStufe: { schaden: 38, abklingzeit: -0.14, extra: 2.5 },
    vollendung: { text: 'Feuert als Kreuz in vier Richtungen' },
  },
  {
    id: 'schlucker',
    name: 'Sternenschlucker',
    beschreibung: 'Reißt alles zusammen, hält es fest, detoniert',
    seltenheit: 'legendaer',
    verhalten: 'singularitaet',
    farbe: '#d08cff',
    maxStufe: 5,
    extraName: 'Sogweite',
    basis: {
      // Schaden je Schadenstakt, nicht einmalig.
      schaden: 26,
      abklingzeit: 6.5,
      anzahl: 1,
      reichweite: 400,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      // Wie lange das Loch steht, bevor es platzt.
      lebensdauer: 2.6,
      rueckstoss: 0,
      streuung: 0,
      extra: 190,
    },
    proStufe: { schaden: 11, abklingzeit: -0.35, extra: 18, lebensdauer: 0.2 },
    vollendung: { text: 'Zieht doppelt so weit und lässt ein Trümmerfeld zurück' },
  },
]

export const WAFFE_START = WAFFEN[0]

/** Wie viele Waffen gleichzeitig getragen werden koennen. */
export const MAX_WAFFEN = 5

export function waffeMit(id: string): WaffenDef | undefined {
  return WAFFEN.find((w) => w.id === id)
}

/** Laufzeitzustand einer ausgeruesteten Waffe. */
export type WaffenInstanz = {
  def: WaffenDef
  stufe: number
  /** Restzeit bis zur naechsten Ausloesung. */
  abkling: number
  /** Umlauf der Trabanten, Seitenwechsel des Hiebs. */
  winkel: number
  /**
   * Platz im Guertel. Das ist der Schluessel des Riss-Systems: Ein Riss
   * gehoert zu einem Platz, nicht zu einem Treffer - siehe `risse.ts`.
   */
  platz: number
  /** Beim Aufwerten einmal ausgerechnet, nicht in jedem Tick neu. */
  werte: WaffenWerte
}

export function ruesteAus(def: WaffenDef, platz: number): WaffenInstanz {
  return {
    def,
    stufe: 1,
    // Sofort feuerbereit: Eine Wartezeit direkt nach dem Aufheben fuehlt sich
    // an, als haenge das Spiel.
    abkling: 0,
    winkel: 0,
    platz,
    werte: werteFuer(def, 1),
  }
}

export function werteAuf(w: WaffenInstanz): void {
  if (w.stufe >= w.def.maxStufe) return
  w.stufe++
  w.werte = werteFuer(w.def, w.stufe)
}
