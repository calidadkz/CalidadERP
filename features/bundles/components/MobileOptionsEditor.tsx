
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Plus, Search, X, Settings, Pencil, Trash2, ChevronRight, ChevronLeft,
    Save, Loader2, Box, Check, List, AlertTriangle, Layers, User, Factory,
    Image as ImageIcon, Upload, ChevronDown
} from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductType, OptionType, OptionVariant, Currency, Product, Counterparty, Manufacturer } from '@/types';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { storage as firebaseStorage } from '@/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ─── Типы ─────────────────────────────────────────────────────────────────────

type Screen = 'types' | 'variants';

// ─── Оверлей поиска (поставщик / категория / производитель) ───────────────────

const SearchOverlay: React.FC<{
    title: string;
    items: { id: string; label: string; sub?: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
    allowEmpty?: boolean;
    emptyLabel?: string;
}> = ({ title, items, selectedId, onSelect, onClose, allowEmpty = true, emptyLabel = '— Не выбрано' }) => {
    const [q, setQ] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const filtered = useMemo(() =>
        items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase()) || i.sub?.toLowerCase().includes(q.toLowerCase())),
        [items, q]
    );

    return (
        <div className="fixed inset-0 z-[500] flex flex-col bg-white">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 flex-none">
                <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={20} /></button>
                <span className="text-base font-bold text-slate-700">{title}</span>
            </div>
            <div className="px-4 py-3 border-b border-slate-100 flex-none">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                    <Search size={15} className="text-slate-400 flex-none" />
                    <input ref={inputRef} type="text" className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                        placeholder="Поиск..." value={q} onChange={e => setQ(e.target.value)} />
                    {q && <button onClick={() => setQ('')}><X size={14} className="text-slate-400" /></button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {allowEmpty && (
                    <button onClick={() => { onSelect(''); onClose(); }} className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${!selectedId ? 'bg-blue-50' : ''}`}>
                        <span className={`text-base ${!selectedId ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>{emptyLabel}</span>
                        {!selectedId && <Check size={16} className="ml-auto text-blue-600" />}
                    </button>
                )}
                {filtered.map(item => (
                    <button key={item.id} onClick={() => { onSelect(item.id); onClose(); }}
                        className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-slate-100 ${selectedId === item.id ? 'bg-blue-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                            <div className={`text-base font-medium leading-tight ${selectedId === item.id ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>{item.label}</div>
                            {item.sub && <div className="text-sm text-slate-400 mt-0.5">{item.sub}</div>}
                        </div>
                        {selectedId === item.id && <Check size={16} className="flex-none text-blue-600" />}
                    </button>
                ))}
                {filtered.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">Ничего не найдено</div>}
            </div>
        </div>
    );
};

// ─── Форма варианта (bottom-sheet) ────────────────────────────────────────────

const VariantFormSheet: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (v: OptionVariant) => Promise<void>;
    initial: Partial<OptionVariant> | null;
    selectedTypeId: string;
    suppliers: Counterparty[];
    manufacturers: Manufacturer[];
    machineCategories: { id: string; name: string }[];
    bomProducts: Product[];
    supplierMap: Map<string, Counterparty>;
    canWrite: boolean;
    showPrices: boolean;
}> = ({ isOpen, onClose, onSave, initial, selectedTypeId, suppliers, manufacturers, machineCategories, bomProducts, supplierMap, canWrite, showPrices }) => {
    const [form, setForm] = useState<Partial<OptionVariant>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showBOM, setShowBOM] = useState(false);
    const [bomSearch, setBomSearch] = useState('');
    const [bomProductId, setBomProductId] = useState('');
    const [bomQty, setBomQty] = useState(1);
    const fileRef = useRef<HTMLInputElement>(null);

    // overlay states
    const [overlay, setOverlay] = useState<'supplier' | 'category' | 'manufacturer' | null>(null);

    useEffect(() => {
        if (isOpen) {
            setForm(initial ?? { name: '', supplierProductName: '', description: '', price: 0, currency: Currency.Cny, composition: [], supplierId: '', manufacturer: '', lengthMm: 0, widthMm: 0, heightMm: 0 });
            setError(null);
            setIsSaving(false);
            setShowBOM(!!(initial?.composition?.length));
            setBomSearch('');
        }
    }, [isOpen, initial]);

    const setF = <K extends keyof OptionVariant>(k: K, v: OptionVariant[K]) =>
        setForm(prev => ({ ...prev, [k]: v }));

    const currentSupplier = useMemo(() => suppliers.find(s => s.id === form.supplierId), [suppliers, form.supplierId]);
    const currentCategory = useMemo(() => machineCategories.find(c => c.id === form.categoryId), [machineCategories, form.categoryId]);

    const filteredBOM = useMemo(() =>
        bomProducts.filter(p => {
            const s = bomSearch.toLowerCase().trim();
            if (!s) return true;
            const sup = supplierMap.get(p.supplierId || '')?.name || '';
            return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || sup.toLowerCase().includes(s) || (p.manufacturer || '').toLowerCase().includes(s);
        }).slice(0, 40),
        [bomProducts, supplierMap, bomSearch]
    );

    const uploadImage = async (file: File) => {
        setIsUploading(true);
        try {
            const base = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^\w\s.-]/gi, '').replace(/\s+/g, '_');
            const ext = file.name.split('.').pop();
            const storageRef = ref(firebaseStorage, `product-photos/${base}_${Date.now()}.${ext}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setF('imageUrl', url);
        } catch { alert('Ошибка загрузки изображения'); }
        finally { setIsUploading(false); }
    };

    const addBOM = () => {
        if (!bomProductId) return;
        const cur = form.composition || [];
        const idx = cur.findIndex(i => i.productId === bomProductId);
        if (idx > -1) {
            const upd = [...cur];
            upd[idx] = { ...upd[idx], quantity: upd[idx].quantity + bomQty };
            setF('composition', upd);
        } else {
            setF('composition', [...cur, { productId: bomProductId, quantity: bomQty }]);
        }
        setBomProductId(''); setBomQty(1); setBomSearch('');
    };

    const removeBOM = (idx: number) =>
        setF('composition', (form.composition || []).filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!canWrite || isSaving) return;
        if (!form.name?.trim()) { setError('Введите название варианта'); return; }
        if (!form.supplierId) { setError('Поставщик обязателен'); return; }
        if (!form.categoryId) { setError('Выберите категорию (тип станка)'); return; }
        setError(null);
        setIsSaving(true);
        try {
            const l = form.lengthMm || 0, w = form.widthMm || 0, h = form.heightMm || 0;
            const v: OptionVariant = {
                id: initial?.id || ApiService.generateId(),
                typeId: selectedTypeId,
                categoryId: form.categoryId!,
                name: form.name!.trim(),
                supplierProductName: form.supplierProductName || '',
                description: form.description || '',
                price: form.price || 0,
                currency: form.currency || Currency.Cny,
                composition: form.composition || [],
                supplierId: form.supplierId!,
                manufacturer: form.manufacturer || '',
                lengthMm: l, widthMm: w, heightMm: h,
                volumeM3: (l * w * h) / 1_000_000_000,
                imageUrl: form.imageUrl || '',
            };
            await onSave(v);
        } catch (e: any) {
            setError(e.message || 'Ошибка сохранения');
        } finally { setIsSaving(false); }
    };

    if (!isOpen) return null;

    const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400";
    const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";
    const sectionCls = "bg-white rounded-2xl p-4 space-y-4";

    const supplierItems = suppliers.map(s => ({ id: s.id, label: s.name, sub: s.country }));
    const categoryItems = machineCategories.map(c => ({ id: c.id, label: c.name }));
    const manufacturerItems = manufacturers.map(m => ({ id: m.name, label: m.name }));

    return (
        <>
            {overlay === 'supplier' && <SearchOverlay title="Поставщик" items={supplierItems} selectedId={form.supplierId || ''} onSelect={id => setF('supplierId', id)} onClose={() => setOverlay(null)} emptyLabel="— Не выбран" />}
            {overlay === 'category' && <SearchOverlay title="Категория (тип станка)" items={categoryItems} selectedId={form.categoryId || ''} onSelect={id => setF('categoryId', id)} onClose={() => setOverlay(null)} allowEmpty={false} emptyLabel="— Не выбрана" />}
            {overlay === 'manufacturer' && <SearchOverlay title="Производитель" items={manufacturerItems} selectedId={form.manufacturer || ''} onSelect={id => setF('manufacturer', id)} onClose={() => setOverlay(null)} emptyLabel="— Не указан" />}

            <div className="fixed inset-0 z-[300] bg-slate-900/60 flex flex-col justify-end">
                <div className="bg-slate-50 rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '95dvh' }}>
                    {/* Хедер */}
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-200 flex-none">
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 flex-none"><X size={20} /></button>
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{initial?.id ? 'Редактирование варианта' : 'Новый вариант'}</div>
                            <div className="text-sm font-black text-slate-700 truncate">{form.name || 'Без названия'}</div>
                        </div>
                        <button onClick={handleSave} disabled={!canWrite || isSaving}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex-none">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Сохранить
                        </button>
                    </div>

                    {/* Тело */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">{error}</div>}

                        {/* Фото */}
                        <div className={sectionCls}>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center flex-none overflow-hidden">
                                    {isUploading ? <Loader2 size={20} className="text-indigo-500 animate-spin" /> : form.imageUrl ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider">Фото варианта</div>
                                    <div className="flex gap-2">
                                        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold">
                                            <Upload size={13} /> Загрузить
                                        </button>
                                        {form.imageUrl && <button onClick={() => setF('imageUrl', '')} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold"><X size={13} /></button>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Основные поля */}
                        <div className={sectionCls}>
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Основные данные</div>

                            <div>
                                <label className={labelCls}>Название <span className="text-red-500">*</span></label>
                                <input type="text" className={inputCls} value={form.name || ''} onChange={e => setF('name', e.target.value)} placeholder="Название варианта" autoComplete="off" />
                            </div>
                            <div>
                                <label className={labelCls}>Название у поставщика</label>
                                <input type="text" className={inputCls} value={form.supplierProductName || ''} onChange={e => setF('supplierProductName', e.target.value)} placeholder="Артикул / наименование у поставщика" autoComplete="off" />
                            </div>

                            {/* Категория */}
                            <div>
                                <label className={labelCls}>Тип станка (категория) <span className="text-red-500">*</span></label>
                                <button onClick={() => setOverlay('category')} className={`${inputCls} flex items-center justify-between text-left`}>
                                    <span className={currentCategory ? 'text-slate-800' : 'text-slate-400'}>{currentCategory?.name || 'Выбрать категорию...'}</span>
                                    <ChevronDown size={16} className="text-slate-400 flex-none ml-2" />
                                </button>
                            </div>

                            {/* Поставщик */}
                            <div>
                                <label className={labelCls}>Поставщик <span className="text-red-500">*</span></label>
                                <button onClick={() => setOverlay('supplier')} className={`${inputCls} flex items-center justify-between text-left`}>
                                    <span className={currentSupplier ? 'text-slate-800' : 'text-slate-400'}>{currentSupplier?.name || 'Выбрать поставщика...'}</span>
                                    <ChevronDown size={16} className="text-slate-400 flex-none ml-2" />
                                </button>
                            </div>

                            {/* Производитель */}
                            <div>
                                <label className={labelCls}>Производитель</label>
                                <button onClick={() => setOverlay('manufacturer')} className={`${inputCls} flex items-center justify-between text-left`}>
                                    <span className={form.manufacturer ? 'text-slate-800' : 'text-slate-400'}>{form.manufacturer || 'Выбрать производителя...'}</span>
                                    <ChevronDown size={16} className="text-slate-400 flex-none ml-2" />
                                </button>
                            </div>
                        </div>

                        {/* Цена и габариты */}
                        {showPrices && (
                            <div className={sectionCls}>
                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Цена и габариты</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Цена закупки</label>
                                        <input type="number" inputMode="decimal" className={inputCls} value={form.price || ''} placeholder="0"
                                            onChange={e => setF('price', parseFloat(e.target.value) || 0)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Валюта</label>
                                        <select className={inputCls} value={form.currency || Currency.Cny} onChange={e => setF('currency', e.target.value as Currency)}>
                                            {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Габариты мм (Д × Ш × В)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="number" inputMode="decimal" className={inputCls} placeholder="Длина" value={form.lengthMm || ''} onChange={e => setF('lengthMm', parseFloat(e.target.value) || 0)} />
                                        <input type="number" inputMode="decimal" className={inputCls} placeholder="Ширина" value={form.widthMm || ''} onChange={e => setF('widthMm', parseFloat(e.target.value) || 0)} />
                                        <input type="number" inputMode="decimal" className={inputCls} placeholder="Высота" value={form.heightMm || ''} onChange={e => setF('heightMm', parseFloat(e.target.value) || 0)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Описание */}
                        <div className={sectionCls}>
                            <label className={labelCls}>Описание</label>
                            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description || ''}
                                onChange={e => setF('description', e.target.value)} placeholder="Описание, характеристики..." />
                        </div>

                        {/* Внутренний состав BOM */}
                        <div className={sectionCls}>
                            <button onClick={() => setShowBOM(v => !v)}
                                className="w-full flex items-center justify-between text-xs font-black text-slate-500 uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                    <Layers size={14} />
                                    <span>Внутренний состав</span>
                                    {(form.composition?.length ?? 0) > 0 && (
                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                                            {form.composition!.length}
                                        </span>
                                    )}
                                </div>
                                <ChevronDown size={14} className={`transition-transform ${showBOM ? 'rotate-180' : ''}`} />
                            </button>

                            {showBOM && (
                                <div className="space-y-3">
                                    {/* Строка поиска детали */}
                                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
                                        <Search size={14} className="text-slate-400 flex-none" />
                                        <input type="text" className="flex-1 bg-transparent text-[14px] outline-none text-slate-800 placeholder:text-slate-400"
                                            placeholder="Поиск детали (имя, SKU, поставщик)..."
                                            value={bomSearch} onChange={e => setBomSearch(e.target.value)} />
                                        {bomSearch && <button onClick={() => setBomSearch('')}><X size={13} className="text-slate-400" /></button>}
                                    </div>

                                    {bomSearch && (
                                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                                            {filteredBOM.map(p => {
                                                const sup = supplierMap.get(p.supplierId || '')?.name || '—';
                                                const isSelected = bomProductId === p.id;
                                                return (
                                                    <button key={p.id} onClick={() => { setBomProductId(p.id); setBomSearch(`${p.sku} — ${p.name}`); }}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-slate-800 truncate">{p.name}</div>
                                                            <div className="text-[11px] text-slate-400 font-mono">{p.sku} · {sup}</div>
                                                        </div>
                                                        {isSelected && <Check size={14} className="text-indigo-600 flex-none" />}
                                                    </button>
                                                );
                                            })}
                                            {filteredBOM.length === 0 && <div className="py-6 text-center text-sm text-slate-400">Ничего не найдено</div>}
                                        </div>
                                    )}

                                    {bomProductId && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 gap-2 flex-none">
                                                <span className="text-xs font-bold text-slate-500">Кол-во:</span>
                                                <input type="number" inputMode="numeric" className="w-14 bg-transparent text-sm font-black text-slate-700 text-center outline-none"
                                                    value={bomQty} onChange={e => setBomQty(parseFloat(e.target.value) || 1)} min={1} />
                                            </div>
                                            <button onClick={addBOM}
                                                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold">
                                                <Plus size={15} /> Добавить в состав
                                            </button>
                                        </div>
                                    )}

                                    {/* Текущий состав */}
                                    {(form.composition || []).length > 0 && (
                                        <div className="bg-slate-50 rounded-2xl divide-y divide-slate-200 overflow-hidden">
                                            {(form.composition || []).map((item, idx) => {
                                                const p = bomProducts.find(x => x.id === item.productId);
                                                return (
                                                    <div key={idx} className="flex items-center gap-3 px-4 py-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-slate-800 truncate">{p?.name || item.productId}</div>
                                                            <div className="text-xs text-slate-400">{p?.sku || ''}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-none">
                                                            <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">×{item.quantity}</span>
                                                            <button onClick={() => removeBOM(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="h-6" />
                    </div>
                </div>
            </div>
        </>
    );
};

// ─── Карточка варианта ─────────────────────────────────────────────────────────

const VariantCard: React.FC<{
    variant: OptionVariant;
    supplierMap: Map<string, Counterparty>;
    isDeleted: boolean;
    canWrite: boolean;
    showPrices: boolean;
    onEdit: () => void;
    onClone: () => void;
    onDelete: () => void;
}> = ({ variant: v, supplierMap, isDeleted, canWrite, showPrices, onEdit, onClone, onDelete }) => {
    const sup = supplierMap.get(v.supplierId || '');
    return (
        <div className={`bg-white rounded-2xl border overflow-hidden ${isDeleted ? 'border-red-200 opacity-60' : 'border-slate-200'}`}>
            <div className="flex gap-3 p-3.5">
                {v.imageUrl && (
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex-none overflow-hidden">
                        <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-bold text-slate-800 leading-snug flex-1">{v.name}</div>
                        {isDeleted && (
                            <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 flex-none">
                                <AlertTriangle size={10} /> В корзине
                            </span>
                        )}
                    </div>
                    {v.supplierProductName && <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{v.supplierProductName}</div>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {sup && <span className="text-[11px] bg-indigo-50 text-indigo-600 rounded-md px-2 py-0.5 font-medium flex items-center gap-1"><User size={10} />{sup.name}</span>}
                        {v.manufacturer && <span className="text-[11px] bg-purple-50 text-purple-600 rounded-md px-2 py-0.5 font-medium flex items-center gap-1"><Factory size={10} />{v.manufacturer}</span>}
                        {(v.composition?.length ?? 0) > 0 && <span className="text-[11px] bg-slate-100 text-slate-500 rounded-md px-2 py-0.5 font-medium flex items-center gap-1"><Layers size={10} />{v.composition!.length}</span>}
                    </div>
                    {showPrices && v.price > 0 && (
                        <div className="mt-1.5 text-sm font-black text-emerald-700">{v.price.toLocaleString()} {v.currency}</div>
                    )}
                </div>
            </div>
            {canWrite && !isDeleted && (
                <div className="flex border-t border-slate-100">
                    <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil size={13} />
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button onClick={onClone} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                        <List size={13} /> Клон
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button onClick={onDelete} className="px-4 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
                        <Trash2 size={15} />
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Главный компонент ─────────────────────────────────────────────────────────

export const MobileOptionsEditor: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('options_editor');

    const canWriteGroups = access.getLevel('actions', 'manage_groups') === 'write';
    const canWriteVariants = access.getLevel('actions', 'manage_variants') === 'write';
    const showPrices = access.canSee('fields', 'col_purchase_price');

    const { optionTypes = [], optionVariants = [], categories = [], products = [], suppliers = [], manufacturers = [], trash = [] } = state;

    const [screen, setScreen] = useState<Screen>('types');
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [typeSearch, setTypeSearch] = useState('');

    // Форма типа
    const [typeForm, setTypeForm] = useState(false);
    const [typeEdit, setTypeEdit] = useState<Partial<OptionType> | null>(null);
    const [typeError, setTypeError] = useState<string | null>(null);
    const [typeIsSaving, setTypeIsSaving] = useState(false);

    // Форма варианта
    const [variantForm, setVariantForm] = useState(false);
    const [variantInitial, setVariantInitial] = useState<Partial<OptionVariant> | null>(null);

    // Фильтр категории на экране вариантов
    const [catFilter, setCatFilter] = useState<string>('all');

    // Confirm delete
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'type' | 'variant'; id: string; name: string } | null>(null);

    // ── Derived ──

    const machineCategories = useMemo(() =>
        categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories]
    );

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

    const bomProducts = useMemo(() =>
        products.filter(p => p.type === ProductType.PART).sort((a, b) => a.name.localeCompare(b.name)),
        [products]
    );

    const deletedVariantIds = useMemo(() =>
        new Set(trash.filter(t => t.type === 'OptionVariant').map(t => t.originalId)),
        [trash]
    );

    const variantsByType = useMemo(() => {
        const map = new Map<string, OptionVariant[]>();
        optionVariants.forEach(v => {
            if (!map.has(v.typeId)) map.set(v.typeId, []);
            map.get(v.typeId)!.push(v);
        });
        return map;
    }, [optionVariants]);

    const filteredTypes = useMemo(() =>
        optionTypes
            .filter(ot => !typeSearch || ot.name.toLowerCase().includes(typeSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        [optionTypes, typeSearch]
    );

    const selectedType = useMemo(() =>
        optionTypes.find(t => t.id === selectedTypeId),
        [optionTypes, selectedTypeId]
    );

    // Варианты для текущего типа, сгруппированные по категории
    const variantGroups = useMemo(() => {
        if (!selectedTypeId) return [];
        const all = variantsByType.get(selectedTypeId) || [];
        const catIds = [...new Set(all.map(v => v.categoryId || '').filter(Boolean))];
        return catIds
            .map(catId => ({
                catId,
                catName: categories.find(c => c.id === catId)?.name || catId,
                variants: all.filter(v => v.categoryId === catId).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
            }))
            .sort((a, b) => a.catName.localeCompare(b.catName, 'ru'));
    }, [selectedTypeId, variantsByType, categories]);

    const displayedGroups = useMemo(() =>
        catFilter === 'all' ? variantGroups : variantGroups.filter(g => g.catId === catFilter),
        [variantGroups, catFilter]
    );

    // ── Handlers: types ──

    const handleOpenAddType = () => {
        setTypeEdit({ name: '', isRequired: false, isSingleSelect: true });
        setTypeError(null);
        setTypeForm(true);
    };

    const handleOpenEditType = (ot: OptionType) => {
        setTypeEdit(ot);
        setTypeError(null);
        setTypeForm(true);
    };

    const handleSaveType = async () => {
        if (!typeEdit?.name?.trim()) { setTypeError('Введите название'); return; }
        const dup = optionTypes.find(t => t.name.toLowerCase() === typeEdit.name!.toLowerCase() && t.id !== (typeEdit as OptionType).id);
        if (dup) { setTypeError(`"${typeEdit.name}" уже существует`); return; }
        setTypeIsSaving(true);
        try {
            if ((typeEdit as OptionType).id) await actions.updateOptionType(typeEdit as OptionType);
            else await actions.addOptionType({ ...typeEdit, id: ApiService.generateId() } as OptionType);
            setTypeForm(false);
        } catch (e: any) {
            setTypeError(e.message || 'Ошибка');
        } finally { setTypeIsSaving(false); }
    };

    const handleDeleteType = (id: string, name: string) =>
        setDeleteConfirm({ type: 'type', id, name });

    const handleDeleteVariant = (id: string, name: string) =>
        setDeleteConfirm({ type: 'variant', id, name });

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'type') {
            await actions.deleteOptionType(deleteConfirm.id);
            if (selectedTypeId === deleteConfirm.id) { setSelectedTypeId(null); setScreen('types'); }
        } else {
            await actions.deleteOptionVariant(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    };

    // ── Handlers: variants ──

    const handleOpenAddVariant = () => {
        setVariantInitial({ categoryId: catFilter !== 'all' ? catFilter : undefined });
        setVariantForm(true);
    };

    const handleOpenEditVariant = (v: OptionVariant) => {
        setVariantInitial(v);
        setVariantForm(true);
    };

    const handleCloneVariant = (v: OptionVariant) => {
        const { id, ...rest } = v;
        setVariantInitial({ ...rest });
        setVariantForm(true);
    };

    const handleSaveVariant = async (v: OptionVariant) => {
        if (variantInitial?.id) await actions.updateOptionVariant(v);
        else await actions.addOptionVariant(v);
        setVariantForm(false);
    };

    const handleDrillIn = (ot: OptionType) => {
        setSelectedTypeId(ot.id);
        setCatFilter('all');
        setScreen('variants');
    };

    // ── Render ──

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden">

            {/* Форма типа */}
            {typeForm && (
                <div className="fixed inset-0 z-[300] bg-slate-900/60 flex flex-col justify-end">
                    <div className="bg-slate-50 rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '80dvh' }}>
                        <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-200 flex-none">
                            <button onClick={() => setTypeForm(false)} className="p-2 rounded-xl text-slate-400"><X size={20} /></button>
                            <div className="flex-1 text-base font-black text-slate-700">
                                {(typeEdit as OptionType)?.id ? 'Редактировать тип' : 'Новый тип опции'}
                            </div>
                            <button onClick={handleSaveType} disabled={typeIsSaving}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                                {typeIsSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Сохранить
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            {typeError && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{typeError}</div>}
                            <div className="bg-white rounded-2xl p-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Название <span className="text-red-500">*</span></label>
                                    <input type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
                                        value={typeEdit?.name || ''} onChange={e => setTypeEdit(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Например: Лазерная трубка" autoFocus />
                                </div>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-xl cursor-pointer">
                                        <div className={`w-11 h-6 rounded-full transition-colors flex-none relative ${typeEdit?.isSingleSelect ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${typeEdit?.isSingleSelect ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
                                        </div>
                                        <input type="checkbox" className="sr-only" checked={!!typeEdit?.isSingleSelect}
                                            onChange={e => setTypeEdit(prev => ({ ...prev, isSingleSelect: e.target.checked }))} />
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">Выбор одного варианта</div>
                                            <div className="text-xs text-slate-400">Radio-кнопки (иначе — чекбоксы)</div>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-xl cursor-pointer">
                                        <div className={`w-11 h-6 rounded-full transition-colors flex-none relative ${typeEdit?.isRequired ? 'bg-red-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${typeEdit?.isRequired ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
                                        </div>
                                        <input type="checkbox" className="sr-only" checked={!!typeEdit?.isRequired}
                                            onChange={e => setTypeEdit(prev => ({ ...prev, isRequired: e.target.checked }))} />
                                        <div>
                                            <div className="text-sm font-bold text-slate-700">Обязательно</div>
                                            <div className="text-xs text-slate-400">Нельзя не выбрать</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Форма варианта */}
            {variantForm && selectedTypeId && (
                <VariantFormSheet
                    isOpen={variantForm}
                    onClose={() => setVariantForm(false)}
                    onSave={handleSaveVariant}
                    initial={variantInitial}
                    selectedTypeId={selectedTypeId}
                    suppliers={suppliers}
                    manufacturers={manufacturers}
                    machineCategories={machineCategories}
                    bomProducts={bomProducts}
                    supplierMap={supplierMap}
                    canWrite={canWriteVariants}
                    showPrices={showPrices}
                />
            )}

            {/* Подтверждение удаления */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-end justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <Trash2 size={28} className="text-red-500 mx-auto mb-3" />
                        <h3 className="text-base font-black text-slate-800 text-center mb-1">
                            {deleteConfirm.type === 'type' ? 'Удалить тип опции?' : 'Удалить вариант?'}
                        </h3>
                        <p className="text-sm text-slate-500 text-center mb-1">«{deleteConfirm.name}»</p>
                        {deleteConfirm.type === 'type' && (
                            <p className="text-xs text-red-500 text-center mb-4">Все варианты этого типа тоже будут удалены</p>
                        )}
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-2xl text-sm">Отмена</button>
                            <button onClick={handleConfirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold text-sm">Удалить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ ЭКРАН 1: ТИПЫ ОПЦИЙ ══════════════════════════════════════════════ */}
            {screen === 'types' && (
                <>
                    <div className="bg-white shadow-sm flex-none">
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                            <div>
                                <h1 className="text-lg font-black text-slate-800 uppercase italic leading-none">Опции</h1>
                                <div className="text-xs text-slate-400 font-semibold mt-0.5">{filteredTypes.length} типов</div>
                            </div>
                            {canWriteGroups && (
                                <button onClick={handleOpenAddType}
                                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/25 active:scale-95 transition-transform flex-none">
                                    <Plus size={16} /> Добавить тип
                                </button>
                            )}
                        </div>
                        <div className="px-4 pb-3">
                            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                                <Search size={15} className="text-slate-400 flex-none" />
                                <input type="text" className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                                    placeholder="Поиск типа опции..." value={typeSearch} onChange={e => setTypeSearch(e.target.value)} />
                                {typeSearch && <button onClick={() => setTypeSearch('')}><X size={14} className="text-slate-400" /></button>}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                        {filteredTypes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-4">
                                    <Settings size={26} className="text-slate-300" />
                                </div>
                                <div className="text-base font-bold text-slate-500">
                                    {typeSearch ? 'Ничего не найдено' : 'Нет типов опций'}
                                </div>
                                {canWriteGroups && !typeSearch && (
                                    <button onClick={handleOpenAddType} className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm">
                                        <Plus size={16} /> Создать первый тип
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredTypes.map(ot => {
                                const typeVariants = variantsByType.get(ot.id) || [];
                                const uniqueCats = new Set(typeVariants.map(v => v.categoryId).filter(Boolean)).size;
                                return (
                                    <div key={ot.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                        <button onClick={() => handleDrillIn(ot)} className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-slate-50">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-none">
                                                <Settings size={18} className="text-indigo-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-800">{ot.name}</div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-bold uppercase">
                                                        {ot.isSingleSelect ? 'Один вариант' : 'Несколько'}
                                                    </span>
                                                    {ot.isRequired && <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 rounded px-1.5 py-0.5 font-bold">Обязат.</span>}
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><Box size={10} /> {uniqueCats} кат.</span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><List size={10} /> {typeVariants.length} вар.</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 flex-none" />
                                        </button>
                                        {canWriteGroups && (
                                            <div className="flex border-t border-slate-100">
                                                <button onClick={() => handleOpenEditType(ot)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                                                    <Pencil size={13} /> Изменить
                                                </button>
                                                <div className="w-px bg-slate-100" />
                                                <button onClick={() => handleDeleteType(ot.id, ot.name)}
                                                    className="px-5 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        <div className="h-4" />
                    </div>
                </>
            )}

            {/* ══ ЭКРАН 2: ВАРИАНТЫ ══════════════════════════════════════════════ */}
            {screen === 'variants' && selectedType && (
                <>
                    <div className="bg-white shadow-sm flex-none">
                        {/* Навбар */}
                        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                            <button onClick={() => setScreen('types')} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 flex-none">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Тип опции</div>
                                <div className="text-base font-black text-slate-800 truncate">{selectedType.name}</div>
                            </div>
                            {canWriteVariants && (
                                <button onClick={handleOpenAddVariant}
                                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/25 active:scale-95 transition-transform flex-none">
                                    <Plus size={16} /> Вариант
                                </button>
                            )}
                        </div>

                        {/* Теги типа */}
                        <div className="flex items-center gap-2 px-4 pb-2">
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 rounded-lg px-2 py-1 font-bold uppercase">
                                {selectedType.isSingleSelect ? 'Один вариант' : 'Несколько'}
                            </span>
                            {selectedType.isRequired && <span className="text-[10px] bg-red-50 text-red-500 rounded-lg px-2 py-1 font-bold border border-red-100">Обязательно</span>}
                            <span className="text-xs text-slate-400">{(variantsByType.get(selectedType.id) || []).length} вариантов</span>
                        </div>

                        {/* Фильтр по категории */}
                        {variantGroups.length > 1 && (
                            <div className="px-4 pb-3 overflow-x-auto">
                                <div className="flex gap-1.5 w-max">
                                    <button onClick={() => setCatFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${catFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        Все
                                    </button>
                                    {variantGroups.map(g => (
                                        <button key={g.catId} onClick={() => setCatFilter(g.catId)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${catFilter === g.catId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                            {g.catName} <span className="ml-1 opacity-70">{g.variants.length}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        {displayedGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mb-4">
                                    <List size={26} className="text-slate-300" />
                                </div>
                                <div className="text-base font-bold text-slate-500">Нет вариантов</div>
                                <div className="text-sm text-slate-400 mt-1">Нажмите «Вариант» чтобы добавить</div>
                                {canWriteVariants && (
                                    <button onClick={handleOpenAddVariant} className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm">
                                        <Plus size={16} /> Добавить
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {displayedGroups.map(group => (
                                    <div key={group.catId}>
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <Box size={13} className="text-slate-400 flex-none" />
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{group.catName}</span>
                                            <span className="text-xs text-slate-400">· {group.variants.length}</span>
                                        </div>
                                        <div className="space-y-2.5">
                                            {group.variants.map(v => (
                                                <VariantCard
                                                    key={v.id}
                                                    variant={v}
                                                    supplierMap={supplierMap}
                                                    isDeleted={deletedVariantIds.has(v.id)}
                                                    canWrite={canWriteVariants}
                                                    showPrices={showPrices}
                                                    onEdit={() => handleOpenEditVariant(v)}
                                                    onClone={() => handleCloneVariant(v)}
                                                    onDelete={() => handleDeleteVariant(v.id, v.name)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="h-4" />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
