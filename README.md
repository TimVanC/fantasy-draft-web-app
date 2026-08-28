# Draft War Room

Live fantasy football draft companion. Syncs to a Sleeper draft in real time and
recommends picks from **Joel Smyth's 2026 Draft Guide** — his board, his
target/pass/avoid tags, his adjusted PPG — instead of consensus ADP. The
disagreement with ADP is the signal.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (pick math, name matching, roster, scarcity)
npm run build      # typecheck + production build
```

## Using it on draft night

1. Paste your Sleeper draft URL (or draft ID, or league ID) and connect.
2. Pick your draft slot in the header — everything about the league (teams,
   rounds, roster slots, third-round reversal) is read from the Sleeper draft
   settings object; nothing is hardcoded.
3. The board polls picks every 2 seconds while the draft is live (5s while
   waiting/paused), refreshes instantly when you focus the tab, and stops
   when the draft completes.

- **Pick Advisor** suggests three players for your pick. Value comes only
  from the guide (board rank, tags, roster need, his round plan); live market
  ADP is used for exactly one thing — the odds a player survives to your next
  pick — because the market, not the guide, decides what everyone else does.
  A "Can wait" line lists top players who'll very likely come back to you.
- **Best available** is sorted by the guide's PPR or half-PPR board (toggle in
  the header). Tags are his conviction colors from the positional rankings.
  Rows expand for his notes, adjusted-PPG context, and profile numbers. ADP
  shown in expanded rows is the guide's printed (Yahoo) ADP only.
- **Mkt ADP** column shows live market ADP (Fantasy Football Calculator
  mocks, cached hourly via `api/adp.ts`) with a green `+N` when the market
  takes a player well after his guide rank — the value gap is the signal. It
  never affects ordering.
- **Outlook** shows the ADP-based odds a player is still there at your next
  pick (`44% at #24`); with no ADP feed it falls back to comparing his spot on
  the available board against the picks before your turn (`LIKELY GONE` /
  `can wait`).
- **His top players by position** in the sidebar: drafted players grey out
  and sink to the bottom keeping their original position rank.
- **✕ on a row** manually removes a player (survives every poll; restore from
  the "Manually removed" bar). Use it if sync breaks or a name fails to match.
- Any skill-position pick that doesn't match a guide player is logged to the
  console **and** shown in the amber banner — a silent mismatch is the failure
  mode this app refuses to have.
- K/D/ST are never recommended: the guide ranks none, and the app reminds you
  to grab them in the final two rounds (streamed weekly).

## Testing without a live draft

**Fixture replay (primary dev loop).** The setup screen's *Replay* button feeds
`fixtures/picks.json` — a real completed 12-team, 15-round 2025 Sleeper draft
(180 picks, draft `1260297814596927488`) — through the exact same pipeline as
live sync, one pick at a time with play/pause/step/speed controls. Several 2025
picks intentionally have no 2026 guide match (Tyreek Hill, James Conner, …),
which exercises the unmatched-pick UI.

**Live mock drafts.** Sleeper mocks produce real draft IDs
(`sleeper.com/draft/nfl/{id}`) served by the same public endpoints this app
polls, so pasting a mock URL should just work. **Not yet verified:** whether a
*solo* mock (you + bots) exposes bot picks in `GET /draft/{id}/picks`, and how
quickly — confirming that requires creating a mock under a logged-in Sleeper
account. To check before draft night: start a mock, paste its URL into the app
(or open `https://api.sleeper.app/v1/draft/<id>/picks` directly), and watch
whether bot picks appear within a few seconds of being made. If a solo mock
turns out not to expose picks, run a two-person mock — invite-link mocks are
real multi-user drafts and behave like league drafts.

## Data

`data/rankings.json` (197 players) is extracted from the guide PDF by
`scripts/extract.py` + `scripts/build_rankings.py`:

- PPR + half-PPR big boards (150 each), positional ranks (32 QB / 60 RB /
  60 WR / 32 TE per format)
- target/pass/avoid tags from the PDF's literal text colors
  (green `#10911d`, yellow `#e1ad01`, red `#c22d21`)
- '25 adjusted PPG + "reason" notes, RB volume table, luck metric, top-50
  stats, and the 16 player-profile cards (ADP, projections, ceiling/risk)

`data/strategy.json` holds his round-by-round plan and rules, rendered as the
checklist panel. Fields the guide doesn't print are `null` — nothing is
invented or interpolated.

## Deploy (Vercel)

Standard Vite deploy; `api/players.ts` is a serverless function that proxies
Sleeper's ~5MB player map with a daily CDN cache (`s-maxage=86400`) so Sleeper
is hit at most about once a day. The client never calls Sleeper's players
endpoint directly (the draft + picks endpoints it does call are small and
rate-limit-safe at one request per 4 s).

## Constraints (by design)

- No consensus ADP in recommendations. No auto-drafting, no writes to Sleeper
  (read-only public API, no auth). No login, no accounts, no stored user data —
  slot/format/overrides live in `localStorage` only.
