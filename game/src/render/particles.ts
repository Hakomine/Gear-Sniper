import type { Spielstand } from '../game/state'
import { mitAlpha } from './palette'

/**
 * Partikel zeichnen - gebuendelt nach Farbe und Verblassungsstufe.
 *
 * Der teure Teil beim Canvas ist nicht das Fuellen, sondern der Wechsel von
 * `fillStyle`: Jede Zuweisung laesst den Browser einen Farbstring neu
 * auswerten. Bei 900 Partikeln waeren das 900 Wechsel pro Bild.
 *
 * Deshalb wandern alle Partikel zuerst in Eimer (Farbe + eine von vier
 * Verblassungsstufen) und werden dann pro Eimer mit *einem* Pfad und *einem*
 * `fill()` gezeichnet - rund zwei Dutzend Wechsel statt 900. Vier Stufen sind
 * fein genug, dass niemand die Abstufung sieht.
 */

/** Wiederverwendete Eimer - werden geleert, nicht neu angelegt. */
const eimer = new Map<string, number[]>()

/** Verblassungsstufen. Mehr sieht man nicht, weniger flackert. */
const STUFEN = 4

export function zeichnePartikel(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  for (const liste of eimer.values()) liste.length = 0

  const partikel = s.partikel.aktiv
  for (let i = 0; i < partikel.length; i++) {
    const p = partikel[i]
    const anteil = p.leben / p.maxLeben
    const stufe = Math.max(1, Math.ceil(anteil * STUFEN))
    // Alle Palettenfarben sind 7 Zeichen lang (#rrggbb) - der Schluessel
    // laesst sich deshalb hinterher wieder zerlegen.
    const schluessel = p.farbe + stufe
    let liste = eimer.get(schluessel)
    if (liste === undefined) {
      liste = []
      eimer.set(schluessel, liste)
    }
    liste.push(i)
  }

  for (const [schluessel, liste] of eimer) {
    if (liste.length === 0) continue
    const farbe = schluessel.slice(0, 7)
    const stufe = Number(schluessel.slice(7))
    ctx.fillStyle = mitAlpha(farbe, stufe / STUFEN)
    ctx.beginPath()

    for (let k = 0; k < liste.length; k++) {
      const p = partikel[liste[k]]
      // Gedrehtes Quadrat = Scherbe. Die Drehung von Hand ausrechnen statt
      // ueber ctx.rotate(): Ein save/rotate/restore pro Partikel wuerde die
      // Buendelung wieder zunichtemachen.
      const c = Math.cos(p.drehung) * p.groesse
      const sn = Math.sin(p.drehung) * p.groesse
      ctx.moveTo(p.x + c, p.y + sn)
      ctx.lineTo(p.x - sn, p.y + c)
      ctx.lineTo(p.x - c, p.y - sn)
      ctx.lineTo(p.x + sn, p.y - c)
      ctx.closePath()
    }
    ctx.fill()
  }
}
