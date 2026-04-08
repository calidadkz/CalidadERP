# DataModel — Типы и перечисления
> Связанные заметки: [[Architecture]] | [[Modules/Inventory]] | [[Modules/Finance]] | [[Modules/Bundles-Options]]
> Дата документирования: 2026-04-06

## Файлы типов (`types/`)
| Файл | Содержимое |
|---|---|
| `enums.ts` | Все перечисления |
| `product.ts` | Product, ProductPackage, MachineConfigEntry, PricingProfile |
| `bundle.ts` | Bundle |
| `options.ts` | OptionType, OptionVariant |
| `order.ts` | SupplierOrder, SalesOrder, OrderItem, SalesOrderItem |
| `inventory.ts` | StockMovement, Reception, Shipment, Discrepancy |
| `finance.ts` | PlannedPayment, ActualPayment, PaymentAllocation, InternalTransaction, BankAccount, CurrencyLot, CashFlowItem |
| `batch.ts` | Batch, BatchExpense, BatchDocument, BatchItemActuals |
| `pre-calculations.ts` | PreCalculationDocument, PreCalculationItem, GeneralSettings, PackingListItem |
| `permissions.ts` | UserProfile, AppRole, RolePermissions, AccessLevel |
| `counterparty.ts` | Counterparty, CounterpartyAccount |
| `currency.ts` | Currency enum |
| `system.ts` | LogItem, TrashItem, ActionType |

## Ключевые перечисления (enums.ts)

```typescript
enum ProductType   { MACHINE = 'Станок', PART = 'Запчасть', SERVICE = 'Услуга' }
enum PricingMethod { MARKUP_WITHOUT_VAT, MARKUP_WITH_VAT, PROFILE }
enum OrderStatus   { CONFIRMED, PARTIALLY_RECEIVED, CLOSED, CANCELLED }
enum AppRole       { ADMIN, MANAGER, ROP, ACCOUNTANT, PROCUREMENT, TECHNICIAN, LOGISTICS, WAREHOUSE, GUEST }
enum TaxRegime     { STANDARD = 'Общеустановленный', SIMPLIFIED = 'Упрощенка' }
enum DiscrepancyResolution { WRITE_OFF, REPAIR, NEXT_SHIPMENT }
enum ExpenseAllocationMethod { BY_VOLUME, BY_VALUE, BY_QUANTITY, SPECIFIC_ITEM }

type MovementStatus = 'Physical' | 'Incoming' | 'Reserved'
type TransactionType = 'Transfer' | 'Exchange'
type AccessLevel = 'none' | 'read' | 'write'
```

## Currency
```typescript
enum Currency { Kzt = 'KZT', Usd = 'USD', Cny = 'CNY', Eur = 'EUR', Rub = 'RUB' }
```
Базовая валюта системы — **KZT**. Все финансовые отчёты строятся в KZT.
Дефолтные курсы в `constants.ts`: USD=450, EUR=490, CNY=63, RUB=5.

## Product — центральная сущность
```typescript
interface Product {
  id / sku / name: string
  type: ProductType           // Станок | Запчасть | Услуга
  basePrice: number
  currency: Currency
  markupPercentage: number
  pricingMethod?: PricingMethod
  salesPrice?: number
  
  // Физические характеристики
  packages?: ProductPackage[] // упаковочные места
  workingLength/Width/HeightMm?: number
  workingVolumeM3?: number
  workingWeightKg?: number
  
  // Остатки (денормализовано)
  stock / reserved / incoming / minStock: number
  
  // Конфигуратор (для станков)
  machineConfig?: MachineConfigEntry[]
  internalComposition?: { productId: string; quantity: number }[]
  compatibleMachineCategoryIds?: string[]
  
  pricingProfileId?: string
  imageUrl?: string
}
```

## UserProfile и права доступа
```typescript
interface UserProfile {
  role: AppRole
  permissions: {
    [module: string]: {
      tabs?:    { [key: string]: AccessLevel }
      fields?:  { [key: string]: AccessLevel }
      actions?: { [key: string]: AccessLevel }
    }
  }
}
```
ADMIN имеет полный доступ без проверки `permissions`.
Остальные роли — гранулярные права через `PermissionsService`.

## PricingProfile (ценовой профиль)
Хранит все параметры для автоматического расчёта цены продажи:
- Ставки логистики, СВХ, брокера, таможни
- НДС, КПН, бонус продаж
- Целевая маржа `targetNetMarginPercent`
Привязывается к товару через `pricingProfileId`.

## Система логов и корзины
```typescript
interface LogItem  { action: ActionType; entity: string; entityId: string; details: string; date: string; userId: string }
interface TrashItem { originalId: string; type: 'Product'|'Order'|...; name: string; data: any; deletedAt: string }
```
Все удаления — soft delete через корзину. Восстановление возможно из `/recycle_bin`.
