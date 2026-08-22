/* THE COLD FRONT — team roster: search + position filter */
"use strict";

(function () {
  let all = [];

  async function loadRoster() {
    const pill = CF.$("#roster-pill");
    const body = CF.$("#roster-table tbody");
    pill.textContent = "loading…";
    try {
      const r = await CF.API.getRoster();
      all = CF.API.rosterPlayers(r.data);
      if (!all.length) throw new Error("empty roster");
      pill.className = "pill " + (r.source === "live" ? "ok" : "cache");
      pill.textContent = (r.source === "live" ? "live" : "snapshot") + " · " + all.length + " players";
      // Position filter options — built once; re-renders must not wipe the user's filter.
      const posSet = Array.from(new Set(all.map((p) => (p.pos || "").toUpperCase()).filter(Boolean))).sort();
      const sel = CF.$("#roster-pos");
      if (sel && !sel.dataset.built) {
        sel.innerHTML = '<option value="">All positions</option>' +
          posSet.map((p) => '<option value="' + CF.esc(p) + '">' + CF.esc(p) + "</option>").join("");
        sel.dataset.built = "1";
      }
      render();
    } catch (e) {
      pill.className = "pill sample";
      pill.textContent = "offline";
      body.innerHTML = '<tr><td colspan="8" class="dim">Roster unreachable from this network, and no snapshot is saved on this device yet. <a href="https://www.chicagobears.com/roster" target="_blank" rel="noopener">Official roster ↗</a> · <a href="https://www.espn.com/nfl/team/_/name/chi/roster" target="_blank" rel="noopener">ESPN roster ↗</a></td></tr>';
    }
  }

  function render() {
    const q = (CF.$("#roster-q").value || "").trim().toLowerCase();
    const pos = CF.$("#roster-pos").value;
    const rows = all.filter((p) => {
      if (pos && (p.pos || "").toUpperCase() !== pos) return false;
      if (q) {
        const hay = (p.name + " " + (p.jersey || "") + " " + (p.pos || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    CF.$("#roster-count").textContent = rows.length + " of " + all.length;
    const body = CF.$("#roster-table tbody");
    body.innerHTML = rows.length
      ? rows.map((p) =>
          "<tr>" +
          '<td class="strong num">' + CF.esc(p.jersey || "—") + "</td>" +
          '<td class="strong">' + CF.esc(p.name) + (p.url ? ' <a href="' + CF.esc(p.url) + '" target="_blank" rel="noopener" title="Profile">↗</a>' : "") + "</td>" +
          "<td>" + CF.esc(p.pos || "—") + "</td>" +
          '<td class="num">' + CF.esc(p.age != null ? p.age : "—") + "</td>" +
          '<td class="num">' + CF.esc(p.exp != null ? p.exp : "—") + "</td>" +
          '<td class="num">' + CF.esc(p.height || "—") + "</td>" +
          '<td class="num">' + CF.esc(p.weight || "—") + "</td>" +
          '<td class="dim">' + CF.esc(p.nation || "") + "</td>" +
          "</tr>"
        ).join("")
      : '<tr><td colspan="8" class="dim">Nobody matches that search — the wind must have taken their names.</td></tr>';
  }

  document.addEventListener("DOMContentLoaded", () => {
    CF.$("#roster-q").addEventListener("input", render);
    CF.$("#roster-pos").addEventListener("change", render);
    loadRoster();
    // Keep the roster fresh for as long as the tab is open (CF.refresh in common.js):
    CF.refresh.register(loadRoster, 5 * 60e3, { name: "roster" }); // roster: 5 min
  });
})();
