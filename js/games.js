/* THE COLD FRONT — games: live board, season log, box scores, division */
"use strict";

(function () {
  let dayOffset = 0;
  let boxRequest = 0, selectedGame = null;
  const query = new URLSearchParams(location.search);
  let boardRequest = 0;
  let lastEvents = [];
  let lastPastGame = null; // most recent completed Bears game (season log)

  const isoDate = (offset) => {
    const value=CF.dayParam(offset);
    return value.slice(0,4)+"-"+value.slice(4,6)+"-"+value.slice(6,8);
  };

  /* ---------- board ---------- */
  async function loadBoard() {
    const request = ++boardRequest;
    const selectedDay = isoDate(dayOffset);
    const pill = CF.$("#board-pill");
    const box = CF.$("#board");
    pill.textContent = "reading…";
    try {
      const dp = CF.dayParam(dayOffset);
      const r = await CF.API.getScoreboard(dp);
      if(request !== boardRequest) return;
      const events = (r.data.events || []).slice();
      lastEvents = events;
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = CF.sourceLabel(r) + " · " + selectedDay;
      if (!events.length) {
        box.innerHTML = '<div class="empty"><div class="big">🌫</div>No NFL games scheduled for this date.<br><span class="dim">Try another date, or check back after kickoff.</span></div>';
        return;
      }
      // Bears game first.
      const isBears = (e) => ((e.competitions && e.competitions[0] && e.competitions[0].competitors) || [])
        .some((c) => (c.team || {}).abbreviation === "CHI");
      events.sort((a, b) => (isBears(b) ? 1 : 0) - (isBears(a) ? 1 : 0));
      box.innerHTML = events.map((e) => eventCard(e, isBears(e))).join("");
      box.setAttribute("aria-busy", "false");
      // The board keeps refreshing on the shared CF.refresh job below (30 s),
      // so scheduled → live → final transitions pick themselves up.
    } catch (e) {
      if(request !== boardRequest) return;
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML = CF.emptyHTML({
        icon: "🏈",
        title: "Board unreachable",
        sub: "No snapshot for " + CF.dayParam(dayOffset) + " on this device yet.",
        action: '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.espn.com/nfl/scoreboard/" target="_blank" rel="noopener">ESPN scoreboard ↗</a> '
          + '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.nfl.com/scores" target="_blank" rel="noopener">NFL.com scores ↗</a>',
      });
      box.setAttribute("aria-busy", "false");
    }
  }

  function eventCard(e, bears) {
    const c = e.competitions && e.competitions[0];
    if (!c) return "";
    const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
    const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
    const st = (e.status?.type || c.status?.type) || {};
    let pill = '<span class="pill">' + CF.esc(st.shortDetail || "scheduled") + "</span>";
    if (st.state === "in") pill = '<span class="pill live"><span class="dot"></span>' + CF.esc(st.detail || "live") + (e.status && e.status.displayClock ? " · " + CF.esc(e.status.displayClock) : "") + "</span>";
    if (st.state === "post") pill = '<span class="pill final">' + CF.esc(st.shortDetail || "final") + "</span>";
    const tv = (c.broadcasts && c.broadcasts[0]) ? ((c.broadcasts[0].names || []).join(" / ")) : "";
    const watch = (c.broadcasts && c.broadcasts[0] && c.broadcasts[0].links && c.broadcasts[0].links.web) ? c.broadcasts[0].links.web.href : null;
    const espn = "https://www.espn.com/nfl/game/_/gameId/" + e.id;
    const score = (t) => (t.score && t.score !== "–" ? t.score : "");
    return '<div class="card game-card' + (bears ? " bears-game" : "") + '" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      "<div style=\"font-size:13.5px\" class=\"dim\">" + CF.esc(e.name || "") + " · " + CF.esc(e.season ? e.season.displayName : "") + "</div>" +
      pill + "</div>" +
      '<div class="vs" style="margin:12px 0">' +
      side(away, false, st.state) +
      '<div class="mid">at ' + CF.esc((c.venue && (c.venue.fullName || c.venue.displayName)) || "field") + "</div>" +
      side(home, true, st.state) +
      "</div>" +
      '<div class="game-meta">' +
      (CF.fmtDate(e.date) + " · " + (CF.fmtTime(e.date) || "TBD")) +
      (tv ? " · TV: <b>" + CF.esc(tv) + "</b>" : "") +
      (watch ? ' · <a href="' + CF.esc(CF.safeURL(watch)) + '" target="_blank" rel="noopener">Watch ↗</a>' : "") +
      ' · <a href="' + espn + '" target="_blank" rel="noopener">ESPN game ↗</a>' +
      (bears ? ' · <a href="#boxscore" data-boxgame="' + CF.esc(e.id) + '" class="boxlink">Box score ↓</a>' : "") +
      "</div></div>";
  }
  function side(comp, isHome, state) {
    const abbr = (comp.team || {}).abbreviation || "?";
    const name = (comp.team || {}).displayName || "";
    const sc = state === "pre" ? null : CF.API.score(comp.score);
    return '<div class="side"><div class="abbr">' + CF.esc(abbr) + '</div><div class="score">' + CF.esc(sc != null ? sc : "") + '</div><div class="dim" style="font-size:12px">' + CF.esc(name) + (isHome ? " (home)" : "") + "</div></div>";
  }

  /* ---------- season log ---------- */
  async function loadLog() {
    const pill = CF.$("#log-pill");
    const body = CF.$("#log-table tbody");
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · " + rows.length + " games";
      if (!rows.length) throw new Error("empty");
      // upcoming first, then most-recent results.
      const now = Date.now();
      const upcoming = rows.filter((g) => new Date(g.date).getTime() >= now - 6 * 3600e3).sort((a, b) => new Date(a.date) - new Date(b.date));
      const past = rows.filter((g) => new Date(g.date).getTime() < now - 6 * 3600e3).sort((a, b) => new Date(b.date) - new Date(a.date));
      lastPastGame = past.find((g) => g.completed) || null;
      body.innerHTML = [
        ...upcoming.map(logRow),
        ...(upcoming.length && past.length ? '<tr><td colspan="7" style="border:none;height:6px;background:rgba(200,56,3,.12)"></td></tr>' : ""),
        ...past.map(logRow),
      ].join("");
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="7" class="dim">Season log unreachable — no snapshot saved on this device yet. <a href="https://www.espn.com/nfl/schedule/" target="_blank" rel="noopener">ESPN NFL schedule ↗</a></td></tr>';
    }
  }

  function logRow(g) {
    const played = g.completed && g.scoreMe != null && g.scoreOpp != null;
    let result = "—";
    if (played) {
      const a = parseInt(g.scoreMe, 10), b = parseInt(g.scoreOpp, 10);
      if (!isNaN(a) && !isNaN(b)) result = a > b ? "W" : a < b ? "L" : "T";
      else if (g.result) result = g.result;
    }
    const cls = played ? (result === "W" ? "active" : result === "L" ? "out" : "final") : "final";
    const scoreTxt = played ? (g.scoreMe + "–" + g.scoreOpp) : "";
    return '<tr' + (played ? ' class="boxrow" style="cursor:pointer" data-boxgame="' + g.id + '"' : "") + ">" +
      "<td>" + CF.fmtDate(g.date) + " <span class=\"dim\">" + (CF.fmtTime(g.date) || "") + "</span></td>" +
      '<td class="strong">' + (g.home ? "vs " : "@ ") + CF.esc(g.opp) + "</td>" +
      '<td class="num dim">' + (g.home ? "H" : "A") + "</td>" +
      '<td class="num">' + CF.esc(scoreTxt) + "</td>" +
      '<td><span class="st ' + cls + '">' + CF.esc(played ? (result || g.result) : (g.result || "UPCOMING")) + "</span></td>" +
      '<td class="dim">' + CF.esc(g.tv || "") + "</td>" +
      "<td>" + (played ? '<a href="#boxscore" class="boxlink" data-boxgame="' + g.id + '">box ↗</a>' : "") + "</td>" +
      "</tr>";
  }

  /* ---------- box score ---------- */
  const STAT_LABELS = {
    passYds: "Pass Yds", rushYds: "Rush Yds", recYds: "Rec Yds", rec: "Rec", targets: "Tgt",
    passComp: "Cmp", passAtt: "Att", passTd: "Pass TD", rushTd: "Rush TD", recTd: "Rec TD",
    fumble: "Fum", int: "INT", totTackle: "Tot Tkl", soloTackle: "Solo", astTackle: "Ast",
    sack: "Sacks", passDef: "PD", fumRec: "FR", int: "INT", xpr: "XP", fgMade: "FG", fgm: "FGM",
    twoPt: "2PT", punt: "Punt", punts: "Punt", longPunt: "Lg Punt", kickoff: "KO",
  };
  const statLabel = (n) => STAT_LABELS[n] || n.replace(/([A-Z])/g, " $1").trim();

  async function loadBoxscore(gameId) {
    const request = ++boxRequest;
    const box = CF.$("#boxscore");
    box.innerHTML = CF.emptyHTML({ icon: "📋", title: "Pulling the box score…", loading: true });
    try {
      const ev = await CF.API.bearsGameEvent(gameId);
      if (request !== boxRequest) return;
      const c = (ev.competitions || [])[0] || {};
      const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
      const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
      const state = (ev.status?.type || c.status?.type)?.state;
      const hs = state === "pre" ? null : CF.API.score(home.score), as_ = state === "pre" ? null : CF.API.score(away.score);
      const leaders = CF.API.eventLeaders(ev);
      const espn = "https://www.espn.com/nfl/game/_/gameId/" + ev.id;
      const st = (ev.status && ev.status.type) || {};
      const scoreBit = (hs != null || as_ != null)
        ? '<span style="font-size:15px"><b>' + CF.esc((away.team || {}).displayName || "?") + "</b> " + CF.esc(as_ != null ? as_ : "—") +
          " · <b>" + CF.esc((home.team || {}).displayName || "?") + "</b> " + CF.esc(hs != null ? hs : "—") +
          ' <span class="dim">(' + CF.esc((c.venue && (c.venue.fullName || c.venue.displayName)) || "field") + ")</span></span>"
        : "";
      let html =
        '<div class="card pad-lg"><div class="badge-row" style="justify-content:space-between">' +
        "<h3 style=\"margin:0\">" + CF.esc(ev.name || "Box score") + "</h3>" +
        '<span class="pill ' + (st.state === "post" ? "final" : "") + '">' + CF.esc(st.shortDetail || st.detail || CF.fmtDate(ev.date)) + "</span></div>" +
        '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' + scoreBit + '</div>' +
        '<div class="tbl-wrap" style="margin-top:14px;border:none"><table class="tbl"><thead><tr><th>Category</th><th>Leader</th><th class="num">Line</th></tr></thead><tbody>' +
        leaders.map((l) => {
          const nm = l.url ? '<a href="' + CF.esc(CF.safeURL(l.url)) + '" target="_blank" rel="noopener">' + CF.esc(l.player) + "</a>" : CF.esc(l.player);
          return '<tr><td class="strong">' + CF.esc(l.label) + "</td>" +
            "<td>" + nm + ' <span class="dim">' + CF.esc(l.pos || "") + (l.jersey ? " #" + CF.esc(l.jersey) : "") + (l.teamAbbr ? " · " + CF.esc(l.teamAbbr) : "") + "</span></td>" +
            '<td class="num">' + CF.esc(l.display) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>" +
        (leaders.length ? '' : '<p class="dim">Player stats will appear here when the game feed is available.</p>') +
        '<p class="src-note">Game details + per-game leaders from the league wire. <a href="' + CF.esc(espn) + '" target="_blank" rel="noopener">Full stat sheet on ESPN ↗</a> · <a href="stats.html">Season stats →</a></p></div>';
      box.innerHTML = html;
    } catch (e) {
      if (request !== boxRequest) return;
      box.innerHTML = '<div class="empty"><div class="big">📋</div>Box score unavailable right now — the feed for that game didn\'t answer.</div>';
    }
  }

  // The explicit link makes each box score keyboard accessible too.
  document.addEventListener("click", (ev) => {
    const target = ev.target.closest("[data-boxgame]");
    if(!target) return;
    ev.preventDefault();
    selectedGame = target.dataset.boxgame;
    loadBoxscore(selectedGame);
    CF.$("#boxscore").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"});
  });


  /* ---------- next opponent card ----------
     Home → Chicago weather chip (existing CF.loadWeather).
     Away → opponent city note from schedule geo / venue / NFL_CITIES. */
  function formatDeskLine(line) {
    if (!line || !line.lines || !line.lines.length) return null;
    const l = line.lines[0];
    const bits = [];
    if (l.spread) {
      const h = (typeof l.spread === "object")
        ? (l.spread.home != null ? l.spread.home : l.spread.away)
        : l.spread;
      if (h != null) bits.push({ k: "Spread", v: String(h) });
    }
    if (l.total != null) bits.push({ k: "O/U", v: String(l.total) });
    if (l.ml) {
      const m = (typeof l.ml === "object")
        ? (l.ml.home != null ? l.ml.home : l.ml.away)
        : l.ml;
      if (m != null) bits.push({ k: "ML", v: String(m) });
    }
    return bits.length ? { book: l.book || "Wire", bits } : null;
  }

  /* Sunday desk — next opp chips + rest + last meetings + wire/Polymarket */
  async function paintMatchupPreview(sched, g) {
    const root = CF.$("#next-opp-preview");
    if (!root || !g) return;
    const last = CF.API.lastMeetingVs(sched, g.oppAbbr);
    const rest = CF.API.restDaysBefore(sched, g.date);
    const hist = CF.API.meetingsVs ? CF.API.meetingsVs(sched, g.oppAbbr, 5) : [];

    let lastHTML =
      '<div class="matchup-stat">' +
      '<span class="k">Last meeting</span>';
    if (last) {
      const site = last.home ? "vs" : "@";
      const score = (last.scoreMe != null && last.scoreMe !== "" && last.scoreMe !== "–")
        ? (CF.esc(String(last.scoreMe)) + "–" + CF.esc(String(last.scoreOpp)))
        : "final";
      lastHTML +=
        '<div class="v">' + CF.esc(site) + " " + CF.esc(last.oppAbbr || g.oppAbbr || "OPP") + "</div>" +
        '<div class="s">' + CF.esc(CF.fmtDate(last.date)) + " · " + score +
        (last.result ? " · " + CF.esc(last.result) : "") + "</div>";
    } else {
      lastHTML +=
        '<div class="v">No prior</div>' +
        '<div class="s">No completed meeting vs ' + CF.esc(g.oppAbbr || "this opponent") + " in the loaded log yet.</div>";
    }
    lastHTML += "</div>";

    let restHTML =
      '<div class="matchup-stat">' +
      '<span class="k">Rest days</span>';
    if (rest && rest.days != null) {
      restHTML +=
        '<div class="v">' + rest.days + (rest.days === 1 ? " day" : " days") + "</div>" +
        '<div class="s">Since ' + CF.esc(CF.fmtDate(rest.last.date)) +
        (rest.last.oppAbbr ? (" vs " + CF.esc(rest.last.oppAbbr)) : "") + "</div>";
    } else {
      restHTML +=
        '<div class="v">—</div>' +
        '<div class="s">Rest clock needs a prior completed game in the season log.</div>';
    }
    restHTML += "</div>";

    let histHTML = "";
    if (hist && hist.length) {
      const chips = hist.map((m) => {
        const site = m.home ? "vs" : "@";
        const score = (m.scoreMe != null && m.scoreMe !== "" && m.scoreMe !== "–")
          ? (String(m.scoreMe) + "–" + String(m.scoreOpp))
          : "";
        const tip = CF.fmtDate(m.date) + " " + site + " " + (m.oppAbbr || g.oppAbbr || "") +
          (score ? " · " + score : "") + " · " + m.wl;
        return '<span class="wl-chip wl-' + m.wl.toLowerCase() + '" title="' + CF.esc(tip) + '">' +
          CF.esc(m.wl) + "</span>";
      }).join("");
      histHTML =
        '<div class="matchup-history" aria-label="Recent meetings vs opponent">' +
        '<span class="k">Last ' + hist.length + " vs " + CF.esc(g.oppAbbr || "OPP") + "</span>" +
        '<div class="wl-chips" role="list">' + chips + "</div>" +
        '<div class="s">From the season log — scored meetings only.</div>' +
        "</div>";
    }

    // Wire line + Polymarket (best-effort; desk still paints without them)
    let wireHTML = "";
    let polyHTML = "";
    try {
      const r = await CF.API.getOdds();
      const line = CF.API.oddsForGame(r.data, g.id);
      const fmt = formatDeskLine(line);
      if (fmt) {
        wireHTML =
          '<div class="matchup-stat desk-odds">' +
          '<span class="k">Wire line</span>' +
          '<div class="desk-chips">' +
          fmt.bits.map((b) =>
            '<span class="desk-chip"><span class="k">' + CF.esc(b.k) + "</span><b>" + CF.esc(b.v) + "</b></span>"
          ).join("") +
          "</div>" +
          '<div class="s">' + CF.esc(fmt.book) +
          (r.source && r.source !== "live" ? " · " + CF.esc(r.source) : "") +
          ' · <a href="odds.html">board →</a></div></div>';
      }
    } catch (e) { /* odds quiet */ }

    try {
      const events = await CF.API.getPolymarket(80);
      const bears = CF.API.polymarketBears(events);
      let top = null;
      for (const ev of bears) {
        for (const m of (ev.markets || [])) {
          if (m.yes != null) { top = m; break; }
        }
        if (top) break;
      }
      if (top) {
        const yes = Math.round(top.yes * 100);
        polyHTML =
          '<div class="matchup-stat desk-poly">' +
          '<span class="k">Polymarket</span>' +
          '<div class="v" style="font-size:14px;line-height:1.35">' + CF.esc(top.question) + "</div>" +
          '<div class="desk-chips" style="margin-top:8px">' +
          '<span class="desk-chip yes"><span class="k">YES</span><b>' + yes + "¢</b></span>" +
          (top.no != null
            ? '<span class="desk-chip no"><span class="k">NO</span><b>' + Math.round(top.no * 100) + "¢</b></span>"
            : "") +
          "</div>" +
          '<div class="s"><a href="' + CF.esc(top.url) + '" target="_blank" rel="noopener">market ↗</a> · <a href="odds.html">more →</a></div></div>';
      }
    } catch (e2) { /* poly quiet */ }

    if (!wireHTML && !polyHTML) {
      wireHTML =
        '<div class="matchup-stat desk-odds">' +
        '<span class="k">Wire / markets</span>' +
        '<div class="v">Quiet</div>' +
        '<div class="s">No live line or Bears Polymarket right now. <a href="odds.html">Odds board →</a></div></div>';
    }

    let wxBlock = "";
    if (g.home && CF.kickoffWeatherHTML) {
      try {
        const wx = await CF.kickoffWeatherHTML(true);
        if (wx) {
          wxBlock =
            '<div class="matchup-stat desk-wx">' +
            '<span class="k">Kickoff weather</span>' +
            wx.replace('class="kickoff-wx"', 'class="kickoff-wx in-desk"') +
            "</div>";
        }
      } catch (e3) { /* weather quiet */ }
    }

    root.innerHTML =
      '<div class="desk-title"><span class="k">Sunday desk</span> <span class="s">next opp · rest · last meetings · line' +
      (g.home ? " · home wx" : "") + "</span></div>" +
      lastHTML + restHTML + histHTML + wireHTML + polyHTML + wxBlock;
    root.hidden = false;
  }

  async function loadNextOpponent() {
    const vs = CF.$("#next-opp-vs");
    const meta = CF.$("#next-opp-meta");
    const chip = CF.$("#next-opp-chip");
    const pill = CF.$("#next-opp-pill");
    const preview = CF.$("#next-opp-preview");
    if (!vs || !meta || !chip) return;
    let g = null, schedData = null;
    try {
      const sc = await CF.API.getSchedule();
      schedData = sc.data;
      g = CF.API.nextBearsGameFromSchedule(sc.data);
    } catch (e) { /* schedule quiet */ }
    if (!g) {
      if (pill) { pill.className = "pill sample"; pill.textContent = "offline"; }
      vs.textContent = "Board is quiet";
      meta.textContent = "Next kickoff lands here when the schedule answers.";
      chip.innerHTML = '<span class="opp-chip dim">no opponent yet</span>';
      if (preview) { preview.innerHTML = ""; preview.hidden = true; }
      if (CF.clearKickoffBanner) CF.clearKickoffBanner();
      return;
    }
    const site = g.home ? "Home · Soldier Field" : "Away";
    const matchup = (g.home ? "vs " : "@ ") + (g.opp || "opponent");
    if (pill) {
      pill.className = "pill ok";
      pill.textContent = g.home ? "home" : "away";
    }
    vs.textContent = matchup;
    meta.innerHTML =
      "<b>" + CF.fmtDate(g.date) + "</b> · " + (CF.fmtTime(g.date) || "TBD") +
      " · " + CF.esc(site) +
      (g.venue ? " · " + CF.esc(g.venue) : "") +
      (g.tv ? " · TV <b>" + CF.esc(g.tv) + "</b>" : "");
    chip.innerHTML = '<span class="opp-chip dim">reading conditions…</span>';
    if (schedData) await paintMatchupPreview(schedData, g);

    // Gameday chrome when kickoff is inside ~30h
    if (CF.applyGamedayMode && g.date) {
      const hours = (new Date(g.date).getTime() - Date.now()) / 3600e3;
      CF.applyGamedayMode(hours <= 30 && hours > -6, hours <= 0 ? "live" : "gameday");
    }
    if (CF.paintKickoffBanner) CF.paintKickoffBanner(g);

    if (g.home) {
      try {
        const wx = await CF.loadWeather();
        if (!wx) {
          chip.innerHTML = '<span class="opp-chip">🌤 Chicago · weather offline</span>';
          return;
        }
        const f = (c) => Math.round(Number(c) * 9 / 5 + 32);
        const desc = wx.phrase ? CF.esc(wx.phrase) : CF.esc(CF.weatherCode(wx.code));
        chip.innerHTML =
          '<span class="opp-chip home" title="Soldier Field conditions">' +
          "❄ Chicago · <b>" + f(wx.tempC) + "°F</b> " + desc +
          (wx.wind != null ? " · wind " + Math.round(wx.wind) + " km/h" : "") +
          "</span>";
      } catch (e2) {
        chip.innerHTML = '<span class="opp-chip">❄ Chicago · weather unavailable</span>';
      }
    } else {
      const note = CF.API.nflCityNote(g.oppAbbr, g.city, g.venue);
      chip.innerHTML = note
        ? '<span class="opp-chip away" title="Away site">✈ Road trip · <b>' + CF.esc(note) + "</b></span>"
        : '<span class="opp-chip away">✈ Road game · city TBD</span>';
    }
  }

  /* ---------- division ----------
     ESPN standings → (preseason: the endpoint is an empty stub) a table
     derived from completed games in the season window, clearly labeled. */
  async function loadDivision() {
    const pill = CF.$("#div2-pill");
    const body = CF.$("#div-table-2 tbody");
    let div = null, label = "";
    try {
      const r = await CF.API.getStandings();
      const d = CF.API.divisionTable(r.data);
      if (d && d.rows.length) {
        div = d;
        label = r.source === "live" ? "live" : "snapshot";
      }
    } catch (e) { /* standings stub or feed down — try the derived table */ }
    if (!div) {
      try {
        div = await CF.API.preseasonStandingsAuto();
        if (div && div.rows.length) label = "from completed games";
      } catch (e2) { /* try the independent wire */ }
    }
    if (!div && CF.API.tsdbKey()) {
      try {
        div = await CF.API.tsdbStandings();
        if (div && div.rows.length) label = "TheSportsDB wire";
      } catch (e3) { /* fall through to offline */ }
    }
    if (!div || !div.rows.length) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="7" class="dim">Standings unavailable right now.</td></tr>';
      paintRaceBars([], CF.$("#div-race-2"));
      return;
    }
    pill.className = "pill ok";
    pill.textContent = label;
    body.innerHTML = div.rows.map((row) =>
      '<tr class="' + (row.isMe ? "me" : "") + '">' +
      '<td class="strong">' + CF.esc(row.name) + "</td>" +
      '<td class="num">' + CF.esc(row.gp != null ? row.gp : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.w != null ? row.w : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.l != null ? row.l : "—") + "</td>" +
      '<td class="num">' + (row.pct != null ? Number(row.pct).toFixed(3).replace(/^0/, "") : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.div != null ? row.div : "—") + "</td>" +
      '<td>' + CF.esc(row.streak || "") + "</td>" +
      "</tr>"
    ).join("");
    paintRaceBars(div.rows, CF.$("#div-race-2"));
  }

  function paintRaceBars(rows, root) {
    if (!root) return;
    if (!rows || !rows.length) {
      root.innerHTML = "";
      root.hidden = true;
      return;
    }
    const maxW = Math.max(1, ...rows.map((r) => Number(r.w) || 0));
    root.hidden = false;
    root.innerHTML = '<div class="race-caption">Division race · wins</div>' +
      rows.map((row) => {
        const w = Number(row.w) || 0;
        const pct = Math.round((w / maxW) * 100);
        return '<div class="race-row' + (row.isMe ? " me" : "") + '" title="' + CF.esc(row.abbr + " " + w + "-" + (row.l != null ? row.l : "—")) + '">' +
          '<span class="race-abbr">' + CF.esc(row.abbr) + "</span>" +
          '<span class="race-track"><span class="race-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="race-wl">' + CF.esc(String(w)) + "-" + CF.esc(row.l != null ? String(row.l) : "—") + "</span>" +
          "</div>";
      }).join("");
  }

  /* ---------- date nav ---------- */
  function wireDates() {
    const pick = CF.$("#day-pick");
    const set = (offset) => {
      dayOffset = offset;
      pick.value = isoDate(offset);
      loadBoard();
    };
    if (/^\d{4}-\d{2}-\d{2}$/.test(query.get("date") || "")) {
      const date = Date.parse(query.get("date") + "T12:00:00Z");
      if (Number.isFinite(date)) dayOffset = Math.round((date - Date.parse(isoDate(0) + "T12:00:00Z")) / 86400000);
    }
    pick.value = isoDate(dayOffset);
    CF.$("#day-today").addEventListener("click", () => set(0));
    CF.$("#day-prev").addEventListener("click", () => {
      const d = new Date(pick.value || isoDate(dayOffset));
      d.setDate(d.getDate() - 1);
      const diff = Math.round((d - new Date(isoDate(0))) / 86400e3);
      set(diff);
    });
    CF.$("#day-next").addEventListener("click", () => {
      const d = new Date(pick.value || isoDate(dayOffset));
      d.setDate(d.getDate() + 1);
      const diff = Math.round((d - new Date(isoDate(0))) / 86400e3);
      set(diff);
    });
    pick.addEventListener("change", () => {
      const d = new Date(pick.value);
      if (isNaN(d.getTime())) { set(0); return; }
      const diff = Math.round((d - new Date(isoDate(0))) / 86400e3);
      set(diff);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireDates();
    loadBoard();
    loadLog();
    loadDivision();
    loadNextOpponent();
    // Keep games moving for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadBoard, 30e3);                 // board: 30 s (scheduled → live → final)
    CF.refresh.register(loadLog, 3 * 60e3);               // season log: 3 min
    CF.refresh.register(loadDivision, 5 * 60e3);          // division table: 5 min
    CF.refresh.register(loadNextOpponent, 3 * 60e3, { name: "next-opp" });
    // Preload a box score so the panel is never empty: a live or finished
    // Bears game on the board, else the most recent completed game from
    // the season log (waits briefly for the log on slower networks).
    setTimeout(async () => {
      if (selectedGame) return;
      if (/^\d+$/.test(query.get("game") || "")) { selectedGame = query.get("game"); loadBoxscore(selectedGame); return; }
      const isBears = (e) => ((e.competitions && e.competitions[0] && e.competitions[0].competitors) || [])
        .some((c) => (c.team || {}).abbreviation === "CHI");
      const state = (e) => ((e.status && e.status.type) || {}).state || "";
      const pick = lastEvents.find((e) => isBears(e) && (state(e) === "post" || state(e) === "in"));
      if (pick) { loadBoxscore(pick.id); return; }
      // No in-play/finished Bears game (e.g. only a scheduled one) → last game.
      const deadline = Date.now() + 8000;
      while (!lastPastGame && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!selectedGame && lastPastGame && lastPastGame.id) loadBoxscore(lastPastGame.id);
    }, 2000);
  });
})();
