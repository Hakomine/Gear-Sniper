import { FARBEN } from '../render/palette'
import { aufsammelnBlitz } from './effects'
import type { Spielstand } from './state'

/**
 * XP-Kristalle - die Belohnungsschleife des Genres.
 *
 * Der Magnet ist wichtiger, als er aussieht: Er verwandelt "Gegner toeten" in
 * "durch das Feld fahren und einsammeln". Genau daraus entsteht der Sog, der
 * einen Lauf traegt. Deshalb ist der Einzugsradius auch eine der besten
 * Aufwertungen und keine Bequemlichkeitsfunktion.
 */

/** Anfangsschub, mit dem ein Kristall aus dem sterbenden Gegner springt. */
const POP = 95

/** Nach dieser Zeit verschwindet ein liegengebliebener Kristall. */
const LEBENSDAUER = 26

export function legeKristall(s: Spielstand, x: number, y: number, wert: number): void {
  const k = s.kristalle.nimm()
  // Bewusst `rng` und nicht `rngOptik`: Wo ein Kristall hinspringt, entscheidet
  // mit, wann der Spieler ihn einsammelt - und damit, wann er aufsteigt. Das
  // ist Spiel, keine Optik. Ein Zufallszug aus dem falschen Strom waere hier
  // genau der Fehler, gegen den die Trennung der beiden Stroeme gedacht ist.
  const r = s.rng.richtung()
  k.x = x
  k.y = y
  k.vx = r.x * POP
  k.vy = r.y * POP
  k.wert = wert
  k.leben = LEBENSDAUER
  k.gezogen = false
}

/**
 * Kristalle bewegen und einsammeln.
 *
 * Gibt die eingesammelte XP-Menge zurueck, statt sie selbst gutzuschreiben.
 * Das haelt diese Datei frei von der Levelup-Logik - und vermeidet, dass
 * `pickups.ts` und `state.ts` sich gegenseitig importieren muessen.
 */
export function aktualisiereKristalle(s: Spielstand, dt: number): number {
  const sp = s.spieler
  const liste = s.kristalle.aktiv
  const magnet2 = sp.magnetRadius * sp.magnetRadius
  const aufsammeln = sp.radius + 12
  const aufsammeln2 = aufsammeln * aufsammeln
  let ausbeute = 0

  for (let i = liste.length - 1; i >= 0; i--) {
    const k = liste[i]
    k.leben -= dt
    if (k.leben <= 0) {
      s.kristalle.freigeben(i)
      continue
    }

    const dx = sp.x - k.x
    const dy = sp.y - k.y
    const d2 = dx * dx + dy * dy

    if (d2 <= aufsammeln2) {
      ausbeute += k.wert
      aufsammelnBlitz(s, k.x, k.y, FARBEN.kristall)
      s.kristalle.freigeben(i)
      continue
    }

    // Einmal angezogen, bleibt angezogen: Sonst reisst der Sog ab, sobald der
    // Spieler kurz die Richtung wechselt, und das Einsammeln fuehlt sich
    // zackig statt fluessig an.
    if (!k.gezogen && d2 <= magnet2) k.gezogen = true

    if (k.gezogen) {
      const d = Math.sqrt(d2) || 1
      // Naeher = schneller. Der Kristall schnellt am Ende regelrecht heran,
      // und genau dieses Zuschnappen ist die Belohnung.
      const zug = 620 + (1 - Math.min(1, d / sp.magnetRadius)) * 900
      k.vx += (dx / d) * zug * dt
      k.vy += (dy / d) * zug * dt
    } else {
      const bremse = Math.exp(-5 * dt)
      k.vx *= bremse
      k.vy *= bremse
    }

    k.x += k.vx * dt
    k.y += k.vy * dt
  }

  return ausbeute
}
