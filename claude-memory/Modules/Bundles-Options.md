# Модуль: Bundles & Options (Комплекты и Опции)
> Связанные заметки: [[Architecture]] | [[DataModel]] | [[Modules/Inventory]]
> Дата документирования: 2026-04-06

## Назначение
Система конфигурации товаров. Позволяет создавать **опции** (типы с вариантами, например "Цвет": Красный/Синий) и **комплекты** (готовые сборки товара с набором выбранных вариантов). Используется при продажах и предрасчётах для точного конфигурирования заказа.

Оба раздела доступны через один `BundlesPage` — маршруты `/bundles` и `/options`.

## Ключевые файлы
| Файл | Назначение |
|---|---|
| `features/bundles/BundlesPage.tsx` | Точка входа, переключение вкладок |
| `features/bundles/components/OptionsEditor.tsx` | Редактор типов опций и вариантов |
| `features/bundles/components/ConfiguratorBuilder.tsx` | Построитель конфигуратора (привязка опций к товару) |
| `features/bundles/components/ConfiguratorModal.tsx` | Модальное окно выбора конфигурации при заказе |
| `features/bundles/components/TemplatesGallery.tsx` | Галерея шаблонов комплектов |
| `features/bundles/components/MassAddModal.tsx` | Массовое добавление вариантов *(новый файл)* |
| `features/bundles/components/VariantForm.tsx` | Форма варианта опции *(новый файл)* |
| `features/bundles/hooks/useBundleConfigurator.ts` | Логика конфигуратора |
| `services/BundleCalculator.ts` | Расчёт итоговой цены комплекта |

## Модель данных

### OptionType (тип опции)
```typescript
{
  name: string           // например "Цвет рабочей поверхности"
  isRequired: boolean
  isSingleSelect: boolean
  categoryId?: string    // привязка к категории товаров
  supplierId?: string
  variants?: OptionVariant[]
}
```

### OptionVariant (вариант опции)
```typescript
{
  typeId: string
  name: string
  price: number
  currency: Currency
  volumeM3?: number      // для расчёта логистики
  composition?: { productId: string; quantity: number }[]  // из каких товаров состоит
  imageUrl?: string
}
```

### Bundle (комплект)
```typescript
{
  baseProductId: string       // основной товар (станок)
  selectedVariantIds: string[] // выбранные варианты опций
  totalPurchasePrice: number
  totalPrice: number
  isTemplate: boolean         // шаблон для галереи
}
```

### MachineConfigEntry (конфигуратор станка, в Product)
```typescript
{
  typeId: string              // ID типа опции
  allowedVariantIds: string[] // доступные варианты для этого типа
  priceOverrides: Record<string, number>  // переопределение цен вариантов
  defaultVariantId?: string
}
```

## Бизнес-логика

### Как работает конфигурация
1. Каждый товар типа `MACHINE` может иметь `machineConfig` — список типов опций с допустимыми вариантами.
2. При создании заказа/продажи открывается `ConfiguratorModal`, где выбираются варианты.
3. Выбранные варианты сохраняются как `configuration: string[]` (массив ID вариантов) в позиции заказа/отгрузки.
4. `BundleCalculator` суммирует базовую цену товара + цены выбранных вариантов.

### Шаблоны (isTemplate)
Комплекты с `isTemplate: true` отображаются в `TemplatesGallery` и могут быть клонированы для быстрого создания нового комплекта.

### composition у вариантов
Вариант может "раскладываться" на составные товары (`composition`). Используется для учёта расходников/запчастей, входящих в опцию.

## Мобильная версия (добавлена 2026-04-15)

**Файл:** `features/bundles/components/MobileOptionsEditor.tsx`

Два экрана (локальный `screen: 'types' | 'variants'`):
1. **types** — список типов с поиском, карточки с кнопками edit/delete, drill-in по тапу на строку
2. **variants** — кнопка назад, фильтр по категориям (chips), карточки вариантов сгруппированные по `machineCategory`

Вложенные overlays:
- `SearchOverlay` — `fixed inset-0 z-[500]` — полноэкранный поиск поставщика/категории/производителя
- `VariantFormSheet` — `fixed inset-0 z-[300]` — форма создания/редактирования варианта
- Type form — `fixed inset-0 z-[300]` — форма создания/редактирования типа
- Delete confirm — `fixed inset-0 z-[400]`

**BundlesPage.tsx** — early return для `mode === 'options' && isMobile`:
```tsx
if (mode === 'options' && isMobile) {
    return <div className="h-full"><MobileOptionsEditor /></div>;
}
```
Это позволяет не рендерить десктопную шапку.

Связано: [[Modules/UI-Mobile]]
