# Модуль: Procurement & Sales (Закупки и Продажи)
> Связанные заметки: [[Architecture]] | [[DataModel]] | [[Modules/Inventory]] | [[Modules/Finance]]
> Дата документирования: 2026-04-06

## Назначение
Два симметричных модуля: закупки (заказы поставщикам) и продажи (заказы покупателям).
Оба создают плановые платежи и складские движения через `InventoryMediator`.

## Ключевые файлы

### Закупки (Procurement)
| Файл | Назначение |
|---|---|
| `features/procurement/ProcurementPage.tsx` | Точка входа |
| `features/procurement/components/OrdersList.tsx` | Список заказов |
| `features/procurement/components/OrderForm.tsx` | Форма заказа |
| `features/procurement/components/OrderItemsTab.tsx` | Позиции заказа |
| `features/procurement/components/OrderPaymentsTab.tsx` | Платежи по заказу |
| `features/procurement/components/ProductPicker.tsx` | Выбор товара с конфигуратором |
| `features/procurement/hooks/useOrderState.ts` | Основной хук |
| `features/procurement/hooks/useOrders.ts` | CRUD заказов |
| `features/procurement/hooks/useOrderFormState.ts` | Состояние формы |

### Продажи (Sales)
| Файл | Назначение |
|---|---|
| `features/sales/SalesPage.tsx` | Точка входа |
| `features/sales/components/SalesOrdersList.tsx` | Список заказов |
| `features/sales/components/SalesOrderForm.tsx` | Форма заказа |
| `features/sales/components/SalesItemsTab.tsx` | Позиции заказа |
| `features/sales/components/SalesPaymentsTab.tsx` | Платежи по заказу |
| `features/sales/hooks/useSales.ts` | CRUD продаж |
| `features/sales/hooks/useSalesOrderFormState.ts` | Состояние формы |

### Смежные модули
| Файл | Назначение |
|---|---|
| `features/receiving/ReceivingPage.tsx` | Приёмка товаров под заказ |
| `features/shipment/ShipmentPage.tsx` | Отгрузка под продажу |

## Модель данных

### SupplierOrder (заказ поставщику)
```typescript
{
  supplierId: string
  buyerId: string              // наша компания
  currency: Currency
  status: OrderStatus          // Подтвержден | Частично получен | Закрыт | Отменен
  items: OrderItem[]
  totalAmountForeign: number
  totalAmountKztEst: number    // оценка в KZT
  paidAmountForeign: number
  totalPaidKzt: number
  receivedItemCount / totalItemCount: number
  contractUrl?: string
  additionalDocuments?: OrderDocument[]
  isDeleted?: boolean          // soft delete
}
```

### OrderItem (позиция заказа)
```typescript
{
  productId / productName / sku: string
  productType: ProductType
  quantity: number
  productBasePrice: number
  productCurrency: Currency
  priceForeign: number
  configuration?: string[]     // выбранные варианты опций
}
```

### SalesOrder (заказ покупателю)
```typescript
{
  clientId / clientName: string
  status: OrderStatus
  items: SalesOrderItem[]
  totalAmount: number          // всегда в KZT
  paidAmount: number
  shippedItemCount / totalItemCount: number
  isDeleted?: boolean
}
```

### SalesOrderItem
```typescript
{
  priceKzt: number             // продажи всегда в KZT
  preCalcItemId?: string       // привязка к позиции предрасчёта
  configuration?: string[]
}
```

## Бизнес-логика

### Жизненный цикл заказа поставщику
```
Создан → Подтверждён → (Частично получен) → Закрыт
                ↓
        Incoming-движения на складе
        PlannedPayment (Outgoing)
```

### Жизненный цикл заказа покупателю
```
Создан → Подтверждён → (Частично отгружен) → Закрыт
                ↓
        Reserved-движения на складе
        PlannedPayment (Incoming)
```

### Soft delete
`isDeleted: true` — заказы не удаляются физически, помечаются как удалённые.
Перемещаются в корзину (`RecycleBinPage`).

### Приёмка (Receiving)
- Привязана к конкретному заказу поставщику
- При проводке (`Posted`) — конвертирует `Incoming` → `Physical`
- Рассчитывает `finalCostUnitKzt` = закупочная цена + распределённые расходы
- Расходы (логистика, брокер, СВХ и т.д.) распределяются методами: `BY_VOLUME`, `BY_VALUE`, `BY_QUANTITY`, `SPECIFIC_ITEM`

### Отгрузка (Shipment)
- Привязана к заказу покупателю
- При проводке — конвертирует `Reserved` → `Physical Out`
- Фиксирует продажную цену (`priceKzt`) на момент отгрузки

### Конфигурация в позициях
`configuration: string[]` — массив ID вариантов опций.
Передаётся в движение склада, позволяет отслеживать конфигурацию конкретного товара на складе.
