
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, ProductCategory, MachineConfigEntry } from '@/types/product';
import { ProductType, PricingMethod } from '@/types/enums';
import { Currency } from '@/types/currency';
import { Counterparty as Supplier, Manufacturer } from '@/types/counterparty';
import { OptionType, OptionVariant } from '@/types/options';
import { X, Save, Search, Check, Loader2, ChevronDown, Box, Settings, CheckSquare, Square, ChevronRight, Image as ImageIcon, Upload, Trash2, LayoutGrid } from 'lucide-react';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { useStore } from '@/features/system/context/GlobalStore';
import { storage as firebaseStorage } from '@/services/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { MediaLibraryModal } from '@/components/ui/MediaLibraryModal';

interface MobileProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (p: Product) => Promise<void>;
    mode: 'create' | 'edit';
    initialData: Partial<Product>;
    suppliers: Supplier[];
    categories: ProductCategory[];
    manufacturers: Manufacturer[];
    machineCategories: ProductCategory[];
    exchangeRates: Record<Currency, number>;
    products: Product[];
}

const CURRENCIES: Currency[] = [Currency.Cny, Currency.Usd, Currency.Kzt, Currency.Eur, Currency.Rub];

// ── Поиск поставщика (fixed-overlay) ─────────────────────────────────────────
const SupplierOverlay: React.FC<{
    suppliers: Supplier[];
    selectedId: string | undefined;
    onSelect: (id: string) => void;
    onClose: () => void;
}> = ({ suppliers, selectedId, onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const filtered = useMemo(() =>
        suppliers.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 80),
        [suppliers, query]
    );

    return (
        <div className="fixed inset-0 z-[400] flex flex-col bg-white">
            {/* Заголовок */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
                    <X size={20} />
                </button>
                <span className="text-base font-bold text-slate-700">Выбор поставщика</span>
            </div>
            {/* Поиск */}
            <div className="px-4 py-3 border-b border-slate-100 flex-none">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                    <Search size={15} className="text-slate-400 flex-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Поиск поставщика..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && <button onClick={() => setQuery('')}><X size={14} className="text-slate-400" /></button>}
                </div>
            </div>
            {/* Список */}
            <div className="flex-1 overflow-y-auto">
                <button
                    onClick={() => { onSelect(''); onClose(); }}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${!selectedId ? 'bg-blue-50' : ''}`}
                >
                    <span className={`text-base ${!selectedId ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>— Не указан</span>
                    {!selectedId && <Check size={16} className="ml-auto text-blue-600" />}
                </button>
                {filtered.map(s => (
                    <button
                        key={s.id}
                        onClick={() => { onSelect(s.id); onClose(); }}
                        className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${selectedId === s.id ? 'bg-blue-50' : ''}`}
                    >
                        <div className="flex-1 min-w-0">
                            <div className={`text-base font-medium leading-tight ${selectedId === s.id ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>{s.name}</div>
                            {s.country && <div className="text-sm text-slate-400 mt-0.5">{s.country}</div>}
                        </div>
                        {selectedId === s.id && <Check size={16} className="flex-none text-blue-600" />}
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">Ничего не найдено</div>
                )}
            </div>
        </div>
    );
};

// ── Выбор типов станков (fixed-overlay, multi-select) ─────────────────────────
const MachineCategoryOverlay: React.FC<{
    categories: ProductCategory[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    onClose: () => void;
}> = ({ categories, selectedIds, onToggle, onClose }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const filtered = useMemo(() =>
        categories.filter(c => !query || c.name.toLowerCase().includes(query.toLowerCase())),
        [categories, query]
    );

    return (
        <div className="fixed inset-0 z-[400] flex flex-col bg-white">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
                    <X size={20} />
                </button>
                <span className="text-base font-bold text-slate-700">Типы станков</span>
                {selectedIds.length > 0 && (
                    <span className="ml-auto text-sm font-bold text-blue-600">{selectedIds.length} выбрано</span>
                )}
            </div>
            <div className="px-4 py-3 border-b border-slate-100 flex-none">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                    <Search size={15} className="text-slate-400 flex-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Поиск типа..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && <button onClick={() => setQuery('')}><X size={14} className="text-slate-400" /></button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {filtered.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                        <button
                            key={c.id}
                            onClick={() => onToggle(c.id)}
                            className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-none transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <span className={`text-base font-medium ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>{c.name}</span>
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">Ничего не найдено</div>
                )}
            </div>
        </div>
    );
};

// ── Мобильная вкладка Опций ────────────────────────────────────────────────────
const MobileOptionsSection: React.FC<{
    formData: Partial<Product>;
    optionTypes: OptionType[];
    optionVariants: OptionVariant[];
    canWrite: boolean;
    onChange: (field: keyof Product, value: any) => void;
}> = ({ formData, optionTypes, optionVariants, canWrite, onChange }) => {
    const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

    // Фильтрация типов по категории станка
    const availableOptionTypes = useMemo(() => {
        return optionTypes.filter(ot => {
            if (ot.categoryId && ot.categoryId === formData.categoryId) return true;
            if (!ot.categoryId) {
                return optionVariants.some(v => v.typeId === ot.id && v.categoryId === formData.categoryId);
            }
            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [optionTypes, optionVariants, formData.categoryId]);

    const machineConfig: MachineConfigEntry[] = formData.machineConfig || [];

    const isTypeEnabled = (typeId: string) => machineConfig.some(c => c.typeId === typeId);

    const toggleType = (typeId: string) => {
        if (!canWrite) return;
        const exists = machineConfig.find(c => c.typeId === typeId);
        if (exists) {
            onChange('machineConfig', machineConfig.filter(c => c.typeId !== typeId));
            if (expandedTypeId === typeId) setExpandedTypeId(null);
        } else {
            onChange('machineConfig', [...machineConfig, { typeId, allowedVariantIds: [], priceOverrides: {} }]);
            setExpandedTypeId(typeId);
        }
    };

    const isVariantAllowed = (typeId: string, variantId: string) => {
        const cfg = machineConfig.find(c => c.typeId === typeId);
        return cfg?.allowedVariantIds?.includes(variantId) ?? false;
    };

    const toggleVariant = (typeId: string, variantId: string) => {
        if (!canWrite) return;
        const cfg = machineConfig.find(c => c.typeId === typeId);
        if (!cfg) return;
        const current = cfg.allowedVariantIds || [];
        const newAllowed = current.includes(variantId)
            ? current.filter(id => id !== variantId)
            : [...current, variantId];
        onChange('machineConfig', machineConfig.map(c => c.typeId === typeId ? { ...c, allowedVariantIds: newAllowed } : c));
    };

    if (!formData.categoryId) {
        return (
            <div className="bg-white rounded-2xl p-5 text-center">
                <Settings size={28} className="text-slate-200 mx-auto mb-2" />
                <div className="text-sm text-slate-400 font-medium">Выберите категорию станка для настройки опций</div>
            </div>
        );
    }

    if (availableOptionTypes.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-5 text-center">
                <Settings size={28} className="text-slate-200 mx-auto mb-2" />
                <div className="text-sm text-slate-400 font-medium">Нет доступных типов опций для этой категории</div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {availableOptionTypes.map(ot => {
                const enabled = isTypeEnabled(ot.id);
                const isExpanded = expandedTypeId === ot.id;
                const variantsOfType = optionVariants.filter(v => v.typeId === ot.id && v.categoryId === formData.categoryId);
                const enabledCount = enabled ? (machineConfig.find(c => c.typeId === ot.id)?.allowedVariantIds?.length ?? 0) : 0;

                return (
                    <div key={ot.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        {/* Заголовок типа */}
                        <div className="flex items-center gap-3 px-4 py-3">
                            <button
                                onClick={() => toggleType(ot.id)}
                                className={`flex-none p-0.5 transition-colors ${enabled ? 'text-blue-600' : 'text-slate-300'}`}
                            >
                                {enabled ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800">{ot.name}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-bold uppercase">
                                        {ot.isSingleSelect ? 'Один вариант' : 'Несколько'}
                                    </span>
                                    {enabled && enabledCount > 0 && (
                                        <span className="text-[10px] text-blue-600 font-bold">{enabledCount} выбрано</span>
                                    )}
                                </div>
                            </div>
                            {enabled && variantsOfType.length > 0 && (
                                <button
                                    onClick={() => setExpandedTypeId(isExpanded ? null : ot.id)}
                                    className="p-2 text-slate-400"
                                >
                                    <ChevronRight size={16} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                            )}
                        </div>

                        {/* Варианты (если раскрыт) */}
                        {enabled && isExpanded && variantsOfType.length > 0 && (
                            <div className="border-t border-slate-100 divide-y divide-slate-50">
                                {variantsOfType.map(v => {
                                    const allowed = isVariantAllowed(ot.id, v.id);
                                    return (
                                        <div
                                            key={v.id}
                                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${allowed ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => toggleVariant(ot.id, v.id)}
                                        >
                                            <div className={`flex-none w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${allowed ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                                {allowed && <Check size={12} className="text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium leading-tight ${allowed ? 'text-slate-800' : 'text-slate-500'}`}>
                                                    {v.name}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                    {v.manufacturer && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-400 rounded px-1.5 py-0.5 font-medium">
                                                            {v.manufacturer}
                                                        </span>
                                                    )}
                                                    {v.price > 0 && (
                                                        <span className="text-[10px] text-slate-400">
                                                            {v.price} {v.currency}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {enabled && isExpanded && variantsOfType.length === 0 && (
                            <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-400 text-center">
                                Нет вариантов для этой категории
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Основная форма ─────────────────────────────────────────────────────────────
export const MobileProductForm: React.FC<MobileProductFormProps> = ({
    isOpen, onClose, onSave, mode, initialData, suppliers, categories,
    manufacturers, machineCategories, exchangeRates, products
}) => {
    const access = useAccess('nomenclature');
    const { state, actions } = useStore();
    const optionTypes: OptionType[] = state.optionTypes || [];
    const optionVariants: OptionVariant[] = state.optionVariants || [];

    const [formData, setFormData] = useState<Partial<Product>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSupplierOverlay, setShowSupplierOverlay] = useState(false);
    const [showMachineCatOverlay, setShowMachineCatOverlay] = useState(false);
    const [activeTab, setActiveTab] = useState<'main' | 'options'>('main');
    const [showDescription, setShowDescription] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [storageImages, setStorageImages] = useState<{ name: string; url: string }[]>([]);
    const [isImagesLoading, setIsImagesLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadStorageImages = async () => {
        setIsImagesLoading(true);
        try {
            const listRef = storageRef(firebaseStorage, 'product-photos');
            const result = await listAll(listRef);
            const imgs = await Promise.all(result.items.map(async item => ({
                name: item.name,
                url: await getDownloadURL(item)
            })));
            setStorageImages(imgs);
        } catch (e) {
            console.error('Storage load error:', e);
        } finally {
            setIsImagesLoading(false);
        }
    };

    const handleImageUpload = async (file: File) => {
        if (!file) return;
        setIsUploadingImage(true);
        try {
            const id = formData.id || `new_${Date.now()}`;
            const imgRef = storageRef(firebaseStorage, `products/${id}/${file.name}`);
            await uploadBytes(imgRef, file);
            const url = await getDownloadURL(imgRef);
            set('imageUrl', url);
        } catch (e) {
            console.error('Ошибка загрузки фото:', e);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const canWrite = access.canWrite('actions', mode === 'create' ? 'create' : 'edit');
    const canSeePurchase = access.canSee('fields', 'basePrice');

    useEffect(() => {
        if (isOpen) {
            setFormData({
                pricingMethod: PricingMethod.MARKUP_WITHOUT_VAT,
                currency: Currency.Cny,
                markupPercentage: 80,
                type: ProductType.PART,
                ...initialData,
            });
            setError(null);
            setIsSaving(false);
            setActiveTab('main');
            setShowDescription(!!initialData.description);
            setShowSupplierOverlay(false);
            setShowMachineCatOverlay(false);
            loadStorageImages();
        }
    }, [isOpen, initialData]);

    const set = (field: keyof Product, value: any) => {
        if (!canWrite) return;
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'basePrice' || field === 'markupPercentage') {
                const rate = exchangeRates[updated.currency as Currency] || 1;
                const purchaseKzt = (Number(updated.basePrice) || 0) * rate;
                updated.salesPrice = Math.round(purchaseKzt * (1 + (Number(updated.markupPercentage) || 0) / 100));
            }
            if (field === 'salesPrice') {
                const rate = exchangeRates[updated.currency as Currency] || 1;
                const purchaseKzt = (Number(updated.basePrice) || 0) * rate;
                if (purchaseKzt > 0) {
                    updated.markupPercentage = parseFloat(((Number(value) / purchaseKzt - 1) * 100).toFixed(2));
                }
            }
            if (field === 'currency') {
                const rate = exchangeRates[value as Currency] || 1;
                const purchaseKzt = (Number(updated.basePrice) || 0) * rate;
                updated.salesPrice = Math.round(purchaseKzt * (1 + (Number(updated.markupPercentage) || 0) / 100));
            }
            return updated;
        });
        if (error) setError(null);
    };

    const toggleMachineCategory = (catId: string) => {
        if (!canWrite) return;
        setFormData(prev => {
            const ids = prev.compatibleMachineCategoryIds || [];
            const next = ids.includes(catId) ? ids.filter(id => id !== catId) : [...ids, catId];
            return { ...prev, compatibleMachineCategoryIds: next };
        });
    };

    const [machineSearch, setMachineSearch] = useState('');

    const toggleCompatibleMachineId = (machineId: string) => {
        if (!canWrite) return;
        setFormData(prev => {
            const ids = prev.compatibleMachineIds || [];
            const next = ids.includes(machineId) ? ids.filter(id => id !== machineId) : [...ids, machineId];
            return { ...prev, compatibleMachineIds: next };
        });
    };

    const machineProducts = useMemo(() => {
        const list = products.filter(p => p.type === ProductType.MACHINE && p.id !== formData.id);
        if (!machineSearch.trim()) return list;
        const q = machineSearch.toLowerCase();
        return list.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    }, [products, formData.id, machineSearch]);

    const currentSupplier = useMemo(() =>
        suppliers.find(s => s.id === formData.supplierId),
        [suppliers, formData.supplierId]
    );

    const partCategories = useMemo(() =>
        categories.filter(c => c.type === (formData.type || ProductType.PART)).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories, formData.type]
    );

    const skuPreview = useMemo(() => {
        const parts = [formData.supplierProductName, currentSupplier?.name, formData.manufacturer].filter(v => v?.trim());
        return parts.join('-') || '—';
    }, [formData.supplierProductName, currentSupplier, formData.manufacturer]);

    const salesPriceKzt = useMemo(() => {
        const rate = exchangeRates[formData.currency as Currency] || 1;
        return Math.round((Number(formData.basePrice) || 0) * rate * (1 + (Number(formData.markupPercentage) || 0) / 100));
    }, [formData.basePrice, formData.currency, formData.markupPercentage, exchangeRates]);

    const handleSave = async () => {
        if (!canWrite || isSaving) return;
        setError(null);
        if (!formData.name?.trim()) { setError('Укажите наименование (рус.)'); return; }
        if (!formData.supplierProductName?.trim()) { setError('Укажите наименование у поставщика'); return; }
        setIsSaving(true);
        try {
            const supplierObj = suppliers.find(s => s.id === formData.supplierId);
            const compositeSku = [formData.supplierProductName, supplierObj?.name || '', formData.manufacturer].filter(v => v?.trim()).join('-');
            if (mode === 'create' && products.some(p => p.sku === compositeSku)) {
                setError(`Артикул "${compositeSku}" уже существует`);
                setIsSaving(false);
                return;
            }
            const product = { ...formData, id: formData.id || ApiService.generateId(), sku: compositeSku, name: formData.name!.trim(), supplierProductName: formData.supplierProductName!.trim(), salesPrice: salesPriceKzt } as Product;
            await onSave(product);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400";
    const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";
    const sectionCls = "bg-white rounded-2xl p-4 space-y-4";
    const isMachine = formData.type === ProductType.MACHINE;
    const showOptionsTab = isMachine;

    return (
        <>
            {/* Оверлей поиска поставщика — полноэкранный */}
            {showSupplierOverlay && (
                <SupplierOverlay
                    suppliers={suppliers}
                    selectedId={formData.supplierId}
                    onSelect={(id) => set('supplierId', id || undefined)}
                    onClose={() => setShowSupplierOverlay(false)}
                />
            )}

            {/* Оверлей выбора типов станков */}
            {showMachineCatOverlay && (
                <MachineCategoryOverlay
                    categories={machineCategories}
                    selectedIds={formData.compatibleMachineCategoryIds || []}
                    onToggle={toggleMachineCategory}
                    onClose={() => setShowMachineCatOverlay(false)}
                />
            )}

            {/* Основной модал */}
            <div className="fixed inset-0 z-[200] bg-slate-900/60 flex flex-col justify-end">
                <div
                    className="bg-slate-50 rounded-t-3xl flex flex-col overflow-hidden"
                    style={{ maxHeight: '95dvh', minHeight: '60dvh' }}
                >
                    {/* Хедер */}
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-200 flex-none">
                        <button onClick={onClose} disabled={isSaving} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 flex-none">
                            <X size={20} />
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                {mode === 'create' ? 'Новая позиция' : 'Редактирование'}
                            </div>
                            <div className="text-sm font-black text-slate-700 truncate leading-tight">
                                {formData.name || 'Без названия'}
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!canWrite || isSaving}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex-none"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Сохранить
                        </button>
                    </div>

                    {/* Табы (Главное | Опции) */}
                    {showOptionsTab && (
                        <div className="flex bg-white border-b border-slate-200 flex-none">
                            <button
                                onClick={() => setActiveTab('main')}
                                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'main' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
                            >
                                Основное
                            </button>
                            <button
                                onClick={() => setActiveTab('options')}
                                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'options' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
                            >
                                Опции
                            </button>
                        </div>
                    )}

                    {/* Тело */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                                {error}
                            </div>
                        )}

                        {/* ── ВКЛАДКА: ОПЦИИ ────────────────────────────── */}
                        {activeTab === 'options' && showOptionsTab && (
                            <MobileOptionsSection
                                formData={formData}
                                optionTypes={optionTypes}
                                optionVariants={optionVariants}
                                canWrite={canWrite}
                                onChange={set}
                            />
                        )}

                        {/* ── ВКЛАДКА: ОСНОВНОЕ ─────────────────────────── */}
                        {activeTab === 'main' && (
                            <>
                                {/* Тип */}
                                <div className={sectionCls}>
                                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                                        {[ProductType.PART, ProductType.MACHINE, ProductType.SERVICE].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => set('type', t)}
                                                className={`py-2 rounded-lg text-xs font-bold transition-all ${formData.type === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                            >
                                                {t === ProductType.PART ? 'Запчасть' : t === ProductType.MACHINE ? 'Станок' : 'Услуга'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Наименования */}
                                <div className={sectionCls}>
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Наименование</div>
                                    {/* Фото */}
                                    <div className="flex gap-3 items-start">
                                        <div
                                            onClick={() => canWrite && fileInputRef.current?.click()}
                                            className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-none transition-all ${canWrite ? 'cursor-pointer active:scale-95' : ''} ${formData.imageUrl ? 'border-slate-200' : 'border-slate-200 bg-slate-50'}`}
                                        >
                                            {formData.imageUrl ? (
                                                <img src={formData.imageUrl} alt="Фото" className="w-full h-full object-cover" />
                                            ) : isUploadingImage ? (
                                                <Loader2 size={22} className="text-blue-400 animate-spin" />
                                            ) : (
                                                <ImageIcon size={22} className="text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2 pt-1">
                                            <div>
                                                <label className={labelCls}>У поставщика <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text" className={inputCls}
                                                    value={formData.supplierProductName || ''}
                                                    onChange={e => set('supplierProductName', e.target.value)}
                                                    placeholder="Артикул / наименование у поставщика"
                                                    autoComplete="off"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                {canWrite && (
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isUploadingImage}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-blue-100 active:scale-95 transition-all disabled:opacity-50"
                                                    >
                                                        {isUploadingImage ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>}
                                                        Фото
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button
                                                        onClick={() => setIsMediaModalOpen(true)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 active:scale-95 transition-all"
                                                    >
                                                        <LayoutGrid size={12}/>
                                                        Библиотека
                                                    </button>
                                                )}
                                                {formData.imageUrl && canWrite && (
                                                    <button
                                                        onClick={() => set('imageUrl', undefined)}
                                                        className="p-1.5 bg-red-50 text-red-400 rounded-xl border border-red-100 active:scale-95 transition-all"
                                                    >
                                                        <Trash2 size={12}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
                                    />
                                    <div>
                                        <label className={labelCls}>Наименование (рус.) <span className="text-red-500">*</span></label>
                                        <input
                                            type="text" className={inputCls}
                                            value={formData.name || ''}
                                            onChange={e => set('name', e.target.value)}
                                            placeholder="Русское наименование"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="bg-slate-100 rounded-xl px-3 py-2">
                                        <span className="text-xs text-slate-400 font-medium">SKU: </span>
                                        <span className="text-xs font-mono font-bold text-slate-600 break-all">{skuPreview}</span>
                                    </div>
                                </div>

                                {/* Классификация */}
                                <div className={sectionCls}>
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Классификация</div>

                                    {/* Поставщик */}
                                    <div>
                                        <label className={labelCls}>Поставщик</label>
                                        <button
                                            onClick={() => setShowSupplierOverlay(true)}
                                            className={`${inputCls} flex items-center justify-between text-left`}
                                        >
                                            <span className={currentSupplier ? 'text-slate-800' : 'text-slate-400'}>
                                                {currentSupplier?.name || 'Выбрать поставщика'}
                                            </span>
                                            <ChevronDown size={16} className="text-slate-400 flex-none ml-2" />
                                        </button>
                                    </div>

                                    {/* Производитель */}
                                    <div>
                                        <label className={labelCls}>Производитель</label>
                                        <input
                                            type="text" className={inputCls}
                                            value={formData.manufacturer || ''}
                                            onChange={e => set('manufacturer', e.target.value)}
                                            placeholder="Название производителя"
                                            list="mobile-manufacturers-list"
                                            autoComplete="off"
                                        />
                                        <datalist id="mobile-manufacturers-list">
                                            {manufacturers.map(m => <option key={m.id} value={m.name} />)}
                                        </datalist>
                                    </div>

                                    {/* Категория */}
                                    <div>
                                        <label className={labelCls}>Категория</label>
                                        <select className={inputCls} value={formData.categoryId || ''} onChange={e => set('categoryId', e.target.value || undefined)}>
                                            <option value="">— Без категории</option>
                                            {partCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Совместимые станки (только для запчастей) */}
                                    {formData.type === ProductType.PART && (
                                        <div className="space-y-3">
                                            {machineCategories.length > 0 && (
                                                <div>
                                                    <label className={labelCls}>Типы станков</label>
                                                    <button
                                                        onClick={() => setShowMachineCatOverlay(true)}
                                                        className={`${inputCls} flex items-center justify-between text-left`}
                                                    >
                                                        {(formData.compatibleMachineCategoryIds || []).length === 0 ? (
                                                            <span className="text-slate-400">Выбрать типы...</span>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                                                {machineCategories
                                                                    .filter(mc => (formData.compatibleMachineCategoryIds || []).includes(mc.id))
                                                                    .map(mc => (
                                                                        <span key={mc.id} className="flex items-center gap-1 bg-blue-100 text-blue-700 rounded-lg px-2 py-0.5 text-xs font-bold">
                                                                            <Box size={10}/>{mc.name}
                                                                        </span>
                                                                    ))
                                                                }
                                                            </div>
                                                        )}
                                                        <ChevronDown size={16} className="text-slate-400 flex-none ml-2" />
                                                    </button>
                                                </div>
                                            )}
                                            <div>
                                                <label className={labelCls}>
                                                    Конкретные станки
                                                    {(formData.compatibleMachineIds || []).length > 0 && (
                                                        <span className="ml-2 text-blue-600 font-black">{(formData.compatibleMachineIds || []).length} выбрано</span>
                                                    )}
                                                </label>
                                                <div className="relative mb-2">
                                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                                                    <input
                                                        value={machineSearch}
                                                        onChange={e => setMachineSearch(e.target.value)}
                                                        placeholder="Поиск станка..."
                                                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-[13px] bg-slate-50 focus:outline-none focus:border-blue-400"
                                                    />
                                                </div>
                                                <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-100 p-1">
                                                    {machineProducts.length === 0 ? (
                                                        <div className="text-xs text-slate-400 py-3 text-center">Нет станков</div>
                                                    ) : machineProducts.map(machine => {
                                                        const isSelected = (formData.compatibleMachineIds || []).includes(machine.id);
                                                        return (
                                                            <button
                                                                key={machine.id}
                                                                onClick={() => toggleCompatibleMachineId(machine.id)}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'}`}
                                                            >
                                                                <div className={`w-4 h-4 rounded flex items-center justify-center border flex-none ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                                                                    {isSelected && <Check size={10} className="text-white"/>}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[13px] font-bold truncate">{machine.name}</div>
                                                                    {machine.sku && <div className="text-[10px] text-slate-400">{machine.sku}</div>}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Ценообразование */}
                                {canSeePurchase && (
                                    <div className={sectionCls}>
                                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Ценообразование</div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Валюта</label>
                                                <select className={inputCls} value={formData.currency || Currency.Cny} onChange={e => set('currency', e.target.value as Currency)}>
                                                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Цена закупки</label>
                                                <input
                                                    type="number" className={inputCls} inputMode="decimal"
                                                    value={formData.basePrice || ''} placeholder="0"
                                                    onChange={e => set('basePrice', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Наценка, %</label>
                                                <input
                                                    type="number" className={inputCls} inputMode="decimal"
                                                    value={formData.markupPercentage ?? ''} placeholder="0"
                                                    onChange={e => set('markupPercentage', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Цена продажи, ₸</label>
                                                <input
                                                    type="number" className={inputCls} inputMode="decimal"
                                                    value={salesPriceKzt || ''} placeholder="0"
                                                    onChange={e => set('salesPrice', parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>

                                        {formData.basePrice && formData.currency && formData.currency !== Currency.Kzt && (
                                            <div className="bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-500">
                                                {formData.basePrice} {formData.currency} × {exchangeRates[formData.currency as Currency] || '?'} ≈{' '}
                                                <span className="font-bold text-slate-700">
                                                    {Math.round((Number(formData.basePrice) || 0) * (exchangeRates[formData.currency as Currency] || 0)).toLocaleString()} ₸
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Складской учёт */}
                                <div className={sectionCls}>
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Складской учёт</div>
                                    <div>
                                        <label className={labelCls}>Мин. остаток (шт.)</label>
                                        <input
                                            type="number" className={inputCls} inputMode="numeric"
                                            value={formData.minStock || ''} placeholder="0"
                                            onChange={e => set('minStock', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                {/* Описание */}
                                <div className={sectionCls}>
                                    <button
                                        onClick={() => setShowDescription(v => !v)}
                                        className="w-full flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest"
                                    >
                                        <span>Описание</span>
                                        <ChevronDown size={14} className={`transition-transform ${showDescription ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showDescription && (
                                        <textarea
                                            className={`${inputCls} resize-none`} rows={4}
                                            value={formData.description || ''}
                                            onChange={e => set('description', e.target.value)}
                                            placeholder="Описание, характеристики, примечания..."
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        <div className="h-6" />
                    </div>
                </div>
            </div>

            <MediaLibraryModal
                isOpen={isMediaModalOpen}
                onClose={() => setIsMediaModalOpen(false)}
                images={storageImages}
                isLoading={isImagesLoading}
                onSelect={(url) => { set('imageUrl', url); setIsMediaModalOpen(false); }}
                currentUrl={formData.imageUrl}
            />
        </>
    );
};
