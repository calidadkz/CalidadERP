import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

interface FilterComboboxProps {
    value: string;
    onChange: (val: string) => void;
    suggestions: string[];
    placeholder?: string;
    showIcon?: boolean;
    /** Показывать предложения даже при пустом вводе */
    showOnEmpty?: boolean;
    className?: string;
}

export const FilterCombobox: React.FC<FilterComboboxProps> = ({
    value, onChange, suggestions, placeholder, showIcon, showOnEmpty, className,
}) => {
    const [open, setOpen] = useState(false);
    const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
    const inputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        if (!value.trim()) return showOnEmpty ? suggestions.slice(0, 12) : [];
        const q = value.toLowerCase();
        return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 10);
    }, [suggestions, value, showOnEmpty]);

    const openDrop = () => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setDropStyle({
            position: 'fixed',
            top: rect.bottom + 2,
            left: rect.left,
            minWidth: Math.max(rect.width, 180),
            zIndex: 99999,
        });
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (!inputRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
    }, [open]);

    const handleSelect = (s: string) => {
        onChange(s);
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.preventDefault();
        onChange('');
        setOpen(false);
        inputRef.current?.focus();
    };

    return (
        <div className={`relative ${className || ''}`}>
            {showIcon && <Search size={10} className="absolute left-2 top-2.5 text-gray-400 pointer-events-none" />}
            <input
                ref={inputRef}
                className={`w-full min-w-0 ${showIcon ? 'pl-6' : 'px-2'} ${value ? 'pr-5' : 'pr-2'} py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold transition-colors focus:border-blue-300`}
                placeholder={placeholder}
                value={value}
                onChange={e => { onChange(e.target.value); openDrop(); }}
                onFocus={openDrop}
            />
            {value && (
                <button
                    type="button"
                    onMouseDown={handleClear}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                    <X size={10} />
                </button>
            )}
            {open && filtered.length > 0 && createPortal(
                <div ref={dropRef} className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1" style={dropStyle}>
                    {filtered.map((s, i) => (
                        <button
                            key={i}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors truncate"
                            onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                        >
                            {s}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};
