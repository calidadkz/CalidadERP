# Session Log

## 2026-04-15 — Мобильная версия Номенклатуры и Опций (завершение)

**Что сделано:**
- Создан `MobileOptionsEditor.tsx` — полноценная мобильная версия модуля Опции (standalone, не в Номенклатуре)
  - Два экрана: список типов → дрилл-ин в варианты
  - SearchOverlay (fixed z-500), VariantFormSheet (fixed z-300), форма типа (fixed z-300)
  - Firebase image upload, BOM секция, supplier/category/manufacturer через overlay
- Подключён в `BundlesPage.tsx`: при `mode === 'options' && isMobile` — early return с `<MobileOptionsEditor />`
- Предыдущие сессии: `MobileNomenclatureView.tsx`, `MobileProductForm.tsx`, `Layout.tsx` mobile menu drawer

**Файлы изменены:**
- `features/bundles/components/MobileOptionsEditor.tsx` (создан)
- `features/bundles/BundlesPage.tsx` (добавлен isMobile + early return)
- `components/system/Layout.tsx` (mobile top bar + drawer)
- `features/nomenclature/NomenclaturePage.tsx`, `MobileNomenclatureView.tsx`, `MobileProductForm.tsx`
- `hooks/useIsMobile.ts` (создан)

**Открытые задачи / следующий шаг:** нет — всё завершено и собрано без ошибок
**Ссылки:** [[Modules/Bundles-Options]], [[Architecture]]

## 2026-04-15 — Адаптивность UI: методика + Layout + типографика + Batches

**Что сделано:**

**1. Методика адаптации (задокументирована в сессии, применяется далее):**
- Диапазон breakpoints: `xl` (≥1280px) = ноутбук 14-15", `2xl` (≥1536px) = большой монитор
- Типографическая шкала T1–T10: минимум читаемого текста = 10px (отображение), предпочтительно 11px для лейблов и мета
- Пространственная шкала: `px-4 xl:px-6 2xl:px-8` для main-контейнеров
- Колонки таблиц: второстепенные `hidden xl:table-cell`
- Поля форм: `flex-wrap` + `min-w-[X] flex-1` вместо фиксированных ширин
- Модальные окна: `max-w-lg xl:max-w-xl` / `max-w-2xl xl:max-w-3xl`

**2. Layout.tsx:**
- Сайдбар: `w-64` → `w-56 xl:w-60`, свёрнут `w-20` → `w-16`
- Шапка сайдбара: `h-20` → `h-14`, пункты меню `text-sm` → `text-xs`, `py-2.5` → `py-2`
- Main: `pt-8 px-8` (фиксировано) → `px-4 pt-5 xl:px-6 xl:pt-6 2xl:px-8 2xl:pt-7` (+88px ширины на 1366px)

**3. index.css — глобальный CSS-пол (покрывает 77 файлов без правки каждого):**
- `text-[7px]`, `text-[8px]` → рендерится 10px
- `text-[9px]` → рендерится 11px
- Включены responsive-варианты: `xl:text-[9px]` и др. тоже получают пол
- `.font-mono.text-slate-300` → цвет поднят до `slate-400` (контраст 3.0:1)
- Семантические утилиты: `.ui-label`, `.ui-meta`, `.ui-section-label`, `.ui-total`

**4. BatchMainListTab.tsx:**
- Заголовки колонок расходов: `text-[8px]` → `text-[10px]`
- `opacity-70/30` на тексте → `text-white/80`, `text-white/40`
- Легенда: `text-[9px] text-slate-300` → `text-[10px] text-slate-400/500`

**5. BatchDetailPage.tsx:**
- KpiCard: `text-[8px] xl:text-[9px]` → `text-[10px] xl:text-[11px]`, лейблы `text-slate-400` → `text-slate-500`
- Action bar: все `text-[9px]` → `text-[11px]` (статус-дропдаун, кнопки удаления, вкладки, экспорт, дедлайн-бейдж)

**6. BatchesPage.tsx:**
- Шапка: адаптивные padding/размеры, `px-8 py-6` → `px-5 py-4 xl:px-8 xl:py-5`
- Кнопки вкладок: `text-[9px]` → `text-[11px]`
- Таблица: отступы `px-8 py-5` → `px-5 xl:px-8 py-3 xl:py-4`
- Колонки "Дата создания" и "Ожид. приход": `hidden xl:table-cell` (не видны на 14")
- `text-slate-200/300` → `text-slate-400` везде

**7. SalesOrdersList + SalesOrderForm + OrdersList + OrderForm (предыдущий сеанс этой сессии):**
- Таблицы: `px-6 py-4` → `px-3 py-3`, кнопки действий всегда видны (без `opacity-0 group-hover`)
- Формы: разбиты на 2 строки, `flex-wrap`, поля сузились, "Начало договора" → "Дата первого платежа"

**Файлы изменены:**
- `components/system/Layout.tsx`
- `index.css`
- `features/batches/components/BatchMainListTab.tsx`
- `features/batches/BatchDetailPage.tsx`
- `features/batches/BatchesPage.tsx`
- `features/sales/components/SalesOrdersList.tsx`
- `features/sales/components/SalesOrderForm.tsx`
- `features/procurement/components/OrdersList.tsx`
- `features/procurement/components/OrderForm.tsx`

**Открытые задачи / следующий шаг:**

Адаптация по приоритету — продолжать по списку:
1. ✅ Layout.tsx
2. ✅ Типографика (CSS-пол в index.css)
3. ✅ Batches (BatchesPage, BatchDetailPage, BatchMainListTab)
4. ✅ Продажи и Снабжение (списки + формы)
5. ⏳ **PreCalculationEditorPage** — сложная страница с DetailedList, боковые панели
6. ⏳ **PaymentModal** (finance) — модальное окно с аллокациями
7. ⏳ **NomenclatureTable** — плотная таблица с режимами Quick/Mass edit
8. ⏳ **InventoryPage + StockTable**
9. ⏳ **Finance tabs** (PaymentsCalendar, BankStatements, TreasuryAccounts)
10. ⏳ **Остальные модальные окна** (CounterpartyCreateModal, WriteOffModal, ReceivingForm и др.)

Дополнительно незакрытые задачи из прошлых сессий:
- `syncPreCalcItems`: `update` → `upsert`
- WriteOff для товаров с конфигурацией

**Ссылки:** [[Architecture]] | [[Modules/Batches-PreCalc]]

---

## 2026-04-15 — Адаптивность UI: продолжение (PreCalc, PaymentModal, Inventory, Finance tabs, Nomenclature, прочее)

**Что сделано:**

**8. PreCalculationEditorPage.tsx:**
- Контейнер: `h-[calc(100vh-2rem)]` → `h-[calc(100vh-2.5rem)] xl:h-[calc(100vh-3rem)]`
- Шапка: `flex-wrap`, `px-4 xl:px-5 py-3`
- Мета-текст: `text-[9px]` → `text-[11px]`
- Дедлайн-бейдж: `text-[9px]` → `text-[11px]`, иконка 9→10
- Кнопки вкладок: `px-3 xl:px-4`, `<span className="hidden xl:inline">` для текста
- Кнопки "Создать партию" и "Сохранить": `text-[11px]`

**9. PaymentModal.tsx:**
- `max-w-2xl` → `max-w-xl xl:max-w-2xl`, `p-4` → `p-3 xl:p-4`
- Все лейблы полей: `text-[8px]` → `text-[11px] text-slate-500`
- Балансы счетов: `text-[9-10px]` → `text-[11px]`
- Все сервисные лейблы: "Добавить строку", дельта-предупреждение, "Итого" → `text-[11px]`

**10. InventoryPage.tsx:**
- KPI-блок: `grid grid-cols-4` → `flex flex-wrap gap-3`
- KPI лейблы: `text-[9px] text-slate-400` → `text-[10px] text-slate-500`
- Кнопки фильтра типов: `text-[10px] px-4` → `text-[11px] px-3 xl:px-4`
- Кнопка "Ввод": `text-[10px]` → `text-[11px]`

**11. PaymentsCalendar.tsx + BankStatements.tsx:**
- Заголовки таблиц: `px-6 py-3` → `px-4 py-3`
- Ячейки данных: `px-6 py-4` → `px-4 py-3`
- `text-[9px] font-mono text-slate-300` (ID транзакций) → `text-[10px] text-slate-400`

**12. NomenclatureTable.tsx:**
- Иконки-кнопки (edit/copy/delete): `text-slate-300` → `text-slate-400`
- Лейбл валюты: `text-[8px] text-slate-300` → `text-[10px] text-slate-400`
- Единица m³: `text-[9px] text-slate-300` → `text-[11px] text-slate-400`
- Разделитель пагинации `/`: `text-slate-300` → `text-slate-400`

**13. ExpenseForm.tsx:**
- Кнопки удаления: `text-slate-300` → `text-slate-400`
- Пустые ячейки таблицы: `text-slate-300` → `text-slate-400`

**14. FinanceCategoriesPage.tsx, CounterpartyManagerPage.tsx, ItemRow.tsx:**
- Пустые состояния и служебные лейблы: `text-slate-300` → `text-slate-400`
- Иконки-декоры (User, Phone) в CounterpartyManagerPage: `text-slate-300` → `text-slate-400`
- ItemRow лейблы "Тип"/"Группа": `text-[8px] text-slate-300` → `text-[11px] text-slate-400`

**Файлы изменены:**
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx`
- `features/finance/components/PaymentModal.tsx`
- `features/inventory/InventoryPage.tsx`
- `features/finance/tabs/PaymentsCalendar.tsx`
- `features/finance/tabs/BankStatements.tsx`
- `features/nomenclature/components/NomenclatureTable.tsx`
- `features/receiving/components/ExpenseForm.tsx`
- `features/finance/FinanceCategoriesPage.tsx`
- `features/counterparties/pages/CounterpartyManagerPage.tsx`
- `features/finance/components/ItemRow.tsx`

Также в той же сессии завершены (хвосты):

**15. WriteOffPage.tsx:**
- Заголовки таблицы: `px-6 py-4` → `px-4 py-3`, ячейки `px-6 py-3` → `px-4 py-3`
- `text-slate-300` в чекбокс-колонке, "—", лейбле KZT, кнопке удаления → `text-slate-400`

**16. PricingManagerPage.tsx:**
- Все `px-6 py-4` → `px-4 py-3` в таблице
- "Все" (плейсхолдеры): `text-slate-300` → `text-slate-400`
- Иконки Info, ChevronDown, кнопка RefreshCw: `text-slate-300` → `text-slate-400`

**17. CounterpartyManagerPage.tsx:**
- Все `px-6 py-4` → `px-4 py-3`
- Кнопки Pencil/Trash2: `text-slate-300` → `text-slate-400`

**18. TreasuryAccounts.tsx:**
- "Баланс" лейбл: `text-[7px] text-slate-300` → `text-[10px] text-slate-400`
- Номер счёта: `text-[8px] opacity-60` → `text-[10px]` без opacity
- Стек даты/себест.: `text-[8px] text-slate-300` → `text-[10px] text-slate-400`
- "/ amountOriginal": `text-[10px] text-slate-300` → `text-slate-400`

**Открытые задачи / следующий шаг:**

Адаптация UI завершена полностью. Осталось из прошлых сессий:
- ⏳ `syncPreCalcItems`: `update` → `upsert`
- ⏳ WriteOff для товаров с конфигурацией

**Ссылки:** [[Architecture]] | [[Modules/Batches-PreCalc]]

---

## 2026-04-15 — Хотфикс: payment_allocations.id NOT NULL при ручной проводке

**Что сделано:**
- Диагностирован баг: ручная проводка из Календаря платежей падала с ошибкой `null value in column "id" of relation "payment_allocations" violates not-null constraint`
- Причина: в прошлой сессии добавили `payment_allocations.id uuid NOT NULL` через миграцию, но оба места записи аллокаций (`executePayment` и `allocatePayment`) не передавали `id` в объектах для `createMany`
- Исправлены оба маппера: добавлен `id: al.id || ApiService.generateId('PA')`

**Файлы изменены:**
- `features/finance/hooks/useFinanceState.ts` — добавлен `id` в `allocationsToSave` в `executePayment` (строка ~87) и `allocatePayment` (строка ~137)

**Открытые задачи / следующий шаг:**
- `syncPreCalcItems`: `update` → `upsert`
- WriteOff для товаров с конфигурацией

**Ссылки:** [[Modules/Finance]]

---

## 2026-04-15 — Мобильная версия Номенклатуры (запчасти)

**Что сделано:**

Создана полноценная мобильная версия модуля Номенклатуры (breakpoint < 768px).

**Архитектура:**
- `useIsMobile(breakpoint=768)` — хук детекции мобильного экрана (resize listener)
- `MobileNomenclatureView` — основной мобильный контейнер: список + фильтры
- `MobileProductForm` — полноэкранная форма добавления/редактирования товара
- `NomenclaturePage` переключается между desktop и mobile через `useIsMobile`

**Функционал MobileNomenclatureView:**
- Шапка: заголовок + счётчик + кнопка "Добавить"
- Поиск (name/sku/supplierProductName/manufacturer)
- Переключатель типа: Запчасти / Станки / Услуги (с количеством)
- Горизонтальный скролл фильтров: по типу станка, по категории товара
- Карточки товаров: фото/иконка, название, SKU, поставщик, категория, цена (валюта+продажная), остаток (цветной бейдж)
- Кнопки Изменить/Удалить на каждой карточке
- Свой диалог подтверждения удаления (вызывает `actions.deleteProduct` напрямую, не через desktop handleDelete)
- Пустое состояние с кнопкой добавить первую

**Функционал MobileProductForm:**
- Слайд-ап full-screen модал
- Поиск поставщика: отдельный слой с search input + список (SupplierSearch)
- Тип товара: переключатель 3 кнопки
- Наименования: supplierProductName, name (рус.), превью SKU
- Классификация: поставщик, производитель (datalist), категория, совместимые станки (чипы)
- Ценообразование: валюта, базовая цена, наценка%, цена продажи ₸ (двустороннее вычисление)
- Курсовой калькулятор (currency × rate → KZT)
- Мин. остаток, описание (коллапс)
- Размер шрифта 16px в полях (нет iOS auto-zoom)

**Файлы созданы:**
- `features/nomenclature/hooks/useIsMobile.ts`
- `features/nomenclature/components/MobileProductForm.tsx`
- `features/nomenclature/components/MobileNomenclatureView.tsx`

**Файлы изменены:**
- `features/nomenclature/NomenclaturePage.tsx` — добавлен мобильный путь рендера

**Открытые задачи:**
- ⏳ Вкладка "Опции" в мобильной форме (для станков) — оставлено на потом
- ⏳ `syncPreCalcItems`: `update` → `upsert`
- ⏳ WriteOff для товаров с конфигурацией

**Ссылки:** [[Architecture]] | [[Modules/UI-CalidadSelect]]

---

## 2026-04-15 — China доставка: вкладка Аллокации по умолчанию, рефакторинг + responsive

**Что сделано:**
- **`features/batches/utils/batchExpenseAllocation.ts`** (новый): вынесена логика `allocateExpensesToItems` + `computeShares` + `EXPENSE_COL_METAS` из компонента в утилиту
- **`ChinaDeliveryForm.tsx`** (новый): форма добавления расхода с вкладками источника — **Аллокации по умолчанию**, Календарь, Вручную. Фильтр аллокаций по контрагенту. Превью распределения суммы по позициям.
- **`ChinaDeliveryModal.tsx`**: переписан — только шелл (список записей + кнопка + форма). ~157 строк вместо 436.
- **`BatchMainListTab.tsx`**: удалена дублированная логика распределения (теперь из утилиты), `onAddChinaExpense`/`onDeleteExpense` убраны → заменены на `onChinaClick`. 274 строк вместо 451.
- **`BatchDetailPage.tsx`**: модал поднят сюда (state `showChinaModal`), передаёт все нужные данные. Responsive классы: KPI `grid-cols-2 xl:grid-cols-4`, сайдбар `w-72 lg:w-80 xl:w-96`, nav-вкладки скрывают лейблы на малых экранах (`hidden lg:inline`), шапка `flex-wrap`, отступы `xl:px-6`.

**Файлы изменены:**
- `features/batches/utils/batchExpenseAllocation.ts` — создан
- `features/batches/components/ChinaDeliveryForm.tsx` — создан
- `features/batches/components/ChinaDeliveryModal.tsx` — переписан
- `features/batches/components/BatchMainListTab.tsx` — рефакторинг
- `features/batches/components/BatchSidebar.tsx` — responsive ширина
- `features/batches/BatchDetailPage.tsx` — модал + responsive

**Открытые задачи / следующий шаг:**
- syncPreCalcItems: `update` → `upsert`
- WriteOff для товаров с конфигурацией

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Decisions/006-china-delivery-multi-allocation]]

---

## 2026-04-14 — Доставка по Китаю: система аллокаций с мульти-группами

**Что сделано:**
- **DB-миграция `batch_expenses_china_distribution`**: добавлена колонка `china_distribution jsonb NULL` в `batch_expenses`
- **`api.ts`**: добавлен `chinaDistribution` в `PROTECTED_JSON_FIELDS` (JSON не конвертируется)
- **`types/batch.ts`**: новый тип `ChinaDeliveryDistribution { method, targetItemIds, manualAmounts? }`, добавлено поле `chinaDistribution?` в `BatchExpense`
- **`BatchMainListTab.tsx`**: полный рефакторинг `allocateExpensesToItems` — China domestic теперь распределяется по каждому расходу отдельно согласно его `chinaDistribution` (volume/weight/manual + targetItemIds). Фоллбэк по объёму вместо равного деления. Добавлен `ChinaDeliveryModal`
- **`ChinaDeliveryModal.tsx`** (новый компонент): модальное окно для управления расходами доставки по Китаю. Функции: выбор метода (объём/вес/вручную), выбор позиций (отдельных или всех), превью распределения суммы по позициям, список уже внесённых записей с возможностью удаления. Несколько независимых записей с разными правилами в рамках одной партии.
- **`BatchDetailPage.tsx`**: передаёт `onAddChinaExpense={addExpense}` и `onDeleteExpense={deleteExpense}` в `BatchMainListTab`

**Ключевое решение:** клик по заголовку "По Китаю" в таблице открывает `ChinaDeliveryModal` (не сайдбар). Каждый `BatchExpense.logistics_china_domestic` хранит свои правила распределения в `chinaDistribution`. Это позволяет: 3 завода = 3 платежа с разными наборами позиций и методами деления.

**Баг до фикса:** `allocateExpensesToItems` при `grandPlan === 0` давал фоллбэк `1/items.length` — равное деление вместо по объёму.

**Файлы изменены:**
- `services/api.ts`
- `types/batch.ts`
- `features/batches/components/BatchMainListTab.tsx`
- `features/batches/components/ChinaDeliveryModal.tsx` — создан
- `features/batches/BatchDetailPage.tsx`

**Открытые задачи / следующий шаг:**
- syncPreCalcItems: `update` → `upsert`
- WriteOff для товаров с конфигурацией
- Проверить финансовый модуль после `id` в аллокациях

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-14 — Аллокации в сайдбаре партии: полный рефакторинг

**Что сделано:**
- **DB-миграция `batch_allocations_tracking`**: добавлены `payment_allocations.id` (uuid, NOT NULL), `payment_allocations.description`, `payment_allocations.batch_id` (пометка занятости), `batch_expenses.allocation_id` (ссылка на аллокацию-основание)
- **`types/batch.ts`**: добавлено `allocationId?` в `BatchExpense`
- **`types/batch.ts` / `types/finance.ts`**: `EnrichedAllocation` дополнен `batchId?`
- **`useBatches.ts`**: при загрузке исходящих платежей теперь отдельно загружаем `payment_allocations` и джойним к `actualPayments`. В `addExpense` — при `allocationId` пишем `batch_id` в аллокацию через `supabase.from().update()` + обновляем локальный state
- **`BatchDetailPage.tsx`**: передаёт `batchId={id!}` в `BatchSidebar`
- **`BatchSidebar.tsx`**: принимает `batchId`, пробрасывает в `AddExpensePanel`, передаёт `allocationId` в `onAddExpense`
- **`AddExpensePanel.tsx`**: принимает `batchId`, фильтрует аллокации — показывает только `batchId=null` ИЛИ `batchId=текущая партия`
- **`AllocationPanel.tsx`**: полный рефакторинг — карточки вместо кнопок, отдельная кнопка "Выбрать" + клик на выписку открывает `PaymentViewerModal` (readonly просмотр платежа со всеми аллокациями, ПП, суммами), бейдж "уже в этой партии", сортировка по приоритету + дате

**Ключевое решение:** аллокация считается "занятой" когда `payment_allocations.batch_id IS NOT NULL AND != currentBatchId`. При выборе и сохранении расхода из аллокации — `batch_id` записывается в БД и в локальный state.

**Файлы изменены:**
- `types/batch.ts`, `features/batches/components/sidebar/types.ts`
- `features/batches/hooks/useBatches.ts`
- `features/batches/BatchDetailPage.tsx`
- `features/batches/components/BatchSidebar.tsx`
- `features/batches/components/sidebar/AddExpensePanel.tsx`
- `features/batches/components/sidebar/AllocationPanel.tsx`

**Открытые задачи / следующий шаг:**
- syncPreCalcItems: `update` → `upsert`
- WriteOff для товаров с конфигурацией
- Проверить: GlobalStore джойнит аллокации к платежам по `actualPaymentId` — теперь там есть `id` у аллокаций, нужно проверить финансовый модуль (не сломался ли)

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Modules/Finance]]

---

## 2026-04-13 — Дедлайн по договору (раб. дни КЗ), выручка партии, CashFlowSelector scroll

**Что сделано:**
- **`utils/kazakhstanWorkingDays.ts`** (новый файл): функции `addWorkingDays(startDate, days)` и `formatDateRu(date)`. Учитываются Сб/Вс и 15 фиксированных праздников РК (Новый год, Наурыз, День независимости и т.д.)
- **`types/order.ts`**: добавлены поля `contractStartDate?: string` и `contractWorkingDays?: number` в `SalesOrder`
- **DB-миграция**: `sales_orders_add_contract_working_days` — добавлены колонки `contract_start_date date` и `contract_working_days integer`
- **`useSalesOrderFormState.ts`**: убран state `contractDeliveryDate`/setter, заменён на `useMemo` из `contractStartDate + contractWorkingDays`. Новые поля state: `contractStartDate`, `contractWorkingDays`
- **`SalesOrderForm.tsx`**: вместо датапикера — три блока: [Начало договора] + [Срок раб. дней] → [Крайняя дата поставки] (рассчитывается авто, отображается в зелёной/красной плашке)
- **`CashFlowSelector.tsx`**: исправлен баг закрытия дропдауна при скролле внутри него. Scroll-listener теперь игнорирует события из `dropdownRef`
- **`useBatches.ts`**: исправлен scoping-баг — `items` была объявлена внутри `if (preCalcData)` и была недоступна в шаге 8. Переименована в `preCalcItems`. Расширен поиск входящих платежей: теперь ищется по `sourceDocId` из заказов И по `preCalculationId` самой партии

**Файлы изменены:**
- `utils/kazakhstanWorkingDays.ts` — создан
- `types/order.ts` — новые поля
- `features/sales/hooks/useSalesOrderFormState.ts` — логика дедлайна
- `features/sales/components/SalesOrderForm.tsx` — новый UI
- `components/ui/CashFlowSelector.tsx` — fix scroll
- `features/batches/hooks/useBatches.ts` — fix scoping + расширенная загрузка платежей

**Открытые задачи / следующий шаг:**
- syncPreCalcItems: `update` → `upsert`
- WriteOff для товаров с конфигурацией
- Проверить в браузере корректность расчёта дат при открытии существующего заказа с договором (если `contractStartDate` ещё не записан в БД — поля будут пустыми, дата не рассчитается)

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Modules/Procurement-Sales]]

---

## 2026-04-13 — Списание и брак: 2-этапный процесс (черновик → проведение)

**Что сделано:**
- **DB-миграция**: добавлена колонка `status text DEFAULT 'Draft'` в `stock_writeoffs`. Существующие записи с `movement_id` автоматически помечены `'Posted'`.
- **Тип `WriteOff`**: добавлено поле `status?: 'Draft' | 'Posted'`.
- **`createWriteOff`** (Этап 1): упрощён — теперь только сохраняет черновик в БД (`status='Draft'`, `unitCostKzt=0`, без движения). Убрана зависимость от InventoryMediator (который всё равно не обрабатывал `documentType='WriteOff'` — это был тихий баг).
- **Новый `postWriteOff`** (Этап 2): проверяет физический остаток через `inventorySummary`, вычисляет среднюю себестоимость (`totalValueKzt / stock`), создаёт движение `Out/Physical` с `documentType='WriteOff'`, обновляет запись на `status='Posted'` + `movementId` + `unitCostKzt`.
- **`deleteWriteOff`**: теперь различает Draft (просто удаляет) и Posted (создаёт сторно-движение).
- **`GlobalStore`**: добавлен `postWriteOff` в `AppActions` и в `actions`, передаёт `inventorySummary` из state.
- **`WriteOffModal`**: принимает `inventorySummary`. При выборе товара показывает панель с физическим остатком и средней себестоимостью. Чекбокс «Провести сразу» (включён по умолчанию если есть остаток). Кнопка меняет текст и цвет в зависимости от режима.
- **`WriteOffPage`**: KPI разбит на 4 плашки (+ «Черновиков»); колонка «Статус» с бейджами Черновик/Проведено; кнопка «Провести» для черновиков; строки черновиков выделены фоном; сумма потерь не считается для черновиков.

**Файлы изменены:**
- `types/inventory.ts` — поле `status` в `WriteOff`
- `features/inventory/hooks/useInventoryState.ts` — рефакторинг `createWriteOff`, новый `postWriteOff`, обновлён `deleteWriteOff`
- `features/system/context/GlobalStore.tsx` — `postWriteOff` в `AppActions` и `actions`
- `features/warehouse/components/WriteOffModal.tsx` — панель остатка, чекбокс «Провести сразу»
- `features/warehouse/pages/WriteOffPage.tsx` — статусы в таблице, кнопка «Провести», KPI

**Открытые задачи / следующий шаг:**
- BatchMainListTab: связь позиций с заказами (выручка per-item)
- syncPreCalcItems: `update` → `upsert`
- WriteOff для товаров с конфигурацией (сейчас ищется только `configuration = []`)
- Обновление `inventorySummary` после проведения (сейчас только `stockMovements` обновляются в памяти, а `v_inventory_summary` — view в Supabase, обновится при следующем запросе)

**Ссылки:** [[Modules/Списания (WriteOff)]]

---

## 2026-04-13 — Комплектации: визуальная иерархия + Статьи ДДС: дропдауны

**Что сделано:**
- **TemplatesGallery (оба вида)**: переработана визуальная иерархия — База станка стала главным заголовком (`text-sm font-black`), опции — крупнее и контрастнее (`bg-blue-100 text-blue-700 border border-blue-200`), Название комплектации — мелкое курсивное в кавычках `«...»` (скрыто если пустое)
- **TemplatesGallery (список)**: кнопки Copy + ClipboardList перемещены левее названия базы (слева в ячейке). Все кнопки (в обоих видах) переведены на 3-градации видимости: `text-slate-200` → `group-hover:text-slate-400` → `hover:!text-blue-600`
- **FinanceCategoriesPage**: убран `overflow-hidden` с контейнера таблицы — выпадающие списки больше не обрезаются
- **ItemRow**: Тип статьи перемещён из бейджей в отдельный `CalidadSelect` в колонке "Тип / Группа". Рядом — такой же CalidadSelect для Группы. Иконка Layers и старый `showTypePicker` удалены. `TypeBadge` убран из первой колонки.

**Файлы изменены:**
- `features/bundles/components/TemplatesGallery.tsx`
- `features/finance/FinanceCategoriesPage.tsx`
- `features/finance/components/ItemRow.tsx`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: связь позиций с заказами (выручка per-item)
- syncPreCalcItems: `update` → `upsert`

**Ссылки:** [[Modules/Bundles-Options]]

---

## 2026-04-13 — Переопределение свойств Типа опций по категориям

**Что сделано:**
- **DB migration**: добавлена колонка `category_overrides jsonb DEFAULT '{}'::jsonb` в таблицу `option_types`
- **TypeScript**: добавлен интерфейс `OptionTypeCategoryOverride { isRequired?, isSingleSelect? }` и поле `categoryOverrides?: Record<string, OptionTypeCategoryOverride>` в `OptionType`
- **ApiService**: `categoryOverrides` добавлен в `PROTECTED_JSON_FIELDS` — ключи внутри JSONB не конвертируются
- **OptionsEditor**: в заголовке каждой категории-секции появились два кликабельных бейджа "Один/Много" и "Обяз." — отображают эффективное значение (с учётом оверрайда). Янтарный цвет + точка `●` сигнализирует о переопределении. Клик по бейджу toggles оверрайд; если значение совпало с глобальным — оверрайд автоматически удаляется. Доступно только `canWriteGroups`.

**Файлы изменены:**
- `types/options.ts` — добавлен `OptionTypeCategoryOverride`, поле `categoryOverrides` в `OptionType`
- `services/api.ts` — `categoryOverrides` в `PROTECTED_JSON_FIELDS`
- `features/bundles/components/OptionsEditor.tsx` — импорт типа, `handleToggleCategoryOverride`, UI-бейджи в секции категории
- `features/bundles/components/ConfiguratorModal.tsx` — `effectiveSingle` через `type.categoryOverrides?.[baseMachine.categoryId]`
- `features/bundles/components/ConfiguratorBuilder.tsx` — `effectiveSingle/effectiveRequired` в `OptionCard` через `machine.categoryId`
- `features/pre-calculations/components/detailed-list/modes/MachineModeModal.tsx` — `effectiveSingle/effectiveRequired` через `selectedProduct.categoryId`, обновлены бейджи и `onToggleOption`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: связь позиций с заказами (выручка per-item)
- syncPreCalcItems: `update` → `upsert`

**Ссылки:** [[Modules/Bundles-Options]]

---

## 2026-04-13 — Редактирование комплектации станка в Предрасчёте

**Что сделано:**
- **Кнопка «Изм. комплектацию»** в меню «три точки» слева от позиции (только для `type === 'MACHINE'`)
- **MachineModeModal**: проп `editMode` — заголовок «Изменить комплектацию», синяя иконка, кнопка «Сохранить»
- **AddItemModal**: пропы `initialProductId/initialOptions/editMode` — pre-populate продукт и опции при открытии
- **handleEditConfigApply**: обновляет options/purchasePrice/volumeM3/weightKg/packages; `revenueKzt` — только если нет привязанного заказа и цена не подтверждена; если продукт сменили — обновляет базовые поля товара
- **Обновление заказа**: если `orderId` есть, обновляет `configuration` в `SalesOrderItem` через `actions.updateSalesOrder` — цена и оплата не меняются

**Файлы изменены:**
- `features/pre-calculations/components/detailed-list/modes/MachineModeModal.tsx`
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx`
- `features/pre-calculations/components/detailed-list/DetailedList.tsx`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: связь позиций с заказами (выручка per-item)
- Форма ручного внесения фактической выручки per-item
- syncPreCalcItems: заменить update на upsert

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Модуль Комплектаций: layout, кнопки копирования

**Что сделано:**
- **ConfiguratorBuilder**: убрана автогенерация имени (была схема `machine.name + [опции]`). Имя теперь необязательное поле, просто плейсхолдер.
- **ConfiguratorBuilder: новый блок идентичности** между селектором модели и полем имени — показывает `machine.name` + `machine.sku` + бейджи выбранных вариантов опций + две иконки-кнопки копирования. Убран дублирующий заголовок из скролл-зоны.
- **Поле "Название сборки"**: необязательное, подсвечивается синим только когда заполнено, плейсхолдер — нейтральный.
- **Кнопки копирования** (Copy / ClipboardList) с тостом без подтверждения (1.8с): `Copy` — наши названия (machine.name + variant.name через запятую), `ClipboardList` — для поставщика (supplierProductName с fallback на name).
- **TemplatesGallery**: хинт в верхней части с объяснением иконок; кнопки Copy + ClipboardList добавлены в список и плитку (перед Download); тост фиксированный снизу экрана.

**Файлы изменены:**
- `features/bundles/components/ConfiguratorBuilder.tsx`
- `features/bundles/components/TemplatesGallery.tsx`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: связь позиций с заказами (выручка per-item из salesOrders)
- syncPreCalcItems: `update` → `upsert` чтобы убрать console.warn

**Ссылки:** [[Modules/Bundles-Options]]

---

## 2026-04-10 — Portal-дропдауны, FilterCombobox, crypto.randomUUID fallback

**Что сделано:**
- **CashFlowSelector → Portal**: дропдаун переведён на `createPortal(document.body)` — больше не обрезается `overflow-hidden` в OrderForm/SalesOrderForm и других. Позиция через `getBoundingClientRect()`, умный выбор вверх/вниз, закрытие при скролле/ресайзе.
- **z-index 9999 → 99999**: CounterpartyCreateModal имеет `z-[10001]` — дропдаун был невидим. Поднят zIndex до 99999 в CashFlowSelector и FilterCombobox.
- **FilterCombobox**: новый компонент умного фильтра для Номенклатуры — три фильтра (Название/SKU, Категория, Поставщик/Произв.) заменены на комбобоксы с автодополнением из реальных данных. Категория и Поставщик показывают список при фокусе, Название — только при вводе. Portal + zIndex 99999.
- **FilterCombobox вынесен** в `components/ui/FilterCombobox.tsx` (отдельный файл).
- **crypto.randomUUID fallback**: `ApiService.generateUUID()` падал при доступе по LAN IP (HTTP — не Secure Context). Добавлен fallback через `Math.random()` RFC 4122 UUID v4.
- **Build fix**: после вынесения FilterCombobox в отдельный файл в NomenclatureTable.tsx остались висячие `);` `};` от старого inline-определения — удалены.
- **Диагностика syncPreCalcItems**: ошибка PGRST116 при создании заказа из предрасчёта — не критическая, данные сохраняются через два пути (локальный стейт + пересохранение предрасчёта). К сведению: `syncPreCalcItems` пытается UPDATE по PCI-xxxxxx ID, который в БД уже другой (Supabase UUID). Симптомов потери данных нет.

**Файлы изменены:**
- `components/ui/CashFlowSelector.tsx` — Portal, zIndex 99999, buttonRef, recalcPosition, scroll/resize close
- `components/ui/FilterCombobox.tsx` — создан; Portal, zIndex 99999
- `features/nomenclature/components/NomenclatureTable.tsx` — import FilterCombobox, nameSuggestions/categorySuggestions/supplierMfgSuggestions, замена трёх input на FilterCombobox; fix висячих ); };
- `services/api.ts` — `generateUUID()` fallback для non-secure context

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии
- syncPreCalcItems: заменить `ApiService.update` на `ApiService.upsert` чтобы убрать console.warn

**Ссылки:** [[Modules/UI-CalidadSelect]]

---

## 2026-04-10 — Черновой инвойс (Excel) + Выручка в Партии

**Что сделано:**
- **Экспорт чернового инвойса** из Предрасчёта и Партии в `.xlsx`:
  - Кнопка «Инвойс .xlsx» в тулбаре DetailedList и в action bar BatchDetailPage
  - Столбцы: Название (наше) | Опции (наши) | Название для поставщика | Опции для поставщика | Валюта | Цена за шт. | Кол-во | Сумма
  - Поставщиков берём из `item.supplierName` (= `product.supplierProductName`) и `OptionVariant.supplierProductName`
- **Bug fix**: при создании Партии из Предрасчёта `actualRevenueKzt` теперь рассчитывается из уже оплаченных ПП (пропорционально доле позиции в заказе)
- **Панель выручки в BatchSidebar**: клик на заголовок «Выручка» → показывает ПП → Выписки → Аллокации (первый непустой приоритет), кнопка «Привязать» обновляет `actualRevenueKzt`

**Файлы изменены:**
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — export xlsx
- `features/batches/BatchDetailPage.tsx` — export xlsx + новые props для сайдбара
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx` — bug fix actualRevenueKzt
- `features/batches/hooks/useBatches.ts` — incomingPlannedPayments, incomingActualPayments
- `features/batches/components/BatchMainListTab.tsx` — Выручка header кликабельный
- `features/batches/components/BatchSidebar.tsx` — RevenueSidebarPanel

**Открытые задачи / следующий шаг:**
- BatchMainListTab: связь позиций с заказами (выручка per-item из salesOrders)
- Форма ручного внесения фактической выручки per-item

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Выручка в Партии: bug fix + панель оснований

**Что сделано:**
- **Bug fix (PreCalculationEditorPage)**: при создании Партии `actualRevenueKzt` в `BatchItemActuals` теперь вычисляется из `state.plannedPayments` (входящие ПП по привязанному заказу), пропорционально доле позиции в выручке заказа
- **useBatches**: добавлена загрузка `incomingPlannedPayments` (входящие ПП по orderIds из предрасчёта) и `incomingActualPayments` (входящие Выписки, связанные через allocations с этими ПП); `updateItemActuals` теперь экспортируется
- **BatchMainListTab**: заголовок «Выручка» стал кликабельным (`type: 'revenue'`), показывает суммарный факт
- **BatchSidebar**: расширен тип `SidebarContext` (`'revenue'`); добавлен `RevenueSidebarPanel` — показывает ПП → Выписки → Аллокации (в порядке приоритета, только первый непустой список); кнопка «Привязать как выручку» обновляет `BatchItemActuals.actualRevenueKzt` для всех позиций заказа пропорционально

**Файлы изменены:**
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx` — bug fix: actualRevenueKzt из plannedPayments
- `features/batches/hooks/useBatches.ts` — incomingPlannedPayments, incomingActualPayments, экспорт updateItemActuals
- `features/batches/BatchDetailPage.tsx` — пробрасываем новые props в BatchSidebar
- `features/batches/components/BatchMainListTab.tsx` — Выручка header кликабельный
- `features/batches/components/BatchSidebar.tsx` — RevenueSidebarPanel

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Экспорт чернового инвойса из Предрасчёта в Excel

**Что сделано:**
- **DetailedList.tsx**: добавлена кнопка «Инвойс .xlsx» в тулбар (рядом с «Создать заказ»)
- **handleExportDraftInvoice**: генерирует `.xlsx` через библиотеку `xlsx` (уже была в зависимостях)
- Колонки: Наименование | Наим. для поставщика | Валюта | Цена за шт. | Кол-во | Сумма
- **Наименование**: станок = `name, typeName: variantName, ...`; запчасть = `name`
- **Наим. для поставщика**: станок = `name, typeName: supplierProductName || variantName, ...` (поиск через `optionVariants` из state); запчасть = `name`
- Цена и сумма — в валюте закупки позиции (`purchasePriceCurrency`)
- Имя файла — `Инвойс_<название предрасчёта>.xlsx`

**Файлы изменены:**
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — импорт xlsx + Download, функция + кнопка

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Формат дат ДД.ММ.ГГГГ + фильтры по столбцам в 4 модулях

**Что сделано:**
- **utils/formatDate.ts**: создана утилита `formatDateDMY(dateStr)` — конвертирует ISO `YYYY-MM-DD` → `ДД.ММ.ГГГГ`
- **FilterCombobox вынесен** в `components/ui/FilterCombobox.tsx` (shared-компонент), импорт в `NomenclatureTable` обновлён
- **PaymentsCalendar**: даты → ДД.ММ.ГГГГ; добавлена панель фильтров: Контрагент (FilterCombobox), Статья ДДС (FilterCombobox), Статус (select: Все/Оплачено/Ожидание) + кнопка «Сбросить» + счётчик
- **BankStatements**: даты → ДД.ММ.ГГГГ; добавлен FilterCombobox «Статья ДДС» (фильтрует по allocations[].cashFlowItemId)
- **SalesOrdersList**: даты → ДД.ММ.ГГГГ; добавлен FilterCombobox «Клиент» (рядом с поиском и select статуса); поле поиска сужено до «ID / название»
- **OrdersList**: даты → ДД.ММ.ГГГГ; select поставщика заменён на FilterCombobox «Поставщик» с автодополнением; поиск сужен до «ID / название»

**Файлы изменены:**
- `utils/formatDate.ts` — создан
- `components/ui/FilterCombobox.tsx` — создан
- `features/nomenclature/components/NomenclatureTable.tsx` — убран локальный FilterCombobox, добавлен import
- `features/finance/tabs/PaymentsCalendar.tsx` — полный рефакторинг (фильтры + дата)
- `features/finance/tabs/BankStatements.tsx` — filterCfItem, formatDateDMY
- `features/sales/components/SalesOrdersList.tsx` — clientFilter + formatDateDMY
- `features/procurement/components/OrdersList.tsx` — supplierText (combobox) + formatDateDMY

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/UI-CalidadSelect]]

---

## 2026-04-10 — CashFlowSelector Portal + FilterCombobox в Номенклатуре

**Что сделано:**
- **CashFlowSelector (Portal)**: дропдаун переведён на `createPortal(dropdown, document.body)` — больше не обрезается ни одним родительским `overflow-hidden` (например, в `OrderForm`, `SalesOrderForm`, финансовых модалках). Позиция вычисляется через `getBoundingClientRect()` при открытии; умный выбор направления (вверх/вниз) в зависимости от свободного места; закрытие при скролле/ресайзе; два отдельных ref для кнопки и дропдауна.
- **FilterCombobox в NomenclatureTable**: три фильтра (Название/SKU, Категория, Поставщик/Произв.) заменены на умные комбобоксы с автодополнением. Также через Portal — не обрезается `overflow-hidden` таблицы. Категория и Поставщик показывают список сразу при фокусе; Название — только при вводе (список слишком большой). Фильтрация по-прежнему работает через `includes()` по тексту — ручной ввод фрагмента сохранён.

**Файлы изменены:**
- `components/ui/CashFlowSelector.tsx` — полный рефакторинг дропдауна на Portal; добавлен `buttonRef`, `recalcPosition`, scroll/resize close
- `features/nomenclature/components/NomenclatureTable.tsx` — добавлен `FilterCombobox`, `nameSuggestions`, `categorySuggestions`, `supplierMfgSuggestions`; заменены три `<input>` фильтра

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/UI-CalidadSelect]]

---

## 2026-04-10 — Рефакторинг Предрасчётов: Timeline, удаление Упаковки, разбивка AddItemModal

**Что сделано:**
- **BatchTimelineTab — интерактивная ось дат**: добавлена SVG-ось времени с тиками и датами под диаграммой Ганта; каждый дедлайн по договору отображается точкой (красная со звездой = самый ранний, оранжевые = остальные); тултип при наведении показывает клиента и дату дедлайна
- **contractDeadlines[]**: `PreCalculationEditorPage` вычисляет список дедлайнов из позиций (по `orderId` → `contractDeliveryDate`) и передаёт в `BatchTimelineTab`; тип `ContractDeadline` экспортирован из компонента
- **Опечатка исправлена**: "Доставка Алматы–Карагандо" → "Доставка Алматы–Караганда"
- **Вкладка Упаковка удалена** из `PreCalculationEditorPage`: убраны кнопка, `case 'PACKING_LIST'`, `packingList` state, `addPackingItem`/`updatePackingItem`/`deletePackingItem` из хука, логика сохранения `pre_calculation_packages`, а также очищен `GlobalStore` от `packingListItems` и связанных actions; компонент `PackingList.tsx` сохранён (для будущего использования в Партиях)
- **Рефакторинг AddItemModal** (638 → 374 строки): создана папка `modes/`; ORDER-режим вынесен в `OrderModeModal.tsx` (162 строки); MACHINE-режим в `MachineModeModal.tsx` (267 строк); в `AddItemModal.tsx` осталась логика + PART mode + роутинг

**Файлы изменены:**
- `features/batches/components/BatchTimelineTab.tsx` — SVG-ось дат, маркеры дедлайнов с тултипом, экспорт `ContractDeadline`, фикс "Карагандо"→"Караганда", декомпозиция на `GanttAxis` + `GanttChart`
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx` — вычисление `contractDeadlines[]`, передача в BatchTimelineTab, удаление PackingList tab и связанного кода
- `features/pre-calculations/hooks/usePreCalculations.ts` — удалены `packingList` state и все его функции + логика сохранения
- `features/system/context/GlobalStore.tsx` — удалены `packingListItems`, `addPackingListItem`, `updatePackingListItem`, `deletePackingListItem`
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx` — сокращён до 374 строк, роутинг к режимам
- **Созданы:** `features/pre-calculations/components/detailed-list/modes/OrderModeModal.tsx` (162 стр.), `modes/MachineModeModal.tsx` (267 стр.)

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии
- PackingList.tsx при необходимости перенести в модуль Партий

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Два режима допрасходов в Приёмке (По партии / Вручную)

**Что сделано:**
- **ExpenseForm (полная переработка)**: два таба — «По партии» и «Вручную»
- **По партии**: таблица категорий (8 видов из предрасчёта), плановые суммы из PreCalcItem × qtyFact, редактируемые фактические суммы, выбор метода распределения, «Применить расходы партии», кнопка «Сбросить к плановым», аккордион-разбивка по позициям
- **Вручную**: два аккордиона — «На весь список» (методы: По объёму, По стоимости, По кол-ву, Поровну) и «На позицию»; привязка к документу (Выписка/ПП) в обоих секциях
- **BY_EQUAL = 'Поровну'**: новый метод распределения расходов — равная доля на каждую позицию независимо от кол-ва
- **ReceptionExpense**: добавлены `paymentId?`, `plannedPaymentId?`, `sourceMode?: 'batch' | 'manual'`
- **ReceivingPage**: при нахождении партии для заказа — загружает `pre_calculation_items` через `batch.preCalculationId`, передаёт в форму
- **RECEPTION_TO_BATCH_CATEGORY**: добавлены новые типы (Доставка по Китаю → logistics_china_domestic, Доставка Урумчи-Алматы → logistics_urumqi_almaty, ПНР, Доставка до клиента)

**Файлы изменены:**
- `types/enums.ts` — `BY_EQUAL = 'Поровну'` в ExpenseAllocationMethod
- `types/inventory.ts` — `ReceptionExpense` + 3 новых поля
- `features/receiving/components/ExpenseForm.tsx` — полная переработка (~320 строк)
- `features/receiving/components/ReceivingForm.tsx` — новые props (preCalcItems, actualPayments, plannedPayments, orderId)
- `features/receiving/hooks/useReceivingLogic.ts` — обработка BY_EQUAL
- `features/receiving/ReceivingPage.tsx` — загрузка preCalcItems, import PreCalculationItem
- `features/procurement/hooks/useOrderState.ts` — расширен RECEPTION_TO_BATCH_CATEGORY

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Рефакторинг расчётов Предрасчёта + дефолты Ценообразования

**Что сделано:**
- **Доставка по Китаю (fixed метод)**: логика изменена — вместо фикс.суммы за единицу теперь задаётся одна сумма на всю партию (`chinaDomesticFixedKztTotal`), которая распределяется пропорционально объёму позиций (с учётом `useDimensions`). Позиции без объёма получают 0
- **Переименование поля**: `chinaDomesticFixedKztPerUnit` → `chinaDomesticFixedKztTotal` в типах, хуке, UI и DB (с fallback при загрузке старых записей)
- **Лейблы DetailedList**: колонка "Дост" → "Дост.клиент" (deliveryLocalKzt)
- **Ценообразование (PricingManagerPage)**: обновлены дефолты для нового профиля — НДС 16%, Урумчи-Алматы $150, КПН 0%, Бонус 3%, Объём 20м³, СВХ 100к, Брокер 104к, Сборы 52к, ПНР 0, Доставка 0; лейблы "Тариф Китай" → "Доставка Урумчи-Алматы", "Доставка" → "Доставка до клиента"

**Файлы изменены:**
- `types/pre-calculations.ts` — `chinaDomesticFixedKztPerUnit` → `chinaDomesticFixedKztTotal`
- `features/pre-calculations/hooks/usePreCalculations.ts` — новый расчёт fixed (пропорционально объёму), обновлены дефолт/загрузка/сохранение
- `features/pre-calculations/components/general-settings/GeneralSettings.tsx` — лейбл "Фикс. сумма (партия)", пояснение в подсказке
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — "Дост" → "Дост.клиент"
- `features/products/pages/PricingManagerPage.tsx` — дефолты нового профиля + переименование полей
- **DB**: `china_domestic_fixed_kzt_per_unit` → `china_domestic_fixed_kzt_total` (migration); добавлена и затем убрана `batch_volume_m3` в `pre_calculations` (откат)

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Приоритеты ДДС в карточке контрагента, чистка BatchEconomyTab, баг FK при удалении продукта

**Что сделано:**
- **CounterpartyCreateModal**: добавлена секция «Приоритетные статьи ДДС» — список чипов с × на каждом (удаление), кнопка добавления → inline CashFlowSelector, первая статья помечена ★; сохраняется через `counterpartyData.cashFlowItemIds` при Submit
- **BatchEconomyTab**: удалён файл (давно заменён BatchComparisonTab + BatchMainListTab, нигде не импортировался)
- **unitCostKzt = 0 в списаниях**: `createWriteOff` теперь берёт `unitCostKzt` из созданного движения (InventoryMediator считает FIFO), а не из хардкода модала (0)
- **FK ошибка при удалении продукта (23503)**: полный рефакторинг `deleteProduct` и `permanentlyDelete`; ошибка теперь показывается пользователю прямо в диалоге Номенклатуры; в корзину продукт не попадает если удаление заблокировано FK

**Файлы изменены:**
- `features/counterparties/components/CounterpartyCreateModal.tsx` — секция приоритетных статей ДДС
- `features/inventory/hooks/useInventoryState.ts` — `createWriteOff` (FIFO unitCostKzt), `deleteProduct` (порядок операций + FK error)
- `features/nomenclature/hooks/useNomenclatureCRUD.ts` — async `confirmDeleteAction`, `deleteError` state
- `features/nomenclature/NomenclaturePage.tsx` — показ `deleteError` в диалоге подтверждения
- `features/system/hooks/useReferenceState.ts` — `permanentlyDelete` для типа 'Product' с обработкой FK 23503

**Удалены:**
- `features/batches/components/BatchEconomyTab.tsx`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции партии)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Architecture]]

---

## 2026-04-10 — Чистка DetailedList (PreCalc) + фикс AddItemModal

**Что сделано:**
- **DetailedList (PreCalc)**: удалены кнопки «Быстрое редактирование» и «Массовое редактирование» — они были ошибочно добавлены в Предрасчёт вместо Номенклатуры; убрано всё связанное состояние (`isQuickEditMode`, `isMassEditMode`, `massEditValues`, `massEditEnabled`), функции (`handleMassApply`, `enterMassEdit`, `exitMassEdit`, `enterQuickEdit`), панели (~170 строк удалено); тулбар теперь: только `+ Станок`, `+ Запчасть`, `+ Из заказа`, `Создать заказ`
- **AddItemModal (режим MACHINE)**: левый бар со списком станков расширен 300px → 360px (+20%); названия продуктов теперь переносятся (`break-words`) вместо обрезания (`truncate`)

**Файлы изменены:**
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — удалены массовое/быстрое редактирование
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx` — ширина левого бара +20%, перенос названий

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-10 — Крайняя дата по договору + Планирование сроков (Timeline)

**Что сделано:**
- **SalesOrder**: поле `contractDeliveryDate` — крайняя дата поставки по договору; обязательно если загружен договор; блокирует сохранение с предупреждением; поле появляется только при наличии договора (рядом с FileUpload)
- **BatchTimelineTab** (новый компонент): 6 этапов (Согласование заявки, Изготовление, Доставка по Китаю, Доставка Урумчи–Алматы, Доставка Алматы–Карагандо, Пусконаладка); диаграмма Ганта с датами; предупреждение о выходе за дедлайн; дата старта для расчёта реальных дат
- **BatchDetailPage**: вкладка «Сроки» (CalendarClock); бейдж дедлайна в заголовке; `earliestDeadline` = min(contractDeliveryDate) по связанным заказам через preCalc.items[].orderId
- **PreCalculationEditorPage**: вкладка «Сроки» с amber dot-индикатором при наличии дедлайна; бейдж дедлайна в заголовке; `handleSaveTimeline` сохраняет через `updateMetadata + savePreCalculation`
- **useBatches**: добавлен `updateTimeline` — сохраняет timeline в БД и обновляет state
- **usePreCalculations**: `timeline` добавлен в маппинг загрузки и в `savePreCalculation`
- **api.ts**: `timeline` добавлен в PROTECTED_JSON_FIELDS
- **DB**: `contract_delivery_date DATE` в `sales_orders`; `timeline JSONB` в `batches` и `pre_calculations`
- **types**: `BatchTimeline` интерфейс в `batch.ts`; `timeline?` в `Batch` и `PreCalculationDocument`; `contractDeliveryDate?` в `SalesOrder`

**Файлы изменены:**
- `types/order.ts`, `types/batch.ts`, `types/pre-calculations.ts`
- `features/sales/hooks/useSalesOrderFormState.ts`
- `features/sales/components/SalesOrderForm.tsx`
- `features/batches/hooks/useBatches.ts`
- `features/batches/BatchDetailPage.tsx`
- `features/pre-calculations/hooks/usePreCalculations.ts`
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx`
- `services/api.ts`

**Созданы:**
- `features/batches/components/BatchTimelineTab.tsx`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Architecture]]

## 2026-04-09 — Незавершённые задачи: приоритеты ДДС в карточке, чистка BatchEconomyTab, баг unitCostKzt

**Что сделано:**
- **CounterpartyCreateModal**: добавлена секция «Приоритетные статьи ДДС» — просмотр, добавление (через CashFlowSelector), удаление чипов; первая статья помечена звёздочкой; `cashFlowItemIds` передаётся в `counterpartyData` при сохранении
- **BatchEconomyTab**: удалён устаревший файл (заменён BatchComparisonTab + BatchMainListTab)
- **Баг unitCostKzt = 0 в списаниях**: `createWriteOff` теперь берёт `unitCostKzt` из движения, которое создаёт `InventoryMediator` (FIFO), а не из хардкода модала

**Файлы изменены:**
- `features/counterparties/components/CounterpartyCreateModal.tsx`
- `features/inventory/hooks/useInventoryState.ts`

**Удалены:**
- `features/batches/components/BatchEconomyTab.tsx`

**Открытые задачи / следующий шаг:**
- BatchMainListTab: добавить связь с заказами (выручка по позиции)
- Форма внесения фактической выручки по позиции партии

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Architecture]]

---

## 2026-04-09 — Рефакторинг FinanceCategoriesPage + локальные правки модулей

**Что сделано:**
- Рефакторинг `FinanceCategoriesPage.tsx` (~900 строк) → 5 компонентов в `features/finance/components/`: `CashFlowBadges.tsx`, `DictManagerModal.tsx`, `CreateItemModal.tsx`, `ItemRow.tsx`, `GroupRow.tsx`; страница-оркестратор ~160 строк
- Зафиксирован стандарт разбивки feature-страниц [[Decisions/005-feature-page-component-split]]
- **OptionsTab**: фикс прокрутки (форма + список в одном overflow контейнере), компактная форма (grid-cols-4), CalidadSelect для Производителя
- **NomenclatureTable**: поле Вес (кг) в быстром редактировании рядом с Габаритами
- **MassAddModal**: секция уже добавленных станков (зелёный фон), кнопка отключения, чекбокс «В базе» (★), индикатор «новый тип»; новая сигнатура `onConfirm` с `isBaseMap` и `existingUpdates`
- **OptionsEditor**: `handleConfirmMassAdd` переписан под новую сигнатуру; обработка remove/isBase/priceOverrides для существующих станков
- **MachineConfigEntry**: новое поле `baseVariantIds?: string[]`
- **FinanceCategoriesPage** (до рефакторинга): кнопка «+ Статья» в строке группы (с предзаполненным parentId), кнопка «# Тег» для тегов группы с наследованием в дочерних статьях (визуальное, пунктирная рамка)

**Файлы изменены:**
- `types/product.ts`
- `features/nomenclature/tabs/OptionsTab.tsx`
- `features/nomenclature/components/NomenclatureTable.tsx`
- `features/bundles/components/MassAddModal.tsx`
- `features/bundles/components/OptionsEditor.tsx`
- `features/finance/FinanceCategoriesPage.tsx`

**Созданы:**
- `features/finance/components/CashFlowBadges.tsx`
- `features/finance/components/DictManagerModal.tsx`
- `features/finance/components/CreateItemModal.tsx`
- `features/finance/components/ItemRow.tsx`
- `features/finance/components/GroupRow.tsx`
- `claude-memory/Decisions/005-feature-page-component-split.md`

**Открытые задачи / следующий шаг:**
- Управление приоритетными статьями ДДС в карточке контрагента (CounterpartyManagerPage)
- `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 9-ю сессию!)
- `unitCostKzt` в списании = 0

**Ссылки:** [[Decisions/005-feature-page-component-split]] | [[Modules/Finance]] | [[Architecture]]

---

## 2026-04-09 — Рефакторинг модуля Партий + интеграция с Приёмкой и Снабжением

**Что сделано:**
- **BatchDetailPage**: полностью переписан — KPI-бар (4 карточки), 4 вкладки (Позиции / Расходы / Сравнение / Документы), постоянный сайдбар справа
- **BatchMainListTab** (новый): горизонтальная таблица план/факт по всем статьям расходов. Заголовки колонок кликабельны — открывают форму внесения факта в сайдбаре. Невнесённые данные показывают плановые значения (не 0)
- **BatchSidebar** (новый): постоянная правая панель — базово сводка по партии, при клике на заголовок колонки меняется на форму внесения расхода (с выбором источника: вручную / календарь / выписки). Показывает историю по статье
- **BatchComparisonTab** (новый): базовое сравнение прогноз/факт с DiffBadge и KPI-карточками
- **BatchExpensesTab**: рефакторинг — убрана инлайн-форма, добавлены кнопки открытия сайдбара, бейдж «Приёмка» на расходах из приёмки
- **useBatches**: полный маппинг всех полей предрасчёта, `updateItemActuals`, загрузка `receptions` по `batchId`
- **DB**: `ALTER TABLE receptions ADD COLUMN batch_id`, `ALTER TABLE batch_expenses ADD COLUMN reception_id` + индексы
- **Типы**: `Reception.batchId?`, `BatchExpense.receptionId?`
- **useOrderState.saveReception**: при `r.batchId` автоматически создаёт `BatchExpense` записи из расходов приёмки (маппинг типа → категории партии)
- **ReceivingPage**: при выборе заказа ищет связанную партию через `supplierOrderIds`, передаёт `batchId` в форму
- **ReceivingForm**: баннер «Приёмка привязана к партии: X» при наличии batchId
- **OrdersList + ProcurementPage**: загрузка всех партий, бейдж партии под названием заказа

**Файлы изменены:**
- `features/batches/BatchDetailPage.tsx`
- `features/batches/hooks/useBatches.ts`
- `features/batches/components/BatchExpensesTab.tsx`
- `features/procurement/hooks/useOrderState.ts`
- `features/procurement/ProcurementPage.tsx`
- `features/procurement/components/OrdersList.tsx`
- `features/receiving/ReceivingPage.tsx`
- `features/receiving/components/ReceivingForm.tsx`
- `types/inventory.ts` (Reception.batchId)
- `types/batch.ts` (BatchExpense.receptionId)

**Созданы:**
- `features/batches/components/BatchSidebar.tsx`
- `features/batches/components/BatchMainListTab.tsx`
- `features/batches/components/BatchComparisonTab.tsx`

**Открытые задачи / следующий шаг:**
- Вкладка «Позиции» (BatchMainListTab): добавить связь с заказами (выручка по заказу как в DetailedList)
- Форма внесения фактической выручки по позиции — пока только расходы
- Управление приоритетами в карточке контрагента (CounterpartyManagerPage) — 9-я сессия
- `BatchEconomyTab` старый можно удалить (заменён BatchComparisonTab + BatchMainListTab)
- `unitCostKzt` в списании = 0

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Architecture]]

---

## 2026-04-09 — Приоритетные статьи ДДС для контрагентов

**Что сделано:**
- **DB**: `ALTER TABLE counterparties ADD COLUMN cash_flow_item_ids jsonb DEFAULT '[]'`
- **Тип**: `cashFlowItemIds?: string[]` добавлен в `Counterparty`
- **useReferenceState**: `patchCounterpartyCashFlowItems(id, ids)` — патч только поля cashFlowItemIds без перезаписи счетов
- **GlobalStore**: action `patchCounterpartyCashFlowItems` пробросен через интерфейс
- **CashFlowSelector**: новый prop `priorityItemIds` — показывает секцию «Приоритет» (янтарный цвет, звёздочка у первого) сверху над основным списком; секция скрывается при поиске/фильтре по тегу
- **StatementImportModal**: при разборе выписки первая приоритетная статья контрагента автоматически подставляется (важнее suggestCashFlowItem); в ячейке «Статья ДДС» добавлена кнопка «★ Запомнить» — добавляет текущую статью в приоритеты контрагента прямо из окна импорта
- **ManualPlanModal**: при выборе контрагента автоматически выбирается первая приоритетная статья; priorityItemIds передаётся в CashFlowSelector
- **PaymentModal**: priorityItemIds из контрагента передаётся в CashFlowSelector каждой строки распределения

**Файлы изменены:**
- `types/counterparty.ts`
- `features/system/hooks/useReferenceState.ts`
- `features/system/context/GlobalStore.tsx`
- `components/ui/CashFlowSelector.tsx`
- `components/ui/StatementImportModal.tsx`
- `features/finance/components/ManualPlanModal.tsx`
- `features/finance/components/PaymentModal.tsx`

**Открытые задачи / следующий шаг:**
- Управление приоритетами в карточке контрагента (CounterpartyManagerPage) — просмотр и удаление статей из списка приоритетов
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 8-ю сессию!)

**Ссылки:** [[Modules/Finance]] | [[Architecture]]

---

## 2026-04-09 — Багфиксы: MovementStatus + дропдаун WriteOffModal

**Что сделано:**
- **MovementStatus import error**: убран импорт `MovementStatus` из `enums.ts` — это `type`, а не `enum`, поэтому нельзя использовать как значение. Заменено на строковый литерал `'Physical' as const`
- **WriteOffModal дропдаун**: убран `overflow-hidden` с внешнего контейнера модала и `overflow-y-auto flex-1` с тела — оба обрезали абсолютно позиционированный CalidadSelect. Модал расширен `max-w-lg` → `max-w-2xl`. Убран `dropdownMinWidth` — дропдаун теперь совпадает с шириной триггера через `right-0`

**Файлы изменены:**
- `features/inventory/hooks/useInventoryState.ts` — удалён импорт MovementStatus, `'Physical' as const`
- `features/warehouse/components/WriteOffModal.tsx` — убраны overflow-клиппинги, расширен модал

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 7-ю сессию!)
- `unitCostKzt` в списании = 0. При необходимости подтягивать из `inventorySummary` при выборе товара

**Ссылки:** [[Modules/UI-CalidadSelect]]

---

## 2026-04-09 — Модуль «Списание и брак» (WriteOff)

**Что сделано:**
- **DB**: 2 новые таблицы: `stock_writeoffs` (записи списаний) и `writeoff_reason_types` (справочник типов, 4 дефолтных типа)
- **Меню**: «Брак и потери» → «Списание и брак»
- **Типы**: `WriteOff`, `WriteOffReasonType`, `WriteOffDocument` в `types/inventory.ts`; `StockMovement.documentType` расширен значением `'WriteOff'`
- **constants.ts**: `STOCK_WRITEOFFS`, `WRITEOFF_REASON_TYPES`
- **useInventoryState**: `writeoffs` state, `createWriteOff` (создаёт движение Out + запись БД), `deleteWriteOff` (сторно движение + удаление записи)
- **useReferenceState**: `writeoffReasonTypes` state + `addWriteoffReasonType`, `updateWriteoffReasonType`, `deleteWriteoffReasonType`
- **GlobalStore**: загрузка writeoffs в `loadOperational`, загрузка writeoffReasonTypes в `loadReferences`, новые actions
- **WriteOffModal**: форма создания — выбор товара (CalidadSelect), кол-во, тип-кнопки, textarea причины, FileUpload для документов; временный ID для папки Firebase с момента открытия
- **ReasonTypesModal**: CRUD справочника типов с цветными бейджами, inline-редактирование, выбор цвета
- **WriteOffPage**: таблица списаний с KPI (кол-во, qty, сумма), поиском, сортировкой по дате, раскрываемой строкой с причиной и ссылками на файлы

**Файлы изменены:**
- `types/inventory.ts`, `constants.ts`, `components/system/Layout.tsx`
- `features/inventory/hooks/useInventoryState.ts`
- `features/system/hooks/useReferenceState.ts`
- `features/system/context/GlobalStore.tsx`
- `App.tsx`

**Созданы:**
- `features/warehouse/components/WriteOffModal.tsx`
- `features/warehouse/components/ReasonTypesModal.tsx`
- `features/warehouse/pages/WriteOffPage.tsx`

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится!)
- unitCostKzt в списании сейчас = 0 (нет доступа к средней себестоимости в момент создания). При необходимости — подтягивать из `inventorySummary`

**Ссылки:** [[Modules/Inventory]] | [[Architecture]]

---

## 2026-04-08 — CalidadSelect + многоколоночная сортировка в Остатках

**Что сделано:**
- Заменены нативные `<select>` (Оборудование, Категории) на `CalidadSelect` в `InventoryPage`
- Добавлена сортировка по числовым столбцам: Себест. ед. (`unitCost`), Себест. общ. (`totalCost`), Цена Пр. ед. (`salesPrice`), Выручка (`revenue`)
- Экспортирован тип `InventorySortKey` из `useInventoryFilters`
- `StockTable` получил `sortConfig` prop и компонент `SortTh` — активный столбец подсвечен синим + стрелка ChevronUp/Down

**Файлы изменены:**
- `features/inventory/hooks/useInventoryFilters.ts` — экспорт `InventorySortKey`, расширен тип
- `features/inventory/InventoryPage.tsx` — CalidadSelect импорт, числовая сортировка в useMemo, передача sortConfig в StockTable
- `features/inventory/components/StockTable.tsx` — SortTh компонент, обновлены props

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 6-ю сессию!)

**Ссылки:** [[Modules/Inventory]] | [[Modules/UI-CalidadSelect]]

---

## 2026-04-08 — Сортировка в MassAddModal (Опции)

**Что сделано:**
- Добавлена кликабельная сортировка по трём полям: **Станок** (название), **Закуп** (basePrice), **Продажа** (salesPrice)
- Повторный клик по активному заголовку — переключает направление asc/desc; клик по другому — меняет поле и сбрасывает на asc
- Компонент `SortTh` — заголовок-кнопка: активный подсвечен синим + стрелка ChevronUp/Down; неактивные — призрачная стрелка при наведении
- Дефолт: сортировка по названию по возрастанию (сохранено поведение как было)

**Файлы изменены:**
- `features/bundles/components/MassAddModal.tsx` — типы `SortField`/`SortDir`, состояние `sortField`/`sortDir`, хендлер `handleSort`, компонент `SortTh`, обновлён `filteredMachines` useMemo

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 5-ю сессию!)

**Ссылки:** [[Modules/Bundles-Options]]

---

## 2026-04-08 — Дубль без «(копия)» + Доставка по Китаю в предрасчётах

**Что сделано:**
- **Дублирование Номенклатуры** — убрано слово «(копия)» из name/supplierProductName; добавлен `isCopy` флаг, при дублировании в шапке ProductModal появляется янтарный бейдж «Создание дубля — это новая позиция»
- **Дублирование Вариантов опций** — убрано «(копия)» из name; в VariantForm при клонировании показывается янтарная полоса «Создание дубля — это новый вариант»
- **Доставка по Китаю** в модуле Предрасчёты:
  - Новые поля `ChinaDomesticRateMethod` + 4 поля в `GeneralSettings` + `deliveryChinaDomesticKzt` в `PreCalculationItem`
  - Миграция БД: `pre_calculations` — 4 новых колонки; `pre_calculation_items` — `delivery_china_domestic_kzt`
  - 3 метода расчёта: от объёма ($/м³), от веса ($/тонна), фикс. цена (₸/ед); курс — тот же что у Урумчи
  - Включена в `fullCostKzt`, `preSaleCostKzt`, `customsNdsKzt` (×0.6)
  - UI в GeneralSettings: карточка «Доставка по Китаю» с 3 кнопками-переключателями и полем ставки
  - Колонка «Кит.Дом» в DetailedList (голубой цвет, между Урумчи и Алм.-Кар.)
  - `plannedLogisticsChinaDomesticKzt` в создаваемой партии теперь реальный, а не 0

**Файлы изменены:**
- `types/pre-calculations.ts` — `ChinaDomesticRateMethod`, новые поля
- `features/pre-calculations/hooks/usePreCalculations.ts` — дефолты, загрузка, расчёт, сохранение
- `features/pre-calculations/components/general-settings/GeneralSettings.tsx` — карточка «Доставка по Китаю»
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — колонка Кит.Дом
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx` — инициализация поля
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx` — реальный planned в партию
- `features/nomenclature/hooks/useNomenclatureCRUD.ts` — isCopy, убрано «(копия)»
- `features/nomenclature/NomenclaturePage.tsx` — передача isCopy
- `features/nomenclature/components/ProductModal.tsx` — янтарный бейдж
- `features/bundles/components/OptionsEditor.tsx` — isCloning, убрано «(копия)»
- `features/bundles/components/VariantForm.tsx` — isCopy пропс + янтарная полоса

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 5-ю сессию!)
- По теме Доставки по Китаю: в Партиях расход `logistics_china_domestic` уже существует как категория. Логика запоздалого отражения (оплата попадает в следующую партию) — это организационный процесс, не требует доп. кода сейчас.

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Decisions/001-rename-expense-categories-and-delivery]] | [[Decisions/004-china-domestic-delivery-rate-methods]] | [[Architecture]]

---

## 2026-04-07 — Инфраструктура статей ДДС: группы, теги, CashFlowSelector

**Что сделано:**
- **DB миграция**: новая таблица `cash_flow_tags`, добавлены колонки `parent_id`, `is_group`, `sort_order`, `tag_ids` в `cash_flow_items`
- **TypeScript**: добавлен интерфейс `CashFlowTag`, расширен `CashFlowItem` (isGroup, parentId, sortOrder, tagIds)
- **`constants.ts`**: добавлен `CASH_FLOW_TAGS`
- **`useReferenceState`**: загрузка тегов, `updateCashFlowItem`, CRUD для тегов (add/update/delete)
- **`GlobalStore`**: `cashFlowTags` в стейте, actions, загрузке
- **`FinanceCategoriesPage`**: полностью переписана — группы с вложенностью, управление тегами, фильтр по тегу, inline-переименование
- **`CashFlowSelector`** (`components/ui/CashFlowSelector.tsx`): новый компонент — сгруппированный дропдаун с поиском и фильтром по тегам
- Заменены нативные `<select>` → `CashFlowSelector` в: `PaymentModal`, `ManualPlanModal`, `StatementImportModal`, `OrderPaymentsTab`, `SalesPaymentsTab`

**Файлы изменены:**
- `types/finance.ts` — CashFlowTag, расширен CashFlowItem
- `constants.ts` — CASH_FLOW_TAGS
- `features/system/hooks/useReferenceState.ts` — теги, updateCashFlowItem
- `features/system/context/GlobalStore.tsx` — cashFlowTags
- `features/finance/FinanceCategoriesPage.tsx` — полная переработка
- `components/ui/CashFlowSelector.tsx` — создан
- `features/finance/components/PaymentModal.tsx` — CashFlowSelector
- `features/finance/components/ManualPlanModal.tsx` — CashFlowSelector
- `components/ui/StatementImportModal.tsx` — CashFlowSelector
- `features/procurement/components/OrderPaymentsTab.tsx` — CashFlowSelector
- `features/sales/components/SalesPaymentsTab.tsx` — CashFlowSelector

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (**5-я сессия подряд!**)
- Применить `CalidadSelect` в других местах по мере работы

**Ссылки:** [[Modules/Finance]] | [[Architecture]]

---

## 2026-04-08 — [ИТОГ СЕССИИ] Quick/Mass Edit в номенклатуре + CalidadSelect стандарт

**Что сделано:**
- Quick Edit (Zap) и Mass Edit (Layers) в **NomenclatureTable** — поставщик, производитель, метод цены, наценка, ТНВЭД, габариты
- Quick Edit (Zap) и Mass Edit (Layers) в **DetailedList** (предрасчёты) — поставщик, метод цены, наценка, ТНВЭД, габариты, категория
- Создан стандарт выпадающего списка **CalidadSelect** (`components/ui/CalidadSelect.tsx`) и задокументирован в vault
- Vault: создана заметка `[[Modules/UI-CalidadSelect]]`, обновлён `[[Architecture]]`

**Файлы изменены:**
- `components/ui/CalidadSelect.tsx` — создан (новый стандарт дропдауна)
- `features/nomenclature/components/NomenclatureTable.tsx` — Quick Edit, Mass Edit, CalidadSelect
- `features/nomenclature/NomenclaturePage.tsx` — `onInlineUpdate`, `onMassUpdate`
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — Quick Edit, Mass Edit
- `claude-memory/Modules/UI-CalidadSelect.md` — создан
- `claude-memory/Architecture.md` — добавлена ссылка на UI-CalidadSelect

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 4-ю сессию!)
- Применить `CalidadSelect` в других местах проекта вместо нативных `<select>` и старого `SearchableDropdown` — по мере работы

**Ссылки:** [[Modules/UI-CalidadSelect]] | [[Modules/Batches-PreCalc]] | [[Architecture]]

---

## 2026-04-08 — CalidadSelect + Quick/Mass Edit в Номенклатуре

**Что сделано:**
- **CalidadSelect** (`components/ui/CalidadSelect.tsx`) — новый переиспользуемый компонент-стандарт для всех выпадающих списков. Точно повторяет стиль GeneralTab (производитель): кнопка-триггер, dropdown с поиском, чекмаркер активного элемента. Пропсы: `options`, `value`, `onChange`, `placeholder`, `nullLabel`, `disabled`, `className`, `dropdownMinWidth`, `zIndex`
- **Quick Edit в NomenclatureTable** — кнопка «Быстрое ред.» (Zap). Sub-row под каждой строкой с CalidadSelect для: поставщика, метода цены, ТНВЭД; text input для производителя; 3 инпута для габаритов (если 1 место). Сохранение на blur/Enter, жёлтая точка + кнопка «Сохранить» пока есть несохранённые изменения
- **Mass Edit в NomenclatureTable** — кнопка «Массовое ред.» (Layers). Панель с CalidadSelect для: поставщика, категории, ТНВЭД, метода цены; text input для производителя; наценка % если выбран метод с наценкой. Каждое поле включается чекбоксом. Кнопка «Применить» → `actions.updateProduct` для всех выбранных
- **Документация** — `claude-memory/Modules/UI-CalidadSelect.md` — полная анатомия паттерна с Tailwind-классами, API и правилом применения

**Файлы изменены:**
- `components/ui/CalidadSelect.tsx` — создан новый компонент
- `features/nomenclature/components/NomenclatureTable.tsx` — Quick Edit, Mass Edit, CalidadSelect
- `features/nomenclature/NomenclaturePage.tsx` — `onInlineUpdate`, `onMassUpdate`, передача `hscodes`/`manufacturers`
- `claude-memory/Modules/UI-CalidadSelect.md` — создан

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — корректно ли читает переименованные поля (переносится 4-ю сессию)
- Рассмотреть замену `SearchableDropdown` на `CalidadSelect` в других местах проекта (по мере работы)

**Ссылки:** [[Modules/UI-CalidadSelect]] | [[Architecture]]

---

## 2026-04-07 — Быстрое и массовое редактирование позиций предрасчёта

**Что сделано:**
- **Быстрое редактирование (Quick Edit)** в `DetailedList`: кнопка «Быстрое ред.» (Zap-иконка) в тулбаре. В режиме QE под каждой строкой раскрывается sub-row с янтарным фоном, где inline-редактируются: поставщик (`supplierName`), ТНВЭД (`hsCode`), метод ценообразования (`isRevenueConfirmed`), наценка (`marginPercentage`) + расч. цена (read-only), габариты (`packages[0]` — Д×Ш×В если 1 место; badge «N мест → карточка» если несколько)
- **Массовое редактирование (Mass Edit)** в `DetailedList`: кнопка «Массовое» (Layers-иконка). Режим показывает панель над таблицей с чекбоксами-полями: поставщик, производитель, ТНВЭД, категория (через productId → products), метод/наценка. Тулбар: «Выбрать все» / «Снять всё», счётчик, «Применить». Обновляет PreCalculationItem-поля через `onUpdateItemsBatch`, категорию — через `ApiService.update(PRODUCTS, ...)`

**Файлы изменены:**
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — Quick Edit sub-row, Mass Edit panel и тулбар, хелперы, Fragment-обёртка для map

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — корректно ли читает переименованные поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (переносится 3-ю сессию подряд)
- «Доставка по Китаю» в предрасчёте пока не заведена как отдельное поле (отложено)

**Ссылки:** [[Modules/Batches-PreCalc]]

---

## 2026-04-07 — Мультивалютность комплектаций, фильтры конструктора, ценообразование

**Что сделано:**
- **Мультивалютность предрасчёта**: добавлен `purchasePriceBreakdown: Record<string, number>` — разбивка закупочной цены по валютам для позиций с опциями разных валют (USD+CNY). Пересчёт KZT теперь применяет курс предрасчёта к каждой валюте отдельно
- **ConfiguratorBuilder**: добавлены фильтры Поставщик и Производитель с дропдаунами «в стиле номенклатуры» (поле поиска по частичному совпадению, галочка на выбранном, click-outside закрытие)
- **Ценообразование — Производитель**: добавлено поле `applicableManufacturer` в профиль (БД + тип + `findProfile`). В модале создания/редактирования — дропдаун с поиском
- **Ценообразование — точечный пересчёт**: новый метод `PricingService.recalculateProfilePrices` пересчитывает цены только у товаров, к которым привязан конкретный профиль. Кнопка `RefreshCw` на каждой строке таблицы профилей, спиннер + тост «✓ N товаров»

**Файлы изменены:**
- `types/pre-calculations.ts` — добавлено поле `purchasePriceBreakdown`
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx` — функция `computePriceBreakdown`, передаётся при добавлении в MACHINE и ORDER режимах
- `features/pre-calculations/hooks/usePreCalculations.ts` — мультивалютный пересчёт в `calculatedItemsResult`, упаковка/распаковка breakdown в JSON-поле `options`, сброс breakdown при ручном изменении цены
- `features/bundles/components/ConfiguratorBuilder.tsx` — фильтры поставщик + производитель, иконки Factory/Truck
- `types/product.ts` — `PricingProfile.applicableManufacturer?: string`
- `services/PricingService.ts` — `findProfile` + `matchManufacturer`, новый `recalculateProfilePrices`, импорт `TableNames`
- `features/products/pages/PricingManagerPage.tsx` — дропдауны с поиском для поставщика и производителя в модале, кнопка точечного пересчёта на строку, столбец Производитель в таблице
- **БД миграция**: `ALTER TABLE pricing_profiles ADD COLUMN applicable_manufacturer text`

**Открытые задачи / следующий шаг:**
- Проверить `BatchEconomyTab` — корректно ли читает переименованные поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt` (перенесено из прошлой сессии, ещё не проверено)
- «Доставка по Китаю» в предрасчёте пока не заведена как отдельное поле (отложено)
- В `recalculateProfilePrices` для PART-товаров нет объёма — `calculateSmartPrice` получает `configVolumeM3 = undefined`, что ок, но стоит проверить на реальных данных

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Decisions/001-rename-expense-categories-and-delivery]] | [[Decisions/002-multicurrency-breakdown-in-precalc]] | [[Decisions/003-pricing-profile-targeted-recalculate]]

---

## 2026-04-07 — Партии: расходы по категориям + переименование доставок

**Что сделано:**
- Исправлена ошибка `payment_counterparty_name` — добавлена отсутствующая колонка в `planned_payments`
- Исправлена ошибка `delivery_almaty_karaganda_kzt_per_m3` — переименована колонка `shipping_karaganda_kzt` в `pre_calculations`
- Переименованы виды доставок: «Китай» → «Урумчи–Алматы», «Локальная/Кар.» → «Алматы–Кар.»; добавлена новая «По Китаю»
- Расширен `ExpenseCategory` до 14 категорий (НДС там./пр./перепр., КПН4/20, ПНР, до клиента и др.)
- Миграции БД: обновлён CHECK constraint `batch_expenses_category_check`, переименованы колонки в `batches` и `pre_calculation_items`, мигрированы старые значения категорий
- Редизайн `BatchExpensesTab`: таблица итогов с кнопкой «+» под каждой категорией, панель добавления с источником (Вручную / Календарь / Выписки), журнал с поиском

**Файлы изменены:**
- `types/batch.ts` — новый `ExpenseCategory`, переименованы поля `Batch`
- `types/pre-calculations.ts` — `deliveryChinaKzt` → `deliveryUrumqiAlmatyKzt`
- `features/pre-calculations/hooks/usePreCalculations.ts` — поля, DB-ключи, расчёты
- `features/pre-calculations/pages/PreCalculationEditorPage.tsx` — поля создания партии
- `features/pre-calculations/components/detailed-list/DetailedList.tsx` — заголовки, refs
- `features/pre-calculations/components/detailed-list/AddItemModal.tsx` — rename field
- `features/pre-calculations/components/general-settings/GeneralSettings.tsx` — метки
- `features/batches/hooks/useBatches.ts` — DB-ключи при загрузке позиций
- `features/batches/BatchDetailPage.tsx` — категории в боковой панели расходов
- `features/batches/components/BatchExpensesTab.tsx` — полный редизайн

**Открытые задачи / следующий шаг:**
- «Доставка по Китаю» в предрасчёте пока не заведена как отдельное поле (договорились обсудить отдельно)
- Проверить что BatchEconomyTab корректно читает переименованные поля `deliveryUrumqiAlmatyKzt` / `logisticsAlmatyKaragandaKzt`

**Ссылки:** [[Modules/Batches-PreCalc]] | [[Decisions/001-rename-expense-categories-and-delivery]]

---

## 2026-04-06 — Настройка MCP и проверка Supabase подключения

**Что сделано:**
- Обнаружены три MCP-конфига: `.mcp.json` (корень), `.vscode/mcp.json` (устаревший), `.idx/mcp.json` (Project IDX)
- Удалён `.vscode/mcp.json` — содержал нерабочие плейсхолдеры
- В `.idx/mcp.json` добавлен Supabase MCP (скопирован из `.mcp.json`) рядом с firebase
- Проверено подключение к Supabase через MCP — успешно, видны все 49 таблиц

**Файлы изменены:**
- `.idx/mcp.json` — добавлен supabase MCP сервер
- `.vscode/mcp.json` — удалён

**Открытые задачи / следующий шаг:**
- нет

**Ссылки:** [[Architecture]]

---

## 2026-04-06 — Первоначальное наполнение vault

**Что сделано:**
- Проанализированы все модули, типы, сервисы проекта
- Создан [[DataModel]] — все типы, enum'ы, центральные сущности
- Создан [[Modules/Inventory]] — склад, движения, InventoryMediator
- Создан [[Modules/Bundles-Options]] — конфигуратор, опции, комплекты
- Создан [[Modules/Finance]] — план/факт/казначейство, выписки, внутренние переводы
- Создан [[Modules/Procurement-Sales]] — закупки, продажи, приёмка, отгрузка
- Создан [[Modules/Batches-PreCalc]] — партии, предрасчёты, калькулятор партии
- Обновлён [[Architecture]] — добавлены ссылки на все модули

**Незакоммиченные файлы (требуют внимания):**
- `features/bundles/components/OptionsEditor.tsx` — изменён
- `features/bundles/components/MassAddModal.tsx` — новый
- `features/bundles/components/VariantForm.tsx` — новый
- `features/inventory/hooks/useInventoryState.ts` — изменён
- `features/system/context/GlobalStore.tsx` — изменён
- `services/api.ts` — изменён

**Открытые задачи:** нет

---

## 2026-04-06 — Инициализация документации

**Что сделано:**
- Проанализирована кодовая база CalidadERP
- Создан `CLAUDE.md` с правилами работы с проектом
- Создан `claude-memory/Architecture.md` — архитектура, модули, маршруты, БД, паттерны
- Создан `claude-memory/Tech-Stack.md` — технологический стек
- Создан `claude-memory/Session-Log.md` (этот файл)

**Текущее состояние проекта:**
- В git есть несколько незакоммиченных изменений:
  - `features/bundles/components/OptionsEditor.tsx` — изменён
  - `features/inventory/hooks/useInventoryState.ts` — изменён
  - `features/system/context/GlobalStore.tsx` — изменён
  - `services/api.ts` — изменён
  - Новые файлы: `MassAddModal.tsx`, `VariantForm.tsx` в bundles/components

**Открытые задачи / что требует внимания:**
- Незакоммиченные изменения в нескольких файлах — уточнить у пользователя статус

---

## 2026-04-06 — Создание PROJECT.md (цели и вехи ERP)

**Что сделано:**
- Запрошен статус проекта через `gsd_query` — PROJECT.md и STATE.md отсутствовали
- Прочитаны все заметки vault: Architecture, Tech-Stack, все модули (Inventory, Bundles-Options, Finance, Procurement-Sales, Batches-PreCalc)
- Создан `PROJECT.md` в корне проекта с Objective и 3 Milestones:
  1. Тестирование и закрытие Bundles & Options (smoke-test + коммит)
  2. Завершить Партии (Batches) — фактические расходы/доходы, документы, генерация, план/факт, закрытие
  3. Базовая отчётность — ОДДС, ОПиУ, эффективность партий, ABC-XYZ анализ

**Файлы изменены:**
- `PROJECT.md` — создан (новый файл в корне)

**Открытые задачи / следующий шаг:**
- Milestone 1: завершить и закоммитить MassAddModal, VariantForm, OptionsEditor

**Ссылки:** [[Architecture]] | [[Modules/Bundles-Options]]

---
<!-- Шаблон для следующих записей:

## YYYY-MM-DD — Название задачи

**Что сделано:**
- 

**Файлы изменены:**
- 

**Открытые задачи:**
- 

-->
