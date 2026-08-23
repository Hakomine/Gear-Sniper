import { FARBEN } from '../render/palette'
import { artIndex, GEGNER_ARTEN } from './enemies'
import { risseLoeschen } from './risse'
import { legeGegner } from './spawner'
import type { Gegner, Spielstand } from './state'
import { gegnerImUmkreis, legeEffekt } from './welt'

/**
 * Gegner mit eigenem Kopf.
 *
 * Vorher liefen *alle* Gegner durch dieselben acht Zeilen: Richtung zum
 * Spieler, Tempo drauf, fertig. Drei Arten, ein Verhalten - deshalb fuehlte
 * sich das Spiel nach zehn Minuten an wie nach einer. Die Waffen waren
 * verschieden, aber alles, worauf sie zielten, war identisch.
 *
 * Aufgebaut wie `verhalten.ts` bei den Waffen: Die Arten sind Daten in
 * `enemies.ts`, das Verhalten ist eine Registratur hier. Ein neuer Gegnertyp
 * ist damit ein Tabelleneintrag, solange er ein vorhandenes Muster benutzt.
 *
 * **Wichtig fuer die Leistung:** Ein Verhalten liefert nur die
 * *Wunschgeschwindigkeit*. Das Auseinanderdruecken kommt in `state.ts`
 * unveraendert obendrauf - es ist gemessen und bezahlt seine eigene
 * Rechenzeit. Daran wird nicht gerueckt.
 */
export type GegnerVerhaltenId =
  | 'jaeger'
  | 'schwaermer'
  | 'stuermer'
  | 'speier'
  | 'teiler'
  | 'kitt'
  | 'schild'

/** Wunschgeschwindigkeit. Wiederverwendetes Objekt - kein Muell in der Schleife. */
export type Bewegung = { vx: number; vy: number }

export type GegnerVerhalten = {
  readonly bewege: (s: Spielstand, g: Gegner, dt: number, aus: Bewegung) => void
  /** Beim Tod, bevor der Pool ihn einzieht. */
  readonly beiTod?: (s: Spielstand, g: Gegner) => void
  /**
   * Schadensfaktor abhaengig davon, wo der Schaden herkommt.
   *
   * Als Quelle gilt der Spieler, nicht das einzelne Geschoss: Praktisch aller
   * Schaden geht von ihm aus, und "komm von hinten" ist die Ansage, die der
   * Spieler lesen soll - nicht "such den richtigen Splitterwinkel".
   */
  readonly schadensFaktor?: (g: Gegner, vonX: number, vonY: number) => number
}

// ---------------------------------------------------------------------------
// Werte
// ---------------------------------------------------------------------------

/** Auf welchem Abstand der Schwaermer kreist, und wie nah er im Anlauf kommt. */
const SCHWARM_WEIT = 250
const SCHWARM_NAH = 30
/** Ein voller Zyklus aus Kreisen und Anlauf. */
const SCHWARM_TAKT = 5.2

/** Ab hier hebt der Stuermer an, und wie lange die Vorwarnung dauert. */
const STURM_ABSTAND = 330
export const STURM_TELEGRAF = 0.7
const STURM_DAUER = 0.42
const STURM_TEMPO = 4.2
const STURM_PAUSE = 1.7

/**
 * Wie viele Feindgeschosse hoechstens gleichzeitig fliegen duerfen.
 *
 * Gemessen ohne Deckel: 1871 Stueck gleichzeitig. Das ist zweierlei Problem -
 * es kostet Rechenzeit (jedes wird pro Tick gegen den Spieler geprueft), und
 * es ist vor allem *unlesbar*. Eine Wand aus zweitausend Kugeln kann man nicht
 * mehr lesen, nur noch erleiden, und dann ist der telegrafierte Schuss des
 * Speiers keine Ansage mehr, sondern Rauschen.
 *
 * Der Deckel greift beim Schuetzen, nicht beim Pool: Wer nicht schiessen darf,
 * laedt einfach weiter - es geht nichts verloren ausser der Menge.
 */
export const MAX_FEIND_SCHUESSE = 260

/** Wunschabstand des Speiers und sein Schusstakt. */
const SPEIER_ABSTAND = 340
const SPEIER_TAKT = 2.2
const SPEIER_TEMPO = 250

/** Wie weit der Kitt Risse schliesst und wie oft. */
export const KITT_RADIUS = 130
const KITT_TAKT = 1.15

/** Wie schnell der Schild sich dreht und wie weit sein Panzer reicht. */
const SCHILD_DREHUNG = 1.25
export const SCHILD_WINKEL = 1.15
export const SCHILD_ABWEHR = 0.18

/**
 * Wiederverwendete Nachbarliste des Kitts.
 *
 * Darf geteilt werden, weil sie innerhalb eines Kitt-Ticks vollstaendig
 * abgearbeitet ist, bevor der naechste abfragt - dieselbe Begruendung wie bei
 * der Splitterkaskade in `welt.ts`. Wer hier eine Abfrage in die Schleife
 * baut, muss ein eigenes Array nehmen.
 */
const nachbarn: Gegner[] = []

// ---------------------------------------------------------------------------
// Die Muster
// ---------------------------------------------------------------------------

/** Richtung zum Spieler, Laenge 1. Schreibt in `aus`, damit nichts anfaellt. */
function zumSpieler(s: Spielstand, g: Gegner, aus: Bewegung): number {
  const dx = s.spieler.x - g.x
  const dy = s.spieler.y - g.y
  const d = Math.hypot(dx, dy) || 1
  aus.vx = dx / d
  aus.vy = dy / d
  return d
}

export const GEGNER_VERHALTEN: Record<GegnerVerhaltenId, GegnerVerhalten> = {
  /** Geradeaus. Die Grundmasse - und der Massstab, an dem alles andere auffaellt. */
  jaeger: {
    bewege(s, g, _dt, aus) {
      zumSpieler(s, g, aus)
      aus.vx *= g.tempo
      aus.vy *= g.tempo
    },
  },

  /**
   * Kreist auf Abstand und schliesst in Wellen.
   *
   * Der Gegner, der das Weglaufen entwertet: Wer vor einem Pulk herlaeuft,
   * hat den Schwaermer schon halb umrundet stehen.
   */
  schwaermer: {
    bewege(s, g, dt, aus) {
      g.takt += dt
      const phase = (g.takt % SCHWARM_TAKT) / SCHWARM_TAKT
      // Zwei Drittel kreisen, ein Drittel angreifen.
      const wunsch = phase < 0.66 ? SCHWARM_WEIT : SCHWARM_NAH

      const abstand = zumSpieler(s, g, aus)
      const radial = Math.max(-1, Math.min(1, (abstand - wunsch) / 90))
      // Senkrecht zur Blickrichtung: das eigentliche Kreisen.
      const tx = -aus.vy
      const ty = aus.vx
      const seite = g.id % 2 === 0 ? 1 : -1

      aus.vx = (aus.vx * radial + tx * seite * 0.85) * g.tempo
      aus.vy = (aus.vy * radial + ty * seite * 0.85) * g.tempo
    },
  },

  /**
   * Haelt an, kuendigt an, prescht.
   *
   * Der erste Gegner, dem man *ausweicht* statt vor ihm wegzulaufen - und
   * damit der Grund, warum es den Stoss gibt. Ohne Vorwarnung waere er nicht
   * schwer, sondern unfair; dieselbe Regel wie bei den Bossen.
   */
  stuermer: {
    bewege(s, g, dt, aus) {
      g.takt -= dt

      if (g.zustand === 1) {
        // Vorwarnung: steht still, die Linie liegt schon im Bild.
        aus.vx = 0
        aus.vy = 0
        if (g.takt <= 0) {
          g.zustand = 2
          g.takt = STURM_DAUER
          const dx = g.merkX - g.x
          const dy = g.merkY - g.y
          const d = Math.hypot(dx, dy) || 1
          g.merkX = (dx / d) * g.tempo * STURM_TEMPO
          g.merkY = (dy / d) * g.tempo * STURM_TEMPO
        }
        return
      }

      if (g.zustand === 2) {
        // Auf der festgelegten Bahn - nicht nachziehend. Ein Sturm, der
        // mitlenkt, laesst sich nicht ausweichen und ist keine Ansage mehr.
        aus.vx = g.merkX
        aus.vy = g.merkY
        if (g.takt <= 0) {
          g.zustand = 0
          g.takt = STURM_PAUSE
        }
        return
      }

      const abstand = zumSpieler(s, g, aus)
      aus.vx *= g.tempo
      aus.vy *= g.tempo
      if (g.takt > 0 || abstand > STURM_ABSTAND) return

      g.zustand = 1
      g.takt = STURM_TELEGRAF
      s.klaenge.melde('warnung', 0.6)
      g.merkX = s.spieler.x
      g.merkY = s.spieler.y
      const e = legeEffekt(s, 'strich', g.x, g.y, 0, STURM_TELEGRAF, FARBEN.gefahr, 4)
      if (e !== null) {
        e.x2 = g.merkX
        e.y2 = g.merkY
        e.warnung = true
      }
    },
  },

  /**
   * Bleibt weg und schiesst.
   *
   * Dreht die Fluchtrichtung um: Bisher war jede Bewegung ein Wegrennen. Der
   * Speier ist der erste Grund, sich in etwas *hinein* zu bewegen.
   */
  speier: {
    bewege(s, g, dt, aus) {
      g.takt -= dt
      const abstand = zumSpieler(s, g, aus)

      // Zu nah: zurueckweichen. Zu weit: nachruecken. Dazwischen: seitwaerts.
      const radial = Math.max(-1, Math.min(1, (abstand - SPEIER_ABSTAND) / 70))
      const tx = -aus.vy
      const ty = aus.vx
      const seite = g.id % 2 === 0 ? 1 : -1
      const zielX = aus.vx
      const zielY = aus.vy
      aus.vx = (zielX * radial + tx * seite * 0.4) * g.tempo
      aus.vy = (zielY * radial + ty * seite * 0.4) * g.tempo

      if (g.takt > 0 || abstand > SPEIER_ABSTAND * 1.6) return
      // Am Deckel wird nicht geschossen, aber weiter geladen: Der naechste
      // Schuss kommt, sobald wieder Platz ist.
      if (s.feindSchuesse.anzahl >= MAX_FEIND_SCHUESSE) return
      g.takt = SPEIER_TAKT

      const p = s.feindSchuesse.nimm()
      p.x = g.x
      p.y = g.y
      p.vx = zielX * SPEIER_TEMPO
      p.vy = zielY * SPEIER_TEMPO
      p.radius = 6
      p.schaden = g.schaden * 0.8
      p.leben = 3.2
      p.farbe = g.art.farbe
      // Der Schuss traegt die Identitaet seines Schuetzen bis zum Einschlag -
      // sonst zaehlten fuer die Kernscherbe alle Geschosse als dieselbe
      // Quelle, und "drei verschiedene Gegnerarten" waere im Fernkampf eine
      // Luege.
      p.quelle = artIndex(g.art)
    },
  },

  /**
   * Laeuft wie ein Jaeger und zerfaellt beim Tod in zwei Kleine.
   *
   * Straft das gedankenlose Abraeumen mit Flaechenwaffen: Ein voller Teppich
   * Teiler wird beim Wegputzen erst einmal *mehr*.
   */
  teiler: {
    bewege(s, g, _dt, aus) {
      zumSpieler(s, g, aus)
      aus.vx *= g.tempo
      aus.vy *= g.tempo
    },
    beiTod(s, g) {
      const klein = GEGNER_ARTEN.find((a) => a.id === 'teilerklein')
      if (klein === undefined) return
      for (let i = 0; i < 2; i++) {
        const w = (i / 2) * Math.PI * 2 + s.rng.next() * 0.6
        // Die Kleinen tragen `teilerklein` und teilen sich deshalb nicht
        // weiter - sonst waere ein Teiler eine Lawine ohne Ende.
        legeGegner(s, klein, g.x + Math.cos(w) * 18, g.y + Math.sin(w) * 18)
      }
    },
  },

  /**
   * Schliesst Risse bei allen Gegnern um sich herum.
   *
   * Der wichtigste Gegner, den dieses Spiel bekommen kann: Er greift genau
   * das an, worauf jeder Bau beruht. Damit gibt es zum ersten Mal eine
   * **Zielpriorität** - wen mache ich zuerst weg? Diese Frage stellte das
   * Spiel vorher nie.
   *
   * Seine *eigenen* Risse laesst er stehen. Sonst waere die Gegenwehr - ihn
   * zuerst zu erledigen - genau an ihm am schwersten.
   */
  kitt: {
    bewege(s, g, dt, aus) {
      g.takt -= dt
      const abstand = zumSpieler(s, g, aus)
      /*
       * Direkt hinter der Front, nicht dahinter geparkt.
       *
       * Zuerst stand er auf 210 Punkten - und damit ausserhalb dessen, worauf
       * die Waffen zielen, denn die nehmen sich den *naechsten* Gegner.
       * Gemessen: 228 Kitte auf dem Feld, wo die Gewichte 18 vorsehen. Sie
       * starben nie und liefen nie weg, also haeuften sie sich an, bis das
       * halbe Bild aus ihnen bestand.
       *
       * Auf 120 steht er mitten in der Reichweite. Er bleibt ein Stoerer, den
       * man wegmachen *muss* - aber einer, den man wegmachen *kann*.
       */
      const radial = Math.max(-1, Math.min(1, (abstand - 120) / 70))
      aus.vx *= g.tempo * radial
      aus.vy *= g.tempo * radial

      if (g.takt > 0) return
      g.takt = KITT_TAKT

      gegnerImUmkreis(s, g.x, g.y, KITT_RADIUS, nachbarn)
      for (let i = 0; i < nachbarn.length; i++) {
        const n = nachbarn[i]
        if (n === g || n.risse === 0) continue
        /*
         * Ein Kitt flickt keinen anderen Kitt.
         *
         * Ohne diese Zeile decken sich zwei Kitte gegenseitig: Keiner von
         * beiden kann mehr zerspringen, und weil sie damit deutlich laenger
         * leben als alles andere, haeufen sie sich an. Gemessen bestand das
         * halbe Feld nach vier Minuten aus ihnen. Der Gegner soll eine
         * Zielfrage stellen, keine unangreifbare Mauer bilden.
         */
        if (n.art.verhalten === 'kitt') continue
        risseLoeschen(n)
      }
      legeEffekt(s, 'ring', g.x, g.y, KITT_RADIUS, 0.35, g.art.farbe, 2)
    },
  },

  /**
   * Von vorn gepanzert, von hinten weich.
   *
   * Er dreht sich zum Spieler, aber begrenzt schnell - man kann ihn
   * umlaufen. Damit bekommt die eigene Position zum ersten Mal eine andere
   * Bedeutung als "weit weg".
   */
  schild: {
    bewege(s, g, dt, aus) {
      const dx = s.spieler.x - g.x
      const dy = s.spieler.y - g.y
      const ziel = Math.atan2(dy, dx)
      // Kuerzesten Weg auf dem Kreis nehmen, sonst dreht er einmal ganz herum.
      let diff = ziel - g.blick
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      const schritt = SCHILD_DREHUNG * dt
      g.blick += Math.max(-schritt, Math.min(schritt, diff))

      const d = Math.hypot(dx, dy) || 1
      aus.vx = (dx / d) * g.tempo
      aus.vy = (dy / d) * g.tempo
    },
    schadensFaktor(g, vonX, vonY) {
      const winkel = Math.atan2(vonY - g.y, vonX - g.x)
      let diff = winkel - g.blick
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      return Math.abs(diff) < SCHILD_WINKEL ? SCHILD_ABWEHR : 1
    },
  },
}
