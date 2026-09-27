// Legacy `&` colour codes -> MiniMessage, matching what LumaItems' String.legacy() does in-game:
// Util.colorcode turns `&#rrggbb` and `&x` codes into section codes, then Adventure's legacy deserializer
// builds the component. As in vanilla, a colour code resets bold/italic/etc.; `&r` resets everything.

const NAMED = {
  0: 'black', 1: 'dark_blue', 2: 'dark_green', 3: 'dark_aqua', 4: 'dark_red', 5: 'dark_purple', 6: 'gold', 7: 'gray',
  8: 'dark_gray', 9: 'blue', a: 'green', b: 'aqua', c: 'red', d: 'light_purple', e: 'yellow', f: 'white',
};
const DECOS = { l: 'b', o: 'i', n: 'u', m: 'st', k: 'obf' };

export function legacyToMini(input) {
  const segs = [];
  let style = { color: null, decos: [] };
  let text = '';
  const flush = () => {
    if (text) segs.push({ ...style, decos: [...style.decos], text });
    text = '';
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '&' && input[i + 1] === '#' && /^[0-9a-fA-F]{6}$/.test(input.slice(i + 2, i + 8))) {
      flush();
      style = { color: `#${input.slice(i + 2, i + 8).toUpperCase()}`, decos: [] };
      i += 7;
    } else if (c === '&' && /[0-9a-fk-orA-FK-OR]/.test(input[i + 1] ?? '')) {
      const code = input[i + 1].toLowerCase();
      flush();
      if (code in NAMED) style = { color: NAMED[code], decos: [] };
      else if (code === 'r') style = { color: null, decos: [] };
      else if (!style.decos.includes(DECOS[code])) style = { ...style, decos: [...style.decos, DECOS[code]] };
      i += 1;
    } else {
      text += c;
    }
  }
  flush();
  return segs
    .map((s) => {
      const open = [s.color && `<${s.color}>`, ...s.decos.map((d) => `<${d}>`)].filter(Boolean);
      const close = [...s.decos].reverse().map((d) => `</${d}>`).concat(s.color ? [`</${s.color}>`] : []);
      return open.join('') + escapeMini(s.text) + close.join('');
    })
    .join('');
}

export function escapeMini(s) {
  return s.replace(/\\/g, '\\\\').replace(/</g, '\\<');
}
