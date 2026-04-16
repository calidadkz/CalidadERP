# Модуль: Inventory (Склад)
> Связанные заметки: [[Architecture]] | [[DataModel]] | [[Modules/Procurement-Sales]]
> Дата документирования: 2026-04-06

## Назначение
Центральный модуль учёта товарных остатков. Показывает реальное состояние склада в разрезе товаров и комплектаций. Позволяет делать инвентаризацию и корректировки.

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/inventory/InventoryPage.tsx` | Точка входа, таб-навигация (desktop + mobile branch) |
| `features/inventory/components/StockTable.tsx` | Таблица остатков (desktop) |
| `features/inventory/components/MovementsTable.tsx` | История движений (desktop) |
| `features/inventory/components/MobileInventoryView.tsx` | **Мобильный UI** — карточки остатков + движений |
| `features/inventory/components/AdjustmentForm.tsx` | Форма корректировки остатков |
| `features/inventory/components/InventoryVerificationReport.tsx` | Акт инвентаризации (default export) |
| `features/inventory/hooks/useInventoryState.ts` | CRUD товаров, движений |
| `features/inventory/hooks/useInventoryData.ts` | Расчёт агрегированных остатков |
| `features/inventory/hooks/useInventoryFilters.ts` | Фильтрация/поиск |
| `services/InventoryService.ts` | Бизнес-расчёты остатков |
| `services/InventoryMediator.ts` | Оркестрация: создаёт движения при событиях |

## Мобильная версия (добавлена 2026-04-16)

`MobileInventoryView` принимает `{ state, actions, access }` — не использует `useStore` напрямую, получает всё от `InventoryPage`.

**StockCard**: раскрывается при наличии конфигураций (станки) или нескольких breakdown-строк. Grid 4 метрик: Склад / В пути / Резерв / Стоимость.

**MovementCard**: поле `revertInitialStockEntry` доступно только для `documentType === 'Adjustment'` без уже существующего reversal.

**InventoryVerificationReport** — `export default`, не named export. Импортировать без фигурных скобок.

Связано: [[Modules/UI-Mobile]]

## Модель данных

### StockMovement (движение товара)
```typescript
{
  type: 'In' | 'Out'
  statusType: 'Physical' | 'Incoming' | 'Reserved'
  documentType: 'Order' | 'SalesOrder' | 'Reception' | 'Shipment' | 'Adjustment'
  documentId: string        // ID источника (заказ, приёмка и т.д.)
  unitCostKzt: number
  salesPriceKzt?: number
  configuration?: string[]  // комплектация варианта
}
```

### Формула остатков (InventoryService)
```
Physical  = сумма физических движений (приёмки)
Incoming  = сумма ожидаемых движений (подтверждённые заказы)
Reserved  = сумма зарезервированных (подтверждённые продажи)
Free      = Physical + Incoming - Reserved
```

## Бизнес-логика

### Когда создаются движения (InventoryMediator)
| Событие | Документ | Статус движения |
|---|---|---|
| Подтверждение заказа | SupplierOrder | `Incoming` In |
| Подтверждение продажи | SalesOrder | `Reserved` In |
| Проводка приёмки | Reception | `Physical` In + снятие `Incoming` |
| Проводка отгрузки | Shipment | `Physical` Out + снятие `Reserved` |
| Корректировка | Adjustment | `Physical` In/Out |

### Себестоимость
При приёмке рассчитывается `finalCostUnitKzt` = (базовая стоимость + распределённые расходы на единицу).
Средняя стоимость обновляется через `InventoryService.calculateNewWeightedAverageCost()`.

### Расхождения (Discrepancy)
Если при приёмке `qtyFact < qtyPlan` — создаётся запись Discrepancy.
Варианты решения: `Write_Off` / `Repair` / `Next_Shipment`.

## Особенности
- `configuration?: string[]` — массив ID выбранных вариантов опций. Один товар может иметь разные конфигурации на складе.
- Таблица `v_inventory_summary` — view в Supabase для агрегированных остатков (не читается напрямую через движения).
- Корректировки имеют `documentType: 'Adjustment'` и не привязаны к документу.
