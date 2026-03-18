
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
    
    // ФИЛЬТРУЕМ ПОСТАВЩИКОВ ИЗ КОНТРАГЕНТОВ
    const suppliers = useMemo(() => 
        ((state?.counterparties || []) as Counterparty[]).filter(c => c.type === 'Supplier'),
    [state?.counterparties]);

    const [selectedOptionTypeId, setSelectedOptionTypeId] = useState<string | null>(null);
    
    // Type Creation State
    const [isAddingType, setIsAddingType] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeSingle, setNewTypeSingle] = useState(true);
    const [newTypeRequired, setNewTypeRequired] = useState(false);

    // Type Editing State
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [editTypeName, setEditTypeName] = useState('');
    const [editTypeSingle, setEditTypeSingle] = useState(true);
    const [editTypeRequired, setEditTypeRequired] = useState(false);

    // Variant Form State
    const [isAddingVariant, setIsAddingVariant] = useState(false);
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [variantFormData, setVariantFormData] = useState<Partial<OptionVariant>>({
        name: '', supplierProductName: '', description: '', price: 0, currency: Currency.CNY, 
        composition: [], supplierId: '', manufacturer: '', lengthMm: 0, widthMm: 0, heightMm: 0
    });

    const [compProductId, setCompProductId] = useState('');
    const [compQty, setCompQty] = useState(1);
    const [isOtherExpanded, setIsOtherExpanded] = useState(false);

    // ФИЛЬТРАЦИЯ ГРУПП ОПЦИЙ
    const availableOptionTypes = (optionTypes || []).filter(ot => {
        if (ot.categoryId && ot.categoryId === formData.categoryId) return true;
        if (!ot.categoryId) {
            const hasMatchingVariant = (optionVariants || []).some(v => 
                v.typeId === ot.id && v.categoryId === formData.categoryId
            );
            if (hasMatchingVariant) return true;
        }
        return false;
    });

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

    const handleSelectAllTypes = () => {
        if (!canWrite) return;
        const currentConfig = [...(formData.machineConfig || [])];
        let changed = false;
        availableOptionTypes.forEach(ot => {
            if (!currentConfig.find(c => c.typeId === ot.id)) {
                currentConfig.push({ typeId: ot.id, allowedVariantIds: [], priceOverrides: {} });
                changed = true;
            }
        });
        if (changed) setFormData({ ...formData, machineConfig: currentConfig });
    };

    const handleSelectAllVariants = (filter?: 'native' | 'other') => {
        if (!canWrite || !selectedOptionTypeId) return;
        const variantsOfType = (optionVariants || []).filter(v => v.typeId === selectedOptionTypeId && v.categoryId === formData.categoryId);
        let targetVariants = variantsOfType;
        if (filter === 'native') {
            targetVariants = variantsOfType.filter(v => v.supplierId === formData.supplierId && v.manufacturer === formData.manufacturer);
        } else if (filter === 'other') {
            targetVariants = variantsOfType.filter(v => v.supplierId !== formData.supplierId || v.manufacturer !== formData.manufacturer);
        }
        const targetIds = targetVariants.map(v => v.id);
        const currentConfig = [...(formData.machineConfig || [])];
        const typeIdx = currentConfig.findIndex(c => c.typeId === selectedOptionTypeId);
        if (typeIdx > -1) {
            const currentAllowed = currentConfig[typeIdx].allowedVariantIds || [];
            const allSelected = targetVariants.every(v => currentAllowed.includes(v.id));
            let newAllowed = allSelected ? currentAllowed.filter(id => !targetIds.includes(id)) : Array.from(new Set([...currentAllowed, ...targetIds]));
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
        const newAllowed = currentAllowed.includes(variantId) ? currentAllowed.filter(id => id !== variantId) : [...currentAllowed, variantId];
        const updatedConfig = currentConfig.map(c => c.typeId === typeId ? { ...c, allowedVariantIds: newAllowed } : c);
        if (!currentConfig.find(c => c.typeId === typeId)) updatedConfig.push({ typeId, allowedVariantIds: newAllowed, priceOverrides: {} });
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
            id: editingVariantId || ApiService.generateId(),
            typeId: selectedOptionTypeId,
            categoryId: formData.categoryId,
            name: variantFormData.name || '',
            supplierProductName: variantFormData.supplierProductName || '',
            description: variantFormData.description || '',
            price: variantFormData.price || 0,
            currency: variantFormData.currency || Currency.CNY,
            composition: variantFormData.composition || [],
            supplierId: variantFormData.supplierId || formData.supplierId || '', // Всегда фиксируем поставщика станка
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

    const addBOMItem = () => {
        if (!compProductId) return;
        const current = variantFormData.composition || [];
        const existing = current.findIndex(i => i.productId === compProductId);
        if (existing > -1) {
            const updated = [...current];
            updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + compQty };
            setVariantFormData({ ...variantFormData, composition: updated });
        } else {
            setVariantFormData({ ...variantFormData, composition: [...current, { productId: compProductId, quantity: compQty }] });
        }
        setCompProductId(''); setCompQty(1);
    };

    const handleCopyVariant = async (v: OptionVariant) => {
        const copy: OptionVariant = { ...v, id: ApiService.generateId(), name: `${v.name} (Копия)` };
        await addOptionVariant(copy);
        if (formData.machineConfig?.find(c => c.typeId === v.typeId)?.allowedVariantIds?.includes(v.id)) {
            toggleAllowedVariant(v.typeId, copy.id);
        }
    };

    const startEditingVariant = (v: OptionVariant) => {
        setEditingVariantId(v.id);
        setVariantFormData({ ...v });
        setIsAddingVariant(true);
    };

    const handleQuickAddOptionType = async () => {
        if (!canWrite || !newTypeName.trim() || !formData.categoryId) return;
        const newType: OptionType = { id: ApiService.generateId(), name: newTypeName.trim(), isRequired: newTypeRequired, isSingleSelect: newTypeSingle, categoryId: formData.categoryId, supplierId: formData.supplierId, manufacturer: formData.manufacturer };
        await addOptionType(newType);
        toggleOptionTypeEnabled(newType.id);
        setNewTypeName(''); setIsAddingType(false);
    };

    const saveEditedType = async () => {
        if (!editingTypeId) return;
        const type = (optionTypes || []).find(t => t.id === editingTypeId);
        if (type) await actions.updateOptionType({ ...type, name: editTypeName, isSingleSelect: editTypeSingle, isRequired: editTypeRequired });
        setEditingTypeId(null);
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
            newDefIds = newDefIds.includes(variantId) ? newDefIds.filter(id => id !== variantId) : [...newDefIds, variantId];
            newDefId = undefined;
        }
        setFormData({ ...formData, machineConfig: currentConfig.map(mc => mc.typeId === typeId ? { ...mc, defaultVariantId: newDefId, defaultVariantIds: newDefIds } : mc) });
    };

    const canSeePurchase = access.canSee('fields', 'basePrice');

    return (
        <div className="flex h-full bg-white">
            {/* Sidebar - Option Types */}
            <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shadow-sm z-10">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {canWrite && formData.categoryId && (
                            <button onClick={handleSelectAllTypes} title="Выбрать все совместимые типы" className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><ListChecks size={16}/></button>
                        )}
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Типы опций</span>
                    </div>
                    {formData.categoryId && canWrite && (
                        <button onClick={() => setIsAddingType(!isAddingType)} className={`text-[9px] px-2 py-1 rounded-md border font-black uppercase tracking-tighter transition-all ${isAddingType ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'}`}>{isAddingType ? <X size={12}/> : '+ Тип'}</button>
                    )}
                </div>
                {isAddingType && (
                    <div className="p-3 bg-blue-50/50 border-b border-blue-100 space-y-2">
                        <input className="w-full bg-white border border-blue-200 p-2 rounded-lg text-xs font-bold" placeholder="Название типа..." value={newTypeName} onChange={e => setNewTypeName(e.target.value)} autoFocus />
                        <div className="flex gap-1.5"><label className="flex-1 flex items-center text-[9px] font-bold"><input type="checkbox" className="mr-1" checked={newTypeSingle} onChange={e => setNewTypeSingle(e.target.checked)}/> Один</label><label className="flex-1 flex items-center text-[9px] font-bold"><input type="checkbox" className="mr-1" checked={newTypeRequired} onChange={e => setNewTypeRequired(e.target.checked)}/> Обяз.</label></div>
                        <div className="flex gap-2"><button onClick={() => setIsAddingType(false)} className="flex-1 py-1 text-[9px] font-bold text-slate-500">Отмена</button><button onClick={handleQuickAddOptionType} className="flex-1 py-1 bg-blue-600 text-white rounded text-[9px] font-black uppercase">Создать</button></div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {availableOptionTypes.map(ot => {
                        const config = formData.machineConfig?.find(c => c.typeId === ot.id);
                        const isActive = selectedOptionTypeId === ot.id;
                        const isValidationError = ot.isRequired && !!config && !(ot.isSingleSelect ? !!config.defaultVariantId : (config.defaultVariantIds?.length || 0) > 0);
                        if (editingTypeId === ot.id) return (
                            <div key={ot.id} className="p-2 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                                <input className="w-full p-1.5 text-xs font-bold border rounded bg-white" value={editTypeName} onChange={e => setEditTypeName(e.target.value)} />
                                <div className="flex gap-2"><label className="flex items-center text-[9px]"><input type="checkbox" checked={editTypeSingle} onChange={e => setEditTypeSingle(e.target.checked)} className="mr-1"/> Один</label><label className="flex items-center text-[9px]"><input type="checkbox" checked={editTypeRequired} onChange={e => setEditTypeRequired(e.target.checked)} className="mr-1"/> Обяз.</label></div>
                                <div className="flex gap-2"><button onClick={() => setEditingTypeId(null)} className="flex-1 py-1 text-[9px] border rounded">Отмена</button><button onClick={saveEditedType} className="flex-1 py-1 text-[9px] bg-blue-600 text-white rounded">Save</button></div>
                            </div>
                        );
                        return (
                            <div key={ot.id} onClick={() => { setSelectedOptionTypeId(ot.id); if (!config && canWrite) toggleOptionTypeEnabled(ot.id); }} className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center group ${isActive ? 'border-blue-500 bg-blue-50' : isValidationError ? 'border-red-200 bg-red-50/30' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}>
                                <div className={`mr-3 ${config ? 'text-blue-600' : 'text-slate-300'}`} onClick={(e) => { e.stopPropagation(); if(canWrite) toggleOptionTypeEnabled(ot.id); }}>{config ? <CheckSquare size={16}/> : <Square size={16}/>}</div>
                                <div className="flex-1 truncate pr-6">
                                    <div className="flex items-center gap-1"><span className={`text-xs font-bold truncate ${isActive ? 'text-blue-900' : isValidationError ? 'text-red-700' : 'text-slate-700'}`}>{ot.name}</span>{isValidationError && <AlertCircle size={10} className="text-red-500 animate-pulse"/>}</div>
                                    <div className="flex gap-1 mt-0.5"><span className="text-[7px] px-1 rounded border bg-slate-50 text-slate-500 uppercase">{ot.isSingleSelect ? 'Один' : 'Много'}</span>{ot.isRequired && <span className="text-[7px] px-1 rounded border bg-red-50 text-red-500 uppercase">Обяз.</span>}</div>
                                </div>
                                {canWrite && <button onClick={(e) => { e.stopPropagation(); setEditingTypeId(ot.id); setEditTypeName(ot.name); setEditTypeSingle(ot.isSingleSelect); setEditTypeRequired(ot.isRequired); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={12}/></button>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50/50 flex flex-col h-full overflow-hidden">
                {selectedOptionTypeId ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="px-4 py-2 bg-white border-b flex justify-between items-center z-10 shadow-sm">
                            <div className="text-sm font-black text-slate-800 tracking-tight">{(optionTypes || []).find(t => t.id === selectedOptionTypeId)?.name}</div>
                            {canWrite && <button onClick={() => { setIsAddingVariant(!isAddingVariant); if(!isAddingVariant) { setEditingVariantId(null); setVariantFormData({ name: '', price: 0, currency: Currency.CNY, composition: [], supplierId: formData.supplierId || '', manufacturer: formData.manufacturer || '' }); } }} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-black text-[9px] uppercase tracking-wider transition-all ${isAddingVariant ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>{isAddingVariant ? <X size={12}/> : <Plus size={12}/>} {isAddingVariant ? '' : 'Добавить вариант'}</button>}
                        </div>

                        {isAddingVariant && (
                            <div className="mx-4 mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg animate-in slide-in-from-top-2 shadow-sm overflow-y-auto max-h-[60%]">
                                <div className="grid grid-cols-12 gap-3 mb-3">
                                    <div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Название варианта *</label><input className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold" value={variantFormData.name} onChange={e => setVariantFormData({...variantFormData, name: e.target.value})} autoFocus /></div>
                                    <div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Название для поставщика</label><input className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold" value={variantFormData.supplierProductName} onChange={e => setVariantFormData({...variantFormData, supplierProductName: e.target.value})} /></div>
                                    
                                    <div className="col-span-4 space-y-0.5">
                                        <label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Поставщик *</label>
                                        <select 
                                            className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold disabled:bg-slate-100 disabled:text-slate-500" 
                                            value={variantFormData.supplierId} 
                                            onChange={e => setVariantFormData({...variantFormData, supplierId: e.target.value})}
                                            disabled={!!formData.supplierId} // Блокируем, если поставщик станка задан
                                        >
                                            <option value="">Выберите...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        {formData.supplierId && <p className="text-[7px] text-indigo-400 mt-0.5 ml-1 uppercase font-bold">Зафиксирован поставщик станка</p>}
                                    </div>

                                    <div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Производитель</label><select className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold" value={variantFormData.manufacturer} onChange={e => setVariantFormData({...variantFormData, manufacturer: e.target.value})}><option value="">Выберите...</option>{manufacturers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select></div>
                                    <div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Цена закупа</label><div className="flex h-9"><input type="number" className="w-full p-2 rounded-l-lg border border-indigo-200 text-xs font-black outline-none bg-white" value={variantFormData.price} onChange={e => setVariantFormData({...variantFormData, price: parseFloat(e.target.value) || 0})}/><select className="w-16 p-2 rounded-r-lg border-y border-r border-indigo-200 text-[10px] font-bold bg-white outline-none" value={variantFormData.currency} onChange={e => setVariantFormData({...variantFormData, currency: e.target.value as Currency})}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                                    <div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Габариты (Д x Ш x В, мм)</label><div className="grid grid-cols-3 gap-1"><input type="number" placeholder="Д" className="w-full p-1.5 rounded-lg border border-indigo-200 text-[10px] font-bold" value={variantFormData.lengthMm || ''} onChange={e => setVariantFormData({...variantFormData, lengthMm: parseFloat(e.target.value) || 0})}/><input type="number" placeholder="Ш" className="w-full p-1.5 rounded-lg border border-indigo-200 text-[10px] font-bold" value={variantFormData.widthMm || ''} onChange={e => setVariantFormData({...variantFormData, widthMm: parseFloat(e.target.value) || 0})}/><input type="number" placeholder="В" className="w-full p-1.5 rounded-lg border border-indigo-200 text-[10px] font-bold" value={variantFormData.heightMm || ''} onChange={e => setVariantFormData({...variantFormData, heightMm: parseFloat(e.target.value) || 0})}/></div></div>
                                    <div className="col-span-12 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Описание</label><textarea className="w-full p-2 rounded-lg border border-indigo-200 text-xs font-bold bg-white resize-none" rows={1} value={variantFormData.description || ''} onChange={e => setVariantFormData({...variantFormData, description: e.target.value})} /></div>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-indigo-200 mb-3"><div className="flex gap-2 mb-1 items-center"><Layers size={14} className="text-indigo-500"/><span className="text-[9px] font-black uppercase text-slate-400">Состав (BOM)</span><div className="flex-1"/><select className="w-48 border border-slate-100 bg-slate-50 p-1 rounded-lg text-[9px] font-bold" value={compProductId} onChange={e => setCompProductId(e.target.value)}><option value="">+ Деталь...</option>{products.filter(p => p.type === ProductType.PART).map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}</select><input type="number" className="w-10 border border-slate-100 bg-slate-50 p-1 rounded-lg text-[9px] font-bold text-center" value={compQty} onChange={e => setCompQty(parseFloat(e.target.value))} min={1}/><button onClick={addBOMItem} className="p-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"><Plus size={12}/></button></div><div className="flex flex-wrap gap-2">{variantFormData.composition?.map((item, i) => (<span key={i} className="px-2 py-1 bg-slate-50 text-[9px] font-bold text-slate-600 rounded border border-slate-100 flex items-center gap-1">{products.find(p => p.id === item.productId)?.name} <span className="text-blue-500">x{item.quantity}</span><button onClick={() => setVariantFormData({...variantFormData, composition: variantFormData.composition?.filter((_, idx) => idx !== i)})} className="text-red-400 hover:text-red-600"><X size={10}/></button></span>))}</div></div>
                                <div className="flex justify-end gap-3"><button onClick={() => setIsAddingVariant(false)} className="px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Отмена</button><button onClick={handleSaveVariant} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Сохранить</button></div>
                            </div>
                        )}

                        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full">
                                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <tr><th className="p-2 text-center w-12">Вкл</th><th className="p-3 text-center w-16">В базе</th><th className="p-3 text-left">Вариант / Производитель</th>{canSeePurchase && <th className="p-3 text-right">База</th>}<th className="p-3 text-right w-36">Спец. цена</th><th className="p-3 w-20"></th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(() => {
                                            const variantsOfType = (optionVariants || []).filter(v => v.typeId === selectedOptionTypeId && v.categoryId === formData.categoryId);
                                            const nativeVariants = variantsOfType.filter(v => v.supplierId === formData.supplierId && v.manufacturer === formData.manufacturer);
                                            const otherVariants = variantsOfType.filter(v => v.supplierId !== formData.supplierId || v.manufacturer !== formData.manufacturer);
                                            const config = formData.machineConfig?.find(c => c.typeId === selectedOptionTypeId);
                                            const currentAllowed = config?.allowedVariantIds || [];
                                            const typeObj = (optionTypes || []).find(t => t.id === selectedOptionTypeId);
                                            const isSingle = typeObj?.isSingleSelect ?? true;

                                            const renderRow = (v: OptionVariant) => {
                                                const isAllowed = currentAllowed.includes(v.id);
                                                const isDefault = isSingle ? config?.defaultVariantId === v.id : !!config?.defaultVariantIds?.includes(v.id);
                                                const override = config?.priceOverrides?.[v.id];
                                                const sup = v.supplierId ? (suppliers || []).find(s => s.id === v.supplierId) : null;
                                                return (
                                                    <tr key={v.id} className={`transition-colors text-xs group ${isAllowed ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 opacity-60'}`}>
                                                        <td className="p-2 text-center"><button onClick={() => toggleAllowedVariant(selectedOptionTypeId!, v.id)} className={`p-1 rounded-md border-2 ${isAllowed ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 text-transparent'}`} disabled={!canWrite}><Check size={10}/></button></td>
                                                        <td className="p-2 text-center border-r border-slate-50">{isAllowed && <button onClick={() => toggleDefaultVariant(selectedOptionTypeId!, v.id, isSingle)} className={`p-1 rounded-full ${isDefault ? 'bg-emerald-100 text-emerald-600' : 'text-slate-200 hover:text-emerald-400'}`} disabled={!canWrite}><CheckCircle size={16}/></button>}</td>
                                                        <td className="p-2"><div className="flex flex-col gap-0.5"><div className="flex items-center gap-1.5"><span className="font-bold text-slate-800 leading-tight">{v.name}</span><div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><Layers size={10}/> {v.composition?.length || 0}</div></div><div className="flex flex-wrap gap-1">{sup && <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded border border-indigo-100 uppercase tracking-tight flex items-center gap-0.5 truncate max-w-[120px]"><User size={8}/> {sup.name}</span>}{v.manufacturer && <span className="text-[7px] font-black bg-purple-50 text-purple-600 px-1 py-0.5 rounded border border-purple-100 uppercase tracking-tight flex items-center gap-0.5 truncate max-w-[120px]"><Factory size={8}/> {v.manufacturer}</span>}{(v.lengthMm || v.widthMm || v.heightMm) ? <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded border border-slate-200 uppercase tracking-tight flex items-center gap-0.5"><Box size={8}/> {v.lengthMm}x{v.widthMm}x{v.heightMm}</span> : null}</div></div></td>
                                                        {canSeePurchase && <td className="p-2 text-right text-[10px] font-bold font-mono text-slate-900">{v.price.toLocaleString()} {v.currency}</td>}
                                                        <td className="p-2 text-right">{isAllowed ? <input type="number" className={`w-28 border rounded-md px-2 py-1 text-right font-mono text-xs ${override !== undefined ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50'}`} placeholder={v.price.toString()} value={override !== undefined ? override : ''} onChange={e => updatePriceOverride(selectedOptionTypeId!, v.id, e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={!canWrite}/> : '-'}</td>
                                                        <td className="p-2 text-center"><div className="flex items-center gap-1 justify-center">{canWrite && <><button onClick={() => handleCopyVariant(v)} title="Копировать" className="p-1 text-slate-300 hover:text-orange-500 opacity-0 group-hover:opacity-100"><Copy size={12}/></button><button onClick={() => startEditingVariant(v)} title="Редактировать" className="p-1 text-slate-300 hover:text-blue-600 opacity-0 group-hover:opacity-100"><Pencil size={12}/></button></>}</div></td>
                                                    </tr>
                                                );
                                            };

                                            return (
                                                <>
                                                    <tr className="bg-blue-50/30"><td className="p-1.5 text-center border-b border-slate-200">{canWrite && <button onClick={() => handleSelectAllVariants('native')} className={`p-1 rounded-md border-2 ${nativeVariants.length > 0 && nativeVariants.every(v => currentAllowed.includes(v.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300'}`}><ListChecks size={12}/></button>}</td><td className="border-b border-slate-200"/><td colSpan={canSeePurchase ? 4 : 3} className="px-2 py-1.5 border-b border-slate-200 font-black text-blue-600 uppercase text-[9px] tracking-widest">Родные варианты</td></tr>
                                                    {nativeVariants.map(renderRow)}
                                                    {otherVariants.length > 0 && (
                                                        <>
                                                            <tr className="bg-slate-100/50 cursor-pointer" onClick={() => setIsOtherExpanded(!isOtherExpanded)}><td className="p-1.5 text-center border-y border-slate-200">{canWrite && isOtherExpanded && <button onClick={(e) => { e.stopPropagation(); handleSelectAllVariants('other'); }} className={`p-1 rounded-md border-2 ${otherVariants.length > 0 && otherVariants.every(v => currentAllowed.includes(v.id)) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300'}`}><ListChecks size={12}/></button>}</td><td className="border-y border-slate-200"/><td colSpan={canSeePurchase ? 4 : 3} className="px-2 py-1.5 border-y border-slate-200 flex items-center gap-2"><ChevronRight size={14} className={`text-slate-400 transition-transform ${isOtherExpanded ? 'rotate-90' : ''}`}/><span className="font-black text-slate-500 uppercase text-[9px] tracking-widest">Другие производители ({otherVariants.length})</span></td></tr>
                                                            {isOtherExpanded && otherVariants.map(renderRow)}
                                                        </>
                                                    )}
                                                    {variantsOfType.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-slate-400 italic text-[10px] font-bold uppercase tracking-widest">Варианты не добавлены</td></tr>}
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><Settings size={48} className="mb-3"/><p className="font-black uppercase tracking-widest text-[10px]">Выберите тип опции слева</p></div>
                )}
            </div>
        </div>
    );
};
