"""Extract /jobs browse dumps from a Minecraft client log into data/raw/<job>.txt.

The log never contains the /jobs command itself, so the job is guessed from what the dump
contains (Brew -> Alchemist, Kill -> Hunter, ...) and the level comes from data/levels.json,
which the player fills in. Output format matches Luma Jobs/data/raw_*.txt:

    # job: Cook
    # level: 41
    # source: latest.log 06:42:19
    Craft:
      Bread ->  6.66$ 1.48xp

Usage:
    python scripts/extract_log.py [--log PATH ...] [--list] [--write]
"""
import argparse
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
LEVELS = ROOT / "data" / "levels.json"
DEFAULT_LOG = Path.home() / "AppData/Roaming/PrismLauncher/instances/Luma/minecraft/logs/latest.log"

CHAT_RE = re.compile(r"^\[(\d\d:\d\d:\d\d)\] \[[^\]]+\]: (?:\[System\] )?\[CHAT\] (.*)$")
ITEM_RE = re.compile(r"^\s+(.+?) ->\s+([\d,]+(?:\.\d+)?)\$\s+([\d,]+(?:\.\d+)?)xp\s*$")
HEADER_RE = re.compile(r"^\s?([A-Z][A-Za-z]*(?: [A-Za-z]+)*):\s*$")  # e.g. "Break:", "Strip logs:"
PAGE_RE = re.compile(r"Prev (\d+)/(\d+) Next")
# A loose page (items/headers with no footer) older than this many seconds is a single-page dump.
LOOSE_GAP_S = 3


def secs(t):
    h, m, s = map(int, t.split(":"))
    return h * 3600 + m * 60 + s


def read_lines(path):
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = CHAT_RE.match(line.rstrip("\n"))
            if m:
                yield m.group(1), m.group(2)


class Dump:
    def __init__(self, total, start, log):
        self.total = total
        self.start = start
        self.log = log
        self.pages = {}  # page number -> (entries, last_section)

    @property
    def complete(self):
        return len(self.pages) == self.total

    def entries(self):
        out, section = [], None
        for k in range(1, self.total + 1):
            if k not in self.pages:
                continue
            page_entries, _ = self.pages[k]
            for sec, item, money, xp in page_entries:
                # A page that starts mid-section inherits the previous page's section.
                sec = sec or (self.pages[k - 1][1] if k - 1 in self.pages else section)
                section = sec
                out.append((sec, item, money, xp))
        return out

    def sections(self):
        seen = []
        for sec, *_ in self.entries():
            if sec not in seen:
                seen.append(sec)
        return seen


def parse_dumps(log_paths):
    dumps = []
    for path in log_paths:
        buf, section, first_t, last_t, current = [], None, None, None, None

        def flush_loose():
            nonlocal buf, section, first_t
            if buf and any(e[1] for e in buf):
                d = Dump(1, first_t, path.name)
                d.pages[1] = (buf, section)
                dumps.append(d)
            buf, section, first_t = [], None, None

        for t, text in read_lines(path):
            if buf and last_t and secs(t) - secs(last_t) > LOOSE_GAP_S and not PAGE_RE.search(text):
                if HEADER_RE.match(text) or ITEM_RE.match(text):
                    flush_loose()
            if m := HEADER_RE.match(text):
                section = m.group(1)
                first_t = first_t or t
                last_t = t
                continue
            if m := ITEM_RE.match(text):
                buf.append((section, m.group(1).strip(), float(m.group(2).replace(",", "")),
                            float(m.group(3).replace(",", ""))))
                first_t = first_t or t
                last_t = t
                continue
            if m := PAGE_RE.search(text):
                k, n = int(m.group(1)), int(m.group(2))
                # Only the page's first entry lacks a section when it continues the previous page.
                entries = buf
                if k == 1 or current is None or current.total != n:
                    current = Dump(n, first_t or t, path.name)
                    dumps.append(current)
                current.pages[k] = (entries, section)
                buf, first_t, last_t = [], None, t
                continue
        flush_loose()
    return dumps


# Guess the job from the dump contents. Order matters: first match wins.
def guess_job(d):
    secs_ = set(d.sections())
    names = {e[1] for e in d.entries()}
    if "Brew" in secs_:
        return "Alchemist"
    if "Fish" in secs_:
        return "Fisherman"
    if "Kill" in secs_ and not ({"Break", "Place"} & secs_):
        return "Hunter"
    if {"Breed", "Shear", "Milk"} & secs_ or "Wheat" in names:
        return "Farmer"
    if "Craft" in secs_ and ({"Bread", "Cake", "Cookie"} & names or "Baked Potato" in names):
        return "Cook"
    if {"Repair", "Enchant"} & secs_ or any(n.endswith(("Sword", "Pickaxe", "Chestplate")) for n in names):
        return "Blacksmith"
    if any("Log" in n or "Stem" in n or "Leaves" in n for n in names) and "Break" in secs_ and len(names) < 200:
        return "Lumberjack"
    if secs_ == {"Place"}:
        return "Builder"
    if any(n.endswith("Ore") for n in names):
        return "Miner"
    if {"Dirt", "Sand", "Gravel"} & names and "Place" not in secs_:
        return "Digger"
    return "?"


def write_raw(job, level, d):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    lines = [f"# job: {job}", f"# level: {level}", f"# source: {d.log} {d.start} ({d.total} pages)"]
    section = None
    for sec, item, money, xp in d.entries():
        if sec != section:
            lines.append(f"{sec}:")
            section = sec
        lines.append(f"  {item} ->  {money:.2f}$ {xp:.2f}xp")
    path = RAW_DIR / f"{job.lower()}.txt"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", action="append", type=Path)
    ap.add_argument("--write", action="store_true", help="write data/raw/<job>.txt for jobs in data/levels.json")
    args = ap.parse_args()
    logs = args.log or [DEFAULT_LOG]

    dumps = parse_dumps(logs)
    latest = {}
    print(f"{'start':8}  {'job?':10} {'pages':>7} {'items':>5}  sections")
    for d in dumps:
        job = guess_job(d)
        status = f"{len(d.pages)}/{d.total}"
        print(f"{d.start:8}  {job:10} {status:>7} {len(d.entries()):>5}  {', '.join(map(str, d.sections()))}")
        if d.complete:
            latest[job] = d  # later complete dumps win

    if args.write:
        levels = json.loads(LEVELS.read_text(encoding="utf-8"))
        for job, level in levels.items():
            if job.startswith("_"):
                continue
            if job not in latest:
                print(f"!! no complete dump found for {job}")
                continue
            print(f"wrote {write_raw(job, level, latest[job]).relative_to(ROOT)}  ({len(latest[job].entries())} items)")


if __name__ == "__main__":
    main()
