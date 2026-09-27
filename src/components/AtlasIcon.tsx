import atlasUrl from '../assets/items-atlas.png';
import atlas from '../data/items-atlas.json';

/**
 * An item icon cut from the glossary's sprite sheet (built by scripts/build_data.py), so the whole Items grid
 * costs one image request. `glint` adds the enchantment sheen, masked to the icon's own pixels.
 */
export function AtlasIcon({ id, size, glint = false }: { id: string; size: number; glint?: boolean }) {
  const n = (atlas.icons as Record<string, number>)[id];
  if (n === undefined) return <span class="atlas-icon" style={{ width: size, height: size }} />;
  const pos = `${-(n % atlas.cols) * size}px ${-Math.floor(n / atlas.cols) * size}px`;
  const dims = `${atlas.cols * size}px ${atlas.rows * size}px`;
  return (
    <span
      class={glint ? 'atlas-icon glint' : 'atlas-icon'}
      aria-hidden="true"
      style={{ width: size, height: size, backgroundImage: `url(${atlasUrl})`, backgroundPosition: pos, backgroundSize: dims, '--atlas': `url(${atlasUrl})`, '--pos': pos, '--dims': dims }}
    />
  );
}
