/* The Cold Front — searchable roster and device-local favorites. */
"use strict";
(function () {
  let all = [], group = "all", table = false, loaded = false;
  let firstPaint = true;
  let favorites = new Set();
  try { const saved = JSON.parse(localStorage.getItem("cf.favorites") || "[]"); if (Array.isArray(saved)) favorites = new Set(saved.map(String)); } catch (_) { /* optional preference */ }
  const playerKey = (player) => String(player.id || player.name);
  // Unit identity for the card treatment: offense threads orange, defense ice,
  // special teams gold — mirroring the injury severity leading-edge convention.
  const groupKey = (group) => /offen/i.test(group || "") ? "offense"
    : /defen/i.test(group || "") ? "defense"
    : /special/i.test(group || "") ? "special" : "other";
  // Human-readable group names, used only as a last resort when the feed
  // omits a player's position (so the card never shows a bare "—").
  const groupLabel = (group) => ({ offense: "Offense", defense: "Defense", special: "Special teams" }[groupKey(group)] || "Bears");
  // Position/number line degrades gracefully when the feed omits a jersey
  // number (practice-squad call-ups, specialists): never a dangling "#—".
  const stLine = (player) => {
    const pos = (player.pos && player.pos !== "—") ? player.pos : groupLabel(player.group);
    return [pos, player.jersey ? "#" + player.jersey : ""].filter(Boolean).join(" · ");
  };
  // Shared jersey numbers are REAL on the live ESPN roster: practice-squad
  // players reuse active-roster numbers (#52, #37, #43, #45, #38, #36 …).
  // When a number is shared by two or more players in the current roster,
  // the practice-squad holder gets a small dim PS tag so two cards/rows
  // never read identically. Never tag from jersey alone, never invent.
  const isPracticeSquad = (p) =>
    /practice.?squad/i.test(String(p.statusType || "")) ||
    /practice.?squad/i.test(String(p.statusName || ""));
  const sharedJerseys = () => {
    const counts = new Map();
    all.forEach((p) => { if (p.jersey) counts.set(p.jersey, (counts.get(p.jersey) || 0) + 1); });
    return new Set([...counts].filter(([, n]) => n > 1).map(([j]) => j));
  };
  const psBadge = (p, dupes) =>
    (isPracticeSquad(p) && p.jersey && dupes.has(p.jersey))
      ? '<span class="ps-tag" title="Practice squad — shares jersey number #' + CF.esc(p.jersey) + '" style="display:inline-block;margin-left:.35em;padding:.05em .35em;border:1px solid rgba(255,255,255,.35);border-radius:.35em;font-size:.62em;letter-spacing:.08em;opacity:.75">PS</span>'
      : "";

  async function loadRoster() {
    const pill = CF.$("#roster-pill");
    try {
      const result = await CF.API.getRoster();
      all = CF.API.rosterPlayers(result.data);
      if (!all.length) throw new Error("Empty roster");
      loaded = true;
      pill.textContent = CF.sourceLabel(result.source) + " · " + all.length + " players";
      // v1.88.0 — the hero headline speaks the live roster count, so it can
      // never contradict the pill ("Fifty-three names" above "live · 83
      // players"). The static fifty-three line stays as the pre-load and
      // feed-down fallback voice; when the feed answers, the hero carries
      // the same number the pill reports.
      const hero = CF.$("#roster-hero-line");
      if (hero) hero.textContent = all.length + " names. One city.";
      const select = CF.$("#roster-pos"), selected = select.value;
      const positions = [...new Set(all.map((p) => String(p.pos).toUpperCase()))].sort();
      select.innerHTML = '<option value="">All positions</option>' + positions.map((p) => '<option value="' + CF.esc(p) + '">' + CF.esc(p) + '</option>').join("");
      if (positions.includes(selected)) select.value = selected;
      render();
    } catch (_) {
      pill.textContent = loaded ? "Refresh unavailable · previous view" : "Roster unavailable";
      if (!loaded) {
        CF.$("#roster-cards").innerHTML = '<div class="empty">The roster feed is temporarily unavailable. <a href="https://www.chicagobears.com/roster" target="_blank" rel="noopener">See the official roster ↗</a></div>';
        CF.$("#roster-table tbody").innerHTML = '<tr><td colspan="8">Roster temporarily unavailable.</td></tr>';
      }
    }
  }

  function render() {
    CF.$("#roster-table-wrap").hidden = !table;
    CF.$("#roster-cards").hidden = table;
    CF.$("#roster-view").setAttribute("aria-pressed", String(table));
    CF.$("#roster-view").textContent = table ? "Player cards" : "Table view";
    if (!loaded) return;
    const query = CF.$("#roster-q").value.trim().toLowerCase(), position = CF.$("#roster-pos").value;
    const rows = all.filter((player) => {
      if (position && String(player.pos).toUpperCase() !== position) return false;
      if (query && !(player.name + " " + player.jersey + " " + player.pos).toLowerCase().includes(query)) return false;
      if (group === "favorites") return favorites.has(playerKey(player));
      if (group === "offense") return /offen/i.test(player.group);
      if (group === "defense") return /defen/i.test(player.group);
      if (group === "special") return /special/i.test(player.group) || ["K", "P", "LS"].includes(player.pos);
      return true;
    });
    CF.$("#roster-count").textContent = rows.length + " of " + all.length + " players";
    const empty = group === "favorites" ? 'No favorites match yet. Tap a star on a player card to add your Bears.' : 'No Bears match those filters. Try another name, number, or position.';
    // Entrance choreography runs once, on first paint — filters and search re-render instantly.
    // Duplicate-number set is computed from the full roster, not the filtered
    // rows, so the PS badge stays correct even when a filter hides one holder.
    const enter = firstPaint; firstPaint = false;
    const dupes = sharedJerseys();
    CF.$("#roster-cards").innerHTML = rows.length ? rows.map((player, i) => {
      const key = playerKey(player), saved = favorites.has(key);
      const photo = CF.safeURL(player.headshot, "img/jersey-54.svg");
      // v1.105.0 — the portrait's number slot is a watermark, so it must stay
      // a number. When the feed omits a jersey (practice-squad call-ups,
      // specialists) the slot carries the paw emblem instead of giant "CHI"
      // fallback text that clipped the card edge on phones — a designed mark,
      // never another player's image.
      const mark = player.jersey
        ? '<span class="player-number" aria-hidden="true">' + CF.esc(player.jersey) + '</span>'
        : '<img class="player-emblem" src="img/paw-mark.svg" alt="" aria-hidden="true">';
      const portrait = player.headshot ? '<img loading="lazy" src="' + CF.esc(photo) + '" alt="" onerror="this.hidden=true">' : '';
      // Height/weight come from ESPN's displayHeight/displayWeight via the
      // mapper; only print the <br> when at least one value exists, so a
      // player missing both never opens the card with a blank line.
      const hw = [player.height, player.weight].filter(Boolean).join(" · ");
      return '<article class="player-card' + (enter ? " cf-enter" : "") + '" data-group="' + groupKey(player.group) + '"' +
        (enter ? ' style="--ni:' + Math.min(i, 11) + '"' : "") +
        '><button type="button" class="favorite-button" data-favorite="' + CF.esc(key) + '" aria-pressed="' + saved + '" aria-label="' + CF.esc((saved ? 'Remove ' : 'Save ') + player.name + (saved ? ' from favorites' : ' to favorites')) + '">' + (saved ? '★' : '☆') + '</button><div class="player-portrait">' + mark + portrait + '</div><div class="player-info"><span class="st">' + CF.esc(stLine(player)) + psBadge(player, dupes) + '</span><h3>' + CF.esc(player.name) + '</h3><p>' + (hw ? CF.esc(hw) + '<br>' : '') + CF.esc(player.college || player.from || "Chicago Bears") + '</p>' + (player.url ? '<a class="player-link" href="' + CF.esc(CF.safeURL(player.url)) + '" target="_blank" rel="noopener">Player profile ↗</a>' : '') + '</div></article>';
    }).join("") : '<div class="empty">' + empty + '</div>';
    CF.$("#roster-table tbody").innerHTML = rows.length ? rows.map((p) => '<tr><td class="num">' + CF.esc(p.jersey || "—") + psBadge(p, dupes) + '</td><td class="strong">' + CF.esc(p.name) + (p.url ? ' <a href="' + CF.esc(CF.safeURL(p.url)) + '" target="_blank" rel="noopener" aria-label="' + CF.esc(p.name + ' profile') + '">↗</a>' : '') + '</td><td>' + CF.esc(p.pos || "—") + '</td><td class="num">' + CF.esc(p.age) + '</td><td class="num">' + CF.esc(p.exp) + '</td><td>' + CF.esc(p.height) + '</td><td>' + CF.esc(p.weight) + '</td><td>' + CF.esc(p.from) + '</td></tr>').join("") : '<tr><td colspan="8">' + empty + '</td></tr>';
  }

  document.addEventListener("DOMContentLoaded", () => {
    CF.$("#roster-q").addEventListener("input", render);
    CF.$("#roster-pos").addEventListener("change", render);
    CF.$$("[data-roster-group]").forEach((button) => button.addEventListener("click", () => {
      group = button.dataset.rosterGroup;
      CF.$$("[data-roster-group]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      render();
    }));
    CF.$("#roster-view").addEventListener("click", () => { table = !table; render(); });
    CF.$("#roster-cards").addEventListener("click", (event) => {
      const button = event.target.closest("[data-favorite]");
      if (!button) return;
      const key = button.dataset.favorite, saving = !favorites.has(key);
      saving ? favorites.add(key) : favorites.delete(key);
      let stored = true;
      try { localStorage.setItem("cf.favorites", JSON.stringify([...favorites])); } catch (_) { stored = false; }
      render();
      const replacement = CF.$$("[data-favorite]").find((b) => b.dataset.favorite === key);
      if (replacement) replacement.focus({ preventScroll: true });
      else CF.$('[data-roster-group="favorites"]').focus();
      CF.toast(stored ? (saving ? "Added to your favorites" : "Removed from favorites") : "Saved for this visit; device storage is unavailable");
    });
    loadRoster();
    CF.refresh.register(loadRoster, 300000, { name: "roster" });
  });
})();
