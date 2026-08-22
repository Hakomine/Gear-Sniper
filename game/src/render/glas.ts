/**
 * Die Oberfläche aus Glas.
 *
 * Das Spiel heisst Scherbenfeld, die Gegner sind Glas, die Kernregel heisst
 * Risse. Dann soll die Oberflaeche auch aus Glas sein - nicht aus abgerundeten
 * Rechtecken. Genau das war die Rueckmeldung: "sieht aus, als haetten wir's
 * durch KI gemacht". Abgerundete Karten, zentrierte Monospace, gleichmaessige
 * Rahmen sind der Standardgriff, und man sieht ihn.
 *
 * Alles hier sind reine Canvas-Pfade: keine Bilder, keine Schriften, nichts
 * zum Nachladen.
 */

/**
 * Kleiner, stabiler Zufall aus einer Zahl.
 *
 * Wichtig ist die *Stabilitaet*: Eine Karte muss über alle Bilder hinweg
 * dieselbe Form haben. Waere sie zufaellig pro Bild, flackerte sie.
 */
function streu(saat: number, i: number): number {
  const x = Math.sin(saat * 12.9898 + i * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Leichte Neigung einer Platte, aus dem Saatwert abgeleitet. */
export function neigung(saat: number): number {
  return (streu(saat, 91) - 0.5) * 0.055
}

/**
 * Eine kantige Glasplatte als Pfad.
 *
 * Aufgebaut aus acht Punkten rund um das Rechteck, jeder leicht versetzt, und
 * einer tief abgeschlagenen Ecke. Dadurch wirkt jede Platte handgebrochen
 * statt gestanzt - und weil der Versatz aus dem Saatwert kommt, ist keine wie
 * die andere, aber jede bleibt sich treu.
 */
export function scherbenPfad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  saat: number,
): void {
  const k = 10 + streu(saat, 1) * 12
  const j = (i: number): number => (streu(saat, i) - 0.5) * 7
  // Welche Ecke abgeschlagen ist - eine von vier, aber immer dieselbe.
  const ecke = Math.floor(streu(saat, 2) * 4)

  const punkte: Array<[number, number]> = []
  const push = (px: number, py: number): void => {
    punkte.push([px, py])
  }

  // Oben links
  if (ecke === 0) {
    push(x + k, y + j(3))
    push(x + j(4), y + k)
  } else {
    push(x + j(3), y + j(4))
  }
  push(x + b * 0.55 + j(5), y + j(6))

  // Oben rechts
  if (ecke === 1) {
    push(x + b - k, y + j(7))
    push(x + b + j(8), y + k)
  } else {
    push(x + b + j(7), y + j(8))
  }
  push(x + b + j(9), y + h * 0.45 + j(10))

  // Unten rechts
  if (ecke === 2) {
    push(x + b + j(11), y + h - k)
    push(x + b - k, y + h + j(12))
  } else {
    push(x + b + j(11), y + h + j(12))
  }
  push(x + b * 0.4 + j(13), y + h + j(14))

  // Unten links
  if (ecke === 3) {
    push(x + k, y + h + j(15))
    push(x + j(16), y + h - k)
  } else {
    push(x + j(15), y + h + j(16))
  }
  push(x + j(17), y + h * 0.5 + j(18))

  ctx.beginPath()
  ctx.moveTo(punkte[0][0], punkte[0][1])
  for (let i = 1; i < punkte.length; i++) ctx.lineTo(punkte[i][0], punkte[i][1])
  ctx.closePath()
}

/**
 * Sprünge quer über eine Fläche.
 *
 * Sie laufen von Rand zu Rand mit einem Knick in der Mitte - eine gerade Linie
 * sieht aus wie ein Strich, eine geknickte wie ein Sprung im Glas. Denselben
 * Trick nutzen die Bruchlinien auf den Gegnern.
 */
export function bruchLinien(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  saat: number,
  anzahl: number,
): void {
  ctx.beginPath()
  for (let i = 0; i < anzahl; i++) {
    const vonY = y + streu(saat, i * 5 + 20) * h
    const bisY = y + streu(saat, i * 5 + 21) * h
    const knickX = x + (0.3 + streu(saat, i * 5 + 22) * 0.4) * b
    const knickY = y + streu(saat, i * 5 + 23) * h
    ctx.moveTo(x, vonY)
    ctx.lineTo(knickX, knickY)
    ctx.lineTo(x + b, bisY)
  }
}

/**
 * Der ganze Bildschirm springt.
 *
 * Für den Todesbildschirm: Strahlen vom Punkt des Todes nach aussen, jeder mit
 * einem Knick und ein paar Abzweigungen. `staerke` von 0 bis 1 waechst die
 * Sache heran, damit der Sprung sich ausbreitet statt einfach da zu sein.
 */
export function sprungOverlay(
  ctx: CanvasRenderingContext2D,
  breite: number,
  hoehe: number,
  staerke: number,
  saat: number,
  zentrumX: number,
  zentrumY: number,
): void {
  if (staerke <= 0) return
  const strahlen = 11
  const reichweite = Math.hypot(breite, hoehe) * staerke

  ctx.beginPath()
  for (let i = 0; i < strahlen; i++) {
    const winkel = (i / strahlen) * Math.PI * 2 + streu(saat, i) * 0.5
    const knick = reichweite * (0.35 + streu(saat, i + 40) * 0.25)
    const abweichung = (streu(saat, i + 60) - 0.5) * 0.5

    const kx = zentrumX + Math.cos(winkel) * knick
    const ky = zentrumY + Math.sin(winkel) * knick
    const ex = zentrumX + Math.cos(winkel + abweichung) * reichweite
    const ey = zentrumY + Math.sin(winkel + abweichung) * reichweite

    ctx.moveTo(zentrumX, zentrumY)
    ctx.lineTo(kx, ky)
    ctx.lineTo(ex, ey)

    // Eine Abzweigung je Strahl - ohne sie sieht es aus wie ein Stern, nicht
    // wie Bruch.
    const ax = kx + Math.cos(winkel - 0.9) * reichweite * 0.3
    const ay = ky + Math.sin(winkel - 0.9) * reichweite * 0.3
    ctx.moveTo(kx, ky)
    ctx.lineTo(ax, ay)
  }
}

/**
 * Ein Balken mit angeschraegten Enden.
 *
 * Der rechte Winkel ist das, was eine Anzeige nach Baukasten aussehen laesst.
 * Zwei schraege Enden kosten vier Punkte und ruecken den Balken in dieselbe
 * Formsprache wie die Scherben auf dem Feld. Als Pfad statt als Fuellung,
 * damit der Aufrufer ihn auch als Schnittmaske verwenden kann - so bleibt die
 * Fuellung im Balken, ohne dass sie selbst schraeg gerechnet werden muss.
 */
export function schraegBalken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  schraege: number,
): void {
  // Bei sehr kurzen Balken wuerde die Schraege die Enden ueberkreuzen.
  const s = Math.min(schraege, b / 2)
  ctx.beginPath()
  ctx.moveTo(x + s, y)
  ctx.lineTo(x + b, y)
  ctx.lineTo(x + b - s, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}


/**
 * Eine massive Platte - der Karten-Baustein dieser Bildsprache.
 *
 * Loest den schwerwiegendsten Fehler der vorherigen Runde ab. Damals wurden
 * Karten als duenne Umrisse mit Bruchlinien *quer durch die Textflaeche*
 * gezeichnet. Auf der Tuer "Ruhe" war dadurch "Nichts wird schwerer"
 * durchgestrichen, und der Titel hatte einen Strich mitten durchs Wort. Ein
 * Strich durch Text bedeutet ueberall *geloescht* oder *ungueltig* - das Auge
 * kann gar nicht anders, als das als kaputt zu lesen.
 *
 * Deshalb hier: volle Fuellung, dicke dunkle Kontur, harter Schlagschatten,
 * und die Akzentfarbe als Balken **oben**. Die Textflaeche bleibt frei. Die
 * Scherben-Herkunft steckt nur noch in der abgeschnittenen Ecke unten rechts -
 * ein Zitat, kein Zerstoerungswerk.
 */
export function massivePlatte(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  opt: {
    grund: string
    kontur: string
    akzent: string
    /** Ausgewaehlt: dickere Kontur, hoeherer Balken, tieferer Schatten. */
    aktiv?: boolean
    /** Wie tief die Ecke unten rechts abgeschnitten ist. */
    ecke?: number
  },
): void {
  const ecke = opt.ecke ?? 18
  const aktiv = opt.aktiv === true
  const tiefe = aktiv ? 7 : 5

  const pfad = (vx: number, vy: number): void => {
    ctx.beginPath()
    ctx.moveTo(x + vx, y + vy)
    ctx.lineTo(x + b + vx, y + vy)
    ctx.lineTo(x + b + vx, y + h - ecke + vy)
    ctx.lineTo(x + b - ecke + vx, y + h + vy)
    ctx.lineTo(x + vx, y + h + vy)
    ctx.closePath()
  }

  // Harter Schatten statt weichem Verlauf: Er sitzt in der Konturfarbe direkt
  // unter der Platte und macht sie zu einem Gegenstand, der auf dem Feld
  // liegt. Ein weicher Schatten waere hier nur Dunst.
  pfad(0, tiefe)
  ctx.fillStyle = opt.kontur
  ctx.fill()

  pfad(0, 0)
  ctx.fillStyle = opt.grund
  ctx.fill()
  ctx.lineJoin = 'round'
  ctx.lineWidth = aktiv ? 3.5 : 2.5
  ctx.strokeStyle = opt.kontur
  ctx.stroke()

  // Der Akzentbalken traegt die Farbe - Seltenheit, Tuerart, Charakter. Oben,
  // waagerecht, ausserhalb jeder Textzeile.
  ctx.save()
  pfad(0, 0)
  ctx.clip()
  ctx.fillStyle = opt.akzent
  ctx.fillRect(x, y, b, aktiv ? 8 : 5)
  ctx.restore()
}

/**
 * Bruchlinien als Randzier - nur im oberen Streifen, nie in der Textflaeche.
 *
 * Damit bleibt die Herkunft sichtbar, ohne dass eine Linie je ein Wort
 * durchschneidet. Wer sie tiefer setzen will, muss vorher pruefen, wo der Text
 * beginnt.
 */
export function randSpruenge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  hoehe: number,
  saat: number,
  farbe: string,
): void {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 3; i++) {
    const sx = x + streu(saat, i * 3 + 40) * b
    const tief = hoehe * (0.35 + streu(saat, i * 3 + 41) * 0.55)
    ctx.moveTo(sx, y)
    ctx.lineTo(sx + (streu(saat, i * 3 + 42) - 0.5) * 26, y + tief)
  }
  ctx.strokeStyle = farbe
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}
