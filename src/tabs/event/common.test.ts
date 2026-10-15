import { describe, expect, it } from 'vitest';
import { codeName, EVENT, GAME_COUNT, META, NEW_GAMES, possessive, PREVIEW, VISIBLE_GAMES } from './common';

describe('event games', () => {
  it('possessive drops the extra s after a name ending in s', () => {
    expect(possessive('Luma Nightmares')).toBe("Luma Nightmares'");
    expect(possessive('Lumarine 2026')).toBe("Lumarine 2026's");
  });

  it('once live, shows only the active games, under this event\'s names for them', () => {
    if (PREVIEW) return;
    expect(VISIBLE_GAMES.map((g) => g.key)).toEqual(EVENT.minigames.filter((g) => META.activeGames.includes(g.key)).map((g) => g.key));
    for (const g of VISIBLE_GAMES) {
      const renamed = META.gameNames[g.key];
      expect(g.name).toBe(renamed ?? EVENT.minigames.find((x) => x.key === g.key)!.name);
      expect(codeName(g)).toBe(renamed ? EVENT.minigames.find((x) => x.key === g.key)!.name : null);
    }
  });

  it('counts new games without a guide alongside the guided ones', () => {
    expect(GAME_COUNT).toBe(VISIBLE_GAMES.length + NEW_GAMES.length);
    expect(NEW_GAMES).toEqual(PREVIEW ? [] : META.newGames);
  });
});
