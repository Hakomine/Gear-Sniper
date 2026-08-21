import { Pool } from '../core/pool'
import { Rng } from '../core/rng'
import { RaumGitter } from '../core/spatialHash'
import { FARBEN } from '../render/palette'
import { xpFuerLevel } from './damage'
import { zerspringen } from './effects'
import type { GegnerArt } from './enemies'
import { aktualisiereKristalle, legeKristall } from './pickups'
import { bewegeSpieler, erzeugeSpieler, verletzeSpieler } from './player'
import { risseAblaufen } from './risse'
import { entferneVerlorene, spawne, startWelle } from './spawner'
import type { Aufwertung } from './upgrades'
import { zieheAngebote } from './upgrades'
import { detoniere, VERHALTEN } from './verhalten'
import type { WaffenInstanz } from './weapons'
import { ruesteAus, WAFFE_START } from './weapons'
import { arbeiteKaskadeAb, gegnerImUmkreis, naechsterGegner, verletzeGegner } from './welt'

/**
 * Der gesamte Laufzustand in einem Objekt - und die Simulation darauf.
 *
 * Diese Datei kennt keinen Browser: kein `document`, kein `window`, kein
 * Canvas. Das ist keine Stilfrage, sondern zahlt sich dreifach aus - die
 * Logik ist ohne Browser testbar, die Performance laesst sich ohne Zeichnen
 * messen (`npm run perf`), und ein spaeteres Verpacken fuer Steam wird zur
 * Randnotiz statt zum Umbau.
 *
 * Die Import-Richtung ist sternfoermig: Diese Datei holt sich Funktionen aus
 * den Teilsystemen, die Teilsysteme holen sich von hier nur *Typen*. Dadurch
 * gibt es keine gegenseitigen Importe.
 */

export type Phase = 'titel' | 'laufend' | 'levelup' | 'tot'

export type Spieler = {
  x: number
  y: number
  hp: number
  maxHp: number
  radius: number
  tempo: number
  level: number
  xp: number
  xpNaechste: number
  /** Restzeit der Unverwundbarkeit nach einem Treffer. */
  unverwundbar: number
  blitz: number
  /** Der Guertel. Hoechstens `MAX_WAFFEN` Stueck - siehe `weapons.ts`. */
  waffen: WaffenInstanz[]
  /** Passive Gegenstaende wirken ausschliesslich ueber diese Werte. */
  schadenMult: number
  abklingMult: number
  tempoMult: number
  magnetRadius: number
  kritChance: number
  kritFaktor: number
}

export type Gegner = {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  art: GegnerArt
  /** Aus der Art plus Zeitskalierung beim Spawn vorgerechnet. */
  radius: number
  tempo: number
  schaden: number
  xp: number
  masse: number
  blitz: number
  stossX: number
  stossY: number
  tot: boolean
  /**
   * Risse - ein Bit je Waffenplatz. Siehe `risse.ts`; bewusst eine Zahl und
   * kein `Set`, weil es davon bis zu 1400 Stueck gibt.
   */
  risseMaske: number
  risse: number
  risseZeit: number
  zersplittert: boolean
}

export type Geschoss = {
  x: number
  y: number
  vx: number
  vy: number
  schaden: number
  radius: number
  durchschlag: number
  leben: number
  rueckstoss: number
  krit: boolean
  /** Guertelplatz der abfeuernden Waffe - entscheidet ueber den Riss. */
  platz: number
  farbe: string
  /** Wendigkeit im Bogenmass je Sekunde. 0 = fliegt geradeaus. */
  zielsuche: number
  ziel: Gegner | null
  /** Zur Probe, ob `ziel` noch derselbe Gegner ist - Pools recyceln Objekte. */
  zielId: number
  /** Groesser als 0: knallt beim Aufschlag. */
  explosionsRadius: number
  /** Wie viele kleinere Granaten der Knall nachwirft. */
  nachwurf: number
  /** Springt nach einem Treffer weiter, statt zu vergehen. */
  prallt: boolean
  /** IDs bereits getroffener Gegner - sonst trifft ein Durchschuss denselben mehrfach. */
  getroffen: Set<number>
}

/** Ein wirksames Feld: Sog des Sternenschluckers, Truemmerfeld nach dem Platzen. */
export type Zone = {
  art: 'sog' | 'knall'
  x: number
  y: number
  radius: number
  maxRadius: number
  leben: number
  maxLeben: number
  schaden: number
  sogKraft: number
  /** Restzeit bis zum naechsten Schadenstakt. */
  tickRest: number
  platz: number
  farbe: string
  /** Laesst beim Platzen ein Truemmerfeld zurueck (vollendeter Schlucker). */
  truemmer: boolean
}

/** Rein optisch: Blitzbahn, Hiebbogen, Druckring. */
export type Effekt = {
  art: 'strich' | 'bogen' | 'ring'
  x: number
  y: number
  x2: number
  y2: number
  radius: number
  winkel: number
  spanne: number
  leben: number
  maxLeben: number
  farbe: string
  breite: number
}

export type Kristall = {
  x: number
  y: number
  vx: number
  vy: number
  wert: number
  leben: number
  gezogen: boolean
}

export type Partikel = {
  x: number
  y: number
  vx: number
  vy: number
  leben: number
  maxLeben: number
  groesse: number
  farbe: string
  drehung: number
  drehTempo: number
}

export type SchadensZahl = {
  x: number
  y: number
  vy: number
  leben: number
  wert: number
  krit: boolean
}

/**
 * Was der Spieler in diesem Tick will - schon uebersetzt.
 *
 * Die Simulation bekommt Absichten, keine Tasten. Dadurch kann der
 * Performance-Test synthetische Eingaben einspeisen, ohne dass ein Browser
 * im Spiel ist.
 */
export type Befehle = {
  x: number
  y: number
  bestaetigen: boolean
  links: boolean
  rechts: boolean
  /** Direktwahl per Zifferntaste, sonst -1. */
  wahl: number
}

export type Statistik = {
  kills: number
  level: number
  zeit: number
  schaden: number
  zersplittert: number
}

export type Spielstand = {
  phase: Phase
  zeit: number
  saat: number
  /** Alles, was den Lauf beeinflusst. */
  rng: Rng
  /** Nur Optik. Getrennt, damit eine neue Partikelwolke nicht den Lauf veraendert. */
  rngOptik: Rng
  spieler: Spieler
  gegner: Pool<Gegner>
  geschosse: Pool<Geschoss>
  zonen: Pool<Zone>
  effekte: Pool<Effekt>
  kristalle: Pool<Kristall>
  partikel: Pool<Partikel>
  zahlen: Pool<SchadensZahl>
  gitter: RaumGitter
  kamera: { x: number; y: number }
  /** Erschuetterung, 0..1. Quadriert in den Ausschlag - siehe render/juice.ts. */
  trauma: number
  /** Globaler Bildblitz, 0..1. */
  blitz: number
  /** 1 = normale Zeit, 0 = eingefroren. Rampt beim Levelup herunter. */
  zeitskala: number
  levelWartet: number
  spawnSpeicher: number
  naechsterSchwarm: number
  angebote: Aufwertung[]
  auswahl: number
  /** Stufen der passiven Gegenstaende. Waffenstufen stehen an der Waffe. */
  stufen: Map<string, number>
  /** Halber Bildschirmdurchmesser - der Spawner braucht ihn, kennt aber kein Canvas. */
  sichtRadius: number
  statistik: Statistik
  naechsteId: number
}

/** Wie lange der Spieler nach einem Treffer unverwundbar ist. */
const UNVERWUNDBAR = 0.55

/** Dauer der Zeitlupe, mit der das Levelup-Menue hereinkommt. */
const LEVELUP_RAMPE = 0.22

/** Der groesste Gegnerradius - so weit muss der Vorfilter greifen. */
const GROESSTER_GEGNER = 22

export function erzeugeSpielstand(saat: number): Spielstand {
  const spieler = erzeugeSpieler()
  spieler.waffen = [ruesteAus(WAFFE_START, 0)]
  return {
    phase: 'titel',
    zeit: 0,
    saat,
    rng: new Rng(saat),
    rngOptik: new Rng(saat).fork(),
    spieler,
    gegner: new Pool<Gegner>(leererGegner, 512),
    geschosse: new Pool<Geschoss>(leeresGeschoss, 128),
    zonen: new Pool<Zone>(leereZone, 8),
    effekte: new Pool<Effekt>(leererEffekt, 64),
    kristalle: new Pool<Kristall>(leererKristall, 256),
    partikel: new Pool<Partikel>(leeresPartikel, 512),
    zahlen: new Pool<SchadensZahl>(leereZahl, 64),
    gitter: new RaumGitter(72),
    kamera: { x: 0, y: 0 },
    trauma: 0,
    blitz: 0,
    zeitskala: 1,
    levelWartet: 0,
    spawnSpeicher: 0,
    naechsterSchwarm: 42,
    angebote: [],
    auswahl: 0,
    stufen: new Map(),
    sichtRadius: 700,
    statistik: { kills: 0, level: 1, zeit: 0, schaden: 0, zersplittert: 0 },
    naechsteId: 1,
  }
}

/** Lauf zuruecksetzen, ohne den Zustand neu anzulegen (die Pools bleiben warm). */
export function starteLauf(s: Spielstand, saat = s.saat): void {
  s.phase = 'laufend'
  s.zeit = 0
  s.saat = saat
  s.rng = new Rng(saat)
  s.rngOptik = new Rng(saat).fork()
  Object.assign(s.spieler, erzeugeSpieler())
  s.spieler.waffen = [ruesteAus(WAFFE_START, 0)]
  s.gegner.alleFreigeben()
  s.geschosse.alleFreigeben()
  s.zonen.alleFreigeben()
  s.effekte.alleFreigeben()
  s.kristalle.alleFreigeben()
  s.partikel.alleFreigeben()
  s.zahlen.alleFreigeben()
  s.kamera.x = 0
  s.kamera.y = 0
  s.trauma = 0
  s.blitz = 0
  s.zeitskala = 1
  s.levelWartet = 0
  s.spawnSpeicher = 0
  s.naechsterSchwarm = 42
  s.angebote = []
  s.auswahl = 0
  s.stufen.clear()
  s.statistik = { kills: 0, level: 1, zeit: 0, schaden: 0, zersplittert: 0 }
  s.naechsteId = 1
  startWelle(s)
}

// ---------------------------------------------------------------------------
// Ein Tick
// ---------------------------------------------------------------------------

/**
 * Wiederverwendetes Ergebnisarray fuer Gitterabfragen.
 *
 * ACHTUNG: Nur fuer Abfragen *dieser* Datei. Wer daraus eine zweite Abfrage
 * startet, waehrend hier noch iteriert wird, ueberschreibt die Liste unter den
 * eigenen Fuessen. Deshalb haben `welt.ts` und `verhalten.ts` eigene Arrays.
 */
const kandidaten: number[] = []

/** Eigenes Array fuer die Zonen - laeuft ausserhalb der Geschossschleife. */
const zonenTreffer: Gegner[] = []

export function tick(s: Spielstand, b: Befehle, dt: number): void {
  switch (s.phase) {
    case 'titel':
      if (b.bestaetigen) starteLauf(s)
      return

    case 'tot':
      // Neuer Saatwert: Ein Neustart soll einen neuen Lauf geben, nicht
      // denselben noch einmal.
      if (b.bestaetigen) starteLauf(s, s.saat + 1)
      return

    case 'levelup':
      levelupTick(s, b, dt)
      return

    case 'laufend':
      laufendTick(s, b, dt)
      return
  }
}

function laufendTick(s: Spielstand, b: Befehle, dt: number): void {
  // Zeitlupe beim Levelup: Die Simulation rampt herunter, statt hart zu
  // stehen. Ein harter Schnitt mitten im Getuemmel liest sich als Ruckler,
  // eine Rampe von gut zwei Zehnteln als Absicht.
  if (s.levelWartet > 0) {
    s.levelWartet -= dt
    s.zeitskala = Math.max(0, s.levelWartet / LEVELUP_RAMPE)
    if (s.levelWartet <= 0) {
      aktualisiereOptik(s, dt)
      oeffneLevelup(s)
      return
    }
  }

  const sdt = dt * s.zeitskala
  s.zeit += sdt
  s.statistik.zeit = s.zeit

  bewegeSpieler(s.spieler, b.x, b.y, sdt)
  spawne(s, sdt)

  // Das Gitter wird zweimal gebaut: einmal fuer das Auseinanderdruecken der
  // Gegner, danach erneut mit den neuen Positionen fuer die Treffer. Ein
  // veraltetes Gitter bei der Trefferpruefung wuerde vereinzelt Schuesse
  // durchrutschen lassen - der Neuaufbau kostet weniger als dieser Fehler.
  gitterAufbauen(s)
  bewegeGegner(s, sdt)

  gitterAufbauen(s)
  feuereWaffen(s, sdt)
  bewegeGeschosse(s, sdt)
  zonenTick(s, sdt)
  spielerKollision(s, sdt)

  // Vor dem Aufraeumen: Zersplitterte Gegner sollen noch ihre Kristalle
  // fallen lassen und in die Statistik zaehlen.
  arbeiteKaskadeAb(s)
  raeumeTote(s)
  entferneVerlorene(s)

  const ausbeute = aktualisiereKristalle(s, sdt)
  if (ausbeute > 0) gibXp(s, ausbeute)

  aktualisiereOptik(s, dt)
  folgeKamera(s, dt)

  if (s.spieler.hp <= 0) {
    s.phase = 'tot'
    s.trauma = 1
    s.blitz = 0.9
  }
}

/**
 * Exportiert, weil die Kaskade und alle Verhalten darauf angewiesen sind:
 * Ohne aktuelles Gitter liefert jede Umkreisabfrage eine leere Liste - und
 * zwar lautlos. Wer die Simulation ausserhalb von `tick` benutzt (Tests,
 * Messungen), muss es vorher bauen.
 */
export function gitterAufbauen(s: Spielstand): void {
  const gitter = s.gitter
  gitter.leeren()
  const liste = s.gegner.aktiv
  // Der Index in `aktiv` ist der Schluessel. Er gilt nur, solange nichts
  // entfernt wird - deshalb laeuft `raeumeTote` erst nach allen Abfragen.
  for (let i = 0; i < liste.length; i++) gitter.einfuegen(liste[i].x, liste[i].y, i)
}

/** Wie stark sich ueberlappende Gegner auseinanderschieben. */
const TRENN_KRAFT = 165

function bewegeGegner(s: Spielstand, dt: number): void {
  const liste = s.gegner.aktiv
  const px = s.spieler.x
  const py = s.spieler.y

  for (let i = 0; i < liste.length; i++) {
    const g = liste[i]
    risseAblaufen(g, dt)

    const dx = px - g.x
    const dy = py - g.y
    const abstand = Math.hypot(dx, dy) || 1
    let vx = (dx / abstand) * g.tempo
    let vy = (dy / abstand) * g.tempo

    // Auseinanderdruecken. Ohne das laufen alle Gegner exakt uebereinander,
    // und aus tausend Feinden wird optisch einer: Man sieht die Gefahr nicht
    // mehr und trifft mit einem Schuss alles.
    //
    // Reizvoll waere, hier auch die Zahl der *angesehenen* Kandidaten zu
    // deckeln - der Aufwand pro Gegner haenge dann nicht mehr an der Dichte.
    // Gemessen ist das ein klarer Rueckschritt (11,7 statt 4,5 ms pro Tick):
    // Wird die Trennkraft beschnitten, verklumpen die Gegner, und dann
    // liefert *jede* Gitterabfrage riesige Kandidatenlisten. Das
    // Auseinanderdruecken bezahlt seine eigene Rechenzeit. Nicht deckeln.
    const sichtweite = g.radius * 2.1
    s.gitter.abfragen(g.x, g.y, sichtweite, kandidaten)
    let geprueft = 0
    for (let k = 0; k < kandidaten.length && geprueft < 6; k++) {
      const j = kandidaten[k]
      if (j === i) continue
      const a = liste[j]
      if (a === undefined) continue
      const ax = g.x - a.x
      const ay = g.y - a.y
      const d2 = ax * ax + ay * ay
      const mindest = g.radius + a.radius
      if (d2 > mindest * mindest || d2 === 0) continue
      const d = Math.sqrt(d2)
      const kraft = ((mindest - d) / mindest) * TRENN_KRAFT
      vx += (ax / d) * kraft
      vy += (ay / d) * kraft
      geprueft++
    }

    g.x += (vx + g.stossX) * dt
    g.y += (vy + g.stossY) * dt
    // Rueckstoss aus Treffern klingt exponentiell ab.
    const daempfung = Math.exp(-9 * dt)
    g.stossX *= daempfung
    g.stossY *= daempfung
    if (g.blitz > 0) g.blitz -= dt
  }
}

/**
 * Waffen ausloesen.
 *
 * Diese Funktion weiss nichts mehr darueber, *wie* eine Waffe wirkt - das
 * steht in `verhalten.ts`. Sie kennt nur den Takt.
 */
function feuereWaffen(s: Spielstand, dt: number): void {
  const sp = s.spieler
  for (let i = 0; i < sp.waffen.length; i++) {
    const w = sp.waffen[i]
    const v = VERHALTEN[w.def.verhalten]

    v.dauernd?.(s, w, dt)
    if (v.feuern === undefined) continue

    w.abkling -= dt
    if (w.abkling > 0) continue

    // Kein Ziel: nicht feuern, aber auch keinen Vorrat aufstauen, der sich
    // spaeter auf einen Schlag entlaedt.
    w.abkling = v.feuern(s, w) ? w.werte.abklingzeit * sp.abklingMult : 0
  }
}

function bewegeGeschosse(s: Spielstand, dt: number): void {
  const geschosse = s.geschosse.aktiv
  const gegner = s.gegner.aktiv

  for (let i = geschosse.length - 1; i >= 0; i--) {
    const p = geschosse[i]

    if (p.zielsuche > 0) lenke(s, p, dt)

    p.x += p.vx * dt
    p.y += p.vy * dt
    p.leben -= dt
    if (p.leben <= 0) {
      // Eine Granate, die niemanden trifft, knallt trotzdem.
      if (p.explosionsRadius > 0) {
        detoniere(s, p.x, p.y, p.explosionsRadius, p.schaden, p.platz, p.farbe, p.nachwurf)
      }
      s.geschosse.freigeben(i)
      continue
    }

    s.gitter.abfragen(p.x, p.y, p.radius + GROESSTER_GEGNER, kandidaten)
    let verbraucht = false

    for (let k = 0; k < kandidaten.length; k++) {
      const g = gegner[kandidaten[k]]
      if (g === undefined || g.tot || p.getroffen.has(g.id)) continue

      const dx = g.x - p.x
      const dy = g.y - p.y
      const reichweite = g.radius + p.radius
      if (dx * dx + dy * dy > reichweite * reichweite) continue

      const laenge = Math.hypot(p.vx, p.vy) || 1
      if (p.explosionsRadius > 0) {
        // Der Knall verteilt den Schaden - das Geschoss selbst richtet
        // nichts aus, sonst zaehlte der Treffer doppelt.
        detoniere(s, p.x, p.y, p.explosionsRadius, p.schaden, p.platz, p.farbe, p.nachwurf)
        verbraucht = true
        break
      }

      verletzeGegner(
        s,
        g,
        p.schaden,
        p.platz,
        p.krit,
        (p.vx / laenge) * p.rueckstoss,
        (p.vy / laenge) * p.rueckstoss,
      )
      p.getroffen.add(g.id)

      if (p.durchschlag > 0) {
        p.durchschlag--
        continue
      }
      // Vollendete Pfeile prallen zum naechsten Gegner weiter, statt zu
      // vergehen. Klappt das nicht, ist das Geschoss verbraucht.
      if (p.prallt && prallWeiter(s, p)) break
      verbraucht = true
      break
    }

    if (verbraucht) s.geschosse.freigeben(i)
  }
}

/** Zielsuche: das Geschoss dreht sich hoechstens `zielsuche` je Sekunde. */
function lenke(s: Spielstand, p: Geschoss, dt: number): void {
  // Ueber eine oertliche Variable, nicht ueber das Feld: TypeScript kann eine
  // veraenderliche Eigenschaft nach der Pruefung nicht als "nicht null"
  // fuehren - jeder Funktionsaufruf koennte sie ja wieder gesetzt haben.
  let ziel = p.ziel

  // Pools recyceln Objekte - die ID beweist, dass es noch dasselbe Ziel ist.
  if (ziel === null || ziel.id !== p.zielId || ziel.tot) {
    ziel = naechsterGegner(s, p.x, p.y, 420)
    p.ziel = ziel
    p.zielId = ziel === null ? -1 : ziel.id
    if (ziel === null) return
  }

  const tempo = Math.hypot(p.vx, p.vy) || 1
  const jetzt = Math.atan2(p.vy, p.vx)
  let ab = Math.atan2(ziel.y - p.y, ziel.x - p.x) - jetzt
  while (ab > Math.PI) ab -= Math.PI * 2
  while (ab < -Math.PI) ab += Math.PI * 2

  const max = p.zielsuche * dt
  const neuWinkel = jetzt + Math.max(-max, Math.min(max, ab))
  p.vx = Math.cos(neuWinkel) * tempo
  p.vy = Math.sin(neuWinkel) * tempo
}

/** Nach einem Treffer auf den naechsten noch nicht getroffenen Gegner umlenken. */
function prallWeiter(s: Spielstand, p: Geschoss): boolean {
  gegnerImUmkreis(s, p.x, p.y, 280, zonenTreffer)
  let bester: Gegner | null = null
  let bestD2 = Infinity

  for (let i = 0; i < zonenTreffer.length; i++) {
    const g = zonenTreffer[i]
    if (p.getroffen.has(g.id)) continue
    const d2 = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y)
    if (d2 < bestD2) {
      bestD2 = d2
      bester = g
    }
  }
  if (bester === null) return false

  const tempo = Math.hypot(p.vx, p.vy) || 1
  const winkel = Math.atan2(bester.y - p.y, bester.x - p.x)
  p.vx = Math.cos(winkel) * tempo
  p.vy = Math.sin(winkel) * tempo
  p.ziel = bester
  p.zielId = bester.id
  return true
}

/**
 * Sog und Truemmerfelder.
 *
 * Laeuft ausserhalb der Geschossschleife und darf deshalb selbst Abfragen
 * starten - mit eigenem Ergebnisarray.
 */
function zonenTick(s: Spielstand, dt: number): void {
  const liste = s.zonen.aktiv

  for (let i = liste.length - 1; i >= 0; i--) {
    const z = liste[i]
    z.leben -= dt

    if (z.leben <= 0) {
      if (z.art === 'sog') platzeSingularitaet(s, z)
      s.zonen.freigeben(i)
      continue
    }

    z.tickRest -= dt
    const taktet = z.tickRest <= 0
    if (taktet) z.tickRest = 0.22

    gegnerImUmkreis(s, z.x, z.y, z.radius, zonenTreffer)
    for (let k = 0; k < zonenTreffer.length; k++) {
      const g = zonenTreffer[k]

      if (z.sogKraft > 0) {
        const dx = z.x - g.x
        const dy = z.y - g.y
        const d = Math.hypot(dx, dy) || 1
        // Naeher am Zentrum zieht es staerker - dadurch entsteht der Klumpen,
        // der die Detonation danach so lohnend macht.
        const zug = z.sogKraft * (1 - Math.min(1, d / z.radius) * 0.4)
        g.stossX += (dx / d) * zug * dt
        g.stossY += (dy / d) * zug * dt
      }

      if (taktet) verletzeGegner(s, g, z.schaden, z.platz, false, 0, 0)
    }
  }
}

/** Das Loch platzt: alles im Umkreis bekommt die volle Ladung. */
function platzeSingularitaet(s: Spielstand, z: Zone): void {
  detoniere(s, z.x, z.y, z.radius, z.schaden * 6, z.platz, z.farbe)
  s.trauma = Math.min(1, s.trauma + 0.35)
  s.blitz = Math.max(s.blitz, 0.45)

  if (!z.truemmer) return
  // Vollendet bleibt ein Truemmerfeld stehen, das weiter Schaden tickt.
  const t = s.zonen.nimm()
  t.art = 'knall'
  t.x = z.x
  t.y = z.y
  t.radius = z.radius * 0.8
  t.maxRadius = t.radius
  t.leben = 4
  t.maxLeben = 4
  t.schaden = z.schaden * 0.5
  t.sogKraft = 0
  t.tickRest = 0
  t.platz = z.platz
  t.farbe = z.farbe
  t.truemmer = false
}

function raeumeTote(s: Spielstand): void {
  const liste = s.gegner.aktiv
  for (let i = liste.length - 1; i >= 0; i--) {
    const g = liste[i]
    if (!g.tot) continue

    legeKristall(s, g.x, g.y, g.xp)
    zerspringen(s, g.x, g.y, g.radius, g.art.farbe)
    s.statistik.kills++
    s.trauma = Math.min(1, s.trauma + 0.012)
    s.gegner.freigeben(i)
  }
}

function spielerKollision(s: Spielstand, dt: number): void {
  const sp = s.spieler
  if (sp.unverwundbar > 0) {
    sp.unverwundbar -= dt
    return
  }

  s.gitter.abfragen(sp.x, sp.y, sp.radius + GROESSTER_GEGNER, kandidaten)
  const liste = s.gegner.aktiv

  for (let k = 0; k < kandidaten.length; k++) {
    const g = liste[kandidaten[k]]
    if (g === undefined || g.tot) continue
    const dx = g.x - sp.x
    const dy = g.y - sp.y
    const reichweite = g.radius + sp.radius
    if (dx * dx + dy * dy > reichweite * reichweite) continue

    verletzeSpieler(sp, g.schaden)
    sp.unverwundbar = UNVERWUNDBAR
    sp.blitz = 1
    s.trauma = Math.min(1, s.trauma + 0.45)
    s.blitz = Math.max(s.blitz, 0.5)
    return
  }
}

function aktualisiereOptik(s: Spielstand, dt: number): void {
  // Optik laeuft in echter Zeit, nicht in Spielzeit: Waehrend der Zeitlupe
  // sollen Partikel weiterlaufen, sonst friert das Bild sichtbar ein.
  const partikel = s.partikel.aktiv
  for (let i = partikel.length - 1; i >= 0; i--) {
    const p = partikel[i]
    p.leben -= dt
    if (p.leben <= 0) {
      s.partikel.freigeben(i)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.drehung += p.drehTempo * dt
    const bremse = Math.exp(-4.5 * dt)
    p.vx *= bremse
    p.vy *= bremse
  }

  const effekte = s.effekte.aktiv
  for (let i = effekte.length - 1; i >= 0; i--) {
    effekte[i].leben -= dt
    if (effekte[i].leben <= 0) s.effekte.freigeben(i)
  }

  const zahlen = s.zahlen.aktiv
  for (let i = zahlen.length - 1; i >= 0; i--) {
    const z = zahlen[i]
    z.leben -= dt
    if (z.leben <= 0) {
      s.zahlen.freigeben(i)
      continue
    }
    z.y += z.vy * dt
    z.vy += 60 * dt
  }

  s.trauma = Math.max(0, s.trauma - dt * 1.5)
  s.blitz = Math.max(0, s.blitz - dt * 4)
  if (s.spieler.blitz > 0) s.spieler.blitz -= dt * 3
}

function folgeKamera(s: Spielstand, dt: number): void {
  // Weich nachziehen statt starr kleben. Eine fest zentrierte Kamera nimmt
  // dem Ausweichen jedes Gefuehl von Tempo.
  const faktor = 1 - Math.exp(-11 * dt)
  s.kamera.x += (s.spieler.x - s.kamera.x) * faktor
  s.kamera.y += (s.spieler.y - s.kamera.y) * faktor
}

// ---------------------------------------------------------------------------
// Levelup
// ---------------------------------------------------------------------------

export function gibXp(s: Spielstand, menge: number): void {
  const sp = s.spieler
  sp.xp += menge
  if (sp.xp < sp.xpNaechste || s.levelWartet > 0) return

  sp.xp -= sp.xpNaechste
  sp.level++
  sp.xpNaechste = xpFuerLevel(sp.level)
  s.statistik.level = sp.level
  s.blitz = Math.max(s.blitz, 0.55)
  s.levelWartet = LEVELUP_RAMPE
}

function oeffneLevelup(s: Spielstand): void {
  s.angebote = zieheAngebote(s, 3)
  s.auswahl = 0
  s.zeitskala = 0
  s.levelWartet = 0
  s.phase = 'levelup'
}

function levelupTick(s: Spielstand, b: Befehle, dt: number): void {
  // Die Optik laeuft weiter, damit das Bild hinter den Karten nicht tot wirkt.
  aktualisiereOptik(s, dt)

  if (s.angebote.length === 0) {
    schliesseLevelup(s)
    return
  }

  if (b.links) s.auswahl = (s.auswahl + s.angebote.length - 1) % s.angebote.length
  if (b.rechts) s.auswahl = (s.auswahl + 1) % s.angebote.length

  let gewaehlt = -1
  if (b.wahl >= 0 && b.wahl < s.angebote.length) gewaehlt = b.wahl
  else if (b.bestaetigen) gewaehlt = s.auswahl
  if (gewaehlt < 0) return

  s.angebote[gewaehlt].anwenden(s)
  schliesseLevelup(s)
}

function schliesseLevelup(s: Spielstand): void {
  s.angebote = []
  s.zeitskala = 1
  s.phase = 'laufend'
  // Kurze Gnadenfrist: Direkt aus dem Menue in einen Treffer zu laufen, ohne
  // reagieren zu koennen, fuehlt sich nach Betrug an.
  s.spieler.unverwundbar = Math.max(s.spieler.unverwundbar, 0.35)
}

// ---------------------------------------------------------------------------
// Fabriken fuer die Pools
// ---------------------------------------------------------------------------
// Die Werte hier sind bedeutungslos - wer ein Objekt aus dem Pool nimmt,
// ueberschreibt jedes Feld.

function leererGegner(): Gegner {
  return {
    id: 0,
    x: 0,
    y: 0,
    hp: 1,
    maxHp: 1,
    art: null as unknown as GegnerArt,
    radius: 8,
    tempo: 0,
    schaden: 0,
    xp: 0,
    masse: 1,
    blitz: 0,
    stossX: 0,
    stossY: 0,
    tot: false,
    risseMaske: 0,
    risse: 0,
    risseZeit: 0,
    zersplittert: false,
  }
}

function leeresGeschoss(): Geschoss {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    schaden: 0,
    radius: 3,
    durchschlag: 0,
    leben: 0,
    rueckstoss: 0,
    krit: false,
    platz: 0,
    farbe: FARBEN.geschoss,
    zielsuche: 0,
    ziel: null,
    zielId: -1,
    explosionsRadius: 0,
    nachwurf: 0,
    prallt: false,
    getroffen: new Set<number>(),
  }
}

function leereZone(): Zone {
  return {
    art: 'sog',
    x: 0,
    y: 0,
    radius: 0,
    maxRadius: 0,
    leben: 0,
    maxLeben: 1,
    schaden: 0,
    sogKraft: 0,
    tickRest: 0,
    platz: 0,
    farbe: FARBEN.text,
    truemmer: false,
  }
}

function leererEffekt(): Effekt {
  return {
    art: 'ring',
    x: 0,
    y: 0,
    x2: 0,
    y2: 0,
    radius: 0,
    winkel: 0,
    spanne: 0,
    leben: 0,
    maxLeben: 1,
    farbe: FARBEN.text,
    breite: 2,
  }
}

function leererKristall(): Kristall {
  return { x: 0, y: 0, vx: 0, vy: 0, wert: 1, leben: 0, gezogen: false }
}

function leeresPartikel(): Partikel {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    leben: 0,
    maxLeben: 1,
    groesse: 2,
    farbe: '#fff',
    drehung: 0,
    drehTempo: 0,
  }
}

function leereZahl(): SchadensZahl {
  return { x: 0, y: 0, vy: 0, leben: 0, wert: 0, krit: false }
}
