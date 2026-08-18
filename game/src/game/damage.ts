import type { Rng } from '../core/rng'

/**
 * Reine Schadensrechnung - keine Seiteneffekte, kein Zustand.
 *
 * Absichtlich als eigene Datei: Das ist die Formel, an der beim Balancing am
 * haeufigsten gedreht wird, und die einzige Stelle, an der ein Rechenfehler
 * das ganze Spiel unspielbar macht, ohne dass es abstuerzt. Was hier steht,
 * laesst sich ohne Browser und ohne Spielschleife testen.
 */
export type SchadensErgebnis = {
  wert: number
  krit: boolean
}

export function berechneSchaden(
  basis: number,
  multiplikator: number,
  kritChance: number,
  kritFaktor: number,
  rng: Rng,
): SchadensErgebnis {
  const krit = kritChance > 0 && rng.chance(kritChance)
  const roh = basis * multiplikator * (krit ? kritFaktor : 1)
  // Abrunden, aber nie auf 0: Ein Treffer, der nichts tut, liest sich als
  // Fehler im Spiel - selbst wenn die Rechnung stimmt.
  return { wert: Math.max(1, Math.floor(roh)), krit }
}

/**
 * XP-Schwelle fuer den Sprung von `level` auf `level + 1`.
 *
 * Leicht ueberlinear: Die ersten Aufwertungen sollen schnell kommen, spaeter
 * soll jede Stufe spuerbar erarbeitet sein.
 *
 * Die Kurve war zuerst deutlich steiler und lieferte in der ersten Minute nur
 * drei Stufen - der Test `haelt die Aufstiegskurve in einem brauchbaren
 * Bereich` hat das aufgedeckt. In diesem Genre ist die erste Minute damit
 * tot: Wer in 60 Sekunden kaum eine Entscheidung trifft, hoert auf, bevor das
 * Spiel angefangen hat.
 */
export function xpFuerLevel(level: number): number {
  return Math.floor(4 + level * 2.4 + level * level * 0.5)
}
