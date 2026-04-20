
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Product, ProductType, SalesOrderItem, PlannedPayment,
    OptionVariant, OptionType, Bundle, StockMovement,
    Currency, CounterpartyType
} from '@/types';
import {
    ArrowLeft, Save, Search, X, Trash2, Plus, Check,
    ChevronDown, Box, Zap, Briefcase, Settings, Layers,
    Calculator, CreditCard, Package, AlertCircle, Loader2,
    Tag, ChevronRight
} from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { useSalesOrderFormState } from '../hooks/useSalesOrderFormState';
import { PricingService } from '@/services/PricingService';
import { InventoryService } from '@/services/InventoryService';
import { ApiService } from '@/services/api';
import { CashFlowSelector } from '@/components/ui/CashFlowSelector';
import { CounterpartyCreateModal } from '@/features/counterparties/components/CounterpartyCreateModal';

// ── Типы ─────────────────────────────────────────────────────────────────────

interface MobileSalesOrderFormProps {
    initialOrder: any | null;
    initialPayments: PlannedPayment[];
    onCancel: () => void;
    onSubmit: (order: any, plans: PlannedPayment[]) => void;
}

// ── Поиск клиента (полноэкранный overlay) ─────────────────────────────────────

const ClientSearchOverlay: React.FC<{
    clients: any[];
    selectedId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
    onAddClient?: () => void;
    canAddClient: boolean;
}> = ({ clients, selectedId, onSelect, onClose, onAddClient, canAddClient }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const filtered = useMemo(() =>
        clients.filter(c => !query || c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 100),
        [clients, query]
    );

    return (
        <div className="fixed inset-0 z-[400] flex flex-col bg-white">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 active:bg-slate-100">
                    <X size={20} />
                </button>
                <span className="text-base font-bold text-slate-700 flex-1">Выбор клиента</span>
                {canAddClient && onAddClient && (
                    <button onClick={onAddClient} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-blue-100">
                        <Plus size={13}/> Новый
                    </button>
                )}
            </div>
            <div className="px-4 py-3 border-b border-slate-100 flex-none">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                    <Search size={15} className="text-slate-400 flex-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Поиск клиента..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && <button onClick={() => setQuery('')}><X size={14} className="text-slate-400" /></button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                <button
                    onClick={() => { onSelect(''); onClose(); }}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${!selectedId ? 'bg-blue-50' : ''}`}
                >
                    <span className={`text-base ${!selectedId ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>— Не указан</span>
                    {!selectedId && <Check size={16} className="ml-auto text-blue-600" />}
                </button>
                {filtered.map(c => (
                    <button
                        key={c.id}
                        onClick={() => { onSelect(c.id); onClose(); }}
                        className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${selectedId === c.id ? 'bg-blue-50' : ''}`}
                    >
                        <div className="flex-1 min-w-0">
                            <div className={`text-base font-medium leading-tight ${selectedId === c.id ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>{c.name}</div>
                        </div>
                        {selectedId === c.id && <Check size={16} className="flex-none text-blue-600" />}
                    </button>
                ))}
                {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Ничего не найдено</div>}
            </div>
        </div>
    );
};

// ── Конфигуратор (мобильный, z-[400]) ────────────────────────────────────────

const MobileConfiguratorOverlay: React.FC<{
    baseMachine: Product;
    optionTypes: OptionType[];
    optionVariants: OptionVariant[];
    bundles: Bundle[];
    stockMovements: StockMovement[];
    exchangeRates: Record<string, number>;
    pricingProfiles: any[];
    canSeePricingDetails: boolean;
    onApply: (data: { name: string; price: number; currency: Currency; config: string[]; selectedVariantIds?: string[] }) => void;
    onClose: () => void;
}> = ({
    baseMachine, optionTypes, optionVariants, bundles, stockMovements,
    exchangeRates, pricingProfiles, canSeePricingDetails, onApply, onClose
}) => {
    const [tab, setTab] = useState<'manual' | 'favorites' | 'warehouse'>('manual');
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const defaults: Record<string, string[]> = {};
        if (baseMachine.machineConfig) {
            baseMachine.machineConfig.forEach(c => {
                if (c.defaultVariantIds?.length) defaults[c.typeId] = c.defaultVariantIds;
                else if (c.defaultVariantId) defaults[c.typeId] = [c.defaultVariantId];
            });
        }
        setSelectedOptions(defaults);
    }, [baseMachine]);

    const f = (v: number) => Math.round(v).toLocaleString();

    const toggleOption = (typeId: string, variantId: string, isSingle: boolean) => {
        setSelectedOptions(prev => {
            const cur = prev[typeId] || [];
            if (isSingle) return { ...prev, [typeId]: [variantId] };
            if (cur.includes(variantId)) return { ...prev, [typeId]: cur.filter(id => id !== variantId) };
            return { ...prev, [typeId]: [...cur, variantId] };
        });
    };

    const allowedOptionTypes = useMemo(() =>
        optionTypes.filter(ot => baseMachine.machineConfig?.some(mc => mc.typeId === ot.id)),
        [baseMachine, optionTypes]
    );

    const bundleTotals = useMemo(() => {
        const ids = Object.values(selectedOptions).flat();
        const purchaseTotal = PricingService.calculateBundlePurchasePrice(baseMachine, ids, optionVariants, exchangeRates as any);
        const totalVolume = PricingService.calculateBundleVolume(baseMachine, ids, optionVariants);
        return { purchaseTotal, totalVolume };
    }, [baseMachine, selectedOptions, optionVariants, exchangeRates]);

    const economy = useMemo(() => {
        const profile = PricingService.findProfile(baseMachine, pricingProfiles);
        const data = PricingService.calculateSmartPrice(baseMachine, profile, exchangeRates as any, bundleTotals.totalVolume, bundleTotals.purchaseTotal);
        return { finalPrice: data.finalPrice, netProfit: data.netProfit, details: data };
    }, [baseMachine, pricingProfiles, exchangeRates, bundleTotals]);

    const getUniqueStockConfigs = () => {
        const configs: Record<string, { names: string[]; physical: number; incoming: number; reserved: number }> = {};
        stockMovements.filter(m => m.productId === baseMachine.id).forEach(m => {
            const key = (m.configuration || []).sort().join('|') || 'BASE';
            if (!configs[key]) configs[key] = { names: m.configuration || [], physical: 0, incoming: 0, reserved: 0 };
            const qty = Number(m.quantity);
            const chg = m.type === 'In' ? qty : -qty;
            if (m.statusType === 'Physical') configs[key].physical += chg;
            else if (m.statusType === 'Incoming') configs[key].incoming += chg;
            else if (m.statusType === 'Reserved') configs[key].reserved += chg;
        });
        return Object.values(configs).filter(c => Math.abs(c.physical) > 0.001 || Math.abs(c.incoming) > 0.001 || Math.abs(c.reserved) > 0.001);
    };

    const handleApply = () => {
        const ids = Object.values(selectedOptions).flat();
        const configNames = ids.map(vid => optionVariants.find(v => v.id === vid)?.name || '').filter(Boolean);
        onApply({ name: baseMachine.name, price: economy.finalPrice, currency: Currency.Kzt, config: configNames, selectedVariantIds: ids });
    };

    const TAB_LABELS = [
        { key: 'manual', label: 'Вручную' },
        { key: 'favorites', label: 'Шаблоны' },
        { key: 'warehouse', label: 'Со склада' },
    ] as const;

    return (
        <div className="fixed inset-0 z-[400] flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 active:bg-slate-100">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Конфигурация</div>
                    <div className="text-sm font-black text-slate-800 truncate leading-tight">{baseMachine.name}</div>
                </div>
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Settings size={16} />
                </div>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-slate-50 border-b border-slate-200 flex-none">
                {TAB_LABELS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                            tab === key ? 'text-blue-600 border-blue-600 bg-white' : 'text-slate-400 border-transparent'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Вручную */}
                {tab === 'manual' && (
                    allowedOptionTypes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                            <Settings size={36} className="mb-3" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Нет настраиваемых опций</p>
                        </div>
                    ) : allowedOptionTypes.map(type => {
                        const configEntry = baseMachine.machineConfig?.find(mc => mc.typeId === type.id);
                        const allowedVarIds = configEntry?.allowedVariantIds || [];
                        const machineCatId = baseMachine.categoryId ?? '';
                        const effectiveSingle = type.categoryOverrides?.[machineCatId]?.isSingleSelect ?? type.isSingleSelect;
                        const variants = optionVariants.filter(v => v.typeId === type.id && allowedVarIds.includes(v.id));

                        return (
                            <div key={type.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                                    <Layers size={13} className="text-blue-400" />
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{type.name}</span>
                                    <span className="ml-auto text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded font-bold uppercase">
                                        {effectiveSingle ? 'Один' : 'Несколько'}
                                    </span>
                                </div>
                                <div className="p-3 grid grid-cols-2 gap-2">
                                    {variants.map(variant => {
                                        const isSelected = selectedOptions[type.id]?.includes(variant.id);
                                        const price = configEntry?.priceOverrides?.[variant.id] ?? variant.price;
                                        return (
                                            <button
                                                key={variant.id}
                                                onClick={() => toggleOption(type.id, variant.id, effectiveSingle)}
                                                className={`flex flex-col gap-1 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95 ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : 'border-slate-100 bg-slate-50/50'
                                                }`}
                                            >
                                                <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-blue-800' : 'text-slate-600'}`}>{variant.name}</span>
                                                {(canSeePricingDetails) && price > 0 && (
                                                    <span className={`text-[10px] font-black font-mono ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                                                        +{f(price)} {variant.currency}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Шаблоны */}
                {tab === 'favorites' && (() => {
                    const machBundles = bundles.filter(b => b.baseProductId === baseMachine.id);
                    if (machBundles.length === 0) return (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                            <Package size={36} className="mb-3" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Нет сохранённых шаблонов</p>
                        </div>
                    );
                    return (
                        <div className="space-y-3">
                            {machBundles.map(b => {
                                const totalVol = PricingService.calculateBundleVolume(baseMachine, b.selectedVariantIds, optionVariants);
                                const purchaseP = PricingService.calculateBundlePurchasePrice(baseMachine, b.selectedVariantIds, optionVariants, exchangeRates as any);
                                const profile = PricingService.findProfile(baseMachine, pricingProfiles);
                                const econ = PricingService.calculateSmartPrice(baseMachine, profile, exchangeRates as any, totalVol, purchaseP);
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => onApply({
                                            name: b.name,
                                            price: econ.finalPrice,
                                            currency: Currency.Kzt,
                                            config: b.selectedVariantIds.map(vid => optionVariants.find(ov => ov.id === vid)?.name || '').filter(Boolean),
                                            selectedVariantIds: b.selectedVariantIds
                                        })}
                                        className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 active:bg-blue-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <span className="text-sm font-black text-slate-800 leading-tight">{b.name}</span>
                                            <span className="text-sm font-black text-blue-600 font-mono whitespace-nowrap">{f(econ.finalPrice)} ₸</span>
                                        </div>
                                        {canSeePricingDetails && (
                                            <div className="text-[10px] text-emerald-600 font-bold mb-2">Прибыль: +{f(econ.netProfit)} ₸</div>
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                            {b.selectedVariantIds.map(vid => (
                                                <span key={vid} className="px-1.5 py-0.5 bg-blue-50 text-[9px] font-bold text-blue-600 rounded border border-blue-100">
                                                    {optionVariants.find(ov => ov.id === vid)?.name}
                                                </span>
                                            ))}
                                        </div>
                                        {b.description && <p className="mt-2 text-[10px] text-slate-400 italic line-clamp-2">{b.description}</p>}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Со склада */}
                {tab === 'warehouse' && (() => {
                    const stockConfigs = getUniqueStockConfigs();
                    if (stockConfigs.length === 0) return (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                            <Box size={36} className="mb-3" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Нет позиций на складе</p>
                        </div>
                    );
                    return (
                        <div className="space-y-3">
                            {stockConfigs.map((conf, idx) => {
                                const free = conf.physical + conf.incoming - conf.reserved;
                                const ids = conf.names.map(n => optionVariants.find(ov => ov.name === n)?.id).filter(Boolean) as string[];
                                const purchaseP = PricingService.calculateBundlePurchasePrice(baseMachine, ids, optionVariants, exchangeRates as any);
                                const totalVol = PricingService.calculateBundleVolume(baseMachine, ids, optionVariants);
                                const profile = PricingService.findProfile(baseMachine, pricingProfiles);
                                const econ = PricingService.calculateSmartPrice(baseMachine, profile, exchangeRates as any, totalVol, purchaseP);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => onApply({ name: baseMachine.name, price: econ.finalPrice, currency: Currency.Kzt, config: conf.names, selectedVariantIds: ids })}
                                        className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 active:bg-emerald-50 transition-colors"
                                    >
                                        {/* Stock counts */}
                                        <div className="flex gap-1 mb-3">
                                            {[
                                                { label: 'Склад', val: conf.physical, color: 'text-slate-700' },
                                                { label: 'Ожид.', val: conf.incoming, color: 'text-blue-600' },
                                                { label: 'Резерв', val: conf.reserved, color: 'text-orange-600' },
                                                { label: 'Свободно', val: free, color: free > 0 ? 'text-emerald-600' : 'text-red-600' },
                                            ].map(({ label, val, color }) => (
                                                <div key={label} className={`flex-1 text-center rounded-lg py-1.5 ${label === 'Свободно' ? (free > 0 ? 'bg-emerald-50' : 'bg-red-50') : 'bg-slate-50'}`}>
                                                    <div className="text-[8px] font-black text-slate-400 uppercase">{label}</div>
                                                    <div className={`text-[13px] font-black ${color}`}>{val}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Config chips */}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {conf.names.length === 0
                                                ? <span className="text-xs text-slate-400 italic">Базовая комплектация</span>
                                                : conf.names.map((n, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-[10px] font-bold text-blue-700 rounded border border-blue-100">{n}</span>
                                                ))
                                            }
                                        </div>
                                        <div className="text-sm font-black text-blue-700 font-mono text-right">{f(econ.finalPrice)} ₸</div>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })()}

                <div className="h-32" />
            </div>

            {/* Footer — price + apply */}
            <div className="flex-none bg-slate-900 text-white px-4 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Итоговая цена (IPP)</div>
                    <div className="text-2xl font-black tracking-tight">{f(economy.finalPrice)} <span className="text-sm font-light opacity-50">₸</span></div>
                    {canSeePricingDetails && (
                        <div className="text-[10px] text-emerald-400 font-bold">Прибыль: +{f(economy.netProfit)} ₸</div>
                    )}
                </div>
                <button
                    onClick={handleApply}
                    className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                >
                    Добавить
                </button>
            </div>
        </div>
    );
};

// ── Поиск товара (полноэкранный overlay) ─────────────────────────────────────

const ProductSearchOverlay: React.FC<{
    products: Product[];
    categories: any[];
    stockMovements: StockMovement[];
    onSelectMachine: (machine: Product) => void;
    onAddProduct: (product: Product, qty: number) => void;
    onClose: () => void;
}> = ({ products, categories, stockMovements, onSelectMachine, onAddProduct, onClose }) => {
    const [type, setType] = useState<ProductType>(ProductType.MACHINE);
    const [query, setQuery] = useState('');
    const [machineFilter, setMachineFilter] = useState<string>('all');
    const [catFilter, setCatFilter] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [qty, setQty] = useState(1);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTimeout(() => searchRef.current?.focus(), 50); }, []);

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE).sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru')), [categories]);

    const typeCategories = useMemo(() => {
        const base = categories.filter((c: any) => c.type === type);
        if (type === ProductType.MACHINE) return base;
        if (machineFilter === 'all') return base;
        return base.filter((cat: any) => products.some(p => p.type === type && p.categoryId === cat.id && (p.compatibleMachineCategoryIds || []).includes(machineFilter)));
    }, [categories, type, machineFilter, products]);

    const filtered = useMemo(() => {
        return products.filter(p => {
            if (p.type !== type) return false;
            if (type !== ProductType.MACHINE && machineFilter !== 'all' && !(p.compatibleMachineCategoryIds || []).includes(machineFilter)) return false;
            if (catFilter !== 'all' && p.categoryId !== catFilter) return false;
            if (query && !p.name.toLowerCase().includes(query.toLowerCase()) && !p.sku.toLowerCase().includes(query.toLowerCase())) return false;
            return true;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, type, machineFilter, catFilter, query]);

    const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

    const handlePickProduct = (p: Product) => {
        if (p.type === ProductType.MACHINE) {
            onSelectMachine(p);
        } else {
            setSelectedProduct(p);
        }
    };

    const handleConfirmAdd = () => {
        if (!selectedProduct) return;
        onAddProduct(selectedProduct, qty);
    };

    return (
        <div className="fixed inset-0 z-[400] flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 active:bg-slate-100">
                    <X size={20} />
                </button>
                <span className="text-base font-bold text-slate-700 flex-1">Добавить позицию</span>
            </div>

            {/* Type switcher */}
            <div className="flex px-4 py-2 gap-1.5 border-b border-slate-100 flex-none bg-white">
                {[
                    { t: ProductType.MACHINE, label: 'Станки', icon: <Box size={12}/>, color: 'bg-blue-600' },
                    { t: ProductType.PART, label: 'Запчасти', icon: <Zap size={12}/>, color: 'bg-orange-500' },
                    { t: ProductType.SERVICE, label: 'Услуги', icon: <Briefcase size={12}/>, color: 'bg-purple-600' },
                ].map(({ t, label, icon, color }) => (
                    <button
                        key={t}
                        onClick={() => { setType(t); setMachineFilter('all'); setCatFilter('all'); setSelectedProduct(null); }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${type === t ? `${color} text-white` : 'bg-slate-100 text-slate-500'}`}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="px-4 py-2 flex gap-2 flex-none bg-slate-50 border-b border-slate-100 overflow-x-auto">
                {type !== ProductType.MACHINE && machineCategories.length > 0 && (
                    <select
                        value={machineFilter}
                        onChange={e => { setMachineFilter(e.target.value); setCatFilter('all'); }}
                        className="text-[11px] font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none min-w-[130px]"
                    >
                        <option value="all">Любой станок</option>
                        {machineCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
                <select
                    value={catFilter}
                    onChange={e => setCatFilter(e.target.value)}
                    className="text-[11px] font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none min-w-[130px]"
                >
                    <option value="all">Все категории</option>
                    {typeCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-slate-100 flex-none">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                    <Search size={15} className="text-slate-400 flex-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Название или артикул..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && <button onClick={() => setQuery('')}><X size={14} className="text-slate-400" /></button>}
                </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                        <Search size={32} className="mb-2" />
                        <p className="text-[11px] font-black uppercase tracking-widest">Товары не найдены</p>
                    </div>
                ) : filtered.slice(0, 100).map(p => {
                    const bal = InventoryService.getProductBalance(p.id, stockMovements);
                    const isMachine = p.type === ProductType.MACHINE;
                    const isSelected = selectedProduct?.id === p.id;
                    return (
                        <button
                            key={p.id}
                            onClick={() => handlePickProduct(p)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : 'active:bg-slate-50'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className={`text-[14px] font-bold leading-tight ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>{p.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                            </div>
                            <div className="text-right flex-none">
                                <div className="text-[13px] font-black text-slate-700 font-mono">{f(p.salesPrice || 0)} ₸</div>
                                <div className={`text-[10px] font-bold ${bal.free <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {isMachine ? `Своб: ${bal.free}` : `Скл: ${bal.physical}`}
                                </div>
                            </div>
                            {isMachine && <ChevronRight size={16} className="text-slate-300 flex-none" />}
                        </button>
                    );
                })}
            </div>

            {/* Qty picker for non-machine */}
            {selectedProduct && selectedProduct.type !== ProductType.MACHINE && (
                <div className="flex-none bg-white border-t border-slate-100 px-4 py-4 flex items-center gap-3 shadow-lg">
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-slate-500 truncate">{selectedProduct.name}</div>
                        <div className="text-base font-black text-blue-600 font-mono">
                            {(selectedProduct.salesPrice || 0) * qty} ₸
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
                        <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center text-slate-600 font-black text-lg active:scale-95">−</button>
                        <input
                            type="number"
                            value={qty}
                            onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 text-center font-black text-slate-800 bg-transparent outline-none text-[15px]"
                        />
                        <button onClick={() => setQty(q => q + 1)} className="w-7 h-7 flex items-center justify-center text-slate-600 font-black text-lg active:scale-95">+</button>
                    </div>
                    <button
                        onClick={handleConfirmAdd}
                        className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-sm active:scale-95 transition-all"
                    >
                        <Check size={18} />
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Вкладка «Состав» ─────────────────────────────────────────────────────────

const ItemsTab: React.FC<{
    items: SalesOrderItem[];
    setItems: React.Dispatch<React.SetStateAction<SalesOrderItem[]>>;
    optionVariants: OptionVariant[];
    isWriteable: boolean;
    canEditPrices: boolean;
    onOpenSearch: () => void;
}> = ({ items, setItems, optionVariants, isWriteable, canEditPrices, onOpenSearch }) => {
    const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

    const updateItem = (idx: number, changes: Partial<SalesOrderItem>) => {
        setItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...changes };
            if ('quantity' in changes || 'priceKzt' in changes) {
                next[idx].totalKzt = (next[idx].quantity || 1) * (next[idx].priceKzt || 0);
            }
            return next;
        });
    };

    return (
        <div className="space-y-3">
            {isWriteable && (
                <button
                    onClick={onOpenSearch}
                    className="w-full flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5 active:scale-[0.99] transition-all"
                >
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-none">
                        <Plus size={18} className="text-white" />
                    </div>
                    <span className="text-sm font-black text-blue-600 uppercase tracking-widest">Добавить товар</span>
                </button>
            )}

            {items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <Package size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Список позиций пуст</p>
                </div>
            ) : items.map((item, idx) => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-black text-slate-800 leading-tight">{item.productName}</div>
                                <div className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">{item.sku}</div>
                            </div>
                            {isWriteable && (
                                <button
                                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                                    className="p-1.5 text-slate-200 active:text-red-500 rounded-lg flex-none"
                                >
                                    <Trash2 size={15} />
                                </button>
                            )}
                        </div>

                        {/* Configuration chips */}
                        {item.configuration && item.configuration.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {item.configuration.map((c, i) => {
                                    const variant = optionVariants.find(v => v.id === c);
                                    return (
                                        <span key={i} className="text-[9px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 border border-blue-100 font-bold">
                                            {variant?.name || c}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Qty + price */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-xl px-2 py-1.5">
                                <button onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })} disabled={!isWriteable} className="w-6 h-6 flex items-center justify-center font-black text-slate-500 disabled:opacity-40">−</button>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={e => isWriteable && updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                                    className="w-10 text-center font-black text-slate-800 bg-transparent outline-none text-[14px]"
                                    disabled={!isWriteable}
                                />
                                <button onClick={() => updateItem(idx, { quantity: item.quantity + 1 })} disabled={!isWriteable} className="w-6 h-6 flex items-center justify-center font-black text-slate-500 disabled:opacity-40">+</button>
                            </div>
                            <span className="text-slate-300 text-sm">×</span>
                            <div className="flex-1">
                                <input
                                    type="number"
                                    value={item.priceKzt}
                                    onChange={e => canEditPrices && updateItem(idx, { priceKzt: parseFloat(e.target.value) || 0 })}
                                    readOnly={!canEditPrices}
                                    className={`w-full text-right font-black text-[14px] font-mono rounded-xl px-3 py-1.5 outline-none ${canEditPrices ? 'bg-slate-100 text-slate-700' : 'bg-transparent text-slate-500'}`}
                                />
                            </div>
                            <span className="text-[10px] text-slate-400 flex-none">₸</span>
                        </div>
                    </div>

                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Итого</span>
                        <span className="text-base font-black text-slate-900 font-mono">{f(item.totalKzt)} ₸</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Вкладка «Транши» ─────────────────────────────────────────────────────────

const PaymentsTab: React.FC<{
    unallocatedAmount: number;
    formPayments: Partial<PlannedPayment>[];
    setFormPayments: React.Dispatch<React.SetStateAction<Partial<PlannedPayment>[]>>;
    handleAddPaymentStep: () => void;
    isWriteable: boolean;
    intermediaries: any[];
}> = ({ unallocatedAmount, formPayments, setFormPayments, handleAddPaymentStep, isWriteable, intermediaries }) => {
    const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

    const updatePayment = (idx: number, key: keyof Partial<PlannedPayment>, value: any) => {
        if (!isWriteable) return;
        setFormPayments(prev => {
            const next = [...prev];
            (next[idx] as any)[key] = value;
            return next;
        });
    };

    const balanced = Math.abs(unallocatedAmount) <= 0.1;

    return (
        <div className="space-y-3">
            {/* Balance banner */}
            <div className={`rounded-2xl p-4 flex items-center justify-between border ${balanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div>
                    <div className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {unallocatedAmount > 0.1 ? 'Остаток к распределению' : unallocatedAmount < -0.1 ? 'Превышение суммы' : 'График сформирован'}
                    </div>
                    <div className={`text-xl font-black font-mono ${unallocatedAmount < -0.1 ? 'text-red-600' : balanced ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {f(Math.abs(unallocatedAmount))} ₸
                    </div>
                </div>
                {isWriteable && (
                    <button
                        onClick={handleAddPaymentStep}
                        className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                        <Plus size={14}/> Транш
                    </button>
                )}
            </div>

            {/* Tranches list */}
            {formPayments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <CreditCard size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Транши не добавлены</p>
                </div>
            ) : formPayments.map((p, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Транш {idx + 1}</span>
                        {isWriteable && (
                            <button onClick={() => setFormPayments(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-slate-200 active:text-red-500 rounded-lg">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    <div className="p-4 space-y-3">
                        {/* Date */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Дата</label>
                            <input
                                type="date"
                                value={p.dueDate || ''}
                                onChange={e => updatePayment(idx, 'dueDate', e.target.value)}
                                disabled={!isWriteable}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            />
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Сумма (₸)</label>
                            <input
                                type="number"
                                value={p.amountDue || ''}
                                onChange={e => updatePayment(idx, 'amountDue', parseFloat(e.target.value) || 0)}
                                disabled={!isWriteable}
                                inputMode="decimal"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] font-black font-mono text-slate-800 text-right outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            />
                        </div>

                        {/* CashFlow */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Статья ДДС</label>
                            <CashFlowSelector
                                value={p.cashFlowItemId || ''}
                                onChange={id => updatePayment(idx, 'cashFlowItemId', id)}
                                direction="Incoming"
                                disabled={!isWriteable}
                                dropdownMinWidth={240}
                            />
                        </div>

                        {/* Intermediary */}
                        {intermediaries.length > 0 && (
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Посредник</label>
                                <select
                                    value={p.paymentCounterpartyId || ''}
                                    onChange={e => {
                                        const cp = intermediaries.find((c: any) => c.id === e.target.value);
                                        updatePayment(idx, 'paymentCounterpartyId', e.target.value || undefined);
                                        updatePayment(idx, 'paymentCounterpartyName', cp?.name || undefined);
                                    }}
                                    disabled={!isWriteable}
                                    className={`w-full border rounded-xl px-4 py-3 text-[15px] font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 ${p.paymentCounterpartyId ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                >
                                    <option value="">— Прямая оплата —</option>
                                    {intermediaries.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Paid status */}
                    {(p.amountPaid || 0) > 0 && (
                        <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Оплачено</span>
                            <span className="text-sm font-black text-emerald-700 font-mono">{f(p.amountPaid || 0)} ₸</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Основная форма ────────────────────────────────────────────────────────────

export const MobileSalesOrderForm: React.FC<MobileSalesOrderFormProps> = ({
    initialOrder, initialPayments, onCancel, onSubmit
}) => {
    const { state, actions } = useStore();
    const access = useAccess('sales');

    const canSeeItems    = access.canSee('tabs', 'items_tab');
    const canSeePayments = access.canSee('tabs', 'payments_tab');
    const canEditPrices  = access.canWrite('fields', 'sales_prices');
    const canAddClient   = access.canWrite('actions', 'add_client');
    const isWriteable    = initialOrder ? access.canWrite('actions', 'edit') : access.canWrite('actions', 'create');

    const {
        orderId, orderName, setOrderName,
        selectedClientId, setSelectedClientId,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        totalOrderAmount, unallocatedAmount,
        handleAddPaymentStep, validateForm,
        responsibleEmployeeId, setResponsibleEmployeeId
    } = useSalesOrderFormState(
        initialOrder, initialPayments,
        state.clients, state.pricingProfiles,
        state.exchangeRates, state.cashFlowItems
    );

    const [isSaving, setIsSaving] = useState(false);
    const [showClientSearch, setShowClientSearch] = useState(false);
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [configuringMachine, setConfiguringMachine] = useState<Product | null>(null);
    const [showAddClientModal, setShowAddClientModal] = useState(false);

    const currentClient = useMemo(() => state.clients.find((c: any) => c.id === selectedClientId), [state.clients, selectedClientId]);
    const intermediaries = useMemo(() => (state.counterparties || []).filter((c: any) => c.isPaymentIntermediary), [state.counterparties]);

    const f = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

    const handleSubmit = async () => {
        if (!isWriteable || isSaving) return;
        const err = validateForm();
        if (err) { alert(err); return; }

        setIsSaving(true);
        try {
            const client = state.clients.find((c: any) => c.id === selectedClientId);
            const orderData = {
                id: orderId,
                name: orderName,
                date: initialOrder?.date || new Date().toISOString().split('T')[0],
                clientId: selectedClientId,
                clientName: client?.name || 'Unknown',
                items: items.map((i: SalesOrderItem) => ({ ...i, salesOrderId: orderId })),
                status: initialOrder?.status || 'Confirmed',
                totalAmount: totalOrderAmount,
                paidAmount: initialOrder?.paidAmount || 0,
                shippedItemCount: initialOrder?.shippedItemCount || 0,
                totalItemCount: items.reduce((s: number, i: SalesOrderItem) => s + (i.quantity || 0), 0),
                contractUrl: initialOrder?.contractUrl || '',
                contractName: initialOrder?.contractName || '',
                additionalDocuments: initialOrder?.additionalDocuments || [],
                responsibleEmployeeId: responsibleEmployeeId || undefined,
                responsibleEmployeeName: (state.counterparties || []).find((e: any) => e.id === responsibleEmployeeId)?.name || undefined,
            };

            const plans: PlannedPayment[] = formPayments.map(p => ({
                id: p.id || ApiService.generateId(),
                direction: 'Incoming',
                sourceDocId: orderId,
                sourceDocType: 'SalesOrder',
                counterpartyId: selectedClientId,
                counterpartyName: client?.name || 'Unknown',
                amountDue: Number(p.amountDue) || 0,
                currency: Currency.Kzt,
                dueDate: p.dueDate || new Date().toISOString().split('T')[0],
                amountPaid: Number(p.amountPaid) || 0,
                isPaid: (Number(p.amountPaid) || 0) >= (Number(p.amountDue) || 0) - 0.01,
                cashFlowItemId: p.cashFlowItemId || '',
                paymentCounterpartyId: p.paymentCounterpartyId || undefined,
                paymentCounterpartyName: p.paymentCounterpartyName || undefined,
            } as PlannedPayment));

            onSubmit(orderData as any, plans);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddProduct = (product: Product, qty: number) => {
        const profile = PricingService.findProfile(product, state.pricingProfiles);
        const economy = PricingService.calculateSmartPrice(product, profile, state.exchangeRates);
        setItems((prev: SalesOrderItem[]) => [...prev, {
            id: ApiService.generateId(),
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: qty,
            priceKzt: economy.finalPrice,
            totalKzt: economy.finalPrice * qty,
            configuration: []
        }]);
        setShowProductSearch(false);
    };

    const handleConfiguratorApply = (data: { name: string; price: number; currency: Currency; config: string[]; selectedVariantIds?: string[] }) => {
        if (!configuringMachine) return;
        const finalConfig = data.selectedVariantIds?.length ? data.selectedVariantIds : data.config;
        setItems((prev: SalesOrderItem[]) => [...prev, {
            id: ApiService.generateId(),
            productId: configuringMachine.id,
            productName: configuringMachine.name,
            sku: configuringMachine.sku,
            quantity: 1,
            priceKzt: data.price,
            totalKzt: data.price,
            configuration: finalConfig || []
        }]);
        setConfiguringMachine(null);
    };

    const nomenclatureAccess = useAccess('nomenclature');
    const canSeePricingDetails = nomenclatureAccess.canSee('fields', 'pricingDetails');

    const balanced = Math.abs(unallocatedAmount) <= 0.1;

    return (
        <>
            {/* ── Overlays — до основного контейнера (вне overflow:hidden) ── */}

            {showClientSearch && (
                <ClientSearchOverlay
                    clients={state.clients}
                    selectedId={selectedClientId}
                    onSelect={setSelectedClientId}
                    onClose={() => setShowClientSearch(false)}
                    canAddClient={canAddClient}
                    onAddClient={() => { setShowClientSearch(false); setShowAddClientModal(true); }}
                />
            )}

            {showProductSearch && !configuringMachine && (
                <ProductSearchOverlay
                    products={state.products}
                    categories={state.categories}
                    stockMovements={state.stockMovements}
                    onSelectMachine={(machine) => { setShowProductSearch(false); setConfiguringMachine(machine); }}
                    onAddProduct={handleAddProduct}
                    onClose={() => setShowProductSearch(false)}
                />
            )}

            {configuringMachine && (
                <MobileConfiguratorOverlay
                    baseMachine={configuringMachine}
                    optionTypes={state.optionTypes || []}
                    optionVariants={state.optionVariants || []}
                    bundles={state.bundles || []}
                    stockMovements={state.stockMovements}
                    exchangeRates={state.exchangeRates}
                    pricingProfiles={state.pricingProfiles}
                    canSeePricingDetails={canSeePricingDetails}
                    onApply={handleConfiguratorApply}
                    onClose={() => setConfiguringMachine(null)}
                />
            )}

            {showAddClientModal && (
                <CounterpartyCreateModal
                    initialType={CounterpartyType.CLIENT}
                    onClose={() => setShowAddClientModal(false)}
                    onSubmit={async (counterparty, accounts) => {
                        await actions.addCounterparty(counterparty, accounts[0]);
                        setSelectedClientId(counterparty.id);
                        setShowAddClientModal(false);
                    }}
                />
            )}

            {/* ── Основная форма ── */}
            <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50">

                {/* Header */}
                <div className="bg-white border-b border-slate-100 px-3 py-2.5 flex items-center gap-2 flex-none">
                    <button onClick={onCancel} className="p-2 text-slate-400 active:text-slate-600 rounded-xl active:bg-slate-50 flex-none">
                        <ArrowLeft size={18} />
                    </button>

                    {/* Tab switcher */}
                    <div className="flex-1 flex justify-center">
                        <div className="flex bg-slate-100 p-0.5 rounded-xl">
                            {canSeeItems && (
                                <button
                                    onClick={() => setActiveFormTab('items')}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeFormTab === 'items' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Состав
                                </button>
                            )}
                            {canSeePayments && (
                                <button
                                    onClick={() => setActiveFormTab('payments')}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all relative ${activeFormTab === 'payments' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Транши
                                    {!balanced && activeFormTab !== 'payments' && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Save */}
                    {isWriteable && (
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm flex-none ${
                                balanced ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                            }`}
                        >
                            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {initialOrder ? 'Обновить' : 'Провести'}
                        </button>
                    )}
                </div>

                {/* Fields — name + client + total */}
                <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-2.5 flex-none">
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Название заказа</label>
                        <input
                            type="text"
                            value={orderName}
                            onChange={e => setOrderName(e.target.value)}
                            disabled={!isWriteable}
                            placeholder="Напр: Поставка станков для цеха №1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[15px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 disabled:opacity-60"
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Клиент</label>
                        <button
                            onClick={() => isWriteable && setShowClientSearch(true)}
                            disabled={!isWriteable}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[15px] text-left flex items-center justify-between disabled:opacity-60"
                        >
                            <span className={currentClient ? 'font-bold text-slate-800' : 'text-slate-400'}>
                                {currentClient?.name || 'Выбрать клиента...'}
                            </span>
                            <ChevronDown size={16} className="text-slate-400 flex-none ml-2" />
                        </button>
                    </div>
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Итого заказ</span>
                        <span className="text-lg font-black text-blue-600 font-mono">{f(totalOrderAmount)} <span className="text-xs font-normal opacity-40">₸</span></span>
                    </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-3 pb-6">
                    {activeFormTab === 'items' && canSeeItems && (
                        <ItemsTab
                            items={items}
                            setItems={setItems}
                            optionVariants={state.optionVariants || []}
                            isWriteable={isWriteable}
                            canEditPrices={canEditPrices}
                            onOpenSearch={() => setShowProductSearch(true)}
                        />
                    )}
                    {activeFormTab === 'payments' && canSeePayments && (
                        <PaymentsTab
                            unallocatedAmount={unallocatedAmount}
                            formPayments={formPayments}
                            setFormPayments={setFormPayments}
                            handleAddPaymentStep={handleAddPaymentStep}
                            isWriteable={isWriteable}
                            intermediaries={intermediaries}
                        />
                    )}
                </div>
            </div>
        </>
    );
};
