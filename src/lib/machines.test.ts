import { describe, expect, it } from 'vitest';
import { machinesFor, machineRate } from './machines';

describe('machine throughput (vanilla timings, 20 ticks/s)', () => {
  it('Cook default setup: 20 furnaces + 10 smokers = 14,400 items/h', () => {
    expect(machineRate({ furnace: 20, smoker: 10 })).toBe(14_400);
  });

  it('one furnace = 360/h, one smoker or blast furnace = 720/h, one brewing stand = 180 brews/h', () => {
    expect(machineRate({ furnace: 1 })).toBe(360);
    expect(machineRate({ smoker: 1 })).toBe(720);
    expect(machineRate({ blast_furnace: 1 })).toBe(720);
    expect(machineRate({ brewing_stand: 1 })).toBe(180);
  });

  it('offers smokers only for food and blast furnaces only for ores/metal', () => {
    expect(machinesFor('Cook', 'Smelt').map((m) => m.id)).toEqual(['furnace', 'smoker']);
    expect(machinesFor('Blacksmith', 'Smelt').map((m) => m.id)).toEqual(['furnace', 'blast_furnace']);
    expect(machinesFor('Digger', 'Smelt').map((m) => m.id)).toEqual(['furnace']);
    expect(machinesFor('Alchemist', 'Brew').map((m) => m.id)).toEqual(['brewing_stand']);
    expect(machinesFor('Miner', 'Break')).toEqual([]);
  });

  it('defaults match the JobsAddons job-block limits', () => {
    const cook = machinesFor('Cook', 'Smelt');
    expect(cook.map((m) => [m.defaultCount, m.maxCount])).toEqual([[20, 30], [10, 20]]);
  });
});
