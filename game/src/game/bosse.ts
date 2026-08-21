import { FARBEN } from '../render/palette'
import type { GegnerArt } from './enemies'
import { verfuegbareArten } from './enemies'
import { legeGegner } from './spawner'
import type { Gegner, Spielstand } from './state'
import { legeEffekt, legeZone } from './welt'

/**
 * Bosse.
 *
 * Sie laufen im **normalen Gegner-Pool** mit, statt einen eigenen zu bekommen.
 * Damit erben sie Risse, Zersplitterung, Rueckstoss und die gesamte
 * Trefferkette umsonst - und ein Boss geht nur mit mehreren *verschiedenen*
 * Waffen schnell zu Boden. Bessere Werbung fuer die Kernregel gibt es nicht.
 *
 * Zwei Dinge sind hier nicht verhandelbar:
 *
 * 1. **Jeder Angriff hat eine Vorwarnung.** Ein Boss ohne Telegraf ist nicht
 *    schwer, sondern unfair - man verliert, ohne zu verstehen warum. Schwer
 *    heisst: Man *sieht* es kommen und muss trotzdem etwas koennen.
 * 2. **Phase zwei aendert das Muster, nicht die Zahlen.** Mehr Trefferpunkte
 *    sind kein zweiter Kampf, sondern derselbe in laenger.
 */

export type AngriffId = 'speichen' | 'sturm' | 'ringe' | 'ruf'

export type BossArt = {
  readonly id: string
  readonly name: string
  readonly farbe: string
  readonly radius: number
  readonly hp: number
  readonly tempo: number
  readonly schaden: number
  readonly xp: number
  readonly angriffe: readonly AngriffId[]
  /** Unter diesem Anteil der Trefferpunkte greift Phase zwei. */
  readonly phaseSchwelle: number
  /** Sekunden zwischen zwei Angriffen. */
  readonly takt: number
}

export type BossZustand = {
  art: BossArt
  phase: number
  angriff: AngriffId | null
  /** Restliche Vorwarnzeit. Groesser als 0 heisst: Angriff ist angekuendigt. */
  telegraf: number
  abkling: number
  zielX: number
  zielY: number
  /** Restzeit des Sturmangriffs - solange praescht der Boss. */
  sturmRest: number
  sturmVx: number
  sturmVy: number
}

/**
 * Bosse brauchen einen `GegnerArt`-Eintrag, weil sie im selben Pool liegen.
 *
 * Form `sechseck` fuer alle drei: Die Formsprache sagt "Elite", die Groesse
 * sagt "Boss". Eine vierte Form einzufuehren wuerde die Sprache verwaessern,
 * die bei tausend Gegnern das Lesen erst moeglich macht.
 */
function bossArtAlsGegner(b: BossArt): GegnerArt {
  return {
    id: `boss:${b.id}`,
    name: b.name,
    form: 'sechseck',
    // Bosse laufen nicht ueber die Gegner-Registratur - `bewegeGegner` zweigt
    // sie vorher zu `bossTick` ab. Der Eintrag steht nur da, damit der Typ
    // vollstaendig ist.
    verhalten: 'jaeger',
    farbe: b.farbe,
    radius: b.radius,
    hp: b.hp,
    tempo: b.tempo,
    schaden: b.schaden,
    xp: b.xp,
    masse: 40,
    abSekunde: 0,
    gewicht: 0,
    gewichtSpaet: 0,
  }
}

export const BOSSE: readonly BossArt[] = [
  {
    id: 'waechter',
    name: 'Wächter',
    farbe: '#ff6b3d',
    radius: 48,
    hp: 900,
    tempo: 34,
    schaden: 26,
    xp: 140,
    angriffe: ['speichen', 'sturm'],
    phaseSchwelle: 0.5,
    takt: 2.6,
  },
  {
    id: 'kolossus',
    name: 'Kolossus',
    farbe: '#8f7bff',
    radius: 62,
    hp: 1000,
    tempo: 28,
    schaden: 34,
    xp: 260,
    angriffe: ['ringe', 'ruf', 'sturm'],
    phaseSchwelle: 0.5,
    takt: 2.4,
  },
  {
    id: 'zerbrecher',
    name: 'Zerbrecher',
    farbe: '#ff4d5e',
    radius: 72,
    hp: 1300,
    tempo: 32,
    schaden: 42,
    xp: 420,
    angriffe: ['speichen', 'sturm', 'ringe', 'ruf'],
    phaseSchwelle: 0.4,
    takt: 2.0,
  },
]

/*
 * Die Trefferpunkte sind ein erster Wurf und ausdruecklich zum Nachtunen da.
 * Gemessen: Mit 1600/1800/2400 stand nach 400 Sekunden erst der zweite Boss -
 * die naechste Welle wartet naemlich, bis der aktuelle liegt, und damit wurde
 * der 90-Sekunden-Takt bedeutungslos. Ein Boss soll ein Ereignis sein, kein
 * Dauerzustand.
 */

/**
 * Die Trefferpunkte eines Bosses ueber die Zeit.
 *
 * Bewusst **nicht** `hpFaktor` aus `enemies.ts`. Der ist quadratisch und
 * gehoert dem Schwarm: Er sorgt dafuer, dass 1400 Wellengegner in der zehnten
 * Minute noch gefaehrlich sind. Auf einen Boss angewendet ergibt er in der
 * zehnten Minute den Faktor 71 - gemessen wurden damit Bosskaempfe von 120 bis
 * 195 Sekunden, und weil die naechste Welle wartet, bis der aktuelle liegt,
 * blieb es bei drei Bossen in zehn Minuten statt sieben.
 *
 * Ein Boss soll ein Ereignis sein, kein Belagerungszustand. Diese Kurve ist
 * flach genug, dass der Kampf bei einer halben bis knapp einer Minute bleibt,
 * und steil genug, dass er nie zur Formsache wird. Der Beruehrungs- und
 * Geschossschaden skaliert weiter mit dem Schwarm - gefaehrlich bleibt er also.
 */
export function bossHpFaktor(zeit: number): number {
  const min = zeit / 60
  return 1 + min * 1.0 + min * min * 0.05
}

/** Wann der erste Boss kommt und in welchem Abstand die weiteren. */
const ERSTER_BOSS = 90
const BOSS_TAKT = 90

/** Welcher Boss zur `nummer`-ten Bosswelle gehoert. Danach wiederholen sie sich. */
export function bossFuer(nummer: number): BossArt {
  return BOSSE[Math.min(nummer, BOSSE.length - 1)]
}

export function naechsteBossZeit(nummer: number): number {
  return ERSTER_BOSS + nummer * BOSS_TAKT
}

/** Laeuft gerade ein Boss? Fuer die Leiste und damit nie zwei gleichzeitig kommen. */
export function findeBoss(s: Spielstand): Gegner | null {
  const liste = s.gegner.aktiv
  for (let i = 0; i < liste.length; i++) {
    if (liste[i].bossZustand !== null && !liste[i].tot) return liste[i]
  }
  return null
}

/** Bosswelle faellig? Dann setzen. */
export function bossWelle(s: Spielstand): void {
  if (s.zeit < naechsteBossZeit(s.bossNummer)) return
  // Nie zwei Wellen uebereinander: Der Takt schiebt sich, bis der aktuelle
  // liegt. Die Tuer "Zwillinge" setzt beide Bosse in *derselben* Welle - das
  // ist etwas anderes und laeuft unten ueber `etappenWerte.bosse`.
  if (findeBoss(s) !== null) return

  for (let i = 0; i < s.etappenWerte.bosse; i++) setzeBoss(s)
}

function setzeBoss(s: Spielstand): void {

  const art = bossFuer(s.bossNummer)

  // Etwas naeher als der Spawnring: Der Boss soll gesehen werden, bevor er da
  // ist, aber nicht erst nach zehn Sekunden Anmarsch.
  const winkel = s.rng.next() * Math.PI * 2
  const r = s.sichtRadius * 0.85
  const g = legeGegner(
    s,
    bossArtAlsGegner(art),
    s.spieler.x + Math.cos(winkel) * r,
    s.spieler.y + Math.sin(winkel) * r,
  )
  // Erst weiterzaehlen, wenn er wirklich steht. Steht das Feld am Deckel,
  // liefert der Pool nichts - und mit einem vorschnellen `bossNummer++` waere
  // die Welle stillschweigend uebersprungen. Genau in der spaeten Phase, wo
  // der Deckel erreicht wird, faellt der Boss dann aus.
  if (g === null) return
  s.bossNummer++

  // `legeGegner` hat die Schwarmkurve angelegt - fuer einen Boss wird sie
  // hier durch die eigene ersetzt.
  g.maxHp = art.hp * bossHpFaktor(s.zeit)
  g.hp = g.maxHp

  g.bossZustand = {
    art,
    phase: 1,
    angriff: null,
    telegraf: 0,
    // Kurze Gnade nach dem Auftritt, damit man ihn erst einmal sieht.
    abkling: 1.8,
    zielX: 0,
    zielY: 0,
    sturmRest: 0,
    sturmVx: 0,
    sturmVy: 0,
  }
  s.blitz = Math.max(s.blitz, 0.5)
  s.trauma = Math.min(1, s.trauma + 0.4)
}

/** Ein Boss-Tick: Bewegung, Vorwarnung, Angriff, Phasenwechsel. */
export function bossTick(s: Spielstand, g: Gegner, dt: number): void {
  const z = g.bossZustand
  if (z === null) return

  // Phasenwechsel: einmalig, mit Ansage.
  if (z.phase === 1 && g.hp / g.maxHp <= z.art.phaseSchwelle) {
    z.phase = 2
    z.telegraf = 0
    z.angriff = null
    z.abkling = 1.2
    s.blitz = Math.max(s.blitz, 0.7)
    s.trauma = Math.min(1, s.trauma + 0.5)
    legeEffekt(s, 'ring', g.x, g.y, z.art.radius * 5, 0.7, z.art.farbe, 5)
  }

  if (z.sturmRest > 0) {
    // Eigene Geschwindigkeit statt des Rueckstoss-Feldes: Der wird gedaempft,
    // und ein Sturmangriff, der auf halber Strecke ausrollt, ist keiner.
    z.sturmRest -= dt
    g.x += z.sturmVx * dt
    g.y += z.sturmVy * dt
    return
  }

  if (z.telegraf > 0) {
    z.telegraf -= dt
    if (z.telegraf <= 0) fuehreAus(s, g, z)
    // Waehrend der Vorwarnung steht der Boss still. Das ist der Moment, in dem
    // der Spieler liest, was kommt - Bewegung wuerde ihn nur verwischen.
    return
  }

  // Langsam nachsetzen.
  const dx = s.spieler.x - g.x
  const dy = s.spieler.y - g.y
  const laenge = Math.hypot(dx, dy) || 1
  g.x += (dx / laenge) * g.tempo * dt
  g.y += (dy / laenge) * g.tempo * dt

  z.abkling -= dt
  if (z.abkling > 0) return
  kuendigeAn(s, g, z)
}

/** Angriff auswaehlen und ankuendigen. */
function kuendigeAn(s: Spielstand, g: Gegner, z: BossZustand): void {
  const angriff = s.rng.pick(z.art.angriffe)
  z.angriff = angriff
  s.klaenge.melde('warnung')
  z.zielX = s.spieler.x
  z.zielY = s.spieler.y

  switch (angriff) {
    case 'speichen': {
      z.telegraf = 1.0
      // Speichen andeuten, damit man die Luecken vorher sieht.
      const speichen = z.phase === 1 ? 5 : 7
      for (let i = 0; i < speichen; i++) {
        const w = (i / speichen) * Math.PI * 2
        const e = legeEffekt(s, 'strich', g.x, g.y, 0, 1.0, FARBEN.gefahr, 2)
        if (e === null) continue
        e.x2 = g.x + Math.cos(w) * 260
        e.y2 = g.y + Math.sin(w) * 260
        e.warnung = true
      }
      break
    }
    case 'sturm': {
      z.telegraf = 0.8
      const e = legeEffekt(s, 'strich', g.x, g.y, 0, 0.8, FARBEN.gefahr, 6)
      if (e !== null) {
        e.x2 = z.zielX
        e.y2 = z.zielY
        e.warnung = true
      }
      break
    }
    case 'ringe': {
      z.telegraf = 0.9
      const e = legeEffekt(s, 'ring', g.x, g.y, 300, 0.9, FARBEN.gefahr, 4)
      if (e !== null) e.warnung = true
      break
    }
    case 'ruf': {
      z.telegraf = 1.2
      for (let i = 0; i < 8; i++) {
        const w = (i / 8) * Math.PI * 2
        const e = legeEffekt(
          s,
          'ring',
          s.spieler.x + Math.cos(w) * 190,
          s.spieler.y + Math.sin(w) * 190,
          26,
          1.2,
          FARBEN.gefahr,
          3,
        )
        if (e !== null) e.warnung = true
      }
      break
    }
  }
}

/** Die Vorwarnung ist abgelaufen - jetzt passiert es. */
function fuehreAus(s: Spielstand, g: Gegner, z: BossZustand): void {
  z.abkling = z.art.takt

  switch (z.angriff) {
    case 'speichen':
      speichenfeuer(s, g, z)
      break
    case 'sturm':
      sturmangriff(s, g, z)
      break
    case 'ringe':
      schockringe(s, g, z)
      break
    case 'ruf':
      bruchruf(s, g)
      break
  }
  z.angriff = null
}

function speichenfeuer(s: Spielstand, g: Gegner, z: BossZustand): void {
  const salven = z.phase === 1 ? 1 : 2
  const speichen = z.phase === 1 ? 5 : 7

  for (let salve = 0; salve < salven; salve++) {
    // Phase zwei feuert eine zweite Salve gegenlaeufig versetzt: Die Luecken
    // wandern gegeneinander, und ein fester Standpunkt reicht nicht mehr.
    const versatz = salve === 0 ? 0 : Math.PI / speichen
    for (let i = 0; i < speichen; i++) {
      const w = (i / speichen) * Math.PI * 2 + versatz
      const tempo = salve === 0 ? 210 : 170
      schiess(s, g, w, tempo, z.art)
    }
  }
  s.trauma = Math.min(1, s.trauma + 0.1)
}

function sturmangriff(s: Spielstand, g: Gegner, z: BossZustand): void {
  const dx = z.zielX - g.x
  const dy = z.zielY - g.y
  const laenge = Math.hypot(dx, dy) || 1
  // Kein Teleport: Der Boss legt die Strecke in etwa einer halben Sekunde
  // zurueck, ausweichen bleibt moeglich.
  const tempo = Math.min(900, laenge / 0.45)
  z.sturmVx = (dx / laenge) * tempo
  z.sturmVy = (dy / laenge) * tempo
  z.sturmRest = 0.5
  s.trauma = Math.min(1, s.trauma + 0.18)
}

function schockringe(s: Spielstand, g: Gegner, z: BossZustand): void {
  const anzahl = z.phase === 1 ? 2 : 3
  for (let i = 0; i < anzahl; i++) {
    const ring = legeZone(
      s,
      'knall',
      g.x,
      g.y,
      300 + i * 40,
      // Gestaffelt: Die Ringe laufen nacheinander los.
      1.1 + i * 0.45,
      z.art.schaden * 0.7,
      -1,
      z.art.farbe,
    )
    ring.feindlich = true
    ring.wachsend = true
  }
}

function bruchruf(s: Spielstand, g: Gegner): void {
  const arten = verfuegbareArten(s.zeit)
  const art = arten[arten.length - 1]
  for (let i = 0; i < 8; i++) {
    const w = (i / 8) * Math.PI * 2
    legeGegner(s, art, s.spieler.x + Math.cos(w) * 190, s.spieler.y + Math.sin(w) * 190)
  }
  legeEffekt(s, 'ring', g.x, g.y, 120, 0.3, g.art.farbe, 3)
}

function schiess(s: Spielstand, g: Gegner, winkel: number, tempo: number, art: BossArt): void {
  if (s.feindSchuesse.anzahl >= 300) return
  const p = s.feindSchuesse.nimm()
  p.x = g.x
  p.y = g.y
  p.vx = Math.cos(winkel) * tempo
  p.vy = Math.sin(winkel) * tempo
  p.radius = 8
  p.schaden = art.schaden * 0.75
  p.leben = 5
  p.farbe = art.farbe
}
