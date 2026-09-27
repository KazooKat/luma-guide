# Luma Guide

A player guide for [LumaMC](https://lumamc.net) (`play.lumamc.net`): how each job scales, how long a level target
takes, what each job pays per item, level perks, item mechanics (Kamori's Glasses, with a live bloom-hour clock), and
relics (where they drop, what's inside them, disassembly odds).

Live site: https://kazookat.github.io/luma-guide/ · Design canvas: https://claude.ai/artifact/P1tHzLmUEceQpNcXqmzEn8

Fan-made; not affiliated with LumaMC. Minecraft icons © Mojang (via the `minecraft-textures` package).
The sapling-box icon (`data/custom-icons/sapling_box.png`) is a render of the `BoxMan01234` head that CustomSaplings uses, via mc-heads.net.
Mechanics and perk facts are described from LumaLibre's public repositories (CC BY-NC-ND 4.0), credited on the pages that use them.

## How the numbers are made

The server's Jobs config isn't public, so the guide is built from in-game readings:

- **Pay per item** comes from `/jobs browse`, one dump per job, read out of the Minecraft client log.
- **Scaling** (fitted, see `src/lib/scaling.ts` and its tests):
  `XP needed = round(4.29·L³ + 0.3002·L² − 0.095)`, XP per action ∝ `(L + 5)`, money per action ∝ `(L + 9)`.
  Each dump is normalized to its level-1 base, so dumps taken at any level work.
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

After moving to a newer commit, re-check the hand-written entries in `data/items-overrides.json` against the source
(the build flags overrides whose builder no longer exists, but not ones whose values changed).

## Refreshing job data after a server change

1. In game, for each job: `/jobs stats` (so the log has your level), then `/jobs browse` for that job and page
   through every page (`Next >>`).
2. Run:
   ```sh
   npm run extract-log            # lists the dumps it found in the Luma Prism instance's latest.log
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
3. `npm test && npm run build`, then commit and push. GitHub Actions tests and deploys `main`.

`scripts/extract_log.py --log <path>` reads another log (including `.log.gz`).

## Suggestions

The "Suggest an addition" button opens a GitHub issue form until `SUGGEST_FORM_URL` in `src/config.ts` is set.
To use a Google Form instead, create one with these fields and paste its share link there:

1. *Which part of the guide?* (multiple choice: Jobs / Items & mechanics / Something new / A mistake to fix)
2. *What should be added or changed?* (paragraph, required)
3. *Your in-game name* (short answer, optional)

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # formula, bloom-hour and machine tests (vitest)
python -m unittest discover -s scripts   # log extractor tests
npm run typecheck
npm run build      # static site in dist/
```
