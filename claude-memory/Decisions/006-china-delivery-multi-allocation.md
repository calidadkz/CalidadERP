# ADR-006: China Delivery Multi-Allocation
> Связанные заметки: [[Architecture]] | [[Session-Log]] | [[Modules/Batches-PreCalc]]
> Дата: 2026-04-15
> Статус: Принято

## Контекст

В одной партии могут быть станки от нескольких заводов Китая, каждый с отдельным транспортом и платежом. Старая система хранила расходы `logistics_china_domestic` как обычные `BatchExpense` и распределяла их по позициям поровну (фоллбэк при `grandPlan = 0`) — это давало неверные цифры.

Нужна возможность:
- Привязать несколько платежей за доставку по Китаю к одной партии
- Для каждого платежа указать, к каким конкретно позициям он относится
- Выбрать метод распределения: по объёму, по весу или вручную

## Рассмотренные варианты

1. **Отдельная таблица `batch_china_allocations`** — явная нормализация, FK на позиции.  
   Плюсы: чистая реляционная модель. Минусы: дополнительные JOIN-ы, усложнение CRUD, новые миграции при любом изменении полей.

2. **JSONB-поле `china_distribution` внутри `batch_expenses`** — правила распределения хранятся вместе с расходом.  
   Плюсы: нет новых таблиц, один insert создаёт и расход и его правила, легко читается локально. Минусы: нельзя делать SQL-запросы внутри JSON без специфики.

## Принятое решение

Выбран **вариант 2** — JSONB-поле `china_distribution` в `batch_expenses`.

Структура:
```typescript
interface ChinaDeliveryDistribution {
  method: 'volume' | 'weight' | 'manual'
  targetItemIds: string[]               // [] = все позиции партии
  manualAmounts?: Record<string, number> // preCalcItemId → KZT
}
```

`targetItemIds: []` означает "применить ко всем позициям" — не нужно перезаписывать при добавлении новых позиций в предрасчёт.

Защита от конвертации: `chinaDistribution` добавлен в `PROTECTED_JSON_FIELDS` в `api.ts` — ApiService не трогает ключи внутри этого объекта.

## Последствия

**Плюсы:**
- N заводов = N записей `BatchExpense` с независимыми правилами, схема не меняется
- Логика распределения читается рядом с данными
- Фоллбэк при отсутствии `chinaDistribution` — по объёму (исправлен старый баг с равным делением)
- `allocateExpensesToItems` вынесен в `features/batches/utils/batchExpenseAllocation.ts` — переиспользуется в таблице позиций и в превью формы

**Минусы / компромиссы:**
- Нельзя сделать `SELECT * WHERE method = 'weight'` без `jsonb_extract` в SQL
- При ручном методе суммы по позициям хранятся денормализованно — нет автоматической проверки что `∑manualAmounts = amountKzt` на уровне БД

## Связанный код

- `types/batch.ts` — тип `ChinaDeliveryDistribution`, поле `BatchExpense.chinaDistribution?`
- `services/api.ts` — `PROTECTED_JSON_FIELDS` добавлен `'chinaDistribution'`
- `features/batches/utils/batchExpenseAllocation.ts` — функция `allocateExpensesToItems`
- `features/batches/components/ChinaDeliveryForm.tsx` — форма с вкладками + превью
- `features/batches/components/ChinaDeliveryModal.tsx` — список записей + шелл
- DB: `batch_expenses.china_distribution jsonb NULL`
