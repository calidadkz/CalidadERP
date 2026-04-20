# ADR-007: SalesOrderForm — открытие из внешних модулей
> Связанные заметки: [[Architecture]] | [[Session-Log]]
> Дата: 2026-04-16
> Статус: Принято

## Контекст

`SalesOrderForm` — тяжёлый компонент создания/редактирования заказа клиента. Изначально он использовался только внутри модуля Продаж. В ходе работы выяснилось, что из Предрасчёта и Партий нужно открывать уже существующий заказ для просмотра и правки — не создавая новый. Нужен единый паттерн: как передать данные, как различать режим создания от редактирования, какой `action` вызывать при сохранении.

## Рассмотренные варианты

1. **Навигация в отдельный маршрут** (`/sales/:id`) — открывать заказ в отдельной странице через `useNavigate`.  
   + Простая реализация, нет дополнительного state.  
   − Уводит пользователя с контекста (Предрасчёт/Партия). После сохранения нужно возвращаться обратно и знать, откуда пришли.

2. **Модал с `SalesOrderForm` прямо в модуле** — fullscreen overlay поверх текущей страницы, `SalesOrderForm` получает `initialOrder` + `initialPayments`.  
   + Контекст не теряется; пользователь видит, откуда открыл заказ.  
   + Уже реализован аналогичный паттерн при создании заказа из Предрасчёта — расширяем его.  
   − Каждый модуль хранит свой `orderModal` state и хендлеры.

3. **Глобальный контекст / Portal для модала** — единый `<SalesOrderModal>` в корне приложения.  
   − Избыточная сложность при текущем масштабе. Можно вынести позже.

## Принятое решение

Вариант 2 — модал с `SalesOrderForm` в каждом модуле-хосте. Паттерн реализован в двух местах:

**Структура state в хост-компоненте:**
```typescript
const [orderModal, setOrderModal] = useState<{
  order: SalesOrder;
  payments: PlannedPayment[];
} | null>(null);
```

**Открытие:**
```typescript
const handleOpenOrder = (order: SalesOrder) => {
  const orderPayments = plannedPayments.filter(p => p.sourceDocId === order.id);
  setOrderModal({ order, payments: orderPayments });
};
```

**Сохранение** — всегда `updateSalesOrder` (не `createSalesOrder`), т.к. заказ уже существует:
```typescript
await actions.updateSalesOrder(order, plans);
await actions.refreshOperationalData();
setOrderModal(null);
```

**В `DetailedList`** (Предрасчёт) — расширенный вариант с флагом `isNew: boolean` в `orderFormConfig`, чтобы различать создание нового заказа (через режим сборки) и редактирование существующего:
```typescript
// Создание нового:
setOrderFormConfig({ ..., isNew: true });
await actions.createSalesOrder(order, plans);

// Редактирование существующего:
setOrderFormConfig({ ..., isNew: false });
await actions.updateSalesOrder(order, plans);
```

## Последствия

**Плюсы:**
- Пользователь не теряет контекст модуля
- Паттерн простой и понятный — state локален в хосте
- `SalesOrderForm` не знает, откуда его открыли — интерфейс не менялся

**Минусы / компромиссы:**
- Дублирование `orderModal` state и хендлеров в каждом хосте (Предрасчёт, Партии)
- Каждый хост должен сам подтягивать `plannedPayments` для заказа
- При добавлении третьего хоста (например, Приёмка) — копировать тот же паттерн

## Связанный код

- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — `orderFormConfig` с `isNew`, `handleOpenExistingOrder`, `handleOrderSubmit`
- `features/batches/BatchDetailPage.tsx` — `orderModal`, `handleOpenOrder`, `handleOrderSubmit`
- `features/batches/components/BatchMainListTab.tsx` — проп `onOpenOrder: (order: SalesOrder) => void`
