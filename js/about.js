/* THE COLD FRONT — about: donations, projects, socials */
"use strict";

(function () {
  function donations() {
    const grid = CF.$("#don-grid");
    if (!grid) return;
    grid.innerHTML = CF.CONFIG.donations.map((d, i) =>
      '<div class="don-card cf-enter" style="--ni:' + i + '">' +
      '<div class="top">' +
      '<span class="coin" style="background:' + CF.esc(d.color) + '">' + CF.esc(d.symbol) + "</span>" +
      '<span class="lbl">' + CF.esc(d.label) + "</span>" +
      "</div>" +
      '<div class="addr" data-addr="' + CF.esc(d.address) + '" title="Click to copy"' +
      ' tabindex="0" role="button" aria-label="Copy the ' + CF.esc(d.label) + ' donation address">' +
      CF.esc(d.address) + "</div>" +
      '<div class="acts">' +
      '<button class="btn small" data-copy="' + CF.esc(d.address) + '" type="button">⧉ Copy</button>' +
      (d.view ? '<a class="btn small" href="' + CF.esc(d.view) + '" target="_blank" rel="noopener">Explorer ↗</a>' : "") +
      "</div>" +
      '<img class="qr" loading="lazy" alt="QR code for ' + CF.esc(d.label) + ' donation address" ' +
      'src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=' + encodeURIComponent(d.address) + '"' +
      ' onerror="this.style.display=\'none\'">' +
      "</div>"
    ).join("");
    grid.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-copy]");
      if (btn) {
        CF.copyText(btn.dataset.copy, CF.CONFIG.donations.find((d) => d.address === btn.dataset.copy).label + " address copied — thank you 🧊");
        return;
      }
      const addr = ev.target.closest("[data-addr]");
      if (addr) CF.copyText(addr.dataset.addr, "Address copied — thank you 🧊");
    });
    grid.addEventListener("keydown", (ev) => {
      // The address strip is a mouse-operable copy target; give
      // keyboard users the same action via Enter or Space.
      const addr = ev.target.closest("[data-addr]");
      if (!addr) return;
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        CF.copyText(addr.dataset.addr, "Address copied — thank you 🧊");
      }
    });
  }

  function projects() {
    const grid = CF.$("#proj-grid");
    if (!grid) return;
    const base = CF.CONFIG.author.github.replace(/\/$/, "");
    grid.innerHTML = CF.CONFIG.projects.map((p) => {
      const href = p.url || base + "/" + p.repo;
      const label = p.url
        ? p.url.replace(/^https?:\/\//, "")
        : "github.com/" + base.split("/").pop() + "/" + p.repo;
      return '<a class="proj-card" href="' + CF.esc(href) + '" target="_blank" rel="noopener">' +
      '<span class="p-ico">' + CF.esc(p.icon) + "</span>" +
      "<h3>" + CF.esc(p.name) + "</h3>" +
      "<p>" + CF.esc(p.desc) + "</p>" +
      '<span class="go">' + CF.esc(label) + " ↗</span>" +
      "</a>";
    }).join("");
  }

  function socials() {
    const grid = CF.$("#all-socials");
    if (!grid) return;
    const mine = {
      name: "X — the builder",
      handle: CF.CONFIG.author.xHandle,
      url: CF.CONFIG.author.x,
      icon: "𝕏",
    };
    grid.innerHTML =
      '<a href="' + CF.esc(mine.url) + '" target="_blank" rel="noopener" style="border-color:var(--orange)"><span class="ico">' + mine.icon + "</span>" +
      "<span style=\"color:var(--orange-hot);font-weight:600\">" + CF.esc(mine.name) + " <span class=\"dim\">" + CF.esc(mine.handle) + "</span></span></a>" +
      CF.CONFIG.socials.map((s) =>
        '<a href="' + CF.esc(s.url) + '" target="_blank" rel="noopener"><span class="ico">' + CF.esc(s.icon) + "</span>" +
        "<span>" + CF.esc(s.name) + " <span class=\"dim\">" + CF.esc(s.handle) + "</span></span></a>"
      ).join("");
  }

  function dataSources() {
    const input = CF.$("#apisports-key");
    const state = CF.$("#apisports-state");
    if (!input || !state || !CF.API) return;
    const showState = () => {
      const key = CF.API.apisportsKey();
      if (key) {
        state.textContent = "Key on this device: " + key.slice(0, 3) + "…" + key.slice(-2) +
          "  — the stats and injury panels can try API-NFL. Coverage and access depend on your provider plan.";
      } else {
        state.textContent = "No key set on this device yet. Stats and injuries use the league wire + derived numbers until one is added.";
      }
    };
    showState();
    CF.$("#apisports-save").addEventListener("click", () => {
      if (!input.value.trim()) { CF.toast("Paste a key first"); return; }
      if (!CF.API.setAPISportsKey(input.value)) { CF.toast("Device storage is unavailable"); return; }
      input.value = "";
      CF.toast("API-Sports key saved to this device ✓");
      showState();
    });
    CF.$("#apisports-clear").addEventListener("click", () => {
      CF.API.setAPISportsKey("");
      input.value = "";
      CF.toast("API-Sports key cleared from this device");
      showState();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") CF.$("#apisports-save").click();
    });
  }

  function tsdbKeys() {
    const input = CF.$("#tsdb-key");
    const state = CF.$("#tsdb-state");
    if (!input || !state || !CF.API) return;
    const showState = () => {
      const key = CF.API.tsdbKey();
      if (key) {
        state.textContent = "Key on this device: " + key.slice(0, 3) + "\u2026" + key.slice(-2) +
          "  \u2014 standings, roster, and schedule can now read the TheSportsDB wire as a second source. Requests go directly to your provider.";
      } else {
        state.textContent = "No key set on this device yet. Standings, roster, and schedule ride the league wire until one is added.";
      }
    };
    showState();
    CF.$("#tsdb-save").addEventListener("click", () => {
      if (!input.value.trim()) { CF.toast("Paste a key first"); return; }
      if (!CF.API.setTSDBKey(input.value)) { CF.toast("Device storage is unavailable"); return; }
      input.value = "";
      CF.toast("TheSportsDB key saved to this device \u2713");
      showState();
    });
    CF.$("#tsdb-clear").addEventListener("click", () => {
      CF.API.setTSDBKey("");
      input.value = "";
      CF.toast("TheSportsDB key cleared from this device");
      showState();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") CF.$("#tsdb-save").click();
    });
  }


  async function loadSnapMeta() {
    const el = CF.$("#snap-meta");
    if (!el) return;
    try {
      const r = await fetch("data/snapshots/META.json", { cache: "no-cache" });
      const m = await r.json();
      const built = m.built ? new Date(m.built) : null;
      // v1.226.0 — the snapshot age speaks in its largest honest unit.
      // The raw hour count grew unbounded: the baked set built
      // 2026-09-26 read "~1139h old" on 2026-11-12 — a four-digit
      // number no fan can feel, and the site's only age that never
      // graduates. Under 48 hours the age stays in hours; past that
      // it wears days ("~47d old"). CF.timeAgo is not a drop-in here:
      // past 30 days it returns a date, which would just repeat the
      // adjacent "built Fri, Sep 25" stamp. A build stamped in the
      // future (clock skew) wears no age at all rather than a
      // negative one.
      const ageMs = built && !isNaN(built.getTime())
        ? Date.now() - built.getTime()
        : null;
      const ageTxt = ageMs == null || ageMs < 0
        ? ""
        : ageMs < 48 * 3600e3
          ? " · ~" + Math.max(1, Math.round(ageMs / 3600e3)) + "h old"
          : " · ~" + Math.round(ageMs / 86400e3) + "d old";
      const feeds = m.feeds || {};
      const ok = Object.keys(feeds).filter((k) => feeds[k] && feeds[k].ok).length;
      const total = Object.keys(feeds).length || m.totalFeeds || 0;
      el.innerHTML =
        '<div class="snap-meta">' +
        '<b>Snapshots</b> v' + CF.esc(String(m.version || "?")) +
        // v1.224.0 — the built stamp speaks Chicago time with its zone
        // named, like the site's freshness stamps (CF.fmtTime): the
        // bare toLocaleString() rendered in the VISITOR's zone
        // ("9/26/2026, 12:34:33 AM" in New York for a build Chicago
        // stamps Fri, Sep 25 · 11:34 PM CDT — wrong evening, no zone).
        (built ? " · built " + CF.esc(CF.fmtDate(built) + (CF.fmtTime(built) ? " · " + CF.fmtTime(built) : "")) : "") +
        ageTxt +
        (total ? " · " + ok + "/" + total + " feeds ok" : "") +
        '. Nightly workflow (see README) refreshes <code>data/snapshots/</code>; run <code>node scripts/refresh-snapshots.mjs</code> locally anytime.' +
        "</div>";
    } catch (e) {
      el.classList.add('snap-empty');
      el.innerHTML = '<div class="snap-meta dim">Snapshot META unavailable on this network.</div>';
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    donations();
    projects();
    socials();
    dataSources();
    tsdbKeys();
    loadSnapMeta();
  });
})();
