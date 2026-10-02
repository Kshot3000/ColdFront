/* THE COLD FRONT — odds: league wire, Polymarket, The Odds API (optional key) */
"use strict";

(function () {
  const KEY_LS = "cf.oddskey";
  // v1.43.0 — .cf-enter on the wire board only at first paint; the 60s refresh re-renders stay instant
  let wireEntered = false;
  // v1.43.0 — .cf-enter on the Polymarket board only at first paint; the 60s refresh re-renders stay instant
  let polyEntered = false;
  // v1.49.0 — previous Polymarket prices per market (event slug + question),
  // so the next render can flag line movement with ▲/▼ chips
  const polyPrev = {};
  // v1.86.0 — Polymarket volumes are dollars; show them that way. The bare
  // CF.fmt printed the raw float (268.18067599999995 -> "268.2"), which reads
  // like a share count sitting next to compact K/M figures. Whole dollars
  // under 1K, compact K/M above, "$" prefix everywhere: $268, $6.7K, $1.8M.
  // v1.108.0 — strip the useless ".0" from the compact form: "$63.0K" -> "$63K".
  const fmtPolyVol = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const compact = (d, suf) => (n / d).toFixed(n % d === 0 ? 0 : 1).replace(/\.0$/, "") + suf;
    if (Math.abs(n) >= 1e6) return "$" + compact(1e6, "M");
    if (Math.abs(n) >= 1e3) return "$" + compact(1e3, "K");
    return "$" + Math.round(n);
  };

  /* v1.108.0 — binary completion for the Polymarket board. The feed sometimes
     ships only one side of a binary market (e.g. prices ["","0.7475"] -> yes
     null, no 0.7475 after api.js's valid() clamps), and the old render path
     then dropped the missing chip entirely. When a market has exactly the two
     Yes/No outcomes and exactly ONE of yes/no is present and finite, derive
     the missing side as (1 - present). Never derive when both are missing or
     the market isn't binary. */
  const looksBinary = (lbl) => /^(yes|no)$/i.test(String(lbl || "").trim());
  function completeBinary(m) {
    const yOk = Number.isFinite(m.yes), nOk = Number.isFinite(m.no);
    if (yOk === nOk) return m; // both present, or both missing — nothing to do
    if (!(looksBinary(m.yesLabel) && looksBinary(m.noLabel))) return m;
    const out = Object.assign({}, m);
    if (yOk) out.no = 1 - m.yes; else out.yes = 1 - m.no;
    return out;
  }

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
      gameName = (nextGame.home ? "vs " : "@ ") + nextGame.opp + " · " + CF.fmtDate(nextGame.date);
      gameId = nextGame.id;
    } catch (e) {
      // try today's scoreboard for a live game id
      try {
        const sb = await CF.API.getScoreboard();
        const g = CF.API.bearsGameFromScoreboard(sb.data);
        /* v1.115.0 — a stale "pre" scoreboard game (kickoff past the 6h grace
           window) is last night's news, not a fallback identity for the odds
           board — the same guard the hero and week clock use. */
        if (g && !CF.API.preGameKickoffStale(g) && (g.home.abbr === "CHI" || g.away.abbr === "CHI")) {
          gameId = g.id;
          gameName = g.name + " · " + CF.fmtDate(g.date);
          nextGame = g;
        }
      } catch (e2) { /* nothing */ }
    }

    try {
      const r = await CF.API.getOdds(nextGame?.date ? CF.dateInput(nextGame.date) : null);
      const line = CF.API.oddsForGame(r.data, gameId);
      if (!line || !line.lines.length) throw new Error("no lines");
      pill.className = "pill ok";
      // v1.94.0 — the pill names the source AND when it was last read.
      // v1.127.0 — the stamp wears the data's own age (a saved snapshot
      // stops claiming "1s ago" for days-old numbers).
      CF.freshStamp(pill, (r.source === "live" ? "live" : "snapshot") + " · " + gameName, CF.dataEpoch(r));
      const side = bearsSideOf(nextGame);
      // v1.108.0 — "BEST" is a comparison: with a single book on the board
      // there's nothing to compare against, so the best-strip and the per-row
      // BEST chips stand down instead of stating the obvious.
      const multiBook = new Set((line.lines || []).map((l) => l.book).filter(Boolean)).size > 1;
      const best = side && multiBook ? bestBearsPrices(line.lines, side) : null;
      box.innerHTML = (best ? bestStrip(best, line.lines, !wireEntered) : "") + line.lines.map((l, i) =>
        '<div class="odds-card' + (wireEntered ? "" : " cf-enter") + '" style="--ni:' + Math.min(i, 12) + '">' +
        '<span class="book">' + CF.esc(l.book) + "</span>" +
        (l.spread && l.spread.home != null ? spreadRow(l, side, best, i) : "") +
        (l.total != null ? totalRow(l, best, i) : "") +
        (l.ml ? mlRow(l, side, best, i) : "") +
        (l.url ? '<a href="' + CF.esc(CF.safeURL(l.url)) + '" target="_blank" rel="noopener" style="font-size:12px">details ↗</a>' : "") +
        "</div>"
      ).join("");
      wireEntered = true;
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "wire line unavailable";
      box.innerHTML =
        '<div class="empty"><div class="big">🎲</div>No league-wire line right now' +
        (nextGame ? " (next game: " + CF.esc(gameName) + ")" : "") + ".<br>" +
        'The Polymarket board below usually still works, and the full-board box takes any <a href="https://the-odds-api.com" target="_blank" rel="noopener">The Odds API</a> key.' +
        '<div class="empty-cta"><a class="btn small" href="https://sportsbook.draftkings.com/sportsbook/nfl" target="_blank" rel="noopener">Sportsbooks ↗</a></div></div>';    }
  }

  /* Best-price finder: which book has the friendliest number for the Bears
     on each market? Best spread = largest line value (fewer points to cover
     for a favorite, more points for a dog); best ML = largest price;
     best Over = lowest total; best Under = highest total. */
  function bearsSideOf(g) {
    if (!g) return null;
    if (typeof g.home === "boolean") return g.home ? "home" : "away";
    if (g.home && g.home.abbr === "CHI") return "home";
    if (g.away && g.away.abbr === "CHI") return "away";
    return null;
  }
  function bestBearsPrices(lines, side) {
    const num = (v) => (v == null || v === "" ? null : Number(v));
    const spreads = [], mls = [], totals = [];
    lines.forEach((l, i) => {
      const sp = num(l.spread && l.spread[side]);
      const mlp = num(l.ml && l.ml[side]);
      const tot = num(l.total);
      if (sp != null && Number.isFinite(sp)) spreads.push({v: sp, book: l.book, i});
      if (mlp != null && Number.isFinite(mlp)) mls.push({v: mlp, book: l.book, i});
      if (tot != null && Number.isFinite(tot)) totals.push({v: tot, book: l.book, i});
    });
    const pick = (arr, better) => (arr.length ? arr.reduce((a, b) => (better(b.v, a.v) ? b : a)) : null);
    return {
      spread: pick(spreads, (b, a) => b > a),
      ml: pick(mls, (b, a) => b > a),
      over: pick(totals, (b, a) => b < a),
      under: pick(totals, (b, a) => b > a),
    };
  }
  function bestChip(label) {
    return '<span class="best-chip" title="Best Bears price on this board">' + label + "</span>";
  }
  const fmtSigned = (v) => (v > 0 ? "+" : "") + v;
  function isBest(pick, l, i, v) {
    return pick && i === pick.i && Number(v) === pick.v;
  }
  function bestStrip(best, lines, enter) {
    const parts = [];
    if (best.spread) parts.push("Spread " + fmtSigned(best.spread.v) + " @ " + best.spread.book);
    if (best.ml) parts.push("ML " + fmtSigned(best.ml.v) + " @ " + best.ml.book);
    if (best.over && best.under && best.over.v === best.under.v) parts.push("O/U " + best.over.v + " @ " + best.over.book);
    else {
      if (best.over) parts.push("Over " + best.over.v + " @ " + best.over.book);
      if (best.under) parts.push("Under " + best.under.v + " @ " + best.under.book);
    }
    if (!parts.length) return "";
    return '<div class="best-strip' + (enter ? " cf-enter" : "") + '" role="note"><span class="best-strip-hed">🐻 Best Bears prices</span>' +
      "<span>across " + lines.length + " " + (lines.length === 1 ? "book" : "books") + ":</span> " +
      "<b>" + parts.map(CF.esc).join("</b> · <b>") + "</b></div>";
  }
  function spreadRow(l, side, best, i) {
    const row = (key, label) => {
      const v = l.spread[key];
      const win = best && key === side && v != null && isBest(best.spread, l, i, v);
      return '<div class="odds-row"><span>Spread (' + label + ')</span><b class="' +
        (String(v).startsWith("-") ? "neg" : "pos") + (win ? " best" : "") + '">' +
        CF.esc(v == null ? "—" : fmtSigned(Number(v))) + (win ? bestChip("BEST") : "") + "</b></div>";
    };
    return row("home", "home") + row("away", "away");
  }
  function totalRow(l, best, i) {
    const v = Number(l.total);
    const over = best && isBest(best.over, l, i, v);
    const under = best && isBest(best.under, l, i, v);
    const chips = over && under ? bestChip("BEST O/U") : (over ? bestChip("BEST OVER") : (under ? bestChip("BEST UNDER") : ""));
    return '<div class="odds-row"><span>Total (O/U)</span><b class="' + ((over || under) ? "best" : "") + '">' +
      CF.esc(l.total) + chips + "</b></div>";
  }
  function mlRow(l, side, best, i) {
    const row = (key, label) => {
      const v = l.ml[key];
      const win = best && key === side && v != null && isBest(best.ml, l, i, v);
      const shown = v == null ? "—" : fmtSigned(Number(v));
      return '<div class="odds-row"><span>ML (' + label + ')</span><b class="' +
        (String(v).startsWith("-") ? "neg" : "pos") + (win ? " best" : "") + '">' +
        CF.esc(shown) + (win ? bestChip("BEST") : "") + "</b></div>";
    };
    return row("home", "home") + row("away", "away");
  }

  /* ---------- 2) Polymarket ---------- */
  async function loadPoly() {
    const box = CF.$("#poly-board");
    const pill = CF.$("#poly-pill");
    // v1.95.0 — the Polymarket pill joins the wire pill in saying "checking…"
    // while the fetch is in flight; the success path restores the real label
    // and the empty/error branches restore honest plain ones.
    if (pill) pill.textContent = "checking…";
    try {
      const events = await CF.API.getPolymarket(100);
      const bears = CF.API.polymarketBears(events);
      if (!bears.length) {
        box.innerHTML = '<div class="empty"><div class="big">🔮</div>No Bears markets found in the current feed. <a href="https://polymarket.com/nfl" target="_blank" rel="noopener">Browse all NFL markets ↗</a></div>';
        if (pill) pill.textContent = "Polymarket · no Bears markets";
        return;
      }
      let n = 0; // per-card stagger index for the first-paint entrance
      // v1.94.0 — the Polymarket header carries its own freshness stamp.
      CF.freshStamp(CF.$("#poly-pill"), "Polymarket · live", Date.now());
      box.innerHTML = bears.slice(0, 8).map((ev) => {
        const kpre = (ev.slug || ev.url || ev.title) + "::";
        return (ev.markets || []).map((m0) => {
          // v1.49.0 — line-movement chips vs the previous render (tracked on
          // the RAW feed values, so the chips report real feed movement even
          // when a side had to be derived for display below).
          const kY = kpre + m0.question + "::yes", kN = kpre + m0.question + "::no";
          const yesChip = CF.polyMoveChip(polyPrev[kY], m0.yes);
          const noChip = CF.polyMoveChip(polyPrev[kN], m0.no);
          polyPrev[kY] = m0.yes; polyPrev[kN] = m0.no;
          // v1.108.0 — complete a binary market before rendering, so both
          // chips always render when at least one side arrived.
          const m = completeBinary(m0);
          // v1.108.0 — cent prices: yes rounds normally; when both sides are
          // present the no side is 100 - yes so the pair always sums to 100
          // (fixes "Yes 51¢ / No 50¢" -> 101%). A lone side (non-binary)
          // rounds on its own.
          const yesCents = Number.isFinite(m.yes) ? Math.round(m.yes * 100) : null;
          const noCents = (yesCents != null && Number.isFinite(m.no))
            ? 100 - yesCents
            : (Number.isFinite(m.no) ? Math.round(m.no * 100) : null);
          // Implied-probability bar: a single fill against the track — the
          // convention every prediction-market fan already reads (Polymarket
          // and Kalshi both fill to the yes price). The old two-segment strip
          // (green yes sliver + full-width no bar) read as a broken visual at
          // the extreme leans that are normal in these markets; the fill plus
          // a 50/50 reference tick keeps the crowd's lean readable at any
          // price, next to the cent prices.
          // v1.108.0 — the alt text derives from the SAME rounded cent values
          // the chips use, so they can never disagree.
          const bar = yesCents != null
            ? '<span class="poly-bar" role="img" aria-label="Implied probability: ' + yesCents + "% yes, " + (100 - yesCents) + '% no">' +
              '<i class="fill" style="width:' + Math.max(0, Math.min(100, yesCents)) + '%"></i></span>'
            : "";
          return '<div class="poly-card' + (polyEntered ? "" : " cf-enter") + '" style="--ni:' + Math.min(n++, 12) + '">' +
          '<span class="q">' + CF.esc(m.question) + "</span>" +
          '<span class="pr">' +
          (yesCents != null ? '<span class="poly-price yes" title="implied ' + yesCents + '%">' + CF.esc(m.yesLabel) + ' ' + yesCents + "¢" + yesChip + "</span>" : "") +
          (noCents != null ? '<span class="poly-price no" title="implied ' + noCents + '%">' + CF.esc(m.noLabel) + ' ' + noCents + "¢" + noChip + "</span>" : "") +
          "</span>" +
          bar +
          '<span class="sub">' +
          (m.volume != null ? "Vol " + fmtPolyVol(m.volume) : "") +
          (m.endDate ? " · ends " + CF.fmtDate(m.endDate, { year: "numeric" }) : "") +
          ' · <a href="' + CF.esc(CF.safeURL(m.url)) + '" target="_blank" rel="noopener">market ↗</a>' +
          "</span></div>";
        }).join("");
      }).join("");
      polyEntered = true;
    } catch (e) {
      box.innerHTML = '<div class="empty"><div class="big">🔮</div>Polymarket didn\'t answer from this network. <a href="https://polymarket.com/nfl" target="_blank" rel="noopener">polymarket.com/nfl ↗</a></div>';
      // v1.95.0 — stop saying "checking…" when the feed already said no.
      if (pill) pill.textContent = "Polymarket · unavailable";
    }
  }

  /* ---------- 3) The Odds API (optional) ---------- */
  function loadStoredKey() {
    try {
      const k = localStorage.getItem(KEY_LS);
      if (k) CF.$("#odds-key").value = k;
    } catch (e) { /* private mode */ }
  }

  let loadingFullBoard = false;
  async function loadFullBoard() {
    if(loadingFullBoard) return;
    const key = (CF.$("#odds-key").value || "").trim();
    const box = CF.$("#oddsapi-board");
    if (!key) { CF.toast("Paste a key first — free at the-odds-api.com"); return; }
    loadingFullBoard = true;
    CF.$("#odds-key-go").disabled = true;
    try { localStorage.setItem(KEY_LS, key); } catch (e) { /* ignore */ }
    box.innerHTML = CF.emptyHTML({ icon: "🎲", title: "Summoning the books…", loading: true });
    try {
      const games = await CF.API.getOddsApi(key);
      const bears = games.filter((g) => /bears/i.test(g.home_team || "") || /bears/i.test(g.away_team || ""));
      if (!bears.length) {
        box.innerHTML = '<div class="empty" style="padding:18px">No Bears games in the next window on The Odds API — that usually means the next game is more than a few days out. The board re-fills as game day approaches.</div>';
        return;
      }
      const g = bears[0];
      const bearsSideFull = /bears/i.test(g.home_team || "") ? "home" : "away";
      const parsed = (g.bookmakers || []).map((b) => {
        const market=(key)=>(b.markets || []).find((m)=>m.key===key)?.outcomes || [];
        const spread=market("spreads").find((o)=>o.name===g.home_team);
        const total=market("totals").find((o)=>o.name==="Over");
        const ml=market("h2h"),home=ml.find((o)=>o.name===g.home_team),away=ml.find((o)=>o.name===g.away_team);
        const sp = spread && spread.point != null ? Number(spread.point) : null;
        const mlSide = bearsSideFull === "home" ? home : away;
        const mlp = mlSide && mlSide.price != null ? Number(mlSide.price) : null;
        return {b, spread, total, home, away,
          bearsSpread: sp != null && Number.isFinite(sp) ? (bearsSideFull === "home" ? sp : -sp) : null,
          bearsML: mlp != null && Number.isFinite(mlp) ? mlp : null};
      });
      const bestSpreadFull = parsed.reduce((a, r) => (r.bearsSpread != null && (a == null || r.bearsSpread > a) ? r.bearsSpread : a), null);
      const bestMLFull = parsed.reduce((a, r) => (r.bearsML != null && (a == null || r.bearsML > a) ? r.bearsML : a), null);
      const rows = parsed.map((r) => {
        const price=(n)=>n==null ? "—" : (Number(n)>0 ? "+" : "") + n;
        const sBest = bestSpreadFull != null && r.bearsSpread === bestSpreadFull;
        const mBest = bestMLFull != null && r.bearsML === bestMLFull;
        const mlCell = (o) => {
          if (!o || o.price == null) return "—";
          const isB = mBest && ((bearsSideFull === "home" && o === r.home) || (bearsSideFull === "away" && o === r.away));
          return '<span class="mlx' + (isB ? " best" : "") + '">' + CF.esc(price(o.price)) + "</span>" + (isB ? bestChip("BEST") : "");
        };
        return '<tr><td class="strong">'+CF.esc(r.b.title || r.b.key)+'</td>' +
          '<td class="num'+(sBest ? " best" : "")+'">'+(r.spread ? CF.esc(price(r.spread.point)+" ("+price(r.spread.price)+")") : "—")+(sBest ? bestChip("BEST") : "")+'</td>' +
          '<td class="num">'+CF.esc(r.total?.point ?? "—")+'</td>' +
          '<td class="num">'+mlCell(r.home)+" / "+mlCell(r.away)+'</td>' +
          '<td class="dim">'+CF.esc(r.b.last_update ? CF.fmtTime(r.b.last_update) : "—")+'</td></tr>';
      });
      box.innerHTML =
        '<div class="tbl-wrap"><table class="tbl" style="min-width:480px"><caption class="sr-only">Odds by sportsbook</caption><thead><tr>' +
        "<th scope=\"col\">Book</th><th scope=\"col\" class=\"num\">Spread</th><th scope=\"col\" class=\"num\">O/U</th><th scope=\"col\" class=\"num\">ML home/away</th><th scope=\"col\">Updated</th>" +
        "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>" +
        '<p class="src-note">' + CF.esc(g.away_team + " at " + g.home_team) + " · " + new Date(g.commence_time).toLocaleString() +
        " · source: The Odds API (your key) · usage depends on your plan · orange = best Bears price</p>";
    } catch (e) {
      box.innerHTML = '<div class="empty" style="padding:18px">The Odds API said no (' + "request unavailable" + '). Check the key, or the free-tier quota.</div>';
    } finally { loadingFullBoard = false; CF.$("#odds-key-go").disabled = false; }
  }

  /* ---------- v1.95.0 — the ↻ button admits when it's working ----------
     Manual refresh and the 60s auto-beat both funnel through refreshOdds: the
     button disables (v1.92.0's honest :disabled affordance does the visuals),
     flips to a spinning "Checking…", and the two boards can never double-
     render from a spam-clicked or overlapping refresh. An auto-beat that lands
     mid-refresh stands down — the in-flight run already has the fresh data. */
  let oddsBusy = false;
  function setOddsBusy(busy) {
    oddsBusy = busy;
    const btn = CF.$("#odds-refresh");
    if (!btn) return;
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
    btn.innerHTML = busy
      ? '<span class="cf-spin" aria-hidden="true">↻</span> Checking…'
      : "↻ Refresh";
  }
  function refreshOdds() {
    if (oddsBusy) return;
    setOddsBusy(true);
    Promise.allSettled([loadWireOdds(), loadPoly()]).finally(() => setOddsBusy(false));
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadStoredKey();
    refreshOdds();
    CF.$("#odds-refresh").addEventListener("click", refreshOdds);
    CF.$("#odds-key-go").addEventListener("click", loadFullBoard);
    CF.$("#odds-key").addEventListener("keydown", (event) => { if (event.key === "Enter") loadFullBoard(); });
    CF.$("#odds-key-clear").addEventListener("click", () => {
      CF.$("#odds-key").value = "";
      try { localStorage.removeItem(KEY_LS); } catch (e) { /* ignore */ }
      CF.$("#oddsapi-board").innerHTML = "";
      CF.toast("Key cleared from this browser");
    });
    // Auto-refresh odds + markets every 60 s while the tab is open (CF.refresh
    // in common.js handles hidden-tab skip + catch-up on return; refreshOdds
    // carries the in-flight guard so a beat that lands mid-refresh stands down).
    // The Odds API full board stays manual on purpose: free tier is 500 req/mo.
    CF.refresh.register(refreshOdds, 60e3);
  });
})();
