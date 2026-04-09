# Architecture — CalidadERP
> Связанные заметки: [[Tech-Stack]] | [[Session-Log]] | [[DataModel]]
> Модули: [[Modules/Inventory]] | [[Modules/Bundles-Options]] | [[Modules/Finance]] | [[Modules/Procurement-Sales]] | [[Modules/Batches-PreCalc]] | [[Modules/Списания (WriteOff)]]
> UI-паттерны: [[Modules/UI-CalidadSelect]]

## Структура проекта

```
CalidadERP/
├── App.tsx                     # Корень приложения, маршрутизация
├── index.tsx                   # Entry point
├── constants.ts                # TableNames enum, курсы валют по умолчанию
├── features/                   # Модули (feature-слайсы)
│   ├── auth/                   # Авторизация (LoginPage)
│   ├── inventory/              # Складской учёт
│   ├── nomenclature/           # Номенклатура товаров
│   ├── products/               # Товары (категории, HS коды, ценообразование)
│   ├── bundles/                # Комплекты и опции (конфигуратор)
│   ├── pre-calculations/       # Предварительные расчёты (калькуляция)
│   ├── batches/                # Партии (импортные поставки)
│   ├── procurement/            # Закупки / заказы поставщикам
│   ├── receiving/              # Приёмка товаров
│   ├── sales/                  # Продажи
│   ├── shipment/               # Отгрузка
│   ├── warehouse/              # Склад (расхождения)
│   ├── counterparties/         # Контрагенты
│   ├── finance/                # Финансы (план/факт/казначейство)
│   ├── history/                # Лог действий
│   └── system/                 # Системные: GlobalStore, AuthContext, Layout
├── services/                   # Сервисный слой (бизнес-логика)
├── components/                 # Общие компоненты
├── types/                      # TypeScript типы
└── utils/                      # Утилиты
```

## Маршруты (Routes)

| URL | Компонент | Описание |
|---|---|---|
| `/inventory` | InventoryPage | Остатки склада |
| `/nomenclature` | NomenclaturePage | Список товаров |
| `/hscodes` | HSCodesPage | Коды ТН ВЭД |
| `/bundles` | BundlesPage | Комплекты |
| `/options` | BundlesPage | Опции товаров |
| `/categories` | CategoriesPage | Категории товаров |
| `/pre-calculations/*` | PreCalculationsRouter | Предварительные расчёты |
| `/batches` | BatchesPage | Список партий |
| `/batches/:id` | BatchDetailPage | Детали партии |
| `/procurement` | ProcurementPage | Заказы поставщикам |
| `/receiving` | ReceivingPage | Приёмка |
| `/sales` | SalesPage | Заказы покупателей |
| `/shipment` | ShipmentPage | Отгрузки |
| `/discrepancy` | DiscrepancyPage | Расхождения |
| `/finance_calendar` | FinancePage (plan) | Финансовый план |
| `/finance_statements` | FinancePage (fact) | Фактические платежи |
| `/finance_accounts` | FinancePage (treasury) | Казначейство |
| `/finance_categories` | FinanceCategoriesPage | Статьи ДДС |
| `/rates` | CurrencyRatesPage | Курсы валют |
| `/counterparties` | CounterpartyManagerPage | Контрагенты |
| `/pricing` | PricingManagerPage | Профили цен |
| `/permissions` | PermissionsManager | Права пользователей |
| `/history` | HistoryPage | История изменений |
| `/recycle_bin` | RecycleBinPage | Корзина |

## State Management

**GlobalStore** (`features/system/context/GlobalStore.tsx`) — единый React Context, агрегирует всё состояние.

Специализированные хуки (разделяют логику):
- `useReferenceState` — справочники (продукты, контрагенты, сотрудники и т.д.)
- `useInventoryState` — остатки склада
- `useOrderState` — заказы (закупки, продажи)
- `useFinanceState` — финансовые данные
- `usePreCalculations` — предварительные расчёты

**AuthContext** (`features/system/context/AuthContext.tsx`) — отдельный контекст авторизации.

## Сервисный слой (`services/`)

| Файл | Назначение |
|---|---|
| `api.ts` (ApiService) | Базовый CRUD, camelCase↔snake_case конвертация, ConflictError |
| `InventoryService.ts` | Расчёт остатков (Physical/Incoming/Reserved/Free), средняя стоимость |
| `MoneyMath.ts` | Точные денежные вычисления (без float-ошибок) |
| `BatchCalculator.ts` | Расчёт себестоимости партии |
| `BundleCalculator.ts` | Расчёт цен комплектов |
| `PermissionsService.ts` | RBAC: `canSee()`, `canWrite()` |
| `PricingService.ts` | Профили ценообразования |
| `StatementParser.ts` | Парсинг банковских выписок (CSV) |
| `InventoryMediator.ts` | Оркестрация складских операций |
| `DomainLogic.ts` | Доменная логика (общая) |
| `supabaseClient.ts` | Supabase клиент |
| `firebase.ts` | Firebase конфигурация |

## База данных (Supabase / PostgreSQL)

~40+ таблиц. Ключевые:

**Номенклатура и склад:**
- `products`, `product_categories`, `manufacturers`
- `stock_movements` — все движения товара
- `v_inventory_summary` — view для агрегированных остатков
- `option_types`, `option_variants`, `bundles`

**Закупки и продажи:**
- `supplier_orders`, `supplier_order_items`
- `sales_orders`, `sales_order_items`
- `receptions`, `reception_items`, `reception_expenses`
- `shipments`, `shipment_items`

**Финансы:**
- `planned_payments`, `actual_payments`, `payment_allocations`
- `internal_transactions`, `bank_accounts`
- `currency_lots`, `cash_flow_items`
- `exchange_rates`

**Справочники:**
- `counterparties`, `counterparty_accounts`
- `our_companies`, `employees`
- `hscodes`, `pricing_profiles`

**Система:**
- `logs`, `trash`, `discrepancies`
- `pre_calculations`, `pre_calculation_items`, `pre_calculation_packages`
- `batches`, `batch_expenses`, `batch_documents`, `batch_item_actuals`

## Система прав доступа

Роли: `ADMIN` (полный доступ) + кастомные роли с гранулярными правами.

Структура прав в `user.permissions`:
```
permissions[module][type][key] → 'none' | 'read' | 'write'
```
- `type`: `tabs` (видимость вкладки) | `fields` (поля) | `actions` (действия)

Проверка:
```typescript
PermissionsService.canSee(user, 'inventory', 'tabs', 'main')
PermissionsService.canWrite(user, 'sales', 'actions', 'create')
```

## Ключевые паттерны

### API конвертация
ApiService автоматически конвертирует camelCase→snake_case при записи и snake_case→camelCase при чтении.
Исключение — защищённые JSON-поля: `matrix`, `machineConfig`, `priceOverrides`, `internalComposition`, `composition`, `configuration`, `settings`, `items`, `packingList`, `options`.

### Optimistic locking (ConflictError)
```typescript
await ApiService.update(TableNames.PRODUCTS, id, data, expectedUpdatedAt);
// Бросает ConflictError если запись изменена другим пользователем
```

### Склад: типы статусов движений
- `Physical` — фактически на складе
- `Incoming` — в пути (ожидается)
- `Reserved` — зарезервировано под заказ
- `Free` = Physical + Incoming − Reserved

### Валюты
KZT (базовая), USD, CNY, EUR, RUB.
Все денежные расчёты — через `MoneyMath` (точная арифметика).
