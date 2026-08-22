/**
 * Gesetzter Zufall (mulberry32).
 *
 * `Math.random()` waere einfacher, kostet aber drei Dinge, die hier zaehlen:
 * Tests koennen nicht pruefen, ob zwei Laeufe gleich verlaufen; ein Fehler,
 * der nur alle 200 Laeufe auftritt, ist nicht reproduzierbar; und ein
 * "Taeglicher Lauf" - in diesem Genre das wichtigste Wiederkehr-Feature -
 * waere nachtraeglich nicht mehr einzubauen.
 *
 * Deshalb laeuft *jeder* Zufall im Spiel ueber diese Klasse. Sobald irgendwo
 * ein `Math.random()` steht, ist der Determinismus futsch.
 */
export class Rng {
  private zustand: number

  constructor(saat: number) {
    // >>> 0 erzwingt eine vorzeichenlose 32-Bit-Zahl. Ohne das liefert ein
    // negativer Saatwert eine andere Folge als derselbe Wert positiv.
    this.zustand = saat >>> 0
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    this.zustand = (this.zustand + 0x6d2b79f5) >>> 0
    let t = this.zustand
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Ganzzahl in [0, grenze). */
  int(grenze: number): number {
    return Math.floor(this.next() * grenze)
  }

  /** Gleitkomma in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Ein zufaelliges Element. Leere Liste ist ein Programmierfehler, kein Sonderfall. */
  pick<T>(liste: readonly T[]): T {
    return liste[this.int(liste.length)]
  }

  /** Trifft mit Wahrscheinlichkeit p (0..1) zu. */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** Ein Einheitsvektor in zufaelliger Richtung - fuer Partikel und Spawnpunkte. */
  richtung(): { x: number; y: number } {
    const w = this.next() * Math.PI * 2
    return { x: Math.cos(w), y: Math.sin(w) }
  }

  /**
   * Eigener Strom mit abgeleitetem Saatwert.
   *
   * Wichtig fuer die Trennung der Systeme: Wenn Partikel und Spawner sich
   * denselben Strom teilen, aendert eine neue Partikelwolke die gesamte
   * Gegnerabfolge. Dann ist "gleicher Saatwert = gleicher Lauf" nur noch
   * so lange wahr, wie niemand an der Optik schraubt.
   */
  fork(): Rng {
    return new Rng(Math.imul(this.zustand ^ 0x9e3779b9, 0x85ebca6b) >>> 0)
  }

  /** Fuer Tests und Speicherstaende: der rohe Zustand. */
  snapshot(): number {
    return this.zustand
  }
}

/** Saatwert aus einem Datum - Grundlage fuer den "Taeglichen Lauf". */
export function tagesSaat(datum = new Date()): number {
  const j = datum.getUTCFullYear()
  const m = datum.getUTCMonth() + 1
  const t = datum.getUTCDate()
  return (j * 10000 + m * 100 + t) >>> 0
}
