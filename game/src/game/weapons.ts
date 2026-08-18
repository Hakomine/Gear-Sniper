/**
 * Waffen als Daten.
 *
 * Der Spieler zielt nie selbst - das ist die Gattungsregel. Die Waffe sucht
 * sich das naechste Ziel, der Spieler entscheidet nur, wo er steht. Alles,
 * was ein Spieler an einer Waffe spuert, sind die Zahlen hier.
 */
export type WaffenDef = {
  readonly id: string
  readonly name: string
  readonly schaden: number
  /** Sekunden zwischen zwei Schuessen. */
  readonly abklingzeit: number
  readonly geschossTempo: number
  readonly geschossRadius: number
  /** Wie viele Gegner ein Geschoss durchschlaegt, bevor es vergeht. */
  readonly durchschlag: number
  /** Geschosse pro Schuss. */
  readonly anzahl: number
  /** Faecherbreite im Bogenmass, wenn mehr als ein Geschoss fliegt. */
  readonly streuung: number
  /** Sekunden bis zum Verschwinden - begrenzt die Reichweite. */
  readonly lebensdauer: number
  /** Wie weit ein Treffer den Gegner zurueckschiebt. */
  readonly rueckstoss: number
  /** Ueber diese Entfernung hinaus sucht die Waffe kein Ziel. */
  readonly reichweite: number
}

export const WAFFEN = {
  splitter: {
    id: 'splitter',
    name: 'Splitterwerfer',
    schaden: 11,
    abklingzeit: 0.36,
    geschossTempo: 430,
    geschossRadius: 4,
    durchschlag: 0,
    anzahl: 1,
    streuung: 0.16,
    lebensdauer: 1.1,
    rueckstoss: 120,
    reichweite: 520,
  },
} as const satisfies Record<string, WaffenDef>

/** Laufzeitzustand einer ausgeruesteten Waffe. */
export type WaffenInstanz = {
  def: WaffenDef
  /** Restzeit bis zum naechsten Schuss. */
  abkling: number
}

export function ruesteAus(def: WaffenDef): WaffenInstanz {
  // Sofort feuerbereit: Eine Wartezeit direkt nach dem Start faehlt sich
  // an, als haenge das Spiel.
  return { def, abkling: 0 }
}
