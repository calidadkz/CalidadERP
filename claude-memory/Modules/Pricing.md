# Модуль: Ценообразование (Pricing Profiles)
> Связанные заметки: [[Architecture]] | [[Modules/Batches-PreCalc]]
> Дата документирования: 2026-04-10

## Назначение
Ценовые профили задают **стандартные параметры расчёта цены продажи** для группы товаров.
`PricingService` использует профиль для обратного расчёта: от целевой маржи к цене продажи.

Маршрут: `/pricing` → `PricingManagerPage`

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/products/pages/PricingManagerPage.tsx` | Список профилей + модальная форма создания/редактирования |
| `services/PricingService.ts` | Расчёт цен по профилю, массовый пересчёт |
| `types/product.ts` | Тип `PricingProfile` |

## Модель данных (PricingProfile)
```typescript
{
  name: string
  type: ProductType          // MACHINE | PART
  supplierId?: string        // фильтр по поставщику (опц.)
  applicableManufacturer?: string
  applicableCategoryIds: string[]

  // Логистика
  logisticsRateUsd: number        // тариф Урумчи-Алматы, $/м³
  batchVolumeM3: number           // объём партии, м³
  batchShippingCostKzt: number    // доставка КРГ, ₸ (на партию)
  batchSvhCostKzt: number         // СВХ, ₸ (на партию)

  // Таможня
  brokerCostKzt: number           // брокер, ₸
  customsFeesKzt: number          // таможенные сборы, ₸

  // Налоги
  vatRate: number                 // НДС, %
  citRate: number                 // КПН, %
  salesBonusRate: number          // бонус менеджера, %

  // Сервис
  pnrCostKzt: number              // ПНР, ₸
  deliveryKzt: number             // доставка до клиента, ₸

  // Цель
  targetNetMarginPercent: number  // целевая чистая маржа, %
}
```

## Дефолты нового профиля (актуальные на 2026-04-10)
```
logisticsRateUsd:      150    ($)
batchVolumeM3:          20    (м³)
batchShippingCostKzt: 1200000 (₸)
batchSvhCostKzt:       100000 (₸)
brokerCostKzt:         104000 (₸)
customsFeesKzt:         52000 (₸)
vatRate:                   16 (%)
citRate:                    0 (%)
salesBonusRate:             3 (%)
pnrCostKzt:                 0 (₸)
deliveryKzt:                0 (₸)
targetNetMarginPercent:    25 (%)
```

## Бизнес-логика
Профиль применяется к товарам, у которых совпадают `supplierId`, `applicableManufacturer` и `applicableCategoryIds`.
Приоритет: более специфичный профиль (с поставщиком/производителем) выигрывает у общего.

Кнопка **"Пересчитать"** запускает `PricingService.recalculateProfilePrices()` — обновляет `salesPrice` у всех товаров профиля.

## Экспорт / Импорт
CSV-формат, колонки в порядке полей. Разделитель `;`. Импорт: upsert по имени профиля.
