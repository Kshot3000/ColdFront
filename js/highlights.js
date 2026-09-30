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

  // One feed fetch that degrades to an empty list — the merge below treats a
  // dead feed as "no items from this source" rather than failing the page.
  async function feedItems(url, src, gate) {
    try {
      var xml = await CF.fetchText(url, { timeout: 8000 });
      var items = parseAtom(xml, src);
      return gate ? items.filter(gate) : items;
    } catch (e) { return []; }
  }

  // Merge the two feeds: de-dupe on videoId, newest first, capped.
  function mergeFeeds(a, b) {
    var seen = {}, out = [];
    a.concat(b).forEach(function (v) {
      if (!v || !v.videoId || seen[v.videoId]) return;
      seen[v.videoId] = true;
      out.push(v);
    });
    out.sort(function (x, y) {
      return (Date.parse(y.published) || 0) - (Date.parse(x.published) || 0);
    });
    return out.slice(0, MAX_ITEMS);
  }

  async function getVideos() {
    // 1) Live channel RSS through the raced chain, both feeds in parallel:
    // the Bears channel plus the NFL league channel's Bears game reels.
    var feeds = await Promise.all([
      feedItems(RSS_URL, "bears", null),
      feedItems(NFL_RSS_URL, "nfl", nflReel)
    ]);
    var merged = mergeFeeds(feeds[0], feeds[1]);
    if (merged.length) return { items: merged, live: true, fetched: null };
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
    return '<button type="button" class="hl-card' + (active ? " is-active" : "") + (enter ? " cf-enter" : "") + '" data-vid="' + esc(v.videoId) + '" data-kind="' + kind + '"' +
      (enter ? ' style="--hi:' + Math.min(idx, 11) + '"' : "") + '>' +
      '<span class="hl-thumb"><img loading="lazy" src="' + esc(CF.safeURL(v.thumb)) + '" alt="" ' +
      'onerror="CF.hlThumbFail(this)">' +
      '<span class="hl-mini-play" aria-hidden="true"></span></span>' +
      '<span class="hl-body"><span class="hl-title">' + esc(v.title) + "</span>" +
      '<span class="hl-meta dim"><span>' + esc(CF.timeAgo(v.published)) + "</span>" +
      (kind === "highlight" ? '<span class="hl-kind">Highlight</span>' : "") + srcBadge +
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
    Array.prototype.forEach.call(document.querySelectorAll(".hl-card"), function (c) {
      c.classList.toggle("is-active", c.getAttribute("data-vid") === v.videoId);
    });
  }

  function posterFor(v) {
    // Poster with big play button; first click swaps in the real player.
    var box = CF.$("#hl-feature");
    box.innerHTML =
      '<div class="hl-ratio"><div class="hl-poster" id="hl-poster" role="button" tabindex="0" ' +
      'aria-label="Play: ' + esc(v.title) + '" ' +
      'style="background-image:url(\'' + esc(CF.safeURL(v.thumb)) + '\')">' +
      '<span class="hl-play" aria-hidden="true"></span></div></div>' +
      '<div class="hl-now"><span class="hl-eyebrow">❄ Now playing</span>' +
      '<h2>' + esc(v.title) + '</h2>' +
      '<span class="meta dim">' + esc(CF.timeAgo(v.published)) + srcMeta(v) + "</span>" +
      '<a class="btn small" href="' + esc(CF.safeURL(v.link)) + '" target="_blank" rel="noopener">YouTube ↗</a></div>';
    nowIn(box);
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
      if (r.live) {
        // v1.110.0 — name the sources honestly: the league reels only show up
        // when the NFL feed actually contributed one.
        var nflCount = r.items.filter(function (v) { return v.src === "nfl"; }).length;
        upd.textContent = nflCount
          ? "Fresh from the Bears channel + " + nflCount + " game reel" + (nflCount === 1 ? "" : "s") + " from the NFL channel"
          : "Fresh from the Bears channel";
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

  document.addEventListener("DOMContentLoaded", function () {
    bindFilters();
    var btn = CF.$("#hl-refresh");
    if (btn) btn.addEventListener("click", load);
    load();
  });
})();
