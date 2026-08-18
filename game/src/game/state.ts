import { Pool } from '../core/pool'
import { Rng } from '../core/rng'
import { RaumGitter } from '../core/spatialHash'
import { FARBEN } from '../render/palette'
import { berechneSchaden, xpFuerLevel } from './damage'
import { funken, legeZahl, zerspringen } from './effects'
import type { GegnerArt } from './enemies'
import { aktualisiereKristalle, legeKristall } from './pickups'
import { bewegeSpieler, erzeugeSpieler, verletzeSpieler } from './player'
import { entferneVerlorene, spawne, startWelle } from './spawner'
import type { Aufwertung } from './upgrades'
import { zieheAngebote } from './upgrades'
import type { WaffenInstanz } from './weapons'
import { ruesteAus, WAFFEN } from './weapons'

/**
 * Der gesamte Laufzustand in einem Objekt - und die Simulation darauf.
 *
 * Diese Datei kennt keinen Browser: kein `document`, kein `window`, kein
 * Canvas. Das ist keine Stilfrage, sondern zahlt sich dreifach aus - die
 * Logik ist ohne Browser testbar, die Performance laesst sich ohne Zeichnen
 * messen (`npm run perf`), und ein spaeteres Verpacken fuer Steam wird zur
 * Randnotiz statt zum Umbau.
 *
 * Die Import-Richtung ist bewusst sternfoermig: Diese Datei holt sich
 * Funktionen aus den Teilsystemen, die Teilsysteme holen sich von hier nur
 * *Typen*. Dadurch gibt es keine gegenseitigen Importe.
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
  waffen: WaffenInstanz[]
  /** Aufwertungen wirken ausschliesslich ueber diese Werte. */
  schadenMult: number
  abklingMult: number
  tempoMult: number
  geschossTempoMult: number
  zusatzProjektile: number
  zusatzDurchschlag: number
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
  /** IDs bereits getroffener Gegner - sonst trifft ein Durchschuss denselben mehrfach. */
  getroffen: Set<number>
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

export function erzeugeSpielstand(saat: number): Spielstand {
  const spieler = erzeugeSpieler()
  spieler.waffen = [ruesteAus(WAFFEN.splitter)]
  return {
    phase: 'titel',
    zeit: 0,
    saat,
    rng: new Rng(saat),
    rngOptik: new Rng(saat).fork(),
    spieler,
    gegner: new Pool<Gegner>(leererGegner, 512),
    geschosse: new Pool<Geschoss>(leeresGeschoss, 128),
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
    statistik: { kills: 0, level: 1, zeit: 0, schaden: 0 },
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
  s.spieler.waffen = [ruesteAus(WAFFEN.splitter)]
  s.gegner.alleFreigeben()
  s.geschosse.alleFreigeben()
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
  s.statistik = { kills: 0, level: 1, zeit: 0, schaden: 0 }
  s.naechsteId = 1
  startWelle(s)
}

// ---------------------------------------------------------------------------
// Ein Tick
// ---------------------------------------------------------------------------

/** Wiederverwendetes Ergebnisarray fuer Gitterabfragen - vermeidet Muell pro Tick. */
const kandidaten: number[] = []

/**
 * Wie stark sich ueberlappende Gegner auseinanderschieben.
 *
 * Fest und nicht an das eigene Tempo gekoppelt: Vorher hing die Kraft am
 * Lauftempo, wodurch sich ausgerechnet die langsamen, dicken Gegner am
 * schwaechsten trennten - also die, bei denen ein Klumpen am meisten stoert.
 */
const TRENN_KRAFT = 165

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
  spielerKollision(s, sdt)

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

function gitterAufbauen(s: Spielstand): void {
  const gitter = s.gitter
  gitter.leeren()
  const liste = s.gegner.aktiv
  // Der Index in `aktiv` ist der Schluessel. Er gilt nur, solange nichts
  // entfernt wird - deshalb laeuft `raeumeTote` erst nach allen Abfragen.
  for (let i = 0; i < liste.length; i++) gitter.einfuegen(liste[i].x, liste[i].y, i)
}

function bewegeGegner(s: Spielstand, dt: number): void {
  const liste = s.gegner.aktiv
  const px = s.spieler.x
  const py = s.spieler.y

  for (let i = 0; i < liste.length; i++) {
    const g = liste[i]

    const dx = px - g.x
    const dy = py - g.y
    const abstand = Math.hypot(dx, dy) || 1
    let vx = (dx / abstand) * g.tempo
    let vy = (dy / abstand) * g.tempo

    // Auseinanderdruecken. Ohne das laufen alle Gegner exakt uebereinander,
    // und aus tausend Feinden wird optisch einer: Man sieht die Gefahr nicht
    // mehr und trifft mit einem Schuss alles. Kostet Rechenzeit, ist aber der
    // Unterschied zwischen einem Schwarm und einem Klumpen.
    //
    // Reizvoll waere, hier auch die Zahl der *angesehenen* Kandidaten zu
    // deckeln - der Aufwand pro Gegner haenge dann nicht mehr an der Dichte.
    // Gemessen ist das ein klarer Rueckschritt (11,7 statt 4,5 ms pro Tick):
    // Wird die Trennkraft beschnitten, verklumpen die Gegner, und dann
    // liefert *jede* Gitterabfrage - Geschosse, Zielsuche, Spielerkollision -
    // riesige Kandidatenlisten. Das Auseinanderdruecken bezahlt seine eigene
    // Rechenzeit, indem es das Gitter brauchbar haelt. Nicht deckeln.
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

function feuereWaffen(s: Spielstand, dt: number): void {
  const sp = s.spieler
  for (const waffe of sp.waffen) {
    waffe.abkling -= dt
    if (waffe.abkling > 0) continue

    const ziel = naechsterGegner(s, sp.x, sp.y, waffe.def.reichweite)
    if (ziel === null) {
      // Kein Ziel in Reichweite: nicht feuern, aber auch keinen Vorrat
      // aufstauen, der sich spaeter auf einen Schlag entlaedt.
      waffe.abkling = 0
      continue
    }

    waffe.abkling = waffe.def.abklingzeit * sp.abklingMult
    const grundWinkel = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
    const anzahl = waffe.def.anzahl + sp.zusatzProjektile

    for (let i = 0; i < anzahl; i++) {
      // Faecher um die Zielrichtung zentrieren, damit auch gerade Anzahlen
      // symmetrisch liegen.
      const versatz = anzahl === 1 ? 0 : (i - (anzahl - 1) / 2) * waffe.def.streuung
      const winkel = grundWinkel + versatz
      const tempo = waffe.def.geschossTempo * sp.geschossTempoMult
      const treffer = berechneSchaden(
        waffe.def.schaden,
        sp.schadenMult,
        sp.kritChance,
        sp.kritFaktor,
        s.rng,
      )

      const geschoss = s.geschosse.nimm()
      geschoss.x = sp.x
      geschoss.y = sp.y
      geschoss.vx = Math.cos(winkel) * tempo
      geschoss.vy = Math.sin(winkel) * tempo
      geschoss.schaden = treffer.wert
      geschoss.krit = treffer.krit
      geschoss.radius = waffe.def.geschossRadius
      geschoss.durchschlag = waffe.def.durchschlag + sp.zusatzDurchschlag
      geschoss.leben = waffe.def.lebensdauer
      geschoss.rueckstoss = waffe.def.rueckstoss
      geschoss.getroffen.clear()
    }
  }
}

function naechsterGegner(s: Spielstand, x: number, y: number, reichweite: number): Gegner | null {
  s.gitter.abfragen(x, y, reichweite, kandidaten)
  const liste = s.gegner.aktiv
  let bester: Gegner | null = null
  let bestD2 = reichweite * reichweite

  for (let k = 0; k < kandidaten.length; k++) {
    const g = liste[kandidaten[k]]
    if (g === undefined || g.tot) continue
    const dx = g.x - x
    const dy = g.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      bester = g
    }
  }
  return bester
}

/** Der groesste Gegnerradius - so weit muss der Vorfilter greifen. */
const GROESSTER_GEGNER = 22

function bewegeGeschosse(s: Spielstand, dt: number): void {
  const geschosse = s.geschosse.aktiv
  const gegner = s.gegner.aktiv

  for (let i = geschosse.length - 1; i >= 0; i--) {
    const p = geschosse[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.leben -= dt
    if (p.leben <= 0) {
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

      trefferAnGegner(s, g, p)
      p.getroffen.add(g.id)

      if (p.durchschlag <= 0) {
        verbraucht = true
        break
      }
      p.durchschlag--
    }

    if (verbraucht) s.geschosse.freigeben(i)
  }
}

function trefferAnGegner(s: Spielstand, g: Gegner, p: Geschoss): void {
  g.hp -= p.schaden
  g.blitz = 0.09
  s.statistik.schaden += p.schaden

  const laenge = Math.hypot(p.vx, p.vy) || 1
  g.stossX += (p.vx / laenge) * (p.rueckstoss / g.masse)
  g.stossY += (p.vy / laenge) * (p.rueckstoss / g.masse)

  funken(s, p.x, p.y, p.krit ? FARBEN.krit : FARBEN.geschoss)

  if (g.hp <= 0) {
    g.tot = true
    return
  }

  // Schadenszahlen nur fuer kritische Treffer. Bei tausend Gegnern staende
  // sonst eine Zahlenwand vor dem Spiel - und ausgerechnet die eine Zahl, auf
  // die es ankommt, ginge darin unter.
  if (p.krit) legeZahl(s, g.x, g.y - g.radius, p.schaden, true)
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
  s.angebote = zieheAngebote(s.rng, s.stufen, s.spieler, 3)
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

  const aufwertung = s.angebote[gewaehlt]
  aufwertung.anwenden(s.spieler)
  s.stufen.set(aufwertung.id, (s.stufen.get(aufwertung.id) ?? 0) + 1)
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
    getroffen: new Set<number>(),
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
