/* THE COLD FRONT — about: donations, projects, socials */
"use strict";

(function () {
  function donations() {
    const grid = CF.$("#don-grid");
    if (!grid) return;
    grid.innerHTML = CF.CONFIG.donations.map((d, i) =>
      '<div class="don-card">' +
      '<div class="top">' +
      '<span class="coin" style="background:' + CF.esc(d.color) + '">' + CF.esc(d.symbol) + "</span>" +
      '<span class="lbl">' + CF.esc(d.label) + "</span>" +
      "</div>" +
      '<div class="addr" data-addr="' + CF.esc(d.address) + '" title="Click to copy">' + CF.esc(d.address) + "</div>" +
      '<div class="acts">' +
      '<button class="btn small" data-copy="' + CF.esc(d.address) + '" type="button">⧉ Copy</button>' +
      '<a class="btn small" href="' + CF.esc(d.view) + '" target="_blank" rel="noopener">Explorer ↗</a>' +
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
    if (!input || !state) return;
    const showState = () => {
      const key = CF.API.apisportsKey();
      if (key) {
        state.textContent = "Key on this device: " + key.slice(0, 3) + "…" + key.slice(-2) +
          "  — the stats and injury panels are reading API-Sports. The site itself never stores or shares it.";
      } else {
        state.textContent = "No key set on this device yet. Stats and injuries use the league wire + derived numbers until one is added.";
      }
    };
    showState();
    CF.$("#apisports-save").addEventListener("click", () => {
      CF.API.setAPISportsKey(input.value);
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
    if (!input || !state) return;
    const showState = () => {
      const key = CF.API.tsdbKey();
      if (key) {
        state.textContent = "Key on this device: " + key.slice(0, 3) + "\u2026" + key.slice(-2) +
          "  \u2014 standings, roster, and schedule can now read the TheSportsDB wire as a second source. The site itself never stores or shares it.";
      } else {
        state.textContent = "No key set on this device yet. Standings, roster, and schedule ride the league wire until one is added.";
      }
    };
    showState();
    CF.$("#tsdb-save").addEventListener("click", () => {
      CF.API.setTSDBKey(input.value);
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

  document.addEventListener("DOMContentLoaded", () => {
    donations();
    projects();
    socials();
    dataSources();
    tsdbKeys();
  });
})();
