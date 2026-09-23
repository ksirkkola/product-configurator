import { QuoteEntry } from './types';
import { PriceOverrides } from './pricing';
import { SectionDiscounts } from './quoteSections';
import { CalibrationQuoteLine } from './components/CalibrationBox';
import { ExtraQuoteLine } from './components/ExtrasBox';
import { QuoteDetails } from './components/QuoteDetailsBox';

// Everything needed to fully rehydrate the Configure/Quote tabs — saved as a
// JSON blob on an Opportunity in the Discovery phase (see OPPORTUNITY.fields
// .configuratorDraftJson in constants/schema.ts). Bump `version` on any
// breaking shape change so parseDraft can reject drafts it can't read.
export interface DraftPayload {
  version: 1;
  entries: QuoteEntry[];
  calLines: CalibrationQuoteLine[];
  extraLines: ExtraQuoteLine[];
  commissionPct: number;
  quoteDetails: QuoteDetails;
  priceOverrides: PriceOverrides;
  sectionDiscounts: SectionDiscounts;
}

export function serializeDraft(input: Omit<DraftPayload, 'version'>): string {
  const payload: DraftPayload = { version: 1, ...input };
  return JSON.stringify(payload);
}

export function parseDraft(raw: unknown): DraftPayload | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DraftPayload>;
    if (parsed.version !== 1) return null;
    if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.calLines) || !Array.isArray(parsed.extraLines)) {
      return null;
    }
    return {
      version: 1,
      entries: parsed.entries,
      calLines: parsed.calLines,
      extraLines: parsed.extraLines,
      commissionPct: typeof parsed.commissionPct === 'number' ? parsed.commissionPct : 0,
      quoteDetails: (parsed.quoteDetails as QuoteDetails) ?? undefined,
      priceOverrides: (parsed.priceOverrides as PriceOverrides) ?? {},
      sectionDiscounts: (parsed.sectionDiscounts as SectionDiscounts) ?? {},
    } as DraftPayload;
  } catch {
    return null;
  }
}

// Builds a short, human-scannable draft name from whatever's in the quote —
// mirrors the pattern QuoteView uses for the finalized Opportunity name.
export function draftName(mainProductCode: string | undefined, mainCount: number): string {
  const label = mainProductCode
    ? `${mainProductCode}${mainCount > 1 ? ` +${mainCount - 1}` : ''}`
    : 'Empty quote';
  return `DRAFT — ${label} — ${new Date().toLocaleDateString()}`;
}
