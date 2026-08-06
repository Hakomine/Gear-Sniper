// Gear Sniper – Cloudflare Worker
// -------------------------------------------------------
// Zwei Aufgaben:
//   1. Oberfläche (auch am Handy): zeigt alle gesammelten Preise, Rabatte und
//      Gebraucht-Funde.
//   2. Alarm: ein Cron prüft alle 15 Minuten die kleine deals.json und meldet
//      echte Treffer per Discord – ohne denselben Deal zweimal zu schicken.
//
// Die Preise selbst holt dieser Worker NICHT. Das macht collector.mjs in
// GitHub Actions und legt prices.json / deals.json im Repo ab. Grund: ein
// Elgato-Produkt-JSON ist ~500 KB, der Free-Plan gibt einem Cron-Lauf aber nur
// 10 ms CPU und 50 Subrequests. So braucht der Alarm-Pfad genau einen Abruf.
//
// Einzurichten (Cloudflare → Settings):
//   Variable  DATA_BASE        raw-GitHub-Link zum Ordner, ohne / am Ende
//   Secret    DISCORD_WEBHOOK  Webhook-URL des Discord-Kanals
//   Binding   GEAR_KV          KV-Namespace (merkt sich Gemeldetes)
//   Trigger   */15 * * * *
// -------------------------------------------------------

// --- Schwellen (hier drehen, wenn zu viel oder zu wenig kommt) ---
const ALARM_MIN_PCT = 50;      // % Rabatt auf UVP – ab hier gibt es Alarm
const ALARM_HISTLOW_PCT = 25;  // beim Allzeittief reicht dieser kleinere Rabatt
const ALARM_USED_PCT = 50;     // % unter Neupreis bei Gebraucht-Angeboten
// Cam-Jagd: hier wird gegen den MEDIAN vergleichbarer Anzeigen gerechnet,
// nicht gegen den Neupreis. 30% unter dem, was alle anderen verlangen, ist
// deshalb schon ein echter Fund – keine 50 nötig.
const ALARM_CAM_PCT = 30;
// Die Betrugs-Markierung setzt der Collector (suspiciousPct in config.json) –
// hier wird sie nur noch angezeigt, damit es nur eine Quelle der Wahrheit gibt.
const ALARM_TTL = 14 * 24 * 3600;  // so lange gilt ein Treffer als "schon gemeldet"
const ALARM_REDROP_PCT = 10;       // erneut melden, wenn der Preis nochmal 10% fällt
const ALARM_MAX_EMBEDS = 10;       // Discord erlaubt max. 10 Embeds pro Nachricht

// --- Betrieb ---
const CACHE_SECONDS = 300;
const HEALTH_TTL = 7 * 24 * 3600;
const ERROR_COOLDOWN = 3600;   // Fehler höchstens 1x pro Stunde melden
const REPORT_HOUR_UTC = 7;     // Tagesbericht ab dieser UTC-Stunde (~9 Uhr DE)
// Gemessen: GitHub führt den `*/30`-Zeitplan auf kostenlosen Konten in
// Wirklichkeit alle 17 bis 190 Minuten aus. Mit 90 Minuten meldete der
// Wächter deshalb GitHubs Trödelei statt echter Probleme. 240 liegt über
// dem schlechtesten gemessenen Abstand und schlägt trotzdem an, wenn der
// Sammler wirklich steht.
const STALE_MINUTES = 240;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/deals') return handleDeals(request, env, ctx);
    if (url.pathname === '/api/health') return handleHealth(env);
    return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  },

  // Cron: Trigger im Dashboard setzen, z.B. */15 * * * *
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env));
  },
};

// ---------- kleiner Key-Value-Speicher ----------
// Nutzt GEAR_KV, falls gebunden. Ohne KV fällt er auf die Cache-API zurück –
// die ist nicht garantiert persistent, deshalb ist KV klar besser.
const store = {
  _req: (k) => new Request('https://gear-sniper.state/' + encodeURIComponent(k)),
  async get(env, k) {
    if (env.GEAR_KV) return env.GEAR_KV.get(k);
    const hit = await caches.default.match(store._req(k));
    return hit ? await hit.text() : null;
  },
  async put(env, k, v, ttl) {
    if (env.GEAR_KV) return env.GEAR_KV.put(k, v, { expirationTtl: ttl });
    return caches.default.put(
      store._req(k),
      new Response(v, { headers: { 'Cache-Control': 'public, max-age=' + ttl } })
    );
  },
};

const dataUrl = (env, file) => (env.DATA_BASE || '').replace(/\/+$/, '') + '/' + file;

async function loadData(env, file) {
  const base = env.DATA_BASE;
  if (!base) throw new Error('DATA_BASE fehlt (als Variable setzen)');
  const res = await fetch(dataUrl(env, file), {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!res.ok) throw new Error(file + ': HTTP ' + res.status);
  return res.json();
}

// ---------- API: alles für die Oberfläche ----------

async function handleDeals(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request('https://gear-sniper.cache/deals');
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';

  if (!fresh) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  if (!env.DATA_BASE) return json({ error: 'DATA_BASE fehlt (als Variable setzen)' }, 500);

  // Bewusst NICHT parsen: prices.json ist ~330 KB, und JSON.parse plus
  // JSON.stringify darauf frisst mehr als die 10 ms CPU, die der Free-Plan
  // pro Anfrage gibt. Der Worker reicht die Bytes einfach durch.
  let upstream;
  try {
    upstream = await fetch(dataUrl(env, 'prices.json'), {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
  } catch (e) {
    return json({ error: 'Daten nicht erreichbar: ' + e.message }, 502);
  }
  if (!upstream.ok) return json({ error: 'prices.json: HTTP ' + upstream.status }, 502);

  const res = new Response(upstream.body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'Cache-Control': 'public, max-age=' + CACHE_SECONDS,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

// ---------- Wächter: Zustand nach außen sichtbar machen ----------

async function handleHealth(env) {
  const raw = await store.get(env, 'health');
  const h = raw ? JSON.parse(raw) : null;
  const age = h ? Math.round((Date.now() - new Date(h.at).getTime()) / 60000) : null;
  return json({
    ok: !!h && h.ok && age <= 30,
    // Ohne KV landet der Zustand in einem flüchtigen Zwischenspeicher und ist
    // gleich wieder weg. Das steht hier, damit man von außen sieht, ob das
    // Binding wirklich greift, statt es aus fehlenden Werten zu erraten.
    kvGebunden: !!env.GEAR_KV,
    lastRun: h?.at || null,
    ageMinutes: age,
    checked: h?.checked ?? null,
    alerts: h?.alerts ?? null,
    dataAge: h?.dataAge ?? null,
    error: h?.error || null,
  });
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
  });

// ---------- Cron: prüfen und melden ----------

async function runCron(env) {
  const errors = [];
  let alerts = [];
  let checked = 0;
  let dataAge = null;

  try {
    const data = await loadData(env, 'deals.json'); // genau EIN Subrequest
    checked = data.count || (data.items || []).length;
    dataAge = Math.round((Date.now() - new Date(data.at).getTime()) / 60000);

    // Stille kann zweierlei heißen: keine Deals – oder der Sammler steht.
    // Nur das zweite ist ein Problem, und das soll auffallen.
    if (dataAge > STALE_MINUTES) {
      errors.push(`Daten sind ${dataAge} Min alt – läuft der GitHub-Job noch?`);
    }

    const hits = (data.items || []).filter(isHit);
    alerts = await onlyNew(env, hits);
    if (alerts.length) await sendDiscord(env, alerts);
  } catch (e) {
    errors.push('Deal-Check: ' + e.message);
  }

  const ok = errors.length === 0;
  await store.put(
    env,
    'health',
    JSON.stringify({
      at: new Date().toISOString(),
      ok,
      checked,
      dataAge,
      alerts: alerts.length,
      error: errors.join(' | ') || null,
    }),
    HEALTH_TTL
  );

  if (!ok) await reportError(env, errors);
  else await dailyReport(env, checked, alerts.length);

  console.log(`Cron fertig – ${alerts.length} neue Treffer${ok ? '' : ' | FEHLER: ' + errors.join(' | ')}`);
}

// Was zählt als Treffer?
function isHit(i) {
  if (i.cur == null || !i.ref) return false;
  if (i.stale) return false;               // alter Stand, nicht neu geprüft
  if (i.src === 'cam') return i.pct >= ALARM_CAM_PCT;
  if (i.src === 'ka') return i.pct >= ALARM_USED_PCT;
  if (i.stock === 'OUT_OF_STOCK') return false; // ausverkauft ist kein Deal
  if (i.pct >= ALARM_MIN_PCT) return true;
  return !!i.atLow && i.pct >= ALARM_HISTLOW_PCT;
}

// Kein Spam: Gemeldetes 14 Tage merken, erneut melden erst bei weiterem Fall.
async function onlyNew(env, hits) {
  const out = [];
  for (const h of hits) {
    const k = 'alerted:' + h.id;
    const prev = await store.get(env, k);
    const prevPrice = prev != null ? +prev : null;
    if (prevPrice != null && !(h.cur <= prevPrice * (1 - ALARM_REDROP_PCT / 100))) continue;
    out.push(h);
    await store.put(env, k, String(h.cur), ALARM_TTL);
  }
  // Krasseste zuerst – bei mehr als zehn Treffern zählt, was oben landet
  return out.sort((a, b) => score(b) - score(a));
}

// Kamera-Funde zuerst – dafür ist die App gebaut.
const score = (h) =>
  (h.src === 'cam' ? 2000 : 0) + (h.src === 'ka' ? 500 : 0) + (h.atLow ? 1000 : 0) + (h.pct || 0);

// ---------- Discord ----------

const eurTxt = (n) => (n == null ? '–' : (+n).toFixed(2).replace('.', ',') + ' €');

async function sendDiscord(env, hits) {
  if (!env.DISCORD_WEBHOOK) {
    console.log('DISCORD_WEBHOOK fehlt – ' + hits.length + ' Treffer nicht gesendet');
    return;
  }

  const embeds = hits.slice(0, ALARM_MAX_EMBEDS).map((h) => {
    const cam = h.src === 'cam';
    const used = h.src === 'ka';
    const lines = [`**${eurTxt(h.cur)}** statt ${eurTxt(h.ref)} · **−${h.pct}%**`];

    if (cam) {
      const blende = /^f\//.test(h.blende || '') ? ' · ' + h.blende : '';
      lines.push(`${h.match} · Sensor ${h.sensor}${blende}`);
      lines.push(`Vergleich: ${h.refArt}${h.neu ? ' · neu ' + eurTxt(h.neu) : ''}`);
      if (h.warum) lines.push('> ' + String(h.warum).slice(0, 300));
      if (h.sus) lines.push('⚠️ **Auffällig günstig** – erst prüfen, dann zahlen.');
      return {
        title: '📷 ' + String(h.name).slice(0, 240),
        url: h.url || undefined,
        description: lines.join('\n'),
        color: 5814783,
        thumbnail: h.img ? { url: h.img } : undefined,
        footer: { text: 'Cam-Jagd · besser als deine Meet 2' },
      };
    }

    if (used) {
      lines.push(`Gebraucht bei Kleinanzeigen${h.vb ? ' (VB)' : ''}`);
      if (h.match) lines.push(`Neupreis-Vergleich: ${h.match}`);
      if (h.sus) {
        lines.push('⚠️ **Auffällig günstig** – erst prüfen, dann zahlen. Kein Vorkasse-Versand.');
      }
    } else {
      lines.push(`Bei **${h.shop}**`);
      if (h.atLow) lines.push('📉 **So billig war es noch nie**');
      if (h.stock === 'OUT_OF_STOCK') lines.push('⚠️ gerade nicht auf Lager');
    }

    return {
      title: (used ? '♻️ ' : h.atLow ? '📉 ' : '🎯 ') + String(h.name).slice(0, 240),
      url: h.url || undefined,
      description: lines.join('\n'),
      color: used ? 10181046 : h.pct >= ALARM_MIN_PCT ? 16498468 : 4906624,
      thumbnail: h.img ? { url: h.img } : undefined,
      footer: { text: 'Gear Sniper · ' + h.shop },
    };
  });

  const more = hits.length > ALARM_MAX_EMBEDS ? ` (+${hits.length - ALARM_MAX_EMBEDS} weitere)` : '';
  await sendDiscordRaw(env, {
    username: 'Gear Sniper',
    content: `🎯 **${hits.length}${hits.length === 1 ? ' neuer Fund' : ' neue Funde'}**${more}`,
    embeds,
  });
}

// Fehler melden, aber höchstens 1x pro Stunde – sonst pingt ein dauerhaft
// kaputter Dienst alle 15 Minuten.
async function reportError(env, errors) {
  const last = +(await store.get(env, 'error_cooldown')) || 0;
  if (Date.now() - last < ERROR_COOLDOWN * 1000) return;
  await store.put(env, 'error_cooldown', String(Date.now()), ERROR_COOLDOWN * 2);
  await sendDiscordRaw(env, {
    username: 'Gear Sniper',
    content: '⚠️ **Gear Sniper hat ein Problem**',
    embeds: [
      {
        title: 'Cron-Lauf fehlgeschlagen',
        description: errors.map((e) => '• ' + e).join('\n').slice(0, 3900),
        color: 16007990,
        footer: { text: 'Nächste Meldung frühestens in einer Stunde' },
      },
    ],
  });
}

// Einmal am Tag ein Lebenszeichen – so fällt Stille auch dann auf, wenn
// gerade wirklich nichts reduziert ist.
async function dailyReport(env, checked, alerts) {
  const now = new Date();
  if (now.getUTCHours() < REPORT_HOUR_UTC) return;
  const today = now.toISOString().slice(0, 10);
  if ((await store.get(env, 'daily_report')) === today) return;
  await store.put(env, 'daily_report', today, 3 * 24 * 3600);
  await sendDiscordRaw(env, {
    username: 'Gear Sniper',
    embeds: [
      {
        title: '✅ Gear Sniper läuft',
        description:
          `Zuletzt ${checked} Kandidaten geprüft.` +
          (alerts ? ` ${alerts} neue Funde dabei.` : ' Aktuell nichts Neues.'),
        color: 4906624,
        footer: { text: 'Tägliches Lebenszeichen' },
      },
    ],
  });
}

async function sendDiscordRaw(env, payload) {
  if (!env.DISCORD_WEBHOOK) return;
  try {
    const res = await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.log('Discord HTTP ' + res.status);
  } catch (e) {
    console.log('Discord-Versand fehlgeschlagen: ' + e.message);
  }
}

// ---------- Oberfläche ----------

const HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Gear Sniper</title>
<style>
  :root {
    --bg:#0b0d11; --card:#141821; --line:#232936; --txt:#e8ecf3; --dim:#8f9bb0;
    --accent:#4ade80; --hot:#fb923c; --used:#a78bfa; --warn:#f87171; --cam:#60a5fa;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--txt);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  header { position:sticky; top:0; z-index:5; background:rgba(11,13,17,.94);
    backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:14px 16px; }
  h1 { margin:0 0 3px; font-size:19px; letter-spacing:.3px; }
  h1 span { color:var(--accent); }
  .sub { font-size:12px; color:var(--dim); }
  .controls { display:flex; flex-wrap:wrap; gap:8px; margin-top:11px; align-items:center; }
  input[type=search], select { background:var(--card); color:var(--txt); border:1px solid var(--line);
    border-radius:9px; padding:8px 10px; font-size:14px; }
  input[type=search] { flex:1 1 160px; min-width:0; }
  .chip { display:inline-flex; align-items:center; gap:6px; background:var(--card);
    border:1px solid var(--line); border-radius:9px; padding:7px 10px; font-size:13px;
    color:var(--dim); cursor:pointer; user-select:none; }
  .chip.on { color:var(--txt); border-color:var(--accent); }
  .chip input { accent-color:var(--accent); margin:0; }
  .slider { display:flex; align-items:center; gap:8px; flex:1 1 210px; font-size:13px; color:var(--dim); }
  .slider input { flex:1; accent-color:var(--accent); }
  main { padding:14px 16px 40px; }
  .grid { display:grid; gap:11px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
  .card { display:flex; gap:12px; background:var(--card); border:1px solid var(--line);
    border-radius:13px; padding:11px; text-decoration:none; color:inherit; }
  .card:hover { border-color:#39445a; }
  .card.deal { border-left:4px solid var(--hot); }
  .card.used { border-left:4px solid var(--used); }
  .card.cam { border-left:4px solid var(--cam); background:linear-gradient(90deg,rgba(96,165,250,.09),var(--card) 60%); }
  .thumb { width:62px; height:62px; flex:0 0 auto; border-radius:9px; object-fit:contain;
    background:#0f131a; }
  .body { flex:1; min-width:0; }
  .name { font-size:14px; font-weight:600; line-height:1.25; margin-bottom:4px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .prices { display:flex; align-items:baseline; gap:7px; flex-wrap:wrap; }
  .cur { font-size:17px; font-weight:800; }
  .was { font-size:12px; color:var(--dim); text-decoration:line-through; }
  .badge { font-size:11px; font-weight:800; padding:2px 6px; border-radius:6px;
    background:var(--hot); color:#1a1005; }
  .meta { font-size:11.5px; color:var(--dim); margin-top:5px; display:flex; gap:8px; flex-wrap:wrap; }
  .tag-low { color:var(--accent); font-weight:700; }
  .tag-cam { color:var(--cam); font-weight:700; }
  .tag-sus { color:var(--warn); font-weight:700; }
  .tag-out { color:var(--warn); }
  .empty { text-align:center; color:var(--dim); padding:50px 20px; font-size:14px; line-height:1.6; }
  footer { padding:0 16px 30px; font-size:11.5px; color:var(--dim); text-align:center; line-height:1.7; }
</style>
</head>
<body>
<header>
  <h1>🎯 GEAR <span>SNIPER</span></h1>
  <div class="sub" id="status">lädt …</div>
  <div class="controls">
    <input type="search" id="q" placeholder="Suchen …" />
    <select id="sort">
      <option value="pct">Rabatt %</option>
      <option value="abs">Ersparnis €</option>
      <option value="cheap">Preis aufsteigend</option>
      <option value="name">Name</option>
    </select>
    <label class="chip" id="c-deal"><input type="checkbox" id="onlyDeal" /> nur reduziert</label>
    <label class="chip" id="c-cam"><input type="checkbox" id="onlyCam" /> 📷 nur Kameras</label>
    <label class="chip" id="c-used"><input type="checkbox" id="onlyUsed" /> nur gebraucht</label>
    <label class="chip" id="c-low"><input type="checkbox" id="onlyLow" /> nur Allzeittief</label>
    <label class="chip" id="c-stock"><input type="checkbox" id="onlyStock" /> nur auf Lager</label>
    <div class="slider">
      <span>ab <b id="minLbl">0</b>% Rabatt</span>
      <input type="range" id="minPct" min="0" max="90" step="5" value="0" />
    </div>
  </div>
</header>
<main>
  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" hidden></div>
</main>
<footer id="foot"></footer>

<script>
const eur = n => n == null ? '–' : n.toFixed(2).replace('.', ',') + ' €';
let ITEMS = [];

const el = id => document.getElementById(id);
const chips = [['onlyCam','c-cam'],['onlyDeal','c-deal'],['onlyUsed','c-used'],['onlyLow','c-low'],['onlyStock','c-stock']];

async function load() {
  try {
    const r = await fetch('/api/deals');
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    ITEMS = d.items || [];
    const age = Math.round((Date.now() - new Date(d.at)) / 60000);
    const camHits = ITEMS.filter(i => i.src === 'cam' && i.pct >= 30).length;
    const deals = ITEMS.filter(i => i.pct > 0).length;
    el('status').textContent =
      '📷 ' + camHits + ' Cam-Funde · ' + deals + ' reduziert · ' +
      ITEMS.length + ' Einträge · Stand vor ' + age + ' Min';
    render();
  } catch (e) {
    el('status').textContent = 'Fehler: ' + e.message;
  }
}

function render() {
  const q = el('q').value.trim().toLowerCase();
  const min = +el('minPct').value;
  el('minLbl').textContent = min;
  for (const [box, chip] of chips) el(chip).classList.toggle('on', el(box).checked);

  let list = ITEMS.filter(i => {
    if (i.cur == null) return false;
    if (i.pct < min) return false;
    if (el('onlyDeal').checked && i.pct <= 0) return false;
    if (el('onlyCam').checked && i.src !== 'cam') return false;
    if (el('onlyUsed').checked && i.src !== 'ka') return false;
    if (el('onlyLow').checked && !i.atLow) return false;
    if (el('onlyStock').checked && i.stock === 'OUT_OF_STOCK') return false;
    if (q && !(i.name + ' ' + i.shop).toLowerCase().includes(q)) return false;
    return true;
  });

  const sort = el('sort').value;
  list.sort((a, b) =>
    sort === 'abs' ? (b.ref - b.cur) - (a.ref - a.cur)
    : sort === 'cheap' ? a.cur - b.cur
    : sort === 'name' ? a.name.localeCompare(b.name)
    : b.pct - a.pct || a.cur - b.cur);

  const grid = el('grid');
  grid.innerHTML = '';
  for (const i of list.slice(0, 400)) grid.appendChild(card(i));

  el('empty').hidden = list.length > 0;
  el('empty').textContent = list.length ? '' :
    'Nichts gefunden. Stell den Regler runter oder nimm einen Filter raus – die Cam-Funde stehen unter 📷 nur Kameras.';
  el('foot').textContent = list.length + ' von ' + ITEMS.length + ' angezeigt';
}

function card(i) {
  const a = document.createElement('a');
  a.className = 'card' + (i.src === 'cam' ? ' cam' : i.src === 'ka' ? ' used' : i.pct > 0 ? ' deal' : '');
  a.href = i.url; a.target = '_blank'; a.rel = 'noopener';

  // Bild-URLs kommen von fremden Servern (auch aus Kleinanzeigen-Inseraten),
  // also nie ungeprüft ins Attribut schreiben.
  const img = i.img ? '<img class="thumb" src="' + esc(i.img) + '" alt="" loading="lazy" />'
                    : '<div class="thumb"></div>';

  const tags = [];
  if (i.src === 'cam') {
    tags.push('<span class="tag-cam">📷 ' + esc(i.match) + '</span>');
    // Kein Regex mit Schrägstrich hier drin: diese Seite steckt in einem
    // Template-String: aus /^f\// würde beim Einbetten /^f// – und damit
    // stünde die ganze Oberfläche still.
    tags.push('Sensor ' + esc(i.sensor) + (String(i.blende || '').startsWith('f/') ? ' · ' + esc(i.blende) : ''));
    if (i.refArt) tags.push(esc(i.refArt));
  }
  if (i.src === 'ka') tags.push('♻️ gebraucht' + (i.vb ? ' · VB' : ''));
  if (i.atLow) tags.push('<span class="tag-low">📉 Allzeittief</span>');
  if (i.sus) tags.push('<span class="tag-sus">⚠️ verdächtig günstig</span>');
  if (i.stock === 'OUT_OF_STOCK') tags.push('<span class="tag-out">ausverkauft</span>');
  if (i.status === 'blocked') tags.push('<span class="tag-out">Shop nicht abrufbar</span>');
  if (i.stale) tags.push('älterer Stand');

  a.innerHTML = img +
    '<div class="body">' +
      '<div class="name">' + esc(i.name) + '</div>' +
      '<div class="prices">' +
        '<span class="cur">' + eur(i.cur) + '</span>' +
        (i.pct > 0 ? '<span class="was">' + eur(i.ref) + '</span>' +
                     '<span class="badge">−' + i.pct + '%</span>' : '') +
      '</div>' +
      '<div class="meta"><span>' + esc(i.shop) + '</span>' +
        tags.map(t => '<span>' + t + '</span>').join('') +
      '</div>' +
    '</div>';
  return a;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

for (const id of ['q','sort','minPct','onlyCam','onlyDeal','onlyUsed','onlyLow','onlyStock']) {
  el(id).addEventListener('input', render);
}
load();
setInterval(load, 5 * 60 * 1000);
</script>
</body>
</html>`;
