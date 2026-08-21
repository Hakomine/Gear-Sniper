import { SCHILD_WINKEL } from '../game/gegnerVerhalten'
import { schreinDef, SCHREIN_RADIUS } from '../game/schreine'
import { STOSS_ABKLING } from '../game/player'
import type { Effekt, Spielstand } from '../game/state'
import { trabantenAnzahl, trabantPunkt } from '../game/verhalten'
import { zeichneAtempause, zeichneLevelup, zeichnePause, zeichneTitel, zeichneTod } from '../ui/menus'
import { zeichneHud } from './hud'
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

const GITTER_SCHRITT = 80

// Drehung der Dreiecksflanken um 140 Grad - einmal ausgerechnet.
const FLANKE_COS = Math.cos((140 * Math.PI) / 180)
const FLANKE_SIN = Math.sin((140 * Math.PI) / 180)

/** Wiederverwendete Eimer, um Gegner nach Art gebuendelt zu zeichnen. */
const gegnerEimer = new Map<string, number[]>()
const blitzende: number[] = []

export class Zeichner {
  /** Faktor von virtuellen Punkten auf echte Bildpunkte. */
  private pixelSkala = 1

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
    const ctx = this.ctx
    ctx.setTransform(this.pixelSkala, 0, 0, this.pixelSkala, 0, 0)

    ctx.fillStyle = FARBEN.grund
    ctx.fillRect(0, 0, VIRT_B, VIRT_H)

    // --- Welt ------------------------------------------------------------
    ctx.save()
    const stoss = erschuetterung(s.trauma, performance.now() / 1000)
    ctx.translate(VIRT_B / 2 + stoss.x, VIRT_H / 2 + stoss.y)
    ctx.rotate(stoss.winkel)
    ctx.scale(WELT_ZOOM, WELT_ZOOM)
    ctx.translate(-s.kamera.x, -s.kamera.y)

    // Reihenfolge ist Lesbarkeit: Zonen liegen als Untergrund unter allem,
    // Bruchlinien direkt auf den Gegnern, Effekte ueber dem Getuemmel, der
    // Spieler zuletzt - er darf nie verdeckt sein.
    zeichneGitter(ctx, s)
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
    if (s.blitz > 0) {
      ctx.fillStyle = mitAlpha('#ffffff', s.blitz * 0.28)
      ctx.fillRect(0, 0, VIRT_B, VIRT_H)
    }

    // Im Tod kein HUD: Uhr, Lebensbalken und Waffenleiste stehen sonst quer
    // durch die Auswertung, und der Lauf ist ohnehin vorbei.
    if (s.phase !== 'titel' && s.phase !== 'tot' && s.phase !== 'atempause') {
      zeichneSchreinZeiger(ctx, s, VIRT_B, VIRT_H)
      zeichneHud(ctx, s, VIRT_B, VIRT_H)
    }
    if (s.phase === 'titel') zeichneTitel(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'levelup') zeichneLevelup(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'pause') zeichnePause(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'atempause') zeichneAtempause(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'tot') zeichneTod(ctx, s, VIRT_B, VIRT_H)
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

    // Der Koerper: eine stehende Scherbe.
    ctx.beginPath()
    ctx.moveTo(sch.x, sch.y - r)
    ctx.lineTo(sch.x + r * 0.62, sch.y - r * 0.1)
    ctx.lineTo(sch.x + r * 0.3, sch.y + r * 0.8)
    ctx.lineTo(sch.x - r * 0.34, sch.y + r * 0.8)
    ctx.lineTo(sch.x - r * 0.62, sch.y - r * 0.16)
    ctx.closePath()
    ctx.fillStyle = mitAlpha(def.farbe, 0.28 + puls * 0.16)
    ctx.fill()
    ctx.strokeStyle = def.farbe
    ctx.lineWidth = 2
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
 * Jede Etappe faerbt das Gitter anders.
 *
 * Der billigste Weg, Fortschritt sichtbar zu machen: Ohne ihn sieht Minute
 * neun genauso aus wie Minute eins, und die Etappen bleiben eine Zahl im
 * Menue statt einer Erfahrung. Der Farbton dreht sich in festen Schritten
 * durch den Kreis, die Helligkeit bleibt - lesbar muss es ja bleiben.
 */
function etappenFarbe(etappe: number, stark: boolean): string {
  const ton = (200 + (etappe - 1) * 47) % 360
  return `hsla(${ton}, 40%, ${stark ? 34 : 26}%, ${stark ? 0.5 : 0.32})`
}

/**
 * Der Hintergrund.
 *
 * Ohne ihn steht der Spieler auf einer schwarzen Flaeche und man sieht die
 * eigene Bewegung nicht - das Spiel fuehlt sich an, als klebe man fest. Das
 * Gitter kostet ein paar Striche und macht aus Stillstand Fahrt.
 */
function zeichneGitter(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  // Durch den Zoom geteilt: Der sichtbare Weltausschnitt ist kleiner als das
  // Spielfeld in virtuellen Punkten. Ohne die Teilung zeichnete das Gitter
  // weit ueber den Bildrand hinaus - reine Rechenzeit fuer nichts.
  const halbB = VIRT_B / 2 / WELT_ZOOM + GITTER_SCHRITT
  const halbH = VIRT_H / 2 / WELT_ZOOM + GITTER_SCHRITT
  const linksX = s.kamera.x - halbB
  const rechtsX = s.kamera.x + halbB
  const obenY = s.kamera.y - halbH
  const untenY = s.kamera.y + halbH

  const startX = Math.floor(linksX / GITTER_SCHRITT) * GITTER_SCHRITT
  const startY = Math.floor(obenY / GITTER_SCHRITT) * GITTER_SCHRITT

  // Zwei Durchgaenge, damit `strokeStyle` nur zweimal wechselt statt bei
  // jedem fuenften Strich.
  for (const stark of [false, true]) {
    ctx.beginPath()
    for (let x = startX; x <= rechtsX; x += GITTER_SCHRITT) {
      if ((Math.round(x / GITTER_SCHRITT) % 5 === 0) !== stark) continue
      ctx.moveTo(x, obenY)
      ctx.lineTo(x, untenY)
    }
    for (let y = startY; y <= untenY; y += GITTER_SCHRITT) {
      if ((Math.round(y / GITTER_SCHRITT) % 5 === 0) !== stark) continue
      ctx.moveTo(linksX, y)
      ctx.lineTo(rechtsX, y)
    }
    ctx.strokeStyle = etappenFarbe(s.etappe, stark)
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/**
 * Gegner - nach Art gebuendelt.
 *
 * Bei bis zu 1400 Gegnern ist nicht das Fuellen teuer, sondern der Wechsel
 * der Farbe. Ein Pfad pro Art heisst drei Farbwechsel statt 1400.
 */
/** Wer gerade einen Schildbogen braucht - wiederverwendet, kein Muell je Bild. */
const schildTraeger: number[] = []

function zeichneGegner(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  for (const liste of gegnerEimer.values()) liste.length = 0
  blitzende.length = 0
  schildTraeger.length = 0

  const gegner = s.gegner.aktiv
  for (let i = 0; i < gegner.length; i++) {
    const id = gegner[i].art.id
    let liste = gegnerEimer.get(id)
    if (liste === undefined) {
      liste = []
      gegnerEimer.set(id, liste)
    }
    liste.push(i)
    if (gegner[i].blitz > 0) blitzende.push(i)
    if (gegner[i].art.verhalten === 'schild') schildTraeger.push(i)
  }

  const drehung = s.zeit * 0.7
  const px = s.spieler.x
  const py = s.spieler.y

  zeichneSchildBoegen(ctx, s, schildTraeger)

  // Ueber die Eimer laufen, nicht ueber die feste Artenliste: Bosse bringen
  // eigene Arten mit, die dort nicht stehen - mit der alten Schleife waeren
  // sie unsichtbar gewesen.
  for (const [, liste] of gegnerEimer) {
    if (liste.length === 0) continue

    ctx.beginPath()
    for (let k = 0; k < liste.length; k++) {
      formPfad(ctx, gegner[liste[k]], px, py, drehung)
    }
    ctx.fillStyle = gegner[liste[0]].art.farbe
    ctx.fill()
    trennKante(ctx)
  }

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
  ctx.fillStyle = mitAlpha(FARBEN.treffer, 0.32)
  ctx.fill()
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
  ctx.lineWidth = 2
  ctx.strokeStyle = FARBEN.grund
  ctx.stroke()
}

/** Haengt die Umrissform eines Gegners an den aktuellen Pfad. */
function formPfad(
  ctx: CanvasRenderingContext2D,
  g: { x: number; y: number; radius: number; blick?: number; art: { form: string } },
  px: number,
  py: number,
  drehung: number,
): void {
  const r = g.radius

  if (g.art.form === 'dreieck') {
    // Spitze zeigt auf den Spieler: Das Dreieck sagt damit gleichzeitig
    // "schnell" und "kommt von dort".
    const dx = px - g.x
    const dy = py - g.y
    const laenge = Math.hypot(dx, dy) || 1
    const nx = dx / laenge
    const ny = dy / laenge
    ctx.moveTo(g.x + nx * r * 1.35, g.y + ny * r * 1.35)
    ctx.lineTo(
      g.x + (nx * FLANKE_COS - ny * FLANKE_SIN) * r,
      g.y + (nx * FLANKE_SIN + ny * FLANKE_COS) * r,
    )
    ctx.lineTo(
      g.x + (nx * FLANKE_COS + ny * FLANKE_SIN) * r,
      g.y + (-nx * FLANKE_SIN + ny * FLANKE_COS) * r,
    )
    ctx.closePath()
    return
  }

  if (g.art.form === 'quadrat') {
    // Achsenparallel und damit optisch ruhig - genau das soll ein Brocken
    // ausstrahlen. Der Gegensatz zu den zappelnden Dreiecken traegt die
    // Lesbarkeit.
    ctx.rect(g.x - r, g.y - r, r * 2, r * 2)
    return
  }

  if (g.art.form === 'raute') {
    // Auf die Spitze gestellt und mitdrehend: Der Schwaermer kreist, und die
    // Form soll das schon im Stand andeuten.
    const c = Math.cos(drehung * 0.8)
    const sn = Math.sin(drehung * 0.8)
    const lang = r * 1.5
    ctx.moveTo(g.x + c * lang, g.y + sn * lang)
    ctx.lineTo(g.x - sn * r * 0.62, g.y + c * r * 0.62)
    ctx.lineTo(g.x - c * lang, g.y - sn * lang)
    ctx.lineTo(g.x + sn * r * 0.62, g.y - c * r * 0.62)
    ctx.closePath()
    return
  }

  if (g.art.form === 'pfeil') {
    // Pfeil mit eingezogenem Heck - zeigt dorthin, wo er hinwill, und ist
    // damit auch waehrend der Vorwarnung eine Ansage.
    const dx = px - g.x
    const dy = py - g.y
    const laenge = Math.hypot(dx, dy) || 1
    const nx = dx / laenge
    const ny = dy / laenge
    const qx = -ny
    const qy = nx
    ctx.moveTo(g.x + nx * r * 1.6, g.y + ny * r * 1.6)
    ctx.lineTo(g.x - nx * r * 0.8 + qx * r, g.y - ny * r * 0.8 + qy * r)
    ctx.lineTo(g.x - nx * r * 0.25, g.y - ny * r * 0.25)
    ctx.lineTo(g.x - nx * r * 0.8 - qx * r, g.y - ny * r * 0.8 - qy * r)
    ctx.closePath()
    return
  }

  if (g.art.form === 'stern') {
    // Vierzackig, abwechselnd lang und kurz: sticht aus runden und eckigen
    // Formen heraus, damit man den Schuetzen im Gewuehl findet.
    for (let i = 0; i < 8; i++) {
      const w = drehung * 0.5 + (i * Math.PI) / 4
      const laenge = i % 2 === 0 ? r * 1.45 : r * 0.55
      const x = g.x + Math.cos(w) * laenge
      const y = g.y + Math.sin(w) * laenge
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    return
  }

  if (g.art.form === 'kreuz') {
    // Ein Pflasterkreuz. Der Kitt flickt Risse - die Form sagt es, bevor der
    // Spieler den Ring aufblitzen sieht.
    const d = r * 0.4
    ctx.moveTo(g.x - d, g.y - r)
    ctx.lineTo(g.x + d, g.y - r)
    ctx.lineTo(g.x + d, g.y - d)
    ctx.lineTo(g.x + r, g.y - d)
    ctx.lineTo(g.x + r, g.y + d)
    ctx.lineTo(g.x + d, g.y + d)
    ctx.lineTo(g.x + d, g.y + r)
    ctx.lineTo(g.x - d, g.y + r)
    ctx.lineTo(g.x - d, g.y + d)
    ctx.lineTo(g.x - r, g.y + d)
    ctx.lineTo(g.x - r, g.y - d)
    ctx.lineTo(g.x - d, g.y - d)
    ctx.closePath()
    return
  }

  if (g.art.form === 'doppelquadrat') {
    // Rahmen im Rahmen: "hieraus werden zwei". Der innere Ring laeuft
    // gegenlaeufig, damit die Fuellregel ihn als Loch stehen laesst.
    ctx.rect(g.x - r, g.y - r, r * 2, r * 2)
    const i = r * 0.44
    ctx.moveTo(g.x - i, g.y - i)
    ctx.lineTo(g.x - i, g.y + i)
    ctx.lineTo(g.x + i, g.y + i)
    ctx.lineTo(g.x + i, g.y - i)
    ctx.closePath()
    return
  }

  if (g.art.form === 'halbmond') {
    // Der Schildtraeger. Der Koerper ist ein Halbkreis, dessen flache Seite
    // dorthin zeigt, wo der Panzer sitzt - der Bogen davor wird getrennt
    // gezeichnet, weil er eine eigene Farbe braucht.
    const blick = g.blick ?? 0
    ctx.moveTo(g.x + Math.cos(blick + Math.PI / 2) * r, g.y + Math.sin(blick + Math.PI / 2) * r)
    ctx.arc(g.x, g.y, r, blick + Math.PI / 2, blick - Math.PI / 2)
    ctx.closePath()
    return
  }

  // Sechseck, langsam drehend.
  for (let i = 0; i < 6; i++) {
    const w = drehung + (i * Math.PI) / 3
    const x = g.x + Math.cos(w) * r
    const y = g.y + Math.sin(w) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
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

    // Zwei Durchgaenge ergeben ein Leuchten, ohne `shadowBlur` zu benutzen -
    // der ist bei dieser Menge um ein Vielfaches teurer als ein zweiter Pfad.
    ctx.beginPath()
    for (let k = 0; k < eimer.length; k++) {
      const p = liste[eimer[k]]
      ctx.moveTo(p.x + p.radius * 2.6, p.y)
      ctx.arc(p.x, p.y, p.radius * 2.6, 0, Math.PI * 2)
    }
    ctx.fillStyle = mitAlpha(farbe, 0.18)
    ctx.fill()

    ctx.beginPath()
    for (let k = 0; k < eimer.length; k++) {
      const p = liste[eimer[k]]
      ctx.moveTo(p.x + p.radius, p.y)
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    }
    ctx.fillStyle = farbe
    ctx.fill()
  }
}

function zeichneKristalle(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.kristalle.aktiv
  if (liste.length === 0) return

  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const k = liste[i]
    // Groesse zeigt den Wert: Ein Elite-Kristall soll aus der Ferne locken.
    const r = 4 + Math.min(6, k.wert)
    ctx.moveTo(k.x, k.y - r)
    ctx.lineTo(k.x + r, k.y)
    ctx.lineTo(k.x, k.y + r)
    ctx.lineTo(k.x - r, k.y)
    ctx.closePath()
  }
  ctx.fillStyle = FARBEN.kristall
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const k = liste[i]
    ctx.moveTo(k.x, k.y - 2.5)
    ctx.lineTo(k.x + 2.5, k.y)
    ctx.lineTo(k.x, k.y + 2.5)
    ctx.lineTo(k.x - 2.5, k.y)
    ctx.closePath()
  }
  ctx.fillStyle = FARBEN.kristallKern
  ctx.fill()
}

function zeichneSpieler(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const sp = s.spieler

  // Einzugsradius als hauchduenner Ring. Das Magnetfeld ist eine der besten
  // Aufwertungen - ohne sichtbaren Radius merkt der Spieler nie, dass sie
  // wirkt, und waehlt sie nie wieder.
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.magnetRadius, 0, Math.PI * 2)
  ctx.strokeStyle = mitAlpha(FARBEN.kristall, 0.09)
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
    ctx.strokeStyle = mitAlpha(FARBEN.textHervor, 0.55)
    ctx.lineWidth = 2.5
    ctx.stroke()
  } else {
    // Voll: ein geschlossener Ring, der leicht atmet - das liest sich als
    // "steht bereit" statt als "hier fehlt noch etwas".
    const puls = 0.35 + 0.2 * Math.sin(performance.now() / 320)
    ctx.beginPath()
    ctx.arc(sp.x, sp.y, sp.radius + 7, 0, Math.PI * 2)
    ctx.strokeStyle = mitAlpha(FARBEN.textHervor, puls)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Waehrend des Stosses eine Schleifspur in Stossrichtung.
  if (sp.stossRest > 0) {
    const laenge = Math.hypot(sp.stossVx, sp.stossVy) || 1
    ctx.beginPath()
    ctx.moveTo(sp.x, sp.y)
    ctx.lineTo(sp.x - (sp.stossVx / laenge) * 46, sp.y - (sp.stossVy / laenge) * 46)
    ctx.strokeStyle = mitAlpha(FARBEN.textHervor, 0.5)
    ctx.lineWidth = 5
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

  // Dunkler Hof, bevor irgendetwas Helles kommt.
  //
  // Im Screenshot aus der spaeten Phase ging die Figur in einem Teppich aus
  // Gegnern schlicht unter - sie wird zwar zuletzt gezeichnet und liegt damit
  // obenauf, aber hell auf hell trennt das Auge nicht. Ein dunkler Ring
  // darunter schneidet sie aus jedem Hintergrund heraus. In einem Spiel, in
  // dem man permanent ausweicht, ist die eigene Position die eine
  // Information, die niemals verloren gehen darf.
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius * 1.75, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(FARBEN.grund, 0.92)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius * 2.1, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(FARBEN.spieler, 0.16)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(sp.blitz > 0 ? FARBEN.gefahr : FARBEN.spieler, blinkt ? 0.4 : 1)
  ctx.fill()

  // Der Kern bleibt immer voll deckend - er ist der eine Punkt, an dem der
  // Spieler seine Position abliest.
  ctx.beginPath()
  ctx.arc(sp.x, sp.y, sp.radius * 0.42, 0, Math.PI * 2)
  ctx.fillStyle = FARBEN.spielerKern
  ctx.fill()
}

function zeichneZahlen(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.zahlen.aktiv
  if (liste.length === 0) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 19px ${SCHRIFT.mono}`

  for (let i = 0; i < liste.length; i++) {
    const z = liste[i]
    ctx.fillStyle = mitAlpha(z.krit ? FARBEN.krit : FARBEN.text, Math.min(1, z.leben * 2.2))
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
      ctx.fillStyle = mitAlpha(z.farbe, 0.1)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = mitAlpha(z.farbe, 0.55)
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

      // Schwarzer Kern.
      ctx.beginPath()
      ctx.arc(z.x, z.y, z.radius * 0.16, 0, Math.PI * 2)
      ctx.fillStyle = mitAlpha(FARBEN.grund, 0.95)
      ctx.fill()
      continue
    }

    ctx.beginPath()
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2)
    ctx.fillStyle = mitAlpha(z.farbe, 0.12 * rest)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = mitAlpha(z.farbe, 0.4 * rest)
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
  ctx.lineWidth = 1.6
  ctx.strokeStyle = mitAlpha(FARBEN.treffer, 0.8)
  ctx.stroke()
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

    // Kern: In Phase zwei weiss glühend statt in Bossfarbe - man soll den
    // Wechsel sehen, nicht nur merken.
    ctx.beginPath()
    ctx.arc(g.x, g.y, g.radius * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = z.phase === 1 ? mitAlpha(FARBEN.grund, 0.7) : mitAlpha(FARBEN.treffer, 0.85)
    ctx.fill()
  }
}

/** Bossgeschosse - rot, mit hellem Kern, damit sie nie mit eigenen verwechselt werden. */
function zeichneFeindSchuesse(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.feindSchuesse.aktiv
  if (liste.length === 0) return

  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i]
    ctx.moveTo(p.x + p.radius * 2.2, p.y)
    ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2)
  }
  ctx.fillStyle = mitAlpha(FARBEN.gefahr, 0.22)
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i]
    ctx.moveTo(p.x + p.radius, p.y)
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
  }
  ctx.fillStyle = FARBEN.gefahr
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = FARBEN.treffer
  ctx.stroke()
}
