/**
 * CalidadSelect — стандартный выпадающий список CalidadERP.
 *
 * Паттерн: кнопка-триггер + оверлей с поиском + список с чекмаркером активного элемента.
 * Смотри документацию: claude-memory/Modules/UI-CalidadSelect.md
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, CheckCircle } from 'lucide-react';

export interface CalidadSelectOption {
    id: string;
    label: string;
    /** Необязательная подстрока под основным label (например, код ТНВЭД) */
    sub?: string;
}

interface CalidadSelectProps {
    /** Список вариантов */
    options: CalidadSelectOption[];
    /** ID выбранного варианта */
    value: string;
    /** Колбэк при выборе */
    onChange: (id: string) => void;
    /** Плейсхолдер в триггере когда ничего не выбрано */
    placeholder?: string;
    /** Текст пункта «сброс» (по умолчанию «— Не указан —»). Передать null чтобы убрать. */
    nullLabel?: string | null;
    disabled?: boolean;
    /** Дополнительные классы для корневого div */
    className?: string;
    /** Минимальная ширина выпадающего списка (по умолчанию совпадает с триггером) */
    dropdownMinWidth?: string;
    /** z-index для dropdown panel (по умолчанию z-[100]) */
    zIndex?: string;
}

export const CalidadSelect: React.FC<CalidadSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Не указан',
    nullLabel = '— Не указан —',
    disabled = false,
    className = '',
    dropdownMinWidth,
    zIndex = 'z-[100]',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.id === value);

    const filtered = useMemo(() => {
        if (!search) return options;
        const q = search.toLowerCase();
        return options.filter(o =>
            o.label.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q)
        );
    }, [options, search]);

    // Закрытие по click-outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Автофокус на поле поиска при открытии
    useEffect(() => {
        if (isOpen) setTimeout(() => searchRef.current?.focus(), 50);
    }, [isOpen]);

    const handleSelect = (id: string) => {
        onChange(id);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            {/* ── Триггер ── */}
            <div
                onClick={() => !disabled && setIsOpen(v => !v)}
                className={[
                    'w-full flex items-center justify-between border rounded-lg py-1.5 px-3 text-xs font-bold transition-all',
                    disabled
                        ? 'opacity-70 pointer-events-none border-slate-200 bg-slate-50'
                        : isOpen
                            ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white cursor-pointer'
                            : 'border-slate-200 bg-white cursor-pointer hover:border-slate-300',
                ].join(' ')}
            >
                <span className={selected ? 'text-slate-800' : 'text-slate-400 italic'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={14}
                    className={`text-slate-300 transition-transform flex-none ml-1 ${isOpen ? 'rotate-180' : ''}`}
                />
            </div>

            {/* ── Dropdown ── */}
            {isOpen && (
                <div
                    className={[
                        'absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200',
                        'animate-in fade-in slide-in-from-top-1 overflow-hidden',
                        zIndex,
                        dropdownMinWidth ? '' : 'right-0',
                    ].join(' ')}
                    style={dropdownMinWidth ? { minWidth: dropdownMinWidth } : undefined}
                >
                    {/* Строка поиска */}
                    <div className="p-2 border-b bg-slate-50">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                            <input
                                ref={searchRef}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400"
                                placeholder="Начните ввод..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Список */}
                    <div className="max-h-56 overflow-y-auto p-1 custom-scrollbar">
                        {/* Пункт «сброс» */}
                        {nullLabel !== null && (
                            <div
                                onClick={() => handleSelect('')}
                                className={[
                                    'px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all',
                                    !value ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-400 italic',
                                ].join(' ')}
                            >
                                <span className="font-bold">{nullLabel}</span>
                                {!value && <CheckCircle size={12} className="text-blue-500 flex-none" />}
                            </div>
                        )}

                        {filtered.length === 0 && (
                            <div className="px-3 py-2 text-[11px] text-slate-400 italic">Нет совпадений</div>
                        )}

                        {filtered.map(o => (
                            <div
                                key={o.id}
                                onClick={() => handleSelect(o.id)}
                                className={[
                                    'px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all',
                                    value === o.id
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'hover:bg-slate-50 text-slate-600',
                                ].join(' ')}
                            >
                                <div className="flex flex-col gap-0.5 min-w-0 mr-2">
                                    <span className="font-bold leading-tight truncate">{o.label}</span>
                                    {o.sub && (
                                        <span className="text-[9px] font-mono text-slate-400 truncate">{o.sub}</span>
                                    )}
                                </div>
                                {value === o.id && <CheckCircle size={12} className="text-blue-500 flex-none" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
