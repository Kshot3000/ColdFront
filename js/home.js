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
      body.innerHTML = '<tr><td colspan="4" class="dim">Standings unavailable right now — check back when the feed is reachable.</td></tr>';
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
        pill.textContent = "live feed";
        return;
      }
    } catch (e) { /* wire silent or unreachable */ }
    // 2) The wide wire: RSS across 100+ outlets (Google News, then Bing News).
    try {
      const items = await CF.API.getGoogleNews("Chicago Bears", 4);
      box.innerHTML = items.map(wideItemHTML).join("");
      pill.textContent = "wide wire";
    } catch (e2) {
      pill.textContent = "offline";
      box.innerHTML = '<div class="empty"><div class="big">📡</div>' +
        "Both wires are down on this network and no snapshot is saved yet.<br>" +
        "Once either feed answers (or you visit while online), headlines cache locally." +
        '<br><a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.chicagobears.com/news" target="_blank" rel="noopener">Official Bears news →</a></div>';
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
    } catch (e3) {
      body.innerHTML = '<tr><td colspan="4" class="dim">Report unavailable.</td></tr>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadNextGame();
    loadStandings();
    loadNews();
    loadInjuries();
    // Keep the home page moving for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadNextGame, 30e3);              // next game + live clock: 30 s
    CF.refresh.register(loadStandings, 60e3);            // NFC North: 60 s
    CF.refresh.register(loadNews, 60e3);                 // headlines: 60 s
    CF.refresh.register(loadInjuries, 5 * 60e3, { name: "injuries" }); // local report (repo JSON): 5 min
  });
})();
