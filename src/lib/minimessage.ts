// A MiniMessage subset, enough for LumaItems tooltips: hex and named colours, color:, gradient, decorations,
// reset and closing tags, `\<` escapes. Unknown tags stay as literal text, as MiniMessage does.
// Items are built with Text.mmNoItalic, so italics are off unless a tag turns them on.

export type Span = {
  text: string;
  color: string | null;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
};

export const NAMED: Record<string, string> = {
  black: '#000000', dark_blue: '#0000AA', dark_green: '#00AA00', dark_aqua: '#00AAAA', dark_red: '#AA0000',
  dark_purple: '#AA00AA', gold: '#FFAA00', gray: '#AAAAAA', grey: '#AAAAAA', dark_gray: '#555555', dark_grey: '#555555',
  blue: '#5555FF', green: '#55FF55', aqua: '#55FFFF', red: '#FF5555', light_purple: '#FF55FF', yellow: '#FFFF55', white: '#FFFFFF',
};

const DECO: Record<string, keyof Span> = {
  bold: 'bold', b: 'bold', italic: 'italic', i: 'italic', em: 'italic', underlined: 'underlined', u: 'underlined',
  strikethrough: 'strikethrough', st: 'strikethrough', obfuscated: 'obfuscated', obf: 'obfuscated',
};

type Frame =
  | { kind: 'color'; name: string; color: string }
  | { kind: 'deco'; name: string; deco: keyof Span; on: boolean }
  | { kind: 'gradient'; name: string; colors: string[]; phase: number; spans: Span[] };

function parseColor(s: string): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  return NAMED[s.toLowerCase()] ?? null;
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Adventure's TextColor.lerp, per channel. */
export function lerp(t: number, a: string, b: string): string {
  const [x, y] = [hex(a), hex(b)];
  return toHex(x.map((v, i) => Math.round(v + t * (y[i] - v))));
}

/** Colour of each of `size` characters across a gradient (Adventure GradientTag). */
export function gradientColors(colors: string[], size: number, phase = 0): string[] {
  if (colors.length === 1 || size === 0) return Array(size).fill(colors[0]);
  const multiplier = size === 1 ? 0 : (colors.length - 1) / (size - 1);
  const out: string[] = [];
  for (let i = 0; i < size; i++) {
    const pos = i * multiplier + phase * (colors.length - 1);
    const low = Math.min(Math.floor(pos), colors.length - 1);
    const high = Math.min(low + 1, colors.length - 1);
    out.push(lerp(pos - Math.floor(pos), colors[low], colors[high]));
  }
  return out;
}

/** Tag body -> frame, or null if it isn't a tag we know (then it is kept as text). */
function openFrame(body: string): Frame | null {
  const [name, ...args] = body.split(':');
  const lower = name.toLowerCase();
  const direct = parseColor(name);
  if (direct) return { kind: 'color', name: name.startsWith('#') ? name.toUpperCase() : lower, color: direct };
  if ((lower === 'color' || lower === 'colour' || lower === 'c') && args[0]) {
    const c = parseColor(args[0]);
    return c ? { kind: 'color', name: lower, color: c } : null;
  }
  if (lower in DECO) return { kind: 'deco', name: lower, deco: DECO[lower], on: args[0] !== 'false' };
  if (lower.startsWith('!') && lower.slice(1) in DECO) return { kind: 'deco', name: lower.slice(1), deco: DECO[lower.slice(1)], on: false };
  if (lower === 'gradient') {
    const colors: string[] = [];
    let phase = 0;
    for (const a of args) {
      const c = parseColor(a);
      if (c) colors.push(c);
      else if (/^-?\d*\.?\d+$/.test(a)) phase = Number(a);
      else return null;
    }
    if (colors.length === 0) colors.push('#FFFFFF', '#000000');
    if (colors.length === 1) colors.push(colors[0]);
    return { kind: 'gradient', name: lower, colors, phase, spans: [] };
  }
  if (lower === 'rainbow') {
    return { kind: 'gradient', name: lower, colors: ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'], phase: 0, spans: [] };
  }
  return null;
}

const sameName = (f: Frame, name: string) => {
  const lower = name.toLowerCase();
  if (f.name.toLowerCase() === lower) return true;
  if (f.kind === 'deco' && DECO[lower] === f.deco) return true;
  if (f.kind === 'color' && (lower === 'color' || lower === 'colour' || lower === 'c')) return true;
  return false;
};

/** Parse one MiniMessage line into styled spans. `base` is the style applied where no tag sets one. */
export function parseMini(input: string, base: Partial<Span> = {}): Span[] {
  const out: Span[] = [];
  const stack: Frame[] = [];

  const style = (): Omit<Span, 'text'> => {
    const s: Omit<Span, 'text'> = { color: base.color ?? null, bold: base.bold, italic: base.italic ?? false, underlined: base.underlined, strikethrough: base.strikethrough, obfuscated: base.obfuscated };
    for (const f of stack) {
      if (f.kind === 'color') s.color = f.color;
      else if (f.kind === 'deco') (s as Record<string, unknown>)[f.deco] = f.on;
    }
    return s;
  };
  const gradientIndex = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === 'gradient') return i;
    return -1;
  };
  const emit = (text: string) => {
    if (!text) return;
    const g = gradientIndex();
    const span = { text, ...style() };
    if (g >= 0) {
      // an explicit colour opened inside the gradient wins over it
      const innerColor = stack.slice(g + 1).some((f) => f.kind === 'color');
      (stack[g] as Extract<Frame, { kind: 'gradient' }>).spans.push(innerColor ? span :{ ...span, color: '\u0000' });
    } else out.push(span);
  };
  const closeFrame = (f: Frame) => {
    if (f.kind !== 'gradient') return;
    const chars = f.spans.filter((s) => s.color === '\u0000').reduce((n, s) => n + [...s.text].length, 0);
    const colors = gradientColors(f.colors, chars, f.phase);
    let ci = 0;
    const done: Span[] = [];
    for (const s of f.spans) {
      if (s.color !== '\u0000') { done.push(s); continue; }
      for (const ch of s.text) done.push({ ...s, text: ch, color: colors[ci++] });
    }
    const g = gradientIndex();
    if (g >= 0) (stack[g] as Extract<Frame, { kind: 'gradient' }>).spans.push(...done);
    else out.push(...done);
  };
  const popTo = (idx: number) => {
    while (stack.length > idx) closeFrame(stack.pop()!);
  };

  let text = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\' && (input[i + 1] === '<' || input[i + 1] === '\\')) { text += input[i + 1]; i++; continue; }
    if (ch !== '<') { text += ch; continue; }
    const end = input.indexOf('>', i);
    if (end < 0) { text += ch; continue; }
    const body = input.slice(i + 1, end);
    if (body.startsWith('/')) {
      const name = body.slice(1).split(':')[0];
      let idx = -1;
      for (let k = stack.length - 1; k >= 0; k--) if (sameName(stack[k], name)) { idx = k; break; }
      if (idx < 0 && name !== '') { text += input.slice(i, end + 1); i = end; continue; }
      emit(text); text = '';
      if (idx >= 0) popTo(idx);
      i = end;
      continue;
    }
    if (body.toLowerCase() === 'reset') { emit(text); text = ''; popTo(0); i = end; continue; }
    const frame = openFrame(body);
    if (!frame) { text += input.slice(i, end + 1); i = end; continue; }
    emit(text); text = '';
    stack.push(frame);
    i = end;
  }
  emit(text);
  popTo(0);
  return merge(out);
}

/** Join neighbouring spans that ended up with identical style. */
function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    if (prev && prev.color === s.color && !!prev.bold === !!s.bold && !!prev.italic === !!s.italic && !!prev.underlined === !!s.underlined
      && !!prev.strikethrough === !!s.strikethrough && !!prev.obfuscated === !!s.obfuscated) prev.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** Plain text of a MiniMessage string. */
export function plain(input: string): string {
  return parseMini(input).map((s) => s.text).join('');
}

/** Minecraft's text shadow: the colour at 25% brightness. */
export function shadowOf(color: string): string {
  return toHex(hex(color).map((v) => Math.floor(v / 4)));
}
