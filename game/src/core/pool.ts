/**
 * Objekt-Pool mit dichter Aktiv-Liste.
 *
 * Der Grund ist der Muell-Sammler: Bei 2000 Gegnern, die staendig sterben und
 * nachruecken, wuerde `new Gegner()` pro Spawn im Sekundentakt Speicher
 * anlegen. Der GC raeumt das irgendwann auf - und genau dann ruckelt das Bild
 * fuer 30 ms. In einem Spiel, in dem Ausweichen auf 100 ms genau zaehlt, ist
 * das der Unterschied zwischen "schwer" und "unfair".
 *
 * Deshalb: einmal anlegen, danach nur noch aus- und einhaengen.
 */
export class Pool<T> {
  /** Alle lebenden Objekte, dicht gepackt. Direkt iterieren - keine Luecken, kein `if aktiv`. */
  readonly aktiv: T[] = []
  private frei: T[] = []

  constructor(
    private fabrik: () => T,
    vorbelegen = 0,
  ) {
    for (let i = 0; i < vorbelegen; i++) this.frei.push(fabrik())
  }

  /**
   * Ein Objekt aus dem Pool holen. Der Aufrufer muss *alle* Felder setzen -
   * die Werte des Vorbesitzers stehen noch drin.
   */
  nimm(): T {
    const objekt = this.frei.pop() ?? this.fabrik()
    this.aktiv.push(objekt)
    return objekt
  }

  /**
   * Objekt an Position `i` freigeben (Tausch mit dem letzten Element).
   *
   * WICHTIG: Beim Iterieren **rueckwaerts** laufen, dann ist das Entfernen
   * waehrend der Schleife sicher:
   *
   *     for (let i = pool.aktiv.length - 1; i >= 0; i--) { ... pool.freigeben(i) }
   *
   * Vorwaerts wuerde das nachgerueckte letzte Element uebersprungen.
   */
  freigeben(i: number): void {
    const letzter = this.aktiv.length - 1
    const objekt = this.aktiv[i]
    this.aktiv[i] = this.aktiv[letzter]
    this.aktiv.pop()
    this.frei.push(objekt)
  }

  /** Alles zurueck in den Pool - fuer den Neustart eines Laufs. */
  alleFreigeben(): void {
    for (let i = 0; i < this.aktiv.length; i++) this.frei.push(this.aktiv[i])
    this.aktiv.length = 0
  }

  get anzahl(): number {
    return this.aktiv.length
  }
}
