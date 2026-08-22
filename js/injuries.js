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

  /* The table prefers live data: league report (per-player status +
     editorial notes) → roster flags → community JSON. */
  function reportRow(row, eta) {
    return "<tr><td class=\"strong\">" + CF.esc(row.name) +
      (row.url ? ' <a href="' + CF.esc(row.url) + '" target="_blank" rel="noopener" title="Profile">↗</a>' : "") +
      "</td>" +
      "<td>" + CF.esc(row.pos || "—") + "</td>" +
      "<td>" + CF.esc(row.comment || row.injury || "—") + "</td>" +
      '<td><span class="st ' + CF.esc(CF.injStatusCls(row.status)) + '">' + CF.esc(row.status || "—") + "</span></td>" +
      '<td class="dim">' + CF.esc(eta || (row.date ? CF.fmtDate(row.date) : "")) + "</td></tr>";
  }

  async function loadReport() {
    const body = CF.$("#report-table tbody");
    const pill = CF.$("#rep-pill");
    const note = CF.$("#rep-note");

    // 1) API-Sports (BYO key) — structured injury rows with ETAs.
    if (CF.API.apisportsKey()) {
      try {
        const rows = await CF.API.apisportsInjuries();
        if (rows && rows.length) {
          pill.className = "pill ok";
          pill.textContent = "live · API-Sports";
          note.textContent = "Structured injury rows via API-Sports (key set on this device). Cross-check with the official pregame report.";
          body.innerHTML = rows.map((row) => reportRow(row, row.eta)).join("");
          return;
        }
      } catch (e) { /* fall through to the league report */ }
    }

    // 2) ESPN league-wide report — per-player status + the notes that
    //    feed the wire.
    try {
      const r = await CF.API.getLeagueInjuries();
      const x = CF.API.bearsInjuryRows(r.data);
      const rows = x.rows.filter((row) => row.status && row.status.toLowerCase() !== "active");
      if (rows.length) {
        pill.className = "pill ok";
        pill.textContent = "live · league report";
        note.textContent = "From the league wire (" + rows.length + " listed) — the wire on the right carries the story behind each one. Always cross-check with the official pregame report.";
        body.innerHTML = rows.map((row) => reportRow(row)).join("");
        return;
      }
    } catch (e) { /* league feed silent */ }

    // 3) Roster flags (IR group + per-player injury notes).
    try {
      const r2 = await CF.API.getRoster();
      const rows = CF.API.rosterInjuryRows(r2.data);
      if (rows.length) {
        pill.className = "pill ok";
        pill.textContent = "live · roster report";
        note.textContent = "Pulled from the live roster's injury flags. Cross-check with the official pregame report.";
        body.innerHTML = rows.map((row) => reportRow(row)).join("");
        return;
      }
    } catch (e2) { /* roster silent too */ }

    // 4) Community-maintained JSON, last resort.
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
    } catch (e3) {
      pill.className = "pill sample";
      body.innerHTML = '<tr><td colspan="5" class="dim">Report unavailable.</td></tr>';
    }
  }

  function wireItem(title, date, extra) {
    return '<div class="news-item" style="grid-template-columns:1fr;padding:12px 14px">' +
      '<p class="headline" style="font-size:13.5px;margin:0">' + CF.esc(title) + "</p>" +
      '<div class="meta"><span>' + CF.esc(extra || "") + "</span><span>" + CF.timeAgo(date) + "</span></div></div>";
  }

  async function loadWire() {
    const box = CF.$("#wire-list");
    const parts = [];

    // 1) The league report's editorial notes — the story behind each row.
    try {
      const r = await CF.API.getLeagueInjuries();
      const x = CF.API.bearsInjuryRows(r.data);
      const rows = x.rows.filter((row) => row.status && row.status.toLowerCase() !== "active" && row.comment);
      rows.forEach((row) => parts.push(wireItem(row.name + " — " + row.comment, row.date, row.status)));
      (x.notes || []).forEach((n) => parts.push(wireItem(n, null, "league note")));
    } catch (e) { /* league notes unavailable */ }

    // 2) ESPN league wire headlines that mention a body part or a status.
    try {
      const news = await CF.API.getNews();
      (news || []).forEach((n) => {
        if (INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || "")) {
          const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
          parts.push('<div class="news-item" style="grid-template-columns:1fr;padding:12px 14px">' +
            '<a class="headline" style="font-size:13.5px" href="' + CF.esc(href) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "") + "</a>" +
            '<div class="meta"><span>' + CF.timeAgo(n.published) + "</span></div></div>");
        }
      });
    } catch (e) { /* wire silent */ }

    // 3) The wide wire: Google News, injury-filtered.
    try {
      const items = await CF.API.getGoogleNews("Chicago Bears injury report", 10);
      items.forEach((it) => {
        if (INJURY_RE.test(it.title || "") || INJURY_RE.test(it.desc || "")) {
          parts.push('<div class="news-item" style="grid-template-columns:1fr;padding:12px 14px">' +
            '<a class="headline" style="font-size:13.5px" href="' + CF.esc(it.link) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
            '<div class="meta"><span>' + CF.esc(it.source || "wide wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div></div>");
        }
      });
    } catch (e) { /* wide wire down */ }

    if (parts.length) {
      box.innerHTML = parts.slice(0, 12).join("");
      return;
    }
    box.innerHTML = '<div class="empty" style="padding:18px 14px;font-size:12.5px">The wires are answering, but nothing on them mentions a body part right now. <a href="https://www.espn.com/nfl/team/_/name/chi/" target="_blank" rel="noopener">ESPN Bears ↗</a></div>';
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
