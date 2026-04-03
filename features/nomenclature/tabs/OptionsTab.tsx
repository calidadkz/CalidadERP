
import React, { useState, useMemo } from 'react';
import { Product, Currency, Manufacturer, ProductType, Counterparty } from '@/types';
import { OptionType, OptionVariant } from '@/types';
import { Settings, ChevronRight, CheckSquare, Square, X, Plus, AlertCircle, Check, CheckCircle, ListChecks, Pencil, Save, User, Factory, Box, Copy, Layers } from 'lucide-react';
import { api } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { useStore } from '@/features/system/context/GlobalStore';

interface OptionsTabProps {
    formData: Partial<Product>;
    optionTypes: OptionType[];
    optionVariants: OptionVariant[];
    setFormData: (data: Partial<Product>) => void;
    addOptionType: (ot: OptionType) => Promise<void>;
    addOptionVariant: (ov: OptionVariant) => Promise<void>;
    products: Product[];
    manufacturers: Manufacturer[];
}

export const OptionsTab: React.FC<OptionsTabProps> = ({ formData, optionTypes = [], optionVariants = [], setFormData, addOptionType, addOptionVariant, products = [], manufacturers = [] }) => {
    const access = useAccess('nomenclature');
    const canWrite = access.canWrite('actions', 'edit');
    const { state, actions } = useStore();
    
    const suppliers = useMemo(() => 
        ((state?.counterparties || []) as Counterparty[]).filter(c => c.type === 'Supplier'),
    [state?.counterparties]);

    const [selectedOptionTypeId, setSelectedOptionTypeId] = useState<string | null>(null);
    const [isAddingType, setIsAddingType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeSingle, setNewTypeSingle] = useState(true);
    const [newTypeRequired, setNewTypeRequired] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [editTypeName, setEditTypeName] = useState('');
    const [editTypeSingle, setEditTypeSingle] = useState(true);
    const [editTypeRequired, setEditTypeRequired] = useState(false);
    const [isAddingVariant, setIsAddingVariant] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [variantFormData, setVariantFormData] = useState<Partial<OptionVariant>>({
        name: '', supplierProductName: '', description: '', price: 0, currency: Currency.Cny, 
        composition: [], supplierId: '', manufacturer: '', lengthMm: 0, widthMm: 0, heightMm: 0
    });
    const [compProductId, setCompProductId] = useState('');
    const [compQty, setCompQty] = useState(1);
    const [isOtherExpanded, setIsOtherExpanded] = useState(false);

    // СТРОГАЯ ФИЛЬТРАЦИЯ ТИПОВ ОПЦИЙ
    const availableOptionTypes = useMemo(() => {
        return (optionTypes || []).filter(ot => {
            // Если тип жестко привязан к категории
            if (ot.categoryId && ot.categoryId === formData.categoryId) return true;
            
            // Если тип общий, но у него есть варианты именно для этой категории
            if (!ot.categoryId) {
                return (optionVariants || []).some(v => 
                    v.typeId === ot.id && v.categoryId === formData.categoryId
                );
            }
            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [optionTypes, optionVariants, formData.categoryId]);

    const toggleOptionTypeEnabled = (typeId: string) => {
        if (!canWrite) return;
        const currentConfig = formData.machineConfig || [];
        const exists = currentConfig.find(c => c.typeId === typeId);
        if (exists) {
            setFormData({ ...formData, machineConfig: currentConfig.filter(c => c.typeId !== typeId) });
            if (selectedOptionTypeId === typeId) setSelectedOptionTypeId(null);
        } else {
            setFormData({ ...formData, machineConfig: [...currentConfig, { typeId, allowedVariantIds: [], priceOverrides: {} }] });
            setSelectedOptionTypeId(typeId);
        }
    };

    const handleSelectAllVariants = (filter?: 'native' | 'other') => {
        if (!canWrite || !selectedOptionTypeId) return;
        
        // СТРОГО: Берем только те варианты, которые относятся к текущему ТИПУ и КАТЕГОРИИ СТАНКА
        const variantsOfType = (optionVariants || []).filter(v => 
            v.typeId === selectedOptionTypeId && 
            v.categoryId === formData.categoryId
        );

        let targetVariants = variantsOfType;
        if (filter === 'native') {
            targetVariants = variantsOfType.filter(v => v.supplierId === formData.supplierId);
        } else if (filter === 'other') {
            targetVariants = variantsOfType.filter(v => v.supplierId !== formData.supplierId);
        }
        
        const targetIds = targetVariants.map(v => v.id);
        const currentConfig = [...(formData.machineConfig || [])];
        const typeIdx = currentConfig.findIndex(c => c.typeId === selectedOptionTypeId);
        
        if (typeIdx > -1) {
            const currentAllowed = currentConfig[typeIdx].allowedVariantIds || [];
            const allSelected = targetVariants.every(v => currentAllowed.includes(v.id));
            let newAllowed = allSelected 
                ? currentAllowed.filter(id => !targetIds.includes(id)) 
                : Array.from(new Set([...currentAllowed, ...targetIds]));
            
            currentConfig[typeIdx] = { ...currentConfig[typeIdx], allowedVariantIds: newAllowed };
        } else {
            currentConfig.push({ typeId: selectedOptionTypeId, allowedVariantIds: targetIds, priceOverrides: {} });
        }
        setFormData({ ...formData, machineConfig: currentConfig });
    };

    const toggleAllowedVariant = (typeId: string, variantId: string) => {
        if (!canWrite) return;
        const currentConfig = formData.machineConfig || [];
        const config = currentConfig.find(c => c.typeId === typeId) || { typeId, allowedVariantIds: [], priceOverrides: {} };
        const currentAllowed = config.allowedVariantIds || [];
        const newAllowed = currentAllowed.includes(variantId) 
            ? currentAllowed.filter(id => id !== variantId) 
            : [...currentAllowed, variantId];
        
        const updatedConfig = currentConfig.map(c => c.typeId === typeId ? { ...c, allowedVariantIds: newAllowed } : c);
        if (!currentConfig.find(c => c.typeId === typeId)) {
            updatedConfig.push({ typeId, allowedVariantIds: newAllowed, priceOverrides: {} });
        }
        setFormData({ ...formData, machineConfig: updatedConfig });
    };

    const updatePriceOverride = (typeId: string, variantId: string, price: number | undefined) => {
        if (!canWrite) return;
        const currentConfig = formData.machineConfig || [];
        const config = currentConfig.find(c => c.typeId === typeId);
        if (!config) return;
        const newOverrides = { ...config.priceOverrides };
        if (price === undefined) delete newOverrides[variantId];
        else newOverrides[variantId] = price;
        setFormData({ ...formData, machineConfig: currentConfig.map(c => c.typeId === typeId ? { ...c, priceOverrides: newOverrides } : c) });
    };

    const handleSaveVariant = async () => {
        if (!canWrite || !variantFormData.name || !selectedOptionTypeId) return;
        const ovData: OptionVariant = {
            id: editingVariantId || api.generateId('OV'),
            typeId: selectedOptionTypeId,
            categoryId: formData.categoryId || '',
            name: variantFormData.name || '',
            supplierProductName: variantFormData.supplierProductName || '',
            description: variantFormData.description || '',
            price: variantFormData.price || 0,
            currency: variantFormData.currency || Currency.Cny,
            composition: variantFormData.composition || [],
            supplierId: variantFormData.supplierId || formData.supplierId || '',
            manufacturer: variantFormData.manufacturer || '',
            lengthMm: variantFormData.lengthMm || 0,
            widthMm: variantFormData.widthMm || 0,
            heightMm: variantFormData.heightMm || 0,
            volumeM3: ((variantFormData.lengthMm || 0) * (variantFormData.widthMm || 0) * (variantFormData.heightMm || 0)) / 1_000_000_000
        };
        if (editingVariantId) await actions.updateOptionVariant(ovData);
        else {
            await addOptionVariant(ovData);
            toggleAllowedVariant(selectedOptionTypeId, ovData.id);
        }
        setIsAddingVariant(false); setEditingVariantId(null);
    };

    const toggleDefaultVariant = (typeId: string, variantId: string, isSingleSelect: boolean) => {
        if (!canWrite) return;
        const currentConfig = formData.machineConfig || [];
        const typeConfig = currentConfig.find(c => c.typeId === typeId);
        if (!typeConfig) return;
        
        let newDefId = typeConfig.defaultVariantId;
        let newDefIds = typeConfig.defaultVariantIds || [];
        
        if (isSingleSelect) {
            newDefId = newDefId === variantId ? undefined : variantId;
            newDefIds = [];
        } else {
            newDefIds = newDefIds.includes(variantId) 
                ? newDefIds.filter(id => id !== variantId) 
                : [...newDefIds, variantId];
            newDefId = undefined;
        }
        
        setFormData({ 
            ...formData, 
            machineConfig: currentConfig.map(mc => mc.typeId === typeId 
                ? { ...mc, defaultVariantId: newDefId, defaultVariantIds: newDefIds } 
                : mc
            ) 
        });
    };

    const canSeePurchase = access.canSee('fields', 'basePrice');

    return (
        <div className="flex h-full bg-white animate-in fade-in duration-300">
            {/* Sidebar - Option Types */}
            <div className="w-[300px] bg-white border-r border-slate-200 flex flex-col h-full z-10">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Типы опций</span>
                    {formData.categoryId && canWrite && (
                        <button onClick={() => setIsAddingType(!isAddingType)} className={`text-[9px] px-2 py-1 rounded-md border font-black uppercase tracking-tighter transition-all ${isAddingType ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
                            {isAddingType ? <X size={12}/> : '+ ТИП'}
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {availableOptionTypes.map(ot => {
                        const config = formData.machineConfig?.find(c => c.typeId === ot.id);
                        const isActive = selectedOptionTypeId === ot.id;
                        return (
                            <div key={ot.id} onClick={() => { setSelectedOptionTypeId(ot.id); if (!config && canWrite) toggleOptionTypeEnabled(ot.id); }} 
                                 className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center group ${isActive ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}>
                                <div className={`mr-3 ${config ? 'text-blue-600' : 'text-slate-300'}`} onClick={(e) => { e.stopPropagation(); if(canWrite) toggleOptionTypeEnabled(ot.id); }}>
                                    {config ? <CheckSquare size={16}/> : <Square size={16}/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold truncate text-slate-700">{ot.name}</div>
                                    <div className="flex gap-1 mt-0.5"><span className="text-[7px] px-1 rounded bg-slate-100 text-slate-500 uppercase font-black">{ot.isSingleSelect ? 'Один' : 'Много'}</span></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50/30 flex flex-col h-full overflow-hidden">
                {selectedOptionTypeId ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="px-6 py-3 bg-white border-b flex justify-between items-center shadow-sm">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                {(optionTypes || []).find(t => t.id === selectedOptionTypeId)?.name}
                            </h3>
                            {canWrite && (
                                <button
                                    onClick={() => {
                                        if (isAddingVariant) {
                                            setIsAddingVariant(false);
                                            setEditingVariantId(null);
                                            setVariantFormData({ name: '', supplierProductName: '', description: '', price: 0, currency: Currency.Cny, composition: [], supplierId: '', manufacturer: '', lengthMm: 0, widthMm: 0, heightMm: 0 });
                                        } else {
                                            setIsAddingVariant(true);
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-black text-[10px] uppercase transition-all ${isAddingVariant ? 'bg-red-50 border-red-200 text-red-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'}`}
                                >
                                    {isAddingVariant ? <X size={14}/> : <Plus size={14}/>} {isAddingVariant ? 'ОТМЕНА' : 'ДОБАВИТЬ ВАРИАНТ'}
                                </button>
                            )}
                        </div>

                        {/* Форма добавления / редактирования варианта */}
                        {isAddingVariant && (
                            <div className="mx-6 mt-4 mb-2 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200 shrink-0">
                                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                    {editingVariantId ? 'Редактировать вариант' : 'Новый вариант'}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Название *</label>
                                        <input
                                            className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                                            placeholder="Название варианта..."
                                            value={variantFormData.name || ''}
                                            onChange={e => setVariantFormData({ ...variantFormData, name: e.target.value })}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Наим. у поставщика</label>
                                        <input
                                            className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                                            placeholder="Артикул / наименование"
                                            value={variantFormData.supplierProductName || ''}
                                            onChange={e => setVariantFormData({ ...variantFormData, supplierProductName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Поставщик</label>
                                        <select
                                            className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white"
                                            value={variantFormData.supplierId || ''}
                                            onChange={e => setVariantFormData({ ...variantFormData, supplierId: e.target.value })}
                                        >
                                            <option value="">— Поставщик —</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Производитель</label>
                                        <input
                                            className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                                            placeholder="Производитель"
                                            value={variantFormData.manufacturer || ''}
                                            onChange={e => setVariantFormData({ ...variantFormData, manufacturer: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Цена закупки</label>
                                        <div className="flex h-[38px]">
                                            <input
                                                type="number"
                                                className="w-full p-2.5 rounded-l-xl border border-indigo-200 text-xs font-black outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                                                value={variantFormData.price || 0}
                                                onChange={e => setVariantFormData({ ...variantFormData, price: parseFloat(e.target.value) || 0 })}
                                            />
                                            <select
                                                className="w-20 p-2 rounded-r-xl border-y border-r border-indigo-200 text-[10px] font-black bg-slate-50 outline-none"
                                                value={variantFormData.currency || Currency.Cny}
                                                onChange={e => setVariantFormData({ ...variantFormData, currency: e.target.value as Currency })}
                                            >
                                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Габариты мм (Д × Ш × В)</label>
                                        <div className="flex gap-1">
                                            <input type="number" className="flex-1 p-2 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white text-center" placeholder="Д" value={variantFormData.lengthMm || ''} onChange={e => setVariantFormData({ ...variantFormData, lengthMm: parseFloat(e.target.value) || 0 })}/>
                                            <input type="number" className="flex-1 p-2 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white text-center" placeholder="Ш" value={variantFormData.widthMm || ''} onChange={e => setVariantFormData({ ...variantFormData, widthMm: parseFloat(e.target.value) || 0 })}/>
                                            <input type="number" className="flex-1 p-2 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white text-center" placeholder="В" value={variantFormData.heightMm || ''} onChange={e => setVariantFormData({ ...variantFormData, heightMm: parseFloat(e.target.value) || 0 })}/>
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Описание</label>
                                        <textarea
                                            className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10 resize-none"
                                            rows={2}
                                            placeholder="Описание варианта..."
                                            value={variantFormData.description || ''}
                                            onChange={e => setVariantFormData({ ...variantFormData, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        onClick={() => { setIsAddingVariant(false); setEditingVariantId(null); setVariantFormData({ name: '', supplierProductName: '', description: '', price: 0, currency: Currency.Cny, composition: [], supplierId: '', manufacturer: '', lengthMm: 0, widthMm: 0, heightMm: 0 }); }}
                                        className="px-4 py-2 text-slate-400 hover:text-slate-600 font-black text-xs uppercase tracking-widest transition-colors"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={handleSaveVariant}
                                        disabled={!variantFormData.name?.trim()}
                                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-30 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                    >
                                        <Save size={14}/> {editingVariantId ? 'Сохранить' : 'Добавить'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Список вариантов */}
                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="p-3 text-center w-14">Вкл</th>
                                            <th className="p-3 text-center w-16">База</th>
                                            <th className="p-3 text-left">Вариант / Характеристики</th>
                                            {canSeePurchase && <th className="p-3 text-right w-32">Цена (закуп)</th>}
                                            <th className="p-3 text-right w-36">Спец. цена (KZT)</th>
                                            <th className="p-3 w-14"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            // СТРОГО: Только варианты ЭТОЙ категории
                                            const variantsOfType = (optionVariants || []).filter(v => 
                                                v.typeId === selectedOptionTypeId && 
                                                v.categoryId === formData.categoryId
                                            );
                                            
                                            const config = formData.machineConfig?.find(c => c.typeId === selectedOptionTypeId);
                                            const currentAllowed = config?.allowedVariantIds || [];
                                            const typeObj = (optionTypes || []).find(t => t.id === selectedOptionTypeId);
                                            const isSingle = typeObj?.isSingleSelect ?? true;

                                            return variantsOfType.map(v => {
                                                const isAllowed = currentAllowed.includes(v.id);
                                                const isDefault = isSingle ? config?.defaultVariantId === v.id : !!config?.defaultVariantIds?.includes(v.id);
                                                const override = config?.priceOverrides?.[v.id];
                                                
                                                return (
                                                    <tr key={v.id} className={`group transition-all ${isAllowed ? 'bg-white hover:bg-blue-50/20' : 'bg-slate-50/50 opacity-60'}`}>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => toggleAllowedVariant(selectedOptionTypeId!, v.id)} 
                                                                    className={`p-1.5 rounded-lg border-2 transition-all ${isAllowed ? 'border-blue-500 bg-blue-600 text-white shadow-sm' : 'border-slate-200 text-transparent bg-white hover:border-slate-300'}`}>
                                                                <Check size={12}/>
                                                            </button>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {isAllowed && (
                                                                <button onClick={() => toggleDefaultVariant(selectedOptionTypeId!, v.id, isSingle)} 
                                                                        className={`p-1.5 rounded-full transition-all ${isDefault ? 'bg-amber-100 text-amber-600 border border-amber-200 shadow-sm' : 'text-slate-200 hover:text-amber-400 hover:bg-amber-50'}`}>
                                                                    <CheckCircle size={18}/>
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-slate-800 leading-tight">{v.name}</span>
                                                                <div className="flex gap-2 mt-1">
                                                                    <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">{v.manufacturer || 'Без произв.'}</span>
                                                                    {v.lengthMm > 0 && <span className="text-[8px] font-black bg-blue-50 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">{v.lengthMm}x{v.widthMm}x{v.heightMm}</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {canSeePurchase && <td className="p-3 text-right text-[10px] font-black font-mono text-slate-700">{v.price.toLocaleString()} {v.currency}</td>}
                                                        <td className="p-3 text-right">
                                                            {isAllowed && (
                                                                <input type="number" 
                                                                       className={`w-32 border rounded-lg px-2 py-1.5 text-right font-black text-[11px] outline-none transition-all ${override !== undefined ? 'border-blue-400 bg-blue-50 text-blue-800 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`} 
                                                                       placeholder={v.price.toString()} 
                                                                       value={override !== undefined ? override : ''} 
                                                                       onChange={e => updatePriceOverride(selectedOptionTypeId!, v.id, e.target.value === '' ? undefined : parseFloat(e.target.value))} />
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setEditingVariantId(v.id); setVariantFormData(v); setIsAddingVariant(true); }} className="p-1.5 text-slate-300 hover:text-blue-600"><Pencil size={14}/></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                                {optionVariants.filter(v => v.typeId === selectedOptionTypeId && v.categoryId === formData.categoryId).length === 0 && (
                                    <div className="py-12 text-center flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-200"><Box size={24}/></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Варианты для этой категории не найдены</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40">
                        <Settings size={48} className="mb-4 animate-spin-slow"/>
                        <p className="font-black uppercase tracking-[0.2em] text-[10px]">Выберите группу опций в левой колонке</p>
                    </div>
                )}
            </div>
        </div>
    );
};
