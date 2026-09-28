/* The Cold Front — live fan headquarters. */
"use strict";
(function () {
  let countdown = 0, predictionGame = null, predictionOppAbbr = "OPP";
  let stndEntered = false; // v1.41.0 — .cf-enter on the standings only at first paint; the 5-minute refresh re-renders stay instant
  const show = (selector, text) => { CF.$(selector).textContent = text; };

  async function loadMatchup() {
    const [board, schedule] = await Promise.allSettled([CF.API.getScoreboard(), CF.API.getSchedule()]);
    let game = board.status === "fulfilled" ? CF.API.bearsGameFromScoreboard(board.value.data) : null;
    let source = game ? board.value.source : null;
    if (schedule.status === "fulfilled") {
      renderSeason(schedule.value);
      if (!game) {
        const next = CF.API.nextBearsGameFromSchedule(schedule.value.data);
        game = next?.game;
        source = schedule.value.source;
      }
    }
    clearInterval(countdown);
    const card = CF.$("#next-game");
    /* v1.37.0 — reset the hero card's Bears identity and result state on each paint. */
    card.classList.remove("final", "bears-won");
    card.querySelectorAll(".side").forEach((s) => s.classList.remove("is-bears", "winner", "loser"));
    /* v1.62.0 — the frost-skeleton first paint announces via #ng-skel-status;
       remove it once the card paints real content (or the quiet state). */
    CF.$("#ng-skel-status")?.remove();
    if (!game) {
      show("#ng-title", "Waiting for the next Bears matchup");
      show("#ng-pill", schedule.status === "fulfilled" ? "Schedule quiet" : "Feed unavailable");
      show("#ng-meta", "The official schedule is one click away in the game center.");
      show("#ng-countdown", "");
      CF.$("#prediction-toggle").disabled = true;
      return;
    }
    if (CF.paintKickoffBanner) CF.paintKickoffBanner({ id: game.id, date: game.date,
      home: game.home.abbr === "CHI", oppAbbr: game.home.abbr === "CHI" ? game.away.abbr : game.home.abbr });
    const status = game.state === "in" ? "Live now" : game.state === "post" ? "Final" : "Next kickoff";
    show("#ng-title", game.name);
    show("#ng-away-abbr", game.away.abbr);
    show("#ng-home-abbr", game.home.abbr);
    /* v1.37.0 — the orange identity follows the Bears, not the home team. */
    const bearsHome37 = game.home.abbr === "CHI";
    const bearSide37 = CF.$("#ng-" + (bearsHome37 ? "home" : "away") + "-abbr").closest(".side");
    const oppSide37 = CF.$("#ng-" + (bearsHome37 ? "away" : "home") + "-abbr").closest(".side");
    if (bearSide37) bearSide37.classList.add("is-bears");
    /* v1.37.0 — finals carry the family winner treatment on the hero card. */
    const num37 = (v) => (v == null || v === "" ? NaN : Number(v));
    const bs37 = num37(bearsHome37 ? game.home.score : game.away.score);
    const os37 = num37(bearsHome37 ? game.away.score : game.home.score);
    const cachedSuffix = source !== "live" ? " · cached" : "";
    let pillCls37 = "pill" + (game.state === "in" ? " live" : "");
    let pillText37 = status + cachedSuffix;
    if (game.state === "post" && Number.isFinite(bs37) && Number.isFinite(os37)) {
      card.classList.add("final");
      if (bs37 > os37) {
        if (bearSide37) bearSide37.classList.add("winner");
        if (oppSide37) oppSide37.classList.add("loser");
        card.classList.add("bears-won");
        pillCls37 += " won";
        pillText37 = "BEARS WIN · Final" + cachedSuffix;
      } else if (bs37 < os37) {
        if (bearSide37) bearSide37.classList.add("loser");
        if (oppSide37) oppSide37.classList.add("winner");
      }
    }
    show("#ng-pill", pillText37);
    CF.$("#ng-pill").className = pillCls37;
    for (const side of ["home", "away"]) show("#ng-" + side + "-score", game.state === "pre" ? "" : (game[side].score ?? "—"));
    show("#ng-mid", game.venue);
    show("#ng-meta", CF.fmtDate(game.date) + " · " + (game.timeValid ? CF.fmtTime(game.date) : "Time TBD") + (game.tv ? " · " + game.tv : ""));
    CF.$("#game-detail-link").href = "games.html?date=" + CF.dateInput(game.date) + "&game=" + encodeURIComponent(game.id) + "#boxscore";
    CF.$("#prediction-toggle").disabled = game.state !== "pre";
    if (predictionGame?.id !== game.id) {
      predictionGame = game;
      const opponent = game.home.abbr === "CHI" ? game.away.abbr : game.home.abbr;
      predictionOppAbbr = opponent;
      show("#prediction-opponent-name", opponent);
      show("#prediction-opponent-abbr", opponent);
      let saved;
      try { saved = JSON.parse(localStorage.getItem("cf.pick." + game.id) || "null"); } catch (_) { /* optional preference */ }
      if (saved) {
        CF.$("#prediction-bears").value = saved.bears;
        CF.$("#prediction-other").value = saved.other;
        show("#prediction-status", "Your pick: CHI " + saved.bears + " · " + opponent + " " + saved.other + ". Saved on this device.");
        updatePredictionDiff();
      }
    }
    let lastCountdown = null;
    const renderCountdown = () => {
      const remaining = Math.max(0, Date.parse(game.date) - Date.now());
      if (!remaining) { show("#ng-countdown", "Kickoff time — waiting for the live board"); clearInterval(countdown); return; }
      const values = [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60];
      // v1.13.0 — tick the changed day/hour/minute units with a gentle pop.
      CF.$("#ng-countdown").innerHTML = values.map((n, i) =>
        '<div class="unit' + (i < 3 && lastCountdown && lastCountdown[i] !== n ? " tick" : "") + '"><b>' +
        String(n).padStart(2, "0") + '</b><span>' + ["days", "hours", "min", "sec"][i] + "</span></div>").join("");
      lastCountdown = values;
    };
    if (game.state === "pre" && game.timeValid) { renderCountdown(); countdown = setInterval(renderCountdown, 1000); }
    else show("#ng-countdown", game.state === "in" ? game.display : "");
  }

  function renderSeason(result) {
    const games = CF.API.scheduleList(result.data).filter((game) => game.completed && game.scoreMe != null && game.scoreOpp != null);
    let wins = 0, losses = 0, ties = 0, points = 0, allowed = 0;
    for (const game of games) {
      const a = Number(game.scoreMe), b = Number(game.scoreOpp);
      points += a; allowed += b;
      if (a > b) wins++; else if (a < b) losses++; else ties++;
    }
    CF.countUp("#season-record", [wins, losses].concat(ties ? [ties] : []).map((n) => ({ n })), "–");
    if (games.length) {
      CF.countUp("#season-points", [{ n: points / games.length, decimals: 1 }], "");
      CF.countUp("#season-diff", [{ n: points - allowed, signed: true }], "");
    }
    show("#season-name", (result.data.season?.displayName || "Current season") + " · " + CF.sourceLabel(result.source));
  }

  async function loadStandings() {
    try {
      const result = await CF.API.getStandings();
      const division = CF.API.divisionTable(result.data);
      if (!division?.rows.length) throw new Error("No division data");
      show("#div-pill", CF.sourceLabel(result.source));
      paintRaceBars(division.rows, CF.$("#div-race"));
      /* v1.41.0 — standings glow-up: Bears row carries the 🐻 identity chip,
         the division leader carries a 👑 DIV LEAD chip (glowing when it's us),
         Pct reads in display numerals. */
      CF.$("#div-table tbody").innerHTML = division.rows.map((row, i) =>
        '<tr class="stnd-row' + (row.isMe ? " stnd-me" : "") + '">' +
        '<td class="strong stnd-team">' +
        (row.isMe ? '<span class="stnd-bear" aria-hidden="true">🐻</span>' : "") +
        CF.esc(row.name) +
        (i === 0 ? ' <span class="stnd-crown' + (row.isMe ? " hot" : "") + '">👑 DIV LEAD</span>' : "") +
        "</td>" +
        '<td class="num">' + row.w + '</td><td class="num">' + row.l + '</td>' +
        '<td class="num stnd-pct">' + Number(row.pct).toFixed(3).replace(/^0/, "") + "</td></tr>"
      ).join("");
      CF.$("#div-table").classList.add("stnd");
      const stndWrap = CF.$("#division .tbl-wrap");
      if (stndWrap) {
        stndWrap.classList.add("stnd");
        if (!stndEntered) {
          stndWrap.classList.add("cf-enter");
          CF.$("#div-race").classList.add("stnd", "cf-enter");
          stndEntered = true;
        }
      }
    } catch (_) {
      show("#div-pill", "Unavailable");
      CF.$("#div-table tbody").innerHTML = '<tr><td colspan="4" class="dim">Standings are temporarily unavailable. <a href="https://www.espn.com/nfl/standings" target="_blank" rel="noopener">ESPN standings ↗</a></td></tr>';
    }
  }

  async function loadNorth() {
    try {
      const result = await CF.API.getWeekScoreboard();
      const games = (result.data.events || []).map(CF.API.gameFromEvent).filter((game) => [game.home.abbr, game.away.abbr].some((team) => ["CHI", "DET", "GB", "MIN"].includes(team)));
      show("#north-pill", CF.sourceLabel(result.source));
      CF.$("#north-games").innerHTML = games.length ? games.map((game) => {
        const ours = [game.home.abbr, game.away.abbr].includes("CHI");
        // v1.30.0 — final-result treatment for our game: a Bears win warms the
        // score, a Bears loss recedes the row (mirroring the game cards).
        let resultCls = "";
        if (ours && game.state === "post" && game.home.score != null && game.away.score != null) {
          const bears = game.home.abbr === "CHI" ? Number(game.home.score) : Number(game.away.score);
          const opp = game.home.abbr === "CHI" ? Number(game.away.score) : Number(game.home.score);
          if (Number.isFinite(bears) && Number.isFinite(opp)) resultCls = bears > opp ? "bears-win" : (bears < opp ? "bears-loss" : "");
        }
        const chip = ours ? '<span class="our-chip">🐻 Our game</span>' : "";
        return '<a class="mini-game ' + (ours ? ("our-game " + resultCls).trim() : '') + '" href="games.html?date=' + CF.dateInput(game.date) + '"><div><strong>' + CF.esc(game.away.abbr + " @ " + game.home.abbr) + '</strong><span>' + CF.esc(CF.fmtDate(game.date) + " · " + (game.timeValid ? CF.fmtTime(game.date) : "Time TBD")) + '</span>' + chip + '</div><div class="mini-status"><strong>' + (game.state === "pre" ? '↗' : CF.esc((game.away.score ?? "—") + ' – ' + (game.home.score ?? "—"))) + '</strong><span>' + CF.esc(game.state === "pre" ? (game.tv || "Scheduled") : game.display) + '</span></div></a>';
      }).join("") : '<div class="empty">No NFC North games in this week’s feed. <a href="games.html">Explore the schedule ↗</a></div>';
    } catch (_) {
      show("#north-pill", "Unavailable");
      CF.$("#north-games").innerHTML = '<div class="empty">The weekly slate is temporarily unavailable. <a href="games.html">Open the game center ↗</a></div>';
    }
  }

  function story(item) {
    const title = item.heading || item.title || "Bears news";
    const url = CF.safeURL(item.links?.web?.href || item.link, "https://www.chicagobears.com/news");
    const photo = CF.safeURL(item.images?.[0]?.url, "img/soldier-field.webp");
    return '<a class="story-card" href="' + CF.esc(url) + '" target="_blank" rel="noopener"><span class="story-art"><img class="story-image" loading="lazy" src="' + CF.esc(photo) + '" alt="" onerror="this.onerror=null;this.src=\'img/soldier-field.webp\'"></span><div class="story-copy"><span class="story-source">' + CF.esc(item.source || "ESPN · Bears wire") + '</span><h3>' + CF.esc(title) + '</h3><div class="story-end"><span>' + CF.esc(CF.timeAgo(item.published || item.date)) + '</span><span aria-hidden="true">Read story ↗</span></div></div></a>';
  }
  function tickerGroup(items, hidden) {
    return '<span class="wt-group"' + (hidden ? ' aria-hidden="true"' : "") + ">" + items.map((item) => {
      const title = item.heading || item.title || "Bears news";
      const url = CF.safeURL(item.links?.web?.href || item.link, "https://www.chicagobears.com/news");
      return '<a class="wt-item" href="' + CF.esc(url) + '" target="_blank" rel="noopener"' + (hidden ? ' tabindex="-1"' : "") + '><span class="wt-src">' + CF.esc(item.source || "Wire") + "</span>" + CF.esc(title) + '</a><span class="wt-sep" aria-hidden="true">❄</span>';
    }).join("") + "</span>";
  }
  function paintTicker(items) {
    const track = CF.$("#wire-ticker-track");
    if (!track || !items.length) return;
    const slice = items.slice(0, 8);
    track.innerHTML = tickerGroup(slice, false) + tickerGroup(slice, true);
  }
  async function loadNews() {
    try {
      const items = await CF.API.getNews();
      if (!items.length) throw new Error("No news");
      CF.$("#home-news").innerHTML = items.slice(0, 4).map(story).join("");
      paintTicker(items);
      show("#wire-pill", CF.sourceLabel(CF.API.newsSource?.source) + " · ESPN");
    } catch (_) {
      try {
        const items = await CF.API.getGoogleNews("Chicago Bears", 4);
        CF.$("#home-news").innerHTML = items.map(story).join("");
        paintTicker(items);
        show("#wire-pill", CF.API.rssSource === "cache" ? "Cached wire" : "Across the wire");
      } catch (_) {
        show("#wire-pill", "Feed unavailable");
        const ticker = CF.$("#wire-ticker");
        if (ticker) ticker.hidden = true;
        CF.$("#home-news").innerHTML = '<div class="empty">The wire is temporarily quiet. <a href="https://www.chicagobears.com/news" target="_blank" rel="noopener">Read the latest on Bears.com ↗</a></div>';
      }
    }
  }

  async function loadInjuries() {
    try {
      const result = await CF.API.getLeagueInjuries();
      const report = CF.API.bearsInjuryRows(result.data);
      if (!report.found) throw new Error("No Bears report");
      const rows = report.rows.filter((row) => row.status?.toLowerCase() !== "active");
      show("#inj-home-pill", CF.sourceLabel(result.source) + " · league report");
      if (result.source === "live") await paintHomeInjuryMove(rows);
      CF.$("#home-injuries tbody").innerHTML = rows.length ? rows.slice(0, 4).map((row) => { const sev = CF.injStatusCls(row.status); return '<tr class="inj-sev-' + sev + '"><td class="strong">' + CF.esc(row.name) + '</td><td>' + CF.esc(row.pos) + '</td><td>' + CF.esc(row.comment || "No additional detail") + '</td><td><span class="st ' + sev + '">' + CF.esc(row.status) + '</span></td></tr>'; }).join("") : '<tr><td colspan="4" class="dim">No players listed in the current feed. Check the official report before kickoff.</td></tr>';
    } catch (_) {
      show("#inj-home-pill", "Report unavailable");
      CF.$("#home-injuries tbody").innerHTML = '<tr><td colspan="4" class="dim">The league report did not answer. <a href="injuries.html">Check roster flags and the full report ↗</a></td></tr>';
    }
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

  /* ---------- news (top 4) ---------- */
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
          '<span class="desk-chip yes"><span class="k">' + CF.esc(top.yesLabel || "Yes") + '</span><b>' + Math.round(top.yes * 100) + "¢</b></span>" +
          (top.no != null
            ? '<span class="desk-chip no"><span class="k">' + CF.esc(top.noLabel || "No") + '</span><b>' + Math.round(top.no * 100) + "¢</b></span>"
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
          '<span class="pulse-chip yes"><span class="k">' + CF.esc(top.yesLabel || "Yes") + '</span><b>' + yes + "¢</b></span>" +
          (top.no != null ? '<span class="pulse-chip no"><span class="k">' + CF.esc(top.noLabel || "No") + '</span><b>' + Math.round(top.no * 100) + "¢</b></span>" : "") +
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
      const leaders = (CF.API.eventLeaders(ev) || []).filter((leader) => leader.teamAbbr === "CHI").slice(0, 4);
      const site = last.home ? "vs" : "@";
      const score = String(last.scoreMe) + "–" + String(last.scoreOpp);
      const result = CF.API.meetingResult(last) || "Final";
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
    for (const [fn, interval] of [[loadMatchup,30000],[loadStandings,300000],[loadNorth,60000],[loadNews,300000],[loadInjuries,300000],[loadWeekClock,60000],[loadOddsPulse,60000],[loadSundayDesk,60000],[loadFilmRoom,120000]]) {
      fn(); CF.refresh.register(fn, interval);
    }
    CF.$("#prediction-toggle").addEventListener("click", () => {
      const form = CF.$("#prediction-form");
      form.hidden = !form.hidden;
      CF.$("#prediction-toggle").setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) { updatePredictionDiff(); CF.$("#prediction-bears").focus(); }
    });
    // v1.58.0 — the live differential chip answers every keystroke.
    const updatePredictionDiff = () => {
      const diff = CF.$("#prediction-diff");
      if (!diff) return;
      const rawB = CF.$("#prediction-bears").value.trim(), rawO = CF.$("#prediction-other").value.trim();
      const bears = Number(rawB), other = Number(rawO);
      const ok = (raw, v) => raw !== "" && Number.isInteger(v) && v >= 0 && v <= 99;
      diff.className = "prediction-diff";
      if (!ok(rawB, bears) || !ok(rawO, other)) { diff.textContent = ""; return; }
      if (bears > other) { diff.textContent = "BEARS BY " + (bears - other); diff.classList.add("is-bears"); }
      else if (other > bears) { diff.textContent = predictionOppAbbr + " BY " + (other - bears); diff.classList.add("is-opp"); }
      else { diff.textContent = "DEAD EVEN"; diff.classList.add("is-tie"); }
    };
    for (const id of ["#prediction-bears", "#prediction-other"]) {
      CF.$(id).addEventListener("input", updatePredictionDiff);
    }
    CF.$("#prediction-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!predictionGame || !event.target.reportValidity()) return;
      const bears = Number(CF.$("#prediction-bears").value), other = Number(CF.$("#prediction-other").value);
      const opponent = predictionGame.home.abbr === "CHI" ? predictionGame.away.abbr : predictionGame.home.abbr;
      let stored = false;
      try { localStorage.setItem("cf.pick." + predictionGame.id, JSON.stringify({ bears, other })); stored = true; } catch (_) { /* storage unavailable */ }
      show("#prediction-status", "Your pick: CHI " + bears + " · " + opponent + " " + other + (stored ? ". Saved on this device." : ". Storage is unavailable; your pick lasts for this visit."));
    });
  });
})();
