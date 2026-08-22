/* THE COLD FRONT — news wire */
"use strict";

(function () {
  const INJURY_RE = /\b(injur|injuried|out\b|questionable|doubtful|day-to-day|ripgate|concussion|fracture|sprain|torn|surgery|sideline|report)\b/i;

  function itemHTML(n) {
    const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
    const img = n.images && n.images[0] ? n.images[0].url : null;
    const thumb = img
      ? '<img class="thumb" loading="lazy" src="' + CF.esc(img) + '" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'thumb-fallback\',textContent:\'❄\'}))">'
      : '<div class="thumb-fallback">❄</div>';
    return '<div class="news-item"><div>' +
      '<a class="headline" href="' + CF.esc(href) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "Bears wire") + "</a>" +
      (n.description ? '<p class="dim" style="font-size:13px;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + CF.esc(n.description) + "</p>" : "") +
      '<div class="meta"><span>' + CF.esc((n.authors && n.authors[0] && n.authors[0].name) || "The Wire") + "</span><span>" + CF.timeAgo(n.published) + "</span></div>" +
      "</div>" + thumb + "</div>";
  }

  /* Wide-wire (Google News RSS) item, same card shape as the ESPN wire. */
  function wideHTML(it) {
    return '<div class="news-item"><div>' +
      '<a class="headline" href="' + CF.esc(it.link) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
      (it.desc ? '<p class="dim" style="font-size:13px;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + CF.esc(it.desc) + "</p>" : "") +
      '<div class="meta"><span>' + CF.esc(it.source || "the wide wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
      '</div><div class="thumb-fallback">❄</div></div>';
  }
  const wideInj = (it) => INJURY_RE.test(it.title || "") || INJURY_RE.test(it.desc || "");

  /* Main wire: ESPN league wire first; when it's quiet (offseason) or
     unreachable, the Google News wide wire carries the panel. The injury
     rail pulls from whichever source(s) answered. */
  async function load() {
    const pill = CF.$("#feed-pill");
    const updated = CF.$("#feed-updated");
    pill.textContent = "connecting…";
    let listHTML = "", injHTML = "", count = 0, src = "";

    // 1) ESPN league wire.
    try {
      const news = await CF.API.getNews();
      const items = news || [];
      if (items.length) {
        listHTML = items.map(itemHTML).join("");
        count = items.length;
        src = "live wire";
        const inj = items.filter((n) => INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || ""));
        injHTML = inj.map(itemHTML).join("");
      }
    } catch (e) { /* league wire silent or down */ }

    // 2) Wide wire (Google News RSS, 100+ outlets).
    if (!listHTML) {
      try {
        const items = await CF.API.getGoogleNews("Chicago Bears", 15);
        if (items.length) {
          listHTML = items.map(wideHTML).join("");
          count = items.length;
          src = "wide wire · " + (items[0].source ? items[0].source + " et al." : "multi-outlet");
          injHTML = items.filter(wideInj).map(wideHTML).join("");
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
          injHTML = rows.slice(0, 8).map((row) =>
            '<div class="news-item"><div>' +
            '<a class="headline" href="' + (row.url ? CF.esc(row.url) : "injuries.html") + '" target="_blank" rel="noopener">' + CF.esc(row.name + " — " + (row.comment || row.status)) + "</a>" +
            '<div class="meta"><span>' + CF.esc(row.status) + "</span><span>" + CF.timeAgo(row.date) + "</span></div></div>"
          ).join("");
        }
      } catch (e) { /* report silent */ }
    }

    if (listHTML) {
      CF.$("#news-list").innerHTML = listHTML;
      CF.$("#injury-news").innerHTML = injHTML ||
        '<div class="empty" style="padding:18px 14px;font-size:12.5px">Nothing flagged on the wire right now — the <a href="injuries.html">report page</a> has the full list.</div>';
      pill.className = "pill ok";
      pill.textContent = src + " · " + count + " stories";
      updated.textContent = "updated " + new Date().toLocaleTimeString();
    } else {
      pill.className = "pill sample";
      pill.textContent = "offline — snapshot unavailable";
      CF.$("#news-list").innerHTML =
        '<div class="empty"><div class="big">📡</div>' +
        "Both wires are unreachable from this network and no snapshot is saved on this device yet.<br>" +
        "Visit while online once and the feeds will cache themselves for offline reading.<br><br>" +
        '<a class="btn primary small" href="https://www.espn.com/nfl/team/_/name/chi/news/" target="_blank" rel="noopener">ESPN Bears news ↗</a> ' +
        '<a class="btn small" href="https://news.google.com/search?q=Chicago%20Bears&hl=en-US&gl=US&ceid=US:en" target="_blank" rel="noopener">Google News ↗</a> ' +
        '<a class="btn small" href="https://www.chicagobears.com/news" target="_blank" rel="noopener">Bears.com ↗</a></div>';
      CF.$("#injury-news").innerHTML =
        '<div class="empty" style="padding:18px 14px;font-size:12.5px">Injury wire offline. The <a href="injuries.html">report page</a> still works.</div>';
    }
  }

  /* ---------- second source: Google News RSS ("Chicago Bears") ---------- */
  async function loadGoogle() {
    const pill = CF.$("#gn-pill");
    const list = CF.$("#gn-list");
    if (!pill || !list) return;
    try {
      const items = await CF.API.getGoogleNews('Chicago Bears', 10);
      list.innerHTML = items.map((it) =>
        '<div class="news-item"><div>' +
        '<a class="headline" href="' + CF.esc(it.link) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
        '<div class="meta"><span>' + CF.esc(it.source || "the wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div>" +
        "</div></div>"
      ).join("");
      pill.className = "pill ok";
      pill.textContent = "live · " + items.length + " stories";
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      list.innerHTML =
        '<div class="empty"><div class="big">📰</div>' +
        "The wide wire is unreachable from this network right now.<br>" +
        '<a class="btn small" style="display:inline-flex;margin-top:12px" href="https://news.google.com/search?q=Chicago%20Bears&hl=en-US&gl=US&ceid=US:en" target="_blank" rel="noopener">Read it on Google News ↗</a></div>';
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
