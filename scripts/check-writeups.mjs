// Validate hand-written item mechanics in data/writeups/*.json against src/data/items.json and, when the
// local LumaItems clone is present, against the source they cite (file exists, cited lines exist).
// Usage: node scripts/check-writeups.mjs [data/writeups/<batch>.json ...]   (no args = every batch)
//        node scripts/check-writeups.mjs --write   (check every batch, then merge them into src/data/writeups.json)
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const PKG = root('data/LumaItems/src/main/java/dev/lumas/lumaitems/');
const items = new Set(JSON.parse(readFileSync(root('src/data/items.json'), 'utf8')).items.map((i) => i.id));
const haveSource = existsSync(PKG);
const lineCount = new Map();
const lines = (file) => {
  if (!lineCount.has(file)) lineCount.set(file, existsSync(PKG + file) ? readFileSync(PKG + file, 'utf8').split('\n').length : -1);
  return lineCount.get(file);
};

const LISTS = ['use', 'numbers', 'details', 'quirks', 'config'];
const WRITE = process.argv.includes('--write');
const args = process.argv.slice(2).filter((a) => a !== '--write');
const files = args.length
  ? args
  : readdirSync(root('data/writeups')).filter((f) => f.endsWith('.json')).map((f) => root(`data/writeups/${f}`));

const errors = [];
const all = [];
const covered = new Map();
const keys = new Set();
for (const file of files) {
  const name = file.split(/[\\/]/).pop();
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { errors.push(`${name}: not valid JSON (${e.message})`); continue; }
  if (!Array.isArray(data)) { errors.push(`${name}: top level must be an array of entries`); continue; }
  for (const [n, w] of data.entries()) {
    all.push(w);
    const at = `${name}[${n}] ${w.key ?? '?'}`;
    if (typeof w.key !== 'string' || !/^[a-z0-9-]+$/.test(w.key)) errors.push(`${at}: key must be lowercase-with-dashes`);
    if (keys.has(w.key)) errors.push(`${at}: duplicate key`);
    keys.add(w.key);
    if (!Array.isArray(w.items) || !w.items.length) errors.push(`${at}: items must list at least one item id`);
    for (const id of w.items ?? []) {
      if (!items.has(id)) errors.push(`${at}: unknown item id "${id}"`);
      if (covered.has(id)) errors.push(`${at}: item "${id}" is already covered by ${covered.get(id)}`);
      covered.set(id, w.key);
    }
    if (typeof w.summary !== 'string' || w.summary.length < 20) errors.push(`${at}: summary missing or too short`);
    for (const k of Object.keys(w)) if (!['key', 'items', 'summary', ...LISTS].includes(k)) errors.push(`${at}: unknown field "${k}"`);
    for (const list of LISTS) {
      if (w[list] === undefined) continue;
      if (!Array.isArray(w[list])) { errors.push(`${at}: ${list} must be an array`); continue; }
      for (const [m, e] of w[list].entries()) {
        const where = `${at} ${list}[${m}]`;
        if (list === 'numbers' ? !(e.label && e.value) : !e.text) errors.push(`${where}: needs ${list === 'numbers' ? 'label and value' : 'text'}`);
        if (typeof e.src !== 'string' || !e.src.trim()) { errors.push(`${where}: missing src`); continue; }
        for (const ref of e.src.split(/,\s*/)) {
          const m2 = /^([\w/.-]+\.(?:kt|java)):(\d+)(?:-(\d+))?$/.exec(ref.trim());
          if (!m2) { errors.push(`${where}: src "${ref}" must look like items/x/File.kt:12 or :12-30`); continue; }
          if (!haveSource) continue;
          const n2 = lines(m2[1]);
          if (n2 < 0) errors.push(`${where}: src file not found: ${m2[1]}`);
          else if (Number(m2[3] ?? m2[2]) > n2 || Number(m2[2]) < 1) errors.push(`${where}: ${ref} is outside the file (${n2} lines)`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
if (WRITE) {
  const commit = readFileSync(root('data/LumaItems.commit'), 'utf8').trim();
  const out = { commit, writeups: Object.fromEntries(all.map((w) => [w.key, w])), byItem: Object.fromEntries(covered) };
  writeFileSync(root('src/data/writeups.json'), JSON.stringify(out, null, 1) + '\n');
  const missing = [...items].filter((id) => !covered.has(id) && id !== 'kamoris-glasses');
  console.log(`wrote src/data/writeups.json${missing.length ? ` — ${missing.length} item(s) still without a write-up: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}` : ''}`);
}
console.log(`ok: ${files.length} file(s), ${keys.size} write-ups covering ${covered.size} item(s)${haveSource ? '' : ' (source not present: citations not line-checked)'}`);
