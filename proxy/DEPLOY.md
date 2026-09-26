# Cold Front remote proxy (Cloudflare Worker)

The static GitHub Pages site reaches ESPN / news / weather directly when the
visitor's network allows it. When Akamai or a corporate filter blocks those
hosts, the site races a short public-CORS bench and then falls back to
same-origin `data/snapshots/`.

For an **always-on** rescue path (phones, locked-down networks), deploy the
included Worker and point the site at it.

## Why this Worker

`proxy/cf-proxy-worker.js` is a tiny allow-listed HTTPS fetch proxy:

- `GET /healthz` → `{ ok: true }`
- `GET /fetch?url=<https://…>` → upstream body with CORS `*`
- Host allow-list only (ESPN, Polymarket, Open-Meteo, NWS, news RSS, …)

It does **not** store keys or rewrite JSON. Free Cloudflare tier is plenty
for a fan site.

## Deploy

Credentials are **not** in this repo. You need a Cloudflare account.

```bash
# Node 22+ recommended for current wrangler
npm i -g wrangler
wrangler login
cd proxy
wrangler deploy
```

Or: Cloudflare dashboard → Workers & Pages → Create → paste
`cf-proxy-worker.js` → Deploy.

Note the URL, e.g. `https://cf-proxy.<you>.workers.dev`.

## Wire it into the site

In `js/common.js`:

```js
remoteProxy: "https://cf-proxy.<you>.workers.dev",
```

Commit + push. Leave `remoteProxy: ""` to skip (default). With it set, every
feed races the Worker in stage 2 alongside the public CORS bench.

## Local alternative

`Start-Local-Proxy.bat` / `proxy/cf-proxy.ps1` binds `127.0.0.1:8799` for
desktop browsing. GitHub Pages skips loopback automatically
(`CF.usableLocalProxy`) so Mixed Content / Private Network Access cannot
hang public visitors.

## Ops notes (2026-09)

Public CORS proxies (allorigins, corsproxy.io, cors.eu.org, …) frequently
403 or time out on ESPN. Treat them as best-effort. Prefer this Worker when
you can deploy it; keep `data/snapshots/` fresh either way.
