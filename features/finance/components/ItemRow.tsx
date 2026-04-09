import React, { useState } from 'react';
import { Pencil, Trash2, X, Check, Hash, Layers } from 'lucide-react';
import { CashFlowItem, CashFlowTag, CashFlowItemType } from '@/types';
import { TagBadge, TypeBadge } from './CashFlowBadges';

export interface ItemRowCallbacks {
    onDelete: (id: string) => void;
    onToggleTags: (id: string, tagIds: string[]) => void;
    onSetItemType: (id: string, typeId: string | null) => void;
    onRename: (id: string, name: string) => void;
    onMoveToGroup: (id: string, parentId: string | null) => void;
}

interface ItemRowProps extends ItemRowCallbacks {
    item: CashFlowItem;
    tags: CashFlowTag[];
    itemTypes: CashFlowItemType[];
    allItems: CashFlowItem[];
    activeType: 'Expense' | 'Income';
    canDelete: boolean;
    indent?: boolean;
    inheritedTagIds?: string[];
}

export const ItemRow: React.FC<ItemRowProps> = ({
    item, tags, itemTypes, allItems, activeType,
    onDelete, onToggleTags, onSetItemType, onRename, onMoveToGroup,
    canDelete, indent, inheritedTagIds = [],
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(item.name);
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);

    const itemTags = tags.filter(t => item.tagIds?.includes(t.id));
    const inheritedTags = tags.filter(t => inheritedTagIds.includes(t.id) && !item.tagIds?.includes(t.id));
    const currentType = itemTypes.find(t => t.id === item.itemTypeId);
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
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveName();
                                    if (e.key === 'Escape') { setIsEditingName(false); setEditName(item.name); }
                                }}
                            />
                        ) : (
                            <span
                                className="font-black text-slate-800 text-sm tracking-tight cursor-pointer hover:text-blue-600 transition-colors"
                                onDoubleClick={() => setIsEditingName(true)}
                                title="Двойной клик для переименования"
                            >
                                {item.name}
                            </span>
                        )}
                        {/* Бейджи тегов и типа */}
                        {(itemTags.length > 0 || currentType || inheritedTags.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {currentType && <TypeBadge type={currentType} onRemove={() => onSetItemType(item.id, null)} />}
                                {itemTags.map(t => (
                                    <TagBadge
                                        key={t.id}
                                        tag={t}
                                        onRemove={() => onToggleTags(item.id, item.tagIds.filter(x => x !== t.id))}
                                    />
                                ))}
                                {inheritedTags.map(t => (
                                    <span
                                        key={`inh-${t.id}`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide opacity-50"
                                        style={{ backgroundColor: t.color + '18', color: t.color, border: `1px dashed ${t.color}66` }}
                                        title="Унаследован от группы"
                                    >
                                        ↑ {t.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            <td className="px-4 py-3.5 text-right">
                {!item.isGroup && groups.length > 0 && (
                    <select
                        className="text-[10px] font-bold text-slate-400 border border-slate-100 rounded-lg px-1.5 py-1 bg-white outline-none hover:border-slate-300 transition-colors"
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
                    {/* Тип статьи */}
                    {!item.isGroup && itemTypes.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => { setShowTypePicker(p => !p); setShowTagPicker(false); }}
                                className="p-1.5 text-slate-300 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-all"
                                title="Тип"
                            >
                                <Layers size={15} />
                            </button>
                            {showTypePicker && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 min-w-[160px] space-y-1">
                                    <button
                                        onClick={() => { onSetItemType(item.id, null); setShowTypePicker(false); }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                        <span className="text-xs font-bold text-slate-400 flex-1">Не задан</span>
                                        {!item.itemTypeId && <Check size={11} className="text-emerald-500" />}
                                    </button>
                                    {itemTypes.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => { onSetItemType(item.id, t.id); setShowTypePicker(false); }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                                        >
                                            <div className="w-2.5 h-2.5 rounded-md" style={{ backgroundColor: t.color }} />
                                            <span className="text-xs font-bold text-slate-700 flex-1">{t.name}</span>
                                            {item.itemTypeId === t.id && <Check size={11} className="text-emerald-500" />}
                                        </button>
                                    ))}
                                    <button onClick={() => setShowTypePicker(false)} className="w-full text-center text-[9px] text-slate-300 pt-1 hover:text-slate-500">закрыть</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Теги */}
                    {!item.isGroup && tags.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => { setShowTagPicker(p => !p); setShowTypePicker(false); }}
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
                                                    const next = active
                                                        ? item.tagIds.filter(t => t !== tag.id)
                                                        : [...(item.tagIds || []), tag.id];
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
                    <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        title="Переименовать"
                    >
                        <Pencil size={15} />
                    </button>

                    {/* Удалить */}
                    {canDelete && (
                        confirmDelete ? (
                            <>
                                <span className="text-[9px] font-black text-red-600 uppercase">Удалить?</span>
                                <button onClick={() => { onDelete(item.id); setConfirmDelete(false); }} className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all active:scale-90"><Check size={14} /></button>
                                <button onClick={() => setConfirmDelete(false)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg transition-all active:scale-90"><X size={14} /></button>
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
