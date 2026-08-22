import { FARBEN } from '../render/palette'
import type { WaffenDef } from './weapons'

/**
 * Verschmelzungen.
 *
 * Sind **beide** Ausgangswaffen auf Maxstufe, kann eine Fusionskarte
 * erscheinen. Sie nimmt beide weg und setzt eine neue an ihre Stelle - ein
 * Platz wird frei.
 *
 * Das greift direkt in die Kernregel: Zwei Waffen zu einer zu machen heisst
 * kurzfristig **ein Riss weniger**. Der frei gewordene Platz nimmt dafuer eine
 * neue Waffe auf. Eine echte Abwaegung statt eines geschenkten Bonus - und der
 * Grund, warum eine Fusion sich nach einer Entscheidung anfuehlt.
 *
 * Die Werte liegen ungefaehr bei der Summe beider ausgereizter Eltern, aber
 * mit eigener Stufenleiter: Vier Stufen mit kraeftigen Schritten, damit auch
 * bei Spielerstufe 40 noch etwas zu ziehen ist. Genau da hoerte der Lauf
 * vorher auf, interessant zu sein.
 */
export type Fusion = {
  readonly id: string
  /** Die beiden Waffen-Kennungen, beide auf Maxstufe. Reihenfolge egal. */
  readonly aus: readonly [string, string]
  readonly def: WaffenDef
}

export const FUSIONEN: readonly Fusion[] = [
  {
    id: 'gewitterkern',
    aus: ['schlucker', 'blitz'],
    def: {
      id: 'gewitterkern',
      name: 'Gewitterkern',
      beschreibung: 'Ein Loch, das alles Gefangene unter Strom setzt',
      seltenheit: 'fusion',
      verhalten: 'gewitterkern',
      farbe: '#a98cff',
      maxStufe: 4,
      extraName: 'Sogweite',
      basis: {
        schaden: 95,
        abklingzeit: 4.6,
        anzahl: 1,
        reichweite: 460,
        radius: 0,
        tempo: 0,
        durchschlag: 0,
        lebensdauer: 3.2,
        rueckstoss: 0,
        streuung: 0,
        extra: 300,
      },
      proStufe: { schaden: 42, abklingzeit: -0.35, extra: 34, lebensdauer: 0.3 },
      vollendung: { text: 'Zieht weiter und lässt ein Trümmerfeld zurück' },
    },
  },
  {
    id: 'scherbenkranz',
    aus: ['klinge', 'trabanten'],
    def: {
      id: 'scherbenkranz',
      name: 'Scherbenkranz',
      beschreibung: 'Kreisende Klingen, die bei jeder Umdrehung rundum schlagen',
      seltenheit: 'fusion',
      verhalten: 'scherbenkranz',
      farbe: '#9ef7ff',
      maxStufe: 4,
      extraName: 'Bahnweite',
      basis: {
        schaden: 46,
        abklingzeit: 0.26,
        anzahl: 4,
        reichweite: 0,
        radius: 13,
        tempo: 2.9,
        durchschlag: 0,
        lebensdauer: 0,
        rueckstoss: 190,
        streuung: 0,
        extra: 130,
      },
      proStufe: { schaden: 20, anzahl: 0.5, extra: 14, tempo: 0.22 },
      vollendung: { text: 'Ein zweiter Kranz läuft gegenläufig' },
    },
  },
  {
    id: 'zerlegestrahl',
    aus: ['prisma', 'bazooka'],
    def: {
      id: 'zerlegestrahl',
      name: 'Zerlegestrahl',
      beschreibung: 'Ein Strahl, der an jedem Getroffenen detoniert',
      seltenheit: 'fusion',
      verhalten: 'zerlegestrahl',
      farbe: '#ff8a5c',
      maxStufe: 4,
      extraName: 'Strahlbreite',
      basis: {
        schaden: 200,
        abklingzeit: 1.9,
        anzahl: 1,
        reichweite: 900,
        radius: 0,
        tempo: 0,
        durchschlag: 0,
        lebensdauer: 0.24,
        rueckstoss: 260,
        streuung: 0,
        extra: 22,
      },
      proStufe: { schaden: 90, abklingzeit: -0.16, extra: 3 },
      vollendung: { text: 'Feuert als Kreuz in vier Richtungen' },
    },
  },
  {
    id: 'schwarmnadeln',
    aus: ['bogen', 'splitter'],
    def: {
      id: 'schwarmnadeln',
      name: 'Schwarmnadeln',
      beschreibung: 'Zielsuchende Nadeln, die sich bei jedem Kill teilen',
      seltenheit: 'fusion',
      verhalten: 'schwarmnadeln',
      farbe: '#c8ff7a',
      maxStufe: 4,
      extraName: 'Lenkung',
      basis: {
        schaden: 62,
        abklingzeit: 0.5,
        anzahl: 3,
        reichweite: 640,
        radius: 5,
        tempo: 380,
        durchschlag: 1,
        lebensdauer: 2.1,
        rueckstoss: 90,
        streuung: 0.3,
        extra: 8,
      },
      proStufe: { schaden: 26, abklingzeit: -0.04, anzahl: 0.5, extra: 0.9 },
      vollendung: { text: 'Jeder Kill teilt die Nadel dreifach' },
    },
  },
  {
    id: 'kollaps',
    aus: ['bazooka', 'schlucker'],
    def: {
      id: 'kollaps',
      name: 'Kollaps',
      beschreibung: 'Reißt erst alles zusammen, dann detoniert es',
      seltenheit: 'fusion',
      verhalten: 'kollaps',
      farbe: FARBEN.elite,
      maxStufe: 4,
      extraName: 'Sogweite',
      basis: {
        schaden: 150,
        abklingzeit: 2.4,
        anzahl: 1,
        reichweite: 580,
        radius: 8,
        tempo: 260,
        durchschlag: 0,
        lebensdauer: 2.2,
        rueckstoss: 240,
        streuung: 0.2,
        extra: 150,
      },
      proStufe: { schaden: 66, abklingzeit: -0.2, extra: 20 },
      vollendung: { text: 'Der Knall wirft drei Kollapse nach' },
    },
  },
  {
    id: 'bogenlicht',
    aus: ['prisma', 'blitz'],
    def: {
      id: 'bogenlicht',
      name: 'Bogenlicht',
      beschreibung: 'Ein Strahl, der sich an jedem Gegner bricht',
      seltenheit: 'fusion',
      verhalten: 'bogenlicht',
      farbe: '#7ad4ff',
      maxStufe: 4,
      extraName: 'Strahlbreite',
      basis: {
        schaden: 170,
        abklingzeit: 1.5,
        anzahl: 1,
        reichweite: 820,
        radius: 0,
        tempo: 0,
        durchschlag: 0,
        lebensdauer: 0.24,
        rueckstoss: 200,
        streuung: 0,
        extra: 18,
      },
      proStufe: { schaden: 74, abklingzeit: -0.12, extra: 2.5 },
      vollendung: { text: 'Jeder Bruch springt dreimal weiter' },
    },
  },
]

/** Alle Kennungen, die durch Verschmelzen entstehen - die lassen sich nicht weiter fusionieren. */
const FUSIONS_IDS = new Set(FUSIONEN.map((f) => f.def.id))

export function istFusion(waffenId: string): boolean {
  return FUSIONS_IDS.has(waffenId)
}
