// A rental being built in the Rental tab — one per fleet unit added. Kept
// entirely separate from ConfigLine/pricing.ts: a rental isn't a priced quote
// line, it's a draft of an activity to be created directly in the Rentals
// workflow (see App.tsx build invariants — rentals have their own lifecycle,
// dates, and unit assignment, not a flat price/cost pair).
export interface RentalLine {
  id: string; // client-side only, for tag/list keys — not sent to Hailer
  unitId: string;
  accountId: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weeklyRate: string;
  deposit: string;
  // One-time charges, distinct from the recurring Weekly Rate — matches the
  // Newton Rental Package reference doc's three separate line items
  // ("Manikin rental fee" / "Onsite startup/training" / "Shipping — billed
  // at cost"). Kept OUT of estimateRentalRevenue/estimateRentalWeeks below,
  // which mirror the Rentals workflow's "Total Rental Revenue" function
  // field exactly (weekly rate x weeks only) — see estimateInvoiceTotal for
  // the all-in total shown on the quote.
  startupFee: string;
  shippingCost: string;
  shipTo: string;
  notes: string;
  // Deliberately no `poReference` here — a PO implies the customer has
  // already agreed to a price, but this tab creates the rental straight into
  // Discovery (pre-commitment), with no quote/proposal step. PO / Reference
  // gets filled in later, directly on the activity in Hailer, once the
  // rental actually reaches Agreement — same convention as the Opportunity
  // workflow's PO fields, which are excluded from this app's quote form too.
}

export function newRentalLine(unitId: string, defaults: { accountId: string | null; shipTo: string }): RentalLine {
  return {
    id: `${unitId}-${Date.now()}`,
    unitId,
    accountId: defaults.accountId,
    startDate: '',
    endDate: '',
    weeklyRate: '',
    deposit: '',
    startupFee: '',
    shippingCost: '',
    shipTo: defaults.shipTo,
    notes: '',
  };
}

// Mirrors the Rentals workflow's "Total Rental Revenue" function field exactly
// (workspace/rentals_.../functions/total_rental_revenue_511.ts) so this
// preview never drifts from what Hailer will actually compute server-side.
// Deliberately weekly-rate-only — see the type comment above for why Startup
// Fee / Shipping stay separate.
export function estimateRentalWeeks(line: RentalLine): number | null {
  const start = line.startDate ? new Date(line.startDate).getTime() : 0;
  const end = line.endDate ? new Date(line.endDate).getTime() : 0;
  if (!start || !end || end <= start) return null;
  const days = (end - start) / 86400000;
  return Math.ceil(days / 7);
}

export function estimateRentalRevenue(line: RentalLine): number | null {
  const rate = Number(line.weeklyRate) || 0;
  const weeks = estimateRentalWeeks(line);
  if (!rate || weeks == null) return null;
  return Math.round(rate * weeks * 100) / 100;
}

// All-in amount to invoice for this line: recurring rental fee + one-time
// Startup Fee + Shipping (excludes Deposit, which is refundable, not revenue).
export function estimateInvoiceTotal(line: RentalLine): number | null {
  const rentalFee = estimateRentalRevenue(line);
  const startup = Number(line.startupFee) || 0;
  const shipping = Number(line.shippingCost) || 0;
  if (rentalFee == null && !startup && !shipping) return null;
  return Math.round(((rentalFee ?? 0) + startup + shipping) * 100) / 100;
}
