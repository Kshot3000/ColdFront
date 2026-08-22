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

  /* ---------- season pulse from the schedule ---------- */
  async function loadPulse() {
    const pill = CF.$("#pulse-pill");
    const tiles = CF.$("#pulse");
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      const played = rows.filter((g) => g.scoreMe != null);
      let pf = 0, pa = 0, counted = 0, W = 0;
      played.forEach((g) => {
        const a = parseInt(g.scoreMe, 10), b = parseInt(g.scoreOpp, 10);
        if (!isNaN(a) && !isNaN(b)) { pf += a; pa += b; counted++; if (a > b) W++; }
      });
      const L = counted - W;
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = r.source === "live" ? "live" : "snapshot";
      if (!counted) throw new Error("no games yet");
      tiles.innerHTML =
        tile(W + "–" + L, "Record (W–L)") +
        tile((pf / counted).toFixed(1), "Points / game") +
        tile((pa / counted).toFixed(1), "Allowed / game") +
        tile((pf - pa > 0 ? "+" : "") + (pf - pa), "Differential");
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      tiles.innerHTML = tile("—", "Record") + tile("—", "Points / game") + tile("—", "Allowed / game") + tile("—", "Differential");
    }
    function tile(v, l) { return '<div class="stat-tile"><b>' + CF.esc(v) + "</b><span>" + CF.esc(l) + "</span></div>"; }
  }

  /* ---------- player leaders (if season stats exposed) ---------- */
  async function loadLeaders() {
    const pill = CF.$("#leaders-pill");
    const box = CF.$("#leaders");
    try {
      const r = await CF.API.getRoster();
      const players = CF.API.rosterPlayers(r.data).filter((p) => p.stats);
      if (!players.length) {
        pill.className = "pill";
        pill.textContent = "season stats not on the feed";
        box.innerHTML =
          '<div class="empty"><div class="big">🧮</div>' +
          "The league feed isn\'t exposing season-level player numbers right now (this changes as the season progresses). " +
          "Meanwhile: the <a href=\"games.html\">box score on the Games page</a> has every completed game, and the <a href=\"https://www.pro-football-reference.com/teams/chi/\" target=\"_blank\" rel=\"noopener\">PFR Bears page ↗</a> has the deep cut.<br></div>";
        return;
      }
      // Pick up to 5 numeric stat columns present on most players.
      const statNames = [];
      players.forEach((p) => Object.keys(p.stats || {}).forEach((k) => {
        const v = p.stats[k];
        if ((typeof v === "number" || !isNaN(v)) && v > 0 && !statNames.includes(k)) statNames.push(k);
      }));
      const cols = statNames.slice(0, 5);
      if (!cols.length) throw new Error("no columns");
      const num = (v) => { const n = parseFloat(v); return isNaN(n) ? -1 : n; };
      const top = [...players].sort((a, b) => num(b.stats[cols[0]]) - num(a.stats[cols[0]])).slice(0, 15);
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · top 15 by " + statLabel(cols[0]);
      box.innerHTML =
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th>Pos</th>' +
        cols.map((c) => '<th class="num">' + CF.esc(statLabel(c)) + "</th>").join("") +
        "</tr></thead><tbody>" +
        top.map((p) =>
          "<tr><td class=\"strong\">" + CF.esc(p.name) + "</td><td>" + CF.esc(p.pos) + "</td>" +
          cols.map((c) => '<td class="num">' + CF.esc(p.stats[c] != null ? p.stats[c] : "·") + "</td>").join("") +
          "</tr>"
        ).join("") +
        "</tbody></table></div>";
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML = '<div class="empty"><div class="big">📊</div>Leaders unavailable — no snapshot on this device yet.</div>';
    }
  }

  /* ---------- last game box score ---------- */
  async function loadLastBox() {
    const pill = CF.$("#lastbox-pill");
    const box = CF.$("#lastbox");
    let gameId = null;
    try {
      const r = await CF.API.getSchedule();
      const rows = CF.API.scheduleList(r.data);
      const now = Date.now();
      const last = rows
        .filter((g) => new Date(g.date).getTime() < now - 6 * 3600e3 && g.scoreMe != null)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (last) gameId = last.id;
      else throw new Error("no completed games in the log");
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML = '<div class="empty"><div class="big">📋</div>Can\'t find the last completed game right now.</div>';
      return;
    }
    try {
      const ev = await CF.API.getEvent(gameId);
      const c = (ev.competitions || [])[0] || {};
      const stats = (c.statistics || []).filter((s) => (s.players || []).length);
      if (!stats.length) throw new Error("no stats");
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
      pill.className = "pill ok";
      pill.textContent = CF.esc(ev.name || "last game");
      box.innerHTML =
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th>' +
        colNames.map((n) => '<th class="num">' + CF.esc(statLabel(n)) + "</th>").join("") +
        "</tr></thead><tbody>" +
        players.map((p) =>
          '<tr><td class="strong">' + CF.esc(p.name) + "</td>" +
          colNames.map((n) => '<td class="num">' + CF.esc(p.cells[n] != null ? p.cells[n] : "·") + "</td>").join("") +
          "</tr>"
        ).join("") +
        "</tbody></table></div>" +
        '<p class="src-note">From the league wire for ' + CF.esc(ev.name || "the last game") + '. <a href="games.html">More games →</a></p>';
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "feed quiet";
      box.innerHTML = '<div class="empty"><div class="big">📋</div>Box score for the last game didn\'t answer this time.</div>';
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
