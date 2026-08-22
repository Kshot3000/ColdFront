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

| Data | Source | Notes |
|---|---|---|
| News, scoreboard, schedule, standings, roster, box scores, odds line | `site.api.espn.com` | CORS-open in browsers. If a network blocks it, the site tries three public CORS proxies, then the snapshot it saved on your device |
| Prediction markets | `gamma-api.polymarket.com` | Live prices; cents ≈ implied probability |
| Chicago weather + Cold Front Index | `api.open-meteo.com` | No key, no account |
| Full odds board (optional) | `api.the-odds-api.com` | **Your** key, stored only in `localStorage`, 500 free requests/mo |
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
- Season-level **player** leader tables appear only when the feed exposes `seasonStats`; until then the page points you at the box score + PFR rather than guessing.
- Injury report rows are community-maintained — the official NFL pregame report always wins.
- Polymarket odds are market prices, not bookmaker lines; they can disagree, and both are right.
