import type { Spielstand } from './state'

/**
 * Erzeugen von Partikeln und Schadenszahlen.
 *
 * Eigene Datei, damit `state.ts` und `pickups.ts` sie beide nutzen koennen,
 * ohne sich gegenseitig zu importieren. Sie kennt nur den *Typ* des
 * Spielstands, holt sich alles ueber das uebergebene Objekt und laesst sich
 * damit ohne Spielschleife testen.
 */

/** Obergrenze. Partikel sind Zugabe - eine eingebrochene Bildrate ist es nicht. */
const MAX_PARTIKEL = 900

export function legePartikel(
  s: Spielstand,
  x: number,
  y: number,
  vx: number,
  vy: number,
  leben: number,
  groesse: number,
  farbe: string,
): void {
  if (s.partikel.anzahl >= MAX_PARTIKEL) return
  const p = s.partikel.nimm()
  p.x = x
  p.y = y
  p.vx = vx
  p.vy = vy
  p.leben = leben
  p.maxLeben = leben
  p.groesse = groesse
  p.farbe = farbe
  p.drehung = s.rngOptik.range(0, Math.PI * 2)
  p.drehTempo = s.rngOptik.range(-9, 9)
}

/** Kurze helle Funken - Einschlag eines Geschosses. */
export function funken(s: Spielstand, x: number, y: number, farbe: string, anzahl = 3): void {
  for (let i = 0; i < anzahl; i++) {
    const r = s.rngOptik.richtung()
    const tempo = s.rngOptik.range(40, 150)
    legePartikel(
      s,
      x,
      y,
      r.x * tempo,
      r.y * tempo,
      s.rngOptik.range(0.12, 0.26),
      s.rngOptik.range(1.5, 3),
      farbe,
    )
  }
}

/**
 * Der Tod eines Gegners.
 *
 * Anzahl und Groesse haengen am Radius: Ein Brocken muss sichtbar wuchtiger
 * zerspringen als ein Splitter, sonst fuehlen sich alle Kills gleich an - und
 * das ist in diesem Genre der Unterschied zwischen befriedigend und flach.
 */
export function zerspringen(s: Spielstand, x: number, y: number, radius: number, farbe: string): void {
  const scherben = 4 + Math.floor(radius / 4)
  for (let i = 0; i < scherben; i++) {
    const r = s.rngOptik.richtung()
    const tempo = s.rngOptik.range(70, 250)
    legePartikel(
      s,
      x,
      y,
      r.x * tempo,
      r.y * tempo,
      s.rngOptik.range(0.28, 0.55),
      s.rngOptik.range(2, 2 + radius / 3),
      farbe,
    )
  }
}

/** Aufblitzen beim Einsammeln eines Kristalls. */
export function aufsammelnBlitz(s: Spielstand, x: number, y: number, farbe: string): void {
  for (let i = 0; i < 2; i++) {
    const r = s.rngOptik.richtung()
    legePartikel(s, x, y, r.x * 60, r.y * 60, 0.18, 2, farbe)
  }
}

/**
 * Schadenszahl. Deckel eingebaut: Bei tausend Gegnern wuerde sonst eine
 * Zahlenwand vor dem Spiel stehen - und ausgerechnet die eine Zahl, auf die
 * es ankommt, ginge darin unter.
 */
export function legeZahl(s: Spielstand, x: number, y: number, wert: number, krit: boolean): void {
  if (s.zahlen.anzahl >= 36) return
  const z = s.zahlen.nimm()
  z.x = x
  z.y = y
  z.vy = -46
  z.leben = 0.7
  z.wert = wert
  z.krit = krit
}
