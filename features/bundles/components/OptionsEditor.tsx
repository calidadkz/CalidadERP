
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductType, OptionType, OptionVariant, Currency, ProductCategory, Product, MachineConfigEntry } from '@/types';
import { Plus, Trash2, Pencil, X, Layers, Settings, Download, Upload, AlertCircle, Loader2, CheckCircle, Factory, Box, LayoutList, User, Search, List, Copy, Filter, ChevronDown, ChevronRight, Image as ImageIcon, MousePointer2, Check, ArrowRight, Tag, AlertTriangle } from 'lucide-react';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { storage as firebaseStorage } from '@/services/firebase';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { MediaLibraryModal } from '@/components/ui/MediaLibraryModal';

export interface StorageImage {
    name: string;
    url: string;
}

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
    const variantImageInputRef = useRef<HTMLInputElement>(null);

    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [isCreatingType, setIsCreatingType] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [newType, setNewType] = useState<Partial<OptionType>>({ name: '', isRequired: false, isSingleSelect: true });
    
    const [typeSearch, setTypeSearch] = useState('');
    const [showTypeFilters, setShowTypeFilters] = useState(false);
    const [typeSupplierFilter, setTypeSupplierFilter] = useState('');
    const [typeMachineCategoryFilter, setTypeMachineCategoryFilter] = useState('');
    const [typeManufacturerFilter, setTypeManufacturerFilter] = useState('');
    
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
    const [newVariant, setNewVariant] = useState<Partial<OptionVariant>>({ name: '', price: 0, currency: Currency.Cny, composition: [], lengthMm: 0, widthMm: 0, heightMm: 0, imageUrl: '' });
    const [variantFormCategoryId, setVariantFormCategoryId] = useState<string | null>(null); 
    
    const [manufacturerSearch, setManufacturerSearch] = useState('');
    const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [compSearch, setCompSearch] = useState('');
    const [showCompDropdown, setShowCompDropdown] = useState(false);

    const [sectionFilters, setSectionFilters] = useState<Record<string, { supplierId: string, manufacturer: string }>>({});
    const [visibleSections, setVisibleSections] = useState<string[]>([]);
    const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
    const [isAddingSection, setIsAddingSection] = useState(false);

    const [compProductId, setCompProductId] = useState('');
    const [compQty, setCompQty] = useState(1);
    
    const [validationError, setValidationError] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<{ show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string }>({ show: false, msg: '', type: 'loading' });

    const [isMassAddMode, setIsMassAddMode] = useState(false);
    const [selectedVariantsToApply, setSelectedVariantsToApply] = useState<string[]>([]);
    const [isMassAddModalOpen, setIsMassAddModalOpen] = useState(false);
    const [massAddSearch, setMassAddSearch] = useState('');
    const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
    const [variantPriceOverrides, setVariantPriceOverrides] = useState<Record<string, number | ''>>({});

    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [storageImages, setStorageImages] = useState<StorageImage[]>([]);
    const [isImagesLoading, setIsImagesLoading] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Вычисляем ID вариантов, которые находятся в корзине
    const deletedVariantIds = useMemo(() => 
        new Set(trash.filter(t => t.type === 'OptionVariant').map(t => t.originalId)), 
        [trash]
    );

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE), [categories]);

    const loadStorageImages = useCallback(async () => {
        setIsImagesLoading(true);
        try {
            const listRef = ref(firebaseStorage, 'product-photos');
            const res = await listAll(listRef);
            const imagePromises = res.items.map(async (item) => {
                const url = await getDownloadURL(item);
                return { name: item.name, url };
            });
            const images = await Promise.all(imagePromises);
            setStorageImages(images);
        } catch (err) { console.error('[Firebase Storage] Load error:', err); } finally { setIsImagesLoading(false); }
    }, []);

    const uploadImage = async (file: File) => {
        setIsUploadingImage(true);
        try {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
            const fileExt = file.name.split('.').pop();
            const sanitizedBase = baseName.replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_');
            const fileName = `${sanitizedBase}_${Date.now()}.${fileExt}`;
            const storageRef = ref(firebaseStorage, `product-photos/${fileName}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            await loadStorageImages();
            setNewVariant(prev => ({ ...prev, imageUrl: downloadURL }));
        } catch (err) { alert("Ошибка при загрузке изображения"); } finally { setIsUploadingImage(false); }
    };

    useEffect(() => { loadStorageImages(); }, [loadStorageImages]);

    const filteredOptionTypes = useMemo(() => {
        return optionTypes
            .filter(ot => {
                const matchName = (ot.name || '').toLowerCase().includes(typeSearch.toLowerCase());
                const matchSupplier = !typeSupplierFilter || ot.supplierId === typeSupplierFilter || optionVariants.some(v => v.typeId === ot.id && v.supplierId === typeSupplierFilter);
                const matchMachine = !typeMachineCategoryFilter || optionVariants.some(v => v.typeId === ot.id && v.categoryId === typeMachineCategoryFilter);
                const matchManufacturer = !typeManufacturerFilter || optionVariants.some(v => v.typeId === ot.id && (v.manufacturer || '').toLowerCase().includes(typeManufacturerFilter.toLowerCase()));
                return matchName && matchSupplier && matchMachine && matchManufacturer;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [optionTypes, typeSearch, typeSupplierFilter, typeMachineCategoryFilter, typeManufacturerFilter, optionVariants]);

    useEffect(() => {
        if (selectedTypeId) {
            const usedCategories = new Set<string>();
            optionVariants.filter(v => v.typeId === selectedTypeId).forEach(v => { if (v.categoryId) usedCategories.add(v.categoryId); });
            const sections = Array.from(usedCategories);
            setVisibleSections(sections);
            setCollapsedSections(sections);
        } else { setVisibleSections([]); setCollapsedSections([]); }
    }, [selectedTypeId]); 

    useEffect(() => {
        if (selectedTypeId) {
            const usedCategories = new Set<string>();
            optionVariants.filter(v => v.typeId === selectedTypeId).forEach(v => { if (v.categoryId) usedCategories.add(v.categoryId); });
            const sections = Array.from(usedCategories);
            setVisibleSections(prev => { if (prev.length === sections.length && prev.every(s => sections.includes(s))) return prev; return sections; });
        }
    }, [optionVariants, selectedTypeId]);

    const toggleSectionCollapse = (catId: string) => { setCollapsedSections(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]); };

    const handleSaveType = async () => {
        if (!canWriteGroups || !newType.name) return;
        setValidationError(null);
        const duplicate = optionTypes.find(ot => ot.name?.toLowerCase().trim() === newType.name?.toLowerCase().trim() && ot.id !== editingTypeId);
        if (duplicate) { setValidationError(`Группа "${newType.name}" уже существует`); return; }
        if (editingTypeId) await actions.updateOptionType({ ...newType, id: editingTypeId } as OptionType);
        else await actions.addOptionType({ ...newType, id: ApiService.generateId() } as OptionType);
        setIsCreatingType(false); setEditingTypeId(null); setNewType({ name: '', isRequired: false, isSingleSelect: true });
    };

    const handleEditType = (e: React.MouseEvent, ot: OptionType) => { e.stopPropagation(); if (!canSeeGroups) return; setNewType(ot); setEditingTypeId(ot.id); setIsCreatingType(true); };
    const handleDeleteType = (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (!canWriteGroups) return; if(confirm("Удалить группу опций и все входящие в нее варианты?")) { actions.deleteOptionType(id); if (selectedTypeId === id) setSelectedTypeId(null); } };
    const handleAddSection = (catId: string) => { if (!visibleSections.includes(catId)) { setVisibleSections(prev => [...prev, catId]); setCollapsedSections(prev => prev.filter(id => id !== catId)); } setIsAddingSection(false); };

    const handleOpenVariantForm = (categoryId: string, variant?: OptionVariant) => {
        setVariantFormCategoryId(categoryId);
        if (variant) {
            setEditingVariantId(variant.id); setNewVariant({ ...variant }); 
            setManufacturerSearch(variant.manufacturer || '');
            setSupplierSearch(suppliers.find(s => s.id === variant.supplierId)?.name || '');
            setCategorySearch(categories.find(c => c.id === variant.categoryId)?.name || '');
        } else {
            setEditingVariantId(null);
            setNewVariant({ name: '', supplierProductName: '', description: '', price: 0, currency: Currency.Cny, composition: [], categoryId: categoryId, supplierId: '', manufacturer: '', lengthMm: 0, widthMm: 0, heightMm: 0, imageUrl: '' });
            setManufacturerSearch(''); setSupplierSearch(''); setCategorySearch(categories.find(c => c.id === categoryId)?.name || '');
        }
    };

    const handleCloneVariant = (variant: OptionVariant) => {
        setVariantFormCategoryId(variant.categoryId || null);
        setEditingVariantId(null);
        setNewVariant({ ...variant, id: undefined, name: `${variant.name} (копия)` });
        setManufacturerSearch(variant.manufacturer || '');
        setSupplierSearch(suppliers.find(s => s.id === variant.supplierId)?.name || '');
        setCategorySearch(categories.find(c => c.id === variant.categoryId)?.name || '');
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
            currency: newVariant.currency || Currency.Cny,
            composition: newVariant.composition || [],
            supplierId: newVariant.supplierId || '',
            manufacturer: newVariant.manufacturer || '',
            lengthMm: newVariant.lengthMm || 0,
            widthMm: newVariant.widthMm || 0,
            heightMm: newVariant.heightMm || 0,
            volumeM3: ((newVariant.lengthMm || 0) * (newVariant.widthMm || 0) * (newVariant.heightMm || 0)) / 1_000_000_000,
            imageUrl: newVariant.imageUrl || ''
        };
        if (editingVariantId) await actions.updateOptionVariant(ovData);
        else await actions.addOptionVariant(ovData);
        setVariantFormCategoryId(null);
        setNewVariant({ name: '', price: 0, currency: Currency.Cny, composition: [], lengthMm: 0, widthMm: 0, heightMm: 0, imageUrl: '' });
    };

    const handleDeleteVariant = (id: string) => { if(confirm("Переместить вариант в корзину?")) actions.deleteOptionVariant(id); };

    const addBOMItem = () => {
        if (!canWriteVariants || !compProductId) return;
        const current = newVariant.composition || [];
        const existingIndex = current.findIndex(item => item.productId === compProductId);
        if (existingIndex > -1) {
            const updated = [...current];
            updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + compQty };
            setNewVariant({ ...newVariant, composition: updated });
        } else { setNewVariant({ ...newVariant, composition: [...current, { productId: compProductId, quantity: compQty }] }); }
        setCompProductId(''); setCompQty(1); setCompSearch('');
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
        const file = event.target.files?.[0]; if (!file) return;
        setImportStatus({ show: true, msg: 'Анализ файла...', type: 'loading', details: '0%' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string; const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0); if (lines.length < 2) throw new Error("Файл пуст или некорректен");
                const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
                const catMap = new Map<string, string>(categories.map(c => [c.name.toLowerCase(), c.id])); const supMap = new Map<string, string>(suppliers.map(s => [s.name.toLowerCase(), s.id])); const typeMap = new Map<string, string>(optionTypes.map(t => [t.name.toLowerCase(), t.id]));
                const pendingTypes = new Map<string, OptionType>(); const pendingCategories = new Map<string, ProductCategory>(); const rows: Record<string, string>[] = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row: Record<string, string> = {}; headers.forEach((h, idx) => row[h] = values[idx]); rows.push(row);
                    const typeName = row['Тип опции']; const catName = row['Категория'];
                    if (typeName && !typeMap.has(typeName.toLowerCase()) && !pendingTypes.has(typeName.toLowerCase())) { pendingTypes.set(typeName.toLowerCase(), { id: ApiService.generateId(), name: typeName, isSingleSelect: true, isRequired: false }); }
                    if (catName && !catMap.has(catName.toLowerCase()) && !pendingCategories.has(catName.toLowerCase())) { pendingCategories.set(catName.toLowerCase(), { id: ApiService.generateId(), name: catName, type: ProductType.MACHINE }); }
                }
                if (pendingTypes.size > 0) { const createdTypes = await actions.addOptionTypesBulk(Array.from(pendingTypes.values())); createdTypes.forEach(t => typeMap.set(t.name.toLowerCase(), t.id)); }
                if (pendingCategories.size > 0) { const createdCats = await actions.addCategoriesBulk(Array.from(pendingCategories.values())); createdCats.forEach(c => catMap.set(c.name.toLowerCase(), c.id)); }
                const variantsToUpsert: OptionVariant[] = [];
                for (const row of rows) {
                    const typeName = row['Тип опции']; const variantName = row['Название опции']; if (!typeName || !variantName) continue;
                    const typeId = typeMap.get(typeName.toLowerCase()); if (!typeId) continue;
                    const catId = row['Категория'] ? catMap.get(row['Категория'].toLowerCase()) : undefined;
                    const supId = row['Поставщик'] ? supMap.get(row['Поставщик'].toLowerCase()) : undefined;
                    const rawCurrency = (row['Валюта'] || 'CNY').toUpperCase(); let currency = rawCurrency as Currency; if (rawCurrency === 'RMB') currency = Currency.Cny;
                    const dimsStr = row['Габариты (Д/Ш/В)'] || '0/0/0'; const [l, w, h] = dimsStr.split('/').map(v => parseFloat(v) || 0);
                    const existingVariant = optionVariants.find(ov => ov.typeId === typeId && ov.name.toLowerCase() === variantName.toLowerCase() && ov.categoryId === catId);
                    variantsToUpsert.push({ id: existingVariant?.id || ApiService.generateId(), typeId: typeId, name: variantName, supplierProductName: row['Название для поставщика'] || existingVariant?.supplierProductName || '', description: row['Описание'] || existingVariant?.description || '', categoryId: catId, supplierId: supId || existingVariant?.supplierId || '', manufacturer: row['Производитель'] || existingVariant?.manufacturer || '', price: parseFloat(row['Цена']?.replace(',', '.') || '0'), currency: currency, lengthMm: l, widthMm: w, heightMm: h, volumeM3: (l * w * h) / 1_000_000_000, composition: existingVariant?.composition || [], imageUrl: existingVariant?.imageUrl || '' });
                }
                const CHUNK_SIZE = 50; for (let i = 0; i < variantsToUpsert.length; i += CHUNK_SIZE) { await actions.upsertOptionVariantsBulk(variantsToUpsert.slice(i, i + CHUNK_SIZE)); }
                setImportStatus({ show: true, type: 'success', msg: 'Импорт завершен' });
            } catch (err: any) { setImportStatus({ show: true, msg: `Ошибка: ${err.message}`, type: 'error' }); }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const toggleVariantSelection = (id: string) => { setSelectedVariantsToApply(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]); };
    const startMassAdd = () => { if (selectedVariantsToApply.length === 0) return; setVariantPriceOverrides({}); setIsMassAddModalOpen(true); };
    const filteredMachinesForMassAdd = useMemo(() => {
        const firstVariant = optionVariants.find(v => v.id === selectedVariantsToApply[0]); const targetCategoryId = firstVariant?.categoryId;
        return products.filter(p => {
            if (p.type !== ProductType.MACHINE) return false; if (targetCategoryId && p.categoryId !== targetCategoryId) return false;
            const machineConfigs = p.machineConfig || []; const allAllowedVariantIds = machineConfigs.flatMap(c => c.allowedVariantIds || []); const hasMissingOptions = selectedVariantsToApply.some(vId => !allAllowedVariantIds.includes(vId)); if (!hasMissingOptions) return false;
            const searchLower = massAddSearch.toLowerCase(); return p.name.toLowerCase().includes(searchLower) || p.sku.toLowerCase().includes(searchLower);
        });
    }, [products, selectedVariantsToApply, optionVariants, massAddSearch]);

    const handleConfirmMassAdd = async () => {
        if (selectedMachines.length === 0 || selectedVariantsToApply.length === 0) return;
        const updates = selectedMachines.map(mId => {
            const product = products.find(p => p.id === mId); if (!product) return null;
            const currentConfigs = [...(product.machineConfig || [])];
            selectedVariantsToApply.forEach(vId => {
                const variant = optionVariants.find(v => v.id === vId); if (!variant) return;
                let configGroup = currentConfigs.find(c => c.typeId === variant.typeId);
                if (!configGroup) { configGroup = { typeId: variant.typeId, allowedVariantIds: [], priceOverrides: {} }; currentConfigs.push(configGroup); }
                if (!configGroup.allowedVariantIds.includes(vId)) { configGroup.allowedVariantIds = [...configGroup.allowedVariantIds, vId]; }
                const override = variantPriceOverrides[vId];
                if (override !== '' && override !== undefined) {
                    configGroup.priceOverrides = { ...configGroup.priceOverrides, [vId]: Number(override) };
                }
            });
            return { ...product, machineConfig: currentConfigs };
        }).filter(Boolean) as Product[];
        for (const prod of updates) { await actions.updateProduct(prod); }
        setIsMassAddModalOpen(false); setIsMassAddMode(false); setSelectedVariantsToApply([]); setSelectedMachines([]); setVariantPriceOverrides({});
        alert(`Опции успешно добавлены к ${updates.length} станкам`);
    };

    const filteredBOMProducts = useMemo(() => {
        return products
            .filter(p => p.type === ProductType.PART)
            .filter(p => {
                const s = compSearch.toLowerCase();
                const supplier = suppliers.find(sup => sup.id === p.supplierId)?.name || '';
                const category = categories.find(cat => cat.id === p.categoryId)?.name || '';
                return p.name.toLowerCase().includes(s) || 
                       p.sku.toLowerCase().includes(s) || 
                       supplier.toLowerCase().includes(s) ||
                       category.toLowerCase().includes(s) ||
                       (p.manufacturer || '').toLowerCase().includes(s);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, compSearch, suppliers, categories]);

    return (
        <div className="flex h-full gap-6 overflow-hidden relative">
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
            <input type="file" ref={variantImageInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} className="hidden" />
            
            <MediaLibraryModal isOpen={isMediaModalOpen} onClose={() => setIsMediaModalOpen(false)} images={storageImages} isLoading={isImagesLoading} onSelect={(url) => setNewVariant(prev => ({ ...prev, imageUrl: url }))} currentUrl={newVariant.imageUrl} />

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

            {isMassAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                            <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Массовое добавление опций</h3><p className="text-xs text-slate-400 font-bold mt-1">Выбрано опций: <span className="text-blue-600">{selectedVariantsToApply.length}</span>. Выберите станки для применения.</p></div>
                            <button onClick={() => setIsMassAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-xl border border-slate-200 shadow-sm"><X size={20}/></button>
                        </div>
                        {/* Выбранные варианты с индивидуальными ценами */}
                        <div className="p-4 bg-indigo-50/40 border-b space-y-2">
                            <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2">Выбранные варианты — индивидуальная цена (₸)</div>
                            <div className="flex flex-wrap gap-2">
                                {selectedVariantsToApply.map(vId => {
                                    const v = optionVariants.find(ov => ov.id === vId);
                                    if (!v) return null;
                                    const overrideVal = variantPriceOverrides[vId];
                                    return (
                                        <div key={vId} className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-3 py-2 shadow-sm">
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-black text-slate-800 truncate max-w-[140px]">{v.name}</div>
                                                <div className="text-[8px] text-slate-400 font-mono">{v.price.toLocaleString()} {v.currency}</div>
                                            </div>
                                            <input
                                                type="number"
                                                className={`w-24 px-2 py-1.5 rounded-lg text-xs font-black text-right outline-none border transition-all ${overrideVal !== '' && overrideVal !== undefined ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                                                placeholder="Цена ₸"
                                                value={overrideVal ?? ''}
                                                onChange={e => setVariantPriceOverrides(prev => ({ ...prev, [vId]: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 }))}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-[8px] text-slate-400 italic">Если оставить пустым — будет использоваться базовая цена варианта</div>
                        </div>
                        <div className="p-4 bg-white border-b flex gap-4 items-center">
                            <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Поиск станков по названию или артикулу..." value={massAddSearch} onChange={e => setMassAddSearch(e.target.value)}/></div>
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Найдено: {filteredMachinesForMassAdd.length}</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-4 py-2 text-left w-10"><input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={selectedMachines.length === filteredMachinesForMassAdd.length && filteredMachinesForMassAdd.length > 0} onChange={(e) => { if (e.target.checked) setSelectedMachines(filteredMachinesForMassAdd.map(m => m.id)); else setSelectedMachines([]); }}/></th><th className="px-4 py-2 text-left">Наименование</th><th className="px-4 py-2 text-left">Поставщик / Произв.</th><th className="px-4 py-2 text-right">Закуп / Продажа</th></tr></thead>
                                <tbody>
                                    {filteredMachinesForMassAdd.map(m => {
                                        const supplier = suppliers.find(s => s.id === m.supplierId); const isSelected = selectedMachines.includes(m.id);
                                        return (
                                            <tr key={m.id} onClick={() => setSelectedMachines(prev => isSelected ? prev.filter(id => id !== m.id) : [...prev, m.id])} className={`group cursor-pointer transition-all ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'} rounded-xl shadow-sm`}><td className="px-4 py-4 rounded-l-xl"><input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={isSelected} onChange={() => {}}/></td><td className="px-4 py-4"><div className="text-sm font-bold text-slate-700">{m.name}</div><div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">{m.sku}</div></td><td className="px-4 py-4"><div className="text-[10px] font-bold text-slate-600">{supplier?.name || '—'}</div><div className="text-[9px] text-slate-400">{m.manufacturer || '—'}</div></td><td className="px-4 py-4 text-right rounded-r-xl"><div className="text-[10px] font-bold text-slate-600">{(m.basePrice || 0).toLocaleString()} {m.currency}</div><div className="text-[11px] font-black text-green-600">{(m.salesPrice || 0).toLocaleString()} ₸</div></td></tr>
                                        );
                                    })}
                                    {filteredMachinesForMassAdd.length === 0 && (<tr><td colSpan={4} className="py-20 text-center text-slate-400 italic font-medium">Станки не найдены или уже имеют все выбранные опции</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t bg-slate-50 flex justify-between items-center"><div className="text-xs font-bold text-slate-500">Выбрано станков: <span className="text-blue-600">{selectedMachines.length}</span></div><div className="flex gap-4"><button onClick={() => setIsMassAddModalOpen(false)} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Отмена</button><button onClick={handleConfirmMassAdd} disabled={selectedMachines.length === 0} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"><Check size={16}/> Применить</button></div></div>
                    </div>
                </div>
            )}

            <div className="w-72 flex-none flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
                <div className="px-3 py-2 bg-slate-50 border-b flex flex-col gap-2">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-nowrap">Типы опций ({filteredOptionTypes.length})</span><div className="flex gap-1">{canImportExport && (<><button onClick={handleExportCSV} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Download size={12}/></button><button onClick={() => fileInputRef.current?.click()} className="p-1 text-slate-400 hover:Orange-600 transition-colors"><Upload size={12}/></button></>)}<button onClick={() => setShowTypeFilters(!showTypeFilters)} className={`p-1 transition-colors ${showTypeFilters || typeSupplierFilter || typeMachineCategoryFilter || typeManufacturerFilter ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><Filter size={12}/></button>{canWriteGroups && <button onClick={() => { setIsCreatingType(true); setEditingTypeId(null); setNewType({ name: '', isRequired: false, isSingleSelect: true }); }} className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all shadow-sm"><Plus size={12}/></button>}</div></div>
                    <div className="space-y-1.5">
                        <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/><input className="w-full pl-8 pr-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 transition-all" placeholder="Поиск по названию..." value={typeSearch} onChange={e => setTypeSearch(e.target.value)} /></div>
                        {showTypeFilters && (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-inner space-y-1.5 animate-in slide-in-from-top-2">
                                <select className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none" value={typeSupplierFilter} onChange={e => setTypeSupplierFilter(e.target.value)}><option value="">Все поставщики</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                <select className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none" value={typeMachineCategoryFilter} onChange={e => setTypeMachineCategoryFilter(e.target.value)}><option value="">Все категории станков</option>{machineCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                <input className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 outline-none" placeholder="Производитель..." value={typeManufacturerFilter} onChange={e => setTypeManufacturerFilter(e.target.value)} />
                                {(typeSupplierFilter || typeMachineCategoryFilter || typeManufacturerFilter) && (<button onClick={() => { setTypeSupplierFilter(''); setTypeMachineCategoryFilter(''); setTypeManufacturerFilter(''); }} className="w-full text-[9px] font-black text-blue-600 uppercase pt-1 text-center hover:underline">Сбросить фильтры</button>)}
                            </div>
                        )}
                    </div>
                </div>
                {isCreatingType && (
                    <div className="p-2 bg-blue-100 border-b space-y-2"><input className="w-full p-1.5 rounded-lg text-xs font-bold border border-slate-300 outline-none" placeholder="Название типа..." value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} autoFocus /><div className="flex flex-col gap-1"><label className="flex items-center text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" className="mr-2" checked={newType.isSingleSelect} onChange={e => setNewType({...newType, isSingleSelect: e.target.checked})}/> Выбор одного (Radio)</label><label className="flex items-center text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" className="mr-2" checked={newType.isRequired} onChange={e => setNewType({...newType, isRequired: e.target.checked})}/> Обязательно</label></div><div className="flex gap-2"><button onClick={() => setIsCreatingType(false)} className="flex-1 py-1 text-[10px] font-bold text-slate-500 bg-white rounded-lg border hover:bg-slate-50">Отмена</button><button onClick={handleSaveType} className="flex-1 py-1 text-[10px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">Сохранить</button></div></div>
                )}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">{filteredOptionTypes.map(ot => { const isActive = selectedTypeId === ot.id; const typeVariants = optionVariants.filter(v => v.typeId === ot.id); const uniqueCats = new Set(typeVariants.map(v => v.categoryId).filter(Boolean)).size; return (<div key={ot.id} onClick={() => setSelectedTypeId(ot.id)} className={`p-3 rounded-lg border transition-all cursor-pointer group ${isActive ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}><div className="flex justify-between items-center"><span className={`text-sm font-bold ${isActive ? 'text-blue-800' : 'text-slate-700'}`}>{ot.name}</span>{canWriteGroups && (<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => handleEditType(e, ot)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil size={12}/></button><button onClick={(e) => handleDeleteType(e, ot.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button></div>)}</div><div className="flex items-center justify-between mt-2 text-[8px] text-slate-400 font-medium"><div className="flex gap-1"><span className="bg-white border px-1.5 py-0.5 rounded font-bold">{ot.isSingleSelect ? 'Один' : 'Много'}</span>{ot.isRequired && <span className="bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded font-bold">Обяз.</span>}</div><div className="flex gap-2 font-medium"><span title="Категорий" className="flex items-center gap-0.5"><Box size={10} className="text-slate-300"/>{uniqueCats}</span><span title="Вариантов" className="flex items-center gap-0.5"><List size={10} className="text-slate-300"/>{typeVariants.length}</span></div></div></div>); })}</div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-w-0">
                {selectedTypeId ? (
                    <div className="flex flex-col h-full">
                        <div className="px-4 py-2 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div><h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{optionTypes.find(t => t.id === selectedTypeId)?.name}</h3><p className="text-[9px] text-slate-400 font-bold mt-0.5">Управление вариантами по категориям</p></div>
                            <div className="flex items-center gap-3">
                                {isMassAddMode && selectedVariantsToApply.length > 0 && (<button onClick={startMassAdd} className="bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all shadow-lg animate-bounce">Добавить к станкам ({selectedVariantsToApply.length}) <ArrowRight size={12}/></button>)}
                                <div className="relative">
                                    <button onClick={() => setIsAddingSection(!isAddingSection)} className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all"><Plus size={12}/> Добавить категорию</button>
                                    {isAddingSection && (<div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in slide-in-from-top-2"><div className="max-h-48 overflow-y-auto custom-scrollbar">{machineCategories.filter(c => !visibleSections.includes(c.id)).map(c => (<button key={c.id} onClick={() => handleAddSection(c.id)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg">{c.name}</button>))}</div></div>)}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar bg-slate-50/30">
                            {visibleSections.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><LayoutList size={48} className="mb-2"/><p className="font-black uppercase tracking-widest text-[10px]">Добавьте категорию</p></div>) : (visibleSections.map(catId => { 
                            const category = categories.find(c => c.id === catId); const sectionFilter = sectionFilters[catId] || { supplierId: '', manufacturer: '' }; 
                            const variants = optionVariants.filter(v => v.typeId === selectedTypeId && v.categoryId === catId).filter(v => !sectionFilter.supplierId || v.supplierId === sectionFilter.supplierId).filter(v => !sectionFilter.manufacturer || (v.manufacturer || '').toLowerCase().includes(sectionFilter.manufacturer.toLowerCase())).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru')); 
                            const isFormOpen = variantFormCategoryId === catId; const isCollapsed = collapsedSections.includes(catId);
                            return (
                            <div key={catId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-2 py-1 bg-slate-50/80 border-b flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <button onClick={() => toggleSectionCollapse(catId)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400">{isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button>
                                        <span className="text-xs font-black text-slate-800 truncate cursor-pointer" onClick={() => toggleSectionCollapse(catId)}>{category?.name}</span>
                                        {canWriteVariants && !isFormOpen && !isCollapsed && (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleOpenVariantForm(catId)} className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-black text-[9px] flex items-center gap-1 uppercase tracking-widest shadow-sm whitespace-nowrap"><Plus size={12}/> Добавить</button>
                                                <button onClick={() => { setIsMassAddMode(!isMassAddMode); setSelectedVariantsToApply([]); }} className={`px-3 py-1 rounded-md transition-all font-black text-[9px] flex items-center gap-1 uppercase tracking-widest shadow-sm whitespace-nowrap ${isMassAddMode ? 'bg-orange-500 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white'}`}><MousePointer2 size={12}/> {isMassAddMode ? 'Отмена выбора' : 'Выбрать массово'}</button>
                                            </div>
                                        )}
                                    </div>
                                    {!isCollapsed && (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <select className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md py-0.5 px-1 outline-none focus:ring-2 focus:ring-blue-100 w-28" value={sectionFilter.supplierId} onChange={e => setSectionFilters({ ...sectionFilters, [catId]: { ...sectionFilter, supplierId: e.target.value } })}><option value="">Все поставщики</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                            <input className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md py-0.5 px-2 outline-none focus:ring-2 focus:ring-blue-100 w-24" placeholder="Производитель..." value={sectionFilter.manufacturer} onChange={e => setSectionFilters({ ...sectionFilters, [catId]: { ...sectionFilter, manufacturer: e.target.value } })} />
                                        </div>
                                    )}
                                </div>
                                {!isCollapsed && (
                                    <>
                                        {isFormOpen && (
                                            <div className="p-4 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top-2">
                                                <div className="grid grid-cols-12 gap-4 mb-4">
                                                    <div className="col-span-12 flex items-center gap-4 bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                                                        <div className="w-24 h-24 rounded-xl bg-slate-50 border-2 border-indigo-50 flex items-center justify-center overflow-hidden group relative shadow-inner">
                                                            {isUploadingImage ? (<Loader2 size={24} className="text-blue-500 animate-spin"/>) : newVariant.imageUrl ? (<><img src={newVariant.imageUrl} alt="Превью" className="w-full h-full object-cover" /><button onClick={() => setNewVariant(prev => ({ ...prev, imageUrl: '' }))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button></>) : (<ImageIcon size={32} className="text-indigo-100" />)}
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-[10px] font-black uppercase text-indigo-900 tracking-widest">Фотография варианта</span>
                                                            <div className="flex gap-2"><button onClick={() => variantImageInputRef.current?.click()} className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2">{isUploadingImage ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>} Загрузить</button><button onClick={() => setIsMediaModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"><ImageIcon size={12}/> Библиотека</button></div>
                                                        </div>
                                                    </div>

                                                    <div className="col-span-4 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Категория *</label>
                                                        <div className="relative">
                                                            <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" placeholder="Поиск категории..." value={categorySearch} onChange={e => { setCategorySearch(e.target.value); setShowCategoryDropdown(true); }} onFocus={() => setShowCategoryDropdown(true)} />
                                                            {showCategoryDropdown && (
                                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                                    {machineCategories.filter(c => (c.name || '').toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                                                        <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs font-bold text-slate-700 rounded-lg transition-colors" onClick={() => { setCategorySearch(c.name); setNewVariant({...newVariant, categoryId: c.id}); setShowCategoryDropdown(false); }}>{c.name}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Название</label>
                                                        <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})}/>
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Для поставщика</label>
                                                        <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" value={newVariant.supplierProductName || ''} onChange={e => setNewVariant({...newVariant, supplierProductName: e.target.value})}/>
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Поставщик *</label>
                                                        <div className="relative">
                                                            <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" placeholder="Поиск поставщика..." value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }} onFocus={() => setShowSupplierDropdown(true)} />
                                                            {showSupplierDropdown && (
                                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                                    {suppliers.filter(s => (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                                                                        <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs font-bold text-slate-700 rounded-lg transition-colors" onClick={() => { setSupplierSearch(s.name); setNewVariant({...newVariant, supplierId: s.id}); setShowSupplierDropdown(false); }}>{s.name}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Производитель</label>
                                                        <div className="relative">
                                                            <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" placeholder="Поиск производителя..." value={manufacturerSearch} onChange={e => { setManufacturerSearch(e.target.value); setNewVariant({...newVariant, manufacturer: e.target.value}); setShowManufacturerDropdown(true); }} onFocus={() => setShowManufacturerDropdown(true)} />
                                                            {showManufacturerDropdown && (
                                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                                    {manufacturers.filter(m => (m.name || '').toLowerCase().includes(manufacturerSearch.toLowerCase())).map(m => (
                                                                        <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs font-bold text-slate-700 rounded-lg transition-colors" onClick={() => { setManufacturerSearch(m.name); setNewVariant({...newVariant, manufacturer: m.name}); setShowManufacturerDropdown(false); }}>{m.name}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Цена</label>
                                                        <div className="flex h-[38px]"><input type="number" className="w-full p-2.5 rounded-l-xl border border-indigo-200 text-xs font-black outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" value={newVariant.price} onChange={e => setNewVariant({...newVariant, price: parseFloat(e.target.value) || 0})}/><select className="w-20 p-2 rounded-r-xl border-y border-r border-indigo-200 text-[10px] font-black bg-slate-50 outline-none" value={newVariant.currency} onChange={e => setNewVariant({...newVariant, currency: e.target.value as Currency})}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                    </div>
                                                    <div className="col-span-12 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Описание</label>
                                                        <textarea className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10 resize-none" rows={2} value={newVariant.description || ''} onChange={e => setNewVariant({...newVariant, description: e.target.value})} />
                                                    </div>
                                                    <div className="col-span-12 space-y-1">
                                                        <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Габариты (мм)</label>
                                                        <div className="grid grid-cols-3 gap-3"><input type="number" placeholder="Д" className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" value={newVariant.lengthMm || ''} onChange={e => setNewVariant({...newVariant, lengthMm: parseFloat(e.target.value) || 0})}/><input type="number" placeholder="Ш" className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" value={newVariant.widthMm || ''} onChange={e => setNewVariant({...newVariant, widthMm: parseFloat(e.target.value) || 0})}/><input type="number" placeholder="В" className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" value={newVariant.heightMm || ''} onChange={e => setNewVariant({...newVariant, heightMm: parseFloat(e.target.value) || 0})}/></div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-3 rounded-2xl border border-indigo-100 mb-4 shadow-sm">
                                                    <div className="flex gap-3 mb-3 items-center">
                                                        <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600"><Layers size={14}/></div>
                                                        <span className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Внутренний состав Опции</span>
                                                        <div className="flex-1"/>
                                                        <div className="relative w-72">
                                                            <input className="w-full p-2 rounded-xl border border-slate-200 text-[10px] font-bold outline-none bg-slate-50 focus:ring-4 focus:ring-blue-500/10" placeholder="+ Поиск детали (имя, SKU, пост, произв)..." value={compSearch} onChange={e => { setCompSearch(e.target.value); setShowCompDropdown(true); }} onFocus={() => setShowCompDropdown(true)} />
                                                            {showCompDropdown && (
                                                                <div className="absolute right-0 top-full mt-1 w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-[120] max-h-64 overflow-y-auto custom-scrollbar p-1">
                                                                    {filteredBOMProducts.map(p => {
                                                                        const sup = suppliers.find(s => s.id === p.supplierId);
                                                                        return (
                                                                            <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors border-b border-slate-50 last:border-0" onClick={() => { setCompProductId(p.id); setCompSearch(`${p.sku} - ${p.name}`); setShowCompDropdown(false); }}>
                                                                                <div className="text-[11px] font-bold text-slate-800">{p.name}</div>
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    <span className="text-[8px] font-mono text-blue-600 bg-blue-50 px-1 rounded">{p.sku}</span>
                                                                                    <span className="text-[8px] text-slate-400 uppercase">{sup?.name || '—'}</span>
                                                                                    <span className="text-[8px] text-slate-300">•</span>
                                                                                    <span className="text-[8px] text-slate-400 italic">{p.manufacturer || '—'}</span>
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                    {filteredBOMProducts.length === 0 && <div className="p-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ничего не найдено</div>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 gap-1 h-[34px]">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase mr-1">Кол-во:</span>
                                                            <input type="number" className="w-12 bg-transparent text-[11px] font-black text-slate-700 text-center outline-none" value={compQty} onChange={e => setCompQty(parseFloat(e.target.value))} min={1}/>
                                                        </div>
                                                        <button onClick={addBOMItem} disabled={!compProductId} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95"><Plus size={18}/></button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {newVariant.composition?.map((item, i) => {
                                                            const p = products.find(prod => prod.id === item.productId);
                                                            return (
                                                                <div key={i} className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-700 rounded-xl border border-slate-200 flex items-center gap-2 group hover:border-indigo-300 hover:bg-white transition-all shadow-sm">
                                                                    <Tag size={10} className="text-indigo-400" />
                                                                    <span>{p?.name}</span>
                                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black">x{item.quantity}</span>
                                                                    <button onClick={() => setNewVariant({...newVariant, composition: newVariant.composition?.filter((_, idx) => idx !== i)})} className="p-0.5 text-slate-300 hover:text-red-500 rounded transition-colors"><X size={12}/></button>
                                                                </div>
                                                            );
                                                        })}
                                                        {(!newVariant.composition || newVariant.composition.length === 0) && <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest py-1 px-2">Состав не задан</div>}
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-3 items-center border-t border-indigo-100 pt-4 mt-2">
                                                    <button onClick={() => setVariantFormCategoryId(null)} className="px-6 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-all">Отмена</button>
                                                    <button onClick={handleSaveVariant} className="px-12 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">Сохранить вариант</button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                            {variants.map(v => { 
                                                const sup = suppliers.find(s => s.id === v.supplierId); 
                                                const isSelectedForMassAdd = selectedVariantsToApply.includes(v.id);
                                                const isDeleted = deletedVariantIds.has(v.id);
                                                
                                                return (
                                                    <div 
                                                        key={v.id} 
                                                        onClick={() => isMassAddMode && !isDeleted && toggleVariantSelection(v.id)} 
                                                        className={`p-2 rounded-lg border transition-all group bg-white flex flex-col gap-0.5 shadow-sm overflow-hidden relative ${
                                                            isDeleted 
                                                                ? 'border-red-200 bg-red-50/30 grayscale-[0.5]' 
                                                                : isMassAddMode 
                                                                    ? (isSelectedForMassAdd ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-blue-400 cursor-pointer') 
                                                                    : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                                                        }`}
                                                    >
                                                        {isDeleted && (
                                                            <div className="absolute top-0 right-0 p-1 bg-red-500 text-white text-[7px] font-black uppercase rounded-bl-lg shadow-sm z-10 flex items-center gap-1">
                                                                <AlertTriangle size={8}/> В корзине
                                                            </div>
                                                        )}

                                                        <div className="flex gap-2">
                                                            {isMassAddMode && !isDeleted ? (
                                                                <div className={`w-5 h-5 rounded flex-none flex items-center justify-center border transition-all ${isSelectedForMassAdd ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 bg-slate-50'}`}>{isSelectedForMassAdd && <Check size={12}/>}</div>
                                                            ) : (v.imageUrl && (
                                                                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex-none overflow-hidden flex items-center justify-center"><img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /></div>
                                                            ))}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <h4 className={`font-bold text-[11px] leading-tight break-words ${isDeleted ? 'text-red-800' : 'text-slate-800'}`}>{v.name}</h4>
                                                                        {v.description && (
                                                                            <div className="group/tooltip relative flex-shrink-0">
                                                                                <AlertCircle size={12} className="text-slate-400 hover:text-indigo-600 cursor-help transition-colors" />
                                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl border border-slate-700">{v.description}</div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {canWriteVariants && !isMassAddMode && !isDeleted && (
                                                                        <div className="flex gap-1 transition-all flex-shrink-0">
                                                                            <button onClick={(e) => { e.stopPropagation(); handleCloneVariant(v); }} className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Клонировать"><Copy size={12}/></button>
                                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenVariantForm(catId, v); }} className="p-0.5 text-slate-400 hover:text-blue-600 transition-colors" title="Редактировать"><Pencil size={12}/></button>
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteVariant(v.id); }} className="p-0.5 text-slate-400 hover:text-red-500 transition-colors" title="Удалить"><Trash2 size={12}/></button>
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
                                                            {showPrices ? <span className={`text-[10px] font-black font-mono leading-none ${isDeleted ? 'text-red-400' : 'text-emerald-600'}`}>{v.price.toLocaleString()} {v.currency}</span> : <span className="text-[8px] font-bold text-slate-300 italic leading-none">Скрыто</span>}
                                                        </div>
                                                    </div>
                                                ); 
                                            })} 
                                            {variants.length === 0 && !isFormOpen && <div className="col-span-full py-4 text-center text-[9px] text-slate-300 italic font-bold uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-xl">Нет вариантов</div>}
                                        </div>
                                    </>
                                )}
                            </div>); }) )}</div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><Settings size={48} className="mb-3"/><p className="font-black uppercase tracking-widest text-[10px]">Выберите тип опции слева</p></div>
                )}
            </div>
        </div>
    );
};
