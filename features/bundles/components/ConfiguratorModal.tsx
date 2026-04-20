
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Currency, OptionVariant, PricingProfile, OptionType, Bundle, StockMovement } from '@/types';
import { X, Settings, Layers, Calculator, Zap, Check } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { PricingService } from '@/services/PricingService';
import { useAccess } from '@/features/auth/hooks/useAccess';

interface ConfiguratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'procurement' | 'sales';
    baseMachine: Product;
    onApply: (data: { name: string, price: number, currency: Currency, config: string[], selectedVariantIds?: string[] }) => void;
}

export const ConfiguratorModal: React.FC<ConfiguratorModalProps> = ({ 
    isOpen, onClose, mode, baseMachine, onApply 
}) => {
    const { state } = useStore();
    const { optionTypes = [], optionVariants = [], bundles = [], stockMovements = [], exchangeRates = {} as Record<string, number>, pricingProfiles = [] } = state;
    const access = useAccess('nomenclature');
    const canSeePricingDetails = access.canSee('fields', 'pricingDetails');

    const [configTab, setConfigTab] = useState<'manual' | 'favorites' | 'warehouse'>('manual');
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const defaults: Record<string, string[]> = {};
        if (baseMachine && baseMachine.machineConfig) {
            baseMachine.machineConfig.forEach(c => {
                if (c.defaultVariantIds && c.defaultVariantIds.length > 0) {
                    defaults[c.typeId] = c.defaultVariantIds;
                } else if (c.defaultVariantId) {
                    defaults[c.typeId] = [c.defaultVariantId];
                }
            });
        }
        setSelectedOptions(defaults);
    }, [baseMachine, isOpen]);

    const f = (val: number) => Math.round(val).toLocaleString();

    const toggleOption = (typeId: string, variantId: string, isSingle: boolean) => {
        setSelectedOptions(prev => {
            const current = prev[typeId] || [];
            if (isSingle) {
                return { ...prev, [typeId]: [variantId] };
            } else {
                if (current.includes(variantId)) return { ...prev, [typeId]: current.filter(id => id !== variantId) };
                return { ...prev, [typeId]: [...current, variantId] };
            }
        });
    };
    
    const bundleTotals = useMemo(() => {
        if (!baseMachine) return { purchaseTotal: 0, totalVolume: 0 };
        
        const selectedVariantIds = Object.values(selectedOptions).flat();
        
        const purchaseTotal = PricingService.calculateBundlePurchasePrice(
            baseMachine,
            selectedVariantIds,
            optionVariants,
            exchangeRates as any
        );

        const totalVolume = PricingService.calculateBundleVolume(
            baseMachine,
            selectedVariantIds,
            optionVariants
        );
    
        return { purchaseTotal, totalVolume };
    }, [baseMachine, selectedOptions, optionVariants, optionTypes, exchangeRates]);

    const currentEconomy = useMemo(() => {
        if (!baseMachine) return { finalPrice: 0, currency: Currency.Usd, details: null };

        if (mode === 'procurement') {
            return { finalPrice: bundleTotals.purchaseTotal, currency: baseMachine.currency, details: null };
        } else {
            const profile = PricingService.findProfile(baseMachine, pricingProfiles);
            const data = PricingService.calculateSmartPrice(baseMachine, profile, exchangeRates as any, bundleTotals.totalVolume, bundleTotals.purchaseTotal);
            return { finalPrice: data.finalPrice, currency: Currency.Kzt, details: data };
        }
    }, [baseMachine, mode, exchangeRates, pricingProfiles, bundleTotals]);

    const getUniqueStockConfigs = (productId: string) => {
        const configs: Record<string, { names: string[], physical: number, incoming: number, reserved: number }> = {};
        
        (stockMovements || [])
            .filter(m => m.productId === productId)
            .forEach(m => {
                const key = (m.configuration || []).sort().join('|') || 'BASE';
                if (!configs[key]) configs[key] = { names: m.configuration || [], physical: 0, incoming: 0, reserved: 0 };
                
                const qty = Number(m.quantity) || 0;
                const change = m.type === 'In' ? qty : -qty;

                if (m.statusType === 'Physical') configs[key].physical += change;
                else if (m.statusType === 'Incoming') configs[key].incoming += change;
                else if (m.statusType === 'Reserved') configs[key].reserved += change;
            });

        return Object.values(configs).filter(c => 
            Math.abs(c.physical) > 0.001 || Math.abs(c.incoming) > 0.001 || Math.abs(c.reserved) > 0.001
        );
    };

    const handleFinalApply = () => {
        const selectedVariantIds = Object.values(selectedOptions).flat();
        const configNames = selectedVariantIds
            .map(vid => optionVariants.find(v => v.id === vid)?.name || '')
            .filter(Boolean);
        
        onApply({
            name: baseMachine.name,
            price: currentEconomy.finalPrice,
            currency: currentEconomy.currency,
            config: configNames,
            selectedVariantIds: selectedVariantIds
        });
    };

    const allowedOptionTypes = useMemo(() => {
        if (!baseMachine || !baseMachine.machineConfig) return [];
        return optionTypes.filter(ot => 
            baseMachine.machineConfig?.some(mc => mc.typeId === ot.id)
        );
    }, [baseMachine, optionTypes]);

    if (!isOpen || !baseMachine) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-white/20">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center flex-none">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl text-white shadow-lg ${mode === 'sales' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                            <Settings size={28}/>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                {mode === 'sales' ? 'Конфигурация для продажи' : 'Конфигурация для закупки'}
                            </span>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">
                                {baseMachine.name}
                            </h3>
                            <div className="flex bg-slate-200 p-1 rounded-xl mt-4 w-fit shadow-inner">
                                <button onClick={() => setConfigTab('manual')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${configTab === 'manual' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Вручную</button>
                                <button onClick={() => setConfigTab('favorites')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${configTab === 'favorites' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Шаблоны</button>
                                <button onClick={() => setConfigTab('warehouse')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${configTab === 'warehouse' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Со склада</button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={28}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-white">
                    {configTab === 'manual' && (
                        allowedOptionTypes.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-center p-10 opacity-30">
                                <Zap size={48} className="mb-4 text-slate-300"/>
                                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Для этой модели нет настраиваемых опций</p>
                            </div>
                        ) : allowedOptionTypes.map(type => {
                            const configEntry = baseMachine.machineConfig?.find(mc => mc.typeId === type.id);
                            const allowedVarIds = configEntry?.allowedVariantIds || [];
                            const machineCatId = baseMachine.categoryId ?? '';
                            const effectiveSingle = type.categoryOverrides?.[machineCatId]?.isSingleSelect ?? type.isSingleSelect;

                            return (
                                <div key={type.id} className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Layers size={14}/> {type.name}
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {optionVariants
                                            .filter(v => v.typeId === type.id && allowedVarIds.includes(v.id))
                                            .map(variant => {
                                                const isSelected = selectedOptions[type.id]?.includes(variant.id);
                                                const price = configEntry?.priceOverrides?.[variant.id] ?? variant.price;

                                                return (
                                                    <div key={variant.id} onClick={() => toggleOption(type.id, variant.id, effectiveSingle)}
                                                        className={`px-4 py-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between group ${isSelected ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-50' : 'border-slate-50 hover:border-slate-200 bg-white'}`}>
                                                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-800' : 'text-slate-600'}`}>{variant.name}</span>
                                                        {(canSeePricingDetails || mode === 'procurement') && (
                                                            <span className={`text-[10px] font-black font-mono ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                                                               {f(price)} {variant.currency}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {configTab === 'favorites' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {bundles.filter(b => b.baseProductId === baseMachine.id).map(b => {
                                const selectedIds = b.selectedVariantIds;
                                const purchasePrice = PricingService.calculateBundlePurchasePrice(baseMachine, selectedIds, optionVariants, exchangeRates as any);
                                
                                let dispPrice = purchasePrice;
                                let dispCurr = baseMachine.currency;
                                
                                if (mode === 'sales') {
                                    const totalVol = PricingService.calculateBundleVolume(baseMachine, selectedIds, optionVariants);
                                    const profile = PricingService.findProfile(baseMachine, pricingProfiles);
                                    const economy = PricingService.calculateSmartPrice(baseMachine, profile, exchangeRates as any, totalVol, purchasePrice);
                                    dispPrice = economy.finalPrice;
                                    dispCurr = Currency.Kzt;
                                }

                                return (
                                <div key={b.id} onClick={() => onApply({ name: b.name, price: dispPrice, currency: dispCurr, config: b.selectedVariantIds.map(vid => optionVariants.find(ov => ov.id === vid)?.name || ''), selectedVariantIds: b.selectedVariantIds })} 
                                     className="p-5 bg-white border border-slate-100 rounded-[1.5rem] hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg group relative flex flex-col min-h-[160px]">
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <h4 className="font-black text-slate-800 text-sm leading-tight flex-1">{b.name}</h4>
                                        <div className="bg-blue-600 text-white px-2 py-0.5 rounded-lg font-black text-[10px] shadow-sm whitespace-nowrap">
                                            {f(dispPrice)} {dispCurr}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {b.selectedVariantIds.map(vid => (
                                            <span key={vid} className="px-1.5 py-0.5 bg-blue-50 text-[8px] font-bold text-blue-600 rounded-md border border-blue-100">
                                                {optionVariants.find(ov => ov.id === vid)?.name}
                                            </span>
                                        ))}
                                    </div>
                                    {b.description && <p className="mt-4 text-[10px] text-slate-400 italic line-clamp-2">{b.description}</p>}
                                </div>
                                );
                            })}
                        </div>
                    )}

                    {configTab === 'warehouse' && (
                        <div className="space-y-3">
                            {getUniqueStockConfigs(baseMachine.id).map((conf, idx) => {
                                const free = conf.physical + conf.incoming - conf.reserved;
                                const selectedIds = conf.names.map(n => optionVariants.find(ov => ov.name === n)?.id).filter(Boolean) as string[];

                                const purchasePrice = PricingService.calculateBundlePurchasePrice(baseMachine, selectedIds, optionVariants, exchangeRates as any);
                                
                                let dispPrice = purchasePrice;
                                let dispCurr = baseMachine.currency;
                                
                                if (mode === 'sales') {
                                    const totalVol = PricingService.calculateBundleVolume(baseMachine, selectedIds, optionVariants);
                                    const profile = PricingService.findProfile(baseMachine, pricingProfiles);
                                    const economy = PricingService.calculateSmartPrice(baseMachine, profile, exchangeRates as any, totalVol, purchasePrice);
                                    dispPrice = economy.finalPrice;
                                    dispCurr = Currency.Kzt;
                                }

                                return (
                                    <div key={idx} onClick={() => onApply({ name: baseMachine.name, price: dispPrice, currency: dispCurr, config: conf.names, selectedVariantIds: selectedIds })} 
                                         className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all">
                                        <div className="flex flex-col gap-3 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-100 divide-x divide-slate-200">
                                                    <div className="px-2 text-center"><div className="text-[7px] font-black text-slate-500 uppercase">На складе</div><div className="text-[10px] font-black text-slate-700">{conf.physical}</div></div>
                                                    <div className="px-2 text-center"><div className="text-[7px] font-black text-slate-500 uppercase">Ожидается</div><div className="text-[10px] font-black text-slate-700">{conf.incoming}</div></div>
                                                    <div className="px-2 text-center"><div className="text-[7px] font-black text-slate-500 uppercase">Резерв</div><div className="text-[10px] font-black text-slate-700">{conf.reserved}</div></div>
                                                    <div className={`px-2 text-center transition-colors ${free > 0 ? 'bg-emerald-50' : free < 0 ? 'bg-red-50' : ''}`}><div className={`text-[7px] font-black uppercase ${free > 0 ? 'text-emerald-600' : free < 0 ? 'text-red-600' : 'text-slate-500'}`}>Свободно</div><div className={`text-[10px] font-black ${free > 0 ? 'text-emerald-700' : free < 0 ? 'text-red-700' : 'text-slate-700'}`}>{free}</div></div>
                                                </div>
                                                <div className="flex flex-wrap gap-1 ml-2">
                                                    {conf.names.length === 0 ? <span className="text-[10px] font-bold text-slate-400 italic">Базовая комплектация</span> : conf.names.map((c, i) => <span key={i} className="px-2 py-0.5 bg-blue-50 text-[10px] font-bold text-blue-700 rounded-md border border-blue-100">{c}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right ml-6">
                                            <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5">{mode === 'sales' ? 'Цена продажи' : 'Себестоимость'}</div>
                                            <div className="text-lg font-black text-blue-700 font-mono tracking-tighter whitespace-nowrap">{f(dispPrice)} <span className="text-xs font-medium opacity-50">{dispCurr}</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-8 py-6 border-t bg-slate-900 text-white flex justify-between items-center shadow-2xl relative overflow-hidden flex-none">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Calculator size={120}/></div>
                    <div className="relative z-10 flex items-center gap-8 flex-1 overflow-hidden">
                        <div>
                            <span className="text-[8px] font-black uppercase text-blue-400 tracking-[0.2em] mb-1.5 block">
                                {mode === 'sales' ? 'Итоговая цена (IPP)' : 'Заводская цена (EXW)'}
                            </span>
                            <div className="text-3xl font-black tracking-tighter whitespace-nowrap">
                                {f(currentEconomy.finalPrice)} <span className="text-lg font-light opacity-50">{currentEconomy.currency}</span>
                            </div>
                        </div>
                        {mode === 'sales' && currentEconomy.details && (
                            <div className="flex items-center gap-6 border-l border-white/10 pl-6 flex-1 overflow-hidden">
                                <div className="min-w-0"><span className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Прибыль</span><div className="text-sm font-black text-emerald-400 truncate">+{f(currentEconomy.details.netProfit)} <span className="text-[9px] opacity-60">₸</span></div></div>
                                {canSeePricingDetails && (<>
                                    <div className="w-px h-8 bg-white/5 flex-none"/>
                                    <div className="min-w-0"><span className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Себестоимость</span><div className="text-sm font-black text-blue-300 truncate">{f(currentEconomy.details.purchaseKzt)} <span className="text-[9px] opacity-60">₸</span></div></div>
                                    <div className="w-px h-8 bg-white/5 flex-none"/>
                                    <div className="min-w-0"><span className="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Доп. расходы</span><div className="text-sm font-black text-orange-400 truncate">+{f(currentEconomy.details.totalExpenses - currentEconomy.details.purchaseKzt)} <span className="text-[9px] opacity-60">₸</span></div></div>
                                    <div className="w-px h-8 bg-white/5 flex-none"/>
                                    <div className="bg-slate-800/40 px-3 py-1.5 rounded-lg border border-white/5 min-w-0"><span className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Полная себестоимость</span><div className="text-sm font-black text-white truncate">{f(currentEconomy.details.totalExpenses)} <span className="text-[9px] opacity-60">₸</span></div></div>
                                </>)}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 relative z-10 flex-none ml-6">
                        <button onClick={onClose} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors uppercase text-[10px] tracking-widest">Отмена</button>
                        <button onClick={handleFinalApply} className={`hover:bg-opacity-90 text-white px-8 py-3 rounded-xl font-black shadow-xl uppercase tracking-widest text-xs transition-all active:scale-95 ${mode === 'sales' ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-blue-600 shadow-blue-900/20'}`}>
                            {mode === 'sales' ? 'Подтвердить' : 'В закупку'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
