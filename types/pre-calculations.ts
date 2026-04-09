
export type ChinaDomesticRateMethod = 'volume' | 'weight' | 'fixed';

export interface GeneralSettings {
  shippingChinaUsdPerM3: number;
  exchangeRateForShipping: number;
  deliveryAlmatyKaragandaKztPerM3: number;
  svhKzt: number;
  brokerKzt: number;
  customsFeesKzt: number;
  exchangeRateUsd: number;
  exchangeRateCny: number;
  ndsRate: number;
  kpn20Rate: number;
  kpn4Rate: number;
  resaleMarkup: number;
  salesBonusRate: number;

  // Доставка по Китаю (внутренняя логистика)
  chinaDomesticRateMethod: ChinaDomesticRateMethod; // 'volume' | 'weight' | 'fixed'
  chinaDomesticRatePerM3Usd: number;   // рейт за м³ (метод volume)
  chinaDomesticRatePerTonUsd: number;  // рейт за тонну (метод weight)
  chinaDomesticFixedKztPerUnit: number; // фиксированная цена за ед. (метод fixed)
}

export interface PreCalculationItem {
  id: string;
  productId?: string;
  orderId?: string;
  clientName?: string;

  name: string;
  sku?: string;
  type: 'MACHINE' | 'PART';
  manufacturer?: string;
  hsCode?: string;
  options?: PreCalculationItemOption[];

  quantity: number;
  supplierName: string;
  revenueKzt: number;
  isRevenueConfirmed: boolean;
  
  // Прочие расходы
  pnrKzt: number;
  deliveryLocalKzt: number;
  salesBonusKzt: number;
  
  marginPercentage: number;
  taxRegime: 'Общ.' | 'Упр.';

  purchasePrice: number;
  purchasePriceCurrency: 'USD' | 'CNY';
  purchasePriceKzt: number;
  purchasePriceBreakdown?: Record<string, number>; // { USD: 10000, CNY: 500 } — для мультивалютных конфигураций

  volumeM3: number;
  weightKg: number;
  packages: { lengthMm: number; widthMm: number; heightMm: number }[];
  useDimensions: boolean;

  deliveryUrumqiAlmatyKzt: number;      // Доставка Урумчи–Алматы (за единицу)
  deliveryChinaDomesticKzt: number;     // Доставка по Китаю (за единицу)
  customChinaDomestic?: boolean;        // true = ручной ввод, не пересчитывать из настроек
  deliveryAlmatyKaragandaPerItemKzt: number;
  svhPerItemKzt: number;
  brokerPerItemKzt: number;
  customsFeesPerItemKzt: number;

  customsNdsKzt: number;
  totalNdsKzt: number;
  ndsDifferenceKzt: number;
  kpnKzt: number;

  preSaleCostKzt: number;
  fullCostKzt: number;
  profitKzt: number;
}

export interface PreCalculationItemOption {
  typeId: string;
  typeName: string;
  variantId: string;
  variantName: string;
}

export interface PackingListItem {
  description: string | number | readonly string[];
  id: string;
  placeNumber: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  volumeM3: number;
  items: {
    detailedItemId: any; preCalculationItemId: string; quantity: number 
  }[];
}

export interface PreCalculationDocument {
    id: string;
    name: string;
    date: string;
    status: 'draft' | 'finalized';
    settings: GeneralSettings;
    items: PreCalculationItem[];
    packingList: PackingListItem[];
}
