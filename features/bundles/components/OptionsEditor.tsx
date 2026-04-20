
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductType, OptionType, OptionTypeCategoryOverride, OptionVariant, Currency, Product, MachineConfigEntry } from '@/types';
import { Plus, Trash2, Pencil, X, Settings, Download, Upload, AlertCircle, Loader2, CheckCircle, Factory, Box, LayoutList, User, Search, List, Copy, Filter, ChevronDown, ChevronRight, MousePointer2, Check, ArrowRight, AlertTriangle, Layers } from 'lucide-react';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { MassAddModal, ExistingMachineUpdate } from './MassAddModal';
import { VariantForm } from './VariantForm';

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
        manufacturers = [],
        trash = []
    } = state;

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Type (group) state ---
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [isCreatingType, setIsCreatingType] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [newType, setNewType] = useState<Partial<OptionType>>({ name: '', isRequired: false, isSingleSelect: true });
    const [typeSearch, setTypeSearch] = useState('');
    const [showTypeFilters, setShowTypeFilters] = useState(false);
    const [typeSupplierFilter, setTypeSupplierFilter] = useState('');
    const [typeMachineCategoryFilter, setTypeMachineCategoryFilter] = useState('');
    const [typeManufacturerFilter, setTypeManufacturerFilter] = useState('');

    // --- Variant form state (simplified — VariantForm owns the rest) ---
    const [variantFormCategoryId, setVariantFormCategoryId] = useState<string | null>(null);
    const [editingVariant, setEditingVariant] = useState<Partial<OptionVariant> | null>(null);
    const [isCloning, setIsCloning] = useState(false);

    // --- Section state ---
    const [sectionFilters, setSectionFilters] = useState<Record<string, { supplierId: string; manufacturer: string }>>({});
    const [visibleSections, setVisibleSections] = useState<string[]>([]);
    const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
    const [isAddingSection, setIsAddingSection] = useState(false);

    // --- Import/export state ---
    const [validationError, setValidationError] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<{ show: boolean; msg: string; type: 'loading' | 'success' | 'error'; details?: string }>({ show: false, msg: '', type: 'loading' });

    // --- Mass add state (modal owns search/selection/prices internally) ---
    const [isMassAddMode, setIsMassAddMode] = useState(false);
    const [massAddCatId, setMassAddCatId] = useState<string | null>(null);
    const [selectedVariantsToApply, setSelectedVariantsToApply] = useState<string[]>([]);
    const [isMassAddModalOpen, setIsMassAddModalOpen] = useState(false);

    // ─── Derived Maps (O(1) lookups everywhere) ───────────────────────────────

    const variantMap = useMemo(() =>
        new Map(optionVariants.map(v => [v.id, v])),
        [optionVariants]
    );

    const variantsByType = useMemo(() => {
        const map = new Map<string, OptionVariant[]>();
        optionVariants.forEach(v => {
            if (!map.has(v.typeId)) map.set(v.typeId, []);
            map.get(v.typeId)!.push(v);
        });
        return map;
    }, [optionVariants]);

    const variantsByTypeAndCat = useMemo(() => {
        const map = new Map<string, Map<string, OptionVariant[]>>();
        optionVariants.forEach(v => {
            if (!map.has(v.typeId)) map.set(v.typeId, new Map());
            const byType = map.get(v.typeId)!;
            const catId = v.categoryId || '';
            if (!byType.has(catId)) byType.set(catId, []);
            byType.get(catId)!.push(v);
        });
        return map;
    }, [optionVariants]);

    const supplierMap = useMemo(() =>
        new Map(suppliers.map(s => [s.id, s])),
        [suppliers]
    );

    const productMap = useMemo(() =>
        new Map(products.map(p => [p.id, p])),
        [products]
    );

    const deletedVariantIds = useMemo(() =>
        new Set(trash.filter(t => t.type === 'OptionVariant').map(t => t.originalId)),
        [trash]
    );

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE), [categories]);

    // BOM products: pre-filter by type, no search term (VariantForm filters by compSearch locally)
    const bomProducts = useMemo(() =>
        products.filter(p => p.type === ProductType.PART).sort((a, b) => a.name.localeCompare(b.name)),
        [products]
    );

    // Machines pre-filtered for MassAddModal
    const machineProducts = useMemo(() =>
        products.filter(p => p.type === ProductType.MACHINE),
        [products]
    );

    const filteredOptionTypes = useMemo(() => {
        return optionTypes
            .filter(ot => {
                const matchName = (ot.name || '').toLowerCase().includes(typeSearch.toLowerCase());
                if (!matchName) return false;
                const typeVariants = variantsByType.get(ot.id) || [];
                const matchSupplier = !typeSupplierFilter || ot.supplierId === typeSupplierFilter ||
                    typeVariants.some(v => v.supplierId === typeSupplierFilter);
                const matchMachine = !typeMachineCategoryFilter ||
                    typeVariants.some(v => v.categoryId === typeMachineCategoryFilter);
                const matchManufacturer = !typeManufacturerFilter ||
                    typeVariants.some(v => (v.manufacturer || '').toLowerCase().includes(typeManufacturerFilter.toLowerCase()));
                return matchSupplier && matchMachine && matchManufacturer;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [optionTypes, typeSearch, typeSupplierFilter, typeMachineCategoryFilter, typeManufacturerFilter, variantsByType]);

    // ─── Effects ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (selectedTypeId) {
            const catIds = Array.from(variantsByTypeAndCat.get(selectedTypeId)?.keys() || []).filter(Boolean);
            setVisibleSections(catIds);
            setCollapsedSections(catIds);
        } else {
            setVisibleSections([]);
            setCollapsedSections([]);
        }
    }, [selectedTypeId]); // intentionally only on selectedTypeId change

    useEffect(() => {
        if (!selectedTypeId) return;
        const catIds = Array.from(variantsByTypeAndCat.get(selectedTypeId)?.keys() || []).filter(Boolean);
        setVisibleSections(prev => {
            if (prev.length === catIds.length && prev.every(s => catIds.includes(s))) return prev;
            return catIds;
        });
    }, [optionVariants, selectedTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const toggleSectionCollapse = (catId: string) =>
        setCollapsedSections(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]);

    const handleToggleCategoryOverride = async (catId: string, field: keyof OptionTypeCategoryOverride) => {
        if (!canWriteGroups || !selectedTypeId) return;
        const type = optionTypes.find(t => t.id === selectedTypeId);
        if (!type) return;
        const overrides = { ...(type.categoryOverrides || {}) };
        const current = overrides[catId] || {};
        // Эффективное значение: оверрайд или глобальное
        const effectiveValue = current[field] !== undefined ? current[field] : type[field];
        const newValue = !effectiveValue;
        const globalValue = type[field];
        if (newValue === globalValue) {
            // Убираем оверрайд для этого поля, если он совпал с глобальным
            const { [field]: _, ...rest } = current;
            if (Object.keys(rest).length === 0) delete overrides[catId];
            else overrides[catId] = rest;
        } else {
            overrides[catId] = { ...current, [field]: newValue };
        }
        await actions.updateOptionType({ ...type, categoryOverrides: overrides });
    };

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
        if (confirm('Удалить группу опций и все входящие в нее варианты?')) {
            actions.deleteOptionType(id);
            if (selectedTypeId === id) setSelectedTypeId(null);
        }
    };

    const handleAddSection = (catId: string) => {
        if (!visibleSections.includes(catId)) {
            setVisibleSections(prev => [...prev, catId]);
            setCollapsedSections(prev => prev.filter(id => id !== catId));
        }
        setIsAddingSection(false);
    };

    const handleOpenVariantForm = (categoryId: string, variant?: OptionVariant) => {
        setVariantFormCategoryId(categoryId);
        setEditingVariant(variant ?? null);
        setIsCloning(false);
    };

    const handleCloneVariant = (variant: OptionVariant) => {
        setVariantFormCategoryId(variant.categoryId || null);
        setEditingVariant({ ...variant, id: undefined });
        setIsCloning(true);
    };

    const handleSaveVariantData = async (variantData: OptionVariant) => {
        if (editingVariant?.id) await actions.updateOptionVariant(variantData);
        else await actions.addOptionVariant(variantData);
        setVariantFormCategoryId(null);
        setEditingVariant(null);
        setIsCloning(false);
    };

    const handleDeleteVariant = (id: string) => {
        if (confirm('Переместить вариант в корзину?')) actions.deleteOptionVariant(id);
    };

    const toggleVariantSelection = (id: string) => {
        const variant = variantMap.get(id);
        if (!variant || variant.categoryId !== massAddCatId) return;
        setSelectedVariantsToApply(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
    };

    const startMassAdd = () => {
        if (selectedVariantsToApply.length === 0) return;
        setIsMassAddModalOpen(true);
    };

    const handleConfirmMassAdd = async (
        selectedMachineIds: string[],
        priceOverrides: Record<string, Record<string, number | ''>>,
        isBaseMap: Record<string, boolean>,
        existingUpdates: ExistingMachineUpdate[]
    ) => {
        // Обновления для новых станков
        const newUpdates = selectedMachineIds.map(mId => {
            const product = productMap.get(mId);
            if (!product) return null;
            const currentConfigs = [...(product.machineConfig || [])];
            const isBase = !!isBaseMap[mId];
            selectedVariantsToApply.forEach(vId => {
                const variant = variantMap.get(vId);
                if (!variant) return;
                let configGroup = currentConfigs.find(c => c.typeId === variant.typeId);
                if (!configGroup) {
                    configGroup = { typeId: variant.typeId, allowedVariantIds: [], priceOverrides: {}, baseVariantIds: [] } as MachineConfigEntry;
                    currentConfigs.push(configGroup);
                }
                if (!configGroup.allowedVariantIds.includes(vId)) {
                    configGroup.allowedVariantIds = [...configGroup.allowedVariantIds, vId];
                }
                if (isBase && !(configGroup.baseVariantIds || []).includes(vId)) {
                    configGroup.baseVariantIds = [...(configGroup.baseVariantIds || []), vId];
                }
                const override = priceOverrides[mId]?.[vId];
                if (override !== '' && override !== undefined) {
                    configGroup.priceOverrides = { ...configGroup.priceOverrides, [vId]: Number(override) };
                }
            });
            return { ...product, machineConfig: currentConfigs };
        }).filter(Boolean) as Product[];

        // Обновления для уже добавленных станков (уже отфильтрованы в MassAddModal)
        const existingMachineUpdates = existingUpdates
            .map(u => {
                const product = productMap.get(u.machineId);
                if (!product) return null;
                const currentConfigs = product.machineConfig ? product.machineConfig.map(c => ({ ...c })) : [];
                selectedVariantsToApply.forEach(vId => {
                    const variant = variantMap.get(vId);
                    if (!variant) return;
                    const configGroupIdx = currentConfigs.findIndex(c => c.typeId === variant.typeId);
                    if (configGroupIdx === -1) return;
                    const configGroup = { ...currentConfigs[configGroupIdx] };
                    if (u.remove) {
                        configGroup.allowedVariantIds = configGroup.allowedVariantIds.filter(id => !selectedVariantsToApply.includes(id));
                        configGroup.baseVariantIds = (configGroup.baseVariantIds || []).filter(id => !selectedVariantsToApply.includes(id));
                    } else {
                        const override = u.priceOverrides[vId];
                        if (override !== '' && override !== undefined) {
                            configGroup.priceOverrides = { ...configGroup.priceOverrides, [vId]: Number(override) };
                        }
                        const bvIds = configGroup.baseVariantIds || [];
                        if (u.isBase && !bvIds.includes(vId)) {
                            configGroup.baseVariantIds = [...bvIds, vId];
                        } else if (!u.isBase) {
                            configGroup.baseVariantIds = bvIds.filter(id => id !== vId);
                        }
                    }
                    currentConfigs[configGroupIdx] = configGroup;
                });
                return { ...product, machineConfig: currentConfigs };
            }).filter(Boolean) as Product[];

        const allUpdates = [...newUpdates, ...existingMachineUpdates];
        if (allUpdates.length === 0) {
            setIsMassAddModalOpen(false);
            return;
        }
        await actions.updateProductsBulk(allUpdates);
        setIsMassAddModalOpen(false);
        setIsMassAddMode(false);
        setSelectedVariantsToApply([]);
        const removedCount = existingUpdates.filter(u => u.remove).length;
        const addedCount = newUpdates.length;
        alert([
            addedCount > 0 && `Добавлено к ${addedCount} станкам`,
            removedCount > 0 && `Отключено у ${removedCount} станков`,
            (existingMachineUpdates.length - removedCount) > 0 && `Обновлено ${existingMachineUpdates.length - removedCount} станков`,
        ].filter(Boolean).join(' · '));
    };

    // ─── CSV Import/Export ────────────────────────────────────────────────────

    const handleExportCSV = () => {
        if (!canImportExport) return;
        const headers = ['Тип опции', 'Категория', 'Название опции', 'Название для поставщика', 'Описание', 'Цена', 'Валюта', 'Поставщик', 'Производитель', 'Габариты (Д/Ш/В)'];
        const rows: string[][] = [];
        optionTypes.forEach(ot => {
            (variantsByType.get(ot.id) || []).forEach(ov => {
                const catName = categories.find(c => c.id === ov.categoryId)?.name || '';
                const supName = supplierMap.get(ov.supplierId || '')?.name || '';
                rows.push([
                    `"${(ot.name || '').replace(/"/g, '""')}"`,
                    `"${catName.replace(/"/g, '""')}"`,
                    `"${(ov.name || '').replace(/"/g, '""')}"`,
                    `"${(ov.supplierProductName || '').replace(/"/g, '""')}"`,
                    `"${(ov.description || '').replace(/"/g, '""')}"`,
                    ov.price.toString(), ov.currency,
                    `"${supName.replace(/"/g, '""')}"`,
                    `"${(ov.manufacturer || '').replace(/"/g, '""')}"`,
                    `"${ov.lengthMm || 0}/${ov.widthMm || 0}/${ov.heightMm || 0}"`,
                ]);
            });
        });
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `options_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        setImportStatus({ show: true, msg: 'Анализ файла...', type: 'loading', details: '0%' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length < 2) throw new Error('Файл пуст или некорректен');
                const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
                const catMap = new Map<string, string>(categories.map(c => [c.name.toLowerCase(), c.id]));
                const supMap = new Map<string, string>(suppliers.map(s => [s.name.toLowerCase(), s.id]));
                const typeMap = new Map<string, string>(optionTypes.map(t => [t.name.toLowerCase(), t.id]));
                const pendingTypes = new Map<string, OptionType>();
                const pendingCategories = new Map<string, any>();
                const rows: Record<string, string>[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row: Record<string, string> = {};
                    headers.forEach((h, idx) => row[h] = values[idx]);
                    rows.push(row);
                    const typeName = row['Тип опции']; const catName = row['Категория'];
                    if (typeName && !typeMap.has(typeName.toLowerCase()) && !pendingTypes.has(typeName.toLowerCase()))
                        pendingTypes.set(typeName.toLowerCase(), { id: ApiService.generateId(), name: typeName, isSingleSelect: true, isRequired: false });
                    if (catName && !catMap.has(catName.toLowerCase()) && !pendingCategories.has(catName.toLowerCase()))
                        pendingCategories.set(catName.toLowerCase(), { id: ApiService.generateId(), name: catName, type: ProductType.MACHINE });
                }
                if (pendingTypes.size > 0) {
                    const created = await actions.addOptionTypesBulk(Array.from(pendingTypes.values()));
                    created.forEach(t => typeMap.set(t.name.toLowerCase(), t.id));
                }
                if (pendingCategories.size > 0) {
                    const created = await actions.addCategoriesBulk(Array.from(pendingCategories.values()));
                    created.forEach(c => catMap.set(c.name.toLowerCase(), c.id));
                }
                const variantsToUpsert: OptionVariant[] = [];
                for (const row of rows) {
                    const typeName = row['Тип опции']; const variantName = row['Название опции'];
                    if (!typeName || !variantName) continue;
                    const typeId = typeMap.get(typeName.toLowerCase()); if (!typeId) continue;
                    const catId = row['Категория'] ? catMap.get(row['Категория'].toLowerCase()) : undefined;
                    const supId = row['Поставщик'] ? supMap.get(row['Поставщик'].toLowerCase()) : undefined;
                    const rawCurrency = (row['Валюта'] || 'CNY').toUpperCase();
                    let currency = rawCurrency as Currency; if (rawCurrency === 'RMB') currency = Currency.Cny;
                    const [l, w, h] = (row['Габариты (Д/Ш/В)'] || '0/0/0').split('/').map(v => parseFloat(v) || 0);
                    const existing = optionVariants.find(ov => ov.typeId === typeId && ov.name.toLowerCase() === variantName.toLowerCase() && ov.categoryId === catId);
                    variantsToUpsert.push({
                        id: existing?.id || ApiService.generateId(), typeId,
                        name: variantName, supplierProductName: row['Название для поставщика'] || existing?.supplierProductName || '',
                        description: row['Описание'] || existing?.description || '',
                        categoryId: catId, supplierId: supId || existing?.supplierId || '',
                        manufacturer: row['Производитель'] || existing?.manufacturer || '',
                        price: parseFloat(row['Цена']?.replace(',', '.') || '0'), currency,
                        lengthMm: l, widthMm: w, heightMm: h, volumeM3: (l * w * h) / 1_000_000_000,
                        composition: existing?.composition || [], imageUrl: existing?.imageUrl || '',
                    });
                }
                const CHUNK = 50;
                for (let i = 0; i < variantsToUpsert.length; i += CHUNK)
                    await actions.upsertOptionVariantsBulk(variantsToUpsert.slice(i, i + CHUNK));
                setImportStatus({ show: true, type: 'success', msg: 'Импорт завершен' });
            } catch (err: any) {
                setImportStatus({ show: true, msg: `Ошибка: ${err.message}`, type: 'error' });
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex h-full gap-6 overflow-hidden relative">
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />

            {/* Import status overlay */}
            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4"/> : importStatus.type === 'success' ? <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4"/> : <AlertCircle size={48} className="mx-auto text-red-500 mb-4"/>}
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                        {importStatus.details && <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-xs whitespace-pre-wrap text-slate-600 border border-slate-100 max-h-48 overflow-y-auto">{importStatus.details}</div>}
                        {importStatus.type !== 'loading' && <button onClick={() => setImportStatus({ ...importStatus, show: false })} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest">ОК</button>}
                    </div>
                </div>
            )}

            {/* Mass Add Modal — isolated re-renders */}
            {isMassAddModalOpen && (
                <MassAddModal
                    selectedVariantsToApply={selectedVariantsToApply}
                    variantMap={variantMap}
                    machines={machineProducts}
                    suppliers={suppliers}
                    onClose={() => setIsMassAddModalOpen(false)}
                    onConfirm={handleConfirmMassAdd}
                />
            )}

            {/* Left panel: Type list */}
            <div className="w-72 flex-none flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
                <div className="px-3 py-2 bg-slate-50 border-b flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-nowrap">Типы опций ({filteredOptionTypes.length})</span>
                        <div className="flex gap-1">
                            {canImportExport && (<>
                                <button onClick={handleExportCSV} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Download size={12}/></button>
                                <button onClick={() => fileInputRef.current?.click()} className="p-1 text-slate-400 hover:text-orange-600 transition-colors"><Upload size={12}/></button>
                            </>)}
                            <button onClick={() => setShowTypeFilters(!showTypeFilters)} className={`p-1 transition-colors ${showTypeFilters || typeSupplierFilter || typeMachineCategoryFilter || typeManufacturerFilter ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><Filter size={12}/></button>
                            {canWriteGroups && <button onClick={() => { setIsCreatingType(true); setEditingTypeId(null); setNewType({ name: '', isRequired: false, isSingleSelect: true }); }} className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all shadow-sm"><Plus size={12}/></button>}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            <input className="w-full pl-8 pr-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 transition-all" placeholder="Поиск по названию..." value={typeSearch} onChange={e => setTypeSearch(e.target.value)}/>
                        </div>
                        {showTypeFilters && (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-inner space-y-1.5 animate-in slide-in-from-top-2">
                                <select className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none" value={typeSupplierFilter} onChange={e => setTypeSupplierFilter(e.target.value)}>
                                    <option value="">Все поставщики</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <select className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none" value={typeMachineCategoryFilter} onChange={e => setTypeMachineCategoryFilter(e.target.value)}>
                                    <option value="">Все категории станков</option>{machineCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none" placeholder="Производитель..." value={typeManufacturerFilter} onChange={e => setTypeManufacturerFilter(e.target.value)}/>
                                {(typeSupplierFilter || typeMachineCategoryFilter || typeManufacturerFilter) && (
                                    <button onClick={() => { setTypeSupplierFilter(''); setTypeMachineCategoryFilter(''); setTypeManufacturerFilter(''); }} className="w-full text-[9px] font-black text-blue-600 uppercase pt-1 text-center hover:underline">Сбросить фильтры</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isCreatingType && (
                    <div className="p-2 bg-blue-100 border-b space-y-2">
                        <input className="w-full p-1.5 rounded-lg text-xs font-bold border border-slate-300 outline-none" placeholder="Название типа..." value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} autoFocus/>
                        <div className="flex flex-col gap-1">
                            <label className="flex items-center text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" className="mr-2" checked={newType.isSingleSelect} onChange={e => setNewType({ ...newType, isSingleSelect: e.target.checked })}/> Выбор одного (Radio)</label>
                            <label className="flex items-center text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" className="mr-2" checked={newType.isRequired} onChange={e => setNewType({ ...newType, isRequired: e.target.checked })}/> Обязательно</label>
                        </div>
                        {validationError && <p className="text-[9px] text-red-500 font-bold">{validationError}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => setIsCreatingType(false)} className="flex-1 py-1 text-[10px] font-bold text-slate-500 bg-white rounded-lg border hover:bg-slate-50">Отмена</button>
                            <button onClick={handleSaveType} className="flex-1 py-1 text-[10px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">Сохранить</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {filteredOptionTypes.map(ot => {
                        const isActive = selectedTypeId === ot.id;
                        const typeVariants = variantsByType.get(ot.id) || [];
                        const uniqueCats = new Set(typeVariants.map(v => v.categoryId).filter(Boolean)).size;
                        return (
                            <div key={ot.id} onClick={() => setSelectedTypeId(ot.id)} className={`p-3 rounded-lg border transition-all cursor-pointer group ${isActive ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}>
                                <div className="flex justify-between items-center">
                                    <span className={`text-sm font-bold ${isActive ? 'text-blue-800' : 'text-slate-700'}`}>{ot.name}</span>
                                    {canWriteGroups && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={e => handleEditType(e, ot)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={12}/></button>
                                            <button onClick={e => handleDeleteType(e, ot.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-2 text-[8px] text-slate-400 font-medium">
                                    <div className="flex gap-1">
                                        <span className="bg-white border px-1.5 py-0.5 rounded font-bold">{ot.isSingleSelect ? 'Один' : 'Много'}</span>
                                        {ot.isRequired && <span className="bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded font-bold">Обяз.</span>}
                                    </div>
                                    <div className="flex gap-2 font-medium">
                                        <span title="Категорий" className="flex items-center gap-0.5"><Box size={10} className="text-slate-300"/>{uniqueCats}</span>
                                        <span title="Вариантов" className="flex items-center gap-0.5"><List size={10} className="text-slate-300"/>{typeVariants.length}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right panel: Variants */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-w-0">
                {selectedTypeId ? (
                    <div className="flex flex-col h-full">
                        <div className="px-4 py-2 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{optionTypes.find(t => t.id === selectedTypeId)?.name}</h3>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">Управление вариантами по категориям</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {isMassAddMode && selectedVariantsToApply.length > 0 && (
                                    <button onClick={startMassAdd} className="bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-lg animate-bounce">
                                        Добавить к станкам ({selectedVariantsToApply.length}) <ArrowRight size={12}/>
                                    </button>
                                )}
                                <div className="relative">
                                    <button onClick={() => setIsAddingSection(!isAddingSection)} className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all">
                                        <Plus size={12}/> Добавить категорию
                                    </button>
                                    {isAddingSection && (
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {machineCategories.filter(c => !visibleSections.includes(c.id)).map(c => (
                                                    <button key={c.id} onClick={() => handleAddSection(c.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg">{c.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar bg-slate-50/30">
                            {visibleSections.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                                    <LayoutList size={48} className="mb-2"/>
                                    <p className="font-black uppercase tracking-widest text-[10px]">Добавьте категорию</p>
                                </div>
                            ) : visibleSections.map(catId => {
                                const category = categories.find(c => c.id === catId);
                                const sectionFilter = sectionFilters[catId] || { supplierId: '', manufacturer: '' };
                                const rawVariants = variantsByTypeAndCat.get(selectedTypeId)?.get(catId) || [];
                                const variants = rawVariants
                                    .filter(v => !sectionFilter.supplierId || v.supplierId === sectionFilter.supplierId)
                                    .filter(v => !sectionFilter.manufacturer || (v.manufacturer || '').toLowerCase().includes(sectionFilter.manufacturer.toLowerCase()))
                                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
                                const isFormOpen = variantFormCategoryId === catId;
                                const isCollapsed = collapsedSections.includes(catId);
                                const selectedType = optionTypes.find(t => t.id === selectedTypeId)!;
                                const catOverride = selectedType?.categoryOverrides?.[catId];
                                const effectiveSingleSelect = catOverride?.isSingleSelect !== undefined ? catOverride.isSingleSelect : selectedType?.isSingleSelect;
                                const effectiveRequired = catOverride?.isRequired !== undefined ? catOverride.isRequired : selectedType?.isRequired;
                                const isSingleOverridden = catOverride?.isSingleSelect !== undefined;
                                const isRequiredOverridden = catOverride?.isRequired !== undefined;

                                return (
                                    <div key={catId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-2 py-1 bg-slate-50/80 border-b flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <button onClick={() => toggleSectionCollapse(catId)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400">
                                                    {isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                                                </button>
                                                <span className="text-xs font-black text-slate-800 truncate cursor-pointer" onClick={() => toggleSectionCollapse(catId)}>{category?.name}</span>
                                                <button
                                                    onClick={() => canWriteGroups && handleToggleCategoryOverride(catId, 'isSingleSelect')}
                                                    title={isSingleOverridden ? 'Переопределено для категории · нажмите чтобы изменить' : 'Глобальное значение · нажмите чтобы переопределить'}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-colors ${isSingleOverridden ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'} ${canWriteGroups ? 'cursor-pointer' : 'cursor-default'}`}
                                                >
                                                    {effectiveSingleSelect ? 'Один' : 'Много'}
                                                    {isSingleOverridden && <span className="ml-0.5 text-amber-500">●</span>}
                                                </button>
                                                <button
                                                    onClick={() => canWriteGroups && handleToggleCategoryOverride(catId, 'isRequired')}
                                                    title={isRequiredOverridden ? 'Переопределено для категории · нажмите чтобы изменить' : 'Глобальное значение · нажмите чтобы переопределить'}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-colors ${effectiveRequired ? isRequiredOverridden ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : 'bg-red-50 border-red-100 text-red-500 hover:border-red-200' : isRequiredOverridden ? 'bg-amber-50 border-amber-300 text-amber-400 hover:bg-amber-100' : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'} ${canWriteGroups ? 'cursor-pointer' : 'cursor-default'}`}
                                                >
                                                    Обяз.
                                                    {isRequiredOverridden && <span className="ml-0.5 text-amber-500">●</span>}
                                                </button>
                                                {canWriteVariants && !isFormOpen && !isCollapsed && (
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => handleOpenVariantForm(catId)} className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-black text-[9px] flex items-center gap-1 uppercase tracking-widest shadow-sm whitespace-nowrap">
                                                            <Plus size={12}/> Добавить
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const isThisCatActive = isMassAddMode && massAddCatId === catId;
                                                                if (isThisCatActive) {
                                                                    setIsMassAddMode(false);
                                                                    setMassAddCatId(null);
                                                                    setSelectedVariantsToApply([]);
                                                                } else {
                                                                    setIsMassAddMode(true);
                                                                    setMassAddCatId(catId);
                                                                    setSelectedVariantsToApply([]);
                                                                }
                                                            }}
                                                            className={`px-3 py-1 rounded-md transition-all font-black text-[9px] flex items-center gap-1 uppercase tracking-widest shadow-sm whitespace-nowrap ${isMassAddMode && massAddCatId === catId ? 'bg-orange-500 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white'}`}
                                                        >
                                                            <MousePointer2 size={12}/> {isMassAddMode && massAddCatId === catId ? 'Отмена выбора' : 'Выбрать массово'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {!isCollapsed && (
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <select className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md py-0.5 px-1 outline-none focus:ring-2 focus:ring-blue-100 w-28" value={sectionFilter.supplierId} onChange={e => setSectionFilters({ ...sectionFilters, [catId]: { ...sectionFilter, supplierId: e.target.value } })}>
                                                        <option value="">Все поставщики</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                    <input className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md py-0.5 px-2 outline-none focus:ring-2 focus:ring-blue-100 w-24" placeholder="Производитель..." value={sectionFilter.manufacturer} onChange={e => setSectionFilters({ ...sectionFilters, [catId]: { ...sectionFilter, manufacturer: e.target.value } })}/>
                                                </div>
                                            )}
                                        </div>

                                        {!isCollapsed && (
                                            <>
                                                {/* Variant Form — isolated component, no parent re-render on keystrokes */}
                                                {isFormOpen && (
                                                    <VariantForm
                                                        key={editingVariant?.id ?? `new-${catId}`}
                                                        categoryId={catId}
                                                        selectedTypeId={selectedTypeId}
                                                        initialVariant={editingVariant}
                                                        isCopy={isCloning}
                                                        suppliers={suppliers}
                                                        manufacturers={manufacturers}
                                                        machineCategories={machineCategories}
                                                        productMap={productMap}
                                                        filteredBOMProducts={bomProducts}
                                                        supplierMap={supplierMap}
                                                        canWriteVariants={canWriteVariants}
                                                        onSave={handleSaveVariantData}
                                                        onCancel={() => { setVariantFormCategoryId(null); setEditingVariant(null); setIsCloning(false); }}
                                                    />
                                                )}

                                                {/* Variant cards grid */}
                                                <div className="p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                                    {variants.map(v => {
                                                        const sup = supplierMap.get(v.supplierId || '');
                                                        const isSelectedForMassAdd = selectedVariantsToApply.includes(v.id);
                                                        const isDeleted = deletedVariantIds.has(v.id);
                                                        const isThisCatMassAdd = isMassAddMode && massAddCatId === catId;
                                                        return (
                                                            <div
                                                                key={v.id}
                                                                onClick={() => isThisCatMassAdd && !isDeleted && toggleVariantSelection(v.id)}
                                                                className={`p-2 rounded-lg border transition-all group bg-white flex flex-col gap-0.5 shadow-sm overflow-hidden relative ${
                                                                    isDeleted ? 'border-red-200 bg-red-50/30 grayscale-[0.5]'
                                                                    : isThisCatMassAdd
                                                                        ? (isSelectedForMassAdd ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-blue-400 cursor-pointer')
                                                                    : isMassAddMode
                                                                        ? 'border-slate-100 opacity-40 pointer-events-none'
                                                                        : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                                                                }`}
                                                            >
                                                                {isDeleted && (
                                                                    <div className="absolute top-0 right-0 p-1 bg-red-500 text-white text-[7px] font-black uppercase rounded-bl-lg shadow-sm z-10 flex items-center gap-1">
                                                                        <AlertTriangle size={8}/> В корзине
                                                                    </div>
                                                                )}
                                                                <div className="flex gap-2">
                                                                    {isThisCatMassAdd && !isDeleted ? (
                                                                        <div className={`w-5 h-5 rounded flex-none flex items-center justify-center border transition-all ${isSelectedForMassAdd ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 bg-slate-50'}`}>
                                                                            {isSelectedForMassAdd && <Check size={12}/>}
                                                                        </div>
                                                                    ) : (v.imageUrl && (
                                                                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex-none overflow-hidden flex items-center justify-center">
                                                                            <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform"/>
                                                                        </div>
                                                                    ))}
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <h4 className={`font-bold text-[11px] leading-tight break-words ${isDeleted ? 'text-red-800' : 'text-slate-800'}`}>{v.name}</h4>
                                                                                {v.description && (
                                                                                    <div className="group/tooltip relative flex-shrink-0">
                                                                                        <AlertCircle size={12} className="text-slate-400 hover:text-indigo-600 cursor-help transition-colors"/>
                                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-slate-700">{v.description}</div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {canWriteVariants && !isMassAddMode && !isDeleted && (
                                                                                <div className="flex gap-1 transition-all flex-shrink-0">
                                                                                    <button onClick={e => { e.stopPropagation(); handleCloneVariant(v); }} className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Клонировать"><Copy size={12}/></button>
                                                                                    <button onClick={e => { e.stopPropagation(); handleOpenVariantForm(catId, v); }} className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors" title="Редактировать"><Pencil size={12}/></button>
                                                                                    <button onClick={e => { e.stopPropagation(); handleDeleteVariant(v.id); }} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors" title="Удалить"><Trash2 size={12}/></button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {sup && <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded border border-indigo-100 uppercase tracking-tight flex items-center gap-0.5 max-w-full truncate"><User size={8}/> {sup.name}</span>}
                                                                            {v.manufacturer && <span className="text-[7px] font-black bg-purple-50 text-purple-600 px-1 py-0.5 rounded border border-purple-100 uppercase tracking-tight flex items-center gap-0.5 max-w-full truncate"><Factory size={8}/> {v.manufacturer}</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-end border-t border-slate-50 pt-1 mt-0.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><Layers size={10}/> {v.composition?.length || 0}</div>
                                                                        {(v.lengthMm || v.widthMm || v.heightMm) ? <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400"><Box size={10}/> {v.volumeM3?.toFixed(3)} м³</div> : null}
                                                                    </div>
                                                                    {showPrices
                                                                        ? <span className={`text-[10px] font-black font-mono leading-none ${isDeleted ? 'text-red-400' : 'text-emerald-600'}`}>{v.price.toLocaleString()} {v.currency}</span>
                                                                        : <span className="text-[8px] font-bold text-slate-300 italic leading-none">Скрыто</span>
                                                                    }
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {variants.length === 0 && !isFormOpen && (
                                                        <div className="col-span-full py-4 text-center text-[9px] text-slate-300 italic font-bold uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-xl">Нет вариантов</div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                        <Settings size={48} className="mb-3"/>
                        <p className="font-black uppercase tracking-widest text-[10px]">Выберите тип опции слева</p>
                    </div>
                )}
            </div>
        </div>
    );
};
