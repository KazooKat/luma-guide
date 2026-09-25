const BASE = import.meta.env.BASE_URL;

/** A Minecraft inventory icon from public/icons. Use `lazy` only in long lists. */
export function Icon({ id, size = 24, alt = '', lazy = false }: { id: string | null | undefined; size?: number; alt?: string; lazy?: boolean }) {
  if (!id) return <span class="icon" style={{ width: size, height: size, display: 'inline-block' }} />;
  return <img class="icon" src={`${BASE}icons/${id}.png`} width={size} height={size} alt={alt} loading={lazy ? 'lazy' : 'eager'} />;
}
