
import React, { useState, useMemo, memo } from 'react';
import { Product, OptionVariant, Supplier } from '@/types';
import { X, Search, Check, ArrowRight, ChevronDown, ChevronUp, Minus, Star, AlertTriangle } from 'lucide-react';

type SortField = 'name' | 'basePrice' | 'salesPrice';
type SortDir = 'asc' | 'desc';

export interface ExistingMachineUpdate {
    machineId: string;
    remove: boolean;
    priceOverrides: Record<string, number | ''>;
    isBase: boolean;
}

interface MassAddModalProps {
    selectedVariantsToApply: string[];
    variantMap: Map<string, OptionVariant>;
    machines: Product[];
    suppliers: Supplier[];
    onClose: () => void;
    onConfirm: (
        selectedMachineIds: string[],
        priceOverrides: Record<string, Record<string, number | ''>>,
        isBaseMap: Record<string, boolean>,
        existingUpdates: ExistingMachineUpdate[]
    ) => Promise<void>;
}

const SortTh: React.FC<{
    field: SortField;
    current: SortField;
    dir: SortDir;
    onSort: (f: SortField) => void;
    className?: string;
    children: React.ReactNode;
}> = ({ field, current, dir, onSort, className, children }) => {
    const active = current === field;
    return (
        <th
            className={`${className} cursor-pointer select-none group`}
            onClick={() => onSort(field)}
        >
            <span className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-blue-600' : 'group-hover:text-slate-600'}`}>
                {children}
                {active
                    ? (dir === 'asc' ? <ChevronUp size={10} className="shrink-0"/> : <ChevronDown size={10} className="shrink-0"/>)
                    : <ChevronUp size={10} className="shrink-0 opacity-0 group-hover:opacity-30"/>
                }
            </span>
        </th>
    );
};

export const MassAddModal: React.FC<MassAddModalProps> = memo(({
    selectedVariantsToApply,
    variantMap,
    machines,
    suppliers,
    onClose,
    onConfirm,
}) => {
    const [massAddSearch, setMassAddSearch] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
    const [machinePriceOverrides, setMachinePriceOverrides] = useState<Record<string, Record<string, number | ''>>>({});
    const [isBaseMap, setIsBaseMap] = useState<Record<string, boolean>>({});
    const [isConfirming, setIsConfirming] = useState(false);
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // State для уже добавленных станков
    const [existingPriceOverrides, setExistingPriceOverrides] = useState<Record<string, Record<string, number | ''>>>({});
    const [existingIsBaseMap, setExistingIsBaseMap] = useState<Record<string, boolean | undefined>>({});
    const [removedExistingIds, setRemovedExistingIds] = useState<Set<string>>(new Set());

    const firstVariant = variantMap.get(selectedVariantsToApply[0]);
    const targetCategoryId = firstVariant?.categoryId;
    const firstVariantTypeId = firstVariant?.typeId;

    const supplierMap = useMemo(() =>
        new Map(suppliers.map(s => [s.id, s])),
        [suppliers]
    );

    // Станки, у которых УЖЕ добавлены ВСЕ выбранные варианты
    const alreadyAddedMachines = useMemo(() =>
        machines.filter(p => {
            if (targetCategoryId && p.categoryId !== targetCategoryId) return false;
            const allAllowedVariantIds = (p.machineConfig || []).flatMap(c => c.allowedVariantIds || []);
            return selectedVariantsToApply.every(vId => allAllowedVariantIds.includes(vId));
        }),
        [machines, selectedVariantsToApply, targetCategoryId]
    );

    // Станки, у которых НЕТ хотя бы одного из выбранных вариантов (кандидаты для добавления)
    const candidateMachines = useMemo(() =>
        machines.filter(p => {
            if (targetCategoryId && p.categoryId !== targetCategoryId) return false;
            const allAllowedVariantIds = (p.machineConfig || []).flatMap(c => c.allowedVariantIds || []);
            return selectedVariantsToApply.some(vId => !allAllowedVariantIds.includes(vId));
        }),
        [machines, selectedVariantsToApply, targetCategoryId]
    );

    // Проверить, настроен ли тип опции для данного станка
    const isMachineTypeConfigured = (machine: Product) => {
        if (!firstVariantTypeId) return true;
        return (machine.machineConfig || []).some(c => c.typeId === firstVariantTypeId);
    };

    // Текущее значение isBase для уже добавленного станка (из machineConfig)
    const getExistingIsBase = (machine: Product): boolean => {
        if (!firstVariantTypeId) return false;
        const configGroup = (machine.machineConfig || []).find(c => c.typeId === firstVariantTypeId);
        if (!configGroup?.baseVariantIds) return false;
        return selectedVariantsToApply.some(vId => configGroup.baseVariantIds!.includes(vId));
    };

    const availableSuppliers = useMemo(() => {
        const allCandidates = [...candidateMachines, ...alreadyAddedMachines];
        const ids = new Set(allCandidates.map(m => m.supplierId).filter(Boolean) as string[]);
        return suppliers.filter(s => ids.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [candidateMachines, alreadyAddedMachines, suppliers]);

    const availableManufacturers = useMemo(() => {
        const allCandidates = [...candidateMachines, ...alreadyAddedMachines];
        const names = [...new Set(allCandidates.map(m => m.manufacturer).filter(Boolean) as string[])];
        return names.sort((a, b) => a.localeCompare(b, 'ru'));
    }, [candidateMachines, alreadyAddedMachines]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const applyFilters = (list: Product[]) => {
        return list.filter(p => {
            if (supplierFilter && p.supplierId !== supplierFilter) return false;
            if (manufacturerFilter && p.manufacturer !== manufacturerFilter) return false;
            const s = massAddSearch.toLowerCase();
            return !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
        });
    };

    const sortList = (list: Product[]) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            if (sortField === 'basePrice') return ((a.basePrice || 0) - (b.basePrice || 0)) * dir;
            if (sortField === 'salesPrice') return ((a.salesPrice || 0) - (b.salesPrice || 0)) * dir;
            return a.name.localeCompare(b.name, 'ru') * dir;
        });
    };

    const filteredCandidates = useMemo(() => sortList(applyFilters(candidateMachines)),
        [candidateMachines, massAddSearch, supplierFilter, manufacturerFilter, sortField, sortDir]);

    const filteredAlreadyAdded = useMemo(() => sortList(applyFilters(alreadyAddedMachines)),
        [alreadyAddedMachines, massAddSearch, supplierFilter, manufacturerFilter, sortField, sortDir]);

    const handleConfirm = async () => {
        const hasNewSelections = selectedMachines.length > 0;
        const hasExistingChanges = removedExistingIds.size > 0 ||
            Object.keys(existingPriceOverrides).length > 0 ||
            Object.keys(existingIsBaseMap).length > 0;
        if ((!hasNewSelections && !hasExistingChanges) || isConfirming) return;
        setIsConfirming(true);
        try {
            // Передаём только станки с реальными изменениями
            const existingUpdates: ExistingMachineUpdate[] = alreadyAddedMachines
                .filter(m =>
                    removedExistingIds.has(m.id) ||
                    Object.keys(existingPriceOverrides[m.id] || {}).length > 0 ||
                    existingIsBaseMap[m.id] !== undefined
                )
                .map(m => ({
                    machineId: m.id,
                    remove: removedExistingIds.has(m.id),
                    priceOverrides: existingPriceOverrides[m.id] || {},
                    isBase: existingIsBaseMap[m.id] !== undefined
                        ? !!existingIsBaseMap[m.id]
                        : getExistingIsBase(m),
                }));
            await onConfirm(selectedMachines, machinePriceOverrides, isBaseMap, existingUpdates);
        } finally {
            setIsConfirming(false);
        }
    };

    const toggleMachine = (mId: string) => {
        setSelectedMachines(prev =>
            prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
        );
    };

    const toggleAll = (checked: boolean) => {
        setSelectedMachines(checked ? filteredCandidates.map(m => m.id) : []);
    };

    const setPriceOverride = (mId: string, vId: string, val: number | '') => {
        setMachinePriceOverrides(prev => ({
            ...prev,
            [mId]: { ...(prev[mId] || {}), [vId]: val },
        }));
    };

    const setExistingPriceOverride = (mId: string, vId: string, val: number | '') => {
        setExistingPriceOverrides(prev => ({
            ...prev,
            [mId]: { ...(prev[mId] || {}), [vId]: val },
        }));
    };

    const toggleRemoveExisting = (mId: string) => {
        setRemovedExistingIds(prev => {
            const next = new Set(prev);
            if (next.has(mId)) next.delete(mId);
            else next.add(mId);
            return next;
        });
    };

    const toggleIsBase = (mId: string, current: boolean) => {
        setIsBaseMap(prev => ({ ...prev, [mId]: !current }));
    };

    const toggleExistingIsBase = (mId: string, currentValue: boolean) => {
        setExistingIsBaseMap(prev => ({ ...prev, [mId]: !currentValue }));
    };

    const variantCols = selectedVariantsToApply.length;
    const totalCols = 4 + variantCols + 2; // checkbox + name + закуп + продажа + variants + isBase + (empty for existing: действие)

    const MachineNameCell = ({ m, rowBg, onClick }: { m: Product; rowBg: string; onClick?: () => void }) => {
        const sup = supplierMap.get(m.supplierId || '');
        const typeConfigured = isMachineTypeConfigured(m);
        return (
            <td className="px-3 py-2.5 sticky left-10 z-10 cursor-pointer" style={{ background: rowBg }} onClick={onClick}>
                <div className="flex items-start gap-1.5">
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-700 leading-tight">{m.name}</div>
                        <div className="text-[9px] font-mono text-slate-400 uppercase">{m.sku}</div>
                        {(sup || m.manufacturer) && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                                {sup && <span className="text-[8px] font-bold text-indigo-500">{sup.name}</span>}
                                {sup && m.manufacturer && <span className="text-[8px] text-slate-300">·</span>}
                                {m.manufacturer && <span className="text-[8px] font-bold text-purple-500">{m.manufacturer}</span>}
                            </div>
                        )}
                    </div>
                    {!typeConfigured && (
                        <span title="Тип опции не был настроен для этого станка — будет создан автоматически" className="shrink-0 flex items-center gap-0.5 px-1 py-0.5 bg-amber-50 border border-amber-200 rounded text-[7px] font-black text-amber-600 uppercase">
                            <AlertTriangle size={8}/> новый тип
                        </span>
                    )}
                </div>
            </td>
        );
    };

    const PriceCells = ({ m }: { m: Product }) => (
        <>
            <td className="px-3 py-2.5 text-right">
                <div className="text-xs font-black text-slate-600 font-mono whitespace-nowrap">
                    {m.basePrice ? m.basePrice.toLocaleString('ru') : '—'}
                    {m.basePrice ? <span className="text-[9px] text-slate-400 ml-1">{m.currency}</span> : ''}
                </div>
            </td>
            <td className="px-3 py-2.5 text-right">
                <div className="text-xs font-black text-emerald-600 font-mono whitespace-nowrap">
                    {m.salesPrice ? m.salesPrice.toLocaleString('ru') : '—'}
                    {m.salesPrice ? <span className="text-[9px] text-emerald-400 ml-1">KZT</span> : ''}
                </div>
            </td>
        </>
    );

    const hasAnyChanges = selectedMachines.length > 0 || removedExistingIds.size > 0 ||
        Object.keys(existingPriceOverrides).some(k => Object.keys(existingPriceOverrides[k]).length > 0) ||
        Object.keys(existingIsBaseMap).length > 0;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b bg-slate-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Массовое добавление опций</h3>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                            Выбрано опций: <span className="text-blue-600">{selectedVariantsToApply.length}</span>. Отметьте станки и при необходимости скорректируйте цены.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <X size={20}/>
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-white border-b shrink-0 flex gap-3 items-center flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                            placeholder="Поиск по названию или артикулу..."
                            value={massAddSearch}
                            onChange={e => setMassAddSearch(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer text-slate-600 min-w-[160px]"
                            value={supplierFilter}
                            onChange={e => setSupplierFilter(e.target.value)}
                        >
                            <option value="">Все поставщики</option>
                            {availableSuppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer text-slate-600 min-w-[160px]"
                            value={manufacturerFilter}
                            onChange={e => setManufacturerFilter(e.target.value)}
                        >
                            <option value="">Все производители</option>
                            {availableManufacturers.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    </div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        Новых: {filteredCandidates.length} · Добавлено: {filteredAlreadyAdded.length}
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50/30">
                    <table className="w-full border-separate border-spacing-y-1.5 min-w-max">
                        <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-3 py-2 text-left w-10 sticky left-0 bg-slate-50/90 z-10">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300"
                                        checked={selectedMachines.length === filteredCandidates.length && filteredCandidates.length > 0}
                                        onChange={e => toggleAll(e.target.checked)}
                                    />
                                </th>
                                <SortTh field="name" current={sortField} dir={sortDir} onSort={handleSort} className="px-3 py-2 text-left min-w-[220px] sticky left-10 bg-slate-50/90 z-10">Станок</SortTh>
                                <SortTh field="basePrice" current={sortField} dir={sortDir} onSort={handleSort} className="px-3 py-2 text-right min-w-[100px]">Закуп</SortTh>
                                <SortTh field="salesPrice" current={sortField} dir={sortDir} onSort={handleSort} className="px-3 py-2 text-right min-w-[100px]">Продажа</SortTh>
                                {selectedVariantsToApply.map(vId => {
                                    const v = variantMap.get(vId);
                                    return (
                                        <th key={vId} className="px-3 py-2 text-center min-w-[120px]">
                                            <div className="font-black text-slate-600 truncate max-w-[110px]">{v?.name}</div>
                                            <div className="font-mono text-slate-400 text-[8px] normal-case">{v?.price.toLocaleString()} {v?.currency}</div>
                                        </th>
                                    );
                                })}
                                <th className="px-3 py-2 text-center min-w-[60px]">
                                    <span className="flex items-center justify-center gap-1"><Star size={9}/> В базе</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ── Кандидаты (новые) ── */}
                            {filteredCandidates.map(m => {
                                const isSelected = selectedMachines.includes(m.id);
                                const rowBg = isSelected ? 'rgb(239 246 255 / 0.9)' : 'white';
                                const currentIsBase = !!isBaseMap[m.id];
                                return (
                                    <tr key={m.id} className={`transition-all ${isSelected ? 'bg-blue-50/70' : 'bg-white hover:bg-slate-50/70'} shadow-sm`}>
                                        <td className="px-3 py-2.5 rounded-l-xl sticky left-0 z-10" style={{ background: rowBg }}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => toggleMachine(m.id)}
                                            />
                                        </td>
                                        <MachineNameCell m={m} rowBg={rowBg} onClick={() => toggleMachine(m.id)}/>
                                        <PriceCells m={m}/>
                                        {selectedVariantsToApply.map(vId => {
                                            const v = variantMap.get(vId);
                                            const currentVal = machinePriceOverrides[m.id]?.[vId];
                                            const displayVal = currentVal !== undefined ? currentVal : (v?.price ?? '');
                                            const isModified = currentVal !== undefined && currentVal !== v?.price;
                                            return (
                                                <td key={vId} className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        className={`w-24 px-2 py-1.5 rounded-lg text-xs font-black text-right outline-none border transition-all ${isModified ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}
                                                        value={displayVal}
                                                        onChange={e => {
                                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                                                            setPriceOverride(m.id, vId, val);
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}
                                        {/* В базе */}
                                        <td className="px-3 py-2.5 text-center rounded-r-xl" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => toggleIsBase(m.id, currentIsBase)}
                                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all mx-auto ${currentIsBase ? 'border-amber-400 bg-amber-100 text-amber-600' : 'border-slate-200 text-transparent hover:border-amber-300'}`}
                                            >
                                                <Star size={14} className={currentIsBase ? 'fill-amber-500' : ''}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredCandidates.length === 0 && filteredAlreadyAdded.length === 0 && (
                                <tr>
                                    <td colSpan={totalCols} className="py-16 text-center text-slate-400 italic font-medium">
                                        Станки не найдены
                                    </td>
                                </tr>
                            )}

                            {/* ── Разделитель «Уже добавлены» ── */}
                            {filteredAlreadyAdded.length > 0 && (
                                <tr>
                                    <td colSpan={totalCols} className="pt-4 pb-1 px-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-px flex-1 bg-emerald-200"/>
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                                                <Check size={10}/> Уже добавлены ({filteredAlreadyAdded.length})
                                            </span>
                                            <div className="h-px flex-1 bg-emerald-200"/>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {/* ── Уже добавленные станки ── */}
                            {filteredAlreadyAdded.map(m => {
                                const isRemoved = removedExistingIds.has(m.id);
                                const rowBg = isRemoved ? 'rgb(254 242 242)' : 'rgb(240 253 244)';
                                const currentIsBase = existingIsBaseMap[m.id] !== undefined
                                    ? !!existingIsBaseMap[m.id]
                                    : getExistingIsBase(m);
                                return (
                                    <tr key={m.id} className={`shadow-sm transition-all ${isRemoved ? 'opacity-60' : ''}`} style={{ background: rowBg }}>
                                        {/* Действие: отключить */}
                                        <td className="px-3 py-2.5 rounded-l-xl sticky left-0 z-10" style={{ background: rowBg }}>
                                            <button
                                                onClick={() => toggleRemoveExisting(m.id)}
                                                title={isRemoved ? 'Отменить отключение' : 'Отключить опцию'}
                                                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all mx-auto ${isRemoved ? 'border-red-400 bg-red-100 text-red-600' : 'border-emerald-300 bg-white text-emerald-600 hover:border-red-300 hover:text-red-500'}`}
                                            >
                                                {isRemoved ? <ArrowRight size={12}/> : <Minus size={12}/>}
                                            </button>
                                        </td>
                                        <MachineNameCell m={m} rowBg={rowBg}/>
                                        <PriceCells m={m}/>
                                        {selectedVariantsToApply.map(vId => {
                                            const v = variantMap.get(vId);
                                            // Текущая цена из machineConfig
                                            const typeConf = (m.machineConfig || []).find(c => c.typeId === firstVariantTypeId);
                                            const existingPrice = typeConf?.priceOverrides?.[vId];
                                            const currentVal = existingPriceOverrides[m.id]?.[vId];
                                            const displayVal = currentVal !== undefined ? currentVal : (existingPrice ?? v?.price ?? '');
                                            const isModified = currentVal !== undefined;
                                            return (
                                                <td key={vId} className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        disabled={isRemoved}
                                                        className={`w-24 px-2 py-1.5 rounded-lg text-xs font-black text-right outline-none border transition-all ${isRemoved ? 'opacity-40 cursor-not-allowed bg-slate-50' : isModified ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}
                                                        value={displayVal}
                                                        onChange={e => {
                                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                                                            setExistingPriceOverride(m.id, vId, val);
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}
                                        {/* В базе */}
                                        <td className="px-3 py-2.5 text-center rounded-r-xl" onClick={e => e.stopPropagation()}>
                                            <button
                                                disabled={isRemoved}
                                                onClick={() => toggleExistingIsBase(m.id, currentIsBase)}
                                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all mx-auto ${isRemoved ? 'opacity-40 cursor-not-allowed' : ''} ${currentIsBase ? 'border-amber-400 bg-amber-100 text-amber-600' : 'border-slate-200 bg-white text-transparent hover:border-amber-300'}`}
                                            >
                                                <Star size={14} className={currentIsBase ? 'fill-amber-500' : ''}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-5 border-t bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="text-xs font-bold text-slate-500 space-y-0.5">
                        <div>
                            Добавить к: <span className="text-blue-600">{selectedMachines.length}</span> станкам
                            {removedExistingIds.size > 0 && <> · Отключить: <span className="text-red-500">{removedExistingIds.size}</span></>}
                        </div>
                        <div className="text-[10px] text-slate-400 italic flex gap-3">
                            <span>★ = «В базе» · Синий = изменённая цена</span>
                            <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={9}/> новый тип = тип опции будет создан автоматически</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">
                            Отмена
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!hasAnyChanges || isConfirming}
                            className="px-10 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                        >
                            <Check size={16}/> Применить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

MassAddModal.displayName = 'MassAddModal';
