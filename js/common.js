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
    blurb: "The all-in-one Chicago Bears fan hub — live news, injuries, odds, stats, schedule, roster & practice intel.",
    version: "1.13.0",
  },

  author: {
    name: "kshot",
    x: "https://x.com/kshot9000",
    xHandle: "@kshot9000",
    github: "https://github.com/Kshot3000",
  },

  // Donation wallets (same addresses as EUTXO.DEX / NightDream + Pearl).
  donations: [
    {
      chain: "PRL",
      label: "Pearl (PRL)",
      symbol: "◆",
      color: "#E8541E",
      address: "prl1p62v09vuzyd8kdz9l23jaf3kph4wwx6jqcmhkkhg8lhr2qlxky8psu3zw9d",
      // No public explorer URL wired yet — about.js only shows the
      // Explorer button when `view` is present.
    },
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
    // Primary: site.web.api — answers browser UAs. site.api often 403s
    // Akamai-fingerprinted browsers (Chrome/Safari) while still letting curl through.
    espnBase: "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl",
    // Alternate ESPN API hosts — same JSON, different infrastructure.
    // If a visitor's network blocks one host, the others usually still
    // answer; the site races them in parallel and takes the first winner.
    espnWebBase: "https://site.api.espn.com/apis/site/v2/sports/football/nfl",
    espnCdnBase: "https://cdn.espn.com/core/api/v2/sports/football/nfl",
    // Same-origin baked snapshots (data/snapshots/) — honest last-known
    // payloads so GitHub Pages never sits on a spinner when every live
    // host and public CORS proxy is quiet.
    snapshotBase: "data/snapshots",
    weather: "https://api.open-meteo.com/v1/forecast",
    // Second weather source: NOAA/NWS (api.weather.gov) — official US
    // forecast service, CORS-open, no key. Used automatically when Open-Meteo
    // can't be reached.
    nws: "https://api.weather.gov",
    nwsPoint: "41.8623,-87.6167", // Soldier Field
    // Second news source: wide-wire RSS ("Chicago Bears") — no CORS
    // headers, so it always rides the proxy chain (local proxy first).
    // Google News first; Bing News is the second upstream — public CORS
    // proxies can usually reach Bing even when Google News is blocked.
    googleNews: "https://news.google.com/rss/search",
    bingNews: "https://www.bing.com/news/search",
    weatherParams: {
      latitude: 41.8623, longitude: -87.6167,
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum,wind_speed_10m_max",
      forecast_days: 3, timezone: "America/Chicago",
    },
    polymarket: "https://gamma-api.polymarket.com/events",

    // Optional BYO-key source (About page, free tier 100 req/day). NFL =
    // league 1. The key lives only in the browser's localStorage.
    apisports: "https://v1.american-football.api-sports.io",
    apisportsLeague: 1,

    // Public pages never probe the visitor's local network or request location.
    // Chicago weather uses the fixed Soldier Field coordinates above.
    localProxy: "",
    // Optional always-on remote proxy for phones / other machines: deploy
    // proxy/cf-proxy-worker.js (see proxy/DEPLOY.md) and put its URL here,
    // e.g. "https://cf-proxy.<you>.workers.dev". Leave "" to skip — the
    // public CORS bench + same-origin snapshots cover GitHub Pages.
    remoteProxy: "",
  },

  // Cache TTLs (ms) for localStorage snapshots — the offline fallback only.
  // Every visit still tries the live feed first; these bound how old the
  // snapshot can be when the network is down. Kept short so even the
  // fallback is fresh.
  ttl: { scoreboard: 10 * 60e3, news: 30 * 60e3, schedule: 3600e3, standings: 3600e3, roster: 3600e3, weather: 10 * 60e3, injuries: 5 * 60e3 },

  // Display ads (AdSense) — paste your publisher ID to go live.
  // While `client` is "" the ad slots are removed from the page entirely,
  // so the site stays clean until you're approved and ready to earn.
  ads: {
    client: "ca-pub-3316742664595468", // live — Kyle's AdSense
    slots: {
      homeLeaderboard: "", // index.html — below the wire ticker
      newsRail: "",        // news.html — bottom of the injury rail
      oddsInline: "",      // odds.html — under the Polymarket board
    },
  },
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
  try { return new Date(iso).toLocaleDateString(undefined, Object.assign({ timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" }, opts || {})); }
  catch (e) { return String(iso).slice(0, 10); }
};

CF.fmtTime = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString(undefined, { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", timeZoneName: "short" }); }
  catch (e) { return ""; }
};

/* v1.49.0 — Polymarket line-movement chip: compares this render's price
   against the previous render and returns a tiny ▲/▼ chip when the price
   moved at least one cent, otherwise an empty string. Prices are 0..1. */
CF.polyMoveChip = (prev, cur) => {
  const a = Number(prev), b = Number(cur);
  if (prev == null || cur == null || !Number.isFinite(a) || !Number.isFinite(b)) return "";
  const cents = Math.round((b - a) * 100);
  if (cents === 0) return "";
  const up = cents > 0;
  const n = Math.abs(cents);
  const dir = up ? "up" : "down";
  return '<span class="mv ' + dir + '" role="img" aria-label="' + dir + " " + n +
    " cent" + (n === 1 ? "" : "s") + ' since your last check">' +
    (up ? "▲" : "▼") + n + "¢</span>";
};

CF.toast = (msg) => {
  let t = CF.$("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    t.setAttribute("aria-atomic", "true");
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
    try { if (!document.execCommand("copy")) throw new Error("copy failed"); done(); } catch (e) { CF.toast("Copy failed — select it manually"); }
    document.body.removeChild(ta);
  }
};


/* ---------------- shared empty / skeleton markup ----------------
   Keep loading & empty states consistent across pages. Callers pass
   icon + title (+ optional sub / action HTML). Markup matches the
   .empty / .skel classes in css/main.css. */
CF.emptyHTML = (opts) => {
  opts = opts || {};
  const icon = opts.icon != null ? opts.icon : "❄";
  const title = opts.title != null ? opts.title : "Nothing here";
  const sub = opts.sub != null ? opts.sub : "";
  const action = opts.action || "";
  const loading = !!opts.loading;
  const cls = "empty" + (loading ? " is-loading" : "") + (opts.cls ? " " + opts.cls : "");
  const style = opts.style ? ' style="' + CF.esc(opts.style) + '"' : "";
  return '<div class="' + cls + '" role="status" aria-live="polite"' + style + ">" +
    '<div class="big" aria-hidden="true">' + icon + "</div>" +
    (title ? '<div class="empty-title">' + title + "</div>" : "") +
    (sub ? '<p class="empty-sub">' + sub + "</p>" : "") +
    (action || "") +
    "</div>";
};

/* Build N skeleton table rows spanning `cols` columns.
   widths: optional array of % widths (cycles). */
CF.skelRows = (cols, n, widths) => {
  cols = Math.max(1, Number(cols) || 4);
  n = Math.max(1, Number(n) || 3);
  widths = widths || [82, 70, 76, 64, 78];
  let html = "";
  for (let i = 0; i < n; i++) {
    const w = widths[i % widths.length];
    const lg = i === 0 ? " lg" : "";
    html += '<tr><td colspan="' + cols + '"><span class="skel' + lg + '" style="width:' + w + '%"></span></td></tr>';
  }
  return html;
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
  // Keep headers CORS-simple by default (no custom Accept). ESPN's
  // OPTIONS preflight 403s; a simple GET with ACAO:* is what works.
  const headers = Object.assign({}, opts.headers || {});
  try {
    const init = Object.assign({ signal: ctrl.signal }, opts.init || {});
    if (Object.keys(headers).length) init.headers = headers;
    const r = await fetch(url, init);
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

/* Loopback proxy is only reachable from a loopback page origin.
   From https://*.github.io Mixed Content / Private Network Access make
   http://127.0.0.1:* hang or fail — skip it so feeds resolve on Pages. */
CF.usableLocalProxy = () => {
  const p = CF.CONFIG.endpoints.localProxy;
  if (!p) return "";
  try {
    const host = (location && location.hostname) || "";
    if (host && host !== "127.0.0.1" && host !== "localhost") return "";
    if (location.protocol === "https:" && /^http:/i.test(p)) return "";
  } catch (e) { return ""; }
  return p;
};

/* Site root for same-origin assets — derived from js/common.js so nested
   pages (_qa/, deep links) still resolve data/snapshots correctly. */
CF.siteRoot = () => {
  try {
    if (CF._siteRoot) return CF._siteRoot;
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || "";
      if (/js\/common\.js(\?|#|$)/i.test(src)) {
        CF._siteRoot = src.replace(/js\/common\.js(\?.*)?(#.*)?$/i, "");
        return CF._siteRoot;
      }
    }
  } catch (e) { /* fall through */ }
  try {
    // Strip filename: /ColdFront/games.html → /ColdFront/
    const path = location.pathname || "/";
    CF._siteRoot = location.origin + path.replace(/\/[^/]*$/, "/");
  } catch (e2) { CF._siteRoot = ""; }
  return CF._siteRoot;
};

/* Same-origin snapshot fallback (data/snapshots/<key>.json). */
CF.snapshotGet = async (cacheKey) => {
  const base = (CF.CONFIG.endpoints.snapshotBase || "data/snapshots").replace(/\/$/, "");
  // Map dotted keys (scoreboard.20260925) → generic stem when needed.
  const stem = String(cacheKey || "").split(".")[0];
  if (cacheKey === "injuries") cacheKey = "injuries-bears";
  const rels = [];
  if (cacheKey) rels.push(base + "/" + cacheKey + ".json");
  if (stem && stem !== cacheKey) rels.push(base + "/" + stem + ".json");
  const root = CF.siteRoot();
  for (const rel of rels) {
    const candidates = [];
    // Prefer site-root resolution (works from /_qa and GitHub Pages subpath).
    if (root) candidates.push(root + rel);
    try { if (typeof location !== "undefined" && location.href) candidates.push(new URL(rel, location.href).href); } catch (e0) { /* ignore */ }
    candidates.push(rel);
    const seen = {};
    for (const url of candidates) {
      if (!url || seen[url]) continue;
      seen[url] = 1;
      try {
        const r = await fetch(url, { cache: "no-cache" });
        if (!r.ok) continue;
        const data = await r.json();
        // A weekly snapshot must never fill a different selected date.
        const day = /^scoreboard\.(\d{8})$/.exec(String(cacheKey));
        if (day) {
          const events = (data.events || []).filter((event) => CF.todayParam(new Date(event.date)) === day[1]);
          if (!events.length) continue;
          return Object.assign({}, data, { events });
        }
        return data;
      } catch (e) { /* try next */ }
    }
  }
  return null;
};

/* ---------------- generic fetch with the full fallback chain ----------------
   For endpoints outside CF.getSource (game detail, Polymarket, The Odds API,
   weather). Order: local loopback proxy -> direct -> optional remote proxy.
   The local attempt fails in milliseconds when the proxy isn't running, so
   there is no cost for the normal case. */
CF.fetchVia = async (url, opts) => {
  opts = opts || {};
  const t = opts.timeout || 9000;
  const local = CF.usableLocalProxy ? CF.usableLocalProxy() : CF.CONFIG.endpoints.localProxy;
  // Stage 1 — local loopback proxy (when running on loopback) + direct, raced.
  const stage1 = [];
  if (local) stage1.push(() => CF.fetchJSON(local + "/fetch?url=" + encodeURIComponent(url), { timeout: Math.min(2500, t) }));
  stage1.push(() => CF.fetchJSON(url, { timeout: t, headers: opts.headers }));
  let firstErr = null;
  try { return await CF.raceJSON(stage1); }
  catch (e) { firstErr = e; }
  // Stage 2 — optional remote proxy + public CORS proxies, raced.
  const stage2 = [];
  const remote = CF.CONFIG.endpoints.remoteProxy;
  if (remote) stage2.push(() => CF.fetchJSON(remote + "/fetch?url=" + encodeURIComponent(url), { timeout: 6000 }));
  for (const proxy of CF.PROXIES) stage2.push(() => CF.fetchJSON(proxy(url), { timeout: 4500, headers: opts.headers }));
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
    // No custom Accept — keep RSS/text fetches CORS-simple.
    const r = await fetch(url, { signal: ctrl.signal });
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
  const local = CF.usableLocalProxy ? CF.usableLocalProxy() : CF.CONFIG.endpoints.localProxy;
  // Stage 1 — local loopback proxy (when running on loopback) + direct, raced.
  const stage1 = [];
  if (local) stage1.push(() => CF.rawFetch(local + "/fetch?url=" + encodeURIComponent(url), Math.min(2500, t)));
  stage1.push(() => CF.rawFetch(url, t));
  let firstErr = null;
  try { return await CF.raceJSON(stage1); }
  catch (e) { firstErr = e; }
  // Stage 2 — optional remote proxy + public CORS proxies, raced.
  const stage2 = [];
  const remote = CF.CONFIG.endpoints.remoteProxy;
  if (remote) stage2.push(() => CF.rawFetch(remote + "/fetch?url=" + encodeURIComponent(url), 6000));
  for (const proxy of CF.PROXIES) stage2.push(() => CF.rawFetch(proxy(url), 4500));
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
CF.readSource = async (name, fetcher, cacheKey, directUrl, altFetchers) => {
  const ttl = (CF.CONFIG.ttl[name] != null) ? CF.CONFIG.ttl[name] : 3600e3;
  const direct = directUrl || urlFor(name);
  const local = CF.usableLocalProxy ? CF.usableLocalProxy() : CF.CONFIG.endpoints.localProxy;
  const remote = CF.CONFIG.endpoints.remoteProxy;

  // Stage 1 — direct hosts + local proxy (loopback pages only), raced.
  const stage1 = [];
  if (direct && local) stage1.push(() => CF.fetchJSON(local + "/fetch?url=" + encodeURIComponent(direct), { timeout: 2500 }));
  stage1.push(fetcher);
  if (altFetchers) for (const a of altFetchers) if (typeof a === "function") stage1.push(a);
  let firstErr = null;
  try {
    const data = await CF.raceJSON(stage1);
    CF.cacheSet(cacheKey, data, ttl);
    return { data, source: "live", name };
  } catch (e) { firstErr = e; }

  // Stage 2 — remote + public CORS proxies, RACED against a delayed
  // same-origin snapshot so dead proxies cannot strand the UI (~1.2s).
  if (direct) {
    const stage2 = [];
    if (remote) stage2.push(() => CF.fetchJSON(remote + "/fetch?url=" + encodeURIComponent(direct), { timeout: 4500 }).then(CF._unwrapProxyJSON));
    for (const proxy of CF.PROXIES) {
      stage2.push(() => CF.fetchJSON(proxy(direct), { timeout: 3200 }).then(CF._unwrapProxyJSON));
    }
    const proxyLive = stage2.length
      ? CF.raceJSON(stage2).then((data) => ({ data, source: "live" }))
      : Promise.reject(new Error("no proxies"));
    const delayedSnap = (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      const snap = await CF.snapshotGet(cacheKey);
      if (!snap) throw new Error("no snap");
      return { data: snap, source: "snapshot" };
    })();
    const cachedQuick = CF.cacheGet(cacheKey);
    const delayedCache = cachedQuick
      ? (async () => {
          await new Promise((r) => setTimeout(r, 900));
          return { data: cachedQuick, source: "cache" };
        })()
      : Promise.reject(new Error("no cache"));
    try {
      const r = await Promise.any([proxyLive, delayedSnap, delayedCache]);
      if (r.source === "live") CF.cacheSet(cacheKey, r.data, ttl);
      return { data: r.data, source: r.source, name };
    } catch (e2) { /* stage 3 */ }
  }

  // Stage 3 — localStorage snapshot from a previous successful visit.
  const cached = CF.cacheGet(cacheKey);
  if (cached) return { data: cached, source: "cache", name };

  // Stage 4 — same-origin baked snapshot (data/snapshots/).
  try {
    const snap = await CF.snapshotGet(cacheKey);
    if (snap) return { data: snap, source: "snapshot", name };
  } catch (e3) { /* fall through */ }

  throw firstErr || new Error("offline:" + name);
};

// Share simultaneous panel requests without marking cached responses as live.
CF.inflight = new Map();
CF.getSource = (name, fetcher, cacheKey, directUrl, altFetchers) => {
  const key = name + ":" + cacheKey;
  if (!CF.inflight.has(key)) {
    const request = CF.readSource(name, fetcher, cacheKey, directUrl, altFetchers)
      .finally(() => CF.inflight.delete(key));
    CF.inflight.set(key, request);
  }
  return CF.inflight.get(key);
};
CF.sourceLabel = (source) => { const value = typeof source === "string" ? source : source?.source; return value === "live" ? "live" : value === "snapshot" ? "saved snapshot" : "cached"; };
CF.safeURL = (value, fallback = "#") => {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : fallback; }
  catch (_) { return fallback; }
};

function urlFor(n) {
  if (n === "scoreboard") return CF.CONFIG.endpoints.espnBase + "/scoreboard?dates=" + CF.todayParam();
  if (n === "news") return CF.CONFIG.endpoints.espnBase + "/news?team=chi&limit=12";
  if (n === "schedule") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/schedule";
  if (n === "standings") return "https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings";
  if (n === "roster") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/roster";
  if (n === "team") return CF.CONFIG.endpoints.espnBase + "/teams/chicago";
  if (n === "odds") return CF.CONFIG.endpoints.espnBase + "/scoreboard";
  if (n === "injuries") return CF.CONFIG.endpoints.espnBase + "/injuries";
  return null;
}
/* Public CORS proxies — rescue stage after direct hosts fail.
   Free public proxies churn hard (ESPN especially is often blocked). Keep
   the list short, timeouts tight, and always race a same-origin snapshot
   so GitHub Pages never sits on a spinner. Prefer deploying
   proxy/cf-proxy-worker.js (proxy/DEPLOY.md) into remoteProxy when you can. */
CF.PROXIES = [
  // /raw only — /get returns a JSON envelope that breaks RSS text fetches.
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
];
CF._unwrapProxyJSON = (data) => data;

CF.todayParam = (date) => CF.dateInput(date).replace(/-/g, "");

CF.dateInput = (value) => {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name) => parts.find((p) => p.type === name).value;
  return part("year") + "-" + part("month") + "-" + part("day");
};
CF.dayParam = (offset) => {
  const date = new Date(CF.dateInput() + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return CF.todayParam(date);
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

/* ---- Condition-aware weather glyph (weather strip brand mark) ----
   v1.46.0 — the strip's brand glyph used to be a hard-coded ⛈ even on a
   clear September afternoon. It now follows the live sky: WMO code when
   Open-Meteo answers, phrase keywords when the NWS fallback answers. */
CF.wxIcon = (w) => {
  const raw = w && w.code;
  const code = (raw === null || raw === undefined || raw === "") ? NaN : Number(raw);
  if (Number.isFinite(code)) {
    if (code === 0) return "☀️";
    if (code === 1) return "🌤️";
    if (code === 2) return "⛅";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 57) return "🌦️";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
    if ([95, 96, 99].includes(code)) return "🌩️";
  }
  const phrase = (w && w.phrase) || "";
  if (/snow|flurr/i.test(phrase)) return "❄️";
  if (/thunder|tstorm|hail/i.test(phrase)) return "🌩️";
  if (/freezing rain|ice storm|sleet/i.test(phrase)) return "🌧️";
  if (/rain|shower/i.test(phrase)) return "🌧️";
  if (/drizzle/i.test(phrase)) return "🌦️";
  if (/fog|mist|haze/i.test(phrase)) return "🌫️";
  if (/overcast|cloud/i.test(phrase)) return "☁️";
  if (/clear|sun/i.test(phrase)) return "☀️";
  if (/partly/i.test(phrase)) return "⛅";
  return "⛅";
};

CF.windChill = (tempC, kmh) => {
  if (tempC > 10 || kmh < 4.8) return tempC;
  const wind = Math.pow(kmh, 0.16);
  return 13.12 + 0.6215 * tempC - 11.37 * wind + 0.3965 * tempC * wind;
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
  if (score >= 70) { label = "Deep freeze — bring the beanie"; cls = "blizzard"; }
  else if (score >= 40) { label = "Cruncher conditions — the front is in"; cls = "cruncher"; }
  return { score, label, cls };
};

/* ---- Cold Front Index sparkline (forecast + visit history) ----
   Fan-facing: a tiny SVG of the Index over the next few days (from
   Open-Meteo daily) plus a localStorage trail of recent readings so
   returning visits show movement. Never invents weather — scores come
   from CF.coldFrontGauge on real numbers only. */
CF.cfiHistoryKey = "cfiHistory";
CF.cfiHistoryPush = (score) => {
  if (score == null || isNaN(score)) return [];
  try {
    const raw = localStorage.getItem("cf." + CF.cfiHistoryKey);
    let arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) arr = [];
    const now = Date.now();
    const s = Math.max(0, Math.min(100, Math.round(Number(score))));
    if (arr.length && Math.abs(now - (arr[arr.length - 1].t || 0)) < 25 * 60e3) {
      arr[arr.length - 1] = { t: now, score: s };
    } else {
      arr.push({ t: now, score: s });
    }
    if (arr.length > 48) arr = arr.slice(-48);
    localStorage.setItem("cf." + CF.cfiHistoryKey, JSON.stringify(arr));
    return arr;
  } catch (e) { return []; }
};
CF.cfiHistoryGet = () => {
  try {
    const raw = localStorage.getItem("cf." + CF.cfiHistoryKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
};
CF.cfiForecastSeries = (wx) => {
  const d = wx && wx.daily;
  if (!d || !Array.isArray(d.time) || !d.time.length) return [];
  const out = [];
  for (let i = 0; i < d.time.length; i++) {
    const tMax = d.temperature_2m_max ? d.temperature_2m_max[i] : null;
    const wind = d.wind_speed_10m_max ? d.wind_speed_10m_max[i] : null;
    const snow = d.snowfall_sum ? d.snowfall_sum[i] : 0;
    if (tMax == null && wind == null) continue;
    const g = CF.coldFrontGauge({ feelsC: tMax, tempC: tMax, wind: wind || 0, gusts: wind || 0, snowCm: snow || 0 });
    if (g) out.push({ t: d.time[i], score: g.score, cls: g.cls, label: g.label });
  }
  return out;
};
CF.cfiSparkSVG = (scores) => {
  if (!scores || scores.length < 2) return "";
  const w = 118, h = 26, pad = 2;
  const n = scores.length;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const s = Math.max(0, Math.min(100, Number(scores[i]) || 0));
    const x = pad + (i / (n - 1)) * (w - pad * 2);
    const y = pad + (1 - s / 100) * (h - pad * 2);
    pts.push([x, y]);
  }
  const poly = pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const last = scores[scores.length - 1];
  const cls = last >= 70 ? "blizzard" : (last >= 40 ? "cruncher" : "mild");
  const lastPt = pts[pts.length - 1];
  return '<svg class="cfi-spark ' + cls + '" viewBox="0 0 ' + w + ' ' + h + '" width="118" height="26" role="img" aria-label="Cold Front Index sparkline">' +
    '<polyline fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" points="' + poly + '"></polyline>' +
    '<circle cx="' + lastPt[0].toFixed(1) + '" cy="' + lastPt[1].toFixed(1) + '" r="2.3" fill="currentColor"></circle>' +
    "</svg>";
};
/* ---- Cold Front Index frost dial (weather strip showpiece) ----
   v1.17.0 — the site's signature stat gets a proper instrument: a small
   animated semicircular SVG frost gauge. Needle sweeps to the live score,
   the frost arc fills and the number counts up. Reduced-motion readers get
   the final reading with no animation. Never invents — score comes from
   CF.coldFrontGauge on real numbers only. */
CF.cfiDialSVG = (score, cls, label) => {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const c = (cls === "blizzard" || cls === "cruncher" || cls === "mild") ? cls : "mild";
  const cx = 66, cy = 66;
  const polar = (deg, rr) => {
    const a = (deg * Math.PI) / 180;
    return [(cx + rr * Math.cos(a)).toFixed(1), (cy - rr * Math.sin(a)).toFixed(1)];
  };
  let ticks = "";
  [0, 25, 50, 75, 100].forEach((t) => {
    const p1 = polar(180 - t * 1.8, 46), p2 = polar(180 - t * 1.8, 40);
    ticks += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '"/>';
  });
  const stops = {
    mild: ['<stop offset="0" stop-color="#8fd6a8"/>', '<stop offset="1" stop-color="#3fae72"/>'],
    cruncher: ['<stop offset="0" stop-color="#9fd8ff"/>', '<stop offset="1" stop-color="#3fa9f5"/>'],
    blizzard: ['<stop offset="0" stop-color="#9fd8ff"/>', '<stop offset="1" stop-color="#ff6a1f"/>'],
  }[c];
  return '<svg class="cfi-dial ' + c + '" viewBox="0 0 132 80" width="104" height="63" role="img"' +
    ' aria-label="Cold Front Index ' + s + ' of 100 — ' + CF.esc(label) + '">' +
    '<defs><linearGradient id="cfi-g-' + c + '" x1="0" y1="0" x2="1" y2="0">' + stops.join("") + '</linearGradient></defs>' +
    '<path class="cfi-track" d="M 12 66 A 54 54 0 0 1 120 66" fill="none"/>' +
    '<g class="cfi-ticks" aria-hidden="true">' + ticks + '</g>' +
    '<path class="cfi-value" d="M 12 66 A 54 54 0 0 1 120 66" fill="none" pathLength="100"' +
    ' stroke="url(#cfi-g-' + c + ')" stroke-dasharray="100" stroke-dashoffset="' + (100 - s) + '"/>' +
    '<g class="cfi-needle" data-target="' + s + '" transform="rotate(' + (-90 + s * 1.8).toFixed(1) + ' 66 66)" aria-hidden="true">' +
      '<line x1="66" y1="66" x2="66" y2="27"/>' +
      '<circle cx="66" cy="66" r="3.4"/>' +
    '</g>' +
    '<text class="cfi-num" x="66" y="58" text-anchor="middle" aria-hidden="true">' + s + '</text>' +
    '<text class="cfi-cap" x="66" y="76" text-anchor="middle" aria-hidden="true">COLD FRONT INDEX</text>' +
    '</svg>';
};
CF.animateCfiDial = (wrap, score) => {
  if (!wrap) return;
  const val = wrap.querySelector(".cfi-value");
  const needle = wrap.querySelector(".cfi-needle");
  const num = wrap.querySelector(".cfi-num");
  if (!val || !needle || !num) return;
  const target = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const prev = Number(wrap.getAttribute("data-cfi-score")) || 0;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const apply = (v) => {
    val.setAttribute("stroke-dashoffset", (100 - v).toFixed(1));
    needle.setAttribute("transform", "rotate(" + (-90 + v * 1.8).toFixed(1) + " 66 66)");
    num.textContent = String(Math.round(v));
  };
  wrap.setAttribute("data-cfi-score", String(target));
  if (reduce || !("requestAnimationFrame" in window)) { apply(target); return; }
  apply(0);
  const t0 = performance.now(), dur = 1100;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    apply(prev + (target - prev) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // Guarantee the final reading even if rAF is stubbed or starved (idempotent in real browsers).
  if (wrap._cfiTimer) clearTimeout(wrap._cfiTimer);
  wrap._cfiTimer = setTimeout(() => apply(target), dur + 150);
};

CF.paintCfiSpark = (wx, root) => {
  const host = root || CF.$("#cfi-spark");
  if (!host) return;
  const hist = CF.cfiHistoryGet().map((x) => x.score);
  const forecast = CF.cfiForecastSeries(wx).map((x) => x.score);
  // Prefer multi-day forecast (clearest fan signal); fall back to visit history.
  let series = forecast.length >= 2 ? forecast : hist;
  if (wx && wx.gauge && series.length) {
    // Pin today's live reading as the first forecast point when present.
    if (forecast.length >= 2) series = [wx.gauge.score].concat(forecast.slice(1));
  }
  if (series.length < 2 && wx && wx.gauge) {
    series = hist.concat([wx.gauge.score]);
  }
  if (series.length < 2) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const tip = forecast.length >= 2
    ? ("Cold Front Index · next " + forecast.length + " days at Soldier Field")
    : ("Cold Front Index · " + series.length + " recent readings");
  host.title = tip;
  host.innerHTML = CF.cfiSparkSVG(series) +
    '<span class="cfi-spark-label">CFI</span>';
};

CF.loadWeather = async () => {
  const base = CF.CONFIG.endpoints.weather;
  const p = CF.CONFIG.endpoints.weatherParams;
  const qs = Object.keys(p).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k])).join("&");
  try {
    const d = await CF.fetchVia(base + "?" + qs, { timeout: 8000 });
    const cur = d.current || {};
    if (!Number.isFinite(cur.temperature_2m)) throw new Error("Weather reading missing");
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
  // NWS forecast is a forecast, not a fabricated observation endpoint.
  const fc = (await CF.fetchVia(grid, { timeout: 8000 })).properties;
  const period = fc?.periods?.[0];
  if (!period || !Number.isFinite(period.temperature)) throw new Error("No NWS forecast");
  const tempC = period.temperatureUnit === "C" ? period.temperature : (period.temperature - 32) * 5 / 9;
  const speeds = String(period.windSpeed || "").match(/\d+(?:\.\d+)?/g);
  const wind = speeds ? Math.max(...speeds.map(Number)) * 1.609344 : 0;
  const wx = {
    tempC, feelsC: CF.windChill(tempC, wind), wind, gusts: null, humidity: null,
    code: null, phrase: period.shortForecast || "NWS forecast", time: period.startTime,
    snowProb: period.probabilityOfPrecipitation?.value ?? null,
    snowCm: null, snowWord: /snow/i.test(period.shortForecast || ""),
    daily: null, source: "nws",
  };
  wx.gauge = CF.coldFrontGauge(wx);
  CF.cacheSet("weather", wx, CF.CONFIG.ttl.weather);
  return wx;
};

CF.renderWeatherStrip = (root) => {
  const el = root || CF.$("[data-cf-weather]");
  if (!el) return;
  el.innerHTML =
    '<span class="wx-brand"><span class="wx-icon" id="wx-icon" aria-hidden="true">⛈</span> Chicago Field Conditions</span>' +
    '<span class="wx-item" id="wx-now">warming up…</span>' +
    '<span class="wx-item"><span class="wx-dot"></span><b>Soldier Field · Chicago</b></span>' +
    '<span class="wx-cfi" id="wx-cfi">' +
      '<span class="wx-gauge" id="wx-gauge">reading the front…</span>' +
      '<span class="cfi-spark-wrap" id="cfi-spark" hidden></span>' +
    "</span>";
  const update = () => CF.loadWeather().then((wx) => {
    const now = CF.$("#wx-now", el);
    const gauge = CF.$("#wx-gauge", el);
    const icon = CF.$("#wx-icon", el);
    if (wx && icon) icon.textContent = CF.wxIcon(wx);
    if (!wx) {
      now.innerHTML = '<span class="wx-offline">offline — last reading unavailable</span>';
      gauge.innerHTML = '<span class="wx-offline" style="font-size:11px">no data</span>';
      gauge.className = "wx-gauge";
      const sp = CF.$("#cfi-spark", el);
      if (sp) { sp.innerHTML = ""; sp.hidden = true; }
      return;
    }
    const f = (c) => Math.round(c * 9 / 5 + 32);
    const desc = wx.phrase ? CF.esc(wx.phrase) : CF.esc(CF.weatherCode(wx.code));
    now.innerHTML =
      "<b>" + f(wx.tempC) + "°F</b> " + desc +
      " · feels <b>" + f(wx.feelsC) + "°F</b>" +
      " · wind <b>" + Math.round(wx.wind / 1.609344) + " mph</b>" +
      (wx.gusts ? " (gusts " + Math.round(wx.gusts / 1.609344) + " mph)" : "") +
      (wx.snowCm != null && Number(wx.snowCm) > 0 ? " · snow " + (Math.round(Number(wx.snowCm) * 10) / 10) + " cm" : "") +
      (wx.snowWord ? " · snow in the forecast" : "") +
      (wx.snowProb != null && !wx.snowWord ? " · precip. " + Math.round(wx.snowProb) + "%" : "") +
      (wx.source === "nws" ? ' · <span class="dim" style="font-size:11px">NWS forecast</span>' : "") +
      (wx.offline ? ' · <span class="wx-offline">cached</span>' : "");
    if (wx.gauge) {
      gauge.innerHTML = CF.cfiDialSVG(wx.gauge.score, wx.gauge.cls, wx.gauge.label);
      gauge.className = "wx-gauge cfi-dial-wrap " + wx.gauge.cls;
      gauge.title = "Cold Front Index: " + wx.gauge.label + " · " + wx.gauge.score + "/100";
      CF.animateCfiDial(gauge, wx.gauge.score);
      CF.cfiHistoryPush(wx.gauge.score);
    }
    CF.paintCfiSpark(wx, CF.$("#cfi-spark", el));
  });
  update();
  CF.refresh.register(update, CF.CONFIG.ttl.weather || 60e4); // re-read the front every 10 min while the page is open
};

/* Gameday mode: denser snow + hotter orange rim when kickoff window / live. */
CF._gamedayOn = false;
CF._gamedayWxBoost = 1;
CF.applyGamedayMode = (on, reason) => {
  const next = !!on;
  if (CF._gamedayOn === next) {
    if (next) CF._syncGamedaySnow();
    return;
  }
  CF._gamedayOn = next;
  document.body.classList.toggle("cf-gameday", next);
  if (next) document.body.setAttribute("data-cf-gameday", reason || "on");
  else document.body.removeAttribute("data-cf-gameday");
  CF._syncGamedaySnow();
};
CF._syncGamedaySnow = () => {
  if (!CF._snow || !CF._snow.setIntensity) return;
  const wx = CF.cacheGet("weather");
  let n = CF.snowIntensity(wx);
  if (CF._gamedayOn) n = Math.max(n, 1.72);
  CF._snow.setIntensity(n);
};

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

/* ---- Injury movement vs prior snapshot ----
   Fan signal: who is NEW on the report, who got UPGRADED (worse), who was
   REMOVED (cleared). Prior = localStorage trail, else the baked nightly
   snapshot when available. Never invents — only diffs real rows. */
CF.injSnapKey = "injSnap";
CF.injSeverity = (s) => {
  const x = (s || "").toLowerCase();
  if (!x || x === "active" || x.includes("healthy")) return 0;
  if (x.includes("day")) return 1;
  if (x.includes("questionable")) return 2;
  if (x.includes("doubtful")) return 3;
  if (x.includes("injured reserve") || x === "ir" || x.includes("out") || x.includes("suspens")) return 4;
  return 2;
};
CF.injRowKey = (row) => String((row && row.name) || "").trim().toLowerCase().replace(/\s+/g, " ");
CF.injSnapGet = () => {
  try {
    const raw = localStorage.getItem("cf." + CF.injSnapKey);
    const o = raw ? JSON.parse(raw) : null;
    if (!o || !Array.isArray(o.rows)) return null;
    return o;
  } catch (e) { return null; }
};
CF.injSnapSet = (rows) => {
  try {
    const slim = (rows || []).filter((r) => r && r.name).map((r) => ({
      name: r.name,
      pos: r.pos || "",
      status: r.status || "",
      comment: r.comment || r.injury || "",
    }));
    localStorage.setItem("cf." + CF.injSnapKey, JSON.stringify({ t: Date.now(), rows: slim }));
  } catch (e) { /* private mode */ }
};
CF.diffInjuryMovement = (current, priorRows) => {
  const cur = (current || []).filter((r) => r && r.name && (r.status || "").toLowerCase() !== "active");
  const pri = (priorRows || []).filter((r) => r && r.name && (r.status || "").toLowerCase() !== "active");
  const curMap = {};
  cur.forEach((r) => { curMap[CF.injRowKey(r)] = r; });
  const priMap = {};
  pri.forEach((r) => { priMap[CF.injRowKey(r)] = r; });
  const neu = [], up = [], rem = [];
  Object.keys(curMap).forEach((k) => {
    const c = curMap[k];
    const p = priMap[k];
    if (!p) neu.push(c);
    else if (CF.injSeverity(c.status) > CF.injSeverity(p.status)) {
      up.push({ name: c.name, from: p.status, to: c.status, pos: c.pos });
    }
  });
  Object.keys(priMap).forEach((k) => {
    if (!curMap[k]) rem.push(priMap[k]);
  });
  return { new: neu, upgraded: up, removed: rem, hasPrior: !!(priorRows && priorRows.length) };
};
CF.injuryMovementHTML = (diff, opts) => {
  opts = opts || {};
  if (!diff || !diff.hasPrior) return "";
  const bits = [];
  (diff.new || []).slice(0, opts.maxNew || 4).forEach((r) => {
    bits.push('<span class="move-chip new" title="Newly listed">' +
      '<span class="k">New</span><b>' + CF.esc(r.name) + "</b>" +
      (r.status ? ' <span class="st ' + CF.esc(CF.injStatusCls(r.status)) + '">' + CF.esc(r.status) + "</span>" : "") +
      "</span>");
  });
  (diff.upgraded || []).slice(0, opts.maxUp || 4).forEach((r) => {
    bits.push('<span class="move-chip up" title="' + CF.esc((r.from || "?") + " → " + (r.to || "?")) + '">' +
      '<span class="k">↑ Up</span><b>' + CF.esc(r.name) + "</b>" +
      ' <span class="dim">' + CF.esc(r.from || "?") + " → " + CF.esc(r.to || "?") + "</span></span>");
  });
  (diff.removed || []).slice(0, opts.maxRem || 4).forEach((r) => {
    bits.push('<span class="move-chip rem" title="Cleared from report">' +
      '<span class="k">Cleared</span><b>' + CF.esc(r.name) + "</b></span>");
  });
  if (!bits.length) {
    return opts.showQuiet
      ? '<div class="inj-move quiet" role="status"><span class="dim">No report movement vs prior snapshot.</span></div>'
      : "";
  }
  const count = (diff.new || []).length + (diff.upgraded || []).length + (diff.removed || []).length;
  return '<div class="inj-move" role="status" aria-label="Injury report movement">' +
    '<div class="inj-move-head"><span class="k">Report movement</span>' +
    '<span class="dim">' + count + " change" + (count === 1 ? "" : "s") + " vs prior</span></div>" +
    '<div class="inj-move-chips">' + bits.join("") + "</div></div>";
};
/* Resolve prior rows: device snapshot first, else baked nightly injuries. */
CF.loadInjuryPrior = async () => {
  const local = CF.injSnapGet();
  if (local && local.rows && local.rows.length) return { rows: local.rows, source: "device" };
  try {
    // Use snapshotGet so /_qa and GitHub Pages subpaths resolve correctly.
    const data = await CF.snapshotGet("injuries-bears");
    if (!data) return null;
    const x = CF.API && CF.API.bearsInjuryRows ? CF.API.bearsInjuryRows(data) : { rows: [] };
    const rows = (x.rows || []).filter((row) => row.status && row.status.toLowerCase() !== "active");
    if (rows.length) return { rows, source: "baked" };
  } catch (e) { /* no baked prior */ }
  return null;
};
/* Compact Chicago kickoff weather line for Sunday desk / next-opp (home only). */
CF.kickoffWeatherHTML = async (isHome) => {
  if (!isHome) return "";
  try {
    const wx = await CF.loadWeather();
    if (!wx || wx.tempC == null) {
      return '<div class="kickoff-wx dim">❄ Soldier Field · weather offline</div>';
    }
    const f = Math.round(Number(wx.tempC) * 9 / 5 + 32);
    const desc = wx.phrase ? CF.esc(wx.phrase) : CF.esc(CF.weatherCode(wx.code));
    const wind = wx.wind != null ? " · wind " + Math.round(wx.wind) + " mph" : "";
    const gauge = wx.gauge ? (' · CFI <b>' + wx.gauge.score + "</b>") : "";
    return '<div class="kickoff-wx" title="Latest weather at Soldier Field; not a kickoff forecast">' +
      '<span class="k">Chicago now</span>' +
      '<span class="kickoff-wx-body">❄ Chicago · <b>' + f + "°F</b> " + desc + wind + gauge + "</span></div>";
  } catch (e) {
    return '<div class="kickoff-wx dim">❄ Soldier Field · weather unavailable</div>';
  }
};

/* Scroll progress thread + back-to-top button (v1.13.0 polish).
   Both are injected chrome — no per-page markup needed, styled in
   css/main.css (.cf-progress, .cf-top). */
CF.initScrollChrome = () => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bar = document.createElement("div");
  bar.className = "cf-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  const top = document.createElement("button");
  top.type = "button";
  top.className = "cf-top";
  top.setAttribute("aria-label", "Back to top");
  top.innerHTML = "↑";
  document.body.appendChild(top);
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    bar.classList.toggle("is-on", y > 24);
    top.classList.toggle("is-on", y > 600);
    // Compact the sticky header once the page moves: the chrome shrinks and
    // deepens so more content stays in view. Keep --cf-head-h (mobile nav
    // offset + anchor scroll-margin) honest when the state flips.
    const scrolled = y > 40;
    if (scrolled !== document.body.classList.contains("is-scrolled")) {
      document.body.classList.toggle("is-scrolled", scrolled);
      const head = document.querySelector(".site-head");
      if (head) document.documentElement.style.setProperty("--cf-head-h", head.offsetHeight + "px");
    }
  };
  // Timer throttle (not rAF) — paint-friendly enough for a 3px bar,
  // and it fires under the repo's jsdom test harness too.
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    setTimeout(update, 16);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  top.addEventListener("click", () => {
    try { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }
    catch (e) { window.scrollTo(0, 0); }
  });
  update();
};

/* ---------------- nav + chrome ---------------- */
CF.injectAtmosphere = () => {
  if (document.querySelector(".cf-atmosphere")) return;
  const el = document.createElement("div");
  el.className = "cf-atmosphere";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<div class="cf-aurora"></div>' +
    '<div class="cf-bands"></div>' +
    '<div class="cf-noise"></div>' +
    '<div class="cf-skyline"></div>' +
    '<div class="cf-vignette"></div>';
  const snow = CF.$("#snow");
  if (snow && snow.parentNode) snow.parentNode.insertBefore(el, snow);
  else document.body.insertBefore(el, document.body.firstChild);
};

CF.ensureSkipLink = () => {
  if (CF.$(".skip-link")) return;
  const main = CF.$("main");
  if (main) { if (!main.id) main.id = "main"; main.tabIndex = -1; }
  const a = document.createElement("a");
  a.className = "skip-link";
  a.href = "#" + ((main && main.id) || "main");
  a.textContent = "Skip to content";
  document.body.insertBefore(a, document.body.firstChild);
};

CF.closeNav = (nav, toggle) => {
  if (!nav) return;
  nav.classList.remove("open");
  document.body.classList.remove("nav-open");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    toggle.textContent = "\u2630";
  }
  const bd = CF.$(".nav-backdrop");
  if (bd) bd.hidden = true;
};

CF.openNav = (nav, toggle) => {
  if (!nav) return;
  const head = CF.$(".site-head");
  if (head) document.documentElement.style.setProperty("--cf-head-h", head.offsetHeight + "px");
  nav.classList.add("open");
  document.body.classList.add("nav-open");
  // Stagger index drives the drawer's link entrance cascade (see cf-nav-in).
  Array.from(nav.querySelectorAll("a")).forEach((a, i) => a.style.setProperty("--ni", i));
  if (toggle) {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    toggle.textContent = "\u2715";
  }
  let bd = CF.$(".nav-backdrop");
  if (!bd) {
    bd = document.createElement("button");
    bd.type = "button";
    bd.className = "nav-backdrop";
    bd.setAttribute("aria-label", "Close menu");
    bd.addEventListener("click", () => CF.closeNav(nav, toggle));
    document.body.appendChild(bd);
  }
  bd.hidden = false;
  const first = nav.querySelector("a");
  if (first) setTimeout(() => first.focus(), 20);
};

/* ---------- v1.51.0 — display-ad slots (AdSense-ready) ----------
   Slots marked [data-ad-slot] are filled only when CF.CONFIG.ads.client
   holds a real publisher ID; otherwise they're removed so the page stays
   clean until ad revenue is switched on. Fill is lazy: the AdSense library
   loads once, then each slot gets an <ins> that AdSense sizes itself. */
CF.initAds = () => {
  const slots = CF.$$("[data-ad-slot]");
  if (!slots.length) return;
  const cfg = (CF.CONFIG && CF.CONFIG.ads) || {};
  const client = (cfg.client || "").trim();
  if (!client) {
    slots.forEach((s) => s.remove());
    return;
  }
  const nameFor = (el) => el.getAttribute("data-ad-slot");
  const slotIdFor = (name) => ((cfg.slots || {})[name] || "").trim();
  let libLoaded = false;
  const ensureLib = () => {
    if (libLoaded) return;
    libLoaded = true;
    const sc = document.createElement("script");
    sc.async = true;
    sc.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client);
    sc.crossOrigin = "anonymous";
    document.head.appendChild(sc);
  };
  ensureLib();
  slots.forEach((el) => {
    const name = nameFor(el);
    const slotId = slotIdFor(name);
    if (!slotId) { el.remove(); return; } // placement without an ad-unit ID stays empty
    el.classList.add("is-live");
    el.setAttribute("role", "complementary");
    el.setAttribute("aria-label", "Advertisement");
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", slotId);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ad-blocked or offline — slot stays quiet */ }
  });
};

CF.initChrome = () => {
  CF.injectAtmosphere();
  CF.ensureSkipLink();
  CF.initScrollChrome();
  CF.initAds();

  const wxEl = CF.$("[data-cf-weather]");
  if (wxEl) {
    if (!wxEl.getAttribute("aria-live")) wxEl.setAttribute("aria-live", "polite");
    if (!wxEl.getAttribute("aria-atomic")) wxEl.setAttribute("aria-atomic", "true");
  }

  const page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  CF.$$(".nav a").forEach((a) => {
    const href = (a.getAttribute("href") || "").replace(/\.html$/, "");
    if (href === page || (page === "index" && href === "")) { a.classList.add("active"); a.setAttribute("aria-current", "page"); }
    if (/x\.com\/kshot/i.test(a.getAttribute("href") || "")) a.classList.add("nav-x");
  });

  const toggle = CF.$(".nav-toggle");
  const nav = CF.$(".nav");
  if (toggle && nav) {
    if (!nav.id) nav.id = "site-nav";
    toggle.setAttribute("type", "button");
    toggle.setAttribute("aria-controls", nav.id);
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (nav.classList.contains("open")) CF.closeNav(nav, toggle);
      else CF.openNav(nav, toggle);
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", () => CF.closeNav(nav, toggle));
    // Close drawer after a tap so mobile chrome doesn't stay open over the next page paint.
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => CF.closeNav(nav, toggle)));
    document.addEventListener("keydown", (e) => {
      if (!nav.classList.contains("open")) return;
      if (e.key === "Escape") {
        CF.closeNav(nav, toggle);
        toggle.focus();
        return;
      }
      if (e.key !== "Tab") return;
      // Don't use offsetParent — fixed-position drawers report null.
      const list = [toggle].concat(Array.from(nav.querySelectorAll("a, button"))).filter(Boolean);
      if (list.length < 2) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

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

  // Deep-link targets (week clock → page sections) land under the sticky header.
  if (location.hash) {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (el) {
      requestAnimationFrame(() => {
        try { el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
        catch (e) { el.scrollIntoView(true); }
      });
    }
  }

  CF.renderWeatherStrip();
  if (CF.initSnow) CF.initSnow();

  const yr = CF.$("[data-cf-year]");
  if (yr) yr.textContent = new Date().getFullYear();


  // Tip chip: copies the Bitcoin donation address from config (2026-09-27: switched from PRL).
  const btcWallet = (CF.CONFIG.donations || []).find((d) => d && d.chain === "BTC");
  if (btcWallet && btcWallet.address) {
    const btcAddr = btcWallet.address;
    const fallbackCopy = (text) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    };
    CF.$$("[data-cf-copy]").forEach((btn) => {
      if (btn.getAttribute("data-cf-copy") !== "btc") return;
      btn.setAttribute("aria-label", "Copy Bitcoin (BTC) donation address to clipboard");
      const status = btn.querySelector(".prl-status");
      let t = null;
      btn.addEventListener("click", () => {
        const done = () => {
          btn.classList.add("copied");
          if (status) status.textContent = "Copied";
          clearTimeout(t);
          t = setTimeout(() => { btn.classList.remove("copied"); if (status) status.textContent = "Copy"; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(btcAddr).then(done, () => { if (fallbackCopy(btcAddr)) done(); });
        } else if (fallbackCopy(btcAddr)) {
          done();
        }
      });
    });
  }

  if (CF.initHeroRotator) CF.initHeroRotator();
  if (CF.initReveal) CF.initReveal();
};


/* ---------- v1.8+ — stadium hero rotator · kickoff banner · reveal · CFI spark ---------- */

/* Layered hero: primary Soldier Field → alt stadium → CSS gridiron fallback.
   Soft crossfade rotation when motion is allowed; onerror advances layers. */
CF.initHeroRotator = () => {
  const root = CF.$("[data-cf-hero-rotator]");
  if (!root) return;
  const layers = CF.$$(".hero-layer", root);
  if (!layers.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const activate = (idx) => {
    layers.forEach((el, i) => el.classList.toggle("is-active", i === idx));
    root.setAttribute("data-hero-active", String(idx));
  };

  layers.forEach((layer, i) => {
    const img = layer.querySelector("img");
    if (!img) return;
    const fail = () => {
      layer.classList.add("is-failed");
      // Advance to next non-failed layer; CSS fallback stays underneath.
      const next = layers.findIndex((el, j) => j > i && !el.classList.contains("is-failed"));
      if (next >= 0) activate(next);
      else root.classList.add("is-fallback-only");
    };
    img.addEventListener("error", fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });

  if (reduce || layers.length < 2) return;

  let idx = 0;
  const tick = () => {
    if (document.hidden || document.documentElement.classList.contains("motion-paused") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const live = layers.map((el, i) => ({ el, i })).filter((x) => !x.el.classList.contains("is-failed"));
    if (live.length < 2) return;
    idx = (idx + 1) % live.length;
    activate(live[idx].i);
  };
  // Atmospheric rotate ~14s — no video, no sound.
  setInterval(tick, 14000);
};

/* Soft gameday-window banner (no sound). Links to board + odds. */
CF.clearKickoffBanner = () => {
  const el = CF.$("#cf-kickoff-banner");
  if (el) el.remove();
};
CF.paintKickoffBanner = (game) => {
  if (!game || !game.date) { CF.clearKickoffBanner(); return; }
  const kick = new Date(game.date).getTime();
  if (isNaN(kick)) { CF.clearKickoffBanner(); return; }
  const hours = (kick - Date.now()) / 3600e3;
  const inWindow = hours <= 30 && hours > -6;
  if (!inWindow) { CF.clearKickoffBanner(); return; }

  const key = String(game.id || game.date);
  try {
    if (sessionStorage.getItem("cf-kickoff-dismiss") === key) return;
  } catch (e) { /* private mode */ }

  let el = CF.$("#cf-kickoff-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "cf-kickoff-banner";
    el.className = "cf-kickoff-banner";
    el.setAttribute("role", "status");
    const host = CF.$(".weather-strip") || CF.$(".site-head") || document.body.firstChild;
    if (host && host.parentNode) host.parentNode.insertBefore(el, host.nextSibling);
    else document.body.insertBefore(el, document.body.firstChild);
  }
  const opp = game.oppAbbr || game.opp || "opponent";
  const site = game.home === true ? "vs" : (game.home === false ? "@" : "vs");
  const when = CF.fmtDate(game.date) + (CF.fmtTime(game.date) ? " · " + CF.fmtTime(game.date) : "");
  const live = hours <= 0;
  el.innerHTML =
    '<div class="wrap cf-kickoff-inner">' +
    '<span class="cf-kickoff-mark" aria-hidden="true">❄</span>' +
    '<span class="cf-kickoff-copy"><b>' + (live ? "Kickoff window · live beat" : "Gameday window") + "</b> " +
    CF.esc(site) + " " + CF.esc(String(opp)) + " · " + CF.esc(when) + "</span>" +
    '<span class="cf-kickoff-actions">' +
    '<a class="btn small" href="games.html#board">Board →</a>' +
    '<a class="btn small" href="odds.html">Odds →</a>' +
    '<button type="button" class="cf-kickoff-dismiss" aria-label="Dismiss gameday banner">×</button>' +
    "</span></div>";
  const btn = el.querySelector(".cf-kickoff-dismiss");
  if (btn) btn.addEventListener("click", () => {
    try { sessionStorage.setItem("cf-kickoff-dismiss", key); } catch (e2) { /* ignore */ }
    CF.clearKickoffBanner();
  });
};

/* IntersectionObserver fade-in for photo bands; defer BG paint until in view. */
CF.initReveal = () => {
  try { document.documentElement.classList.add("cf-js"); } catch (e) { /* ignore */ }
  const nodes = CF.$$(".photo-band");
  if (!nodes.length) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    nodes.forEach((n) => n.classList.add("cf-reveal", "is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    });
  }, { rootMargin: "120px 0px", threshold: 0.08 });
  nodes.forEach((n) => {
    n.classList.add("cf-reveal");
    io.observe(n);
  });
};

/* Count-up flourish for stat numbers. Paints the exact final text first so
   reduced-motion, paused, or non-animating environments always read correct,
   then sweeps each numeric segment from 0 when the browser can animate.
   parts: [{n, decimals, signed}], joined by sep ("–" default). */
CF.countUp = (el, parts, sep) => {
  el = typeof el === "string" ? CF.$(el) : el;
  if (!el || !Array.isArray(parts) || !parts.length) return;
  const paint = (nums) => nums.map((p) => ((p.signed && p.n > 0 ? "+" : "") + p.n.toFixed(p.decimals | 0))).join(sep == null ? "–" : sep);
  const finalText = paint(parts);
  el.textContent = finalText;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || document.documentElement.classList.contains("motion-paused")) return;
  const dur = 900, t0 = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = paint(parts.map((p) => ({ n: p.n * e, decimals: p.decimals, signed: p.signed })));
    if (t < 1) window.requestAnimationFrame(frame);
    else el.textContent = finalText;
  };
  window.requestAnimationFrame(frame);
};

document.addEventListener("DOMContentLoaded", CF.initChrome);
