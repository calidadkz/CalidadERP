
import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { OptionVariant, Currency, ProductCategory, Product, Counterparty, Manufacturer } from '@/types';
import { Plus, X, Layers, Upload, Image as ImageIcon, Loader2, Tag, AlertCircle, Copy } from 'lucide-react';
import { ApiService } from '@/services/api';
import { storage as firebaseStorage } from '@/services/firebase';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { MediaLibraryModal } from '@/components/ui/MediaLibraryModal';

export interface StorageImage { name: string; url: string; }

interface VariantFormProps {
    categoryId: string;
    selectedTypeId: string;
    /** null = новый вариант, объект = редактирование */
    initialVariant: Partial<OptionVariant> | null;
    isCopy?: boolean;
    suppliers: Counterparty[];
    manufacturers: Manufacturer[];
    machineCategories: ProductCategory[];
    productMap: Map<string, Product>;
    filteredBOMProducts: Product[];
    supplierMap: Map<string, Counterparty>;
    canWriteVariants: boolean;
    onSave: (data: OptionVariant) => Promise<void>;
    onCancel: () => void;
}

export const VariantForm: React.FC<VariantFormProps> = memo(({
    categoryId,
    selectedTypeId,
    initialVariant,
    isCopy,
    suppliers,
    manufacturers,
    machineCategories,
    productMap,
    filteredBOMProducts,
    supplierMap,
    canWriteVariants,
    onSave,
    onCancel,
}) => {
    const [form, setForm] = useState<Partial<OptionVariant>>(() => initialVariant ?? {
        name: '', supplierProductName: '', description: '',
        price: 0, currency: Currency.Cny, composition: [],
        categoryId, supplierId: '', manufacturer: '',
        lengthMm: 0, widthMm: 0, heightMm: 0, imageUrl: '',
    });

    const [manufacturerSearch, setManufacturerSearch] = useState(initialVariant?.manufacturer || '');
    const [showManufacturerDropdown, setShowManufacturerDropdown] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState(
        () => initialVariant?.supplierId ? (suppliers.find(s => s.id === initialVariant.supplierId)?.name || '') : ''
    );
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [categorySearch, setCategorySearch] = useState(
        () => initialVariant?.categoryId
            ? (machineCategories.find(c => c.id === initialVariant.categoryId)?.name || '')
            : (machineCategories.find(c => c.id === categoryId)?.name || '')
    );
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [compSearch, setCompSearch] = useState('');
    const [showCompDropdown, setShowCompDropdown] = useState(false);
    const [compProductId, setCompProductId] = useState('');
    const [compQty, setCompQty] = useState(1);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Image state
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [storageImages, setStorageImages] = useState<StorageImage[]>([]);
    const [isImagesLoading, setIsImagesLoading] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const variantImageInputRef = useRef<HTMLInputElement>(null);

    const loadStorageImages = useCallback(async () => {
        setIsImagesLoading(true);
        try {
            const listRef = ref(firebaseStorage, 'product-photos');
            const res = await listAll(listRef);
            const images = await Promise.all(res.items.map(async item => ({
                name: item.name,
                url: await getDownloadURL(item),
            })));
            setStorageImages(images);
        } catch (err) {
            console.error('[Firebase Storage] Load error:', err);
        } finally {
            setIsImagesLoading(false);
        }
    }, []);

    useEffect(() => { loadStorageImages(); }, [loadStorageImages]);

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
            setForm(prev => ({ ...prev, imageUrl: downloadURL }));
        } catch {
            alert('Ошибка при загрузке изображения');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const setField = <K extends keyof OptionVariant>(key: K, value: OptionVariant[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const addBOMItem = () => {
        if (!canWriteVariants || !compProductId) return;
        const current = form.composition || [];
        const existingIdx = current.findIndex(item => item.productId === compProductId);
        if (existingIdx > -1) {
            const updated = [...current];
            updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + compQty };
            setField('composition', updated);
        } else {
            setField('composition', [...current, { productId: compProductId, quantity: compQty }]);
        }
        setCompProductId(''); setCompQty(1); setCompSearch('');
    };

    const removeBOMItem = (idx: number) => {
        setField('composition', (form.composition || []).filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!canWriteVariants || !form.name || !selectedTypeId || !categoryId) return;
        if (!form.supplierId) { setValidationError('Поставщик обязателен'); return; }
        setValidationError(null);
        setIsSaving(true);
        try {
            const l = form.lengthMm || 0, w = form.widthMm || 0, h = form.heightMm || 0;
            const variantData: OptionVariant = {
                id: initialVariant?.id || ApiService.generateId(),
                typeId: selectedTypeId,
                categoryId: form.categoryId || categoryId,
                name: form.name || '',
                supplierProductName: form.supplierProductName || '',
                description: form.description || '',
                price: form.price || 0,
                currency: form.currency || Currency.Cny,
                composition: form.composition || [],
                supplierId: form.supplierId || '',
                manufacturer: form.manufacturer || '',
                lengthMm: l, widthMm: w, heightMm: h,
                volumeM3: (l * w * h) / 1_000_000_000,
                imageUrl: form.imageUrl || '',
            };
            await onSave(variantData);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredBOMBySearch = filteredBOMProducts.filter(p => {
        const s = compSearch.toLowerCase();
        if (!s) return true;
        const sup = supplierMap.get(p.supplierId || '')?.name || '';
        return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || sup.toLowerCase().includes(s) || (p.manufacturer || '').toLowerCase().includes(s);
    });

    return (
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top-2">
            {isCopy && (
                <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-[10px] font-black uppercase tracking-widest">
                    <Copy size={14} className="shrink-0"/> Создание дубля — это новый вариант, оригинал не изменится
                </div>
            )}
            <input
                type="file"
                ref={variantImageInputRef}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }}
                accept="image/*"
                className="hidden"
            />
            <MediaLibraryModal
                isOpen={isMediaModalOpen}
                onClose={() => setIsMediaModalOpen(false)}
                images={storageImages}
                isLoading={isImagesLoading}
                onSelect={url => setField('imageUrl', url)}
                currentUrl={form.imageUrl}
            />

            <div className="grid grid-cols-12 gap-4 mb-4">
                {/* Image block */}
                <div className="col-span-12 flex items-center gap-4 bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                    <div className="w-24 h-24 rounded-xl bg-slate-50 border-2 border-indigo-50 flex items-center justify-center overflow-hidden group relative shadow-inner">
                        {isUploadingImage
                            ? <Loader2 size={24} className="text-blue-500 animate-spin"/>
                            : form.imageUrl
                                ? (<>
                                    <img src={form.imageUrl} alt="Превью" className="w-full h-full object-cover"/>
                                    <button onClick={() => setField('imageUrl', '')} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                                  </>)
                                : <ImageIcon size={32} className="text-indigo-100"/>
                        }
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-indigo-900 tracking-widest">Фотография варианта</span>
                        <div className="flex gap-2">
                            <button onClick={() => variantImageInputRef.current?.click()} className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2">
                                {isUploadingImage ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>} Загрузить
                            </button>
                            <button onClick={() => setIsMediaModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2">
                                <ImageIcon size={12}/> Библиотека
                            </button>
                        </div>
                    </div>
                </div>

                {/* Category */}
                <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Категория *</label>
                    <div className="relative">
                        <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" placeholder="Поиск категории..." value={categorySearch}
                            onChange={e => { setCategorySearch(e.target.value); setShowCategoryDropdown(true); }}
                            onFocus={() => setShowCategoryDropdown(true)}
                        />
                        {showCategoryDropdown && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {machineCategories.filter(c => (c.name || '').toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                    <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs font-bold text-slate-700 rounded-lg transition-colors"
                                        onClick={() => { setCategorySearch(c.name); setField('categoryId', c.id); setShowCategoryDropdown(false); }}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Name */}
                <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Название</label>
                    <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                        value={form.name || ''} onChange={e => setField('name', e.target.value)}/>
                </div>

                {/* Supplier product name */}
                <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Для поставщика</label>
                    <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                        value={form.supplierProductName || ''} onChange={e => setField('supplierProductName', e.target.value)}/>
                </div>

                {/* Supplier */}
                <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Поставщик *</label>
                    <div className="relative">
                        <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" placeholder="Поиск поставщика..." value={supplierSearch}
                            onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                            onFocus={() => setShowSupplierDropdown(true)}
                        />
                        {showSupplierDropdown && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {suppliers.filter(s => (s.name || '').toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                                    <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs font-bold text-slate-700 rounded-lg transition-colors"
                                        onClick={() => { setSupplierSearch(s.name); setField('supplierId', s.id); setShowSupplierDropdown(false); }}>
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Manufacturer */}
                <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Производитель</label>
                    <div className="relative">
                        <input className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10" placeholder="Поиск производителя..." value={manufacturerSearch}
                            onChange={e => { setManufacturerSearch(e.target.value); setField('manufacturer', e.target.value); setShowManufacturerDropdown(true); }}
                            onFocus={() => setShowManufacturerDropdown(true)}
                        />
                        {showManufacturerDropdown && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[110] max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {manufacturers.filter(m => (m.name || '').toLowerCase().includes(manufacturerSearch.toLowerCase())).map(m => (
                                    <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs font-bold text-slate-700 rounded-lg transition-colors"
                                        onClick={() => { setManufacturerSearch(m.name); setField('manufacturer', m.name); setShowManufacturerDropdown(false); }}>
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Price */}
                <div className="col-span-4 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Цена</label>
                    <div className="flex h-[38px]">
                        <input type="number" className="w-full p-2.5 rounded-l-xl border border-indigo-200 text-xs font-black outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                            value={form.price || 0} onChange={e => setField('price', parseFloat(e.target.value) || 0)}/>
                        <select className="w-20 p-2 rounded-r-xl border-y border-r border-indigo-200 text-[10px] font-black bg-slate-50 outline-none"
                            value={form.currency || Currency.Cny} onChange={e => setField('currency', e.target.value as Currency)}>
                            {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Description */}
                <div className="col-span-12 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Описание</label>
                    <textarea className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10 resize-none" rows={2}
                        value={form.description || ''} onChange={e => setField('description', e.target.value)}/>
                </div>

                {/* Dimensions */}
                <div className="col-span-12 space-y-1">
                    <label className="text-[9px] font-black uppercase text-indigo-900 ml-1 tracking-widest">Габариты (мм)</label>
                    <div className="grid grid-cols-3 gap-3">
                        <input type="number" placeholder="Д" className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                            value={form.lengthMm || ''} onChange={e => setField('lengthMm', parseFloat(e.target.value) || 0)}/>
                        <input type="number" placeholder="Ш" className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                            value={form.widthMm || ''} onChange={e => setField('widthMm', parseFloat(e.target.value) || 0)}/>
                        <input type="number" placeholder="В" className="w-full p-2.5 rounded-xl border border-indigo-200 text-xs font-bold outline-none bg-white focus:ring-4 focus:ring-indigo-500/10"
                            value={form.heightMm || ''} onChange={e => setField('heightMm', parseFloat(e.target.value) || 0)}/>
                    </div>
                </div>
            </div>

            {/* BOM */}
            <div className="bg-white p-3 rounded-2xl border border-indigo-100 mb-4 shadow-sm">
                <div className="flex gap-3 mb-3 items-center">
                    <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600"><Layers size={14}/></div>
                    <span className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Внутренний состав Опции</span>
                    <div className="flex-1"/>
                    <div className="relative w-72">
                        <input className="w-full p-2 rounded-xl border border-slate-200 text-[10px] font-bold outline-none bg-slate-50 focus:ring-4 focus:ring-blue-500/10"
                            placeholder="+ Поиск детали (имя, SKU, пост, произв)..."
                            value={compSearch}
                            onChange={e => { setCompSearch(e.target.value); setShowCompDropdown(true); }}
                            onFocus={() => setShowCompDropdown(true)}
                        />
                        {showCompDropdown && (
                            <div className="absolute right-0 top-full mt-1 w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-[120] max-h-64 overflow-y-auto custom-scrollbar p-1">
                                {filteredBOMBySearch.map(p => {
                                    const sup = supplierMap.get(p.supplierId || '');
                                    return (
                                        <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors border-b border-slate-50 last:border-0"
                                            onClick={() => { setCompProductId(p.id); setCompSearch(`${p.sku} - ${p.name}`); setShowCompDropdown(false); }}>
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
                                {filteredBOMBySearch.length === 0 && <div className="p-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ничего не найдено</div>}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 gap-1 h-[34px]">
                        <span className="text-[8px] font-black text-slate-400 uppercase mr-1">Кол-во:</span>
                        <input type="number" className="w-12 bg-transparent text-[11px] font-black text-slate-700 text-center outline-none"
                            value={compQty} onChange={e => setCompQty(parseFloat(e.target.value) || 1)} min={1}/>
                    </div>
                    <button onClick={addBOMItem} disabled={!compProductId} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95">
                        <Plus size={18}/>
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(form.composition || []).map((item, i) => {
                        const p = productMap.get(item.productId);
                        return (
                            <div key={i} className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-700 rounded-xl border border-slate-200 flex items-center gap-2 group hover:border-indigo-300 hover:bg-white transition-all shadow-sm">
                                <Tag size={10} className="text-indigo-400"/>
                                <span>{p?.name || item.productId}</span>
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black">x{item.quantity}</span>
                                <button onClick={() => removeBOMItem(i)} className="p-0.5 text-slate-300 hover:text-red-500 rounded transition-colors"><X size={12}/></button>
                            </div>
                        );
                    })}
                    {(!form.composition || form.composition.length === 0) && (
                        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest py-1 px-2">Состав не задан</div>
                    )}
                </div>
            </div>

            {validationError && (
                <div className="flex items-center gap-2 text-red-500 text-xs font-bold mb-3 p-2 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle size={14}/> {validationError}
                </div>
            )}

            <div className="flex justify-end gap-3 items-center border-t border-indigo-100 pt-4 mt-2">
                <button onClick={onCancel} className="px-6 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-all">
                    Отмена
                </button>
                <button onClick={handleSave} disabled={isSaving} className="px-12 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60">
                    {isSaving ? 'Сохранение...' : 'Сохранить вариант'}
                </button>
            </div>
        </div>
    );
});

VariantForm.displayName = 'VariantForm';
