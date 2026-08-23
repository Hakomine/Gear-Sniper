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

export type Seltenheit = 'gewoehnlich' | 'selten' | 'episch' | 'legendaer' | 'fusion'

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
  // Fusionen werden nie als Fund gezogen - sie entstehen nur aus zwei
  // ausgereizten Waffen und haben ihre eigene Gewichtung in `upgrades.ts`.
  fusion: 0,
}

export const SELTENHEIT_NAME: Record<Seltenheit, string> = {
  gewoehnlich: 'Gewöhnlich',
  selten: 'Selten',
  episch: 'Episch',
  legendaer: 'Legendär',
  fusion: 'Fusion',
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
  // Verhalten der Fusionen - siehe `fusionen.ts`.
  | 'gewitterkern'
  | 'scherbenkranz'
  | 'zerlegestrahl'
  | 'schwarmnadeln'
  | 'kollaps'
  | 'bogenlicht'
  // Runde fuenf: zwoelf, die jeweils etwas tun, das keine andere tut.
  | 'schleifband'
  | 'stimmgabel'
  | 'fadenkreuz'
  | 'spiegel'
  | 'frost'
  | 'anker'
  | 'bohrkopf'
  | 'glocke'
  | 'saatgut'
  | 'schwarzband'
  | 'kaleidoskop'
  | 'sanduhr'

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
    farbe: '#b46bff',
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
    farbe: '#ff7a45',
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
  // --- Runde fuenf ---------------------------------------------------------
  // Zwoelf, die jeweils etwas tun, das keine andere tut. Die meisten haengen
  // an der Riss-Regel, statt danebenzustehen: Wer eine davon zieht, aendert
  // seinen Bau, nicht seine Zahlen.
  {
    id: 'schleifband',
    name: 'Schleifband',
    beschreibung: 'Zieht eine schneidende Spur hinter dir her',
    seltenheit: 'gewoehnlich',
    verhalten: 'schleifband',
    farbe: '#ffb04d',
    maxStufe: 5,
    extraName: 'Spurbreite',
    basis: {
      schaden: 16,
      abklingzeit: 0.5,
      anzahl: 1,
      reichweite: 0,
      radius: 30,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0.9,
      rueckstoss: 0,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 7, radius: 5, lebensdauer: 0.12 },
    vollendung: { text: 'Die Spur bleibt doppelt so lange liegen', werte: { lebensdauer: 2.6 } },
  },
  {
    id: 'stimmgabel',
    name: 'Stimmgabel',
    beschreibung: 'Schallwelle ringsum — trifft härter, was schneller läuft',
    seltenheit: 'gewoehnlich',
    verhalten: 'stimmgabel',
    farbe: '#7ee8e0',
    maxStufe: 5,
    extraName: 'Nachhall',
    basis: {
      schaden: 13,
      abklingzeit: 1.05,
      anzahl: 1,
      reichweite: 170,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 6, reichweite: 26, abklingzeit: -0.07 },
    vollendung: { text: 'Reicht über den halben Bildschirm', werte: { reichweite: 420 } },
  },
  {
    id: 'fadenkreuz',
    name: 'Fadenkreuz',
    beschreibung: 'Bohrt am zähesten Gegner und lädt sich dabei auf',
    seltenheit: 'selten',
    verhalten: 'fadenkreuz',
    farbe: '#ff5c7a',
    maxStufe: 5,
    extraName: 'Aufladung',
    basis: {
      schaden: 42,
      abklingzeit: 0,
      anzahl: 1,
      reichweite: 520,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 22, reichweite: 40 },
    vollendung: { text: 'Sucht sich sein Ziel über das ganze Feld', werte: { reichweite: 1400 } },
  },
  {
    id: 'spiegel',
    name: 'Spiegelscherbe',
    beschreibung: 'Wirft feindliche Geschosse zurück — schneller und schärfer',
    seltenheit: 'selten',
    verhalten: 'spiegel',
    farbe: '#cfe9f2',
    maxStufe: 4,
    extraName: 'Fangradius',
    basis: {
      schaden: 30,
      abklingzeit: 0,
      anzahl: 1,
      reichweite: 0,
      radius: 96,
      tempo: 0,
      durchschlag: 2,
      lebensdauer: 2.4,
      rueckstoss: 90,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 22, radius: 22, durchschlag: 1 },
    vollendung: { text: 'Zurückgeworfenes durchschlägt alles', werte: { durchschlag: 99 } },
  },
  {
    id: 'frost',
    name: 'Frostkeil',
    beschreibung: 'Vereist — und Vereistes zerspringt mit zwei Waffen statt drei',
    seltenheit: 'selten',
    verhalten: 'frost',
    farbe: '#8fd8ff',
    maxStufe: 5,
    extraName: 'Frostdauer',
    basis: {
      schaden: 18,
      abklingzeit: 1.5,
      anzahl: 1,
      reichweite: 420,
      radius: 90,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 2.2,
    },
    proStufe: { schaden: 8, radius: 14, extra: 0.4, abklingzeit: -0.1 },
    vollendung: { text: 'Vereist das halbe Feld auf einmal', werte: { radius: 320 } },
  },
  {
    id: 'anker',
    name: 'Ankerhaken',
    beschreibung: 'Zieht den entferntesten Gegner mitten in deinen Bau',
    seltenheit: 'selten',
    verhalten: 'anker',
    farbe: '#c9b08a',
    maxStufe: 5,
    extraName: 'Zugkraft',
    basis: {
      schaden: 34,
      abklingzeit: 1.2,
      anzahl: 1,
      reichweite: 620,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 900,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 16, rueckstoss: 160, abklingzeit: -0.09 },
    vollendung: { text: 'Reisst gleich einen ganzen Pulk heran', werte: { rueckstoss: 2200 } },
  },
  {
    id: 'bohrkopf',
    name: 'Bohrkopf',
    beschreibung: 'Bleibt stecken und reisst seinen Riss immer wieder neu auf',
    seltenheit: 'episch',
    verhalten: 'bohrkopf',
    farbe: '#ff9d3d',
    maxStufe: 4,
    extraName: 'Risstakt',
    basis: {
      schaden: 55,
      abklingzeit: 0,
      anzahl: 1,
      reichweite: 400,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 0.8,
    },
    proStufe: { schaden: 28, extra: -0.14, reichweite: 40 },
    vollendung: { text: 'Reisst in jedem Augenblick neu auf', werte: { extra: 0.12 } },
  },
  {
    id: 'glocke',
    name: 'Glockenturm',
    beschreibung: 'Ein Schlag setzt bei allem im Bild einen Riss',
    seltenheit: 'episch',
    verhalten: 'glocke',
    farbe: '#ffd98a',
    maxStufe: 4,
    extraName: 'Wucht',
    basis: {
      schaden: 20,
      abklingzeit: 4,
      anzahl: 1,
      reichweite: 0,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 14, abklingzeit: -0.5 },
    vollendung: { text: 'Schlägt doppelt so oft', werte: { abklingzeit: 1.2 } },
  },
  {
    id: 'saatgut',
    name: 'Saatgut',
    beschreibung: 'Eine träge Knospe, die erst am Ende ihres Wegs aufgeht',
    seltenheit: 'episch',
    verhalten: 'saatgut',
    farbe: '#9be87d',
    maxStufe: 4,
    extraName: 'Blüte',
    basis: {
      schaden: 70,
      abklingzeit: 2.2,
      anzahl: 4,
      reichweite: 500,
      radius: 7,
      tempo: 120,
      durchschlag: 0,
      lebensdauer: 1.8,
      rueckstoss: 200,
      streuung: 0,
      extra: 130,
    },
    proStufe: { schaden: 34, extra: 26, anzahl: 1 },
    vollendung: { text: 'Die Blüte wirft eine zweite Saat aus', werte: { anzahl: 9 } },
  },
  {
    id: 'schwarzband',
    name: 'Schwarzband',
    beschreibung: 'Schneidet alles zwischen dem nächsten und dem fernsten Gegner',
    seltenheit: 'episch',
    verhalten: 'schwarzband',
    farbe: '#b98cff',
    maxStufe: 4,
    extraName: 'Bandbreite',
    basis: {
      schaden: 46,
      abklingzeit: 1.6,
      anzahl: 1,
      reichweite: 560,
      radius: 34,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 24, radius: 8, reichweite: 50 },
    vollendung: { text: 'Spannt sich über das ganze Feld', werte: { reichweite: 1400 } },
  },
  {
    id: 'kaleidoskop',
    name: 'Kaleidoskop',
    beschreibung: 'Löst eine andere deiner Waffen ein zweites Mal aus',
    seltenheit: 'legendaer',
    verhalten: 'kaleidoskop',
    farbe: '#fff2c4',
    maxStufe: 5,
    extraName: 'Spiegelstärke',
    basis: {
      schaden: 0,
      abklingzeit: 1.1,
      anzahl: 1,
      reichweite: 0,
      radius: 0,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 0,
      streuung: 0,
      extra: 0.4,
    },
    proStufe: { extra: 0.1, abklingzeit: -0.12 },
    vollendung: { text: 'Spiegelt in voller Stärke', werte: { extra: 1 } },
  },
  {
    id: 'sanduhr',
    name: 'Sanduhr',
    beschreibung: 'Alles im Umkreis läuft rückwärts — auch feindliche Geschosse',
    seltenheit: 'legendaer',
    verhalten: 'sanduhr',
    farbe: '#e0c9ff',
    maxStufe: 5,
    extraName: 'Umkehr',
    basis: {
      schaden: 14,
      abklingzeit: 2.6,
      anzahl: 1,
      reichweite: 0,
      radius: 200,
      tempo: 0,
      durchschlag: 0,
      lebensdauer: 0,
      rueckstoss: 720,
      streuung: 0,
      extra: 0,
    },
    proStufe: { schaden: 7, radius: 30, rueckstoss: 130, abklingzeit: -0.22 },
    vollendung: { text: 'Dreht die Zeit im ganzen Bild zurück', werte: { radius: 700 } },
  },
]
export const WAFFE_START = WAFFEN[0]

/** Wie viele Waffen gleichzeitig getragen werden koennen. */
/**
 * Die harte Obergrenze des Guertels.
 *
 * Nicht dasselbe wie `spieler.maxWaffen`: Die Charaktere tragen drei bis
 * fuenf, und die Tuer "Duennhaeutig" legt einen drauf. **Diese** Zahl ist die
 * Grenze, hinter der die reservierten Riss-Plaetze beginnen - wer sie
 * ueberschreitet, laesst eine Waffe und die Scherben dasselbe Bit teilen, und
 * die Kernregel waere im Spiel unsichtbar ausgehebelt.
 */
export const MAX_WAFFEN = 6

/**
 * Der kleinste freie Guertelplatz.
 *
 * **Nicht** die Laenge des Arrays. Der Platz ist zugleich das Bit, unter dem
 * eine Waffe ihre Risse setzt - und beim Verschmelzen fallen zwei Eintraege
 * weg, waehrend einer hinzukommt. Mit der Laenge als Index bekaemen danach
 * zwei Waffen denselben Platz, saessen also auf demselben Bit, und die
 * Kernregel waere still ausgehebelt: ein Fehler, den man im Spiel nicht sieht.
 */
export function freierPlatz(belegt: readonly WaffenInstanz[], maxPlaetze: number): number {
  for (let p = 0; p < maxPlaetze; p++) {
    if (!belegt.some((w) => w.platz === p)) return p
  }
  return -1
}

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
  /**
   * Arbeitsspeicher des Verhaltens.
   *
   * Der Bohrkopf merkt sich sein Opfer, das Schleifband seinen Taktzaehler,
   * das Fadenkreuz seine Aufladung. Zwei Zahlen an hoechstens sechs Waffen -
   * ein eigenes Zustandsobjekt je Verhalten waere sauberer zu lesen und hier
   * schlicht ueberdimensioniert.
   */
  merkId: number
  merkZeit: number
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
    merkId: -1,
    merkZeit: 0,
  }
}

export function werteAuf(w: WaffenInstanz): void {
  if (w.stufe >= w.def.maxStufe) return
  w.stufe++
  w.werte = werteFuer(w.def, w.stufe)
}
