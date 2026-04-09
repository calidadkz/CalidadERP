import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, X, Check, Plus, Hash } from 'lucide-react';
import { CashFlowItem, CashFlowTag, CashFlowItemType } from '@/types';
import { TagBadge } from './CashFlowBadges';
import { ItemRow, ItemRowCallbacks } from './ItemRow';

interface GroupRowProps extends ItemRowCallbacks {
    group: CashFlowItem;
    children: CashFlowItem[];
    tags: CashFlowTag[];
    itemTypes: CashFlowItemType[];
    allItems: CashFlowItem[];
    activeType: 'Expense' | 'Income';
    canDelete: boolean;
    canCreate: boolean;
    onAddItemToGroup: (groupId: string) => void;
}

export const GroupRow: React.FC<GroupRowProps> = ({
    group, children, tags, itemTypes, allItems, activeType,
    onDelete, onToggleTags, onSetItemType, onRename, onMoveToGroup,
    canDelete, canCreate, onAddItemToGroup,
}) => {
    const [expanded, setExpanded] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(group.name);
    const [showGroupTagPicker, setShowGroupTagPicker] = useState(false);

    const handleSaveName = () => {
        if (editName.trim() && editName !== group.name) onRename(group.id, editName.trim());
        setIsEditingName(false);
    };

    const groupTags = tags.filter(t => group.tagIds?.includes(t.id));
    const groupTagIds = group.tagIds || [];

    return (
        <>
            <tr className="bg-slate-50/80 hover:bg-slate-100/60 transition-all group border-t border-slate-100">
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setExpanded(p => !p)}
                            className="flex items-center gap-2 font-black text-slate-600 text-xs uppercase tracking-widest"
                        >
                            {expanded
                                ? <ChevronDown size={14} className="text-slate-400" />
                                : <ChevronRight size={14} className="text-slate-400" />
                            }
                            <span>{group.name}</span>
                            <span className="ml-1 text-[10px] font-bold text-slate-300">({children.length})</span>
                        </button>

                        {/* Теги группы */}
                        {groupTags.map(t => (
                            <TagBadge
                                key={t.id}
                                tag={t}
                                onRemove={() => onToggleTags(group.id, groupTagIds.filter(x => x !== t.id))}
                            />
                        ))}
                        {groupTags.length > 0 && (
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">↓ наследуется</span>
                        )}
                    </div>
                </td>

                <td className="px-4 py-3 text-right" />

                <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Добавить статью в группу */}
                        {canCreate && (
                            <button
                                onClick={() => onAddItemToGroup(group.id)}
                                className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-blue-200 hover:border-blue-400"
                                title="Добавить статью в эту группу"
                            >
                                <Plus size={11} /> Статья
                            </button>
                        )}

                        {/* Тег группы */}
                        {canCreate && tags.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowGroupTagPicker(p => !p)}
                                    className={`flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg transition-all border ${showGroupTagPicker ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'text-indigo-500 hover:bg-indigo-50 border-indigo-200 hover:border-indigo-400'}`}
                                    title="Теги группы (наследуются всеми статьями)"
                                >
                                    <Hash size={11} /> Тег
                                </button>
                                {showGroupTagPicker && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-50 min-w-[190px] space-y-1">
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 pb-1 border-b border-slate-100">
                                            Теги группы (наследуются статьями)
                                        </div>
                                        {tags.map(tag => {
                                            const active = groupTagIds.includes(tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => {
                                                        const next = active
                                                            ? groupTagIds.filter(t => t !== tag.id)
                                                            : [...groupTagIds, tag.id];
                                                        onToggleTags(group.id, next);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                                                >
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                                    <span className="text-xs font-bold text-slate-700 flex-1">{tag.name}</span>
                                                    {active && <Check size={11} className="text-emerald-500" />}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setShowGroupTagPicker(false)}
                                            className="w-full text-center text-[9px] text-slate-300 pt-1 hover:text-slate-500"
                                        >
                                            закрыть
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setIsEditingName(true)}
                            className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                            <Pencil size={14} />
                        </button>

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
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') { setIsEditingName(false); setEditName(group.name); }
                                    }}
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
                    itemTypes={itemTypes}
                    allItems={allItems}
                    activeType={activeType}
                    onDelete={onDelete}
                    onToggleTags={onToggleTags}
                    onSetItemType={onSetItemType}
                    onRename={onRename}
                    onMoveToGroup={onMoveToGroup}
                    canDelete={canDelete}
                    indent
                    inheritedTagIds={groupTagIds}
                />
            ))}
        </>
    );
};
