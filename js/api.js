/* ============================================================
   THE COLD FRONT — data layer
   ESPN site API (primary, CORS-open in browsers) → CORS proxies
   → localStorage snapshot → (page-level sample data as last resort).
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
  web: (path) => () => CF.fetchJSON(CF.webBase() + path, { timeout: 9000 }),

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
    const r = await CF.getSource("news",
      () => CF.fetchJSON(CF.base() + "/teams/chicago/news", { timeout: 9000 }), "news", null,
      [CF.API.web("/teams/chicago/news")]);
    return r.data.news || [];
  },

  getScoreboard: async (dateParam) => {
    const dp = dateParam || CF.todayParam();
    const url = CF.base() + "/scoreboard?dates=" + dp;
    // Pass the dated URL through so the proxy path fetches THIS date, not
    // just today (urlFor("scoreboard") is pinned to the single current day).
    const r = await CF.getSource("scoreboard",
      () => CF.fetchJSON(url, { timeout: 9000 }),
      "scoreboard." + dp, url,
      [() => CF.fetchJSON(CF.webBase() + "/scoreboard?dates=" + dp, { timeout: 9000 })]);
    return r;
  },

  getSchedule: async () => {
    const url = CF.base() + "/teams/chicago/schedule";
    const r = await CF.getSource("schedule",
      () => CF.fetchJSON(url, { timeout: 9000 }), "schedule", url,
      [
        CF.API.web("/teams/chicago/schedule"),
        () => CF.fetchJSON(CF.cdnBase() + "/teams/chicago/schedule", { timeout: 9000 }),
        CF.API.tsdbKey() ? () => CF.API.tsdbSchedule() : null,
      ].filter(Boolean));
    return r;
  },

  getStandings: async () => {
    const r = await CF.getSource("standings",
      () => CF.fetchJSON(CF.base() + "/standings", { timeout: 9000 }), "standings", null,
      [CF.API.web("/standings")]);
    return r;
  },

  getRoster: async () => {
    const url = CF.base() + "/teams/chicago/roster";
    const r = await CF.getSource("roster",
      () => CF.fetchJSON(url, { timeout: 9000 }), "roster", url,
      [
        CF.API.web("/teams/chicago/roster"),
        CF.API.tsdbKey() ? () => CF.API.tsdbRoster() : null,
      ].filter(Boolean));
    return r;
  },

  /* League-wide injury report. Heavy payload (~9 MB) but it carries the
     full Bears list: status per player + editorial notes on the wire. */
  getLeagueInjuries: async () => {
    const r = await CF.getSource("injuries",
      () => CF.fetchJSON(CF.base() + "/injuries", { timeout: 15000 }), "injuries", null,
      [() => CF.fetchJSON(CF.webBase() + "/injuries", { timeout: 15000 })]);
    return r;
  },

  getEvent: async (id) => {
    // Full fallback chain (local proxy -> direct -> optional remote proxy),
    // plus a localStorage snapshot so a live game page survives a blip.
    const cacheKey = "event." + id;
    const cached = CF.cacheGet(cacheKey);
    try {
      const data = await CF.fetchVia(CF.base() + "/events/" + id, { timeout: 9000 });
      CF.cacheSet(cacheKey, data, 3600e3);
      return data;
    } catch (e) {
      if (cached) return cached;
      throw e;
    }
  },

  getOdds: async () => {
    const r = await CF.getSource("odds",
      () => CF.fetchJSON(CF.base() + "/odds", { timeout: 9000 }), "odds", null,
      [CF.API.web("/odds")]);
    return r;
  },

  /* ---------- Polymarket (prediction markets) ---------- */
  getPolymarket: async (limit) => {
    const qs = "limit=" + (limit || 60) + "&active=true&closed=false&tag_slug=nfl";
    const d = await CF.fetchVia(CF.CONFIG.endpoints.polymarket + "?" + qs, { timeout: 10000 });
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
  parseRss: (xml) => {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).map((el) => {
      const t = (n) => { const x = el.getElementsByTagName(n)[0]; return x ? x.textContent.trim() : null; };
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
        title: t("title"),
        link,
        source: srcEl ? srcEl.textContent.trim() : null,
        date: t("pubDate"),
        desc: t("description"),
      };
    }).filter((it) => it.title && it.link);
    return items;
  },

  getGoogleNews: async (query, max) => {
    const q = query || 'Chicago Bears';
    const feeds = [
      CF.CONFIG.endpoints.googleNews + "?q=" + encodeURIComponent(q) + "&hl=en-US&gl=US&ceid=US:en",
      CF.CONFIG.endpoints.bingNews + "?q=" + encodeURIComponent(q) + "&format=RSS",
    ];
    let items = [];
    for (const url of feeds) {
      try {
        const xml = await CF.fetchText(url, { timeout: 10000 });
        items = CF.API.parseRss(xml).slice(0, max || 12);
        if (items.length) break;
      } catch (e) { /* next upstream */ }
    }
    if (!items.length) throw new Error("empty news feed");
    CF.cacheSet("gnews." + q, items, 5 * 60e4);
    return items;
  },

  /* ---------- The Odds API (optional, user's own key) ---------- */
  getOddsApi: async (key) => {
    const qs = "api_key=" + encodeURIComponent(key) + "&region=us&marketType=qlf&dateFormat=iso";
    const d = await CF.fetchVia("https://api.the-odds-api.com/v4/sports/american_football_nfl/odds?" + qs, { timeout: 10000 });
    return d || [];
  },

  /* ---------- extraction helpers (defensive across ESPN shapes) ---------- */

  // Next (or most recent) Bears game from a scoreboard payload.
  bearsGameFromScoreboard: (sb) => {
    const events = (sb && sb.events) || [];
    if (!events.length) return null;
    const isBears = (comp) => (comp.competitors || []).some((c) => (c.team || {}).abbreviation === "CHI");
    const bearsEvents = events.filter((e) => isBears(e.competitions && e.competitions[0]));
    const e = bearsEvents[0] || events[0];
    const c = e.competitions[0];
    const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
    const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
    return {
      id: e.id,
      name: e.name,
      season: e.season ? e.season.displayName : "",
      date: e.date,
      state: e.status && e.status.type ? e.status.type.state : "pre",
      display: e.status && e.status.type ? (e.status.type.detail || e.status.type.displayType || "") : "",
      clock: e.status ? (e.status.displayClock || "") : "",
      home: { abbr: home.team ? home.team.abbreviation : "?", name: home.team ? home.team.displayName : "?", score: CF.API.score(home.score) || "–" },
      away: { abbr: away.team ? away.team.abbreviation : "?", name: away.team ? away.team.displayName : "?", score: CF.API.score(away.score) || "–" },
      venue: c.venue ? c.venue.displayName : "",
      city: c.geolocation ? c.geolocation.city + ", " + c.geolocation.state : "",
      tv: (c.broadcasts && c.broadcasts[0]) ? ((c.broadcasts[0].names || []).join(" / ") || (c.broadcasts[0].shortNames || []).join(" / ")) : "",
      watch: (c.broadcasts && c.broadcasts[0] && c.broadcasts[0].links && c.broadcasts[0].links.web) ? c.broadcasts[0].links.web.href : null,
      odds: c.odds || null,
    };
  },

  // Next scheduled Bears game from the schedule payload (future only).
  nextBearsGameFromSchedule: (sched) => {
    const items = (sched && (sched.schedule || sched.events)) || [];
    const now = Date.now();
    for (const it of items) {
      const d = new Date(it.date || it.start).getTime();
      if (isNaN(d) || d < now - 6 * 3600e3) continue;
      const c = (it.competitions || [it])[0];
      const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
      const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
      const opp = home.team && home.team.abbreviation === "CHI" ? away : home;
      return {
        id: it.id,
        date: it.date,
        season: it.season ? it.season.displayName : (it.seasonType || ""),
        home: !!(home.team && home.team.abbreviation === "CHI"),
        opp: opp.team ? opp.team.displayName : (it.name || "opponent"),
        tv: (c.broadcasts && c.broadcasts[0]) ? ((c.broadcasts[0].names || []).join(" / ")) : "",
        venue: c.venue ? c.venue.displayName : "",
      };
    }
    return null;
  },

  // Flatten a schedule payload into a simple array.
  scheduleList: (sched) => {
    const items = (sched && (sched.schedule || sched.events)) || [];
    return items.map((it) => {
      const c = (it.competitions || [it])[0];
      const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
      const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
      const iAmHome = !!(home.team && home.team.abbreviation === "CHI");
      const opp = iAmHome ? away : home;
      return {
        id: it.id,
        date: it.date,
        seasonType: it.seasonType || (it.season && it.season.type) || "",
        opp: opp.team ? opp.team.displayName : "—",
        oppAbbr: opp.team ? opp.team.abbreviation : "—",
        home: iAmHome,
        scoreMe: iAmHome ? CF.API.score(home.score) : CF.API.score(away.score),
        scoreOpp: iAmHome ? CF.API.score(away.score) : CF.API.score(home.score),
        result: it.status && it.status.type ? (it.status.type.detail || it.status.type.shortDetail || "") : "",
        tv: (c.broadcasts && c.broadcasts[0]) ? ((c.broadcasts[0].names || []).join(" / ")) : "",
        venue: c.venue ? c.venue.displayName : "",
      };
    });
  },

  // NFC North (or group containing CHI) from a standings payload.
  divisionTable: (stand) => {
    const groups = [];
    const walk = (node) => {
      if (!node) return;
      if (node.groups) node.groups.forEach(walk);
      if (node.standings && node.standings.entries) {
        groups.push({ name: node.name || "", entries: node.standings.entries });
      }
      if (node.children) node.children.forEach(walk);
      if (node.standings && node.standings.groups) node.standings.groups.forEach(walk);
    };
    walk(stand);
    const pick = groups.find((g) => /north/i.test(g.name)) ||
      groups.find((g) => (g.entries || []).some((e) => {
        const t = e.team || {};
        return t.abbreviation === "CHI" || /bears/i.test(t.displayName || "");
      })) || groups[0];
    if (!pick) return null;
    return {
      name: pick.name || "Division",
      rows: (pick.entries || []).map((e) => {
        const st = {};
        (e.stats || []).forEach((s) => { st[s.name] = s.value; });
        const t = e.team || {};
        return {
          name: t.displayName || t.name || "—",
          abbr: t.abbreviation || "—",
          gp: st.gamesPlayed != null ? st.gamesPlayed : st.games,
          w: st.wins != null ? st.wins : st.win,
          l: st.losses != null ? st.losses : st.loss,
          pct: st.pct != null ? st.pct : st.winPct,
          div: st.divisionRank != null ? st.divisionRank : st.divRank,
          streak: st.streak || "",
          isMe: t.abbreviation === "CHI",
        };
      }).sort((a, b) => (Number(b.w) - Number(a.w)) || (Number(a.l) - Number(b.l))),
    };
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
      rows.push({
        name: a.displayName || "—",
        pos: a.position ? (a.position.abbreviation || "") : "",
        status: r.status || "",
        date: r.date || "",
        comment: comment,
        url: a.links && a.links[0] ? a.links[0].href : null,
      });
    });
    return { rows, notes };
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
    // Pass the range URL explicitly: urlFor("scoreboard") is hardcoded to the
    // single day (today), so without this the proxy path would fetch today's
    // board instead of the season window the derived table needs.
    const r = await CF.getSource("scoreboard",
      () => CF.fetchJSON(rangeUrl, { timeout: 15000 }),
      "scoreboard." + key, rangeUrl);
    return CF.API.aggregateStandings(r.data);
  },

  aggregateStandings: (sb) => {
    const stats = {};
    const add = (abbr, name, d) => {
      if (!abbr) return;
      const s = (stats[abbr] = stats[abbr] || { name: "", gp: 0, w: 0, l: 0, pf: 0, pa: 0 });
      if (name && !s.name) s.name = name;
      s.gp += d.gp || 0; s.w += d.w || 0; s.l += d.l || 0; s.pf += d.pf || 0; s.pa += d.pa || 0;
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
    });
    const pick = (abbr) => {
      const s = stats[abbr];
      return { name: s.name, abbr, gp: s.gp, w: s.w, l: s.l, pct: s.gp ? s.w / s.gp : 0, div: null, streak: "", isMe: abbr === "CHI" };
    };
    const north = ["CHI", "DET", "GB", "MIN"].filter((a) => stats[a]);
    if (north.length >= 3) {
      const rows = north.map(pick).sort((a, b) => (b.w - a.w) || (a.l - b.l));
      return { name: north.length === 4 ? "NFC North" : "NFC North (partial)", rows };
    }
    const all = Object.keys(stats).sort((a, b) => (stats[b].gp - stats[a].gp) || (stats[b].pf - stats[a].pf));
    if (!all.length) return null;
    return { name: "Most-played teams", rows: all.slice(0, 4).map(pick) };
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
    const dates = [];
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
    (c.leaders || []).forEach((cat) => {
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
          teamAbbr: idToAbbr[String((l.team || {}).id)] || "",
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
  setTSDBKey: (k) => { try { localStorage.setItem("cf.tsdbkey", (k || "").trim()); } catch (e) { /* private mode */ } },

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
    const d = await CF.API.getTSDB("/search_all_teams.php?n=Chicago");
    const list = (d && d.teams) || [];
    const bear = list.find((t) => /chicago bears/i.test(t.strTeam || "")) || list.find((t) => /bears/i.test(t.strTeam || ""));
    if (!bear) throw new Error("TheSportsDB: no Chicago Bears in search results");
    try { localStorage.setItem("cf.tsdbteam", bear.idTeam); } catch (e) { /* private mode */ }
    return bear.idTeam;
  },

  /* Roster adapter — returns the same shape CF.API.rosterPlayers consumes,
     so the team page renders it with no changes. */
  tsdbRoster: async () => {
    const id = await CF.API.tsdbTeamId();
    const d = await CF.API.getTSDB("/lookupteam.php?i=" + id);
    const t = ((d && d.teams) || [])[0];
    if (!t) throw new Error("TheSportsDB: no team payload");
    let names = [];
    try { names = JSON.parse(t.strTeamLocked || "[]"); } catch (e) { names = []; }
    if (!names.length) throw new Error("TheSportsDB: empty roster");
    return [{ group: "Roster", players: names.map((n) => ({ displayName: n })) }];
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
      const done = /final/i.test(e.strStatus || "") || e.intHomeScore != null;
      const team = (name) => ({ abbreviation: isMe(name) ? "CHI" : "?", displayName: name || "—" });
      return {
        id: e.idEvent,
        date: dateStr,
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
     fall back to the ESPN-derived numbers. NFL = league 39. */
  apisportsKey: () => { try { return localStorage.getItem("cf.apisportskey") || ""; } catch (e) { return ""; } },
  setAPISportsKey: (k) => { try { localStorage.setItem("cf.apisportskey", (k || "").trim()); } catch (e) { /* private mode */ } },

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
    return (r && r.response) || [];
  },

  apisportsStandings: async () => {
    const d = await CF.API.getAPISports("/standings?league=" + CF.CONFIG.endpoints.apisportsLeague + "&season=" + CF.API.nflSeasonYear());
    if (!d) return null;
    const rows = (d || []).map((r) => ({
      name: (r.team || {}).name, abbr: (r.team || {}).abbreviation,
      gp: r.played != null ? r.played : null, w: r.win != null ? r.win : null, l: r.lose != null ? r.lose : null,
      pct: (r.played && r.played > 0) ? (r.win || 0) / r.played : 0,
      div: r.rank || null, streak: "",
      isMe: (r.team || {}).abbreviation === "CHI",
    }));
    if (!rows.length) return null;
    return { name: (d[0] && d[0].group ? String(d[0].group) : "Division") + " (API-Sports)", rows: rows.sort((a, b) => (b.w - a.w) || (a.l - b.l)) };
  },

  apisportsPlayerStats: async () => {
    const d = await CF.API.getAPISports("/players/statistics?league=" + CF.CONFIG.endpoints.apisportsLeague + "&season=" + CF.API.nflSeasonYear());
    if (!d) return null;
    const byPlayer = {};
    (d || []).forEach((row) => {
      const p = row.player || {};
      const key = p.id != null ? "id" + p.id : (p.name || Math.random());
      const rec = (byPlayer[key] = byPlayer[key] || { name: p.name || "—", pos: p.position || "", stats: {} });
      (row.statistics || []).forEach((s) => {
        const v = Number(s.value);
        if (!isNaN(v) && v > 0 && (!rec.stats[s.name] || v > rec.stats[s.name])) rec.stats[s.name] = v;
      });
    });
    const players = Object.values(byPlayer);
    const colScore = {};
    players.forEach((p) => Object.keys(p.stats).forEach((k) => { colScore[k] = (colScore[k] || 0) + 1; }));
    const cols = Object.keys(colScore).sort((a, b) => colScore[b] - colScore[a]).slice(0, 5);
    if (!cols.length) return null;
    const top = [...players].sort((a, b) => ((b.stats[cols[0]] || 0) - (a.stats[cols[0]] || 0))).slice(0, 15);
    return { cols, top };
  },

  apisportsInjuries: async () => {
    const d = await CF.API.getAPISports("/injuries?league=" + CF.CONFIG.endpoints.apisportsLeague + "&season=" + CF.API.nflSeasonYear());
    if (!d) return null;
    return (d || [])
      .filter((r) => (r.team || {}).abbreviation === "CHI")
      .map((r) => ({
        name: (r.player || {}).name,
        pos: (r.player || {}).position || "",
        status: r.status || (r.injured ? "Injured" : "Out"),
        date: r.injured || "",
        comment: r.description || "",
        url: null,
      }));
  },

  // Odds for a single game from the ESPN /odds payload.
  oddsForGame: (oddsPayload, gameId) => {
    const games = (oddsPayload && (oddsPayload.games || oddsPayload)) || [];
    const list = Array.isArray(games) ? games : [];
    const g = list.find((x) => String(x.id) === String(gameId)) ||
      list.find((x) => /bears/i.test(x.name || ""));
    if (!g) return null;
    const arr = Array.isArray(g.odds) ? g.odds : (g.odds ? [g.odds] : []);
    return {
      id: g.id,
      name: g.name || "",
      date: g.date,
      lines: arr.map((o) => ({
        book: o.provider ? (o.provider.name || o.provider.displayName || "Book") : "Book",
        spread: o.spread || o.spreadLine || null,
        total: o.overUnder || o.total != null ? o.overUnder || o.total : null,
        ml: o.moneyline || o.moneyLine || null,
        url: o.links && o.links.web ? o.links.web.href : null,
      })).filter((l) => l.spread || l.total || l.ml),
    };
  },

  // Bears-relevant Polymarket events.
  polymarketBears: (events) => {
    const hit = (s) => /bears|chicago/i.test(s || "");
    return (events || []).filter((ev) =>
      hit(ev.title) || hit(ev.slug) ||
      (ev.markets || []).some((m) => hit(m.question))
    ).map((ev) => ({
      title: ev.title,
      slug: ev.slug,
      url: "https://polymarket.com/event/" + (ev.slug || ev.id),
      markets: (ev.markets || []).map((m) => {
        let outcomes = [], prices = [];
        try { outcomes = JSON.parse(m.outcomes || "[]"); } catch (e) { outcomes = (m.outcomes || "").split(","); }
        try { prices = JSON.parse(m.outcomePrices || "[]").map(Number); } catch (e) { prices = (m.outcomePrices || "").split(",").map(Number); }
        const yes = prices[0] != null ? prices[0] : null;
        const no = prices[1] != null ? prices[1] : (yes != null ? Math.max(0, 1 - yes) : null);
        return {
          question: m.question || m.groupItemTitle || ev.title,
          yes, no,
          volume: m.volume != null ? Number(m.volume) : (m.volumeNum != null ? Number(m.volumeNum) : null),
          endDate: m.endDate,
          url: m.slug ? "https://polymarket.com/market/" + m.slug : ("https://polymarket.com/event/" + ev.slug),
        };
      }),
    }));
  },
};

/* Every ESPN fetcher calls CF.base(); keep it available at the CF level too
   (CF.API.base is the source of truth). Without this alias the "direct" leg
   of the feed chain threw "not a function" and the site only ever worked via
   a proxy — now the direct fetch is a real, working path for every visitor. */
CF.base = CF.API.base;
