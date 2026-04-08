# Модуль: Finance (Финансы)
> Связанные заметки: [[Architecture]] | [[DataModel]] | [[Modules/Procurement-Sales]]
> Дата документирования: 2026-04-06

## Назначение
Финансовый модуль в трёх видах: планирование платежей, учёт фактических платежей по выпискам, казначейство (счета и валютные позиции). Также включает справочник статей ДДС и курсы валют.

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/finance/FinancePage.tsx` | Точка входа, переключение view: plan/fact/treasury |
| `features/finance/tabs/PaymentsCalendar.tsx` | Вкладка: Платёжный календарь (план) |
| `features/finance/tabs/BankStatements.tsx` | Вкладка: Выписки (факт) |
| `features/finance/tabs/TreasuryAccounts.tsx` | Вкладка: Казначейство |
| `features/finance/FinanceCategoriesPage.tsx` | Справочник статей ДДС |
| `features/finance/pages/CurrencyRatesPage.tsx` | Курсы валют |
| `features/finance/hooks/useFinanceState.ts` | Основной хук состояния |
| `features/finance/hooks/useFinance.ts` | Финансовые операции |
| `features/finance/components/PaymentModal.tsx` | Создание/редактирование платежа |
| `features/finance/components/ManualPlanModal.tsx` | Ручной плановый платёж |
| `services/StatementParser.ts` | Парсинг банковских выписок (CSV) |

## Маршруты
| URL | View | Описание |
|---|---|---|
| `/finance_calendar` | `plan` | Платёжный календарь |
| `/finance_statements` | `fact` | Фактические платежи / выписки |
| `/finance_accounts` | `treasury` | Счета и валюта |
| `/finance_categories` | — | Статьи ДДС |
| `/rates` | — | Курсы валют |

## Модель данных

### PlannedPayment (плановый платёж)
```typescript
{
  direction: 'Incoming' | 'Outgoing'
  sourceDocType: 'Order' | 'SalesOrder' | 'Manual'
  sourceDocId: string
  amountDue: number
  amountPaid: number
  currency: Currency
  dueDate: string
  isPaid: boolean
  cashFlowItemId: string      // статья ДДС
  paymentCounterpartyId?      // посредник (например Kaspi Bank)
}
```

### ActualPayment (фактический платёж / строка выписки)
```typescript
{
  direction: 'Incoming' | 'Outgoing'
  amount: number
  currency: Currency
  bankAccountId: string
  exchangeRate: number
  allocations: PaymentAllocation[]   // разбивка по статьям
  isInternalTransfer?: boolean       // исключать из P&L
  pairedInternalTxId?: string        // ссылка на внутренний перевод
  knp?: string                       // КНП (казахстанский код назначения платежа)
}
```

### PaymentAllocation (разбивка платежа)
```typescript
{
  cashFlowItemId: string      // статья ДДС
  batchId?: string            // привязка к партии
  amountCovered: number
  targetBankAccountId?        // для внутренних переводов
  existingInternalTxId?       // при привязке второй стороны перевода
}
```

### InternalTransaction (внутренний перевод / конвертация)
```typescript
{
  type: 'Transfer' | 'Exchange'
  fromAccountId / toAccountId: string
  amountSent / amountReceived: number
  fee: number
  rate: number                      // курс при обмене
  actualPaymentOutId?               // исходящая сторона выписки
  actualPaymentInId?                // входящая сторона выписки
  isFullyReconciled?: boolean       // true когда обе стороны привязаны
}
```

## Бизнес-логика

### Поток платежей
1. Плановые платежи создаются **автоматически** при подтверждении заказа/продажи
2. Вручную — через `ManualPlanModal`
3. Фактические платежи импортируются из банковской выписки (CSV через `StatementParser`) или создаются вручную
4. Фактический платёж **связывается** с плановым через `PaymentAllocation.plannedPaymentId`

### Внутренние переводы и конвертации
- `isInternalTransfer: true` на `ActualPayment` исключает из P&L-анализа
- `InternalTransaction` отслеживает переводы между счетами и обмен валюты
- `isFullyReconciled` становится `true` когда оба конца перевода (Out + In) обработаны

### Статьи ДДС (CashFlowItem)
Категории: `Operating` / `Investing` / `Financial`
Типы: `Income` / `Expense`

### Валюты
Поддерживаются: KZT, USD, CNY, EUR, RUB
Курсы хранятся в таблице `exchange_rates`, обновляются вручную через `/rates`
Дефолтные курсы в `constants.ts` (KZT_RATES)

### Парсинг выписок
`StatementParser.ts` разбирает CSV из Каспи Банка и Народного Банка (есть файлы-примеры в корне проекта: `Выписка Калидат - Каспи банк.csv`, `Выписка Калидат - Народный банк.csv`).
