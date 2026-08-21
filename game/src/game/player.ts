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
    schadenNimmt: 1,
    // Regelveraendernde Gegenstaende - siehe upgrades.ts. Alle aus, bis einer
    // gezogen wird.
    rissDauer: 0,
    kettenRiss: 0,
    kettenZaehler: 0,
    splitterFeld: 0,
    blutglas: 0,
    kritRiss: false,
    zwillingsbruch: 1,
    standhaft: 0,
    schild: false,
    stehZeit: 0,
    steht: false,
    aussetzer: false,
    sog: 0,
    zeitlupe: 0,
    letzterRiss: false,
    // Charakter-Mechaniken. Bei allen anderen bleiben sie auf null und kosten
    // genau eine Abfrage pro Tick - siehe charaktere.ts.
    schliffProNah: 0,
    schliff: 0,
    stillstand: 0,
    stillstandSchwelle: 0,
    dornen: 0,
    stossRest: 0,
    stossAbkling: 0,
    stossVx: 0,
    stossVy: 0,
    stossLaden: 1,
    blickX: 1,
    blickY: 0,
  }
}

/**
 * Der Stoss - das zweite Verb.
 *
 * Bis hierher konnte der Spieler genau *eines*: laufen. Solange alle Gegner
 * stumpf hinterherliefen, reichte das auch. Mit Stuermern, die eine Bahn
 * ankuendigen und dann durchziehen, und Speiern, die aus der Ferne treffen,
 * braucht es eine Antwort - sonst sind beide nur Aerger statt einer Ansage,
 * auf die man reagieren kann.
 *
 * Er setzt bewusst **keinen Riss**: Der Stoss bleibt ein reines
 * Ausweichmanoever und haengt sich nicht an die Kernregel. Damit braucht die
 * Riss-Bitmaske auch keinen weiteren reservierten Platz.
 */
export const STOSS_DAUER = 0.18
export const STOSS_ABKLING = 2.5
/** Wie viel schneller der Stoss ist als normales Laufen. */
export const STOSS_TEMPO = 3.4
/** Unverwundbar bleibt man einen Tick laenger als der Stoss dauert. */
const STOSS_SCHUTZ = STOSS_DAUER + 0.06

/**
 * Stoss ausloesen, wenn er bereit ist.
 *
 * Ohne Richtung stoesst er dorthin, wo man zuletzt hinlief - sonst waere ein
 * Stoss im Stand ein verschenkter Knopfdruck, und genau im Gedraenge steht man
 * oft kurz still.
 */
export function stosse(sp: Spieler, bx: number, by: number, letztX: number, letztY: number): boolean {
  if (sp.stossAbkling > 0 || sp.stossRest > 0) return false

  let rx = bx
  let ry = by
  if (rx === 0 && ry === 0) {
    rx = letztX
    ry = letztY
  }
  const laenge = Math.hypot(rx, ry)
  if (laenge === 0) return false

  const tempo = sp.tempo * sp.tempoMult * STOSS_TEMPO
  sp.stossVx = (rx / laenge) * tempo
  sp.stossVy = (ry / laenge) * tempo
  sp.stossRest = STOSS_DAUER
  sp.stossAbkling = STOSS_ABKLING
  // Nicht ueberschreiben, wenn gerade schon Unverwundbarkeit laeuft: Wer
  // direkt nach einem Treffer stoesst, soll seine Gnadenzeit behalten.
  sp.unverwundbar = Math.max(sp.unverwundbar, STOSS_SCHUTZ)
  return true
}

/** Stoss und Abklingzeit weiterlaufen lassen. */
export function stossTick(sp: Spieler, dt: number): void {
  if (sp.stossRest > 0) sp.stossRest = Math.max(0, sp.stossRest - dt)
  if (sp.stossAbkling > 0) {
    sp.stossAbkling = Math.max(0, sp.stossAbkling - dt * sp.stossLaden)
  }
}

/**
 * `bx`/`by` sind bereits normiert (Laenge hoechstens 1) - siehe core/input.ts.
 * Die Welt ist unbegrenzt, es gibt also keine Waende zu pruefen.
 */
export function bewegeSpieler(sp: Spieler, bx: number, by: number, dt: number): void {
  // Waehrend des Stosses zaehlt allein die Stossrichtung. Ein Stoss, den man
  // mit dem Stick verziehen kann, ist kein Ausweichen mehr, sondern nur ein
  // kurzer Temposchub - und dann laesst sich ein angekuendigter Sturm nicht
  // mehr sauber lesen.
  if (sp.stossRest > 0) {
    sp.x += sp.stossVx * dt
    sp.y += sp.stossVy * dt
    return
  }

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
