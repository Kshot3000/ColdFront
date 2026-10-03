/* ============================================================
   THE COLD FRONT — game highlights (v1.110.0)
   Latest videos from the official Chicago Bears YouTube channel plus the
   league's Bears game highlight reels from the official NFL channel,
   pulled keyless through the raced fetch chain:
     YouTube channel RSS (Atom) → public CORS proxies → local snapshot.
   Clicking a card loads it into the featured player (privacy-enhanced
   youtube-nocookie embed). "Highlights only" filters for game footage.
   v1.32.0: frosted-glass card glow-up with identity thread, staggered
   frost-fade entrance on first paint, and skeleton video cards while
   the feed loads.
   v1.57.0: the feature frame's now-playing strip gets the family
   treatment — identity thread, display-type title, ❄ NOW PLAYING
   eyebrow, igniting Highlight chip, :focus-visible parity on the
   keyboard-operable poster, and a one-shot fade each time the
   feature swaps videos.
   v1.110.0: second source — the official NFL league channel's Bears game
   highlight reels merge into the feed (the team channel rarely posts full
   game reels), each wearing an NFL source badge; when both live feeds are
   unreachable the snapshot fallback now says how old it is.
   v1.175.0: the game-reel shelf — a curated snapshot (data/snapshots/
   highlights.json, built by scripts/refresh-highlights.py from both
   channels' full video lists) merges into the feed, because the RSS
   windows rotate the per-game reels out within days under a flood of
   Shorts and pressers, leaving the page leading with press conferences.
   Game reels now lead the board and the featured player opens on the
   newest reel whenever one exists.
   v1.181.0: the now-playing card says so — it was marked only by the
   .is-active border, so a fan scanning the grid had to spot a 1px
   orange edge, and a screen-reader fan heard nothing at all (a probe
   measured aria-current null on every card, before and after a
   swap). The active card now carries aria-current="true" (the rest
   "false", the week-clock's spelling) and a solid "Now playing"
   badge in its meta row; featureVideo keeps class, attribute and
   badge in sync on every swap.
   ============================================================ */
"use strict";

(function () {
  // Official Chicago Bears YouTube channel.
  var CHANNEL_ID = "UCP0Cdc6moLMyDJiO0s-yhbQ";
  var RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID;
  var CHANNEL_URL = "https://www.youtube.com/@ChicagoBears";
  // v1.110.0 — official NFL league channel, home of the per-game highlight
  // reels ("Bears vs. X | NFL Week N Game Highlights"). Channel ID verified
  // 2026-09-29 on the "NFL - YouTube" page (Verified, @NFL, "The official
  // YouTube page of the NFL") — never swap this for a guessed value.
  var NFL_CHANNEL_ID = "UCDVYQ4Zhbm3S2dlz7P1GBDg";
  var NFL_RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=" + NFL_CHANNEL_ID;
  var NFL_CHANNEL_URL = "https://www.youtube.com/@NFL";
  var MAX_ITEMS = 18;

  // Titles that smell like game footage (not press conferences).
  var HL_RE = /\b(highlight|mic'd|micd|top\s?\d+|every\s+\w+\s+(catch|run|play|sack|touchdown)|vs\.?\b|game\s+(trailer|recap|highlights)|hype|wired|sound\s+fx|all\s+22|film\s+room|can't-miss|best\s+plays)\b/i;
  var PRESS_RE = /\bpress\s+conference\b/i;
  // v1.110.0 — league-feed gate: only Bears game highlight reels, never the
  // channel's league-wide draft shows, analysis, or other-team content.
  var NFL_BEARS_RE = /\bbears\b/i;
  var NFL_HL_RE = /\bhighlights?\b/i;

  function esc(s) { return CF.esc(s == null ? "" : String(s)); }

  // Thumbnail fallback: swap a broken YouTube thumb for a frost glyph.
  CF.hlThumbFail = CF.hlThumbFail || function (img) {
    img.onerror = null;
    var d = document.createElement("div");
    d.className = "thumb-fallback";
    d.textContent = "🎬";
    img.replaceWith(d);
  };

  /* ---------- feed ---------- */

  function parseAtom(xml, src) {
    var doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return [];
    var out = [];
    Array.prototype.forEach.call(doc.getElementsByTagName("entry"), function (el) {
      var one = function (tag) {
        var x = el.getElementsByTagName(tag)[0];
        return x ? x.textContent.trim() : null;
      };
      var vid = one("yt:videoId");
      var title = one("title");
      if (!vid || !title) return;
      var thumb = null;
      var mg = el.getElementsByTagName("media:thumbnail")[0];
      if (mg) thumb = mg.getAttribute("url");
      out.push({
        videoId: vid,
        title: title,
        published: one("published"),
        thumb: thumb || ("https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg"),
        link: "https://www.youtube.com/watch?v=" + vid,
        src: src
      });
    });
    return out;
  }

  function kindOf(v) {
    if (HL_RE.test(v.title) && !PRESS_RE.test(v.title)) return "highlight";
    return "video";
  }

  // v1.110.0 — the league feed only contributes Bears game highlight reels.
  function nflReel(v) {
    return NFL_BEARS_RE.test(v.title) && NFL_HL_RE.test(v.title);
  }

  // v1.175.0 — what counts as a GAME reel (an actual game's highlight cut,
  // as opposed to mic'd-up features and single-play clips): the shelf marks
  // its items outright, league items pass the reel gate, and a Bears-channel
  // title needs "highlights" plus a game context (a matchup or a win).
  var GAME_CTX_RE = /\b(vs\.?|win over)\b/i;
  function isGameReel(v) {
    if (!v) return false;
    if (v.reel) return true;
    if (v.src === "nfl") return nflReel(v);
    return NFL_HL_RE.test(v.title) && GAME_CTX_RE.test(v.title);
  }

  // One feed fetch that degrades to an empty list — the merge below treats a
  // dead feed as "no items from this source" rather than failing the page.
  async function feedItems(url, src, gate) {
    try {
      var xml = await CF.fetchText(url, { timeout: 8000 });
      var items = parseAtom(xml, src);
      return gate ? items.filter(gate) : items;
    } catch (e) { return []; }
  }

  // v1.175.0 — the game-reel shelf shipped with the site. Degrades to an
  // empty list like a dead feed; the merge treats it as one more source.
  async function reelItems() {
    try {
      var snap = CF.snapshotGet ? await CF.snapshotGet("highlights") : null;
      var list = snap && (snap.items || snap);
      if (!Array.isArray(list)) return { items: [], fetched: null };
      var items = [];
      list.forEach(function (it) {
        if (!it || !it.videoId || !it.title) return;
        items.push({
          videoId: it.videoId,
          title: it.title,
          published: it.published || null,
          thumb: "https://i.ytimg.com/vi/" + it.videoId + "/hqdefault.jpg",
          link: "https://www.youtube.com/watch?v=" + it.videoId,
          src: it.src || "bears",
          reel: true
        });
      });
      return { items: items, fetched: (snap && snap.fetched) || null };
    } catch (e) { return { items: [], fetched: null }; }
  }

  // Merge every source: de-dupe on videoId (a later copy can upgrade an
  // item to reel status), then game reels first — newest first inside
  // each class — capped. v1.175.0: reels lead, so the featured player and
  // the top of the grid are game footage, not the newest presser.
  function mergeAll(lists) {
    var seen = {}, out = [];
    lists.forEach(function (list) {
      (list || []).forEach(function (v) {
        if (!v || !v.videoId) return;
        var prev = seen[v.videoId];
        if (prev) { if (isGameReel(v)) prev.reel = true; return; }
        if (isGameReel(v)) v.reel = true;
        seen[v.videoId] = v;
        out.push(v);
      });
    });
    out.sort(function (x, y) {
      var rx = x.reel ? 1 : 0, ry = y.reel ? 1 : 0;
      if (rx !== ry) return ry - rx;
      return (Date.parse(y.published) || 0) - (Date.parse(x.published) || 0);
    });
    return out.slice(0, MAX_ITEMS);
  }

  async function getVideos() {
    // 1) Live channel RSS through the raced chain (Bears + the NFL
    // league channel's Bears reels) plus the game-reel shelf, in parallel.
    var results = await Promise.all([
      feedItems(RSS_URL, "bears", null),
      feedItems(NFL_RSS_URL, "nfl", nflReel),
      reelItems()
    ]);
    var live = results[0].length > 0 || results[1].length > 0;
    var merged = mergeAll([results[2].items, results[0], results[1]]);
    if (merged.length) return { items: merged, live: live, fetched: results[2].fetched };
    // 2) Last-good snapshot shipped with the site.
    try {
      var snap = CF.snapshotGet ? await CF.snapshotGet("yt") : null;
      var list = snap && (snap.items || snap);
      if (Array.isArray(list) && list.length) {
        return {
          items: list.slice(0, MAX_ITEMS).map(function (it) {
            return {
              videoId: it.videoId,
              title: it.title,
              published: it.published || it.date || null,
              thumb: it.thumb || ("https://i.ytimg.com/vi/" + it.videoId + "/hqdefault.jpg"),
              link: "https://www.youtube.com/watch?v=" + it.videoId,
              src: it.src || "bears"
            };
          }),
          live: false,
          fetched: (snap && snap.fetched) || null
        };
      }
    } catch (e2) { /* fall through */ }
    return { items: [], live: false, fetched: null };
  }

  /* ---------- render ---------- */

  var state = { items: [], filter: "all", current: null };

  // v1.32.0 — the frost-fade entrance runs once, on first paint; filter and
  // refresh re-renders stay instant.
  var firstPaint = true;

  function embedURL(id, autoplay) {
    return "https://www.youtube-nocookie.com/embed/" + id + "?rel=0" + (autoplay ? "&autoplay=1" : "");
  }

  function cardHTML(v, active, enter, idx) {
    var kind = kindOf(v);
    // v1.110.0 — league reels wear an NFL source badge so fans know where the
    // game footage comes from; Bears-channel videos need no badge.
    var srcBadge = v.src === "nfl" ? '<span class="hl-src">NFL</span>' : "";
    // v1.181.0 — the playing card names itself in its meta row, so the
    // state is text (readable, announced) and not only a border colour.
    var playingBadge = active ? '<span class="hl-playing">Now playing</span>' : "";
    return '<button type="button" class="hl-card' + (active ? " is-active" : "") + (enter ? " cf-enter" : "") + '" data-vid="' + esc(v.videoId) + '" data-kind="' + kind + '"' +
      ' aria-current="' + (active ? "true" : "false") + '"' +
      (enter ? ' style="--hi:' + Math.min(idx, 11) + '"' : "") + '>' +
      '<span class="hl-thumb"><img loading="lazy" src="' + esc(CF.safeURL(v.thumb)) + '" alt="" ' +
      'onerror="CF.hlThumbFail(this)">' +
      '<span class="hl-mini-play" aria-hidden="true"></span></span>' +
      '<span class="hl-body"><span class="hl-title">' + esc(v.title) + "</span>" +
      '<span class="hl-meta dim"><span>' + esc(CF.timeAgo(v.published)) + "</span>" +
      (kind === "highlight" ? '<span class="hl-kind">Highlight</span>' : "") + srcBadge + playingBadge +
      "</span></span></button>";
  }

  // v1.57.0 — one-shot fade on the now-playing strip each time the
  // feature swaps; remove/re-add around a reflow so re-renders
  // re-trigger the animation (reduced motion snaps it).
  function nowIn(box) {
    var now = box.querySelector(".hl-now");
    if (!now) return;
    now.classList.remove("hl-now-in");
    void now.offsetWidth;
    now.classList.add("hl-now-in");
  }

  function srcMeta(v) {
    return v.src === "nfl" ? ' · <span class="hl-src">NFL</span>' : "";
  }

  function featureVideo(v, autoplay) {
    state.current = v.videoId;
    var box = CF.$("#hl-feature");
    var kind = kindOf(v);
    box.innerHTML =
      '<div class="hl-ratio">' +
      '<iframe src="' + esc(embedURL(v.videoId, autoplay)) + '" title="' + esc(v.title) + '" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      'allowfullscreen loading="lazy"></iframe></div>' +
      '<div class="hl-now"><span class="hl-eyebrow">❄ Now playing</span>' +
      '<h2>' + esc(v.title) + '</h2>' +
      '<span class="meta dim">' + esc(CF.timeAgo(v.published)) +
      (kind === "highlight" ? ' · <span class="hl-kind">Highlight</span>' : "") + srcMeta(v) + "</span>" +
      '<a class="btn small" href="' + esc(CF.safeURL(v.link)) + '" target="_blank" rel="noopener">YouTube ↗</a></div>';
    nowIn(box);
    // v1.181.0 — keep the grid honest on every swap: the class, the
    // aria-current attribute and the visible Now playing badge all
    // move together, so no surface is left claiming the old video.
    Array.prototype.forEach.call(document.querySelectorAll(".hl-card"), function (c) {
      var on = c.getAttribute("data-vid") === v.videoId;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-current", on ? "true" : "false");
      var meta = c.querySelector(".hl-meta");
      if (!meta) return;
      var badge = meta.querySelector(".hl-playing");
      if (on && !badge) {
        badge = document.createElement("span");
        badge.className = "hl-playing";
        badge.textContent = "Now playing";
        meta.appendChild(badge);
      } else if (!on && badge) {
        badge.parentNode.removeChild(badge);
      }
    });
  }

  function posterFor(v) {
    // Poster with big play button; first click swaps in the real player.
    // v1.121.0 — the thumbnail is probed before it paints: while it loads
    // (or when it can't, e.g. adblockers, a YouTube outage, offline) the
    // poster wears a composed ice-steel surface and a frost glyph instead
    // of a black void. The glyph retires once the real thumb lands.
    var box = CF.$("#hl-feature");
    var thumbURL = CF.safeURL(v.thumb);
    box.innerHTML =
      '<div class="hl-ratio"><div class="hl-poster" id="hl-poster" role="button" tabindex="0" ' +
      'aria-label="Play: ' + esc(v.title) + '">' +
      '<span class="hl-frost" aria-hidden="true">❄</span>' +
      '<span class="hl-play" aria-hidden="true"></span></div></div>' +
      '<div class="hl-now"><span class="hl-eyebrow">❄ Now playing</span>' +
      '<h2>' + esc(v.title) + '</h2>' +
      '<span class="meta dim">' + esc(CF.timeAgo(v.published)) + srcMeta(v) + "</span>" +
      '<a class="btn small" href="' + esc(CF.safeURL(v.link)) + '" target="_blank" rel="noopener">YouTube ↗</a></div>';
    nowIn(box);
    var poster = CF.$("#hl-poster");
    var probe = new Image();
    probe.onload = function () {
      poster.style.backgroundImage = "url(\"" + thumbURL + "\")";
      var frost = poster.querySelector(".hl-frost");
      if (frost) frost.parentNode.removeChild(frost);
    };
    probe.onerror = function () { poster.classList.add("hl-poster-bad"); };
    probe.src = thumbURL;
    var play = function () { featureVideo(v, true); };
    CF.$("#hl-poster").addEventListener("click", play);
    CF.$("#hl-poster").addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); }
    });
  }

  function render() {
    var list = CF.$("#hl-list");
    var items = state.items.filter(function (v) {
      return state.filter === "all" || kindOf(v) === "highlight";
    });
    if (!items.length) {
      list.innerHTML = CF.emptyHTML({
        icon: "🎬", title: "Nothing in this cut",
        sub: "Try the full feed — or the Bears channel on YouTube."
      });
      return;
    }
    // The entrance choreography runs once, on first paint.
    var enter = firstPaint; firstPaint = false;
    list.innerHTML = items.map(function (v, i) {
      return cardHTML(v, v.videoId === state.current, enter, i);
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll(".hl-card"), function (c) {
      c.addEventListener("click", function () {
        var v = state.items.filter(function (x) { return x.videoId === c.getAttribute("data-vid"); })[0];
        if (v) { featureVideo(v, true); box0scroll(); }
      });
    });
  }

  function box0scroll() {
    var box = CF.$("#hl-feature");
    if (box && box.getBoundingClientRect().top < 0) {
      box.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setPill(live, count) {
    var pill = CF.$("#hl-pill");
    pill.classList.remove("is-loading");
    pill.textContent = live ? ("● live · " + count + " videos") : ("◌ snapshot · " + count + " videos");
    pill.classList.toggle("cache", true);
  }

  // v1.32.0 — skeleton video cards mirroring .hl-card while the feed loads,
  // with a screen-reader status so the wait is announced.
  function skelCards(n) {
    var out = '<span class="sr-only" role="status">Loading the latest Bears videos…</span>';
    for (var i = 0; i < n; i++) {
      out += '<div class="hl-skel" aria-hidden="true"><span class="skel skel-shot"></span>' +
        '<span class="skel-copy"><span class="skel lg" style="width:92%"></span>' +
        '<span class="skel" style="width:56%"></span></span></div>';
    }
    return out;
  }

  async function load() {
    var list = CF.$("#hl-list");
    var pill = CF.$("#hl-pill");
    pill.textContent = "connecting…";
    list.innerHTML = skelCards(6);
    var r = await getVideos();
    state.items = r.items;
    setPill(r.live, r.items.length);
    var upd = CF.$("#hl-updated");
    if (upd) {
      var reelCount = r.items.filter(isGameReel).length;
      if (r.live) {
        // v1.175.0 — name what's leading: game reels sit on top of the
        // board whenever the shelf or the league feed provided any.
        upd.textContent = reelCount
          ? "Fresh from the Bears channel — " + reelCount + " game highlight reel" + (reelCount === 1 ? "" : "s") + " leading the board"
          : "Fresh from the Bears channel";
      } else if (reelCount) {
        // v1.175.0 — the shelf carried the page while the feeds are down;
        // its stamp says when the reels were last refreshed.
        var shelfAge = r.fetched ? CF.timeAgo(r.fetched) : "";
        upd.textContent = "Live feeds unreachable — showing saved game reels" + (shelfAge ? " (shelf refreshed " + shelfAge + ")" : "") + ".";
      } else {
        // v1.110.0 — the snapshot now carries its age, so fans can tell how
        // stale the fallback is instead of guessing.
        var age = r.fetched ? CF.timeAgo(r.fetched) : "";
        upd.textContent = "Live feeds unreachable — showing the last good snapshot" + (age ? " (" + age + ")" : "") + ".";
      }
    }
    if (r.items.length) {
      posterFor(r.items[0]);
      state.current = r.items[0].videoId;
    } else {
      CF.$("#hl-feature").innerHTML = CF.emptyHTML({
        icon: "📡", title: "No signal",
        sub: "The Bears and NFL channels wouldn't answer. Try refresh — or watch on YouTube directly."
      });
    }
    render();
  }

  function bindFilters() {
    Array.prototype.forEach.call(document.querySelectorAll(".hl-filters .chip"), function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(document.querySelectorAll(".hl-filters .chip"), function (c) {
          c.setAttribute("aria-pressed", c === chip ? "true" : "false");
        });
        state.filter = chip.getAttribute("data-filter");
        render();
      });
    });
  }

  /* ---------- v1.178.0 — the refresh button admits when it's working ----------
     The last refresh button with no busy state: a click re-fetched
     both channel feeds with no sign of life on the button itself, so
     a slow feed read as a dead button and a second click doubled the
     work. Clicks and the first load now funnel through refreshHl in
     the v1.95.0 odds / v1.177.0 injury-wire form: the button
     disables, flips to a spinning "Checking…" (aria-busy
     announced), overlapping refreshes stand down, and the label
     always restores. (No auto-beat on this page — highlights stay
     manual, as before.) */
  var hlBusy = false;
  function setHlBusy(busy) {
    hlBusy = busy;
    var btn = CF.$("#hl-refresh");
    if (!btn) return;
    btn.disabled = busy;
    btn.setAttribute("aria-busy", String(busy));
    btn.innerHTML = busy
      ? '<span class="cf-spin" aria-hidden="true">↻</span> Checking…'
      : "↻ Refresh now";
  }
  async function refreshHl() {
    if (hlBusy) return;
    setHlBusy(true);
    try { await load(); } catch (e) { /* load paints its own empty state */ }
    finally { setHlBusy(false); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindFilters();
    var btn = CF.$("#hl-refresh");
    if (btn) btn.addEventListener("click", refreshHl);
    refreshHl();
  });
})();
