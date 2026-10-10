/* THE COLD FRONT — games: live board, season log, box scores, division */
"use strict";

(function () {
  let dayOffset = 0;
  let boxRequest = 0, selectedGame = null;
  const query = new URLSearchParams(location.search);
  let boardRequest = 0;
  let lastEvents = [];
  let lastPastGame = null; // most recent completed Bears game (season log)
  let nextGame = null; // v1.193.0 — the next Bears game, resolved by the Sunday desk
  let deskShareGame196 = null; // v1.196.0 — the full event game the desk Share button sends; repainted with the desk
  let boardDay = null; // v1.193.0 — the ISO day the board last painted
  let daySetter = null; // v1.193.0 — wireDates' setter, so the board can jump days

  /* v1.193.0 — the board's no-games day stops being a dead end.
     On the four-plus days a week with no NFL games the board's
     empty state named the problem and offered nothing: reaching
     the Bears' next game took four taps on the day-next button
     (or a date-picker hunt), even though the Sunday desk on this
     same page already knows that game. The empty state now
     carries a one-tap jump to that game's board, and the branch
     finally clears the board's aria-busy like its siblings do —
     a game-free day used to leave the board announced as loading
     forever. */
  const chiDayISO = (dateStr) => {
    try { return new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); }
    catch (e) { return ""; }
  };
  const jumpHTML = (viewedDay) => {
    if (!nextGame || !nextGame.date) return "";
    const target = chiDayISO(nextGame.date);
    if (!target || target === viewedDay) return "";
    return '<button class="btn small" type="button" data-cf-jump-next style="display:inline-flex;margin-top:12px">Bears ' +
      (nextGame.home ? "vs " : "at ") + CF.esc(String(nextGame.oppAbbr || "OPP")) + " · " +
      CF.esc(CF.fmtDate(nextGame.date)) + " — see that board →</button>";
  };
  const paintBoardJump = () => {
    const host = CF.$("#board .board-jump-host");
    if (host) host.innerHTML = jumpHTML(boardDay);
  };
  let deskEntered = false; // .cf-enter on the duel only at first paint; refresh re-renders stay instant
  let divEntered = false; // v1.41.0 — .cf-enter on the standings only at first paint; the 5-minute refresh re-renders stay instant

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
      // v1.94.0 — the pill names the source AND when it was last read.
      // v1.127.0 — the stamp wears the data's own age (a saved snapshot
      // stops claiming "1s ago" for days-old numbers).
      CF.freshStamp(pill, CF.sourceLabel(r) + " · " + selectedDay, CF.dataEpoch(r));
      if (!events.length) {
        boardDay = selectedDay;
        box.innerHTML = CF.emptyHTML({
          icon: "🌫",
          title: "No NFL games scheduled for this date",
          sub: "Try another date, or check back after kickoff.",
          action: '<span class="board-jump-host">' + jumpHTML(selectedDay) + "</span>",
        });
        box.setAttribute("aria-busy", "false");
        CF.syncLiveTitle(null);
        return;
      }
      // Bears game first.
      const isBears = (e) => ((e.competitions && e.competitions[0] && e.competitions[0].competitors) || [])
        .some((c) => (c.team || {}).abbreviation === "CHI");
      events.sort((a, b) => (isBears(b) ? 1 : 0) - (isBears(a) ? 1 : 0));
      box.innerHTML = events.map((e) => eventCard(e, isBears(e))).join("");
      box.setAttribute("aria-busy", "false");
      /* v1.190.0 — the tab keeps score off today's board only:
         the Bears event the fan is looking at, never a final
         exhumed by browsing another date. */
      const bearsEvent = events.find((e) => isBears(e));
      CF.syncLiveTitle(selectedDay === isoDate(0) && bearsEvent ? CF.API.gameFromEvent(bearsEvent) : null);
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
    // Final-score winner emphasis: crown the winning side, dim the loser,
    // and call out a Bears win on the card and the status pill.
    let cardCls = "", winSide = null, bearsResult = null;
    if (st.state === "post") {
      const hs = parseInt(CF.API.score(home.score), 10), as_ = parseInt(CF.API.score(away.score), 10);
      if (!isNaN(hs) && !isNaN(as_) && hs !== as_) {
        winSide = hs > as_ ? "home" : "away";
        cardCls += " final-w";
        if (bears) {
          const bearsHome = ((home.team || {}).abbreviation === "CHI");
          bearsResult = (bearsHome && winSide === "home") || (!bearsHome && winSide === "away") ? "won" : "lost";
          cardCls += bearsResult === "won" ? " bears-won" : " bears-lost";
          pill = bearsResult === "won"
            ? '<span class="pill won">BEARS WIN · ' + CF.esc(st.shortDetail || "final") + "</span>"
            : '<span class="pill final">FINAL · L</span>';
        }
      }
    }
    return '<div class="card game-card' + (bears ? " bears-game" : "") + cardCls + '" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      "<div style=\"font-size:13.5px\" class=\"dim\">" + CF.esc(e.name || "") + " · " + CF.esc(e.season ? e.season.displayName : "") + "</div>" +
      pill + "</div>" +
      '<div class="vs" style="margin:12px 0">' +
      side(away, false, st.state, winSide) +
      '<div class="mid">at ' + CF.esc((c.venue && (c.venue.fullName || c.venue.displayName)) || "field") + "</div>" +
      side(home, true, st.state, winSide) +
      "</div>" +
      '<div class="game-meta">' +
      (CF.fmtDate(e.date) + " · " + (CF.kickoffTime(e.date) || "TBD")) +
      (tv ? " · TV: <b>" + CF.esc(tv) + "</b>" : "") +
      (watch ? ' · <a href="' + CF.esc(CF.safeURL(watch)) + '" target="_blank" rel="noopener">Watch ↗</a>' : "") +
      ' · <a href="' + espn + '" target="_blank" rel="noopener">ESPN game ↗</a>' +
      (bears ? ' · <a href="#boxscore" data-boxgame="' + CF.esc(e.id) + '" class="boxlink">Box score ↓</a>' : "") +
      "</div></div>";
  }
  function side(comp, isHome, state, winSide) {
    const abbr = (comp.team || {}).abbreviation || "?";
    const name = (comp.team || {}).displayName || "";
    const sc = state === "pre" ? null : CF.API.score(comp.score);
    const side = isHome ? "home" : "away";
    const wcls = winSide ? (winSide === side ? " winner" : " loser") : "";
    return '<div class="side' + wcls + '"><div class="abbr">' + CF.esc(abbr) + '</div><div class="score">' + CF.esc(sc != null ? sc : "") + '</div><div class="dim" style="font-size:12px">' + CF.esc(name) + (isHome ? " (home)" : "") + "</div></div>";
  }

  /* ---------- season log ---------- */
  async function loadLog() {
    const pill = CF.$("#log-pill");
    const body = CF.$("#log-table tbody");
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      // v1.94.0 — the pill names the source AND when it was last read.
      // v1.127.0 — the stamp wears the data's own age (a saved snapshot
      // stops claiming "1s ago" for days-old numbers).
      CF.freshStamp(pill, (r.source === "live" ? "live" : "snapshot") + " · " + rows.length + " games", CF.dataEpoch(r));
      if (!rows.length) throw new Error("empty");
      // upcoming first, then most-recent results.
      const now = Date.now();
      const upcoming = rows.filter((g) => new Date(g.date).getTime() >= now - 6 * 3600e3).sort((a, b) => new Date(a.date) - new Date(b.date));
      const past = rows.filter((g) => new Date(g.date).getTime() < now - 6 * 3600e3).sort((a, b) => new Date(b.date) - new Date(a.date));
      lastPastGame = past.find((g) => g.completed) || null;
      body.innerHTML = [
        ...upcoming.map(logRow),
        // v1.76.0 — the split between upcoming and completed games is labeled,
        // not a bare orange bar: a ruled divider carrying a fan-facing tag in
        // the site's micro-label typography (Oswald, tracked-out uppercase).
        ...(upcoming.length && past.length ? '<tr class="log-divider"><td colspan="7" style="border:none;padding:16px 8px 10px"><div style="display:flex;align-items:center;gap:14px" aria-hidden="true"><span style="flex:1;height:2px;min-width:24px;background:linear-gradient(90deg,transparent,var(--orange-glow));border-radius:2px"></span><span style="font-family:var(--display);font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-dim);white-space:nowrap">Completed &middot; the season so far</span><span style="flex:1;height:2px;min-width:24px;background:linear-gradient(90deg,var(--orange-glow),transparent);border-radius:2px"></span></div></td></tr>' : ""),
        ...past.map(logRow),
      ].join("");
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="7" class="dim"><span class="log-empty">Season log unreachable — no snapshot saved on this device yet. <a href="https://www.espn.com/nfl/schedule/" target="_blank" rel="noopener">ESPN NFL schedule ↗</a></span></td></tr>';
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
    // Row-level result treatment: wins carry the orange thread, losses recede.
    const rcls = played ? (result === "W" ? " result-w" : result === "L" ? " result-l" : "") : "";
    const scoreTxt = played ? (g.scoreMe + "–" + g.scoreOpp) : "";
    return '<tr' + (played ? ' class="boxrow' + rcls + '" style="cursor:pointer" data-boxgame="' + g.id + '"' : "") + ">" +
      // v1.87.0 — the kickoff time is separated from the date by a visible
    // middot in dim, matching the site's own date-voice ("date · time" in
    // common.js). A bare space rendered as nothing, fusing date and kickoff
    // into "Thu, Oct 227:15 PM CDT".
    // v1.108.0 — kickoffTime returns "" for placeholder late-night source
    // times (e.g. ESPN's 11 PM stand-in for TBD/flex slots); the date stays,
    // the time honestly reads TBD instead of a fake 11 PM.
    "<td>" + CF.fmtDate(g.date) + (CF.kickoffTime(g.date) ? ' <span class="dim">· ' + CF.kickoffTime(g.date) + "</span>" : ' <span class="dim" title="Kickoff time not set yet — flex scheduling can move it">· Time TBD</span>') + "</td>" +
      '<td class="strong">' + (g.home ? "vs " : "@ ") + CF.esc(g.opp) + "</td>" +
      '<td class="num dim">' + (g.home ? "H" : "A") + "</td>" +
      '<td class="num log-score">' + CF.esc(scoreTxt) + "</td>" +
      '<td><span class="st ' + cls + '">' + CF.esc(played ? (result || g.result) : (g.result || "UPCOMING")) + "</span></td>" +
      '<td class="dim">' + CF.esc(g.tv || "") + "</td>" +
      "<td>" + (played ? '<a href="#boxscore" class="boxlink" data-boxgame="' + g.id + '" aria-label="Box score: Bears ' + (g.home ? "vs " : "at ") + CF.esc(g.opp) + '">Box ↗</a>' : "") + "</td>" +
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
      /* v1.102.0 — the box-score card gets a real scoreboard header. The score
         is the headline now: a scoreboard duel (away left, home right) in the
         family .duel language, the final in display numerals, the winner's
         number carrying the orange identity glow, the Bears side wearing the
         .bears treatment + 🐻 chip. Pre-game shows em-dash numerals with the
         kickoff pill up top. The visual duel is aria-hidden; the sr-only
         sentence carries the same facts for assistive tech (v1.35.0 pattern). */
      const awayTeam = away.team || {}, homeTeam = home.team || {};
      const awayName = awayTeam.displayName || "?", homeName = homeTeam.displayName || "?";
      const bearsSide = homeTeam.abbreviation === "CHI" ? "home" : (awayTeam.abbreviation === "CHI" ? "away" : null);
      const hsN = hs != null ? Number(hs) : null, asN = as_ != null ? Number(as_) : null;
      const winner = (hsN != null && asN != null && !isNaN(hsN) && !isNaN(asN))
        ? (hsN > asN ? "home" : (asN > hsN ? "away" : "tie")) : null;
      const venue = (c.venue && (c.venue.fullName || c.venue.displayName)) || "";
      const statusTxt = st.shortDetail || st.detail || CF.fmtDate(ev.date);
      const duelSide = (team, score, side) => {
        const isBears = bearsSide === side, isWin = winner === side;
        return '<div class="duel-side box-side' + (side === "away" ? " opp" : "") + (isBears ? " bears" : "") + '">' +
          '<span class="box-team">' + CF.esc(team.displayName || "?") +
          (isBears ? ' <span class="duel-bear" aria-hidden="true">🐻</span>' : "") + "</span>" +
          '<span class="box-num' + (isWin ? " win" : "") + (score == null ? " tbd" : "") + '">' +
          (score != null ? CF.esc(score) : "–") + "</span></div>";
      };
      const srScore = (hs != null || as_ != null)
        ? awayName + " " + as_ + ", " + homeName + " " + hs + ". "
        : awayName + " at " + homeName + ". ";
      const duel =
        '<p class="sr-only">' + CF.esc(srScore + statusTxt + (venue ? ", " + venue : "")) + "</p>" +
        '<div class="duel box-duel" aria-hidden="true">' +
        duelSide(awayTeam, as_, "away") +
        '<div class="duel-mid box-mid">' +
        (venue ? '<span class="box-venue">' + CF.esc(venue) + "</span>" : "") +
        "</div>" +
        duelSide(homeTeam, hs, "home") +
        "</div>";
      const pillCls = st.state === "post" ? "final" : (st.state === "in" ? "live" : "");
      const pillDot = st.state === "in" ? '<span class="dot" aria-hidden="true"></span>' : "";
      /* Category glyph chips — same family mapping as the stats-page leaders
         (v1.39.0), so the box-score rows read as the same leaderboard. */
      const boxGlyph = (category) => {
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
      };
      let html =
        '<div class="card pad-lg"><div class="badge-row" style="justify-content:space-between">' +
        "<h3 style=\"margin:0\">" + CF.esc(ev.name || "Box score") + "</h3>" +
        '<span class="pill ' + pillCls + '">' + pillDot + CF.esc(statusTxt) + "</span></div>" +
        duel +
        '<div class="tbl-wrap" style="margin-top:14px;border:none"><table class="tbl"><caption class="sr-only">Box score leaders by category</caption><thead><tr><th scope="col">Category</th><th scope="col">Leader</th><th scope="col" class="num">Line</th></tr></thead><tbody>' +
        leaders.map((l) => {
          const nm = l.url ? '<a href="' + CF.esc(CF.safeURL(l.url)) + '" target="_blank" rel="noopener">' + CF.esc(l.player) + "</a>" : CF.esc(l.player);
          return '<tr><td class="strong ld-cat"><span class="ld-glyph" aria-hidden="true">' + boxGlyph(l.category || l.label) + "</span>" + CF.esc(l.label) + "</td>" +
            "<td>" + nm + ' <span class="dim">' + CF.esc(l.pos || "") + (l.jersey ? " #" + CF.esc(l.jersey) : "") + (l.teamAbbr ? " · " + CF.esc(l.teamAbbr) : "") + "</span></td>" +
            '<td class="num">' + CF.esc(l.display) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>" +
        (leaders.length ? '' : '<p class="dim">Player stats will appear here when the game feed is available.</p>') +
        '<p class="src-note">Game details + per-game leaders from the league wire. <a href="' + CF.esc(espn) + '" target="_blank" rel="noopener">Full stat sheet on ESPN ↗</a> · <a href="stats.html">Season stats →</a></p></div>';
      box.innerHTML = html;
    } catch (e) {
      if (request !== boxRequest) return;
      box.innerHTML = CF.emptyHTML({ icon: "📋", title: "Box score unavailable", sub: "The feed for that game didn\u2019t answer — try another game from the log." });
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
        '<div class="v">Not met yet</div>' +
        '<div class="s">No completed meeting vs ' + CF.esc(g.oppAbbr || "this opponent") + " in the season log yet.</div>";
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
        // v1.108.0 — the chips carry the market's real outcome labels
        // (yesLabel/noLabel), never hardcoded YES/NO: that hardcoding let
        // this card disagree with the home desk and the odds board on which
        // side was which. Cent rounding keeps yes+no at exactly 100.
        const yesC = Math.round(top.yes * 100);
        const noC = top.no != null ? 100 - yesC : null;
        polyHTML =
          '<div class="matchup-stat desk-poly">' +
          '<span class="k">Polymarket</span>' +
          '<div class="v" style="font-size:14px;line-height:1.35">' + CF.esc(top.question) + "</div>" +
          '<div class="desk-chips" style="margin-top:8px">' +
          '<span class="desk-chip yes"><span class="k">' + CF.esc(top.yesLabel || "Yes") + "</span><b>" + yesC + "¢</b></span>" +
          (noC != null
            ? '<span class="desk-chip no"><span class="k">' + CF.esc(top.noLabel || "No") + "</span><b>" + noC + "¢</b></span>"
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

  /* Kickoff countdown for the Sunday desk chip. Paints once per 3-minute
     refresh — no per-second ticker, so it never fights the live region. */
  function kickoffLabel(date) {
    const ms = new Date(date).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms < -6 * 3600e3) return null;
    if (ms <= 0) return { text: "Kickoff window", urgent: true };
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    if (d >= 2) return { text: "Kickoff in " + d + "d " + h + "h", urgent: false };
    if (d === 1) return { text: "Kickoff tomorrow", urgent: false };
    if (h >= 3) return { text: "Kickoff in " + h + "h " + m + "m", urgent: false };
    if (h > 0 || m > 0) return { text: "Kickoff in " + (h ? h + "h " : "") + m + "m", urgent: true };
    return { text: "Kickoff imminent", urgent: true };
  }

  /* Sunday desk duel card — Bears side with the 🐻 identity chip, a vs/@
     mid carrying the week number, and the opponent side. The pill reads
     "WK N" (never "WK Week N"): the ESPN week text arrives as "Week 3",
     so a leading "Week" is stripped before the WK prefix goes on. The
     frost-fade entrance class lands on the first paint only. */
  function paintDuel(g) {
    const duel = CF.$("#next-opp-duel");
    if (!duel) return;
    const wkLabel = String(g.week || "").replace(/^Week\s+/i, "");
    duel.innerHTML =
      '<div class="duel-side bears" style="--ni:0">' +
        '<span class="duel-abbr">CHI</span>' +
        '<span class="duel-name"><span class="duel-bear" aria-hidden="true">🐻</span><span>Chicago Bears</span></span>' +
      "</div>" +
      '<div class="duel-mid">' +
        '<span class="duel-vs">' + (g.home ? "vs" : "@") + "</span>" +
        (wkLabel ? '<span class="duel-week">WK ' + CF.esc(wkLabel) + "</span>" : "") +
      "</div>" +
      '<div class="duel-side opp" style="--ni:2">' +
        '<span class="duel-abbr">' + CF.esc(String(g.oppAbbr || "OPP")) + "</span>" +
        '<span class="duel-name"><span>' + CF.esc(g.opp || "Opponent") + "</span></span>" +
      "</div>";
    if (!deskEntered) duel.classList.add("cf-enter");
    deskEntered = true;
    duel.hidden = false;
  }

  /* v1.196.0 — the desk plans the Sunday too. The home hero's match
     footer gained "Add to calendar" (v1.194.0) and "Share" (v1.195.0),
     but a fan who lands on the Games page — from a bookmark, a search
     result, or the week clock's gameday link — plans from this card,
     and it offered neither: the desk resolved the same next game down
     to its TV network and then stopped at information. The desk now
     carries the same two actions under the same honesty rules, driven
     by the full event game the desk's resolver already keeps
     (g.game): the calendar link appears only for a pre-game (CF.
     calendarHref itself refuses an unconfirmed kickoff), Share only
     when CF.shareTextForGame can describe the game without inventing
     a score, and the whole row hides again in the quiet state so a
     feed-down desk never shows dead controls. */
  function paintDeskActions(g) {
    const row = CF.$("#next-opp-actions");
    const cal = CF.$("#desk-cal");
    const share = CF.$("#desk-share");
    if (!row || !cal || !share) return;
    const full = g && g.game ? g.game : null;
    const calHref = full && full.state === "pre" ? CF.calendarHref(full) : "";
    cal.hidden = !calHref;
    if (calHref) {
      cal.href = calHref;
      cal.setAttribute("download", "bears-" + CF.dateInput(full.date) + ".ics");
      cal.setAttribute("aria-label", "Add to calendar: " + full.name + ", " + CF.fmtDate(full.date) + " " + (CF.kickoffTime(full.date) || ""));
    }
    const shareText = full ? CF.shareTextForGame(full) : "";
    share.hidden = !shareText;
    deskShareGame196 = shareText ? full : null;
    if (shareText) share.setAttribute("aria-label", "Share this game: " + full.name);
    row.hidden = !(calHref || shareText);
  }

  async function loadNextOpponent() {
    const vs = CF.$("#next-opp-vs");
    const meta = CF.$("#next-opp-meta");
    const chip = CF.$("#next-opp-chip");
    const pill = CF.$("#next-opp-pill");
    const duel = CF.$("#next-opp-duel");
    const cd = CF.$("#next-opp-countdown");
    const preview = CF.$("#next-opp-preview");
    if (!vs || !meta || !chip) return;
    let g = null, schedData = null;
    try {
      const sc = await CF.API.getSchedule();
      schedData = sc.data;
      g = CF.API.nextBearsGameFromSchedule(sc.data);
    } catch (e) { /* schedule quiet */ }
    nextGame = g || null;
    paintBoardJump();
    if (!g) {
      if (pill) { pill.className = "pill sample"; pill.textContent = "offline"; }
      if (duel) duel.hidden = true;
      if (cd) cd.hidden = true;
      vs.textContent = "Board is quiet";
      meta.textContent = "Next kickoff lands here when the schedule answers.";
      chip.innerHTML = '<span class="opp-chip dim">no opponent yet</span>';
      if (preview) { preview.innerHTML = ""; preview.hidden = true; }
      paintDeskActions(null);
      if (CF.clearKickoffBanner) CF.clearKickoffBanner();
      return;
    }
    // v1.74.0 — the venue token comes from g.venue below, so the site token must
    // not hardcode it too (that printed "Home · Soldier Field · Soldier Field").
    const site = g.home ? "Home" : "Away";
    if (pill) {
      pill.className = "pill ok";
      pill.textContent = g.home ? "home" : "away";
    }
    paintDuel(g);
    // Screen-reader matchup line — the card itself is aria-live="polite",
    // and the visual duel is aria-hidden so the matchup isn't doubled.
    vs.textContent = "Chicago Bears " + (g.home ? "vs" : "at") + " " + (g.opp || "opponent");
    const cdText = kickoffLabel(g.date);
    if (cd) {
      if (cdText) {
        cd.hidden = false;
        cd.textContent = cdText.text;
        cd.classList.toggle("today", cdText.urgent);
      } else {
        cd.hidden = true;
      }
    }
    meta.innerHTML =
      "<b>" + CF.fmtDate(g.date) + "</b> · " + (CF.kickoffTime(g.date) || "TBD") +
      " · " + CF.esc(site) +
      (g.venue ? " · " + CF.esc(g.venue) : (g.home ? " · Soldier Field" : "")) +
      (g.tv ? " · TV <b>" + CF.esc(g.tv) + "</b>" : "");
    paintDeskActions(g);
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
          (wx.wind != null ? " · wind " + Math.round(wx.wind / 1.609344) + " mph" : "") +
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
    // v1.94.0 — the pill names the source AND when it was last read.
    CF.freshStamp(pill, label, Date.now());
    /* v1.41.0 — standings glow-up: Bears row carries the 🐻 identity chip,
       the division leader carries a 👑 DIV LEAD chip (glowing when it's us),
       Pct reads in display numerals, streaks become pills. */
    const streakPill = (s) => {
      const t = String(s || "").trim();
      const cls = /^W\d*/i.test(t) ? " up" : /^L\d*/i.test(t) ? " down" : "";
      return '<span class="stnd-strk' + cls + '">' + CF.esc(t || "—") + "</span>";
    };
    body.innerHTML = div.rows.map((row, i) =>
      '<tr class="stnd-row' + (row.isMe ? " stnd-me" : "") + '">' +
      '<td class="strong stnd-team">' +
      (row.isMe ? '<span class="stnd-bear" aria-hidden="true">🐻</span>' : "") +
      CF.esc(row.name) +
      (i === 0 ? ' <span class="stnd-crown' + (row.isMe ? " hot" : "") + '">👑 DIV LEAD</span>' : "") +
      "</td>" +
      '<td class="num">' + CF.esc(row.gp != null ? row.gp : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.w != null ? row.w : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.l != null ? row.l : "—") + "</td>" +
      '<td class="num stnd-pct">' + (row.pct != null ? Number(row.pct).toFixed(3).replace(/^0/, "") : "—") + "</td>" +
      '<td class="num">' + CF.esc(row.div != null ? row.div : "—") + "</td>" +
      "<td>" + streakPill(row.streak) + "</td>" +
      "</tr>"
    ).join("");
    CF.$("#div-table-2").classList.add("stnd");
    const divWrap = CF.$("#div-table-2").closest(".tbl-wrap");
    if (divWrap) {
      divWrap.classList.add("stnd");
      if (!divEntered) {
        divWrap.classList.add("cf-enter");
        CF.$("#div-race-2").classList.add("stnd", "cf-enter");
        divEntered = true;
      }
    }
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
    daySetter = set;
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
    // v1.193.0 — the no-games jump: one tap on the empty state's
    // button lands the board on the next Bears game's day, using
    // the same offset math as the ?date= deep link above.
    CF.$("#board").addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-cf-jump-next]") : null;
      if (!btn || !nextGame || !daySetter) return;
      const target = chiDayISO(nextGame.date);
      const off = Math.round((Date.parse(target + "T12:00:00Z") - Date.parse(isoDate(0) + "T12:00:00Z")) / 86400000);
      if (Number.isFinite(off)) daySetter(off);
    });
    /* v1.196.0 — the desk Share button sends the game the desk is
       showing: the platform share sheet where one exists, the
       clipboard (with a "Link copied" answer in the label) where it
       doesn't — the hero button's exact behaviour (v1.195.0). A
       cancelled sheet changes nothing; an unavailable path says so,
       briefly, in the label. */
    const deskShareBtn196 = CF.$("#desk-share");
    let deskShareTimer196 = 0;
    if (deskShareBtn196) deskShareBtn196.addEventListener("click", async () => {
      if (!deskShareGame196) return;
      const status = await CF.shareGame(deskShareGame196);
      if (status !== "copied" && status !== "unavailable") return;
      const original196 = deskShareBtn196.innerHTML;
      deskShareBtn196.textContent = status === "copied" ? "✓ Link copied" : "Share unavailable";
      clearTimeout(deskShareTimer196);
      deskShareTimer196 = setTimeout(() => { deskShareBtn196.innerHTML = original196; }, 2400);
    });
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
