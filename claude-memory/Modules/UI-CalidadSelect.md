# UI-паттерн: CalidadSelect
> Связанные заметки: [[Architecture]] | [[Tech-Stack]]
> Дата документирования: 2026-04-08

## Название паттерна
**CalidadSelect** — стандартный кастомный выпадающий список CalidadERP.

## Эталон
Оригинальная реализация: `features/nomenclature/tabs/GeneralTab.tsx` — дропдаун «Производитель».
Переиспользуемый компонент: `components/ui/CalidadSelect.tsx`.

## Когда применять
Всегда, когда нужен `<select>` для выбора из справочника (поставщик, производитель, категория, ТНВЭД, метод ценообразования, статус и т.п.).  
**Не использовать** нативный `<select>` или `SearchableDropdown` из старого кода для новых форм.

## Анатомия компонента

```
┌─────────────────────────────────────────┐  ← Триггер (кнопка)
│ Текущее значение или плейсхолдер    ▾   │
└─────────────────────────────────────────┘
           ↓ При клике открывается:
┌─────────────────────────────────────────┐  ← Dropdown panel
│ ┌─────────────────────────────────────┐ │  ← Search area (bg-slate-50)
│ │ 🔍 Начните ввод...                  │ │
│ └─────────────────────────────────────┘ │
│ — Не указан —                           │  ← Null option
│ ✓ We-Tech          [checkmark if active]│  ← Active item (bg-blue-50)
│   Jinan Apex                            │  ← Inactive item
│   ...                                   │
└─────────────────────────────────────────┘
```

## Tailwind классы (ключевые)

### Триггер
```
w-full flex items-center justify-between border rounded-lg py-1.5 px-3 text-xs font-bold transition-all cursor-pointer
```
- Закрыт: `border-slate-200 bg-white hover:border-slate-300`
- Открыт: `border-blue-500 ring-4 ring-blue-500/10 bg-white`
- Disabled: `opacity-70 pointer-events-none border-slate-200 bg-slate-50`

### Dropdown panel
```
absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200
animate-in fade-in slide-in-from-top-1 overflow-hidden z-[100]
```

### Search area
```
p-2 border-b bg-slate-50
```
Input внутри:
```
w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400
```
Иконка: `<Search size={12} className="absolute left-2.5 top-2 text-slate-400" />`

### Список (scroll-контейнер)
```
max-h-56 overflow-y-auto p-1 custom-scrollbar
```

### Элемент списка
- Базовый: `px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all`
- Активный: `bg-blue-50 text-blue-700`
- Неактивный: `hover:bg-slate-50 text-slate-600`
- Null-пункт (не выбрано): `hover:bg-slate-50 text-slate-400 italic`

### Маркер активного элемента
```tsx
<CheckCircle size={12} className="text-blue-500 flex-none" />
```

## API компонента

```tsx
import { CalidadSelect, CalidadSelectOption } from '@/components/ui/CalidadSelect';

// Тип опции
interface CalidadSelectOption {
    id: string;
    label: string;
    sub?: string; // Подпись под label (код, артикул и т.п.)
}

<CalidadSelect
    options={options}          // CalidadSelectOption[]
    value={selectedId}         // string (id выбранного)
    onChange={setSelectedId}   // (id: string) => void
    placeholder="не выбран"    // текст триггера когда пусто
    nullLabel="— Не выбран —"  // текст null-пункта; null = убрать пункт
    disabled={false}
    className="w-44"           // ширина триггера
    dropdownMinWidth="280px"   // min-width dropdown (если список шире триггера)
    zIndex="z-[100]"           // z-index панели (по умолчанию z-[100])
/>
```

## Примеры использования

```tsx
// Поставщик
const supplierOptions = useMemo(() =>
    suppliers.map(s => ({ id: s.id, label: s.name })), [suppliers]);

<CalidadSelect options={supplierOptions} value={formData.supplierId || ''} onChange={v => onChange('supplierId', v)} className="w-full" />

// ТНВЭД (с sub-строкой — код + название)
const hscodeOptions = useMemo(() =>
    hscodes.map(h => ({ id: h.id, label: h.code, sub: h.name?.slice(0, 50) })), [hscodes]);

<CalidadSelect options={hscodeOptions} value={formData.hsCodeId || ''} onChange={v => onChange('hsCodeId', v)} className="w-full" dropdownMinWidth="300px" />
```

## Правило применения
> При добавлении любого select/dropdown для выбора из справочника — использовать `CalidadSelect`, а не нативный `<select>` и не `SearchableDropdown`.  
> Нативный `<select>` допустим только для enum-полей с ≤5 фиксированными вариантами внутри мелких inline-ячеек таблиц (например, налоговый режим в DetailedList).

---

## Паттерн: Portal-дропдаун (для overflow-hidden контейнеров)

### Проблема
Любой `overflow` ≠ `visible` на родительском элементе обрезает `position: absolute` дропдаун. В CalidadERP большинство форм и таблиц завёрнуты в `overflow-hidden`:
- `OrderForm`, `SalesOrderForm` — `h-[calc(100vh-120px)] ... overflow-hidden`
- `NomenclatureTable` — `overflow-hidden h-full flex flex-col`
- Финансовые модалки, CounterpartyCreateModal и т.д.

### Решение: `createPortal(dropdown, document.body)`
Дропдаун монтируется напрямую в `<body>`, минуя все родительские стеки. Позиция задаётся через `position: fixed` с координатами из `getBoundingClientRect()`.

### Компоненты с Portal-дропдауном
| Компонент | Файл | Направление |
|---|---|---|
| `CalidadSelect` | `components/ui/CalidadSelect.tsx` | вниз (пересчёт при scroll/resize) |
| `CashFlowSelector` | `components/ui/CashFlowSelector.tsx` | вверх/вниз (умно) |
| `FilterCombobox` | `features/nomenclature/components/NomenclatureTable.tsx` | вниз |

### Шаблон реализации

```tsx
import { createPortal } from 'react-dom';

const buttonRef = useRef<HTMLButtonElement>(null);
const dropRef = useRef<HTMLDivElement>(null);
const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
const [open, setOpen] = useState(false);

const recalcPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = 340; // примерная высота дропдауна
    const showAbove = spaceBelow < dropH && spaceAbove > spaceBelow;
    setDropStyle({
        position: 'fixed',
        left: rect.left,
        top: showAbove ? undefined : rect.bottom + 4,
        bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
        minWidth: Math.max(minWidth, rect.width),
        zIndex: 9999,
    });
};

// Закрытие по клику вне — оба ref
useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
        if (!buttonRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
            setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
}, [open]);

// Закрытие при скролле/ресайзе
useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true); // capture — ловит скролл внутри любого контейнера
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
}, [open]);

// Рендер
{typeof document !== 'undefined' && createPortal(
    open ? <div ref={dropRef} style={dropStyle}>...</div> : null,
    document.body
)}
```

### Ключевые детали
- `window.addEventListener('scroll', close, **true**)` — capture-фаза обязательна, иначе scroll внутри `overflow-auto` контейнера не поймается
- `createPortal(null, document.body)` — валидно в React, ничего не рендерит
- `z-index: 9999` — выше любых модалок (`z-[200]`, `z-[500]`)
- `CalidadSelect` **переведён на Portal** (2026-04-14). Причина: многократно возникала проблема обрезки дропдауна в контейнерах с `overflow-hidden` (BatchCategoryMappingTab и др.).
