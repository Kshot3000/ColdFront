/* THE COLD FRONT — games: live board, season log, box scores, division */
"use strict";

(function () {
  let dayOffset = 0;
  let lastEvents = [];

  const isoDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  /* ---------- board ---------- */
  async function loadBoard() {
    const pill = CF.$("#board-pill");
    const box = CF.$("#board");
    pill.textContent = "reading…";
    try {
      const dp = CF.dayParam(dayOffset);
      const r = await CF.API.getScoreboard(dp);
      const events = (r.data.events || []);
      lastEvents = events;
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · " + new Date().toLocaleDateString();
      if (!events.length) {
        box.innerHTML = '<div class="empty"><div class="big">🌫</div>No games on the board that day — whiteout, probably.<br><span class="dim">Try another date, or check back after kickoff.</span></div>';
        return;
      }
      // Bears game first.
      const isBears = (e) => ((e.competitions && e.competitions[0] && e.competitions[0].competitors) || [])
        .some((c) => (c.team || {}).abbreviation === "CHI");
      events.sort((a, b) => (isBears(b) ? 1 : 0) - (isBears(a) ? 1 : 0));
      box.innerHTML = events.map((e) => eventCard(e, isBears(e))).join("");
      // The board keeps refreshing on the shared CF.refresh job below (30 s),
      // so scheduled → live → final transitions pick themselves up.
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML =
        '<div class="empty"><div class="big">🏈</div>Board is unreachable from this network, and no snapshot for ' +
        CF.dayParam(dayOffset) + " is saved on this device yet.<br>" +
        '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.espn.com/nfl/scoreboard/" target="_blank" rel="noopener">ESPN scoreboard ↗</a> ' +
        '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.nfl.com/scores" target="_blank" rel="noopener">NFL.com scores ↗</a></div>';
    }
  }

  function eventCard(e, bears) {
    const c = e.competitions && e.competitions[0];
    if (!c) return "";
    const home = (c.competitors || []).find((x) => x.homeAway === "home") || {};
    const away = (c.competitors || []).find((x) => x.homeAway === "away") || {};
    const st = (e.status && e.status.type) || {};
    let pill = '<span class="pill">' + CF.esc(st.shortDetail || "scheduled") + "</span>";
    if (st.state === "in") pill = '<span class="pill live"><span class="dot"></span>' + CF.esc(st.detail || "live") + (e.status && e.status.displayClock ? " · " + CF.esc(e.status.displayClock) : "") + "</span>";
    if (st.state === "post") pill = '<span class="pill final">' + CF.esc(st.shortDetail || "final") + "</span>";
    const tv = (c.broadcasts && c.broadcasts[0]) ? ((c.broadcasts[0].names || []).join(" / ")) : "";
    const watch = (c.broadcasts && c.broadcasts[0] && c.broadcasts[0].links && c.broadcasts[0].links.web) ? c.broadcasts[0].links.web.href : null;
    const espn = "https://www.espn.com/nfl/game/_/gameId/" + e.id;
    const score = (t) => (t.score && t.score !== "–" ? t.score : "");
    return '<div class="card' + (bears ? " game-card" : "") + '" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
      "<div style=\"font-size:13.5px\" class=\"dim\">" + CF.esc(e.name || "") + " · " + CF.esc(e.season ? e.season.displayName : "") + "</div>" +
      pill + "</div>" +
      '<div class="vs" style="margin:12px 0">' +
      side(away, false) +
      '<div class="mid">at ' + CF.esc((c.venue && c.venue.displayName) || "field") + "</div>" +
      side(home, true) +
      "</div>" +
      '<div class="game-meta">' +
      (CF.fmtDate(e.date) + " · " + (CF.fmtTime(e.date) || "TBD")) +
      (tv ? " · TV: <b>" + CF.esc(tv) + "</b>" : "") +
      (watch ? ' · <a href="' + CF.esc(watch) + '" target="_blank" rel="noopener">Watch ↗</a>' : "") +
      ' · <a href="' + espn + '" target="_blank" rel="noopener">ESPN game ↗</a>' +
      (bears ? ' · <a href="#log-table" data-boxgame="' + CF.esc(e.id) + '" class="boxlink">Box score ↓</a>' : "") +
      "</div></div>";
  }
  function side(comp, isHome) {
    const abbr = (comp.team || {}).abbreviation || "?";
    const name = (comp.team || {}).displayName || "";
    return '<div class="side"><div class="abbr">' + CF.esc(abbr) + '</div><div class="score">' + CF.esc(comp.score && comp.score !== "–" ? comp.score : "") + '</div><div class="dim" style="font-size:12px">' + CF.esc(name) + (isHome ? " (home)" : "") + "</div></div>";
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
      body.innerHTML = [
        ...upcoming.map(logRow),
        ...(upcoming.length && past.length ? '<tr><td colspan="7" style="border:none;height:6px;background:rgba(200,56,3,.12)"></td></tr>' : ""),
        ...past.map(logRow),
      ].join("");
      CF.$$("#log-table .boxlink").forEach((a) => a.addEventListener("click", () => {
        loadBoxscore(a.dataset.boxgame);
        CF.$("#boxscore").scrollIntoView({ behavior: "smooth", block: "start" });
      }));
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="7" class="dim">Season log unreachable — no snapshot saved on this device yet. <a href="https://www.espn.com/nfl/schedule/" target="_blank" rel="noopener">ESPN NFL schedule ↗</a></td></tr>';
    }
  }

  function logRow(g) {
    const played = g.scoreMe != null;
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
      '<td class="strong">' + (g.home ? "@" : "vs ") + CF.esc(g.opp) + "</td>" +
      '<td class="num dim">' + (g.home ? "A" : "H") + "</td>" +
      '<td class="num">' + CF.esc(scoreTxt) + "</td>" +
      '<td><span class="st ' + cls + '">' + CF.esc(played ? (result || g.result) : (g.result || "UPCOMING")) + "</span></td>" +
      '<td class="dim">' + CF.esc(g.tv || "") + "</td>" +
      "<td>" + (played ? '<a href="#boxscore" class="boxlink" data-boxgame="' + g.id + '" onclick="event.stopPropagation()">box ↗</a>' : "") + "</td>" +
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
    const box = CF.$("#boxscore");
    box.innerHTML = '<div class="empty"><div class="big">📋</div>Pulling the box score…</div>';
    try {
      const ev = await CF.API.getEvent(gameId);
      const c = (ev.competitions || [])[0] || {};
      const stats = (c.statistics || []).filter((s) => (s.players || []).length);
      if (!stats.length) throw new Error("no stats");
      // Build per-player rows.
      const rows = {};
      const colNames = [];
      stats.forEach((s) => {
        if (!colNames.includes(s.name)) colNames.push(s.name);
        const vals = Array.isArray(s.displayValue) ? s.displayValue
          : Array.isArray(s.value) ? s.value
          : (s.displayValue != null || s.value != null) ? [s.displayValue != null ? s.displayValue : s.value] : null;
        (s.players || []).forEach((p, i) => {
          const key = p.id != null ? "id" + p.id : p.displayName;
          rows[key] = rows[key] || { name: p.displayName || "—", cells: {} };
          if (vals && vals[i] != null) rows[key].cells[s.name] = String(vals[i]);
        });
      });
      const players = Object.values(rows).sort((a, b) => a.name.localeCompare(b.name));
      let html =
        '<div class="card pad-lg"><div class="badge-row" style="justify-content:space-between">' +
        "<h3 style=\"margin:0\">" + CF.esc(ev.name || "Box score") + "</h3>" +
        "<span class=\"pill\">" + CF.fmtDate(ev.date) + "</span></div>" +
        '<div class="tbl-wrap" style="margin-top:14px;border:none"><table class="tbl"><thead><tr><th>Player</th>' +
        colNames.map((n) => '<th class="num">' + CF.esc(statLabel(n)) + "</th>").join("") +
        "</tr></thead><tbody>" +
        players.map((p) =>
          '<tr><td class="strong">' + CF.esc(p.name) + "</td>" +
          colNames.map((n) => '<td class="num">' + CF.esc(p.cells[n] != null ? p.cells[n] : "·") + "</td>").join("") +
          "</tr>"
        ).join("") +
        "</tbody></table></div>" +
        '<p class="src-note">Individual stats from the league wire for this game. <a href="stats.html">Season stats →</a></p></div>';
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = '<div class="empty"><div class="big">📋</div>Box score unavailable right now — the feed for that game didn\'t answer.</div>';
    }
  }

  // Click anywhere on a played row.
  document.addEventListener("click", (ev) => {
    const row = ev.target.closest(".boxrow");
    if (row && row.dataset.boxgame) loadBoxscore(row.dataset.boxgame);
  });

  /* ---------- division ---------- */
  async function loadDivision() {
    const pill = CF.$("#div2-pill");
    const body = CF.$("#div-table-2 tbody");
    try {
      const r = await CF.API.getStandings();
      const div = CF.API.divisionTable(r.data);
      if (!div) throw new Error("no division");
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = r.source === "live" ? "live" : "snapshot";
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
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="7" class="dim">Standings unavailable right now.</td></tr>';
    }
  }

  /* ---------- date nav ---------- */
  function wireDates() {
    const pick = CF.$("#day-pick");
    const set = (offset) => {
      dayOffset = offset;
      pick.value = isoDate(offset);
      loadBoard();
    };
    pick.value = isoDate(0);
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
    // Keep games moving for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadBoard, 30e3);                 // board: 30 s (scheduled → live → final)
    CF.refresh.register(loadLog, 3 * 60e3);               // season log: 3 min
    CF.refresh.register(loadDivision, 5 * 60e3);          // division table: 5 min
    // If there's a Bears game today, preload its box score when it's over.
    setTimeout(async () => {
      if (!lastEvents.length) return;
      const isBears = (e) => ((e.competitions && e.competitions[0] && e.competitions[0].competitors) || [])
        .some((c) => (c.team || {}).abbreviation === "CHI");
      const g = lastEvents.find((e) => isBears(e) && e.status && e.status.type && e.status.type.state === "post");
      if (g) loadBoxscore(g.id);
    }, 2500);
  });
})();
