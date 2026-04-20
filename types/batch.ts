export type BatchStatus =
  | 'open'
  | 'manufacturing'
  | 'transit_china'
  | 'transit_almaty'
  | 'customs'
  | 'transit_karaganda'
  | 'receiving'
  | 'setup_shipping'
  | 'completed';

export interface BatchStatusRecord {
  id: BatchStatus;
  label: string;
  sortOrder: number;
  color: string;
}

export interface BatchTimeline {
  startDate?: string;             // Дата старта (от которой считаются все этапы)
  approvalDays: number;           // Согласование заявки
  manufacturingDays: number;      // Изготовление
  chinaDeliveryDays: number;      // Доставка по Китаю
  urumqiAlmatyDays: number;       // Доставка Урумчи–Алматы
  almatyKaragandaDays: number;    // Доставка Алматы–Карагандо
  commissioningDays: number;      // Пусконаладка
}

export type ExpenseCategory =
  | 'logistics_urumqi_almaty'      // Доставка Урумчи–Алматы
  | 'logistics_almaty_karaganda'   // Доставка Алматы–Караганда
  | 'logistics_china_domestic'     // Доставка по Китаю
  | 'customs_vat'                  // НДС Таможенный
  | 'sales_vat'                    // НДС итоговый при продаже
  | 'resale_vat'                   // НДС от перепродажи (Упрощёнка)
  | 'kpn_simplified'               // КПН (Упр.)
  | 'kpn_standard'                 // КПН20
  | 'svh'                          // СВХ
  | 'broker'                       // Брокер
  | 'customs'                      // Таможенные сборы
  | 'pnr'                          // Пусконаладка
  | 'delivery_local'               // Доставка до клиента
  | 'sales_bonus'                  // Бонус отдела продаж
  | 'other'                        // Прочее
  | 'revenue';                     // Выручка

export interface Batch {
  id: string;
  preCalculationId: string;
  name: string;
  status: BatchStatus;
  date: string;
  updatedAt: string;
  notes?: string;

  // Связанные заказы поставщикам
  supplierOrderIds: string[];

  // Milestone-даты
  expectedArrivalDate?: string;
  customsDate?: string;
  closedDate?: string;

  // Плановые показатели (фиксируются при создании из предрасчёта)
  plannedRevenueKzt: number;
  plannedPurchaseKzt: number;
  plannedLogisticsUrumqiAlmatyKzt: number;   // Доставка Урумчи–Алматы
  plannedLogisticsAlmatyKaragandaKzt: number; // Доставка Алматы–Караганда
  plannedLogisticsChinaDomesticKzt: number;   // Доставка по Китаю
  plannedSvhKzt: number;
  plannedBrokerKzt: number;
  plannedCustomsKzt: number;

  // Итоговые (пересчитываются)
  totalPlannedProfit?: number;
  totalActualProfit?: number;

  // Планирование сроков
  timeline?: BatchTimeline;

  // Позиции, помеченные на удаление (в статусе manufacturing)
  deletedItemIds?: string[];
}

export interface BatchItemActuals {
  id: string;
  batchId: string;
  preCalculationItemId: string;
  actualRevenueKzt: number;
  actualPurchaseKzt: number;
}

// Правила распределения суммы доставки по Китаю между позициями партии
export interface ChinaDeliveryDistribution {
  method: 'volume' | 'weight' | 'manual';
  targetItemIds: string[];              // [] = все позиции партии
  manualAmounts?: Record<string, number>; // preCalcItemId → сумма KZT
}

export interface BatchExpense {
  id: string;
  batchId: string;
  category: ExpenseCategory;
  description: string;
  amountKzt: number;
  date: string;
  paymentId?: string;        // Связь с actual_payments (Выписка)
  plannedPaymentId?: string; // Связь с planned_payments (Календарь)
  allocationId?: string;     // Связь с payment_allocations.id (Аллокации)
  documentIds?: string[];
  receptionId?: string;      // Авто-создан из приёмки (Receiving)
  chinaDistribution?: ChinaDeliveryDistribution; // Только для logistics_china_domestic
}

export interface BatchDocument {
  id: string;
  batchId: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
}
