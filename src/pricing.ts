import { ConfigLine } from './types';

export interface LinePricing {
  line: ConfigLine;
  hasPrice: boolean;
  listTotal: number; // 0 when no price (PRF)
  finalTotal: number; // list + agent commission
  costTotal: number;
}

export interface Totals {
  lines: LinePricing[];
  listSum: number;
  finalSum: number;
  costSum: number;
  marginPct: number;
  prfCount: number;
}

// Agent commission is added ON TOP of list price: final = price * (1 + pct/100).
// Calibration (and any future startup-cost) lines are commission-EXEMPT: agents
// get no cut of service work, so those lines carry their flat price.
// Margin follows the price sheet's GM NET = (price - cost) / price, on list price
// (commission is the agent's cut, not ours).
export function computeTotals(lines: ConfigLine[], commissionPct: number): Totals {
  const priced: LinePricing[] = lines.map((line) => {
    const hasPrice = line.item.price != null;
    const exempt = line.item.itemType === 'calibration';
    const listTotal = hasPrice ? (line.item.price as number) * line.qty : 0;
    const finalTotal = hasPrice
      ? (line.item.price as number) * (exempt ? 1 : 1 + commissionPct / 100) * line.qty
      : 0;
    const costTotal = line.item.cost != null ? line.item.cost * line.qty : 0;
    return { line, hasPrice, listTotal, finalTotal, costTotal };
  });

  const listSum = priced.reduce((s, p) => s + p.listTotal, 0);
  const finalSum = priced.reduce((s, p) => s + p.finalTotal, 0);
  const costSum = priced.reduce((s, p) => s + p.costTotal, 0);
  const marginPct = listSum > 0 ? ((listSum - costSum) / listSum) * 100 : 0;
  const prfCount = priced.filter((p) => !p.hasPrice).length;

  return { lines: priced, listSum, finalSum, costSum, marginPct, prfCount };
}
