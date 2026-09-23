// Hex IDs copied from workspace/enums.ts (never hardcode elsewhere — this is the one file).

export const WORKFLOWS = {
  priceList: '6a6858c8fa66717867108a8a',
  workOrder: '6a4c9c50b7d11c3c37c9ca77',
  workOrderLineItem: '6a4c9c51b7d11c3c37c9ca90',
  rentals: '6a99429b65a81755cf3190cf',
  rentalFleet: '6a99429d65a81755cf3190e9',
};

// Price List is a flat dataset (enableUnlinkedMode: true) but still has one phase.
export const PRICE_LIST_PHASE = '6a6858c8fa66717867108a89';

export const WORK_ORDER_PHASES = [
  '6a4c9c7fa218e0e0d33d25a0', // New (isInitial)
  '6a4c9c81a218e0e0d33d25ce', // Parts Sourcing
  '6a4c9c83a218e0e0d33d260c', // Assembly
  '6a4c9c86a218e0e0d33d264c', // QC / Testing
  '6a4c9c88a218e0e0d33d269b', // Ready to Ship
  '6a4c9c8ba218e0e0d33d26d9', // Shipped
  '6a4c9c8da218e0e0d33d2719', // Complete (isEndpoint)
  '6a4c9c90a218e0e0d33d2759', // On Hold
];

export const WORK_ORDER_PHASE_NAMES: Record<string, string> = {
  '6a4c9c7fa218e0e0d33d25a0': 'New',
  '6a4c9c81a218e0e0d33d25ce': 'Parts Sourcing',
  '6a4c9c83a218e0e0d33d260c': 'Assembly',
  '6a4c9c86a218e0e0d33d264c': 'QC / Testing',
  '6a4c9c88a218e0e0d33d269b': 'Ready to Ship',
  '6a4c9c8ba218e0e0d33d26d9': 'Shipped',
  '6a4c9c8da218e0e0d33d2719': 'Complete',
  '6a4c9c90a218e0e0d33d2759': 'On Hold',
};

// Work Order Line Item — initial phase is "Pending".
export const WORK_ORDER_LINE_ITEM_INITIAL_PHASE = '6a4c9c94a218e0e0d33d27b4';

// Field keys (server-set `key` property on each field — resolved to hex via field-resolver.ts).
export const PRICE_LIST_FIELDS = {
  itemId: 'item_id',
  productCode: 'product_code',
  description: 'description',
  itemType: 'item_type',
  parentItem: 'parent_item',
  cost2025: 'cost_2025',
  price2025: 'price_2025',
  toTmxa: 'to_tmxa',
  toTmxaSf: 'to_tmxa_sf',
  specSheet: 'spec_sheet',
  standardsSupported: 'standards_supported',
  includedInPrice: 'included_in_price',
} as const;

export const ITEM_TYPE = {
  MAIN: 'main',
  STANDARD_OPTION: 'standard option',
  CUSTOM_OPTION: 'custom option',
  ISO_CERTIFICATION: 'iso certification',
  STARTUP: 'startup',
  CUSTOMIZATION: 'customization',
  SHIPPING: 'shipping',
  // App-side only (not a Price List dropdown value): calibration service lines.
  // Commission-exempt — see computeTotals.
  CALIBRATION: 'calibration',
} as const;

// Quote sections, in display order — matches the printed quote layout.
export interface Section {
  type: (typeof ITEM_TYPE)[keyof typeof ITEM_TYPE];
  label: string;
}

export const SECTIONS: Section[] = [
  { type: ITEM_TYPE.MAIN, label: 'Base Product(s)' },
  { type: ITEM_TYPE.ISO_CERTIFICATION, label: 'ISO 17025 Certification' },
  { type: ITEM_TYPE.STANDARD_OPTION, label: 'Standard System Options' },
  { type: ITEM_TYPE.CUSTOM_OPTION, label: 'Custom System Options' },
  { type: ITEM_TYPE.CUSTOMIZATION, label: 'Customization' },
  { type: ITEM_TYPE.STARTUP, label: 'Startup' },
  { type: ITEM_TYPE.CALIBRATION, label: 'Calibration Options' },
  { type: ITEM_TYPE.SHIPPING, label: 'Shipping' },
];

// These roll up into "Total System Price" — the configured system itself,
// before Calibration / Shipping are added on top. Matches the customer-facing
// quote template's mid-total (Startup is included here per FECSA convention).
export const SYSTEM_PRICE_TYPES: string[] = [
  ITEM_TYPE.MAIN,
  ITEM_TYPE.ISO_CERTIFICATION,
  ITEM_TYPE.STANDARD_OPTION,
  ITEM_TYPE.CUSTOM_OPTION,
  ITEM_TYPE.CUSTOMIZATION,
  ITEM_TYPE.STARTUP,
];

// Sections that get a per-section "Discount (%)" / "Discount ($)" pair above
// their Subtotal row — matches the FECSA-style quote template exactly. ISO
// 17025 Certification and Shipping intentionally have none; Calibration's
// template row is a differently-labeled fixed "POS Discount" rather than
// this generic ad-hoc one, so it's excluded too.
export const DISCOUNTABLE_TYPES: string[] = [
  ITEM_TYPE.MAIN,
  ITEM_TYPE.STANDARD_OPTION,
  ITEM_TYPE.CUSTOM_OPTION,
  ITEM_TYPE.CUSTOMIZATION,
  ITEM_TYPE.STARTUP,
];

// Some base products require a specific option every time they're quoted
// (e.g. ACE always needs the OUS ManikinPC license). Keyed by product code;
// value is the option's exact Description text, matched against the Price
// List row to auto-select it (qty 1) the moment the main is added — the rep
// can still remove/change it, this just prevents forgetting it.
export const MANDATORY_OPTIONS: Record<string, string> = {
  '522-ACE': 'Software, ManikinPC License (Permanent) - OUS',
};

// Agents get no cut of service/pass-through work (see Opportunity's
// "Commission Amount" field description: "Not given on Startup, Service
// Plan, ISO 17025 Certs or ManikinPC"). Calibration is the same kind of
// service line, so it's exempt too.
export const COMMISSION_EXEMPT_TYPES: string[] = [
  ITEM_TYPE.ISO_CERTIFICATION,
  ITEM_TYPE.STARTUP,
  ITEM_TYPE.CALIBRATION,
];

// Items in these sections have no fixed catalog price (PRF) — they're always
// manually priced per quote via ExtrasBox rather than picked with a qty.
export const MANUAL_PRICE_TYPES: string[] = [
  ITEM_TYPE.ISO_CERTIFICATION,
  ITEM_TYPE.STARTUP,
  ITEM_TYPE.CUSTOMIZATION,
  ITEM_TYPE.SHIPPING,
];

export const INCOTERMS = [
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
] as const;

export const WORK_ORDER_FIELDS = {
  workOrderNumber: 'workOrderNumber',
  buildType: 'buildType',
  productType: 'productType',
  customer: 'customer',
  priority: 'priority',
  dateReceived: 'dateReceived',
} as const;

export const WORK_ORDER_LINE_ITEM_FIELDS = {
  workOrder: 'workOrder',
  partNumber: 'partNumber',
  description: 'description',
  quantityRequired: 'quantityRequired',
  unitCost: 'unitCost',
  // ponytail: `inventoryItem` is required:true server-side (verified live) even
  // though the spec asks to leave it empty — deliberately omitted here. See
  // App.tsx pushToWorkOrder() for the surfaced error this causes today, and
  // workspace/work_order_line_item_.../fields.ts for the staged (unpushed) fix.
} as const;

export const COMMISSION_TIERS = [0, 1.6, 5, 10, 15, 20, 25, 35] as const;

// Special-case labels for tiers that represent something other than a plain
// agent cut (e.g. 1.6% is the NET60 payment-terms surcharge, not commission).
export const COMMISSION_TIER_LABELS: Partial<Record<(typeof COMMISSION_TIERS)[number], string>> = {
  1.6: 'NET60 Payment',
};

// Opportunity (quotes live in the Proposal phase; Discovery is pre-quote by design).
// Fields have no keys in this workflow — hex IDs used directly.
// Quoted Total Revenue is a function field that sums the € parts — never write it.
export const OPPORTUNITY = {
  workflowId: '6a041734fc4db70b8339a63e',
  proposalPhaseId: '6a0428a8fc4db70b833a3aa6',
  discoveryPhaseId: '6a041734fc4db70b8339a639',
  fields: {
    configuratorDraftJson: '6a8e8598201471f67b45bc7e', // JSON blob — Save Draft / Resume Draft state
    leadInformation: '6a045b3869ca0986f1f788ba', // activitylink -> Customers | Contact persons (Account + Contact)
    proposalDate: '6a045f6b69ca0986f1f7a241',
    quoteExpirationDate: '6a045f7f69ca0986f1f7a333',
    productName: '6a04622d69ca0986f1f7be45', // required dropdown, options = raw sheet codes
    baseProduct: '6a046c0e69ca0986f1f81428', // € list price, pre-commission
    iso17025: '6a046c4b69ca0986f1f81815', // € — ISO 17025 Certification only
    calibration: '6a8d1dcacac73beca6b4cadb', // € — on-site/in-house calibration service
    standardOptions: '6a046c8a69ca0986f1f81d87', // € sum, pre-commission
    customOptions: '6a046d5969ca0986f1f826fa', // € sum, pre-commission
    customization: '6a046db169ca0986f1f82bfd', // €
    startup: '6a046dd769ca0986f1f82daa', // €
    shipping: '6a046e3a69ca0986f1f83261', // €
    agentCommissionPct: '6a43a1633eb603adc29a5fb3',
    commissionAmount: '6a43a19a3eb603adc29a6119', // €
    // Quote header details (added for the sectioned quote template).
    proposalReference: '6a8d1dc9cac73beca6b4cac4', // text, e.g. "E4452.02 (revision 03)"
    internalReference: '6a8d1dc9cac73beca6b4cac7', // numeric
    agent: '6a8d1dc9cac73beca6b4caca', // activitylink -> Customers (reseller/distributor)
    shipTo: '6a8d1dc9cac73beca6b4cacd', // text
    finalDestinationCountry: '6a8d1dcacac73beca6b4cad0', // dropdown
    hsCode: '6a8d1dcacac73beca6b4cad3', // text
    incoterms: '6a8d1dcacac73beca6b4cad6', // dropdown
  },
} as const;

// Customers — used for Account / Agent pickers in the quote header.
export const CUSTOMERS = {
  workflowId: '6a041d0ffc4db70b8339c891',
  phaseId: '6a041d0ffc4db70b8339c89c',
  fields: {
    streetAddress: '6a508cd12ea5e9da20741d68',
    city: '6a041d0ffc4db70b8339c897',
    country: '6a3cbc95c15e261f4512e9a0',
  },
} as const;

// Contact persons — used for the Contact picker in the quote header.
export const CONTACTS = {
  workflowId: '6a041d0ffc4db70b8339c89a',
  phaseId: '6a041d0ffc4db70b8339c8e5',
  fields: {
    firstName: '6a041d0ffc4db70b8339c8e0',
    lastName: '6a041d0ffc4db70b8339c8e1',
    phone: '6a041d0ffc4db70b8339c8e2',
    email: '6a041d0ffc4db70b8339c8c5',
    company: '6a041d0ffc4db70b8339c8e4', // activitylink -> Customers
  },
} as const;

// Rentals — a rental is its own lifecycle entity (Discovery -> ... -> Closed),
// not a priced quote line item, so it lives on its own tab (RentalPush.tsx)
// rather than riding the ITEM_TYPE/SECTIONS pricing pipeline. Fields have
// keys, resolve via field resolver.
export const RENTALS_DISCOVERY_PHASE = '6a99429b65a81755cf3190ce';

export const RENTALS_FIELDS = {
  customer: 'customer',
  rentalUnit: 'rental_unit',
  rentalStartDate: 'rental_start_date',
  rentalEndDate: 'rental_end_date', // label "Return Due Date"
  weeklyRate: 'weekly_rate',
  deposit: 'deposit',
  startupFee: 'startup_fee', // one-time on-site setup/training — separate from Weekly Rate
  shippingCost: 'shipping_cost', // billed at cost, not a fixed catalog rate
  shipTo: 'ship_to',
  poReference: 'po_reference',
  notes: 'notes',
} as const;

// Per the Newton Rental Package reference doc: "20% of the total rental fee
// will be credited against the purchase price of a new [...] system" if the
// customer later decides to buy instead of just renting. Applies to the
// recurring rental fee only (weekly rate x weeks) — Startup Fee and Shipping
// are separate, pass-through/one-time charges, not part of "the rental fee."
export const RENTAL_PURCHASE_CREDIT_PCT = 0.2;

// Rental Fleet — flat dataset (enableUnlinkedMode: true) but still has one phase.
export const RENTAL_FLEET_PHASE = '6a99429d65a81755cf3190e5';

export const RENTAL_FLEET_FIELDS = {
  productFamily: 'product_family',
  serialNumber: 'serial_number',
  status: 'status',
} as const;

// Calibration Rates dataset — fields have keys, resolve via field resolver.
export const CALIBRATION = {
  workflowId: '6a687f173ca04dbbb1afaf49',
  phaseId: '6a687f173ca04dbbb1afaf48',
  fields: {
    rowType: 'row_type',
    daysTraveling: 'days_traveling',
    airfare: 'airfare',
    carPerDay: 'car_per_day',
    hotelPerDay: 'hotel_per_day',
    foodPerDay: 'food_per_day',
    daysOnSite: 'days_on_site',
    partsCost: 'parts_cost',
    value: 'value',
  },
} as const;
