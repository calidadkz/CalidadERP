
import React, { useState, useMemo, useEffect } from 'react';
import { Product, ProductCategory } from '@/types/product';
import { ProductType } from '@/types/enums';
import { Counterparty as Supplier } from '@/types/counterparty';
import { Search, Cpu, Settings, Briefcase, Pencil, Trash2, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';

interface NomenclatureTableProps {
    products: Product[];
    suppliers: Supplier[];
    categories: ProductCategory[];
    onEdit: (p: Product) => void;
    onCopy: (p: Product) => void;
    onDelete: (id: string, name: string) => void;
    onFilteredDataChange?: (products: Product[]) => void;
}

type SortConfig = { key: keyof Product; direction: 'asc' | 'desc' } | null;

const ITEMS_PER_PAGE = 50;

export const NomenclatureTable: React.FC<NomenclatureTableProps> = ({ 
    products = [], 
    suppliers = [], 
    categories = [], 
    onEdit, 
    onCopy, 
    onDelete, 
    onFilteredDataChange 
}) => {
    const access = useAccess('nomenclature');
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [filters, setFilters] = useState<Record<string, string>>({
        name_sku: '',
        categoryId: '',
        supplier_mfg: ''
    });
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);

    const handleSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const processedProducts = useMemo(() => {
        let data = [...products];
        
        // Применение фильтров
        if (filters.name_sku || filters.categoryId || filters.supplier_mfg) {
            data = data.filter(item => {
                const searchLower = (filters.name_sku || '').toLowerCase();
                const matchSearch = !filters.name_sku || 
                    (item.name || '').toLowerCase().includes(searchLower) || 
                    (item.sku || '').toLowerCase().includes(searchLower);
                
                const matchCategory = !filters.categoryId || (categories.find(c => c.id === item.categoryId)?.name || '').toLowerCase().includes((filters.categoryId || '').toLowerCase());
                
                const searchSupMfg = (filters.supplier_mfg || '').toLowerCase();
                const matchSupMfg = !filters.supplier_mfg || 
                    (suppliers.find(s => s.id === item.supplierId)?.name || '').toLowerCase().includes(searchSupMfg) ||
                    (item.manufacturer || '').toLowerCase().includes(searchSupMfg);
                
                return matchSearch && matchCategory && matchSupMfg;
            });
        }

        // Применение сортировки
        if (sortConfig) {
            data.sort((a, b) => {
                const aValue = (a as any)[sortConfig.key] ?? 0;
                const bValue = (b as any)[sortConfig.key] ?? 0;
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [products, filters, sortConfig, categories, suppliers]);

    // Pagination Logic
    const totalItems = processedProducts.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedProducts.slice(start, start + ITEMS_PER_PAGE);
    }, [processedProducts, currentPage]);


    // Уведомляем родителя об изменении видимого списка (полного списка после фильтров, для экспорта)
    useEffect(() => {
        if (onFilteredDataChange) {
            onFilteredDataChange(processedProducts);
        }
    }, [processedProducts, onFilteredDataChange]);

    const canSeePurchase = access.canSee('fields', 'basePrice');
    const canWrite = access.canWrite('actions', 'edit');

    const renderSortIcon = (key: keyof Product) => {
        if (sortConfig?.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="ml-0.5 inline" /> : <ChevronDown size={12} className="ml-0.5 inline" />;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <table className="min-w-full divide-y divide-gray-200 table-fixed border-separate border-spacing-0">
                    <thead className="relative z-10">
                        <tr className="text-slate-500">
                            <th onClick={() => handleSort('type')} className="sticky top-0 bg-gray-50 w-8 px-1 py-3 text-center text-[9px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
                                {renderSortIcon('type') || 'Тип'}
                            </th>
                            <th onClick={() => handleSort('name')} className="sticky top-0 bg-gray-50 w-[45%] px-2 py-3 text-left text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors border-b">
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
                        <tr className="bg-white/95 backdrop-blur-sm shadow-sm sticky top-[37px] z-10">
                            <th className="px-1 py-1.5 border-b"></th>
                            <th className="px-2 py-1.5 border-b">
                                <div className="relative">
                                    <Search size={10} className="absolute left-2 top-2.5 text-gray-400" />
                                    <input 
                                        className="w-full min-w-0 pl-6 pr-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold" 
                                        placeholder="Поиск..." 
                                        value={filters.name_sku}
                                        onChange={(e) => {
                                            setFilters(prev => ({...prev, name_sku: e.target.value}));
                                            setCurrentPage(1);
                                        }}
                                    />
                                </div>
                            </th>
                            <th className="px-1.5 py-1.5 border-b">
                                <input 
                                    className="w-full min-w-0 px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold" 
                                    placeholder="Категория..." 
                                    value={filters.categoryId}
                                    onChange={(e) => {
                                        setFilters(prev => ({...prev, categoryId: e.target.value}));
                                        setCurrentPage(1);
                                    }}
                                />
                            </th>
                            <th className="px-1.5 py-1.5 border-b">
                                <input 
                                    className="w-full min-w-0 px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500/10 font-bold" 
                                    placeholder="Поставщик / Произв..." 
                                    value={filters.supplier_mfg}
                                    onChange={(e) => {
                                        setFilters(prev => ({...prev, supplier_mfg: e.target.value}));
                                        setCurrentPage(1);
                                    }}
                                />
                            </th>
                            {canSeePurchase && <th className="px-1.5 py-1.5 border-b"></th>}
                            <th className="px-1.5 py-1.5 border-b bg-green-50/20"></th>
                            <th className="px-1.5 py-1.5 border-b"></th>
                            <th className="px-1.5 py-1.5 border-b"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                        {processedProducts.length === 0 ? (
                            <tr><td colSpan={9} className="p-12 text-center text-slate-400 italic">Ничего не найдено</td></tr>
                        ) : paginatedProducts.map((product) => {
                            const supplier = suppliers.find(s => s.id === product.supplierId);
                            const category = categories.find(c => c.id === product.categoryId);
                            return (
                                <tr key={product.id} className="hover:bg-slate-50/50 group transition-all">
                                    <td className="px-1 py-3 text-center">
                                        {product.type === ProductType.MACHINE ? <Cpu className="text-blue-500 mx-auto" size={14} /> : product.type === ProductType.PART ? <Settings className="text-orange-500 mx-auto" size={14} /> : <Briefcase className="text-purple-500 mx-auto" size={14}/>}
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col gap-1 overflow-hidden">
                                            <div 
                                                className="text-[13px] font-bold text-slate-700 cursor-pointer hover:text-blue-600 transition-colors whitespace-normal break-words leading-snug" 
                                                onClick={() => onEdit(product)}
                                            >
                                                {product.name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-1.5 py-3">
                                        <div className="text-slate-500 font-medium whitespace-normal leading-tight text-[10px]" title={category?.name}>
                                            {category?.name || '—'}
                                        </div>
                                    </td>
                                    <td className="px-1.5 py-3">
                                        <div className="flex flex-col gap-0.5 overflow-hidden">
                                            <div className="text-slate-700 font-bold truncate text-[10px]" title={`Поставщик: ${supplier?.name || '—'}`}>
                                                {supplier?.name || '—'}
                                            </div>
                                            <div className="text-slate-400 font-medium truncate text-[9px]" title={`Производитель: ${product.manufacturer || '—'}`}>
                                                {product.manufacturer || '—'}
                                            </div>
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
                                    </td>
                                    <td className="px-1.5 py-3 text-right font-mono">
                                        <div className="font-black text-slate-600 text-xs">
                                            {(product.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0).toFixed(3)} <span className="text-[9px] font-bold text-slate-300">m³</span>
                                        </div>
                                    </td>
                                    <td className="px-1.5 py-3 text-center font-mono">
                                        <div className="font-black text-slate-600 text-xs">
                                            {product.packages?.length || 0}
                                        </div>
                                    </td>
                                    <td className="px-1 py-3 text-center">
                                        <div className="flex justify-center gap-0.5">
                                            <button onClick={() => onEdit(product)} className={`p-1 rounded-md transition-all ${canWrite ? 'text-slate-300 hover:text-blue-600 hover:bg-blue-50' : 'text-blue-500 bg-blue-50 hover:bg-blue-100'}`} title={canWrite ? "Редактировать" : "Просмотреть"}>
                                                {canWrite ? <Pencil size={12}/> : <Eye size={12}/>}
                                            </button>
                                            {canWrite && (
                                                <button onClick={() => onCopy(product)} className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all" title="Копировать">
                                                    <Copy size={12}/>
                                                </button>
                                            )}
                                            {access.canWrite('actions', 'delete') && (
                                                <button onClick={() => onDelete(product.id, product.name)} className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-all" title="В корзину"><Trash2 size={12}/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="flex-none p-3 border-t bg-white flex justify-between items-center text-[10px]">
                    <div className="text-slate-400 font-medium">
                        Показано {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} из <span className="font-bold text-slate-700">{totalItems}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(1)} 
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                        >
                            <ChevronsLeft size={14}/>
                        </button>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                        >
                            <ChevronLeft size={14}/>
                        </button>
                        
                        <div className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-black min-w-[30px] text-center">
                            {currentPage}
                        </div>
                        <span className="text-slate-300 font-bold">/</span>
                        <div className="px-2 text-slate-500 font-bold">
                            {totalPages}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                        >
                            <ChevronRight size={14}/>
                        </button>
                        <button 
                            onClick={() => setCurrentPage(totalPages)} 
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
                        >
                            <ChevronsRight size={14}/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
