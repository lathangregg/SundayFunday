# Sunday Funday

An interactive, mobile-friendly analytics site for the **Sunday Funday: Dynasty Edition** Sleeper fantasy football league (8 teams).
It pulls league data from Sleeper's free public API on a schedule, checks it, and publishes a static site.

- **Home**: standings, headline stats (leader, luckiest/unluckiest, top score), weekly results
- **History**: *Season* (rank-by-week chart, points-by-week heat table, results for any week) and *All-time* (standings across every season, finish by season, head-to-head matrix, scoring by season, records book)
- **Data**
  - **Schedule analysis**: every team's record against every other team's schedule (8×8), record against all teams by week, and a summary with schedule luck and record against the weekly median
  - **Roster analysis**: top-heavy share, concentration curves, dependency on the top scorer, position mix, and points vs. league average by position

Charts are tappable (tooltips with game and player detail), tables sort when you tap a header, and the Data pages have a week-range filter.

## How it works

```
Sleeper API  →  scripts/fetch.mjs  →  site/data/league.json  →  site/ (static pages)  →  hosting
                                        ↑ tests/verify.mjs checks it before every deploy
```

| Path | What it is |
|---|---|
| `config.json` | League ID and your Sleeper username (the username gets highlighted on the site) |
| `scripts/fetch.mjs` | Pulls teams, weekly matchups, starters' points, and past seasons (via `previous_league_id`) into `site/data/league.json` |
| `site/js/analytics.js` | All calculations (pure functions, shared by the site and the tests) |
| `site/js/pages/` | One file per page: `home`, `history`, `schedule`, `roster` |
| `tests/verify.mjs` | Consistency checks (e.g. the pivot diagonal must equal Sleeper's official records)  |
| `.github/workflows/update.yml` | Scheduled refresh: fetch → verify → commit data → deploy |

No build step and no dependencies: plain ES modules, Node 18+ for the scripts.

## Run it locally

```bash
node scripts/fetch.mjs     # refresh data from Sleeper
node tests/verify.mjs      # sanity checks
node scripts/serve.mjs     # then open http://localhost:8080
```

## Automatic updates

`.github/workflows/update.yml` runs at **11:50 PM Central on Sunday, Monday and Thursday nights** (05:50 UTC the next day), on every push that touches the site or scripts, and on demand from the **Actions** tab ("Run workflow"). If the data changed, it commits `site/data/league.json`; if the checks fail, nothing is deployed and the previous site stays up.

A week only counts as *completed* once Sleeper's current NFL week has moved past it and every team has a score. The in-progress week appears on Home as live scores but is excluded from all analysis.

## Hosting

**Option A: GitHub Pages** (free for public repos)
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Run the workflow once (Actions tab → *Update data and deploy* → Run workflow).
3. The site appears at `https://<your-username>.github.io/<repo-name>/`.

**Option B: Cloudflare Pages** (free, works with a private repo)
1. Create a Pages project from this repo. Build command: *(none)*. Output directory: `site`.
2. In this repo, add a repository variable `DEPLOY_PAGES` = `false` (Settings → Secrets and variables → Actions → Variables) so the GitHub Pages deploy step is skipped.
3. The workflow still refreshes and commits the data; Cloudflare redeploys on each commit.

Note that anything the site loads, including `league.json`, is visible to anyone with the link.

## Definitions

- **Schedule pivot**: team A's weekly scores replayed against team B's opponents. In the week B actually played A, A would face itself, so that week uses A's real head-to-head result against B. The diagonal is each team's real record.
- **Luck**: actual wins minus the wins a team's scoring would earn on an average schedule (its combined record against all other schedules, divided by the number of other teams).
- **vs. median**: win if a team's score beats the league median that week (average of the middle two scores with 8 teams).
- **Effective players**: 1 ÷ Σ(share²) of each player's share of team points; the equivalent number of equal-sized contributors. Lower means more concentrated.
- **Roster analysis** uses starters' points only, grouped by each player's real position.

## Scope

Built for a single Sleeper league. Adding more leagues later would mean moving the Sleeper-specific code in `scripts/fetch.mjs` behind a small adapter and adding a league selector to the site.

## License

MIT, see [LICENSE](LICENSE). League data belongs to Sleeper and the league members.
