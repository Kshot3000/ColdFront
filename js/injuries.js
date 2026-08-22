/* THE COLD FRONT — injuries: local report table + live injury wire */
"use strict";

(function () {
  const INJURY_RE = /\b(injur|out\b|questionable|doubtful|day-to-day|ripgate|concussion|fracture|sprain|torn|surgery|sideline|report|ankle|knee|shoulder|hamstring|calf|rib|back|groin)\b/i;

  function statusCls(s) {
    const x = (s || "").toLowerCase();
    if (x.includes("out")) return "out";
    if (x.includes("questionable")) return "questionable";
    if (x.includes("doubtful")) return "doubtful";
    if (x.includes("day")) return "day-to-day";
    return "active";
  }

  async function loadReport() {
    const body = CF.$("#report-table tbody");
    const pill = CF.$("#rep-pill");
    const note = CF.$("#rep-note");
    try {
      const r = await fetch("data/injuries.json", { cache: "no-cache" });
      const data = await r.json();
      const rows = (data.rows || []).filter((row) => row.name && row.name !== "—");
      pill.textContent = "community report";
      if (data.updated) note.textContent = "Last updated in the repo: " + data.updated + ".";
      body.innerHTML = rows.length
        ? rows.map((row) =>
            "<tr><td class=\"strong\">" + CF.esc(row.name) + "</td>" +
            "<td>" + CF.esc(row.pos || "—") + "</td>" +
            "<td>" + CF.esc(row.injury || "—") + "</td>" +
            '<td><span class="st ' + CF.esc(row.statusCls || statusCls(row.status)) + '">' + CF.esc(row.status || "—") + "</span></td>" +
            "<td class=\"dim\">" + CF.esc(row.eta || "") + "</td></tr>"
          ).join("")
        : '<tr><td colspan="5" class="dim">No rows in the report right now — either everyone is healthy (suspicious) or the table is waiting for its first update. The wire on the right has the live picture.</td></tr>';
    } catch (e) {
      pill.className = "pill sample";
      body.innerHTML = '<tr><td colspan="5" class="dim">Report file unavailable.</td></tr>';
    }
  }

  async function loadWire() {
    const box = CF.$("#wire-list");
    try {
      const news = await CF.API.getNews();
      const items = (news || []).filter((n) => INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || ""));
      if (!items.length) {
        box.innerHTML = '<div class="empty" style="padding:18px 14px;font-size:12.5px">The wire is answering, but nothing on it mentions a body part right now.</div>';
        return;
      }
      box.innerHTML = items.slice(0, 10).map((n) => {
        const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
        return '<div class="news-item" style="grid-template-columns:1fr;padding:12px 14px">' +
          '<a class="headline" style="font-size:13.5px" href="' + CF.esc(href) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "") + "</a>" +
          '<div class="meta"><span>' + CF.timeAgo(n.published) + "</span></div></div>";
      }).join("");
    } catch (e) {
      box.innerHTML = '<div class="empty" style="padding:18px 14px;font-size:12.5px">Injury wire offline. <a href="https://www.espn.com/nfl/team/_/name/chi/" target="_blank" rel="noopener">ESPN Bears ↗</a></div>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadReport();
    loadWire();
    CF.$("#wire-refresh").addEventListener("click", () => { CF.toast("Refreshing the wire…"); loadWire(); });
    // Keep both sides moving for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadWire, 5 * 60e3);              // live injury wire: 5 min
    CF.refresh.register(loadReport, 5 * 60e3, { name: "report" }); // local report (repo JSON): 5 min
  });
})();
