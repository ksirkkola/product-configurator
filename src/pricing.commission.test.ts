import { describe, it, expect } from 'vitest';
import { commissionMultiplier, computeTotals } from './pricing';
import { ITEM_TYPE } from './constants/schema';

const line = (type: string, price: number, qty = 1, id = type) =>
  ({ item: { _id: id, itemType: type, price, cost: 0 }, qty }) as never;

describe('agent commission is price / (1 - pct)', () => {
  it('25% -> price / 0.75', () => { expect(commissionMultiplier(25)).toBeCloseTo(1 / 0.75, 10); });
  it('10% -> price / 0.9', () => { expect(commissionMultiplier(10)).toBeCloseTo(1 / 0.9, 10); });
  it('no commission -> 1', () => { expect(commissionMultiplier(0)).toBe(1); });
  it('NET60 1.6% stays a simple markup', () => { expect(commissionMultiplier(1.6)).toBeCloseTo(1.016, 10); });
  it('quote: 7500 base at 25% -> 10000 and the agent gets 25% of it', () => {
    const t = computeTotals([line(ITEM_TYPE.MAIN, 7500)], 25);
    expect(t.listSum).toBe(7500);
    expect(t.finalSum).toBeCloseTo(10000, 6);
    expect(t.finalSum - t.listSum).toBeCloseTo(0.25 * t.finalSum, 6);
  });
  it('exempt lines (shipping) carry no commission', () => {
    const t = computeTotals([line(ITEM_TYPE.SHIPPING, 400)], 25);
    expect(t.finalSum).toBe(400);
  });
  it('a typed override is the final price; list is backed out', () => {
    const t = computeTotals([line(ITEM_TYPE.MAIN, 7500, 1, 'm1')], 25, { m1: 9000 });
    expect(t.finalSum).toBeCloseTo(9000, 6);
    expect(t.listSum).toBeCloseTo(6750, 6);
  });
});
