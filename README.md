# THE COLD FRONT

**Chicago Bears × Midwest Winter Football** — an independent fan site for people who think football should be played in a blizzard.

Navy, orange, steel and frost. A 70-flake snow canvas. A "Cold Front Index" computed from real Chicago weather. Live news, injuries, practice intel, every game this side of the frozen lake, player stats, and an odds board with both Vegas lines and Polymarket prediction-market odds.

> Unofficial, unaffiliated fan project. Not affiliated with or endorsed by the NFL, the Chicago Bears, or any broadcaster. Odds are informational — 18+/21+ where legal.

---

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Next game + live score + countdown, NFC North watch, latest headlines, injury snapshot, quick links, socials |
| `news.html` | Live news wire with auto-refresh, plus an **injury wire** rail that flags report-moving headlines |
| `games.html` | Live scoreboard (auto-refreshing every 30 s), day-by-day picker, full season log with results, **box scores** on tap, division table |
| `stats.html` | Season pulse (record, points, differential from the log), player leaders when the feed exposes season stats, last game box score |
| `odds.html` | League-wire lines, **Polymarket prediction markets** (live prices, volume), and a full-board box that takes **your own The Odds API key** (free tier) for Bet365/Pinnacle/DraftKings side-by-side |
| `injuries.html` | Community-maintained report table (`data/injuries.json`) + live injury wire |
| `practice.html` | The facilities (Halas Hall, Navy Pier, Soldier Field), the honest week-at-the-facility table, media availability, and a practice tracker you can keep (`data/practice.json`) |
| `team.html` | Full roster from the league wire — search by name/jersey, filter by position |
| `about.html` | The site, **@kshot9000** on X, donation addresses (BTC / ERG / ADA) with QR + copy, and the other projects |
| `404.html` | A whiteout |

## Data sources (all keyless, all in-browser)

Every feed is fetched through a **raced multi-source chain**: the primary host and its alternates are tried **in parallel** (fastest winner, losers abort), then public CORS proxies are raced as a rescue stage, and finally the last good snapshot from your device is shown, clearly badged. That's what keeps every panel filling even on a hostile network.

| Data | Sources tried (in order) | Notes |
|---|---|---|
| Scoreboard, schedule, standings, roster, wire, box scores, odds line | `site.api.espn.com` → `site.web.api.espn.com` → `cdn.espn.com` (core API, schedule) | Same JSON, different infrastructure — a network that blocks one rarely blocks all three |
| …if a visitor's network blocks all direct hosts | `cors.eu.org` → `allorigins.win` → `corsproxy.io` → `codetabs.com` (public CORS proxies) → optional Cloudflare Worker (`remoteProxy`) | Free public proxies rotate in and out; the site keeps a bench of them and uses whichever answers |
| News wide wire | Google News RSS → Bing News RSS (same chain) | 100+ outlets, no key |
| Roster / schedule / standings (optional, BYO free key) | **TheSportsDB** — a fully independent provider (different company, CDN, JSON) | Set your free key on the About page; the key stays in `localStorage` and is sent only to TheSportsDB |
| Prediction markets | `gamma-api.polymarket.com` | Live prices; cents ≈ implied probability |
| Chicago weather + Cold Front Index | `api.open-meteo.com` → `api.weather.gov` (NOAA/NWS) | No key, no account |
| Full odds board (optional) | `api.the-odds-api.com` | **Your** key, stored only in `localStorage`, 500 free requests/mo |
| Season stats / injury ETAs (optional) | API-Sports (free key) | Set on the About page |
| Injury report + practice tracker | `data/*.json` in this repo | You edit, you push |

**Offline behavior:** every feed that answers once is cached in `localStorage` with a TTL, so a later whiteout shows your last good snapshot — clearly badged `snapshot`, never pretending to be live. Sample/placeholder rows are labeled as such. The site never invents stats.

## Live updates — what refreshes, how often

Every page registers its panels with one shared auto-refresh scheduler (`CF.refresh` in `js/common.js`). As long as a tab is open, the panels keep re-pulling their feeds on the cadence below. Hidden tabs pause (browsers throttle background tabs anyway), and anything that came due while hidden fires the moment the tab comes back to the front. A job that is already mid-flight is never stacked, and a panel whose refresh fails keeps its last good data and wears its `offline` / `snapshot` pill until the next successful pull.

| Panel | Where | Refreshes every |
|---|---|---|
| Next game + live clock | Home · Games | 30 s |
| Scoreboard (scheduled → live → final) | Games | 30 s |
| Headlines | Home | 60 s |
| NFC North standings | Home | 60 s |
| Vegas wire line | Odds | 60 s |
| Polymarket board | Odds | 60 s |
| Season pulse · last-game box score | Stats | 2 min |
| Season log | Games | 3 min |
| Player leaders | Stats | 5 min |
| Roster | Team | 5 min |
| Injury wire · injury report · practice tracker · news wire | News · Injuries · Practice · Home | 5 min |
| Chicago weather + Cold Front Index | every page | 10 min |

**"Forever" means:** leave the tab open all game and the board tracks the clock for the whole game. Close the tab and the static site does nothing — there is no server behind it, by design. Open it again and every panel starts by hitting the live feeds directly, so every visit is fresh.

Two honest ceilings:

- `data/injuries.json` and `data/practice.json` only change when *you* edit and push them. The 5-min re-check picks up your push on the next cycle (and GitHub Pages' CDN can serve a just-pushed file for up to ~10 min, so expect a short lag after pushing).
- The Odds API full board stays **manual** on purpose: the free tier is 500 requests/month, and the site will not burn your quota in the background.

## Quick start (local)

Open `index.html` directly, or serve it:

```powershell
python -m http.server 8080
# or: npx serve .
```

Visit <http://localhost:8080>.

## Deploy to GitHub Pages

**This site is live** at <https://kshot3000.github.io/ColdFront/> (repo: [`Kshot3000/ColdFront`](https://github.com/Kshot3000/ColdFront), Pages source: branch `main`, folder `/`).

To update it: edit files here, then

```powershell
cd the-cold-front
git add .
git commit -m "what changed"
git push
```

GitHub Pages rebuilds automatically — the new version is live in about a minute.

(If you ever re-host it elsewhere: push to any repo, then Settings → Pages → Source *Deploy from a branch* → branch `main`, folder `/ (root)`.)

## Keeping the feeds live

Most visitors' browsers hit the ESPN / Polymarket / Open-Meteo APIs directly — the site tries that path first and it "just works". Two things can break that on a given machine:

- **CDN 403s** — some networks (residential lines, VPNs) get their browser-fingerprinted traffic 403'd by the CDN edge, and the panels show *snapshot/offline*;
- **Local Network Access** — recent Chrome (151+) blocks *public* pages (like a github.io site) from reading responses of `localhost` services, so a browser-fine feed proxy can still be refused by the browser itself.

For those machines this repo includes a tiny **local feed proxy + site mirror**:

| File | What it is |
|---|---|
| `Start-Local-Proxy.bat` | double-click launcher (starts proxy + mirror minimized, prints a health check for each) |
| `proxy/cf-proxy.ps1` | the proxy itself — pure PowerShell + .NET, zero dependencies; loopback-only: feed proxy on port 8799 + read-only site mirror on port 8080 |
| `proxy/cf-proxy.log` | runtime log (created on first start; git-ignored) |
| `proxy/cf-proxy-worker.js` + `proxy/wrangler.toml` | optional Cloudflare Worker with the same API, for phones / other machines |

Every feed resolves in this order: **local proxy → direct → optional remote proxy → public CORS proxies → last snapshot**. So:

- on a machine where the proxy runs, feeds stay live even if that network 403s the browser;
- everybody else takes the direct path, unchanged;
- if the proxy isn't running, the local attempt fails in a few milliseconds and the chain moves on — no downside anywhere.

**Which URL to open where:**

- **On the machine that runs the proxy:** open **`http://127.0.0.1:8080/`** — the same site served from loopback. A loopback origin reading a loopback proxy is exactly what browsers allow, so this path is guaranteed live in every browser (it sidesteps the Local Network Access rule above). Bookmark it.
- **Everywhere else (phone, other computers):** the public site — `https://kshot3000.github.io/ColdFront/` — keeps working through the direct feed path.

One honest caveat: in the preseason the **standings** endpoint is an empty stub, so the site derives a division table from the completed games in the season window and labels it clearly as *preseason · from games played* rather than faking official standings. Official standings take over the moment the league publishes them.

```powershell
# start (idempotent — safe to re-run; a second instance detects the port and exits)
.\Start-Local-Proxy.bat

# health check
curl http://127.0.0.1:8799/healthz        # -> {"ok":true}

# stop: end the powershell.exe whose command line contains "cf-proxy.ps1"
```

**Auto-start at login:** a shortcut to `Start-Local-Proxy.bat` lives in the Windows *Startup* folder (`shell:startup`) — delete that shortcut to turn auto-start off. This is what keeps the site's data updating constantly while your machine is on.

**Remote / mobile (optional):** deploy `proxy/cf-proxy-worker.js` (e.g. `npm i -g wrangler`, then `wrangler deploy` from `proxy/`) and paste the Worker URL into `CF.CONFIG.endpoints.remoteProxy` in `js/common.js`. Both implementations enforce the same host allow-list; the proxy only ever fetches from the sources below.

**Data sources (every feed has a second source — and most have a third):**

| Panel | Primary | Second source | Third source |
|---|---|---|---|
| Scoreboard, schedule, roster, wire, box scores, leaders | ESPN site API (`site.api.espn.com`) | **alternate ESPN hosts** (`site.web.api.espn.com`, `cdn.espn.com`) raced in parallel → **public CORS proxies** (cors.eu.org, allorigins, …) | derived from the scoreboard (per-game box + camp leaders) |
| Division standings | ESPN standings | **derived preseason table** (W–L from completed games) | **TheSportsDB** (free key) |
| Roster | ESPN roster | alternate ESPN hosts + public proxies | **TheSportsDB** (free key) |
| Schedule / season log | ESPN schedule | alternate ESPN hosts + public proxies | **TheSportsDB** (free key) |
| News | ESPN wire | **Google News RSS** ("Chicago Bears", 100+ outlets) | **Bing News RSS** |
| Injury report | ESPN **league injury report** (per-player status + notes) | roster injury flags → community JSON | **API-Sports** (free key) for structured rows + ETAs |
| Season player stats / leaders | per-game leaders from the league wire | **API-Sports** (free key) | — |
| Weather strip + cold-front gauge | Open-Meteo | **NOAA/NWS** (`api.weather.gov`, official US forecast) | — |
| Prediction markets | Polymarket | **The Odds API** (free key) | — |
| Vegas lines | The Odds API (your key) | ESPN league wire |

Three **free BYO-key** upgrades are optional and the site works fully without them: [API-Sports](https://www.api-sports.io/) (season stats + injury ETAs, 100 req/day), [The Odds API](https://the-odds-api.com/) (full Vegas board, 500 req/mo) and [TheSportsDB](https://www.thesportsdb.com/) (independent roster/schedule/standings wire). Each is set on the About page or right where it's used; every key lives only in your browser. Enterprise feeds (Sportradar, Opta/Stats Perform, LSports, SportsDataIO) are real-time, low-latency options priced for production — the site is built to run without them.

The weather strip shows `NOAA/NWS` when it had to use the fallback, so you can see which source you're reading.

**Troubleshooting:** `proxy/cf-proxy.log` records every upstream fetch with status and byte count. The listener binds `127.0.0.1:8799` only — nothing outside the machine can reach it. If a panel still says *snapshot*, the whole chain was exhausted: check the log, then the pill text on the panel.

## Editing your data

One config block, one JSON per editable dataset:

| What | Where |
|---|---|
| X profile, GitHub base, donations, projects, socials | `CF.CONFIG` at the top of `js/common.js` (clearly marked `████ CONFIG ████`) |
| Injury report rows | `data/injuries.json` — `{ name, pos, injury, status, statusCls, eta }` |
| Practice tracker rows | `data/practice.json` — `{ date, session, focus, media, notes }` |

Notes:

- The donation wallets here are the same public addresses as **EUTXO.DEX** and **NightDream.io** (BTC `3GnR7…X8vZK`, ERG `9fcM5…Pvy`, ADA `addr1q…44v`). Change them in `CF.CONFIG.donations` and they update in About + everywhere the config is used.
- Project links use your GitHub handle `Kshot3000` (X handle stays `@kshot9000`). Both live in `CF.CONFIG.author` — one place, all links.
- The odds full-board key never leaves the visitor's browser.

## Repo layout

```
the-cold-front/
├── index.html          home: next game, division, wire, injury snapshot
├── news.html           live news wire + injury rail
├── games.html          live board, season log, box scores, division
├── stats.html          season pulse, leaders, last game box
├── odds.html           Vegas line + Polymarket + full board (own key)
├── injuries.html       report table + injury wire
├── practice.html       facilities, weekly rhythm, tracker
├── team.html           searchable roster
├── about.html          builder, donations, projects, socials
├── 404.html            whiteout
├── css/main.css        whole design system (navy/orange/steel/frost)
├── js/common.js        CONFIG + utilities + snow + weather + chrome
├── js/api.js           ESPN / Polymarket / The Odds API layer
├── js/<page>.js        one small file per page
├── data/injuries.json  community report (you maintain)
├── data/practice.json  practice tracker (you maintain)
├── img/favicon.svg     paw over the cold front
├── robots.txt
└── README.md
```

Zero build step, zero npm, zero dependencies. The only external calls are Google Fonts (with system fallbacks), the QR image service on About, and the data feeds above — each with a graceful offline state.

## Honest limitations

- Static site, by design: auto-refresh runs while a tab is open and resumes fresh on every visit; nothing runs server-side between visits. "Constantly, forever" = *constantly while you're looking*, forever fresh on every visit.
- Background tabs are throttled by the browser — that's the browser's policy, not the site's. Jobs catch up the instant the tab is visible again.
- `data/*.json` (injuries, practice) only change when you edit + push; expect a short CDN lag after pushing.
- ESPN's API is blocked on some networks (it was during development); the proxy + snapshot fallback exists for exactly that, but first-visit offline will show honest "offline" panels instead of fake data.
- Recent Chrome also refuses public pages reading loopback services ("Local Network Access") — the 8080 site mirror exists for exactly that; see *Keeping the feeds live*.
- Season-level **player** leader tables use per-game league-wire leaders ("camp leaders") by default; set a free API-Sports key on the About page and they switch to full-season stats automatically.
- Injury report rows come from the ESPN league injury report (per-player status + notes) with roster flags and a community JSON as fallback — the official NFL pregame report always wins.
- Polymarket odds are market prices, not bookmaker lines; they can disagree, and both are right.
