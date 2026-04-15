# Модуль: Nomenclature (Номенклатура)
> Связанные заметки: [[Architecture]] | [[Modules/Bundles-Options]] | [[Modules/UI-Mobile]]
> Дата документирования: 2026-04-15

## Назначение
Справочник товаров (Запчасти, Станки, Услуги). CRUD товаров с ценообразованием, категориями, поставщиками, производителями, опциями (для станков), изображениями.

Маршрут: `/nomenclature` → `NomenclaturePage.tsx`

## Ключевые файлы

| Файл | Назначение |
|---|---|
| `features/nomenclature/NomenclaturePage.tsx` | Точка входа, десктоп + mobile branch |
| `features/nomenclature/components/NomenclatureTable.tsx` | Десктопная таблица товаров |
| `features/nomenclature/components/MobileNomenclatureView.tsx` | **Мобильный список** — карточки, фильтры, поиск |
| `features/nomenclature/components/MobileProductForm.tsx` | **Мобильная форма** редактирования/создания товара |
| `features/nomenclature/hooks/useNomenclatureCRUD.ts` | Логика CRUD (сохранение, удаление, дублирование) |
| `features/nomenclature/hooks/useIsMobile.ts` | Re-export из `@/hooks/useIsMobile` |

## Модель данных (Product)

```typescript
{
  id: string
  name: string
  sku: string
  type: ProductType         // MACHINE | PART | SERVICE
  categoryId?: string
  supplierId?: string
  manufacturerId?: string
  basePrice: number
  baseCurrency: Currency    // KZT | USD | CNY | EUR | RUB
  salesPrice: number
  salesCurrency: Currency
  markup: number            // %
  stock: number
  imageUrl?: string
  machineConfig?: MachineConfigEntry[]  // только для MACHINE
}
```

## Мобильная версия (добавлена 2026-04-15)

### MobileNomenclatureView
- Карточка товара: миниатюра (w-14 h-14), имя + бейдж остатков, SKU, чипы (категория/поставщик/производитель), цена внизу
- Действия на карточке: иконки Изменить / Дублировать / Удалить (без подписей)
- Хедер: заголовок + счётчик + кнопка +Создать (`flex-none` чтобы не обрезалась)
- Поиск: строка поиска
- Переключатель типов: 3 колонки (Запчасти / Станки / Услуги)
- Фильтр по категориям: горизонтальный скролл `overflow-x-auto`
- Удаление: собственный confirm bottom-sheet → вызывает `onDelete(id: string): Promise<void>` напрямую (не через десктопный confirm диалог)
- Дублирование: `const { id, ...rest } = product; setFormInitial({ ...rest, sku: \`${rest.sku}_copy\` })`

### MobileProductForm
- Bottom-sheet: `fixed inset-0 z-[200]`
- Вкладки "Основное" / "Опции" (только для станков)
- **Поставщик через SupplierOverlay** — `fixed inset-0 z-[400]`, рендерится как первый элемент в React fragment ПЕРЕД главным div модала. Причина: если рендерить внутри контейнера с `overflow:hidden`, оверлей обрезается и появляется на уровне шапки.
- Двустороннее вычисление цен: `basePrice × rate × markup = salesPrice` и обратно
- Все inputs: `text-[15px]` — защита от auto-zoom на iOS Safari (зум срабатывает при font-size < 16px)
- MobileOptionsSection: чекбоксы типов опций + раскрываемые списки вариантов

## Паттерн мобильного разветвления

```tsx
// NomenclaturePage.tsx
const isMobile = useIsMobile();
if (isMobile) return <MobileNomenclatureView ... />;
// ... десктопный рендер
```

## Известные решения

### Overlay внутри overflow:hidden — НЕПРАВИЛЬНО
```tsx
// ❌ Будет обрезан, появится на уровне родителя
<div className="overflow-hidden relative">
  <div className="absolute inset-0 z-50">...</div>
</div>
```

### Правильный паттерн: fixed + React fragment
```tsx
// ✅ Рендерим ПЕРЕД основным div, вне overflow:hidden
return (
  <>
    {showOverlay && <div className="fixed inset-0 z-[400]">...</div>}
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* основная форма */}
    </div>
  </>
);
```
