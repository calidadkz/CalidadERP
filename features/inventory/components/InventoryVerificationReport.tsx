
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Product, ProductCategory as Category, StockMovement, ProductType } from '@/types';
import { Printer, X, Layers, Box, Hash } from 'lucide-react';

interface EnrichedInventoryItem {
  product: Product;
  category: Category;
  inStock: boolean;
  actualQuantity: number;
}

interface ReportFilters {
  excludedCategories: string[];
  excludedMachineTypes: string[];
}

interface InventoryVerificationReportProps {
  products: Product[];
  categories: Category[];
  stockMovements: StockMovement[];
  onClose: () => void;
}

const InventoryVerificationReport: React.FC<InventoryVerificationReportProps> = (
  { products, categories, stockMovements, onClose }
) => {
  const [filters, setFilters] = useState<ReportFilters>({
    excludedCategories: [],
    excludedMachineTypes: [],
  });
  const [inventoryNumber, setInventoryNumber] = useState('');

  const machineCategories = useMemo(() => 
    categories.filter(c => c.type === ProductType.MACHINE),
    [categories]
  );

  const allAvailableMachineTypes = useMemo(() => {
    const types = new Set<string>();
    products.forEach(p => p.compatibleMachineCategoryIds?.forEach(typeId => {
        const cat = machineCategories.find(c => c.id === typeId);
        if(cat) types.add(cat.name);
    }));
    return Array.from(types).sort();
  }, [products, machineCategories]);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    stockMovements.forEach(m => {
        const current = map.get(m.productId) || 0;
        map.set(m.productId, current + (m.type === 'In' ? m.quantity : -m.quantity));
    });
    return map;
  }, [stockMovements]);

  const toggleCategoryFilter = (categoryName: string) => {
    setFilters(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(categoryName)
        ? prev.excludedCategories.filter(name => name !== categoryName)
        : [...prev.excludedCategories, categoryName],
    }));
  };

  const toggleMachineTypeFilter = (machineType: string) => {
    setFilters(prev => ({
      ...prev,
      excludedMachineTypes: prev.excludedMachineTypes.includes(machineType)
        ? prev.excludedMachineTypes.filter(name => name !== machineType)
        : [...prev.excludedMachineTypes, machineType],
    }));
  };

  const filteredData = useMemo(() => {
    const enrichedData: EnrichedInventoryItem[] = [];

    products.forEach(product => {
        if (product.type !== ProductType.PART) return;

        const quantity = stockMap.get(product.id) || 0;
        const category = categories.find(c => c.id === product.categoryId);
        
        if (category) {
            enrichedData.push({
                product,
                category,
                inStock: quantity > 0,
                actualQuantity: quantity,
            });
        }
    });

    return enrichedData.filter(item => {
      if (filters.excludedCategories.includes(item.category.name)) {
        return false;
      }

      const productMachineIds = item.product.compatibleMachineCategoryIds || [];
      if (productMachineIds.length > 0) {
        const productMachineNames = productMachineIds
            .map(id => machineCategories.find(c => c.id === id)?.name)
            .filter(Boolean) as string[];

        const allApplicableExcluded = productMachineNames.every(
          (typeName) => filters.excludedMachineTypes.includes(typeName)
        );
        if (allApplicableExcluded) {
          return false;
        }
      }
      return true;
    });
  }, [products, categories, stockMap, filters, machineCategories]);

  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (reportRef.current) {
      const printWindow = window.open('', '', 'height=800,width=1200');
      if (printWindow) {
        const today = new Date().toLocaleDateString();
        const invNum = inventoryNumber.trim() || '_______';
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="UTF-8">
              <title>Лист Сверки</title>
              <style>
                  body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 15mm; }
                  @page {
                      size: A4;
                      margin: 15mm;
                      @top-right {
                          content: "Дата: ${today} | Инвентаризация №${invNum}";
                          font-size: 9pt;
                      }
                      @bottom-center {
                          content: "Страница " counter(page) " из " counter(pages);
                          font-size: 8pt;
                      }
                  }
                  h1 { text-align: center; font-size: 16pt; margin-bottom: 8mm; text-transform: uppercase; letter-spacing: 1px; }
                  .section-title { background: #1e293b; color: white; padding: 8px 15px; margin-top: 10mm; font-size: 12pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
                  .category-header { background: #f1f5f9; padding: 5px 10px; border-left: 4px solid #64748b; margin-top: 6mm; margin-bottom: 3mm; font-size: 11pt; font-weight: 700; color: #334155; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
                  th { background: #f8fafc; text-align: left; padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 8pt; text-transform: uppercase; color: #64748b; }
                  td { padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 9pt; color: #1e293b; }
                  .col-name { width: 60%; }
                  .col-qty { width: 10%; text-align: center; font-weight: 700; }
                  .col-fact { width: 10%; text-align: center; }
                  .col-machines { width: 20%; font-size: 8pt; color: #64748b; }
                  @media print {
                      table { page-break-inside: auto; }
                      tr { page-break-inside: avoid; page-break-after: auto; }
                      thead { display: table-header-group; }
                  }
              </style>
          </head>
          <body>
              <h1>Лист Сверки Складских Остатков (Запчасти)</h1>
              ${reportRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  }, [inventoryNumber]);

  const reportStructure = useMemo(() => {
    const inStockData: Record<string, EnrichedInventoryItem[]> = {};
    const outOfStockData: Record<string, EnrichedInventoryItem[]> = {};

    filteredData.forEach(item => {
      const target = item.inStock ? inStockData : outOfStockData;
      if (!target[item.category.name]) {
        target[item.category.name] = [];
      }
      target[item.category.name].push(item);
    });

    const sortFn = (a: EnrichedInventoryItem, b: EnrichedInventoryItem) => a.product.name.localeCompare(b.product.name);
    Object.values(inStockData).forEach(list => list.sort(sortFn));
    Object.values(outOfStockData).forEach(list => list.sort(sortFn));

    return { 
      inStock: Object.entries(inStockData).sort(([a], [b]) => a.localeCompare(b)),
      outOfStock: Object.entries(outOfStockData).sort(([a], [b]) => a.localeCompare(b))
    };
  }, [filteredData]);

  const getMachineNames = (product: Product) => {
    return product.compatibleMachineCategoryIds?.map(id => machineCategories.find(c => c.id === id)?.name).filter(Boolean).join(', ') || '-';
  };

  return (
    <div className="flex flex-col h-full max-h-[92vh] w-full">
      <div className="flex justify-between items-center mb-6 px-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center">
              <Printer className="mr-3 text-blue-600" size={28} /> Лист Инвентаризации
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Настройка и формирование документа для печати</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"><X size={28} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-1 mb-6 bg-slate-100 p-1 rounded-2xl border border-slate-200">
        <div className="md:col-span-4 bg-white p-5 rounded-xl shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                <Hash size={14} className="text-blue-500" />
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Номер инвентаризации</label>
            </div>
            <input 
                type="text" 
                placeholder="Например: INV-2024-001"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                value={inventoryNumber}
                onChange={(e) => setInventoryNumber(e.target.value)}
            />
            <p className="mt-2 text-[9px] text-slate-400 font-bold uppercase italic">Будет отображен в заголовке каждой страницы</p>
        </div>

        <div className="md:col-span-4 bg-white p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Layers size={14} className="text-indigo-500" />
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Категории запчастей</label>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {categories.filter(c => c.type === ProductType.PART).map(cat => (
              <button
                key={cat.id}
                onClick={() => toggleCategoryFilter(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                  filters.excludedCategories.includes(cat.name)
                    ? 'bg-slate-50 border-slate-200 text-slate-300'
                    : 'bg-white border-indigo-200 text-indigo-600 shadow-sm'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-4 bg-white p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Box size={14} className="text-orange-500" />
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Применяемость (Станки)</label>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {allAvailableMachineTypes.map(type => (
              <button
                key={type}
                onClick={() => toggleMachineTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                  filters.excludedMachineTypes.includes(type)
                    ? 'bg-slate-50 border-slate-200 text-slate-300'
                    : 'bg-white border-orange-200 text-orange-600 shadow-sm'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 px-1">
        <button onClick={handlePrint} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20">
          <Printer size={20} /> Сформировать и распечатать
        </button>
      </div>

      <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
        <div ref={reportRef} className="bg-white border border-slate-200 rounded-xl p-10 shadow-sm min-h-full">
          {reportStructure.inStock.length > 0 && (
            <div className="mb-12">
              <div className="section-title">В НАЛИЧИИ НА СКЛАДЕ</div>
              {reportStructure.inStock.map(([catName, items]) => (
                <div key={catName} className="mb-6">
                  <div className="category-header">{catName}</div>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="col-name">Наименование</th>
                        <th className="col-qty">Учет</th>
                        <th className="col-fact">Факт</th>
                        <th className="col-machines">Применяемость</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.product.id}>
                          <td>{item.product.name}</td>
                          <td className="col-qty">{item.actualQuantity}</td>
                          <td></td>
                          <td className="col-machines">{getMachineNames(item.product)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {reportStructure.outOfStock.length > 0 && (
            <div className="mb-8">
              <div className="section-title" style={{ background: '#64748b' }}>ОТCУТСТВУЮТ (НОМЕНКЛАТУРА)</div>
              {reportStructure.outOfStock.map(([catName, items]) => (
                <div key={catName} className="mb-6">
                  <div className="category-header" style={{ borderLeftColor: '#cbd5e1' }}>{catName}</div>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="col-name">Наименование</th>
                        <th className="col-qty">Учет</th>
                        <th className="col-fact">Факт</th>
                        <th className="col-machines">Применяемость</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.product.id}>
                          <td className="text-slate-400 italic">{item.product.name}</td>
                          <td className="col-qty text-slate-300">0</td>
                          <td></td>
                          <td className="col-machines">{getMachineNames(item.product)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
          
          {filteredData.length === 0 && (
            <div className="py-20 text-center">
              <Box size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Нет данных для отображения с текущими фильтрами</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryVerificationReport;
