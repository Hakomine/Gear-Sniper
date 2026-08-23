import { SCHILD_WINKEL } from '../game/gegnerVerhalten'
import { schreinDef, SCHREIN_RADIUS } from '../game/schreine'
import { STOSS_ABKLING } from '../game/player'
import { RISS_SCHWELLE } from '../game/risse'
import type { Effekt, Gegner, Spielstand } from '../game/state'
import { trabantenAnzahl, trabantPunkt } from '../game/verhalten'
import { ZEICHEN } from '../game/zeichen'
import { zeichneAtempause, zeichneLevelup, zeichnePause, zeichneTitel, zeichneTod } from '../ui/menus'
import { zeichneHud } from './hud'
import { gitterBild } from './gitter'
import {
  AUSBRUCH,
  bogen,
  flecken,
  kantenVersatz,
  SCHRAFFUR_AB,
  schraffurMuster,
  schraffurPfad,
  strahlen,
} from './papier'
import { erschuetterung } from './juice'
import { FARBEN, mitAlpha, SCHRIFT } from './palette'
import { zeichnePartikel } from './particles'

/**
 * Die feste Spielfeldgroesse in virtuellen Punkten.
 *
 * Alles zeichnet in diesen Koordinaten, egal wie gross das Fenster ist. Der
 * Zeichner skaliert am Ende genau einmal. Dadurch sieht jeder Spieler
 * denselben Weltausschnitt - ohne das haette ein breiter Monitor mehr
 * Vorwarnzeit und damit einen echten Spielvorteil.
 */
export const VIRT_B = 1280
export const VIRT_H = 720

/**
 * Wie nah die Kamera an der Welt steht.
 *
 * Nur die Welt wird vergroessert, die Anzeige nicht - deshalb ein eigener
 * Faktor statt einer kleineren Spielfeldgroesse: Menuekarten, Schrift und
 * Balken behalten ihre Masse.
 *
 * Der erste Stand hatte keinen Zoom, und die Screenshots zeigten sofort, was
 * daran falsch ist: Gegner mit 9 Punkten Radius auf 1280 Punkten Breite sind
 * Fliegendreck, und der Spawnring lag so weit draussen, dass die ersten
 * Gegner zehn Sekunden brauchten, um ueberhaupt anzukommen. Naeher heran
 * loest beides auf einmal.
 */
export const WELT_ZOOM = 1.35

/** Halbe Diagonale des sichtbaren Weltausschnitts - vom Spieler bis in die Ecke. */
export const SICHT_RADIUS = Math.hypot(VIRT_B, VIRT_H) / 2 / WELT_ZOOM

// Drehung der Dreiecksflanken um 140 Grad - einmal ausgerechnet.
const FLANKE_COS = Math.cos((140 * Math.PI) / 180)
const FLANKE_SIN = Math.sin((140 * Math.PI) / 180)

/** Wiederverwendete Eimer, um Gegner nach Art gebuendelt zu zeichnen. */
const gegnerEimer = new Map<string, number[]>()
const blitzende: number[] = []

export class Zeichner {
  /** Faktor von virtuellen Punkten auf echte Bildpunkte. */
  private pixelSkala = 1

  /**
   * Wann das letzte Bild gezeichnet wurde.
   *
   * Das Federnetz laeuft in *echter* Zeit, nicht in Spielzeit - genau wie die
   * Partikel in `aktualisiereOptik`. Sonst stuende der Boden waehrend eines
   * Hitstops still, und ausgerechnet die Welle, die der Schlag ausgeloest hat,
   * bliebe eingefroren.
   */
  private letzteZeit = performance.now()

  /**
   * Wie lange das letzte Bild zum Zeichnen gebraucht hat, in Millisekunden.
   *
   * `npm run perf` misst ausschliesslich den *Tick* - es laeuft ohne Browser,
   * genau das ist sein Zweck. Die Glut-Schicht und das Federnetz sind aber
   * Zeichenkosten und waeren dort unsichtbar: Sie koennten still acht
   * Millisekunden je Bild verschlingen, und es fiele erst beim Spielen auf.
   *
   * Zwei Zeitnahmen je Bild sind dafuer ein sehr kleiner Preis, und der
   * Browser-Test liest den Wert aus - siehe `test/smoke.spec.ts`.
   */
  bildZeit = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
  ) {}

  /**
   * Groesse an das Fenster anpassen - 16:9 mit schwarzen Balken.
   *
   * Das feste Seitenverhaeltnis jetzt festzulegen kostet nichts und erspart
   * spaeter die Baustelle, das Spiel auf Ultrawide und Steam Deck getrennt
   * zurechtzuruecken.
   */
  passeAn(): void {
    // Auf 2 gedeckelt: Darueber kostet jeder Bildpunkt Leistung, ohne dass
    // ein Mensch den Unterschied sieht.
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const skala = Math.min(window.innerWidth / VIRT_B, window.innerHeight / VIRT_H)
    const cssB = Math.floor(VIRT_B * skala)
    const cssH = Math.floor(VIRT_H * skala)

    this.canvas.style.width = `${cssB}px`
    this.canvas.style.height = `${cssH}px`
    this.canvas.width = Math.floor(cssB * dpr)
    this.canvas.height = Math.floor(cssH * dpr)
    this.pixelSkala = this.canvas.width / VIRT_B
  }

  /**
   * Ein Bild.
   *
   * `alpha` waere der Zwischenwert zwischen zwei Logikschritten. Fuer den
   * Prototyp wird nicht interpoliert: Bei 60 Hz Logik und 60 Hz Bild gaebe es
   * nichts zu gewinnen. Auf einem 144-Hz-Monitor ist eine leichte Unruhe
   * sichtbar - das ist der bekannte Preis und der erste Kandidat fuer eine
   * Politur-Runde.
   */
  zeichne(s: Spielstand, _alpha: number): void {
    const begonnen = performance.now()
    const ctx = this.ctx
    ctx.setTransform(this.pixelSkala, 0, 0, this.pixelSkala, 0, 0)

    const jetzt = performance.now()
    const echtDt = Math.min(0.05, (jetzt - this.letzteZeit) / 1000)
    this.letzteZeit = jetzt

    bogen(ctx, VIRT_B, VIRT_H)

    // --- Welt ------------------------------------------------------------
    ctx.save()
    const stoss = erschuetterung(s.trauma, performance.now() / 1000)
    ctx.translate(VIRT_B / 2 + stoss.x, VIRT_H / 2 + stoss.y)
    ctx.rotate(stoss.winkel)
    /*
     * Der Zoomstoss - ein Atemzug bei den grossen Momenten.
     *
     * Bewusst winzig: Ein paar Prozent liest das Auge als Wucht, alles
     * darueber als Ruckeln. Er sitzt in der Kameramatrix und nicht im
     * Weltzoom, damit die Anzeige davon unberuehrt bleibt - eine mitzoomende
     * Uhr waere sofort als Fehler zu erkennen.
     */
    const zoom = WELT_ZOOM * (1 + s.zoomStoss)
    ctx.scale(zoom, zoom)
    ctx.translate(-s.kamera.x, -s.kamera.y)

    // Reihenfolge ist Lesbarkeit: Zonen liegen als Untergrund unter allem,
    // Bruchlinien direkt auf den Gegnern, Effekte ueber dem Getuemmel, der
    // Spieler zuletzt - er darf nie verdeckt sein.
    gitterBild(ctx, s, echtDt)
    flecken(ctx, s.kamera.x, s.kamera.y)
    // Schreine liegen wie Zonen im Untergrund: Sie sind Gelaende, kein Gegner.
    zeichneSchreine(ctx, s)
    zeichneZonen(ctx, s)
    zeichneKristalle(ctx, s)
    zeichneGegner(ctx, s)
    zeichneBosse(ctx, s)
    zeichneBruchlinien(ctx, s)
    zeichneTrabanten(ctx, s)
    zeichneGeschosse(ctx, s)
    zeichneFeindSchuesse(ctx, s)
    zeichneEffekte(ctx, s)
    zeichnePartikel(ctx, s)
    zeichneSpieler(ctx, s)
    zeichneZahlen(ctx, s)

    ctx.restore()

    // --- Bildschirm -------------------------------------------------------
    zeichneVignette(ctx, s)

    if (s.blitz > 0) zeichneRandPuls(ctx, s.blitz)

    // Im Tod kein HUD: Uhr, Lebensbalken und Waffenleiste stehen sonst quer
    // durch die Auswertung, und der Lauf ist ohnehin vorbei.
    if (s.phase !== 'titel' && s.phase !== 'tot' && s.phase !== 'atempause') {
      if (!s.blind) zeichneSchreinZeiger(ctx, s, VIRT_B, VIRT_H)
      zeichneHud(ctx, s, VIRT_B, VIRT_H)
    }
    if (s.phase === 'titel') zeichneTitel(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'levelup') zeichneLevelup(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'pause') zeichnePause(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'atempause') zeichneAtempause(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'tot') zeichneTod(ctx, s, VIRT_B, VIRT_H)

    this.bildZeit = performance.now() - begonnen
  }
}

/**
 * Schreine auf dem Feld.
 *
 * Sie sind der einzige Grund, irgendwohin zu *wollen* statt nur wegzulaufen -
 * also muessen sie auch von weitem als Angebot lesbar sein. Ein Ring am Boden,
 * die Farbe der Art, und beim Amboss ein Bogen, der sich beim Stehen fuellt
 * und beim Weitergehen sichtbar zurueckfaellt.
 */
function zeichneSchreine(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.schreine.aktiv
  for (let i = 0; i < liste.length; i++) {
    const sch = liste[i]
    const def = schreinDef(sch.art)
    const r = 26

    if (sch.benutzt) {
      // Ruine: bleibt stehen, damit niemand denselben Schrein zweimal anlaeuft.
      ctx.beginPath()
      ctx.arc(sch.x, sch.y, r * 0.7, 0, Math.PI * 2)
      ctx.strokeStyle = mitAlpha(FARBEN.textSchwach, 0.22)
      ctx.lineWidth = 2
      ctx.stroke()
      continue
    }

    const puls = 0.5 + 0.5 * Math.sin(performance.now() / 420 + i)

    // Der Wirkbereich - so weit muss man heran.
    ctx.beginPath()
    ctx.arc(sch.x, sch.y, SCHREIN_RADIUS, 0, Math.PI * 2)
    ctx.strokeStyle = mitAlpha(def.farbe, 0.13 + puls * 0.08)
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Der Koerper: eine stehende Scherbe, mit Schatten wie alles, was auf dem
    // Feld steht.
    ctx.save()
    ctx.translate(0, 5)
    ctx.beginPath()
    ctx.moveTo(sch.x, sch.y - r)
    ctx.lineTo(sch.x + r * 0.62, sch.y - r * 0.1)
    ctx.lineTo(sch.x + r * 0.3, sch.y + r * 0.8)
    ctx.lineTo(sch.x - r * 0.34, sch.y + r * 0.8)
    ctx.lineTo(sch.x - r * 0.62, sch.y - r * 0.16)
    ctx.closePath()
    ctx.fillStyle = FARBEN.schatten
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(sch.x, sch.y - r)
    ctx.lineTo(sch.x + r * 0.62, sch.y - r * 0.1)
    ctx.lineTo(sch.x + r * 0.3, sch.y + r * 0.8)
    ctx.lineTo(sch.x - r * 0.34, sch.y + r * 0.8)
    ctx.lineTo(sch.x - r * 0.62, sch.y - r * 0.16)
    ctx.closePath()
    ctx.fillStyle = def.farbe
    ctx.fill()
    ctx.lineJoin = 'round'
    ctx.strokeStyle = FARBEN.kontur
    ctx.lineWidth = 3
    ctx.stroke()

    if (sch.art === 'amboss' && sch.ladung > 0) {
      ctx.beginPath()
      ctx.arc(sch.x, sch.y, r + 10, -Math.PI / 2, -Math.PI / 2 + sch.ladung * Math.PI * 2)
      ctx.strokeStyle = def.farbe
      ctx.lineWidth = 4
      ctx.stroke()
    }
  }
}

/**
 * Pfeile am Bildrand fuer Schreine ausserhalb des Bildes.
 *
 * Ohne sie findet man einen Schrein nur zufaellig, und dann ist er kein
 * Angebot mehr, sondern eine Ueberraschung. Gezeichnet wird in
 * Bildschirmkoordinaten, deshalb steht das hier ausserhalb der Kameratransform.
 */
function zeichneSchreinZeiger(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  const liste = s.schreine.aktiv
  const rand = 46

  for (let i = 0; i < liste.length; i++) {
    const sch = liste[i]
    if (sch.benutzt) continue
    const dx = sch.x - s.kamera.x
    const dy = sch.y - s.kamera.y
    const sx = breite / 2 + dx * WELT_ZOOM
    const sy = hoehe / 2 + dy * WELT_ZOOM
    if (sx > rand && sx < breite - rand && sy > rand && sy < hoehe - rand) continue

    const winkel = Math.atan2(dy, dx)
    const px = Math.max(rand, Math.min(breite - rand, sx))
    const py = Math.max(rand, Math.min(hoehe - rand, sy))
    const def = schreinDef(sch.art)

    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(winkel)
    ctx.beginPath()
    ctx.moveTo(11, 0)
    ctx.lineTo(-8, 8)
    ctx.lineTo(-4, 0)
    ctx.lineTo(-8, -8)
    ctx.closePath()
    ctx.fillStyle = mitAlpha(def.farbe, 0.85)
    ctx.fill()
    ctx.restore()
  }
}


/**
 * Der Rand des Bogens und der Etappenstich.
 *
 * Vorher lief hier ein schwarzer Radialverlauf ueber die Raender. Auf Papier
 * ist das schlicht falsch: Ein Druck wird zum Rand hin nicht dunkler, er wird
 * hoechstens fleckiger, weil die Presse dort ungleichmaessiger aufliegt. Aus
 * der Vignette wird deshalb ein sehr schwacher Andruck in Papierfarbe - er
 * gibt dem Bild eine Mitte, ohne dass jemand ihn als Effekt wahrnimmt.
 *
 * Der Etappenstich bleibt, wechselt aber die Rechenart: Ein additiver Auftrag
 * macht helles Papier nur noch heller und waescht es aus. Eine *Lasur* -
 * Farbe, die das Papier abdunkelt statt es zu ueberstrahlen - ist das, was
 * eine zweite Walze wirklich tut.
 */
let randAndruck: CanvasGradient | null = null

function zeichneVignette(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  if (randAndruck === null) {
    const v = ctx.createRadialGradient(
      VIRT_B / 2,
      VIRT_H / 2,
      Math.min(VIRT_B, VIRT_H) * 0.38,
      VIRT_B / 2,
      VIRT_H / 2,
      Math.hypot(VIRT_B, VIRT_H) / 2,
    )
    v.addColorStop(0, mitAlpha(FARBEN.grundTief, 0))
    v.addColorStop(1, mitAlpha(FARBEN.grundTief, 0.75))
    randAndruck = v
  }
  ctx.fillStyle = randAndruck
  ctx.fillRect(0, 0, VIRT_B, VIRT_H)

  const stich = etappenStich(s.etappe, s.zerruettung)
  if (stich === null) return
  ctx.save()
  // `multiply` statt `lighter`: So legt sich die Farbe auf das Papier, statt
  // es wegzustrahlen.
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = stich
  ctx.fillRect(0, 0, VIRT_B, VIRT_H)
  ctx.restore()
}

/**
 * Der Bildblitz als Rand-Puls.
 *
 * Vorher war Wucht ein weisses Vollbild-Rechteck bei 28 Prozent Deckkraft -
 * die roheste Darstellung, die es gibt. Sie ueberdeckt das Getuemmel genau in
 * dem Moment, in dem man es am dringendsten sehen will.
 *
 * Ein Puls, der von den Raendern nach innen laeuft, sagt dasselbe, ohne die
 * Mitte zuzukleistern. Auf Papier laeuft er in **Tinte** statt in Weiss: Ein
 * heller Puls auf hellem Grund waere unsichtbar, und ein Schlag, den man nicht
 * sieht, ist keiner.
 */
let pulsVerlauf: CanvasGradient | null = null

function zeichneRandPuls(ctx: CanvasRenderingContext2D, staerke: number): void {
  if (pulsVerlauf === null) {
    const v = ctx.createRadialGradient(
      VIRT_B / 2,
      VIRT_H / 2,
      Math.min(VIRT_B, VIRT_H) * 0.24,
      VIRT_B / 2,
      VIRT_H / 2,
      Math.hypot(VIRT_B, VIRT_H) / 2,
    )
    v.addColorStop(0, mitAlpha(FARBEN.kontur, 0))
    v.addColorStop(0.6, mitAlpha(FARBEN.kontur, 0.18))
    v.addColorStop(1, mitAlpha(FARBEN.kontur, 0.85))
    pulsVerlauf = v
  }
  ctx.save()
  ctx.globalAlpha = Math.min(1, staerke * 0.6)
  ctx.fillStyle = pulsVerlauf
  ctx.fillRect(0, 0, VIRT_B, VIRT_H)
  ctx.restore()
}

/**
 * Ein sehr blasser Farbstich je Etappe.
 *
 * Er ist bewusst kaum wahrnehmbar - man soll nicht denken "jetzt ist es
 * gruen", sondern nur merken, dass sich etwas veraendert hat, wenn eine neue
 * Etappe anfaengt. Unter Zerruettung wird er kraeftiger: Die Schleife soll
 * sich anders anfuehlen, nicht nur anders rechnen.
 */
/*
 * Vier Papiertoene, keine Leuchtfarben.
 *
 * Als Lasur aufgetragen faerbt jeder davon den Bogen ein wenig um - so, wie
 * verschiedene Papiersorten aussehen. Gesaettigte Toene waeren hier falsch:
 * Sie wuerden mit den beiden Druckfarben konkurrieren, und deren ganze
 * Wirkung haengt daran, dass sie die einzigen sind.
 */
const STICHE = ['rgba(150,170,200,', 'rgba(210,170,130,', 'rgba(180,160,200,', 'rgba(160,195,175,']

function etappenStich(etappe: number, zerruettung: number): string | null {
  // Deutlich kraeftiger als der additive Stich zuvor: Eine Lasur bei einem
  // Prozent sieht niemand, weil sie das Papier nur um einen Hauch abdunkelt.
  const staerke = 0.1 + Math.min(0.22, zerruettung * 0.07)
  return STICHE[(etappe - 1) % STICHE.length] + staerke.toFixed(3) + ')'
}

/**
 * Gegner - nach Art gebuendelt.
 *
 * Bei bis zu 1400 Gegnern ist nicht das Fuellen teuer, sondern der Wechsel
 * der Farbe. Ein Pfad pro Art heisst drei Farbwechsel statt 1400.
 */
/** Wer gerade einen Schildbogen braucht - wiederverwendet, kein Muell je Bild. */
const schildTraeger: number[] = []

/**
 * Ein Eimer je Zeichen, damit auch die Ringe artweise gezeichnet werden.
 *
 * Fuenf Pfadaufbauten fuer das ganze Feld statt einer je gezeichnetem Gegner -
 * dieselbe Rechnung wie bei den Koerpern selbst.
 */
const zeichenEimer: number[][] = ZEICHEN.map(() => [])

function zeichneGegner(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  for (const liste of gegnerEimer.values()) liste.length = 0
  for (const liste of zeichenEimer) liste.length = 0
  blitzende.length = 0
  schildTraeger.length = 0

  /*
   * Was nicht im Bild steht, wird nicht gezeichnet.
   *
   * Der groesste Fund der Bildzeitmessung. `entferneVerlorene` haelt Gegner bis
   * zum 2,4-fachen Sichtradius am Leben - im vollen Feld steht damit ein guter
   * Teil der 1400 weit ausserhalb des Bildschirms und wurde trotzdem in jeden
   * Pfad aufgenommen: Fuellung, Kontur, Kern. Drei Pfadaufbauten fuer etwas,
   * das niemand sieht.
   *
   * Zwei Vergleiche je Gegner ersetzen das. Der Rand ist grosszuegig, weil die
   * Erschuetterung das Bild verschiebt und der Zoomstoss es weitet - ein Gegner
   * darf niemals am Rand aufploppen.
   */
  const halbB = VIRT_B / 2 / WELT_ZOOM + SICHT_RAND
  const halbH = VIRT_H / 2 / WELT_ZOOM + SICHT_RAND

  const gegner = s.gegner.aktiv
  for (let i = 0; i < gegner.length; i++) {
    const g = gegner[i]
    if (Math.abs(g.x - s.kamera.x) > halbB || Math.abs(g.y - s.kamera.y) > halbH) continue

    const id = g.art.id
    let liste = gegnerEimer.get(id)
    if (liste === undefined) {
      liste = []
      gegnerEimer.set(id, liste)
    }
    liste.push(i)
    if (g.blitz > 0) blitzende.push(i)
    if (g.art.verhalten === 'schild') schildTraeger.push(i)
    if (g.zeichen >= 0) zeichenEimer[g.zeichen].push(i)
  }

  const drehung = s.zeit * 0.7
  const px = s.spieler.x
  const py = s.spieler.y

  zeichneSchildBoegen(ctx, s, schildTraeger)

  // Ueber die Eimer laufen, nicht ueber die feste Artenliste: Bosse bringen
  // eigene Arten mit, die dort nicht stehen - mit der alten Schleife waeren
  // sie unsichtbar gewesen.
  /*
   * Drei Durchgaenge je Gegnerart: Fuellung, Kontur, leuchtender Kern.
   *
   * Der Schlagschatten ist weggefallen, und das aus zwei Gruenden, die
   * zufaellig zusammenfielen. Auf dem hellen Feld gab er jedem Koerper eine
   * Standflaeche; auf dem Nachtfeld ist ein Schatten in `rgba(2,3,8,0.55)`
   * schlicht unsichtbar - nichts wirft bei Nacht einen Schatten auf Schwarz.
   * Und gemessen kostete er einen vollen Pfadaufbau ueber 1300 Gegner, also
   * rund drei Millisekunden je Bild. Der Kern hat seinen Platz eingenommen:
   * dieselben Kosten, aber er sagt etwas.
   *
   * Drei Striche je *Art*, nicht je Gegner: Der Pfad wird einmal fuer die
   * ganze Art aufgebaut und mehrfach benutzt.
   */
  for (const [, liste] of gegnerEimer) {
    if (liste.length === 0) continue

    /*
     * Ein Pfad, zwei Verwendungen: erst gefuellt, dann umrandet.
     *
     * Der naheliegende Umbau waere, die Kontur als groessere Fuellung darunter
     * zu zeichnen statt als Strich - `stroke()` ueber runde Ecken gilt als
     * teuer. Gemessen war es das Gegenteil: Der zweite Pfadaufbau ueber 1300
     * Formen kostete mehr als der Strich, den er einsparen sollte (15,3 statt
     * 12,2 Millisekunden je Bild). Ein Pfad, zwei Aufrufe darauf bleibt der
     * guenstigste Weg zu Fuellung und Kante.
     */
    ctx.beginPath()
    for (let k = 0; k < liste.length; k++) {
      formPfad(ctx, gegner[liste[k]], px, py, drehung)
    }
    ctx.fillStyle = gegner[liste[0]].art.farbe
    ctx.fill()
    trennKante(ctx)

    /*
     * Dritter Durchgang: Schraffur - so schattiert ein Druck.
     *
     * Bis Runde 6 sass hier ein hellerer *Kern* in derselben Form: Beleuchtung
     * von innen. Im Hochdruck gibt es keine. Die Walze traegt Farbe auf oder
     * sie traegt keine auf; wer dunkler will, schneidet enger. Aus dem Kern
     * werden deshalb parallele Schnitte, und der Strichabstand macht die
     * Helligkeit.
     *
     * Nur fuer Grosses. Zwei Striche in einem Splitter von neun Punkten
     * Radius waeren kein Schnitt, sondern Dreck - und tausend Dreckflecken
     * sind wieder der Teppich, den die Konturen seit Runde 5 verhindern.
     * Kleines bleibt massive Tinte, genau wie im echten Linolschnitt.
     *
     * Der Farbton lebt hier - und nur hier: Der Kitt ist zinnoberrot, weil man
     * ihn zuerst wegmachen muss, der Speier ebenso, weil man zu ihm hin muss.
     * Der Rest schraffiert in Papierfarbe, was schlicht heisst: weniger Tinte.
     */
    if (gegner[liste[0]].art.auge) zeichneAugen(ctx, gegner, liste, px, py)

    if (gegner[liste[0]].radius >= SCHRAFFUR_AB) {
      /*
       * Der Winkel steht fest, er dreht nicht mit.
       *
       * Zuerst lief er mit `drehung` mit, und das war falsch: Ein Schnitt im
       * Linoleum bleibt, wo er ist. Mitdrehende Schraffur liest sich als
       * Kritzelei, feststehende als Material - und weil der Winkel aus dem
       * Namen der Art kommt, hat jede Gegnerart ihre eigene Schnittrichtung.
       */
      const winkel = schnittWinkel(gegner[liste[0]].art.form)
      ctx.beginPath()
      for (let k = 0; k < liste.length; k++) {
        const g = gegner[liste[k]]
        // Deutlich innerhalb der Silhouette: Die Striche folgen einer
        // Kreissehne, die Form ist aber ein Sechseck oder ein Kreuz. Bei
        // vollem Radius liefen sie oben und unten aus dem Koerper heraus.
        schraffurPfad(ctx, g.x, g.y, g.radius * 0.6, winkel, g.radius / 3.4, g.id)
      }
      ctx.lineWidth = 1.3
      ctx.lineCap = 'butt'
      ctx.strokeStyle = mitAlpha(gegner[liste[0]].art.kern, 0.85)
      ctx.stroke()
    }
  }

  zeichneZeichenRinge(ctx, s, drehung)
  zeichneSchalen(ctx, s, drehung)

  // Der Trefferblitz *ueberlagert* die Farbe, er ersetzt sie nicht.
  //
  // Zuerst kamen frisch getroffene Gegner in einen eigenen weissen Durchgang.
  // Mit einer Waffe ging das gut; mit fuenf gleichzeitig feuernden war
  // praktisch jeder Gegner dauernd im Blitz, und der Screenshot zeigte ein
  // graues Feld statt der Formsprache aus Farbe und Umriss. Als Ueberlagerung
  // mit abklingender Deckkraft bleibt beides: der Treffer *und* die Identitaet
  // des Gegners. Die Deckkraft ist bewusst niedrig: Bei fuenf Waffen wird ein
  // Gegner praktisch ununterbrochen getroffen, und alles ueber einem Drittel
  // faerbt das ganze Feld cremeweiss.
  if (blitzende.length === 0) return
  ctx.beginPath()
  for (let k = 0; k < blitzende.length; k++) {
    formPfad(ctx, gegner[blitzende[k]], px, py, drehung)
  }
  ctx.fillStyle = mitAlpha('#ffffff', 0.45)
  ctx.fill()
}

/**
 * Die Schalen des Kerns.
 *
 * Drei Ringe um den Koerper, einer je verbliebener Schale, und einer davon
 * bricht mit jedem Viertel. Damit sagt der Gegner selbst, wie weit der Kampf
 * ist - man muss nicht auf die Leiste schauen, um zu sehen, dass gerade etwas
 * passiert ist.
 *
 * Waehrend des Gnadenfensters blinkt er hell: Es ist der einzige Moment im
 * Spiel, in dem Schaden gar nichts bewirkt, und das muss sichtbar sein - sonst
 * sieht es aus, als seien die eigenen Waffen kaputt.
 */
function zeichneSchalen(ctx: CanvasRenderingContext2D, s: Spielstand, drehung: number): void {
  const gegner = s.gegner.aktiv
  for (let i = 0; i < gegner.length; i++) {
    const g = gegner[i]
    const z = g.bossZustand
    if (z === null || (z.art.schalen ?? 0) === 0) continue

    for (let k = 0; k < z.schale; k++) {
      const r = g.radius * (1.25 + k * 0.22)
      ctx.beginPath()
      // Leicht gegenlaeufig gedreht, damit die Schalen als getrennte Koerper
      // lesbar bleiben statt als ein dicker Rand.
      const versatz = drehung * (k % 2 === 0 ? 0.5 : -0.5)
      for (let e = 0; e <= 6; e++) {
        const w = versatz + (e / 6) * Math.PI * 2
        const px2 = g.x + Math.cos(w) * r
        const py2 = g.y + Math.sin(w) * r
        if (e === 0) ctx.moveTo(px2, py2)
        else ctx.lineTo(px2, py2)
      }
      ctx.lineWidth = 7
      ctx.strokeStyle = FARBEN.kontur
      ctx.stroke()
      ctx.lineWidth = 3.5
      ctx.strokeStyle = z.art.farbe
      ctx.stroke()

      // Jede stehende Schale strahlt. Wer sie bricht, sieht den Kern kahler
      // werden - der Kampffortschritt steht damit am Gegner selbst.
      //
      // Im Druck gibt es kein Leuchten, also strahlt er so, wie ein
      // Holzschnitt strahlt: mit Schnitten nach aussen. Der Griff ist so alt
      // wie die Technik und wird ohne Erklaerung verstanden.
      strahlen(ctx, g.x, g.y, r + 4, r + 22, 10, z.art.farbe, drehung * 0.3, 0.55)
    }

    if (z.unverwundbar > 0) {
      // Zurueckhaltend: Bei einem Koerper von 88 Punkten Radius wird aus einer
      // kraeftigen weissen Fuellung ein grauer Klecks, der die Form
      // verschluckt. Ein blasses Aufleuchten sagt dasselbe und laesst den Kern
      // Kern bleiben.
      ctx.beginPath()
      ctx.arc(g.x, g.y, g.radius * 1.1, 0, Math.PI * 2)
      ctx.fillStyle = mitAlpha('#ffffff', 0.14 + Math.abs(Math.sin(drehung * 12)) * 0.14)
      ctx.fill()
    }

    // Der Kittring: Solange er offen steht, sammelt der Kern seine Risse ein.
    if (z.kittGemeldet) {
      ctx.beginPath()
      ctx.arc(g.x, g.y, g.radius * (1.1 + z.kittRest), 0, Math.PI * 2)
      ctx.lineWidth = 4
      ctx.strokeStyle = mitAlpha('#63d4ff', 0.85)
      ctx.stroke()
    }
  }
}

/**
 * Der Ring um einen gezeichneten Gegner.
 *
 * Zwei Ringe statt einem: ein dunkler darunter, damit der helle sich auch vor
 * einem hellen Koerper abhebt - dieselbe Konturregel wie ueberall. Der aeussere
 * pulsiert, weil ein starrer Kreis wie ein Aufkleber wirkt und weil das Auge
 * Bewegung im Pulk schneller findet als Farbe.
 *
 * Bewusst *ausserhalb* des Koerpers und nicht als zweite Fuellung: Die Farbe
 * eines Gegners sagt, was er ist, und die darf ein Zeichen nicht ueberschreiben
 * - sonst waeren neun Arten mal fuenf Zeichen wieder fuenf Arten.
 */
function zeichneZeichenRinge(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  drehung: number,
): void {
  if (s.gezeichnet === 0) return
  const gegner = s.gegner.aktiv
  const puls = 1 + Math.sin(drehung * 2.4) * 0.06

  for (let z = 0; z < zeichenEimer.length; z++) {
    const liste = zeichenEimer[z]
    if (liste.length === 0) continue

    ctx.beginPath()
    for (let k = 0; k < liste.length; k++) {
      const g = gegner[liste[k]]
      if (g === undefined) continue
      ctx.moveTo(g.x + g.radius * 1.6 * puls, g.y)
      ctx.arc(g.x, g.y, g.radius * 1.6 * puls, 0, Math.PI * 2)
    }
    ctx.lineWidth = 5
    ctx.strokeStyle = FARBEN.kontur
    ctx.stroke()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = ZEICHEN[z].farbe
    ctx.stroke()

  }
}

/**
 * Der Bogen vor dem Schildtraeger.
 *
 * Ohne ihn ist "von vorn prallt fast alles ab" eine unsichtbare Regel, und der
 * Spieler lernt nur, dass dieser Gegner zaeh ist - nicht, dass er umlaufen
 * werden will. Der Bogen deckt genau den Winkel ab, den `SCHILD_WINKEL` in
 * `gegnerVerhalten.ts` abwehrt: Was man sieht, ist die Regel.
 *
 * Wird *vor* den Koerpern gezeichnet, damit die Form obenauf liegt und der
 * Bogen wie ein davorgehaltenes Stueck Glas wirkt.
 */
function zeichneSchildBoegen(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  liste: readonly number[],
): void {
  if (liste.length === 0) return
  const gegner = s.gegner.aktiv

  ctx.beginPath()
  for (let k = 0; k < liste.length; k++) {
    const g = gegner[liste[k]]
    if (g === undefined) continue
    ctx.moveTo(
      g.x + Math.cos(g.blick - SCHILD_WINKEL) * g.radius * 1.5,
      g.y + Math.sin(g.blick - SCHILD_WINKEL) * g.radius * 1.5,
    )
    ctx.arc(g.x, g.y, g.radius * 1.5, g.blick - SCHILD_WINKEL, g.blick + SCHILD_WINKEL)
  }
  ctx.lineWidth = 5
  ctx.strokeStyle = mitAlpha('#dfe8ff', 0.75)
  ctx.stroke()
}

/**
 * Dunkle Linie um jede Form.
 *
 * Im dichten Getuemmel verschmolzen gleichfarbige Gegner zu einer einzigen
 * orangen Flaeche - man sah eine Masse, keine Gegner. Eine Kante in der
 * Hintergrundfarbe schneidet jede Form frei, und aus dem Teppich wird wieder
 * ein Schwarm aus einzelnen Koerpern.
 *
 * Kostet nichts: Der Pfad ist ohnehin schon aufgebaut, das hier ist ein
 * zweiter Strich darauf - ein Aufruf fuer alle Gegner einer Art.
 */
function trennKante(ctx: CanvasRenderingContext2D): void {
  // Eigene Konturfarbe, nicht die Grundfarbe: Seit das Spielfeld heller ist
  // als die Figuren, waere eine Kante in Grundfarbe unsichtbar. Sie ist jetzt
  // dunkler als alles andere und traegt die ganze Lesbarkeit.
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()
}

/**
 * Wie weit ueber den Bildrand hinaus noch gezeichnet wird.
 *
 * Grosszuegig bemessen: Die Erschuetterung verschiebt das Bild um bis zu 16
 * Punkte, der Zoomstoss weitet es, und der groesste Boss hat 88 Punkte Radius.
 * Ein Gegner, der am Rand aufploppt, waere schlimmer als die paar Pfade, die
 * der Rand kostet.
 */
const SICHT_RAND = 170

/**
 * Das Auge - was aus einer Form eine Kreatur macht.
 *
 * Bis hierher war Scherbenfeld eine Simulation von Vielecken. Man weicht
 * Dreiecken aus, man zerbricht Sechsecke, und nichts davon *lebt*. Jedes
 * Spiel, mit dem dieses hier verglichen wird, hat an dieser Stelle etwas:
 * Isaac hat Gesichter, Downwell hat Augen, Brotato hat eine Kartoffel.
 *
 * Es kostet zwei Kreise, und es aendert alles:
 *
 * - Die Pupille **folgt dem Spieler**. Ein Gegner, der einen ansieht, waehrend
 *   er naeher kommt, ist etwas anderes als ein Gegner, der auf einen zufaehrt.
 * - Beim Treffer **kneift er zu**: Das Lid faehrt herunter, solange `blitz`
 *   laeuft. Damit hat der haeufigste Moment des Spiels eine Reaktion am
 *   Gegner selbst, nicht nur eine Zahl daneben.
 * - Traegt er **Risse**, springt die Pupille. Die Kernregel steht damit auch
 *   im Gesicht - und ein Gegner kurz vor der Zersplitterung sieht aus wie
 *   einer kurz vor der Zersplitterung.
 *
 * Wie alles andere artweise gebuendelt: drei Pfade fuer alle Traeger einer
 * Art statt drei je Gegner.
 */
function zeichneAugen(
  ctx: CanvasRenderingContext2D,
  gegner: readonly Gegner[],
  liste: readonly number[],
  px: number,
  py: number,
): void {
  // Das Weisse.
  ctx.beginPath()
  for (let k = 0; k < liste.length; k++) {
    const g = gegner[liste[k]]
    const r = g.radius * 0.42
    ctx.moveTo(g.x + r, g.y)
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2)
  }
  ctx.fillStyle = FARBEN.grund
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()

  // Die Pupille, dorthin gerueckt, wo der Spieler steht. Sie wandert nur ein
  // Stueck: Eine Pupille am Rand des Weissen sieht panisch aus, eine leicht
  // versetzte aufmerksam.
  ctx.beginPath()
  for (let k = 0; k < liste.length; k++) {
    const g = gegner[liste[k]]
    const dx = px - g.x
    const dy = py - g.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const weit = g.radius * 0.17
    const r = g.radius * 0.2
    ctx.moveTo(g.x + (dx / d) * weit + r, g.y + (dy / d) * weit)
    ctx.arc(g.x + (dx / d) * weit, g.y + (dy / d) * weit, r, 0, Math.PI * 2)
  }
  ctx.fillStyle = FARBEN.kontur
  ctx.fill()

  /*
   * Das Lid - nur bei frisch Getroffenen.
   *
   * Ein halber Kreis von oben ueber das Auge, in Koerperfarbe: Das liest sich
   * als Zukneifen, nicht als Balken. Getrennter Durchgang, weil er nur
   * wenige betrifft und die Fuellfarbe eine andere ist.
   */
  ctx.beginPath()
  let kneift = false
  for (let k = 0; k < liste.length; k++) {
    const g = gegner[liste[k]]
    if (g.blitz <= 0) continue
    kneift = true
    const r = g.radius * 0.46
    ctx.moveTo(g.x - r, g.y)
    ctx.lineTo(g.x + r, g.y)
    ctx.arc(g.x, g.y, r, 0, Math.PI, true)
    ctx.closePath()
  }
  if (kneift) {
    ctx.fillStyle = gegner[liste[0]].art.farbe
    ctx.fill()
  }
}

/**
 * Die Schnittrichtung einer Gegnerart.
 *
 * Vier Winkel, fest an der Form. Das ist der Ersatz fuer die Gegnerfarben,
 * die diese Runde eingezogen hat: Zwei Arten nebeneinander sind an der
 * Richtung ihrer Schnitte zu unterscheiden, ohne dass eine Farbe dafuer
 * herhalten muss - genauso, wie ein Stecher zwei Flaechen trennt, der nur
 * eine Farbe zur Verfuegung hat.
 *
 * Aus dem Namen der Form abgeleitet und nicht aus einem Index in
 * `GEGNER_ARTEN`: `draw.ts` importiert bewusst nichts aus `game/enemies.ts`,
 * und diese Runde ist kein Grund, damit anzufangen.
 */
const SCHNITT_WINKEL: Record<string, number> = {
  quadrat: 0.55,
  sechseck: 1.15,
  stern: 2.1,
  kreuz: 2.65,
  halbmond: 0.55,
  doppelquadrat: 2.1,
}

function schnittWinkel(form: string): number {
  return SCHNITT_WINKEL[form] ?? 1.15
}

/**
 * Ein Eckpunkt, aus seiner Sollposition gerutscht.
 *
 * Das ist der Handgriff, um den sich diese ganze Runde dreht. Vorher kam jedes
 * Sechseck aus `cos(i * PI / 3)` und war damit ein *perfektes* Sechseck -
 * tausend davon im Bild, und alle exakt gleich. Kein Mensch schneidet so, und
 * genau das sieht man einem Bild an, ohne es benennen zu koennen.
 *
 * Jeder Punkt rutscht jetzt zweifach: ein Stueck vom Mittelpunkt weg oder auf
 * ihn zu, und ein kleineres Stueck quer dazu. Nur radial waere zu wenig - dann
 * saessen alle Punkte weiter auf denselben Strahlen, und die Form bliebe
 * regelmaessig, nur mit anderen Radien.
 *
 * Entscheidend ist, dass der Versatz aus `saat` (der `id` des Gegners) und dem
 * Eckenindex kommt und **nicht** aus der Zeit: Dieselbe Kreatur bricht in
 * jedem Bild identisch aus. Waere es je Bild neu, flackerte das ganze Feld,
 * und aus "handgeschnitten" wuerde "kaputt".
 */
function ecke(
  ctx: CanvasRenderingContext2D,
  saat: number,
  i: number,
  cx: number,
  cy: number,
  x: number,
  y: number,
  start: boolean,
): void {
  const dx = x - cx
  const dy = y - cy
  const laengs = 1 + kantenVersatz(saat, i) * AUSBRUCH
  const quer = kantenVersatz(saat, i + 64) * AUSBRUCH * 0.7
  const nx = cx + dx * laengs - dy * quer
  const ny = cy + dy * laengs + dx * quer
  if (start) ctx.moveTo(nx, ny)
  else ctx.lineTo(nx, ny)
}

/**
 * Haengt die Umrissform eines Gegners an den aktuellen Pfad.
 *
 * Jede Form geht durch `ecke`, auch die, die frueher ein `ctx.rect` oder ein
 * `ctx.arc` waren: Ein Rechteck und ein Kreisbogen lassen sich nicht
 * verwackeln, und ein einziges exaktes Rechteck zwischen lauter geschnittenen
 * Formen faellt sofort auf. Der Halbmond ist deshalb jetzt ein Polygonzug aus
 * neun Stuecken - aus der Ferne derselbe Bogen, aus der Naehe ein Schnitt.
 */
function formPfad(
  ctx: CanvasRenderingContext2D,
  g: { id?: number; x: number; y: number; radius: number; blick?: number; art: { form: string } },
  px: number,
  py: number,
  drehung: number,
): void {
  const r = g.radius
  const saat = g.id ?? 1
  const cx = g.x
  const cy = g.y

  if (g.art.form === 'dreieck') {
    // Spitze zeigt auf den Spieler: Das Dreieck sagt damit gleichzeitig
    // "schnell" und "kommt von dort".
    const dx = px - g.x
    const dy = py - g.y
    // `Math.sqrt` statt `Math.hypot`: Letzteres schuetzt vor Ueberlauf bei
    // riesigen Werten und ist dafuer ein Vielfaches langsamer. Hier stehen
    // Bildschirmabstaende, also hoechstens ein paar tausend - der Schutz
    // greift nie, die Kosten fallen bei jedem Gegner in jedem Bild an.
    const laenge = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / laenge
    const ny = dy / laenge
    ecke(ctx, saat, 0, cx, cy, g.x + nx * r * 1.35, g.y + ny * r * 1.35, true)
    ecke(
      ctx, saat, 1, cx, cy,
      g.x + (nx * FLANKE_COS - ny * FLANKE_SIN) * r,
      g.y + (nx * FLANKE_SIN + ny * FLANKE_COS) * r,
      false,
    )
    ecke(
      ctx, saat, 2, cx, cy,
      g.x + (nx * FLANKE_COS + ny * FLANKE_SIN) * r,
      g.y + (-nx * FLANKE_SIN + ny * FLANKE_COS) * r,
      false,
    )
    ctx.closePath()
    return
  }

  if (g.art.form === 'quadrat') {
    // Achsenparallel und damit optisch ruhig - genau das soll ein Brocken
    // ausstrahlen. Der Gegensatz zu den zappelnden Dreiecken traegt die
    // Lesbarkeit.
    ecke(ctx, saat, 0, cx, cy, g.x - r, g.y - r, true)
    ecke(ctx, saat, 1, cx, cy, g.x + r, g.y - r, false)
    ecke(ctx, saat, 2, cx, cy, g.x + r, g.y + r, false)
    ecke(ctx, saat, 3, cx, cy, g.x - r, g.y + r, false)
    ctx.closePath()
    return
  }

  if (g.art.form === 'raute') {
    // Auf die Spitze gestellt und mitdrehend: Der Schwaermer kreist, und die
    // Form soll das schon im Stand andeuten.
    const c = Math.cos(drehung * 0.8)
    const sn = Math.sin(drehung * 0.8)
    const lang = r * 1.5
    ecke(ctx, saat, 0, cx, cy, g.x + c * lang, g.y + sn * lang, true)
    ecke(ctx, saat, 1, cx, cy, g.x - sn * r * 0.62, g.y + c * r * 0.62, false)
    ecke(ctx, saat, 2, cx, cy, g.x - c * lang, g.y - sn * lang, false)
    ecke(ctx, saat, 3, cx, cy, g.x + sn * r * 0.62, g.y - c * r * 0.62, false)
    ctx.closePath()
    return
  }

  if (g.art.form === 'pfeil') {
    // Pfeil mit eingezogenem Heck - zeigt dorthin, wo er hinwill, und ist
    // damit auch waehrend der Vorwarnung eine Ansage.
    const dx = px - g.x
    const dy = py - g.y
    // `Math.sqrt` statt `Math.hypot` - Begruendung siehe beim Dreieck.
    const laenge = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / laenge
    const ny = dy / laenge
    const qx = -ny
    const qy = nx
    ecke(ctx, saat, 0, cx, cy, g.x + nx * r * 1.6, g.y + ny * r * 1.6, true)
    ecke(ctx, saat, 1, cx, cy, g.x - nx * r * 0.8 + qx * r, g.y - ny * r * 0.8 + qy * r, false)
    ecke(ctx, saat, 2, cx, cy, g.x - nx * r * 0.25, g.y - ny * r * 0.25, false)
    ecke(ctx, saat, 3, cx, cy, g.x - nx * r * 0.8 - qx * r, g.y - ny * r * 0.8 - qy * r, false)
    ctx.closePath()
    return
  }

  if (g.art.form === 'stern') {
    // Vierzackig, abwechselnd lang und kurz: sticht aus runden und eckigen
    // Formen heraus, damit man den Schuetzen im Gewuehl findet.
    for (let i = 0; i < 8; i++) {
      const w = drehung * 0.5 + (i * Math.PI) / 4
      const laenge = i % 2 === 0 ? r * 1.45 : r * 0.55
      ecke(ctx, saat, i, cx, cy, g.x + Math.cos(w) * laenge, g.y + Math.sin(w) * laenge, i === 0)
    }
    ctx.closePath()
    return
  }

  if (g.art.form === 'kreuz') {
    // Ein Pflasterkreuz. Der Kitt flickt Risse - die Form sagt es, bevor der
    // Spieler den Ring aufblitzen sieht.
    const d = r * 0.4
    const p: Array<[number, number]> = [
      [-d, -r], [d, -r], [d, -d], [r, -d], [r, d], [d, d],
      [d, r], [-d, r], [-d, d], [-r, d], [-r, -d], [-d, -d],
    ]
    for (let i = 0; i < p.length; i++) {
      ecke(ctx, saat, i, cx, cy, g.x + p[i][0], g.y + p[i][1], i === 0)
    }
    ctx.closePath()
    return
  }

  if (g.art.form === 'doppelquadrat') {
    // Rahmen im Rahmen: "hieraus werden zwei". Der innere Ring laeuft
    // gegenlaeufig, damit die Fuellregel ihn als Loch stehen laesst.
    ecke(ctx, saat, 0, cx, cy, g.x - r, g.y - r, true)
    ecke(ctx, saat, 1, cx, cy, g.x + r, g.y - r, false)
    ecke(ctx, saat, 2, cx, cy, g.x + r, g.y + r, false)
    ecke(ctx, saat, 3, cx, cy, g.x - r, g.y + r, false)
    ctx.closePath()
    const i = r * 0.44
    ecke(ctx, saat, 4, cx, cy, g.x - i, g.y - i, true)
    ecke(ctx, saat, 5, cx, cy, g.x - i, g.y + i, false)
    ecke(ctx, saat, 6, cx, cy, g.x + i, g.y + i, false)
    ecke(ctx, saat, 7, cx, cy, g.x + i, g.y - i, false)
    ctx.closePath()
    return
  }

  if (g.art.form === 'halbmond') {
    // Der Schildtraeger. Der Koerper ist ein Halbkreis, dessen flache Seite
    // dorthin zeigt, wo der Panzer sitzt - der Bogen davor wird getrennt
    // gezeichnet, weil er eine eigene Farbe braucht.
    const blick = g.blick ?? 0
    const von = blick + Math.PI / 2
    const STUECKE = 9
    for (let i = 0; i <= STUECKE; i++) {
      const w = von + (i / STUECKE) * Math.PI
      ecke(ctx, saat, i, cx, cy, g.x + Math.cos(w) * r, g.y + Math.sin(w) * r, i === 0)
    }
    ctx.closePath()
    return
  }

  // Sechseck, langsam drehend.
  for (let i = 0; i < 6; i++) {
    const w = drehung + (i * Math.PI) / 3
    ecke(ctx, saat, i, cx, cy, g.x + Math.cos(w) * r, g.y + Math.sin(w) * r, i === 0)
  }
  ctx.closePath()
}

/** Eimer, um Geschosse nach Waffenfarbe zu buendeln. */
const geschossEimer = new Map<string, number[]>()

/**
 * Geschosse - gebuendelt nach Waffenfarbe.
 *
 * Jede Waffe traegt ihre eigene Farbe, damit man im Getuemmel sieht, was
 * gerade wirkt: Der gruene Pfad des Bogens, die orangen Granaten, die gelben
 * Splitter. Bei fuenf gleichzeitig feuernden Waffen ist das der Unterschied
 * zwischen "da passiert etwas" und "ich verstehe, was passiert".
 */
function zeichneGeschosse(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.geschosse.aktiv
  if (liste.length === 0) return

  for (const eimer of geschossEimer.values()) eimer.length = 0
  for (let i = 0; i < liste.length; i++) {
    let eimer = geschossEimer.get(liste[i].farbe)
    if (eimer === undefined) {
      eimer = []
      geschossEimer.set(liste[i].farbe, eimer)
    }
    eimer.push(i)
  }

  for (const [farbe, eimer] of geschossEimer) {
    if (eimer.length === 0) continue

    /*
     * Kein Hof. Ein Geschoss ist ein Tintenpunkt.
     *
     * Auf dem Nachtfeld brauchte es einen Schein, um ueberhaupt aufzufallen;
     * auf Papier ist ein dunkler Punkt mit Kontur von sich aus das
     * Auffaelligste, was es gibt. Der Hof war eine Antwort auf ein Problem,
     * das die neue Palette nicht mehr hat.
     */
    ctx.beginPath()
    for (let k = 0; k < eimer.length; k++) {
      const p = liste[eimer[k]]
      ctx.moveTo(p.x + p.radius, p.y)
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    }
    ctx.fillStyle = farbe
    ctx.fill()
    // Auch Geschosse bekommen ihre Kontur: Auf einem hellen Feld verschwindet
    // ein heller Punkt sonst genau dann, wenn es darauf ankommt.
    ctx.lineWidth = 2
    ctx.strokeStyle = FARBEN.kontur
    ctx.stroke()
  }
}

function zeichneKristalle(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.kristalle.aktiv
  if (liste.length === 0) return

  /*
   * Zwei Klassen statt einer, und das ist eine Farbentscheidung.
   *
   * Auf dem Nachtfeld war jeder Kristall ein leuchtender Punkt, und bei
   * zweihundert Stueck war das hinnehmbar - Leuchten laeuft ineinander. Im
   * Druck nicht: Zweihundert satte Ockerrauten auf hellem Papier ergeben ein
   * Feld aus Gold, in dem der Gegner untergeht und das *Wichtige* nicht mehr
   * heraussticht. Ocker ist eine von genau zwei Druckfarben; sie an das
   * Haeufigste im Bild zu verschenken macht sie wertlos.
   *
   * Also: Der gewoehnliche Kristall ist nur noch eine kleine Kontur mit
   * Papier darin - er ist da, er faellt nicht auf. Erst der wertvolle traegt
   * Ocker und lockt damit wirklich aus der Ferne. Genau das war die Aufgabe.
   */
  const WERTVOLL_AB = 3

  ctx.lineJoin = 'round'

  for (let durchgang = 0; durchgang < 2; durchgang++) {
    const wertvoll = durchgang === 1
    ctx.beginPath()
    let welche = false

    for (let i = 0; i < liste.length; i++) {
      const k = liste[i]
      if (k.wert >= WERTVOLL_AB !== wertvoll) continue
      welche = true
      // Groesse zeigt den Wert: Ein Elite-Kristall soll aus der Ferne locken.
      const r = (wertvoll ? 5 : 3.4) + Math.min(5, k.wert)
      ctx.moveTo(k.x, k.y - r)
      ctx.lineTo(k.x + r, k.y)
      ctx.lineTo(k.x, k.y + r)
      ctx.lineTo(k.x - r, k.y)
      ctx.closePath()
    }
    if (!welche) continue

    ctx.fillStyle = wertvoll ? FARBEN.kristall : FARBEN.grund
    ctx.fill()
    ctx.lineWidth = wertvoll ? 2 : 1.4
    ctx.strokeStyle = FARBEN.kontur
    ctx.stroke()
  }
}

function zeichneSpieler(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const sp = s.spieler

  // Einzugsradius als hauchduenner Ring. Das Magnetfeld ist eine der besten
  // Aufwertungen - ohne sichtbaren Radius merkt der Spieler nie, dass sie
  // wirkt, und waehlt sie nie wieder.
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.magnetRadius, 0, Math.PI * 2)
  ctx.strokeStyle = mitAlpha(FARBEN.kontur, 0.14)
  ctx.lineWidth = 1.5
  ctx.stroke()

  /*
   * Der Stoss-Ring.
   *
   * Ein Ausweichmanoever mit Abklingzeit ist nur dann eine Entscheidung, wenn
   * man *weiss*, ob es bereit ist. Steht der Ring voll, kann man stossen; ein
   * Blick auf die eigene Figur genuegt, ohne die Augen vom Getuemmel zu
   * nehmen. Deshalb hier und nicht als Balken am Bildrand.
   */
  const bereit = sp.stossAbkling <= 0
  const anteil = bereit ? 1 : 1 - sp.stossAbkling / STOSS_ABKLING
  if (!bereit || sp.stossRest > 0) {
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, sp.radius + 7, -Math.PI / 2, -Math.PI / 2 + anteil * Math.PI * 2)
    ctx.strokeStyle = FARBEN.spielerRing
    ctx.lineWidth = 3.5
    ctx.stroke()
  } else {
    // Voll: ein geschlossener Ring, der leicht atmet - das liest sich als
    // "steht bereit" statt als "hier fehlt noch etwas".
    const puls = 0.35 + 0.2 * Math.sin(performance.now() / 320)
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, sp.radius + 7, 0, Math.PI * 2)
    ctx.strokeStyle = mitAlpha(FARBEN.spielerRing, 0.35 + puls * 0.5)
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Waehrend des Stosses eine Schleifspur in Stossrichtung.
  if (sp.stossRest > 0) {
    const laenge = Math.hypot(sp.stossVx, sp.stossVy) || 1
    ctx.beginPath()
    ctx.moveTo(sp.x, sp.y)
    ctx.lineTo(sp.x - (sp.stossVx / laenge) * 46, sp.y - (sp.stossVy / laenge) * 46)
    ctx.strokeStyle = mitAlpha(FARBEN.spielerRing, 0.55)
    ctx.lineWidth = 6
    ctx.stroke()
  }

  // Waehrend der Unverwundbarkeit blinken - sonst raetselt der Spieler, warum
  // Treffer ploetzlich nichts tun.
  //
  // Blinken heisst hier *blasser*, nicht *weg*. Zuerst wurde die Figur in der
  // Blinkphase gar nicht gezeichnet, und im Screenshot aus dem dichten
  // Getuemmel war sie schlicht nicht auffindbar: Wer dauernd Treffer kassiert,
  // ist dauernd unverwundbar - und damit die halbe Zeit unsichtbar. In einem
  // Spiel, das nur aus Ausweichen besteht, ist das die schlimmste
  // Sekunde, um die eigene Position zu verlieren.
  const blinkt = sp.unverwundbar > 0 && Math.floor(sp.unverwundbar * 22) % 2 === 0

  /*
   * Der Hof - die Stelle, an der die Presse ausgespart hat.
   *
   * Das war das eine Risiko dieser Richtung, und im ersten Bild ist es
   * eingetreten: Tausend Koerper in massiver Tinte ergeben eine schwarze
   * Masse, und eine weisse Scheibe von dreizehn Punkten darin ist schlicht
   * nicht auffindbar. Auf dem Nachtfeld hatte der Spieler ein Leuchten, das
   * sich ueber alles legte; im Druck gibt es das nicht.
   *
   * Also andersherum: Statt dass der Spieler heller wird als seine Umgebung,
   * *wird seine Umgebung Papier*. Ein blasser Hof aus Papierfarbe unter der
   * Figur draengt die Tinte zurueck, und genau das ist ein Griff, den es im
   * Druck wirklich gibt - eine Aussparung im Druckstock. Er liegt bewusst
   * *ueber* dem Getuemmel und *unter* der Figur.
   *
   * Blass genug, dass man ihn nicht als Scheibe liest, kraeftig genug, dass
   * die Masse an dieser Stelle aufreisst.
   */
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius * 2.6, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(FARBEN.grund, 0.62)
  ctx.fill()

  /*
   * Die eigene Figur: ein Loch im Druck.
   *
   * In einem Spiel, das nur aus Ausweichen besteht, ist die eigene Position
   * die eine Information, die niemals verlorengehen darf. Auf dem Nachtfeld
   * trug das ein Leuchten; im Druck traegt es das Material. Der Spieler ist
   * das einzige Ding im Bild, aus dem die Tinte *herausgenommen* wurde -
   * Papier, umgeben von einer schweren Kante, mitten in einer schwarzen
   * Masse. So etwas findet das Auge immer, und es kostet keine Farbe.
   *
   * Die Kante ist bewusst schwerer als bei jedem Gegner: Auf hellem Papier
   * ist eine weisse Flaeche fuer sich unsichtbar - erst der Rand macht sie zu
   * einer Figur. Genau umgekehrt zur Nachtfassung, wo die Fuellung alles trug
   * und der Rand nur trennte.
   */
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(sp.blitz > 0 ? FARBEN.gefahr : FARBEN.spieler, blinkt ? 0.5 : 1)
  ctx.fill()
  ctx.lineWidth = 4.5
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()

  // Der Kern ist jetzt *Tinte*, nicht Weiss: Ein weisser Punkt in einer
  // weissen Scheibe ist auf Papier nichts. Ein dunkler Punkt darin macht aus
  // der Scheibe ein Auge - und der Spieler liest seine Position an einem
  // Punkt ab statt an einer Flaeche.
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius * 0.34, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(FARBEN.kontur, blinkt ? 0.5 : 1)
  ctx.fill()

  if (sp.stossRest > 0) {
    strahlen(ctx, sp.x, sp.y, sp.radius * 1.3, sp.radius * 3, 9, FARBEN.spielerRing, 0, 0.8)
  }

  if (sp.istGlas) zeichneEigeneRisse(ctx, s)
}

/**
 * Die Risse der Kernscherbe - auf ihrer eigenen Figur.
 *
 * Ohne sie waere die Mechanik unsichtbar: Man zerspringt beim dritten Treffer
 * und weiss nicht, warum es diesmal passiert ist und beim letzten Mal nicht.
 * Genau derselbe Grund, aus dem Gegner ihre Bruchlinien tragen - die Kernregel
 * ist nur dann eine Regel, wenn man ihren Stand sieht.
 *
 * Die Linien werden laenger und wandern nach aussen, je naeher der dritte
 * Riss kommt, und beim letzten pulsiert der Ring: Der gefaehrliche Zustand
 * bewegt sich, der harmlose nicht.
 */
function zeichneEigeneRisse(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const sp = s.spieler
  if (sp.risse === 0) return

  const knapp = sp.risse >= RISS_SCHWELLE - 1
  const puls = knapp ? 1 + Math.sin(performance.now() / 110) * 0.12 : 1
  const r = sp.radius * puls

  ctx.beginPath()
  for (let i = 0; i < sp.risse; i++) {
    // Feste Winkel statt Zufall: Zwei Risse sollen bei jedem Blick an
    // derselben Stelle sitzen, sonst liest man Flackern statt Zustand.
    const w = (i / RISS_SCHWELLE) * Math.PI * 2 - Math.PI / 3
    // Weit ueber den Koerper hinaus: Die Figur ist nur dreizehn Punkte gross,
    // und ein Riss, der in ihr steckenbleibt, ist im Getuemmel nicht zu sehen.
    // Er soll aus ihr herauszeigen wie bei einem Gegner auch.
    ctx.moveTo(sp.x + Math.cos(w) * r * 0.25, sp.y + Math.sin(w) * r * 0.25)
    ctx.lineTo(sp.x + Math.cos(w + 0.3) * r * 1.85, sp.y + Math.sin(w + 0.3) * r * 1.85)
  }
  ctx.lineWidth = 5.5
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = knapp ? FARBEN.gefahr : s.charakter.farbe
  ctx.stroke()

  // Beim zweiten Riss ein Ring dazu: Der naechste Treffer einer *neuen* Art
  // laesst sie zerspringen, und das ist die Sekunde, in der man es wissen muss.
  if (!knapp) return
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius * 2.1 * puls, 0, Math.PI * 2)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = mitAlpha(FARBEN.gefahr, 0.8)
  ctx.stroke()
}

function zeichneZahlen(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.zahlen.aktiv
  if (liste.length === 0) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 19px ${SCHRIFT.mono}`

  // Dunkler Umriss um jede Zahl - ohne ihn verschwinden helle Ziffern auf dem
  // helleren Feld genau dann, wenn viele davon uebereinanderliegen.
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4
  for (let i = 0; i < liste.length; i++) {
    const z = liste[i]
    const deckung = Math.min(1, z.leben * 2.2)
    ctx.strokeStyle = mitAlpha(FARBEN.kontur, deckung)
    ctx.strokeText(String(z.wert), z.x, z.y)
    ctx.fillStyle = mitAlpha(z.krit ? FARBEN.krit : FARBEN.text, deckung)
    ctx.fillText(String(z.wert), z.x, z.y)
  }

  ctx.textBaseline = 'alphabetic'
}

/**
 * Zonen - Sog und Truemmerfeld.
 *
 * Der Sog wird von innen nach aussen dunkler gezeichnet, damit er wie ein
 * Loch wirkt und nicht wie eine Lampe: Ein helles Zentrum saehe aus, als
 * strahle etwas ab, und genau das Gegenteil passiert hier.
 */
/**
 * Wie kraeftig eine Flaeche angedruckt wird - abhaengig von ihrer Groesse.
 *
 * Eine kleine Zone darf satt sein, eine bildschirmfuellende nicht. Das ist
 * keine Willkuer, sondern die Regel der Presse: Je groesser die Flaeche, desto
 * duenner traegt die Walze auf. Und es ist eine handfeste Notwendigkeit -
 * die vollendete Zeitwaffe hat 700 Punkte Radius, und bei voller Dichte
 * schraffiert sie den ganzen Bogen zu, bis das Papier verschwindet.
 */
function andruck(radius: number): number {
  return Math.max(0.12, Math.min(0.5, 45 / radius))
}

function zeichneZonen(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.zonen.aktiv
  if (liste.length === 0) return

  for (let i = 0; i < liste.length; i++) {
    const z = liste[i]
    const rest = z.leben / z.maxLeben

    if (z.art === 'sog') {
      // Der Rand zuckt mit - ein starrer Kreis wirkt wie ein Aufkleber.
      const zucken = 1 + Math.sin(performance.now() / 90) * 0.02
      ctx.beginPath()
      ctx.arc(z.x, z.y, z.radius * zucken, 0, Math.PI * 2)
      // Auf einem hellen Grund braucht eine Zone eine *dunkle* Fuellung, sonst
      // verschwindet sie. Vorher lag sie als heller Schleier auf schwarzem
      // Feld - jetzt ist es umgekehrt.
      // Schraffur statt Fuellung: Eine Zone ist ein zweiter Druckgang auf
      // dasselbe Papier, keine gefaerbte Scheibe. Der Winkel kommt aus dem
      // Ort - zwei Zonen nebeneinander sind damit an der Strichrichtung zu
      // unterscheiden, ohne dass eine Farbe dafuer herhalten muss.
      const m = schraffurMuster(ctx, Math.round(z.x / 40 + z.y / 40), z.farbe, andruck(z.radius))
      if (m !== null) {
        ctx.fillStyle = m
        ctx.fill()
      }
      ctx.lineWidth = 3
      ctx.strokeStyle = FARBEN.kontur
      ctx.stroke()

      // Drei einlaufende Ringe zeigen die Richtung des Sogs.
      for (let k = 1; k <= 3; k++) {
        const anteil = ((performance.now() / 900 + k / 3) % 1)
        ctx.beginPath()
        ctx.arc(z.x, z.y, z.radius * (1 - anteil), 0, Math.PI * 2)
        ctx.strokeStyle = mitAlpha(z.farbe, 0.28 * anteil)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Schwarzer Kern - gedeckelt. Ohne Deckel wird aus dem Auge des Sogs
      // bei einer ausgereizten Waffe eine Tintenpfuetze von hundert Punkten
      // Durchmesser, die das halbe Bild frisst.
      ctx.beginPath()
      ctx.arc(z.x, z.y, Math.min(22, z.radius * 0.16), 0, Math.PI * 2)
      ctx.fillStyle = FARBEN.kontur
      ctx.fill()
      continue
    }

    // Die Brandspur des Zunders flackert und liegt kraeftiger auf: Sie
    // verletzt den Spieler, nicht die Gegner, und muss deshalb aussehen wie
    // etwas, in das man nicht hineinlaeuft - nicht wie ein Waffeneffekt.
    const brand = z.art === 'brand'
    const flackern = brand ? 0.86 + Math.sin(performance.now() / 70 + z.x) * 0.14 : 1
    ctx.beginPath()
    ctx.arc(z.x, z.y, z.radius * (brand ? flackern : 1), 0, Math.PI * 2)
    // Die Brandspur schraffiert dichter und in Zinnober: Sie ist die einzige
    // Zone, die *dem Spieler* wehtut, und muss sich deshalb von allen
    // Waffenzonen unterscheiden lassen.
    const m2 = schraffurMuster(
      ctx,
      brand ? 1 : Math.round(z.x / 40 + z.y / 40),
      brand ? FARBEN.gefahr : z.farbe,
      andruck(z.radius) * (brand ? 1.5 : 1) * rest,
    )
    if (m2 !== null) {
      ctx.fillStyle = m2
      ctx.fill()
    }
    ctx.lineWidth = brand ? 3 : 2.2
    ctx.strokeStyle = mitAlpha(brand ? FARBEN.gefahr : FARBEN.kontur, (brand ? 0.95 : 0.7) * rest)
    ctx.stroke()
  }
}

/**
 * Bruchlinien auf angerissenen Gegnern.
 *
 * Das ist die Sichtbarkeit der Kernregel. Ohne sie platzen Gegner scheinbar
 * grundlos, und niemand kommt darauf, dass es an der *Mischung* der Waffen
 * liegt - die eine Entscheidung, um die sich das ganze Spiel dreht.
 *
 * Alles in einem Pfad: Bei hunderten angerissenen Gegnern waere ein Strich je
 * Gegner der teuerste Teil des Bildes.
 */
function zeichneBruchlinien(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.gegner.aktiv
  ctx.beginPath()
  let gezeichnet = false

  for (let i = 0; i < liste.length; i++) {
    const g = liste[i]
    if (g.risse <= 0) continue
    gezeichnet = true

    for (let k = 0; k < g.risse; k++) {
      // Aus der ID abgeleitet statt gespeichert: Der Riss sitzt bei jedem
      // Gegner woanders, bleibt aber ueber die Bilder hinweg an derselben
      // Stelle - ohne ein zusaetzliches Feld an 1400 Objekten.
      const winkel = ((g.id * 2.399 + k * 1.911) % Math.PI) - Math.PI / 2
      // Kuerzer als der Radius: Ragen die Linien ueber die Form hinaus, sieht
      // der Gegner aus, als traege er Stacheln. Ein Sprung liegt *im* Glas.
      const laenge = g.radius * 0.82
      const cx = Math.cos(winkel) * laenge
      const cy = Math.sin(winkel) * laenge
      // Leichter Knick in der Mitte - eine gerade Linie sieht aus wie ein
      // Strich, eine geknickte wie ein Sprung im Glas.
      const knickX = g.x + cy * 0.16
      const knickY = g.y - cx * 0.16
      ctx.moveTo(g.x - cx, g.y - cy)
      ctx.lineTo(knickX, knickY)
      ctx.lineTo(g.x + cx, g.y + cy)
    }
  }

  if (!gezeichnet) return

  /*
   * Zwei Striche auf demselben Pfad: erst dunkel und breit, dann hell und
   * schmal darauf.
   *
   * Ein Riss ist die Kernregel dieses Spiels und soll das Auffaelligste am
   * Gegner sein. Als reiner dunkler Strich auf einem dunklen Koerper war er
   * das Gegenteil - man sah ihn erst, wenn man danach suchte. Der helle Kern
   * in der Mitte macht daraus Glas, das von innen bricht: dieselbe Lesart wie
   * bei einem echten Sprung, wo die Bruchflaeche das Licht faengt.
   */
  ctx.lineCap = 'round'
  ctx.lineWidth = 3.4
  ctx.strokeStyle = mitAlpha(FARBEN.kontur, 0.9)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = mitAlpha(FARBEN.riss, 0.95)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // Und jeder gerissene Gegner glimmt. Bei drei Rissen zerspringt er - das
  // Glimmen ist die Vorwarnung, die es bisher nur als Strichzeichnung gab.
  /*
   * Nur die *fast* zersplitterten glimmen - ab dem zweiten Riss.
   *
   * Gemessen: Mit jedem gerissenen Gegner kostete die Glut-Schicht 8,7 der 20
   * Millisekunden je Bild, weil im vollen Getuemmel hunderte gleichzeitig
   * einen Riss tragen. Und sie sagte dabei am wenigsten: Ein Riss ist der
   * Normalzustand, zwei sind die Ansage. Genau die bleibt.
   */
  // Kein zusaetzliches Signal mehr bei zwei Rissen: Die Kerben sind jetzt
  // *fehlende Tinte* und damit von sich aus das Hellste am Koerper. Ein
  // Leuchten obendrauf waere das zweite Mal dieselbe Aussage.
}

/** Trabanten: kreisende Scherben, Position kommt aus dem Verhalten. */
function zeichneTrabanten(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const sp = s.spieler

  for (let i = 0; i < sp.waffen.length; i++) {
    const w = sp.waffen[i]
    if (w.def.verhalten !== 'trabant') continue

    // Die Bahn andeuten, damit der Spieler die Reichweite einschaetzen kann.
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, w.werte.extra, 0, Math.PI * 2)
    ctx.strokeStyle = mitAlpha(w.def.farbe, 0.12)
    ctx.lineWidth = 1
    ctx.stroke()

    const gesamt = trabantenAnzahl(w)
    ctx.beginPath()
    for (let k = 0; k < gesamt; k++) {
      const punkt = trabantPunkt(w, k, sp.x, sp.y)
      const r = w.werte.radius
      ctx.moveTo(punkt.x, punkt.y - r)
      ctx.lineTo(punkt.x + r, punkt.y)
      ctx.lineTo(punkt.x, punkt.y + r)
      ctx.lineTo(punkt.x - r, punkt.y)
      ctx.closePath()
    }
    ctx.fillStyle = w.def.farbe
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = FARBEN.grund
    ctx.stroke()
  }
}

/** Blitzbahnen, Hiebboegen und Druckringe. */
function zeichneEffekte(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.effekte.aktiv
  if (liste.length === 0) return

  for (let i = 0; i < liste.length; i++) {
    const e = liste[i]
    const rest = Math.max(0, e.leben / e.maxLeben)

    if (e.warnung) {
      zeichneWarnung(ctx, e, rest)
      continue
    }

    if (e.art === 'strich') {
      // Zweimal gezeichnet: breit und blass als Schein, schmal und weiss als
      // Kern. Das ist der billigste Weg zu einem Strahl, der gleisst.
      ctx.beginPath()
      ctx.moveTo(e.x, e.y)
      ctx.lineTo(e.x2, e.y2)
      ctx.lineCap = 'round'
      ctx.lineWidth = e.breite * 2.2 * rest
      ctx.strokeStyle = mitAlpha(e.farbe, 0.35 * rest)
      ctx.stroke()

      ctx.lineWidth = Math.max(1, e.breite * 0.5) * rest
      ctx.strokeStyle = mitAlpha(FARBEN.treffer, 0.9 * rest)
      ctx.stroke()
      ctx.lineCap = 'butt'
      continue
    }

    if (e.art === 'bogen') {
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius, e.winkel - e.spanne, e.winkel + e.spanne)
      ctx.lineCap = 'round'
      ctx.lineWidth = e.breite * 2.4 * rest
      ctx.strokeStyle = mitAlpha(e.farbe, 0.5 * rest)
      ctx.stroke()
      ctx.lineWidth = e.breite * rest
      ctx.strokeStyle = mitAlpha(FARBEN.treffer, 0.85 * rest)
      ctx.stroke()
      ctx.lineCap = 'butt'
      continue
    }

    // Ring: waechst nach aussen und verblasst - eine Druckwelle.
    const fortschritt = 1 - rest
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.radius * (0.35 + 0.65 * fortschritt), 0, Math.PI * 2)
    ctx.lineWidth = e.breite * rest
    ctx.strokeStyle = mitAlpha(e.farbe, 0.75 * rest)
    ctx.stroke()
  }
}

/**
 * Vorwarnung eines Bossangriffs.
 *
 * Gestrichelt, rot und pulsierend - und **auf voller Groesse**, nicht
 * wachsend. Eine Warnung muss zeigen, wo gleich etwas passiert, nicht wo es
 * gerade anfaengt. Sie wird zum Ende hin kraeftiger statt schwaecher: Der
 * letzte Moment vor dem Einschlag ist der, in dem man reagiert.
 */
function zeichneWarnung(ctx: CanvasRenderingContext2D, e: Effekt, rest: number): void {
  const naehe = 1 - rest
  const puls = 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 90))
  ctx.save()
  ctx.setLineDash([10, 8])
  ctx.lineWidth = e.breite * (1 + naehe)
  ctx.strokeStyle = mitAlpha(FARBEN.gefahr, (0.35 + 0.5 * naehe) * puls)

  if (e.art === 'strich') {
    ctx.beginPath()
    ctx.moveTo(e.x, e.y)
    ctx.lineTo(e.x2, e.y2)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Bosse zusaetzlich hervorheben.
 *
 * Ein Boss ist ein Sechseck wie ein Elite-Gegner, nur groesser - das allein
 * reicht im Getuemmel nicht. Ein pulsierender Aussenring und ein Kern in der
 * Phasenfarbe machen ihn auf einen Blick auffindbar, ohne die Formsprache zu
 * verwaessern.
 */
function zeichneBosse(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.gegner.aktiv

  for (let i = 0; i < liste.length; i++) {
    const g = liste[i]
    const z = g.bossZustand
    if (z === null) continue

    const puls = 0.5 + 0.5 * Math.sin(performance.now() / 220)
    ctx.beginPath()
    ctx.arc(g.x, g.y, g.radius * (1.25 + puls * 0.08), 0, Math.PI * 2)
    ctx.strokeStyle = mitAlpha(z.art.farbe, 0.35 + puls * 0.3)
    ctx.lineWidth = 3
    ctx.stroke()

    /*
     * Kern: In Phase zwei weiss gluehend statt in Bossfarbe - man soll den
     * Wechsel sehen, nicht nur merken.
     *
     * Beim Kern zaehlen keine Phasen, sondern Schalen: Solange noch eine
     * steht, bleibt sein Inneres dunkel; ist die letzte gebrochen, gluht es.
     * Ohne diese Unterscheidung sass in ihm ein toter grauer Fleck, der genau
     * nichts sagte - er hat `phaseSchwelle: -1` und wechselt nie die Phase.
     */
    const schalen = z.art.schalen ?? 0
    const offen = schalen > 0 ? z.schale === 0 : z.phase > 1
    ctx.beginPath()
    ctx.arc(g.x, g.y, g.radius * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = offen ? mitAlpha(FARBEN.treffer, 0.85) : mitAlpha(FARBEN.kontur, 0.75)
    ctx.fill()
  }
}

/** Bossgeschosse - rot, mit hellem Kern, damit sie nie mit eigenen verwechselt werden. */
function zeichneFeindSchuesse(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.feindSchuesse.aktiv
  if (liste.length === 0) return

  // Feindgeschosse muessen von eigenen unterscheidbar bleiben: Sie sind die
  // einzigen Punkte im Zinnober, und Zinnober heisst im ganzen Spiel genau
  // eines - das kann dir wehtun. Auf Papier ist das ohne jeden Schein die
  // auffaelligste Farbe, die es gibt.
  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i]
    ctx.moveTo(p.x + p.radius, p.y)
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
  }
  ctx.fillStyle = FARBEN.gefahr
  ctx.fill()
  // Dunkle Kontur wie bei allem anderen. Ein weisser Rand liess die Geschosse
  // vorher auf schwarzem Grund leuchten; auf hellem Feld trennt Dunkel besser.
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2.5
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()
}
