// Gear Sniper – Collector
// Sammelt Preise aus vier Quellen und schreibt sie in kompakte JSON-Dateien,
// die der Cloudflare Worker dann nur noch liest:
//
//   1. Elgato-Shop DE  – kompletter Katalog aus der Sitemap (UVP + aktueller Preis)
//   2. Watchlist       – beliebige Produkt-Links anderer Shops (watchlist.json)
//   3. Kleinanzeigen   – Gebraucht-Angebote, verglichen mit dem Neupreis
//   4. Jagd            – gezielte Modelle (jagd.json), verglichen mit dem
//                        Median vergleichbarer Anzeigen
//
// Läuft in GitHub Actions (und lokal per run.bat). Bewusst NICHT im Worker:
// ein Elgato-Produkt-JSON ist ~500 KB, das sprengt jedes Cloudflare-Free-Limit.
//
// Start:  node collector.mjs --mode=fast
//         node collector.mjs --mode=full
//         node collector.mjs --mode=fast --dry-run

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { rechneMarge, lohntSich } from './marge.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// --- Argumente ---------------------------------------------------------

const args = process.argv.slice(2);
const arg = (name, def = null) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : args.includes('--' + name) ? true : def;
};
const MODE = arg('mode', 'fast');
const DRY = !!arg('dry-run');
const SIMULATE = arg('simulate-deal', null);
const ONLY = arg('only', null); // elgato | watch | ka | jagd
const ZEIGE = arg('zeige', null); // Modellname: listet alle zugeordneten Anzeigen
const BUILDID = arg('buildid', null); // nur zum Testen: veraltete Elgato-buildId erzwingen

// Ehrlicher User-Agent statt Browser-Tarnung. Getestet: Elgato und
// Kleinanzeigen antworten damit genauso wie einem echten Browser.
const UA =
  process.env.SNIPER_UA ||
  'GearSniper/1.0 (persoenlicher Preiswecker, geringe Frequenz; Node ' + process.version + ')';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const eur = (n) => (n == null ? '–' : n.toFixed(2).replace('.', ',') + ' €');

// --- HTTP mit Bremse, Timeout und Wiederholung -------------------------

let lastCall = 0;

async function get(target, { accept = 'text/html', tries = 3 } = {}) {
  const wait = CFG.throttleMs - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'de-DE,de;q=0.9' },
        signal: AbortSignal.timeout(20000),
        redirect: 'follow',
      });
      if (res.status === 429 || res.status === 503) {
        const back = (i + 1) * 15000;
        console.log(`    Rate-Limit (${res.status}), warte ${back / 1000}s ...`);
        // Muss gesetzt werden, sonst fliegt nach dem letzten Versuch ein
        // nacktes null – und jeder catch, der e.message liest, kippt selbst um.
        lastErr = new Error('HTTP ' + res.status);
        lastErr.status = res.status;
        await sleep(back);
        continue;
      }
      if (!res.ok) {
        const err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      // 4xx sind endgültig – nochmal fragen bringt nichts
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) break;
      if (i < tries - 1) await sleep(2000 * (i + 1));
    }
  }
  throw lastErr || new Error('kein Erfolg und kein Fehler bei ' + target);
}

// --- Quelle 1: Elgato-Shop DE ------------------------------------------

// Die buildId steckt in jeder Seite und ändert sich bei jedem Deploy von
// Elgato. Deshalb pro Lauf frisch holen – hartkodiert wäre sie morgen tot.
async function elgatoBuildId() {
  const html = await get(CFG.elgato.base + '/' + CFG.elgato.locale);
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('buildId nicht gefunden – hat Elgato die Seite umgebaut?');
  return m[1];
}

async function elgatoCatalog() {
  const xml = await get(CFG.elgato.sitemap, { accept: 'application/xml' });
  const slugs = [...xml.matchAll(/<loc>[^<]*\/p\/([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return [...new Set(slugs)];
}

async function elgatoProduct(buildId, slug) {
  const u = `${CFG.elgato.base}/_next/data/${buildId}/${CFG.elgato.locale}/p/${slug}.json`;
  const raw = await get(u, { accept: 'application/json' });
  const it = JSON.parse(raw)?.pageProps?.productData?.productDetail?.items?.[0];
  if (!it) return null;

  const mp = it.price_range?.minimum_price;
  const reg = mp?.regular_price?.value;
  const cur = mp?.final_price?.value;
  if (typeof cur !== 'number' || typeof reg !== 'number' || reg <= 0) return null;

  return {
    id: 'elgato:' + it.sku,
    src: 'elgato',
    sku: it.sku,
    name: it.name,
    shop: 'Elgato',
    url: `${CFG.elgato.base}/${CFG.elgato.locale}/p/${slug}`,
    img: it.image?.url || it.small_image?.url || it.media_gallery?.[0]?.url || null,
    cur: round2(cur),
    ref: round2(reg),
    pct: pct(reg, cur),
    stock: it.stock_status || null,
  };
}

async function collectElgato(mode, prevItems, state) {
  console.log('\n[1/4] Elgato-Shop');
  // --buildid=kaputt erzwingt eine veraltete ID, um die Selbstheilung unten zu testen
  let buildId = BUILDID || (await elgatoBuildId());
  console.log('  buildId: ' + buildId);

  const all = await elgatoCatalog();
  console.log('  Katalog: ' + all.length + ' Produkte');

  let slugs = all;
  if (mode === 'fast') {
    // Schnelllauf: alles was zuletzt reduziert war (das will man engmaschig
    // beobachten) plus ein rotierender Block, damit auch neue Sales innerhalb
    // weniger Stunden auffallen statt erst beim Nachtlauf.
    const hot = new Set(
      prevItems.filter((p) => p.src === 'elgato' && (p.pct > 0 || p.atLow)).map((p) => slugOf(p.url))
    );
    const cursor = state.cursor || 0;
    const block = [];
    for (let i = 0; i < Math.min(CFG.fastBlock, all.length); i++) {
      block.push(all[(cursor + i) % all.length]);
    }
    state.cursor = (cursor + CFG.fastBlock) % all.length;
    slugs = [...new Set([...hot, ...block])].filter(Boolean);
    console.log(`  Schnelllauf: ${slugs.length} Produkte (${hot.size} beobachtet + Block ab ${cursor})`);
  }

  const out = [];
  const nachzuegler = [];
  let fails = 0;
  let neueId = 0; // wie oft die buildId schon nachgeholt wurde

  for (let i = 0; i < slugs.length; i++) {
    try {
      const p = await elgatoProduct(buildId, slugs[i]);
      if (p) out.push(p);
      fails = 0;
    } catch (e) {
      fails++;
      nachzuegler.push(slugs[i]);
      console.log(`    ! ${slugs[i]}: ${e.message}`);

      // Häufen sich die Fehler, hat Elgato vermutlich mitten im Lauf etwas
      // veröffentlicht – dann stimmt die buildId nicht mehr und ALLE weiteren
      // Abrufe laufen auf 404. Genau daran ist der Nachtlauf am 07.08.2026
      // gescheitert. Also neue holen und weitermachen statt abzubrechen.
      // Ein Schnelllauf trifft das kaum, ein 25-Minuten-Volllauf schon.
      if (fails >= 5 && neueId < 3) {
        neueId++;
        try {
          const frisch = await elgatoBuildId();
          if (frisch !== buildId) {
            console.log(`  buildId hat sich geändert: ${buildId} -> ${frisch}, mache weiter`);
            buildId = frisch;
            i--; // denselben Slug gleich nochmal, diesmal mit der neuen ID
          }
          fails = 0;
          continue;
        } catch (e2) {
          console.log('    buildId nicht erneuerbar: ' + e2.message);
        }
      }

      if (fails >= 20) throw new Error('20 Fehler in Folge bei Elgato – Abbruch (' + e.message + ')');
    }
    if ((i + 1) % 50 === 0) console.log(`  ... ${i + 1}/${slugs.length}`);
  }

  // Zweiter Anlauf für die Gescheiterten. Lohnt vor allem nach einem
  // buildId-Wechsel: die ersten paar Produkte fallen durch, bevor der Wechsel
  // überhaupt auffällt – die wären sonst für diesen Lauf verloren.
  const offen = [...new Set(nachzuegler)].filter((s) => !out.some((p) => slugOf(p.url) === s));
  if (offen.length) {
    console.log(`  Zweiter Anlauf für ${offen.length} Nachzügler ...`);
    let geholt = 0;
    for (const slug of offen) {
      try {
        const p = await elgatoProduct(buildId, slug);
        if (p) {
          out.push(p);
          geholt++;
        }
      } catch {
        // beim zweiten Mal endgültig – kommt beim nächsten Lauf wieder dran
      }
    }
    console.log(`  ${geholt} davon nachgeholt`);
  }

  console.log('  ' + out.length + ' Preise geholt');
  return out;
}

const slugOf = (u) => (u || '').split('/p/')[1] || null;

// --- Quelle 2: Watchlist (beliebige Shops) -----------------------------

// Preis aus einer fremden Produktseite ziehen. Reihenfolge nach Zuverlässigkeit:
// JSON-LD ist standardisiert, der Rest ist Fallback.
export function extractPrice(html, custom) {
  if (custom) {
    const m = html.match(new RegExp(custom));
    const v = num(m?.[1]);
    if (v) return { price: v, via: 'regex' };
  }

  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const found = findOffer(data);
    if (found) return { price: found, via: 'json-ld' };
  }

  const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i);
  if (num(meta?.[1])) return { price: num(meta[1]), via: 'meta' };

  const micro = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i);
  if (num(micro?.[1])) return { price: num(micro[1]), via: 'microdata' };

  return null;
}

// Rekursiv durch JSON-LD laufen – manche Shops verschachteln in @graph,
// itemListElement oder liefern ein Array von Offers.
function findOffer(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const v = findOffer(n, depth + 1);
      if (v) return v;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  const t = String(node['@type'] || '');
  if (/Offer/i.test(t)) {
    const v = num(node.price) ?? num(node.lowPrice);
    if (v) return v;
  }
  for (const key of ['offers', '@graph', 'itemListElement', 'mainEntity', 'hasVariant']) {
    if (node[key]) {
      const v = findOffer(node[key], depth + 1);
      if (v) return v;
    }
  }
  return null;
}

async function collectWatchlist() {
  console.log('\n[2/4] Watchlist');
  const file = path.join(__dirname, 'watchlist.json');
  if (!fs.existsSync(file)) {
    console.log('  keine watchlist.json – übersprungen');
    return [];
  }
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];

  for (const e of list) {
    const base = {
      id: 'watch:' + hash(e.url),
      src: 'watch',
      name: e.name || e.url,
      shop: e.shop || hostOf(e.url),
      url: e.url,
      img: e.img || null,
      ref: e.uvp ?? null,
      stock: null,
    };
    try {
      const html = await get(e.url);
      const hit = extractPrice(html, e.regex);
      if (!hit) {
        console.log(`  ? ${base.name}: kein Preis gefunden (Seite geladen)`);
        out.push({ ...base, cur: null, pct: 0, status: 'no-price' });
        continue;
      }
      // Ohne eingetragene UVP kommt die Referenz aus dem Preisverlauf
      // (höchster je gesehener Preis) – siehe updateHistory. Sie hier auf den
      // aktuellen Preis zu setzen hieße: Rabatt ist immer null.
      out.push({
        ...base,
        cur: round2(hit.price),
        ref: base.ref != null ? round2(base.ref) : null,
        pct: base.ref != null ? pct(base.ref, hit.price) : 0,
        refFromHistory: base.ref == null,
        status: 'ok',
      });
      console.log(`  ✓ ${base.name}: ${eur(hit.price)} (${hit.via})`);
    } catch (e2) {
      // Erwartbar: viele Shops sperren Server-IPs aus. Das ist kein Bug,
      // das gehört sichtbar in die App statt still zu verschwinden.
      console.log(`  × ${base.name}: nicht abrufbar (${e2.message})`);
      out.push({ ...base, cur: null, pct: 0, status: 'blocked', note: e2.message });
    }
  }
  return out;
}

// --- Quelle 3: Kleinanzeigen (gebraucht) -------------------------------

// Wanted-Ads und Tauschgesuche raus – wir wollen Angebote, keine Suchenden.
// Nicht nur am Titelanfang prüfen: "Ich werde kaufen RTX 5090" stand so
// zwischen den Grafikkarten-Treffern.
const WANTED = /^(\W*\w+){0,3}\W*\b(suche|suchen|kaufe|kaufen|tausche|ankauf|gesucht|biete an fuer)\b/i;

// Vermietung ist kein Kauf. Stand echt in den Treffern: "MIETE Elgato Cam Link
// 4K – 15 €" sah aus wie −85%, war aber ein Tagespreis.
const RENTAL = /\b(miete|mieten|vermiete|vermietung|leihen|leihe|verleih)\b/i;

// Zubehör zum Gerät ist nicht das Gerät. "Stream Deck Mini Halterung für Sim
// Racing" wurde sonst gegen den Preis eines Stream Deck Mini gerechnet.
// Bewusst NICHT drin: "Zubehör", "Standfuß", "Kabel" – die stehen auch in
// ganz normalen Geräte-Anzeigen ("… mit Zubehör und OVP").
const ACCESSORY = /\b(halterung|halter|mount|case|huelle|tasche|skin|aufkleber|faceplate|abdeckung|schutzfolie|tastenkappen)\b/;

// Kaputt ist kein Schnäppchen. Eine defekte Kamera für 30% des Marktpreises
// ist genau das, was sie kostet – und würde den Alarm dauerhaft verstopfen.
const DEFECT = /\b(defekt|kaputt|bastler|ersatzteil|ersatzteile|fuer teile|nicht funktionsfaehig|gebrochen)\b/;

// Zubehör rund um Kameras. Der erste Testlauf fischte fast nur so was:
// SmallRig-Cages, Handgriffe, Fachbücher – und eine Kia-Stahlfelge mit der
// Teilenummer 52910-A6000.
// HART: Wörter, die eine Kamera-Anzeige ausschließen, egal wo sie stehen.
// "kompatibel" ist das beste Einzelsignal überhaupt – so schreibt niemand
// über eine Kamera, aber jeder Zubehör-Verkäufer.
const CAM_ACCESSORY =
  /\b(\w*buch|cage|kaefig|smallrig|rig|akku\w*|batterie|ladegeraet|ladestation|blitz\w*|gurt|speicherkarte|fernausloeser|fernbedienung|anleitung|ratgeber|displayschutz|schutzfolie|schutzglas|zwischenring|telekonverter|softbox|gimbal|unterwassergehaeuse|kompatibel|ersatzakku)\b/;

// WEICH: Wörter, die auch in echten Angeboten vorkommen ("A6400 mit 16-50
// Objektiv", "inkl. Tasche"). Die zählen nur, wenn sie vorne stehen oder ein
// "für <Modell>" dahinter kommt – dann ist es Zubehör FÜR die Kamera.
const CAM_SOFT_WORDS =
  'objektiv|griff|grip|halterung|halter|platte|winkel|tasche|koffer|adapter|deckel|filter|stativ|sucher|schutz|' +
  // Grafikkarten-Zubehoer: "Luefter fuer RTX 3070" ist keine Grafikkarte
  'luefter|kuehler|kuehlkoerper|wasserkuehler|wasserblock|backplate|riser|stuetze|halteb|blende';
const CAM_SOFT = new RegExp('\\b(' + CAM_SOFT_WORDS + ')\\w*\\b');
const CAM_SOFT_FUER = new RegExp('\\b(' + CAM_SOFT_WORDS + ')\\w*\\s+(fuer|for)\\b');

function isAccessoryAd(t) {
  if (CAM_ACCESSORY.test(t)) return true;
  const head = ' ' + t.trim().split(' ').slice(0, 3).join(' ') + ' ';
  if (CAM_SOFT.test(head) || ACCESSORY.test(head)) return true;
  return CAM_SOFT_FUER.test(t);
}

// Wo im Titel steht der Modellname? Das ist der eigentliche Trick: bei einer
// echten Kamera-Anzeige steht das Modell vorne ("Sony Alpha 6000 Gehäuse"),
// bei Zubehör hinten in einer Kompatibilitätsliste ("Baxxtar Akku … für
// Sony A6000 A6300 A6400").
function phrasePos(words, phrases) {
  let best = { pos: -1, len: 0 };
  for (const p of phrases) {
    const pw = p.split(' ');
    for (let i = 0; i + pw.length <= words.length; i++) {
      if (pw.every((w, k) => words[i + k] === w)) {
        if (best.pos === -1 || i < best.pos) best = { pos: i, len: pw.length };
        break;
      }
    }
  }
  return best;
}

// Wo gesucht wird – bewusst NICHT in config.json, weil das Repo oeffentlich ist.
// Eine Postleitzahl plus Abholradius sagt mehr ueber jemanden aus, als es
// aussieht. Gelesen wird in dieser Reihenfolge:
//
//   1. Umgebungsvariablen SNIPER_ORT_ID / SNIPER_PLZ / SNIPER_ORT
//      -> so kommt der Ort in GitHub Actions rein, als Repo-Secrets
//   2. standort.json daneben (lokal, per .gitignore geschuetzt)
//   3. config.json, falls es doch jemand dort eintraegt
//
// Ohne Orts-ID kommt null zurueck und alles sucht bundesweit wie frueher.
export function ladeStandort(dir, cfg) {
  const basis = cfg.standort || {};
  let datei = {};
  try {
    datei = JSON.parse(fs.readFileSync(path.join(dir, 'standort.json'), 'utf8'));
  } catch {
    /* gibt es nicht, kein Problem */
  }

  const ortId = Number(process.env.SNIPER_ORT_ID || datei.ortId || basis.ortId) || null;
  if (!ortId) return null;

  return {
    ...basis,
    ortId,
    plz: process.env.SNIPER_PLZ || datei.plz || basis.plz || '',
    ort: process.env.SNIPER_ORT || datei.ort || basis.ort || '',
    radiusKm: Number(process.env.SNIPER_RADIUS_KM || datei.radiusKm || basis.radiusKm) || 15,
  };
}

const STANDORT = ladeStandort(__dirname, CFG);

// Der Ortsteil der Such-URL. Kleinanzeigen haengt Ort und Umkreis an das "k0":
// k0l<ortId>r<km>, also z.B. k0l1234r15 = Ort 1234, 15 km Umkreis. Die Orts-ID
// liefert https://www.kleinanzeigen.de/s-ort-empfehlungen.json?query=<PLZ>
function ortSuffix(standort) {
  if (!standort?.ortId) return 'k0';
  return 'k0l' + standort.ortId + (standort.radiusKm ? 'r' + standort.radiusKm : '');
}

// Eine Kleinanzeigen-Suche abrufen. Seite 6+ sperrt deren robots.txt.
//
// standort ist optional – ohne ihn sucht die Funktion bundesweit wie bisher.
// Das ist wichtig, weil die Elgato- und Watchlist-Quellen den Umkreis nicht
// wollen: dort geht es um Shop-Preise, nicht ums Abholen.
export async function kleinanzeigenAds(query, pages, minPrice, maxPrice, standort = null) {
  const slug = query.trim().toLowerCase().replace(/\s+/g, '-');
  const suffix = ortSuffix(standort);
  const out = [];
  for (let page = 1; page <= Math.min(pages, 5); page++) {
    const u =
      page === 1
        ? `https://www.kleinanzeigen.de/s-preis:${minPrice}:${maxPrice}/${slug}/${suffix}`
        : `https://www.kleinanzeigen.de/s-preis:${minPrice}:${maxPrice}/seite:${page}/${slug}/${suffix}`;
    let ads;
    try {
      ads = parseKleinanzeigen(await get(u));
    } catch (e) {
      console.log(`  × "${query}" Seite ${page}: nicht abrufbar (${e.message})`);
      break;
    }
    if (!ads.length) break;
    out.push(...ads);
  }

  // Kleinanzeigen nimmt den Umkreis nur als Wunsch. Gemessen am 09.08.2026 ueber
  // alle 18 Jagd-Modelle: von 310 Treffern einer r15-Suche lagen 110 weiter weg
  // als 15 km, der aeusserste 50 km (Duelmen). Die Suche weitet still auf, wenn
  // sonst zu wenig uebrig bliebe. Wer nicht hinfahren kann, hat davon nichts,
  // also wird hier hart nachgeschnitten.
  //
  // Anzeigen OHNE Entfernungsangabe bleiben absichtlich drin: nachgemessen
  // standen die ausnahmslos im Suchort selbst. Kleinanzeigen laesst die Angabe
  // weg, wenn die Entfernung null ist – das sind also die naechsten Anzeigen
  // ueberhaupt und nicht etwa welche mit unbekanntem Ort.
  if (standort?.ortId && standort.hartFiltern && standort.radiusKm) {
    return out.filter((a) => a.km == null || a.km <= standort.radiusKm);
  }
  return out;
}

// Anzeigen, die generell nicht als Kauf zählen
const isJunk = (ad) => !ad.price || WANTED.test(ad.title) || RENTAL.test(ad.title) || DEFECT.test(norm(ad.title));

// Wie alt ist die Anzeige? Kleinanzeigen schreibt "Heute, 14:32",
// "Gestern, 09:05" oder ein Datum. Nur der Heute-Fall ist minutengenau – und
// genau der zaehlt, denn ein Fund von gestern ist ohnehin weg.
export function adAlterMin(zeitTxt, jetzt = new Date()) {
  if (!zeitTxt) return null;
  const uhr = zeitTxt.match(/(\d{1,2}):(\d{2})/);
  if (/heute/i.test(zeitTxt) && uhr) {
    const t = new Date(jetzt);
    t.setHours(+uhr[1], +uhr[2], 0, 0);
    // Anzeige "spaeter" als jetzt = Uhrzeit von gestern kurz vor Mitternacht
    const min = Math.round((jetzt - t) / 60000);
    return min >= 0 ? min : min + 1440;
  }
  if (/gestern/i.test(zeitTxt) && uhr) {
    const t = new Date(jetzt);
    t.setDate(t.getDate() - 1);
    t.setHours(+uhr[1], +uhr[2], 0, 0);
    return Math.round((jetzt - t) / 60000);
  }
  const d = zeitTxt.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (d) return Math.round((jetzt - new Date(+d[3], +d[2] - 1, +d[1])) / 60000);
  return null;
}

export function parseKleinanzeigen(html, jetzt = new Date()) {
  const out = [];
  for (const block of html.split(/(?=<article[^>]*class="aditem)/).slice(1)) {
    const id = block.match(/data-adid="(\d+)"/)?.[1];
    const href = block.match(/data-href="([^"]+)"/)?.[1];
    const title = clean(block.match(/<a[^>]*class="ellipsis"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    const priceTxt = clean(block.match(/price-shipping--price">([\s\S]*?)</)?.[1]);
    const img = block.match(/<img[^>]*src="([^"]+)"/)?.[1] || null;
    if (!id || !href || !title) continue;

    // "1.250 € VB" / "50 €" / "Zu verschenken"
    const price = num((priceTxt || '').replace(/\./g, '').replace(/\s*€.*$/, ''));

    // Bei einer Umkreissuche steht die Entfernung im Ort mit drin:
    // "47441 Moers (13 km)". Geschenkt – die muss niemand selbst ausrechnen.
    //
    // Achtung: bei ungenau hinterlegten Orten schreibt Kleinanzeigen
    // "48249 Dülmen (ca. 50 km)". Ohne das optionale "ca." blieb km null,
    // und weil der Umkreisfilter unbekannte Entfernungen durchlaesst, stand
    // prompt ein 50-km-Fund in der 15-km-Liste.
    const ortTxt = clean(block.match(/aditem-main--top--left"[^>]*>([\s\S]*?)<\/div>/)?.[1]);
    const km = num(ortTxt.match(/\(\s*(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*km\s*\)/i)?.[1]);
    const ort = ortTxt.replace(/\s*\(\s*(?:ca\.?\s*)?[\d.,]+\s*km\s*\)\s*$/i, '').trim() || null;

    const zeit = clean(block.match(/aditem-main--top--right"[^>]*>([\s\S]*?)<\/div>/)?.[1]) || null;

    out.push({
      id,
      href,
      title,
      price,
      img,
      vb: /VB/i.test(priceTxt || ''),
      ort,
      km,
      zeit,
      alterMin: adAlterMin(zeit, jetzt),
    });
  }
  return out;
}

async function collectKleinanzeigen(catalog) {
  console.log('\n[3/4] Kleinanzeigen (gebraucht)');
  if (!CFG.kleinanzeigen.enabled) {
    console.log('  deaktiviert');
    return [];
  }
  const ka = CFG.kleinanzeigen;
  const seen = new Set();
  const out = [];
  // Gebrauchtes Streaming-Gear ist klein und wird oft verschickt – deshalb ist
  // der Umkreis hier abschaltbar, anders als bei der Jagd auf Grafikkarten.
  const st = ka.umkreis ? STANDORT : null;

  for (const q of ka.queries) {
    const ads = await kleinanzeigenAds(q, ka.pages, ka.minPrice, ka.maxPrice, st);
    for (const ad of ads) {
      if (seen.has(ad.id)) continue;
      seen.add(ad.id);
      if (isJunk(ad)) continue;

      const match = matchProduct(ad.title, catalog);
      if (!match) continue; // ohne Neupreis kein Vergleich – kein Rabatt berechenbar

      const p = pct(match.ref, ad.price);
      out.push({
        id: 'ka:' + ad.id,
        src: 'ka',
        name: ad.title,
        shop: 'Kleinanzeigen',
        url: 'https://www.kleinanzeigen.de' + ad.href,
        img: ad.img,
        cur: ad.price,
        ref: match.ref,
        pct: p,
        stock: 'USED',
        match: match.name,
        vb: ad.vb,
        ort: ad.ort,
        km: ad.km,
        alterMin: ad.alterMin,
        // Auffällig weit unter Neupreis: eher Betrugsmasche oder defekt.
        // Nicht wegwerfen, aber markieren – die Entscheidung trifft Hakan.
        sus: p >= CFG.suspiciousPct,
      });
    }
    console.log(`  "${q}": ${ads.length} Anzeigen`);
  }
  const hits = out.filter((o) => o.pct >= CFG.usedMinPct).length;
  console.log(`  ${out.length} zuordenbare Angebote, davon ${hits} über ${CFG.usedMinPct}% unter Neupreis`);
  return out;
}

// --- Quelle 4: Die Jagd ------------------------------------------------
//
// Der eigentliche Zweck der App: gezielt auf bestimmte Modelle lauern.
// Welche das sind, steht in jagd.json – aktuell Grafikkarten.
//
// Entscheidend ist der Referenzpreis. Gegen den NEUPREIS zu rechnen waere
// Unsinn: eine gebrauchte RTX 3070 fuer 220 € ist dann "−58%", obwohl das
// einfach der normale Gebrauchtpreis ist. Verglichen wird deshalb gegen den
// MEDIAN der Anzeigen fuer dasselbe Modell. Ein Fund ist erst dann einer,
// wenn er deutlich unter dem liegt, was alle anderen verlangen.
//
// Und weil bei Grafikkarten massenhaft betrogen wird, gibt es eine zweite
// Grenze nach unten: was zu gut ist, um wahr zu sein, wird als Betrugsverdacht
// markiert und ausdruecklich NICHT als Fund gemeldet.

// Kategorie-weite Ausschluesse einmal vorbereiten: bei Grafikkarten vor allem
// Komplett-PCs und Notebooks. Die wuerden den Median nach oben ziehen und sind
// ohnehin ein anderes Produkt.
export function jagdAusschluss(db) {
  return {
    ausschluss: (db.ausschluss || []).map(norm).filter(Boolean),
    muster: (db.ausschlussMuster || []).map((r) => new RegExp(r)),
  };
}

// Passt eine Anzeige zum gesuchten Modell?
//
// Bewusst eine eigene, exportierte Funktion: der Live-Poller muss exakt
// dieselben Filter benutzen. Baut er sie nach, driftet er ab und meldet wieder
// Notebooks und Luefter – die Arbeit, die hier drinsteckt, gibt es nur einmal.
export function passtZumModell(ad, m, { ausschluss = [], muster = [] } = {}) {
  if (isJunk(ad)) return false;

  const phrases = (m.queries || []).map(norm).filter(Boolean);
  const marken = (m.marke || []).map(norm).filter(Boolean);
  const nicht = (m.nicht || []).map(norm).filter(Boolean);

  const words = norm(ad.title).split(' ');
  const t = ' ' + words.join(' ') + ' ';

  // Modellname muss am Stueck UND weit vorne im Titel stehen
  const hit = phrasePos(words, phrases);
  if (hit.pos < 0 || hit.pos > 5) return false;

  // Direkt hinter dem Modellnamen darf keine groessere Variante stehen:
  // "RTX 4070 Ti" ist nicht die "RTX 4070" und kostet deutlich mehr.
  // Bewusst nur die zwei Woerter danach pruefen – sonst fiele eine echte
  // 4070-Anzeige raus, die im Text eine 4060 Ti erwaehnt.
  const danach = words.slice(hit.pos + hit.len, hit.pos + hit.len + 2);
  if (nicht.some((w) => danach.includes(w))) return false;

  if (!marken.some((b) => t.includes(' ' + b))) return false;
  if (ausschluss.some((w) => t.includes(' ' + w + ' '))) return false;
  if (muster.some((r) => r.test(t))) return false;
  if (isAccessoryAd(t)) return false;

  // "<Irgendwas> für <Modell>" ist Zubehör, "<Modell> für <Zweck>" nicht.
  // Entscheidet allein die Reihenfolge – das braucht keine Wortliste.
  const fuer = words.indexOf('fuer');
  if (fuer !== -1 && fuer < hit.pos) return false;

  return true;
}

// Alle Jagd-Dateien einlesen: jagd.json, jagd-streaming.json, ...
//
// Eine Datei pro Kategorie statt einer grossen. Grund: label, emoji und vor
// allem die Ausschlusslisten gehoeren zur Kategorie. Die Notebook- und
// CPU-Filter der Grafikkarten haben bei Elgato-Geraeten nichts verloren, und
// umgekehrt. So kommt eine neue Kategorie ohne Codeaenderung dazu.
export function ladeJagdDbs(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^jagd.*\.json$/i.test(f))
    .sort()
    .map((f) => {
      const db = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { datei: f, db, filter: jagdAusschluss(db) };
    })
    .filter((x) => Array.isArray(x.db.modelle) && x.db.modelle.length);
}

async function collectJagd() {
  const dbs = ladeJagdDbs(__dirname);
  if (!dbs.length) {
    console.log('\n[4/4] Jagd – keine jagd*.json, übersprungen');
    return [];
  }

  const ka = CFG.kleinanzeigen;
  const st = STANDORT;
  const out = [];
  const markt = {};
  console.log(`\n[4/4] Jagd: ${dbs.map((d) => d.db.label || d.datei).join(', ')}`);
  if (st) console.log(`  Umkreis: ${st.radiusKm} km um ${st.plz} ${st.ort}`);

  for (const { db, filter: filterOpt } of dbs) {
   if (dbs.length > 1) console.log(`  --- ${db.emoji || ''} ${db.label || ''} ---`);
   // Schwellen pro Kategorie. 40 € Mindestgewinn sind bei einer Grafikkarte
   // richtig und bei einem Stream Deck Mini unmoeglich – dessen ganzer
   // Marktwert liegt bei 42 €. Was die Kategorie nicht selbst setzt, kommt
   // aus config.json.
   const cfgK = { ...CFG, marge: { ...CFG.marge, ...(db.marge || {}) } };
   for (const m of db.modelle) {
    // Schritt 1 – BUNDESWEIT, nur fuer den Median.
    //
    // Der Median braucht Masse. Aus den zwoelf Anzeigen im 15-km-Umkreis
    // gerechnet wackelt er mit jedem einzelnen Angebot, und ein schiefer
    // Median macht aus jedem Normalpreis einen Fund. Verkaufen kann Hakan
    // ohnehin bundesweit – der bundesweite Preis ist also der ehrlichere
    // Vergleich, auch wenn gekauft nur lokal wird.
    const bundesweit = [];
    const gesehen = new Set();
    for (const q of m.queries) {
      for (const ad of await kleinanzeigenAds(q, CFG.jagdPages, ka.minPrice, CFG.jagdMaxPrice)) {
        if (gesehen.has(ad.id)) continue;
        gesehen.add(ad.id);
        if (passtZumModell(ad, m, filterOpt)) bundesweit.push(ad);
      }
    }

    // Median der eigenen Anzeigen – erst ab genug Datenpunkten belastbar
    const prices = bundesweit.map((a) => a.price).sort((a, b) => a - b);
    const genug = prices.length >= CFG.jagdMinListings;
    const median = genug ? prices[Math.floor(prices.length / 2)] : null;
    const ref = median ?? m.markt;
    const refArt = median ? 'Median aus ' + prices.length + ' Anzeigen' : 'geschätzter Marktpreis';

    // Nicht nur der Median, sondern die ganze Verteilung. Grund: der Median
    // sagt, was die Leute VERLANGEN. Wer selbst schnell verkaufen will, muss
    // die anderen unterbieten – der realistische Erloes liegt also im unteren
    // Viertel, nicht in der Mitte. Ohne p25 muesste man diesen Abschlag raten,
    // und geraten war er bisher (realFaktor 0,85).
    markt[m.name] = {
      ref: round2(ref),
      median: median ? round2(median) : null,
      p25: genug ? round2(quantil(prices, 0.25)) : null,
      p75: genug ? round2(quantil(prices, 0.75)) : null,
      min: prices.length ? round2(prices[0]) : null,
      max: prices.length ? round2(prices[prices.length - 1]) : null,
      anzeigen: prices.length,
      refArt,
    };

    // Schritt 2 – IM UMKREIS: das sind die Funde, zu denen Hakan hinkommt.
    // Eine Seite reicht; gemessen liefert der 15-km-Radius pro Modell rund ein
    // Dutzend Anzeigen, und die passen alle auf Seite 1.
    let funde = bundesweit;
    if (st) {
      funde = [];
      const lokal = new Set();
      for (const q of m.queries) {
        for (const ad of await kleinanzeigenAds(q, 1, ka.minPrice, CFG.jagdMaxPrice, st)) {
          if (lokal.has(ad.id)) continue;
          lokal.add(ad.id);
          if (passtZumModell(ad, m, filterOpt)) funde.push(ad);
        }
      }
    }

    let treffer = 0;
    let betrug = 0;

    for (const ad of funde) {
      const p = pct(ref, ad.price);
      // Zu gut, um wahr zu sein. Bei Grafikkarten ist das die Regel, nicht die
      // Ausnahme: eine 4090 fuer 300 € ist nie ein Schnaeppchen.
      const scam = p >= CFG.jagdScamPct;
      // Graubereich dazwischen: gut genug, um gemeldet zu werden, aber
      // ungewoehnlich genug, um vorher genau hinzuschauen. Ohne diese Stufe
      // kaeme eine RTX 5070 Ti fuer 450 € (Median 950 €) als ganz normaler
      // Treffer rein - dabei ist das entweder ein Traumfund oder eine Masche.
      const warn = !scam && p >= CFG.jagdWarnPct;
      // Mit der PAUSCHALE rechnen, nicht mit der echten Entfernung.
      //
      // prices.json und deals.json landen im oeffentlichen Repo, weil der
      // Worker sie von dort holt. Aus einer echten Fahrtkostenzahl liesse sich
      // km exakt zurueckrechnen (fahrt / 2 / kmKosten), und zusammen mit den
      // Anzeigen-Links waere der Mittelpunkt per Dreiecksmessung bestimmbar.
      // Deshalb hier immer der schlechteste Fall im Umkreis: gleich fuer alle,
      // verraet nichts, und schaetzt eher zu vorsichtig als zu optimistisch.
      // Der Live-Poller laeuft lokal und rechnet mit der echten Entfernung.
      const fahrtKm = st?.radiusKm ?? ad.km;
      const margeK = rechneMarge(ad.price, markt[m.name], fahrtKm, cfgK);
      if (scam) betrug++;
      else if (lohntSich(margeK, cfgK)) treffer++;

      out.push({
        id: 'jagd:' + ad.id,
        src: 'jagd',
        name: ad.title,
        shop: 'Kleinanzeigen',
        url: 'https://www.kleinanzeigen.de' + ad.href,
        img: ad.img,
        cur: ad.price,
        ref: round2(ref),
        pct: p,
        stock: 'USED',
        vb: ad.vb,
        // Ort, Entfernung und Alter kommen aus der Trefferliste mit. Die
        // Entfernung rechnet Kleinanzeigen bei einer Umkreissuche selbst aus
        // und schreibt sie in den Ort: "47441 Moers (13 km)".
        ort: ad.ort,
        km: ad.km,
        alterMin: ad.alterMin,
        match: m.name,
        typ: m.typ,
        kategorie: db.label || null,
        emoji: db.emoji || null,
        specs: m.specs || null,
        warum: m.warum,
        neu: m.neu,
        // Woher der Vergleichspreis kommt – das gehoert sichtbar dazu,
        // sonst weiss man nicht, wie ernst man die Prozentzahl nehmen darf
        refArt,
        // Die Marge hier ausrechnen und mitschreiben, statt sie im Worker
        // nachzubauen: der Worker haette dann zwei Kopien derselben Formel,
        // die frueher oder spaeter auseinanderlaufen. Aus demselben Grund
        // faellt hier auch schon die Entscheidung – der Worker vergleicht
        // dann nur noch ein Ja/Nein und kennt gar keine Schwellen mehr.
        marge: margeK,
        lohnt: !scam && lohntSich(margeK, cfgK),
        sus: scam,
        warn,
      });
    }

    // --zeige="RTX 4060" listet alle zugeordneten Anzeigen auf. Zum Nachjustieren
    // der Filter unverzichtbar: ein schiefer Median hat immer einen Grund.
    // Zeigt beide Listen, weil sich sonst nicht erkennen laesst, ob ein
    // fehlender Fund am Filter liegt oder schlicht am Umkreis.
    if (ZEIGE && m.name.toLowerCase().includes(String(ZEIGE).toLowerCase())) {
      console.log(`  --- ${bundesweit.length} bundesweit (Median-Grundlage) ---`);
      for (const ad of bundesweit.slice().sort((a, b) => a.price - b.price)) {
        console.log(`     ${String(ad.price).padStart(5)} €  ${ad.title.slice(0, 60)}`);
      }
      if (st) {
        console.log(`  --- ${funde.length} im Umkreis (erreichbar) ---`);
        for (const ad of funde.slice().sort((a, b) => a.price - b.price)) {
          console.log(
            `     ${String(ad.price).padStart(5)} € ${String(ad.km ?? '?').padStart(3)} km  ` +
              `${(ad.ort || '').padEnd(24).slice(0, 24)} ${ad.title.slice(0, 45)}`
          );
        }
      }
      console.log('  ---');
    }

    console.log(
      `  ${m.name.padEnd(18)} ${String(bundesweit.length).padStart(3)} bundesweit · ` +
        (st ? `${String(funde.length).padStart(2)} im Umkreis · ` : '') +
        `Median ${eur(ref).padStart(10)} ${median ? '        ' : '(geschätzt)'}` +
        (treffer ? ` · ${treffer} Fund${treffer > 1 ? 'e' : ''}` : '') +
        (betrug ? ` · ${betrug} Betrugsverdacht` : '')
    );
   }
  }

  // Marktpreise getrennt ablegen. Winzige Datei, die der Live-Poller bei jedem
  // Lauf liest – prices.json waere dafuer viel zu gross.
  writeJson('markt.json', { at: new Date().toISOString(), modelle: markt });
  return out;
}

// Gebraucht-Titel einem Katalog-Produkt zuordnen. Regel: ALLE Wörter des
// Produktnamens müssen im Anzeigentitel vorkommen, und der längste Treffer
// gewinnt – so schlägt "Stream Deck XL" das allgemeinere "Stream Deck".
export function matchProduct(title, catalog) {
  const t = ' ' + norm(title) + ' ';
  // Produktnamen wie "Wave" sind für sich genommen zu allgemein. Solche
  // Ein-Wort-Treffer zählen nur, wenn die Anzeige auch Elgato nennt.
  const brandNamed = / elgato /.test(t);
  let best = null;

  for (const p of catalog) {
    if (p.src !== 'elgato' || !p.ref) continue;
    // Bündel als Referenz sind irreführend: ein einzelnes Gerät gegen einen
    // Set-Preis gerechnet ergibt Traumrabatte, die es nie gab.
    if (/\b(bundle|kit)\b/i.test(p.name)) continue;

    const phrase = norm(p.name);
    if (phrase.length < 3) continue;
    if (!phrase.includes(' ') && (!brandNamed || phrase.length < 4)) continue;

    // Der Produktname muss am Stück im Anzeigentitel stehen. Nur die
    // einzelnen Wörter irgendwo zu finden reicht nicht – so wurde
    // "Stream Deck MK.2 … Studio Controller" gegen den 999-€-"Stream Deck
    // Studio" gerechnet und sah aus wie −91%.
    if (!t.includes(' ' + phrase + ' ')) continue;

    if (ACCESSORY.test(t) && !ACCESSORY.test(phrase)) continue;

    const score = phrase.length; // längster (= genauester) Treffer gewinnt
    if (!best || score > best.score) best = { name: p.name, ref: p.ref, score };
  }
  return best;
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    // ae/oe/ue statt a/o/u: sonst wird aus "für" ein "fur" und aus "Hülle"
    // ein "hulle" – und sämtliche Filter unten greifen ins Leere.
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    // Sonst wären "Stream Deck +" und "Stream Deck" nach dem Putzen identisch
    // und ein Plus-Modell würde gegen den Preis des kleinen Modells gerechnet.
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// --- Preisverlauf ------------------------------------------------------

// Ein Punkt pro Tag und Produkt. Daraus kommt das Allzeittief-Kennzeichen,
// das nicht auf Elgatos UVP vertraut – falls die still gesenkt wird.
function updateHistory(hist, items) {
  const d = today();
  for (const it of items) {
    if (it.cur == null || it.src === 'ka' || it.src === 'jagd') continue; // Einzelstücke, kein Preisverlauf
    // Nicht neu geprüfte Produkte behalten ihren alten Stand – sonst würde der
    // Verlauf Tagespunkte erfinden, die nie gemessen wurden.
    if (it.stale) continue;
    const h = (hist.items[it.id] ||= { min: it.cur, max: it.cur, minAt: d, points: [] });

    // Tiefstand VOR dem heutigen Punkt merken. Sonst wäre jeder Preis sein
    // eigenes Allzeittief und der allererste Lauf würde Discord fluten.
    const prevMin = h.min;
    const prevDays = h.points.length;
    h.max = Math.max(h.max ?? it.cur, it.cur);

    // Watchlist-Einträge ohne eingetragene UVP: Referenz ist der höchste je
    // gesehene Preis. Am Anfang also 0% – das wächst sich mit der Zeit aus.
    if (it.refFromHistory) {
      it.ref = h.max;
      it.pct = pct(h.max, it.cur);
    }

    // Den Tagespunkt schreibt nur der Nachtlauf. Sonst änderte sich
    // history.json 48-mal am Tag und würde bei jedem Commit neu im Repo
    // landen. min/max pflegen die Schnellläufe trotzdem mit – nur darauf
    // stützt sich das Allzeittief.
    const last = h.points[h.points.length - 1];
    if (MODE === 'full' || !h.points.length) {
      if (last && last[0] === d) last[1] = it.cur;
      else h.points.push([d, it.cur]);
      if (h.points.length > CFG.historyDays) h.points = h.points.slice(-CFG.historyDays);
    }
    if (it.cur <= h.min) {
      h.min = it.cur;
      h.minAt = d;
    }

    it.low = h.min;
    it.lowAt = h.minAt;
    // Ein Allzeittief ist erst eins, wenn der Sniper das Produkt lange genug
    // kennt – vorher weiß er schlicht zu wenig.
    it.atLow = prevDays >= CFG.minHistoryDays && it.cur <= prevMin;
  }
  hist.meta = { ...(hist.meta || {}), updated: new Date().toISOString() };
  return hist;
}

// --- Hilfsmittel -------------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100;
// Quantil einer bereits sortierten Preisliste, lineare Interpolation.
const quantil = (sortiert, q) => {
  if (!sortiert.length) return null;
  const i = (sortiert.length - 1) * q;
  const u = Math.floor(i);
  const o = Math.ceil(i);
  return u === o ? sortiert[u] : sortiert[u] + (sortiert[o] - sortiert[u]) * (i - u);
};
const pct = (ref, cur) => (!ref || ref <= 0 || cur == null ? 0 : Math.max(0, Math.round(((ref - cur) / ref) * 100)));
const clean = (s) =>
  (s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    // Kleinanzeigen setzt in Ortsnamen ein breitenloses Leerzeichen als
    // Trennhilfe: "Essen-&#8203;Katernberg". Bleibt es stehen, steht es
    // spaeter im Discord-Alarm. Als Escape geschrieben, weil das Zeichen im
    // Quelltext sonst unsichtbar waere und beim naechsten Editieren verschwindet.
    .replace(/&#8203;?/g, '').replace(/[\u200B\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const num = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return 'Shop';
  }
};
const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

// Was in die veroeffentlichten Dateien darf.
//
// prices.json und deals.json liegen im oeffentlichen Repo – der Worker holt
// sie ueber raw.githubusercontent.com, sie MUESSEN also lesbar sein. Ortsnamen
// der Funde stehen damit aber auch drin, und weil alle im eigenen Umkreis
// liegen, verraten sie die Wohngegend. Deshalb fliegen ort und km hier raus.
//
// Die Fahrtkosten in der Marge sind schon vorher pauschal gerechnet (siehe
// collectJagd), aus ihnen laesst sich die Entfernung also nicht rekonstruieren.
function ohneOrtsdaten(items) {
  return items.map(({ ort, km, ...rest }) => rest);
}

const readJson = (name, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  } catch {
    return fallback;
  }
};
const writeJson = (name, data) => {
  if (DRY) return;
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data), 'utf8');
};

// --- Hauptlauf ---------------------------------------------------------

async function main() {
  const t0 = Date.now();
  console.log(`Gear Sniper – Sammellauf (${MODE}${DRY ? ', dry-run' : ''})`);

  const prev = readJson('prices.json', { items: [] });
  const hist = readJson('history.json', { meta: {}, items: {} });
  hist.items ||= {};
  hist.meta ||= {};

  let items = [];

  if (!ONLY || ONLY === 'elgato') {
    items.push(...(await collectElgato(MODE, prev.items || [], hist.meta)));
  }
  if (!ONLY || ONLY === 'watch') {
    items.push(...(await collectWatchlist()));
  }

  // Im Schnelllauf fehlt der halbe Katalog – für den Gebraucht-Vergleich
  // deshalb die alten Preise als Referenz dazunehmen.
  const known = new Map(items.map((i) => [i.id, i]));
  const catalog = [...items, ...(prev.items || []).filter((p) => !known.has(p.id))];

  if (!ONLY || ONLY === 'ka') {
    items.push(...(await collectKleinanzeigen(catalog)));
  }
  if (!ONLY || ONLY === 'jagd') {
    items.push(...(await collectJagd()));
  }

  // Im Schnelllauf nicht geprüfte Produkte behalten ihren letzten Stand,
  // sonst wäre die App nach jedem Lauf halb leer.
  const fresh = new Set(items.map((i) => i.id));
  for (const p of prev.items || []) {
    // Nur Shop-Produkte behalten ihren letzten Stand. Anzeigen-basierte Quellen
    // (Kleinanzeigen, Jagd) sind Einzelstücke – die sind entweder im aktuellen
    // Lauf dabei oder weg. Das räumt nebenbei alte Quellen selbst auf.
    if (!fresh.has(p.id) && (p.src === 'elgato' || p.src === 'watch')) items.push({ ...p, stale: true });
  }

  updateHistory(hist, items);

  if (SIMULATE) {
    const t = items.find((i) => i.sku === SIMULATE || i.id === SIMULATE);
    if (t) {
      t.cur = round2(t.ref * 0.4);
      t.pct = 60;
      t.simulated = true;
      console.log(`\n  TESTFALL: ${t.name} künstlich auf ${eur(t.cur)} (−60%) gesetzt`);
    } else {
      console.log(`\n  TESTFALL: ${SIMULATE} nicht gefunden`);
    }
  }

  items.sort((a, b) => b.pct - a.pct || (a.cur ?? 1e9) - (b.cur ?? 1e9));

  const prices = { at: new Date().toISOString(), mode: MODE, count: items.length, items };

  // Zweite, winzige Datei nur für den Alarm-Cron: der Worker hat auf dem
  // Free-Plan 10 ms CPU – 500 Produkte zu parsen wäre Verschwendung.
  const deals = items.filter(
    (i) => i.pct >= CFG.dealFloorPct || i.atLow || i.status === 'blocked' || i.simulated ||
         (i.src === 'jagd' && i.pct >= CFG.jagdMinPct)
  );
  const dealFile = { at: prices.at, mode: MODE, count: deals.length, items: deals };

  // Erst hier die Ortsdaten entfernen, nicht frueher: die Konsolenausgabe und
  // --zeige brauchen sie, und die Marge ist ohnehin schon pauschal gerechnet.
  writeJson('prices.json', { ...prices, items: ohneOrtsdaten(prices.items) });
  writeJson('deals.json', { ...dealFile, items: ohneOrtsdaten(dealFile.items) });
  writeJson('history.json', hist);

  const top = items.filter((i) => i.pct > 0).slice(0, 10);
  console.log('\n--- Beste Rabatte ---');
  if (!top.length) console.log('  gerade nichts reduziert');
  for (const t of top) {
    console.log(
      `  −${String(t.pct).padStart(2)}%  ${eur(t.cur).padStart(10)} statt ${eur(t.ref).padStart(10)}  ` +
        `${t.name.slice(0, 45).padEnd(45)} [${t.shop}]${t.sus ? ' ⚠ verdächtig günstig' : ''}`
    );
  }
  console.log(
    `\nFertig in ${Math.round((Date.now() - t0) / 1000)}s – ` +
      `${items.length} Einträge, ${deals.length} für den Alarm relevant` +
      (DRY ? ' (dry-run: nichts geschrieben)' : '')
  );
}

// Nur starten, wenn die Datei direkt aufgerufen wurde – wird sie nur
// importiert (Tests), passiert nichts.
const startedDirectly = process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (startedDirectly) {
  main().catch((e) => {
    console.error('\nAbbruch: ' + e.message);
    process.exit(1);
  });
}
