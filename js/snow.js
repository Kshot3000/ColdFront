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
  document.body.appendChild(control);

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
    control.innerHTML = '<span aria-hidden="true">❄</span> ' + (active ? "Snow on" : "Snow paused");
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
