# ADR-002: Мультивалютные позиции в предрасчёте — упаковка breakdown в JSON
> Связанные заметки: [[Architecture]] | [[Modules/Batches-PreCalc]] | [[Session-Log]]
> Дата: 2026-04-07
> Статус: Принято

## Контекст

В предрасчёте каждая позиция имеет `purchasePrice` + `purchasePriceCurrency` (USD или CNY).
Проблема возникает при станках с опциями в разных валютах: станок USD, но часть опций в CNY.

`PricingService.calculateBundlePurchasePrice` конвертирует всё в валюту станка по курсам из **GlobalStore** (рыночные).
При добавлении в предрасчёт цена записывается как одно число в валюте станка — CNY-компонент уже «растворён».

Когда пользователь меняет `exchangeRateCny` в настройках предрасчёта (фиксирует собственный курс),
CNY-часть опций продолжает считаться по старому рыночному курсу — пересчёта не происходит.

## Рассмотренные варианты

1. **Новая колонка `purchase_price_breakdown jsonb` в `pre_calculation_items`**
   — Чисто с точки зрения схемы
   — Требует миграции БД и правки ApiService-маппинга
   — Избыточно: данные уже есть в `options` (JSON-поле, не конвертируемое)

2. **Упаковка breakdown в существующее JSON-поле `options`**
   — Не требует миграции
   — `options` уже является защищённым полем (не конвертируется ApiService)
   — Обратно совместимо: старые записи содержат массив `[...]`, новые — объект `{ variants: [...], breakdown: {...} }`
   — Небольшая неочевидность формата при чтении

3. **Хранить breakdown только в памяти, не персистить**
   — Пересчёт работает пока открыт документ
   — При перезагрузке / повторном открытии breakdown теряется → регрессия

## Принятое решение

**Вариант 2** — упаковка в `options`.

При сохранении:
```typescript
options: item.purchasePriceBreakdown
  ? { variants: item.options || [], breakdown: item.purchasePriceBreakdown }
  : (item.options || [])
```

При загрузке:
```typescript
options: Array.isArray(raw) ? raw : raw?.variants || []
purchasePriceBreakdown: Array.isArray(raw) ? undefined : raw?.breakdown
```

Определение формата по `Array.isArray` — простой discriminant, не требует версионирования.

## Последствия

**Плюсы:**
- Нет миграции БД
- Обратная совместимость: старые позиции (массив) читаются без изменений
- Пересчёт `purchasePriceKzt` теперь честно разбивает: `USD * exchangeRateUsd + CNY * exchangeRateCny`
- При ручном изменении `purchasePrice` пользователем — breakdown сбрасывается, расчёт возвращается к простой формуле

**Минусы / компромиссы:**
- Поле `options` теперь полиморфно: массив ИЛИ объект — нужно учитывать при любой будущей работе с этим полем
- Если добавятся другие валюты (EUR, RUB) — они автоматически попадут в breakdown, но будут конвертированы по USD-курсу (fallback). Требует явного расширения логики при необходимости

## Связанный код

- `types/pre-calculations.ts` — поле `purchasePriceBreakdown?: Record<string, number>`
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx` — функция `computePriceBreakdown()`
- `features/pre-calculations/hooks/usePreCalculations.ts` — пересчёт в `calculatedItemsResult`, упаковка при сохранении, распаковка при загрузке
- `services/PricingService.ts` — `calculateBundlePurchasePrice()` (источник данных для breakdown)
