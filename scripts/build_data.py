"""Build src/data/jobs.json and public/icons/ from data/raw/<job>.txt.

Raw format and the Builder/Miner category rules come from Luma Jobs/scripts/parse.py.
Every value is normalized to its level-1 base using the fitted Luma scaling:
    xp(L) = base (L+5)/6        money(L) = base (L+9)/10
so the site can project any level. Icons come from the minecraft-textures package
(MC 26.2 manifest); only the PNGs actually referenced are copied into public/icons/.
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
META_FILE = ROOT / "data" / "jobs-meta.json"
OUT = ROOT / "src" / "data" / "jobs.json"
ICON_DIR = ROOT / "public" / "icons"
TEX = ROOT / "node_modules" / "minecraft-textures" / "dist" / "textures"
MC_VERSION = "26.2"

LINE_RE = re.compile(r"^\s*(.+?)\s+->\s+([\d.]+)\$\s+([\d.]+)xp\s*$")
SECTION_RE = re.compile(r"^([A-Z][A-Za-z]*(?: [A-Za-z]+)*):\s*$")
META_RE = re.compile(r"^#\s*(\w+)\s*:\s*(.+?)\s*$")

# From Luma Jobs/scripts/parse.py. Only meaningful for block lists (Builder Place, Miner Break).
CATEGORY_RULES = [
    ("Ore", ["Ore", "Ancient Debris"]),
    ("Valuable Block", ["Netherite Block", "Diamond Block", "Emerald Block", "Gold Block", "Iron Block",
                        "Redstone Block", "Lapis Block", "Coal Block", "Beacon", "Raw Iron Block",
                        "Raw Copper Block", "Raw Gold Block"]),
    ("Copper", ["Copper"]),
    ("Deepslate", ["Deepslate"]),
    ("Blackstone", ["Blackstone"]),
    ("Sandstone", ["Sandstone"]),
    ("Nether Brick", ["Nether Brick", "Red Nether Brick"]),
    ("Resin", ["Resin"]),
    ("Quartz", ["Quartz"]),
    ("Prismarine", ["Prismarine", "Sea Lantern"]),
    ("End", ["End Stone", "End Rod", "End Portal", "Purpur", "Chorus"]),
    ("Tuff", ["Tuff"]),
    ("Amethyst", ["Amethyst"]),
    ("Stone", ["Cobblestone", "Stone", "Andesite", "Diorite", "Granite", "Calcite", "Dripstone", "Basalt",
               "Netherrack", "Crimson Nylium", "Warped Nylium"]),
    ("Wood", ["Log", "Wood", "Stem", "Hyphae", "Planks", "Stripped"]),
    ("Wood Furniture", ["Fence", "Door", "Trapdoor", "Stairs", "Slab", "Sign", "Hanging Sign", "Fence Gate",
                        "Button", "Pressure Plate"]),
    ("Bamboo", ["Bamboo"]),
    ("Glass", ["Glass"]),
    ("Wool", ["Wool"]),
    ("Carpet", ["Carpet"]),
    ("Concrete", ["Concrete"]),
    ("Terracotta", ["Terracotta", "Bricks", "Brick"]),
    ("Ice/Snow", ["Ice", "Snow"]),
    ("Light Source", ["Glowstone", "Shroomlight", "Froglight", "Lantern", "Torch", "Candle", "Lightning Rod",
                      "Redstone Lamp", "Jack O Lantern"]),
    ("Bed", ["Bed"]),
    ("Banner", ["Banner"]),
    ("Shulker", ["Shulker"]),
    ("Coral", ["Coral"]),
    ("Sculk", ["Sculk"]),
    ("Flora", ["Leaves", "Azalea", "Moss", "Flower", "Rose", "Tulip", "Dandelion", "Poppy", "Orchid", "Allium",
               "Bluet", "Daisy", "Cornflower", "Lily", "Blossom", "Sunflower", "Lilac", "Peony", "Fern", "Grass",
               "Dead Bush", "Seagrass", "Kelp", "Sea Pickle", "Vine", "Roots", "Dripleaf", "Mangrove Roots",
               "Sprouts", "Mushroom", "Cobweb", "Pitcher Plant", "Glow Lichen", "Lily Pad", "Flower Pot",
               "Bookshelf"]),
    ("Redstone", ["Redstone", "Repeater", "Comparator", "Rail", "Piston", "Observer", "Hopper", "Dispenser",
                  "Dropper", "Lectern", "Target", "Lever", "Daylight Detector", "Tripwire Hook", "Trapped Chest",
                  "Tnt", "Slime Block", "Honey Block", "Note Block"]),
    ("Utility", ["Crafting Table", "Loom", "Composter", "Chest", "Barrel", "Furnace", "Smoker", "Blast Furnace",
                 "Cartography Table", "Fletching Table", "Grindstone", "Smithing Table", "Stonecutter", "Bell",
                 "Campfire", "Armor Stand", "Painting", "Jukebox", "Enchanting Table", "Lodestone",
                 "Respawn Anchor", "Honeycomb Block", "Ender Chest", "Anvil", "Bee Nest", "Beehive", "Iron Bars",
                 "Iron Chain", "Ladder", "Scaffolding", "Sponge", "Wet Sponge", "Hay Block", "Dried Kelp Block",
                 "Bone Block", "Melon", "Pumpkin", "Carved Pumpkin", "Magma Block", "Clay", "Mud", "Packed Mud",
                 "Grass Block", "Dirt", "Rooted Dirt", "Coarse Dirt", "Podzol", "Mycelium", "Sand", "Red Sand",
                 "Gravel", "Soul Sand", "Soul Soil", "Obsidian", "Crying Obsidian", "Nether Wart Block",
                 "Warped Wart Block", "Skull", "Head"]),
]
CATEGORIZED_JOBS = {"Builder", "Miner"}


def classify(name):
    for cat, kws in CATEGORY_RULES:
        if any(kw in name for kw in kws):
            return cat
    return "Misc"


# Actions whose "item" is a mob: icon is its spawn egg.
MOB_ACTIONS = {"Kill", "Breed", "Tame", "Milk", "MMKill"}
# Block/entity names whose item id differs. Checked before the generic rules.
ALIASES = {
    "carrots": "carrot", "potatoes": "potato", "beetroots": "beetroot", "cocoa": "cocoa_beans",
    "melon_stem": "melon_seeds", "pumpkin_stem": "pumpkin_seeds", "attached_melon_stem": "melon_seeds",
    "attached_pumpkin_stem": "pumpkin_seeds", "sweet_berry_bush": "sweet_berries", "cave_vines": "glow_berries",
    "cave_vines_plant": "glow_berries", "tall_seagrass": "seagrass", "kelp_plant": "kelp",
    "wall_torch": "torch", "redstone_wall_torch": "redstone_torch", "soul_wall_torch": "soul_torch",
    "bamboo_sapling": "bamboo", "twisting_vines_plant": "twisting_vines", "weeping_vines_plant": "weeping_vines",
    "fire": "flint_and_steel", "water": "water_bucket", "lava": "lava_bucket", "redstone_wire": "redstone",
    "tripwire": "string", "big_dripleaf_stem": "big_dripleaf", "pitcher_crop": "pitcher_pod",
    "torchflower_crop": "torchflower_seeds", "dragon_breath": "dragon_breath", "stone": "stone",
    # mobs without a spawn egg
    "wither": "nether_star", "ender_dragon": "dragon_head", "player": "player_head", "giant": "zombie_head",
    "illusioner": "crossbow", "sign": "oak_sign", "grass": "short_grass", "hanging_sign": "oak_hanging_sign",
}
DYE_COLORS = {"white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray",
              "cyan", "purple", "blue", "brown", "green", "red", "black"}


EXTRA_ICONS = ["furnace", "smoker", "blast_furnace", "brewing_stand", "netherite_helmet", "clock",
               "amethyst_shard", "wheat_seeds", "oak_sapling", "beetroot", "cocoa_beans", "wheat", "writable_book", "experience_bottle", "emerald"]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower().replace("'", "")).strip("_")


class Icons:
    def __init__(self):
        manifest = json.loads((TEX / "manifest" / f"{MC_VERSION}.json").read_text(encoding="utf-8"))
        self.by_id = {i["id"].removeprefix("minecraft:"): i["texture"] for i in manifest["items"]}
        self.by_name = {i["readable"].lower(): i["id"].removeprefix("minecraft:") for i in manifest["items"]}
        self.used = {}
        self.missing = []

    def resolve(self, job, action, name):
        s = slug(name)
        candidates = []
        if action in MOB_ACTIONS:
            candidates += [ALIASES.get(s, ""), f"{s}_spawn_egg"]
        if action == "Shear" and s in DYE_COLORS:
            candidates.append(f"{s}_wool")
        candidates += [ALIASES.get(s, ""), s, self.by_name.get(name.lower(), "")]
        if s.endswith("_wall_fan"):
            candidates.append(s.replace("_wall_fan", "_fan"))
        if s.endswith("_wall_sign") or s.endswith("_wall_hanging_sign"):
            candidates.append(s.replace("_wall", ""))
        if s.endswith("_wall_banner") or s.endswith("_wall_head") or s.endswith("_wall_skull"):
            candidates.append(s.replace("_wall", ""))
        for c in candidates:
            if c and c in self.by_id:
                self.used[c] = self.by_id[c]
                return c
        self.missing.append(f"{job}/{action}/{name}")
        return None

    def copy(self):
        if ICON_DIR.exists():
            shutil.rmtree(ICON_DIR)
        ICON_DIR.mkdir(parents=True)
        for item_id, texture in self.used.items():
            shutil.copyfile(TEX / "assets" / texture, ICON_DIR / f"{item_id}.png")


def parse_file(path):
    meta, rows, action = {}, [], None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if m := META_RE.match(line):
            meta[m.group(1).lower()] = m.group(2)
            continue
        if m := SECTION_RE.match(line):
            action = m.group(1)
            continue
        if (m := LINE_RE.match(line)) and action:
            rows.append((action, m.group(1).strip(), float(m.group(2)), float(m.group(3))))
    return meta, rows


def main():
    jobs_meta = json.loads(META_FILE.read_text(encoding="utf-8"))
    icons = Icons()
    jobs = []
    for job, jm in jobs_meta["jobs"].items():
        path = RAW_DIR / f"{job.lower()}.txt"
        entry = {"job": job, **jm, "level": None, "source": None, "items": []}
        if path.exists():
            meta, rows = parse_file(path)
            level = int(meta["level"])
            entry["level"] = level
            entry["source"] = meta.get("source")
            seen = {}
            for action, name, money, xp in rows:
                key = (action, name)
                seen[key] = seen.get(key, 0) + 1
                label = name if seen[key] == 1 else f"{name} ({seen[key]})"
                entry["items"].append({
                    "action": action,
                    "item": label,
                    "category": classify(name) if job in CATEGORIZED_JOBS else action,
                    "moneyBase": round(money * 10 / (level + 9), 6),
                    "xpBase": round(xp * 6 / (level + 5), 6),
                    "observed": {"level": level, "money": money, "xp": xp},
                    "icon": icons.resolve(job, action, name),
                    "key": key,
                })
            # The server sometimes lists the same item twice in one action with different pay
            # (e.g. Lumberjack Break "Stripped Oak Log"). Flag them rather than guess which applies.
            for it in entry["items"]:
                it["dupe"] = seen[it.pop("key")] > 1
        jobs.append(entry)

    # Icons the UI uses directly (job picker, machine inputs, item cards).
    for extra in [m["icon"] for m in jobs_meta["jobs"].values()] + EXTRA_ICONS:
        if extra not in icons.by_id:
            raise SystemExit(f"unknown UI icon id: {extra}")
        icons.used[extra] = icons.by_id[extra]
    icons.copy()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"mcVersion": MC_VERSION, "jobs": jobs}, indent=1), encoding="utf-8")
    for j in jobs:
        print(f"  {j['job']:11} level {str(j['level']):>4}  {len(j['items']):4} items")
    print(f"icons: {len(icons.used)} copied, {len(icons.missing)} unresolved")
    for m in icons.missing:
        print("   missing icon:", m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
