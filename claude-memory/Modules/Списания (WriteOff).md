# Модуль: Списания (WriteOff)
> Связанные заметки: [[Architecture]] | [[Session-Log]] | [[Modules/Inventory]]
> Дата документирования: 2026-04-09

## Назначение
Прямые ручные списания товара со склада — потери, поломки, инвентаризационные разницы, компенсации за брак.
Заменяет старый DiscrepancyPage (который был про расхождения при приёмке).
Маршрут: `/discrepancy` → `WriteOffPage`.

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/warehouse/pages/WriteOffPage.tsx` | Точка входа: список списаний, KPI, поиск, сортировка |
| `features/warehouse/components/WriteOffModal.tsx` | Форма создания списания |
| `features/warehouse/components/ReasonTypesModal.tsx` | CRUD справочника типов причин |
| `features/inventory/hooks/useInventoryState.ts` | `createWriteOff`, `deleteWriteOff` |
| `features/system/hooks/useReferenceState.ts` | `writeoffReasonTypes` state + CRUD |
| `features/system/context/GlobalStore.tsx` | Загрузка + экспорт actions |
| `types/inventory.ts` | Интерфейсы `WriteOff`, `WriteOffReasonType`, `WriteOffDocument` |

## Структура данных

### TypeScript
```typescript
interface WriteOff {
    id: string;           // Генерируется заранее (временный ID = постоянный)
    date: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitCostKzt: number;  // ⚠ Сейчас всегда 0 — не подтягивается из inventorySummary
    reasonNote?: string;
    reasonTypeId?: string;
    documents: WriteOffDocument[];
    movementId?: string;  // ID связанного stock_movements
    createdAt?: string;
}

interface WriteOffReasonType {
    id: string;
    name: string;
    color: string;        // 'red' | 'orange' | 'amber' | 'blue' | 'green' | 'purple' | 'slate'
    sortOrder: number;
}

interface WriteOffDocument {
    name: string;
    url: string;          // Firebase Storage URL
    uploadedAt: string;
}
```

### БД (Supabase)
**`stock_writeoffs`** — записи списаний
- `id text PK`, `date date`, `product_id text FK→products`, `product_name text`, `sku text`
- `quantity numeric`, `unit_cost_kzt numeric`
- `reason_note text`, `reason_type_id uuid FK→writeoff_reason_types ON DELETE SET NULL`
- `documents jsonb DEFAULT '[]'`, `movement_id text`, `created_at timestamptz`

**`writeoff_reason_types`** — справочник типов (редактируемый)
- `id uuid PK`, `name text`, `color text`, `sort_order int`, `created_at timestamptz`
- Дефолтные: Потеря (red), Поломка (orange), Компенсация за брак (amber), Разница при инвентаризации (blue)

## Бизнес-логика

### Создание списания (`createWriteOff`)
1. Генерирует `id = ApiService.generateId('WO')` **при открытии модала** (не при сохранении)
2. Файлы загружаются в Firebase Storage по пути `writeoffs/{id}/` ещё до сохранения в БД
3. При сохранении: сначала `InventoryMediator.processEvent('WriteOff', 'Adjustment', ...)` → создаёт движение `Out` в `stock_movements`
4. Потом `ApiService.create(STOCK_WRITEOFFS, { ...writeoff, movementId })`
5. Тип движения в `stock_movements.documentType` = `'Adjustment'` (не `'WriteOff'`) — InventoryMediator не поддерживает кастомный documentType

### Удаление списания (`deleteWriteOff`)
- Находит исходное движение по `movementId`
- Создаёт **сторно-движение** `In` с описанием `"Отмена списания (исходный: {wo.id})"`
- Удаляет запись из `stock_writeoffs`
- Запись из `stock_movements` НЕ удаляется — только сторно

### Временный ID (паттерн документов)
Аналогично `SalesOrderForm`: ID генерируется при открытии формы → файлы грузятся в `writeoffs/{id}/` → при сохранении этот же ID становится первичным ключом записи. Нет понятия «временного хранилища» — папка просто создаётся заранее.

## Связанные модули
- [[Modules/Inventory]] — движения попадают в `stock_movements`, влияют на остатки
- `DiscrepancyPage` — старый модуль расхождений при приёмке (оставлен, но роут перезаписан)

## Известные особенности / ограничения
- **`unitCostKzt` = 0** при создании — себестоимость не вычисляется автоматически. Нужно подтягивать из `inventorySummary` при выборе товара в форме (TODO)
- **`documentType` в движении = `'Adjustment'`**, хотя логически это `'WriteOff'` — InventoryMediator не поддерживает произвольный documentType без рефакторинга
- **Без overflow-hidden в WriteOffModal**: внешний контейнер модала намеренно не имеет `overflow-hidden` — иначе CalidadSelect обрезается. Если добавить скроллируемые секции внутри, нужно помнить об этом
- Удаление списания не удаляет файлы из Firebase Storage — они остаются навсегда

## История изменений
- 2026-04-09: создан модуль (DB, типы, state, UI), задокументирован
