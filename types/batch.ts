export type BatchStatus = 'active' | 'completed' | 'closed';

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
}

export interface BatchItemActuals {
  id: string;
  batchId: string;
  preCalculationItemId: string;
  actualRevenueKzt: number;
  actualPurchaseKzt: number;
}

export interface BatchExpense {
  id: string;
  batchId: string;
  category: ExpenseCategory;
  description: string;
  amountKzt: number;
  date: string;
  paymentId?: string;        // Связь с actual_payments (Выписка) — подтверждает расход
  plannedPaymentId?: string; // Связь с planned_payments (Календарь) — прогноз оплаты
  documentIds?: string[];
  receptionId?: string;      // Авто-создан из приёмки (Receiving) — источник данных
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
