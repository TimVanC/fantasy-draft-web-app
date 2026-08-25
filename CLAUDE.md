# Draft War Room

A live fantasy football draft companion. It syncs to a Sleeper draft in real time and
recommends picks from a specific analyst's rankings rather than generic consensus ADP.

## Context you need before writing code

I will supply `Joel\_Smyth\_s\_Draft\_Guide\_2026.pdf` in this repo. Read it first. It is the
entire ranking and reasoning source for this app. The pages that matter most:

* **PPR Big Board** and **Half-PPR Big Board** (150 players each, ranked, with position)
* **Positional Rankings** (60 RB, 60 WR, 32 QB, 32 TE, color coded green = target,
yellow = pass, red = avoiding). The colors are the analyst's conviction signal and
should become a `tag` field per player. Extract them from the PDF's color data, not
from the plain text layer, which drops them.
* **'25 Adjusted PPG** tables for QB/RB/WR/TE, including the "reason" column
* **RB Volume** table (projected volume, '25 adjusted volume, confidence)
* **Player Profiles** (16 players with ADP, '25 FFPG, '26 projected FFPG, ceiling/risk out of 10)
* **My Draft Strategy** page (his round-by-round template and positional rules)
* **Top 50 Stats** (use as per-player notes where a stat names a player)
* **Luck Metric** (top and bottom 25 from 2025)

Build a `data/rankings.json` from these. One record per player:

```
{ name, pos, team, pprRank, halfRank, posRank, tag, adp,
  adjPpg2025, adjPpgNote, projPpg2026, ceiling, risk, notes\[] }
```

Most fields will be null for most players. That is fine. Do not invent values to fill
them, and do not interpolate ADP for players whose ADP is not printed in the guide.

## My league

10-team, full PPR, snake. Starters: QB, RB, RB, WR, WR, TE, W/R/T flex, DEF, K.
I have the 1.01 pick, so my picks are 1, 20, 21, 40, 41, 60, 61, 80, 81, 100, 101,
120, 121, 140, 141. I stream kicker and defense weekly, so the app should never
recommend one before the final two rounds.

Do not hardcode any of this. Read teams and roster slots from the Sleeper draft
settings object and let draft slot be user input.

## Stack

* React + TypeScript + Vite
* Tailwind
* Deployed to Vercel
* No database. Rankings ship as a static JSON import. Draft state lives in memory.
* One Vercel serverless function (`/api/players`) that caches Sleeper's player map,
since that endpoint is \~5MB and should be fetched at most once a day.

## Sleeper API

Read-only, public, no auth, no API key. Base `https://api.sleeper.app/v1`.
Stay under 1000 calls/minute or risk an IP block.

* `GET /draft/{draft\_id}` returns `settings` (teams, rounds, slots\_qb, slots\_rb,
slots\_wr, slots\_te, slots\_flex, slots\_k, slots\_def, slots\_bn, pick\_timer),
`status`, `draft\_order`, `slot\_to\_roster\_id`
* `GET /draft/{draft\_id}/picks` returns every pick made so far, each with `pick\_no`,
`round`, `draft\_slot`, `player\_id`, and a `metadata` object holding
`first\_name`, `last\_name`, `position`, `team`
* `GET /league/{league\_id}/drafts` if the user pastes a league ID instead
* `GET /players/nfl` full player map, cache daily, never call from the client

There is no public ADP endpoint. Only use ADP printed in the guide's player profile
cards, and label it as such in the UI.

Poll `/picks` every 3-5 seconds while a draft is active. Stop polling when
`status === "complete"`.

## What it has to do

1. Accept a Sleeper draft URL or raw ID. Parse the numeric ID out of either.
2. Track pick number, current round, whose turn it is, and how many picks until mine.
3. Show my roster mapped into actual starting slots plus flex, and which starters are
still unfilled.
4. Show best available by the analyst's rank, filtered and sorted, with his tag,
his adjusted PPG, and any note tied to that player.
5. Flag scarcity: for each available player, estimate whether he survives to my next
pick. Compare his rank against the picks remaining before my next selection.
Show "likely gone" and "can wait" so I stop reaching on players who will last.
6. Show the round-by-round plan from the guide's strategy page, checked off as picks pass.
7. Manual override. Let me click any player off the board if sync breaks or if the
name match fails. Manual overrides must survive the next poll.

## Player matching

Sleeper names will not match the guide's strings exactly. Suffixes, "Jr.", "III",
apostrophes, and periods all differ. Normalize both sides: lowercase, strip
punctuation, strip suffixes, then match on last name plus position plus team where
team is known. Log every unmatched pick to the console with both strings so I can fix
the JSON. A silent mismatch during a live draft is the worst failure mode here, so
surface unmatched picks in the UI too.

## Testing

This is the part I care about most. I want to be able to test before draft night.

* **Fixture replay.** Save the full picks array from a completed public 2025 draft to
`fixtures/`. Build a replay mode that feeds picks one at a time on a timer so the
whole app can be exercised without a live draft. This is the primary dev loop.
* **Live mock.** Sleeper mock drafts produce real draft IDs at
`sleeper.app/draft/nfl/{id}` and hit the same endpoints. Verify that bot picks
actually appear in the picks array and how quickly, since that is the one thing I
am unsure of. If solo mocks do not expose picks, note it and fall back to a
multi-person mock.
* Unit tests on the pick math: given teams and slot, the snake pick numbers must be
correct for both odd and even rounds, and for slot 1 and slot N specifically.
* Unit tests on name normalization, using real mismatches you find in the fixture.

## Things I do not want

* No consensus ADP blended into the recommendation. The whole point is that this
board disagrees with ADP, and the disagreement is the signal.
* No auto-drafting or writing to Sleeper. The API is read-only and I want it that way.
* No login, no accounts, no stored user data.
* Nothing that takes more than one glance to read. I will be looking at this with a
90 second pick clock running.

## Start here

Read the PDF, build `data/rankings.json`, and show me a sample of 20 records plus a
count by position and by tag before writing any UI. If the color extraction for the
target/pass/avoid tags does not work cleanly, tell me rather than guessing at them.

