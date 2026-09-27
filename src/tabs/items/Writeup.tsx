import type { JSX } from 'preact';
import type { Writeup, WriteupLine } from '../../data/types';

const SRC = 'https://github.com/LumaLibre/LumaItems/blob';

/** "items/x/File.kt:12-30" -> a GitHub link to those lines at the pinned commit. */
export function sourceLinks(src: string, commit: string) {
  return src.split(/,\s*/).map((ref) => {
    const m = /^(.+?):(\d+)(?:-(\d+))?$/.exec(ref.trim());
    if (!m) return null;
    const [, file, a, b] = m;
    const name = file.split('/').pop();
    return { href: `${SRC}/${commit.slice(0, 7)}/src/main/java/dev/lumas/lumaitems/${file}#L${a}${b ? `-L${b}` : ''}`, label: `${name} · ${a}${b ? `–${b}` : ''}` };
  }).filter((x): x is { href: string; label: string } => !!x);
}

/**
 * Footnote-style citations: `cite(src)` renders a numbered marker in reading order, and <Sources> lists them.
 * Markers are buttons (the site's routes live in the URL hash, so in-page #anchors can't be used).
 */
export function makeNotes(prefix: string) {
  const list: string[] = [];
  const cite = (src: string) => {
    list.push(src);
    const n = list.length;
    const open = () => {
      const li = document.getElementById(`${prefix}-src-${n}`);
      const details = li?.closest('details');
      if (details) details.open = true;
      li?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      li?.classList.add('flash');
      setTimeout(() => li?.classList.remove('flash'), 1600);
    };
    return <button type="button" class="cite" onClick={open} aria-label={`Source ${n}`}>[{n}]</button>;
  };
  return { list, cite, prefix };
}

export function Sources({ notes, commit }: { notes: ReturnType<typeof makeNotes>; commit: string }) {
  if (!notes.list.length) return null;
  return (
    <details class="sources">
      <summary>Sources · {notes.list.length} place{notes.list.length === 1 ? '' : 's'} in the plugin code</summary>
      <ol>
        {notes.list.map((src, i) => (
          <li key={i} id={`${notes.prefix}-src-${i + 1}`}>
            {sourceLinks(src, commit).map((l, j) => (
              <span key={l.href}>{j > 0 && ', '}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></span>
            ))}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Bullets({ lines, cite }: { lines: WriteupLine[]; cite: (src: string) => JSX.Element }) {
  return (
    <ul class="wu-bullets">
      {lines.map((l, i) => <li key={i}><span>{l.text}{cite(l.src)}</span></li>)}
    </ul>
  );
}

/** The hand-checked mechanics for an item, every line footnoted to the plugin code it comes from. */
export function WriteupView({ w, commit }: { w: Writeup; commit: string }) {
  // Citations are numbered in reading order, so each block renders (and cites) top to bottom.
  const notes = makeNotes('wu');
  const use = w.use?.length ? (
    <div class="wu-block">
      <h3>How to use it</h3>
      <ol class="wu-steps">
        {w.use.map((l, i) => <li key={i}><span class="step-num" aria-hidden="true">{i + 1}</span><span>{l.text}{notes.cite(l.src)}</span></li>)}
      </ol>
    </div>
  ) : null;
  const numbers = w.numbers?.length ? (
    <div class="wu-block">
      <h3>Numbers</h3>
      <div class="stat-grid">
        {w.numbers.map((n, i) => (
          <div class="stat" key={i}>
            <span class="stat-label">{n.label}</span>
            <span class="stat-value">{n.value}{notes.cite(n.src)}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;
  const details = w.details?.length ? <div class="wu-block"><h3>Details</h3><Bullets lines={w.details} cite={notes.cite} /></div> : null;
  const quirks = w.quirks?.length ? <div class="wu-block callout warn"><h3>Good to know</h3><Bullets lines={w.quirks} cite={notes.cite} /></div> : null;
  const config = w.config?.length ? <div class="wu-block callout"><h3>Depends on server settings</h3><Bullets lines={w.config} cite={notes.cite} /></div> : null;
  return (
    <>
      <p class="writeup-summary">{w.summary}</p>
      {use}
      {numbers}
      {details}
      {(quirks || config) && <div class={quirks && config ? 'callouts two' : 'callouts'}>{quirks}{config}</div>}
      <Sources notes={notes} commit={commit} />
    </>
  );
}
