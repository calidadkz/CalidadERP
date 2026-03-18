
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../system/context/GlobalStore';
import { ProductType, Product, ProductCategory as Category } from '@/types';
import { LayoutList, FileText, Wallet, PackageSearch, TrendingUp, Download, Upload, Loader2, CheckCircle, AlertCircle, PlusCircle, Box, Zap, Search, Printer, FileDown } from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';

import { useInventoryData } from './hooks/useInventoryData';
import { useInventoryFilters } from './hooks/useInventoryFilters';
import { AdjustmentForm } from './components/AdjustmentForm';
import { StockTable } from './components/StockTable';
import { MovementsTable } from './components/MovementsTable';
import InventoryVerificationReport from './components/InventoryVerificationReport';

export const InventoryPage: React.FC = () => {
  const { state, actions } = useStore();
  const { products, stockMovements, exchangeRates, optionVariants, pricingProfiles, categories, optionTypes } = state;
  const access = useAccess('inventory');
  
  const canSeeStock = access.canSee('tabs', 'stock_view');
  const canSeeMovements = access.canSee('tabs', 'movements_view');

  const [viewMode, setViewMode] = useState<'stock' | 'movements'>(canSeeStock ? 'stock' : 'movements');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string }>({ show: false, msg: '', type: 'loading' });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showVerificationReport, setShowVerificationReport] = useState(false);

  // Hooks
  const { stockDataMap, getDetailedBreakdown, totals } = useInventoryData(products, stockMovements);
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

  const processedStockProducts = useMemo(() => {
      const data = products.filter(p => {
          const matchSearch = !deferredSearchTerm || (p.name || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) || (p.sku || '').toLowerCase().includes(deferredSearchTerm.toLowerCase());
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
          data.sort((a, b) => sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')) : 0);
      }
      return data;
  }, [products, deferredSearchTerm, sortConfig, activeType, machineFilter, categoryFilter]);

  const sortedMovements = useMemo(() => {
      return [...stockMovements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [stockMovements]);

  const f = (val: number) => Math.round(val).toLocaleString();

  const handleExportCSV = () => {
    const dataToExport = processedStockProducts;
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

  if (!state) return null;

  return (
    <div className="space-y-6">
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
        <div><h2 className="text-2xl font-bold text-slate-800 flex items-center"><PackageSearch className="mr-3 text-blue-600" size={28}/> Остатки и Движения</h2><p className="text-slate-500 text-sm font-medium mt-1">Контроль складских запасов и история перемещений</p></div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
             {canSeeStock && <button onClick={() => setViewMode('stock')} className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'stock' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><LayoutList size={14} className="mr-2"/> Остатки</button>}
             {canSeeMovements && <button onClick={() => setViewMode('movements')} className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'movements' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><FileText size={14} className="mr-2"/> Движения</button>}
        </div>
      </div>

      {viewMode === 'stock' && (
          <>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {access.canSee('fields', 'kpi_value') && <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-3"><div className="bg-white p-1.5 rounded-lg shadow-sm text-blue-600"><Wallet size={20}/></div><div><div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">ЦЕННОСТЬ СКЛАДА</div><div className="text-lg font-black text-blue-800">{f(totals.warehouseValue)} ₸</div></div></div>}
                    {access.canSee('fields', 'kpi_revenue') && <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3"><div className="bg-white p-1.5 rounded-lg shadow-sm text-emerald-600"><TrendingUp size={20}/></div><div><div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">ПОТЕНЦ. ВЫРУЧКА</div><div className="text-lg font-black text-emerald-800">{f(totals.potentialRevenue)} ₸</div></div></div>}
                    <div className="col-span-1 lg:col-span-2 flex justify-end items-center gap-2">
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
                            <button onClick={() => setIsAdjusting(true)} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap"><PlusCircle size={16} className="mr-2"/> Ввод</button>
                        )}
                    </div>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200 flex-none">
                        <button onClick={() => { setActiveType(ProductType.MACHINE); setMachineFilter('all'); setCategoryFilter('all'); }} className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.MACHINE ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Box size={14}/> Станки</button>
                        <button onClick={() => { setActiveType(ProductType.PART); setMachineFilter('all'); setCategoryFilter('all'); }} className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.PART ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Zap size={14}/> Запчасти</button>
                    </div>
                    {activeType === ProductType.PART && (
                        <div className="w-56">
                            <select className="w-full bg-white border border-slate-200 py-1.5 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" value={machineFilter} onChange={e => { setMachineFilter(e.target.value); setCategoryFilter('all'); }}>
                                <option value="all">Все оборудование</option>
                                {machineCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="w-56">
                        <select className="w-full bg-white border border-slate-200 py-1.5 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="all">Все категории</option>
                            {displayedCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {isAdjusting && (
                <AdjustmentForm 
                    onClose={() => setIsAdjusting(false)}
                    products={products}
                    stockMovements={stockMovements}
                    exchangeRates={exchangeRates}
                    optionVariants={optionVariants}
                    pricingProfiles={pricingProfiles}
                    categories={categories}
                    optionTypes={optionTypes}
                    actions={actions}
                />
            )}

            <StockTable 
                products={processedStockProducts} 
                getDetailedBreakdown={getDetailedBreakdown} 
                access={access} 
                handleSort={handleSort} 
            />
          </>
      )}

      {viewMode === 'movements' && (
          <MovementsTable 
            movements={sortedMovements} 
            access={access} 
            actions={actions} 
          />
      )}

      {showVerificationReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-8 relative animate-in zoom-in-95 duration-200 overflow-hidden">
            <InventoryVerificationReport 
              products={products}
              categories={categories}
              stockMovements={stockMovements}
              onClose={() => setShowVerificationReport(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
