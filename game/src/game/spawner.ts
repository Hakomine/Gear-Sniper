import type { GegnerArt } from './enemies'
import {
  GEGNER_ARTEN,
  gewichtFuer,
  hpFaktor,
  schadenFaktor,
  tempoFaktor,
  verfuegbareArten,
} from './enemies'
import type { Gegner, Spielstand } from './state'

/**
 * Obergrenze zum Schutz der Bildrate. Darueber spawnt nichts mehr nach.
 *
 * Gemessen mit `npm run perf` (Budget: 5 ms pro Tick):
 *
 * | Gegner | Mittel  | p95     |
 * |--------|---------|---------|
 * | 1400   | 1,9 ms  | 2,5 ms  |
 * | 2000   | 4,5 ms  | 5,8 ms  |
 *
 * Der Anstieg ist ueberproportional, weil die Dichte quadratisch in die
 * Nachbarschaftsabfragen eingeht. Bei 2000 reisst der p95 das Budget, deshalb
 * bleibt die Grenze dort, wo die Messung sie traegt. Wer sie anhebt, misst
 * vorher nach - geraten war der Wert schon einmal.
 *
 * Steht hier und nicht in `state.ts`, damit `spawner.ts` ausschliesslich
 * *Typen* von dort bezieht - sonst importierten sich beide Dateien
 * gegenseitig.
 */
export const MAX_GEGNER = 1400

/**
 * Die Wellen-Regie.
 *
 * Der wichtigste Regler des ganzen Spiels: Sie entscheidet, ob sich Minute 8
 * noch nach etwas anfuehlt. Zwei Kurven greifen ineinander - hier die *Menge*,
 * in `enemies.ts` die *Zaehigkeit*. Nur die Menge zu steigern reicht nicht:
 * Ab einem gewissen Punkt raeumt eine aufgewertete Waffe jeden Teppich
 * muehelos weg, und das Spiel wird trotz tausend Gegnern langweilig.
 */

/** Gegner pro Sekunde. */
function spawnRate(zeit: number): number {
  // Gedeckelt, damit die Bildrate nicht die Schwierigkeit bestimmt.
  return Math.min(46, 2.4 + zeit * 0.085)
}

/** Sekunden zwischen zwei Schwaermen. */
const SCHWARM_TAKT = 42

export function legeGegner(s: Spielstand, art: GegnerArt, x: number, y: number): Gegner | null {
  if (s.gegner.anzahl >= MAX_GEGNER) return null
  const g = s.gegner.nimm()
  g.id = s.naechsteId++
  g.x = x
  g.y = y
  g.art = art
  // Skalierung einmal beim Spawn festschreiben statt jeden Tick neu zu
  // rechnen - und ein Gegner behaelt damit die Werte, mit denen er kam.
  g.maxHp = art.hp * hpFaktor(s.zeit)
  g.hp = g.maxHp
  g.radius = art.radius
  g.tempo = art.tempo * tempoFaktor(s.zeit)
  g.schaden = art.schaden * schadenFaktor(s.zeit)
  g.xp = art.xp
  g.masse = art.masse
  g.blitz = 0
  g.stossX = 0
  g.stossY = 0
  g.tot = false
  return g
}

function waehleArt(s: Spielstand): GegnerArt {
  const arten = verfuegbareArten(s.zeit)
  let summe = 0
  for (const a of arten) summe += gewichtFuer(a, s.zeit)
  let wurf = s.rng.next() * summe
  for (const a of arten) {
    wurf -= gewichtFuer(a, s.zeit)
    if (wurf <= 0) return a
  }
  return arten[arten.length - 1]
}

/**
 * Ein Gegner erscheint auf einem Ring knapp ausserhalb des Sichtfelds.
 *
 * `sichtRadius` kommt von aussen herein (main.ts setzt ihn aus der
 * Fenstergroesse), damit diese Datei nichts von einem Bildschirm wissen muss.
 */
function ringPunkt(s: Spielstand, winkel: number): { x: number; y: number } {
  const r = s.sichtRadius + 50
  return { x: s.spieler.x + Math.cos(winkel) * r, y: s.spieler.y + Math.sin(winkel) * r }
}

/**
 * Eine Handvoll Gegner direkt beim Start, auf halbem Weg statt am Rand.
 *
 * Der erste Screenshot nach sechs Sekunden zeigte ein fast leeres Feld: Vom
 * Spawnring braucht ein Splitter rund zehn Sekunden bis zum Spieler, und so
 * lange passiert schlicht nichts. Die ersten Sekunden entscheiden aber, ob
 * jemand weiterspielt. Diese Welle steht schon halb im Bild und ist nach zwei
 * bis drei Sekunden da.
 */
export function startWelle(s: Spielstand): void {
  const art = GEGNER_ARTEN[0]
  for (let i = 0; i < 14; i++) {
    // Gleichmaessig verteilt statt zufaellig geklumpt - der Spieler soll von
    // allen Seiten etwas sehen, nicht in eine Richtung schauen muessen.
    const winkel = (i / 14) * Math.PI * 2 + s.rng.range(-0.2, 0.2)
    const r = s.sichtRadius * s.rng.range(0.5, 0.72)
    legeGegner(s, art, s.spieler.x + Math.cos(winkel) * r, s.spieler.y + Math.sin(winkel) * r)
  }
}

export function spawne(s: Spielstand, dt: number): void {
  s.spawnSpeicher += spawnRate(s.zeit) * dt
  while (s.spawnSpeicher >= 1) {
    s.spawnSpeicher -= 1
    const p = ringPunkt(s, s.rng.next() * Math.PI * 2)
    legeGegner(s, waehleArt(s), p.x, p.y)
  }

  if (s.zeit >= s.naechsterSchwarm) {
    schwarm(s)
    s.naechsterSchwarm += SCHWARM_TAKT
  }
}

/**
 * Ein Schwarm: viele Gegner gleichzeitig aus *einer* Richtung.
 *
 * Der gleichmaessige Ring alleine erzeugt einen Dauerzustand ohne Form. Ein
 * Pulk aus einer Richtung zwingt den Spieler zu einer echten Entscheidung -
 * durchbrechen oder ausweichen - und gibt dem Lauf einen Rhythmus.
 */
function schwarm(s: Spielstand): void {
  const arten = verfuegbareArten(s.zeit)
  const art = arten[arten.length - 1]
  const mitte = s.rng.next() * Math.PI * 2
  const breite = 0.85
  const anzahl = 16 + Math.floor(s.zeit / 12)

  for (let i = 0; i < anzahl; i++) {
    const winkel = mitte + s.rng.range(-breite, breite)
    const p = ringPunkt(s, winkel)
    // Leicht gestaffelt, damit der Pulk als Welle ankommt und nicht als Wand.
    const tiefe = s.rng.range(0, 190)
    legeGegner(
      s,
      art,
      p.x + Math.cos(winkel) * tiefe,
      p.y + Math.sin(winkel) * tiefe,
    )
  }
}

/**
 * Gegner entfernen, die weit hinter dem Spieler zurueckgeblieben sind.
 *
 * Ohne das sammelt ein davonlaufender Spieler einen immer laengeren Schwanz
 * an Verfolgern, die er nie wiedersieht - sie kosten nur Rechenzeit. Die
 * Grenze liegt bewusst weit ausserhalb des Sichtfelds, damit nichts vor den
 * Augen des Spielers verschwindet.
 */
export function entferneVerlorene(s: Spielstand): void {
  const grenze = s.sichtRadius * 2.4
  const grenze2 = grenze * grenze
  const liste = s.gegner.aktiv
  const px = s.spieler.x
  const py = s.spieler.y

  for (let i = liste.length - 1; i >= 0; i--) {
    const g = liste[i]
    // Bosse bleiben. Ein Boss, der verschwindet, weil man weit genug wegläuft,
    // waere kein Boss, sondern eine Empfehlung.
    if (g.bossZustand !== null) continue
    const dx = g.x - px
    const dy = g.y - py
    if (dx * dx + dy * dy > grenze2) s.gegner.freigeben(i)
  }
}
