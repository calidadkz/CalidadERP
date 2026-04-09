import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { ColorPicker } from './CashFlowBadges';

interface DictManagerModalProps {
    title: string;
    items: { id: string; name: string; color: string }[];
    onAdd: (item: { name: string; color: string }) => Promise<any>;
    onUpdate: (id: string, data: { name?: string; color?: string }) => Promise<any>;
    onDelete: (id: string) => Promise<void>;
    onClose: () => void;
}

export const DictManagerModal: React.FC<DictManagerModalProps> = ({
    title, items, onAdd, onUpdate, onDelete, onClose,
}) => {
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#6366f1');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await onAdd({ name: newName.trim(), color: newColor });
        setNewName('');
    };

    const startEdit = (item: { id: string; name: string; color: string }) => {
        setEditingId(item.id);
        setEditName(item.name);
        setEditColor(item.color);
    };

    const saveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        await onUpdate(editingId, { name: editName.trim(), color: editColor });
        setEditingId(null);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={20} /></button>
                </div>

                {/* Создание */}
                <div className="flex gap-2 mb-4 items-start">
                    <input
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Название..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <div className="flex flex-col gap-1.5">
                        <ColorPicker value={newColor} onChange={setNewColor} />
                        <button
                            onClick={handleAdd}
                            disabled={!newName.trim()}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase shadow-md hover:bg-indigo-700 transition-all disabled:opacity-30 flex items-center gap-1"
                        >
                            <Plus size={14} /> Добавить
                        </button>
                    </div>
                </div>

                {/* Список */}
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="text-center text-slate-300 py-8 text-sm italic">Пока пусто</div>
                    ) : items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 group">
                            {editingId === item.id ? (
                                <>
                                    <input
                                        className="flex-1 border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold outline-none"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                        autoFocus
                                    />
                                    <ColorPicker value={editColor} onChange={setEditColor} />
                                    <button onClick={saveEdit} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"><Check size={14} /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"><X size={14} /></button>
                                </>
                            ) : (
                                <>
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="flex-1 text-sm font-bold text-slate-700">{item.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil size={13} /></button>
                                        {confirmDeleteId === item.id ? (
                                            <>
                                                <span className="text-[9px] font-black text-red-600 uppercase self-center mr-1">Удалить?</span>
                                                <button onClick={() => { onDelete(item.id); setConfirmDeleteId(null); }} className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"><Check size={13} /></button>
                                                <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg"><X size={13} /></button>
                                            </>
                                        ) : (
                                            <button onClick={() => setConfirmDeleteId(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
