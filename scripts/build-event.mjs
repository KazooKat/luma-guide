// Build src/data/event.json from the local LumaLibre/luma-events clone (pinned in data/luma-events.commit),
// the hand-maintained data/event/event.json, and the cited minigame guides in data/event/minigames/*.json.
// Every number read from the source keeps the file:line it came from, so the page can cite it.
// The build fails if something it expects in the source has moved, so a refresh after an event update is loud.
// Usage: node scripts/build-event.mjs           (check + write src/data/event.json and src/data/event-live.json)
//        node scripts/build-event.mjs --check   (check only)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const PKG = root('data/luma-events/src/main/java/dev/lumas/events/');
const CHECK = process.argv.includes('--check');

if (!existsSync(PKG)) {
  console.error('data/luma-events is missing. Clone it first (see README, "Refreshing event data").');
  process.exit(1);
}

const errors = [];
const cache = new Map();
const lines = (file) => {
  if (!cache.has(file)) cache.set(file, existsSync(PKG + file) ? readFileSync(PKG + file, 'utf8').split('\n') : null);
  return cache.get(file);
};

/** First line in `file` matching `re`: { m, src: "file:line" }. Records an error (and returns null) when nothing matches. */
function find(file, re, what) {
  const ls = lines(file);
  if (!ls) { errors.push(`${what}: ${file} not found`); return null; }
  for (let i = 0; i < ls.length; i++) {
    const m = re.exec(ls[i]);
    if (m) return { m, line: i + 1, src: `${file}:${i + 1}` };
  }
  errors.push(`${what}: no line in ${file} matches ${re}`);
  return null;
}
/** Every line in `file` matching `re`. */
function findAll(file, re) {
  return (lines(file) ?? []).flatMap((l, i) => { const m = re.exec(l); return m ? [{ m, line: i + 1, src: `${file}:${i + 1}` }] : []; });
}
const num = (s) => Number(String(s).replace(/_/g, ''));
const span = (a, b) => (a && b ? `${a.src.split(':')[0]}:${Math.min(a.line, b.line)}-${Math.max(a.line, b.line)}` : a?.src ?? b?.src ?? '');

// ---- tokens --------------------------------------------------------------------------------------------------
const TX = 'items/TokenExchanging.java';
const types = findAll(TX, /^\s+([A-Z_]+)\((\w+)\.class,\s*"(.*?)",\s*"([a-z0-9-]+)"\)/).map(({ m, src }) => ({ constant: m[1], name: m[3], key: m[4], src }));
if (!types.length) errors.push(`${TX}: no TokenType entries found`);
const ceil = find(TX, /Math\.ceil\(.*getTokenMultiplier\(\)\s*\*\s*amount\)/, 'token multiplier rounding');
const cap = find(TX, /Math\.min\(finalAmount,\s*(\d+)\)/, 'token cap');
const capMsg = find(TX, /sendMsg\(player,\s*"You got <gold>"\s*\+\s*finalAmount/, 'token chat message');
const CFG = 'configurable/Config.java';
const mult = find(CFG, /tokenMultiplier\s*=\s*([\d.]+)/, 'token multiplier default');

// ---- jobs ----------------------------------------------------------------------------------------------------
const JV = 'listeners/EventJobValue.java';
const JL = 'listeners/JobsListener.java';
const jobList = findAll(JV, /^\s+([A-Z]+)\((\d+)\)[,;]/).map(({ m, src }) => ({ job: m[1][0] + m[1].slice(1).toLowerCase(), chance: num(m[2]), src }));
if (jobList.length !== 10) errors.push(`${JV}: expected 10 jobs, found ${jobList.length}`);
const bound = find(JV, /bound\s*=\s*([\d_]+)/, 'job bound');
const roll = find(JL, /RANDOM\.nextInt\(bound\)\s*<\s*jobConstant\.getChance\(\)/, 'job roll');
const tf = find(JL, /getBound\(\)\s*\*\s*(\d+)/, 'tree feller factor');
const tnt = find(JL, /ActionType\.TNTBREAK/, 'tnt exclusion');
const jobGive = find(JL, /TokenExchanging\.give\(player,\s*TokenExchanging\.TokenType\.\w+,\s*(\d+),/, 'job token amount');
const jobsOn = find(CFG, /jobTokenPayouts\s*=\s*(true|false)/, 'job payouts default');

// ---- town invites --------------------------------------------------------------------------------------------
const TJ = 'listeners/TownJoinListener.java';
const tMin = find(TJ, /MIN_ELIGIBLE_PLAYTIME_TICKS\s*=\s*TimeUnit\.MINUTES\.toSeconds\((\d+)\)/, 'invite min playtime');
const tMax = find(TJ, /MAX_ELIGIBLE_PLAYTIME_TICKS\s*=\s*TimeUnit\.HOURS\.toSeconds\((\d+)\)/, 'invite max playtime');
const tCd = find(TJ, /INVITER_REWARD_COOLDOWN_NANOS\s*=\s*TimeUnit\.MINUTES\.toNanos\((\d+)\)/, 'invite cooldown');
const tLo = find(TJ, /MIN_INVITER_REWARD\s*=\s*(\d+)/, 'invite reward min');
const tHi = find(TJ, /MAX_INVITER_REWARD\s*=\s*(\d+)/, 'invite reward max');
const tOn = find(CFG, /townTokenInvitePayouts\s*=\s*(true|false)/, 'invite payouts default');

// ---- schedule ------------------------------------------------------------------------------------------------
const MM = 'games/MinigameManager.java';
const autoOn = find(CFG, /automaticMinigames\s*=\s*(true|false)/, 'automatic minigames default');
const cd = find(CFG, /automaticMinigameCooldown\s*=\s*(\d+)L/, 'automatic cooldown');
const countdown = find(MM, /return this\.newMinigame\(force, (\d+)\);/, 'join countdown');
const rotation = find(MM, /return availableMinigames\.get\(\(lastIndex \+ 1\) % availableMinigames\.size\(\)\)/, 'rotation');
const rotStart = find(CFG, /enabledAutomaticMinigames\s*=\s*List\.of\(/, 'default rotation');
const defaultRotation = [];
if (rotStart) {
  for (let i = rotStart.line; i < lines(CFG).length && !/\);/.test(lines(CFG)[i - 1]); i++) {
    for (const m of lines(CFG)[i].matchAll(/MinigameConstant\.([A-Z_0-9]+)/g)) defaultRotation.push(m[1]);
  }
}

// ---- commands and charm --------------------------------------------------------------------------------------
const CM = 'commands/CommandManager.java';
const rootCmd = find(CM, /name\s*=\s*"(\w+)"/, 'root command');
const aliases = find(CM, /aliases\s*=\s*\{(.*?)\}/, 'root aliases');
const playerCommands = [];
for (const dir of ['commands/modules', 'commands/modules/minigame']) {
  for (const f of readdirSync(PKG + dir).filter((f) => f.endsWith('.java'))) {
    const file = `${dir}/${f}`;
    const text = lines(file).join('\n');
    if (!/permission\s*=\s*"lumaevents\.default"/.test(text)) continue;
    const name = find(file, /name\s*=\s*"(\w+)"/, `command name in ${file}`);
    const usage = find(file, /usage\s*=\s*"\/<command> (.*?)"/, `command usage in ${file}`);
    if (name) playerCommands.push({ name: name.m[1], usage: usage ? usage.m[1] : name.m[1], src: span(name, usage) });
  }
}
playerCommands.sort((a, b) => a.name.localeCompare(b.name));
const charm = find('commands/modules/ClaimCharmCommand.java', /getCustomItem\("([a-z0-9-]+)"\)/, 'charm item');
const charmNeed = find('commands/modules/ClaimCharmCommand.java', /getScores\(\)\.isEmpty\(\)/, 'charm requirement');

// ---- candy (trick or treating) -------------------------------------------------------------------------------
// Each candy rolls once when eaten: a shared Soul Orb chance first, then its own effects, else nothing.
// Older events have no candy folder, so this is optional; once the folder exists, anything unreadable fails the build.
const CANDY_DIR = 'items/candy';
const CI = `${CANDY_DIR}/CandyItem.kt`;
let candy = null;
if (existsSync(PKG + CANDY_DIR)) {
  const orbChance = find(CI, /const val SOUL_ORB_CHANCE\s*=\s*([\d.]+)/, 'candy soul orb chance');
  const orbGive = find(CI, /private fun giveSoulOrb/, 'candy soul orb give');
  const pool = find(CI, /listOf\(CandyEffect\(SOUL_ORB_CHANCE/, 'candy roll pool');
  const bedrock = find(CI, /override fun onRightClick/, 'candy bedrock right click');
  // The Bedrock path: right click eats the candy for Floodgate players. Cite the whole function, up to its closing brace.
  const floodgate = find(CI, /isFloodgate\) return$/, 'candy bedrock check');
  const bedrockEnd = bedrock ? lines(CI).findIndex((l, i) => i >= bedrock.line && /^ {4}\}$/.test(l)) + 1 : 0;
  if (bedrock && bedrockEnd < 1) errors.push(`${CI}: end of onRightClick not found`);
  const strip = (s) => s.replace(/<[^>]+>/g, '');
  const items = readdirSync(PKG + CANDY_DIR).filter((f) => f.endsWith('.kt') && f !== 'CandyItem.kt').sort().map((f) => {
    const file = `${CANDY_DIR}/${f}`;
    const key = find(file, /override val key = "([a-z-]+)"/, `candy key in ${file}`);
    const name = find(file, /override val name = "(.+)"/, `candy name in ${file}`);
    const effects = [];
    for (const [i, l] of lines(file).entries()) {
      const e = /CandyEffect\(([\d.]+),\s*"(.*?)"\)/.exec(l);
      if (e) { effects.push({ chance: Number(e[1]), message: strip(e[2]), potions: [], src: `${file}:${i + 1}` }); continue; }
      const p = /PotionEffect\(PotionEffectType\.([A-Z_]+),\s*20 \* (\d+),\s*(\d+)\)/.exec(l);
      if (p && effects.length) effects.at(-1).potions.push({ type: p[1], seconds: Number(p[2]), level: Number(p[3]) + 1 });
    }
    if (!effects.length) errors.push(`${file}: no CandyEffect found`);
    const written = lines(file).filter((l) => /\bCandyEffect\(/.test(l)).length;
    if (written !== effects.length) errors.push(`${file}: ${written} CandyEffect(...) lines but only ${effects.length} read (chance or message not a literal?)`);
    if (effects.reduce((a, e) => a + e.chance, Number(orbChance?.m[1] ?? 0)) > 1) errors.push(`${file}: effect chances add up to more than 1`);
    return { key: key?.m[1], name: name ? strip(name.m[1]) : f, src: key?.src, effects };
  });
  if (!items.length) errors.push(`${CANDY_DIR}: no candy found`);
  if (orbChance && orbGive && pool && bedrock && floodgate && bedrockEnd > 0) candy = { soulOrbChance: Number(orbChance.m[1]), soulOrbSrc: span(orbChance, orbGive), rollSrc: pool.src, bedrockSrc: `${CI}:${bedrock.line}-${bedrockEnd}`, items };
}

// ---- minigames -----------------------------------------------------------------------------------------------
const MC = 'games/constants/MinigameConstant.java';
const constants = findAll(MC, /^\s+([A-Z_0-9]+)\((.+?),\s*"([^"]+)"((?:,\s*"[^"]+")+)\)[,;]?\s*$/).map(({ m, src }) => {
  const cls = /(\w+)::new|new (\w+)\(/.exec(m[2]);
  return { constant: m[1], name: m[3], aliases: [...m[4].matchAll(/"([^"]+)"/g)].map((a) => a[1]), cls: cls?.[1] ?? cls?.[2], src };
});
if (constants.length < 1) errors.push(`${MC}: no minigames found`);
// Game classes live in games/logic/ or a subfolder of it (games/logic/skywars/SkyWars.java).
const logicFiles = new Map();
(function walk(dir) {
  for (const e of readdirSync(PKG + dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${dir}/${e.name}`);
    else if (e.name.endsWith('.java')) logicFiles.set(e.name.slice(0, -5), logicFiles.has(e.name.slice(0, -5)) ? null : `${dir}/${e.name}`);
  }
})('games/logic');
for (const c of constants) {
  const file = logicFiles.get(c.cls) ?? `games/logic/${c.cls}.java`;
  if (logicFiles.get(c.cls) === null) errors.push(`games/logic: more than one ${c.cls}.java`);
  // Either `new XTokenFormula(args)` or, for the score range games, the factory `XTokenFormula.formula(args)`.
  const f = findAll(file, /(?:new (\w+TokenFormula)|\b(\w+TokenFormula)\.formula)\((.*)\);/).map(({ m, src }) => ({ m: [m[0], m[1] ?? m[2], m[3]], src }))[0];
  c.formula = f ? { cls: f.m[1], args: f.m[2].trim(), src: f.src, file: `games/tokenformula/${f.m[1]}.java` } : null;
  // A game whose class never mentions a TokenFormula pays no tokens (Mob Arena in the Lumares code); anything else is a moved pattern.
  if (!f && (lines(file) ?? []).some((l) => /TokenFormula/.test(l))) errors.push(`${file}: no token formula found for ${c.constant}`);
  else if (!f && !lines(file)) errors.push(`${file} not found for ${c.constant}`);
  else if (f && !lines(c.formula.file)) errors.push(`${c.formula.file} not found`);
}

// ---- hand-written guides -------------------------------------------------------------------------------------
const LISTS = ['howToPlay', 'scoring', 'tokens', 'numbers', 'tips', 'quirks', 'config'];
const FIELDS = ['key', 'constant', 'name', 'summary', 'tokenLine', 'storyboard', ...LISTS];
/** Every ref in a guide line's src ("games/logic/X.java:12, other.java:3-8") must name a real span of a real file. */
function checkSrc(where, src) {
  if (typeof src !== 'string' || !src.trim()) { errors.push(`${where}: missing src`); return; }
  for (const ref of src.split(/,\s*/)) {
    const r = /^([\w/.-]+\.(?:kt|java)):(\d+)(?:-(\d+))?$/.exec(ref.trim());
    if (!r) { errors.push(`${where}: src "${ref}" must look like games/logic/X.java:12 or :12-30`); continue; }
    const ls = lines(r[1]);
    if (!ls) errors.push(`${where}: src file not found: ${r[1]}`);
    else if (Number(r[2]) < 1 || Number(r[3] ?? r[2]) > ls.length || Number(r[3] ?? r[2]) < Number(r[2])) errors.push(`${where}: ${ref} is outside the file (${ls.length} lines)`);
  }
}
/** storyboard: { values: { name: number }, beats: [3 x { caption, sub, src }] }, read by src/tabs/event/storyboard. */
function checkStoryboard(at, sb) {
  const where = `${at} storyboard`;
  if (!sb || typeof sb !== 'object' || Array.isArray(sb)) { errors.push(`${where}: must be an object`); return; }
  for (const k of Object.keys(sb)) if (!['values', 'beats'].includes(k)) errors.push(`${where}: unknown field "${k}"`);
  if (!sb.values || typeof sb.values !== 'object' || Array.isArray(sb.values)) errors.push(`${where}: values must be an object`);
  else for (const [k, v] of Object.entries(sb.values)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(k)) errors.push(`${where}: value name "${k}" must be camelCase`);
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${where}: value "${k}" must be a number`);
  }
  if (!Array.isArray(sb.beats) || sb.beats.length !== 3) { errors.push(`${where}: needs exactly 3 beats`); return; }
  for (const [m, b] of sb.beats.entries()) {
    const w = `${where} beats[${m}]`;
    for (const k of Object.keys(b)) if (!['caption', 'sub', 'src'].includes(k)) errors.push(`${w}: unknown field "${k}"`);
    if (typeof b.caption !== 'string' || !b.caption.trim() || b.caption.length > 40) errors.push(`${w}: caption must be 1 to 40 characters`);
    if (typeof b.sub !== 'string' || !b.sub.trim() || b.sub.length > 110) errors.push(`${w}: sub must be 1 to 110 characters`);
    if (/[–—]/.test(`${b.caption}${b.sub}`)) errors.push(`${w}: uses an en/em dash`);
    checkSrc(w, b.src);
  }
}
const guides = new Map();
const gdir = root('data/event/minigames');
for (const f of existsSync(gdir) ? readdirSync(gdir).filter((f) => f.endsWith('.json')).sort() : []) {
  let data;
  try { data = JSON.parse(readFileSync(`${gdir}/${f}`, 'utf8')); } catch (e) { errors.push(`${f}: not valid JSON (${e.message})`); continue; }
  if (!Array.isArray(data)) { errors.push(`${f}: top level must be an array`); continue; }
  for (const [n, g] of data.entries()) {
    const at = `${f}[${n}] ${g.key ?? '?'}`;
    if (typeof g.key !== 'string' || !/^[a-z0-9-]+$/.test(g.key)) errors.push(`${at}: key must be lowercase-with-dashes`);
    if (!constants.some((c) => c.constant === g.constant)) errors.push(`${at}: unknown constant "${g.constant}"`);
    if ([...guides.values()].some((o) => o.constant === g.constant)) errors.push(`${at}: ${g.constant} already has a guide`);
    if (guides.has(g.key)) errors.push(`${at}: duplicate key`);
    if (typeof g.summary !== 'string' || g.summary.length < 20) errors.push(`${at}: summary missing or too short`);
    for (const k of Object.keys(g)) if (!FIELDS.includes(k)) errors.push(`${at}: unknown field "${k}"`);
    for (const list of LISTS) {
      if (g[list] === undefined) continue;
      if (!Array.isArray(g[list])) { errors.push(`${at}: ${list} must be an array`); continue; }
      for (const [m, e] of g[list].entries()) {
        const where = `${at} ${list}[${m}]`;
        if (list === 'numbers' ? !(e.label && e.value) : !e.text) errors.push(`${where}: needs ${list === 'numbers' ? 'label and value' : 'text'}`);
        for (const k of Object.keys(e)) if (!(list === 'numbers' ? ['label', 'value', 'src'] : ['text', 'src']).includes(k)) errors.push(`${where}: unknown field "${k}"`);
        if (/[–—]/.test(e.text ?? e.value ?? '')) errors.push(`${where}: uses an en/em dash`);
        checkSrc(where, e.src);
      }
    }
    if (g.storyboard !== undefined) checkStoryboard(at, g.storyboard);
    guides.set(g.key, g);
  }
}

// ---- hand-maintained event facts -----------------------------------------------------------------------------
const meta = JSON.parse(readFileSync(root('data/event/event.json'), 'utf8'));
delete meta._readme;
const itemIds = new Set(JSON.parse(readFileSync(root('src/data/items.json'), 'utf8')).items.map((i) => i.id));
for (const k of meta.activeGames ?? []) if (!guides.has(k)) errors.push(`event.json activeGames: no minigame guide with key "${k}"`);
meta.trickOrTreat ??= null;
if (meta.trickOrTreat) {
  const t = meta.trickOrTreat;
  if (!(t.cooldownHours > 0)) errors.push('event.json trickOrTreat.cooldownHours: must be a positive number of hours');
  if (!t.reward) errors.push('event.json trickOrTreat.reward: say what it gives');
}
meta.newGames ??= [];
for (const [i, n] of meta.newGames.entries()) {
  if (!n?.name?.trim() || !n.summary?.trim()) errors.push(`event.json newGames[${i}]: needs a name and a summary`);
  else if ([...guides.values()].some((g) => g.name.toLowerCase() === n.name.toLowerCase())) errors.push(`event.json newGames: "${n.name}" already has a guide, put its key in activeGames`);
}
for (const [i, s] of (meta.shop?.items ?? []).entries()) {
  if (!s.name) errors.push(`event.json shop.items[${i}]: needs a name`);
  if (!Number.isInteger(s.cost) || s.cost < 0) errors.push(`event.json shop.items[${i}]: cost must be a whole number`);
  if (s.itemId && !itemIds.has(s.itemId)) errors.push(`event.json shop.items[${i}]: unknown item id "${s.itemId}"`);
}
for (const id of [meta.token?.itemId, meta.charmItemId]) if (id && !itemIds.has(id)) errors.push(`event.json: unknown item id "${id}"`);

if (errors.length) {
  console.error(`${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

const missing = constants.filter((c) => ![...guides.values()].some((g) => g.constant === c.constant)).map((c) => c.constant);
const commit = readFileSync(root('data/luma-events.commit'), 'utf8').trim();
const out = {
  commit,
  meta,
  tokens: {
    types: types.map(({ name, key, src }) => ({ name, key, src })),
    multiplier: { default: Number(mult.m[1]), src: mult.src, roundingSrc: ceil.src },
    cap: { value: Number(cap.m[1]), src: cap.src, messageSrc: capMsg.src },
  },
  jobs: {
    bound: num(bound.m[1]), boundSrc: bound.src, rollSrc: roll.src,
    treeFellerFactor: Number(tf.m[1]), treeFellerSrc: tf.src, tntSrc: tnt.src,
    tokensPerDrop: Number(jobGive.m[1]), tokensPerDropSrc: jobGive.src,
    onByDefault: jobsOn.m[1] === 'true', onSrc: jobsOn.src,
    list: jobList,
  },
  townInvite: {
    minPlaytimeMinutes: Number(tMin.m[1]), maxPlaytimeHours: Number(tMax.m[1]), cooldownMinutes: Number(tCd.m[1]),
    rewardMin: Number(tLo.m[1]), rewardMax: Number(tHi.m[1]), onByDefault: tOn.m[1] === 'true', onSrc: tOn.src,
    src: `${TJ}:${tMin.line}-${tHi.line}`,
  },
  schedule: {
    autoByDefault: autoOn.m[1] === 'true', autoSrc: autoOn.src,
    cooldownMinutes: Number(cd.m[1]) / 60000, cooldownSrc: cd.src,
    countdownSeconds: Number(countdown.m[1]), countdownSrc: countdown.src,
    rotationSrc: rotation.src, defaultRotation, defaultRotationSrc: rotStart.src,
  },
  commands: {
    root: rootCmd.m[1], aliases: [...aliases.m[1].matchAll(/"([^"]+)"/g)].map((a) => a[1]), src: span(rootCmd, aliases),
    player: playerCommands,
  },
  charm: { itemId: charm.m[1], src: charm.src, requirementSrc: charmNeed.src },
  candy,
  minigames: constants.map((c) => {
    const g = [...guides.values()].find((x) => x.constant === c.constant);
    return { key: g?.key ?? c.constant.toLowerCase().replace(/_/g, '-'), constant: c.constant, name: c.name, aliases: c.aliases, src: c.src, formula: c.formula, guide: g ?? null };
  }),
};

if (!CHECK) {
  writeFileSync(root('src/data/event.json'), JSON.stringify(out, null, 1) + '\n');
  // The nav only needs the switch; importing event.json in App would pull all of it into the main bundle.
  // The nav only needs these, so it doesn't pull the whole event data into the main bundle.
writeFileSync(root('src/data/event-live.json'), JSON.stringify({ live: meta.live, listed: Boolean(meta.listed || meta.live), name: meta.name }) + '\n');
  console.log('wrote src/data/event.json, src/data/event-live.json');
}
console.log(`ok: luma-events @ ${commit.slice(0, 7)}, ${jobList.length} jobs, ${constants.length} minigames, ${guides.size} guide(s)${missing.length ? `, no guide yet: ${missing.join(', ')}` : ''}`);
