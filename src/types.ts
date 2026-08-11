export interface PriceListItem {
  _id: string;
  name: string;
  itemId: string;
  productCode: string;
  description: string;
  itemType: 'main' | 'standard option' | 'custom option' | 'calibration';
  parentId?: string;
  cost?: number;
  price?: number; // undefined = price on request (PRF)
}

export interface ConfigLine {
  item: PriceListItem;
  qty: number;
}

export interface WorkOrderSummary {
  _id: string;
  name: string;
  workOrderNumber?: string;
  customerName?: string;
  buildType?: string;
  phaseId: string;
}
