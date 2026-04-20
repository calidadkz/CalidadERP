/**
 * ColumnFilter — заголовок колонки таблицы с сортировкой и фильтром.
 *
 * Паттерн: кнопка сортировки (стрелки ↑↓) + иконка Filter → выпадающий
 * список в стиле CalidadSelect с полем ввода для частичного поиска.
 * Dropdown рендерится через React Portal (document.body).
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Filter, Search, X } from 'lucide-react';

interface ColumnFilterProps {
    label: string;
    /** Ключ поля для сортировки; если не передан — сортировка недоступна */
    sortKey?: string;
    currentSortKey?: string;
    sortOrder?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    /** Текущее значение фильтра; если не передан onFilterChange — фильтр недоступен */
    filterValue?: string;
    onFilterChange?: (val: string) => void;
    /** Список уникальных значений для подсказок */
    suggestions?: string[];
    align?: 'left' | 'right' | 'center';
}

export const ColumnFilter: React.FC<ColumnFilterProps> = ({
    label,
    sortKey,
    currentSortKey,
    sortOrder = 'asc',
    onSort,
    filterValue = '',
    onFilterChange,
    suggestions = [],
    align = 'left',
}) => {
    const [dropOpen, setDropOpen] = useState(false);
    const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isActiveSort = !!sortKey && currentSortKey === sortKey;
    const isActiveFilter = !!filterValue;

    const filteredSuggestions = useMemo(() => {
        const q = filterValue.toLowerCase();
        if (!q) return suggestions.slice(0, 15);
        return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 12);
    }, [suggestions, filterValue]);

    const openDrop = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const rightAligned = align === 'right';
        setDropStyle({
            position: 'fixed',
            top: rect.bottom + 4,
            left: rightAligned ? undefined : rect.left,
            right: rightAligned ? window.innerWidth - rect.right : undefined,
            minWidth: Math.max(rect.width, 220),
            zIndex: 99999,
        });
        setDropOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // Закрытие по click-outside
    useEffect(() => {
        if (!dropOpen) return;
        const h = (e: MouseEvent) => {
            if (
                !containerRef.current?.contains(e.target as Node) &&
                !dropRef.current?.contains(e.target as Node)
            ) setDropOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [dropOpen]);

    // Закрытие при скролле/ресайзе
    useEffect(() => {
        if (!dropOpen) return;
        const close = () => setDropOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [dropOpen]);

    const jc = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    const SortArrows = () => {
        if (!sortKey) return null;
        if (isActiveSort) {
            return sortOrder === 'asc'
                ? <ChevronUp size={10} className="text-blue-500 flex-none" />
                : <ChevronDown size={10} className="text-blue-500 flex-none" />;
        }
        return (
            <span className="flex flex-col opacity-25 flex-none" style={{ lineHeight: 0 }}>
                <ChevronUp size={8} />
                <ChevronDown size={8} />
            </span>
        );
    };

    return (
        <div ref={containerRef} className={`inline-flex flex-col gap-px min-w-0 w-full select-none`}>
            {/* ── Строка: лейбл + стрелки сортировки + иконка фильтра ── */}
            <div className={`flex items-center gap-1.5 ${jc}`}>
                {sortKey ? (
                    <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors min-w-0"
                        onClick={() => onSort?.(sortKey)}
                    >
                        {align !== 'right' && <SortArrows />}
                        <span className="truncate">{label}</span>
                        {align === 'right' && <SortArrows />}
                    </button>
                ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</span>
                )}

                {onFilterChange && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); dropOpen ? setDropOpen(false) : openDrop(); }}
                        className={`flex-none p-0.5 rounded transition-all ${
                            isActiveFilter
                                ? 'text-blue-600 bg-blue-100 ring-1 ring-blue-300'
                                : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                        }`}
                        title="Фильтр"
                    >
                        <Filter size={9} />
                    </button>
                )}
            </div>

            {/* ── Активный фильтр — бейдж с крестиком ── */}
            {isActiveFilter && (
                <div className={`flex items-center gap-0.5 ${jc}`}>
                    <span className="text-[9px] text-blue-600 font-bold bg-blue-50 rounded px-1 truncate max-w-[92px]">
                        {filterValue}
                    </span>
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onFilterChange?.(''); }}
                        className="text-blue-400 hover:text-red-500 transition-colors flex-none"
                    >
                        <X size={8} />
                    </button>
                </div>
            )}

            {/* ── Выпадающий список через Portal ── */}
            {dropOpen && createPortal(
                <div
                    ref={dropRef}
                    className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1"
                    style={dropStyle}
                >
                    {/* Поле ввода */}
                    <div className="p-2 border-b bg-slate-50">
                        <div className="relative">
                            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                ref={inputRef}
                                className="w-full pl-7 pr-6 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400 transition-colors"
                                placeholder="Поиск..."
                                value={filterValue}
                                onChange={e => onFilterChange?.(e.target.value)}
                            />
                            {filterValue && (
                                <button
                                    type="button"
                                    onMouseDown={e => { e.preventDefault(); onFilterChange?.(''); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Список подсказок */}
                    <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                        {filteredSuggestions.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-slate-400 italic">Нет совпадений</div>
                        ) : filteredSuggestions.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`w-full text-left px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors truncate ${
                                    filterValue === s
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'hover:bg-slate-50 text-slate-600'
                                }`}
                                onMouseDown={e => { e.preventDefault(); onFilterChange?.(s); setDropOpen(false); }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
