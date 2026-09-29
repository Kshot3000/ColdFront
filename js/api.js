/* ============================================================
   THE COLD FRONT — data layer
   ESPN site API (primary, CORS-open in browsers) → CORS proxies
   → localStorage snapshot → clear unavailable state.
   Polymarket Gamma API for prediction markets. Open-Meteo weather.
   ============================================================ */
"use strict";
CF = CF || {};

CF.API = {
  base: () => CF.CONFIG.endpoints.espnBase,
  webBase: () => CF.CONFIG.endpoints.espnWebBase,
  cdnBase: () => CF.CONFIG.endpoints.espnCdnBase,

  /* Alternate-host fetchers: same ESPN JSON from a different piece of
     infrastructure. These ride the Stage-1 race alongside the primary
     host, so a blocked network still gets the data from a working one. */
  web: (path) => () => CF.fetchJSON(CF.API.webBase() + path, { timeout: 9000 }),

  /* ESPN hands scores to us as either a plain string ("34") or an object
     ({value:34, displayValue:"34"}). Every panel needs a plain value. */
  score: (x) => {
    if (x == null) return null;
    if (typeof x === "object") return (x.displayValue != null) ? x.displayValue : x.value;
    return x;
  },

  /* ---------- raw ESPN getters ----------
     Every getter now passes alternate hosts (site.web.api.espn.com, and
     cdn.espn.com where a core-API path exists) as altFetchers; CF.getSource
     races them in parallel and uses the first one that answers. */
  getTeam: async () => {
    const r = await CF.getSource("team",
      () => CF.fetchJSON(CF.base() + "/teams/chicago", { timeout: 9000 }), "team", null,
      [CF.API.web("/teams/chicago")]);
    return r;
  },

  getNews: async () => {
    const url = CF.API.base() + "/news?team=chi&limit=12";
    const r = await CF.getSource("news", () => CF.fetchJSON(url), "news", url,
      [() => CF.fetchJSON(CF.API.webBase() + "/news?team=chi&limit=12")]);
    CF.API.newsSource = r;
    return CF.API.normalizeNews(r.data);
  },

  normalizeNews: (data) => ((data && (data.articles || data.news)) || [])
    .map((n) => Object.assign({}, n, { heading: n.headline || n.heading || "Bears news" })),

  getScoreboard: async (dateParam) => {
    // Dated URL when the Games day-picker asks for a specific day.
    // Default (no dateParam): undated week board — pinning ?dates=today
    // returns [] on bye/weekdays and wiped the home board + odds harvest.
    const dp = dateParam || "";
    const path = dp ? ("/scoreboard?dates=" + dp) : "/scoreboard";
    const url = CF.base() + path;
    const alt = CF.API.webBase() + path;
    const cacheKey = dp ? ("scoreboard." + dp) : "scoreboard";
    const r = await CF.getSource("scoreboard",
      () => CF.fetchJSON(url, { timeout: 9000 }),
      cacheKey, url,
      [() => CF.fetchJSON(alt, { timeout: 9000 })]);
    return r;
  },

  getWeekScoreboard: async () => {
    const url = CF.API.base() + "/scoreboard?limit=100";
    return CF.getSource("scoreboard", () => CF.fetchJSON(url), "scoreboard.week", url);
  },

  getSchedule: async () => {
    const url = CF.base() + "/teams/chicago/schedule";
    const r = await CF.getSource("schedule",
      () => CF.fetchJSON(url, { timeout: 9000 }), "schedule", url,
      [
        CF.API.web("/teams/chicago/schedule"),
        () => CF.fetchJSON(CF.API.cdnBase() + "/teams/chicago/schedule", { timeout: 9000 }),

      ].filter(Boolean)).catch(async (error) => {
        if (!CF.API.tsdbKey()) throw error;
        const data = await CF.API.tsdbSchedule();
        return { data, source: "live", name: "schedule", provider: "TheSportsDB" };
      });
    return r;
  },

  getStandings: async () => {
    const url = "https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings";
    return CF.getSource("standings", () => CF.fetchJSON(url), "standings", url);
  },

  getRoster: async () => {
    const url = CF.base() + "/teams/chicago/roster";
    const r = await CF.getSource("roster",
      () => CF.fetchJSON(url, { timeout: 9000 }), "roster", url,
      [
        CF.API.web("/teams/chicago/roster"),

      ].filter(Boolean)).catch(async (error) => {
        if (!CF.API.tsdbKey()) throw error;
        const data = await CF.API.tsdbRoster();
        return { data, source: "live", name: "roster", provider: "TheSportsDB" };
      });
    return r;
  },

  /* League-wide injury report. Heavy payload (~9 MB) but it carries the
     full Bears list: status per player + editorial notes on the wire. */
  getLeagueInjuries: async () => {
    const url = CF.API.base() + "/injuries";
    const compact = (data) => ({ timestamp: data?.timestamp, injuries: (data?.injuries || []).filter((team) =>
      team.displayName === "Chicago Bears" || team.team?.abbreviation === "CHI") });
    const result = await CF.getSource("injuries", async () => compact(await CF.fetchJSON(url, { timeout: 15000 })), "injuries", url);
    result.data = compact(result.data);
    if (result.source === "live") CF.cacheSet("injuries", result.data, CF.CONFIG.ttl.injuries);
    return result;
  },

  getEvent: async (id) => {
    // Full fallback chain (local proxy -> direct -> optional remote proxy),
    // plus a localStorage snapshot so a live game page survives a blip.
    const cacheKey = "event." + id;
    const cached = CF.cacheGet(cacheKey);
    try {
      const data = await CF.fetchVia(CF.base() + "/summary?event=" + encodeURIComponent(id), { timeout: 9000 });
      CF.cacheSet(cacheKey, data, 3600e3);
      return data;
    } catch (e) {
      if (cached) return cached;
      throw e;
    }
  },

  getOdds: async (date) => {
    const url=CF.API.base()+"/scoreboard" + (date ? "?dates=" + date.replace(/-/g, "") : "");
    return CF.getSource("odds",()=>CF.fetchJSON(url),"odds." + (date || "week"),url);
  },

  /* ---------- Polymarket (prediction markets) ---------- */
  getPolymarket: async (limit) => {
    const base = new URL(CF.CONFIG.endpoints.polymarket).origin;
    let tag = CF.cacheGet("polymarket.nfl-tag");
    if (!tag) {
      tag = await CF.fetchVia(base + "/tags/slug/nfl", { timeout: 10000 });
      if (!tag || !/^\d+$/.test(String(tag.id))) throw new Error("NFL tag unavailable");
      CF.cacheSet("polymarket.nfl-tag", tag, 86400e3);
    }
    const qs = new URLSearchParams({ limit: String(limit || 100), closed: "false", tag_id: String(tag.id) });
    const d = await CF.fetchVia(base + "/events/keyset?" + qs, { timeout: 10000 });
    const events = Array.isArray(d) ? d : (d.events || []);
    return events;
  },

  /* ---------- wide-wire RSS (multi-source, no key) ----------
     Returns [{title, link, source, date, desc}]. Tries each upstream in
     order, and each one rides the full fallback chain (local proxy first,
     then direct, then public CORS proxies):
       1) Google News RSS — broadest outlet coverage
       2) Bing News RSS   — same stories; public CORS proxies can reach it
          even when Google News is blocked from the browser
     The first upstream that answers with items wins. */
  /* v1.72.0 — Google/Bing RSS (and the CORS proxies ferrying it) can stack
     entity-escaping: the XML may carry &amp;quot; (two levels) or
     &amp;amp;quot; (three levels) for the same quote. Decoding exactly
     once leaves "&quot;" in the string, which the render path then
     re-escapes, so headlines printed the literal text "&quot;" on the
     page (seen live on the Wide Wire). Decode to a fixpoint so any
     stacking level collapses to the real character. Bounded at 5 passes;
     textContent never adds entities, so this always terminates.
     v1.107.0 — hoisted out of parseRss: the baked-snapshot branch of
     getGoogleNews never ran this decoder, so snapshot-served headlines
     printed literal "&quot;" (seen live on the Wide Wire). Both paths
     now share it. */
  unescRss: (s) => {
    if (!s) return s;
    let cur = s;
    for (let i = 0; i < 5; i++) {
      const next = new DOMParser().parseFromString(cur, "text/html").body.textContent;
      if (next === cur) return next;
      cur = next;
    }
    return cur;
  },

  parseRss: (xml) => {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).map((el) => {
      const t = (n) => { const x = el.getElementsByTagName(n)[0]; return x ? x.textContent.trim() : null; };
      const unesc = CF.API.unescRss;
      // Bing wraps the source in a namespace: <News:Source>.
      const srcEl = el.getElementsByTagName("source")[0] || el.getElementsByTagNameNS("*", "Source")[0];
      let link = t("link") || null;
      // Bing wraps the real URL in a redirect (?url=<encoded>); unwrap it.
      if (link && /apiclick\.aspx/i.test(link)) {
        try {
          const q = new URL(link).searchParams.get("url");
          if (q) link = decodeURIComponent(q);
        } catch (e) { /* keep the redirect link */ }
      }
      return {
        title: unesc(t("title")),
        link,
        source: unesc(srcEl ? srcEl.textContent.trim() : null),
        date: t("pubDate"),
        desc: unesc(t("description") || "") || "",
      };
    }).filter((it) => it.title && it.link);
    return items;
  },

  getGoogleNews: async (query, max) => {
    const q = query || 'Chicago Bears';
    const cached = CF.cacheGet("gnews." + q);
    const feeds = [
      // Bing first: public CORS proxies reach it more often than Google News.
      CF.CONFIG.endpoints.bingNews + "?q=" + encodeURIComponent(q) + "&format=RSS",
      CF.CONFIG.endpoints.googleNews + "?q=" + encodeURIComponent(q) + "&hl=en-US&gl=US&ceid=US:en",
    ];
    let items = [];
    // Race live RSS (short) against a delayed same-origin snapshot so Pages
    // never waits on dead CORS proxies when Google/Bing block the browser.
    const live = (async () => {
      for (const url of feeds) {
        try {
          const xml = await CF.fetchText(url, { timeout: 5500 });
          const list = CF.API.parseRss(xml).slice(0, max || 12);
          if (list.length) return list;
        } catch (e) { /* next upstream */ }
      }
      return [];
    })();
    const snapP = (async () => {
      try {
        const snap = CF.snapshotGet ? await CF.snapshotGet("gnews") : null;
        const list = snap && (snap.items || snap);
        if (!Array.isArray(list)) return [];
        return list.slice(0, max || 12).map((it) => ({
          // v1.107.0 — baked snapshots can carry the same stacked entities
          // the live RSS path decodes (seen live: "&quot;" printed in a
          // Wide Wire headline). Run the shared decoder here too.
          title: CF.API.unescRss(it.title),
          link: it.link,
          source: CF.API.unescRss(it.source) || null,
          date: it.date || it.pubDate || it.isoDate || null,
          desc: CF.API.unescRss(it.desc) || null,
        }));
      } catch (e) { return []; }
    })();
    try {
      const winner = await Promise.any([
        live.then((list) => { if (!list.length) throw new Error("empty live"); return { items: list, source: "live" }; }),
        (async () => {
          await new Promise((r) => setTimeout(r, 1400));
          const list = await snapP;
          if (!list.length) throw new Error("empty snap");
          return { items: list, source: "cache" };
        })(),
      ]);
      items = winner.items;
      CF.API.rssSource = winner.source;
    } catch (e) {
      items = [];
    }
    if (!items.length) {
      const cached = CF.cacheGet("gnews." + q);
      if (cached?.length) { CF.API.rssSource = "cache"; return cached.slice(0, max || 12); }
      throw new Error("empty news feed");
    }
    if (CF.API.rssSource === "live") CF.cacheSet("gnews." + q, items, 30 * 60000);
    return items;
  },

  /* ---------- The Odds API (optional, user's own key) ---------- */
  getOddsApi: async (key) => {
    // Credential-bearing requests go ONLY to the chosen provider.
    const qs = new URLSearchParams({apiKey:key, regions:"us", markets:"h2h,spreads,totals", oddsFormat:"american", dateFormat:"iso"});
    const d = await CF.fetchJSON("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?" + qs, {timeout:10000});
    return Array.isArray(d) ? d : [];
  },

  /* ---------- extraction helpers (defensive across ESPN shapes) ---------- */

  // Next (or most recent) Bears game from a scoreboard payload.
  bearsGameFromScoreboard: (sb) => {
    const events = (sb && sb.events) || [];
    const e = events.find((event) => ((event.competitions || [])[0]?.competitors || [])
      .some((c) => (c.team || {}).abbreviation === "CHI"));
    return e ? CF.API.gameFromEvent(e) : null;
  },

  gameFromEvent: (e) => {
    if (!e) return null;
    const c = (e.competitions || [e])[0] || {};
    const teams = c.competitors || [];
    const team = (side) => {
      const x = teams.find((t) => t.homeAway === side) || {};
      return {abbr:x.team?.abbreviation || "—", name:x.team?.displayName || "To be announced", score:CF.API.score(x.score)};
    };
    const status = e.status || c.status || {};
    const broadcast = (c.broadcasts || [])[0] || {};
    const venue = c.venue || {};
    return {id:e.id, name:e.name || "Bears football", season:e.season?.displayName || "",
      seasonType:e.seasonType?.name || "", week:e.week?.text || (e.week?.number ? "Week " + e.week.number : ""),
      date:e.date || c.date, timeValid:e.timeValid !== false && c.timeValid !== false,
      state:status.type?.state || "pre", display:status.type?.shortDetail || status.type?.detail || "Scheduled",
      clock:status.displayClock || "", home:team("home"), away:team("away"),
      venue:venue.fullName || venue.displayName || "Venue to be announced",
      city:venue.address?.city || c.geolocation?.city || "",
      tv:(broadcast.names || []).join(" / ") || broadcast.media?.shortName || broadcast.media?.name || "",
      odds:c.odds || null};
  },

  nextBearsGameFromSchedule: (sched) => {
    const now = Date.now();
    const items = ((sched && (sched.schedule || sched.events)) || []).slice().sort((a,b) => new Date(a.date || a.start) - new Date(b.date || b.start));
    for (const e of items) {
      const g = CF.API.gameFromEvent(e);
      if (!g || ![g.home.abbr,g.away.abbr].includes("CHI")) continue;
      if (g.state === "post" || !Number.isFinite(Date.parse(g.date)) || Date.parse(g.date) < now - 6 * 3600e3) continue;
      const home = g.home.abbr === "CHI", opponent = home ? g.away : g.home;
      return {id:g.id,date:g.date,season:g.season || sched.season?.displayName || "",seasonType:g.seasonType,
        home,opp:opponent.name,oppAbbr:opponent.abbr,tv:g.tv,venue:g.venue,week:g.week,timeValid:g.timeValid,game:g};
    }
    return null;
  },

  /* Opponent-city notes for away games (static geography — not fake scores).
     Used when the schedule payload has no geolocation. */
  NFL_CITIES: {
    ARI: "Glendale, AZ", ATL: "Atlanta, GA", BAL: "Baltimore, MD", BUF: "Orchard Park, NY",
    CAR: "Charlotte, NC", CIN: "Cincinnati, OH", CLE: "Cleveland, OH", DAL: "Arlington, TX",
    DEN: "Denver, CO", DET: "Detroit, MI", GB: "Green Bay, WI", HOU: "Houston, TX",
    IND: "Indianapolis, IN", JAX: "Jacksonville, FL", KC: "Kansas City, MO", LAC: "Inglewood, CA",
    LAR: "Inglewood, CA", LV: "Las Vegas, NV", MIA: "Miami Gardens, FL", MIN: "Minneapolis, MN",
    NE: "Foxborough, MA", NO: "New Orleans, LA", NYG: "East Rutherford, NJ", NYJ: "East Rutherford, NJ",
    PHI: "Philadelphia, PA", PIT: "Pittsburgh, PA", SEA: "Seattle, WA", SF: "Santa Clara, CA",
    TB: "Tampa, FL", TEN: "Nashville, TN", WSH: "Landover, MD", WAS: "Landover, MD", CHI: "Chicago, IL",
  },

  nflCityNote: (abbr, city, venue) => {
    if (city) return city;
    const mapped = abbr ? CF.API.NFL_CITIES[String(abbr).toUpperCase()] : null;
    if (mapped) return mapped;
    if (venue) return venue;
    return "";
  },

  // Flatten a schedule payload into a simple array.
  scheduleList: (sched) => {
    return ((sched && (sched.schedule || sched.events)) || []).map((e) => {
      const g = CF.API.gameFromEvent(e), home = g.home.abbr === "CHI";
      const me = home ? g.home : g.away, opp = home ? g.away : g.home;
      const played = g.state === "post";
      return {id:g.id,date:g.date,seasonType:g.seasonType,opp:opp.name,oppAbbr:opp.abbr,home,
        scoreMe:played ? me.score : null,scoreOpp:played ? opp.score : null,
        state:g.state,completed:played,result:g.display,tv:g.tv,venue:g.venue};
    }).sort((a,b) => new Date(a.date) - new Date(b.date));
  },

  /* Last completed meeting vs an opponent abbr (same season log), if any. */
  lastMeetingVs: (sched, oppAbbr) => {
    if (!oppAbbr) return null;
    const want = String(oppAbbr).toUpperCase();
    const now = Date.now();
    const rows = CF.API.scheduleList(sched)
      .filter((r) => {
        if (!r || !r.date) return false;
        if (String(r.oppAbbr || "").toUpperCase() !== want) return false;
        const t = new Date(r.date).getTime();
        if (isNaN(t) || t > now - 2 * 3600e3) return false;
        const hasScore = (r.scoreMe != null && r.scoreMe !== "" && r.scoreMe !== "–")
          || (r.scoreOpp != null && r.scoreOpp !== "" && r.scoreOpp !== "–");
        const done = hasScore || /final|fte|f\/ot|completed/i.test(String(r.result || ""));
        return done;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows[0] || null;
  },

  /* W/L/T from scored meeting only — never invent a result. */
  meetingResult: (r) => {
    if (!r) return null;
    const a = parseInt(r.scoreMe, 10), b = parseInt(r.scoreOpp, 10);
    if (!isNaN(a) && !isNaN(b)) return a > b ? "W" : a < b ? "L" : "T";
    const m = String(r.result || "").trim().toUpperCase();
    if (m === "W" || m === "L" || m === "T") return m;
    return null;
  },

  /* Last N completed meetings vs opponent (season log only). */
  meetingsVs: (sched, oppAbbr, limit) => {
    if (!oppAbbr) return [];
    const want = String(oppAbbr).toUpperCase();
    const cap = Math.max(1, Math.min(Number(limit) || 5, 5));
    const now = Date.now();
    return CF.API.scheduleList(sched)
      .filter((r) => {
        if (!r || !r.date) return false;
        if (String(r.oppAbbr || "").toUpperCase() !== want) return false;
        const t = new Date(r.date).getTime();
        if (isNaN(t) || t > now - 2 * 3600e3) return false;
        const hasScore = (r.scoreMe != null && r.scoreMe !== "" && r.scoreMe !== "–")
          || (r.scoreOpp != null && r.scoreOpp !== "" && r.scoreOpp !== "–");
        const done = hasScore || /final|fte|f\/ot|completed/i.test(String(r.result || ""));
        return done;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, cap)
      .map((r) => {
        const wl = CF.API.meetingResult(r);
        return wl ? Object.assign({}, r, { wl: wl }) : null;
      })
      .filter(Boolean);
  },

  /* Rest days between the most recent completed Bears game and a kickoff date. */
  restDaysBefore: (sched, nextDate) => {
    if (!nextDate) return null;
    const kick = new Date(nextDate).getTime();
    if (isNaN(kick)) return null;
    const now = Date.now();
    const past = CF.API.scheduleList(sched)
      .filter((r) => {
        if (!r || !r.date) return false;
        const t = new Date(r.date).getTime();
        if (isNaN(t) || t >= kick - 6 * 3600e3) return false;
        if (t > now + 3600e3) return false;
        const hasScore = (r.scoreMe != null && r.scoreMe !== "" && r.scoreMe !== "–")
          || (r.scoreOpp != null && r.scoreOpp !== "" && r.scoreOpp !== "–");
        return hasScore || /final|fte|f\/ot|completed/i.test(String(r.result || ""));
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!past.length) return null;
    const last = past[0];
    const lastT = new Date(last.date).getTime();
    const days = Math.max(0, Math.round((kick - lastT) / 86400e3));
    return { days, last };
  },

  // NFC North (or group containing CHI) from a standings payload.
  divisionTable: (stand) => {
    const entries = new Map(), north = ["CHI","DET","GB","MIN"];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      (node.standings?.entries || node.entries || []).forEach((e) => {
        if(north.includes(e.team?.abbreviation)) entries.set(e.team.abbreviation,e);
      });
      [node.groups,node.children,node.standings?.groups].forEach((nodes) => { if(Array.isArray(nodes)) nodes.forEach(walk); });
    };
    walk(stand);
    if (!entries.size) return null;
    const rows = [...entries.values()].map((e) => {
      const st = {}, display = {};
      (e.stats || []).forEach((v) => { st[v.name]=v.value;display[v.name]=v.displayValue; });
      const t=e.team || {}, w=st.wins ?? st.win ?? 0, l=st.losses ?? st.lose ?? 0;
      return {name:t.displayName || t.name,abbr:t.abbreviation,gp:st.gamesPlayed ?? st.games ?? (w+l+(st.ties || 0)),
        w,l,pct:st.winPercent ?? st.winPct ?? st.pct ?? 0,div:st.divisionRank ?? st.divRank,
        streak:display.streak || "—",isMe:t.abbreviation === "CHI"};
    }).sort((a,b) => (Number(b.pct)-Number(a.pct)) || (Number(a.div ?? 99)-Number(b.div ?? 99)) || north.indexOf(a.abbr)-north.indexOf(b.abbr));
    return {name:"NFC North",season:stand.season?.displayName || "",rows};
  },

  // Roster flattened to players. Handles both ESPN shapes:
  //   old: { roster: [{ group, players: [] }] }
  //   new: { athletes: [{ position: "offense"|"defense"|..., items: [] }] }
  // Items also carry live status ("Active", "Day-To-Day"…), an injuries[]
  // list and birthPlace/college, so the team page doubles as the injury
  // list fallback.
  rosterPlayers: (r) => {
    let groups = [];
    if (r && Array.isArray(r.roster)) groups = r.roster.map((g) => ({ group: g.group || g.name || "roster", players: g.players || [] }));
    else if (r && Array.isArray(r.athletes)) groups = r.athletes.map((g) => ({ group: g.position || g.group || "roster", players: g.items || [] }));
    else if (Array.isArray(r)) groups = [{ group: "roster", players: r }];
    const out = [];
    groups.forEach((g) => (g.players || []).forEach((p) => out.push({ p, group: g.group })));
    return out.map(({ p, group }) => {
      const inj = (p.injuries && p.injuries[0]) || null;
      const st = p.status || {};
      const birth = p.birthPlace || {};
      const college = p.college && p.college.name ? p.college.name : "";
      const from = (birth.city ? birth.city + (birth.state ? ", " + birth.state : "") : birth.country) || college || "";
      const link = (p.links && (p.links[0] && p.links[0].href)) || (p.links && p.links.web ? p.links.web.href : null);
      return {
        id: p.id,
        headshot: p.headshot?.href || "",
        name: p.displayName || p.name || "—",
        pos: p.position ? (p.position.abbreviation || p.position) : (p.position || "—"),
        jersey: p.jersey || "",
        height: p.displayHeight || p.height || "",
        weight: p.displayWeight || (p.weight != null ? p.weight + " lb" : ""),
        age: p.age != null ? p.age : "",
        exp: (p.experience && p.experience.years != null) ? p.experience.years + " yrs" : (p.experience != null ? String(p.experience) : ""),
        nation: from,
        from,
        college,
        group,
        groupIsIR: /injured|out$/i.test(group || ""),
        statusName: st.name || st.abbreviation || "",
        statusType: st.type || "",
        injury: inj ? (inj.status || "") : "",
        injuryDate: inj ? inj.date : null,
        stats: p.seasonStats || p.stats || null,
        url: link,
      };
    });
  },

  // Players on the roster who are hurt (IR group, flagged, or non-active).
  rosterInjuryRows: (r) => {
    return CF.API.rosterPlayers(r)
      .filter((p) => p.groupIsIR || p.injury || (p.statusType && p.statusType !== "active"))
      .map((p) => ({
        name: p.name,
        pos: p.pos,
        status: p.injury || p.statusName || "Listed",
        date: p.injuryDate || "",
        comment: p.groupIsIR ? "Listed in the injured group." : (p.statusName || ""),
        url: p.url,
      }));
  },

  // Bears rows + editorial notes from the league-wide injuries payload.
  bearsInjuryRows: (payload) => {
    const teams = (payload && payload.injuries) || [];
    const bears = teams.find((t) => t.displayName === "Chicago Bears" || (t.team || {}).abbreviation === "CHI");
    const rows = [];
    const notes = [];
    (((bears && bears.injuries) || [])).forEach((r) => {
      const a = r.athlete;
      const comment = (r.longComment && r.longComment !== r.shortComment) ? r.longComment : (r.shortComment || "");
      if (!a) { if (comment) notes.push(comment); return; }
      // Compact injury designation from ESPN's details: type + detail + side,
      // skipping junk values ("Not Specified", null/empty). e.g. "Hamstring —
      // Strain (Right)", "Knee", "Leg", "Knee — ACL (Surgery)", "Undisclosed".
      const cleanDetail = (v) => {
        const s = String(v == null ? "" : v).trim();
        return (!s || /^not specified$/i.test(s)) ? "" : s;
      };
      const d = r.details || {};
      const dType = cleanDetail(d.type);
      const dDetail = cleanDetail(d.detail);
      const dSide = cleanDetail(d.side);
      let injury = dType;
      if (dDetail && dSide) injury += " — " + dDetail + " (" + dSide + ")";
      else if (dDetail) injury += " (" + dDetail + ")";
      else if (dSide) injury += " (" + dSide + ")";
      injury = injury.replace(/ - /g, " — "); // house style: "Knee - ACL" → "Knee — ACL"
      rows.push({
        name: a.displayName || "—",
        pos: a.position ? (a.position.abbreviation || "") : "",
        status: r.status || "",
        date: r.date || "",
        comment: comment,
        injury: injury,
        // v1.68.0 — the compact designation for table cells; the long
        // editorial comment stays on the wire as the story behind the row.
        short: r.shortComment || "",
        url: a.links && a.links[0] ? a.links[0].href : null,
      });
    });
    return { rows, notes, found: Boolean(bears) };
  },

  /* ---------- derived standings (preseason / early season) ----------
     The league standings endpoint is an empty stub until the regular
     season starts, so the site reconstructs a division table from the
     scoreboard over a date range. Every completed game updates W-L-PF-PA
     for both teams; then the NFC North (or the most active teams) is
     rendered, clearly labeled as a derived preseason record. */
  preseasonStandings: async (startParam, endParam) => {
    const key = startParam + "-" + endParam;
    const rangeUrl = CF.base() + "/scoreboard?dates=" + key;
    const altUrl = CF.API.webBase() + "/scoreboard?dates=" + key;
    try {
      const r = await CF.getSource("scoreboard",
        () => CF.fetchJSON(rangeUrl, { timeout: 15000 }),
        "scoreboard." + key, rangeUrl,
        [() => CF.fetchJSON(altUrl, { timeout: 15000 })]);
      const table = CF.API.aggregateStandings(r.data);
      if (table && table.rows && table.rows.length) return table;
    } catch (e) { /* range unsupported on some hosts — derive from schedule */ }
    // Schedule-derived NFC North (completed games only — no fake rows).
    try {
      const s = await CF.API.getSchedule();
      const table = CF.API.standingsFromBearsSchedule(s.data);
      if (table && table.rows && table.rows.length) return table;
    } catch (e2) { /* fall */ }
    throw new Error("derived standings unavailable");
  },

  /* Build a minimal division table from the Bears season log + known
     NFC North abbrs. Only counts completed scored games — never invents. */
  standingsFromBearsSchedule: (sched) => {
    const north = ["CHI", "DET", "GB", "MIN"];
    const stats = {};
    north.forEach((a) => { stats[a] = { abbr: a, name: a, gp: 0, w: 0, l: 0 }; });
    const names = { CHI: "Chicago Bears", DET: "Detroit Lions", GB: "Green Bay Packers", MIN: "Minnesota Vikings" };
    north.forEach((a) => { stats[a].name = names[a]; });
    CF.API.scheduleList(sched).forEach((r) => {
      const a = parseInt(r.scoreMe, 10), b = parseInt(r.scoreOpp, 10);
      if (isNaN(a) || isNaN(b)) return;
      const me = stats.CHI;
      me.gp += 1;
      if (a > b) me.w += 1; else if (a < b) me.l += 1;
      const opp = String(r.oppAbbr || "").toUpperCase();
      if (stats[opp]) {
        stats[opp].gp += 1;
        if (b > a) stats[opp].w += 1; else if (b < a) stats[opp].l += 1;
      }
    });
    const rows = north.map((a) => {
      const s = stats[a];
      return {
        name: s.name, abbr: s.abbr, gp: s.gp, w: s.w, l: s.l,
        pct: s.gp ? s.w / s.gp : 0, div: null, streak: "", isMe: a === "CHI",
      };
    }).filter((r) => r.gp > 0 || r.abbr === "CHI")
      .sort((a, b) => (b.w - a.w) || (a.l - b.l));
    if (!rows.length) return null;
    return { name: "NFC North (from season log)", rows };
  },

  aggregateStandings: (sb) => {
    const stats = {};
    const add = (abbr, name, d) => {
      if (!abbr) return;
      const s = (stats[abbr] = stats[abbr] || { name: "", gp: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 });
      if (name && !s.name) s.name = name;
      s.gp += d.gp || 0; s.w += d.w || 0; s.l += d.l || 0; s.t += d.t || 0; s.pf += d.pf || 0; s.pa += d.pa || 0;
    };
    ((sb && sb.events) || []).forEach((e) => {
      const st = (e.status && e.status.type) || {};
      if (st.completed !== true && st.state !== "post") return;
      const c = ((e.competitions) || [])[0] || {};
      const home = (c.competitors || []).find((x) => x.homeAway === "home");
      const away = (c.competitors || []).find((x) => x.homeAway === "away");
      if (!home || !away) return;
      const hs = CF.API.score(home.score), as_ = CF.API.score(away.score);
      if (hs == null || as_ == null) return;
      const ha = (home.team || {}).abbreviation, aa = (away.team || {}).abbreviation;
      add(ha, (home.team || {}).displayName, { gp: 1, pf: Number(hs) || 0, pa: Number(as_) || 0 });
      add(aa, (away.team || {}).displayName, { gp: 1, pf: Number(as_) || 0, pa: Number(hs) || 0 });
      if (Number(hs) > Number(as_)) { add(ha, null, { w: 1 }); add(aa, null, { l: 1 }); }
      else if (Number(as_) > Number(hs)) { add(aa, null, { w: 1 }); add(ha, null, { l: 1 }); }
      else { add(aa, null, { t: 1 }); add(ha, null, { t: 1 }); }
    });
    const pick = (abbr) => {
      const s = stats[abbr];
      return { name: s.name, abbr, gp: s.gp, w: s.w, l: s.l, pct: s.gp ? (s.w + s.t / 2) / s.gp : 0, div: null, streak: "", isMe: abbr === "CHI" };
    };
    const north = ["CHI", "DET", "GB", "MIN"].filter((a) => stats[a]);
    if (north.length >= 3) {
      const rows = north.map(pick).sort((a, b) => (b.w - a.w) || (a.l - b.l));
      return { name: north.length === 4 ? "NFC North" : "NFC North (partial)", rows };
    }
    return north.length ? { name: "NFC North (partial)", rows: north.map(pick) } : null;
  },

  // Sensible window for derived standings. It must open early enough to
  // catch EVERY team's first preseason game — the Bears' first game isn't
  // necessarily the earliest one (some rivals open a week before us), so we
  // open at the earlier of the Bears' first scheduled game and a ~3-week
  // lookback. Only used while the real standings endpoint is an empty stub
  // (i.e. the preseason), where a wide window is harmless.
  preseasonStandingsAuto: async () => {
    const today = new Date();
    let startD = new Date(today.getTime() - 21 * 86400e3);
    try {
      const s = await CF.API.getSchedule();
      const items = (s.data && (s.data.schedule || s.data.events)) || [];
      const dates = items.map((it) => new Date(it.date).getTime()).filter((t) => !isNaN(t));
      if (dates.length) {
        const firstBears = new Date(Math.min.apply(null, dates));
        if (firstBears < startD) startD = firstBears;
      }
    } catch (e) { /* default window */ }
    return CF.API.preseasonStandings(CF.todayParam(startD), CF.todayParam(today));
  },

  /* ---------- one game by ID ----------
     /events/{id} is a 404 on both ESPN hosts, but the scoreboard for the
     game's date carries the full event — scores, venue, broadcasts, and
     the per-game leaders that stand in for box scores in the preseason.
     Date is resolved from the schedule first, then nearby days. */
  bearsGameEvent: async (id) => {
    try {
      const summary = await CF.API.getEvent(id);
      const event = summary.header;
      const competition = event?.competitions?.[0];
      if (competition) return Object.assign({}, event, {
        name: event.name || [...(competition.competitors || [])]
          .sort((a, b) => (a.homeAway === "home") - (b.homeAway === "home"))
          .map((team) => team.team?.displayName || "Team").join(" at "),
        date: event.date || competition.date,
        status: event.status || competition.status,
        competitions: [Object.assign({}, competition, { venue: competition.venue || summary.gameInfo?.venue })],
        teamLeaders: summary.leaders || [],
      });
    } catch (_) { /* A dated scoreboard can still supply the game. */ }
    let dates = [];
    try {
      const s = await CF.API.getSchedule();
      const items = (s.data && (s.data.schedule || s.data.events)) || [];
      const it = items.find((x) => String(x.id) === String(id));
      if (it && it.date) {
        const d = new Date(it.date);
        if (!isNaN(d.getTime())) dates.push(CF.todayParam(d));
      }
    } catch (e) { /* scan nearby days */ }
    if (!dates.length) dates = [0, -1, -2, -3, -4, -5].map((o) => CF.dayParam(o));
    for (const dp of dates) {
      try {
        const sb = await CF.API.getScoreboard(dp);
        const e = ((sb.data && sb.data.events) || []).find((x) => String(x.id) === String(id));
        if (e) return e;
      } catch (e2) { /* next day */ }
    }
    throw new Error("game not found: " + id);
  },

  // Per-game leader rows from a scoreboard event (the league wire's
  // standing in for a full box score in the preseason).
  eventLeaders: (event) => {
    const c = ((event && event.competitions) || [])[0] || {};
    const idToAbbr = {};
    (c.competitors || []).forEach((comp) => {
      const t = comp.team || {};
      if (t.id != null && t.abbreviation) idToAbbr[String(t.id)] = t.abbreviation;
    });
    const rows = [];
    const categories = event?.teamLeaders?.length
      ? event.teamLeaders.flatMap((group) => (group.leaders || []).map((cat) => Object.assign({}, cat, { team: group.team })))
      : (c.leaders || []);
    categories.forEach((cat) => {
      (cat.leaders || []).forEach((l) => {
        const a = l.athlete || {};
        rows.push({
          category: cat.name || "",
          label: cat.displayName || cat.shortDisplayName || cat.name || "Leader",
          player: a.displayName || "—",
          pos: a.position ? (a.position.abbreviation || "") : "",
          jersey: a.jersey || "",
          value: l.value != null ? Number(l.value) : null,
          display: l.displayValue || (l.value != null ? String(l.value) : "—"),
          teamAbbr: cat.team?.abbreviation || idToAbbr[String((l.team || cat.team || {}).id)] || "",
          url: a.links && a.links[0] ? a.links[0].href : null,
        });
      });
    });
    return rows.sort((a, b) => (b.value || 0) - (a.value || 0));
  },

  /* ---------- TheSportsDB (optional, BYO free key) ----------
     A fully independent second wire: different company, different CDN,
     different JSON. When a key is set (About page), roster / schedule /
     standings gain this fallback so they survive a network that blocks
     every ESPN host and every public proxy. Without a key the functions
     throw immediately and the ESPN chain carries on alone. The key lives
     only in this browser's localStorage. */
  tsdbKey: () => { try { return (localStorage.getItem("cf.tsdbkey") || "").trim(); } catch (e) { return ""; } },
  setTSDBKey: (k) => { try { localStorage.setItem("cf.tsdbkey", (k || "").trim()); return true; } catch (e) { return false; } },

  getTSDB: async (path) => {
    const key = CF.API.tsdbKey();
    if (!key) throw new Error("TheSportsDB: no key set");
    const d = await CF.fetchJSON("https://www.thesportsdb.com/api/v1/json/" + encodeURIComponent(key) + path, { timeout: 10000 });
    if (!d) throw new Error("TheSportsDB: empty response");
    return d;
  },

  // Resolves (and remembers) the Bears' team id via name search.
  tsdbTeamId: async () => {
    try { const c = localStorage.getItem("cf.tsdbteam"); if (c) return c; } catch (e) { /* look it up */ }
    const d = await CF.API.getTSDB("/searchteams.php?t=Chicago%20Bears");
    const list = (d && d.teams) || [];
    const bear = list.find((t) => /chicago bears/i.test(t.strTeam || "")) || list.find((t) => /bears/i.test(t.strTeam || ""));
    if (!bear) throw new Error("TheSportsDB: no Chicago Bears in search results");
    try { localStorage.setItem("cf.tsdbteam", bear.idTeam); } catch (e) { /* private mode */ }
    return bear.idTeam;
  },

  /* Roster adapter — returns the same shape CF.API.rosterPlayers consumes,
     so the team page renders it with no changes. */
  tsdbRoster: async () => {
    const id=await CF.API.tsdbTeamId();
    const d=await CF.API.getTSDB("/lookup_all_players.php?id="+encodeURIComponent(id));
    const players=d?.player || d?.players || [];
    if(!players.length)throw new Error("TheSportsDB: no player data");
    return {provider:"TheSportsDB",athletes:[{position:"Roster",items:players.map((p)=>({
      id:p.idPlayer,displayName:p.strPlayer,jersey:p.strNumber || "",position:{abbreviation:p.strPosition || "—"},
      displayHeight:p.strHeight || "",displayWeight:p.strWeight || "",birthPlace:{country:p.strNationality || ""}
    }))}]};
  },

  /* Schedule adapter — maps TheSportsDB events onto the ESPN schedule shape
     (scheduleList / nextBearsGameFromSchedule consume it unchanged). */
  tsdbSchedule: async () => {
    const id = await CF.API.tsdbTeamId();
    const d = await CF.API.getTSDB("/lookup_all_events.php?id=" + id + "&s=" + CF.API.nflSeasonYear());
    const evs = (d && d.events) || [];
    if (!evs.length) throw new Error("TheSportsDB: no events for the season");
    const isMe = (s) => /chicago bears/i.test(s || "");
    const events = evs.map((e) => {
      const dateStr = e.dateEvent ? (e.dateEvent + "T" + (e.strTime || "17:30:00")) : null;
      const d0 = dateStr ? new Date(dateStr) : null;
      const preseason = d0 ? (d0.getMonth() < 8) : true; // before September = camp
      const done = /^(?:final|ft|aot|match finished)$/i.test(e.strStatus || "");
      const team = (name) => ({ abbreviation: isMe(name) ? "CHI" : "?", displayName: name || "—" });
      return {
        id: e.idEvent,
        date: dateStr ? dateStr.replace(/Z$/, "") + "Z" : null,
        timeValid: Boolean(e.strTime),
        seasonType: preseason ? "pre" : "reg",
        status: { type: { state: done ? "post" : "pre" } },
        competitions: [{
          competitors: [
            { homeAway: "home", team: team(e.strHomeTeam), score: e.intHomeScore != null ? String(e.intHomeScore) : null },
            { homeAway: "away", team: team(e.strAwayTeam), score: e.intAwayScore != null ? String(e.intAwayScore) : null },
          ],
        }],
      };
    });
    return { events };
  },

  /* Standings adapter — reuses the same aggregator that derives the
     preseason table from ESPN's scoreboard, fed with TheSportsDB events. */
  tsdbStandings: async () => {
    const sched = await CF.API.tsdbSchedule();
    const events = ((sched && sched.events) || []).map((e) => ({
      status: { type: { completed: e.status && e.status.type && e.status.type.state === "post", state: e.status ? e.status.type.state : "pre" } },
      competitions: e.competitions,
    }));
    const d = CF.API.aggregateStandings({ events });
    if (!d || !d.rows || !d.rows.length) throw new Error("TheSportsDB: no standings data");
    d.name = (d.name || "Division") + " (TheSportsDB wire)";
    return d;
  },

  /* ---------- API-Sports (optional, BYO free key) ----------
     Free tier: 100 requests/day. The key never leaves this browser
     (localStorage, set on the About page). When present, the stats and
     injuries panels prefer this feed; when absent or unreachable they
     fall back to the ESPN-derived numbers. NFL = league 1. */
  apisportsKey: () => { try { return localStorage.getItem("cf.apisportskey") || ""; } catch (e) { return ""; } },
  setAPISportsKey: (k) => { try { localStorage.setItem("cf.apisportskey", (k || "").trim()); return true; } catch (e) { return false; } },

  // NFL season year for API-Sports (Aug–Dec → that year, Jan–Jul → prior).
  nflSeasonYear: () => {
    const d = new Date();
    return (d.getMonth() >= 7) ? d.getFullYear() : d.getFullYear() - 1;
  },

  getAPISports: async (path) => {
    const key = CF.API.apisportsKey();
    if (!key) return null;
    const url = CF.CONFIG.endpoints.apisports + path;
    const r = await CF.fetchJSON(url, { timeout: 10000, headers: { "x-apisports-key": key, Accept: "application/json" } });
    if (r?.errors && Object.keys(r.errors).length) throw new Error("API-Sports: request unavailable for this key or plan");
    return Array.isArray(r?.response) ? r.response : [];
  },

  apisportsTeamId: async () => {
    if (CF.API._apisportsTeam) return CF.API._apisportsTeam;
    const teams = await CF.API.getAPISports("/teams?search=Chicago");
    const match = (teams || []).find((row) => /chicago bears/i.test((row.team || row).name || ""));
    const id = (match?.team || match)?.id;
    if (!id) throw new Error("API-Sports: Bears team unavailable");
    CF.API._apisportsTeam = id;
    return id;
  },

  apisportsPlayerStats: async () => {
    const id = await CF.API.apisportsTeamId();
    const data = await CF.API.getAPISports("/players/statistics?team=" + encodeURIComponent(id) + "&season=" + CF.API.nflSeasonYear());
    const players = [];
    for (const row of data || []) {
      const player = row.player || {};
      const stats = {};
      const collect = (node, prefix = "") => {
        if (Array.isArray(node)) { node.forEach((item) => collect(item, prefix)); return; }
        if (!node || typeof node !== "object") return;
        if (node.name && node.value != null && Number.isFinite(Number(node.value))) {
          stats[(prefix ? prefix + " " : "") + node.name] = Number(node.value);
        }
        if (node.statistics) collect(node.statistics, node.group || node.name || prefix);
        if (node.groups) collect(node.groups, prefix);
      };
      if (Array.isArray(row.teams)) row.teams.filter((team) => String((team.team || team).id) === String(id)).forEach((team) => collect(team));
      else collect(row);
      if (Object.keys(stats).length) players.push({ name: player.name || row.name || "Bears player", pos: player.position || "", stats });
    }
    if (!players.length) return null;
    const cols = [...new Set(players.flatMap((p) => Object.keys(p.stats)))].slice(0, 5);
    return { cols, top: players.sort((a,b) => (b.stats[cols[0]] || 0) - (a.stats[cols[0]] || 0)).slice(0, 15) };
  },

  apisportsInjuries: async () => {
    const id = await CF.API.apisportsTeamId();
    const data = await CF.API.getAPISports("/injuries?team=" + encodeURIComponent(id));
    return (data || []).map((row) => ({ name: row.player?.name || "Bears player", pos: row.player?.position || "",
      status: row.status || "Listed", date: row.date || "", comment: row.description || "", url: null }));
  },

  // Odds for a single game from the ESPN /odds payload.
  oddsForGame: (payload,gameId) => {
    const list=Array.isArray(payload) ? payload : (payload?.events || payload?.games || []);
    const g=list.find((e)=>String(e.id)===String(gameId));
    if(!g)return null;
    const odds=g.competitions?.[0]?.odds || g.odds || [];
    return {id:g.id,name:g.name,date:g.date,lines:(Array.isArray(odds) ? odds : [odds]).map((o)=>{
      const point=o.pointSpread,ml=o.moneyline || o.moneyLine;
      const value=(v)=>v && typeof v === "object" ? (v.close?.odds ?? v.odds ?? null) : (v ?? null);
      return {book:o.provider?.name || "Book",spread:point ? {home:point.home?.close?.line,away:point.away?.close?.line} : (typeof o.spread === "object" ? o.spread : null),
        total:o.overUnder ?? (typeof o.total === "number" ? o.total : null),
        ml:ml ? {home:value(ml.home),away:value(ml.away)} : null,url:null};
    }).filter((l)=>l.spread || l.total != null || l.ml)};
  },

  // Bears-relevant Polymarket events.
  polymarketBears: (events) => {
    const hit = (s) => /\bbears\b/i.test(s || "");
    return (events || []).filter((ev) =>
      hit(ev.title) || hit(ev.slug) ||
      (ev.markets || []).some((m) => hit(m.question))
    ).map((ev) => ({
      title: ev.title,
      slug: ev.slug,
      url: "https://polymarket.com/event/" + (ev.slug || ev.id),
      markets: (ev.markets || []).filter((m) => m.closed !== true && m.active !== false &&
        (hit(ev.title) || hit(ev.slug) || hit(m.question) || hit(m.groupItemTitle))).map((m) => {
        const arr=(v)=>{if(Array.isArray(v))return v;try{const d=JSON.parse(v || "[]");return Array.isArray(d) ? d : [];}catch(e){return [];}};
        const outcomes=arr(m.outcomes),prices=arr(m.outcomePrices).map((v)=>v == null || v === "" ? null : Number(v));
        const valid=(n)=>Number.isFinite(n) && n>=0 && n<=1 ? n : null;
        const yes=valid(prices[0]),no=valid(prices[1]);
        return {
          question: m.question || m.groupItemTitle || ev.title,
          yes, no, yesLabel:outcomes[0] || "Yes",noLabel:outcomes[1] || "No",
          volume: m.volume != null ? Number(m.volume) : (m.volumeNum != null ? Number(m.volumeNum) : null),
          endDate: m.endDate,
          url: "https://polymarket.com/event/" + (ev.slug || ev.id),
        };
      }),
    })).filter((ev) => ev.markets.length);
  },
};

/* Every ESPN fetcher calls CF.base(); keep it available at the CF level too
   (CF.API.base is the source of truth). Without this alias the "direct" leg
   of the feed chain threw "not a function" and the site only ever worked via
   a proxy — now the direct fetch is a real, working path for every visitor. */
CF.base = CF.API.base;
