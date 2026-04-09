# ADR-005: Разбивка больших feature-страниц на компоненты
> Связанные заметки: [[Architecture]] | [[Session-Log]]
> Дата: 2026-04-09
> Статус: Принято

## Контекст

`FinanceCategoriesPage.tsx` вырос до ~900 строк — в одном файле жили константы, 4 вспомогательных компонента, 2 модала, 2 строки таблицы и сама страница-оркестратор. Файл стало тяжело читать, и при добавлении новой функциональности (теги группы, кнопки в строке группы) он продолжал расти. Это типичная ситуация для feature-страниц, которые итеративно расширяются.

## Рассмотренные варианты

1. **Оставить всё в одном файле** — просто, нет лишних импортов. Минус: файл >800 строк, трудно ориентироваться, Claude теряет контекст при чтении частями.

2. **Вынести компоненты в `features/<module>/components/`** — каждый логически независимый блок в свой файл. Плюс: читаемость, изолированный стейт, лёгкое переиспользование. Минус: больше файлов, нужны общие типы/интерфейсы.

3. **Вынести в `components/ui/`** — только для действительно общих UI-примитивов, не специфичных для домена. Не подходит для доменных компонентов типа `GroupRow`.

## Принятое решение

Вариант 2: **`features/<module>/components/`** как папка для всех компонентов, специфичных для модуля.

Правила разбивки:
- **Примитивы / бейджи** → `components/XxxBadges.tsx` (ColorPicker, TagBadge, TypeBadge + PALETTE)
- **Модалы** → отдельный файл на каждый модал (`DictManagerModal.tsx`, `CreateItemModal.tsx`)
- **Строки таблицы с локальным стейтом** → отдельный файл (`ItemRow.tsx`, `GroupRow.tsx`)
- **Shared callbacks interface** → экспортируется из компонента-строки (`ItemRowCallbacks`) и переиспользуется в GroupRow
- **Страница-оркестратор** → только state, derived data (useMemo), обработчики и JSX верхнего уровня. Не содержит определений компонентов.

## Последствия

**Плюсы:**
- Страница-оркестратор: ~160 строк вместо ~900
- Каждый компонент помещается в окно чтения Claude целиком
- Локальный UI-стейт (confirmDelete, showPicker) изолирован в своём компоненте — нет утечки в родителя
- Интерфейс callbacks (`ItemRowCallbacks`) переиспользуется между `ItemRow` и `GroupRow` без дублирования

**Минусы / компромиссы:**
- Больше файлов на навигацию
- При изменении интерфейса callbacks нужно обновить несколько файлов
- Импорты в странице становятся длиннее

## Связанный код

- [features/finance/FinanceCategoriesPage.tsx](features/finance/FinanceCategoriesPage.tsx) — оркестратор (~160 строк)
- [features/finance/components/CashFlowBadges.tsx](features/finance/components/CashFlowBadges.tsx) — PALETTE, ColorPicker, TagBadge, TypeBadge
- [features/finance/components/DictManagerModal.tsx](features/finance/components/DictManagerModal.tsx) — CRUD справочников (теги/типы)
- [features/finance/components/CreateItemModal.tsx](features/finance/components/CreateItemModal.tsx) — создание группы/статьи
- [features/finance/components/ItemRow.tsx](features/finance/components/ItemRow.tsx) — строка статьи + экспорт `ItemRowCallbacks`
- [features/finance/components/GroupRow.tsx](features/finance/components/GroupRow.tsx) — строка группы с кнопками и тегами

## Применимость

Этот паттерн применять когда файл превышает **~400 строк** или содержит **3+ определения компонентов**. Примеры других кандидатов: `OptionsEditor.tsx`, `ProductModal.tsx`.
