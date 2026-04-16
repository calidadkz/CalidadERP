
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Calculator, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight,
    Circle, ClipboardList, Copy, Download, Factory, Loader2, PieChart, Save,
    Search, Settings, ShieldCheck, Star, Tag, Truck, X, ListFilter
} from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Bundle, Currency, MachineConfigEntry, OptionType, OptionVariant, Product, ProductType } from '@/types';
import { useBundleConfigurator } from '@/features/bundles/hooks/useBundleConfigurator';
import { BundleCalculator } from '@/services/BundleCalculator';
import { BundleExporter } from '@/services/BundleExporter';
import { PricingService } from '@/services/PricingService';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    onSaved: () => void;
    editingBundle?: Bundle | null;
}

// ─── SearchOverlay ────────────────────────────────────────────────────────────

const SearchOverlay: React.FC<{
    title: string;
    items: { id: string; label: string; sub?: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
    allowEmpty?: boolean;
    emptyLabel?: string;
}> = ({ title, items, selectedId, onSelect, onClose, allowEmpty = true, emptyLabel = '— Все —' }) => {
    const [q, setQ] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

    const filtered = useMemo(() =>
        items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase()) || i.sub?.toLowerCase().includes(q.toLowerCase())),
        [items, q]
    );

    return (
        <div className="fixed inset-0 z-[500] flex flex-col bg-white">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={20} /></button>
                <span className="text-base font-bold text-slate-700 flex-1 truncate">{title}</span>
            </div>
            <div className="px-4 py-3 border-b border-slate-100 flex-none">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                    <Search size={15} className="text-slate-400 flex-none" />
                    <input ref={inputRef} type="text" className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Поиск..." value={q} onChange={e => setQ(e.target.value)} />
                    {q && <button onClick={() => setQ('')}><X size={14} className="text-slate-400" /></button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {allowEmpty && (
                    <button onClick={() => { onSelect(''); onClose(); }}
                        className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${!selectedId ? 'bg-blue-50' : ''}`}>
                        <span className={`text-base ${!selectedId ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>{emptyLabel}</span>
                        {!selectedId && <Check size={16} className="ml-auto text-blue-600" />}
                    </button>
                )}
                {filtered.map(item => (
                    <button key={item.id} onClick={() => { onSelect(item.id); onClose(); }}
                        className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${selectedId === item.id ? 'bg-blue-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                            <div className={`text-base font-medium leading-tight ${selectedId === item.id ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>{item.label}</div>
                            {item.sub && <div className="text-sm text-slate-400 mt-0.5">{item.sub}</div>}
                        </div>
                        {selectedId === item.id && <Check size={16} className="flex-none text-blue-600" />}
                    </button>
                ))}
                {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Ничего не найдено</div>}
            </div>
        </div>
    );
};

// ─── OptionVariantCard ────────────────────────────────────────────────────────

const OptionVariantCard: React.FC<{
    type: OptionType;
    v: OptionVariant;
    machine: Product;
    configEntry: MachineConfigEntry | undefined;
    selectedVars: string[];
    exchangeRates: Record<Currency, number>;
    showPrice: boolean;
    onToggle: () => void;
    f: (n: number) => string;
}> = ({ type, v, machine, configEntry, selectedVars, showPrice, onToggle, f }) => {
    const isSelected = selectedVars.includes(v.id);
    const isDefault = BundleCalculator.getDefaultIds(configEntry).includes(v.id);
    const price = configEntry?.priceOverrides?.[v.id] ?? v.price;

    return (
        <button onClick={onToggle}
            className={`w-full text-left p-3 rounded-xl border-2 transition-all flex flex-col gap-1.5 ${isSelected
                ? 'border-blue-500 bg-blue-50/60 shadow-sm shadow-blue-100'
                : 'border-slate-200 bg-white active:border-blue-300'}`}>
            <div className="flex items-start justify-between gap-1.5">
                <span className={`text-sm font-bold leading-tight flex-1 ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{v.name}</span>
                {isSelected
                    ? <CheckCircle size={16} className="text-blue-500 flex-none mt-0.5" />
                    : <Circle size={16} className="text-slate-200 flex-none mt-0.5" />}
            </div>
            {showPrice && (
                <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-mono font-bold ${isDefault ? 'text-blue-500' : 'text-slate-400'}`}>
                            {f(price)} {v.currency}
                        </span>
                        {isDefault && (
                            <span className="bg-blue-100 text-blue-500 px-1 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                                <Star size={6} fill="currentColor" /> База
                            </span>
                        )}
                    </div>
                    {v.volumeM3 > 0 && (
                        <span className="text-[10px] text-blue-400 font-bold">+{v.volumeM3.toFixed(2)}м³</span>
                    )}
                </div>
            )}
        </button>
    );
};

// ─── DetailRow ────────────────────────────────────────────────────────────────

const DetailRow = ({ label, value, bold = false, color = 'text-slate-200' }: { label: string; value: number; bold?: boolean; color?: string }) => (
    <div className="flex justify-between items-center">
        <span className="text-sm text-slate-400 truncate pr-2">{label}</span>
        <span className={`text-sm font-mono ${bold ? 'font-black' : 'font-semibold'} ${color} whitespace-nowrap`}>
            {Math.round(value).toLocaleString()} ₸
        </span>
    </div>
);

// ─── EconomySheet ─────────────────────────────────────────────────────────────

const EconomySheet: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    machine: Product;
    economy: any;
    showEconomy: boolean;
    userMargin: number | null;
    defaultMargin: number | null;
    bundleName: string;
    bundleDescription: string;
    canSave: boolean;
    isSaving: boolean;
    onMarginChange: (v: number | null) => void;
    onNameChange: (v: string) => void;
    onDescChange: (v: string) => void;
    onSave: () => void;
    onExport: () => void;
    editingBundle?: Bundle | null;
    f: (n: number) => string;
}> = ({
    isOpen, onClose, machine, economy, showEconomy, userMargin, defaultMargin,
    bundleName, bundleDescription, canSave, isSaving,
    onMarginChange, onNameChange, onDescChange, onSave, onExport, editingBundle, f
}) => {
    const [expensesOpen, setExpensesOpen] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end bg-slate-900/60">
            <div className="bg-slate-900 rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '92dvh' }}>

                {/* Drag handle */}
                <div className="flex-none flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-white/20 rounded-full" />
                </div>

                {/* Тёмная шапка с ценой */}
                <div className="flex-none px-5 py-4 relative">
                    <button onClick={onClose} className="absolute top-3 right-4 p-2 text-slate-400 hover:text-white rounded-xl">
                        <X size={20} />
                    </button>
                    <button onClick={onExport} className="absolute top-3 right-14 p-2 text-slate-400 hover:text-white rounded-xl" title="Скачать CSV">
                        <Download size={18} />
                    </button>

                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Итоговая цена продажи</div>
                    <div className="text-3xl font-black font-mono text-white tracking-tight">
                        {f(economy?.data?.finalPrice || 0)} <span className="text-[16px] font-medium text-blue-400">KZT</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white/5 rounded-xl py-2">
                            <div className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Объём</div>
                            <div className="text-sm font-black font-mono text-white">
                                {economy?.totalVolume?.toFixed(2)} <span className="text-[9px] text-slate-400">м³</span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl py-2">
                            <div className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">База</div>
                            <div className="text-sm font-black font-mono text-cyan-300">
                                {f(machine.basePrice)} <span className="text-[9px] text-cyan-600">{machine.currency}</span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl py-2">
                            <div className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Итого</div>
                            <div className="text-sm font-black font-mono text-amber-300">
                                {f(economy?.purchaseForeign || 0)} <span className="text-[9px] text-amber-600">{machine.currency}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Скроллируемое тело */}
                <div className="flex-1 overflow-y-auto bg-slate-800">
                    <div className="px-5 py-4 space-y-4">

                        {/* Экономика */}
                        {showEconomy && economy && (
                            <div className="space-y-3">
                                {/* Профиль + маржа */}
                                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                                    <ShieldCheck size={16} className="text-blue-400 flex-none" />
                                    <span className="text-sm font-bold text-slate-200 flex-1 truncate">
                                        {economy.profile?.name || 'Ручная наценка'}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-none">
                                        <input
                                            type="number"
                                            className="w-16 bg-white/10 border border-white/10 rounded-lg text-center text-sm font-black text-white p-1.5 outline-none focus:ring-2 ring-blue-500/30 text-[15px]"
                                            value={userMargin ?? ''}
                                            onChange={e => onMarginChange(e.target.value ? parseFloat(e.target.value) : null)}
                                            placeholder={`${defaultMargin ?? 0}`}
                                        />
                                        <span className="text-sm text-slate-400 font-bold">%</span>
                                    </div>
                                </div>

                                {/* Расходы (сворачиваемые) */}
                                <button
                                    onClick={() => setExpensesOpen(v => !v)}
                                    className="w-full flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                                    <span className="text-sm font-bold text-slate-300">Детализация расходов</span>
                                    {expensesOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                                </button>

                                {expensesOpen && (
                                    <div className="bg-white/5 rounded-xl px-4 py-3 space-y-2.5">
                                        <div className="border-l-2 border-blue-500 pl-3 space-y-2">
                                            <DetailRow label="Цена закупки (KZT)" value={economy.data.purchaseKzt} bold color="text-white" />
                                            <DetailRow label="Логистика (Китай)" value={economy.data.logisticsCn} />
                                            <DetailRow label="Логистика (Местная)" value={economy.data.logisticsLocal} />
                                        </div>
                                        <div className="border-l-2 border-orange-500 pl-3 space-y-2">
                                            <DetailRow label="Склад / Терминал" value={economy.data.svh} />
                                            <DetailRow label="Таможня + Брокер" value={economy.data.customsFees + economy.data.brokerFees} />
                                        </div>
                                        <div className="border-l-2 border-purple-500 pl-3 space-y-2">
                                            <DetailRow label="Пусконаладка" value={economy.data.pnr} />
                                            <DetailRow label="Доставка клиенту" value={economy.data.deliveryLocal} />
                                            <DetailRow label="Бонус продаж" value={economy.data.bonus} color="text-purple-300" />
                                        </div>
                                        <div className="border-l-2 border-red-500 pl-3 space-y-2">
                                            <DetailRow label={`НДС (${economy.profile?.vatRate || 12}%)`} value={economy.data.vat} />
                                            <DetailRow label={`КПН (${economy.profile?.citRate || 20}%)`} value={economy.data.cit} />
                                        </div>
                                        <div className="pt-2 border-t border-white/10">
                                            <DetailRow label="Всего расходов" value={economy.data.totalExpenses} bold color="text-slate-100" />
                                        </div>
                                    </div>
                                )}

                                {/* Прибыль */}
                                <div className="flex items-center justify-between bg-emerald-900/40 border border-emerald-700/30 rounded-xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <PieChart size={16} className="text-emerald-400" />
                                        <span className="text-sm font-bold text-emerald-300">Прибыль</span>
                                    </div>
                                    <span className="text-base font-black font-mono text-emerald-300">
                                        +{f(economy.data.netProfit)} ₸
                                    </span>
                                </div>
                            </div>
                        )}

                        {!showEconomy && (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-600 opacity-40">
                                <ShieldCheck size={32} className="mb-2" />
                                <p className="text-xs font-black uppercase tracking-widest">Экономика скрыта</p>
                            </div>
                        )}

                        {/* Название и описание */}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <Tag size={10} /> Название сборки <span className="normal-case font-normal text-slate-600">(необязательно)</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white font-medium placeholder:text-slate-600 outline-none focus:ring-2 ring-blue-500/30"
                                    placeholder="Название комплектации..."
                                    value={bundleName}
                                    onChange={e => onNameChange(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Описание</label>
                                <textarea
                                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white font-medium placeholder:text-slate-600 outline-none focus:ring-2 ring-blue-500/30 resize-none h-20"
                                    placeholder="Особенности сборки..."
                                    value={bundleDescription}
                                    onChange={e => onDescChange(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Нижний отступ для кнопки */}
                        <div className="h-2" />
                    </div>
                </div>

                {/* Кнопка сохранить — fixed внизу */}
                {canSave && (
                    <div className="flex-none bg-slate-800 px-5 pb-6 pt-3 border-t border-white/5">
                        <button
                            onClick={onSave}
                            disabled={isSaving}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                            {isSaving
                                ? <><Loader2 size={16} className="animate-spin" /> Сохранение...</>
                                : <><Save size={16} /> {editingBundle ? 'Обновить шаблон' : 'Сохранить шаблон'}</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── MobileConfiguratorBuilder ────────────────────────────────────────────────

export const MobileConfiguratorBuilder: React.FC<Props> = ({ onSaved, editingBundle }) => {
    const { state, actions } = useStore();
    const access = useAccess('bundles');
    const { products, optionTypes, optionVariants, exchangeRates, pricingProfiles, categories, suppliers = [] } = state;
    const config = useBundleConfigurator();

    const canSave = access.canWrite('actions', 'save_template');
    const showEconomy = access.canSee('fields', 'economy_details');
    const showOptionPrice = access.canSee('fields', 'option_purchase_price');

    // ── Фильтры выбора модели ──
    const [filterOverlay, setFilterOverlay] = useState<'category' | 'supplier' | 'manufacturer' | null>(null);
    const [supplierFilterId, setSupplierFilterId] = useState('');
    const [manufacturerFilter, setManufacturerFilter] = useState('');

    // ── Поиск модели ──
    const [modelSearch, setModelSearch] = useState('');

    // ── UI состояния ──
    const [showEconomySheet, setShowEconomySheet] = useState(false);
    const [copyToast, setCopyToast] = useState<string | null>(null);
    const [userMargin, setUserMargin] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const machine = products.find(p => p.id === config.baseMachineId);

    // ── Инициализация при редактировании ──
    useEffect(() => {
        if (editingBundle) {
            const baseProd = products.find(p => p.id === editingBundle.baseProductId);
            if (baseProd?.categoryId) config.setCategoryId(baseProd.categoryId);
            config.setBaseMachineId(editingBundle.baseProductId);
            config.setBundleName(editingBundle.name);
            config.setBundleDescription(editingBundle.description || '');
            const restoredOptions: Record<string, string[]> = {};
            editingBundle.selectedVariantIds.forEach(vid => {
                const variant = optionVariants.find(v => v.id === vid);
                if (variant) {
                    if (!restoredOptions[variant.typeId]) restoredOptions[variant.typeId] = [];
                    restoredOptions[variant.typeId].push(vid);
                }
            });
            config.setSelectedOptions(restoredOptions);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingBundle]);

    // ── Дефолтные опции при выборе станка ──
    useEffect(() => {
        if (machine && machine.machineConfig && !editingBundle) {
            const defaults: Record<string, string[]> = {};
            const allTypeIds: string[] = [];
            machine.machineConfig.forEach(c => {
                allTypeIds.push(c.typeId);
                const defaultIds = BundleCalculator.getDefaultIds(c);
                if (defaultIds.length > 0) defaults[c.typeId] = defaultIds;
            });
            config.setSelectedOptions(defaults);
            config.setExpandedTypeIds(allTypeIds);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machine?.id]);

    useEffect(() => { setUserMargin(null); }, [machine?.id]);

    // ── Derived ──

    const machineCategories = useMemo(() =>
        categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories]
    );

    const availableSuppliers = useMemo(() => {
        const ids = new Set(products.filter(p => p.type === ProductType.MACHINE).map(p => p.supplierId).filter(Boolean));
        return suppliers.filter(s => ids.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [products, suppliers]);

    const availableManufacturers = useMemo(() =>
        Array.from(new Set(products.filter(p => p.type === ProductType.MACHINE && p.manufacturer).map(p => p.manufacturer as string)))
            .sort((a, b) => a.localeCompare(b, 'ru')),
        [products]
    );

    const filteredModels = useMemo(() =>
        products.filter(p => {
            if (p.type !== ProductType.MACHINE) return false;
            if (config.categoryId && p.categoryId !== config.categoryId) return false;
            if (supplierFilterId && p.supplierId !== supplierFilterId) return false;
            if (manufacturerFilter && p.manufacturer !== manufacturerFilter) return false;
            if (modelSearch) {
                const q = modelSearch.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
            }
            return true;
        }),
        [products, config.categoryId, supplierFilterId, manufacturerFilter, modelSearch]
    );

    const selectedVariants = useMemo(() =>
        (Object.values(config.selectedOptions) as string[][]).flat()
            .map(vid => optionVariants.find(v => v.id === vid)).filter(Boolean) as OptionVariant[],
        [config.selectedOptions, optionVariants]
    );

    const defaultMargin = useMemo(() => {
        if (!machine) return null;
        const profile = PricingService.findProfile(machine, pricingProfiles);
        return profile ? profile.targetNetMarginPercent : (machine.markupPercentage || null);
    }, [machine, pricingProfiles]);

    const bundleTotals = useMemo(() => {
        if (!machine) return { purchaseTotal: 0, totalVolume: 0 };
        const t = BundleCalculator.calculateTotals(machine, config.selectedOptions, optionVariants, exchangeRates as any);
        return { purchaseTotal: t.purchaseTotal, totalVolume: t.totalVolumeM3 };
    }, [machine, config.selectedOptions, optionVariants, exchangeRates]);

    const economy = useMemo(() => {
        if (!machine) return null;
        const marginOverride = userMargin ?? defaultMargin;
        const profile = PricingService.findProfile(machine, pricingProfiles);
        const data = PricingService.calculateSmartPrice(machine, profile, exchangeRates, bundleTotals.totalVolume, bundleTotals.purchaseTotal, marginOverride ?? undefined);
        return { profile, data, purchaseForeign: bundleTotals.purchaseTotal, totalVolume: bundleTotals.totalVolume };
    }, [machine, pricingProfiles, exchangeRates, userMargin, defaultMargin, bundleTotals]);

    const selectedCategoryName = useMemo(() => machineCategories.find(c => c.id === config.categoryId)?.name || '', [machineCategories, config.categoryId]);
    const selectedSupplierName = useMemo(() => availableSuppliers.find(s => s.id === supplierFilterId)?.name || '', [availableSuppliers, supplierFilterId]);

    const f = (val: number) => Math.round(val).toLocaleString();

    // ── Handlers ──

    const handleSelectModel = (p: Product) => {
        config.resetSelection(p.id);
        setModelSearch('');
    };

    const handleBackToSelect = () => {
        if (!editingBundle) {
            config.resetSelection('');
            setModelSearch('');
        }
    };

    const showCopyToast = (msg: string) => {
        setCopyToast(msg);
        setTimeout(() => setCopyToast(null), 1800);
    };

    const handleCopyOur = () => {
        if (!machine) return;
        navigator.clipboard.writeText([machine.name, ...selectedVariants.map(v => v.name)].join(', '));
        showCopyToast('Скопировано (наши названия)');
    };

    const handleCopySupplier = () => {
        if (!machine) return;
        const parts = [machine.supplierProductName || machine.name, ...selectedVariants.map(v => v.supplierProductName || v.name)];
        navigator.clipboard.writeText(parts.join(', '));
        showCopyToast('Скопировано (для поставщика)');
    };

    const handleSave = async () => {
        if (!machine || !canSave) return;
        setIsSaving(true);
        try {
            const bundleData: Bundle = {
                id: editingBundle?.id || ApiService.generateId(),
                name: config.bundleName.trim(),
                baseProductId: machine.id,
                baseProductName: machine.name,
                selectedVariantIds: (Object.values(config.selectedOptions) as string[][]).flat(),
                totalPurchasePrice: economy?.purchaseForeign || 0,
                totalPrice: economy?.data?.finalPrice || 0,
                isTemplate: true,
                description: config.bundleDescription
            };
            if (editingBundle) await actions.updateBundle(bundleData);
            else await actions.addBundle(bundleData);
            setShowEconomySheet(false);
            onSaved();
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        if (!machine) return;
        BundleExporter.exportToCsv(
            { name: config.bundleName || machine.name, baseProductId: machine.id, selectedVariantIds: (Object.values(config.selectedOptions) as string[][]).flat(), totalPrice: economy?.data?.finalPrice || 0, description: config.bundleDescription },
            products, optionVariants, optionTypes,
            (module, sub, id, msg) => actions.addLog(module, sub, id, msg)
        );
    };

    // ── Render overlays ──

    const filterOverlayItems = useMemo(() => {
        if (filterOverlay === 'category') return machineCategories.map(c => ({ id: c.id, label: c.name }));
        if (filterOverlay === 'supplier') return availableSuppliers.map(s => ({ id: s.id, label: s.name }));
        if (filterOverlay === 'manufacturer') return availableManufacturers.map(m => ({ id: m, label: m }));
        return [];
    }, [filterOverlay, machineCategories, availableSuppliers, availableManufacturers]);

    const filterOverlaySelected = filterOverlay === 'category' ? config.categoryId : filterOverlay === 'supplier' ? supplierFilterId : manufacturerFilter;
    const filterOverlayTitle = filterOverlay === 'category' ? 'Категория' : filterOverlay === 'supplier' ? 'Поставщик' : 'Производитель';

    // ── Render ──

    return (
        <>
            {/* SearchOverlay для фильтров */}
            {filterOverlay && (
                <SearchOverlay
                    title={filterOverlayTitle}
                    items={filterOverlayItems}
                    selectedId={filterOverlaySelected}
                    onSelect={id => {
                        if (filterOverlay === 'category') { config.setCategoryId(id); config.setBaseMachineId(''); }
                        else if (filterOverlay === 'supplier') { setSupplierFilterId(id); config.setBaseMachineId(''); }
                        else { setManufacturerFilter(id); config.setBaseMachineId(''); }
                    }}
                    onClose={() => setFilterOverlay(null)}
                    emptyLabel={filterOverlay === 'category' ? '— Все категории —' : filterOverlay === 'supplier' ? '— Все поставщики —' : '— Все производители —'}
                />
            )}

            {/* EconomySheet */}
            {machine && economy && (
                <EconomySheet
                    isOpen={showEconomySheet}
                    onClose={() => setShowEconomySheet(false)}
                    machine={machine}
                    economy={economy}
                    showEconomy={showEconomy}
                    userMargin={userMargin}
                    defaultMargin={defaultMargin}
                    bundleName={config.bundleName}
                    bundleDescription={config.bundleDescription}
                    canSave={canSave}
                    isSaving={isSaving}
                    onMarginChange={setUserMargin}
                    onNameChange={config.setBundleName}
                    onDescChange={config.setBundleDescription}
                    onSave={handleSave}
                    onExport={handleExport}
                    editingBundle={editingBundle}
                    f={f}
                />
            )}

            {/* CopyToast */}
            {copyToast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-lg whitespace-nowrap pointer-events-none">
                    {copyToast}
                </div>
            )}

            {/* Основной контент */}
            <div className="flex flex-col h-full bg-slate-100 overflow-hidden">

                {/* ── Шаг 1: выбор модели ── */}
                {!machine && (
                    <div className="flex flex-col h-full overflow-hidden">

                        {/* Поиск */}
                        <div className="flex-none bg-white px-4 py-3 space-y-3 border-b border-slate-200">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Box size={20} className="text-blue-600 flex-none" />
                                {editingBundle ? 'Редактирование' : 'Новая сборка'}
                            </h2>
                            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                                <Search size={16} className="text-slate-400 flex-none" />
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                                    placeholder="Поиск модели станка..."
                                    value={modelSearch}
                                    onChange={e => setModelSearch(e.target.value)}
                                    autoFocus
                                />
                                {modelSearch && <button onClick={() => setModelSearch('')}><X size={14} className="text-slate-400" /></button>}
                            </div>

                            {/* Фильтры-чипы */}
                            <div className="overflow-x-auto -mx-4 px-4 flex-none">
                                <div className="flex gap-2 w-max pb-1">
                                    <button
                                        onClick={() => setFilterOverlay('category')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold whitespace-nowrap transition-all ${config.categoryId ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        <ListFilter size={13} />
                                        {selectedCategoryName || 'Категория'}
                                        {config.categoryId && <X size={11} onClick={e => { e.stopPropagation(); config.setCategoryId(''); config.setBaseMachineId(''); }} />}
                                    </button>
                                    <button
                                        onClick={() => setFilterOverlay('supplier')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold whitespace-nowrap transition-all ${supplierFilterId ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        <Truck size={13} />
                                        {selectedSupplierName || 'Поставщик'}
                                        {supplierFilterId && <X size={11} onClick={e => { e.stopPropagation(); setSupplierFilterId(''); config.setBaseMachineId(''); }} />}
                                    </button>
                                    <button
                                        onClick={() => setFilterOverlay('manufacturer')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold whitespace-nowrap transition-all ${manufacturerFilter ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        <Factory size={13} />
                                        {manufacturerFilter || 'Производитель'}
                                        {manufacturerFilter && <X size={11} onClick={e => { e.stopPropagation(); setManufacturerFilter(''); config.setBaseMachineId(''); }} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Список моделей */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredModels.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                    <Box size={40} className="mb-3 text-slate-200" />
                                    <p className="text-sm font-bold">Модели не найдены</p>
                                    <p className="text-xs text-slate-400 mt-1">Измените параметры поиска</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredModels.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelectModel(p)}
                                            className="w-full flex items-center gap-3 px-4 py-4 text-left bg-white hover:bg-blue-50 active:bg-blue-100 transition-colors">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-none">
                                                {p.imageUrl
                                                    ? <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                                    : <Box size={18} className="text-slate-300" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 text-sm leading-tight truncate">{p.name}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</div>
                                            </div>
                                            <div className="text-right flex-none">
                                                <div className="text-sm font-black font-mono text-slate-700">{f(p.basePrice)}</div>
                                                <div className="text-xs text-slate-400">{p.currency}</div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 flex-none" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Шаг 2: настройка опций ── */}
                {machine && (
                    <div className="flex flex-col h-full overflow-hidden">

                        {/* Sticky header */}
                        <div className="flex-none bg-white border-b border-slate-200 px-4 py-3 space-y-2">
                            {/* Строка 1: назад + название + copy */}
                            <div className="flex items-center gap-2">
                                {!editingBundle && (
                                    <button onClick={handleBackToSelect} className="p-2 -ml-1 text-slate-400 hover:text-slate-700 rounded-xl">
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-slate-800 text-base leading-tight truncate">{machine.name}</div>
                                    <div className="text-xs font-mono text-slate-400">{machine.sku}</div>
                                </div>
                                <div className="flex items-center gap-1 flex-none relative">
                                    <button onClick={handleCopyOur} title="Наши названия"
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                        <Copy size={16} />
                                    </button>
                                    <button onClick={handleCopySupplier} title="Для поставщика"
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                        <ClipboardList size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Строка 2: выбранные варианты (chips) */}
                            {selectedVariants.length > 0 && (
                                <div className="overflow-x-auto -mx-4 px-4">
                                    <div className="flex gap-1.5 w-max pb-0.5">
                                        {selectedVariants.map(v => (
                                            <span key={v.id}
                                                className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border border-blue-100 whitespace-nowrap">
                                                {v.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Список типов опций */}
                        <div className="flex-1 overflow-y-auto pb-24 space-y-2 px-3 pt-3">
                            {machine.machineConfig && optionTypes
                                .filter(ot => {
                                    const ce = machine.machineConfig?.find(mc => mc.typeId === ot.id);
                                    return ce && ce.allowedVariantIds && ce.allowedVariantIds.length > 0;
                                })
                                .map(type => {
                                    const isExpanded = config.expandedTypeIds.includes(type.id);
                                    const selectedVars = config.selectedOptions[type.id] || [];
                                    const configEntry = machine.machineConfig?.find(mc => mc.typeId === type.id);
                                    const allowedVarIds = configEntry?.allowedVariantIds || [];
                                    const variants = optionVariants.filter(v => v.typeId === type.id && allowedVarIds.includes(v.id));
                                    const machineCatId = machine.categoryId ?? '';
                                    const effectiveSingle = type.categoryOverrides?.[machineCatId]?.isSingleSelect ?? type.isSingleSelect;
                                    const effectiveRequired = type.categoryOverrides?.[machineCatId]?.isRequired ?? type.isRequired;

                                    return (
                                        <div key={type.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            {/* Accordion header */}
                                            <button
                                                onClick={() => config.toggleAccordion(type.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}>
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-none ${selectedVars.length > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Settings size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-black text-sm text-slate-700 uppercase tracking-tight">{type.name}</span>
                                                    {selectedVars.length > 0 && (
                                                        <span className="ml-2 bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-black uppercase">
                                                            Выбрано {selectedVars.length}
                                                        </span>
                                                    )}
                                                </div>
                                                {isExpanded ? <ChevronDown size={16} className="text-slate-300 flex-none" /> : <ChevronRight size={16} className="text-slate-300 flex-none" />}
                                            </button>

                                            {/* Карточки вариантов */}
                                            {isExpanded && (
                                                <div className="p-3 grid grid-cols-2 gap-2 bg-slate-50/30">
                                                    {variants.map(v => (
                                                        <OptionVariantCard
                                                            key={v.id}
                                                            type={type}
                                                            v={v}
                                                            machine={machine}
                                                            configEntry={configEntry}
                                                            selectedVars={selectedVars}
                                                            exchangeRates={exchangeRates as any}
                                                            showPrice={showOptionPrice}
                                                            onToggle={() => config.toggleOption(type.id, v.id, effectiveSingle, effectiveRequired)}
                                                            f={f}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                            {/* Пустое состояние — нет опций */}
                            {(!machine.machineConfig || machine.machineConfig.length === 0) && (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Settings size={36} className="mb-3 text-slate-200" />
                                    <p className="text-sm font-bold">Опции не настроены</p>
                                    <p className="text-xs text-slate-400 mt-1">Для этой модели нет доступных опций</p>
                                </div>
                            )}
                        </div>

                        {/* Floating bottom bar — итоговая цена */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent pointer-events-none">
                            <button
                                onClick={() => setShowEconomySheet(true)}
                                className="w-full pointer-events-auto bg-slate-900 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl active:scale-[0.98] transition-transform">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Итоговая цена</div>
                                    <div className="text-xl font-black font-mono tracking-tight flex items-baseline gap-1.5">
                                        {f(economy?.data?.finalPrice || 0)}
                                        <span className="text-xs font-medium text-blue-400">KZT</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedVariants.length > 0 && (
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-500 uppercase">Опций</div>
                                            <div className="text-base font-black text-slate-200">{selectedVariants.length}</div>
                                        </div>
                                    )}
                                    <div className="bg-blue-600 rounded-xl p-2.5">
                                        <Calculator size={18} />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
