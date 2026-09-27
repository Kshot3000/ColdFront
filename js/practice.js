/* THE COLD FRONT — practice & facility */
"use strict";

(function () {
  const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function todayKey() {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "America/Chicago",
      }).format(new Date());
    } catch (e) {
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
    }
  }

  function inferLevel(row) {
    if (row && row.level != null && !isNaN(Number(row.level))) {
      return Math.max(0, Math.min(4, Number(row.level)));
    }
    const s = String((row && (row.session || row.label || row.note)) || "").toLowerCase();
    if (/game\s*day|kickoff|soldier/.test(s)) return 4;
    if (/full-?team|full\b|two-a|install/.test(s)) return 3;
    if (/light|limited|individual/.test(s)) return 2;
    if (/walk|mental|film|media/.test(s)) return 1;
    if (/off|rest|travel|bye/.test(s)) return 0;
    return 2;
  }

  function levelMeta(level) {
    const L = [
      { cls: "lv-0", short: "Off", tip: "Off / rest / travel" },
      { cls: "lv-1", short: "Walk", tip: "Walkthrough / mental" },
      { cls: "lv-2", short: "Light", tip: "Light / limited" },
      { cls: "lv-3", short: "Full", tip: "Full-team practice" },
      { cls: "lv-4", short: "Game", tip: "Game day" },
    ];
    return L[Math.max(0, Math.min(4, level))] || L[2];
  }

  function buildHeatCells(data) {
    const today = todayKey();
    let cells = [];
    if (Array.isArray(data.participation) && data.participation.length) {
      cells = data.participation.map((p) => ({
        day: p.day || p.date || "—",
        label: p.label || levelMeta(inferLevel(p)).short,
        level: inferLevel(p),
        note: p.note || p.focus || "",
      }));
    } else if (Array.isArray(data.rows) && data.rows.length) {
      cells = data.rows.map((r) => ({
        day: r.date || "—",
        label: levelMeta(inferLevel(r)).short,
        level: inferLevel(r),
        note: r.focus || r.session || "",
      }));
    } else {
      cells = DAY_ORDER.map((d) => ({
        day: d,
        label: "—",
        level: d === "Sun" ? 4 : d === "Sat" ? 0 : 2,
        note: "Add participation[] or rows in data/practice.json",
      }));
    }
    return cells.map((c) => Object.assign({}, c, { isToday: String(c.day).slice(0, 3) === today }));
  }

  function paintHeat(data) {
    const root = CF.$("#practice-heat");
    const pill = CF.$("#heat-pill");
    if (!root) return;
    const cells = buildHeatCells(data);
    if (!(data.participation?.length || data.rows?.length)) {
      if (pill) pill.textContent = "Awaiting confirmed updates";
      root.innerHTML = CF.emptyHTML({ icon: "❄", title: "The practice week is taking shape", sub: "Confirmed participation updates will appear here. Follow the official Bears report for current availability." });
      return;
    }
    const fromPart = Array.isArray(data.participation) && data.participation.length;
    if (pill) {
      pill.textContent = fromPart ? "participation" : "from tracker";
      pill.className = "tag";
    }
    root.innerHTML =
      '<div class="heat-accent" aria-hidden="true"></div>' +
      '<div class="heat-head"><span class="k">Week intensity</span>' +
      '<span class="dim">Facility → gameday</span></div>' +
      '<div class="heat-legend" aria-hidden="true">' +
      '<span class="heat-leg-item"><i class="heat-swatch lv-0"></i>Off</span>' +
      '<span class="heat-leg-item"><i class="heat-swatch lv-1"></i>Walk</span>' +
      '<span class="heat-leg-item"><i class="heat-swatch lv-2"></i>Light</span>' +
      '<span class="heat-leg-item"><i class="heat-swatch lv-3"></i>Full</span>' +
      '<span class="heat-leg-item"><i class="heat-swatch lv-4"></i>Game</span>' +
      "</div>" +
      '<div class="heat-strip" role="list" aria-label="Practice participation week">' +
      cells
        .map((c) => {
          const meta = levelMeta(c.level);
          const tip = CF.esc(c.day + " · " + (c.note || meta.tip));
          return (
            '<div class="heat-cell ' +
            meta.cls +
            (c.isToday ? " is-today" : "") +
            '" role="listitem" title="' +
            tip +
            '">' +
            '<span class="heat-day">' +
            CF.esc(String(c.day).slice(0, 3)) +
            "</span>" +
            '<span class="heat-bar" aria-hidden="true"></span>' +
            '<span class="heat-label">' +
            CF.esc(c.label) +
            "</span>" +
            (c.isToday ? '<span class="heat-today">today</span>' : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="heat-note dim">Week strip from <code>data/practice.json</code>' +
      (fromPart ? " participation[]" : " rows (inferred intensity)") +
      ". Edit and push to keep it honest — never invents who practiced.</p>";
  }

  let trkEntered = false; // first-paint entrance runs once; refreshes stay instant

  async function loadTracker() {
    const body = CF.$("#tracker tbody");
    const note = CF.$("#track-note");
    const trackPill = CF.$("#track-pill");
    // v1.44.0 — week-intel treatment: the wrapper carries the family identity
    // thread; the frost-fade entrance runs on first paint only.
    const wrap = body ? body.closest(".tbl-wrap") : null;
    if (wrap) {
      wrap.classList.add("trk");
      if (!trkEntered) wrap.classList.add("cf-enter");
    }
    if (body) body.innerHTML = CF.skelRows(5, 2);
    try {
      const r = await fetch("data/practice.json", { cache: "no-cache" });
      const data = await r.json();
      const rows = data.rows || [];
      const today = todayKey();
      paintHeat(data);
      body.innerHTML = rows.length
        ? rows
            .map((row) => {
              const isToday = String(row.date || "").slice(0, 3) === today;
              const lv = inferLevel(row);
              const meta = levelMeta(lv);
              const cls = "trk-row trk-lv" + lv + (isToday ? " is-today-row trk-today" : "");
              return (
                "<tr class=\"" + cls + "\">" +
                '<td class="strong">' +
                CF.esc(row.date) +
                (isToday ? ' <span class="st active">today</span>' : "") +
                '</td><td>' +
                CF.esc(row.session) +
                ' <span class="heat-inline ' +
                meta.cls +
                '" title="' +
                CF.esc(meta.tip) +
                '">' +
                CF.esc(meta.short) +
                "</span></td>" +
                "<td>" +
                CF.esc(row.focus || "—") +
                "</td>" +
                '<td><span class="st ' +
                (/availability|presser/i.test(row.media || "") ? "active" : "day-to-day") +
                '">' +
                CF.esc(row.media || "—") +
                "</span></td>" +
                '<td class="dim">' +
                CF.esc(row.notes || "") +
                "</td></tr>"
              );
            })
            .join("")
        : '<tr class="trk-row"><td colspan="5">' +
          CF.emptyHTML({
            icon: "❄️",
            title: "Tracker is empty",
            sub: "Confirmed sessions will appear here when announced.",
          }) +
          "</td></tr>";
      trkEntered = true;
      if (trackPill) {
        trackPill.textContent = rows.length ? rows.length + " sessions" : "empty";
        trackPill.className = "tag";
      }
      if (note) {
        note.innerHTML =
          (data.updated
            ? "Tracker updated: <b>" + CF.esc(data.updated) + "</b>. "
            : "") +
          "Practice schedules may change. Check official Bears announcements before making plans.";
      }
    } catch (e) {
      paintHeat({});
      if (trackPill) {
        trackPill.textContent = "offline";
        trackPill.className = "tag";
      }
      body.innerHTML =
        '<tr class="trk-row"><td colspan="5">' +
        CF.emptyHTML({
          icon: "🌫",
          title: "Tracker unavailable",
          sub: "The practice tracker could not be reached. Please try again later.",
        }) +
        "</td></tr>";
      trkEntered = true;
    }
  }

  function socials() {
    const grid = CF.$("#practice-socials");
    if (!grid) return;
    const picks = CF.CONFIG.socials.filter((s) => /Bears|ESPN|NFL/i.test(s.name));
    grid.innerHTML = (picks.length ? picks : CF.CONFIG.socials)
      .map(
        (s) =>
          '<a href="' +
          CF.esc(s.url) +
          '" target="_blank" rel="noopener"><span class="ico">' +
          CF.esc(s.icon) +
          "</span>" +
          "<span>" +
          CF.esc(s.name) +
          ' <span class="dim">' +
          CF.esc(s.handle) +
          "</span></span></a>"
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadTracker();
    socials();
    CF.refresh.register(loadTracker, 5 * 60e3, { name: "tracker" });
  });
})();
