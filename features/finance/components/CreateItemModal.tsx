import React, { useState } from 'react';
import { X, Layers } from 'lucide-react';
import { CashFlowItem, CashFlowTag, CashFlowItemType, CashFlowCategory } from '@/types';

interface CreateItemModalProps {
    type: 'Income' | 'Expense';
    isGroup: boolean;
    groups: CashFlowItem[];
    tags: CashFlowTag[];
    itemTypes: CashFlowItemType[];
    defaultParentId?: string;
    onSubmit: (data: Partial<CashFlowItem>) => Promise<void>;
    onClose: () => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
    type, isGroup, groups, tags, itemTypes, defaultParentId, onSubmit, onClose,
}) => {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState(defaultParentId || '');
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [selectedItemTypeId, setSelectedItemTypeId] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleTag = (id: string) =>
        setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setLoading(true);
        await onSubmit({
            name: name.trim(),
            type,
            isGroup,
            parentId: parentId || null,
            tagIds: selectedTagIds,
            itemTypeId: selectedItemTypeId || null,
            sortOrder: 0,
            category: CashFlowCategory.OPERATING,
        });
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                        {isGroup ? 'Новая группа' : 'Новая статья'}
                    </h3>
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Название</label>
                        <input
                            autoFocus
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                            placeholder={isGroup ? 'Реклама, Логистика...' : 'Google Ads, Аренда офиса...'}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>

                    {!isGroup && groups.length > 0 && (
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Группа</label>
                            {defaultParentId ? (
                                <div className="px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold text-blue-700">
                                    {groups.find(g => g.id === defaultParentId)?.name || '—'}
                                    <span className="ml-2 text-[9px] font-black text-blue-400 uppercase tracking-widest">зафиксировано</span>
                                </div>
                            ) : (
                                <select
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                    value={parentId}
                                    onChange={e => setParentId(e.target.value)}
                                >
                                    <option value="">— Без группы —</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            )}
                        </div>
                    )}

                    {!isGroup && itemTypes.length > 0 && (
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Тип статьи</label>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setSelectedItemTypeId('')}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border-2 transition-all ${!selectedItemTypeId ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-400'}`}
                                >
                                    Не задан
                                </button>
                                {itemTypes.map(it => (
                                    <button
                                        key={it.id}
                                        onClick={() => setSelectedItemTypeId(it.id === selectedItemTypeId ? '' : it.id)}
                                        className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border-2 transition-all flex items-center gap-1"
                                        style={{
                                            borderColor: it.color,
                                            backgroundColor: selectedItemTypeId === it.id ? it.color : 'transparent',
                                            color: selectedItemTypeId === it.id ? '#fff' : it.color,
                                        }}
                                    >
                                        <Layers size={9} /> {it.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isGroup && tags.length > 0 && (
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Теги</label>
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map(tag => {
                                    const active = selectedTagIds.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag(tag.id)}
                                            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border-2 transition-all"
                                            style={{
                                                borderColor: tag.color,
                                                backgroundColor: active ? tag.color : 'transparent',
                                                color: active ? '#fff' : tag.color,
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors">Отмена</button>
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || loading}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-30"
                    >
                        Создать
                    </button>
                </div>
            </div>
        </div>
    );
};
