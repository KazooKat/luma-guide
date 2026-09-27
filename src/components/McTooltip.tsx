import type { GlossaryItem } from '../data/types';
import { parseMini, shadowOf, type Span } from '../lib/minimessage';

/** One line of Minecraft text: per-span colour with the game's 25%-brightness drop shadow. */
export function McLine({ mini, base }: { mini: string; base?: Partial<Span> }) {
  const spans = parseMini(mini, base);
  return (
    <span class="mc-line">
      {spans.length === 0 ? ' ' : spans.map((s, i) => {
        const color = s.color ?? '#FFFFFF';
        const deco = [s.underlined && 'underline', s.strikethrough && 'line-through'].filter(Boolean).join(' ');
        return (
          <span
            key={i}
            class={s.obfuscated ? 'mc-obf' : undefined}
            style={{
              color,
              textShadow: `var(--mc-px) var(--mc-px) 0 ${shadowOf(color)}`,
              fontWeight: s.bold ? 700 : 400,
              fontStyle: s.italic ? 'italic' : 'normal',
              textDecoration: deco || undefined,
            }}
          >
            {s.text}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The item's tooltip as the game draws it: name, visible vanilla enchants, then lore (tier footer included).
 * A name with no colour of its own takes the item's rarity colour: aqua once enchanted, white otherwise.
 */
export function McTooltip({ item, labelledBy }: { item: GlossaryItem; labelledBy?: string }) {
  return (
    <div class="mc-tip" role="group" aria-labelledby={labelledBy}>
      <div class="mc-title"><McLine mini={item.name} base={{ color: item.glint ? '#55FFFF' : '#FFFFFF' }} /></div>
      {item.enchants.map((l, i) => <McLine key={`e${i}`} mini={l} />)}
      {item.lore.map((l, i) => <McLine key={`l${i}`} mini={l} base={{ color: '#FFFFFF' }} />)}
    </div>
  );
}
