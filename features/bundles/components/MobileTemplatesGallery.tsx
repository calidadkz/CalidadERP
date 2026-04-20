
import React, { useMemo, useState } from 'react';
import {
    AlignLeft, Box, ChevronDown, ChevronRight, ChevronUp,
    ClipboardList, Copy, Download, Filter, Pencil, RotateCcw,
    Search, Star, Trash2, X, Monitor
} from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Bundle, Product, ProductType } from '@/types';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { BundleExporter } from '@/services/BundleExporter';

interface Props {
    onLoad: (b: Bundle) => void;
}

// ─── Compact dimensions info ──────────────────────────────────────────────────

const CompactDimensions: React.FC<{ bundle: Bundle; products: Product[]; optionVariants: any[] }> = ({ bundle, products, optionVariants }) => {
    const baseProduct = products.find(p => p.id === bundle.baseProductId);
    if (!baseProduct) return null;

    const basePackages = baseProduct.packages || [];
    const baseVolume = basePackages.reduce((sum, p) => sum + (p.volumeM3 || 0), 0);
    const optionsVolume = bundle.selectedVariantIds
        .map(vid => optionVariants.find(ov => ov.id === vid))
        .filter(ov => ov && (ov.volumeM3 || 0) > 0)
        .reduce((sum, ov) => sum + (ov!.volumeM3 || 0), 0);
    const totalVolume = baseVolume + optionsVolume;

    const hasWorkingDims = (baseProduct.workingLengthMm || 0) > 0 || (baseProduct.workingWidthMm || 0) > 0;

    if (totalVolume === 0 && !hasWorkingDims) return null;

    return (
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
            {totalVolume > 0 && (
                <span className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Объём:</span>
                    <span className="font-black text-slate-700">{totalVolume.toFixed(2)} м³</span>
                </span>
            )}
            {hasWorkingDims && (
                <span className="flex items-center gap-1 text-[10px]">
                    <Monitor size={11} className="text-slate-300" />
                    <span>{baseProduct.workingLengthMm || 0}×{baseProduct.workingWidthMm || 0}×{baseProduct.workingHeightMm || 0}</span>
                </span>
            )}
        </div>
    );
};

// ─── FilterSheet ──────────────────────────────────────────────────────────────

const FilterSheet: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    machines: Product[];
    machineId: string;
    priceMin: string;
    priceMax: string;
    onMachineChange: (id: string) => void;
    onPriceMinChange: (v: string) => void;
    onPriceMaxChange: (v: string) => void;
    onReset: () => void;
    activeCount: number;
}> = ({ isOpen, onClose, machines, machineId, priceMin, priceMax, onMachineChange, onPriceMinChange, onPriceMaxChange, onReset, activeCount }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end bg-slate-900/60">
            <div className="bg-white rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '80dvh' }}>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-none">
                    <span className="text-base font-black text-slate-800 flex-1">Фильтры</span>
                    {activeCount > 0 && (
                        <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-red-500 font-bold px-3 py-1.5 rounded-xl hover:bg-red-50">
                            <RotateCcw size={14} /> Сбросить
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* Базовая модель */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Базовая модель</label>
                        <div className="space-y-1">
                            <button
                                onClick={() => onMachineChange('')}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${!machineId ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                Все модели
                                {!machineId && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-lg">✓</span>}
                            </button>
                            {machines.map(p => (
                                <button key={p.id}
                                    onClick={() => onMachineChange(p.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${machineId === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    <span className="truncate text-left flex-1">{p.name}</span>
                                    {machineId === p.id && <span className="ml-2 text-xs font-bold bg-white/20 px-2 py-0.5 rounded-lg flex-none">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Диапазон цены */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Диапазон цены (₸)</label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₸</span>
                                <input type="number" inputMode="numeric"
                                    className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium outline-none focus:ring-2 ring-blue-500/20 text-slate-800"
                                    placeholder="От" value={priceMin} onChange={e => onPriceMinChange(e.target.value)} />
                            </div>
                            <span className="text-slate-300 font-bold">—</span>
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₸</span>
                                <input type="number" inputMode="numeric"
                                    className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium outline-none focus:ring-2 ring-blue-500/20 text-slate-800"
                                    placeholder="До" value={priceMax} onChange={e => onPriceMaxChange(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="h-2" />
                </div>
                <div className="flex-none px-5 pb-6 pt-3 border-t border-slate-100">
                    <button onClick={onClose}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest">
                        Применить
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── DeleteConfirm ────────────────────────────────────────────────────────────

const DeleteConfirm: React.FC<{
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ name, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[400] flex flex-col justify-end bg-slate-900/60">
        <div className="bg-white rounded-t-3xl px-5 py-6 space-y-4">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-none">
                    <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                    <div className="font-black text-slate-800 text-base">Удалить шаблон?</div>
                    <div className="text-sm text-slate-500 mt-0.5 leading-snug">«{name}»</div>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm">Отмена</button>
                <button onClick={onConfirm} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-bold text-sm">Удалить</button>
            </div>
        </div>
    </div>
);

// ─── BundleCard ───────────────────────────────────────────────────────────────

const BundleCard: React.FC<{
    bundle: Bundle;
    products: Product[];
    optionVariants: any[];
    showName: boolean;
    showBaseModel: boolean;
    showComposition: boolean;
    showPrice: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onCopyOur: () => void;
    onCopySupplier: () => void;
    onExport: () => void;
    f: (n: number) => string;
}> = ({ bundle: b, products, optionVariants, showName, showBaseModel, showComposition, showPrice, canEdit, canDelete, onEdit, onDelete, onCopyOur, onCopySupplier, onExport, f }) => {
    const [descOpen, setDescOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 space-y-2.5">

                {/* Строка 1: название модели + действия */}
                <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                        {showBaseModel && (
                            <div className="font-black text-slate-800 text-sm leading-tight">{b.baseProductName}</div>
                        )}
                        {showName && b.name && (
                            <div className="text-xs text-slate-400 italic mt-0.5">«{b.name}»</div>
                        )}
                    </div>
                    {/* Иконки действий */}
                    <div className="flex items-center gap-0.5 flex-none -mr-1">
                        <button onClick={onCopyOur} title="Наши названия"
                            className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                            <Copy size={15} />
                        </button>
                        <button onClick={onCopySupplier} title="Для поставщика"
                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                            <ClipboardList size={15} />
                        </button>
                        <button onClick={onExport} title="Экспорт CSV"
                            className="p-2 text-slate-300 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all">
                            <Download size={15} />
                        </button>
                        {canDelete && (
                            <button onClick={onDelete}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Строка 2: чипы вариантов */}
                {showComposition && b.selectedVariantIds.length > 0 && (
                    <div className="overflow-x-auto -mx-4 px-4">
                        <div className="flex gap-1.5 w-max pb-0.5">
                            {b.selectedVariantIds.map(vid => {
                                const v = optionVariants.find(ov => ov.id === vid);
                                return v ? (
                                    <span key={vid} className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg border border-blue-100 whitespace-nowrap">
                                        {v.name}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    </div>
                )}

                {/* Строка 3: габариты */}
                <CompactDimensions bundle={b} products={products} optionVariants={optionVariants} />

                {/* Строка 4: описание (раскрываемое) */}
                {b.description && (
                    <div>
                        <button
                            onClick={() => setDescOpen(v => !v)}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 py-0.5">
                            <AlignLeft size={12} />
                            <span className="font-semibold">Описание</span>
                            {descOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {descOpen && (
                            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed italic bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 whitespace-pre-wrap">
                                {b.description}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Нижняя полоса: цена + кнопка Изменить */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Цена продажи</div>
                    {showPrice ? (
                        <div className="text-base font-black text-slate-900 font-mono">{f(b.totalPrice)} <span className="text-xs font-normal">₸</span></div>
                    ) : (
                        <div className="text-xs font-bold text-slate-300 italic">Скрыто</div>
                    )}
                </div>
                {canEdit && (
                    <button onClick={onEdit}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all">
                        <Pencil size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── MobileTemplatesGallery ───────────────────────────────────────────────────

export const MobileTemplatesGallery: React.FC<Props> = ({ onLoad }) => {
    const { state, actions } = useStore();
    const access = useAccess('bundles');
    const { bundles, products, optionVariants, optionTypes } = state;

    const canDelete = access.canWrite('actions', 'delete_template');
    const canEdit = access.canSee('actions', 'edit_template');
    const showName = access.canSee('fields', 'col_name');
    const showBaseModel = access.canSee('fields', 'col_base_model');
    const showComposition = access.canSee('fields', 'col_composition');
    const showPrice = access.canSee('fields', 'col_price');

    const [search, setSearch] = useState('');
    const [machineId, setMachineId] = useState('');
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');

    const [showFilters, setShowFilters] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);
    const [copyToast, setCopyToast] = useState<string | null>(null);

    const machines = useMemo(() =>
        products.filter(p => p.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [products]
    );

    const activeFilterCount = [machineId, priceMin, priceMax].filter(Boolean).length;

    const filtered = useMemo(() => bundles.filter(b => {
        if (!b.isTemplate) return false;
        const q = search.toLowerCase();
        const optionNames = b.selectedVariantIds.map(vid => optionVariants.find(ov => ov.id === vid)?.name?.toLowerCase() || '').join(' ');
        const matchSearch = !q || b.name?.toLowerCase().includes(q) || b.baseProductName.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q) || optionNames.includes(q);
        const matchMachine = !machineId || b.baseProductId === machineId;
        const min = priceMin ? parseFloat(priceMin) : 0;
        const max = priceMax ? parseFloat(priceMax) : Infinity;
        const matchPrice = b.totalPrice >= min && b.totalPrice <= max;
        return matchSearch && matchMachine && matchPrice;
    }), [bundles, search, machineId, priceMin, priceMax, optionVariants]);

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const showCopyToast = (msg: string) => {
        setCopyToast(msg);
        setTimeout(() => setCopyToast(null), 1800);
    };

    const handleCopyOur = (b: Bundle) => {
        const variants = b.selectedVariantIds.map(vid => optionVariants.find(ov => ov.id === vid)?.name).filter(Boolean) as string[];
        navigator.clipboard.writeText([b.baseProductName, ...variants].join(', '));
        showCopyToast('Скопировано (наши названия)');
    };

    const handleCopySupplier = (b: Bundle) => {
        const baseProd = products.find(p => p.id === b.baseProductId);
        const base = baseProd?.supplierProductName || b.baseProductName;
        const variants = b.selectedVariantIds.map(vid => {
            const ov = optionVariants.find(o => o.id === vid);
            return ov?.supplierProductName || ov?.name;
        }).filter(Boolean) as string[];
        navigator.clipboard.writeText([base, ...variants].join(', '));
        showCopyToast('Скопировано (для поставщика)');
    };

    const handleExport = (b: Bundle) => {
        BundleExporter.exportToCsv(
            { name: b.name, baseProductId: b.baseProductId, selectedVariantIds: b.selectedVariantIds, totalPrice: b.totalPrice, description: b.description },
            products, optionVariants, optionTypes,
            (module, sub, id, msg) => actions.addLog(module, sub, id, msg)
        );
    };

    const handleReset = () => {
        setSearch('');
        setMachineId('');
        setPriceMin('');
        setPriceMax('');
    };

    return (
        <>
            {/* FilterSheet */}
            <FilterSheet
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                machines={machines}
                machineId={machineId}
                priceMin={priceMin}
                priceMax={priceMax}
                onMachineChange={setMachineId}
                onPriceMinChange={setPriceMin}
                onPriceMaxChange={setPriceMax}
                onReset={handleReset}
                activeCount={activeFilterCount}
            />

            {/* DeleteConfirm */}
            {deleteTarget && (
                <DeleteConfirm
                    name={deleteTarget.name || deleteTarget.baseProductName}
                    onConfirm={() => { actions.deleteBundle(deleteTarget.id); setDeleteTarget(null); }}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {/* CopyToast */}
            {copyToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-lg whitespace-nowrap pointer-events-none">
                    {copyToast}
                </div>
            )}

            <div className="flex flex-col h-full bg-slate-100 overflow-hidden">

                {/* Поисковая строка + кнопка фильтров */}
                <div className="flex-none bg-white px-4 py-3 border-b border-slate-200 flex gap-2 items-center">
                    <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                        <Search size={15} className="text-slate-400 flex-none" />
                        <input
                            type="text"
                            className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                            placeholder="Поиск по шаблонам..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
                    </div>
                    <button
                        onClick={() => setShowFilters(true)}
                        className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border font-semibold text-sm transition-all ${activeFilterCount > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <Filter size={15} />
                        Фильтры
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Счётчик + сброс активных фильтров */}
                {(activeFilterCount > 0 || search) && (
                    <div className="flex-none flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <span className="text-xs font-bold text-blue-600">
                            {filtered.length} {filtered.length === 1 ? 'шаблон' : filtered.length < 5 ? 'шаблона' : 'шаблонов'}
                        </span>
                        <button onClick={handleReset} className="flex items-center gap-1.5 text-xs font-bold text-blue-500">
                            <RotateCcw size={12} /> Сбросить всё
                        </button>
                    </div>
                )}

                {/* Список карточек */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Star size={40} className="mb-3 text-slate-200" />
                            <p className="text-sm font-bold">Шаблоны не найдены</p>
                            {(search || activeFilterCount > 0) && (
                                <button onClick={handleReset} className="mt-3 text-sm text-blue-500 font-bold flex items-center gap-1.5">
                                    <RotateCcw size={13} /> Сбросить фильтры
                                </button>
                            )}
                        </div>
                    ) : (
                        filtered.map(b => (
                            <BundleCard
                                key={b.id}
                                bundle={b}
                                products={products}
                                optionVariants={optionVariants}
                                showName={showName}
                                showBaseModel={showBaseModel}
                                showComposition={showComposition}
                                showPrice={showPrice}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                onEdit={() => onLoad(b)}
                                onDelete={() => setDeleteTarget(b)}
                                onCopyOur={() => handleCopyOur(b)}
                                onCopySupplier={() => handleCopySupplier(b)}
                                onExport={() => handleExport(b)}
                                f={f}
                            />
                        ))
                    )}
                    <div className="h-2" />
                </div>
            </div>
        </>
    );
};
