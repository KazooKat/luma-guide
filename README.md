# Luma Guide

A player guide for [LumaMC](https://lumamc.net) (`play.lumamc.net`): how each job scales, how long a level target
takes, what each job pays per item, level perks, item mechanics (Kamori's Glasses, with a live bloom-hour clock), and
relics (where they drop, what's inside them, disassembly odds).

Live site: https://luma.kazookat.dev/ (the old https://kazookat.github.io/luma-guide/ links redirect there) · Design canvas: https://claude.ai/artifact/P1tHzLmUEceQpNcXqmzEn8

Fan-made; not affiliated with LumaMC. Minecraft icons © Mojang (via the `minecraft-textures` package).
The sapling-box icon (`data/custom-icons/sapling_box.png`) is a render of the `BoxMan01234` head that CustomSaplings uses, via mc-heads.net.
Mechanics and perk facts are described from LumaLibre's public repositories (CC BY-NC-ND 4.0), credited on the pages that use them.

## How the numbers are made

The server's Jobs config isn't public, so the guide is built from in-game readings:

- **Pay per item** comes from `/jobs browse`, one dump per job, read out of the Minecraft client log.
- **Scaling** (fitted, see `src/lib/scaling.ts` and its tests):
  `XP needed = round(4.29·L³ + 0.3002·L² − 0.095)`, money per action ∝ `(L + 9)`, XP per action ∝ `(L + c)` with a
  per-job `xpOffset` c in `data/jobs-meta.json`: 10/7 for Hunter, Farmer and Blacksmith (each read at 2 levels, every item
  fits; earlier dumps are in `data/readings/`, checked by `src/lib/readings.test.ts`), 5 for Cook (its 2026-09-24
  readings), and 10/7 for the jobs read only once. Each dump is normalized to its level-1 base, so dumps taken at any
  level work. A second `/jobs browse` at a different level for any job settles its offset.
- **Perks** (level + perk name) are extracted from `LumaLibre/JobsAddons` `PerksFile.kt`.
- **Kamori's Glasses** bloom hour is an exact port of `KamorisGlasses.kt`, tested against the JVM on every day 2024–2034.
- **Relics** (`src/lib/relics.ts`): odds are derived from LumaItems' relic code and default `relics.yml` / `astral.yml`.
  The disassembler and Astral Orb pick by rejection (draw a random entry, keep it if its number ≥ `nextInt(101)`),
  which works out to `(n + 1) / Σ(n + 1)`; a seeded simulation of that loop is in the tests. Mob relic *drop* odds
  use vanilla equipment-drop rules and are labelled as an estimate on the page.

- **Item glossary** (`src/data/items.json`): `scripts/build-items.mjs` evaluates every `ItemFactory.builder()` chain in
  LumaItems with a small Kotlin reader (`scripts/lib/kotlin-lite.mjs`) and rebuilds each tooltip in `ItemFactory`'s line
  order. Items it can't evaluate (random colour variants, builders shared by several items) and all Astral set pieces
  are transcribed by hand in `data/items-overrides.json`; the build fails if an item is neither. Vanilla enchant lines
  follow Minecraft 26.2 data (tooltip order, names, max levels) from misode/mcmeta.

## Refreshing the item glossary

```sh
git -c core.longpaths=true clone https://github.com/LumaLibre/LumaItems.git data/LumaItems   # not committed (CC BY-NC-ND)
git -C data/LumaItems checkout "$(cat data/LumaItems.commit)"                                   # or a newer commit: update the .commit file too
npm run items        # writes src/data/items.json; lists skipped items and anything needing an override
npm run data         # copies the item icons into public/icons/ and packs them into src/assets/items-atlas.png (needs Pillow)
```

**Mechanics write-ups** live in `data/writeups/<batch>.json`, one entry per item or item family, every line citing
the source (`items/x/File.kt:12-30`). `npm run writeups` checks them (ids, fields, and that each cited file/line exists)
and merges them into `src/data/writeups.json`. The public guide leaves out anything that would teach an exploit;
behaviour that depends on the game or server config goes under `config`.

**Astral upgrades** are computed, not hand-written: `scripts/lib/astral-upgrades.mjs` reads the `astral-upgrades`
defaults in `AstralYml.kt` and applies `AstralSetUpgradeFactory`'s rules, using vanilla 26.2 item stats and enchantment
rules from `scripts/lib/mc-26.2.json` (refresh with `node scripts/fetch-mc-data.mjs`).

After moving to a newer commit, re-check the hand-written entries in `data/items-overrides.json` against the source
(the build flags overrides whose builder no longer exists, but not ones whose values changed).

## Refreshing event data

The Event section (`#/event`) is built from `LumaLibre/luma-events` (no license file upstream, so it is cloned locally
and not committed, like LumaItems), the hand-maintained `data/event/event.json`, and the cited minigame guides in
`data/event/minigames/*.json`.

```sh
git clone https://github.com/LumaLibre/luma-events.git data/luma-events
git -C data/luma-events checkout "$(cat data/luma-events.commit)"   # or a newer commit: update the .commit file too
npm run event        # checks everything, writes src/data/event.json and src/data/event-live.json
```

`npm run event` reads the job token odds, town invite rules, token cap and multiplier, schedule defaults, player
commands and the minigame list (with each game's token formula) straight from the source, keeping the file:line of every
number. It fails if something it expects has moved, if a guide cites a line that doesn't exist, or if a guide uses
an en or em dash. Games without a guide are listed but don't fail the build.

`data/event/event.json` holds what the code can't tell you:

- `live`: `false` keeps the Event tab out of the nav. The pages still open by link, with a "Preview" banner, and every
  minigame shows so the guides can be checked. Set it to `true` when the event opens.
- `activeGames`: the minigame keys confirmed for this event. Once `live` is on, only these show.
- `sourceEvent`: the event the pinned luma-events code was written for. While it differs from `name`, every page says
  the numbers come from that event's code. Set it to the new event's name after moving to its code and re-checking.
- `name`, `nameConfirmed`, `dates`, `token`, `charmItemId`, and `shop` (items with `name`, `cost`, optional `itemId`
  from the item glossary, `limit` and `note`). Shop prices are server config, so they're read in game; put the date in
  `shop.readOn`.

After moving to a newer luma-events commit, re-read each game's guide against the new code: the build line-checks
citations but can't tell when the cited lines now say something else.

## Refreshing job data after a server change

1. In game, for each job: `/jobs stats` (so the log has your level), then `/jobs browse` for that job and page
   through every page (`Next >>`).
2. Run:
   ```sh
   npm run extract-log            # lists the dumps it found in the Luma Prism instance's latest.log (no flags)
   ```
   Put each job's level at dump time into `data/levels.json`, then:
   ```sh
   python scripts/extract_log.py --write   # writes data/raw/<job>.txt
   npm run data                            # rebuilds src/data/jobs.json, public/icons/, src/data/perks.json
   ```
   `npm run data` needs a local copy of the perks source (not committed; it's CC BY-NC-ND):
   ```sh
   gh api repos/LumaLibre/JobsAddons/commits/HEAD --jq .sha > data/PerksFile.commit
   gh api "repos/LumaLibre/JobsAddons/contents/src/main/kotlin/dev/lumas/jobsaddons/configuration/PerksFile.kt" --jq .content | base64 -d > data/PerksFile.kt
   ```
   Also update `DATA_DATE` in `src/config.ts`.
   Alchemist brewing chains use Luma's mcMMO potion recipes (`src/data/potions.json`). To refresh them
   (needs PyYAML; the fetched `.yml` isn't committed):
   ```sh
   gh api repos/LumaLibre/mcMMO/commits/HEAD --jq .sha > data/mcmmo.commit
   gh api "repos/LumaLibre/mcMMO/contents/src/main/resources/potions.yml?ref=$(cat data/mcmmo.commit)" --jq .content | base64 -d > data/mcmmo-potions.yml
   npm run potions
   ```
   Catalysis and Master Angler numbers live in `src/lib/mcmmo.ts` (Retro Mode, checked against `/alchemy` and `/fishing` in game).
3. `npm test && npm run build`, then commit and push. GitHub Actions tests `main`, deploys it to Cloudflare, and then publishes the GitHub Pages redirect (see "Hosting").

`scripts/extract_log.py --log <path>` reads another log (including `.log.gz`).

## Suggestions

The "Suggest an addition" button opens a GitHub issue form until `SUGGEST_FORM_URL` in `src/config.ts` is set.
To use a Google Form instead, create one with these fields and paste its share link there:

1. *Which part of the guide?* (multiple choice: Jobs / Items & mechanics / Something new / A mistake to fix)
2. *What should be added or changed?* (paragraph, required)
3. *Your in-game name* (short answer, optional)

## Hosting

The site is static files served by Cloudflare Workers static assets (`wrangler.jsonc`, no Worker script, so requests
are free and unlimited). `.github/workflows/deploy.yml` deploys with `wrangler deploy` and needs two repo secrets:
`CLOUDFLARE_API_TOKEN` (a token from the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`. After that
succeeds it publishes `redirect/index.html` to GitHub Pages, which forwards old links and keeps the `#/` route.
To deploy by hand: `npm run build && npx wrangler deploy`.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # formula, bloom-hour and machine tests (vitest)
python -m unittest discover -s scripts   # log extractor tests
npm run typecheck
npm run build      # static site in dist/
```
