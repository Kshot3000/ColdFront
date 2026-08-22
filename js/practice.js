/* THE COLD FRONT — practice & facility */
"use strict";

(function () {
  async function loadTracker() {
    const body = CF.$("#tracker tbody");
    const note = CF.$("#track-note");
    try {
      const r = await fetch("data/practice.json", { cache: "no-cache" });
      const data = await r.json();
      const rows = data.rows || [];
      body.innerHTML = rows.length
        ? rows.map((row) =>
            "<tr><td class=\"strong\">" + CF.esc(row.date) + "</td>" +
            "<td>" + CF.esc(row.session) + "</td>" +
            "<td>" + CF.esc(row.focus || "—") + "</td>" +
            '<td><span class="st ' + (/availability|presser/i.test(row.media || "") ? "active" : "day-to-day") + '">' + CF.esc(row.media || "—") + "</span></td>" +
            '<td class="dim">' + CF.esc(row.notes || "") + "</td></tr>"
          ).join("")
        : '<tr><td colspan="5" class="dim">Tracker is empty.</td></tr>';
      if (data.updated) note.textContent = "Tracker last updated in the repo: " + data.updated + " — edit data/practice.json and push to keep it current.";
    } catch (e) {
      body.innerHTML = '<tr><td colspan="5" class="dim">Tracker unavailable.</td></tr>';
    }
  }

  function socials() {
    const grid = CF.$("#practice-socials");
    if (!grid) return;
    const picks = CF.CONFIG.socials.filter((s) => /Bears|ESPN|NFL/i.test(s.name));
    grid.innerHTML = (picks.length ? picks : CF.CONFIG.socials).map((s) =>
      '<a href="' + CF.esc(s.url) + '" target="_blank" rel="noopener"><span class="ico">' + CF.esc(s.icon) + "</span>" +
      "<span>" + CF.esc(s.name) + " <span class=\"dim\">" + CF.esc(s.handle) + "</span></span></a>"
    ).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadTracker();
    socials();
    // Keep the tracker fresh for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadTracker, 5 * 60e3, { name: "tracker" }); // tracker (repo JSON): 5 min
  });
})();
