import { LinePricing, Totals } from './pricing';
import { DISCOUNTABLE_TYPES, SECTIONS, Section, SYSTEM_PRICE_TYPES } from './constants/schema';

// Percentage (0-100) discount per section, keyed by ITEM_TYPE — only sections
// in DISCOUNTABLE_TYPES are ever read here. See App.tsx's sectionDiscounts state.
export type SectionDiscounts = Partial<Record<string, number>>;

export interface QuoteSectionGroup {
  section: Section;
  lines: LinePricing[];
  subtotal: number; // gross, before this section's discount
  discountable: boolean;
  discountPct: number; // 0 when not set / not discountable
  discountAmount: number; // subtotal * discountPct / 100
  netSubtotal: number; // subtotal - discountAmount — what feeds the running totals
}

export interface GroupedQuote {
  systemPriceSections: QuoteSectionGroup[];
  postSystemSections: QuoteSectionGroup[];
  totalSystemPrice: number; // sum of system-price sections' NET subtotals
  grandTotal: number; // sum of every section's NET subtotal — "Items TOTAL without Tax"
}

// Groups priced lines into the 8 quote sections, in display order, and
// applies any per-section discount — shared by the on-screen Quote view and
// the PDF export so they never drift apart.
export function groupQuoteSections(totals: Totals, sectionDiscounts: SectionDiscounts = {}): GroupedQuote {
  const grouped: QuoteSectionGroup[] = SECTIONS.map((section) => {
    const lines = totals.lines.filter((p) => p.line.item.itemType === section.type);
    const subtotal = lines.reduce((s, p) => s + (p.hasPrice ? p.finalTotal : 0), 0);
    const discountable = DISCOUNTABLE_TYPES.includes(section.type);
    const discountPct = discountable ? sectionDiscounts[section.type] ?? 0 : 0;
    const discountAmount = subtotal * (discountPct / 100);
    const netSubtotal = subtotal - discountAmount;
    return { section, lines, subtotal, discountable, discountPct, discountAmount, netSubtotal };
  });

  const systemPriceSections = grouped.filter((g) => SYSTEM_PRICE_TYPES.includes(g.section.type));
  const postSystemSections = grouped.filter((g) => !SYSTEM_PRICE_TYPES.includes(g.section.type));
  const totalSystemPrice = systemPriceSections.reduce((s, g) => s + g.netSubtotal, 0);
  const grandTotal = grouped.reduce((s, g) => s + g.netSubtotal, 0);

  return { systemPriceSections, postSystemSections, totalSystemPrice, grandTotal };
}
