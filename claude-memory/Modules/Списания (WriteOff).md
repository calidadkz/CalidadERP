# Модуль: Списания (WriteOff)
> Связанные заметки: [[Architecture]] | [[Session-Log]] | [[Modules/Inventory]]
> Дата документирования: 2026-04-13 (обновлено)

## Назначение
Прямые ручные списания товара со склада — потери, поломки, инвентаризационные разницы, компенсации за брак.
Маршрут: `/discrepancy` → `WriteOffPage`.

## 2-этапный процесс списания

### Этап 1: Черновик (`status = 'Draft'`)
- Создаётся через «Новое списание» → `createWriteOff`
- Запись сохраняется в `stock_writeoffs` без движения по складу
- `unitCostKzt = 0`, `movementId = null`
- Можно создать даже если товара нет на складе (черновик-заявка)

### Этап 2: Проведение (`status = 'Posted'`)
- Кнопка «Провести» в списке (для черновиков) → `postWriteOff`
- Или автоматически при создании если на складе есть остаток (чекбокс «Провести сразу»)
- Проверяет: `physicalQty >= quantity` (иначе ошибка)
- Вычисляет среднюю себестоимость: `totalValueKzt / physicalQty` из `v_inventory_summary`
- Создаёт движение `Out / Physical / documentType='WriteOff'`
- Обновляет запись: `status='Posted'`, `movementId`, `unitCostKzt`

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/warehouse/pages/WriteOffPage.tsx` | Список списаний, KPI, статусы, кнопка «Провести» |
| `features/warehouse/components/WriteOffModal.tsx` | Форма создания: показывает остаток, себестоимость, чекбокс «Провести сразу» |
| `features/warehouse/components/ReasonTypesModal.tsx` | CRUD справочника типов причин |
| `features/inventory/hooks/useInventoryState.ts` | `createWriteOff`, `postWriteOff`, `deleteWriteOff` |
| `features/system/hooks/useReferenceState.ts` | `writeoffReasonTypes` state + CRUD |
| `features/system/context/GlobalStore.tsx` | Загрузка + экспорт actions |
| `types/inventory.ts` | Интерфейсы `WriteOff`, `WriteOffReasonType`, `WriteOffDocument` |

## Структура данных

### TypeScript
```typescript
interface WriteOff {
    id: string;           // Генерируется заранее (WO-xxxx)
    date: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCostKzt: number;  // 0 для черновиков; заполняется при проведении (avg cost)
    reasonNote?: string;
    reasonTypeId?: string;
    documents: WriteOffDocument[];
    movementId?: string;  // ID связанного stock_movements (только для Posted)
    status?: 'Draft' | 'Posted';  // Default 'Posted' для старых записей
    createdAt?: string;
}
```

### БД (Supabase)
**`stock_writeoffs`** — записи списаний
- `id text PK`, `date date`, `product_id text FK→products`, `product_name text`, `sku text`
- `quantity numeric`, `unit_cost_kzt numeric`
- `reason_note text`, `reason_type_id uuid FK→writeoff_reason_types ON DELETE SET NULL`
- `documents jsonb DEFAULT '[]'`, `movement_id text`, `status text DEFAULT 'Draft'`
- `created_at timestamptz`

**`writeoff_reason_types`** — справочник типов (редактируемый)
- `id uuid PK`, `name text`, `color text`, `sort_order int`, `created_at timestamptz`

## Бизнес-логика

### `createWriteOff` (Этап 1 — черновик)
1. Проверяет что товар существует
2. Сохраняет в `stock_writeoffs` с `status='Draft'`, `unitCostKzt=0`, `movementId=null`
3. НЕ создаёт движения по складу

### `postWriteOff` (Этап 2 — проведение)
1. Находит запись в `inventorySummary` по `productId` (без конфигурации)
2. Проверяет: `physicalQty >= quantity` (иначе бросает ошибку)
3. Считает `avgCost = totalValueKzt / physicalQty`
4. Создаёт `StockMovement { type:'Out', statusType:'Physical', documentType:'WriteOff' }`
5. Обновляет запись: `status='Posted'`, `movementId`, `unitCostKzt=avgCost`

### `deleteWriteOff`
- `Draft` → просто удаляет запись из `stock_writeoffs`
- `Posted` → создаёт сторно-движение `In/Physical` + удаляет запись

### Себестоимость
Используется **средняя** (avg) из `v_inventory_summary.totalValueKzt / stock`.
Не FIFO — принято намеренно: это проще и консистентно с тем, что видит пользователь в интерфейсе остатков.

## UI паттерны

### WriteOffModal
- При выборе товара: панель с физическим остатком + средней себестоимостью + суммой потерь (если кол-во введено)
- Чекбокс «Провести сразу» (по умолчанию включён если есть остаток)
- Кнопка меняет текст и цвет: «Провести списание» (красная) vs «Создать черновик» (серая)

### WriteOffPage
- 4 KPI плашки: Всего / Черновиков / Кол-во списано / Сумма потерь
- Колонка «Статус»: бейдж Черновик (amber) / Проведено (emerald)
- Строки черновиков подсвечены `bg-amber-50/20`
- Кнопка «Провести» для черновиков (рядом с удалением)
- Сумма потерь показывается только для проведённых

## Известные особенности / ограничения
- `postWriteOff` работает только для товаров **без конфигурации** (ищет запись с `configuration = []`). Для машин с опциями нужна доработка.
- После проведения `inventorySummary` в памяти не обновляется — view в Supabase обновится при следующем полном refresh
- Удаление списания не удаляет файлы из Firebase Storage
- Старые записи без поля `status` трактуются как `'Posted'` (через `wo.status ?? 'Posted'`)

## История изменений
- 2026-04-09: создан модуль (DB, типы, state, UI)
- 2026-04-13: рефакторинг на 2 этапа (Draft/Posted), исправлен баг с InventoryMediator (не обрабатывал documentType='WriteOff'), добавлен postWriteOff, обновлён UI
