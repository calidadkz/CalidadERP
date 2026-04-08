# Модуль: Inventory (Склад)
> Связанные заметки: [[Architecture]] | [[DataModel]] | [[Modules/Procurement-Sales]]
> Дата документирования: 2026-04-06

## Назначение
Центральный модуль учёта товарных остатков. Показывает реальное состояние склада в разрезе товаров и комплектаций. Позволяет делать инвентаризацию и корректировки.

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/inventory/InventoryPage.tsx` | Точка входа, таб-навигация |
| `features/inventory/components/StockTable.tsx` | Таблица остатков |
| `features/inventory/components/MovementsTable.tsx` | История движений |
| `features/inventory/components/AdjustmentForm.tsx` | Форма корректировки остатков |
| `features/inventory/components/InventoryVerificationReport.tsx` | Акт инвентаризации |
| `features/inventory/hooks/useInventoryState.ts` | CRUD товаров, движений |
| `features/inventory/hooks/useInventoryData.ts` | Расчёт агрегированных остатков |
| `features/inventory/hooks/useInventoryFilters.ts` | Фильтрация/поиск |
| `services/InventoryService.ts` | Бизнес-расчёты остатков |
| `services/InventoryMediator.ts` | Оркестрация: создаёт движения при событиях |

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
