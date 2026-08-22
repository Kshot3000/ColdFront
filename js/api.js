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

  /* ---------- raw ESPN getters ---------- */
  getTeam: async () => {
    const r = await CF.getSource("team", () => CF.fetchJSON(CF.base() + "/teams/chicago", { timeout: 9000 }), "team");
    return r;
  },

  getNews: async () => {
    const r = await CF.getSource("news", () => CF.fetchJSON(CF.base() + "/teams/chicago/news", { timeout: 9000 }), "news");
    return r.data.news || [];
  },

  getScoreboard: async (dateParam) => {
    const dp = dateParam || CF.todayParam();
    const r = await CF.getSource("scoreboard",
      () => CF.fetchJSON(CF.base() + "/scoreboard?dates=" + dp, { timeout: 9000 }),
      "scoreboard." + dp);
    return r;
  },

  getSchedule: async () => {
    const r = await CF.getSource("schedule", () => CF.fetchJSON(CF.base() + "/teams/chicago/schedule", { timeout: 9000 }), "schedule");
    return r;
  },

  getStandings: async () => {
    const r = await CF.getSource("standings", () => CF.fetchJSON(CF.base() + "/standings", { timeout: 9000 }), "standings");
    return r;
  },

  getRoster: async () => {
    const r = await CF.getSource("roster", () => CF.fetchJSON(CF.base() + "/teams/chicago/roster", { timeout: 9000 }), "roster");
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
    const r = await CF.getSource("odds", () => CF.fetchJSON(CF.base() + "/odds", { timeout: 9000 }), "odds");
    return r;
  },

  /* ---------- Polymarket (prediction markets) ---------- */
  getPolymarket: async (limit) => {
    const qs = "limit=" + (limit || 60) + "&active=true&closed=false&tag_slug=nfl";
    const d = await CF.fetchVia(CF.CONFIG.endpoints.polymarket + "?" + qs, { timeout: 10000 });
    const events = Array.isArray(d) ? d : (d.events || []);
    return events;
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
      home: { abbr: home.team ? home.team.abbreviation : "?", name: home.team ? home.team.displayName : "?", score: home.score || "–" },
      away: { abbr: away.team ? away.team.abbreviation : "?", name: away.team ? away.team.displayName : "?", score: away.score || "–" },
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
        scoreMe: iAmHome ? (home.score || null) : (away.score || null),
        scoreOpp: iAmHome ? (away.score || null) : (home.score || null),
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

  // Roster flattened to players.
  rosterPlayers: (r) => {
    const out = [];
    const groups = (r && r.roster) || (Array.isArray(r) ? r : []);
    groups.forEach((g) => {
      (g.players || []).forEach((p) => out.push(p));
    });
    return out.map((p) => ({
      id: p.id,
      name: p.displayName || p.name || "—",
      pos: p.position ? (p.position.abbreviation || p.position) : (p.position || "—"),
      jersey: p.jersey || "",
      height: p.height || "",
      weight: p.weight != null ? p.weight + " lb" : "",
      age: p.age != null ? p.age : "",
      exp: p.experience != null ? p.experience : "",
      nation: p.nationality ? (p.nationality.displayName || "") : "",
      stats: p.seasonStats || p.stats || null,
      url: p.links && p.links.web ? p.links.web.href : null,
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
