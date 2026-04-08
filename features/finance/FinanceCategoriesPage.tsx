
import React, { useState, useRef, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { CashFlowItem, CashFlowTag, CashFlowCategory } from '@/types';
import {
    Plus, Trash2, Tag, ArrowDownCircle, ArrowUpCircle, X, Check,
    ShieldAlert, ChevronDown, ChevronRight, FolderPlus, Pencil, Hash
} from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';
import { ApiService } from '@/services/api';

// ─────────────────────────────────────────────
// Вспомогательные компоненты
// ─────────────────────────────────────────────

const TAG_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
];

interface TagBadgeProps {
    tag: CashFlowTag;
    onRemove?: () => void;
}
const TagBadge: React.FC<TagBadgeProps> = ({ tag, onRemove }) => (
    <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide"
        style={{ backgroundColor: tag.color + '22', color: tag.color }}
    >
        {tag.name}
        {onRemove && (
            <button onClick={onRemove} className="hover:opacity-70 transition-opacity ml-0.5">
                <X size={9} />
            </button>
        )}
    </span>
);

// ─────────────────────────────────────────────
// Модал тегов
// ─────────────────────────────────────────────
interface TagManagerModalProps {
    tags: CashFlowTag[];
    onAddTag: (tag: Omit<CashFlowTag, 'id'>) => Promise<CashFlowTag>;
    onUpdateTag: (id: string, data: Partial<CashFlowTag>) => Promise<CashFlowTag>;
    onDeleteTag: (id: string) => Promise<void>;
    onClose: () => void;
}
const TagManagerModal: React.FC<TagManagerModalProps> = ({ tags, onAddTag, onUpdateTag, onDeleteTag, onClose }) => {
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(TAG_COLORS[0]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        await onAddTag({ name: newName.trim(), color: newColor });
        setNewName('');
    };

    const handleStartEdit = (tag: CashFlowTag) => {
        setEditingId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editName.trim()) return;
        await onUpdateTag(editingId, { name: editName.trim(), color: editColor });
        setEditingId(null);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Hash size={18} className="text-indigo-500" /> Управление тегами
                    </h3>
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors"><X size={20} /></button>
                </div>

                {/* Создание тега */}
                <div className="flex gap-2 mb-4">
                    <input
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Название тега..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <div className="flex gap-1">
                        {TAG_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setNewColor(c)}
                                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                                style={{ backgroundColor: c, borderColor: newColor === c ? '#1e293b' : 'transparent' }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={!newName.trim()}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase shadow-md hover:bg-indigo-700 transition-all disabled:opacity-30"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Список тегов */}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                    {tags.length === 0 ? (
                        <div className="text-center text-slate-300 py-8 text-sm italic">Теги пока не созданы</div>
                    ) : tags.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 group">
                            {editingId === tag.id ? (
                                <>
                                    <input
                                        className="flex-1 border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                        autoFocus
                                    />
                                    <div className="flex gap-1">
                                        {TAG_COLORS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setEditColor(c)}
                                                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                                                style={{ backgroundColor: c, borderColor: editColor === c ? '#1e293b' : 'transparent' }}
                                            />
                                        ))}
                                    </div>
                                    <button onClick={handleSaveEdit} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"><Check size={14} /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"><X size={14} /></button>
                                </>
                            ) : (
                                <>
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                    <span className="flex-1 text-sm font-bold text-slate-700">{tag.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleStartEdit(tag)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                                        {confirmDeleteId === tag.id ? (
                                            <>
                                                <span className="text-[9px] font-black text-red-600 uppercase self-center mr-1">Удалить?</span>
                                                <button onClick={() => { onDeleteTag(tag.id); setConfirmDeleteId(null); }} className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><Check size={13} /></button>
                                                <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg transition-colors"><X size={13} /></button>
                                            </>
                                        ) : (
                                            <button onClick={() => setConfirmDeleteId(tag.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
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

// ─────────────────────────────────────────────
// Модал создания группы/статьи
// ─────────────────────────────────────────────
interface CreateItemModalProps {
    type: 'Income' | 'Expense';
    isGroup: boolean;
    groups: CashFlowItem[];
    tags: CashFlowTag[];
    onSubmit: (data: Partial<CashFlowItem>) => Promise<void>;
    onClose: () => void;
}
const CreateItemModal: React.FC<CreateItemModalProps> = ({ type, isGroup, groups, tags, onSubmit, onClose }) => {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState<string>('');
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
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
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Группа (необязательно)</label>
                            <select
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                value={parentId}
                                onChange={e => setParentId(e.target.value)}
                            >
                                <option value="">— Без группы —</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
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

// ─────────────────────────────────────────────
// Строка статьи
// ─────────────────────────────────────────────
interface ItemRowProps {
    item: CashFlowItem;
    tags: CashFlowTag[];
    allItems: CashFlowItem[];
    activeType: 'Expense' | 'Income';
    onDelete: (id: string) => void;
    onToggleTags: (id: string, tagIds: string[]) => void;
    onRename: (id: string, name: string) => void;
    onMoveToGroup: (id: string, parentId: string | null) => void;
    canDelete: boolean;
    indent?: boolean;
}
const ItemRow: React.FC<ItemRowProps> = ({ item, tags, allItems, activeType, onDelete, onToggleTags, onRename, onMoveToGroup, canDelete, indent }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [showTagPicker, setShowTagPicker] = useState(false);

    const itemTags = tags.filter(t => item.tagIds?.includes(t.id));
    const groups = allItems.filter(x => x.isGroup && x.type === activeType);

    const handleSaveName = () => {
        if (editName.trim() && editName !== item.name) onRename(item.id, editName.trim());
        setIsEditingName(false);
    };

    return (
        <tr className="hover:bg-slate-50/50 transition-all group">
            <td className="px-4 py-3.5">
                <div className={`flex items-start gap-2.5 ${indent ? 'pl-8' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${activeType === 'Expense' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <div className="min-w-0 flex-1">
                        {isEditingName ? (
                            <input
                                autoFocus
                                className="border border-blue-300 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-full"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setIsEditingName(false); setEditName(item.name); } }}
                            />
                        ) : (
                            <span
                                className="font-black text-slate-800 text-sm tracking-tight cursor-pointer hover:text-blue-600 transition-colors"
                                onDoubleClick={() => setIsEditingName(true)}
                                title="Двойной клик для переименования"
                            >{item.name}</span>
                        )}
                        {itemTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {itemTags.map(t => (
                                    <TagBadge key={t.id} tag={t} onRemove={() => onToggleTags(item.id, item.tagIds.filter(x => x !== t.id))} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-4 py-3.5 text-right">
                {/* Группа */}
                {!item.isGroup && groups.length > 0 && (
                    <select
                        className="text-[10px] font-bold text-slate-400 border border-slate-100 rounded-lg px-1.5 py-1 bg-white outline-none hover:border-slate-300 transition-colors mr-2"
                        value={item.parentId || ''}
                        onChange={e => onMoveToGroup(item.id, e.target.value || null)}
                        title="Группа"
                    >
                        <option value="">Без группы</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                )}
            </td>
            <td className="px-4 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Добавить тег */}
                    {!item.isGroup && tags.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowTagPicker(p => !p)}
                                className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Теги"
                            >
                                <Hash size={15} />
                            </button>
                            {showTagPicker && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 min-w-[160px] space-y-1">
                                    {tags.map(tag => {
                                        const active = item.tagIds?.includes(tag.id);
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    const next = active ? item.tagIds.filter(t => t !== tag.id) : [...(item.tagIds || []), tag.id];
                                                    onToggleTags(item.id, next);
                                                }}
                                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                                <span className="text-xs font-bold text-slate-700 flex-1">{tag.name}</span>
                                                {active && <Check size={11} className="text-emerald-500" />}
                                            </button>
                                        );
                                    })}
                                    <button onClick={() => setShowTagPicker(false)} className="w-full text-center text-[9px] text-slate-300 pt-1 hover:text-slate-500">закрыть</button>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Переименовать */}
                    <button onClick={() => setIsEditingName(true)} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Переименовать">
                        <Pencil size={15} />
                    </button>
                    {/* Удалить */}
                    {canDelete && (
                        confirmDelete ? (
                            <>
                                <span className="text-[9px] font-black text-red-600 uppercase">Удалить?</span>
                                <button onClick={() => { onDelete(item.id); setConfirmDelete(false); }} className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all active:scale-90"><Check size={14} /></button>
                                <button onClick={() => setConfirmDelete(false)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all active:scale-90"><X size={14} /></button>
                            </>
                        ) : (
                            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={15} /></button>
                        )
                    )}
                </div>
            </td>
        </tr>
    );
};

// ─────────────────────────────────────────────
// Строка группы
// ─────────────────────────────────────────────
interface GroupRowProps {
    group: CashFlowItem;
    children: CashFlowItem[];
    tags: CashFlowTag[];
    allItems: CashFlowItem[];
    activeType: 'Expense' | 'Income';
    onDelete: (id: string) => void;
    onToggleTags: (id: string, tagIds: string[]) => void;
    onRename: (id: string, name: string) => void;
    onMoveToGroup: (id: string, parentId: string | null) => void;
    canDelete: boolean;
}
const GroupRow: React.FC<GroupRowProps> = ({ group, children, tags, allItems, activeType, onDelete, onToggleTags, onRename, onMoveToGroup, canDelete }) => {
    const [expanded, setExpanded] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(group.name);

    const handleSaveName = () => {
        if (editName.trim() && editName !== group.name) onRename(group.id, editName.trim());
        setIsEditingName(false);
    };

    return (
        <>
            <tr className="bg-slate-50/80 hover:bg-slate-100/60 transition-all group border-t border-slate-100">
                <td className="px-4 py-3" colSpan={1}>
                    <button
                        onClick={() => setExpanded(p => !p)}
                        className="flex items-center gap-2 font-black text-slate-600 text-xs uppercase tracking-widest"
                    >
                        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span>{group.name}</span>
                        <span className="ml-1 text-[10px] font-bold text-slate-300">({children.length})</span>
                    </button>
                </td>
                <td className="px-4 py-3 text-right" />
                <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setIsEditingName(true)} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Pencil size={14} /></button>
                        {canDelete && (
                            confirmDelete ? (
                                <>
                                    <span className="text-[9px] font-black text-red-600 uppercase">Удалить?</span>
                                    <button onClick={() => { onDelete(group.id); setConfirmDelete(false); }} className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all active:scale-90"><Check size={14} /></button>
                                    <button onClick={() => setConfirmDelete(false)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg transition-all active:scale-90"><X size={14} /></button>
                                </>
                            ) : (
                                <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                            )
                        )}
                    </div>
                    {isEditingName && (
                        <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center" onClick={() => setIsEditingName(false)}>
                            <div className="bg-white rounded-2xl p-5 shadow-2xl w-80" onClick={e => e.stopPropagation()}>
                                <p className="text-xs font-black uppercase text-slate-500 mb-2">Переименовать группу</p>
                                <input
                                    autoFocus
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onBlur={handleSaveName}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setIsEditingName(false); setEditName(group.name); } }}
                                />
                            </div>
                        </div>
                    )}
                </td>
            </tr>
            {expanded && children.map(child => (
                <ItemRow
                    key={child.id}
                    item={child}
                    tags={tags}
                    allItems={allItems}
                    activeType={activeType}
                    onDelete={onDelete}
                    onToggleTags={onToggleTags}
                    onRename={onRename}
                    onMoveToGroup={onMoveToGroup}
                    canDelete={canDelete}
                    indent
                />
            ))}
        </>
    );
};

// ─────────────────────────────────────────────
// Главная страница
// ─────────────────────────────────────────────
export const FinanceCategoriesPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('finance_categories');
    const { cashFlowItems, cashFlowTags } = state;

    const [activeType, setActiveType] = useState<'Expense' | 'Income'>('Expense');
    const [showTagManager, setShowTagManager] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState<false | 'group' | 'item'>(false);
    const [filterTagId, setFilterTagId] = useState<string>('');

    const canCreate = access.canWrite('actions', 'create');
    const canDelete = access.canWrite('actions', 'delete');

    // Статьи текущего типа
    const typeItems = useMemo(
        () => cashFlowItems.filter(c => c.type === activeType),
        [cashFlowItems, activeType]
    );

    // Группы
    const groups = useMemo(() => typeItems.filter(x => x.isGroup).sort((a, b) => a.sortOrder - b.sortOrder), [typeItems]);

    // Статьи (не группы) с фильтром по тегу
    const leafItems = useMemo(() => {
        let items = typeItems.filter(x => !x.isGroup);
        if (filterTagId) items = items.filter(x => x.tagIds?.includes(filterTagId));
        return items.sort((a, b) => a.sortOrder - b.sortOrder);
    }, [typeItems, filterTagId]);

    // Статьи без группы
    const ungroupedItems = useMemo(() => leafItems.filter(x => !x.parentId), [leafItems]);

    const handleCreateItem = async (data: Partial<CashFlowItem>) => {
        await actions.addCashFlowItem({
            id: ApiService.generateUUID(),
            name: data.name!,
            type: activeType,
            isGroup: data.isGroup ?? false,
            parentId: data.parentId ?? null,
            tagIds: data.tagIds ?? [],
            sortOrder: data.sortOrder ?? 0,
            category: CashFlowCategory.OPERATING,
        });
    };

    const handleDelete = (id: string) => actions.deleteCashFlowItem(id);

    const handleToggleTags = async (id: string, tagIds: string[]) => {
        await actions.updateCashFlowItem(id, { tagIds });
    };

    const handleRename = async (id: string, name: string) => {
        await actions.updateCashFlowItem(id, { name });
    };

    const handleMoveToGroup = async (id: string, parentId: string | null) => {
        await actions.updateCashFlowItem(id, { parentId });
    };

    const commonRowProps = {
        tags: cashFlowTags,
        allItems: typeItems,
        activeType,
        onDelete: handleDelete,
        onToggleTags: handleToggleTags,
        onRename: handleRename,
        onMoveToGroup: handleMoveToGroup,
        canDelete,
    };

    return (
        <>
            {/* Модалы */}
            {showTagManager && (
                <TagManagerModal
                    tags={cashFlowTags}
                    onAddTag={actions.addCashFlowTag}
                    onUpdateTag={actions.updateCashFlowTag}
                    onDeleteTag={actions.deleteCashFlowTag}
                    onClose={() => setShowTagManager(false)}
                />
            )}
            {showCreateModal !== false && (
                <CreateItemModal
                    type={activeType}
                    isGroup={showCreateModal === 'group'}
                    groups={groups}
                    tags={cashFlowTags}
                    onSubmit={handleCreateItem}
                    onClose={() => setShowCreateModal(false)}
                />
            )}

            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">

                {/* Заголовок */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Tag className="mr-3 text-indigo-600" size={28} /> Статьи ДДС
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Классификация доходов и расходов для финансовой аналитики</p>
                    </div>
                    <button
                        onClick={() => setShowTagManager(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"
                    >
                        <Hash size={14} /> Теги ({cashFlowTags.length})
                    </button>
                </div>

                {/* Переключатель тип + кнопки создания */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex bg-white p-1.5 rounded-[1.25rem] shadow-sm border border-slate-200">
                        <button
                            onClick={() => { setActiveType('Expense'); setFilterTagId(''); }}
                            className={`flex items-center px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeType === 'Expense' ? 'bg-red-600 text-white shadow-red-200 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ArrowDownCircle size={14} className="mr-2" /> Расходы
                        </button>
                        <button
                            onClick={() => { setActiveType('Income'); setFilterTagId(''); }}
                            className={`flex items-center px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeType === 'Income' ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ArrowUpCircle size={14} className="mr-2" /> Доходы
                        </button>
                    </div>

                    {canCreate && (
                        <>
                            <button
                                onClick={() => setShowCreateModal('group')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                            >
                                <FolderPlus size={14} /> Группа
                            </button>
                            <button
                                onClick={() => setShowCreateModal('item')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                            >
                                <Plus size={14} /> Статья
                            </button>
                        </>
                    )}

                    {/* Фильтр по тегу */}
                    {cashFlowTags.length > 0 && (
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Тег:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {cashFlowTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => setFilterTagId(prev => prev === tag.id ? '' : tag.id)}
                                        className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all"
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
                        </div>
                    )}
                </div>

                {!canCreate && (
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-dashed border-slate-200 flex items-center gap-3 text-slate-400">
                        <ShieldAlert size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">У вас нет прав на создание новых статей</span>
                    </div>
                )}

                {/* Таблица */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Название / Теги</th>
                                <th className="text-right px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Группа</th>
                                <th className="w-40" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {typeItems.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-20 text-center text-slate-300 italic font-medium">В этом разделе пока нет статей</td>
                                </tr>
                            ) : (
                                <>
                                    {/* Группы + их статьи */}
                                    {groups.map(group => {
                                        const children = leafItems.filter(x => x.parentId === group.id);
                                        if (filterTagId && children.length === 0) return null;
                                        return (
                                            <GroupRow
                                                key={group.id}
                                                group={group}
                                                children={children}
                                                {...commonRowProps}
                                            />
                                        );
                                    })}
                                    {/* Статьи без группы */}
                                    {ungroupedItems.length > 0 && (
                                        <>
                                            {groups.length > 0 && (
                                                <tr className="bg-slate-50/40 border-t border-slate-100">
                                                    <td colSpan={3} className="px-6 py-2.5 text-[9px] font-black text-slate-300 uppercase tracking-widest">Без группы</td>
                                                </tr>
                                            )}
                                            {ungroupedItems.map(item => (
                                                <ItemRow key={item.id} item={item} {...commonRowProps} />
                                            ))}
                                        </>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Статистика */}
                <div className="flex gap-4 text-xs text-slate-400 font-bold">
                    <span>{groups.length} групп</span>
                    <span>·</span>
                    <span>{leafItems.length} статей</span>
                    {filterTagId && <><span>·</span><span className="text-indigo-500">фильтр по тегу</span></>}
                </div>
            </div>
        </>
    );
};
