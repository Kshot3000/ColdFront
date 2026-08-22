/* THE COLD FRONT — odds: league wire, Polymarket, The Odds API (optional key) */
"use strict";

(function () {
  const KEY_LS = "cf.oddskey";

  /* ---------- 1) league-wire line for the next Bears game ---------- */
  async function loadWireOdds() {
    const pill = CF.$("#odds-pill");
    const box = CF.$("#odds-board");
    pill.textContent = "checking…";
    let nextGame = null, gameId = null, gameName = "";
    try {
      const sc = await CF.API.getSchedule();
      nextGame = CF.API.nextBearsGameFromSchedule(sc.data);
      if (!nextGame) throw new Error("no next game in log");
      gameName = (nextGame.home ? "@" : "vs ") + nextGame.opp + " · " + CF.fmtDate(nextGame.date);
      gameId = nextGame.id;
    } catch (e) {
      // try today's scoreboard for a live game id
      try {
        const sb = await CF.API.getScoreboard();
        const g = CF.API.bearsGameFromScoreboard(sb.data);
        if (g && (g.home.abbr === "CHI" || g.away.abbr === "CHI")) {
          gameId = g.id;
          gameName = g.name + " · " + CF.fmtDate(g.date);
          nextGame = g;
        }
      } catch (e2) { /* nothing */ }
    }

    try {
      const r = await CF.API.getOdds();
      const line = CF.API.oddsForGame(r.data, gameId);
      if (!line || !line.lines.length) throw new Error("no lines");
      pill.className = "pill ok";
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · " + gameName;
      box.innerHTML = line.lines.map((l) =>
        '<div class="odds-card">' +
        '<span class="book">' + CF.esc(l.book) + "</span>" +
        (l.spread && l.spread.home != null ? spreadRow(l) : "") +
        (l.total != null ? '<div class="odds-row"><span>Total (O/U)</span><b>' + CF.esc(l.total) + "</b></div>" : "") +
        (l.ml ? mlRow(l) : "") +
        (l.url ? '<a href="' + CF.esc(l.url) + '" target="_blank" rel="noopener" style="font-size:12px">details ↗</a>' : "") +
        "</div>"
      ).join("");
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "wire line unavailable";
      box.innerHTML =
        '<div class="empty"><div class="big">🎲</div>No league-wire line right now' +
        (nextGame ? " (next game: " + CF.esc(gameName) + ")" : "") + ".<br>" +
        'The Polymarket board below usually still works, and the full-board box takes any <a href="https://the-odds-api.com" target="_blank" rel="noopener">The Odds API</a> key.' +
        ' <a class="btn small" style="display:inline-flex;margin-top:12px" href="https://sportsbook.draftkings.com/sportsbook/nfl" target="_blank" rel="noopener">Sportsbooks ↗</a></div>';
    }
  }

  function spreadRow(l) {
    return '<div class="odds-row"><span>Spread (home)</span><b class="' + (String(l.spread.home).startsWith("-") ? "neg" : "pos") + '">' + CF.esc(l.spread.home) + "</b></div>" +
      '<div class="odds-row"><span>Spread (away)</span><b class="' + (String(l.spread.away).startsWith("-") ? "neg" : "pos") + '">' + CF.esc(l.spread.away) + "</b></div>";
  }
  function mlRow(l) {
    return '<div class="odds-row"><span>ML (home)</span><b class="' + (String(l.ml.home).startsWith("-") ? "neg" : "pos") + '">' + CF.esc(l.ml.home) + "</b></div>" +
      '<div class="odds-row"><span>ML (away)</span><b class="' + (String(l.ml.away).startsWith("-") ? "neg" : "pos") + '">' + CF.esc(l.ml.away) + "</b></div>";
  }

  /* ---------- 2) Polymarket ---------- */
  async function loadPoly() {
    const box = CF.$("#poly-board");
    try {
      const events = await CF.API.getPolymarket(100);
      const bears = CF.API.polymarketBears(events);
      if (!bears.length) {
        box.innerHTML = '<div class="empty"><div class="big">🔮</div>No active Bears markets on Polymarket right now — the NFL tag is live, but nothing matches "Bears" at this moment. <a href="https://polymarket.com/nfl" target="_blank" rel="noopener">Browse all NFL markets ↗</a></div>';
        return;
      }
      box.innerHTML = bears.slice(0, 8).map((ev) =>
        (ev.markets || []).map((m) =>
          '<div class="poly-card">' +
          '<span class="q">' + CF.esc(m.question) + "</span>" +
          '<span class="pr">' +
          (m.yes != null ? '<span class="poly-price yes" title="implied ' + Math.round(m.yes * 100) + '%">YES ' + Math.round(m.yes * 100) + "¢</span>" : "") +
          (m.no != null ? '<span class="poly-price no" title="implied ' + Math.round(m.no * 100) + '%">NO ' + Math.round(m.no * 100) + "¢</span>" : "") +
          "</span>" +
          '<span class="sub">' +
          (m.volume != null ? "Vol " + CF.fmt(m.volume) : "") +
          (m.endDate ? " · ends " + CF.fmtDate(m.endDate) : "") +
          ' · <a href="' + CF.esc(m.url) + '" target="_blank" rel="noopener">market ↗</a>' +
          "</span></div>"
        ).join("")
      ).join("");
    } catch (e) {
      box.innerHTML = '<div class="empty"><div class="big">🔮</div>Polymarket didn\'t answer from this network. <a href="https://polymarket.com/nfl" target="_blank" rel="noopener">polymarket.com/nfl ↗</a></div>';
    }
  }

  /* ---------- 3) The Odds API (optional) ---------- */
  function loadStoredKey() {
    try {
      const k = localStorage.getItem(KEY_LS);
      if (k) CF.$("#odds-key").value = k;
    } catch (e) { /* private mode */ }
  }

  async function loadFullBoard() {
    const key = (CF.$("#odds-key").value || "").trim();
    const box = CF.$("#oddsapi-board");
    if (!key) { CF.toast("Paste a key first — free at the-odds-api.com"); return; }
    try { localStorage.setItem(KEY_LS, key); } catch (e) { /* ignore */ }
    box.innerHTML = '<div class="empty"><div class="big">🎲</div>Summoning the books…</div>';
    try {
      const games = await CF.API.getOddsApi(key);
      const bears = games.filter((g) => /bears/i.test(g.home_team || "") || /bears/i.test(g.away_team || ""));
      if (!bears.length) {
        box.innerHTML = '<div class="empty" style="padding:18px">No Bears games in the next window on The Odds API — that usually means the next game is more than a few days out. The board re-fills as game day approaches.</div>';
        return;
      }
      const g = bears[0];
      const rows = (g.bookmakers || []).map((b) => {
        const ps = b.point_spread || {};
        const ou = b.over_under || {};
        const ml = b.moneyline || {};
        return "<tr><td class=\"strong\">" + CF.esc(b.title || b.key) + "</td>" +
          "<td class=\"num\">" + (ps.spread != null ? CF.esc(ps.spread) : "—") + (ps.point != null ? " (" + CF.esc(ps.point) + ")" : "") + "</td>" +
          "<td class=\"num\">" + (ou.total != null ? CF.esc(ou.total) : "—") + "</td>" +
          "<td class=\"num\">" + (ml.home != null ? CF.esc(ml.home) : "—") + " / " + (ml.away != null ? CF.esc(ml.away) : "—") + "</td>" +
          (b.last_update ? '<td class="dim">' + new Date(b.last_update).toLocaleTimeString() + "</td>" : "<td></td>") +
          "</tr>";
      });
      box.innerHTML =
        '<div class="tbl-wrap"><table class="tbl" style="min-width:480px"><thead><tr>' +
        "<th>Book</th><th class=\"num\">Spread</th><th class=\"num\">O/U</th><th class=\"num\">ML home/away</th><th>Updated</th>" +
        "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>" +
        '<p class="src-note">' + CF.esc(g.displayName || "") + " · " + new Date(g.commence_time).toLocaleString() +
        " · source: The Odds API (your key) · free tier 500 req/mo</p>";
    } catch (e) {
      box.innerHTML = '<div class="empty" style="padding:18px">The Odds API said no (' + CF.esc(e.message || "error") + '). Check the key, or the free-tier quota.</div>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadStoredKey();
    loadWireOdds();
    loadPoly();
    CF.$("#odds-refresh").addEventListener("click", () => { loadWireOdds(); loadPoly(); });
    CF.$("#odds-key-go").addEventListener("click", loadFullBoard);
    CF.$("#odds-key-clear").addEventListener("click", () => {
      CF.$("#odds-key").value = "";
      try { localStorage.removeItem(KEY_LS); } catch (e) { /* ignore */ }
      CF.$("#oddsapi-board").innerHTML = "";
      CF.toast("Key cleared from this browser");
    });
    // Auto-refresh odds + markets every 60 s while the tab is open (CF.refresh
    // in common.js handles hidden-tab skip + catch-up on return).
    // The Odds API full board stays manual on purpose: free tier is 500 req/mo.
    CF.refresh.register(loadWireOdds, 60e3);
    CF.refresh.register(loadPoly, 60e3);
  });
})();
