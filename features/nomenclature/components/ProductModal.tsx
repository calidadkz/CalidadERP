
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product, ProductCategory, ProductPackage } from '@/types/product';
import { ProductType, PricingMethod } from '@/types/enums';
import { Currency } from '@/types/currency';
import { Counterparty as Supplier, Manufacturer } from '@/types/counterparty';
import { OptionType, OptionVariant } from '@/types/options';
import { Cpu, Settings, X, LayoutGrid, Wrench, ArrowRight, ArrowLeft, Save, Calculator, ShieldCheck, AlertCircle, Eye, Loader2, PieChart, Copy } from 'lucide-react';
import { GeneralTab } from '../tabs/GeneralTab';
import { OptionsTab } from '../tabs/OptionsTab';
import { CompositionTab } from '../tabs/CompositionTab';
import { PricingService } from '@/services/PricingService';
import { useStore } from '@/features/system/context/GlobalStore';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { ApiService } from '@/services/api';
import { storage as firebaseStorage } from '@/services/firebase';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (p: Product) => Promise<void> | void;
    modalMode: 'create' | 'edit';
    isCopy?: boolean;
    initialData: Partial<Product>;
    suppliers: Supplier[];
    categories: ProductCategory[];
    optionTypes: OptionType[];
    optionVariants: OptionVariant[];
    products: Product[];
    addOptionType: (ot: OptionType) => Promise<void>;
    addOptionVariant: (ov: OptionVariant) => Promise<void>;
    exchangeRates: Record<Currency, number>;
    manufacturers: Manufacturer[];
}

export interface StorageImage {
    name: string;
    url: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
    isOpen, onClose, onSave, modalMode, isCopy, initialData, suppliers, categories, optionTypes, optionVariants, products, addOptionType, addOptionVariant, exchangeRates, manufacturers
}) => {
    const { state } = useStore();
    const access = useAccess('nomenclature');
    const { pricingProfiles, hscodes } = state;
    const [activeTab, setActiveTab] = useState<'general' | 'options' | 'composition'>('general');
    const [formData, setFormData] = useState<Partial<Product>>(initialData);
    const [showDetails, setShowDetails] = useState(false);
    
    const [isSaving, setIsSaving] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const [storageImages, setStorageImages] = useState<StorageImage[]>([]);
    const [isImagesLoading, setIsImagesLoading] = useState(false);

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
        } catch (err) {
            console.error('[Firebase Storage] Load error:', err);
        } finally {
            setIsImagesLoading(false);
        }
    }, []);

    const uploadImage = async (file: File) => {
        try {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
            const fileExt = file.name.split('.').pop();
            const sanitizedBase = baseName.replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_');
            const fileName = `${sanitizedBase}_${Date.now()}.${fileExt}`;
            
            const storageRef = ref(firebaseStorage, `product-photos/${fileName}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            await loadStorageImages();
            return downloadURL;
        } catch (err) {
            console.error('[Firebase Storage] Upload error:', err);
            throw err;
        }
    };

    useEffect(() => {
        if (isOpen) {
            const initialPackages = (initialData?.packages && initialData.packages.length > 0) ? initialData.packages : [{ id: ApiService.generateId(), lengthMm: 0, widthMm: 0, heightMm: 0, weightKg: 0, volumeM3: 0 }];
            setFormData({
                pricingMethod: PricingMethod.MARKUP_WITHOUT_VAT,
                ...initialData,
                packages: initialPackages
            });
            setActiveTab('general');
            setShowDetails(false);
            setIsSaving(false);
            setLocalError(null);
            loadStorageImages();
        }
    }, [initialData, isOpen, loadStorageImages]);

    useEffect(() => {
        if (formData.pricingMethod !== PricingMethod.PROFILE && showDetails) {
            setShowDetails(false);
        }
    }, [formData.pricingMethod, showDetails]);

    const economyPreview = useMemo(() => {
        if (!formData.name || !formData.categoryId) return null;
        const method = formData.pricingMethod || PricingMethod.MARKUP_WITHOUT_VAT;
        if (method === PricingMethod.PROFILE) {
            const profile = PricingService.findProfile(formData as Product, pricingProfiles);
            const data = PricingService.calculateSmartPrice(formData as Product, profile, exchangeRates);
            return { profile, data };
        } else {
            const rate = exchangeRates[formData.currency as Currency] || 1;
            const purchaseKzt = (formData.basePrice || 0) * rate;
            const markup = Number(formData.markupPercentage) || 0;
            const finalPrice = Math.round(purchaseKzt * (1 + markup / 100));
            return {
                profile: null,
                data: {
                    finalPrice,
                    purchaseKzt: Math.round(purchaseKzt),
                    logisticsCn: 0, logisticsLocal: 0, svh: 0, brokerFees: 0, customsFees: 0,
                    pnr: 0, deliveryLocal: 0, vat: 0, cit: 0, bonus: 0,
                    totalExpenses: Math.round(purchaseKzt),
                    netProfit: finalPrice - purchaseKzt
                }
            };
        }
    }, [formData, pricingProfiles, exchangeRates]);

    useEffect(() => {
        if (!isOpen || !economyPreview?.data) return;
        
        const calculatedPrice = economyPreview.data.finalPrice;
        let newMarkup = formData.markupPercentage;
        
        if (formData.pricingMethod === PricingMethod.PROFILE) {
            const purchaseKzt = economyPreview.data.purchaseKzt;
            if (purchaseKzt > 0) {
                const rawMarkup = ((calculatedPrice - purchaseKzt) / purchaseKzt) * 100;
                newMarkup = parseFloat(rawMarkup.toFixed(2));
            } else {
                newMarkup = 0;
            }
        }

        const priceChanged = calculatedPrice !== formData.salesPrice;
        const markupChanged = formData.pricingMethod === PricingMethod.PROFILE && newMarkup !== formData.markupPercentage;

        // Если это PROFILE, то цена всегда берется из расчета.
        // Если это ручная наценка, то мы обновляем цену только если она СИЛЬНО отличается (больше чем на 2 тенге),
        // чтобы не перебивать ручной ввод из-за микро-округлений наценки.
        const shouldUpdatePrice = formData.pricingMethod === PricingMethod.PROFILE 
            ? priceChanged 
            : Math.abs(calculatedPrice - (formData.salesPrice || 0)) > 2;

        if (shouldUpdatePrice || markupChanged) {
            setFormData(prev => ({ 
                ...prev, 
                salesPrice: shouldUpdatePrice ? calculatedPrice : prev.salesPrice,
                markupPercentage: formData.pricingMethod === PricingMethod.PROFILE ? newMarkup : prev.markupPercentage
            }));
        }
    }, [economyPreview, isOpen, formData.pricingMethod, formData.markupPercentage, formData.salesPrice]);

    if (!isOpen) return null;

    const canWrite = access.canWrite('actions', modalMode === 'create' ? 'create' : 'edit');
    const canSeeEconomy = !!economyPreview?.profile && access.canSee('fields', 'pricingDetails');

    const handleChange = (field: keyof Product, value: any) => {
        if (!canWrite) return; 
        setFormData(prev => {
            let finalValue = value;
            const numericFields: (keyof Product)[] = ['basePrice', 'markupPercentage', 'workingLengthMm', 'workingWidthMm', 'workingHeightMm', 'workingWeightKg', 'minStock', 'salesPrice'];
            if (numericFields.includes(field)) finalValue = isNaN(value) ? 0 : Number(value);
            const updated = { ...prev, [field]: finalValue };
            if (['workingLengthMm', 'workingWidthMm', 'workingHeightMm'].includes(field as string)) {
                const l = Number(updated.workingLengthMm) || 0;
                const w = Number(updated.workingWidthMm) || 0;
                const h = Number(updated.workingHeightMm) || 0;
                updated.workingVolumeM3 = parseFloat(((l * w * h) / 1000000000).toFixed(3));
            }
            return updated;
        });
        if (localError) setLocalError(null);
    };

    const handlePackageChange = (index: number, field: keyof ProductPackage, value: any) => {
        if (!canWrite) return;
        const updatedPackages = [...(formData.packages || [])];
        const numericFields: (keyof ProductPackage)[] = ['lengthMm', 'widthMm', 'heightMm', 'weightKg'];
        let finalValue = value;
        if (numericFields.includes(field)) finalValue = isNaN(value) ? 0 : Number(value);
        updatedPackages[index] = { ...updatedPackages[index], [field]: finalValue };
        if (['lengthMm', 'widthMm', 'heightMm'].includes(field as string)) {
            const p = updatedPackages[index];
            const l = p.lengthMm || 0;
            const w = p.widthMm || 0;
            const h = p.heightMm || 0;
            updatedPackages[index].volumeM3 = parseFloat(((l * w * h) / 1000000000).toFixed(3));
        }
        setFormData(prev => ({ ...prev, packages: updatedPackages }));
    };

    const addPackage = () => {
        if (!canWrite || (formData.packages && formData.packages.length >= 5)) return;
        const newPackage: ProductPackage = { id: ApiService.generateId(), lengthMm: 0, widthMm: 0, heightMm: 0, weightKg: 0, volumeM3: 0 };
        setFormData(prev => ({ ...prev, packages: [...(prev.packages || []), newPackage] }));
    };

    const removePackage = (index: number) => {
        if (!canWrite) return;
        setFormData(prev => ({ ...prev, packages: prev.packages?.filter((_, i) => i !== index) }));
    };

    const handleFinalSave = async () => {
        if (!canWrite || isSaving) return;
        setLocalError(null);
        if (!formData.name?.trim() || !formData.supplierProductName?.trim()) {
            setLocalError("Заполните основные наименования.");
            return;
        }
        setIsSaving(true);
        try {
            const supplierObj = suppliers.find(s => s.id === formData.supplierId);
            const compositeSku = [formData.supplierProductName, supplierObj?.name || '', formData.manufacturer].filter(v => v?.trim().length > 0).join('-');
            if (modalMode === 'create' && products.some(p => p.sku === compositeSku)) {
                setLocalError(`Товар с артикулом "${compositeSku}" уже существует.`);
                setIsSaving(false);
                return;
            }
            const finalProduct = {
                ...formData,
                id: formData.id || ApiService.generateId(),
                sku: compositeSku,
                salesPrice: economyPreview?.data?.finalPrice || formData.salesPrice || 0
            } as Product;
            await onSave(finalProduct);
        } catch (e: unknown) {
            setLocalError(e instanceof Error ? e.message : "Ошибка сохранения.");
        } finally {
            setIsSaving(false);
        }
    };

    const f = (val: number) => Math.round(val).toLocaleString();

    return (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center flex-none">
                    <div className="flex items-center gap-3">
                        {formData.type === ProductType.MACHINE ? <Cpu size={24} className="text-blue-400"/> : <Settings size={24} className="text-orange-400"/>}
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{canWrite ? 'Редактирование' : 'Просмотр'}</div>
                            <h3 className="font-bold text-lg leading-none mt-1">{modalMode === 'create' ? 'Новая позиция' : `${formData.sku}`}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isCopy && (
                            <div className="bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Copy size={14}/> Создание дубля — это новая позиция
                            </div>
                        )}
                        {!canWrite && <div className="bg-blue-600/20 px-3 py-1.5 rounded-xl border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Eye size={14}/> Просмотр</div>}
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"><X size={24}/></button>
                    </div>
                </div>

                <div className="flex border-b bg-gray-50 flex-none px-4">
                    <button onClick={() => setActiveTab('general')} className={`px-6 py-4 text-xs uppercase font-black tracking-widest flex items-center transition-all ${activeTab === 'general' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={14} className="mr-2"/> 1. Общие данные</button>
                    {formData.type === ProductType.MACHINE && (
                        <>
                            <button onClick={() => setActiveTab('options')} className={`px-6 py-4 text-xs uppercase font-black tracking-widest flex items-center transition-all ${activeTab === 'options' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Settings size={14} className="mr-2"/> 2. Опции</button>
                            <button onClick={() => setActiveTab('composition')} className={`px-6 py-4 text-xs uppercase font-black tracking-widest flex items-center transition-all ${activeTab === 'composition' ? 'bg-white border-t-2 border-t-blue-500 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Wrench size={14} className="mr-2"/> 3. Состав (BOM)</button>
                        </>
                    )}
                </div>

                <div className="flex-1 flex overflow-hidden bg-gray-50 relative">
                    <div className="flex-1 overflow-hidden relative border-r">
                        {activeTab === 'general' && (
                            <GeneralTab 
                                formData={formData} 
                                suppliers={suppliers as any}
                                categories={categories}
                                hscodes={hscodes}
                                pricingProfiles={pricingProfiles}
                                manufacturers={manufacturers}
                                modalMode={modalMode}
                                onChange={handleChange}
                                onPackageChange={handlePackageChange}
                                onAddPackage={addPackage}
                                onRemovePackage={removePackage}
                                economyData={economyPreview?.data}
                                appliedProfile={economyPreview?.profile}
                                onShowDetails={() => setShowDetails(!showDetails)}
                                showDetails={showDetails}
                                storageImages={storageImages}
                                isImagesLoading={isImagesLoading}
                                onUploadImage={uploadImage}
                                exchangeRates={exchangeRates}
                                products={products}
                            />
                        )}
                        {activeTab === 'options' && (
                            <OptionsTab 
                                formData={formData} 
                                optionTypes={optionTypes} 
                                optionVariants={optionVariants} 
                                setFormData={setFormData} 
                                addOptionType={addOptionType} 
                                addOptionVariant={addOptionVariant}
                                products={products}
                                manufacturers={manufacturers}
                            />
                        )}
                        {activeTab === 'composition' && <CompositionTab formData={formData} products={products} setFormData={setFormData} />}
                    </div>

                    <div className={`bg-white flex flex-col shadow-2xl relative overflow-hidden transition-all duration-300 ease-in-out border-l border-slate-200 z-10 ${showDetails && canSeeEconomy ? 'w-[380px] opacity-100' : 'w-0 opacity-0 invisible'}`}>
                        {economyPreview?.profile && economyPreview.data && (
                            <div className="flex flex-col h-full w-[380px]">
                                <div className="p-4 bg-slate-900 text-white flex justify-between items-center flex-none">
                                    <div className="flex items-center gap-2">
                                        <Calculator size={18} className="text-blue-400"/>
                                        <h3 className="font-black uppercase text-[10px] tracking-widest">Детализация расходов</h3>
                                    </div>
                                    <button onClick={() => setShowDetails(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400"><X size={18}/></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <ShieldCheck size={14} className="text-blue-500 flex-shrink-0"/>
                                            <span className="text-[10px] font-black text-slate-700 truncate uppercase tracking-tight">{economyPreview.profile.name}</span>
                                        </div>
                                        <div className="bg-blue-600 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase whitespace-nowrap">
                                            Цель: {economyPreview.profile.targetNetMarginPercent}%
                                        </div>
                                    </div>
                                    <div className="border-l-2 border-blue-500 pl-3 space-y-1.5">
                                        <DetailRow label="Чистая цена закупа" value={economyPreview.data.purchaseKzt} bold color="text-slate-900" />
                                        <DetailRow label="Доставка (Китай)" value={economyPreview.data.logisticsCn} />
                                        <DetailRow label="Доставка (Локальная)" value={economyPreview.data.logisticsLocal} />
                                    </div>
                                    <div className="border-l-2 border-orange-500 pl-3 space-y-1.5">
                                        <DetailRow label="Терминал / СВХ" value={economyPreview.data.svh} />
                                        <DetailRow label="Таможенные сборы" value={economyPreview.data.customsFees + economyPreview.data.brokerFees} />
                                    </div>
                                    <div className="border-l-2 border-purple-500 pl-3 space-y-1.5">
                                        <DetailRow label="Пусконаладка (ПНР)" value={economyPreview.data.pnr} />
                                        <DetailRow label="Доставка до клиента" value={economyPreview.data.deliveryLocal} />
                                        <DetailRow label="Бонус отдела продаж" value={economyPreview.data.bonus} color="text-purple-600" />
                                    </div>
                                    <div className="border-l-2 border-red-500 pl-3 space-y-1.5">
                                        <DetailRow label={`НДС (${economyPreview.profile.vatRate}%)`} value={economyPreview.data.vat} />
                                        <DetailRow label={`КПН (${economyPreview.profile.citRate}%)`} value={economyPreview.data.cit} />
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 space-y-3">
                                        <div className="flex justify-between items-center text-slate-500 px-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest">Общие расходы:</span>
                                            <span className="text-xs font-black font-mono">{f(economyPreview.data.totalExpenses)} ₸</span>
                                        </div>
                                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <PieChart size={14} className="text-emerald-500"/>
                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Чистая прибыль:</span>
                                            </div>
                                            <span className="text-sm font-black text-emerald-700 font-mono">+{f(economyPreview.data.netProfit)} ₸</span>
                                        </div>
                                        <div className="bg-blue-600 p-4 rounded-xl shadow-lg text-white">
                                            <div className="text-[8px] font-black text-blue-200 uppercase mb-0.5 tracking-widest">Итоговая цена продажи</div>
                                            <div className="text-xl font-black font-mono tracking-tight flex items-baseline gap-1.5">
                                                {f(economyPreview.data.finalPrice)} <span className="text-[10px] font-medium text-blue-300 uppercase">KZT</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white border-t border-slate-200 py-3 px-8 flex flex-col gap-2 flex-none shadow-[0_-10px_20_rgba(0,0,0,0.05)] relative z-20">
                    {localError && (
                        <div className="bg-red-50 border border-red-200 py-1.5 px-3 rounded-xl flex items-center gap-2 text-red-600 animate-in slide-in-from-bottom-2">
                            <AlertCircle size={14}/>
                            <span className="text-[11px] font-bold">{localError}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center h-10">
                        <div className="text-sm">
                            {formData.type === ProductType.MACHINE ? (
                                <div className="flex items-center gap-5">
                                    {activeTab === 'general' && (
                                        <button onClick={() => setActiveTab('options')} className="group flex items-center text-blue-600 font-black uppercase text-[10px] tracking-widest hover:text-blue-700 transition-colors">
                                            Шаг 2: Настройка опций <ArrowRight size={14} className="ml-1.5 group-hover:translate-x-1 transition-transform"/>
                                        </button>
                                    )}
                                    {activeTab === 'options' && (
                                        <div className="flex gap-5">
                                            <button onClick={() => setActiveTab('general')} className="flex items-center text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">
                                                <ArrowLeft size={14} className="mr-1.5"/> Назад
                                            </button>
                                            <button onClick={() => setActiveTab('composition')} className="group flex items-center text-blue-600 font-black uppercase text-[10px] tracking-widest hover:text-blue-700 transition-colors">
                                                Шаг 3: Состав станка <ArrowRight size={14} className="ml-1.5 group-hover:translate-x-1 transition-transform"/>
                                            </button>
                                        </div>
                                    )}
                                    {activeTab === 'composition' && (
                                        <button onClick={() => setActiveTab('options')} className="flex items-center text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">
                                            <ArrowLeft size={14} className="mr-1.5"/> Назад
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-slate-300 font-black uppercase text-[9px] tracking-widest">
                                    Доступна только основная вкладка
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={onClose} 
                                disabled={isSaving} 
                                className="px-6 py-2.5 border-2 border-slate-50 rounded-xl text-slate-400 font-black hover:bg-slate-50 hover:text-slate-600 transition-all text-[10px] uppercase tracking-widest active:scale-95"
                            >
                                Отмена
                            </button>
                            {canWrite && (
                                <button 
                                    onClick={handleFinalSave} 
                                    disabled={isSaving} 
                                    className="px-10 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all uppercase tracking-widest flex items-center gap-2 active:scale-95 disabled:opacity-70 disabled:grayscale"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                    {modalMode === 'create' ? 'Создать позицию' : 'Сохранить изменения'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DetailRow = ({ label, value, bold = false, color = "text-slate-700" }: { label: string, value: number, bold?: boolean, color?: string }) => (
    <div className="flex justify-between items-center text-[10px]">
        <span className="text-slate-500 font-medium">{label}:</span>
        <span className={`font-mono ${bold ? 'font-black' : 'font-bold'} ${color}`}>{Math.round(value).toLocaleString()} ₸</span>
    </div>
);
