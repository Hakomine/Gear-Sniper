// Gear Sniper – Live-Poller
//
// Der Sammler (collector.mjs) laeuft in GitHub Actions und ist dort real alle
// 17 bis 190 Minuten dran. Fuer Marktpreise reicht das voellig. Zum Sniping
// nicht: eine deutlich unterbewertete Karte ist nach 5 bis 15 Minuten weg.
// Wer erst nach einer Stunde pingt, kommt strukturell zu spaet.
//
// Deshalb dieser Dauerlaeufer auf dem eigenen PC:
//   - alle 60 Sekunden, nur die Jagd-Modelle, nur der eigene Umkreis
//   - nur Seite 1 – im 15-km-Radius passt der ganze lokale Markt eines
//     Modells da drauf, Sortierung ist deshalb egal
//   - Dedup ueber gesehen.json, es meldet also ausschliesslich Neues
//   - Marktpreis kommt aus markt.json, das der Sammler pflegt. Selbst
//     bundesweit nachrechnen wuerde ihn wieder langsam machen.
//
// Start:  live.cmd  (oder node sniper-live.mjs)
//         node sniper-live.mjs --once --dry-run    einmal, ohne Discord
//         node sniper-live.mjs --takt=120          langsamerer Takt
//
// Beenden: Strg+C

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { kleinanzeigenAds, passtZumModell, ladeJagdDbs, ladeStandort } from './collector.mjs';
import { rechneMarge, lohntSich, margeText } from './marge.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const P = (n) => path.join(__dirname, n);

const args = process.argv.slice(2);
const arg = (name, def = null) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : args.includes('--' + name) ? true : def;
};
const ONCE = !!arg('once');
const DRY = !!arg('dry-run');
const TAKT = Math.max(30, +arg('takt', 60)) * 1000;
// Zeigt die knapp Gescheiterten mit ihren Zahlen. Ohne das laesst sich nicht
// unterscheiden, ob gerade wirklich nichts da ist oder ob eine Schwelle zu
// hart steht – "0 Funde" sieht in beiden Faellen gleich aus.
const WARUM = !!arg('warum');

const CFG = JSON.parse(fs.readFileSync(P('config.json'), 'utf8'));
// Alle Kategorien, die als jagd*.json danebenliegen – Grafikkarten,
// Streaming-Gear, was spaeter dazukommt.
const DBS = ladeJagdDbs(__dirname);
const MODELLE = DBS.reduce((n, d) => n + d.db.modelle.length, 0);
// Ort kommt aus standort.json bzw. den Umgebungsvariablen, nicht aus config.json
const ST = ladeStandort(__dirname, CFG);

// Anzeigen 14 Tage lang merken. Kuerzer, und ein Angebot das laenger steht
// wuerde erneut als "neu" durchgehen.
const MERK_TAGE = 14;
const MAX_EMBEDS = 10;

// --- Webhook ------------------------------------------------------------
// Wie beim Key Sniper: Datei statt Konstante, damit die URL nie im Repo landet.
// Bewusst bei JEDEM Melden neu gelesen, nicht einmal beim Start: so nimmt ein
// laufender Poller den Webhook an, sobald die Datei da ist – ohne Neustart.
//
// Gesucht wird die erste Zeile, die wie eine URL aussieht. Damit darf in der
// Datei auch eine Anleitung stehen, ohne dass die als Adresse durchgeht.
function webhookUrl() {
  if (process.env.DISCORD_WEBHOOK?.startsWith('http')) return process.env.DISCORD_WEBHOOK.trim();
  try {
    return (
      fs
        .readFileSync(P('webhook.txt'), 'utf8')
        .split(/\r?\n/)
        .map((z) => z.trim())
        .find((z) => z.startsWith('https://')) || null
    );
  } catch {
    return null;
  }
}

// --- Gedaechtnis --------------------------------------------------------

const readJson = (n, f) => {
  try {
    return JSON.parse(fs.readFileSync(P(n), 'utf8'));
  } catch {
    return f;
  }
};

const gesehenDatei = P('gesehen.json');
// Ob die Datei VOR dem ersten Lauf existierte, entscheidet ueber den
// Einlaufmodus weiter unten – deshalb hier einmal festhalten.
const ersterStart = !fs.existsSync(gesehenDatei);
let gesehen = readJson('gesehen.json', {});

function merkeAufraeumen() {
  const grenze = Date.now() - MERK_TAGE * 86400e3;
  for (const [id, t] of Object.entries(gesehen)) if (t < grenze) delete gesehen[id];
}
function merkeSpeichern() {
  if (DRY) return;
  fs.writeFileSync(gesehenDatei, JSON.stringify(gesehen), 'utf8');
}

// --- Bewertung ----------------------------------------------------------

const pct = (ref, cur) => (!ref || ref <= 0 || cur == null ? 0 : Math.max(0, Math.round(((ref - cur) / ref) * 100)));
const eur = (n) => (n == null ? '–' : (+n).toFixed(2).replace('.', ',') + ' €');

function bewerte(ad, modell, markt, cfgK) {
  const mk = markt[modell.name];
  const ref = mk?.ref ?? modell.markt;
  if (!ref) return null;

  const p = pct(ref, ad.price);

  // Betrugsverdacht wird NICHT gemeldet – dieselbe Regel wie beim Sammler.
  // Wer auf eine 4090 fuer 400 € gepingt wird, gewoehnt sich an, Alarme
  // wegzuwischen, und uebersieht dann den echten Fund.
  if (p >= CFG.jagdScamPct) return { verworfen: 'Betrugsverdacht', p, ref };

  // Die ganze Verteilung uebergeben, nicht nur den Median: die Margenrechnung
  // setzt den Verkauf im unteren Viertel an, weil man zum schnellen Verkaufen
  // die anderen Angebote unterbieten muss.
  const marge = rechneMarge(ad.price, mk ?? ref, ad.km, cfgK);
  if (!lohntSich(marge, cfgK)) return { verworfen: 'Marge zu klein', p, ref, marge };

  return {
    ad,
    modell,
    ref,
    p,
    marge,
    refArt: mk?.refArt || 'geschätzter Marktpreis',
    warn: p >= CFG.jagdWarnPct,
  };
}

// --- Discord ------------------------------------------------------------

function anschreiben(fund) {
  return (
    `Hallo, ist die ${fund.modell.name} noch verfügbar? ` +
    `Ich könnte kurzfristig zum Abholen vorbeikommen und bar bezahlen. Viele Grüße`
  );
}

async function melde(funde) {
  const hook = webhookUrl();
  if (DRY || !hook) {
    if (!hook && !DRY) console.log('  ! kein Webhook (webhook.txt fehlt) – nichts gesendet');
    return;
  }

  const embeds = funde.slice(0, MAX_EMBEDS).map((f) => {
    const a = f.ad;
    const zeilen = [
      `**${eur(a.price)}**${a.vb ? ' VB' : ''} · Markt ${eur(f.ref)} · −${f.p} %`,
      `📍 ${a.ort || 'Ort unbekannt'}${a.km != null ? ` · ${a.km} km` : ' · direkt vor Ort'}` +
        (a.alterMin != null ? ` · Anzeige ${alterTxt(a.alterMin)} alt` : ''),
      margeText(f.marge),
      `Vergleich: ${f.refArt}`,
    ];
    if (f.warn) {
      zeilen.push(
        '🟡 **Ungewöhnlich günstig** – entweder ein echter Fund oder eine Masche. Genau hinschauen.'
      );
    }
    zeilen.push('🔍 Abholung mit Test im laufenden Rechner · kein Vorkasse-Versand · keine Freunde-Funktion');
    zeilen.push('💬 ' + anschreiben(f));

    return {
      title: (f.emoji || '🎯') + ' ' + String(a.title).slice(0, 240),
      url: 'https://www.kleinanzeigen.de' + a.href,
      description: zeilen.join('\n').slice(0, 4000),
      color: f.warn ? 16755200 : 5814783,
      thumbnail: a.img ? { url: a.img } : undefined,
      footer: { text: `Live-Poller · ${f.kategorie || 'Jagd'} · ${f.modell.name}` },
    };
  });

  const mehr = funde.length > MAX_EMBEDS ? ` (+${funde.length - MAX_EMBEDS} weitere)` : '';
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Gear Sniper Live',
        content: `⚡ **${funde.length} erreichbare${funde.length === 1 ? 'r Fund' : ' Funde'}**${mehr}`,
        embeds,
      }),
    });
    if (!res.ok) console.log('  ! Discord HTTP ' + res.status);
  } catch (e) {
    console.log('  ! Discord-Versand fehlgeschlagen: ' + e.message);
  }
}

const alterTxt = (min) =>
  min < 60 ? min + ' Min' : min < 1440 ? Math.round(min / 60) + ' Std' : Math.round(min / 1440) + ' Tage';

// --- Latenzprotokoll ----------------------------------------------------
//
// Die eigentliche Erfolgsfrage lautet nicht "findet er was", sondern "wie
// schnell". Deshalb wird jeder Fund mit seinem Anzeigenalter mitgeschrieben.
// Liegt der Median ueber ein paar Minuten, ist die Kette irgendwo verstopft
// und alles andere ist egal.
function protokolliere(funde) {
  if (DRY || !funde.length) return;
  const datei = P('latenz.csv');
  if (!fs.existsSync(datei)) {
    fs.writeFileSync(datei, 'zeitpunkt;modell;preis;km;anzeige_alter_min;netto\n', 'utf8');
  }
  const zeilen = funde
    .map((f) =>
      [
        new Date().toISOString(),
        f.modell.name,
        f.ad.price,
        f.ad.km ?? '',
        f.ad.alterMin ?? '',
        f.marge?.netto ?? '',
      ].join(';')
    )
    .join('\n');
  fs.appendFileSync(datei, zeilen + '\n', 'utf8');
}

// --- Ein Durchlauf ------------------------------------------------------

// Marktpreise holen. Erste Wahl ist die lokale markt.json, aber die ist nur
// frisch, wenn der Sammler auch lokal laeuft. Normalerweise laeuft er in GitHub
// Actions – deshalb wird bei veralteter oder fehlender Datei die Fassung aus
// dem Repo nachgeladen. Ohne das rechnet der Poller mit Preisen von vorgestern
// und meldet Funde, die keine sind.
let marktCache = null;
let marktGeholt = 0;

async function ladeMarkt() {
  const lokal = readJson('markt.json', null);
  const alter = lokal?.at ? Date.now() - Date.parse(lokal.at) : Infinity;
  if (alter < 6 * 3600e3) return lokal;

  // Hoechstens stuendlich nachfragen, sonst bei jedem Takt ein Abruf.
  if (marktCache && Date.now() - marktGeholt < 3600e3) return marktCache;
  if (!CFG.marktUrl) return lokal;

  try {
    const res = await fetch(CFG.marktUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    marktCache = await res.json();
    marktGeholt = Date.now();
    return marktCache;
  } catch (e) {
    console.log('  ! Marktpreise nicht aus dem Repo ladbar (' + e.message + ') – nehme die lokale Datei');
    return lokal;
  }
}

async function durchlauf(still) {
  const marktDatei = (await ladeMarkt()) || { modelle: {} };
  const markt = marktDatei.modelle || {};
  const marktAlter = marktDatei.at;

  const funde = [];
  const knapp = [];
  let geprueft = 0;
  let neu = 0;
  let fehler = 0;
  const verworfen = { Betrugsverdacht: 0, 'Marge zu klein': 0, 'kein Marktwert': 0 };

  for (const { db, filter } of DBS) {
    // Schwellen der Kategorie ueber die aus config.json legen – dieselbe
    // Zusammensetzung wie im Sammler, damit beide dasselbe fuer einen Fund
    // halten.
    const cfgK = { ...CFG, marge: { ...CFG.marge, ...(db.marge || {}) } };
    for (const m of db.modelle) {
      for (const q of m.queries) {
        let ads;
        try {
          ads = await kleinanzeigenAds(q, 1, CFG.kleinanzeigen.minPrice, CFG.jagdMaxPrice, ST);
        } catch (e) {
          fehler++;
          continue;
        }
        geprueft += ads.length;

        for (const ad of ads) {
          if (gesehen[ad.id]) continue;
          gesehen[ad.id] = Date.now();
          neu++;
          if (still) continue; // Einlaufrunde: nur merken, nicht melden
          if (!passtZumModell(ad, m, filter)) continue;

          const b = bewerte(ad, m, markt, cfgK);
          if (!b) verworfen['kein Marktwert']++;
          else if (b.verworfen) {
            verworfen[b.verworfen]++;
            if (WARUM) knapp.push({ ...b, ad, modell: m, kategorie: db.label, schwelle: cfgK.marge });
          } else funde.push({ ...b, kategorie: db.label, emoji: db.emoji });
        }
      }
    }
  }

  merkeAufraeumen();
  merkeSpeichern();

  const zeit = new Date().toLocaleTimeString('de-DE');
  if (still) {
    console.log(`[${zeit}] Einlaufrunde: ${neu} vorhandene Anzeigen gemerkt, nichts gemeldet.`);
    return;
  }

  funde.sort((a, b) => b.marge.netto - a.marge.netto);

  const marktWarn = !Object.keys(markt).length
    ? '  ! keine Marktpreise – erst "node collector.mjs --mode=fast" laufen lassen'
    : marktAlter && Date.now() - Date.parse(marktAlter) > 12 * 3600e3
      ? `  ! Marktpreise sind ${Math.round((Date.now() - Date.parse(marktAlter)) / 3600e3)} h alt`
      : null;

  console.log(
    `[${zeit}] ${geprueft} Anzeigen · ${neu} neu · ${funde.length} Fund${funde.length === 1 ? '' : 'e'}` +
      ` · verworfen: ${verworfen['Marge zu klein']} Marge, ${verworfen.Betrugsverdacht} Betrug` +
      (fehler ? ` · ${fehler} Abrufe fehlgeschlagen` : '')
  );
  if (marktWarn) console.log(marktWarn);

  for (const f of funde) {
    console.log(
      `    ${eur(f.ad.price).padStart(10)} → netto ${eur(f.marge.netto).padStart(9)} (${String(f.marge.pct).padStart(3)} %) · ` +
        `${String(f.ad.km ?? 0).padStart(2)} km · ${f.modell.name.padEnd(14)} ${f.ad.title.slice(0, 40)}`
    );
  }

  if (WARUM && knapp.length) {
    const schwellen = [...new Set(knapp.map((k) => `${k.kategorie}: ab ${k.schwelle.minEuro} € und ${k.schwelle.minPct} %`))];
    console.log(`  --- ${knapp.length} nicht gemeldet (${schwellen.join(' · ')}) ---`);
    const sortiert = knapp
      .filter((k) => k.marge)
      .sort((a, b) => b.marge.netto - a.marge.netto)
      .slice(0, 15);
    for (const k of sortiert) {
      console.log(
        `    ${eur(k.ad.price).padStart(10)} · Markt ${eur(k.ref).padStart(9)} · −${String(k.p).padStart(2)} % → ` +
          `netto ${eur(k.marge.netto).padStart(9)} (${String(k.marge.pct).padStart(4)} %) · ${k.verworfen.padEnd(15)} ` +
          `${k.modell.name.padEnd(16)} ${k.ad.title.slice(0, 32)}`
      );
    }
    const ohneMarge = knapp.filter((k) => !k.marge).length;
    if (ohneMarge) console.log(`    (${ohneMarge} weitere ohne berechenbare Marge)`);
    console.log('  ---');
  }

  if (funde.length) {
    protokolliere(funde);
    await melde(funde);
  }
}

// --- Hauptschleife ------------------------------------------------------

async function main() {
  if (!ST) {
    console.error('Kein Standort in config.json – der Live-Poller ist ohne Umkreis sinnlos.');
    process.exit(1);
  }
  console.log(
    `Gear Sniper Live · ${MODELLE} Modelle (${DBS.map((d) => d.db.label).join(', ')}) · ` +
      `${ST.radiusKm} km um ${ST.plz} ${ST.ort} · Takt ${TAKT / 1000}s${DRY ? ' · dry-run' : ''}`
  );
  if (!DRY && !webhookUrl()) {
    console.log(
      'Hinweis: in webhook.txt steht noch keine URL – es wird nur auf der Konsole gemeldet.\n' +
        '         Die Datei wird bei jeder Meldung neu gelesen, du kannst sie im Laufen ergänzen.'
    );
  }

  // Beim allerersten Start ist jede Anzeige "neu". Ohne Einlaufrunde kaeme
  // sofort eine Flut von Meldungen zu Angeboten, die seit Wochen stehen –
  // und genau die will der Poller ja gerade nicht melden.
  if (ersterStart && !ONCE) {
    console.log('Erster Start – eine stille Einlaufrunde, damit alte Anzeigen nicht als Funde durchgehen.');
    await durchlauf(true);
  }

  await durchlauf(false);
  if (ONCE) return;

  for (;;) {
    await new Promise((r) => setTimeout(r, TAKT));
    try {
      await durchlauf(false);
    } catch (e) {
      console.log('  ! Durchlauf abgebrochen: ' + e.message);
    }
  }
}

main().catch((e) => {
  console.error('Abbruch: ' + e.message);
  process.exit(1);
});
