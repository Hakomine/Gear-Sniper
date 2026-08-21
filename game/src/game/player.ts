import type { Spieler } from './state'

/**
 * Der Spieler bewegt sich - mehr nicht.
 *
 * Das ist die Gattungsregel des Survivor-likes und der Grund, warum es
 * funktioniert: Weil Zielen und Schiessen wegfallen, wird jede Entscheidung
 * zu einer Positionsentscheidung. Alles, was der Spieler steuert, steht in
 * dieser Datei; alles, was er aufwertet, sind die Multiplikatoren darin.
 */
export function erzeugeSpieler(): Spieler {
  return {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    radius: 11,
    tempo: 218,
    level: 1,
    xp: 0,
    // Bewusst sehr niedrig: Der erste Levelup soll nach wenigen Sekunden
    // kommen. Er ist der Moment, in dem das Spiel zeigt, worum es geht.
    xpNaechste: 5,
    unverwundbar: 0,
    blitz: 0,
    waffen: [],
    schadenMult: 1,
    abklingMult: 1,
    tempoMult: 1,
    magnetRadius: 95,
    kritChance: 0.05,
    kritFaktor: 2.1,
    xpMult: 1,
    maxWaffen: 5,
    // Charakter-Mechaniken. Bei allen anderen bleiben sie auf null und kosten
    // genau eine Abfrage pro Tick - siehe charaktere.ts.
    schliffProNah: 0,
    schliff: 0,
    stillstand: 0,
    stillstandSchwelle: 0,
    dornen: 0,
  }
}

/**
 * `bx`/`by` sind bereits normiert (Laenge hoechstens 1) - siehe core/input.ts.
 * Die Welt ist unbegrenzt, es gibt also keine Waende zu pruefen.
 */
export function bewegeSpieler(sp: Spieler, bx: number, by: number, dt: number): void {
  const tempo = sp.tempo * sp.tempoMult
  sp.x += bx * tempo * dt
  sp.y += by * tempo * dt
}

export function verletzeSpieler(sp: Spieler, schaden: number): void {
  sp.hp = Math.max(0, sp.hp - schaden)
}

export function heileSpieler(sp: Spieler, menge: number): void {
  sp.hp = Math.min(sp.maxHp, sp.hp + menge)
}
