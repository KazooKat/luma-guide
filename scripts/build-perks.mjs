// Parse a local copy of LumaLibre/JobsAddons PerksFile.kt into src/data/perks.json (level + perk name only).
// The copy is not committed (upstream is CC BY-NC-ND 4.0). Fetch it with:
//   gh api "repos/LumaLibre/JobsAddons/contents/src/main/kotlin/dev/lumas/jobsaddons/configuration/PerksFile.kt" --jq .content | base64 -d > data/PerksFile.kt
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const src = readFileSync(new URL('data/PerksFile.kt', root), 'utf8');
const commit = readFileSync(new URL('data/PerksFile.commit', root), 'utf8').trim();

// Kotlin string literal (no escapes are used in this file besides \" which we tolerate).
const STR = '"((?:[^"\\\\]|\\\\.)*)"';
const blockRe = /add\(builder\(\)([\s\S]*?)\.build\(\)\)/g;
const jobRe = /\.job\(JobConstant\.(\w+)\)/;
const levelRe = /\.level\((\d+)\)/;
const perkRe = new RegExp(`\\.(permissionPerk|commandPerk)\\(\\s*${STR}\\s*,\\s*${STR}\\s*\\)`, 'g');

const plain = (mini) =>
  mini
    .replace(/<[^>]*>/g, '')
    .replace(/&#[0-9a-fA-F]{6}>?/g, '')
    .replace(/^You have unlocked the /, '')
    .replace(/^You have /, '')
    .replace(/^You got /, '')
    .replace(/ perk!$/, '')
    .replace(/!$/, '')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const perks = {};
let count = 0;
for (const [, body] of src.matchAll(blockRe)) {
  const job = body.match(jobRe)?.[1];
  const level = Number(body.match(levelRe)?.[1]);
  if (!job || !level) throw new Error(`unparsed perk block: ${body.slice(0, 120)}`);
  const name = job[0] + job.slice(1).toLowerCase();
  for (const [, kind, , message] of body.matchAll(perkRe)) {
    (perks[name] ??= []).push({ level, kind: kind === 'commandPerk' ? 'reward' : 'unlock', text: plain(message) });
    count++;
  }
}
for (const list of Object.values(perks)) list.sort((a, b) => a.level - b.level);

writeFileSync(
  new URL('src/data/perks.json', root),
  JSON.stringify({ source: `LumaLibre/JobsAddons@${commit.slice(0, 7)} PerksFile.kt`, perks }, null, 1),
);
console.log(`perks: ${count} across ${Object.keys(perks).length} jobs (JobsAddons@${commit.slice(0, 7)})`);
