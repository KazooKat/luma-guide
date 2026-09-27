// Build src/data/items.json (the Items glossary) from a local clone of LumaLibre/LumaItems.
// The clone is not committed (upstream is CC BY-NC-ND 4.0). Set it up at the pinned commit with:
//   git -c core.longpaths=true clone https://github.com/LumaLibre/LumaItems.git data/LumaItems
//   git -C data/LumaItems checkout "$(cat data/LumaItems.commit)"
// Every ItemFactory.builder() chain under items/ is evaluated with scripts/lib/kotlin-lite.mjs. Anything the
// evaluator can't resolve must be covered by data/items-overrides.json, or the build fails. Astral sets are built
// procedurally in the plugin, so they are transcribed per piece in the overrides file.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lex, evaluate, collectVals, matchClose, splitArgs, Unresolved, show } from './lib/kotlin-lite.mjs';
import { buildTooltip, enchantLine, enchantInfo } from './lib/tooltip.mjs';
import { legacyToMini } from './lib/legacy.mjs';
import { parseUpgrades, upgradePath } from './lib/astral-upgrades.mjs';
import { enchantKey, gearType, eventName, tierColors } from './lib/items-util.mjs';

const ROOT = new URL('../', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, ROOT));
const REPO = path('data/LumaItems');
const PKG = join(REPO, 'src/main/java/dev/lumas/lumaitems');
const COMMIT = readFileSync(path('data/LumaItems.commit'), 'utf8').trim();
const OVERRIDES = JSON.parse(readFileSync(path('data/items-overrides.json'), 'utf8'));
const OUT = path('src/data/items.json');
const SOURCE_URL = `https://github.com/LumaLibre/LumaItems/blob/${COMMIT.slice(0, 7)}`;

if (!existsSync(PKG)) throw new Error(`LumaItems clone not found at ${REPO} (see header comment)`);
const head = readFileSync(join(REPO, '.git/HEAD'), 'utf8').trim();
if (head !== COMMIT) throw new Error(`data/LumaItems is at ${head}, expected ${COMMIT} from data/LumaItems.commit`);

// ---------- tiers ----------
const tierSrc = readFileSync(join(PKG, 'util/Tier.java'), 'utf8');
const TIERS = new Map();
for (const m of tierSrc.matchAll(/public static final Tier (\w+) = new Tier\("((?:[^"\\]|\\.)*)"\)(?:\.alt\("((?:[^"\\]|\\.)*)"\))?;/g)) {
  TIERS.set(m[1], { tier: true, key: m[1], mini: m[2], alt: m[3] ?? null });
}
const NON_EVENT = new Set(['BLANK', 'DEPRECATED', 'DEBUG', 'STAFF', 'ASTRAL', 'COLLECTIBLE']);
const EVENTS = [...TIERS.values()].filter((t) => !NON_EVENT.has(t.key));
if (EVENTS.length < 10) throw new Error(`only ${EVENTS.length} event tiers parsed from Tier.java`);

// ---------- source walk ----------
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.kt') ? [p] : [];
  });
}

function classRanges(tokens) {
  const out = [];
  for (let k = 0; k < tokens.length - 1; k++) {
    if (tokens[k].v !== 'class' || tokens[k].t !== 'id' || tokens[k + 1].t !== 'id') continue;
    let j = k + 2;
    let d = 0;
    for (; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.v === '(' || t.v === '<') d++;
      else if (t.v === ')' || t.v === '>') d--;
      else if (d === 0 && t.v === '{') break;
      else if (d === 0 && t.nl && j > k + 2 && t.v !== ':' && tokens[j - 1].v !== ':' && tokens[j - 1].v !== ',') { j = -1; break; }
    }
    if (j < 0 || j >= tokens.length) continue;
    // annotations directly before `class` (skipping modifiers)
    const annotations = [];
    let b = k - 1;
    while (b >= 0) {
      const t = tokens[b];
      if (t.t === 'id' && ['private', 'internal', 'open', 'abstract', 'data', 'sealed', 'public', 'final', 'inner'].includes(t.v)) { b--; continue; }
      if (t.v === ')') { let d2 = 0; for (; b >= 0; b--) { if (tokens[b].v === ')') d2++; if (tokens[b].v === '(') { d2--; if (d2 === 0) break; } } b--; continue; }
      if (t.t === 'id' && tokens[b - 1]?.v === '@') { annotations.push(t.v); b -= 2; continue; }
      break;
    }
    out.push({ name: tokens[k + 1].v, start: j, end: matchClose(tokens, j), annotations });
  }
  return out;
}

const RELEVANT = new Set(['name', 'customEnchants', 'lore', 'material', 'persistentData', 'vanillaEnchants', 'tier', 'hideEnchants', 'addSpace', 'spoofEnchants', 'tagline', 'b64PHead']);
const BUILDS = new Set(['build', 'buildPair', 'buildItem', 'buildNoMiniMessage']);

/** Top-level (outside any class) declarations of every other .kt file in the same package directory. */
const siblingCache = new Map();
function siblingDecls(file) {
  const dir = file.slice(0, file.lastIndexOf('/'));
  if (!siblingCache.has(dir)) {
    const decls = new Map();
    for (const f of readdirSync(join(PKG, dir)).filter((n) => n.endsWith('.kt'))) {
      const toks = lex(readFileSync(join(PKG, dir, f), 'utf8'));
      const cls = classRanges(toks);
      for (const [name, list] of collectVals(toks)) {
        for (const d of list) if (!cls.some((c) => c.start < d.pos && d.pos < c.end)) {
          if (!decls.has(name)) decls.set(name, []);
          decls.get(name).push({ ...d, file: f });
        }
      }
    }
    siblingCache.set(dir, decls);
  }
  return siblingCache.get(dir);
}

/**
 * Identifier lookup scoped like Kotlin would see it from `pos`: the innermost enclosing class's declaration first,
 * then the file's top level, then top-level declarations elsewhere in the package directory.
 */
function makeEnv(vals, classes, file, pos) {
  const seen = new Set();
  const enclosing = (at) => classes.filter((c) => c.start < at && at < c.end).sort((a, b) => b.start - a.start);
  const resolveDecl = (name, at, fn = false) => {
    const list = (vals.get(name) ?? []).filter((d) => !!d.params === fn);
    for (const c of enclosing(at)) {
      const inClass = list.filter((d) => c.start < d.pos && d.pos < c.end && enclosing(d.pos)[0] === c);
      if (inClass.length === 1) return { decl: inClass[0], local: true };
    }
    const top = list.filter((d) => !classes.some((c) => c.start < d.pos && d.pos < c.end));
    if (top.length === 1) return { decl: top[0], local: true };
    const sib = siblingDecls(file).get(name) ?? [];
    if (!list.length && sib.length === 1) return { decl: sib[0], local: false };
    throw new Unresolved(`identifier ${name}${list.length > 1 ? ' (ambiguous)' : ''}`);
  };
  const stack = [pos];
  const frames = []; // parameter bindings of local helper functions being evaluated
  const env = {
    lookup(name) {
      const frame = frames[frames.length - 1];
      if (frame && name in frame) return frame[name];
      const { decl, local } = resolveDecl(name, stack[stack.length - 1]);
      if (!local) return evaluate(decl.tokens, makeEnv(new Map(), [], `${file.slice(0, file.lastIndexOf('/'))}/${decl.file}`, 0));
      if (seen.has(name)) throw new Unresolved(`recursive ${name}`);
      seen.add(name);
      stack.push(decl.pos);
      try { return evaluate(decl.tokens, env); } finally { seen.delete(name); stack.pop(); }
    },
    enumRef(ns, member) {
      if (ns === 'Material') return { material: member };
      if (ns === 'Enchantment') return { ench: enchantKey(member) };
      if (ns === 'Tier' && TIERS.has(member)) return TIERS.get(member);
      throw new Unresolved(`${ns}.${member}`);
    },
    call(name, args) {
      if ((vals.get(name) ?? []).some((d) => d.params)) {
        const { decl } = resolveDecl(name, stack[stack.length - 1], true);
        if (decl.params.length !== args.length) throw new Unresolved(`${name}(): ${args.length} args`);
        frames.push(Object.fromEntries(decl.params.map((p, i) => [p, args[i]])));
        stack.push(decl.pos);
        try { return evaluate(decl.tokens, env); } finally { frames.pop(); stack.pop(); }
      }
      if (name === 'Tier' && typeof args[0] === 'string') return { tier: true, key: null, mini: args[0], alt: null };
      if (name === 'Util.namespacedKey' && typeof args[0] === 'string') return args[0];
      if (name === 'NamespacedKey' && typeof args[1] === 'string') return args[1];
      throw new Unresolved(`call ${name}()`);
    },
  };
  return env;
}

const newItem = () => ({ name: '', customEnchants: [], lore: [], taglines: [], vanillaEnchants: [], hideEnchants: false, addSpace: true, spoofEnchants: false, tier: undefined, legacy: false, material: null, id: null, head: false, icon: null });

/** `ITEM_MODEL, NamespacedKey.minecraft("x")` inside a class: the item is drawn as x, not its material. */
function itemModel(tokens, cls) {
  if (!cls) return null;
  for (let k = cls.start; k < cls.end - 7; k++) {
    if (tokens[k].v === 'ITEM_MODEL' && tokens[k + 1].v === ',' && tokens[k + 2].v === 'NamespacedKey' && tokens[k + 4].v === 'minecraft'
      && tokens[k + 6]?.t === 'str' && tokens[k + 6].parts.length === 1) return tokens[k + 6].parts[0];
  }
  return null;
}
const cloneItem = (it) => JSON.parse(JSON.stringify(it));

const strings = (vals, what) => {
  const flat = vals.flat(2);
  if (!flat.every((s) => typeof s === 'string')) throw new Unresolved(`${what}: not all strings`);
  return flat;
};

/** Apply the `.method(args)` chain starting at tokens[j] (a '.') to `item`, until a build call. */
function readChain(tokens, j, env, item, errors = []) {
  let built = false;
  while (tokens[j]?.v === '.' && tokens[j + 1]?.t === 'id' && tokens[j + 2]?.v === '(') {
    const m = tokens[j + 1].v;
    const close = matchClose(tokens, j + 2);
    const argToks = splitArgs(tokens, j + 3, close);
    j = close + 1;
    if (BUILDS.has(m)) { built = true; item.legacy = m === 'buildNoMiniMessage'; break; }
    if (!RELEVANT.has(m)) continue;
    try {
      const args = argToks.map((a) => evaluate(a, env));
      applyMethod(item, m, args);
    } catch (e) {
      if (!(e instanceof Unresolved)) throw e;
      errors.push(`.${m}(${show(argToks.flat())}): ${e.message}`);
    }
  }
  return { item, errors, built, end: j };
}

function applyMethod(item, m, args) {
  switch (m) {
    case 'name': item.name = strings(args, 'name')[0]; break;
    case 'customEnchants': item.customEnchants = strings(args, 'customEnchants'); break;
    case 'lore': item.lore = strings(args, 'lore'); break;
    case 'tagline':
      item.taglines = args.length === 2 ? [`<${args[0]}>"${args[1]}"`] : strings(args, 'tagline');
      break;
    case 'material': {
      const v = args[0];
      if (v?.material) item.material = v.material;
      else if (typeof v === 'string') item.material = v.toUpperCase();
      else throw new Unresolved('material');
      break;
    }
    case 'persistentData': {
      const v = args.flat()[0];
      if (typeof v !== 'string') throw new Unresolved('persistentData');
      item.id = v;
      break;
    }
    case 'vanillaEnchants': {
      const pairs = args.flat();
      item.vanillaEnchants = pairs.map((p) => {
        if (!p?.pair || !p.pair[0]?.ench || typeof p.pair[1] !== 'number') throw new Unresolved('vanillaEnchants entry');
        return [p.pair[0].ench, p.pair[1]];
      });
      break;
    }
    case 'tier': {
      const v = args[0];
      if (typeof v === 'string') item.tier = { tier: true, key: null, mini: v, alt: null };
      else if (v?.tier) item.tier = v;
      else throw new Unresolved('tier');
      break;
    }
    case 'hideEnchants': case 'addSpace': case 'spoofEnchants':
      if (typeof args[0] !== 'boolean') throw new Unresolved(m);
      item[m] = args[0];
      break;
    case 'b64PHead': item.head = true; break;
  }
}

/** Section for a tier, or null with a reason when the item is left out of the glossary. */
function classify(tier) {
  if (!tier) return { section: null, reason: 'no tier (defaults to Astral: stub/placeholder)' };
  if (tier.key && EVENTS.some((e) => e.key === tier.key)) return { section: tier.key };
  if (tier.key === 'COLLECTIBLE' || /Collectible/.test(tier.mini)) return { section: 'COLLECTIBLE' };
  return { section: null, reason: `tier ${tier.key ?? JSON.stringify(tier.mini)}` };
}

// ---------- collect ----------
const items = [];
const skipped = [];
const failures = [];
const usedOverrides = new Set();

function accept(key, cls, rel, item, errors, ov = OVERRIDES.items[key]) {
  if (ov) usedOverrides.add(key);
  if (ov?.skip) { skipped.push(`${key} (${cls?.name}): ${ov.note}`); return; }
  if (ov) Object.assign(item, ov.fields ?? {}, ov.note ? { note: ov.note } : {});
  if (ov?.tierKey) {
    if (!TIERS.has(ov.tierKey)) throw new Error(`override ${key}: unknown tier ${ov.tierKey}`);
    const t = TIERS.get(ov.tierKey);
    item.tier = ov.tierAlt ? { ...t, mini: t.alt ?? t.mini } : t;
  }
  const { section, reason } = classify(item.tier);
  if (!section) { skipped.push(`${key} (${cls?.name}): ${reason}`); return; }
  if (errors.length && !ov) { failures.push(`${key} (${cls?.name}):\n    ${errors.join('\n    ')}`); return; }
  if (!item.id || !item.material || !item.name) { failures.push(`${key} (${cls?.name}): missing id/material/name`); return; }
  items.push({ ...item, section, cls: cls?.name ?? null, file: rel });
}

for (const file of walk(join(PKG, 'items'))) {
  const rel = relative(PKG, file).replace(/\\/g, '/');
  if (rel.startsWith('items/astral/')) continue; // Astral sets come from the overrides file
  const src = readFileSync(file, 'utf8');
  if (!src.includes('ItemFactory')) continue;
  const tokens = lex(src);
  const classes = classRanges(tokens);
  const vals = collectVals(tokens);
  const classAt = (k) => classes.filter((c) => c.start < k && k < c.end).sort((a, b) => b.start - a.start)[0];
  const bases = new Map(); // `val base = ItemFactory.builder()...` without build(): extended elsewhere in the file
  let n = 0;
  for (let k = 0; k < tokens.length - 4; k++) {
    if (tokens[k].v !== 'ItemFactory' || tokens[k + 1].v !== '.') continue;
    const b = tokens[k + 2].v === 'Companion' ? k + 4 : k + 2;
    if (tokens[b]?.v !== 'builder' || tokens[b + 1]?.v !== '(') continue;
    const cls = classAt(k);
    const env = makeEnv(vals, classes, rel, k);
    const { item, errors, built } = readChain(tokens, b + 3, env, newItem());
    item.icon = itemModel(tokens, cls);
    if (!built && tokens[k - 1]?.v === '=') {
      let d = k - 2;
      while (d > 0 && tokens[d - 1]?.v !== 'val' && tokens[d - 1]?.v !== 'var') d--; // skip `: Type`
      if (tokens[d]?.t === 'id') { bases.set(tokens[d].v, { item, errors }); continue; }
    }
    const key = `${rel}#${n++}`;
    if (cls?.annotations.includes('Ignore')) { skipped.push(`${key} (${cls.name}): @Ignore`); continue; }
    if (!built) errors.push('builder chain does not end in build()');
    accept(key, cls, rel, item, errors);
  }
  for (const [baseName, base] of bases) {
    for (let k = 1; k < tokens.length - 2; k++) {
      if (tokens[k].v !== baseName || tokens[k + 1].v !== '.' || tokens[k - 1].v === 'val' || tokens[k - 1].v === '.') continue;
      const cls = classAt(k);
      const key = `${rel}#${baseName}@${cls?.name ?? k}`;
      if (cls?.annotations.includes('Ignore')) { skipped.push(`${key}: @Ignore`); continue; }
      const { item, errors, built } = readChain(tokens, k + 1, makeEnv(vals, classes, rel, k), cloneItem(base.item), [...base.errors]);
      item.icon = itemModel(tokens, cls) ?? item.icon;
      if (!built) continue; // not an item definition (e.g. the base passed somewhere else)
      accept(key, cls, rel, item, errors);
    }
  }
}

// Items the source builds from parameters or lists (one builder, several registered items), transcribed by hand.
for (const extra of OVERRIDES.extraItems ?? []) {
  accept(`extra:${extra.fields.id}`, { name: extra.cls }, extra.file, { ...newItem(), ...extra.fields }, [], extra);
}

for (const set of OVERRIDES.astralSets) {
  const legacy = set.style === 'legacy';
  set.pieces.forEach((piece) => {
    const gear = gearType(piece.material);
    const name = piece.name ?? (legacy ? `&#AC87FB&l${set.name} &f${gear}` : `<b><#AC87FB>${set.name}</#AC87FB></b> <white>${gear}</white>`);
    const customEnchants = piece.customEnchants ?? (legacy ? set.customEnchants : set.customEnchants.map((e) => `<#AC87FB>${e}</#AC87FB>`));
    items.push({
      id: `${set.id}-${piece.material.toLowerCase().replace(/_/g, '-')}`,
      set: set.id,
      setName: set.name,
      section: 'ASTRAL',
      cls: set.cls,
      file: set.file,
      material: piece.material,
      name,
      customEnchants,
      lore: piece.lore,
      taglines: [],
      vanillaEnchants: piece.enchants,
      hideEnchants: false,
      addSpace: true,
      spoofEnchants: false,
      tier: legacy ? { mini: '&#AC87FB&lAstral' } : TIERS.get('ASTRAL'),
      legacy,
      head: false,
    });
  });
}

console.log(`skipped ${skipped.length} (not in the glossary):`);
for (const s of skipped) console.log(`  - ${s}`);

const unusedOverrides = Object.keys(OVERRIDES.items).filter((k) => !usedOverrides.has(k));
for (const e of OVERRIDES.extraItems ?? []) usedOverrides.add(`extra:${e.fields.id}`);
if (failures.length || unusedOverrides.length) {
  console.error(`\n${failures.length} item(s) could not be resolved; add them to data/items-overrides.json:\n`);
  for (const f of failures) console.error(`  ${f}`);
  if (unusedOverrides.length) console.error(`\nOverrides that matched nothing (source moved?): ${unusedOverrides.join(', ')}`);
  process.exit(1);
}

// ---------- Astral upgrades ----------
const UPGRADES = parseUpgrades(readFileSync(join(PKG, 'configuration/files/AstralYml.kt'), 'utf8'));
for (const it of items.filter((i) => i.section === 'ASTRAL')) {
  if (!UPGRADES[it.set]) throw new Error(`no astral-upgrades tiers for ${it.set}`);
}

// ---------- output ----------
const ids = new Set();
const out = items.map((it) => {
  if (ids.has(it.id)) throw new Error(`duplicate item id ${it.id} (${it.file})`);
  ids.add(it.id);
  const tip = buildTooltip({ ...it, tier: it.tier?.mini ?? '' });
  return {
    id: it.id,
    section: it.section,
    ...(it.set ? { set: it.set, setName: it.setName } : {}),
    material: it.material,
    icon: (it.icon ?? (it.head ? 'player_head' : it.material.toLowerCase())).replace(/^minecraft:/, ''),
    glint: it.vanillaEnchants.length > 0,
    name: tip.name,
    enchants: tip.enchants,
    lore: tip.lore,
    // For the detail view and search: custom enchants (the item's abilities) and every vanilla enchant,
    // including ones the tooltip hides.
    abilities: it.customEnchants.map((e) => (it.legacy ? legacyToMini(e) : e)),
    enchantList: [...it.vanillaEnchants]
      .sort((a, b) => enchantInfo(a[0]).order - enchantInfo(b[0]).order)
      .map(([k, l]) => enchantLine(k, l).replace(/^<\w+>/, '')),
    enchantsHidden: it.vanillaEnchants.length > 0 && tip.enchants.length === 0,
    source: `${SOURCE_URL}/src/main/java/dev/lumas/lumaitems/${it.file}`,
    cls: it.cls,
    ...(it.note ? { note: it.note } : {}),
    ...(it.section === 'ASTRAL' ? {
      upgrades: {
        path: upgradePath({ material: it.material, enchants: it.vanillaEnchants }, UPGRADES[it.set]),
        source: `${SOURCE_URL}/src/main/java/dev/lumas/lumaitems/configuration/files/AstralYml.kt#L${UPGRADES[it.set][0].line}`,
      },
    } : {}),
  };
});

const newestFirst = [...EVENTS].reverse();
const sections = [
  ...newestFirst.map((e) => ({ key: e.key, kind: 'event', name: eventName(e.mini), mini: e.mini, colors: tierColors(e.mini) })),
  { key: 'ASTRAL', kind: 'astral', name: 'Astral', mini: TIERS.get('ASTRAL').mini, colors: tierColors(TIERS.get('ASTRAL').mini) },
  { key: 'COLLECTIBLE', kind: 'collectible', name: 'Collectibles', mini: TIERS.get('COLLECTIBLE').mini, colors: ['#55FFFF'] },
].filter((s) => out.some((i) => i.section === s.key));

writeFileSync(OUT, JSON.stringify({ source: { repo: 'LumaLibre/LumaItems', commit: COMMIT }, sections, items: out }, null, 1) + '\n');
console.log(`items: ${out.length} written to src/data/items.json from LumaItems @ ${COMMIT.slice(0, 7)}`);
for (const s of sections) console.log(`  ${s.name.padEnd(18)} ${out.filter((i) => i.section === s.key).length}`);
