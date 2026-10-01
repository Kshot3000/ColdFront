/* THE COLD FRONT — news wire */
"use strict";

(function () {
  /* v1.122.0 — mirrors CF.thumbGlyph's injury branch in js/common.js (which
     documents the pairing): recovery-shaped stories ("Behind the recovery
     process…") belong in the injury rail with the bandage, not the snowflake. */
  const INJURY_RE = /\b(injur(?:y|ies|ed)?|out\b|questionable|doubtful|day-to-day|concussion|fracture|sprain|torn|surgery|sideline|recover(?:y|ies|ing|ed)?|report)\b/i;

  // v1.36.0 — .cf-enter on first paint only; the 5-minute auto-refresh and
  // the manual refresh re-renders stay instant.
  let wireEntered = false;
  function enterAttrs(i, enter) {
    return enter ? ' cf-enter" style="--ni:' + Math.min(i, 12) : "";
  }

  /* v1.106.0 — the wire's fallback thumbnails were all the same snowflake
     box: when ESPN's images 404 (hotlink protection) or the wide wire ships
     none, the list read as a wall of identical ❄ tiles. Fallbacks now carry
     a story-aware glyph (injury / game / roster move / brand snowflake) and
     one of four whisper-quiet tints keyed off the headline, so neighboring
     cards read as distinct stories instead of the same missing image.
     v1.116.0 — the glyph/tint logic moved to CF.thumbGlyph/CF.thumbTint in
     common.js so the home page's Fresh-off-the-wire cards share the exact
     same story-aware treatment. */
  function thumbGlyph(n) { return CF.thumbGlyph(n); }
  function thumbTint(n) { return CF.thumbTint(n); }
  function thumbHTML(n, img) {
    const glyph = thumbGlyph(n), tint = thumbTint(n);
    if (!img) return '<div class="thumb-fallback ' + tint + '" data-glyph="' + glyph + '">' + glyph + "</div>";
    return '<img class="thumb" loading="lazy" src="' + CF.esc(img) + '" alt=""' +
      ' data-glyph="' + glyph + '" data-tint="' + tint + '" onerror="CF.thumbFallback(this)">';
  }

  function itemHTML(n, i, enter) {
    const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
    const img = n.images && n.images[0] ? n.images[0].url : null;
    const thumb = thumbHTML(n, img);
    return '<div class="news-item' + enterAttrs(i, enter) + '"><div>' +
      '<a class="headline" href="' + CF.esc(CF.safeURL(href)) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "Bears wire") + "</a>" +
      (n.description ? '<p class="dim" style="font-size:13px;margin-top:5px">' + CF.esc(CF.truncateWords(n.description, 140)) + "</p>" : "") +
      '<div class="meta"><span>' + CF.esc((n.authors && n.authors[0] && n.authors[0].name) || "The Wire") + "</span><span>" + CF.timeAgo(n.published) + "</span></div>" +
      "</div>" + thumb + "</div>";
  }

  /* Wide-wire (Google News RSS) item, same card shape as the ESPN wire. */
  function wideHTML(it, i, enter) {
    return '<div class="news-item' + enterAttrs(i, enter) + '"><div>' +
      '<a class="headline" href="' + CF.esc(CF.safeURL(it.link)) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
      (it.desc ? '<p class="dim" style="font-size:13px;margin-top:5px">' + CF.esc(CF.truncateWords(it.desc, 140)) + "</p>" : "") +
      '<div class="meta"><span>' + CF.esc(it.source || "the wide wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
      '</div>' + thumbHTML(it, null) + "</div>";
  }
  const wideInj = (it) => INJURY_RE.test(it.title || "") || INJURY_RE.test(it.desc || "");

  /* Dedupe across the three feeds: the same story repeats on the main wire,
     the injury rail, and the wide wire. The main wire and the injury rail
     PARTITION each feed (non-injury vs injury-shaped), so no story appears
     twice by construction; both rendered lists seed the seen set, and the
     wide wire (loadGoogle, which awaits mainWireReady) skips any normalized
     headline already shown in either. */
  const normHeadline = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const wireSeen = new Set();
  const markSeen = (items, head) => items.forEach((it) => wireSeen.add(normHeadline(head(it))));
  let mainWireReady = Promise.resolve();

  /* Main wire: ESPN league wire first; when it's quiet (offseason) or
     unreachable, the Google News wide wire carries the panel. The injury
     rail pulls from whichever source(s) answered. */
  async function load() {
    let resolveMain = null;
    mainWireReady = new Promise((res) => { resolveMain = res; });
    try {
    wireSeen.clear(); // fresh pass — the main wire re-seeds the set below
    const enter = !wireEntered; // this render pass's entrance decision
    const pill = CF.$("#feed-pill");
    pill.textContent = "connecting…";
    const newsList = CF.$("#news-list");
    const injBox = CF.$("#injury-news");
    if (newsList) newsList.innerHTML = CF.emptyHTML({ icon: "📡", title: "Tuning in", sub: "League wire first — then we keep the rail warm.", loading: true });
    if (injBox) injBox.innerHTML = CF.emptyHTML({ icon: "🩹", title: "Scanning the rail", sub: "Flagging report-shaped headlines.", loading: true, style: "padding:18px 14px" });
    let listHTML = "", injHTML = "", count = 0, src = "";

    // 1) ESPN league wire — partitioned, not subsetted: the main wire renders
    //    the non-injury items and the injury rail renders the injury items, so
    //    no story appears twice by construction. If every item is
    //    injury-shaped, the main wire keeps the whole feed and the rail falls
    //    back to the league-report rows (step 3).
    try {
      const news = await CF.API.getNews();
      const items = news || [];
      if (items.length) {
        const inj = items.filter((n) => INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || ""));
        const rest = items.filter((n) => inj.indexOf(n) < 0);
        const mainItems = rest.length ? rest : items;
        const railItems = rest.length ? inj : [];
        listHTML = mainItems.map((n, i) => itemHTML(n, i, enter)).join("");
        count = mainItems.length;
        src = CF.sourceLabel(CF.API.newsSource);
        markSeen(mainItems, (n) => n.heading || n.title);
        markSeen(railItems, (n) => n.heading || n.title);
        injHTML = railItems.map((n, i) => itemHTML(n, i, enter)).join("");
      }
    } catch (e) { /* league wire silent or down */ }

    // 2) Wide wire (Google News RSS, 100+ outlets) — same partition rule.
    if (!listHTML) {
      try {
        const items = await CF.API.getGoogleNews("Chicago Bears", 15);
        if (items.length) {
          const injAll = items.filter(wideInj);
          const rest = items.filter((it) => injAll.indexOf(it) < 0);
          const mainItems = rest.length ? rest : items;
          const railItems = rest.length ? injAll : [];
          listHTML = mainItems.map((it, i) => wideHTML(it, i, enter)).join("");
          count = mainItems.length;
          src = "wide wire · " + (items[0].source ? items[0].source + " et al." : "multi-outlet");
          markSeen(mainItems, (it) => it.title);
          markSeen(railItems, (it) => it.title);
          injHTML = railItems.map((it, i) => wideHTML(it, i, enter)).join("");
        }
      } catch (e) { /* both down */ }
    }

    // 3) Whatever injury material the league report already surfaced.
    if (!injHTML) {
      try {
        const r = await CF.API.getLeagueInjuries();
        const x = CF.API.bearsInjuryRows(r.data);
        const rows = x.rows
          .filter((row) => row.status && row.status.toLowerCase() !== "active" && row.comment)
          .filter((row) => !wireSeen.has(normHeadline(row.name)));
        markSeen(rows, (row) => row.name);
        if (rows.length) {
          // v1.68.0 — same compact rule as the injuries page: the player
          // name is the headline and the story becomes a 3-line excerpt.
          injHTML = rows.slice(0, 8).map((row, idx) =>
            '<div class="news-item' + enterAttrs(idx, enter) + '"><div>' +
            '<a class="headline" href="' + (row.url ? CF.esc(CF.safeURL(row.url)) : "injuries.html") + '" target="_blank" rel="noopener">' + CF.esc(row.name) + "</a>" +
            (row.comment ? '<p class="inj-excerpt">' + CF.esc(row.comment) + "</p>" : "") +
            '<div class="meta"><span>' + CF.esc(row.status) + "</span><span>" + CF.timeAgo(row.date) + "</span></div></div>"
          ).join("");
        }
      } catch (e) { /* report silent */ }
    }

    if (listHTML) {
      CF.$("#news-list").innerHTML = listHTML;
      wireEntered = true; // first paint done — refreshes stay instant
      CF.$("#injury-news").innerHTML = injHTML || CF.emptyHTML({
        icon: "🩹",
        title: "Nothing flagged",
        sub: "Nothing flagged on the wire right now — the report page has the full list.",
        action: '<a class="btn small" style="display:inline-flex;margin-top:12px" href="injuries.html">Injury report →</a>',
        style: "padding:18px 14px",
      });
      pill.className = "pill ok";
      // v1.94.0 — the pill says when the wire was last read, not just its source.
      // v1.127.0 — the stamp wears the winning feed's own age: the ESPN path
      // reads the news payload's timestamp; the wide-wire path reads the RSS
      // snapshot's harvest time when it served one.
      const wideSnap = src.indexOf("wide wire") === 0 && CF.API.rssSource === "cache" && CF.API.rssEpoch;
      CF.freshStamp(pill, src + " · " + count + " stories", wideSnap ? CF.API.rssEpoch : CF.dataEpoch(CF.API.newsSource));
    } else {
      pill.className = "pill sample";
      pill.textContent = "offline — snapshot unavailable";
      CF.$("#news-list").innerHTML = CF.emptyHTML({
        icon: "📡",
        title: "Both wires are dark",
        sub: "Unreachable from this network and no snapshot is saved on this device yet. Visit while online once and the feeds cache themselves for offline reading.",
        action: '<a class="btn primary small" style="display:inline-flex;margin-top:12px" href="https://www.espn.com/nfl/team/_/name/chi/news/" target="_blank" rel="noopener">ESPN Bears news ↗</a> '
          + '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://news.google.com/search?q=Chicago%20Bears&hl=en-US&gl=US&ceid=US:en" target="_blank" rel="noopener">Google News ↗</a> '
          + '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://www.chicagobears.com/news" target="_blank" rel="noopener">Bears.com ↗</a>',
      });
      CF.$("#injury-news").innerHTML = CF.emptyHTML({
        icon: "🩹",
        title: "Injury wire offline",
        sub: "The report page still works.",
        action: '<a class="btn small" style="display:inline-flex;margin-top:12px" href="injuries.html">Injury report →</a>',
        style: "padding:18px 14px",
      });
    }
    } finally {
      resolveMain(); // the wide wire may now build — it dedupes against the seen set
    }
  }

  /* ---------- second source: Google News RSS ("Chicago Bears") ---------- */
  async function loadGoogle() {
    // The main wire builds first; the wide wire skips anything already shown
    // on the main wire or the injury rail.
    try { await mainWireReady; } catch (e) { /* main wire never resolved — carry on */ }
    const enter = !wireEntered; // this render pass's entrance decision
    const pill = CF.$("#gn-pill");
    const list = CF.$("#gn-list");
    if (!pill || !list) return;
    list.innerHTML = CF.emptyHTML({ icon: "📰", title: "Tuning the shortwave", sub: "Wide wire across outlets — same story, every angle.", loading: true });
    try {
      const items = await CF.API.getGoogleNews('Chicago Bears', 10);
      if (!items.length) throw new Error("empty wide wire");
      const fresh = items.filter((it) => {
        const h = normHeadline(it.title);
        if (!h || wireSeen.has(h)) return false;
        wireSeen.add(h);
        return true;
      });
      if (fresh.length) {
        list.innerHTML = fresh.map((it, i) =>
          '<div class="news-item' + enterAttrs(i, enter) + '"><div>' +
          '<a class="headline" href="' + CF.esc(CF.safeURL(it.link)) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
          '<div class="meta"><span>' + CF.esc(it.source || "the wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
          "</div></div>"
        ).join("");
        wireEntered = true; // first paint done — refreshes stay instant
        pill.className = "pill ok";
        pill.textContent = "live · " + fresh.length + " stories";
      } else {
        // Every wide story already ran on the main wire or the injury rail —
        // not an outage, just nothing new to show.
        list.innerHTML = CF.emptyHTML({
          icon: "📰",
          title: "Nothing new on the wide wire",
          sub: "Every story up top already ran on the main wire or the injury rail.",
        });
        pill.className = "pill ok";
        pill.textContent = "live · all stories already shown";
      }
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      list.innerHTML = CF.emptyHTML({
        icon: "📰",
        title: "Wide wire unreachable",
        sub: "The wide wire is unreachable from this network right now.",
        action: '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://news.google.com/search?q=Chicago%20Bears&hl=en-US&gl=US&ceid=US:en" target="_blank" rel="noopener">Read it on Google News ↗</a>',
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    loadGoogle();
    CF.$("#refresh").addEventListener("click", () => {
      CF.toast("Refreshing the wire…");
      load();
      loadGoogle();
    });
    // Auto-refresh every 5 min while the tab is open (CF.refresh in common.js
    // already handles hidden-tab skip + catch-up on return).
    CF.refresh.register(load, 5 * 60e3, { name: "wire" });
    CF.refresh.register(loadGoogle, 5 * 60e3, { name: "wide wire" });
  });
})();
