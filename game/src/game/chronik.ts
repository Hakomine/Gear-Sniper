import { FARBEN } from '../render/palette'
import type { CharakterId } from './charaktere'
import { CHARAKTERE } from './charaktere'
import type { Spielstand } from './state'
import type { VerhexungId } from './verhexungen'
import { VERHEXUNGEN } from './verhexungen'

/**
 * Die Chronik - was von einem Lauf uebrig bleibt.
 *
 * Bisher ueberdauerte einen Lauf genau eine Zahl: der Bestwert. Sie sagt, wie
 * hoch jemand gekommen ist, aber nicht *wie*, und damit ist sie als
 * Bestenliste nur der halbe Gedanke. Ob 40.000 Punkte mit dem Koloss ohne
 * Verhexungen entstanden sind oder mit der Prismatikerin unter drei
 * Verhexungen in der zweiten Zerruettung, ist der ganze Unterschied - und
 * genau das steht hier.
 *
 * **Sie bleibt reine Aufzeichnung.** Kein Eintrag macht einen spaeteren Lauf
 * leichter, kein Wert wandert zurueck ins Spiel. Das ist dieselbe Regel wie
 * bei den Charakteren, und ein Test haelt sie fest: Was ueber einen Lauf
 * hinaus bleibt, ist Zugang und Erinnerung, nie Rechenkraft.
 *
 * Diese Datei kennt keinen Browser - `main.ts` legt sie in den `localStorage`
 * und liest sie zurueck, genau wie bei den offenen Charakteren.
 */
export type Eintrag = {
  readonly punkte: number
  readonly charakter: string
  readonly etappe: number
  readonly zerruettung: number
  readonly verhexungen: string[]
  readonly zeit: number
  readonly gewonnen: boolean
  readonly saat: number
  /** War es der Lauf der Tagesscherbe? */
  readonly tag: boolean
}

/**
 * Wie viele Eintraege bleiben.
 *
 * Zehn, nicht hundert: Eine Bestenliste, durch die man blaettern muss, liest
 * niemand. Und sie liegt im `localStorage`, wo Platz endlich ist.
 */
export const CHRONIK_MAX = 10

/** Wie viele davon das Titelbild zeigt. */
export const CHRONIK_SICHTBAR = 5

export function eintragAus(s: Spielstand): Eintrag {
  return {
    punkte: s.punkte,
    charakter: s.charakter.id,
    etappe: s.etappe,
    zerruettung: s.zerruettung,
    verhexungen: [...s.verhexungen],
    zeit: Math.round(s.statistik.zeit),
    gewonnen: s.gewonnen,
    saat: s.saat,
    tag: s.tagesLauf,
  }
}

/**
 * Einen Eintrag einsortieren. Gibt eine *neue* Liste zurueck.
 *
 * Absteigend nach Punkten und hart gedeckelt. Ein elfter Eintrag faellt
 * heraus, auch wenn er gerade eben entstanden ist - eine Bestenliste, die den
 * letzten Lauf bevorzugt, ist keine.
 */
export function trageEin(chronik: readonly Eintrag[], neu: Eintrag): Eintrag[] {
  return [...chronik, neu].sort((a, b) => b.punkte - a.punkte).slice(0, CHRONIK_MAX)
}

/**
 * Eine gespeicherte Chronik einlesen, egal wie kaputt sie ist.
 *
 * Ein fremder, halber oder von Hand verbogener Eintrag darf das Spiel nicht am
 * Starten hindern - dieselbe Haltung wie beim Laden des Fortschritts. Jedes
 * Feld wird einzeln geprueft und notfalls ersetzt, statt dem Ganzen zu
 * vertrauen.
 */
export function leseChronik(roh: unknown): Eintrag[] {
  if (!Array.isArray(roh)) return []
  const bekannt = new Set<string>(CHARAKTERE.map((c) => c.id))
  const hexen = new Set<string>(VERHEXUNGEN.map((v) => v.id))
  const raus: Eintrag[] = []

  for (const x of roh) {
    if (typeof x !== 'object' || x === null) continue
    const e = x as Partial<Eintrag>
    if (typeof e.punkte !== 'number' || !Number.isFinite(e.punkte)) continue
    raus.push({
      punkte: Math.max(0, Math.floor(e.punkte)),
      charakter: typeof e.charakter === 'string' && bekannt.has(e.charakter) ? e.charakter : '?',
      etappe: zahl(e.etappe, 1),
      zerruettung: zahl(e.zerruettung, 0),
      verhexungen: Array.isArray(e.verhexungen)
        ? e.verhexungen.filter((v): v is string => typeof v === 'string' && hexen.has(v))
        : [],
      zeit: zahl(e.zeit, 0),
      gewonnen: e.gewonnen === true,
      saat: zahl(e.saat, 0),
      tag: e.tag === true,
    })
  }
  return raus.sort((a, b) => b.punkte - a.punkte).slice(0, CHRONIK_MAX)
}

function zahl(wert: unknown, ersatz: number): number {
  return typeof wert === 'number' && Number.isFinite(wert) ? Math.max(0, Math.floor(wert)) : ersatz
}

/** Name und Farbe eines Eintrags - fuer die Anzeige. */
export function charakterAnzeige(id: string): { name: string; farbe: string } {
  const c = CHARAKTERE.find((x) => x.id === id)
  return c === undefined ? { name: '—', farbe: FARBEN.koerperLeicht } : { name: c.name, farbe: c.farbe }
}

/** Nur zur Typsicherung der Aufrufer - die Chronik speichert rohe Zeichenketten. */
export type ChronikCharakter = CharakterId | '?'
export type ChronikVerhexung = VerhexungId
