# Session Log

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
