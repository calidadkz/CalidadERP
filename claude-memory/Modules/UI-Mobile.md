# UI: Мобильные паттерны (Mobile UI Patterns)
> Связанные заметки: [[Architecture]] | [[Modules/Nomenclature]] | [[Modules/Bundles-Options]]
> Дата документирования: 2026-04-15

## Breakpoint и хук

```typescript
// hooks/useIsMobile.ts
export const useIsMobile = (breakpoint = 768) => { ... }
```

Стандартный breakpoint: `768px`. Хук слушает `resize`, инициализируется по `window.innerWidth`.

## Layout — мобильное меню

**Файл:** `components/system/Layout.tsx`

На мобильных (`isMobile === true`) сайдбар заменяется:
- Top bar: `h-12 bg-slate-900` — гамбургер + название вкладки + аватар
- Drawer: `fixed inset-0 z-[100]` — backdrop + панель `w-72 max-w-[85vw]`
- Drawer закрывается по тапу на backdrop или после выбора пункта
- `main` на мобильном: `flex-1 overflow-hidden` — без паддингов (модули сами управляют отступами)

## Паттерны Bottom-Sheet

```tsx
// Стандартный bottom-sheet
<div className="fixed inset-0 z-[200] bg-slate-900/60 flex flex-col justify-end">
  <div className="bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '95dvh' }}>
    {/* содержимое */}
  </div>
</div>
```

Уровни z-index (соглашение):
| z-index | Назначение |
|---|---|
| `z-[100]` | Layout mobile drawer |
| `z-[200]` | Основные модальные окна / bottom-sheets |
| `z-[300]` | Вложенные формы, confirm dialogs |
| `z-[400]` | Overlay поиска поверх формы (SupplierOverlay и т.п.) |
| `z-[500]` | SearchOverlay (полноэкранный поиск) |

## Фиксация overlays поверх overflow:hidden

**Проблема:** overlay внутри контейнера с `overflow:hidden` обрезается и позиционируется относительно родителя, а не экрана.

**Решение:** `fixed inset-0` + рендер в React fragment ДО основного контейнера:

```tsx
return (
  <>
    {showOverlay && (
      <div className="fixed inset-0 z-[400]">  {/* вне overflow:hidden */}
        <SupplierSearch ... />
      </div>
    )}
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* основная форма */}
    </div>
  </>
);
```

## iOS Safari — защита от auto-zoom

Safari автоматически зумирует страницу при фокусе на input с `font-size < 16px`.

**Решение:** использовать `text-[15px]` (15px рендерится, но 16px = 1rem не триггерит зум при правильной viewport meta).

На практике в проекте: все `<input>` в мобильных компонентах используют `text-[15px]`.

## dvh вместо vh

Мобильные браузеры имеют изменяемый chrome (адресная строка, навигация).  
`100vh` = общая высота с учётом chrome (может быть больше видимого).  
`100dvh` = динамическая высота = только видимая область.

```tsx
style={{ maxHeight: '95dvh' }}  // ✅ правильно для bottom-sheet
```

## Touch targets

Минимальный touch target: 44px.  
Практика: кнопки `py-2.5` или `py-3` (≈40-48px суммарно с текстом).

## Горизонтальный скролл фильтров

```tsx
<div className="overflow-x-auto -mx-4 px-4 flex-none">
  <div className="flex gap-2 w-max pb-1">
    {chips}
  </div>
</div>
```

`w-max` предотвращает перенос, `overflow-x-auto` на родителе обеспечивает скролл.

## Паттерн мобильного разветвления в модулях

```tsx
const isMobile = useIsMobile();
if (isMobile) return <MobileXxxView ... />;
// ... десктопный рендер
```

Для BundlesPage с early-return до рендера десктопной шапки:
```tsx
if (mode === 'options' && isMobile) {
    return <div className="h-full"><MobileOptionsEditor /></div>;
}
```

## Реализованные мобильные модули

| Модуль | Компоненты | Статус |
|---|---|---|
| Layout | top bar + drawer | ✅ готово |
| Nomenclature | MobileNomenclatureView, MobileProductForm | ✅ готово |
| Options (standalone) | MobileOptionsEditor | ✅ готово |
| Bundles / Configurator | MobileConfiguratorBuilder, MobileTemplatesGallery | ✅ готово |
| Inventory | MobileInventoryView (остатки + движения + корректировки) | ✅ готово |
| Sales | MobileSalesView + **MobileSalesOrderForm** (нативная мобильная форма ЗК) | ✅ готово |
| Procurement | MobileProcurementView (карточки ЗП + форма fullscreen) | ✅ готово |
| Shipment | MobileShipmentView (таб К отгрузке/История + форма fullscreen) | ✅ готово |
| Receiving | MobileReceivingView (ожидают + журнал + форма fullscreen) | ✅ готово |

## Паттерн нативных мобильных форм (MobileSalesOrderForm)

Для ЗК реализована **нативная** мобильная форма (`MobileSalesOrderForm`), не использующая десктопные компоненты:
- Самодостаточная: `useStore()` + `useAccess()` внутри, принимает только `initialOrder/Payments` + колбэки
- Overlays (z-[400]) рендерятся **до** основного контейнера (паттерн `<>overlays + main</>`)
- `ClientSearchOverlay` → полноэкранный поиск с кнопкой "Новый клиент"
- `ProductSearchOverlay` → тип / категория / поиск → для станков открывает `MobileConfiguratorOverlay`
- `MobileConfiguratorOverlay` → 3 вкладки (Вручную / Шаблоны / Со склада), футер с ценой IPP
- `ItemsTab` → карточки позиций с qty-picker (−/+), цена, итого
- `PaymentsTab` → карточки траншей (дата / сумма / ДДС / посредник), баланс-баннер

## Паттерн мобильных форм (fullscreen) — устаревший

Для форм, не имеющих нативной мобильной версии (OrderForm, ReceivingForm, ShipmentForm):
```tsx
if (view === 'form') {
    return (
        <div className="fixed inset-0 z-[200] bg-white overflow-y-auto">
            <ComplexDesktopForm isMobile={true} ... />
        </div>
    );
}
```
Форма доступна в полноэкранном режиме с прокруткой. Заголовок со стрелкой «назад» рендерится внутри десктопной формы через `isMobile` флаг.

## Паттерн самодостаточных мобильных вьюшек

Все Mobile*View компоненты:
- Вызывают `useStore()` и `useAccess()` **внутри** (не получают state как пропсы)
- Страница добавляет только `useIsMobile()` + early return: `if (isMobile) return <MobileXxxView />;`
- Управляют своим `view` состоянием (list/form) самостоятельно
