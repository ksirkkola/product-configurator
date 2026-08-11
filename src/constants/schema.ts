// Hex IDs copied from workspace/enums.ts (never hardcode elsewhere — this is the one file).

export const WORKFLOWS = {
  priceList: '6a6858c8fa66717867108a8a',
  workOrder: '6a4c9c50b7d11c3c37c9ca77',
  workOrderLineItem: '6a4c9c51b7d11c3c37c9ca90',
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
} as const;

export const ITEM_TYPE = {
  MAIN: 'main',
  STANDARD_OPTION: 'standard option',
  CUSTOM_OPTION: 'custom option',
  // App-side only (not a Price List dropdown value): calibration service lines.
  // Commission-exempt — see computeTotals.
  CALIBRATION: 'calibration',
} as const;

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

export const COMMISSION_TIERS = [0, 5, 10, 15, 20, 25, 35] as const;

// Opportunity (quotes live in the Proposal phase; Discovery is pre-quote by design).
// Fields have no keys in this workflow — hex IDs used directly.
// Quoted Total Revenue is a function field that sums the € parts — never write it.
export const OPPORTUNITY = {
  workflowId: '6a041734fc4db70b8339a63e',
  proposalPhaseId: '6a0428a8fc4db70b833a3aa6',
  fields: {
    productName: '6a04622d69ca0986f1f7be45', // required dropdown, options = raw sheet codes
    baseProduct: '6a046c0e69ca0986f1f81428', // € list price, pre-commission
    standardOptions: '6a046c8a69ca0986f1f81d87', // € sum, pre-commission
    customOptions: '6a046d5969ca0986f1f826fa', // € sum, pre-commission
    agentCommissionPct: '6a43a1633eb603adc29a5fb3',
    commissionAmount: '6a43a19a3eb603adc29a6119', // €
    iso17025: '6a046c4b69ca0986f1f81815', // € — quoted calibration certs; calibration lines land here
  },
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
