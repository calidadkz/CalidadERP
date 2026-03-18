
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product, ProductType, ProductCategory, OptionVariant, PricingProfile, OptionType, Currency } from '@/types';
import { Box, Zap, Briefcase, Search, ChevronDown, Monitor, Tags, Layers, X } from 'lucide-react';
import { PricingService } from '@/services/PricingService';

const normalizeOptions = (opts?: string[]) => [...(opts || [])].sort((a, b) => a.localeCompare(b));

interface AdjustmentFormProps {
    onClose: () => void;
    products: Product[];
    stockMovements: any[];
    exchangeRates: Record<Currency, number>;
    optionVariants: OptionVariant[];
    pricingProfiles: PricingProfile[];
    categories: ProductCategory[];
    optionTypes: OptionType[];
    actions: any;
}

export const AdjustmentForm = React.memo(({ 
    onClose, 
    products, 
    stockMovements, 
    exchangeRates, 
    optionVariants, 
    pricingProfiles, 
    categories,
    optionTypes,
    actions
}: AdjustmentFormProps) => {
    const [adjActiveType, setAdjActiveType] = useState<ProductType>(ProductType.MACHINE);
    const [adjMachineFilter, setAdjMachineFilter] = useState<string | 'all'>('all');
    const [adjCategoryFilter, setAdjCategoryFilter] = useState<string | 'all'>('all');
    const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(true);
    const [prodSearch, setProdSearch] = useState('');
    const [debouncedProdSearch, setDebouncedProdSearch] = useState('');
    const [visibleProdCount, setVisibleProdCount] = useState(50);
    const [adjProductId, setAdjProductId] = useState('');
    const [adjQty, setAdjQty] = useState(1);
    const [adjUnitPrice, setAdjUnitPrice] = useState(0);
    const [adjSalesPrice, setAdjSalesPrice] = useState(0); 
    const [adjOptions, setAdjOptions] = useState<Record<string, string>>({});
    
    const prodRef = useRef<HTMLDivElement>(null);
    const prodSearchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedProdSearch(prodSearch);
            setVisibleProdCount(50);
        }, 300);
        return () => clearTimeout(timer);
    }, [prodSearch]);

    useEffect(() => {
        if (isProdDropdownOpen && prodSearchInputRef.current) {
            prodSearchInputRef.current.focus();
        }
    }, [isProdDropdownOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (prodRef.current && !prodRef.current.contains(event.target as Node)) setIsProdDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizeOptionsLocal = useCallback((opts?: string[]) => normalizeOptions(opts), []);

    const calculateConfigEconomy = useCallback((product: Product, variantIds: string[]) => {
        const purchaseForeign = PricingService.calculateBundlePurchasePrice(product, variantIds, optionVariants, exchangeRates);
        const profile = PricingService.findProfile(product, pricingProfiles);
        const productVolume = product.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0;
        return PricingService.calculateSmartPrice(product, profile, exchangeRates, productVolume, purchaseForeign);
    }, [optionVariants, exchangeRates, pricingProfiles]);

    const handleProductSelect = useCallback((p: Product) => {
        setAdjProductId(p.id);
        setAdjOptions({});
        setProdSearch('');
        setIsProdDropdownOpen(false);
        
        const initOptions: Record<string, string> = {};
        if (p.type === ProductType.MACHINE && p.machineConfig) {
            p.machineConfig.forEach(mc => { 
                if (mc.defaultVariantId) {
                    initOptions[mc.typeId] = mc.defaultVariantId;
                } else if (mc.defaultVariantIds && mc.defaultVariantIds.length > 0) {
                    initOptions[mc.typeId] = mc.defaultVariantIds[0];
                }
            });
            setAdjOptions(initOptions);
        }
        
        const variantIds = Object.values(initOptions).filter(Boolean) as string[];
        const economy = calculateConfigEconomy(p, variantIds);
        setAdjUnitPrice(economy.purchaseKzt);
        setAdjSalesPrice(economy.finalPrice);
    }, [calculateConfigEconomy]);

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')), [categories]);

    const adjDisplayedCategories = useMemo(() => {
        const base = categories.filter(c => c.type === adjActiveType);
        if (adjActiveType === ProductType.MACHINE) return base;
        if (adjMachineFilter === 'all') return base;
        return base.filter(cat => products.some(p => p.type === adjActiveType && p.categoryId === cat.id && (p.compatibleMachineCategoryIds || []).includes(adjMachineFilter)));
    }, [categories, adjActiveType, adjMachineFilter, products]);

    const filteredAdjustProducts = useMemo(() => {
        return products.filter(p => {
            const matchType = p.type === adjActiveType;
            const matchMachine = adjActiveType === ProductType.MACHINE || adjMachineFilter === 'all' || (p.compatibleMachineCategoryIds || []).includes(adjMachineFilter);
            const matchCategory = adjCategoryFilter === 'all' || p.categoryId === adjCategoryFilter;
            const matchSearch = !debouncedProdSearch || (p.name || '').toLowerCase().includes(debouncedProdSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(debouncedProdSearch.toLowerCase());
            return matchType && matchMachine && matchCategory && matchSearch;
        }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
    }, [products, debouncedProdSearch, adjActiveType, adjMachineFilter, adjCategoryFilter]);

    const visibleAdjustProducts = useMemo(() => filteredAdjustProducts.slice(0, visibleProdCount), [filteredAdjustProducts, visibleProdCount]);

    const handleProdListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            if (visibleProdCount < filteredAdjustProducts.length) {
                setVisibleProdCount(prev => prev + 50);
            }
        }
    }, [visibleProdCount, filteredAdjustProducts.length]);

    const selectedProduct = useMemo(() => products.find(p => p.id === adjProductId), [adjProductId, products]);

    const handleSave = async () => {
        if (!selectedProduct) return;
        const variantIds = Object.values(adjOptions).filter(Boolean) as string[];
        const selectedVarNames = normalizeOptionsLocal(variantIds.map(vid => optionVariants.find(v => v.id === vid)?.name).filter(Boolean) as string[]);
        await actions.adjustStock(adjProductId, adjQty, adjUnitPrice * adjQty, `Ввод остатков.`, selectedVarNames, adjSalesPrice);
        setAdjProductId(''); setAdjQty(1); setAdjUnitPrice(0); setAdjSalesPrice(0); setAdjOptions({}); setProdSearch(''); setDebouncedProdSearch('');
        setTimeout(() => { setIsProdDropdownOpen(true); if (prodSearchInputRef.current) prodSearchInputRef.current.focus(); }, 100);
    };

    return (
        <div className="bg-blue-50/20 p-6 rounded-[2rem] border border-blue-100/50 shadow-sm space-y-4 animate-in fade-in relative overflow-visible mb-6">
            <div className="flex justify-between items-center gap-6">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex-none">
                    {[ProductType.MACHINE, ProductType.PART, ProductType.SERVICE].map(type => (
                        <button 
                            key={type}
                            onClick={() => { setAdjActiveType(type); setAdjMachineFilter('all'); setAdjCategoryFilter('all'); setAdjProductId(''); }}
                            className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${adjActiveType === type ? (type === ProductType.MACHINE ? 'bg-blue-600' : type === ProductType.PART ? 'bg-orange-600' : 'bg-purple-600') + ' text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {type === ProductType.MACHINE ? <Box size={14}/> : type === ProductType.PART ? <Zap size={14}/> : <Briefcase size={14}/>} {type === ProductType.MACHINE ? 'Станки' : type === ProductType.PART ? 'Запчасти' : 'Услуги'}
                        </button>
                    ))}
                </div>
                <div className="flex flex-1 justify-end gap-3">
                    {adjActiveType !== ProductType.MACHINE && (
                        <div className="w-56">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5"><Monitor size={10} className="text-blue-500"/> Совместимость</label>
                            <select className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={adjMachineFilter} onChange={e => { setAdjMachineFilter(e.target.value); setAdjCategoryFilter('all'); setAdjProductId(''); }}>
                                <option value="all">Любое оборудование</option>
                                {machineCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="w-56">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5"><Tags size={10} className={adjActiveType === ProductType.MACHINE ? "text-blue-600" : "text-orange-500"}/> Категория</label>
                        <select className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={adjCategoryFilter} onChange={e => { setAdjCategoryFilter(e.target.value); setAdjProductId(''); }}>
                            <option value="all">Все категории</option>
                            {adjDisplayedCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={24}/></button>
                </div>
            </div>
            <div className="flex gap-3 items-end">
                <div className="flex-1 relative" ref={prodRef}>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest flex items-center gap-1.5"><Search size={10} className="text-blue-500"/> Наименование или Артикул</label>
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-3 text-slate-300 pointer-events-none"/>
                        <div className="w-full flex items-center justify-between border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold cursor-pointer bg-white shadow-sm hover:border-blue-300 transition-all" onClick={() => setIsProdDropdownOpen(!isProdDropdownOpen)}>
                            <span className={selectedProduct ? 'text-slate-800' : 'text-slate-400'}>{selectedProduct ? selectedProduct.name : 'Начните подбор товара...'}</span>
                            <ChevronDown size={20} className="text-slate-300"/>
                        </div>
                    </div>
                    {isProdDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[130] max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="p-2 border-b bg-slate-50">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-2 text-slate-300" />
                                    <input ref={prodSearchInputRef} autoFocus className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" placeholder="Поиск по названию или SKU..." value={prodSearch} onChange={e => setProdSearch(e.target.value)}/>
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-56 custom-scrollbar" onScroll={handleProdListScroll}>
                                {visibleAdjustProducts.length > 0 ? visibleAdjustProducts.map(p => {
                                    const movementsForProduct = stockMovements.filter(m => m.productId === p.id);
                                    const physical = movementsForProduct.filter(m => m.statusType === 'Physical').reduce((acc, m) => acc + (m.type === 'In' ? m.quantity : -m.quantity), 0);
                                    const incoming = movementsForProduct.filter(m => m.statusType === 'Incoming').reduce((acc, m) => acc + (m.type === 'In' ? m.quantity : -m.quantity), 0);
                                    const reserved = movementsForProduct.filter(m => m.statusType === 'Reserved').reduce((acc, m) => acc + (m.type === 'In' ? m.quantity : -m.quantity), 0);
                                    const free = physical + incoming - reserved;
                                    return (
                                        <div key={p.id} onClick={() => handleProductSelect(p)} className="px-5 py-3 hover:bg-blue-50 cursor-pointer text-xs border-b last:border-0 flex justify-between items-center group transition-colors">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="font-black text-slate-700 group-hover:text-blue-700 truncate">{p.name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase mt-0.5">{p.sku}</div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div className="text-right min-w-[50px]"><div className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Склад</div><div className="text-[11px] font-black text-slate-700">{physical}</div></div>
                                                <div className="text-right min-w-[50px]"><div className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Доступно</div><div className={`text-[11px] font-black ${free <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{free}</div></div>
                                            </div>
                                        </div>
                                    );
                                }) : <div className="p-10 text-center text-slate-400 italic text-[10px] font-bold uppercase tracking-widest">Товары не найдены</div>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-20">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 text-center tracking-widest">Кол-во</label>
                    <input type="number" className="w-full bg-white border border-slate-200 px-1 py-3 rounded-2xl text-center font-black text-sm shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5" value={adjQty} onChange={e => setAdjQty(parseFloat(e.target.value) || 0)}/>
                </div>
                <div className="w-32">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Себест. ед. (KZT)</label>
                    <input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-2xl text-sm font-black text-slate-700 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5" value={adjUnitPrice} onChange={e => setAdjUnitPrice(parseFloat(e.target.value) || 0)}/>
                </div>
                <div className="w-32">
                    <label className="block text-[8px] font-black text-emerald-600 uppercase mb-1.5 ml-1 tracking-widest">Цена прод. (KZT)</label>
                    <input type="number" className="w-full bg-emerald-50/30 border border-emerald-200 p-3 rounded-2xl text-sm font-black text-emerald-700 shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/5" value={adjSalesPrice} onChange={e => setAdjSalesPrice(parseFloat(e.target.value) || 0)}/>
                </div>
                <button onClick={handleSave} disabled={!adjProductId} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 h-[50px] disabled:opacity-30 disabled:grayscale">Провести</button>
            </div>
            {selectedProduct?.type === ProductType.MACHINE && selectedProduct.machineConfig && (
                <div className="p-4 bg-white/50 rounded-2xl border border-slate-100 space-y-3 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-2"><Layers size={14} className="text-blue-500"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Конфигурация лота для ввода остатка</span></div>
                    <div className="flex flex-wrap gap-4">
                        {selectedProduct.machineConfig.map(mc => {
                            const type = optionTypes.find(t => t.id === mc.typeId);
                            if (!type) return null;
                            return (
                                <div key={mc.typeId} className="flex-1 min-w-[200px]">
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">{type.name}</label>
                                    <select
                                        className="w-full border border-slate-200 p-2 rounded-xl text-[11px] font-bold outline-none bg-white focus:ring-4 focus:ring-blue-500/5 shadow-sm"
                                        value={adjOptions[mc.typeId] || ''}
                                        onChange={e => {
                                            const newOpts = { ...adjOptions, [mc.typeId]: e.target.value };
                                            setAdjOptions(newOpts);
                                            const variantIds = Object.values(newOpts).filter(Boolean) as string[];
                                            const economy = calculateConfigEconomy(selectedProduct, variantIds);
                                            setAdjUnitPrice(economy.purchaseKzt); setAdjSalesPrice(economy.finalPrice);
                                        }}
                                    >
                                        {!type.isRequired && <option value="">-- Отсутствует --</option>}
                                        {optionVariants.filter(v => mc.allowedVariantIds.includes(v.id)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});
