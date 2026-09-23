import { ConfigLine } from './types';
import { COMMISSION_EXEMPT_TYPES, ITEM_TYPE, MARGIN_TOTAL_TYPES } from './constants/schema';

// Keyed by line.item._id — a manual per-unit price that replaces the catalog
// price for that line (rare discounting / one-off pricing on a PRF item).
// The override is the FINAL per-unit price the customer sees (what-you-type-
// is-what-they-pay); commission math still runs on top by working backwards
// to an implied list price, so margin% and agent commission stay consistent.
export type PriceOverrides = Record<string, number>;

export interface LinePricing {
  line: ConfigLine;
  hasPrice: boolean;
  listTotal: number; // 0 when no price (PRF or Included)
  finalTotal: number; // list + agent commission
  costTotal: number;
  unitPrice?: number; // final per-unit price shown/charged (post-commission), undefined when PRF/Included
  isOverridden: boolean;
  // No separate charge because it's bundled into its parent's price (e.g.
  // ACE's mandatory ManikinPC) — distinct from PRF ("price on request"):
  // an Included line has a KNOWN price of zero, not an unknown one.
  isIncluded: boolean;
}

export interface Totals {
  lines: LinePricing[];
  listSum: number;
  finalSum: number;
  costSum: number;
  baseCostSum: number; // base product only
  marginPct: number; // base product only
  totalCostSum: number; // base product + standard/custom options + customization
  totalMarginPct: number; // same scope as totalCostSum
  prfCount: number;
}

// Agent commission is added ON TOP of list price: final = price * (1 + pct/100).
// ISO 17025 Certification, Startup, and Calibration lines are commission-EXEMPT:
// agents get no cut of service/pass-through work, so those lines carry their
// flat price (see COMMISSION_EXEMPT_TYPES).
// Margin follows the price sheet's GM NET = (price - cost) / price, on list price
// (commission is the agent's cut, not ours). Two scopes are tracked side by
// side: marginPct/baseCostSum is the BASE PRODUCT only; totalMarginPct/
// totalCostSum widens that to base product + standard/custom options +
// customization (MARGIN_TOTAL_TYPES). ISO Certification, Startup, Calibration,
// and Shipping are excluded from BOTH — they still count toward
// listSum/costSum/finalSum for the other totals, just not either margin figure.
export function computeTotals(
  lines: ConfigLine[],
  commissionPct: number,
  priceOverrides: PriceOverrides = {},
): Totals {
  const priced: LinePricing[] = lines.map((line) => {
    const exempt = COMMISSION_EXEMPT_TYPES.includes(line.item.itemType);
    const multiplier = exempt ? 1 : 1 + commissionPct / 100;
    const override = priceOverrides[line.item._id];
    const isOverridden = override != null;
    // Included takes effect only when not manually overridden — a rep
    // overriding the price on an Included line means they're deliberately
    // charging for it after all, which should win.
    const isIncluded = !isOverridden && !!line.item.includedInPrice;
    const costTotal = line.item.cost != null ? line.item.cost * line.qty : 0;
    if (isIncluded) {
      return {
        line,
        hasPrice: true, // known price of zero — not PRF
        listTotal: 0,
        finalTotal: 0,
        costTotal,
        unitPrice: 0,
        isOverridden,
        isIncluded: true,
      };
    }
    // override is the final (post-commission) per-unit price; back it out to
    // an implied list price so listSum/margin% stay mathematically consistent.
    const listPrice = isOverridden ? override / multiplier : line.item.price;
    const hasPrice = listPrice != null;
    const listTotal = hasPrice ? (listPrice as number) * line.qty : 0;
    const finalTotal = hasPrice ? (listPrice as number) * multiplier * line.qty : 0;
    const unitPrice = hasPrice ? (listPrice as number) * multiplier : undefined;
    return { line, hasPrice, listTotal, finalTotal, costTotal, unitPrice, isOverridden, isIncluded: false };
  });

  const listSum = priced.reduce((s, p) => s + p.listTotal, 0);
  const finalSum = priced.reduce((s, p) => s + p.finalTotal, 0);
  const costSum = priced.reduce((s, p) => s + p.costTotal, 0);
  const mainLines = priced.filter((p) => p.line.item.itemType === ITEM_TYPE.MAIN);
  const mainListSum = mainLines.reduce((s, p) => s + p.listTotal, 0);
  const baseCostSum = mainLines.reduce((s, p) => s + p.costTotal, 0);
  const marginPct = mainListSum > 0 ? ((mainListSum - baseCostSum) / mainListSum) * 100 : 0;

  const marginTotalLines = priced.filter((p) => MARGIN_TOTAL_TYPES.includes(p.line.item.itemType));
  const marginTotalListSum = marginTotalLines.reduce((s, p) => s + p.listTotal, 0);
  const totalCostSum = marginTotalLines.reduce((s, p) => s + p.costTotal, 0);
  const totalMarginPct =
    marginTotalListSum > 0 ? ((marginTotalListSum - totalCostSum) / marginTotalListSum) * 100 : 0;

  const prfCount = priced.filter((p) => !p.hasPrice).length;

  return {
    lines: priced,
    listSum,
    finalSum,
    costSum,
    baseCostSum,
    marginPct,
    totalCostSum,
    totalMarginPct,
    prfCount,
  };
}
