# Session Log

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
