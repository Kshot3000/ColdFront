# The Cold Front

Independent Chicago Bears fan headquarters, published at **https://kshot3000.github.io/ColdFront/**.

## The fan experience

- Chicago night photography, a fixed winter background, and layered falling snow on every page.
- The **Snow on / Snow paused** control remembers a visitor's choice. Device reduced-motion settings stop the animation; background tabs stop rendering snow. Phones get fewer particles.
- The stadium hero, Sunday desk, week clock, film room, injury movement, weather sparkline, and same-origin data snapshots are retained from the current site.
- Home includes the next Bears matchup, a kickoff countdown, a season summary, this week's NFC North matchups, standings, news, and injury highlights.
- **Make your call** saves a personal score prediction for that specific game on the visitor's device. It is not a shared poll.
- The roster includes player cards, search, position and group filters, a table view, and device-local favorites.
- Mobile navigation, keyboard focus, Escape-to-close menus, a skip link, and deep links to game dates are supported.

## Privacy

Chicago weather uses fixed Soldier Field coordinates, **41.8623, -87.6167**. The site does not call the browser geolocation API and does not automatically connect to localhost or request local-network access. The old automatic loopback-proxy probe has been removed.

Favorites, predictions, snow preferences, cached public data, and optional user-provided API keys are stored locally in the visitor's browser. Credential-bearing requests go directly to the relevant provider, never through public CORS proxies. No shared provider keys belong in the repository.

## Pages

| Page | Features |
| --- | --- |
| Home | Matchup, personal score pick, season numbers, news, North matchups and standings |
| News | ESPN stories, injury headlines, wider RSS wire, refresh |
| Games | Date-selectable scoreboard, season schedule, per-game leaders, division standings |
| Highlights | Latest Bears YouTube videos, featured player, highlights-only filter, no key needed |
| Stats | Completed-game record, scoring, recent Bears leaders, last-game detail |
| Odds | ESPN game lines, Bears prediction markets, optional The Odds API board |
| Injuries | ESPN report, roster flags, community fallback, injury news |
| Practice | Official Halas Hall, training camp and stadium resources; confirmed-session tracker |
| Team | Player cards, roster search, filters, favorites, table view |
| About | Builder, projects, donation wallets, socials, optional provider settings |
| 404 | Branded recovery with working links even from nested missing URLs |

## Run and test

No build step or runtime packages are needed. Serve the repository root with a static server:

```sh
python3 -m http.server 8080
```

The development-only tests use Node.js 20.19+ and jsdom:

```sh
npm ci
npm test
```

Tests exercise all ten pages, navigation, real user controls, date links, score normalization, NFC North membership, credential routing, offline behavior, unavailable storage, and reduced-motion changes. Fixture responses are explicitly test data and are never used by the public website. The feed adapters have also been checked against actual ESPN schedule, standings, roster, headline, injury, and odds responses.

## Data and limitations

ESPN public endpoints supply football data. Open-Meteo supplies current weather; NWS provides a clearly labeled forecast fallback. Concurrent requests for the same feed are shared. Cached results are labeled and expire. Scheduled zero scores never count as completed results; ties are preserved. All kickoff times are displayed in Chicago time.

The league injury response is reduced to the Bears before storage, so the full league payload does not fill browser storage. Injury report dates are not promised return dates. The community files intentionally contain no invented injuries or practice sessions.

The wider RSS wire and prediction markets depend on third-party CORS policies. A temporary provider outage produces an unavailable state with source links, rather than fabricated data. Optional keyed providers depend on a visitor's valid key, quota, and plan coverage; authenticated provider calls were not tested with a real key.

## Editing

- `css/main.css`, `css/experience.css`: shared visual design and responsive layouts.
- `js/common.js`: configuration, caching, weather, navigation, author and original donation addresses.
- `js/snow.js`: snowfall and motion preference controls.
- `js/api.js`: providers and normalization.
- `data/practice.json`, `data/injuries.json`: confirmed community updates.

GitHub Pages serves `main` from the repository root. No hosting migration is required. The historical Windows proxy scripts are retained for manual local development; public visitors never use them automatically.

## Sources

- [Bears training camp](https://www.chicagobears.com/fan-zone/training-camp)
- [1920 Football Drive](https://www.chicagobears.com/video/1920-football-drive)
- [Soldier Field visitor information](https://www.soldierfield.com/plan-your-visit)
- [NFL odds API documentation](https://the-odds-api.com/sports/nfl-odds.html)
- [API-NFL documentation](https://api-sports.io/documentation/nfl/v1)
- [Photography attribution](img/ATTRIBUTION.txt)

Independent fan project. Not affiliated with or endorsed by the NFL, the Chicago Bears, or any broadcaster. Odds are informational.
