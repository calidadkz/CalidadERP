import React, { useState, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { CashFlowItem, CashFlowCategory } from '@/types';
import {
    Tag, ArrowDownCircle, ArrowUpCircle,
    ShieldAlert, FolderPlus, Plus, Hash, Layers, Box,
} from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';
import { ApiService } from '@/services/api';
import { DictManagerModal } from './components/DictManagerModal';
import { CreateItemModal } from './components/CreateItemModal';
import { GroupRow } from './components/GroupRow';
import { ItemRow } from './components/ItemRow';

export const FinanceCategoriesPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('finance_categories');
    const { cashFlowItems, cashFlowTags, cashFlowItemTypes } = state;

    const [activeType, setActiveType] = useState<'Expense' | 'Income'>('Expense');
    const [showTagManager, setShowTagManager] = useState(false);
    const [showTypeManager, setShowTypeManager] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState<false | 'group' | 'item'>(false);
    const [createModalGroupId, setCreateModalGroupId] = useState<string | undefined>(undefined);
    const [filterTagId, setFilterTagId] = useState('');
    const [filterItemTypeId, setFilterItemTypeId] = useState('');

    const canCreate = access.canWrite('actions', 'create');
    const canDelete = access.canWrite('actions', 'delete');

    const typeItems = useMemo(() => cashFlowItems.filter(c => c.type === activeType), [cashFlowItems, activeType]);
    const groups = useMemo(() => typeItems.filter(x => x.isGroup).sort((a, b) => a.sortOrder - b.sortOrder), [typeItems]);
    const leafItems = useMemo(() => {
        let items = typeItems.filter(x => !x.isGroup);
        if (filterTagId) items = items.filter(x => x.tagIds?.includes(filterTagId));
        if (filterItemTypeId) items = items.filter(x => x.itemTypeId === filterItemTypeId);
        return items.sort((a, b) => a.sortOrder - b.sortOrder);
    }, [typeItems, filterTagId, filterItemTypeId]);
    const ungroupedItems = useMemo(() => leafItems.filter(x => !x.parentId), [leafItems]);

    // ─── Обработчики ───────────────────────────────────────────────────────────

    const handleCreateItem = async (data: Partial<CashFlowItem>) => {
        await actions.addCashFlowItem({
            id: ApiService.generateUUID(),
            name: data.name!,
            type: activeType,
            isGroup: data.isGroup ?? false,
            parentId: data.parentId ?? null,
            tagIds: data.tagIds ?? [],
            itemTypeId: data.itemTypeId ?? null,
            sortOrder: 0,
            category: CashFlowCategory.OPERATING,
        });
    };

    const handleAddItemToGroup = (groupId: string) => {
        setCreateModalGroupId(groupId);
        setShowCreateModal('item');
    };

    const openCreateModal = (mode: 'group' | 'item') => {
        setCreateModalGroupId(undefined);
        setShowCreateModal(mode);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateModalGroupId(undefined);
    };

    const handleDelete      = (id: string) => actions.deleteCashFlowItem(id);
    const handleToggleTags  = (id: string, tagIds: string[]) => actions.updateCashFlowItem(id, { tagIds });
    const handleSetItemType = (id: string, typeId: string | null) => actions.updateCashFlowItem(id, { itemTypeId: typeId });
    const handleRename      = (id: string, name: string) => actions.updateCashFlowItem(id, { name });
    const handleMoveToGroup = (id: string, parentId: string | null) => actions.updateCashFlowItem(id, { parentId });

    const rowCallbacks = {
        onDelete:      handleDelete,
        onToggleTags:  handleToggleTags,
        onSetItemType: handleSetItemType,
        onRename:      handleRename,
        onMoveToGroup: handleMoveToGroup,
    };

    const commonRowProps = {
        ...rowCallbacks,
        tags:       cashFlowTags,
        itemTypes:  cashFlowItemTypes,
        allItems:   typeItems,
        activeType,
        canDelete,
    };

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── Модалы ── */}
            {showTagManager && (
                <DictManagerModal
                    title="Теги статей ДДС"
                    items={cashFlowTags}
                    onAdd={actions.addCashFlowTag}
                    onUpdate={actions.updateCashFlowTag}
                    onDelete={actions.deleteCashFlowTag}
                    onClose={() => setShowTagManager(false)}
                />
            )}
            {showTypeManager && (
                <DictManagerModal
                    title="Типы статей ДДС"
                    items={cashFlowItemTypes}
                    onAdd={actions.addCashFlowItemType}
                    onUpdate={actions.updateCashFlowItemType}
                    onDelete={actions.deleteCashFlowItemType}
                    onClose={() => setShowTypeManager(false)}
                />
            )}
            {showCreateModal !== false && (
                <CreateItemModal
                    type={activeType}
                    isGroup={showCreateModal === 'group'}
                    groups={groups}
                    tags={cashFlowTags}
                    itemTypes={cashFlowItemTypes}
                    defaultParentId={createModalGroupId}
                    onSubmit={handleCreateItem}
                    onClose={closeCreateModal}
                />
            )}

            <div className="space-y-6 w-full max-w-[1210px] mx-auto animate-in fade-in duration-500">

                {/* ── Заголовок ── */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Tag className="mr-3 text-indigo-600" size={28} /> Статьи ДДС
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Классификация доходов и расходов для финансовой аналитики</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowTypeManager(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-violet-600 hover:border-violet-200 shadow-sm transition-all"
                        >
                            <Layers size={14} /> Типы ({cashFlowItemTypes.length})
                        </button>
                        <button
                            onClick={() => setShowTagManager(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"
                        >
                            <Hash size={14} /> Теги ({cashFlowTags.length})
                        </button>
                    </div>
                </div>

                {/* ── Переключатель + кнопки ── */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex bg-white p-1.5 rounded-[1.25rem] shadow-sm border border-slate-200">
                        <button
                            onClick={() => { setActiveType('Expense'); setFilterTagId(''); setFilterItemTypeId(''); }}
                            className={`flex items-center px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeType === 'Expense' ? 'bg-red-600 text-white shadow-red-200 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ArrowDownCircle size={14} className="mr-2" /> Расходы
                        </button>
                        <button
                            onClick={() => { setActiveType('Income'); setFilterTagId(''); setFilterItemTypeId(''); }}
                            className={`flex items-center px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeType === 'Income' ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ArrowUpCircle size={14} className="mr-2" /> Доходы
                        </button>
                    </div>

                    {canCreate && (
                        <>
                            <button
                                onClick={() => openCreateModal('group')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                            >
                                <FolderPlus size={14} /> Группа
                            </button>
                            <button
                                onClick={() => openCreateModal('item')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                            >
                                <Plus size={14} /> Статья
                            </button>
                        </>
                    )}
                </div>

                {/* ── Фильтры ── */}
                {(cashFlowItemTypes.length > 0 || cashFlowTags.length > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {cashFlowItemTypes.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Тип:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {cashFlowItemTypes.map(it => (
                                        <button
                                            key={it.id}
                                            onClick={() => setFilterItemTypeId(p => p === it.id ? '' : it.id)}
                                            className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wide border flex items-center gap-1 transition-all"
                                            style={{
                                                borderColor: it.color,
                                                backgroundColor: filterItemTypeId === it.id ? it.color : 'transparent',
                                                color: filterItemTypeId === it.id ? '#fff' : it.color,
                                            }}
                                        >
                                            <Layers size={8} /> {it.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {cashFlowTags.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Тег:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {cashFlowTags.map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => setFilterTagId(p => p === tag.id ? '' : tag.id)}
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
                )}

                {!canCreate && (
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-dashed border-slate-200 flex items-center gap-3 text-slate-400">
                        <ShieldAlert size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">У вас нет прав на создание новых статей</span>
                    </div>
                )}

                {/* ── Таблица ── */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Название / Теги</th>
                                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[340px]">Тип / Группа</th>
                                <th className="w-36" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {typeItems.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-20 text-center text-slate-400 italic font-medium">
                                        В этом разделе пока нет статей
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {groups.map(group => {
                                        const children = leafItems.filter(x => x.parentId === group.id);
                                        if ((filterTagId || filterItemTypeId) && children.length === 0) return null;
                                        return (
                                            <GroupRow
                                                key={group.id}
                                                group={group}
                                                children={children}
                                                {...commonRowProps}
                                                canCreate={canCreate}
                                                onAddItemToGroup={handleAddItemToGroup}
                                            />
                                        );
                                    })}
                                    {ungroupedItems.length > 0 && (
                                        <>
                                            {groups.length > 0 && (
                                                <tr className="bg-slate-50/40 border-t border-slate-100">
                                                    <td colSpan={3} className="px-6 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Без группы</td>
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

                {/* ── Итог ── */}
                <div className="flex gap-4 text-xs text-slate-400 font-bold">
                    <span>{groups.length} групп</span>
                    <span>·</span>
                    <span>{leafItems.length} статей</span>
                    {(filterTagId || filterItemTypeId) && <><span>·</span><span className="text-indigo-500">фильтр активен</span></>}
                </div>
            </div>
        </>
    );
};
