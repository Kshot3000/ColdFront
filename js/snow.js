/* Decorative lake-effect snow. Weather never controls this visual effect. */
"use strict";

CF.initSnow = () => {
  const canvas = CF.$("#snow");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = true;
  try { enabled = localStorage.getItem("cf.snow") !== "off"; } catch (_) { /* optional preference */ }
  let width = 0, height = 0, flakes = [], frame = 0, previous = 0, elapsed = 0;
  const control = document.createElement("button");
  control.type = "button";
  control.className = "snow-toggle";
  control.setAttribute("aria-controls", "snow");
  // v1.100.0 — the toggle's home follows the viewport, using the same
  // max-width:760px breakpoint the CSS dock rule uses. On phones it docks in
  // the sticky header (left of the menu button) so it can never park on
  // readable content — the floating pill used to cover the
  // responsible-gambling helpline number on odds.html and the matchup line on
  // the NEXT UP card (v1.79.0). On desktop the CSS floats it bottom-right via
  // position:fixed — but that only reaches the viewport when the toggle is NOT
  // inside .site-head: the header's backdrop-filter makes it a containing
  // block for fixed descendants, which trapped the pill at the header's
  // bottom-right, burying the X nav link under it. So desktop parks the
  // control on document.body (no filters or transforms there), and a change
  // listener re-homes it across resizes and orientation flips.
  const dockMq = window.matchMedia("(max-width: 760px)");
  const placeSnowToggle = () => {
    const headBar = document.querySelector(".site-head .wrap");
    const navToggle = headBar && headBar.querySelector(".nav-toggle");
    if (dockMq.matches) {
      if (navToggle) headBar.insertBefore(control, navToggle);
      else if (headBar) headBar.appendChild(control);
      else document.body.appendChild(control);
    } else {
      // Desktop: escape the header's backdrop-filter trap so the CSS
      // position:fixed actually floats the pill at the viewport's bottom-right.
      document.body.appendChild(control);
    }
  };
  dockMq.addEventListener("change", () => { placeSnowToggle(); dodgeFooter(); });
  placeSnowToggle();

  // v1.104.0 — the desktop pill is position:fixed bottom-right, so at the
  // page bottom it parked on top of the footer tip chip ("Tip the build ·
  // BTC"), burying the Copy label. When the footer rises into the pill's
  // parking zone the pill now rides just above it: every scroll/resize
  // measures the overlap between the pill's bottom edge and the footer's
  // top edge and raises the pill by that overlap plus a 12px breathing gap.
  // It tracks 1:1 with the scroll — deliberately no CSS transition, so the
  // pill never lags behind the footer edge. Phones are untouched: there the
  // pill docks in the header (position:static) and never meets the footer.
  let lastDodge = null;
  const dodgeFooter = () => {
    if (dockMq.matches) { if (lastDodge !== "") { control.style.bottom = ""; lastDodge = ""; } return; }
    const foot = document.querySelector(".site-foot");
    if (!foot) { if (lastDodge !== "") { control.style.bottom = ""; lastDodge = ""; } return; }
    const overlap = control.getBoundingClientRect().bottom - foot.getBoundingClientRect().top;
    let next = "";
    if (overlap > 0) {
      const parked = parseFloat(getComputedStyle(control).bottom) || 18;
      next = (parked + overlap + 12) + "px";
    }
    if (next !== lastDodge) { control.style.bottom = next; lastDodge = next; }
  };
  window.addEventListener("scroll", dodgeFooter, { passive: true });
  window.addEventListener("resize", dodgeFooter, { passive: true });
  dodgeFooter();

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Fewer particles on phones; density stays consistent on large displays.
    const count = Math.round(Math.min(170, Math.max(45, width * height / 8500)));
    flakes = Array.from({ length: count }, () => {
      const depth = Math.random();
      return { x: Math.random() * width, y: Math.random() * height,
        radius: 0.6 + depth * 2.5, speed: 16 + depth * 48,
        alpha: 0.22 + depth * 0.56, drift: Math.random() * Math.PI * 2,
        depth };
    });
  }

  function draw(time) {
    frame = 0;
    if (!enabled || reduced.matches || document.hidden) return;
    const dt = previous ? Math.min((time - previous) / 1000, 0.05) : 0;
    previous = time;
    elapsed += dt;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#edf7ff";
    const wind = 10 + Math.sin(elapsed * 0.19) * 13;
    for (const flake of flakes) {
      flake.x += (wind * (0.3 + flake.depth) + Math.sin(elapsed * 0.7 + flake.drift) * 8) * dt;
      flake.y += flake.speed * dt;
      if (flake.y > height + 8) { flake.y = -8; flake.x = Math.random() * width; }
      if (flake.x > width + 8) flake.x = -8;
      if (flake.x < -8) flake.x = width + 8;
      ctx.globalAlpha = flake.alpha;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    frame = requestAnimationFrame(draw);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    const active = enabled && !reduced.matches;
    canvas.hidden = !active;
    document.documentElement.classList.toggle("motion-paused", !active);
    control.setAttribute("aria-pressed", String(active));
    control.setAttribute("aria-label", active ? "Pause snowfall and background motion" : "Resume snowfall and background motion");
    // v1.79.0 — the label span lets the phone layout collapse the toggle to
    // icon-only while assistive tech still gets the state from
    // aria-label/aria-pressed on the button itself.
    control.innerHTML = '<span class="snow-ico" aria-hidden="true">❄</span><span class="snow-label">' + (active ? "Snow on" : "Snow paused") + "</span>";
    control.disabled = reduced.matches;
    control.title = reduced.matches ? "Your device prefers reduced motion" : "Decorative snowfall · Chicago weather is shown above";
    if (active && !document.hidden) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, width, height);
  }

  control.addEventListener("click", () => {
    enabled = !enabled;
    try { localStorage.setItem("cf.snow", enabled ? "on" : "off"); } catch (_) { /* private browsing */ }
    sync();
  });
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  window.addEventListener("pagehide", () => { cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener("pageshow", sync);
  resize();
  sync();
};
