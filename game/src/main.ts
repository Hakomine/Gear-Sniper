import { Eingabe } from './core/input'
import { Schleife } from './core/loop'
import type { Befehle } from './game/state'
import { erzeugeSpielstand, tick } from './game/state'
import { ruesteAus, WAFFEN, werteAuf } from './game/weapons'
import { SICHT_RADIUS, Zeichner } from './render/draw'

/**
 * Aufbau und Verdrahtung.
 *
 * Diese Datei ist die Naht zwischen Browser und Spiel. Sie uebersetzt Tasten
 * in Absichten und reicht sie an die Simulation weiter - die selbst nichts
 * von einem Fenster weiss. Alles, was hier steht, waere beim Verpacken fuer
 * Steam der einzige Teil, der ueberhaupt angefasst werden muesste.
 */

const canvas = document.getElementById('spiel') as HTMLCanvasElement
// `alpha: false` erspart dem Browser das Durchmischen mit dem Seitenhintergrund.
const ctx = canvas.getContext('2d', { alpha: false })
if (ctx === null) throw new Error('Canvas 2D nicht verfügbar')

const zeichner = new Zeichner(canvas, ctx)
const eingabe = new Eingabe()

const spiel = erzeugeSpielstand(Date.now() >>> 0)
spiel.sichtRadius = SICHT_RADIUS

// Einmal angelegt und pro Tick ueberschrieben - kein Muell in der Schleife.
const befehle: Befehle = {
  x: 0,
  y: 0,
  bestaetigen: false,
  links: false,
  rechts: false,
  wahl: -1,
}
const bewegung = { x: 0, y: 0 }

const schleife = new Schleife({
  tick(dt) {
    eingabe.pollen()
    eingabe.bewegung(bewegung)

    befehle.x = bewegung.x
    befehle.y = bewegung.y
    // Bewegung liest gehaltene Tasten, Menuefuehrung nur die Flanke: Sonst
    // rast die Auswahl bei gehaltenem A durch alle Karten.
    befehle.bestaetigen = eingabe.getippt('bestaetigen')
    befehle.links = eingabe.getippt('links')
    befehle.rechts = eingabe.getippt('rechts')
    befehle.wahl = eingabe.getippt('wahl1')
      ? 0
      : eingabe.getippt('wahl2')
        ? 1
        : eingabe.getippt('wahl3')
          ? 2
          : -1

    tick(spiel, befehle, dt)
    eingabe.tickEnde()
  },

  render(alpha) {
    zeichner.zeichne(spiel, alpha)
  },
})

eingabe.verbinden()
zeichner.passeAn()
window.addEventListener('resize', () => zeichner.passeAn())
schleife.start()

// Griff fuer den Playwright-Test: Er startet den Lauf, liest den Zustand aus
// und kann Waffen ausruesten, statt sich auf Screenshots allein zu verlassen.
// Ohne den Zugriff auf `WAFFEN` liesse sich kein Bild von einem fertigen Bau
// machen - man muesste zehn Minuten spielen, um eine Vollendung zu sehen.
declare global {
  interface Window {
    __scherbenfeld?: {
      spiel: typeof spiel
      schleife: Schleife
      waffen: typeof WAFFEN
      ruesteAus: typeof ruesteAus
      werteAuf: typeof werteAuf
    }
  }
}
window.__scherbenfeld = { spiel, schleife, waffen: WAFFEN, ruesteAus, werteAuf }
