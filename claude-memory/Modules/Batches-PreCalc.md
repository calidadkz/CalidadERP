# Модуль: Batches & Pre-calculations (Партии и Предрасчёты)
> Связанные заметки: [[Architecture]] | [[DataModel]] | [[Modules/Procurement-Sales]] | [[Modules/Finance]]
> Дата документирования: 2026-04-06

## Назначение
**Предрасчёт** — инструмент расчёта себестоимости и рентабельности **до** оформления заказа.
Учитывает закупочную цену, логистику из Китая, таможню, НДС, маржу.

**Партия (Batch)** — связана с предрасчётом и отслеживает **фактическое** исполнение: реальные расходы, выручку, итоговую прибыль в сравнении с планом.

## Ключевые файлы

### Pre-calculations
| Файл | Назначение |
|---|---|
| `features/pre-calculations/PreCalculationsRouter.tsx` | Роутер модуля |
| `features/pre-calculations/pages/PreCalculationsListPage.tsx` | Список документов |
| `features/pre-calculations/pages/PreCalculationEditorPage.tsx` | Редактор |
| `features/pre-calculations/components/general-settings/GeneralSettings.tsx` | Параметры расчёта |
| `features/pre-calculations/components/detailed-list/DetailedList.tsx` | Таблица позиций |
| `features/pre-calculations/components/detailed-list/AddItemModal.tsx` | Добавление позиции |
| `features/pre-calculations/components/packing-list/PackingList.tsx` | Упаковочный лист |
| `features/pre-calculations/hooks/usePreCalculations.ts` | Логика и CRUD |

### Batches
| Файл | Назначение |
|---|---|
| `features/batches/BatchesPage.tsx` | Список партий |
| `features/batches/BatchDetailPage.tsx` | Детальная страница партии |
| `features/batches/components/BatchEconomyTab.tsx` | Экономика: план vs факт |
| `features/batches/components/BatchExpensesTab.tsx` | Фактические расходы |
| `features/batches/components/BatchDocumentsTab.tsx` | Документы партии |
| `features/batches/hooks/useBatches.ts` | CRUD партий |
| `services/BatchCalculator.ts` | Расчёт статистики партии |

## Модель данных

### PreCalculationDocument
```typescript
{
  status: 'draft' | 'finalized'
  settings: GeneralSettings    // параметры расчёта (общие для документа)
  items: PreCalculationItem[]
  packingList: PackingListItem[]
}
```

### GeneralSettings (параметры расчёта)
```typescript
{
  shippingChinaUsdPerM3: number       // доставка из Китая USD/м³
  exchangeRateForShipping: number
  deliveryAlmatyKaragandaKztPerM3: number
  svhKzt / brokerKzt / customsFeesKzt: number
  exchangeRateUsd / exchangeRateCny: number
  ndsRate / kpn20Rate / kpn4Rate: number
  resaleMarkup / salesBonusRate: number
}
```

### PreCalculationItem (позиция предрасчёта)
Ключевые поля расчёта:
```typescript
{
  type: 'MACHINE' | 'PART'
  purchasePrice: number
  purchasePriceCurrency: 'USD' | 'CNY'
  purchasePriceKzt: number        // конвертировано
  volumeM3 / weightKg: number
  
  // Расходы (рассчитываются от настроек)
  deliveryUrumqiAlmatyKzt: number  // бывший deliveryChinaKzt (rename 2026-04-07)
  deliveryAlmatyKaragandaPerItemKzt: number
  svhPerItemKzt / brokerPerItemKzt / customsFeesPerItemKzt: number
  
  // Налоги
  customsNdsKzt / totalNdsKzt / ndsDifferenceKzt: number
  kpnKzt: number                  // КПН (корпоративный налог)
  
  // Итог
  preSaleCostKzt: number          // себестоимость до продажи
  fullCostKzt: number             // полная себестоимость
  profitKzt: number               // плановая прибыль
  revenueKzt: number              // выручка (подтверждённая или расчётная)
  taxRegime: 'Общ.' | 'Упр.'     // влияет на расчёт налогов
}
```

### Batch
```typescript
{
  preCalculationId: string      // связь с предрасчётом
  status: 'active' | 'completed' | 'closed'
  totalPlannedProfit?: number
  totalActualProfit?: number
}
```

### BatchExpense (фактический расход партии)
```typescript
{
  category: 'logistics_urumqi_almaty' | 'logistics_almaty_karaganda' | 'logistics_china_domestic'
           | 'customs_vat' | 'sales_vat' | 'resale_vat'
           | 'kpn_simplified' | 'kpn_standard'
           | 'svh' | 'broker' | 'customs' | 'pnr' | 'delivery_local'
           | 'other' | 'revenue'
  // Устаревшие (migration 2026-04-07): logistics_china → logistics_urumqi_almaty, logistics_local → logistics_almaty_karaganda
  amountKzt: number
  paymentId?: string            // связь с actual_payments (выписка)
  plannedPaymentId?: string     // связь с planned_payments (календарь)
  documentIds?: string[]        // прикреплённые документы
}
```

## Бизнес-логика

### Поток: Предрасчёт → Партия
```
PreCalculation (draft) → finalized → Batch (active)
                                          ↓
                              Фиксируются фактические расходы
                              Привязываются платежи из выписки
                                          ↓
                              BatchCalculator.calculateBatchStats()
                              (план vs факт)
                                          ↓
                                    Batch (completed/closed)
```

### Расчёт статистики партии (BatchCalculator)
```
plannedProfit  = сумма item.profitKzt из предрасчёта
actualRevenue  = сумма BatchItemActuals.actualRevenueKzt
totalExpenses  = сумма BatchExpense.amountKzt
actualProfit   = actualRevenue - totalExpenses
profitDiff%    = (actualProfit - plannedProfit) / |plannedProfit| * 100
```

### Упаковочный лист (PackingList)
Каждое "место" (`PackingListItem`) содержит набор позиций предрасчёта.
Используется для формирования документов на таможню.

### Связь с финансами
`BatchExpense.paymentId` → `ActualPayment.id`
`BatchExpense.plannedPaymentId` → `PlannedPayment.id`
`PaymentAllocation.batchId` → `Batch.id`
Позволяет отслеживать полный денежный поток партии.
