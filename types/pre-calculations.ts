export interface GeneralSettings {
  shippingChinaUsdPerM3: number;
  exchangeRateForShipping: number;
  deliveryAlmatyKaragandaKzt: number;
  svhKzt: number;
  brokerKzt: number;
  customsFeesKzt: number;
  ndsRate: number;
  kpn20Rate: number;
  kpn4Rate: number;
  resaleMarkup: number;
  salesBonusRate: number;
}

export interface DetailedListItem {
  id: string;
  name: string;
  options?: string[];
  supplierName: string;
  manufacturer: string;
  hsCode: string;
  quantity: number;
  volumeM3: number;
  ignoreDimensions: boolean;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  deliveryToClientKzt: number;
  orderId?: string;
  clientName?: string;
  contractNumber?: string;
  revenueKzt: number;
  isRevenueConfirmed: boolean;
  prepaymentKzt: number;
  isPrepaymentConfirmed: boolean;
  taxRegime: 'Общ.' | 'Упр.';
  // Calculated fields (as in PreCalculationItem)
  purchaseKzt?: number;
  logisticsCnKzt?: number;
  logisticsLocalKzt?: number;
  svhPerItemKzt: number; // Updated name to match PreCalculationItem
  brokerPerItemKzt: number; // Updated name to match PreCalculationItem
  customsFeesPerItemKzt: number; // Updated name to match PreCalculationItem
  totalNdsKzt: number;
  customsNdsKzt?: number; // Optional as in PreCalculationItem
  ndsDifferenceKzt?: number; // Optional as in PreCalculationItem
  kpnKzt?: number; // Optional as in PreCalculationItem
  profitKzt?: number; // Optional as in PreCalculationItem
  marginPercentage?: number; // Optional as in PreCalculationItem
  fullCostKzt?: number; // Added from PreCalculationItem
  preSaleCostKzt?: number; // Added from PreCalculationItem
  salesBonusKzt?: number; // Added from PreCalculationItem
  commissioningKzt?: number; // Added from PreCalculationItem

  // New properties from PreCalculationItem that are not in DetailedListItem but are required
  productName: string; // From PreCalculationItem
  type: string; // From PreCalculationItem, e.g., 'Stock'
  supplierPriceUsd: number; // From PreCalculationItem
  sellingPriceKzt: number; // From PreCalculationItem
}

export interface PackingListItem {
  id: string;
  preCalculationId?: string; // Added from PreCalculationPackage
  packageNumber: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  weightKg?: number;
  volumeM3?: number;
  description?: string;
  items: { detailedItemId: string; quantity: number }[];
  createdAt?: string; // Added from PreCalculationPackage
}

export interface PreCalculation {
  id: string;
  name: string;
  date?: string;
  status: string;
  taxScheme: string;
  exchangeRateUsdKzt: number;
  shippingChinaUsd: number;
  shippingKaragandaKzt: number;
  svhKzt: number;
  brokerKzt: number;
  customsFeesKzt: number;
  customsVatKzt: number;
  totalVolumeM3?: number;
  totalWeightKg?: number;
  notes?: string;
  updatedAt?: string;
  exchangeRateCnyKzt?: number;
  citRateStandard?: number;
  citRateSimplified?: number;
  vatRate?: number;
  intercompanyMarkupPercent?: number;

  // New fields to align with usePreCalculations hook and its internal states
  generalSettings?: GeneralSettings; // Assuming this will be part of the PreCalculation object from DB if it saves the settings
  detailedListItems?: DetailedListItem[]; 
  packingListItems?: PackingListItem[]; 
}

export interface PreCalculationItem {
  id: string;
  preCalculationId?: string;
  productId?: string;
  productName: string;
  sku?: string;
  orderId?: string;
  clientId?: string;
  clientName?: string;
  type: string;
  quantity: number;
  supplierPriceUsd: number;
  sellingPriceKzt: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  weightKg?: number;
  volumeM3?: number;
  purchaseKzt?: number;
  logisticsCnKzt?: number;
  logisticsLocalKzt?: number;
  svhKzt?: number;
  brokerKzt?: number;
  customsFeesKzt?: number;
  customsVatKzt?: number;
  pnrKzt?: number;
  deliveryLocalKzt?: number;
  advertisingKzt?: number;
  bonusKzt?: number;
  taxKzt?: number;
  vatKzt?: number;
  totalExpensesKzt?: number;
  profitKzt?: number;
  marginPercent?: number;
}

export interface PreCalculationPackage {
  id: string;
  preCalculationId?: string;
  packageNumber: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  weightKg?: number;
  volumeM3?: number;
  description?: string;
  items?: any; // You might want to define a more specific type for this JSONB array
  createdAt?: string;
}
