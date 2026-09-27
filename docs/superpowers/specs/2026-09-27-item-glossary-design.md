# Item glossary — design

Date: 2026-09-27. Approved in chat ("go until implemented and then commit and push it").

## Goal
Turn the Items tab into a glossary of every obtainable LumaItems custom item:
- A grid of item icons, one section per event, colour-coded with that event's tier gradient.
  Extra sections: **Astral** (grouped by set) and **Collectibles**.
- Hovering (or focusing) an item shows its tooltip as the game draws it.
- Search by event, item name, effect (lore text) and enchant (custom and vanilla).
- Clicking an item opens a detail view (`#/items/<id>`): icon, full tooltip, auto facts
  (event, item type, abilities, enchants, source link) and a hand-checked mechanics write-up when one exists.
  Kamori's Glasses keeps its existing write-up (bloom clock etc.). Other write-ups are added in batches,
  one event at a time, starting with Lumarine 2026 (follow-up, not in this change).
- Relics page: Astral set names link to their Astral section (`#/items/astral/<set>`).
- Site-wide light/dark toggle. Dark is the default regardless of OS setting; the choice is remembered per browser.

## Scope decisions (from the chat)
- Included: every registered item whose tier is an event tier, plus Astral sets and Collectibles
  (Tier.COLLECTIBLE fishing collectibles and the St Patrick's collectibles).
- Excluded: `@Ignore` classes, untiered stubs/placeholders, Tier.STAFF, Tier.BLANK (Grubby Relic, Jobs Booster,
  Repair Tokens), Tier.DEBUG and playground items (Foodie Pickaxe).
- Holiday Ham is filed under Lumaween 2025: its `ThanksgivingEventTier` line is commented out and the live tier is
  `Tier.HALLOWEEN_2025` ("Halloween re-release"). (Corrected during implementation; the chat said Thanksgiving 2024.)
- Registered items that share one persistentData id (3 Valentide charms, 2 Strasz bows, 9 Reformation Pouches) get
  glossary-unique ids. Items with random variants show one representative variant plus a "varies in game" note.
- Relics stay on the Relics tab (randomly generated, not fixed items).
- Layout follows the existing Claude Design canvas look (no glossary artboards existed when this was built).

## Data pipeline (approach B: parse the source)
- `scripts/build-items.mjs` reads a local, gitignored clone of LumaItems at the commit in `data/LumaItems.commit`
  (`19587d5`, the same commit the Relics page uses) and writes `src/data/items.json`. LumaItems is CC BY-NC-ND 4.0,
  so its source is not committed; only the extracted data is, with attribution and source links.
- It evaluates `ItemFactory.builder()` chains with a small Kotlin expression evaluator (strings with templates,
  lists, `Enchantment.X to n` pairs, `Material.X`, `Tier.X[.alt()]`, same-file `val` constants).
  Anything it cannot resolve is a hard error unless `data/items-overrides.json` covers that item.
- Astral sets are built procedurally (loops, `when`, `canEnchantItem` filters), so they are hand-transcribed
  per piece in `data/items-overrides.json`; the script applies the factory rules (name format, common enchants,
  legacy vs MiniMessage mode, default Astral tier).
- Tooltip assembly mirrors `ItemFactory.createItem()` (@ 19587d5, lines 161-190): name; vanilla enchants
  (hidden when `hideEnchants`; `spoofEnchants` writes them as grey lore instead); custom enchants; blank line
  if lore or taglines; taglines + blank; lore; tier footer (`TIER_FORMAT` / `LEGACY_TIER_FORMAT`).
  Lore defaults to white, italics off (`Text.mmNoItalic`, LumaCore — not public, inferred from the name).
- Vanilla enchant lines follow Minecraft 26.2 data (misode/mcmeta `26.2-data-json`): order from the
  `tooltip_order` tag, names from `en_us.json`, numeral omitted when level 1 and max level 1, curses red,
  levels above X shown as the raw key `enchantment.level.N` (vanilla has no translation for them).
- Icons: the item's material through the existing `build_data.py` icon copier (player heads show the plain
  head icon; dyed leather shows undyed).

## Rendering
- `src/lib/minimessage.ts`: MiniMessage subset (hex and named colours, `color:`, gradient, bold/italic/
  underlined/strikethrough/obfuscated, reset, closing tags) plus legacy `&` codes, to styled spans.
  Gradients follow Adventure's per-character interpolation. Unknown tags render literally, like MiniMessage.
- Tooltip: Minecraft-style dark panel with purple frame, 1px text shadow at 25% brightness,
  "Minecraft" font by Craftron Gaming (dafont "100% Free", via `@south-paw/typeface-minecraft`).

## Testing
- Vitest: MiniMessage parser (colours, gradients, legacy resets), tooltip assembly (Kamori's Glasses line by line),
  search matching, items.json invariants (every item has a section, icon, non-empty name; no duplicate ids).
- Real-browser check with Playwright on the production build: grid, hover tooltip, search, detail view,
  relics link, theme toggle persistence.
