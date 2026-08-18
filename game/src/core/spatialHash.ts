/**
 * Gitter-Hash als Kollisions-Vorfilter.
 *
 * Ohne ihn muesste jedes Geschoss gegen jeden Gegner geprueft werden:
 * 200 Geschosse x 2000 Gegner = 400.000 Abstandsrechnungen pro Tick, 60 mal
 * pro Sekunde. Das ist der Punkt, an dem ein Survivor-like einbricht.
 *
 * Mit Gitter fragt ein Geschoss nur die zwei bis vier Zellen ab, die es
 * beruehrt - typisch ein Dutzend Kandidaten statt 2000.
 *
 * Die Welt ist unbegrenzt (die Kamera folgt dem Spieler ins Nichts), deshalb
 * ein Hash und kein festes Feld: negative Koordinaten funktionieren, und es
 * gibt keine Weltgrenze, die irgendwann willkuerlich gesetzt werden muesste.
 */
export class RaumGitter {
  private zellen = new Map<number, number[]>()
  private invGroesse: number

  constructor(zellGroesse = 72) {
    this.invGroesse = 1 / zellGroesse
  }

  /**
   * Zwei Primzahlen mischen die Koordinaten zu einem Schluessel. Zwei
   * verschiedene Zellen koennen denselben Schluessel treffen - das ist
   * unschaedlich, weil danach ohnehin exakt nachgerechnet wird. Es kostet
   * dann nur ein paar Kandidaten mehr.
   */
  private schluessel(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) | 0
  }

  /**
   * Leeren, ohne die Arrays wegzuwerfen. `Map.clear()` waere kuerzer, wuerde
   * aber jeden Tick hunderte Arrays zu Muell machen - genau das, was der Pool
   * an anderer Stelle vermeidet.
   */
  leeren(): void {
    for (const liste of this.zellen.values()) liste.length = 0
  }

  einfuegen(x: number, y: number, id: number): void {
    const cx = Math.floor(x * this.invGroesse)
    const cy = Math.floor(y * this.invGroesse)
    const k = this.schluessel(cx, cy)
    let liste = this.zellen.get(k)
    if (liste === undefined) {
      liste = []
      this.zellen.set(k, liste)
    }
    liste.push(id)
  }

  /**
   * Alle IDs im Umkreis sammeln. `aus` wird geleert und wiederverwendet -
   * der Aufrufer haelt ein einziges Array fuer alle Abfragen.
   *
   * Die Treffer sind Kandidaten, keine Treffer: Der genaue Abstand muss
   * danach noch geprueft werden.
   */
  abfragen(x: number, y: number, radius: number, aus: number[]): number[] {
    aus.length = 0
    const minX = Math.floor((x - radius) * this.invGroesse)
    const maxX = Math.floor((x + radius) * this.invGroesse)
    const minY = Math.floor((y - radius) * this.invGroesse)
    const maxY = Math.floor((y + radius) * this.invGroesse)

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const liste = this.zellen.get(this.schluessel(cx, cy))
        if (liste === undefined) continue
        for (let i = 0; i < liste.length; i++) aus.push(liste[i])
      }
    }
    return aus
  }

  /**
   * Zellgroesse anpassen. Faustregel: etwa der doppelte Durchmesser des
   * groessten Objekts. Zu klein heisst viele Zellen pro Abfrage, zu gross
   * heisst viele Kandidaten pro Zelle.
   */
  setzeZellGroesse(groesse: number): void {
    this.invGroesse = 1 / groesse
    this.zellen.clear()
  }
}
