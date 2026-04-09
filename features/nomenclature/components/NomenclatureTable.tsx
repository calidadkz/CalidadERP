
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Product, ProductCategory } from '@/types/product';
import { ProductType, PricingMethod } from '@/types/enums';
import { HSCode } from '@/types/customs';
import { Counterparty as Supplier } from '@/types/counterparty';
import {
    Search, Cpu, Settings, Briefcase, Pencil, Trash2, Eye,
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy,
    Zap, Layers, Check, Square, CheckSquare, Box, X
} from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { ImageModal } from '@/components/ui/ImageModal';
import { CalidadSelect, CalidadSelectOption } from '@/components/ui/CalidadSelect';

interface NomenclatureTableProps {
    products: Product[];
    suppliers: Supplier[];
    categories: ProductCategory[];
    hscodes?: HSCode[];
    manufacturers?: string[];
    onEdit: (p: Product) => void;
    onCopy: (p: Product) => void;
    onDelete: (id: string, name: string) => void;
    onFilteredDataChange?: (products: Product[]) => void;
    onInlineUpdate?: (product: Product) => void;
    onMassUpdate?: (ids: string[], changes: Partial<Product>) => void;
}

type SortConfig = { key: keyof Product; direction: 'asc' | 'desc' } | null;

const ITEMS_PER_PAGE = 50;

const PRICING_OPTIONS = [
    { value: PricingMethod.MARKUP_WITHOUT_VAT, label: 'Наценка (без НДС)' },
    { value: PricingMethod.MARKUP_WITH_VAT,    label: 'Наценка (с НДС)' },
    { value: PricingMethod.PROFILE,             label: 'Ценовой профиль' },
];

export const NomenclatureTable: React.FC<NomenclatureTableProps> = ({
    products = [],
    suppliers = [],
    categories = [],
    hscodes = [],
    manufacturers = [],
    onEdit,
    onCopy,
    onDelete,
    onFilteredDataChange,
    onInlineUpdate,
    onMassUpdate,
}) => {
    const access = useAccess('nomenclature');
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [filters, setFilters] = useState<Record<string, string>>({
        name_sku: '', categoryId: '', supplier_mfg: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [modalImage, setModalImage] = useState<{ src: string, alt: string } | null>(null);

    // Режимы
    const [isQuickEditMode, setIsQuickEditMode] = useState(false);
    const [isMassEditMode, setIsMassEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Буфер несохранённых изменений в Quick Edit
    const [inlineEdits, setInlineEdits] = useState<Record<string, Partial<Product>>>({});

    // Mass Edit
    const [massValues, setMassValues] = useState({
        supplierId: '', manufacturer: '', categoryId: '', hsCodeId: '',
        pricingMethod: '', markupPercentage: ''
    });
    const [massEnabled, setMassEnabled] = useState<Record<string, boolean>>({});

    const canSeePurchase = access.canSee('fields', 'basePrice');
    const canWrite = access.canWrite('actions', 'edit');
    const colCount = canSeePurchase ? 9 : 8;

    // ── Опции для CalidadSelect ──
    const supplierOptions = useMemo<CalidadSelectOption[]>(() =>
        suppliers.map(s => ({ id: s.id, label: s.name })), [suppliers]);
    const categoryOptions = useMemo<CalidadSelectOption[]>(() =>
        categories.map(c => ({ id: c.id, label: c.name })), [categories]);
    const hscodeOptions = useMemo<CalidadSelectOption[]>(() =>
        (hscodes || []).map(h => ({ id: h.id, label: h.code, sub: h.name?.slice(0, 50) })), [hscodes]);
    const pricingOptions = useMemo<CalidadSelectOption[]>(() =>
        PRICING_OPTIONS.map(o => ({ id: o.value, label: o.label })), []);

    // --- Сортировка / фильтрация ---
    const handleSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const processedProducts = useMemo(() => {
        let data = [...products];
        if (filters.name_sku || filters.categoryId || filters.supplier_mfg) {
            const s = filters.name_sku.toLowerCase();
            const c = filters.categoryId.toLowerCase();
            const sup = filters.supplier_mfg.toLowerCase();
            data = data.filter(item => {
                const ms = !s || item.name.toLowerCase().includes(s) || (item.sku || '').toLowerCase().includes(s);
                const mc = !c || (categories.find(x => x.id === item.categoryId)?.name || '').toLowerCase().includes(c);
                const msup = !sup
                    || (suppliers.find(x => x.id === item.supplierId)?.name || '').toLowerCase().includes(sup)
                    || (item.manufacturer || '').toLowerCase().includes(sup);
                return ms && mc && msup;
            });
        }
        if (sortConfig) {
            data.sort((a, b) => {
                const av = (a as any)[sortConfig.key] ?? 0;
                const bv = (b as any)[sortConfig.key] ?? 0;
                if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [products, filters, sortConfig, categories, suppliers]);

    const totalItems = processedProducts.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedProducts.slice(start, start + ITEMS_PER_PAGE);
    }, [processedProducts, currentPage]);

    useEffect(() => {
        if (onFilteredDataChange) onFilteredDataChange(processedProducts);
    }, [processedProducts, onFilteredDataChange]);

    // --- Quick Edit helpers ---
    // Получить актуальное значение поля: буфер → исходный продукт
    const getField = (product: Product, key: keyof Product): any =>
        (inlineEdits[product.id] as any)?.[key] ?? (product as any)[key];

    const setInlineField = (productId: string, key: keyof Product, value: any) => {
        setInlineEdits(prev => ({ ...prev, [productId]: { ...prev[productId], [key]: value } }));
    };

    const saveInline = (product: Product) => {
        const diff = inlineEdits[product.id];
        if (!diff || Object.keys(diff).length === 0) return;
        const updated: Product = { ...product, ...diff };
        onInlineUpdate?.(updated);
        setInlineEdits(prev => { const n = { ...prev }; delete n[product.id]; return n; });
    };

    const isDirty = (id: string) => !!inlineEdits[id] && Object.keys(inlineEdits[id]).length > 0;

    // --- Mass Edit ---
    const handleSelectAll = () => {
        if (selectedIds.size === paginatedProducts.length)
            setSelectedIds(new Set());
        else
            setSelectedIds(new Set(paginatedProducts.map(p => p.id)));
    };

    const toggleSelect = (id: string) => {
        const n = new Set(selectedIds);
        if (n.has(id)) n.delete(id); else n.add(id);
        setSelectedIds(n);
    };

    const handleMassApply = () => {
        if (selectedIds.size === 0) return;
        const changes: Partial<Product> = {};
        if (massEnabled.supplierId && massValues.supplierId) changes.supplierId = massValues.supplierId;
        if (massEnabled.manufacturer && massValues.manufacturer) changes.manufacturer = massValues.manufacturer;
        if (massEnabled.categoryId && massValues.categoryId) changes.categoryId = massValues.categoryId;
        if (massEnabled.hsCodeId && massValues.hsCodeId) changes.hsCodeId = massValues.hsCodeId;
        if (massEnabled.pricingMethod && massValues.pricingMethod) changes.pricingMethod = massValues.pricingMethod as PricingMethod;
        if (massEnabled.markupPercentage && massValues.markupPercentage) changes.markupPercentage = parseFloat(massValues.markupPercentage);
        onMassUpdate?.([...selectedIds], changes);
        setIsMassEditMode(false);
        setSelectedIds(new Set());
        setMassEnabled({});
    };

    const enterMassEdit = () => { setIsMassEditMode(true); setIsQuickEditMode(false); setSelectedIds(new Set()); };
    const exitMassEdit = () => { setIsMassEditMode(false); setSelectedIds(new Set()); setMassEnabled({}); };

    const renderSortIcon = (key: keyof Product) => {
        if (sortConfig?.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-0.5 inline" /> : <ChevronDown size={12} className="ml-0.5 inline" />;
    };

    const isMarkupMethod = (pm: string) => pm === PricingMethod.MARKUP_WITHOUT_VAT || pm === PricingMethod.MARKUP_WITH_VAT;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">

            {/* ── Тулбар режимов ── */}
            <div className="flex-none flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
                {!isMassEditMode ? (
                    <>
                        {onInlineUpdate && (
                            <button
                                onClick={() => { setIsQuickEditMode(v => !v); if (isMassEditMode) exitMassEdit(); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${isQuickEditMode ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600'}`}
                            >
                                <Zap size={12} /> Быстрое ред.
                            </button>
                        )}
                        {onMassUpdate && (
                            <button
                                onClick={enterMassEdit}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-all"
                            >
                                <Layers size={12} /> Массовое ред.
                            </button>
                        )}
                        {isQuickEditMode && (
                            <span className="text-[9px] text-amber-600 font-bold ml-1">— нажмите Enter или уйдите из поля чтобы сохранить</span>
                        )}
                    </>
                ) : (
                    <div className="flex items-center gap-3 w-full flex-wrap">
                        <Layers size={14} className="text-blue-600" />
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Массовое: {selectedIds.size} выбрано</span>
                        <button onClick={handleSelectAll} className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all">
                            {selectedIds.size === paginatedProducts.length ? 'Снять всё' : 'Выбрать все'}
                        </button>

                        {/* Поля для массового редактирования */}
                        <div className="flex items-center gap-2 flex-wrap ml-2">
                            {/* Поставщик */}
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] ${massEnabled.supplierId ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                <input type="checkbox" checked={!!massEnabled.supplierId} onChange={e => setMassEnabled(p => ({ ...p, supplierId: e.target.checked }))} className="w-3 h-3 accent-blue-600" />
                                <span className="font-black text-slate-500 uppercase tracking-wider">Поставщик:</span>
                                <CalidadSelect options={supplierOptions} value={massValues.supplierId} onChange={v => setMassValues(p => ({ ...p, supplierId: v }))} disabled={!massEnabled.supplierId} placeholder="выбрать" nullLabel="— Не выбран —" className="w-36" zIndex="z-[200]" />
                            </label>

                            {/* Производитель — text input, нет справочника id */}
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] ${massEnabled.manufacturer ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                <input type="checkbox" checked={!!massEnabled.manufacturer} onChange={e => setMassEnabled(p => ({ ...p, manufacturer: e.target.checked }))} className="w-3 h-3 accent-blue-600" />
                                <span className="font-black text-slate-500 uppercase tracking-wider">Произв.:</span>
                                <input type="text" value={massValues.manufacturer} onChange={e => setMassValues(p => ({ ...p, manufacturer: e.target.value }))} disabled={!massEnabled.manufacturer} className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-40" />
                            </label>

                            {/* Категория */}
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] ${massEnabled.categoryId ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                <input type="checkbox" checked={!!massEnabled.categoryId} onChange={e => setMassEnabled(p => ({ ...p, categoryId: e.target.checked }))} className="w-3 h-3 accent-blue-600" />
                                <span className="font-black text-slate-500 uppercase tracking-wider">Категория:</span>
                                <CalidadSelect options={categoryOptions} value={massValues.categoryId} onChange={v => setMassValues(p => ({ ...p, categoryId: v }))} disabled={!massEnabled.categoryId} placeholder="выбрать" nullLabel="— Не выбрана —" className="w-40" zIndex="z-[200]" />
                            </label>

                            {/* ТНВЭД */}
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] ${massEnabled.hsCodeId ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                <input type="checkbox" checked={!!massEnabled.hsCodeId} onChange={e => setMassEnabled(p => ({ ...p, hsCodeId: e.target.checked }))} className="w-3 h-3 accent-blue-600" />
                                <span className="font-black text-slate-500 uppercase tracking-wider">ТНВЭД:</span>
                                <CalidadSelect options={hscodeOptions} value={massValues.hsCodeId} onChange={v => setMassValues(p => ({ ...p, hsCodeId: v }))} disabled={!massEnabled.hsCodeId} placeholder="выбрать" nullLabel="— Не задан —" className="w-44" dropdownMinWidth="280px" zIndex="z-[200]" />
                            </label>

                            {/* Метод цены */}
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] ${massEnabled.pricingMethod ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                <input type="checkbox" checked={!!massEnabled.pricingMethod} onChange={e => setMassEnabled(p => ({ ...p, pricingMethod: e.target.checked }))} className="w-3 h-3 accent-blue-600" />
                                <span className="font-black text-slate-500 uppercase tracking-wider">Метод цены:</span>
                                <CalidadSelect options={pricingOptions} value={massValues.pricingMethod} onChange={v => setMassValues(p => ({ ...p, pricingMethod: v }))} disabled={!massEnabled.pricingMethod} placeholder="выбрать" nullLabel="— Не задан —" className="w-44" zIndex="z-[200]" />
                            </label>

                            {/* Наценка — только если выбран метод с наценкой */}
                            {isMarkupMethod(massValues.pricingMethod) && massEnabled.pricingMethod && (
                                <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[10px] ${massEnabled.markupPercentage ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                    <input type="checkbox" checked={!!massEnabled.markupPercentage} onChange={e => setMassEnabled(p => ({ ...p, markupPercentage: e.target.checked }))} className="w-3 h-3 accent-blue-600" />
                                    <span className="font-black text-slate-500 uppercase tracking-wider">Наценка %:</span>
                                    <input type="number" value={massValues.markupPercentage} onChange={e => setMassValues(p => ({ ...p, markupPercentage: e.target.value }))} disabled={!massEnabled.markupPercentage} className="w-16 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 font-bold font-mono text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-40 text-right" />
                                </label>
                            )}
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={handleMassApply} disabled={selectedIds.size === 0 || !Object.values(massEnabled).some(Boolean)} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm disabled:opacity-40 transition-all">
                                <Check size={12} /> Применить
                            </button>
                            <button onClick={exitMassEdit} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Таблица ── */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <table className="min-w-full divide-y divide-gray-200 table-fixed border-separate border-spacing-0">
                    <thead className="relative z-10">
                        <tr className="text-slate-500">
                            {isMassEditMode && (
                                <th className="sticky top-0 bg-gray-50 w-8 px-1 py-3 text-center border-b">
                                    <button onClick={handleSelectAll} className="text-slate-400 hover:text-blue-600 transition-all">
                                        {selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0
                                            ? <CheckSquare size={14} className="text-blue-600" />
                                            : <Square size={14} />}
                                    </button>
                                </th>
                            )}
                            <th onClick={() => handleSort('type')} className="sticky top-0 bg-gray-50 w-12 px-1 py-3 text-center text-[9px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
                                {renderSortIcon('type') || 'Фото'}
                            </th>
                            <th onClick={() => handleSort('name')} className="sticky top-0 bg-gray-50 w-[42%] px-2 py-3 text-left text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
                                Наименование {renderSortIcon('name')}
                            </th>
                            <th onClick={() => handleSort('categoryId')} className="sticky top-0 bg-gray-50 w-[15%] px-1.5 py-3 text-left text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
                                Категория {renderSortIcon('categoryId')}
                            </th>
                            <th onClick={() => handleSort('supplierId')} className="sticky top-0 bg-gray-50 w-[15%] px-1.5 py-3 text-left text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
                                Пост. / Произв. {renderSortIcon('supplierId')}
                            </th>
                            {canSeePurchase && (
                                <th onClick={() => handleSort('basePrice')} className="sticky top-0 bg-gray-50 w-16 px-1.5 py-3 text-right text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
                                    Закуп {renderSortIcon('basePrice')}
                                </th>
                            )}
                            <th onClick={() => handleSort('salesPrice')} className="sticky top-0 bg-green-50 w-20 px-1.5 py-3 text-right text-[10px] font-black uppercase cursor-pointer hover:bg-green-100 transition-colors text-green-700 border-b">
                                Продажа {renderSortIcon('salesPrice')}
                            </th>
                            <th className="sticky top-0 bg-gray-50 w-20 px-1.5 py-3 text-right text-[10px] font-black uppercase border-b">Объем</th>
                            <th className="sticky top-0 bg-gray-50 w-16 px-1.5 py-3 text-center text-[10px] font-black uppercase border-b">Мест</th>
                            <th className="sticky top-0 bg-gray-50 w-10 px-1 py-3 text-center text-[10px] font-black uppercase border-b"></th>
                        </tr>
                        {/* Строка фильтров */}
                        <tr className="bg-white/95 backdrop-blur-sm shadow-sm sticky top-[37px] z-10">
                            {isMassEditMode && <th className="px-1 py-1.5 border-b"></th>}
                            <th className="px-1 py-1.5 border-b"></th>
                            <th className="px-2 py-1.5 border-b">
                                <div className="relative">
                                    <Search size={10} className="absolute left-2 top-2.5 text-gray-400" />
                                    <input className="w-full min-w-0 pl-6 pr-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold" placeholder="Поиск..." value={filters.name_sku} onChange={e => { setFilters(p => ({ ...p, name_sku: e.target.value })); setCurrentPage(1); }} />
                                </div>
                            </th>
                            <th className="px-1.5 py-1.5 border-b">
                                <input className="w-full min-w-0 px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold" placeholder="Категория..." value={filters.categoryId} onChange={e => { setFilters(p => ({ ...p, categoryId: e.target.value })); setCurrentPage(1); }} />
                            </th>
                            <th className="px-1.5 py-1.5 border-b">
                                <input className="w-full min-w-0 px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold" placeholder="Поставщик / Произв..." value={filters.supplier_mfg} onChange={e => { setFilters(p => ({ ...p, supplier_mfg: e.target.value })); setCurrentPage(1); }} />
                            </th>
                            {canSeePurchase && <th className="px-1.5 py-1.5 border-b"></th>}
                            <th className="px-1.5 py-1.5 border-b bg-green-50/20"></th>
                            <th className="px-1.5 py-1.5 border-b"></th>
                            <th className="px-1.5 py-1.5 border-b"></th>
                            <th className="px-1.5 py-1.5 border-b"></th>
                        </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                        {paginatedProducts.length === 0 ? (
                            <tr><td colSpan={colCount + (isMassEditMode ? 1 : 0)} className="p-12 text-center text-slate-400 italic">Ничего не найдено</td></tr>
                        ) : paginatedProducts.map(product => {
                            const supplier = suppliers.find(s => s.id === product.supplierId);
                            const category = categories.find(c => c.id === product.categoryId);
                            const hsCode = hscodes.find(h => h.id === product.hsCodeId);
                            const isSelected = selectedIds.has(product.id);
                            const dirty = isDirty(product.id);

                            return (
                                <React.Fragment key={product.id}>
                                    {/* ── Основная строка ── */}
                                    <tr className={`hover:bg-slate-50/50 group transition-all ${isSelected ? 'bg-blue-50/30' : ''} ${dirty ? 'outline outline-1 outline-amber-300/60 outline-offset-[-1px]' : ''}`}>
                                        {isMassEditMode && (
                                            <td className="px-1 py-2 text-center">
                                                <button onClick={() => toggleSelect(product.id)} className="text-slate-400 hover:text-blue-600 transition-all">
                                                    {isSelected ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                                                </button>
                                            </td>
                                        )}
                                        <td className="px-1 py-2 text-center">
                                            <div
                                                className={`w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden mx-auto shadow-sm transition-transform hover:scale-110 active:scale-95 ${product.imageUrl ? 'cursor-zoom-in' : ''}`}
                                                onClick={() => product.imageUrl && setModalImage({ src: product.imageUrl, alt: product.name })}
                                            >
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt={product.sku} className="w-full h-full object-contain" />
                                                ) : product.type === ProductType.MACHINE ? (
                                                    <Cpu className="text-blue-400" size={12} />
                                                ) : product.type === ProductType.PART ? (
                                                    <Settings className="text-orange-400" size={12} />
                                                ) : (
                                                    <Briefcase className="text-purple-400" size={12} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3">
                                            <div className="flex flex-col gap-1 overflow-hidden">
                                                <div className="text-[13px] font-bold text-slate-700 cursor-pointer hover:text-blue-600 transition-colors whitespace-normal break-words leading-snug" onClick={() => onEdit(product)}>
                                                    {product.name}
                                                    {dirty && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" title="Несохранённые изменения" />}
                                                </div>
                                                <div className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">{product.sku}</div>
                                                {hsCode && (
                                                    <div className="text-[9px] font-mono text-indigo-500 font-bold">{hsCode.code}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-1.5 py-3">
                                            <div className="text-slate-500 font-medium whitespace-normal leading-tight text-[10px]">{category?.name || '—'}</div>
                                        </td>
                                        <td className="px-1.5 py-3">
                                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                                <div className="text-slate-700 font-bold truncate text-[10px]">{supplier?.name || '—'}</div>
                                                <div className="text-slate-400 font-medium truncate text-[9px]">{product.manufacturer || '—'}</div>
                                            </div>
                                        </td>
                                        {canSeePurchase && (
                                            <td className="px-1.5 py-3 text-right">
                                                <div className="text-slate-600 font-bold font-mono tracking-tighter whitespace-nowrap text-xs">
                                                    {(product.basePrice || 0).toLocaleString()} <span className="text-[8px] text-slate-300">{product.currency}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-1.5 py-3 text-right bg-green-50/20">
                                            <div className="text-green-700 font-black font-mono whitespace-nowrap text-xs">
                                                {(product.salesPrice || 0).toLocaleString()} <span className="text-[8px] opacity-60">₸</span>
                                            </div>
                                            {product.pricingMethod && (
                                                <div className="text-[8px] text-slate-400 font-medium truncate max-w-[70px] text-right">
                                                    {product.pricingMethod === PricingMethod.MARKUP_WITHOUT_VAT ? 'б/НДС'
                                                        : product.pricingMethod === PricingMethod.MARKUP_WITH_VAT ? 'с/НДС'
                                                        : 'профиль'}
                                                    {isMarkupMethod(product.pricingMethod || '') ? ` ${product.markupPercentage}%` : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-1.5 py-3 text-right font-mono">
                                            <div className="font-black text-slate-600 text-xs">
                                                {(product.packages?.reduce((s, p) => s + (p.volumeM3 || 0), 0) || 0).toFixed(3)} <span className="text-[9px] font-bold text-slate-300">m³</span>
                                            </div>
                                        </td>
                                        <td className="px-1.5 py-3 text-center font-mono">
                                            <div className="font-black text-slate-600 text-xs">{product.packages?.length || 0}</div>
                                        </td>
                                        <td className="px-1 py-3 text-center">
                                            <div className="flex justify-center gap-0.5">
                                                <button onClick={() => onEdit(product)} className={`p-1 rounded-md transition-all ${canWrite ? 'text-slate-300 hover:text-blue-600 hover:bg-blue-50' : 'text-blue-500 bg-blue-50 hover:bg-blue-100'}`}>
                                                    {canWrite ? <Pencil size={12} /> : <Eye size={12} />}
                                                </button>
                                                {canWrite && <button onClick={() => onCopy(product)} className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"><Copy size={12} /></button>}
                                                {access.canWrite('actions', 'delete') && <button onClick={() => onDelete(product.id, product.name)} className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"><Trash2 size={12} /></button>}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* ── Quick Edit sub-row ── */}
                                    {isQuickEditMode && (
                                        <tr className="bg-amber-50/30 border-t-0">
                                            <td colSpan={colCount} className="px-4 py-2.5 border-b border-amber-100/80">
                                                <div className="flex items-end gap-3 flex-wrap">

                                                    {/* Поставщик */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Поставщик</span>
                                                        <CalidadSelect
                                                            options={supplierOptions}
                                                            value={getField(product, 'supplierId') || ''}
                                                            onChange={v => { setInlineField(product.id, 'supplierId', v); }}
                                                            placeholder="не выбран"
                                                            nullLabel="— Не выбран —"
                                                            className="w-44"
                                                            zIndex="z-[150]"
                                                        />
                                                    </div>

                                                    {/* Производитель */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Производитель</span>
                                                        <input
                                                            type="text"
                                                            value={getField(product, 'manufacturer') || ''}
                                                            onChange={e => setInlineField(product.id, 'manufacturer', e.target.value)}
                                                            onBlur={() => saveInline(product)}
                                                            onKeyDown={e => e.key === 'Enter' && saveInline(product)}
                                                            placeholder="напр. We-Tech"
                                                            className="w-32 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                                        />
                                                    </div>

                                                    {/* Метод ценообразования */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Метод цены</span>
                                                        <CalidadSelect
                                                            options={pricingOptions}
                                                            value={getField(product, 'pricingMethod') || ''}
                                                            onChange={v => { setInlineField(product.id, 'pricingMethod', v || undefined); }}
                                                            placeholder="не задан"
                                                            nullLabel="— Не задан —"
                                                            className="w-44"
                                                            zIndex="z-[150]"
                                                        />
                                                    </div>

                                                    {/* Наценка + цена продажи — только если метод с наценкой */}
                                                    {isMarkupMethod(getField(product, 'pricingMethod') || '') && (
                                                        <>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Наценка %</span>
                                                                <input
                                                                    type="number"
                                                                    value={getField(product, 'markupPercentage') ?? 0}
                                                                    onChange={e => setInlineField(product.id, 'markupPercentage', parseFloat(e.target.value) || 0)}
                                                                    onBlur={() => saveInline(product)}
                                                                    onKeyDown={e => e.key === 'Enter' && saveInline(product)}
                                                                    className="w-20 bg-white border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold font-mono text-slate-700 focus:outline-none focus:border-amber-400 transition-all text-right"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Расч. цена</span>
                                                                <div className="h-[30px] flex items-center px-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                                                    <span className="text-[11px] font-black text-emerald-700 font-mono">
                                                                        {(product.salesPrice || 0).toLocaleString()} ₸
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Код ТНВЭД */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Код ТНВЭД</span>
                                                        <CalidadSelect
                                                            options={hscodeOptions}
                                                            value={getField(product, 'hsCodeId') || ''}
                                                            onChange={v => { setInlineField(product.id, 'hsCodeId', v || undefined); }}
                                                            placeholder="не задан"
                                                            nullLabel="— Не задан —"
                                                            className="w-52"
                                                            dropdownMinWidth="300px"
                                                            zIndex="z-[150]"
                                                        />
                                                    </div>

                                                    {/* Транспортные габариты */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Габариты (Д×Ш×В, мм)</span>
                                                        {(!product.packages || product.packages.length === 0) ? (
                                                            <span className="h-[30px] flex items-center text-[10px] text-slate-400 italic">нет — задайте в карточке</span>
                                                        ) : product.packages.length === 1 ? (
                                                            <div className="flex items-center gap-1">
                                                                {(['lengthMm', 'widthMm', 'heightMm'] as const).map((dim, idx) => (
                                                                    <React.Fragment key={dim}>
                                                                        {idx > 0 && <span className="text-[9px] text-slate-400 font-bold">×</span>}
                                                                        <input
                                                                            type="number"
                                                                            defaultValue={product.packages![0][dim] || 0}
                                                                            onBlur={e => {
                                                                                const pkg = { ...(product.packages![0]), [dim]: parseFloat(e.target.value) || 0 };
                                                                                const updated: Product = { ...product, ...(inlineEdits[product.id] || {}), packages: [pkg] };
                                                                                onInlineUpdate?.(updated);
                                                                                setInlineEdits(prev => { const n = { ...prev }; delete n[product.id]; return n; });
                                                                            }}
                                                                            className="w-16 bg-white border border-amber-200 rounded-lg px-1.5 py-1 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-amber-400 text-center"
                                                                        />
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="h-[30px] flex items-center">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-black text-blue-700">
                                                                    <Box size={11} /> {product.packages.length} мест — откройте карточку
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Вес */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Вес (кг)</span>
                                                        {(!product.packages || product.packages.length === 0) ? (
                                                            <span className="h-[30px] flex items-center text-[10px] text-slate-400 italic">—</span>
                                                        ) : product.packages.length === 1 ? (
                                                            <input
                                                                type="number"
                                                                defaultValue={product.packages[0].weightKg || 0}
                                                                onBlur={e => {
                                                                    const pkg = { ...product.packages![0], weightKg: parseFloat(e.target.value) || 0 };
                                                                    const updated: Product = { ...product, ...(inlineEdits[product.id] || {}), packages: [pkg] };
                                                                    onInlineUpdate?.(updated);
                                                                    setInlineEdits(prev => { const n = { ...prev }; delete n[product.id]; return n; });
                                                                }}
                                                                className="w-20 bg-white border border-amber-200 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-amber-400 text-center"
                                                            />
                                                        ) : (
                                                            <div className="h-[30px] flex items-center">
                                                                <span className="text-[10px] text-slate-400 italic">откройте карточку</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Кнопка сохранить если есть изменения */}
                                                    {dirty && (
                                                        <button
                                                            onClick={() => saveInline(product)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all self-end"
                                                        >
                                                            <Check size={11} /> Сохранить
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Пагинация ── */}
            {totalPages > 1 && (
                <div className="flex-none p-3 border-t bg-white flex justify-between items-center text-[10px]">
                    <div className="text-slate-400 font-medium">
                        Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1} – {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} из <span className="font-bold text-slate-700">{totalItems}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronsLeft size={14} /></button>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={14} /></button>
                        <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-black min-w-[30px] text-center">{currentPage}</div>
                        <span className="text-slate-300 font-bold">/</span>
                        <div className="px-2 text-slate-500 font-bold">{totalPages}</div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={14} /></button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronsRight size={14} /></button>
                    </div>
                </div>
            )}

            {modalImage && (
                <ImageModal src={modalImage.src} alt={modalImage.alt} isOpen={!!modalImage} onClose={() => setModalImage(null)} />
            )}
        </div>
    );
};
