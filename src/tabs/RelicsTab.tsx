import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SuggestButton } from '../components/SuggestButton';
import {
  astralOrbOdds, disassemblyOdds, enchantCountOdds, GRUBBY_PER_ACTION, GRUBBY_TOTAL, GRUBBY_WEIGHTS, levelRule,
  LUMAITEMS_REF, magmaticIfZero, MOB_RELIC_SPAWN, mobRelicPerKill, RARITIES, type RarityId,
} from '../lib/relics';
import { fmtInt } from '../lib/format';

const SRC = `https://github.com/LumaLibre/LumaItems/blob/${LUMAITEMS_REF}/src/main/java/dev/lumas/lumaitems`;
const RARITY = Object.fromEntries(RARITIES.map((r) => [r.id, r])) as Record<RarityId, (typeof RARITIES)[number]>;

/** 0.0106 -> "1.1%", 0.00015 -> "0.015%" */
function pct(p: number): string {
  const v = p * 100;
  if (v >= 10) return `${v.toFixed(1)}%`;
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.1) return `${v.toFixed(2)}%`;
  return `${v.toPrecision(2)}%`;
}
const oneIn = (p: number) => `1 in ${fmtInt(Math.round(1 / p))}`;

function countText(weight: number): string {
  const odds = [...enchantCountOdds(weight)];
  const counts = odds.map(([c]) => c);
  const lo = Math.min(...counts), hi = Math.max(...counts);
  if (lo === 0) return `None or 1 (50/50)`;
  return lo === hi ? `${lo}` : `${lo}–${hi}, evenly`;
}

function RarityName({ id }: { id: RarityId }) {
  const r = RARITY[id];
  return (
    <span class="rarity-name">
      <i class="swatch" style={{ background: r.color }} aria-hidden="true" />
      {r.name}
    </span>
  );
}

function Bar({ p, max }: { p: number; max: number }) {
  return (
    <span class="odds-bar" aria-hidden="true">
      <i style={{ width: `${Math.max(2, (p / max) * 100)}%` }} />
    </span>
  );
}

export function RelicsTab() {
  const [astral, setAstral] = useState(false);
  const dis = disassemblyOdds(astral);
  const disMax = dis[0].chance;
  const orb = astralOrbOdds();
  const orbMax = orb[0].chance;
  const lunarCore = dis.find((d) => d.reward.label === 'Lunar Core')!.chance;
  const shards = dis.find((d) => d.reward.label === '4 Relic Shards')!.chance;

  return (
    <>
      <section class="intro">
        <h1>Relics</h1>
        <p>
          Relics are randomly enchanted gear with a rarity. Here's where they come from, what's inside them, and what you get for
          disassembling them, all read from the plugin's source code.
        </p>
      </section>

      <section class="card" aria-label="Rarities">
        <div class="card-title"><h3>The six rarities</h3><span>rarest at the top</span></div>
        <div class="rarity-grid">
          {RARITIES.map((r) => (
            <div class="rarity-card" key={r.id} style={{ borderTopColor: r.color }}>
              <div class="rarity-head">
                <Icon id={r.icon} size={32} />
                <b style={{ color: r.color }}>{r.name}</b>
              </div>
              <dl class="kv">
                <dt>From</dt><dd>{r.source}</dd>
                <dt>Item</dt><dd>{r.items}</dd>
                {r.id !== 'astral' && (
                  <>
                    <dt>Enchants</dt><dd>{countText(r.weight)}</dd>
                    <dt>Levels</dt><dd>{levelRule(r.maxLevel)}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
        <p class="note">
          Lunar relics from a Lunar Orb or Grubby Relic can roll levels above vanilla (Sharpness VII, Protection VII…). A few enchants are capped:
          Silk Touch and Mending I, Aqua Affinity II, Depth Strider III, Fortune and Looting IV, Fire Aspect and Sweeping Edge V, Knockback VI.
        </p>
      </section>

      <section class="card" aria-label="Where relics come from">
        <div class="card-title"><h3>Where relics come from</h3></div>
        <div class="source-grid">
          <div class="source">
            <div class="source-head"><Icon id="zombie_head" size={32} /><h4>Hostile mobs</h4></div>
            <p class="big-odds">{pct(MOB_RELIC_SPAWN)}</p>
            <p>of hostile mobs spawn wearing or holding a relic (9 in 101). Look for armor or an off-hand item with a coloured name.</p>
            <ul class="facts compact">
              <li>Normal mobs: <RarityName id="pulsar" />, <RarityName id="solar" /> or <RarityName id="delta" />, a third each.</li>
              <li>Ender Dragon, Wither, Elder Guardian and Warden: same chance, but the relic is always <RarityName id="nova" />.</li>
              <li>Never in the Pale worlds.</li>
            </ul>
            <p class="note estimate">
              <b>Estimate:</b> the relic then drops like any mob equipment in vanilla (8.5%, +1% per Looting level, player kill only),
              so roughly <b>{oneIn(mobRelicPerKill(0))}</b> hostile kills, or <b>{oneIn(mobRelicPerKill(3))}</b> with Looting III.
              Luma's code doesn't change the drop chance; this part hasn't been tested in-game.
            </p>
          </div>

          <div class="source">
            <div class="source-head"><Icon id="charcoal" size={32} /><h4>Grubby Relic (jobs)</h4></div>
            <p class="big-odds">{pct(GRUBBY_PER_ACTION)}</p>
            <p>
              chance per paid job action ({oneIn(GRUBBY_PER_ACTION)}), for every job except Hunter. Right-click it to open. The
              <a href="#/jobs"> Jobs calculator</a> shows how many to expect for your plan.
            </p>
            <div class="mini-odds" role="table" aria-label="Grubby Relic contents">
              {GRUBBY_WEIGHTS.map((g) => (
                <div role="row" key={g.rarity}>
                  <span role="cell"><RarityName id={g.rarity} /></span>
                  <span role="cell" class="mono">{pct(g.weight / GRUBBY_TOTAL)}</span>
                </div>
              ))}
            </div>
          </div>

          <div class="source">
            <div class="source-head"><Icon id="ender_eye" size={32} /><h4>Orbs</h4></div>
            <p>Craft 8 <b>Relic Shards</b> around a core, then right-click the orb:</p>
            <ul class="facts compact">
              <li><Icon id="prismarine_shard" size={20} /> <b>Lunar Core</b> → Lunar Orb → a <RarityName id="lunar" /> relic (diamond gear, 3–7 enchants).</li>
              <li><Icon id="prismarine_shard" size={20} /> <b>Astral Core</b> → Astral Orb → one piece of an <a href="#/items/astral">Astral set</a> (odds below). Everyone online sees the reveal.</li>
              <li><Icon id="amethyst_cluster" size={20} /> 8 shards in a ring (empty middle) make an <b>Astral Upgrade Core</b>.</li>
            </ul>
            <p class="note">
              Shards and cores also come from disassembling, the "Farm 50,000 Potatoes" quest (6 shards), "Kill 4,000 Iron Golems" (Astral Core),
              and the 25- and 100-quest achievements (3 Lunar / 2 Astral Cores).
            </p>
          </div>
        </div>
      </section>

      <section class="card" aria-label="Disassembly">
        <div class="card-title">
          <h3>Disassembly rewards</h3>
          <span>one reward per relic</span>
        </div>
        <p class="explain-line">
          Hold a relic and right-click the <b>Disassembler</b> at spawn, then click again within 10 seconds to confirm. Every relic rarity gets the same table,
          except Astral relics, which add an Astral Core.
          {' '}<i>(The chat message tells you to left-click Astral relics, but the code only accepts right-click.)</i>
        </p>
        <div class="chips" role="group" aria-label="Relic type">
          <button class="chip" aria-pressed={!astral} onClick={() => setAstral(false)}>Any non-Astral relic</button>
          <button class="chip" aria-pressed={astral} onClick={() => setAstral(true)}>Astral relic</button>
        </div>
        <div class="odds-table" role="table" aria-label="Disassembly odds">
          <div class="odds-row head" role="row">
            <span role="columnheader">Reward</span><span role="columnheader">Chance</span><span role="columnheader" class="r">About</span>
          </div>
          {dis.map(({ reward, chance }) => (
            <div class="odds-row" role="row" key={reward.label}>
              <span role="cell" class="item-name">
                <Icon id={reward.icon} size={24} />
                <span><b>{reward.label}</b>{reward.note && <small>{reward.note}</small>}</span>
              </span>
              <span role="cell" class="odds-cell"><Bar p={chance} max={disMax} /><span class="mono">{pct(chance)}</span></span>
              <span role="cell" class="r mono muted">{oneIn(chance)}</span>
            </div>
          ))}
        </div>
        <p class="note">
          On average you get a Lunar Core every {fmtInt(Math.round(1 / lunarCore))} disassemblies, and the 8 shards an orb needs take about
          {' '}{fmtInt(Math.round(2 / shards))} (4 shards {pct(shards)} of the time).
          How it works: the plugin keeps re-drawing rewards, and each one sticks with a chance of (its number + 1) out of 101. So a bigger number means more likely, but nothing is truly 0.
        </p>
      </section>

      <section class="card" aria-label="Astral Orb odds">
        <div class="card-title"><h3>What's in an Astral Orb</h3><span>chance per set, then a random piece of that set</span></div>
        <div class="odds-table" role="table" aria-label="Astral Orb odds">
          {orb.map(({ set, chance }) => (
            <div class="odds-row" role="row" key={set}>
              <span role="cell"><a href={`#/items/astral/${set.toLowerCase()}-set`}><b>{set}</b></a>{set === 'Magmatic' && <sup>*</sup>}</span>
              <span role="cell" class="odds-cell"><Bar p={chance} max={orbMax} /><span class="mono">{pct(chance)}</span></span>
              <span role="cell" class="r mono muted">{oneIn(chance)}</span>
            </div>
          ))}
        </div>
        <p class="note">
          * Magmatic is listed twice in the default config (35 and 0). Counted as written it's {pct(orb.find((o) => o.set === 'Magmatic')!.chance)};
          if the server's config only kept the 0, it drops to {pct(magmaticIfZero())} and every other set gets about 13% more likely.
        </p>
      </section>

      <section class="card" aria-label="Good to know">
        <div class="card-title"><h3>Good to know</h3></div>
        <ul class="facts plain">
          <li>Half of all mob relics (Pulsar, Solar, Delta) roll <b>no enchantments at all</b>. The other half get exactly one, at level I.</li>
          <li>Enchantments are drawn from the full list, not just ones that fit the item, so a relic can have Sharpness on boots. Lunar rolls lean a little towards enchants that fit.</li>
          <li>A relic never gets both Silk Touch and Mending.</li>
          <li>Anvils won't combine a relic with another item (renaming still works), and relics can't be mixed.</li>
          <li>Relics can break like normal gear. The plugin has break protection for them, but it's switched off.</li>
          <li>A Delta relic can be a plain piece of <b>Leather</b>, the crafting item, because it's on Delta's item list.</li>
          <li>Relic names are a random prefix and suffix (157 × 76 combinations), coloured by rarity.</li>
        </ul>
        <p class="note">
          Source: <a href={`${SRC}/relics`} target="_blank" rel="noopener noreferrer">LumaLibre/LumaItems @ {LUMAITEMS_REF}</a> (relics, GeneralListeners, JobsListeners,
          GrubbyRelicItem, AstralOrbItem). Numbers use the plugin's default config; the live server can change the reward table and orb odds.
        </p>
      </section>

      <section class="more-card">
        <p>Spotted something different in game, or want another system covered?</p>
        <SuggestButton label="Suggest a fix or addition" outline />
      </section>
    </>
  );
}
