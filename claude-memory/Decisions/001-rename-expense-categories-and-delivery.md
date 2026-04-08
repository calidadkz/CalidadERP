# ADR-001: Переименование категорий расходов партий и видов доставки
> Связанные заметки: [[Modules/Batches-PreCalc]] | [[Session-Log]]
> Дата: 2026-04-07
> Статус: Принято

## Контекст

В системе исторически использовались нейтральные имена для видов доставки и категорий расходов партий:
- `logistics_china` — доставка из Китая
- `logistics_local` — локальная доставка (Алматы–Кар.)

Эти названия не отражали реальную географию маршрутов, что вызывало путаницу при добавлении расходов. Кроме того, в `batch_expenses` было только 7 категорий, и не было возможности фиксировать НДС, КПН, ПНР, доставку до клиента как отдельные статьи.

В `pre_calculations` колонка называлась `shipping_karaganda_kzt`, а тип TS ожидал `delivery_almaty_karaganda_kzt_per_m3` — рассинхронизация имён БД и кода.

## Рассмотренные варианты

1. **Оставить старые имена, добавить только новые категории** — проще, но путаница с «logistics_china» сохраняется; маршруты не очевидны из кода
2. **Переименовать + мигрировать данные** — требует ALTER TABLE, UPDATE данных и обновления CHECK constraint; зато код и БД говорят одним языком

## Принятое решение

Вариант 2. Выполнена миграция с полным переименованием:

| Старое | Новое |
|--------|-------|
| `logistics_china` | `logistics_urumqi_almaty` (Доставка Урумчи–Алматы) |
| `logistics_local` | `logistics_almaty_karaganda` (Доставка Алматы–Кар.) |
| — | `logistics_china_domestic` (Доставка по Китаю, новая) |
| — | `customs_vat`, `sales_vat`, `resale_vat` (НДС по видам) |
| — | `kpn_simplified`, `kpn_standard` (КПН4 и КПН20) |
| — | `pnr`, `delivery_local` (ПНР и доставка до клиента) |

В `pre_calculation_items`:
- `delivery_china_kzt` → `delivery_urumqi_almaty_kzt`
- `logistics_local_kzt` → `logistics_almaty_karaganda_kzt`

В `batches`:
- `planned_logistics_china_kzt` → `planned_logistics_urumqi_almaty_kzt`
- `planned_logistics_local_kzt` → `planned_logistics_almaty_karaganda_kzt`

В TS-типах: `PreCalculationItem.deliveryChinaKzt` → `deliveryUrumqiAlmatyKzt`

## Последствия

**Плюсы:**
- Код, UI и БД используют единую терминологию
- BatchExpensesTab теперь покрывает все статьи расходов (14 категорий)
- Новый UI: таблица итогов с кнопкой «+» под каждой категорией вместо общей формы

**Минусы / компромиссы:**
- Нужно обновлять CHECK constraint до изменения данных — порядок важен (сначала DROP CONSTRAINT, потом UPDATE, потом ADD CONSTRAINT)
- `logistics_china_domestic` (доставка по Китаю) добавлена как категория расходов, но **пока не интегрирована в расчёты предрасчёта** — отдельная задача

## Важно для будущих миграций категорий в batch_expenses

Всегда делать в таком порядке:
```sql
ALTER TABLE batch_expenses DROP CONSTRAINT batch_expenses_category_check;
UPDATE batch_expenses SET category = 'new_value' WHERE category = 'old_value';
ALTER TABLE batch_expenses ADD CONSTRAINT batch_expenses_category_check CHECK (...);
```
Иначе Supabase отклоняет миграцию с ошибкой `violates check constraint`.

## Связанный код

- `types/batch.ts` — `ExpenseCategory` union type
- `types/pre-calculations.ts` — `PreCalculationItem.deliveryUrumqiAlmatyKzt`
- `features/batches/components/BatchExpensesTab.tsx` — CATEGORIES массив с ключами
- `features/pre-calculations/hooks/usePreCalculations.ts` — расчёт и DB-маппинг
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx` — создание партии
