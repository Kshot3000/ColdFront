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

  /* ---------- player leaders ----------
     1) API-Sports season stats when a key is set on the About page;
     2) otherwise the league wire's per-game leaders across every
        completed Bears game — "camp leaders" while the season is young. */
  function leaderCell(l) {
    const name = l.url ? '<a href="' + CF.esc(l.url) + '" target="_blank" rel="noopener">' + CF.esc(l.player) + "</a>" : CF.esc(l.player);
    return name + ' <span class="dim">' + CF.esc(l.pos || "") + (l.jersey ? " #" + CF.esc(l.jersey) : "") + (l.teamAbbr ? " · " + CF.esc(l.teamAbbr) : "") + "</span>";
  }

  async function loadLeaders() {
    const pill = CF.$("#leaders-pill");
    const box = CF.$("#leaders");

    // 1) API-Sports (BYO key) — real season player stats.
    if (CF.API.apisportsKey()) {
      try {
        const d = await CF.API.apisportsPlayerStats();
        if (d && d.top.length) {
          pill.className = "pill ok";
          pill.textContent = "live · API-Sports · top 15 by " + d.cols[0];
          box.innerHTML =
            '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th>Pos</th>' +
            d.cols.map((c) => '<th class="num">' + CF.esc(c) + "</th>").join("") +
            "</tr></thead><tbody>" +
            d.top.map((p) =>
              "<tr><td class=\"strong\">" + CF.esc(p.name) + "</td><td>" + CF.esc(p.pos || "—") + "</td>" +
              d.cols.map((c) => '<td class="num">' + CF.esc(p.stats[c] != null ? p.stats[c] : "·") + "</td>").join("") +
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
            if (!best[l.category] || (l.value || 0) > (best[l.category].value || 0)) {
              best[l.category] = Object.assign({}, l, { when: CF.fmtDate(g.date) });
            }
          });
        } catch (e2) { /* that game's leaders didn't answer */ }
      }
      const rowsOut = Object.values(best);
      if (!rowsOut.length) throw new Error("no leaders");
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · camp leaders · " + gamesUsed + " game" + (gamesUsed === 1 ? "" : "s");
      box.innerHTML =
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th>Leader</th><th class="num">Line</th><th>When</th></tr></thead><tbody>' +
        rowsOut.map((l) =>
          "<tr><td class=\"strong\">" + CF.esc(l.label) + "</td>" +
          "<td>" + leaderCell(l) + "</td>" +
          '<td class="num">' + CF.esc(l.display) + "</td>" +
          '<td class="dim">' + CF.esc(l.when || "") + "</td></tr>"
        ).join("") +
        "</tbody></table></div>" +
        '<p class="src-note">Per-game leaders from the league wire across the completed games so far. Full season stats land here the moment the feed exposes them — or set an <a href="about.html#data-sources">API-Sports key</a> on the About page.</p>';
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      box.innerHTML = '<div class="empty"><div class="big">📊</div>Leaders unavailable — no completed games on the wire yet, and no snapshot on this device.</div>';
    }
  }

  /* ---------- last game box ----------
     /events/{id} is a 404 on both ESPN hosts, so the box is rebuilt from
     the scoreboard event: final score + the league wire's per-game leaders
     + a deep link to the ESPN game page for the full stat sheet. */
  async function loadLastBox() {
    const pill = CF.$("#lastbox-pill");
    const box = CF.$("#lastbox");
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
      box.innerHTML = '<div class="empty"><div class="big">📋</div>Can\'t find the last completed game right now.</div>';
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
      pill.className = "pill ok";
      pill.textContent = ev.name || "last game";
      box.innerHTML =
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">' +
        '<span class="pill final">' + CF.esc(st.shortDetail || st.detail || "final") + "</span>" +
        '<span style="font-size:14.5px"><b>' + CF.esc((away.team || {}).displayName || "?") + "</b> " + CF.esc(as_ != null ? as_ : "—") +
        " · <b>" + CF.esc((home.team || {}).displayName || "?") + "</b> " + CF.esc(hs != null ? hs : "—") +
        ' <span class="dim">(' + CF.esc((c.venue && c.venue.displayName) || "Soldier Field") + ", " + CF.fmtDate(ev.date) + ")</span></span>" +
        (me != null && opp != null ? '<span class="st ' + (Number(me) > Number(opp) ? "active" : "out") + '">' + (Number(me) > Number(opp) ? "W" : "L") + " " + CF.esc(me) + "–" + CF.esc(opp) + " (CHI)</span>" : "") +
        "</div>" +
        (leaders.length
          ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th>Leader</th><th class="num">Line</th></tr></thead><tbody>' +
            leaders.map((l) =>
              "<tr><td class=\"strong\">" + CF.esc(l.label) + "</td>" +
              "<td>" + leaderCell(l) + "</td>" +
              '<td class="num">' + CF.esc(l.display) + "</td></tr>"
            ).join("") +
            "</tbody></table></div>"
          : "") +
        '<p class="src-note">Final score + per-game leaders from the league wire. <a href="' + CF.esc(espn) + '" target="_blank" rel="noopener">Full stat sheet on ESPN ↗</a> · <a href="games.html">More games →</a></p>';
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
