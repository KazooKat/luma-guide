// A deliberately small Kotlin reader for LumaItems item definitions: enough to lex a source file and evaluate
// the constant expressions passed to ItemFactory builders (strings with templates, lists, maps, `a to b`,
// enum references, same-file vals). Anything outside that subset throws Unresolved so the caller can fall back
// to a hand-checked override instead of guessing.

export class Unresolved extends Error {}

const PUNCT = ['?.', '!!', '::', '->', '==', '!=', '<=', '>=', '&&', '||', '+=', '..', '(', ')', '[', ']', '{', '}', ',', '.', ':', ';', '=', '+', '-', '*', '/', '%', '<', '>', '!', '?', '@', '&', '|'];

/** Tokens: {t:'id'|'num'|'str'|'char'|'p', v, parts?, nl (newline before), pos}. Comments are dropped. */
export function lex(src, start = 0, stopAtBrace = false) {
  const out = [];
  let i = start;
  let nl = false;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { nl = true; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) {
      let d = 0;
      do {
        if (src.startsWith('/*', i)) { d++; i += 2; } else if (src.startsWith('*/', i)) { d--; i += 2; } else i++;
      } while (d > 0 && i < src.length);
      continue;
    }
    const pos = i;
    if (c === '"') {
      const raw = src.startsWith('"""', i);
      const { parts, end } = lexString(src, i + (raw ? 3 : 1), raw);
      out.push({ t: 'str', parts, nl, pos });
      i = end;
    } else if (c === "'") {
      let j = i + 1;
      let v = src[j];
      if (v === '\\') { v = unescape(src[j + 1]); j++; }
      out.push({ t: 'char', v, nl, pos });
      i = j + 2;
    } else if (/[0-9]/.test(c)) {
      const m = /^(0x[0-9a-fA-F_]+|[0-9][0-9_]*(\.[0-9]+)?([eE][+-]?[0-9]+)?)[fFLuU]*/.exec(src.slice(i, i + 40));
      out.push({ t: 'num', v: Number(m[1].replace(/_/g, '')), nl, pos });
      i += m[0].length;
    } else if (/[A-Za-z_`]/.test(c)) {
      let m;
      if (c === '`') { const e = src.indexOf('`', i + 1); m = [src.slice(i, e + 1)]; out.push({ t: 'id', v: m[0].slice(1, -1), nl, pos }); }
      else { m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 200)); out.push({ t: 'id', v: m[0], nl, pos }); }
      i += m[0].length;
    } else {
      const p = PUNCT.find((q) => src.startsWith(q, i));
      if (!p) throw new Error(`lex: unexpected ${JSON.stringify(c)} at ${i}`);
      if (stopAtBrace) {
        if (p === '{') depth++;
        if (p === '}') { if (depth === 0) return { tokens: out, end: i + 1 }; depth--; }
      }
      out.push({ t: 'p', v: p, nl, pos });
      i += p.length;
    }
    nl = false;
  }
  if (stopAtBrace) throw new Error('lex: unterminated ${...}');
  return out;
}

function unescape(ch) {
  return { n: '\n', t: '\t', r: '\r', b: '\b', '"': '"', "'": "'", '\\': '\\', $: '$' }[ch] ?? ch;
}

function lexString(src, i, raw) {
  const parts = [];
  let lit = '';
  for (;;) {
    if (i >= src.length) throw new Error('lex: unterminated string');
    if (raw ? src.startsWith('"""', i) : src[i] === '"') {
      let end = i + (raw ? 3 : 1);
      if (raw) while (src[end] === '"') { lit += '"'; end++; }
      if (lit) parts.push(lit);
      return { parts, end };
    }
    const c = src[i];
    if (!raw && c === '\\') {
      if (src[i + 1] === 'u') { lit += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)); i += 6; }
      else { lit += unescape(src[i + 1]); i += 2; }
    } else if (c === '$' && src[i + 1] === '{') {
      if (lit) { parts.push(lit); lit = ''; }
      const { tokens, end } = lex(src, i + 2, true);
      parts.push({ expr: tokens });
      i = end;
    } else if (c === '$' && /[A-Za-z_]/.test(src[i + 1] ?? '')) {
      if (lit) { parts.push(lit); lit = ''; }
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i + 1));
      parts.push({ expr: [{ t: 'id', v: m[0], nl: false, pos: i + 1 }] });
      i += 1 + m[0].length;
    } else {
      lit += c;
      i++;
    }
  }
}

/** Index of the token closing the bracket opened at `open` (tokens[open] is '(' '[' or '{'). */
export function matchClose(tokens, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const want = pairs[tokens[open].v];
  let d = 0;
  for (let k = open; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.t !== 'p') continue;
    if (t.v in pairs) d++;
    else if (t.v === ')' || t.v === ']' || t.v === '}') { d--; if (d === 0) { if (t.v !== want) throw new Error('bracket mismatch'); return k; } }
  }
  throw new Error('unclosed bracket');
}

/** Split tokens[from..to) on top-level commas. */
export function splitArgs(tokens, from, to) {
  const args = [];
  let cur = from;
  let d = 0;
  for (let k = from; k < to; k++) {
    const t = tokens[k];
    if (t.t !== 'p') continue;
    if (t.v === '(' || t.v === '[' || t.v === '{') d++;
    else if (t.v === ')' || t.v === ']' || t.v === '}') d--;
    else if (t.v === ',' && d === 0) { args.push(tokens.slice(cur, k)); cur = k + 1; }
  }
  if (cur < to) args.push(tokens.slice(cur, to));
  return args;
}

const LIST_FNS = new Set(['listOf', 'mutableListOf', 'arrayListOf', 'arrayOf', 'setOf', 'mutableSetOf', 'listOfNotNull']);
const MAP_FNS = new Set(['mapOf', 'mutableMapOf', 'hashMapOf', 'linkedMapOf']);
const IDENTITY_METHODS = new Set(['toMutableList', 'toList', 'toTypedArray', 'toMutableMap', 'toMap', 'toString', 'trimIndent']);

/**
 * Evaluate one expression. `env.lookup(name)` resolves bare identifiers (same-file vals);
 * `env.enumRef(owner, member)` resolves `Owner.MEMBER`; `env.call(name, args)` may resolve other calls.
 */
export function evaluate(tokens, env) {
  if (tokens[0]?.t === 'id' && tokens[1]?.t === 'p' && tokens[1].v === '=') tokens = tokens.slice(2); // named argument
  const p = { tokens, k: 0 };
  const v = parseInfix(p, env);
  if (p.k !== tokens.length) throw new Unresolved(`unparsed tail: ${show(tokens.slice(p.k))}`);
  return v;
}

export function show(tokens) {
  return tokens.map((t) => (t.t === 'str' ? JSON.stringify(t.parts.map((x) => (typeof x === 'string' ? x : '${…}')).join('')) : t.v)).join(' ').slice(0, 160);
}

function parseInfix(p, env) {
  let left = parsePostfix(p, env);
  for (;;) {
    const t = p.tokens[p.k];
    if (!t || t.nl) return left;
    if (t.t === 'id' && t.v === 'to') { p.k++; left = { pair: [left, parsePostfix(p, env)] }; continue; }
    if (t.t === 'p' && t.v === '+') {
      p.k++;
      const right = parsePostfix(p, env);
      if (Array.isArray(left) && Array.isArray(right)) left = [...left, ...right];
      else if (typeof left === 'string' || typeof right === 'string') left = String(left) + String(right);
      else if (typeof left === 'number' && typeof right === 'number') left = left + right;
      else throw new Unresolved('unsupported +');
      continue;
    }
    if (t.t === 'p' && t.v === '?' ) throw new Unresolved('conditional expression');
    return left;
  }
}

function parsePostfix(p, env) {
  let v = parsePrimary(p, env);
  for (;;) {
    const t = p.tokens[p.k];
    if (!t) return v;
    if (t.t === 'p' && t.v === '!!') { p.k++; continue; }
    if (t.t === 'p' && (t.v === '.' || t.v === '?.')) {
      const name = p.tokens[p.k + 1];
      if (!name || name.t !== 'id') throw new Unresolved('bad member access');
      const next = p.tokens[p.k + 2];
      if (next && next.t === 'p' && next.v === '(') {
        const close = matchClose(p.tokens, p.k + 2);
        const args = splitArgs(p.tokens, p.k + 3, close).map((a) => evaluate(a, env));
        p.k = close + 1;
        v = method(v, name.v, args, env);
      } else {
        p.k += 2;
        v = member(v, name.v, env);
      }
      continue;
    }
    return v;
  }
}

function member(v, name, env) {
  if (v && v.ns) return env.enumRef(v.ns, name);
  if (typeof v === 'string' && name === 'key') return v; // NamespacedKey.key: keys are kept as their string
  throw new Unresolved(`member .${name}`);
}

function method(v, name, args, env) {
  if (IDENTITY_METHODS.has(name)) return v;
  if (v && v.tier && name === 'alt' && args.length === 0) return { ...v, mini: v.alt ?? v.mini, isAlt: true };
  if (typeof v === 'string' && name === 'astralColor') return `<#AC87FB>${v}</#AC87FB>`;
  if (typeof v === 'string' && name === 'namespacedKey' && args.length === 0) return v; // String.namespacedKey()
  if (typeof v === 'string' && name === 'uppercase') return v.toUpperCase();
  if (typeof v === 'string' && name === 'lowercase') return v.toLowerCase();
  if (v && v.ns && env.call) return env.call(`${v.ns}.${name}`, args);
  throw new Unresolved(`method .${name}()`);
}

function parsePrimary(p, env) {
  const t = p.tokens[p.k];
  if (!t) throw new Unresolved('unexpected end');
  if (t.t === 'str') {
    p.k++;
    return t.parts.map((part) => {
      if (typeof part === 'string') return part;
      const r = evaluate(part.expr, env);
      if (typeof r !== 'string' && typeof r !== 'number') throw new Unresolved('non-string template');
      return String(r);
    }).join('');
  }
  if (t.t === 'num') { p.k++; return t.v; }
  if (t.t === 'char') { p.k++; return t.v; }
  if (t.t === 'p' && t.v === '-' && p.tokens[p.k + 1]?.t === 'num') { p.k += 2; return -p.tokens[p.k - 1].v; }
  if (t.t === 'p' && t.v === '(') {
    const close = matchClose(p.tokens, p.k);
    const v = evaluate(p.tokens.slice(p.k + 1, close), env);
    p.k = close + 1;
    return v;
  }
  if (t.t === 'id') {
    if (t.v === 'true' || t.v === 'false') { p.k++; return t.v === 'true'; }
    if (t.v === 'null') { p.k++; return null; }
    const next = p.tokens[p.k + 1];
    if (next && next.t === 'p' && next.v === '(' && !next.nl) {
      const close = matchClose(p.tokens, p.k + 1);
      const argToks = splitArgs(p.tokens, p.k + 2, close);
      p.k = close + 1;
      if (LIST_FNS.has(t.v)) return argToks.map((a) => evaluate(a, env));
      if (MAP_FNS.has(t.v)) return argToks.map((a) => evaluate(a, env));
      if (t.v === 'Pair') { const [a, b] = argToks.map((x) => evaluate(x, env)); return { pair: [a, b] }; }
      if (env.call) return env.call(t.v, argToks.map((a) => evaluate(a, env)));
      throw new Unresolved(`call ${t.v}()`);
    }
    p.k++;
    if (/^[A-Z]/.test(t.v) && next && next.t === 'p' && next.v === '.') return { ns: t.v };
    return env.lookup(t.v);
  }
  throw new Unresolved(`unexpected token ${t.v}`);
}

/**
 * Same-file `val`/`const val`/`var` declarations and single-expression `fun name(a: T) = expr` helpers:
 * name -> [{ pos, tokens, params? }] (initializer/body tokens).
 */
export function collectVals(tokens) {
  const vals = new Map();
  const add = (name, entry) => { if (!vals.has(name)) vals.set(name, []); vals.get(name).push(entry); };
  for (let k = 0; k < tokens.length - 2; k++) {
    const t = tokens[k];
    if (t.t === 'id' && t.v === 'fun' && tokens[k + 1].t === 'id' && tokens[k + 2].v === '(') {
      const close = matchClose(tokens, k + 2);
      let j = close + 1;
      if (tokens[j]?.v === ':') while (j < tokens.length && tokens[j].v !== '=' && tokens[j].v !== '{') j++;
      if (tokens[j]?.v !== '=') continue;
      const params = splitArgs(tokens, k + 3, close).map((a) => a[0].v);
      add(tokens[k + 1].v, { pos: k, tokens: tokens.slice(j + 1, exprEnd(tokens, j + 1)), params });
      continue;
    }
    if (t.t !== 'id' || (t.v !== 'val' && t.v !== 'var')) continue;
    const name = tokens[k + 1];
    if (name.t !== 'id') continue;
    let j = k + 2;
    if (tokens[j]?.v === ':') { // skip a type annotation up to '='
      let d = 0;
      while (j < tokens.length) {
        const x = tokens[j];
        if (x.v === '<' || x.v === '(') d++;
        if (x.v === '>' || x.v === ')') d--;
        if (d === 0 && x.v === '=') break;
        if (d === 0 && x.nl && j > k + 3) break;
        j++;
      }
    }
    if (tokens[j]?.v !== '=') continue;
    const end = exprEnd(tokens, j + 1);
    add(name.v, { pos: k, tokens: tokens.slice(j + 1, end) });
  }
  return vals;
}

/** End index of the expression starting at `from`: stops at a newline that doesn't continue the expression. */
export function exprEnd(tokens, from) {
  let d = 0;
  let k = from;
  for (; k < tokens.length; k++) {
    const t = tokens[k];
    if (k > from && d === 0 && t.nl) {
      const continues = t.t === 'p' && (t.v === '.' || t.v === '?.' || t.v === '+');
      const prev = tokens[k - 1];
      const prevOpen = prev.t === 'p' && (prev.v === '+' || prev.v === ',' || prev.v === '=');
      if (!continues && !prevOpen) break;
    }
    if (t.t !== 'p') continue;
    if (t.v === '(' || t.v === '[' || t.v === '{') d++;
    else if (t.v === ')' || t.v === ']' || t.v === '}') { if (d === 0) break; d--; }
    else if (d === 0 && t.v === ';') break;
  }
  return k;
}
