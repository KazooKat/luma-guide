import { describe, expect, it } from 'vitest';
import { shopTotal } from './Shop';

describe('shop total', () => {
  it('counts each limited item up to its limit', () => {
    expect(shopTotal([{ name: 'A', cost: 150, limit: 2 }, { name: 'B', cost: 265, limit: 1 }])).toEqual({ total: 565, limited: 2, open: [] });
  });

  it('leaves items with no limit out of the total and names them', () => {
    const r = shopTotal([{ name: 'A', cost: 150, limit: 2 }, { name: 'Nametags', cost: 35, limit: null }, { name: 'Particles', cost: 64 }]);
    expect(r).toEqual({ total: 300, limited: 1, open: ['Nametags', 'Particles'] });
  });

  it('with no limits at all, totals 1 of everything', () => {
    expect(shopTotal([{ name: 'A', cost: 10 }, { name: 'B', cost: 5, limit: null }])).toEqual({ total: 15, limited: 0, open: [] });
  });
});
