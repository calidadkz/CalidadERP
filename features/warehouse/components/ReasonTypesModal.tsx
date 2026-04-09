
import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, GripVertical } from 'lucide-react';
import { WriteOffReasonType } from '@/types/inventory';

const COLORS = [
    { id: 'red',    label: 'Красный' },
    { id: 'orange', label: 'Оранжевый' },
    { id: 'amber',  label: 'Янтарный' },
    { id: 'blue',   label: 'Синий' },
    { id: 'green',  label: 'Зелёный' },
    { id: 'purple', label: 'Фиолетовый' },
    { id: 'slate',  label: 'Серый' },
];

const COLOR_DOT: Record<string, string> = {
    red:    'bg-red-400',
    orange: 'bg-orange-400',
    amber:  'bg-amber-400',
    blue:   'bg-blue-400',
    green:  'bg-green-400',
    purple: 'bg-purple-400',
    slate:  'bg-slate-400',
};

const COLOR_BADGE: Record<string, string> = {
    red:    'bg-red-100 text-red-700 border-red-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    amber:  'bg-amber-100 text-amber-700 border-amber-200',
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    green:  'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
};

interface ReasonTypesModalProps {
    reasonTypes: WriteOffReasonType[];
    onAdd: (rt: Omit<WriteOffReasonType, 'id' | 'createdAt'>) => Promise<WriteOffReasonType>;
    onUpdate: (id: string, data: Partial<WriteOffReasonType>) => Promise<WriteOffReasonType>;
    onDelete: (id: string) => Promise<void>;
    onClose: () => void;
}

export const ReasonTypesModal: React.FC<ReasonTypesModalProps> = ({ reasonTypes, onAdd, onUpdate, onDelete, onClose }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('');
    const [draftColor, setDraftColor] = useState('slate');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('slate');
    const [saving, setSaving] = useState(false);

    const startEdit = (rt: WriteOffReasonType) => {
        setEditingId(rt.id);
        setDraftName(rt.name);
        setDraftColor(rt.color);
    };

    const cancelEdit = () => { setEditingId(null); setDraftName(''); setDraftColor('slate'); };

    const saveEdit = async () => {
        if (!editingId || !draftName.trim()) return;
        setSaving(true);
        await onUpdate(editingId, { name: draftName.trim(), color: draftColor });
        setSaving(false);
        cancelEdit();
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        await onAdd({ name: newName.trim(), color: newColor, sortOrder: reasonTypes.length + 1 });
        setSaving(false);
        setNewName('');
        setNewColor('slate');
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Удалить этот тип? Уже созданные списания не будут затронуты.')) return;
        await onDelete(id);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Типы списания</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={16}/>
                    </button>
                </div>

                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
                    {reasonTypes.map(rt => (
                        <div key={rt.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 group">
                            <GripVertical size={14} className="text-slate-300 flex-none"/>
                            {editingId === rt.id ? (
                                <>
                                    <input
                                        autoFocus
                                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                                        value={draftName}
                                        onChange={e => setDraftName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                    />
                                    <div className="flex gap-1">
                                        {COLORS.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => setDraftColor(c.id)}
                                                title={c.label}
                                                className={`w-4 h-4 rounded-full ${COLOR_DOT[c.id]} transition-transform ${draftColor === c.id ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                                            />
                                        ))}
                                    </div>
                                    <button onClick={saveEdit} disabled={saving} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50">
                                        <Check size={13}/>
                                    </button>
                                    <button onClick={cancelEdit} className="p-1.5 bg-slate-100 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">
                                        <X size={13}/>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className={`flex-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${COLOR_BADGE[rt.color] || COLOR_BADGE.slate}`}>
                                        {rt.name}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEdit(rt)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Pencil size={12}/>
                                        </button>
                                        <button onClick={() => handleDelete(rt.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={12}/>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {isAdding ? (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50">
                            <Plus size={14} className="text-blue-400 flex-none"/>
                            <input
                                autoFocus
                                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                                placeholder="Название типа..."
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
                            />
                            <div className="flex gap-1">
                                {COLORS.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setNewColor(c.id)}
                                        title={c.label}
                                        className={`w-4 h-4 rounded-full ${COLOR_DOT[c.id]} transition-transform ${newColor === c.id ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                                    />
                                ))}
                            </div>
                            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50">
                                <Check size={13}/>
                            </button>
                            <button onClick={() => setIsAdding(false)} className="p-1.5 bg-slate-100 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">
                                <X size={13}/>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all text-[11px] font-bold"
                        >
                            <Plus size={14}/> Добавить тип
                        </button>
                    )}
                </div>

                <div className="px-8 py-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl transition-colors">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};
