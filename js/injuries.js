/* THE COLD FRONT — injuries: local report table + live injury wire */
"use strict";

(function () {
  const INJURY_RE = /\b(injur(?:y|ies|ed)?|out\b|questionable|doubtful|day-to-day|concussion|fracture|sprain|torn|surgery|sideline|report|ankle|knee|shoulder|hamstring|calf|rib|back|groin)\b/i;

  // v1.36.0 — .cf-enter on first paint only; the 5-minute refresh re-renders stay instant.
  let wireEntered = false;

  function sevCls(row) {
    return CF.injStatusCls(row.status || row.statusCls);
  }

  /* Availability snapshot strip: at-a-glance severity counts above the table.
     Rows unknown (failed fetch) clears the strip; zero rows is "full strength". */
  function paintSnapshot(rows) {
    const host = CF.$("#rep-snapshot");
    if (!host) return;
    if (!rows) { host.innerHTML = ""; return; }
    const counts = { out: 0, questionable: 0, "day-to-day": 0, active: 0 };
    rows.forEach((row) => {
      const cls = sevCls(row);
      counts[cls] = (counts[cls] || 0) + 1;
    });
    const total = Object.keys(counts).reduce((a, k) => a + counts[k], 0);
    if (!total) {
      host.innerHTML = '<span class="inj-snap-clear">\u2714 Full strength — nobody listed on the report.</span>';
      return;
    }
    const labels = { out: "Out", questionable: "Questionable", "day-to-day": "Day-to-day", active: "Active" };
    host.innerHTML = ["out", "questionable", "day-to-day", "active"]
      .filter((k) => counts[k] > 0)
      .map((k) => '<span class="inj-snap-chip sev-' + k + '"><b>' + counts[k] + '</b> ' + labels[k] + '</span>')
      .join("") +
      '<span class="inj-snap-total">' + total + ' listed</span>';
  }

  async function paintMovement(rows) {
    const host = CF.$("#inj-movement");
    if (!host) return;
    try {
      const prior = await CF.loadInjuryPrior();
      const diff = CF.diffInjuryMovement(rows || [], prior && prior.rows);
      host.innerHTML = CF.injuryMovementHTML(diff, { showQuiet: !!(prior && prior.rows && prior.rows.length) });
      if (prior && prior.source) host.dataset.prior = prior.source;
    } catch (e) {
      host.innerHTML = "";
    }
    // Always refresh the device prior from the live table so the next visit diffs cleanly.
    if (rows && rows.length) CF.injSnapSet(rows);
  }

  /* The table prefers live data: league report (per-player status +
     editorial notes) → roster flags → community JSON. */
  function reportRow(row, eta) {
    const sev = sevCls(row);
    // The INJURY column shows the compact injury designation (row.injury,
    // built from ESPN's details: type + detail + side) — never the full
    // comment sentence, and never a status code ("Injured Reserve" must not
    // appear in both the INJURY and STATUS columns). The full editorial
    // comment stays in the title tooltip; the injury wire on the right
    // carries the story behind each row.
    const designation = row.injury || "—";
    const full = row.comment && row.comment !== designation ? row.comment : null;
    return '<tr class="inj-sev-' + sev + '"><td class="strong">' + CF.esc(row.name) +
      (row.url ? ' <a href="' + CF.esc(CF.safeURL(row.url)) + '" target="_blank" rel="noopener" title="Profile">↗</a>' : "") +
      "</td>" +
      "<td>" + CF.esc(row.pos || "—") + "</td>" +
      "<td" + (full ? ' title="' + CF.esc(full) + '"' : "") + ">" + CF.esc(designation) + "</td>" +
      '<td><span class="st ' + sev + '">' + CF.esc(CF.injStatusLabel(row.status) || "—") + "</span></td>" +
      '<td class="dim">' + CF.esc(eta || (row.date ? CF.fmtDate(row.date) : "")) + "</td></tr>";
  }

  async function loadReport() {
    const body = CF.$("#report-table tbody");
    const pill = CF.$("#rep-pill");
    const note = CF.$("#rep-note");
    if (body) body.innerHTML = CF.skelRows(5, 3);

    // 1) API-Sports (BYO key) — structured injury rows with ETAs.
    if (CF.API.apisportsKey()) {
      try {
        const rows = await CF.API.apisportsInjuries();
        if (rows && rows.length) {
          pill.className = "pill ok";
          // v1.94.0 — the pill says when the report was last read, not just its source.
          CF.freshStamp(pill, "live · API-Sports", Date.now());
          note.textContent = "Structured injury rows via API-Sports (key set on this device). Cross-check with the official pregame report.";
          body.innerHTML = rows.map((row) => reportRow(row, row.eta)).join("");
          paintSnapshot(rows);
          await paintMovement(rows);
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
      if (x.found && !rows.length) {
        // v1.94.0 — the pill says when the report was last read, not just its source.
        // v1.127.0 — the stamp wears the payload's own age, not the paint time.
        CF.freshStamp(pill, CF.sourceLabel(r) + " · league report", CF.dataEpoch(r));
        note.textContent = "Check the official pregame report for final availability.";
        body.innerHTML = '<tr><td colspan="5">No players listed in the current Bears feed.</td></tr>';
        paintSnapshot([]);
        return;
      }
      if (rows.length) {
        pill.className = "pill ok";
        // v1.94.0 — the pill says when the report was last read, not just its source.
        // v1.127.0 — the stamp wears the payload's own age, not the paint time.
        CF.freshStamp(pill, CF.sourceLabel(r) + " · League report", CF.dataEpoch(r));
        note.textContent = "From the league wire (" + rows.length + " listed) — the wire on the right carries the story behind each one. Always cross-check with the official pregame report.";
        body.innerHTML = rows.map((row) => reportRow(row)).join("");
        paintSnapshot(rows);
        await paintMovement(rows);
        return;
      }
    } catch (e) { /* league feed silent */ }

    // 3) Roster flags (IR group + per-player injury notes).
    try {
      const r2 = await CF.API.getRoster();
      const rows = CF.API.rosterInjuryRows(r2.data);
      if (rows.length) {
        pill.className = "pill ok";
        // v1.94.0 — the pill says when the report was last read, not just its source.
        // v1.127.0 — the stamp wears the payload's own age, not the paint time.
        CF.freshStamp(pill, CF.sourceLabel(r2) + " · Roster flags", CF.dataEpoch(r2));
        note.textContent = "Pulled from the live roster's injury flags. Cross-check with the official pregame report.";
        body.innerHTML = rows.map((row) => reportRow(row)).join("");
        paintSnapshot(rows);
        await paintMovement(rows);
        return;
      }
    } catch (e2) { /* roster silent too */ }

    // 4) Community-maintained JSON, last resort.
    try {
      const r = await fetch("data/injuries.json", { cache: "no-cache" });
      const data = await r.json();
      const rows = (data.rows || []).filter((row) => row.name && row.name !== "—");
      pill.textContent = "community report";
      if (data.updated) note.textContent = "Community report updated: " + CF.esc(data.updated) + ".";
      body.innerHTML = rows.length
        ? rows.map((row) => reportRow(row, row.eta)).join("")
        : '<tr><td colspan="5" class="dim">No verified report is available. Check the official Bears injury report for current availability.</td></tr>';
      paintSnapshot(rows.length ? rows : null);
    } catch (e3) {
      pill.className = "pill sample";
      paintSnapshot(null);
      body.innerHTML = '<tr><td colspan="5">' + CF.emptyHTML({
        icon: "🌫",
        title: "Report unavailable",
        sub: "Could not load the community report from this network.",
      }) + "</td></tr>";
    }
  }

  /* League-report wire cards: the player name is the headline, a real status
     pill (span.st with CF.injStatusCls), the injury designation, and the
     comment as the story excerpt ONLY when it's substantive (longer than ~24
     chars and not just echoing the status word — a comment of exactly
     "doubtful" adds nothing the pill doesn't already say). */
  const substantiveComment = (row) => {
    const c = String(row.comment || "").trim();
    if (c.length <= 24) return "";
    const low = c.toLowerCase();
    const statusWords = [
      String(row.status || "").trim().toLowerCase(),
      String(CF.injStatusLabel(row.status) || "").trim().toLowerCase(),
    ];
    if (statusWords.includes(low)) return "";
    return c;
  };

  function wireItem(row, i) {
    const statusLabel = CF.injStatusLabel(row.status) || "";
    const excerpt = substantiveComment(row);
    return '<div class="news-item' + (wireEntered ? "" : " cf-enter") + '" style="grid-template-columns:1fr;padding:12px 14px;--ni:' + Math.min(i, 12) + '">' +
      '<p class="headline" style="font-size:13.5px;margin:0">' + CF.esc(row.name || "League note") + "</p>" +
      (statusLabel ? '<p style="margin:6px 0 0"><span class="st ' + CF.injStatusCls(row.status) + '">' + CF.esc(statusLabel) + "</span></p>" : "") +
      (row.injury ? '<p class="dim" style="font-size:12.5px;margin:6px 0 0">' + CF.esc(row.injury) + "</p>" : "") +
      (excerpt ? '<p class="inj-excerpt">' + CF.esc(excerpt) + "</p>" : "") +
      '<div class="meta"><span>' + CF.timeAgo(row.date) + "</span></div></div>";
  }

  function wireNote(note, i) {
    return '<div class="news-item' + (wireEntered ? "" : " cf-enter") + '" style="grid-template-columns:1fr;padding:12px 14px;--ni:' + Math.min(i, 12) + '">' +
      '<p class="inj-excerpt">' + CF.esc(note) + "</p>" +
      '<div class="meta"><span>league note</span></div></div>';
  }

  async function loadWire() {
    const box = CF.$("#wire-list");
    if (box) {
      box.innerHTML = CF.emptyHTML({
        icon: "🩹",
        title: "Tuning injury wire",
        sub: "Flagging headlines that smell like a report change.",
        loading: true,
        style: "padding:18px 14px",
      });
    }
    const parts = [];

    // 1) The league report's editorial notes — the story behind each row.
    try {
      const r = await CF.API.getLeagueInjuries();
      const x = CF.API.bearsInjuryRows(r.data);
      const rows = x.rows.filter((row) => row.status && row.status.toLowerCase() !== "active" && row.comment);
      rows.forEach((row) => {
        // A card must never be just "name + pill + time" with no useful text:
        // rows with neither an injury designation nor a substantive comment
        // stay on the report table instead.
        if (!row.injury && !substantiveComment(row)) return;
        parts.push(wireItem(row, parts.length));
      });
      (x.notes || []).forEach((n) => parts.push(wireNote(n, parts.length)));
    } catch (e) { /* league notes unavailable */ }

    // 2) ESPN league wire headlines that mention a body part or a status.
    try {
      const news = await CF.API.getNews();
      (news || []).forEach((n) => {
        if (INJURY_RE.test(n.heading || "") || INJURY_RE.test(n.description || "")) {
          const href = (n.links && n.links.web && n.links.web.href) || "https://www.chicagobears.com/";
          parts.push('<div class="news-item' + (wireEntered ? "" : " cf-enter") + '" style="grid-template-columns:1fr;padding:12px 14px;--ni:' + Math.min(parts.length, 12) + '">' +
            '<a class="headline" style="font-size:13.5px" href="' + CF.esc(CF.safeURL(href)) + '" target="_blank" rel="noopener">' + CF.esc(n.heading || "") + "</a>" +
            '<div class="meta"><span>' + CF.timeAgo(n.published) + "</span></div></div>");
        }
      });
    } catch (e) { /* wire silent */ }

    // 3) The wide wire: Google News, injury-filtered.
    try {
      const items = await CF.API.getGoogleNews("Chicago Bears injury report", 10);
      items.forEach((it) => {
        if (INJURY_RE.test(it.title || "") || INJURY_RE.test(it.desc || "")) {
          parts.push('<div class="news-item' + (wireEntered ? "" : " cf-enter") + '" style="grid-template-columns:1fr;padding:12px 14px;--ni:' + Math.min(parts.length, 12) + '">' +
            '<a class="headline" style="font-size:13.5px" href="' + CF.esc(CF.safeURL(it.link)) + '" target="_blank" rel="noopener">' + CF.esc(it.title) + "</a>" +
            '<div class="meta"><span>' + CF.esc(it.source || "wide wire") + "</span><span>" + CF.timeAgo(it.date) + "</span></div></div>");
        }
      });
    } catch (e) { /* wide wire down */ }

    if (parts.length) {
      box.innerHTML = parts.slice(0, 12).join("");
      wireEntered = true; // first paint done — refreshes stay instant
      return;
    }
    box.innerHTML = '<div class="empty" style="padding:18px 14px;font-size:12.5px">No injury headlines are available from the connected feeds right now. <a href="https://www.espn.com/nfl/team/_/name/chi/" target="_blank" rel="noopener">ESPN Bears ↗</a></div>';
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
