
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    Box, ChevronDown, ChevronRight, Cpu, Download, FileDown,
    FileText, Filter, LayoutList, Loader2, PackageSearch, Printer,
    RefreshCw, RotateCcw, Search, Settings, TrendingUp, Upload,
    Wallet, X, Zap, PlusCircle, CheckCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';
import { Product, ProductType, StockMovement } from '@/types';
import { useInventoryData } from '../hooks/useInventoryData';
import { useInventoryFilters } from '../hooks/useInventoryFilters';
import { AdjustmentForm } from './AdjustmentForm';
import InventoryVerificationReport from './InventoryVerificationReport';

const MOVEMENTS_PAGE_SIZE = 50;
const INITIAL_PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const f = (v: number) => Math.round(v || 0).toLocaleString();

const movementStatusLabel = (s: string) =>
    s === 'Physical' ? 'Склад' : s === 'Incoming' ? 'В пути' : s === 'Reserved' ? 'Резерв' : s;

// ─── FilterSheet ──────────────────────────────────────────────────────────────

const FilterSheet: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    activeType: ProductType;
    machineFilter: string;
    categoryFilter: string;
    machineCategories: { id: string; name: string }[];
    displayedCategories: { id: string; name: string }[];
    onTypeChange: (t: ProductType) => void;
    onMachineChange: (id: string) => void;
    onCategoryChange: (id: string) => void;
    onReset: () => void;
}> = ({ isOpen, onClose, activeType, machineFilter, categoryFilter, machineCategories, displayedCategories, onTypeChange, onMachineChange, onCategoryChange, onReset }) => {
    if (!isOpen) return null;

    const activeFilters = [
        machineFilter !== 'all' ? 1 : 0,
        categoryFilter !== 'all' ? 1 : 0
    ].reduce((a, b) => a + b, 0);

    return (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end bg-slate-900/60">
            <div className="bg-white rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: '85dvh' }}>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-none">
                    <span className="text-base font-black text-slate-800 flex-1">Фильтры</span>
                    {activeFilters > 0 && (
                        <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-red-500 font-bold px-3 py-1.5 rounded-xl hover:bg-red-50">
                            <RotateCcw size={14} /> Сбросить
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 text-slate-400 rounded-xl"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* Тип товара */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Тип товара</label>
                        <div className="flex gap-2">
                            <button onClick={() => { onTypeChange(ProductType.MACHINE); onMachineChange('all'); onCategoryChange('all'); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-all ${activeType === ProductType.MACHINE ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                <Box size={15} /> Станки
                            </button>
                            <button onClick={() => { onTypeChange(ProductType.PART); onMachineChange('all'); onCategoryChange('all'); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-all ${activeType === ProductType.PART ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                <Zap size={15} /> Запчасти
                            </button>
                        </div>
                    </div>

                    {/* Фильтр по оборудованию (только для запчастей) */}
                    {activeType === ProductType.PART && machineCategories.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Оборудование</label>
                            <div className="space-y-1">
                                <button onClick={() => onMachineChange('all')}
                                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${machineFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    Всё оборудование
                                </button>
                                {machineCategories.map(c => (
                                    <button key={c.id} onClick={() => onMachineChange(c.id)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all truncate ${machineFilter === c.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Категория */}
                    {displayedCategories.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Категория</label>
                            <div className="space-y-1">
                                <button onClick={() => onCategoryChange('all')}
                                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${categoryFilter === 'all' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    Все категории
                                </button>
                                {displayedCategories.map(c => (
                                    <button key={c.id} onClick={() => onCategoryChange(c.id)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all truncate ${categoryFilter === c.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="h-2" />
                </div>
                <div className="flex-none px-5 pb-6 pt-3 border-t border-slate-100">
                    <button onClick={onClose} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest">
                        Применить
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── StockCard ────────────────────────────────────────────────────────────────

const StockCard: React.FC<{
    product: Product;
    breakdown: any[];
    access: any;
}> = ({ product, breakdown, access }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const stats = useMemo(() => {
        let s = 0, i = 0, r = 0, v = 0, sv = 0;
        for (const b of breakdown) { s += b.stock; i += b.incoming; r += b.reserved; v += b.totalValueKzt; sv += b.totalSalesValueKzt; }
        return { aggStock: s, aggIncoming: i, aggReserved: r, aggValue: v, aggSalesValue: sv, free: s + i - r };
    }, [breakdown]);

    const canExpand = product.type === ProductType.MACHINE || breakdown.length > 1;
    const isMachine = product.type === ProductType.MACHINE;

    const showCost = access.canSee('fields', 'col_unit_cost');
    const showValue = access.canSee('fields', 'col_total_value');
    const showSales = access.canSee('fields', 'col_sales_price');
    const showRevenue = access.canSee('fields', 'col_revenue');

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Строка товара */}
            <div
                className={`flex items-center gap-3 px-4 py-3.5 ${canExpand ? 'cursor-pointer active:bg-slate-50' : ''}`}
                onClick={() => canExpand && setIsExpanded(v => !v)}>

                {/* Изображение */}
                <div className={`w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden flex-none bg-slate-50 ${product.imageUrl ? '' : ''}`}>
                    {product.imageUrl
                        ? <img src={product.imageUrl} alt="" className="w-full h-full object-contain" />
                        : isMachine
                            ? <Cpu size={16} className="text-blue-400" />
                            : <Settings size={16} className="text-orange-400" />}
                </div>

                {/* Имя + SKU */}
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 leading-tight truncate">{product.name}</div>
                    <div className="text-xs font-mono text-slate-400 mt-0.5">{product.sku}</div>
                </div>

                {/* Свободный остаток (главная цифра) */}
                <div className="text-right flex-none">
                    <div className={`text-base font-black font-mono ${stats.free < 0 ? 'text-red-600' : stats.free === 0 ? 'text-slate-400' : 'text-emerald-700'}`}>
                        {f(stats.free)}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">свободно</div>
                </div>

                {canExpand && (
                    <div className="flex-none ml-1">
                        {isExpanded ? <ChevronDown size={16} className="text-slate-300" /> : <ChevronRight size={16} className="text-slate-300" />}
                    </div>
                )}
            </div>

            {/* Строка 4 метрик */}
            <div className="grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
                <div className="py-2 text-center">
                    <div className="text-xs font-black font-mono text-slate-700">{f(stats.aggStock)}</div>
                    <div className="text-[9px] text-slate-400 font-bold">Склад</div>
                </div>
                <div className="py-2 text-center">
                    <div className="text-xs font-black font-mono text-orange-500">{f(stats.aggIncoming)}</div>
                    <div className="text-[9px] text-slate-400 font-bold">В пути</div>
                </div>
                <div className="py-2 text-center">
                    <div className="text-xs font-black font-mono text-red-400">{f(stats.aggReserved)}</div>
                    <div className="text-[9px] text-slate-400 font-bold">Резерв</div>
                </div>
                {(showCost || showValue) ? (
                    <div className="py-2 text-center">
                        {showValue && (
                            <>
                                <div className="text-xs font-black font-mono text-blue-600">{f(stats.aggValue)}</div>
                                <div className="text-[9px] text-slate-400 font-bold">Стоим.</div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="py-2 text-center">
                        <div className="text-xs font-black font-mono text-emerald-600">{f(stats.aggSalesValue)}</div>
                        <div className="text-[9px] text-slate-400 font-bold">Выручка</div>
                    </div>
                )}
            </div>

            {/* Раскрытые конфигурации */}
            {isExpanded && canExpand && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                    {breakdown.map((conf, idx) => (
                        <div key={idx} className={`px-4 py-3 ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
                            {/* Опции конфигурации */}
                            <div className="flex flex-wrap gap-1 mb-2">
                                {conf.optionsInfo.length === 0
                                    ? <span className="text-xs text-slate-400 italic">Базовая</span>
                                    : conf.optionsInfo.map((opt: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">{opt}</span>
                                    ))}
                            </div>
                            {/* Метрики конфигурации */}
                            <div className="grid grid-cols-4 gap-2">
                                <div className="text-center">
                                    <div className="text-xs font-black font-mono text-slate-700">{f(conf.stock)}</div>
                                    <div className="text-[9px] text-slate-400">Склад</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-black font-mono text-orange-400">{f(conf.incoming)}</div>
                                    <div className="text-[9px] text-slate-400">В пути</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs font-black font-mono text-red-400">{f(conf.reserved)}</div>
                                    <div className="text-[9px] text-slate-400">Резерв</div>
                                </div>
                                <div className="text-center">
                                    <div className={`text-xs font-black font-mono ${(conf.stock + conf.incoming - conf.reserved) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {f(conf.stock + conf.incoming - conf.reserved)}
                                    </div>
                                    <div className="text-[9px] text-slate-400">Своб.</div>
                                </div>
                            </div>
                            {/* Цены конфигурации */}
                            {(showCost || showSales) && conf.stock > 0 && (
                                <div className="flex gap-4 mt-2 pt-2 border-t border-slate-100">
                                    {showCost && (
                                        <div>
                                            <div className="text-[9px] text-slate-400 font-bold">Себест. ед.</div>
                                            <div className="text-xs font-black font-mono text-slate-600">{f(conf.totalValueKzt / conf.stock)} ₸</div>
                                        </div>
                                    )}
                                    {showValue && (
                                        <div>
                                            <div className="text-[9px] text-slate-400 font-bold">Стоимость</div>
                                            <div className="text-xs font-black font-mono text-blue-600">{f(conf.totalValueKzt)} ₸</div>
                                        </div>
                                    )}
                                    {showSales && (
                                        <div>
                                            <div className="text-[9px] text-slate-400 font-bold">Цена пр.</div>
                                            <div className="text-xs font-black font-mono text-emerald-600">{f(conf.totalSalesValueKzt / conf.stock)} ₸</div>
                                        </div>
                                    )}
                                    {showRevenue && (
                                        <div>
                                            <div className="text-[9px] text-slate-400 font-bold">Выручка</div>
                                            <div className="text-xs font-black font-mono text-emerald-700">{f(conf.totalSalesValueKzt)} ₸</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── MovementCard ─────────────────────────────────────────────────────────────

const MovementCard: React.FC<{
    m: StockMovement;
    access: any;
    allMovements: StockMovement[];
    onRevert: (id: string) => void;
}> = ({ m, access, allMovements, onRevert }) => {
    const isIn = m.type === 'In';
    const canRevert = m.documentType === 'Adjustment' &&
        m.description?.startsWith('Ввод остатков') &&
        !allMovements.some(rev => rev.description?.includes(`(исходный док: ${m.id})`));

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 space-y-2">
            {/* Строка 1: тип + дата + кол-во */}
            <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase flex-none ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {isIn ? '↑ Приход' : '↓ Расход'}
                </span>
                <span className="text-xs text-slate-400 flex-1">{(m.date || '').split('T')[0]}</span>
                <span className={`text-base font-black font-mono ${isIn ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isIn ? '+' : '-'}{m.quantity}
                </span>
                {canRevert && (
                    <button onClick={() => onRevert(m.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Отменить">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Строка 2: товар */}
            <div>
                <div className="text-sm font-bold text-slate-800 leading-tight">{m.productName}</div>
                <div className="text-xs font-mono text-slate-400">{m.sku}</div>
            </div>

            {/* Строка 3: статус + документ + цены */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg uppercase">
                    {movementStatusLabel(m.statusType)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                    {m.documentType} #{m.documentId ? m.documentId.slice(-6) : '—'}
                </span>
                {access.canSee('fields', 'col_cost') && m.unitCostKzt > 0 && (
                    <span className="text-[10px] font-mono text-slate-500 ml-auto">
                        {f(m.unitCostKzt)} ₸/ед.
                    </span>
                )}
                {access.canSee('fields', 'col_sales_price') && (m.salesPriceKzt || 0) > 0 && (
                    <span className="text-[10px] font-mono text-emerald-500">
                        {f(m.salesPriceKzt || 0)} ₸ пр.
                    </span>
                )}
            </div>

            {/* Описание */}
            {m.description && (
                <div className="text-[10px] text-slate-400 italic">{m.description}</div>
            )}
        </div>
    );
};

// ─── MobileInventoryView ──────────────────────────────────────────────────────

interface Props {
    state: any;
    actions: any;
    access: any;
}

export const MobileInventoryView: React.FC<Props> = ({ state, actions, access }) => {
    const { products, inventorySummary, categories, exchangeRates, optionVariants, pricingProfiles, optionTypes } = state;

    const canSeeStock = access.canSee('tabs', 'stock_view');
    const canSeeMovements = access.canSee('tabs', 'movements_view');

    const [viewMode, setViewMode] = useState<'stock' | 'movements'>(canSeeStock ? 'stock' : 'movements');
    const [showFilterSheet, setShowFilterSheet] = useState(false);
    const [showAdjustSheet, setShowAdjustSheet] = useState(false);
    const [showVerificationReport, setShowVerificationReport] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const observerRef = useRef<HTMLDivElement>(null);
    const [importStatus, setImportStatus] = useState<{ show: boolean; msg: string; type: 'loading' | 'success' | 'error'; details?: string } | null>(null);

    // Movements
    const [localMovements, setLocalMovements] = useState<StockMovement[]>([]);
    const [isMovementsLoading, setIsMovementsLoading] = useState(false);
    const [hasMoreMovements, setHasMoreMovements] = useState(true);
    const [movementsOffset, setMovementsOffset] = useState(0);

    // Stock pagination
    const [displayLimit, setDisplayLimit] = useState(INITIAL_PAGE_SIZE);

    const { getDetailedBreakdown, totals } = useInventoryData(products, inventorySummary);
    const {
        searchTerm, setSearchTerm,
        sortConfig, handleSort,
        activeType, setActiveType,
        machineFilter, setMachineFilter,
        categoryFilter, setCategoryFilter,
        machineCategories, displayedCategories
    } = useInventoryFilters(products, categories);

    const deferredSearch = React.useDeferredValue(searchTerm);

    // Fetch movements
    const fetchMovements = useCallback(async (isInitial = false) => {
        if (viewMode !== 'movements') return;
        setIsMovementsLoading(true);
        const offset = isInitial ? 0 : movementsOffset;
        try {
            const { data, error } = await supabase
                .from(TableNames.STOCK_MOVEMENTS)
                .select('id, date, product_id, sku, product_name, type, quantity, unit_cost_kzt, status_type, document_type, document_id, description, configuration, sales_price_kzt')
                .order('date', { ascending: false })
                .range(offset, offset + MOVEMENTS_PAGE_SIZE - 1);
            if (error) throw error;
            const camel = ApiService.keysToCamel(data || []);
            if (isInitial) { setLocalMovements(camel); setMovementsOffset(MOVEMENTS_PAGE_SIZE); }
            else { setLocalMovements(prev => [...prev, ...camel]); setMovementsOffset(prev => prev + MOVEMENTS_PAGE_SIZE); }
            setHasMoreMovements(camel.length === MOVEMENTS_PAGE_SIZE);
        } catch (e) { console.error(e); }
        finally { setIsMovementsLoading(false); }
    }, [viewMode, movementsOffset]);

    useEffect(() => {
        if (viewMode === 'movements' && localMovements.length === 0) fetchMovements(true);
    }, [viewMode]);

    // Filtered products
    const allFiltered = useMemo(() => {
        const term = deferredSearch.toLowerCase();
        return products.filter(p => {
            if (p.type !== activeType) return false;
            if (term && !p.name?.toLowerCase().includes(term) && !p.sku?.toLowerCase().includes(term)) return false;
            if (activeType === ProductType.PART) {
                if (machineFilter !== 'all' && !(p.compatibleMachineCategoryIds || []).includes(machineFilter)) return false;
            }
            if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
            return true;
        });
    }, [products, deferredSearch, activeType, machineFilter, categoryFilter]);

    const displayedProducts = useMemo(() => allFiltered.slice(0, displayLimit), [allFiltered, displayLimit]);

    // Infinite scroll
    useEffect(() => {
        const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && viewMode === 'stock' && displayLimit < allFiltered.length) {
                setDisplayLimit(prev => prev + 50);
            }
        }, { threshold: 0.1 });
        if (observerRef.current) obs.observe(observerRef.current);
        return () => obs.disconnect();
    }, [displayLimit, allFiltered.length, viewMode]);

    useEffect(() => { setDisplayLimit(INITIAL_PAGE_SIZE); }, [deferredSearch, activeType, machineFilter, categoryFilter]);

    const activeFilterCount = [machineFilter !== 'all' ? 1 : 0, categoryFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0);

    const handleResetFilters = () => { setMachineFilter('all'); setCategoryFilter('all'); };

    // Export
    const handleExportCSV = () => {
        if (allFiltered.length === 0) return;
        const rows = allFiltered.map(p => {
            const breakdown = getDetailedBreakdown(p.id);
            const aggStock = breakdown.reduce((s, b) => s + b.stock, 0);
            return `"${p.sku}";"${p.name}";${aggStock}`;
        });
        const csv = '\uFEFF' + ['SKU;Наименование;Остаток на складе', ...rows].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `stock_balance_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        setShowExportMenu(false);
    };

    // Import
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportStatus({ show: true, msg: 'Импорт остатков...', type: 'loading' });
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) throw new Error('Файл пуст');
                const headers = lines[0].split(';').map(h => h.trim().replace(/^\uFEFF/, ''));
                const skuIdx = headers.findIndex(h => h === 'SKU');
                const qtyIdx = headers.findIndex(h => h === 'Остаток на складе');
                if (skuIdx === -1 || qtyIdx === -1) throw new Error("Не найдены колонки 'SKU' и 'Остаток на складе'");
                let added = 0, errors = 0;
                for (let i = 1; i < lines.length; i++) {
                    const vals = lines[i].split(';');
                    const sku = vals[skuIdx]?.trim().replace(/^"|"$/g, '');
                    const qty = parseFloat(vals[qtyIdx]?.trim().replace(/^"|"$/g, ''));
                    const prod = products.find(p => p.sku === sku);
                    if (prod && !isNaN(qty)) { try { await actions.adjustStock(prod.id, qty, 0, 'Массовый ввод остатков (импорт)'); added++; } catch { errors++; } }
                    else { errors++; }
                }
                actions.refreshInventorySummary();
                setImportStatus({ show: true, type: 'success', msg: 'Импорт завершён', details: `Добавлено: ${added}\nОшибок: ${errors}` });
            } catch (err: any) {
                setImportStatus({ show: true, type: 'error', msg: `Ошибка: ${err.message}` });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // ── Render ──

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />

            {/* FilterSheet */}
            <FilterSheet
                isOpen={showFilterSheet}
                onClose={() => setShowFilterSheet(false)}
                activeType={activeType}
                machineFilter={machineFilter}
                categoryFilter={categoryFilter}
                machineCategories={machineCategories}
                displayedCategories={displayedCategories}
                onTypeChange={setActiveType}
                onMachineChange={setMachineFilter}
                onCategoryChange={setCategoryFilter}
                onReset={handleResetFilters}
            />

            {/* AdjustmentForm overlay */}
            {showAdjustSheet && (
                <div className="fixed inset-0 z-[200] flex flex-col bg-white overflow-y-auto">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 flex-none sticky top-0 bg-white z-10">
                        <button onClick={() => setShowAdjustSheet(false)} className="p-2 text-slate-400 rounded-xl hover:bg-slate-100"><X size={20} /></button>
                        <span className="text-base font-black text-slate-800">Ввод остатков</span>
                    </div>
                    <div className="flex-1 p-4">
                        <AdjustmentForm
                            onClose={() => setShowAdjustSheet(false)}
                            products={products}
                            stockMovements={localMovements}
                            exchangeRates={exchangeRates || {}}
                            optionVariants={optionVariants || []}
                            pricingProfiles={pricingProfiles || []}
                            categories={categories || []}
                            optionTypes={optionTypes || []}
                            actions={actions}
                        />
                    </div>
                </div>
            )}

            {/* VerificationReport overlay */}
            {showVerificationReport && (
                <div className="fixed inset-0 z-[200] bg-white overflow-y-auto">
                    <div className="p-4">
                        <InventoryVerificationReport
                            products={products}
                            categories={categories}
                            stockMovements={localMovements}
                            onClose={() => setShowVerificationReport(false)}
                        />
                    </div>
                </div>
            )}

            {/* Import status modal */}
            {importStatus?.show && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 p-6">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" />
                            : importStatus.type === 'success' ? <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                                : <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />}
                        <h3 className="text-xl font-black text-slate-800 mb-2">{importStatus.msg}</h3>
                        {importStatus.details && <pre className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-xs text-slate-600 border whitespace-pre-wrap">{importStatus.details}</pre>}
                        {importStatus.type !== 'loading' && (
                            <button onClick={() => setImportStatus(null)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest">ОК</button>
                        )}
                    </div>
                </div>
            )}

            {/* Главный layout */}
            <div className="flex flex-col h-full bg-slate-100 overflow-hidden">

                {/* Tab bar */}
                <div className="flex-none flex bg-white border-b border-slate-200">
                    {canSeeStock && (
                        <button onClick={() => setViewMode('stock')}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-b-2 transition-all ${viewMode === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                            <LayoutList size={14} /> Остатки
                        </button>
                    )}
                    {canSeeMovements && (
                        <button onClick={() => setViewMode('movements')}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-b-2 transition-all ${viewMode === 'movements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
                            <FileText size={14} /> Движения
                        </button>
                    )}
                </div>

                {/* ── Вкладка Остатки ── */}
                {viewMode === 'stock' && (
                    <div className="flex flex-col flex-1 overflow-hidden">

                        {/* KPI (если есть права) */}
                        {(access.canSee('fields', 'kpi_value') || access.canSee('fields', 'kpi_revenue')) && (
                            <div className="flex-none overflow-x-auto px-3 pt-3 -mb-1">
                                <div className="flex gap-2 w-max pb-1">
                                    {access.canSee('fields', 'kpi_value') && (
                                        <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2.5 flex-none">
                                            <Wallet size={16} className="text-blue-500 flex-none" />
                                            <div>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Ценность склада</div>
                                                <div className="text-sm font-black text-blue-800 font-mono">{f(totals.warehouseValue)} ₸</div>
                                            </div>
                                        </div>
                                    )}
                                    {access.canSee('fields', 'kpi_revenue') && (
                                        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5 flex-none">
                                            <TrendingUp size={16} className="text-emerald-500 flex-none" />
                                            <div>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Потенц. выручка</div>
                                                <div className="text-sm font-black text-emerald-800 font-mono">{f(totals.potentialRevenue)} ₸</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Поиск + кнопки */}
                        <div className="flex-none px-3 pt-3 pb-2 flex gap-2 items-center">
                            <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
                                <Search size={15} className="text-slate-400 flex-none" />
                                <input type="text"
                                    className="flex-1 bg-transparent text-[15px] outline-none text-slate-800 placeholder:text-slate-400"
                                    placeholder="Поиск по названию / SKU..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)} />
                                {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-slate-400" /></button>}
                            </div>

                            {/* Фильтры */}
                            <button onClick={() => setShowFilterSheet(true)}
                                className={`relative p-2.5 rounded-xl border shadow-sm flex-none transition-all ${activeFilterCount > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
                                <Filter size={17} />
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{activeFilterCount}</span>
                                )}
                            </button>

                            {/* Экспорт / Импорт */}
                            <div className="relative">
                                <button onClick={() => setShowExportMenu(v => !v)}
                                    className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl shadow-sm flex-none">
                                    <Download size={17} />
                                </button>
                                {showExportMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-[150] overflow-hidden">
                                        <button onClick={handleExportCSV} className="flex items-center w-full px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50">
                                            <FileDown size={14} className="mr-3 text-slate-400" /> Экспорт CSV
                                        </button>
                                        <button onClick={() => { setShowVerificationReport(true); setShowExportMenu(false); }} className="flex items-center w-full px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-50">
                                            <Printer size={14} className="mr-3 text-blue-500" /> Лист сверки
                                        </button>
                                        <button onClick={() => { fileInputRef.current?.click(); setShowExportMenu(false); }} className="flex items-center w-full px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                            <Upload size={14} className="mr-3 text-orange-500" /> Импорт CSV
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Обновить */}
                            <button onClick={() => actions.refreshInventorySummary()}
                                className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl shadow-sm flex-none">
                                <RefreshCw size={17} />
                            </button>
                        </div>

                        {/* Тип: Станки / Запчасти */}
                        <div className="flex-none px-3 pb-2 flex gap-2">
                            <button
                                onClick={() => { setActiveType(ProductType.MACHINE); setMachineFilter('all'); setCategoryFilter('all'); }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${activeType === ProductType.MACHINE ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>
                                <Box size={14} /> Станки
                            </button>
                            <button
                                onClick={() => { setActiveType(ProductType.PART); setMachineFilter('all'); setCategoryFilter('all'); }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${activeType === ProductType.PART ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>
                                <Zap size={14} /> Запчасти
                            </button>
                            {activeFilterCount > 0 && (
                                <button onClick={handleResetFilters} className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
                                    <RotateCcw size={12} /> Сбросить
                                </button>
                            )}
                        </div>

                        {/* Счётчик */}
                        <div className="flex-none px-4 pb-1">
                            <span className="text-[10px] text-slate-400 font-bold">
                                {displayedProducts.length} из {allFiltered.length} позиций
                            </span>
                        </div>

                        {/* Список карточек */}
                        <div className="flex-1 overflow-y-auto px-3 pb-20 space-y-2">
                            {displayedProducts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <PackageSearch size={40} className="mb-3 text-slate-200" />
                                    <p className="text-sm font-bold">Товары не найдены</p>
                                </div>
                            ) : (
                                displayedProducts.map(p => (
                                    <StockCard
                                        key={p.id}
                                        product={p}
                                        breakdown={getDetailedBreakdown(p.id)}
                                        access={access}
                                    />
                                ))
                            )}
                            <div ref={observerRef} className="h-4" />
                            {allFiltered.length > displayLimit && (
                                <div className="flex justify-center py-4">
                                    <Loader2 size={20} className="text-slate-300 animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* FAB — ввод остатков */}
                        {access.canWrite('actions', 'adjust_btn') && (
                            <div className="absolute bottom-4 right-4 pointer-events-none">
                                <button
                                    onClick={() => setShowAdjustSheet(true)}
                                    className="pointer-events-auto flex items-center gap-2 bg-blue-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all">
                                    <PlusCircle size={18} /> Ввод
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Вкладка Движения ── */}
                {viewMode === 'movements' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Кнопка обновить */}
                        <div className="flex-none px-3 pt-3 pb-2 flex justify-end">
                            <button onClick={() => fetchMovements(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 shadow-sm">
                                <RefreshCw size={14} className={isMovementsLoading ? 'animate-spin' : ''} />
                                Обновить
                            </button>
                        </div>

                        {/* Список карточек движений */}
                        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">
                            {localMovements.length === 0 && !isMovementsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <FileText size={40} className="mb-3 text-slate-200" />
                                    <p className="text-sm font-bold">История движений пуста</p>
                                </div>
                            ) : (
                                localMovements.map(m => (
                                    <MovementCard
                                        key={m.id}
                                        m={m}
                                        access={access}
                                        allMovements={localMovements}
                                        onRevert={id => actions.revertInitialStockEntry(id)}
                                    />
                                ))
                            )}

                            {isMovementsLoading && (
                                <div className="flex justify-center py-6">
                                    <Loader2 size={24} className="text-slate-300 animate-spin" />
                                </div>
                            )}

                            {hasMoreMovements && !isMovementsLoading && localMovements.length > 0 && (
                                <div className="flex justify-center py-4">
                                    <button
                                        onClick={() => fetchMovements()}
                                        className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                                        <ChevronDown size={16} /> Загрузить ещё
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
