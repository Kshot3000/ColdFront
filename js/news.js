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

  async function load() {
    const pill = CF.$("#feed-pill");
    const updated = CF.$("#feed-updated");
    pill.textContent = "connecting…";
    try {
      const news = await CF.API.getNews();
      const items = news || [];
      if (!items.length) throw new Error("empty feed");
      CF.$("#news-list").innerHTML = items.map(itemHTML).join("");
      const inj = items.filter((n) => INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || ""));
      CF.$("#injury-news").innerHTML = inj.length
        ? inj.slice(0, 8).map(itemHTML).join("")
        : '<div class="empty" style="padding:18px 14px;font-size:12.5px">Nothing flagged on the wire right now.</div>';
      pill.className = "pill ok";
      pill.textContent = "live wire · " + items.length + " stories";
      updated.textContent = "updated " + new Date().toLocaleTimeString();
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline — snapshot unavailable";
      CF.$("#news-list").innerHTML =
        '<div class="empty"><div class="big">📡</div>' +
        "The wire is unreachable from this network and no snapshot is saved on this device yet.<br>" +
        "Visit while online once and the feed will cache itself for offline reading.<br><br>" +
        '<a class="btn primary small" href="https://www.espn.com/nfl/team/_/name/chi/news/" target="_blank" rel="noopener">ESPN Bears news ↗</a> ' +
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
