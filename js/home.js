/* THE COLD FRONT — home page */
"use strict";

(function () {
  let countdownTimer = null;

  /* ---------- next game card ---------- */
  async function loadNextGame() {
    const pill = CF.$("#ng-pill");
    const title = CF.$("#ng-title");
    try {
      // 1) Is there a Bears game today (pre / live / final)?
      let game = null, src = "live";
      try {
        const sb = await CF.API.getScoreboard();
        src = sb.source;
        game = CF.API.bearsGameFromScoreboard(sb.data);
      } catch (e) { /* fall through to schedule */ }

      // 2) Otherwise the next scheduled game.
      let schedGame = null;
      try {
        const sc = await CF.API.getSchedule();
        schedGame = CF.API.nextBearsGameFromSchedule(sc.data);
      } catch (e) { /* no schedule either */ }

      if (!game && !schedGame) throw new Error("no data");

      renderGame(game, schedGame, src);
    } catch (e) {
      title.textContent = "Board is dark";
      pill.className = "pill sample";
      pill.textContent = "offline";
      CF.$("#ng-meta").innerHTML =
        'No live feed and no saved snapshot yet. Open the site once on a connected network and it will cache the board for offline use. <a href="https://www.espn.com/nfl/team/_/name/chi/" target="_blank" rel="noopener">ESPN Bears →</a>';
      CF.$("#ng-countdown").innerHTML = "";
      CF.$("#ng-mid").innerHTML = "Soldier Field<br>Uptown, Chicago";
    }
  }

  function renderGame(game, schedGame, src) {
    const title = CF.$("#ng-title");
    const pill = CF.$("#ng-pill");
    const meta = CF.$("#ng-meta");
    const cd = CF.$("#ng-countdown");
    const mid = CF.$("#ng-mid");

    const isBearsGame = game && (
      game.home.abbr === "CHI" || game.away.abbr === "CHI");

    if (game && isBearsGame) {
      // Game day (or final) — show the scoreboard.
      title.textContent = game.season ? game.season + " · " + game.name : game.name;
      if (game.state === "in") { pill.className = "pill live"; pill.innerHTML = '<span class="dot"></span>live'; }
      else if (game.state === "post") { pill.className = "pill final"; pill.textContent = game.display || "final"; }
      else { pill.className = "pill"; pill.textContent = game.display || "scheduled"; }
      if (src !== "live") {
        const extra = document.createElement("span");
        extra.className = "pill " + (src === "proxy" ? "cache" : "sample");
        extra.textContent = src === "proxy" ? "via proxy" : "snapshot";
        pill.parentNode.insertBefore(extra, pill.nextSibling);
      }
      CF.$("#ng-away-abbr").textContent = game.away.abbr;
      CF.$("#ng-home-abbr").textContent = game.home.abbr;
      CF.$("#ng-away-score").textContent = game.away.score && game.away.score !== "–" ? game.away.score : "";
      CF.$("#ng-home-score").textContent = game.home.score && game.home.score !== "–" ? game.home.score : "";
      mid.innerHTML = "at " + CF.esc(game.venue || "Soldier Field");
      const bits = [];
      bits.push("<b>" + CF.fmtDate(game.date) + "</b> · " + (CF.fmtTime(game.date) || "TBD"));
      if (game.city) bits.push(CF.esc(game.city));
      if (game.tv) bits.push("TV: <b>" + CF.esc(game.tv) + "</b>");
      if (game.watch) bits.push('<a href="' + CF.esc(game.watch) + '" target="_blank" rel="noopener">Watch ↗</a>');
      if (game.clock) bits.push("Clock: " + CF.esc(game.clock));
      meta.innerHTML = bits.join(" · ");
      cd.innerHTML = "";
      if (CF.applyGamedayMode) {
        CF.applyGamedayMode(game.state === "in" || game.state === "pre", game.state === "in" ? "live" : "gameday");
      }
      if (CF.paintKickoffBanner) {
        CF.paintKickoffBanner({
          id: game.id, date: game.date,
          opp: (game.home && game.home.abbr === "CHI") ? (game.away && game.away.name) : (game.home && game.home.name),
          oppAbbr: (game.home && game.home.abbr === "CHI") ? (game.away && game.away.abbr) : (game.home && game.home.abbr),
          home: !!(game.home && game.home.abbr === "CHI"),
        });
      }
      // Live-clock refresh comes from the shared CF.refresh job registered
      // below (30 s, whether the game is scheduled, live, or just final).
      return;
    }

    // Upcoming game from the schedule.
    const g = (game && isBearsGame) ? game : schedGame;
    if (!g) {
      title.textContent = game ? (game.name || "No Bears game on the board") : "Board is quiet";
      pill.className = "pill";
      pill.textContent = "no next game found";
      meta.innerHTML = (game ? 'Today: ' + CF.esc(game.name) + '. ' : '') + 'The next Bears game will appear here the moment it hits the schedule.';
      cd.innerHTML = "";
      return;
    }
    const date = new Date(g.date).getTime();
    title.textContent = (g.season ? g.season + " · " : "") + (g.home ? "Bears @ " + g.opp : "Bears vs " + g.opp);
    pill.className = "pill";
    pill.textContent = src === "live" ? "scheduled" : "snapshot";
    CF.$("#ng-away-abbr").textContent = g.home ? g.oppAbbr || g.opp.slice(0, 3) : "—";
    CF.$("#ng-away-score").textContent = "";
    CF.$("#ng-home-score").textContent = "";
    mid.innerHTML = (g.home ? "at " + CF.esc(g.opp) : "vs " + CF.esc(g.opp)) + "<br>" + CF.esc(g.venue || "Soldier Field");
    const bits = ["<b>" + CF.fmtDate(g.date) + "</b>", (CF.fmtTime(g.date) || "TBD")];
    if (g.tv) bits.push("TV: <b>" + CF.esc(g.tv) + "</b>");
    meta.innerHTML = bits.join(" · ");

    if (CF.applyGamedayMode && g.date) {
      const hours = (new Date(g.date).getTime() - Date.now()) / 3600e3;
      CF.applyGamedayMode(hours <= 30 && hours > -6, hours <= 0 ? "live" : "gameday");
    }
    if (CF.paintKickoffBanner) CF.paintKickoffBanner(g);

    // Countdown.
    const render = () => {
      const diff = Math.max(0, date - Date.now());
      const d = Math.floor(diff / 86400e3);
      const h = Math.floor((diff % 86400e3) / 3600e3);
      const m = Math.floor((diff % 3600e3) / 60e3);
      const s = Math.floor((diff % 60e3) / 1e3);
      cd.innerHTML =
        unit(d, "days") + unit(h, "hours") + unit(m, "min") + unit(s, "sec");
    };
    render();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(render, 1000);
    function unit(v, lbl) {
      return '<div class="unit"><b>' + v + "</b><span>" + lbl + "</span></div>";
    }
  }

  /* ---------- division standings ----------
     ESPN standings → (preseason: the endpoint is an empty stub) a table
     derived from completed games in the season window, clearly labeled. */
  async function loadStandings() {
    const pill = CF.$("#div-pill");
    const body = CF.$("#div-table tbody");
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
        if (div && div.rows.length) label = "preseason · from games played";
      } catch (e2) { /* try the independent wire */ }
    }
    if (!div && CF.API.tsdbKey()) {
      try {
        div = await CF.API.tsdbStandings();
        if (div && div.rows.length) label = "preseason · TheSportsDB wire";
      } catch (e3) { /* fall through to offline */ }
    }
    if (!div || !div.rows.length) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="4" class="dim">Standings unavailable — check back when the feed answers. NFC North will refill from the live table or completed games.</td></tr>';
      paintRaceBars([], CF.$("#div-race"));
      return;
    }
    pill.className = "pill ok";
    pill.textContent = label;
    body.innerHTML = div.rows.map((row) =>
      '<tr class="' + (row.isMe ? "me" : "") + '">' +
      '<td class="strong">' + CF.esc(row.abbr) + " · " + CF.esc(row.name.replace(row.abbr + " ", "")) + "</td>" +
      '<td class="num">' + CF.esc(row.w != null ? row.w : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.l != null ? row.l : "—") + "</td>" +
      '<td class="num">' + (row.pct != null ? Number(row.pct).toFixed(3).replace(/^0/, "") : "—") + "</td>" +
      "</tr>"
    ).join("");
    paintRaceBars(div.rows, CF.$("#div-race"));
  }

  /* Win-bar race from the same standings rows — no invented numbers. */
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

  /* ---------- news (top 4) ---------- */
  function newsItemHTML(n) {
    const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
    const img = n.images && n.images[0] ? n.images[0].url : null;
    const thumb = img
      ? '<img class="thumb" loading="lazy" src="' + CF.esc(img) + '" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'thumb-fallback\',textContent:\'❄\'}))">'
      : '<div class="thumb-fallback">❄</div>';
    return '<div class="news-item"><div>' +
      '<a class="headline" href="' + CF.esc(href) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "Bears wire") + "</a>" +
      '<div class="meta"><span>' + CF.esc((n.authors && n.authors[0] && n.authors[0].name) || "The Wire") + "</span><span>" + CF.timeAgo(n.published) + "</span></div>" +
      "</div>" + thumb + "</div>";
  }

  function wideItemHTML(it) {
    return '<div class="news-item"><div>' +
      '<a class="headline" href="' + CF.esc(it.link) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
      '<div class="meta"><span>' + CF.esc(it.source || "the wide wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
      '</div><div class="thumb-fallback">❄</div></div>';
  }

  async function loadNews() {
    const box = CF.$("#home-news");
    const pill = CF.$("#wire-pill");
    // 1) ESPN league wire first (it's quiet in the offseason, though…).
    try {
      const news = await CF.API.getNews();
      const items = (news || []).slice(0, 4);
      if (items.length) {
        box.innerHTML = items.map(newsItemHTML).join("");
        box.setAttribute("aria-busy", "false");
        pill.textContent = "live feed";
        return;
      }
    } catch (e) { /* wire silent or unreachable */ }
    // 2) The wide wire: RSS across 100+ outlets (Google News, then Bing News).
    try {
      const items = await CF.API.getGoogleNews("Chicago Bears", 4);
      box.innerHTML = items.map(wideItemHTML).join("");
      box.setAttribute("aria-busy", "false");
      pill.textContent = "wide wire";
    } catch (e2) {
      pill.textContent = "offline";
      box.innerHTML = CF.emptyHTML({
        icon: "📡",
        title: "Wire is dark",
        sub: "Both feeds are down on this network and no snapshot is saved yet. Visit once while online and headlines cache locally.",
        action: '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.chicagobears.com/news" target="_blank" rel="noopener">Official Bears news →</a>',
      });
      box.setAttribute("aria-busy", "false");
    }
  }

  /* ---------- injury snapshot ----------
     Live league report (per-player status) → roster flags → community
     JSON as the last resort. */
  function injRowHTML(row) {
    return '<tr><td class="strong">' + CF.esc(row.name) +
      (row.url ? ' <a href="' + CF.esc(row.url) + '" target="_blank" rel="noopener" title="Profile">↗</a>' : "") +
      "</td><td>" + CF.esc(row.pos || "—") + "</td><td>" + CF.esc(row.comment || row.injury || "—") +
      "</td><td><span class=\"st " + CF.esc(CF.injStatusCls(row.status)) + "\">" + CF.esc(row.status) + "</span></td></tr>";
  }

  async function paintHomeInjuryMove(rows) {
    const host = CF.$("#home-inj-movement");
    if (!host || !CF.diffInjuryMovement) return;
    try {
      const prior = await CF.loadInjuryPrior();
      const diff = CF.diffInjuryMovement(rows || [], prior && prior.rows);
      // Compact on home — skip quiet state to keep the snapshot lean.
      host.innerHTML = CF.injuryMovementHTML(diff, { maxNew: 3, maxUp: 2, maxRem: 2 });
    } catch (e) { host.innerHTML = ""; }
    if (rows && rows.length) CF.injSnapSet(rows);
  }

  async function loadInjuries() {
    const body = CF.$("#home-injuries tbody");
    let rows = [];
    try {
      const r = await CF.API.getLeagueInjuries();
      const x = CF.API.bearsInjuryRows(r.data);
      rows = x.rows.filter((row) => row.status && row.status.toLowerCase() !== "active");
    } catch (e) { /* league feed silent */ }
    if (!rows.length) {
      try {
        const r2 = await CF.API.getRoster();
        rows = CF.API.rosterInjuryRows(r2.data);
      } catch (e2) { /* roster silent too */ }
    }
    if (rows.length) {
      body.innerHTML = rows.slice(0, 3).map(injRowHTML).join("");
      await paintHomeInjuryMove(rows);
      return;
    }
    // Community-maintained JSON, last resort.
    try {
      const r = await fetch("data/injuries.json", { cache: "no-cache" });
      const data = await r.json();
      const local = (data.rows || []).slice(0, 3);
      body.innerHTML = local.length ? local.map((row) =>
        "<tr><td class=\"strong\">" + CF.esc(row.name) + "</td><td>" + CF.esc(row.pos) + "</td><td>" + CF.esc(row.injury) + "</td><td><span class=\"st " + CF.esc(row.statusCls || CF.injStatusCls(row.status)) + "\">" + CF.esc(row.status) + "</span></td></tr>"
      ).join("") : '<tr><td colspan="4" class="dim">Report is empty right now — all clear? Suspicious. Check back.</td></tr>';
      await paintHomeInjuryMove(data.rows || []);
    } catch (e3) {
      body.innerHTML = '<tr><td colspan="4" class="dim">Report unavailable.</td></tr>';
      const host = CF.$("#home-inj-movement");
      if (host) host.innerHTML = "";
    }
  }




  /* ---------- Sunday desk (next opp + rest + last meetings + wire/poly) ---------- */
  function formatDeskLineBits(line) {
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

  async function loadSundayDesk() {
    const root = CF.$("#sunday-desk");
    const pill = CF.$("#sunday-desk-pill");
    if (!root) return;
    let g = null, sched = null, src = "live";
    try {
      const sc = await CF.API.getSchedule();
      sched = sc.data;
      src = sc.source || "live";
      g = CF.API.nextBearsGameFromSchedule(sc.data);
    } catch (e) { /* schedule quiet */ }
    if (!g) {
      if (pill) { pill.textContent = "quiet"; pill.className = "tag"; }
      root.innerHTML =
        '<div class="pulse-empty dim">No next kickoff on the board yet. ' +
        '<a href="games.html">Games →</a></div>';
      return;
    }
    const matchup = (g.home ? "vs " : "@ ") + (g.opp || "opponent");
    const last = CF.API.lastMeetingVs(sched, g.oppAbbr);
    const rest = CF.API.restDaysBefore(sched, g.date);
    const hist = CF.API.meetingsVs ? CF.API.meetingsVs(sched, g.oppAbbr, 5) : [];

    let restBit = "—";
    let restSub = "Needs a prior completed game";
    if (rest && rest.days != null) {
      restBit = rest.days + (rest.days === 1 ? " day" : " days");
      restSub = "Since " + CF.fmtDate(rest.last.date) +
        (rest.last.oppAbbr ? (" vs " + rest.last.oppAbbr) : "");
    }

    let lastBit = "No prior";
    let lastSub = "vs " + (g.oppAbbr || "OPP");
    if (last) {
      const site = last.home ? "vs" : "@";
      const score = (last.scoreMe != null && last.scoreMe !== "" && last.scoreMe !== "–")
        ? (String(last.scoreMe) + "–" + String(last.scoreOpp))
        : "final";
      lastBit = site + " " + (last.oppAbbr || g.oppAbbr || "OPP");
      lastSub = CF.fmtDate(last.date) + " · " + score + (last.result ? " · " + last.result : "");
    }

    let histHTML = "";
    if (hist && hist.length) {
      histHTML =
        '<div class="desk-hist">' +
        hist.map((m) =>
          '<span class="wl-chip wl-' + m.wl.toLowerCase() + '" title="' +
          CF.esc(CF.fmtDate(m.date) + " · " + m.wl) + '">' + CF.esc(m.wl) + "</span>"
        ).join("") +
        "</div>";
    }

    let wireHTML = "";
    let polyHTML = "";
    let lineOk = false, polyOk = false;
    try {
      const r = await CF.API.getOdds();
      const line = CF.API.oddsForGame(r.data, g.id);
      const fmt = formatDeskLineBits(line);
      if (fmt) {
        lineOk = true;
        wireHTML =
          '<div class="desk-line">' +
          fmt.bits.map((b) =>
            '<span class="desk-chip"><span class="k">' + CF.esc(b.k) + "</span><b>" + CF.esc(b.v) + "</b></span>"
          ).join("") +
          '<span class="desk-book dim">' + CF.esc(fmt.book) + "</span></div>";
      }
    } catch (e) { /* quiet */ }
    try {
      const events = await CF.API.getPolymarket(60);
      const bears = CF.API.polymarketBears(events);
      let top = null;
      for (const ev of bears) {
        for (const m of (ev.markets || [])) {
          if (m.yes != null) { top = m; break; }
        }
        if (top) break;
      }
      if (top) {
        polyOk = true;
        polyHTML =
          '<div class="desk-poly-row">' +
          '<span class="desk-chip yes"><span class="k">YES</span><b>' + Math.round(top.yes * 100) + "¢</b></span>" +
          (top.no != null
            ? '<span class="desk-chip no"><span class="k">NO</span><b>' + Math.round(top.no * 100) + "¢</b></span>"
            : "") +
          '<a class="dim" href="' + CF.esc(top.url) + '" target="_blank" rel="noopener" title="' +
          CF.esc(top.question) + '">Polymarket ↗</a></div>';
      }
    } catch (e2) { /* quiet */ }

    if (pill) {
      const bits = [];
      bits.push(src === "live" ? "live sched" : "snapshot");
      if (lineOk) bits.push("wire");
      if (polyOk) bits.push("poly");
      if (g.home) bits.push("home wx");
      pill.textContent = bits.join(" · ");
      pill.className = "tag";
    }

    let wxHTML = "";
    if (g.home && CF.kickoffWeatherHTML) {
      try { wxHTML = await CF.kickoffWeatherHTML(true); } catch (e3) { wxHTML = ""; }
    }

    root.innerHTML =
      '<div class="desk-accent" aria-hidden="true"></div>' +
      '<div class="desk-head">' +
      '<div class="desk-kicker"><span class="k">Next kickoff</span></div>' +
      '<div class="desk-match">' + CF.esc(matchup) + "</div>" +
      '<div class="desk-when dim"><b>' + CF.esc(CF.fmtDate(g.date)) + "</b> · " +
      CF.esc(CF.fmtTime(g.date) || "TBD") +
      (g.tv ? " · TV " + CF.esc(g.tv) : "") +
      (g.home ? " · Home · Soldier Field" : " · Away") +
      "</div></div>" +
      (wxHTML || "") +
      '<div class="desk-grid">' +
      '<div class="matchup-stat"><span class="k">Rest</span><div class="v">' + CF.esc(restBit) +
      '</div><div class="s">' + CF.esc(restSub) + "</div></div>" +
      '<div class="matchup-stat"><span class="k">Last meeting</span><div class="v">' + CF.esc(lastBit) +
      '</div><div class="s">' + CF.esc(lastSub) + "</div></div>" +
      "</div>" +
      (histHTML
        ? '<div class="desk-hist-wrap"><span class="k">Recent vs ' + CF.esc(g.oppAbbr || "OPP") +
          "</span>" + histHTML + "</div>"
        : "") +
      (wireHTML || polyHTML
        ? '<div class="desk-markets">' +
          (wireHTML
            ? '<div class="desk-mkt"><span class="k">Wire line</span>' + wireHTML + "</div>"
            : "") +
          (polyHTML
            ? '<div class="desk-mkt"><span class="k">Polymarket</span>' + polyHTML + "</div>"
            : "") +
          "</div>"
        : '<div class="desk-markets"><div class="dim" style="font-size:13px">No wire line or Bears market right now · <a href="odds.html">Odds →</a></div></div>') +
      '<p class="src-note" style="margin-top:12px;margin-bottom:0"><a href="games.html#next-opp">Games Sunday desk →</a> · rest &amp; meetings from the season log</p>';
  }

  /* ---------- odds / Polymarket pulse (compact, near week clock) ---------- */
  function formatLineBits(line) {
    if (!line || !line.lines || !line.lines.length) return null;
    const l = line.lines[0];
    const bits = [];
    if (l.spread) {
      const h = (typeof l.spread === "object") ? (l.spread.home != null ? l.spread.home : l.spread.away) : l.spread;
      if (h != null) bits.push({ k: "Spread", v: String(h) });
    }
    if (l.total != null) bits.push({ k: "O/U", v: String(l.total) });
    if (l.ml) {
      const m = (typeof l.ml === "object") ? (l.ml.home != null ? l.ml.home : l.ml.away) : l.ml;
      if (m != null) bits.push({ k: "ML", v: String(m) });
    }
    return bits.length ? { book: l.book || "Wire", bits } : null;
  }

  async function loadOddsPulse() {
    const root = CF.$("#odds-pulse");
    const pill = CF.$("#odds-pulse-pill");
    if (!root) return;
    let gameLabel = "";
    let gameId = null;
    try {
      const sc = await CF.API.getSchedule();
      const ng = CF.API.nextBearsGameFromSchedule(sc.data);
      if (ng) {
        gameId = ng.id;
        gameLabel = (ng.home ? "vs " : "@ ") + (ng.oppAbbr || ng.opp) + " · " + CF.fmtDate(ng.date);
      }
    } catch (e) { /* schedule quiet */ }

    let wireHTML = "";
    let wireOk = false;
    try {
      const r = await CF.API.getOdds();
      const line = CF.API.oddsForGame(r.data, gameId);
      const fmt = formatLineBits(line);
      if (fmt) {
        wireOk = true;
        wireHTML =
          '<div class="pulse-block">' +
          '<div class="pulse-label">Wire line' + (gameLabel ? ' · ' + CF.esc(gameLabel) : "") + "</div>" +
          '<div class="pulse-chips">' +
          fmt.bits.map((b) => '<span class="pulse-chip"><span class="k">' + CF.esc(b.k) + '</span><b>' + CF.esc(b.v) + "</b></span>").join("") +
          "</div>" +
          '<div class="pulse-sub">' + CF.esc(fmt.book) + ' · <a href="odds.html">full board →</a></div>' +
          "</div>";
      }
    } catch (e) { /* odds quiet */ }

    let polyHTML = "";
    let polyOk = false;
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
        polyOk = true;
        const yes = Math.round(top.yes * 100);
        polyHTML =
          '<div class="pulse-block">' +
          '<div class="pulse-label">Polymarket pulse</div>' +
          '<div class="pulse-q">' + CF.esc(top.question) + "</div>" +
          '<div class="pulse-chips">' +
          '<span class="pulse-chip yes"><span class="k">YES</span><b>' + yes + "¢</b></span>" +
          (top.no != null ? '<span class="pulse-chip no"><span class="k">NO</span><b>' + Math.round(top.no * 100) + "¢</b></span>" : "") +
          "</div>" +
          '<div class="pulse-sub"><a href="' + CF.esc(top.url) + '" target="_blank" rel="noopener">market ↗</a> · <a href="odds.html">more →</a></div>' +
          "</div>";
      }
    } catch (e2) { /* poly quiet */ }

    if (!wireOk && !polyOk) {
      if (pill) { pill.textContent = "quiet"; pill.className = "tag"; }
      root.innerHTML =
        '<div class="pulse-empty dim">No live line or Bears market right now' +
        (gameLabel ? " (next: " + CF.esc(gameLabel) + ")" : "") +
        '. <a href="odds.html">Odds board →</a></div>';
      return;
    }
    if (pill) {
      pill.textContent = (wireOk && polyOk) ? "wire + poly" : (wireOk ? "wire" : "polymarket");
      pill.className = "tag";
    }
    root.innerHTML = wireHTML + polyHTML;
  }

  /* ---------- week clock (practice → media → gameday → film) ---------- */
  function weekPhaseFromGame(game, schedGame) {
    const g = (game && (game.home || game.away) && (game.home.abbr === "CHI" || game.away.abbr === "CHI"))
      ? game
      : schedGame;
    if (!g || !g.date) {
      return {
        active: "practice",
        note: "Schedule is quiet — Midweek default. Practice notes and the wire stay warm until the next kickoff lands.",
        pill: "fallback",
      };
    }
    const kick = new Date(g.date).getTime();
    if (isNaN(kick)) {
      return { active: "practice", note: "Kickoff time unclear — showing the Midweek practice beat.", pill: "fallback" };
    }
    const hours = (kick - Date.now()) / 3600e3;
    const when = CF.fmtDate(g.date) + (CF.fmtTime(g.date) ? " · " + CF.fmtTime(g.date) : "");
    const opp = g.opp || (g.away && g.home ? ((g.home.abbr === "CHI" ? g.away.abbr : g.home.abbr)) : "opponent");
    if (game && game.state === "in") {
      return { active: "gameday", note: "<b>Live now</b> — board is the beat. " + CF.esc(when), pill: "live" };
    }
    if (game && game.state === "post" && hours > -60) {
      return { active: "film", note: "<b>Final in the books</b> — film &amp; numbers until the next week starts. " + CF.esc(when), pill: "film" };
    }
    if (hours <= 30) {
      return { active: "gameday", note: "<b>Gameday window</b> vs " + CF.esc(String(opp)) + " — " + CF.esc(when), pill: "gameday" };
    }
    if (hours <= 72) {
      return { active: "media", note: "<b>Media week</b> — pressers &amp; the wire before " + CF.esc(when), pill: "media" };
    }
    if (hours <= 120) {
      return { active: "practice", note: "<b>Practice week</b> toward " + CF.esc(String(opp)) + " · " + CF.esc(when), pill: "practice" };
    }
    return { active: "practice", note: "Next up: <b>" + CF.esc(String(opp)) + "</b> · " + CF.esc(when) + " — facility days first.", pill: "practice" };
  }

  function paintWeekClock(phase) {
    const root = CF.$("#week-clock");
    const note = CF.$("#week-clock-note");
    const pill = CF.$("#week-clock-pill");
    if (!root) return;
    const deep = {
      practice: "practice.html#tracker",
      media: "news.html#news-list",
      gameday: "games.html#board",
      film: "stats.html#lastbox",
    };
    CF.$$(".week-clock-phase", root).forEach((el) => {
      const key = el.getAttribute("data-phase");
      const on = key === phase.active;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-current", on ? "step" : "false");
      if (deep[key]) el.setAttribute("href", deep[key]);
    });
    if (note) note.innerHTML = phase.note;
    if (pill) {
      pill.textContent = phase.pill || "week";
      pill.className = "tag" + (phase.pill === "live" ? " live" : "");
    }
    if (CF.applyGamedayMode) {
      const hot = phase.active === "gameday" || phase.pill === "live";
      CF.applyGamedayMode(hot, phase.pill === "live" ? "live" : (hot ? "gameday" : ""));
    }
  }

  async function loadWeekClock() {
    let game = null, schedGame = null;
    try {
      const sb = await CF.API.getScoreboard();
      game = CF.API.bearsGameFromScoreboard(sb.data);
    } catch (e) { /* board quiet */ }
    try {
      const sc = await CF.API.getSchedule();
      schedGame = CF.API.nextBearsGameFromSchedule(sc.data);
    } catch (e2) { /* schedule quiet */ }
    paintWeekClock(weekPhaseFromGame(game, schedGame));
  }



  /* ---------- film-room teaser (after a final) ----------
     Compact last-box leaders when a completed Bears game is fresh —
     deep-links to stats last-box + games. Hidden when nothing final. */
  function filmLeaderCell(l) {
    return CF.esc(l.player) +
      (l.pos || l.teamAbbr
        ? ' <span class="dim">' + CF.esc([l.pos, l.teamAbbr].filter(Boolean).join(" · ")) + "</span>"
        : "");
  }

  async function loadFilmRoom() {
    const root = CF.$("#film-room");
    const pill = CF.$("#film-room-pill");
    const section = CF.$("#film-room-section");
    if (!root) return;
    let last = null;
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      const now = Date.now();
      last = rows
        .filter((g) => new Date(g.date).getTime() < now - 3 * 3600e3 && g.scoreMe != null && g.scoreOpp != null)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    } catch (e) { /* schedule quiet */ }
    if (!last) {
      if (section) section.hidden = true;
      root.innerHTML = "";
      if (pill) { pill.textContent = "quiet"; pill.className = "tag"; }
      return;
    }
    // Keep teaser warm for ~5 days after the final — otherwise hide.
    const ageH = (Date.now() - new Date(last.date).getTime()) / 3600e3;
    if (ageH > 120) {
      if (section) section.hidden = true;
      root.innerHTML = "";
      if (pill) { pill.textContent = "archived"; pill.className = "tag"; }
      return;
    }
    try {
      const ev = await CF.API.bearsGameEvent(last.id);
      const c = (ev.competitions || [])[0] || {};
      const leaders = (CF.API.eventLeaders(ev) || []).slice(0, 4);
      const site = last.home ? "vs" : "@";
      const score = String(last.scoreMe) + "–" + String(last.scoreOpp);
      const result = last.result || ((Number(last.scoreMe) > Number(last.scoreOpp)) ? "W" : "L");
      if (section) section.hidden = false;
      if (pill) {
        pill.textContent = "last final";
        pill.className = "tag";
      }
      root.innerHTML =
        '<div class="film-room-card">' +
        '<div class="film-room-head">' +
        '<div class="film-kicker"><span class="k">Film room</span></div>' +
        '<div class="film-match"><b>' + CF.esc(result) + "</b> " +
        CF.esc(site) + " " + CF.esc(last.oppAbbr || last.opp || "OPP") +
        ' <span class="dim">' + CF.esc(score) + " · " + CF.esc(CF.fmtDate(last.date)) + "</span></div>" +
        "</div>" +
        (leaders.length
          ? '<div class="film-leaders" role="list">' +
            leaders.map((l) =>
              '<div class="film-leader" role="listitem">' +
              '<span class="k">' + CF.esc(l.label) + "</span>" +
              '<span class="film-who">' + filmLeaderCell(l) + "</span>" +
              '<span class="film-line">' + CF.esc(l.display) + "</span></div>"
            ).join("") +
            "</div>"
          : '<p class="dim" style="margin:8px 0 0;font-size:13px">Leaders quiet on the wire — score still stands.</p>') +
        '<div class="film-actions">' +
        '<a class="btn small" href="stats.html#lastbox">Full last box →</a>' +
        '<a class="btn small" href="games.html">Games log →</a>' +
        '<a class="btn small" href="stats.html">Stats →</a>' +
        "</div></div>";
    } catch (e2) {
      if (section) section.hidden = true;
      root.innerHTML = "";
      if (pill) { pill.textContent = "feed quiet"; pill.className = "tag"; }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadNextGame();
    loadStandings();
    loadNews();
    loadInjuries();
    loadWeekClock();
    loadOddsPulse();
    loadSundayDesk();
    loadFilmRoom();
    // Keep the home page moving for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadNextGame, 30e3);              // next game + live clock: 30 s
    CF.refresh.register(loadStandings, 60e3);            // NFC North: 60 s
    CF.refresh.register(loadNews, 60e3);                 // headlines: 60 s
    CF.refresh.register(loadInjuries, 5 * 60e3, { name: "injuries" }); // local report (repo JSON): 5 min
    CF.refresh.register(loadWeekClock, 60e3, { name: "week-clock" });
    CF.refresh.register(loadOddsPulse, 60e3, { name: "odds-pulse" });
    CF.refresh.register(loadSundayDesk, 60e3, { name: "sunday-desk" });
    CF.refresh.register(loadFilmRoom, 2 * 60e3, { name: "film-room" });
  });
})();
