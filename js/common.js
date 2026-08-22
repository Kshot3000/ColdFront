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
    weather: "https://api.open-meteo.com/v1/forecast",
    weatherParams: {
      latitude: 41.8781, longitude: -87.6298,
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum",
      forecast_days: 3, timezone: "America/Chicago",
    },
    polymarket: "https://gamma-api.polymarket.com/events",

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
  ttl: { scoreboard: 10 * 60e3, news: 30 * 60e3, schedule: 3600e3, standings: 3600e3, roster: 3600e3, weather: 10 * 60e3 },
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
CF.fetchJSON = async (url, opts) => {
  opts = opts || {};
  const timeout = opts.timeout || 9000;
  const ctrl = new AbortController();
  const h = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: { Accept: "application/json, text/xml;q=0.9, */*;q=0.8" } }, opts.init || {}));
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
  if (local) {
    try { return await CF.fetchJSON(local + "/fetch?url=" + encodeURIComponent(url), { timeout: Math.min(6000, t) }); }
    catch (eLocal) { /* not running, or upstream failed — try direct */ }
  }
  try {
    return await CF.fetchJSON(url, { timeout: t });
  } catch (directErr) {
    const remote = CF.CONFIG.endpoints.remoteProxy;
    if (remote) {
      return await CF.fetchJSON(remote + "/fetch?url=" + encodeURIComponent(url), { timeout: 6000 });
    }
    throw directErr;
  }
};

/* ---------------- data source helper: the full live-feed chain ----------------
   Every named feed resolves in this order:
   1) local loopback proxy (Start-Local-Proxy.bat) — the fix for networks
      where the CDN 403s browser traffic; instant no-op when not running;
   2) direct fetch — CORS-open, so this is the normal path for most visitors;
   3) optional remote proxy (e.g. the included Cloudflare Worker) when a URL
      is set in CF.CONFIG.endpoints.remoteProxy;
   4) public CORS proxies — last resort for other visitors' odd networks;
   5) the localStorage snapshot from a previous successful visit.
   Data that arrives via any proxy is still LIVE data, so it is reported as
   source "live"; only step 5 (stale snapshot) reports differently. */
CF.getSource = async (name, fetcher, cacheKey) => {
  const ttl = (CF.CONFIG.ttl[name] != null) ? CF.CONFIG.ttl[name] : 3600e3;
  const direct = urlFor(name);

  const viaProxy = async (base, timeout) => {
    const data = await CF.fetchJSON(base + "/fetch?url=" + encodeURIComponent(direct), { timeout: timeout });
    CF.cacheSet(cacheKey, data, ttl);
    return { data, source: "live", name };
  };

  // 1) local loopback proxy
  if (direct && CF.CONFIG.endpoints.localProxy) {
    try { return await viaProxy(CF.CONFIG.endpoints.localProxy, 6000); }
    catch (eLocal) { /* continue the chain */ }
  }
  // 2) direct
  try {
    const data = await fetcher();
    CF.cacheSet(cacheKey, data, ttl);
    return { data, source: "live", name };
  } catch (e1) {
    // 3) optional remote proxy
    if (direct && CF.CONFIG.endpoints.remoteProxy) {
      try { return await viaProxy(CF.CONFIG.endpoints.remoteProxy, 6000); }
      catch (eRemote) { /* continue the chain */ }
    }
    // 4) public CORS proxies (helps visitors on unusual networks)
    if (direct) {
      for (const proxy of CF.PROXIES) {
        try {
          const data = await CF.fetchJSON(proxy(direct), { timeout: 8000 });
          CF.cacheSet(cacheKey, data, ttl);
          return { data, source: "proxy", name };
        } catch (e2) { /* next */ }
      }
    }
    // 5) local snapshot
    const cached = CF.cacheGet(cacheKey);
    if (cached) return { data: cached, source: "cache", name };
    throw new Error("offline:" + name);
  }
  function urlFor(n) {
    if (n === "scoreboard") return CF.CONFIG.endpoints.espnBase + "/scoreboard?dates=" + CF.todayParam();
    if (n === "news") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/news";
    if (n === "schedule") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/schedule";
    if (n === "standings") return CF.CONFIG.endpoints.espnBase + "/standings";
    if (n === "roster") return CF.CONFIG.endpoints.espnBase + "/teams/chicago/roster";
    if (n === "team") return CF.CONFIG.endpoints.espnBase + "/teams/chicago";
    if (n === "odds") return CF.CONFIG.endpoints.espnBase + "/odds";
    return null;
  }
};
CF.PROXIES = [
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
  // Themed "fan gauge" derived from real Open-Meteo numbers.
  if (!w) return null;
  const tC = w.apparent_temperature;
  const wind = w.wind_gusts_10m || w.wind_speed_10m || 0;
  const snow = w.snowProb || 0;
  let score = 0;
  if (tC < 0) score += 55; else if (tC < 5) score += 42; else if (tC < 10) score += 28; else if (tC < 16) score += 12;
  if (wind >= 60) score += 35; else if (wind >= 40) score += 26; else if (wind >= 25) score += 15;
  if (snow >= 60) score += 25; else if (snow >= 25) score += 12;
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
    let snowProb = null;
    if (d.daily && d.daily.precipitation_probability_max && d.daily.precipitation_probability_max.length) {
      snowProb = d.daily.precipitation_probability_max[0];
    }
    const wx = {
      tempC: cur.temperature_2m,
      feelsC: cur.apparent_temperature,
      wind: cur.wind_speed_10m,
      gusts: cur.wind_gusts_10m,
      humidity: cur.relative_humidity_2m,
      code: cur.weather_code,
      time: cur.time,
      snowProb,
      daily: d.daily || null,
    };
    wx.gauge = CF.coldFrontGauge(wx);
    CF.cacheSet("weather", wx, CF.CONFIG.ttl.weather);
    return wx;
  } catch (e) {
    const c = CF.cacheGet("weather");
    if (c) { c.offline = true; return c; }
    return null;
  }
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
    const now = CF.$("#wx-now", el);
    const gauge = CF.$("#wx-gauge", el);
    if (!wx) {
      now.innerHTML = '<span class="wx-offline">offline — last reading unavailable</span>';
      gauge.textContent = "no data";
      return;
    }
    const f = (c) => Math.round(c * 9 / 5 + 32);
    now.innerHTML =
      "<b>" + f(wx.tempC) + "°F</b> " + CF.esc(CF.weatherCode(wx.code)) +
      " · feels <b>" + f(wx.feelsC) + "°F</b>" +
      " · wind <b>" + Math.round(wx.wind) + " km/h</b>" +
      (wx.gusts ? " (gusts " + Math.round(wx.gusts) + ")" : "") +
      (wx.snowProb != null ? " · snow " + Math.round(wx.snowProb) + "%" : "") +
      (wx.offline ? ' · <span class="wx-offline">cached</span>' : "");
    if (wx.gauge) {
      gauge.textContent = wx.gauge.label + " · " + wx.gauge.score + "/100";
      gauge.className = "wx-gauge " + wx.gauge.cls;
    }
  });
  update();
  CF.refresh.register(update, CF.CONFIG.ttl.weather || 60e4); // re-read the front every 10 min while the page is open
};

/* ---------------- snow canvas ---------------- */
CF.startSnow = () => {
  const canvas = CF.$("#snow");
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  let W, H, flakes = [];
  const N = 70;
  const resize = () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  const mk = (init) => ({
    x: Math.random() * W,
    y: init ? Math.random() * H : -6,
    r: 0.8 + Math.random() * 2.2,
    vy: 0.35 + Math.random() * 0.9,
    vx: -0.15 + Math.random() * 0.3,
    a: 0.25 + Math.random() * 0.55,
    sway: Math.random() * Math.PI * 2,
  });
  for (let i = 0; i < N; i++) flakes.push(mk(true));
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) loop();
  });
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
    requestAnimationFrame(loop);
  }
  loop();
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
  CF.startSnow();

  const yr = CF.$("[data-cf-year]");
  if (yr) yr.textContent = new Date().getFullYear();
};

document.addEventListener("DOMContentLoaded", CF.initChrome);
