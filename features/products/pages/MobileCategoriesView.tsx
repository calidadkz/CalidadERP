
import React, { useState, useMemo, useRef } from 'react';
import { List, Plus, Trash2, Box, Zap, Briefcase, X, Check, Search, Edit2 } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { ProductCategory, ProductType } from '@/types';
import { ApiService } from '@/services/api';

const TYPE_TABS: { type: ProductType; label: string; Icon: React.ElementType; color: string; dot: string }[] = [
    { type: ProductType.MACHINE,  label: 'Станки',   Icon: Box,      color: 'bg-blue-600 text-white',   dot: 'bg-blue-500' },
    { type: ProductType.PART,     label: 'Запчасти', Icon: Zap,      color: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
    { type: ProductType.SERVICE,  label: 'Услуги',   Icon: Briefcase,color: 'bg-indigo-600 text-white', dot: 'bg-indigo-500' },
];

export const MobileCategoriesView: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('categories');

    const canCreate = access.canWrite('actions', 'create');
    const canUpdate = access.canWrite('actions', 'update');
    const canDelete = access.canWrite('actions', 'delete');

    const [activeType, setActiveType] = useState<ProductType>(ProductType.MACHINE);
    const [search, setSearch] = useState('');
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<ProductCategory | null>(null);
    const addInputRef = useRef<HTMLInputElement>(null);

    const { categories } = state;

    const activeTab = TYPE_TABS.find(t => t.type === activeType)!;

    const processed = useMemo(() =>
        categories
            .filter(c => c.type === activeType)
            .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories, activeType, search]
    );

    const handleAdd = () => {
        if (!canCreate || !newName.trim()) return;
        const isDuplicate = categories.some(c =>
            c.type === activeType && c.name.toLowerCase() === newName.trim().toLowerCase()
        );
        if (isDuplicate) { alert(`Категория "${newName.trim()}" уже существует`); return; }
        actions.addCategory({ id: ApiService.generateId('CAT'), name: newName.trim(), type: activeType });
        setNewName('');
        addInputRef.current?.focus();
    };

    const handleStartEdit = (cat: ProductCategory) => {
        setEditingId(cat.id);
        setEditName(cat.name);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        const category = categories.find(c => c.id === editingId);
        if (!category) return;
        if (category.name === editName.trim()) { setEditingId(null); return; }
        const isDuplicate = categories.some(c =>
            c.id !== editingId &&
            c.type === category.type &&
            c.name.toLowerCase() === editName.trim().toLowerCase()
        );
        if (isDuplicate) { alert(`Категория "${editName.trim()}" уже существует`); return; }
        await actions.updateCategory({ ...category, name: editName.trim() });
        setEditingId(null);
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        actions.deleteCategory(deleteTarget.id);
        setDeleteTarget(null);
    };

    const switchType = (type: ProductType) => {
        setActiveType(type);
        setEditingId(null);
        setSearch('');
        setNewName('');
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-slate-50">

            {/* ── Header ── */}
            <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <List size={18}/>
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Категории</h1>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 leading-none">
                                {activeTab.label} · {processed.length}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Type tabs */}
                <div className="flex gap-1 mb-2">
                    {TYPE_TABS.map(({ type, label, Icon, color }) => (
                        <button
                            key={type}
                            onClick={() => switchType(type)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                activeType === type ? color : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            <Icon size={12}/> {label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск..."
                        className="w-full pl-8 pr-8 py-2 text-[13px] bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-indigo-300"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300">
                            <X size={13}/>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Add form ── */}
            {canCreate && (
                <div className="bg-white border-b border-slate-100 px-4 py-2.5 shrink-0 flex gap-2">
                    <input
                        ref={addInputRef}
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        placeholder={`Новая категория (${activeTab.label.toLowerCase()})...`}
                        className="flex-1 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-300 placeholder:text-slate-300 placeholder:font-normal"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newName.trim()}
                        className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                    >
                        <Plus size={14}/>
                    </button>
                </div>
            )}

            {/* ── List ── */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {processed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
                        <List size={32}/>
                        <p className="text-[11px] font-black uppercase tracking-widest">Категории не найдены</p>
                    </div>
                ) : processed.map(cat => {
                    const isEditing = editingId === cat.id;

                    return (
                        <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        className="flex-1 bg-slate-50 border border-blue-200 px-3 py-1.5 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm text-slate-800"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleSaveEdit();
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                    />
                                    <button onClick={handleSaveEdit} className="p-2 bg-emerald-500 text-white rounded-xl active:scale-95 transition-all shadow-sm">
                                        <Check size={14}/>
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="p-2 bg-slate-100 text-slate-400 rounded-xl active:scale-95 transition-all">
                                        <X size={14}/>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${activeTab.dot}`}/>
                                    <span className="flex-1 font-black text-slate-800 text-sm leading-tight">{cat.name}</span>
                                    <div className="flex gap-0.5 shrink-0">
                                        {canUpdate && (
                                            <button
                                                onClick={() => handleStartEdit(cat)}
                                                className="p-1.5 text-slate-300 active:text-blue-500 rounded-lg active:bg-blue-50"
                                            >
                                                <Edit2 size={14}/>
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                onClick={() => setDeleteTarget(cat)}
                                                className="p-1.5 text-slate-300 active:text-red-500 rounded-lg active:bg-red-50"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                <div className="h-4"/>
            </div>

            {/* ── Delete bottom sheet ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[300] bg-slate-900/60 flex flex-col justify-end">
                    <div className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '95dvh' }}>
                        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5"/>
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24}/>
                        </div>
                        <h3 className="text-base font-black text-slate-800 text-center uppercase tracking-tight mb-1">Удалить категорию?</h3>
                        <p className="text-[12px] text-slate-500 text-center mb-6 leading-relaxed">
                            «{deleteTarget.name}» будет перемещена в корзину.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleDelete}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                            >
                                Да, удалить
                            </button>
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase tracking-widest text-xs"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
