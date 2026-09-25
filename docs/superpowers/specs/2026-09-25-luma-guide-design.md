# Luma Guide — design

Date: 2026-09-25. Approved in chat ("go ahead till implemented").

## Goal
A public, no-login reference site for LumaMC players:
1. **Jobs tab** — how each of the 10 jobs scales (XP needed, $ and XP per action by level),
   how many hours reaching a target level takes, per-item tables with Minecraft icons,
   and per-job level perks.
2. **Items tab** — item mechanics. Launch content: Kamori's Glasses only (live bloom-hour clock).
   Relics are deferred (first follow-up).
3. **Suggest button** — links to a Google Form the owner creates.

## Decisions
- Stack: Vite + Preact + TypeScript, Vitest for unit tests. Deployed to GitHub Pages via Actions.
- Hosting: GitHub Pages, public repo under the owner's account. Push only with explicit go-ahead.
- Jobs data: `/jobs browse` dumps read from the owner's Luma client log, one raw file per job
  with `# job:` / `# level:` headers (format of `Luma Jobs/data/raw_*.txt`). The parser normalizes
  every value to its level-1 base so any dump level works.
- Scaling formulas (fitted from in-game readings, see research note):
  - `req(L) = round(4.29 L^3 + 0.3002 L^2 - 0.095)`
  - `xp(L) = xp_base (L+5)/6`, `money(L) = money_base (L+9)/10`
- Time model: player picks job, current/target level, the item they grind, and an editable
  actions/hour (per-job default). Cook additionally offers the furnace/smoker throughput model.
- Provenance: every job/formula shows a confidence badge — confirmed / fitted / assumed.
- Icons: `minecraft-textures` manifest for MC 26.2 (the Luma Prism instance version), matched
  by id (`Deepslate Diamond Ore` → `deepslate_diamond_ore`), then by readable name, then alias map.
  Only referenced PNGs are copied into the build.
- Kamori's Glasses: BigInt port of `bloomHour()`, verified against all 99 dates of the Java-generated
  schedule; bloom hour computed in America/New_York and shown in the viewer's local time too.
- Perks: transcribed from `LumaLibre/JobsAddons` `PerksFile.kt` at a pinned commit.

## Out of scope (launch)
Relics, other custom items, rank/boost pay modifiers, payment caps.
