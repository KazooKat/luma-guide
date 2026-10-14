import type { VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import data from '../../../data/event.json';
import type { EventData, MinigameGuide } from '../../../data/types';
import { SCENE_FILES, SCENES } from './scenes';
import { BEAT_MS, beatAt, type Beat } from './Storyboard';

const EVENT = data as EventData;
const GUIDES = EVENT.minigames.flatMap((g) => (g.guide ? [g.guide] : []));

/** Every number written in a piece of text ("1,080 points", "22.5 seconds", "33%"). */
const numbersIn = (s: string) => [...s.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, '')));

/** Every number the guide's own text states, which the storyboard is allowed to use. */
function guideNumbers(g: MinigameGuide): Set<number> {
  const texts = [g.summary, g.tokenLine ?? ''];
  for (const list of [g.howToPlay, g.scoring, g.tokens, g.tips, g.quirks, g.config]) for (const l of list ?? []) texts.push(l.text ?? '');
  for (const n of g.numbers ?? []) texts.push(`${n.label ?? ''} ${n.value ?? ''}`);
  return new Set(texts.flatMap(numbersIn));
}

/** Renders a scene's tree by calling its function components, and returns every element's props. */
function flatten(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node == null || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') { out.push({ type: '#text', text: String(node) }); return out; }
  if (Array.isArray(node)) { for (const n of node) flatten(n, out); return out; }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') return flatten((v.type as (p: unknown) => unknown)(v.props), out);
  out.push({ type: v.type, ...v.props });
  flatten(v.props.children, out);
  return out;
}

describe('storyboard clock', () => {
  it('splits the loop into 3 beats', () => {
    expect(beatAt(0)).toEqual({ beat: 0, t: 0 });
    expect(beatAt(BEAT_MS * 1.5)).toEqual({ beat: 1, t: 0.5 });
    expect(beatAt(BEAT_MS * 3 + 10).beat).toBe(0);
    expect(beatAt(BEAT_MS * 3 - 1).beat).toBe(2);
  });
});

describe('every minigame has a storyboard', () => {
  it.each(GUIDES.map((g) => [g.key, g] as const))('%s has 3 beats and a scene', (key, g) => {
    expect(g.storyboard, `${key}: add a storyboard to its guide JSON`).toBeTruthy();
    expect(g.storyboard!.beats).toHaveLength(3);
    expect(SCENES[key], `${key}: add src/tabs/event/storyboard/scenes/<Game>.tsx exporting key = '${key}'`).toBeTypeOf('function');
  });

  it('every scene file is for a real guide, and no 2 files claim the same game', () => {
    const keys = Object.values(SCENE_FILES).map((m) => m.key);
    for (const [file, m] of Object.entries(SCENE_FILES)) expect(GUIDES.some((g) => g.key === m.key), `${file}: no guide with key "${m.key}"`).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('storyboards match their guides', () => {
  const withBoards = GUIDES.filter((g) => g.storyboard);
  it.each(withBoards.map((g) => [g.key, g] as const))('%s only uses numbers its guide states', (key, g) => {
    const allowed = guideNumbers(g);
    for (const [name, v] of Object.entries(g.storyboard!.values)) expect(allowed.has(v), `${key}: value ${name} = ${v} isn't stated in the guide`).toBe(true);
    for (const b of g.storyboard!.beats) {
      for (const n of numbersIn(`${b.caption} ${b.sub}`)) expect(allowed.has(n), `${key}: "${b.caption} / ${b.sub}" says ${n}, which the guide doesn't`).toBe(true);
    }
  });
});

describe('scenes draw cleanly', () => {
  const withScenes = GUIDES.filter((g) => g.storyboard && SCENES[g.key]);
  it.each(withScenes.map((g) => [g.key, g] as const))('%s draws an svg with no NaN or undefined at every beat', (key, g) => {
    const Scene = SCENES[key];
    for (const beat of [0, 1, 2] as Beat[]) {
      for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        const els = flatten(Scene({ beat, t, values: g.storyboard!.values }));
        expect(els[0]?.type, `${key}: a scene must return <Stage>`).toBe('svg');
        for (const el of els) {
          for (const [attr, val] of Object.entries(el)) {
            if (attr === 'children') continue;
            const bad = (typeof val === 'number' && !Number.isFinite(val)) || (typeof val === 'string' && /NaN|undefined|Infinity/.test(val));
            expect(bad, `${key} beat ${beat} t ${t}: <${String(el.type)} ${attr}=${String(val)}>`).toBe(false);
          }
        }
      }
    }
  });
});
