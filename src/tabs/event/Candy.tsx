import type { CandyEffect, EventCandy } from '../../data/types';
import { Src } from './common';

const ROMAN = ['', '', ' II', ' III', ' IV', ' V'];

/** FIRE_RESISTANCE -> "Fire Resistance" */
const potionName = (type: string) => type.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** 0.2 -> "20%", 0.07 -> "7%", 0.125 -> "12.5%" */
export const chancePct = (p: number) => `${Math.round(p * 1000) / 10}%`;

/**
 * What one effect does, in words. Potion effects read as "Speed II 25 s". A candy with any effect that isn't just
 * potions (the Surprise Egg) shows each effect's chat message instead, so a launch or a summon isn't hidden.
 */
export function effectText(e: CandyEffect, useMessage: boolean): string {
  if (useMessage || !e.potions.length) return `"${e.message}"`;
  return e.potions.map((p) => `${potionName(p.type)}${ROMAN[p.level] ?? ` ${p.level}`} ${p.seconds} s`).join(' + ');
}

/** Chance that eating this candy does nothing: whatever the Soul Orb roll and its own effects leave over. */
export const nothingChance = (candy: EventCandy, effects: CandyEffect[]) =>
  Math.max(0, 1 - candy.soulOrbChance - effects.reduce((a, e) => a + e.chance, 0));

export function CandyTable({ candy }: { candy: EventCandy }) {
  return (
    <>
      <p class="explain-line">
        Each candy you eat rolls once: <b>{chancePct(candy.soulOrbChance)}</b> for 1 Soul Orb, then the candy's own effects below, and otherwise nothing.
        {' '}<Src src={candy.rollSrc}>source</Src>
        {' '}On Bedrock, right click a candy to eat it. <Src src={candy.bedrockSrc}>source</Src>
      </p>
      <div class="odds-table" role="table" aria-label="What each candy does">
        <div class="odds-row candy-row head" role="row">
          <span role="columnheader">Candy</span><span role="columnheader">Besides the Soul Orb</span><span role="columnheader" class="r">Nothing</span>
        </div>
        {candy.items.map((c) => {
          const useMessage = c.effects.some((e) => !e.potions.length);
          return (
            <div class="odds-row candy-row" role="row" key={c.key}>
              <span role="cell"><Src src={c.src}><b>{c.name}</b></Src></span>
              <span role="cell" class="soft">
                {c.effects.map((e, i) => <span class="candy-effect" key={i}>{chancePct(e.chance)} {effectText(e, useMessage)}</span>)}
              </span>
              <span role="cell" class="r">{chancePct(nothingChance(candy, c.effects))}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
