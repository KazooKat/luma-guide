import { describe, expect, it } from 'vitest';
import { gradientColors, lerp, parseMini, plain, shadowOf } from './minimessage';

describe('parseMini', () => {
  it('applies hex and named colours with closing tags', () => {
    expect(parseMini('<#CDB4DB>Blessing</#CDB4DB> and <gray>more')).toEqual([
      { text: 'Blessing', color: '#CDB4DB', bold: undefined, italic: false, underlined: undefined, strikethrough: undefined, obfuscated: undefined },
      { text: ' and ', color: null, bold: undefined, italic: false, underlined: undefined, strikethrough: undefined, obfuscated: undefined },
      { text: 'more', color: '#AAAAAA', bold: undefined, italic: false, underlined: undefined, strikethrough: undefined, obfuscated: undefined },
    ]);
  });

  it('uses the base colour where no tag sets one (lore defaults to white)', () => {
    expect(parseMini('plain', { color: '#FFFFFF' })[0].color).toBe('#FFFFFF');
  });

  it('keeps italics off unless asked, and stacks decorations', () => {
    const [s] = parseMini('<b><st>x</st></b>');
    expect(s).toMatchObject({ text: 'x', bold: true, strikethrough: true, italic: false });
    expect(parseMini('<i>y')[0].italic).toBe(true);
  });

  it('closing an outer tag closes the tags opened inside it', () => {
    const spans = parseMini('<b><red>a</b>b');
    expect(spans.map((s) => [s.text, s.color, !!s.bold])).toEqual([['a', '#FF5555', true], ['b', null, false]]);
  });

  it('interpolates gradients per character, spaces included', () => {
    const spans = parseMini('<gradient:#000000:#FFFFFF>abc</gradient>');
    expect(spans.map((s) => s.color)).toEqual(['#000000', '#808080', '#FFFFFF']);
    expect(spans.map((s) => s.text).join('')).toBe('abc');
  });

  it('runs a gradient across bold children', () => {
    const spans = parseMini('<b><gradient:#D8F3DC:#B7E4C7:#95D5B2:#A9DEF9:#CDB4DB>Kamori\'s Glasses</gradient></b>');
    expect(spans).toHaveLength(16);
    expect(spans[0]).toMatchObject({ text: 'K', color: '#D8F3DC', bold: true });
    expect(spans[15]).toMatchObject({ text: 's', color: '#CDB4DB', bold: true });
  });

  it('treats unknown tags and escapes as text', () => {
    expect(plain('<foo>bar \\<b> baz')).toBe('<foo>bar <b> baz');
  });

  it('handles reset', () => {
    const spans = parseMini('<red><b>a<reset>b');
    expect(spans[1]).toMatchObject({ text: 'b', color: null, bold: undefined });
  });
});

describe('colour helpers', () => {
  it('lerps per channel with rounding', () => {
    expect(lerp(0.5, '#000000', '#FFFFFF')).toBe('#808080');
  });
  it('gives one colour per character for multi-stop gradients', () => {
    expect(gradientColors(['#FF0000', '#00FF00', '#0000FF'], 5)).toEqual(['#FF0000', '#808000', '#00FF00', '#008080', '#0000FF']);
  });
  it('shadows at a quarter brightness', () => {
    expect(shadowOf('#FFFFFF')).toBe('#3F3F3F');
    expect(shadowOf('#AAAAAA')).toBe('#2A2A2A');
  });
});
