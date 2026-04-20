import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Pencil, Trash2, X, Check, Hash, Search } from 'lucide-react';
import { CashFlowItem, CashFlowTag, CashFlowItemType } from '@/types';
import { TagBadge } from './CashFlowBadges';
import { CalidadSelect } from '@/components/ui/CalidadSelect';

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
    const [tagSearch, setTagSearch] = useState('');
    const tagPickerRef = useRef<HTMLDivElement>(null);

    const itemTags = tags.filter(t => item.tagIds?.includes(t.id));
    const inheritedTags = tags.filter(t => inheritedTagIds.includes(t.id) && !item.tagIds?.includes(t.id));
    const groups = allItems.filter(x => x.isGroup && x.type === activeType);

    const typeOptions = itemTypes.map(t => ({ id: t.id, label: t.name }));
    const groupOptions = groups.map(g => ({ id: g.id, label: g.name }));

    const filteredTags = useMemo(() => {
        if (!tagSearch) return tags;
        const q = tagSearch.toLowerCase();
        return tags.filter(t => t.name.toLowerCase().includes(q));
    }, [tags, tagSearch]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
                setShowTagPicker(false);
                setTagSearch('');
            }
        };
        if (showTagPicker) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showTagPicker]);

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
                        {/* Бейджи тегов */}
                        {(itemTags.length > 0 || inheritedTags.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
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

            <td className="px-4 py-3.5">
                {!item.isGroup && (
                    <div className="flex gap-2">
                        {itemTypes.length > 0 && (
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5 ml-0.5">Тип</div>
                                <CalidadSelect
                                    options={typeOptions}
                                    value={item.itemTypeId || ''}
                                    onChange={id => onSetItemType(item.id, id || null)}
                                    nullLabel="— Не задан —"
                                    placeholder="Не задан"
                                    zIndex="z-[110]"
                                    dropdownMinWidth="180px"
                                />
                            </div>
                        )}
                        {groupOptions.length > 0 && (
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5 ml-0.5">Группа</div>
                                <CalidadSelect
                                    options={groupOptions}
                                    value={item.parentId || ''}
                                    onChange={id => onMoveToGroup(item.id, id || null)}
                                    nullLabel="— Без группы —"
                                    placeholder="Без группы"
                                    zIndex="z-[110]"
                                    dropdownMinWidth="180px"
                                />
                            </div>
                        )}
                    </div>
                )}
            </td>

            <td className="px-4 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1 transition-all">

                    {/* Теги */}
                    {!item.isGroup && tags.length > 0 && (
                        <div className="relative" ref={tagPickerRef}>
                            <button
                                onClick={() => { setShowTagPicker(p => !p); if (!showTagPicker) setTagSearch(''); }}
                                className="p-1.5 text-slate-200 group-hover:text-slate-400 hover:!text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Теги"
                            >
                                <Hash size={15} />
                            </button>
                            {showTagPicker && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] min-w-[200px] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                    <div className="p-2 border-b bg-slate-50">
                                        <div className="relative">
                                            <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                                            <input
                                                autoFocus
                                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400"
                                                placeholder="Начните ввод..."
                                                value={tagSearch}
                                                onChange={e => setTagSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto p-1 custom-scrollbar">
                                        {filteredTags.length === 0 && (
                                            <div className="px-3 py-2 text-[11px] text-slate-400 italic">Нет совпадений</div>
                                        )}
                                        {filteredTags.map(tag => {
                                            const active = item.tagIds?.includes(tag.id);
                                            return (
                                                <div
                                                    key={tag.id}
                                                    onClick={() => {
                                                        const next = active
                                                            ? item.tagIds.filter(t => t !== tag.id)
                                                            : [...(item.tagIds || []), tag.id];
                                                        onToggleTags(item.id, next);
                                                    }}
                                                    className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center gap-2 transition-all ${active ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                                >
                                                    <div className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: tag.color }} />
                                                    <span className="font-bold flex-1">{tag.name}</span>
                                                    {active && <Check size={11} className="text-blue-500 flex-none" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Переименовать */}
                    <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1.5 text-slate-200 group-hover:text-slate-400 hover:!text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
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
                            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-200 group-hover:text-slate-400 hover:!text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={15} /></button>
                        )
                    )}
                </div>
            </td>
        </tr>
    );
};
