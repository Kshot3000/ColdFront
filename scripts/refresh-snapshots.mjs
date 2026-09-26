#!/usr/bin/env node
/**
 * Refresh same-origin data/snapshots/ for THE COLD FRONT.
 * Used by .github/workflows/refresh-snapshots.yml and local maintainers.
 * Honest payloads only — never invents scores, lines, or injuries.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "snapshots");
const UA = "curl/8.13.0 ColdFront-snapshot-refresh/1.10";
const VERSION = "1.10.0";

const ESPN = {
  web: "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl",
  api: "https://site.api.espn.com/apis/site/v2/sports/football/nfl",
};

async function fetchJSON(url, { timeout = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json,*/*" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(res.status + " " + url);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url, { timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/rss+xml,application/xml,text/xml,*/*" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(res.status + " " + url);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function firstJSON(urls) {
  let last;
  for (const u of urls) {
    try {
      return { data: await fetchJSON(u), url: u };
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("all urls failed");
}

function writeJSON(name, data) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data) + "\n");
  const bytes = fs.statSync(p).size;
  console.log("wrote", name, bytes, "bytes");
  return bytes;
}

function parseRssItems(xml, max = 12) {
  const items = [];
  const re = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < max) {
    const block = m[0];
    const grab = (tag) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      if (!mm) return null;
      return (mm[1] != null ? mm[1] : mm[2] || "").trim() || null;
    };
    let title = grab("title");
    let link = grab("link");
    let pubDate = grab("pubDate");
    let source = grab("source");
    if (!source) {
      const ns = block.match(/<(?:News:)?Source[^>]*>([\s\S]*?)<\/(?:News:)?Source>/i);
      if (ns) source = ns[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    }
    if (link && /apiclick\.aspx/i.test(link)) {
      try {
        const q = new URL(link).searchParams.get("url");
        if (q) link = decodeURIComponent(q);
      } catch (_) { /* keep */ }
    }
    if (!title || !link) continue;
    let isoDate = null;
    let date = pubDate;
    if (pubDate) {
      const t = Date.parse(pubDate);
      if (!isNaN(t)) {
        isoDate = new Date(t).toISOString();
        date = isoDate;
      }
    }
    items.push({ title, link, pubDate, source, isoDate, date });
  }
  return items;
}

function trimInjuries(payload) {
  const teams = (payload && payload.injuries) || [];
  const bears = teams.filter(
    (t) =>
      t.displayName === "Chicago Bears" ||
      (t.team && t.team.abbreviation === "CHI") ||
      String(t.id) === "3"
  );
  return {
    injuries: bears.length ? bears : [],
    meta: {
      team: "CHI",
      trimmed: true,
      source: "site.web.api",
      harvestedAt: new Date().toISOString(),
    },
  };
}

function harvestOdds(scoreboard) {
  const games = ((scoreboard && scoreboard.events) || [])
    .map((e) => {
      const c = (e.competitions || [])[0] || {};
      return {
        id: e.id,
        name: e.name || "",
        date: e.date,
        odds: c.odds || [],
      };
    })
    .filter((g) => g.odds && g.odds.length);
  return { games };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const built = new Date().toISOString();
  const feeds = {};
  const notes = [];

  // Schedule (CHI team 3)
  try {
    const { data, url } = await firstJSON([
      ESPN.web + "/teams/3/schedule",
      ESPN.api + "/teams/3/schedule",
    ]);
    writeJSON("schedule.json", data);
    feeds.schedule = { ok: true, events: (data.events || []).length, via: url };
  } catch (e) {
    feeds.schedule = { ok: false, error: String(e.message || e) };
    notes.push("schedule refresh failed — kept previous file if present");
  }

  // Scoreboard + odds harvest
  let scoreboard = null;
  try {
    const { data, url } = await firstJSON([
      ESPN.web + "/scoreboard",
      ESPN.api + "/scoreboard",
    ]);
    scoreboard = data;
    writeJSON("scoreboard.json", data);
    feeds.scoreboard = { ok: true, events: (data.events || []).length, via: url };
    const odds = harvestOdds(data);
    writeJSON("odds.json", odds);
    feeds.odds = { ok: true, games: odds.games.length, via: "harvested from scoreboard" };
  } catch (e) {
    feeds.scoreboard = { ok: false, error: String(e.message || e) };
    feeds.odds = { ok: false, error: "no scoreboard to harvest" };
    notes.push("scoreboard/odds refresh failed — kept previous files if present");
  }

  // Roster
  try {
    const { data, url } = await firstJSON([
      ESPN.web + "/teams/3/roster",
      ESPN.api + "/teams/3/roster",
    ]);
    writeJSON("roster.json", data);
    const n = Array.isArray(data.athletes)
      ? data.athletes.reduce((a, g) => a + ((g.items && g.items.length) || 0), 0)
      : 0;
    feeds.roster = { ok: true, athletes: n || (data.athletes || []).length, via: url };
  } catch (e) {
    feeds.roster = { ok: false, error: String(e.message || e) };
    notes.push("roster refresh failed — kept previous file if present");
  }

  // Injuries (trim CHI only — full league is ~9MB)
  try {
    const { data, url } = await firstJSON([
      ESPN.web + "/injuries",
      ESPN.api + "/injuries",
    ]);
    const trimmed = trimInjuries(data);
    writeJSON("injuries-bears.json", trimmed);
    const players = ((trimmed.injuries[0] && trimmed.injuries[0].injuries) || []).length;
    feeds.injuries = { ok: true, players, via: url, trimmed: true };
  } catch (e) {
    feeds.injuries = { ok: false, error: String(e.message || e) };
    notes.push("injuries refresh failed — kept previous file if present");
  }

  // Wide-wire news (Bing first, Google second)
  try {
    const q = encodeURIComponent("Chicago Bears");
    const urls = [
      "https://www.bing.com/news/search?q=" + q + "&format=RSS",
      "https://news.google.com/rss/search?q=" + q + "&hl=en-US&gl=US&ceid=US:en",
    ];
    let items = [];
    let via = "";
    for (const u of urls) {
      try {
        const xml = await fetchText(u);
        items = parseRssItems(xml, 12);
        if (items.length) {
          via = u;
          break;
        }
      } catch (_) { /* next */ }
    }
    if (!items.length) throw new Error("empty RSS");
    writeJSON("gnews.json", { items, query: "Chicago Bears", harvestedAt: built });
    feeds.gnews = { ok: true, items: items.length, via };
  } catch (e) {
    feeds.gnews = { ok: false, error: String(e.message || e) };
    notes.push("gnews refresh failed — kept previous file if present");
  }

  const okCount = Object.values(feeds).filter((f) => f && f.ok).length;
  const meta = {
    built,
    source: "site.web.api.espn.com + bing/google news rss",
    version: VERSION,
    notes:
      notes.length
        ? notes.join("; ")
        : "CHI injuries trimmed (team id 3); odds harvested from scoreboard; gnews items include date",
    feeds,
    okCount,
    totalFeeds: Object.keys(feeds).length,
    freshnessHint:
      "Baked same-origin fallbacks for GitHub Pages. Age = now − built. Nightly Action keeps these warm.",
  };
  writeJSON("META.json", meta);
  console.log(JSON.stringify({ built, okCount, feeds }, null, 2));
  if (okCount === 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
