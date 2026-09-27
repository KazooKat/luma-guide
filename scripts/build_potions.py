"""Build src/data/potions.json from a local copy of Luma's mcMMO potions.yml.

Luma runs its own mcMMO fork (LumaLibre/mcMMO). Its potions.yml decides which ingredient turns which
potion into which, and at which Concoctions tier each ingredient unlocks. The site uses it to build
valid brewing chains starting at a water bottle. Fetch the pinned copy with:
    gh api repos/LumaLibre/mcMMO/commits/HEAD --jq .sha > data/mcmmo.commit
    gh api "repos/LumaLibre/mcMMO/contents/src/main/resources/potions.yml?ref=$(cat data/mcmmo.commit)" --jq .content | base64 -d > data/mcmmo-potions.yml
Needs PyYAML (pip install pyyaml).
"""
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "mcmmo-potions.yml"
COMMIT = ROOT / "data" / "mcmmo.commit"
OUT = ROOT / "src" / "data" / "potions.json"
START = "POTION_OF_WATER"

TIER_KEYS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"]
BASE_NAMES = {"WATER": "Water Bottle", "MUNDANE": "Mundane Potion", "THICK": "Thick Potion",
              "AWKWARD": "Awkward Potion", "EMPTY": "Uncraftable Potion"}


def title(words: str) -> str:
    return " ".join(w.capitalize() for w in words.split("_") if w)


def potion_name(pid: str) -> str:
    """POTION_OF_STRENGTH_II -> Potion of Strength II; SPLASH_POTION_OF_SWIFTNESS_EXTENDED -> Splash Potion of Swiftness (long)."""
    form = ""
    for prefix in ("SPLASH_", "LINGERING_"):
        if pid.startswith(prefix):
            form, pid = title(prefix), pid[len(prefix):]
    body = pid.removeprefix("POTION_OF_").removeprefix("POTION_")  # upstream typo: LINGERING_POTION_WIND_CHARGING
    suffix = ""
    if body.endswith("_EXTENDED"):
        body, suffix = body[: -len("_EXTENDED")], " (long)"
    elif body.endswith("_II"):
        body, suffix = body[: -len("_II")], " II"
    if body in BASE_NAMES:
        name = BASE_NAMES[body]
    else:
        name = f"Potion of {title(body)}"
    return f"{form} {name}{suffix}".strip()


def main() -> None:
    doc = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    tiers = {}
    for n, key in enumerate(TIER_KEYS, start=1):
        for mat in doc["Concoctions"].get(f"Tier_{key}_Ingredients") or []:
            tiers[mat] = n
    all_potions = doc["Potions"]

    # Keep only what a chain starting at a water bottle can reach.
    potions, queue = {}, [START]
    while queue:
        pid = queue.pop()
        if pid in potions or pid not in all_potions:
            continue
        children = all_potions[pid].get("Children") or {}
        potions[pid] = {"name": potion_name(pid), "children": dict(children)}
        queue.extend(children.values())

    # Upstream has dangling children (e.g. Splash Wind Charging + Dragon Breath points at
    # LINGERING_POTION_OF_WIND_CHARGING, but the potion is defined as LINGERING_POTION_WIND_CHARGING).
    # mcMMO can't brew into a potion it doesn't define, so those steps aren't offered. Same for an
    # ingredient that isn't in any Concoctions tier (e.g. TALL_GRASS): the brew is refused at every level.
    for pid, p in potions.items():
        for mat, child in list(p["children"].items()):
            if child not in potions:
                print(f"warning: dropping {pid} + {mat} -> {child} (not defined upstream)")
                del p["children"][mat]
            elif mat not in tiers:
                print(f"warning: dropping {pid} + {mat} -> {child} ({mat} is in no Concoctions tier)")
                del p["children"][mat]

    commit = COMMIT.read_text(encoding="utf-8").strip()
    OUT.write_text(json.dumps({
        "source": f"LumaLibre/mcMMO@{commit[:7]} potions.yml",
        "start": START,
        "tiers": tiers,
        "potions": potions,
    }, indent=1), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(potions)} potions, {len(tiers)} ingredients")


if __name__ == "__main__":
    main()
