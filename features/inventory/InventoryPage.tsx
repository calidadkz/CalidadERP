
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../system/context/GlobalStore';
import { ProductType, ProductCategory as Category, StockMovement } from '@/types';
import { LayoutList, FileText, Wallet, PackageSearch, TrendingUp, Download, Upload, Loader2, CheckCircle, AlertCircle, PlusCircle, Box, Zap, Search, Printer, FileDown, RefreshCw, ChevronDown } from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';
import { ApiService } from '@/services/api';
import { supabase } from '@/services/supabaseClient';
import { TableNames } from '@/constants';
import { CalidadSelect, CalidadSelectOption } from '@/components/ui/CalidadSelect';

import { useInventoryData } from './hooks/useInventoryData';
import { useInventoryFilters } from './hooks/useInventoryFilters';
import { AdjustmentForm } from './components/AdjustmentForm';
import { StockTable } from './components/StockTable';
import { MovementsTable } from './components/MovementsTable';
import InventoryVerificationReport from './components/InventoryVerificationReport';
import { MobileInventoryView } from './components/MobileInventoryView';
import { useIsMobile } from '@/hooks/useIsMobile';

const INITIAL_PAGE_SIZE = 50;
const MOVEMENTS_PAGE_SIZE = 50;

export const InventoryPage: React.FC = () => {
  const { state, actions } = useStore();
  const {
    products, inventorySummary, categories,
    exchangeRates, optionVariants, pricingProfiles, optionTypes
  } = state;
  const access = useAccess('inventory');
  const isMobile = useIsMobile();
  
  const canSeeStock = access.canSee('tabs', 'stock_view');
  const canSeeMovements = access.canSee('tabs', 'movements_view');

  const [viewMode, setViewMode] = useState<'stock' | 'movements'>(canSeeStock ? 'stock' : 'movements');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string }>({ show: false, msg: '', type: 'loading' });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showVerificationReport, setShowVerificationReport] = useState(false);

  // Pagination and local movements state
  const [localMovements, setLocalMovements] = useState<StockMovement[]>([]);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);
  const [hasMoreMovements, setHasMoreMovements] = useState(true);
  const [movementsOffset, setMovementsOffset] = useState(0);
  
  const [displayLimit, setDisplayLimit] = useState(INITIAL_PAGE_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Helper for formatting
  const f = (val: number) => Math.round(val || 0).toLocaleString();

  // Hooks
  const { getDetailedBreakdown, totals } = useInventoryData(products, inventorySummary);
  const { 
    searchTerm, setSearchTerm, 
    sortConfig, handleSort, 
    activeType, setActiveType, 
    machineFilter, setMachineFilter, 
    categoryFilter, setCategoryFilter,
    machineCategories,
    displayedCategories 
  } = useInventoryFilters(products, categories);

  const deferredSearchTerm = React.useDeferredValue(searchTerm);

  // Загрузка движений (с пагинацией)
  const fetchMovements = useCallback(async (isInitial = false) => {
    if (viewMode !== 'movements') return;
    
    setIsMovementsLoading(true);
    const currentOffset = isInitial ? 0 : movementsOffset;
    
    try {
      const { data, error } = await supabase
        .from(TableNames.STOCK_MOVEMENTS)
        .select(`
          id, date, product_id, sku, product_name, type, quantity, 
          unit_cost_kzt, status_type, document_type, document_id, 
          description, configuration, sales_price_kzt
        `)
        .order('date', { ascending: false })
        .range(currentOffset, currentOffset + MOVEMENTS_PAGE_SIZE - 1);
      
      if (error) throw error;
      
      const camelData = ApiService.keysToCamel(data || []);
      
      if (isInitial) {
        setLocalMovements(camelData);
        setMovementsOffset(MOVEMENTS_PAGE_SIZE);
      } else {
        setLocalMovements(prev => [...prev, ...camelData]);
        setMovementsOffset(prev => prev + MOVEMENTS_PAGE_SIZE);
      }
      
      setHasMoreMovements(camelData.length === MOVEMENTS_PAGE_SIZE);
    } catch (e) {
      console.error("Failed to fetch movements", e);
    } finally {
      setIsMovementsLoading(false);
    }
  }, [viewMode, movementsOffset]);

  // Загружаем первую порцию при переключении на вкладку
  useEffect(() => {
    if (viewMode === 'movements' && localMovements.length === 0) {
      fetchMovements(true);
    }
  }, [viewMode, fetchMovements, localMovements.length]);

  const handleRefreshMovements = () => {
    fetchMovements(true);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayLimit(INITIAL_PAGE_SIZE);
  }, [deferredSearchTerm, activeType, machineFilter, categoryFilter, sortConfig]);

  const allFilteredProducts = useMemo(() => {
      const term = deferredSearchTerm.toLowerCase();
      const data = products.filter(p => {
          const matchSearch = !term || (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
          if (!matchSearch) return false;

          const matchType = p.type === activeType;
          if (!matchType) return false;

          if (activeType === ProductType.PART) {
              const matchMachine = machineFilter === 'all' || (p.compatibleMachineCategoryIds || []).includes(machineFilter);
              if (!matchMachine) return false;
          }

          const matchCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
          if (!matchCategory) return false;

          return true;
      });

      if (sortConfig) {
          if (sortConfig.key === 'name') {
              data.sort((a, b) => sortConfig.direction === 'asc'
                  ? (a.name || '').localeCompare(b.name || '', 'ru')
                  : (b.name || '').localeCompare(a.name || '', 'ru'));
          } else {
              const getNumericKey = (breakdown: any[]): Record<string, number> => {
                  let s = 0, v = 0, sv = 0;
                  for (const b of breakdown) { s += b.stock; v += b.totalValueKzt; sv += b.totalSalesValueKzt; }
                  return { totalCost: v, unitCost: s > 0 ? v / s : 0, salesPrice: s > 0 ? sv / s : 0, revenue: sv };
              };
              data.sort((a, b) => {
                  const aStats = getNumericKey(getDetailedBreakdown(a.id));
                  const bStats = getNumericKey(getDetailedBreakdown(b.id));
                  const aVal = aStats[sortConfig.key] ?? 0;
                  const bVal = bStats[sortConfig.key] ?? 0;
                  return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
              });
          }
      }
      return data;
  }, [products, deferredSearchTerm, sortConfig, activeType, machineFilter, categoryFilter]);

  // Lazy sliced products
  const processedStockProducts = useMemo(() => {
      return allFilteredProducts.slice(0, displayLimit);
  }, [allFilteredProducts, displayLimit]);

  // Infinite scroll observer for PRODUCTS
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && viewMode === 'stock' && displayLimit < allFilteredProducts.length) {
          setDisplayLimit(prev => prev + 50);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [displayLimit, allFilteredProducts.length, viewMode]);

  const handleExportCSV = () => {
    const dataToExport = allFilteredProducts;
    if (dataToExport.length === 0) {
        alert("Нет данных для экспорта с текущими фильтрами");
        return;
    }

    const headers = ['SKU', 'Наименование', 'Остаток на складе'];
    const escapeCsv = (cell: any) => {
        if (cell === null || cell === undefined) return '""';
        const str = String(cell);
        return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = dataToExport.map(p => {
        const breakdown = getDetailedBreakdown(p.id);
        const aggStock = breakdown.reduce((s, b) => s + b.stock, 0);
        return [escapeCsv(p.sku), escapeCsv(p.name), aggStock].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock_balance_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    actions.addLog('Export', 'Система', 'Stock', `Экспорт остатков (${dataToExport.length} шт.)`);
    setShowExportOptions(false);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({ show: true, msg: 'Импорт остатков...', type: 'loading' });
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 2) throw new Error("Файл пуст");

            const headers = lines[0].split(';').map(h => h.trim().replace(/^\uFEFF/, ''));
            const skuIndex = headers.findIndex(h => h === 'SKU');
            const qtyIndex = headers.findIndex(h => h === 'Остаток на складе');

            if (skuIndex === -1 || qtyIndex === -1) {
                throw new Error("Не найдены обязательные колонки 'SKU' и 'Остаток на складе'");
            }

            let added = 0;
            let errors = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(';');
                const sku = values[skuIndex]?.trim().replace(/^"|"$/g, '');
                const qty = parseFloat(values[qtyIndex]?.trim().replace(/^"|"$/g, ''));

                const product = products.find(p => p.sku === sku);

                if (product && !isNaN(qty)) {
                    try {
                        await actions.adjustStock(product.id, qty, 0, 'Массовый ввод остатков (импорт)');
                        added++;
                    } catch (err) {
                        console.error(`Error adjusting stock for ${sku}:`, err);
                        errors++;
                    }
                } else {
                    errors++;
                }
            }
            actions.refreshInventorySummary(); 
            setImportStatus({ 
                show: true, 
                type: 'success', 
                msg: 'Импорт завершен', 
                details: `Добавлено: ${added}\nОшибок: ${errors}`
            });
        } catch (err: any) {
            setImportStatus({ show: true, msg: `Ошибка: ${err.message}`, type: 'error' });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  if (isMobile) {
    return (
      <div className="h-full relative">
        <MobileInventoryView state={state} actions={actions} access={access} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
        {importStatus.show && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
                    {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" /> : importStatus.type === 'success' ? <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" /> : <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />}
                    <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                    {importStatus.details && <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-xs whitespace-pre-wrap text-slate-600 border">{importStatus.details}</div>}
                    {importStatus.type !== 'loading' && <button onClick={() => setImportStatus({ show: false, msg: '', type: 'loading' })} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest">ОК</button>}
                </div>
            </div>
        )}

      <div className="flex justify-between items-center">
        <div><h2 className="text-xl xl:text-2xl font-bold text-slate-800 flex items-center"><PackageSearch className="mr-2.5 text-blue-600" size={24}/> Остатки и Движения</h2><p className="text-slate-500 text-xs xl:text-sm font-medium mt-0.5">Контроль складских запасов и история перемещений</p></div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
             {canSeeStock && <button onClick={() => setViewMode('stock')} className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'stock' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><LayoutList size={14} className="mr-2"/> Остатки</button>}
             {canSeeMovements && <button onClick={() => setViewMode('movements')} className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'movements' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><FileText size={14} className="mr-2"/> Движения</button>}
        </div>
      </div>

      {viewMode === 'stock' && (
          <>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                    {access.canSee('fields', 'kpi_value') && <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3"><div className="bg-white p-1.5 rounded-lg shadow-sm text-blue-600"><Wallet size={20}/></div><div><div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">ЦЕННОСТЬ СКЛАДА</div><div className="text-lg font-black text-blue-800">{f(totals.warehouseValue)} ₸</div></div></div>}
                    {access.canSee('fields', 'kpi_revenue') && <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3"><div className="bg-white p-1.5 rounded-lg shadow-sm text-emerald-600"><TrendingUp size={20}/></div><div><div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">ПОТЕНЦ. ВЫРУЧКА</div><div className="text-lg font-black text-emerald-800">{f(totals.potentialRevenue)} ₸</div></div></div>}
                    <div className="flex-1 flex justify-end items-center gap-2 min-w-[200px]">
                        <div className="relative">
                            <button 
                                onClick={() => setShowExportOptions(!showExportOptions)} 
                                className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm"
                            >
                                <Download size={16}/>
                            </button>
                            {showExportOptions && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={handleExportCSV} className="flex items-center w-full px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors border-b border-slate-50"><FileDown size={14} className="mr-3 text-slate-400"/> Экспорт в CSV</button>
                                    <button onClick={() => { setShowVerificationReport(true); setShowExportOptions(false); }} className="flex items-center w-full px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"><Printer size={14} className="mr-3 text-blue-500"/> Лист сверки</button>
                                </div>
                            )}
                        </div>
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-orange-600 rounded-xl shadow-sm"><Upload size={16}/></button>
                        <div className="relative w-full max-w-xs"><Search size={16} className="absolute left-3 top-[9px] text-slate-400" /><input type="text" className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" placeholder="Поиск по названию/SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
                        {!isAdjusting && access.canWrite('actions', 'adjust_btn') && (
                            <button onClick={() => setIsAdjusting(true)} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow font-black uppercase text-[11px] tracking-widest transition-all whitespace-nowrap"><PlusCircle size={16} className="mr-2"/> Ввод</button>
                        )}
                    </div>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200 flex-none">
                        <button onClick={() => { setActiveType(ProductType.MACHINE); setMachineFilter('all'); setCategoryFilter('all'); }} className={`flex items-center gap-2 px-3 xl:px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.MACHINE ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Box size={14}/> Станки</button>
                        <button onClick={() => { setActiveType(ProductType.PART); setMachineFilter('all'); setCategoryFilter('all'); }} className={`flex items-center gap-2 px-3 xl:px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.PART ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Zap size={14}/> Запчасти</button>
                    </div>
                    {activeType === ProductType.PART && (
                        <CalidadSelect
                            options={machineCategories.map(c => ({ id: c.id, label: c.name }))}
                            value={machineFilter === 'all' ? '' : machineFilter}
                            onChange={v => { setMachineFilter(v || 'all'); setCategoryFilter('all'); }}
                            nullLabel="Все оборудование"
                            className="w-52"
                        />
                    )}
                    <CalidadSelect
                        options={displayedCategories.map(c => ({ id: c.id, label: c.name }))}
                        value={categoryFilter === 'all' ? '' : categoryFilter}
                        onChange={v => setCategoryFilter(v || 'all')}
                        nullLabel="Все категории"
                        className="w-52"
                    />
                    <button onClick={() => actions.refreshInventorySummary()} className="p-2 text-slate-400 hover:text-blue-600"><RefreshCw size={16}/></button>
                </div>
            </div>

            {isAdjusting && (
                <AdjustmentForm 
                    onClose={() => setIsAdjusting(false)}
                    products={products}
                    stockMovements={localMovements}
                    exchangeRates={exchangeRates || {}}
                    optionVariants={optionVariants || []}
                    pricingProfiles={pricingProfiles || []}
                    categories={categories || []}
                    optionTypes={optionTypes || []}
                    actions={actions}
                />
            )}

            <StockTable
                products={processedStockProducts}
                getDetailedBreakdown={getDetailedBreakdown}
                access={access}
                handleSort={handleSort}
                sortConfig={sortConfig}
            />
            
            {allFilteredProducts.length > displayLimit && (
              <div ref={observerTarget} className="py-8 flex justify-center">
                <Loader2 size={24} className="text-slate-300 animate-spin" />
              </div>
            )}
            
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-4">
              Показано {processedStockProducts.length} из {allFilteredProducts.length}
            </div>
          </>
      )}

      {viewMode === 'movements' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={handleRefreshMovements}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                <RefreshCw size={14} className={`mr-2 ${isMovementsLoading ? 'animate-spin' : ''}`} />
                Обновить историю
              </button>
            </div>

            <MovementsTable 
              movements={localMovements} 
              access={access} 
              actions={actions} 
            />

            {hasMoreMovements && (
              <div className="flex justify-center py-6">
                <button 
                  onClick={() => fetchMovements()}
                  disabled={isMovementsLoading}
                  className="flex items-center px-8 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-50 shadow-lg"
                >
                  {isMovementsLoading ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <ChevronDown size={16} className="mr-2" />
                  )}
                  Загрузить еще
                </button>
              </div>
            )}
          </div>
      )}

      {showVerificationReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-8 relative animate-in zoom-in-95 duration-200 overflow-hidden">
            <InventoryVerificationReport 
              products={products}
              categories={categories}
              stockMovements={localMovements}
              onClose={() => setShowVerificationReport(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
