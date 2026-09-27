import type { Writeup, WriteupLine } from '../../data/types';
import { Check } from './KamoriWriteup';

const SRC = 'https://github.com/LumaLibre/LumaItems/blob';

/** "items/x/File.kt:12-30" -> a GitHub link to those lines at the pinned commit. */
export function sourceLinks(src: string, commit: string) {
  return src.split(/,\s*/).map((ref) => {
    const m = /^(.+?):(\d+)(?:-(\d+))?$/.exec(ref.trim());
    if (!m) return null;
    const [, file, a, b] = m;
    const name = file.split('/').pop();
    return { href: `${SRC}/${commit.slice(0, 7)}/src/main/java/dev/lumas/lumaitems/${file}#L${a}${b ? `-L${b}` : ''}`, label: `${name} line${b ? 's' : ''} ${a}${b ? `–${b}` : ''}` };
  }).filter((x): x is { href: string; label: string } => !!x);
}

function Src({ src, commit }: { src: string; commit: string }) {
  return (
    <span class="src-links">
      {sourceLinks(src, commit).map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" title={`Source: ${l.label}`} aria-label={`Source: ${l.label}`}>source</a>
      ))}
    </span>
  );
}

function Lines({ lines, commit, icon }: { lines: WriteupLine[]; commit: string; icon?: 'check' }) {
  return (
    <ul class={icon ? 'facts' : 'facts plain'}>
      {lines.map((l, i) => (
        <li key={i}>
          {icon && <Check />}
          <span>{l.text} <Src src={l.src} commit={commit} /></span>
        </li>
      ))}
    </ul>
  );
}

/** The hand-checked mechanics for an item, every line linked to the plugin code it comes from. */
export function WriteupView({ w, commit }: { w: Writeup; commit: string }) {
  return (
    <>
      <p class="writeup-summary">{w.summary}</p>
      {(w.use?.length || w.numbers?.length) ? (
        <div class="pair">
          {w.use?.length ? (
            <div class="writeup-block">
              <h3>How to use it</h3>
              <Lines lines={w.use} commit={commit} icon="check" />
            </div>
          ) : null}
          {w.numbers?.length ? (
            <div class="writeup-block">
              <h3>Numbers</h3>
              <table class="mtable numbers">
                <tbody>
                  {w.numbers.map((n, i) => (
                    <tr key={i}>
                      <td>{n.label}</td>
                      <td>{n.value} <Src src={n.src} commit={commit} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {w.details?.length ? (
        <div class="writeup-block">
          <h3>Details</h3>
          <Lines lines={w.details} commit={commit} />
        </div>
      ) : null}
      {w.quirks?.length ? (
        <div class="writeup-block callout warn">
          <h3>Good to know</h3>
          <Lines lines={w.quirks} commit={commit} />
        </div>
      ) : null}
      {w.config?.length ? (
        <div class="writeup-block callout">
          <h3>Depends on server settings</h3>
          <Lines lines={w.config} commit={commit} />
        </div>
      ) : null}
    </>
  );
}
