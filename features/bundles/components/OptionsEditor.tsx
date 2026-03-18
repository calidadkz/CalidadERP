
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductType, OptionType, OptionVariant, Currency, ProductCategory } from '@/types';
import { Plus, Trash2, Pencil, X, Layers, Settings, Download, Upload, AlertCircle, Loader2, CheckCircle, Factory, Box, LayoutList, User, Search, List, Copy } from 'lucide-react';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';

export const OptionsEditor: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('options_editor');
    
    const groupsAccess = access.getLevel('actions', 'manage_groups');
    const variantsAccess = access.getLevel('actions', 'manage_variants');
    
    const canSeeGroups = groupsAccess !== 'none';
    const canWriteGroups = groupsAccess === 'write';
    const canWriteVariants = variantsAccess === 'write';
    const canImportExport = access.canWrite('actions', 'import_export');
    const showPrices = access.canSee('fields', 'col_purchase_price');

    const { 
        optionTypes = [], 
        optionVariants = [], 
        categories = [], 
        products = [], 
        suppliers = [], 
        manufacturers = [] 
    } = state;

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [isCreatingType, setIsCreatingType] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [newType, setNewType] = useState<Partial<OptionType>>({ name: '', isRequired: false, isSingleSelect: true });
    
    const [typeSearch, setTypeSearch] = useState('');
    const [typeSupplierFilter, setTypeSupplierFilter] = useState('');
    
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [newVariant, setNewVariant] = useState<Partial<OptionVariant>>({ name: '', price: 0, currency: Currency.USD, composition: [], lengthMm: 0, widthMm: 0, heightMm: 0 });
    const [variantFormCategoryId, setVariantFormCategoryId] = useState<string | null>(null); 
    const [manufacturerSearch, setManufacturerSearch] = useState('');
    const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);

    const [sectionFilters, setSectionFilters] = useState<Record<string, { supplierId: string, manufacturer: string }>>({});
    const [visibleSections, setVisibleSections] = useState<string[]>([]);
    const [isAddingSection, setIsAddingSection] = useState(false);

    const [compProductId, setCompProductId] = useState('');
    const [compQty, setCompQty] = useState(1);
    
    const [validationError, setValidationError] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<{ show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string }>({ show: false, msg: '', type: 'loading' });

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE), [categories]);

    const filteredOptionTypes = useMemo(() => {
        return optionTypes
            .filter(ot => {
                const matchName = (ot.name || '').toLowerCase().includes(typeSearch.toLowerCase());
                const matchSupplier = !typeSupplierFilter || 
                    ot.supplierId === typeSupplierFilter ||
                    optionVariants.some(v => v.typeId === ot.id && v.supplierId === typeSupplierFilter);
                return matchName && matchSupplier;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [optionTypes, typeSearch, typeSupplierFilter, optionVariants]);

    useEffect(() => {
        if (selectedTypeId) {
            const usedCategories = new Set<string>();
            optionVariants.filter(v => v.typeId === selectedTypeId).forEach(v => {
                if (v.categoryId) usedCategories.add(v.categoryId);
            });
            setVisibleSections(Array.from(usedCategories));
        } else {
            setVisibleSections([]);
        }
    }, [selectedTypeId, optionVariants]);

    const handleSaveType = async () => {
        if (!canWriteGroups || !newType.name) return;
        setValidationError(null);
        const duplicate = optionTypes.find(ot => ot.name?.toLowerCase().trim() === newType.name?.toLowerCase().trim() && ot.id !== editingTypeId);
        if (duplicate) { setValidationError(`Группа "${newType.name}" уже существует`); return; }
        if (editingTypeId) await actions.updateOptionType({ ...newType, id: editingTypeId } as OptionType);
        else await actions.addOptionType({ ...newType, id: ApiService.generateId() } as OptionType);
        setIsCreatingType(false); setEditingTypeId(null); setNewType({ name: '', isRequired: false, isSingleSelect: true });
    };

    const handleEditType = (e: React.MouseEvent, ot: OptionType) => {
        e.stopPropagation();
        if (!canSeeGroups) return;
        setNewType(ot); setEditingTypeId(ot.id); setIsCreatingType(true);
    };

    const handleDeleteType = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!canWriteGroups) return;
        if(confirm("Удалить группу опций и все входящие в нее варианты?")) {
            actions.deleteOptionType(id);
            if (selectedTypeId === id) setSelectedTypeId(null);
        }
    };

    const handleAddSection = (catId: string) => {
        if (!visibleSections.includes(catId)) setVisibleSections(prev => [...prev, catId]);
        setIsAddingSection(false);
    };

    const handleOpenVariantForm = (categoryId: string, variant?: OptionVariant) => {
        setVariantFormCategoryId(categoryId);
        if (variant) {
            setEditingVariantId(variant.id); setNewVariant({ ...variant }); setManufacturerSearch(variant.manufacturer || '');
        } else {
            setEditingVariantId(null);
            setNewVariant({ 
                name: '', supplierProductName: '', description: '', price: 0, currency: Currency.USD, composition: [], 
                categoryId: categoryId, supplierId: '', manufacturer: '',
                lengthMm: 0, widthMm: 0, heightMm: 0
            });
            setManufacturerSearch('');
        }
    };

    const handleCloneVariant = (variant: OptionVariant) => {
        setVariantFormCategoryId(variant.categoryId || null);
        setEditingVariantId(null);
        setNewVariant({ ...variant, id: undefined, name: `${variant.name} (копия)` });
        setManufacturerSearch(variant.manufacturer || '');
        setValidationError(null);
    };

    const handleSaveVariant = async () => {
        if (!canWriteVariants || !newVariant.name || !selectedTypeId || !variantFormCategoryId) return;
        if (!newVariant.supplierId) { setValidationError("Поставщик обязателен"); return; }
        const ovData: OptionVariant = {
            id: editingVariantId || ApiService.generateId(),
            typeId: selectedTypeId,
            categoryId: newVariant.categoryId || variantFormCategoryId,
            name: newVariant.name || '',
            supplierProductName: newVariant.supplierProductName || '',
            description: newVariant.description || '',
            price: newVariant.price || 0,
            currency: newVariant.currency || Currency.USD,
            composition: newVariant.composition || [],
            supplierId: newVariant.supplierId || '',
            manufacturer: newVariant.manufacturer || '',
            lengthMm: newVariant.lengthMm || 0,
            widthMm: newVariant.widthMm || 0,
            heightMm: newVariant.heightMm || 0,
            volumeM3: ((newVariant.lengthMm || 0) * (newVariant.widthMm || 0) * (newVariant.heightMm || 0)) / 1_000_000_000
        };
        if (editingVariantId) await actions.updateOptionVariant(ovData);
        else await actions.addOptionVariant(ovData);
        setVariantFormCategoryId(null);
        setNewVariant({ name: '', price: 0, currency: Currency.USD, composition: [], lengthMm: 0, widthMm: 0, heightMm: 0 });
    };

    const handleDeleteVariant = (id: string) => { if(confirm("Удалить вариант?")) actions.deleteOptionVariant(id); };

    const addBOMItem = () => {
        if (!canWriteVariants || !compProductId) return;
        const current = newVariant.composition || [];
        const existingIndex = current.findIndex(item => item.productId === compProductId);
        if (existingIndex > -1) {
            const updated = [...current];
            updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + compQty };
            setNewVariant({ ...newVariant, composition: updated });
        } else {
            setNewVariant({ ...newVariant, composition: [...current, { productId: compProductId, quantity: compQty }] });
        }
        setCompProductId(''); setCompQty(1);
    };

    const handleExportCSV = () => {
        if (!canImportExport) return;
        const headers = ['Тип опции', 'Категория', 'Название опции', 'Название для поставщика', 'Описание', 'Цена', 'Валюта', 'Поставщик', 'Производитель', 'Габариты (Д/Ш/В)'];
        const rows: string[][] = [];
        optionTypes.forEach(ot => {
            optionVariants.filter(ov => ov.typeId === ot.id).forEach(ov => {
                const catName = categories.find(c => c.id === ov.categoryId)?.name || '';
                const supName = suppliers.find(s => s.id === ov.supplierId)?.name || '';
                rows.push([ `"${(ot.name || '').replace(/"/g, '""')}"`, `"${catName.replace(/"/g, '""')}"`, `"${(ov.name || '').replace(/"/g, '""')}"`, `"${(ov.supplierProductName || '').replace(/"/g, '""')}"`, `"${(ov.description || '').replace(/"/g, '""')}"`, ov.price.toString(), ov.currency, `"${supName.replace(/"/g, '""')}"`, `"${(ov.manufacturer || '').replace(/"/g, '""')}"`, `"${ov.lengthMm || 0}/${ov.widthMm || 0}/${ov.heightMm || 0}"` ]);
            });
        });
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `options_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportStatus({ show: true, msg: 'Анализ файла...', type: 'loading', details: '0%' });
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length < 2) throw new Error("Файл пуст или некорректен");

                const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
                const catMap = new Map<string, string>(categories.map(c => [c.name.toLowerCase(), c.id]));
                const supMap = new Map<string, string>(suppliers.map(s => [s.name.toLowerCase(), s.id]));
                const typeMap = new Map<string, string>(optionTypes.map(t => [t.name.toLowerCase(), t.id]));
                const pendingTypes = new Map<string, OptionType>();
                const pendingCategories = new Map<string, ProductCategory>();
                const rows: Record<string, string>[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row: Record<string, string> = {}; 
                    headers.forEach((h, idx) => row[h] = values[idx]);
                    rows.push(row);
                    const typeName = row['Тип опции'];
                    const catName = row['Категория'];
                    if (typeName && !typeMap.has(typeName.toLowerCase()) && !pendingTypes.has(typeName.toLowerCase())) { pendingTypes.set(typeName.toLowerCase(), { id: ApiService.generateId(), name: typeName, isSingleSelect: true, isRequired: false }); }
                    if (catName && !catMap.has(catName.toLowerCase()) && !pendingCategories.has(catName.toLowerCase())) { pendingCategories.set(catName.toLowerCase(), { id: ApiService.generateId(), name: catName, type: ProductType.MACHINE }); }
                }

                if (pendingTypes.size > 0) { const createdTypes = await actions.addOptionTypesBulk(Array.from(pendingTypes.values())); createdTypes.forEach(t => typeMap.set(t.name.toLowerCase(), t.id)); }
                if (pendingCategories.size > 0) { const createdCats = await actions.addCategoriesBulk(Array.from(pendingCategories.values())); createdCats.forEach(c => catMap.set(c.name.toLowerCase(), c.id)); }

                const variantsToUpsert: OptionVariant[] = [];
                for (const row of rows) {
                    const typeName = row['Тип опции']; const catName = row['Категория']; const variantName = row['Название опции'];
                    if (!typeName || !variantName) continue;
                    const typeId = typeMap.get(typeName.toLowerCase()); if (!typeId) continue;
                    const catId = catName ? catMap.get(catName.toLowerCase()) : undefined;
                    const supId = row['Поставщик'] ? supMap.get(row['Поставщик'].toLowerCase()) : undefined;
                    const rawCurrency = (row['Валюта'] || 'USD').toUpperCase();
                    let currency = rawCurrency as Currency; if (rawCurrency === 'RMB') currency = Currency.CNY;
                    const dimsStr = row['Габариты (Д/Ш/В)'] || '0/0/0'; const [l, w, h] = dimsStr.split('/').map(v => parseFloat(v) || 0);
                    const existingVariant = optionVariants.find(ov => ov.typeId === typeId && ov.name.toLowerCase() === variantName.toLowerCase() && ov.categoryId === catId);
                    variantsToUpsert.push({ id: existingVariant?.id || ApiService.generateId(), typeId: typeId, name: variantName, supplierProductName: row['Название для поставщика'] || existingVariant?.supplierProductName || '', description: row['Описание'] || existingVariant?.description || '', categoryId: catId, supplierId: supId || existingVariant?.supplierId || '', manufacturer: row['Производитель'] || existingVariant?.manufacturer || '', price: parseFloat(row['Цена']?.replace(',', '.') || '0'), currency: currency, lengthMm: l, widthMm: w, heightMm: h, volumeM3: (l * w * h) / 1_000_000_000, composition: existingVariant?.composition || [] });
                }

                const CHUNK_SIZE = 50;
                for (let i = 0; i < variantsToUpsert.length; i += CHUNK_SIZE) { await actions.upsertOptionVariantsBulk(variantsToUpsert.slice(i, i + CHUNK_SIZE)); }
                setImportStatus({ show: true, type: 'success', msg: 'Импорт завершен' });
            } catch (err: any) { setImportStatus({ show: true, msg: `Ошибка: ${err.message}`, type: 'error' }); }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex h-full gap-6 overflow-hidden relative">
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" /> : importStatus.type === 'success' ? <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" /> : <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />}
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                        {importStatus.details && <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-xs whitespace-pre-wrap text-slate-600 border border-slate-100 max-h-48 overflow-y-auto">{importStatus.details}</div>}
                        {importStatus.type !== 'loading' && <button onClick={() => setImportStatus({ ...importStatus, show: false })} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest">ОК</button>}
                    </div>
                </div>
            )}

            <div className="w-72 flex-none flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
                <div className="px-3 py-2 bg-slate-50 border-b flex flex-col gap-2">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-nowrap">Типы опций ({filteredOptionTypes.length})</span><div className="flex gap-1">{canImportExport && (<><button onClick={handleExportCSV} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Download size={12}/></button><button onClick={() => fileInputRef.current?.click()} className="p-1 text-slate-400 hover:text-orange-600 transition-colors"><Upload size={12}/></button></>)}{canWriteGroups && <button onClick={() => { setIsCreatingType(true); setEditingTypeId(null); setNewType({ name: '', isRequired: false, isSingleSelect: true }); }} className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all shadow-sm"><Plus size={12}/></button>}</div></div>
                    <div className="space-y-1.5"><div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/><input className="w-full pl-8 pr-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 transition-all" placeholder="Фильтр типов..." value={typeSearch} onChange={e => setTypeSearch(e.target.value)} /></div><select className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100" value={typeSupplierFilter} onChange={e => setTypeSupplierFilter(e.target.value)}><option value="">Все поставщики</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                </div>
                {isCreatingType && (
                    <div className="p-2 bg-blue-100 border-b space-y-2"><input className="w-full p-1.5 rounded-lg text-xs font-bold border border-slate-300 outline-none" placeholder="Название типа..." value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} autoFocus /><div className="flex flex-col gap-1"><label className="flex items-center text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" className="mr-2" checked={newType.isSingleSelect} onChange={e => setNewType({...newType, isSingleSelect: e.target.checked})}/> Выбор одного (Radio)</label><label className="flex items-center text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" className="mr-2" checked={newType.isRequired} onChange={e => setNewType({...newType, isRequired: e.target.checked})}/> Обязательно</label></div><div className="flex gap-2"><button onClick={() => setIsCreatingType(false)} className="flex-1 py-1 text-[10px] font-bold text-slate-500 bg-white rounded-lg border hover:bg-slate-50">Отмена</button><button onClick={handleSaveType} className="flex-1 py-1 text-[10px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">Сохранить</button></div></div>
                )}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">{filteredOptionTypes.map(ot => { const isActive = selectedTypeId === ot.id; const typeVariants = optionVariants.filter(v => v.typeId === ot.id); const uniqueCats = new Set(typeVariants.map(v => v.categoryId).filter(Boolean)).size; return (<div key={ot.id} onClick={() => setSelectedTypeId(ot.id)} className={`p-3 rounded-lg border transition-all cursor-pointer group ${isActive ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}><div className="flex justify-between items-center"><span className={`text-sm font-bold ${isActive ? 'text-blue-800' : 'text-slate-700'}`}>{ot.name}</span>{canWriteGroups && (<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => handleEditType(e, ot)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={12}/></button><button onClick={(e) => handleDeleteType(e, ot.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button></div>)}</div><div className="flex items-center justify-between mt-2 text-[8px] text-slate-400 font-medium"><div className="flex gap-1"><span className="bg-white border px-1.5 py-0.5 rounded font-bold">{ot.isSingleSelect ? 'Один' : 'Много'}</span>{ot.isRequired && <span className="bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded font-bold">Обяз.</span>}</div><div className="flex gap-2 font-medium"><span title="Категорий" className="flex items-center gap-0.5"><Box size={10} className="text-slate-300"/>{uniqueCats}</span><span title="Вариантов" className="flex items-center gap-0.5"><List size={10} className="text-slate-300"/>{typeVariants.length}</span></div></div></div>); })}</div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-w-0">
                {selectedTypeId ? (
                    <div className="flex flex-col h-full">
                        <div className="px-4 py-2 border-b bg-slate-50 flex justify-between items-center shrink-0"><div><h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{optionTypes.find(t => t.id === selectedTypeId)?.name}</h3><p className="text-[9px] text-slate-400 font-bold mt-0.5">Управление вариантами по категориям</p></div><div className="relative"><button onClick={() => setIsAddingSection(!isAddingSection)} className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all"><Plus size={12}/> Добавить категорию</button>{isAddingSection && (<div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in slide-in-from-top-2"><div className="max-h-48 overflow-y-auto custom-scrollbar">{machineCategories.filter(c => !visibleSections.includes(c.id)).map(c => (<button key={c.id} onClick={() => handleAddSection(c.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg">{c.name}</button>))}</div></div>)}</div></div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar bg-slate-50/30">{visibleSections.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><LayoutList size={48} className="mb-2"/><p className="font-black uppercase tracking-widest text-[10px]">Добавьте категорию</p></div>) : (visibleSections.map(catId => { const category = categories.find(c => c.id === catId); const sectionFilter = sectionFilters[catId] || { supplierId: '', manufacturer: '' }; const variants = optionVariants.filter(v => v.typeId === selectedTypeId && v.categoryId === catId).filter(v => !sectionFilter.supplierId || v.supplierId === sectionFilter.supplierId).filter(v => !sectionFilter.manufacturer || (v.manufacturer || '').toLowerCase().includes(sectionFilter.manufacturer.toLowerCase())); const isFormOpen = variantFormCategoryId === catId; return (<div key={catId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-2 py-1 bg-slate-50/80 border-b flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><Box size={14} className="text-indigo-500 flex-shrink-0"/><span className="text-xs font-black text-slate-800 truncate">{category?.name}</span>{canWriteVariants && !isFormOpen && (<button onClick={() => handleOpenVariantForm(catId)} className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-black text-[9px] flex items-center gap-1 uppercase tracking-widest shadow-sm whitespace-nowrap"><Plus size={12}/> Добавить</button>)}</div><div className="flex items-center gap-2 flex-shrink-0"><select className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md py-0.5 px-1 outline-none focus:ring-2 focus:ring-blue-100 w-28" value={sectionFilter.supplierId} onChange={e => setSectionFilters({ ...sectionFilters, [catId]: { ...sectionFilter, supplierId: e.target.value } })}><option value="">Все поставщики</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md py-0.5 px-2 outline-none focus:ring-2 focus:ring-blue-100 w-24" placeholder="Производитель..." value={sectionFilter.manufacturer} onChange={e => setSectionFilters({ ...sectionFilters, [catId]: { ...sectionFilter, manufacturer: e.target.value } })} /></div></div>{isFormOpen && (<div className="p-3 bg-indigo-100 border-b border-indigo-200 animate-in slide-in-from-top-2"><div className="grid grid-cols-12 gap-3 mb-3"><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Категория *</label><select className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.categoryId || ''} onChange={e => setNewVariant({...newVariant, categoryId: e.target.value})}><option value="">Выберите категорию...</option>{machineCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Название варианта</label><input className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})}/></div><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Название для поставщика</label><input className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.supplierProductName || ''} onChange={e => setNewVariant({...newVariant, supplierProductName: e.target.value})}/></div><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Поставщик *</label><select className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.supplierId || ''} onChange={e => setNewVariant({...newVariant, supplierId: e.target.value})}><option value="">Выберите...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Производитель</label><div className="relative"><input className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" placeholder="Поиск производителя..." value={manufacturerSearch} onChange={e => { setManufacturerSearch(e.target.value); setNewVariant({...newVariant, manufacturer: e.target.value}); setShowManufacturerDropdown(true); }} onFocus={() => setShowManufacturerDropdown(true)} />{showManufacturerDropdown && (<div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] max-h-48 overflow-y-auto custom-scrollbar">{manufacturers.filter(m => (m.name || '').toLowerCase().includes(manufacturerSearch.toLowerCase())).map(m => (<button key={m.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700" onClick={() => { setManufacturerSearch(m.name); setNewVariant({...newVariant, manufacturer: m.name}); setShowManufacturerDropdown(false); }}>{m.name}</button>))}</div>)}</div></div><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Цена</label><div className="flex h-9"><input type="number" className="w-full p-2 rounded-l-lg border border-indigo-300 text-xs font-black outline-none bg-white" value={newVariant.price} onChange={e => setNewVariant({...newVariant, price: parseFloat(e.target.value) || 0})}/><select className="w-16 p-2 rounded-r-lg border-y border-r border-indigo-300 text-[10px] font-bold bg-white outline-none" value={newVariant.currency} onChange={e => setNewVariant({...newVariant, currency: e.target.value as Currency})}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></div></div><div className="col-span-8 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Описание</label><textarea className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white resize-none" rows={1} value={newVariant.description || ''} onChange={e => setNewVariant({...newVariant, description: e.target.value})} /></div><div className="col-span-4 space-y-0.5"><label className="text-[8px] font-black uppercase text-indigo-800 ml-1">Габариты (Д x Ш x В, мм)</label><div className="grid grid-cols-3 gap-2"><input type="number" placeholder="Д" className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.lengthMm || ''} onChange={e => setNewVariant({...newVariant, lengthMm: parseFloat(e.target.value) || 0})}/><input type="number" placeholder="Ш" className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.widthMm || ''} onChange={e => setNewVariant({...newVariant, widthMm: parseFloat(e.target.value) || 0})}/><input type="number" placeholder="В" className="w-full p-2 rounded-lg border border-indigo-300 text-xs font-bold outline-none bg-white" value={newVariant.heightMm || ''} onChange={e => setNewVariant({...newVariant, heightMm: parseFloat(e.target.value) || 0})}/></div></div></div><div className="bg-white p-2 rounded-xl border border-indigo-200 mb-2"><div className="flex gap-2 mb-1 items-center"><Layers size={14} className="text-indigo-500"/><span className="text-[9px] font-black uppercase text-slate-400">Состав (BOM)</span><div className="flex-1"/><select className="w-48 border border-slate-100 bg-slate-50 p-1 rounded-lg text-[9px] font-bold" value={compProductId} onChange={e => setCompProductId(e.target.value)}><option value="">+ Деталь...</option>{products.filter(p => p.type === ProductType.PART).map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}</select><input type="number" className="w-10 border border-slate-100 bg-slate-50 p-1 rounded-lg text-[9px] font-bold text-center" value={compQty} onChange={e => setCompQty(parseFloat(e.target.value))} min={1}/><button onClick={addBOMItem} className="p-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"><Plus size={12}/></button></div><div className="flex flex-wrap gap-2">{newVariant.composition?.map((item, i) => (<span key={i} className="px-2 py-1 bg-slate-50 text-[9px] font-bold text-slate-600 rounded border border-slate-100 flex items-center gap-1">{products.find(p => p.id === item.productId)?.name} <span className="text-blue-500">x{item.quantity}</span><button onClick={() => setNewVariant({...newVariant, composition: newVariant.composition?.filter((_, idx) => idx !== i)})} className="text-red-400 hover:text-red-600"><X size={10}/></button></span>))}</div></div><div className="flex justify-end gap-3 items-center"><button onClick={() => setVariantFormCategoryId(null)} className="px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all">Отмена</button><button onClick={handleSaveVariant} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">Сохранить</button></div></div>)}<div className="p-2 grid grid-cols-1 md:grid-cols-3 gap-2">{variants.map(v => { const sup = suppliers.find(s => s.id === v.supplierId); return (<div key={v.id} className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group bg-white flex flex-col gap-0.5 shadow-sm"><div className="flex justify-between items-start"><div className="flex items-center gap-1.5 min-w-0"><h4 className="font-bold text-[11px] text-slate-800 leading-tight break-words">{v.name}</h4>{v.description && (<div className="group/tooltip relative flex-shrink-0"><AlertCircle size={12} className="text-slate-400 hover:text-indigo-600 cursor-help transition-colors" /><div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-slate-700">{v.description}</div></div>)}</div>{canWriteVariants && (<div className="flex gap-1 transition-all flex-shrink-0"><button onClick={() => handleCloneVariant(v)} className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Клонировать"><Copy size={12}/></button><button onClick={() => handleOpenVariantForm(catId, v)} className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors" title="Редактировать"><Pencil size={12}/></button><button onClick={() => handleDeleteVariant(v.id)} className="p-0.5 text-slate-400 hover:text-red-600 transition-colors" title="Удалить"><Trash2 size={12}/></button></div>)}</div><div className="flex flex-wrap gap-1">{sup && <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded border border-indigo-100 uppercase tracking-tight flex items-center gap-0.5 max-w-full truncate"><User size={8}/> {sup.name}</span>}{v.manufacturer && <span className="text-[7px] font-black bg-purple-50 text-purple-600 px-1 py-0.5 rounded border border-purple-100 uppercase tracking-tight flex items-center gap-0.5 max-w-full truncate"><Factory size={8}/> {v.manufacturer}</span>}</div><div className="flex justify-between items-end border-t border-slate-50 pt-1 mt-0.5"><div className="flex items-center gap-2"><div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><Layers size={10}/> {v.composition?.length || 0}</div>{(v.lengthMm || v.widthMm || v.heightMm) ? <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><Box size={10}/> {v.volumeM3?.toFixed(3)} м³</div> : null}</div>{showPrices ? <span className="text-[10px] font-black font-mono text-emerald-600 leading-none">{v.price.toLocaleString()} {v.currency}</span> : <span className="text-[8px] font-bold text-slate-300 italic leading-none">Скрыто</span>}</div></div>); })} {variants.length === 0 && !isFormOpen && <div className="col-span-full py-4 text-center text-[9px] text-slate-300 italic font-bold uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-xl">Нет вариантов</div>}</div></div>); }) )}</div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><Settings size={48} className="mb-3"/><p className="font-black uppercase tracking-widest text-[10px]">Выберите тип опции слева</p></div>
                )}
            </div>
        </div>
    );
};
