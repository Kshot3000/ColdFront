/* THE COLD FRONT — stats: season pulse, leaders, last game box score */
"use strict";

(function () {
  const STAT_LABELS = {
    passYds: "Pass Yds", rushYds: "Rush Yds", recYds: "Rec Yds", rec: "Rec", targets: "Tgt",
    passComp: "Cmp", passAtt: "Att", passTd: "Pass TD", rushTd: "Rush TD", recTd: "Rec TD",
    fumble: "Fum", int: "INT", totTackle: "Tot Tkl", soloTackle: "Solo", astTackle: "Ast",
    sack: "Sacks", passDef: "PD", fumRec: "FR", xpr: "XP", fgMade: "FG",
  };
  const statLabel = (n) => STAT_LABELS[n] || String(n).replace(/([A-Z])/g, " $1").trim();

  /* v1.65.0 — the box-score leaders read as one undifferentiated list: both
     teams' rows interleaved (value-sorted) with repeated category labels and
     no way to see whose was whose. Leaders now render in team blocks — Bears
     first on this fan site — each in its own <tbody> under a divider row
     (<th scope="rowgroup"> so screen readers announce the team). A single
     team, or rows with no team, keeps the old flat render. */
  function divRowHTML(abbr, names) {
    const isMe = abbr === "CHI";
    const label = (names && names[abbr]) || abbr;
    return '<tr class="ld-div' + (isMe ? " me" : "") + '"><th colspan="3" scope="rowgroup">' +
      '<span class="ld-div-name">' + (isMe ? '<span aria-hidden="true">🐻</span> ' : "") +
      CF.esc(label) + ' <span class="ld-div-abbr">' + CF.esc(abbr) + "</span></span></th></tr>";
  }
  function leadersTableHTML(leaders, names, entered) {
    const rowHTML = (l) =>
      '<tr class="ld-row">' + leaderCatCell(l) +
      '<td class="ld-leader">' + leaderCell(l) + "</td>" +
      '<td class="num ld-line">' + CF.esc(l.display) + "</td></tr>";
    const abbr = (l) => (l.teamAbbr || "").toUpperCase();
    const order = [];
    leaders.forEach((l) => { const a = abbr(l); if (a && !order.includes(a)) order.push(a); });
    order.sort((a, b) => (a === "CHI" ? -1 : b === "CHI" ? 1 : 0));
    const blocks = order
      .map((a) => ({ abbr: a, rows: leaders.filter((l) => abbr(l) === a) }))
      .filter((b) => b.rows.length);
    const stray = leaders.filter((l) => !abbr(l));
    let body;
    if (blocks.length >= 2) {
      body = blocks.map((b) =>
        "<tbody>" + divRowHTML(b.abbr, names) + b.rows.map(rowHTML).join("") + "</tbody>"
      ).join("");
      if (stray.length) body += "<tbody>" + stray.map(rowHTML).join("") + "</tbody>";
    } else {
      body = "<tbody>" + leaders.map(rowHTML).join("") + "</tbody>";
    }
    return '<div class="tbl-wrap ld' + (entered ? " cf-enter" : "") + '">' +
      '<table class="tbl ld"><caption class="sr-only">Last game leaders by team</caption>' +
      '<thead><tr><th scope="col">Category</th><th scope="col">Leader</th><th scope="col" class="num">Line</th></tr></thead>' +
      body + "</table></div>";
  }

  /* ---------- season pulse from the schedule ---------- */
  let pulseEntered = false; // .cf-enter only on first paint; refresh re-renders stay instant

  async function loadPulse() {
    const pill = CF.$("#pulse-pill");
    const tiles = CF.$("#pulse");
    let cells = [
      ["—", "Record", ""], ["—", "Points / game", ""], ["—", "Allowed / game", ""], ["—", "Differential", ""],
    ];
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      const played = rows.filter((g) => g.scoreMe != null);
      let pf = 0, pa = 0, counted = 0, W = 0, T = 0;
      played.forEach((g) => {
        const a = parseInt(g.scoreMe, 10), b = parseInt(g.scoreOpp, 10);
        if (!isNaN(a) && !isNaN(b)) { pf += a; pa += b; counted++; if (a > b) W++; else if(a === b) T++; }
      });
      const L = counted - W - T;
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = r.source === "live" ? "live" : "snapshot";
      if (!counted) {
        pill.textContent = "Season not started";
        cells = [
          ["0–0", "Record", ""], ["—", "Points / game", ""], ["—", "Allowed / game", ""], ["—", "Differential", ""],
        ];
      } else {
        const diff = pf - pa;
        cells = [
          // v1.34.0 — the record number warms on a winning record and recedes
          // on a losing one; the differential tints with the story.
          [W + "–" + L + (T ? "–" + T : ""), T ? "Record (W–L–T)" : "Record (W–L)",
           W > L ? "record-win" : (W < L ? "record-loss" : "")],
          [(pf / counted).toFixed(1), "Points / game", ""],
          [(pa / counted).toFixed(1), "Allowed / game", ""],
          [(diff > 0 ? "+" : "") + diff, "Differential",
           diff > 0 ? "diff-pos" : (diff < 0 ? "diff-neg" : "")],
        ];
      }
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
    }
    const entered = !pulseEntered;
    pulseEntered = true;
    tiles.innerHTML = cells.map((c, i) => tile(c[0], c[1], c[2], entered, i)).join("");
    function tile(v, l, cls, enter, i) {
      return '<div class="stat-tile' + (cls ? " " + cls : "") + (enter ? " cf-enter" : "") +
        '" style="--ni:' + i + '"><b>' + CF.esc(v) + "</b><span>" + CF.esc(l) + "</span></div>";
    }
  }

  /* ---------- player leaders ----------
     1) API-Sports season stats when a key is set on the About page;
     2) otherwise the league wire's per-game leaders across every
        completed Bears game — "camp leaders" while the season is young. */
  function leaderCell(l) {
    const name = l.url ? '<a href="' + CF.esc(CF.safeURL(l.url)) + '" target="_blank" rel="noopener">' + CF.esc(l.player) + "</a>" : CF.esc(l.player);
    return name + ' <span class="dim">' + CF.esc(l.pos || "") + (l.jersey ? " #" + CF.esc(l.jersey) : "") + (l.teamAbbr ? " · " + CF.esc(l.teamAbbr) : "") + "</span>";
  }

  /* Category glyph chips for the leaderboard treatment. */
  function ldGlyph(category) {
    const s = String(category || "").toLowerCase();
    if (/intercept/.test(s)) return "🎯";
    if (/sack/.test(s)) return "💥";
    if (/tackle/.test(s)) return "🛡";
    if (/fumble/.test(s)) return "🤲";
    if (/receiv/.test(s)) return "🙌";
    if (/rush/.test(s)) return "💨";
    if (/pass/.test(s)) return "🏈";
    if (/kick|punt|field/.test(s)) return "🦵";
    if (/return/.test(s)) return "🏃";
    return "❄";
  }

  function leaderCatCell(l) {
    return '<td class="strong ld-cat"><span class="ld-glyph" aria-hidden="true">' +
      ldGlyph(l.category || l.label) + "</span>" + CF.esc(l.label) + "</td>";
  }

  let leadersEntered = false; // .cf-enter only on first paint; the 5-min refresh re-renders stay instant

  async function loadLeaders() {
    const pill = CF.$("#leaders-pill");
    const box = CF.$("#leaders");
    if (box) box.innerHTML = CF.emptyHTML({ icon: "📊", title: "Working the numbers", sub: "Season leaders when the wire has completed games.", loading: true });

    // 1) API-Sports (BYO key) — real season player stats.
    if (CF.API.apisportsKey()) {
      try {
        const d = await CF.API.apisportsPlayerStats();
        if (d && d.top.length) {
          pill.className = "pill ok";
          pill.textContent = "live · API-Sports · top 15 by " + d.cols[0];
          const entered = !leadersEntered;
          leadersEntered = true;
          box.innerHTML =
            '<div class="tbl-wrap ld' + (entered ? " cf-enter" : "") + '"><table class="tbl ld"><caption class="sr-only">Bears season leaders</caption><thead><tr><th scope="col">Player</th><th scope="col">Pos</th>' +
            d.cols.map((c) => '<th scope="col" class="num">' + CF.esc(c) + "</th>").join("") +
            "</tr></thead><tbody>" +
            d.top.map((p) =>
              '<tr class="ld-row"><td class="strong">' + CF.esc(p.name) + '</td><td class="ld-cat">' + CF.esc(p.pos || "—") + "</td>" +
              d.cols.map((c) => '<td class="num ld-line">' + CF.esc(p.stats[c] != null ? p.stats[c] : "·") + "</td>").join("") +
              "</tr>"
            ).join("") +
            "</tbody></table></div>" +
            '<p class="src-note">Season player stats via <a href="https://www.api-sports.io/" target="_blank" rel="noopener">API-Sports</a> (key set on this device — <a href="about.html#data-sources">manage on About</a>).</p>';
          return;
        }
      } catch (e) { /* key dead or feed down — fall back to the wire */ }
    }

    // 2) Camp leaders: best per-game leader line from each completed game.
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      const played = rows
        .filter((g) => g.scoreMe != null && g.scoreOpp != null)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 4);
      if (!played.length) throw new Error("no games yet");
      const best = {};
      let gamesUsed = 0;
      for (const g of played) {
        try {
          const ev = await CF.API.bearsGameEvent(g.id);
          gamesUsed++;
          CF.API.eventLeaders(ev).forEach((l) => {
            if(l.teamAbbr !== "CHI") return;
            if (!best[l.category] || (l.value || 0) > (best[l.category].value || 0)) {
              best[l.category] = Object.assign({}, l, { when: CF.fmtDate(g.date) });
            }
          });
        } catch (e2) { /* that game's leaders didn't answer */ }
      }
      const rowsOut = Object.values(best);
      if (!rowsOut.length) throw new Error("no leaders");
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · recent game leaders · " + gamesUsed + " game" + (gamesUsed === 1 ? "" : "s");
      const entered = !leadersEntered;
      leadersEntered = true;
      box.innerHTML =
        '<div class="tbl-wrap ld' + (entered ? " cf-enter" : "") + '"><table class="tbl ld"><caption class="sr-only">Bears per-game leaders, recent completed games</caption><thead><tr><th scope="col">Category</th><th scope="col">Leader</th><th scope="col" class="num">Line</th><th scope="col">When</th></tr></thead><tbody>' +
        rowsOut.map((l) =>
          '<tr class="ld-row">' + leaderCatCell(l) +
          '<td class="ld-leader">' + leaderCell(l) + "</td>" +
          '<td class="num ld-line">' + CF.esc(l.display) + "</td>" +
          '<td class="dim ld-when">' + CF.esc(l.when || "") + "</td></tr>"
        ).join("") +
        "</tbody></table></div>" +
        '<p class="src-note">Per-game leaders from the league wire across the completed games so far. Full season stats land here the moment the feed exposes them — or set an <a href="about.html#data-sources">API-Sports key</a> on the About page.</p>';
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML = CF.emptyHTML({
        icon: "📊",
        title: "Leaders unavailable",
        sub: "No completed games on the wire yet, and no snapshot on this device.",
      });
    }
  }

  /* ---------- last game box ----------
     /events/{id} is a 404 on both ESPN hosts, so the box is rebuilt from
     the scoreboard event: final score + the league wire's per-game leaders
     + a deep link to the ESPN game page for the full stat sheet. */
  let boxEntered = false; // .cf-enter only on first paint; refresh re-renders stay instant

  function bxSide(t, score, isBears, won, lost) {
    const abbr = CF.esc((t.team || {}).abbreviation || "—");
    const name = CF.esc((t.team || {}).displayName || "Team");
    return '<div class="bx-team' + (won ? " winner" : "") + (lost ? " loser" : "") + '">' +
      '<span class="bx-abbr">' + abbr + "</span>" +
      '<span class="bx-name">' + name + (isBears ? '<span class="bx-chip">🐻 Bears</span>' : "") + "</span>" +
      '<span class="bx-score">' + CF.esc(score != null ? score : "—") + "</span></div>";
  }
  async function loadLastBox() {
    const pill = CF.$("#lastbox-pill");
    const box = CF.$("#lastbox");
    if (box) box.innerHTML = CF.emptyHTML({ icon: "📋", title: "Finding the last game", sub: "Pulling the most recent completed Bears box.", loading: true });
    let last = null;
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      const now = Date.now();
      last = rows
        .filter((g) => new Date(g.date).getTime() < now - 6 * 3600e3 && g.scoreMe != null && g.scoreOpp != null)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (!last) throw new Error("no completed games in the log");
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML = CF.emptyHTML({
        icon: "📋",
        title: "No completed game yet",
        sub: "Can't find the last completed game right now.",
      });
      return;
    }
    try {
      const ev = await CF.API.bearsGameEvent(last.id);
      const c = (ev.competitions || [])[0] || {};
      const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
      const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
      const hs = CF.API.score(home.score), as_ = CF.API.score(away.score);
      const iAmHome = (home.team || {}).abbreviation === "CHI";
      const me = iAmHome ? hs : as_, opp = iAmHome ? as_ : hs;
      const leaders = CF.API.eventLeaders(ev);
      const espn = "https://www.espn.com/nfl/game/_/gameId/" + ev.id;
      const st = (ev.status && ev.status.type) || {};
      const bearsWon = me != null && opp != null && Number(me) > Number(opp);
      const bearsLost = me != null && opp != null && Number(me) < Number(opp);
      const awayIsBears = !iAmHome;
      const awayWon = as_ != null && hs != null && Number(as_) > Number(hs);
      const awayLost = as_ != null && hs != null && Number(as_) < Number(hs);
      // v1.65.0 — display names for the team-block dividers on the leaders table.
      const teamNames = {};
      [away, home].forEach((c) => {
        const t = c.team || {};
        if (t.abbreviation) teamNames[String(t.abbreviation).toUpperCase()] = t.displayName || t.abbreviation;
      });
      const entered = !boxEntered;
      boxEntered = true;
      pill.className = "pill ok";
      pill.textContent = ev.name || "last game";
      box.innerHTML =
        '<div class="bx-card' + (entered ? " cf-enter" : "") + '">' +
        '<div class="bx-head">' +
        '<span class="pill final">' + CF.esc(st.shortDetail || st.detail || "final") + "</span>" +
        (me != null && opp != null
          ? '<span class="pill ' + (bearsWon ? "won" : bearsLost ? "result-loss" : "result-tie") + '">' +
            (bearsWon ? "W" : bearsLost ? "L" : "T") + " " + CF.esc(me) + "–" + CF.esc(opp) + " (CHI)</span>"
          : "") +
        "</div>" +
        '<div class="bx-teams">' +
        bxSide(away, as_, awayIsBears, awayWon, awayLost) +
        bxSide(home, hs, iAmHome, awayLost, awayWon) +
        "</div>" +
        '<div class="bx-meta"><span>' + CF.esc((c.venue && (c.venue.fullName || c.venue.displayName)) || "Soldier Field") + "</span>" +
        '<span class="wx-dot" aria-hidden="true"></span>' +
        "<span>" + CF.esc(CF.fmtDate(ev.date)) + "</span></div>" +
        "</div>" +
        (leaders.length ? leadersTableHTML(leaders, teamNames, entered) : "") +
        '<p class="src-note">Final score + per-game leaders from the league wire. <a href="' + CF.esc(espn) + '" target="_blank" rel="noopener">Full stat sheet on ESPN ↗</a> · <a href="games.html">More games →</a></p>';
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "feed quiet";
      box.innerHTML = CF.emptyHTML({
        icon: "📋",
        title: "Box score quiet",
        sub: "Box score for the last game didn't answer this time.",
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadPulse();
    loadLeaders();
    loadLastBox();
    // Keep the stats moving for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadPulse, 2 * 60e3);             // season pulse: 2 min
    CF.refresh.register(loadLeaders, 5 * 60e3);           // leaders: 5 min
    CF.refresh.register(loadLastBox, 2 * 60e3);           // last game box: 2 min
  });
})();
