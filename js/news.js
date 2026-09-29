/* THE COLD FRONT — news wire */
"use strict";

(function () {
  const INJURY_RE = /\b(injur(?:y|ies|ed)?|out\b|questionable|doubtful|day-to-day|concussion|fracture|sprain|torn|surgery|sideline|report)\b/i;

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
     cards read as distinct stories instead of the same missing image. */
  function thumbGlyph(n) {
    const t = ((n.heading || n.title || "") + " " + (n.description || n.desc || "")).toLowerCase();
    if (INJURY_RE.test(t)) return "🩹";
    if (/\b(game|win|wins|loss|beat|beats|recap|score|touchdown|field goal|overtime|playoff|playoffs|kickoff|sunday|monday|thursday)\b/.test(t)) return "🏈";
    if (/\b(trade|traded|sign|signed|signing|contract|extension|roster|draft|drafted|waive|waived|release|hire|hired|fired|coach|gm)\b/.test(t)) return "📋";
    return "❄";
  }
  function thumbTint(n) {
    const s = String(n.heading || n.title || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "tf-t" + (h % 4);
  }
  function thumbHTML(n, img) {
    const glyph = thumbGlyph(n), tint = thumbTint(n);
    if (!img) return '<div class="thumb-fallback ' + tint + '">' + glyph + "</div>";
    return '<img class="thumb" loading="lazy" src="' + CF.esc(img) + '" alt=""' +
      ' data-glyph="' + glyph + '" data-tint="' + tint + '" onerror="CF.thumbFallback(this)">';
  }

  function itemHTML(n, i, enter) {
    const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
    const img = n.images && n.images[0] ? n.images[0].url : null;
    const thumb = thumbHTML(n, img);
    return '<div class="news-item' + enterAttrs(i, enter) + '"><div>' +
      '<a class="headline" href="' + CF.esc(CF.safeURL(href)) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "Bears wire") + "</a>" +
      (n.description ? '<p class="dim" style="font-size:13px;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + CF.esc(n.description) + "</p>" : "") +
      '<div class="meta"><span>' + CF.esc((n.authors && n.authors[0] && n.authors[0].name) || "The Wire") + "</span><span>" + CF.timeAgo(n.published) + "</span></div>" +
      "</div>" + thumb + "</div>";
  }

  /* Wide-wire (Google News RSS) item, same card shape as the ESPN wire. */
  function wideHTML(it, i, enter) {
    return '<div class="news-item' + enterAttrs(i, enter) + '"><div>' +
      '<a class="headline" href="' + CF.esc(CF.safeURL(it.link)) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
      (it.desc ? '<p class="dim" style="font-size:13px;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + CF.esc(it.desc) + "</p>" : "") +
      '<div class="meta"><span>' + CF.esc(it.source || "the wide wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
      '</div>' + thumbHTML(it, null) + "</div>";
  }
  const wideInj = (it) => INJURY_RE.test(it.title || "") || INJURY_RE.test(it.desc || "");

  /* Main wire: ESPN league wire first; when it's quiet (offseason) or
     unreachable, the Google News wide wire carries the panel. The injury
     rail pulls from whichever source(s) answered. */
  async function load() {
    const enter = !wireEntered; // this render pass's entrance decision
    const pill = CF.$("#feed-pill");
    pill.textContent = "connecting…";
    const newsList = CF.$("#news-list");
    const injBox = CF.$("#injury-news");
    if (newsList) newsList.innerHTML = CF.emptyHTML({ icon: "📡", title: "Tuning in", sub: "League wire first — then we keep the rail warm.", loading: true });
    if (injBox) injBox.innerHTML = CF.emptyHTML({ icon: "🩹", title: "Scanning the rail", sub: "Flagging report-shaped headlines.", loading: true, style: "padding:18px 14px" });
    let listHTML = "", injHTML = "", count = 0, src = "";

    // 1) ESPN league wire.
    try {
      const news = await CF.API.getNews();
      const items = news || [];
      if (items.length) {
        listHTML = items.map((n, i) => itemHTML(n, i, enter)).join("");
        count = items.length;
        src = CF.sourceLabel(CF.API.newsSource);
        const inj = items.filter((n) => INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || ""));
        injHTML = inj.map((n, i) => itemHTML(n, i, enter)).join("");
      }
    } catch (e) { /* league wire silent or down */ }

    // 2) Wide wire (Google News RSS, 100+ outlets).
    if (!listHTML) {
      try {
        const items = await CF.API.getGoogleNews("Chicago Bears", 15);
        if (items.length) {
          listHTML = items.map((it, i) => wideHTML(it, i, enter)).join("");
          count = items.length;
          src = "wide wire · " + (items[0].source ? items[0].source + " et al." : "multi-outlet");
          injHTML = items.filter(wideInj).map((it, i) => wideHTML(it, i, enter)).join("");
        }
      } catch (e) { /* both down */ }
    }

    // 3) Whatever injury material the league report already surfaced.
    if (!injHTML) {
      try {
        const r = await CF.API.getLeagueInjuries();
        const x = CF.API.bearsInjuryRows(r.data);
        const rows = x.rows.filter((row) => row.status && row.status.toLowerCase() !== "active" && row.comment);
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
      CF.freshStamp(pill, src + " · " + count + " stories", Date.now());
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
  }

  /* ---------- second source: Google News RSS ("Chicago Bears") ---------- */
  async function loadGoogle() {
    const enter = !wireEntered; // this render pass's entrance decision
    const pill = CF.$("#gn-pill");
    const list = CF.$("#gn-list");
    if (!pill || !list) return;
    list.innerHTML = CF.emptyHTML({ icon: "📰", title: "Tuning the shortwave", sub: "Wide wire across outlets — same story, every angle.", loading: true });
    try {
      const items = await CF.API.getGoogleNews('Chicago Bears', 10);
      if (!items.length) throw new Error("empty wide wire");
      list.innerHTML = items.map((it, i) =>
        '<div class="news-item' + enterAttrs(i, enter) + '"><div>' +
        '<a class="headline" href="' + CF.esc(CF.safeURL(it.link)) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
        '<div class="meta"><span>' + CF.esc(it.source || "the wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
        "</div></div>"
      ).join("");
      wireEntered = true; // first paint done — refreshes stay instant
      pill.className = "pill ok";
      pill.textContent = "live · " + items.length + " stories";
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
