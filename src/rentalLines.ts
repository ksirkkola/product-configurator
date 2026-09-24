import {
  RENTAL_CLEANING_CALIBRATION_FEE,
  RENTAL_MONTHLY_RATE,
  RENTAL_SHORT_TERM_MAX_WEEKS,
  RENTAL_SHORT_TERM_WEEKLY_RATE,
} from './constants/schema';

// A rental being built in the Rental tab — one per fleet unit added. Kept
// entirely separate from ConfigLine/pricing.ts: a rental isn't a priced quote
// line, it's a draft of an activity to be created directly in the Rentals
// workflow (see App.tsx build invariants — rentals have their own lifecycle,
// dates, and unit assignment, not a flat price/cost pair).
export interface RentalLine {
  id: string; // client-side only, for tag/list keys — not sent to Hailer
  unitId: string;
  // No accountId/shipTo here — Account/Contact/Ship To are shared across the
  // whole batch (RentalDetails, picked once in RentalDetailsBox), same
  // assumption a Rental Contract makes: one customer per document.
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  // The per-week RATE (for display: "€4,875/week") — auto-filled from the
  // tiered schedule once both dates are set. What actually gets pushed to
  // Hailer's "Rental Fee for Desired Time Length" field is the computed
  // TOTAL (see estimateRentalRevenue), not this rate — that field holds a
  // single total fee for the whole period, never a per-week rate to multiply.
  weeklyRate: string;
  // One-time charges, distinct from the recurring rental fee — matches the
  // Rentals workflow's real field set (Setup and Training / Freight Delivery
  // / Freight Return / Cleaning and Calibration). No `deposit` here — despite
  // an earlier version of this app treating it as a real field, the Rentals
  // workflow has no such field; it was a leftover from an early prototype.
  startupFee: string; // "Setup and Training" — one-time on-site setup/training
  freightDelivery: string; // "Freight Delivery" — billed at cost
  freightReturn: string; // "Freight Return" — billed at cost
  cleaningAndCalibration: string; // one-time fee, defaults to the standard rate, waivable below
  cleaningAndCalibrationWaived: boolean;
  notes: string;
  // Deliberately no `poReference` here — a PO implies the customer has
  // already agreed to a price, but this tab creates the rental straight into
  // Discovery (pre-commitment), with no quote/proposal step. PO / Reference
  // gets filled in later, directly on the activity in Hailer, once the
  // rental actually reaches Agreement — same convention as the Opportunity
  // workflow's PO fields, which are excluded from this app's quote form too.
}

export function newRentalLine(unitId: string): RentalLine {
  return {
    id: `${unitId}-${Date.now()}`,
    unitId,
    startDate: '',
    endDate: '',
    weeklyRate: '',
    startupFee: '',
    freightDelivery: '',
    freightReturn: '',
    cleaningAndCalibration: String(RENTAL_CLEANING_CALIBRATION_FEE),
    // Defaults to waived — the fee is already baked into the rental price
    // (RENTAL_SHORT_TERM_WEEKLY_RATE / RENTAL_MONTHLY_RATE), so showing it as
    // a standard charge that's then waived on every contract is a deliberate
    // sales gesture ("look, we're giving you this for free") rather than an
    // actual discount. Still an editable checkbox per line for the rare case
    // someone wants to genuinely charge for it.
    cleaningAndCalibrationWaived: true,
    notes: '',
  };
}

// Deliberately weekly-rate-only — see the type comment above for why Setup
// and Training / Freight / Cleaning and Calibration stay separate.
export function estimateRentalWeeks(line: RentalLine): number | null {
  const start = line.startDate ? new Date(line.startDate).getTime() : 0;
  const end = line.endDate ? new Date(line.endDate).getTime() : 0;
  if (!start || !end || end <= start) return null;
  const days = (end - start) / 86400000;
  return Math.ceil(days / 7);
}

// Universal weekly rate for a given rental duration — same schedule for every
// unit (Newton and ACE alike). See the constant comments in schema.ts for the
// full explanation of the tier/cliff. RentalLineEditor calls this to
// auto-fill (and keep in sync with) RentalLine.weeklyRate the moment both
// dates are selected — the rep never has to look up or type a rate manually.
export function tieredWeeklyRate(weeks: number): number {
  if (weeks <= 0) return 0;
  return weeks <= RENTAL_SHORT_TERM_MAX_WEEKS
    ? RENTAL_SHORT_TERM_WEEKLY_RATE
    : RENTAL_MONTHLY_RATE / 4;
}

// The TOTAL rental fee for this line's desired time length (rate x weeks) —
// this is what gets pushed to Hailer's "Rental Fee for Desired Time Length"
// field (RENTALS_FIELDS.rentalFeeTotal), which mirrors straight through to
// "Total Rental Revenue" server-side (workspace/rentals_.../functions/
// total_rental_revenue_511.ts is a pure pass-through/rounding of this value —
// it does NOT multiply by weeks itself, so this app must send the total,
// never the raw per-week rate).
export function estimateRentalRevenue(line: RentalLine): number | null {
  const rate = Number(line.weeklyRate) || 0;
  const weeks = estimateRentalWeeks(line);
  if (!rate || weeks == null) return null;
  return Math.round(rate * weeks * 100) / 100;
}

// The Cleaning and Calibration charge actually due for this line — 0 when
// waived, regardless of what's still typed in the amount field (kept visible
// so the waived line can still show its standard price on the contract).
export function cleaningAndCalibrationDue(line: RentalLine): number {
  if (line.cleaningAndCalibrationWaived) return 0;
  return Number(line.cleaningAndCalibration) || 0;
}

// All-in amount to invoice for this line: recurring rental fee + every
// one-time charge (Setup and Training, Freight Delivery, Freight Return,
// Cleaning and Calibration net of waiver). No Deposit — see the type comment.
export function estimateInvoiceTotal(line: RentalLine): number | null {
  const rentalFee = estimateRentalRevenue(line);
  const startup = Number(line.startupFee) || 0;
  const freightDelivery = Number(line.freightDelivery) || 0;
  const freightReturn = Number(line.freightReturn) || 0;
  const cleaning = cleaningAndCalibrationDue(line);
  if (rentalFee == null && !startup && !freightDelivery && !freightReturn && !cleaning) return null;
  return Math.round(((rentalFee ?? 0) + startup + freightDelivery + freightReturn + cleaning) * 100) / 100;
}
