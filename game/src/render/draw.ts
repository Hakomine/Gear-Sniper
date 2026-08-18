import { GEGNER_ARTEN } from '../game/enemies'
import type { Spielstand } from '../game/state'
import { zeichneLevelup, zeichneTitel, zeichneTod } from '../ui/menus'
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

    zeichneGitter(ctx, s)
    zeichneKristalle(ctx, s)
    zeichneGegner(ctx, s)
    zeichneGeschosse(ctx, s)
    zeichnePartikel(ctx, s)
    zeichneSpieler(ctx, s)
    zeichneZahlen(ctx, s)

    ctx.restore()

    // --- Bildschirm -------------------------------------------------------
    if (s.blitz > 0) {
      ctx.fillStyle = mitAlpha('#ffffff', s.blitz * 0.28)
      ctx.fillRect(0, 0, VIRT_B, VIRT_H)
    }

    if (s.phase !== 'titel') zeichneHud(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'titel') zeichneTitel(ctx, VIRT_B, VIRT_H)
    if (s.phase === 'levelup') zeichneLevelup(ctx, s, VIRT_B, VIRT_H)
    if (s.phase === 'tot') zeichneTod(ctx, s, VIRT_B, VIRT_H)
  }
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
    ctx.strokeStyle = stark ? FARBEN.gitterStark : FARBEN.gitter
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
function zeichneGegner(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  for (const liste of gegnerEimer.values()) liste.length = 0
  blitzende.length = 0

  const gegner = s.gegner.aktiv
  for (let i = 0; i < gegner.length; i++) {
    // Frisch getroffene Gegner kommen in einen eigenen weissen Durchgang -
    // dieser Aufblitzer ist die wichtigste Rueckmeldung im ganzen Spiel.
    if (gegner[i].blitz > 0) {
      blitzende.push(i)
      continue
    }
    const id = gegner[i].art.id
    let liste = gegnerEimer.get(id)
    if (liste === undefined) {
      liste = []
      gegnerEimer.set(id, liste)
    }
    liste.push(i)
  }

  const drehung = s.zeit * 0.7
  const px = s.spieler.x
  const py = s.spieler.y

  for (const art of GEGNER_ARTEN) {
    const liste = gegnerEimer.get(art.id)
    if (liste === undefined || liste.length === 0) continue

    ctx.beginPath()
    for (let k = 0; k < liste.length; k++) {
      formPfad(ctx, gegner[liste[k]], px, py, drehung)
    }
    ctx.fillStyle = art.farbe
    ctx.fill()
    trennKante(ctx)
  }

  if (blitzende.length > 0) {
    ctx.beginPath()
    for (let k = 0; k < blitzende.length; k++) {
      formPfad(ctx, gegner[blitzende[k]], px, py, drehung)
    }
    ctx.fillStyle = FARBEN.treffer
    ctx.fill()
    trennKante(ctx)
  }
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
  g: { x: number; y: number; radius: number; art: { form: string } },
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

function zeichneGeschosse(ctx: CanvasRenderingContext2D, s: Spielstand): void {
  const liste = s.geschosse.aktiv
  if (liste.length === 0) return

  // Zwei Durchgaenge ergeben ein Leuchten, ohne `shadowBlur` zu benutzen -
  // der ist bei dieser Menge um ein Vielfaches teurer als ein zweiter Pfad.
  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i]
    ctx.moveTo(p.x + p.radius * 2.6, p.y)
    ctx.arc(p.x, p.y, p.radius * 2.6, 0, Math.PI * 2)
  }
  ctx.fillStyle = mitAlpha(FARBEN.geschoss, 0.18)
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i]
    ctx.moveTo(p.x + p.radius, p.y)
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
  }
  ctx.fillStyle = FARBEN.geschoss
  ctx.fill()
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
