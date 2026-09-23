export type ItemType =
  | 'main'
  | 'standard option'
  | 'custom option'
  | 'iso certification'
  | 'startup'
  | 'customization'
  | 'shipping'
  // App-side only (not a Price List dropdown value): calibration service lines.
  | 'calibration';

export interface PriceListItem {
  _id: string;
  name: string;
  itemId: string;
  productCode: string;
  description: string;
  itemType: ItemType;
  parentId?: string;
  cost?: number;
  price?: number; // undefined = price on request (PRF)
  specSheetFileId?: string; // set on any one 'main' row per product code
  standardsSupported?: string; // comma-separated, set on any one 'main' row per product code
  includedInPrice?: boolean; // no separate charge — bundled into the parent's price (e.g. ACE's mandatory ManikinPC)
}

export interface ConfigLine {
  item: PriceListItem;
  qty: number;
}

// A product added to the quote — the main item plus its selected option
// quantities. Shared between App.tsx state and the draft save/resume payload.
export interface QuoteEntry {
  mainId: string;
  qty: number;
  optionQtys: Record<string, number>;
}

export interface WorkOrderSummary {
  _id: string;
  name: string;
  workOrderNumber?: string;
  customerName?: string;
  buildType?: string;
  phaseId: string;
}

export interface RentalUnitSummary {
  _id: string;
  name: string;
  productFamily?: string;
  serialNumber?: string;
  status?: string;
}
