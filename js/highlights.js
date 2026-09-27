/* ============================================================
   THE COLD FRONT — game highlights (v1.13.0)
   Latest videos from the official Chicago Bears YouTube channel,
   pulled keyless through the raced fetch chain:
     YouTube channel RSS (Atom) → public CORS proxies → local snapshot.
   Clicking a card loads it into the featured player (privacy-enhanced
   youtube-nocookie embed). "Highlights only" filters for game footage.
   v1.32.0: frosted-glass card glow-up with identity thread, staggered
   frost-fade entrance on first paint, and skeleton video cards while
   the feed loads.
   ============================================================ */
"use strict";

(function () {
  // Official Chicago Bears YouTube channel.
  var CHANNEL_ID = "UCP0Cdc6moLMyDJiO0s-yhbQ";
  var RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID;
  var CHANNEL_URL = "https://www.youtube.com/@ChicagoBears";
  var MAX_ITEMS = 18;

  // Titles that smell like game footage (not press conferences).
  var HL_RE = /\b(highlight|mic'd|micd|top\s?\d+|every\s+\w+\s+(catch|run|play|sack|touchdown)|vs\.?\b|game\s+(trailer|recap|highlights)|hype|wired|sound\s+fx|all\s+22|film\s+room|can't-miss|best\s+plays)\b/i;
  var PRESS_RE = /\bpress\s+conference\b/i;

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

  function parseAtom(xml) {
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
        link: "https://www.youtube.com/watch?v=" + vid
      });
    });
    return out;
  }

  function kindOf(v) {
    if (HL_RE.test(v.title) && !PRESS_RE.test(v.title)) return "highlight";
    return "video";
  }

  async function getVideos() {
    // 1) Live channel RSS through the raced chain.
    try {
      var xml = await CF.fetchText(RSS_URL, { timeout: 8000 });
      var items = parseAtom(xml).slice(0, MAX_ITEMS);
      if (items.length) return { items: items, live: true };
    } catch (e) { /* proxies next */ }
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
              link: "https://www.youtube.com/watch?v=" + it.videoId
            };
          }),
          live: false
        };
      }
    } catch (e2) { /* fall through */ }
    return { items: [], live: false };
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
    return '<button type="button" class="hl-card' + (active ? " is-active" : "") + (enter ? " cf-enter" : "") + '" data-vid="' + esc(v.videoId) + '" data-kind="' + kind + '"' +
      (enter ? ' style="--hi:' + Math.min(idx, 11) + '"' : "") + '>' +
      '<span class="hl-thumb"><img loading="lazy" src="' + esc(CF.safeURL(v.thumb)) + '" alt="" ' +
      'onerror="CF.hlThumbFail(this)">' +
      '<span class="hl-mini-play" aria-hidden="true"></span></span>' +
      '<span class="hl-body"><span class="hl-title">' + esc(v.title) + "</span>" +
      '<span class="hl-meta dim"><span>' + esc(CF.timeAgo(v.published)) + "</span>" +
      (kind === "highlight" ? '<span class="hl-kind">Highlight</span>' : "") +
      "</span></span></button>";
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
      '<div class="hl-now"><h2>' + esc(v.title) + '</h2>' +
      '<span class="meta dim">' + esc(CF.timeAgo(v.published)) +
      (kind === "highlight" ? ' · <span class="hl-kind">Highlight</span>' : "") + "</span>" +
      '<a class="btn small" href="' + esc(CF.safeURL(v.link)) + '" target="_blank" rel="noopener">YouTube ↗</a></div>';
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
      '<div class="hl-now"><h2>' + esc(v.title) + '</h2>' +
      '<span class="meta dim">' + esc(CF.timeAgo(v.published)) + "</span>" +
      '<a class="btn small" href="' + esc(CF.safeURL(v.link)) + '" target="_blank" rel="noopener">YouTube ↗</a></div>';
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
    if (upd) upd.textContent = r.live ? "Fresh from youtube.com/@ChicagoBears" : "Live feed unreachable — showing the last good snapshot.";
    if (r.items.length) {
      posterFor(r.items[0]);
      state.current = r.items[0].videoId;
    } else {
      CF.$("#hl-feature").innerHTML = CF.emptyHTML({
        icon: "📡", title: "No signal",
        sub: "The Bears channel wouldn't answer. Try refresh — or watch on YouTube directly."
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
