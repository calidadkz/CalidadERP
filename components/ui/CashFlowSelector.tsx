/**
 * CashFlowSelector — компонент выбора статьи ДДС.
 * Поддерживает: группировку, теги, поиск.
 * Использование:
 *   <CashFlowSelector
 *     value={cashFlowItemId}
 *     onChange={id => ...}
 *     direction="Outgoing" | "Incoming" | undefined
 *   />
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { CashFlowItem, CashFlowTag } from '@/types';
import { Tag, Search, ChevronDown, X, Check } from 'lucide-react';

interface Props {
    value: string;
    onChange: (id: string) => void;
    /** 'Incoming' = доходы, 'Outgoing' = расходы, undefined = все */
    direction?: 'Incoming' | 'Outgoing';
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    /** Минимальная ширина выпадающего списка в px */
    dropdownMinWidth?: number;
    /** Приоритетные статьи контрагента — показываются сверху отдельной секцией */
    priorityItemIds?: string[];
}

export const CashFlowSelector: React.FC<Props> = ({
    value,
    onChange,
    direction,
    disabled,
    placeholder = '— Статья ДДС —',
    className = '',
    dropdownMinWidth = 280,
    priorityItemIds = [],
}) => {
    const { state } = useStore();
    const { cashFlowItems, cashFlowTags } = state;

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filterTagId, setFilterTagId] = useState<string>('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Закрываем по клику вне
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
                setFilterTagId('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Тип для фильтрации
    const itemType: 'Income' | 'Expense' | undefined =
        direction === 'Outgoing' ? 'Expense' :
        direction === 'Incoming' ? 'Income' :
        undefined;

    // Все статьи (не группы), отфильтрованные по типу
    const leafItems = useMemo(() => {
        let items = cashFlowItems.filter(x => !x.isGroup);
        if (itemType) items = items.filter(x => x.type === itemType);
        return items;
    }, [cashFlowItems, itemType]);

    // Группы
    const groups = useMemo(() => {
        let gs = cashFlowItems.filter(x => x.isGroup);
        if (itemType) gs = gs.filter(x => x.type === itemType);
        return gs.sort((a, b) => a.sortOrder - b.sortOrder);
    }, [cashFlowItems, itemType]);

    // Теги, реально используемые в этих статьях
    const usedTags = useMemo(() => {
        const tagIds = new Set(leafItems.flatMap(x => x.tagIds ?? []));
        return cashFlowTags.filter(t => tagIds.has(t.id));
    }, [leafItems, cashFlowTags]);

    // Применяем поиск и фильтр по тегу
    const filteredItems = useMemo(() => {
        let items = leafItems;
        if (filterTagId) items = items.filter(x => x.tagIds?.includes(filterTagId));
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(x => x.name.toLowerCase().includes(q));
        }
        return items;
    }, [leafItems, filterTagId, search]);

    // Группируем для отображения
    const grouped = useMemo(() => {
        const groupMap = new Map<string | null, CashFlowItem[]>();
        groupMap.set(null, []);
        groups.forEach(g => groupMap.set(g.id, []));
        filteredItems.forEach(item => {
            const pid = item.parentId ?? null;
            if (!groupMap.has(pid)) groupMap.set(null, [...(groupMap.get(null) || [])]);
            const arr = groupMap.get(pid) ?? groupMap.get(null)!;
            arr.push(item);
        });
        return groupMap;
    }, [filteredItems, groups]);

    // Приоритетные статьи: в том порядке что в priorityItemIds, отфильтрованные по типу
    const priorityItems = useMemo(() => {
        return priorityItemIds
            .map(id => cashFlowItems.find(x => x.id === id && !x.isGroup))
            .filter((x): x is CashFlowItem => !!x && (!itemType || x.type === itemType));
    }, [priorityItemIds, cashFlowItems, itemType]);

    const selectedItem = cashFlowItems.find(x => x.id === value);
    const selectedTags = cashFlowTags.filter(t => selectedItem?.tagIds?.includes(t.id));

    const handleSelect = (id: string) => {
        onChange(id);
        setOpen(false);
        setSearch('');
        setFilterTagId('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(p => !p)}
                className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all
                    ${disabled
                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                        : open
                            ? 'border-blue-300 ring-2 ring-blue-500/10 bg-white'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    }
                `}
            >
                <Tag size={12} className={`shrink-0 ${selectedItem ? 'text-indigo-500' : 'text-slate-300'}`} />
                <span className={`flex-1 text-[11px] font-bold truncate ${selectedItem ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedItem ? selectedItem.name : placeholder}
                </span>
                {selectedItem && !disabled && (
                    <span onClick={handleClear} className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer">
                        <X size={12} />
                    </span>
                )}
                <ChevronDown size={12} className={`shrink-0 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="absolute top-full mt-1 z-[200] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                    style={{ minWidth: dropdownMinWidth }}
                >
                    {/* Поиск */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                            <Search size={12} className="text-slate-400 shrink-0" />
                            <input
                                autoFocus
                                className="flex-1 bg-transparent text-[11px] font-bold outline-none text-slate-700 placeholder:text-slate-300"
                                placeholder="Поиск статьи..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500 transition-colors">
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Фильтр по тегам */}
                    {usedTags.length > 0 && (
                        <div className="px-2.5 py-1.5 border-b border-slate-50 flex flex-wrap gap-1">
                            {usedTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setFilterTagId(p => p === tag.id ? '' : tag.id)}
                                    className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all"
                                    style={{
                                        borderColor: tag.color,
                                        backgroundColor: filterTagId === tag.id ? tag.color : 'transparent',
                                        color: filterTagId === tag.id ? '#fff' : tag.color,
                                    }}
                                >
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Список */}
                    <div className="max-h-64 overflow-y-auto py-1">
                        {/* Приоритетные статьи контрагента */}
                        {priorityItems.length > 0 && !search && !filterTagId && (
                            <div>
                                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50/80 flex items-center gap-1.5">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                    Приоритет
                                </div>
                                {priorityItems.map((item, idx) => (
                                    <OptionRow
                                        key={item.id}
                                        item={item}
                                        tags={cashFlowTags}
                                        isSelected={value === item.id}
                                        onSelect={handleSelect}
                                        priorityIndex={idx}
                                    />
                                ))}
                                <div className="mx-3 my-1 border-t border-slate-100" />
                            </div>
                        )}
                        {filteredItems.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[11px] text-slate-300 font-bold italic">Ничего не найдено</div>
                        ) : (
                            <>
                                {/* Сначала группы с детьми */}
                                {groups.map(group => {
                                    const children = grouped.get(group.id) ?? [];
                                    if (children.length === 0) return null;
                                    return (
                                        <div key={group.id}>
                                            <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/80">
                                                {group.name}
                                            </div>
                                            {children.map(item => (
                                                <OptionRow
                                                    key={item.id}
                                                    item={item}
                                                    tags={cashFlowTags}
                                                    isSelected={value === item.id}
                                                    onSelect={handleSelect}
                                                    indent
                                                />
                                            ))}
                                        </div>
                                    );
                                })}
                                {/* Затем без группы */}
                                {(grouped.get(null)?.length ?? 0) > 0 && (
                                    <div>
                                        {groups.some(g => (grouped.get(g.id)?.length ?? 0) > 0) && (
                                            <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-300 bg-slate-50/40">
                                                Без группы
                                            </div>
                                        )}
                                        {grouped.get(null)!.map(item => (
                                            <OptionRow
                                                key={item.id}
                                                item={item}
                                                tags={cashFlowTags}
                                                isSelected={value === item.id}
                                                onSelect={handleSelect}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Строка опции ───────────────────────────────────────
interface OptionRowProps {
    item: CashFlowItem;
    tags: CashFlowTag[];
    isSelected: boolean;
    onSelect: (id: string) => void;
    indent?: boolean;
    priorityIndex?: number; // если задан — строка из секции приоритетов
}
const OptionRow: React.FC<OptionRowProps> = ({ item, tags, isSelected, onSelect, indent, priorityIndex }) => {
    const itemTags = tags.filter(t => item.tagIds?.includes(t.id));
    return (
        <button
            type="button"
            onClick={() => onSelect(item.id)}
            className={`
                w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                ${indent ? 'pl-6' : ''}
                ${priorityIndex !== undefined ? 'bg-amber-50/40 hover:bg-amber-50' : ''}
                ${isSelected ? 'bg-blue-50 text-blue-700' : priorityIndex === undefined ? 'hover:bg-slate-50 text-slate-700' : 'text-slate-700'}
            `}
        >
            {priorityIndex === 0 && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b" className="shrink-0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            )}
            <span className="flex-1 text-[11px] font-bold truncate">{item.name}</span>
            {itemTags.length > 0 && (
                <span className="flex gap-1 shrink-0">
                    {itemTags.slice(0, 2).map(t => (
                        <span
                            key={t.id}
                            className="px-1.5 py-0.5 rounded-full text-[8px] font-black"
                            style={{ backgroundColor: t.color + '22', color: t.color }}
                        >
                            {t.name}
                        </span>
                    ))}
                </span>
            )}
            {isSelected && <Check size={12} className="text-blue-500 shrink-0" />}
        </button>
    );
};
