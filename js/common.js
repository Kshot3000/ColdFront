/* ============================================================
   THE COLD FRONT — shared config, utilities, chrome
   (snow, weather strip, nav, toast, localStorage cache)
   ============================================================ */
"use strict";

/* ██████ CONFIG — EDIT YOUR DATA HERE ██████
   Your X profile, donations, projects and socials live in ONE place.
   GitHub handle is Kshot3000 (X handle stays @kshot9000). */
window.CF = window.CF || {};

CF.CONFIG = {
  site: {
    name: "THE COLD FRONT",
    tagline: "Chicago Bears × Midwest Winter Football",
    blurb: "An independent fan site for people who think football should be played in a blizzard.",
    version: "1.0.0",
  },

  author: {
    name: "kshot",
    x: "https://x.com/kshot9000",
    xHandle: "@kshot9000",
    github: "https://github.com/Kshot3000",
  },

  // Donation wallets (same addresses as EUTXO.DEX / NightDream).
  donations: [
    {
      chain: "BTC",
      label: "Bitcoin (BTC)",
      symbol: "₿",
      color: "#f7931a",
      address: "3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK",
      view: "https://mempool.space/address/3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK",
    },
    {
      chain: "ERG",
      label: "Ergo (ERG)",
      symbol: "⬡",
      color: "#ff7a1a",
      address: "9fcM5RWnAjmP4vx5bnW6yohB6H9bLq8sJbaPLHtwZLtQPB32Pvy",
      view: "https://explorer.ergoplatform.com/addresses/9fcM5RWnAjmP4vx5bnW6yohB6H9bLq8sJbaPLHtwZLtQPB32Pvy",
    },
    {
      chain: "ADA",
      label: "Cardano (ADA)",
      symbol: "₳",
      color: "#2a5adb",
      address: "addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v",
      view: "https://cardanoscan.io/addresses/addr1q8hnl6vl5a6k3rw3n5g3jtte696zcl76kfatzv7gpswa9r0dj7fma6klq55y4ffm7tf0em09udnyhuk4ah92pl5x9jpqjae44v",
    },
  ],

  // Your other projects (linked from About).
  projects: [
    {
      name: "NightDream.io",
      icon: "☾",
      desc: "Cardano by day, Midnight by night — live CNT markets, a 554-token registry and a privacy-chain watchlist. Zero ads, zero server-side state.",
      repo: "nightdream.io",
    },
    {
      name: "EUTXO.DEX",
      icon: "⬡",
      desc: "A non-custodial DEX for the Ergo chain. Real sigma-rust signing in WASM, real constant-product math, virtual pools until the on-chain contract ships.",
      repo: "eutxo-dex",
    },
    {
      name: "Cardano SPO Tracker",
      icon: "₳",
      desc: "Blue-and-black staking dashboard: on-device epoch clock, per-epoch ADA rewards, live network snapshot, fully offline-capable. One HTML file.",
      repo: "Epoch-Tracker",
    },
    {
      name: "SigmaSwap",
      icon: "◈",
      desc: "Work in progress — the next swap experience on the Sigma network. Fee curves first; everything else after. Watch the X for the launch.",
      url: "https://x.com/kshot9000",
    },
  ],

  // Official Bears socials (linked throughout).
  socials: [
    { name: "X / Twitter", handle: "@ChicagoBears", url: "https://x.com/ChicagoBears", icon: "𝕏" },
    { name: "Instagram", handle: "@chicagobears", url: "https://www.instagram.com/chicagobears/", icon: "◎" },
    { name: "Facebook", handle: "Chicago Bears", url: "https://www.facebook.com/chicagobears", icon: "f" },
    { name: "TikTok", handle: "@chicagobears", url: "https://www.tiktok.com/@chicagobears", icon: "♪" },
    { name: "YouTube", handle: "Chicago Bears", url: "https://www.youtube.com/@ChicagoBears", icon: "▶" },
    { name: "Bears.com", handle: "official site", url: "https://www.chicagobears.com/", icon: "★" },
    { name: "ESPN — Bears", handle: "scoreboard", url: "https://www.espn.com/nfl/team/_/name/chi/", icon: "⚑" },
    { name: "NFL.com — Bears", handle: "official league", url: "https://www.nfl.com/teams/chicago-bears/", icon: "⬢" },
  ],

  endpoints: {
    espnBase: "https://site.api.espn.com/apis/site/v2/sports/football/nfl",
    // Alternate ESPN API hosts — same JSON, different infrastructure.
    // If a visitor's network blocks one host, the others usually still
    // answer; the site races them in parallel and takes the first winner.
    espnWebBase: "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl",
    espnCdnBase: "https://cdn.espn.com/core/api/v2/sports/football/nfl",
    weather: "https://api.open-meteo.com/v1/forecast",
    // Second weather source: NOAA/NWS (api.weather.gov) — official US
    // forecast service, CORS-open, no key. Used automatically when Open-Meteo
    // can't be reached.
    nws: "https://api.weather.gov",
    nwsPoint: "41.8781,-87.6298", // Soldier Field
    // Second news source: wide-wire RSS ("Chicago Bears") — no CORS
    // headers, so it always rides the proxy chain (local proxy first).
    // Google News first; Bing News is the second upstream — public CORS
    // proxies can usually reach Bing even when Google News is blocked.
    googleNews: "https://news.google.com/rss/search",
    bingNews: "https://www.bing.com/news/search",
    weatherParams: {
      latitude: 41.8781, longitude: -87.6298,
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum",
      forecast_days: 3, timezone: "America/Chicago",
    },
    polymarket: "https://gamma-api.polymarket.com/events",

    // Optional BYO-key source (About page, free tier 100 req/day). NFL =
    // league 39. The key lives only in the browser's localStorage.
    apisports: "https://v3.football.api-sports.io",
    apisportsLeague: 39,

    // Local loopback feed proxy (proxy/cf-proxy.ps1, started via
    // Start-Local-Proxy.bat). Tried FIRST by every feed: on networks where
    // ESPN's CDN 403s browser traffic (residential lines, VPNs), the proxy
    // fetches with a tool-style client and the feed goes live anyway. If the
    // proxy isn't running, this attempt fails in a few milliseconds and the
    // chain moves on. Loopback-only — unreachable from the internet.
    localProxy: "http://127.0.0.1:8799",
    // Optional always-on remote proxy for phones / other machines: deploy
    // proxy/cf-proxy-worker.js to any host (the file targets Cloudflare
    // Workers) and put its URL here, e.g. "https://cf-proxy.example.workers.dev".
    // Leave as "" to skip this step entirely.
    remoteProxy: "",
  },

  // Cache TTLs (ms) for localStorage snapshots — the offline fallback only.
  // Every visit still tries the live feed first; these bound how old the
  // snapshot can be when the network is down. Kept short so even the
  // fallback is fresh.
  ttl: { scoreboard: 10 * 60e3, news: 30 * 60e3, schedule: 3600e3, standings: 3600e3, roster: 3600e3, weather: 10 * 60e3, injuries: 5 * 60e3 },
};

/* ---------------- tiny utilities ---------------- */
CF.$ = (sel, root) => (root || document).querySelector(sel);
CF.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

CF.esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

CF.fmt = (n) => {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + "K";
  return String(v);
};

CF.timeAgo = (iso) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  return new Date(iso).toLocaleDateString();
};

CF.fmtDate = (iso, opts) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, opts || { weekday: "short", month: "short", day: "numeric" }); }
  catch (e) { return String(iso).slice(0, 10); }
};

CF.fmtTime = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  catch (e) { return ""; }
};

CF.toast = (msg) => {
  let t = CF.$("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
};

CF.copyText = (text, msg) => {
  const done = () => CF.toast(msg || "Copied to clipboard ✓");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  } else fallback();
  function fallback() {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { CF.toast("Copy failed — select it manually"); }
    document.body.removeChild(ta);
  }
};

/* ---------------- fetch with timeout + localStorage cache ---------------- */
/* Promise.any wrapper: race several fetch attempts at once; the first one
   to answer wins, the losers abort on their own timeouts. If every attempt
   fails, rethrow the first error. This is what keeps the whole page fast:
   a feed no longer waits 45 s of sequential retries — it waits for the
   fastest working path (~2 s on a normal network). */
CF.raceJSON = async (attempts) => {
  const ps = [];
  for (const a of attempts) {
    let p;
    try { p = Promise.resolve().then(a); }
    catch (e) { p = Promise.reject(e); }
    ps.push(p);
  }
  if (!ps.length) throw new Error("no fetch attempts");
  try { return await Promise.any(ps); }
  catch (agg) { throw (agg && agg.errors && agg.errors[0]) || new Error("all fetch attempts failed"); }
};

CF.fetchJSON = async (url, opts) => {
  opts = opts || {};
  const timeout = opts.timeout || 9000;
  const ctrl = new AbortController();
  const h = setTimeout(() => ctrl.abort(), timeout);
  const headers = Object.assign({ Accept: "application/json, text/xml;q=0.9, */*;q=0.8" }, opts.headers || {});
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: headers }, opts.init || {}));
    if (!r.ok) throw new Error("HTTP " + r.status);
    const text = await r.text();
    try { return JSON.parse(text); }
    catch (e) { throw new Error("Not JSON"); }
  } finally { clearTimeout(h); }
};

CF.cacheGet = (key) => {
  try {
    const raw = localStorage.getItem("cf." + key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.ts) return null;
    if (Date.now() - o.ts > (o.ttl || 3600e3)) return null;
    return o.data;
  } catch (e) { return null; }
};

CF.cacheSet = (key, data, ttl) => {
  try { localStorage.setItem("cf." + key, JSON.stringify({ ts: Date.now(), ttl: ttl || 3600e3, data })); }
  catch (e) { /* storage full or blocked — ignore */ }
};

/* ---------------- generic fetch with the full fallback chain ----------------
   For endpoints outside CF.getSource (game detail, Polymarket, The Odds API,
   weather). Order: local loopback proxy -> direct -> optional remote proxy.
   The local attempt fails in milliseconds when the proxy isn't running, so
   there is no cost for the normal case. */
CF.fetchVia = async (url, opts) => {
  opts = opts || {};
  const t = opts.timeout || 9000;
  const local = CF.CONFIG.endpoints.localProxy;
  // Stage 1 — local loopback proxy (when running) + direct, raced.
  const stage1 = [];
  if (local) stage1.push(() => CF.fetchJSON(local + "/fetch?url=" + encodeURIComponent(url), { timeout: Math.min(5000, t) }));
  stage1.push(() => CF.fetchJSON(url, { timeout: t, headers: opts.headers }));
  let firstErr = null;
  try { return await CF.raceJSON(stage1); }
  catch (e) { firstErr = e; }
  // Stage 2 — optional remote proxy + public CORS proxies, raced.
  const stage2 = [];
  const remote = CF.CONFIG.endpoints.remoteProxy;
  if (remote) stage2.push(() => CF.fetchJSON(remote + "/fetch?url=" + encodeURIComponent(url), { timeout: 6000 }));
  for (const proxy of CF.PROXIES) stage2.push(() => CF.fetchJSON(proxy(url), { timeout: 10000, headers: opts.headers }));
  if (stage2.length) {
    try { return await CF.raceJSON(stage2); } catch (e) { /* fall through */ }
  }
  throw firstErr || new Error("all fetch paths failed: " + url);
};

/* Raw text fetch with timeout (for non-JSON feeds like RSS). */
CF.rawFetch = async (url, timeout) => {
  const ctrl = new AbortController();
  const h = setTimeout(() => ctrl.abort(), timeout || 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json, text/xml;q=0.9, */*;q=0.8" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(h); }
};

/* Same fallback chain as CF.fetchVia, but returns the raw body (text).
   Includes the public CORS proxies — RSS feeds (Google/Bing News) have no
   CORS headers, so on public networks this is the whole show. */
CF.fetchText = async (url, opts) => {
  opts = opts || {};
  const t = opts.timeout || 9000;
  const local = CF.CONFIG.endpoints.localProxy;
  // Stage 1 — local loopback proxy (when running) + direct, raced.
  const stage1 = [];
  if (local) stage1.push(() => CF.rawFetch(local + "/fetch?url=" + encodeURIComponent(url), Math.min(5000, t)));
  stage1.push(() => CF.rawFetch(url, t));
  let firstErr = null;
  try { return await CF.raceJSON(stage1); }
  catch (e) { firstErr = e; }
  // Stage 2 — optional remote proxy + public CORS proxies, raced.
  const stage2 = [];
  const remote = CF.CONFIG.endpoints.remoteProxy;
  if (remote) stage2.push(() => CF.rawFetch(remote + "/fetch?url=" + encodeURIComponent(url), 6000));
  for (const proxy of CF.PROXIES) stage2.push(() => CF.rawFetch(proxy(url), 10000));
  if (stage2.length) {
    try { return await CF.raceJSON(stage2); } catch (e) { /* fall through */ }
  }
  throw firstErr || new Error("all fetch paths failed: " + url);
};

/* ---------------- data source helper: the full live-feed chain ----------------
   Every named feed resolves in stages, and each stage RACES its paths in
   parallel (CF.raceJSON) — the fastest working path wins, losers abort:
   1) direct hosts (the primary + alternates passed as altFetchers, e.g.
      site.web.api.espn.com / cdn.espn.com) + the local loopback proxy
      (Start-Local-Proxy.bat) when it is running;
   2) optional remote proxy (e.g. the included Cloudflare Worker) + the
      public CORS proxies — the rescue path for networks that block the
      direct hosts;
   3) the localStorage snapshot from a previous successful visit.
   Data that arrives via any path in stages 1–2 is LIVE data, so it is
   reported as source "live"; only stage 3 (stale snapshot) reports
   "cache". */
CF.getSource = async (name, fetcher, cacheKey, directUrl, altFetchers) => {
  const ttl = (CF.CONFIG.ttl[name] != null) ? CF.CONFIG.ttl[name] : 3600e3;
  const direct = directUrl || urlFor(name);
  const local = CF.CONFIG.endpoints.localProxy;
  const remote = CF.CONFIG.endpoints.remoteProxy;

  // Stage 1 — direct hosts + local proxy, raced in parallel.
  const stage1 = [];
  if (direct && local) stage1.push(() => CF.fetchJSON(local + "/fetch?url=" + encodeURIComponent(direct), { timeout: 5000 }));
  stage1.push(fetcher);
  if (altFetchers) for (const a of altFetchers) if (typeof a === "function") stage1.push(a);
  let firstErr = null;
  try {
    const data = await CF.raceJSON(stage1);
    CF.cacheSet(cacheKey, data, ttl);
    return { data, source: "live", name };
  } catch (e) { firstErr = e; }

  // Stage 2 — remote proxy + public CORS proxies, raced in parallel.
  if (direct) {
    const stage2 = [];
    if (remote) stage2.push(() => CF.fetchJSON(remote + "/fetch?url=" + encodeURIComponent(direct), { timeout: 6000 }));
    for (const proxy of CF.PROXIES) stage2.push(() => CF.fetchJSON(proxy(direct), { timeout: 10000 }));
    if (stage2.length) {
      try {
        const data = await CF.raceJSON(stage2);
        CF.cacheSet(cacheKey, data, ttl);
        return { data, source: "live", name };
      } catch (e2) { /* stage 3 */ }
    }
  }

  // Stage 3 — the snapshot from the last successful visit.
  const cached = CF.cacheGet(cacheKey);
  if (cached) return { data: cached, source: "cache", name };
  throw firstErr || new Error("offline:" + name);
};

function urlFor(n) {
  if (n === "scoreboard") return CF.CONFIG.endpoints.espnBase + "/scoreboard?dates=" + CF.todayParam();
  if (n === "news") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/news";
  if (n === "schedule") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/schedule";
  if (n === "standings") return CF.CONFIG.endpoints.espnBase + "/standings";
  if (n === "roster") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/roster";
  if (n === "team") return CF.CONFIG.endpoints.espnBase + "/teams/chicago";
  if (n === "odds") return CF.CONFIG.endpoints.espnBase + "/odds";
  if (n === "injuries") return CF.CONFIG.endpoints.espnBase + "/injuries";
  return null;
}
/* Public CORS proxies — the last-resort stage for visitors whose networks
   block every direct host. cors.eu.org leads because it is the one that
   has actually answered for ESPN; the others stay on the bench as a
   rotating reserve (free public proxies come and go). Each is only used
   after the direct attempts failed, and only one winner is needed. */
CF.PROXIES = [
  (u) => "https://cors.eu.org/" + u,
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
];

CF.todayParam = (d) => {
  const dt = d || new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return "" + y + m + dd;
};

CF.dayParam = (offset) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return CF.todayParam(dt);
};

/* ---------------- auto-refresh registry ----------------
   One shared scheduler behind every "keep it fresh" panel on every page.
   CF.refresh.register(fn, everyMs) re-runs fn while the tab is open:
   - hidden tabs are skipped (browsers throttle them anyway),
   - anything that came due while hidden fires the instant the tab is back,
   - a per-job busy guard means a slow feed can never stack a second run on
     top of one still in flight,
   - errors are swallowed so the page keeps showing the last good data;
     each panel already wears its own "offline / snapshot" pill for that case.
   Net effect: as long as a tab is open, everything keeps updating; every
   fresh visit starts by hitting the live feeds directly. */
CF.refresh = (function () {
  const MIN_MS = 15e3; // don't hammer the feeds
  const jobs = [];

  function run(job) {
    if (job.busy) return;
    job.busy = true;
    let p;
    try { p = Promise.resolve().then(job.fn); }
    catch (e) { job.busy = false; return; }
    job.lastRun = Date.now();
    p.catch(function () { /* keep last good state — panels show their own offline pill */ })
     .then(function () { job.busy = false; });
  }

  function tick() {
    // __cf_forceTick is a smoke-test hook: lets the in-app browser verify job
    // execution even if its tab reports itself hidden.
    if (document.hidden && !window.__cf_forceTick) return;
    const now = Date.now();
    for (const job of jobs) {
      if (now >= job.due) {
        job.due = now + job.interval;
        run(job);
      }
    }
  }

  const api = {
    jobs: jobs, // exposed for debugging / tests
    _tick: tick, // exposed for smoke tests only
    register(fn, everyMs, opts) {
      if (typeof fn !== "function") return null;
      const interval = Math.max(MIN_MS, Number(everyMs) || 60e3);
      const job = { fn: fn, interval: interval, due: Date.now() + interval, busy: false, lastRun: null, name: (opts && opts.name) || null };
      jobs.push(job);
      return job;
    },
  };

  setInterval(tick, 5e3);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
  return api;
})();

/* ---------------- weather strip + cold front gauge ---------------- */
const WMO = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  85: "Snow showers", 86: "Snow showers",
  95: "Thunder", 96: "Thunder + hail", 99: "Thunder + hail",
};

CF.weatherCode = (c) => WMO[c] || "—";

CF.windChill = (tC, kmh) => {
  if (tC > 10 || kmh < 5) return tC;
  const t = 9 + (3.7 * Math.min(kmh, 20) * Math.pow(Math.abs(tC), 0.4));
  return t;
};

CF.coldFrontGauge = (w) => {
  // Themed "fan gauge" derived from real field numbers (Open-Meteo or NWS).
  if (!w) return null;
  const tC = (w.feelsC != null) ? w.feelsC : w.apparent_temperature;
  const wind = w.gusts || w.wind || w.wind_gusts_10m || w.wind_speed_10m || 0;
  // Real snowfall (cm) today — NOT the chance of precipitation, which in
  // August is just the odds of a summer storm.
  const snow = (w.snowCm != null) ? Number(w.snowCm) : 0;
  let score = 0;
  if (tC < 0) score += 55; else if (tC < 5) score += 42; else if (tC < 10) score += 28; else if (tC < 16) score += 12;
  if (wind >= 60) score += 35; else if (wind >= 40) score += 26; else if (wind >= 25) score += 15;
  if (snow >= 5) score += 25; else if (snow >= 1) score += 12;
  score = Math.min(100, score);
  let label = "Mild for the Midwest", cls = "mild";
  if (score >= 70) { label = "Blizzard watch — bring the beanie"; cls = "blizzard"; }
  else if (score >= 40) { label = "Cruncher conditions — the front is in"; cls = "cruncher"; }
  return { score, label, cls };
};

CF.loadWeather = async () => {
  const base = CF.CONFIG.endpoints.weather;
  const p = CF.CONFIG.endpoints.weatherParams;
  const qs = Object.keys(p).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k])).join("&");
  try {
    const d = await CF.fetchVia(base + "?" + qs, { timeout: 8000 });
    const cur = d.current || {};
    // precipProb = chance of ANY precipitation today (rain in summer).
    // snowCm     = actual snowfall today in cm (the only real "snow" signal).
    let precipProb = null, snowCm = null;
    if (d.daily && d.daily.precipitation_probability_max && d.daily.precipitation_probability_max.length) {
      precipProb = d.daily.precipitation_probability_max[0];
    }
    if (d.daily && d.daily.snowfall_sum && d.daily.snowfall_sum.length) {
      snowCm = d.daily.snowfall_sum[0];
    }
    const wx = {
      tempC: cur.temperature_2m,
      feelsC: cur.apparent_temperature,
      wind: cur.wind_speed_10m,
      gusts: cur.wind_gusts_10m,
      humidity: cur.relative_humidity_2m,
      code: cur.weather_code,
      time: cur.time,
      snowProb: precipProb,
      snowCm,
      daily: d.daily || null,
      source: "open-meteo",
    };
    wx.gauge = CF.coldFrontGauge(wx);
    CF.cacheSet("weather", wx, CF.CONFIG.ttl.weather);
    return wx;
  } catch (e) {
    // Open-Meteo unreachable — fall back to the official US source (NWS).
    try { return await CF.loadWeatherNWS(); }
    catch (e2) {
      const c = CF.cacheGet("weather");
      if (c) { c.offline = true; return c; }
      return null;
    }
  }
};

/* NOAA/NWS fallback weather (api.weather.gov — CORS-open, no key).
   Maps to the same wx shape so the weather strip renders it identically. */
CF.loadWeatherNWS = async () => {
  const base = CF.CONFIG.endpoints.nws;
  const pt = CF.CONFIG.endpoints.nwsPoint;
  const points = await CF.fetchVia(base + "/points/" + pt, { timeout: 8000 });
  const grid = points.properties && points.properties.forecast;
  if (!grid) throw new Error("no NWS gridpoint");
  let obs = null, fc = null;
  try { obs = (await CF.fetchVia(grid + "/observations/latest", { timeout: 8000 })).properties; } catch (e) { obs = null; }
  try { fc = (await CF.fetchVia(grid, { timeout: 8000 })).properties; } catch (e) { fc = null; }
  const p0 = fc && fc.periods && fc.periods[0] ? fc.periods[0] : null;
  if (!obs && !p0) throw new Error("no NWS data");
  const num = (s) => { const m = String(s == null ? "" : s).match(/-?\d+\.?\d*/); return m ? parseFloat(m[0]) : null; };
  const wx = {
    tempC: obs ? obs.tempC : (p0 ? p0.temperature * 5 / 9 - 160 / 9 : null),
    feelsC: obs ? obs.tempC : (p0 ? p0.temperature * 5 / 9 - 160 / 9 : null),
    wind: obs ? obs.windSpeedKmH : (p0 ? num(p0.windSpeed) * 1.609 : null),
    gusts: obs ? num(obs.windGust) * 1.609 : null,
    humidity: obs && obs.relativeHumidity != null ? parseFloat(obs.relativeHumidity) : null,
    code: null,
    phrase: (obs && obs.textDescription) || (p0 && p0.shortForecast) || "NOAA/NWS",
    time: obs ? obs.timestamp : (p0 ? p0.endTime : null),
    snowProb: p0 && p0.probabilityOfPrecipitation && p0.probabilityOfPrecipitation.value != null ? p0.probabilityOfPrecipitation.value : null,
    snowCm: null,
    // NWS gives no snowfall total here; the forecast wording is the signal.
    snowWord: /\b(snow|snowshowers?)\b/i.test(((obs && obs.textDescription) || (p0 && p0.shortForecast) || "")),
    daily: null,
    source: "nws",
  };
  wx.gauge = CF.coldFrontGauge(wx);
  CF.cacheSet("weather", wx, CF.CONFIG.ttl.weather);
  return wx;
};

CF.renderWeatherStrip = (root) => {
  const el = root || CF.$("[data-cf-weather]");
  if (!el) return;
  el.innerHTML =
    '<span class="wx-brand">⛈ Chicago Field Conditions</span>' +
    '<span class="wx-item" id="wx-now">warming up…</span>' +
    '<span class="wx-item"><span class="wx-dot"></span><b>41.88°N 87.63°W</b></span>' +
    '<span class="wx-gauge" id="wx-gauge">reading the front…</span>';
  const update = () => CF.loadWeather().then((wx) => {
    CF.setSnow(CF.snowShouldFall(wx)); // let the flake machine follow the real weather
    const now = CF.$("#wx-now", el);
    const gauge = CF.$("#wx-gauge", el);
    if (!wx) {
      now.innerHTML = '<span class="wx-offline">offline — last reading unavailable</span>';
      gauge.textContent = "no data";
      return;
    }
    const f = (c) => Math.round(c * 9 / 5 + 32);
    const desc = wx.phrase ? CF.esc(wx.phrase) : CF.esc(CF.weatherCode(wx.code));
    now.innerHTML =
      "<b>" + f(wx.tempC) + "°F</b> " + desc +
      " · feels <b>" + f(wx.feelsC) + "°F</b>" +
      " · wind <b>" + Math.round(wx.wind) + " km/h</b>" +
      (wx.gusts ? " (gusts " + Math.round(wx.gusts) + ")" : "") +
      (wx.snowCm != null && Number(wx.snowCm) > 0 ? " · snow " + (Math.round(Number(wx.snowCm) * 10) / 10) + " cm" : "") +
      (wx.snowWord ? " · snow in the forecast" : "") +
      (wx.snowProb != null && !wx.snowWord ? " · rain " + Math.round(wx.snowProb) + "%" : "") +
      (wx.source === "nws" ? ' · <span class="dim" style="font-size:11px">NOAA/NWS</span>' : "") +
      (wx.offline ? ' · <span class="wx-offline">cached</span>' : "");
    if (wx.gauge) {
      gauge.textContent = wx.gauge.label + " · " + wx.gauge.score + "/100";
      gauge.className = "wx-gauge " + wx.gauge.cls;
    }
  });
  update();
  CF.refresh.register(update, CF.CONFIG.ttl.weather || 60e4); // re-read the front every 10 min while the page is open
};

/* ---------------- snow canvas (weather- and season-aware) ----------------
   The theme is winter football, but it's still summer in August, so the
   flake machine only spins on REAL snow signals: a WMO snow weather code,
   actual snowfall today (Open-Meteo snowfall_sum >= 0.2 cm), the NWS
   forecast wording saying snow, or sub-freezing temps. "Chance of
   precipitation" is NOT a snow signal — in August that's just the odds of a
   summer storm. With no weather data at all, it falls back to Chicago's
   real snow window (Nov-Mar). Respects prefers-reduced-motion. */
CF.snowShouldFall = (wx) => {
  if (wx && typeof wx === "object") {
    const code = Number(wx.code) || 0;
    const SNOW_CODES = [56, 57, 66, 67, 71, 73, 75, 77, 85, 86];
    if (SNOW_CODES.indexOf(code) >= 0) return true;
    if (wx.snowCm != null && Number(wx.snowCm) >= 0.2) return true; // actual snowfall today
    if (wx.snowWord) return true; // NWS forecast wording: snow
    const t = (wx.feelsC != null) ? wx.feelsC : wx.tempC;
    if (t != null && Number(t) <= 2) return true;
    return false;
  }
  const m = new Date().getMonth(); // 0 = Jan
  return m >= 10 || m <= 2;
};

CF.setSnow = (on) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) on = false;
  if (CF._snowOn === on) return;
  CF._snowOn = on;
  if (on) CF._snow.start(); else CF._snow.stop();
};

CF._snow = (function () {
  const N = 70;
  let canvas = null, ctx = null, W = 0, H = 0, flakes = [], raf = 0, running = false;
  const mk = (init) => ({
    x: Math.random() * W,
    y: init ? Math.random() * H : -6,
    r: 0.8 + Math.random() * 2.2,
    vy: 0.35 + Math.random() * 0.9,
    vx: -0.15 + Math.random() * 0.3,
    a: 0.25 + Math.random() * 0.55,
    sway: Math.random() * Math.PI * 2,
  });
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  function onVis() {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (CF._snowOn) { running = true; loop(); }
  }
  function loop() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e8f1fa";
    for (const f of flakes) {
      f.sway += 0.012;
      f.x += f.vx + Math.sin(f.sway) * 0.18;
      f.y += f.vy;
      if (f.y > H + 6) { Object.assign(f, mk(false)); }
      if (f.x > W + 6) f.x = -6;
      if (f.x < -8) f.x = W + 4;
      ctx.globalAlpha = f.a;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    canvas = CF.$("#snow");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    flakes = [];
    for (let i = 0; i < N; i++) flakes.push(mk(true));
    running = true;
    loop();
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVis);
    if (ctx) ctx.clearRect(0, 0, W, H);
  }
  return { start, stop };
})();

/* Shared status pill class for injury rows (Out / Questionable / IR / …). */
CF.injStatusCls = (s) => {
  const x = (s || "").toLowerCase();
  if (x.includes("injured reserve") || x === "ir") return "out";
  if (x.includes("out")) return "out";
  if (x.includes("questionable") || x.includes("doubtful")) return "questionable";
  if (x.includes("day")) return "day-to-day";
  if (x.includes("suspens")) return "out";
  return "active";
};

/* ---------------- nav + chrome ---------------- */
CF.initChrome = () => {
  const page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  CF.$$(".nav a").forEach((a) => {
    const href = (a.getAttribute("href") || "").replace(/\.html$/, "");
    if (href === page || (page === "index" && href === "")) a.classList.add("active");
  });
  const toggle = CF.$(".nav-toggle");
  const nav = CF.$(".nav");
  if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("open"));

  // author slots anywhere on the page
  CF.$$("[data-cf-x-handle]").forEach((el) => { el.textContent = CF.CONFIG.author.xHandle; });
  CF.$$("[data-cf-x-url]").forEach((el) => { el.href = CF.CONFIG.author.x; });

  // socials lists (footer / about)
  CF.$$("[data-cf-socials]").forEach((ul) => {
    ul.innerHTML = CF.CONFIG.socials.map((s) =>
      '<li><a href="' + CF.esc(s.url) + '" target="_blank" rel="noopener">' +
      '<span style="display:inline-block;width:18px">' + CF.esc(s.icon) + '</span> ' + CF.esc(s.name) +
      ' <span class="dim">' + CF.esc(s.handle) + '</span></a></li>'
    ).join("");
  });
  const grid = CF.$("#home-socials");
  if (grid) {
    grid.innerHTML = CF.CONFIG.socials.map((s) =>
      '<a href="' + CF.esc(s.url) + '" target="_blank" rel="noopener"><span class="ico">' + CF.esc(s.icon) + '</span>' +
      '<span>' + CF.esc(s.name) + ' <span class="dim">' + CF.esc(s.handle) + '</span></span></a>'
    ).join("");
  }

  CF.renderWeatherStrip();
  // Snow decision: use the last cached reading if we have one, otherwise
  // the calendar (Nov-Mar in Chicago). renderWeatherStrip re-decides as
  // soon as the live weather answers — no August blizzards.
  CF.setSnow(CF.snowShouldFall(CF.cacheGet("weather")));

  const yr = CF.$("[data-cf-year]");
  if (yr) yr.textContent = new Date().getFullYear();
};

document.addEventListener("DOMContentLoaded", CF.initChrome);
