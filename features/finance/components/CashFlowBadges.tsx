import React from 'react';
import { X, Layers } from 'lucide-react';
import { CashFlowTag, CashFlowItemType } from '@/types';

export const PALETTE = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
    '#64748b', '#0f172a',
];

export const ColorPicker: React.FC<{ value: string; onChange: (c: string) => void }> = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-1">
        {PALETTE.map(c => (
            <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
                style={{ backgroundColor: c, borderColor: value === c ? '#1e293b' : 'transparent' }}
            />
        ))}
    </div>
);

export const TagBadge: React.FC<{ tag: CashFlowTag; onRemove?: () => void }> = ({ tag, onRemove }) => (
    <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide"
        style={{ backgroundColor: tag.color + '22', color: tag.color }}
    >
        {tag.name}
        {onRemove && <button onClick={onRemove} className="hover:opacity-70 ml-0.5"><X size={9} /></button>}
    </span>
);

export const TypeBadge: React.FC<{ type: CashFlowItemType; onRemove?: () => void }> = ({ type, onRemove }) => (
    <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border"
        style={{ borderColor: type.color + '66', backgroundColor: type.color + '11', color: type.color }}
    >
        <Layers size={8} />
        {type.name}
        {onRemove && <button onClick={onRemove} className="hover:opacity-70 ml-0.5"><X size={9} /></button>}
    </span>
);
