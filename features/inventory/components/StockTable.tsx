
import React, { useState, useMemo } from 'react';
import { Product, ProductType } from '@/types';
import { ChevronDown, ChevronRight, Cpu, Settings } from 'lucide-react';
import { ImageModal } from '@/components/ui/ImageModal';

const PriceCell = React.memo(({ value, currency = "KZT", color = "text-slate-700", bg = "" }: { value: number, currency?: string, color?: string, bg?: string }) => {
  const f = (val: number) => Math.round(val).toLocaleString();
  return (
    <td className={`px-4 py-3 text-right ${bg}`}>
        <div className="flex flex-col items-end">
            <span className={`font-mono text-[11px] font-black leading-none ${color}`}>{f(value)}</span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">{currency}</span>
        </div>
    </td>
  );
});

const StockRow = React.memo(({ 
  product, 
  breakdown, 
  isExpanded, 
  onToggle, 
  access 
}: { 
  product: Product, 
  breakdown: any[], 
  isExpanded: boolean, 
  onToggle: () => void,
  access: any
}) => {
  const [isImgModalOpen, setIsImgModalOpen] = useState(false);
  const f = (val: number) => Math.round(val).toLocaleString();

  // Мемоизация агрегированных данных, чтобы не считать их при каждом рендере строки
  const stats = useMemo(() => {
    let s = 0, i = 0, r = 0, v = 0, sv = 0;
    for (let j = 0; j < breakdown.length; j++) {
        const b = breakdown[j];
        s += b.stock;
        i += b.incoming;
        r += b.reserved;
        v += b.totalValueKzt;
        sv += b.totalSalesValueKzt;
    }
    return {
        aggStock: s,
        aggIncoming: i,
        aggReserved: r,
        aggValue: v,
        aggSalesValue: sv,
        free: s + i - r
    };
  }, [breakdown]);

  const canExpand = product.type === ProductType.MACHINE || breakdown.length > 1;

  const handleImgClick = (e: React.MouseEvent) => {
      if (product.imageUrl) {
          e.stopPropagation();
          setIsImgModalOpen(true);
      }
  };

  return (
    <React.Fragment>
        <tr 
            className={`group transition-all hover:bg-slate-50/30 ${canExpand ? 'cursor-pointer' : 'cursor-default'}`} 
            onClick={() => canExpand && onToggle()}
        >
            <td className="text-center">
                {canExpand ? (isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : null}
            </td>
            <td className="px-6 py-3">
                <div className="flex items-center">
                    <div 
                        className={`w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden mr-3 shadow-sm shrink-0 transition-transform hover:scale-110 active:scale-95 ${product.imageUrl ? 'cursor-zoom-in' : ''}`}
                        onClick={handleImgClick}
                    >
                        {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.sku} className="w-full h-full object-contain" />
                        ) : (
                            product.type === ProductType.MACHINE ? <Cpu className="text-blue-500" size={14} /> : <Settings className="text-orange-500" size={14} />
                        )}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-700">{product.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono leading-tight">{product.sku}</div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-4 text-right font-mono font-bold text-xs">{f(stats.aggStock)}</td>
            <td className="px-4 py-4 text-right font-mono text-xs text-orange-600">{f(stats.aggIncoming)}</td>
            <td className="px-4 py-4 text-right font-mono text-xs text-red-500">{f(stats.aggReserved)}</td>
            <td className={`px-4 py-4 text-right font-mono font-black text-xs ${stats.free < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{f(stats.free)}</td>
            <PriceCell value={stats.aggStock > 0 ? stats.aggValue / stats.aggStock : 0} color="text-slate-500" bg="bg-blue-50/10" />
            <PriceCell value={stats.aggValue} color="text-blue-700" bg="bg-blue-100/10" />
            <PriceCell value={stats.aggStock > 0 ? stats.aggSalesValue / stats.aggStock : 0} color="text-emerald-600" bg="bg-emerald-50/10" />
            <PriceCell value={stats.aggSalesValue} color="text-emerald-800" bg="bg-emerald-100/10" />
        </tr>
        {isExpanded && canExpand && breakdown.map((conf, idx) => (
            <tr key={idx} className="bg-slate-50/30 border-b animate-in fade-in">
                <td className="py-2 text-center text-blue-300 text-[10px]">•</td>
                <td className="px-10 py-2">
                    <div className="flex flex-wrap gap-1">
                        {conf.optionsInfo.length === 0 ? <span className="text-[10px] font-bold text-slate-400 italic">Базовая</span> : conf.optionsInfo.map((opt: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-100">{opt}</span>
                        ))}
                    </div>
                </td>
                <td className="px-4 py-2 text-right font-mono text-[11px] font-bold">{f(conf.stock)}</td>
                <td className="px-4 py-2 text-right font-mono text-[11px] text-orange-400">{f(conf.incoming)}</td>
                <td className="px-4 py-2 text-right font-mono text-[11px] text-red-400">{f(conf.reserved)}</td>
                <td className="px-4 py-2 text-right font-mono text-[11px] font-black">{f(conf.stock + conf.incoming - conf.reserved)}</td>
                <PriceCell value={conf.stock > 0 ? conf.totalValueKzt / conf.stock : 0} color="text-slate-400" bg="bg-blue-50/5" />
                <PriceCell value={conf.totalValueKzt} color="text-blue-600" bg="bg-blue-100/5" />
                <PriceCell value={conf.stock > 0 ? conf.totalSalesValueKzt / conf.stock : 0} color="text-emerald-600" bg="bg-emerald-50/5" />
                <PriceCell value={conf.totalSalesValueKzt} color="text-emerald-800" bg="bg-emerald-100/5" />
            </tr>
        ))}
        {product.imageUrl && (
            <ImageModal 
                src={product.imageUrl} 
                alt={product.name} 
                isOpen={isImgModalOpen} 
                onClose={() => setIsImgModalOpen(false)} 
            />
        )}
    </React.Fragment>
  );
});

interface StockTableProps {
    products: Product[];
    getDetailedBreakdown: (productId: string) => any[];
    access: any;
    handleSort: (key: 'name') => void;
}

export const StockTable: React.FC<StockTableProps> = ({ products, getDetailedBreakdown, access, handleSort }) => {
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <tr>
                        <th className="w-10"></th>
                        {access.canSee('fields', 'col_model') && <th className="px-6 py-4 text-left cursor-pointer" onClick={() => handleSort('name')}>Модель / Запчасть</th>}
                        {access.canSee('fields', 'col_stock') && <th className="px-4 py-4 text-right w-16">Склад</th>}
                        {access.canSee('fields', 'col_incoming') && <th className="px-4 py-4 text-right w-16 text-orange-600">Путь</th>}
                        {access.canSee('fields', 'col_reserved') && <th className="px-4 py-4 text-right w-16 text-red-500">Резерв</th>}
                        {access.canSee('fields', 'col_free') && <th className="px-4 py-4 text-right w-16 text-blue-700">Свободно</th>}
                        {access.canSee('fields', 'col_cost') && <th className="px-4 py-4 text-right w-24 bg-blue-50/20">Себест. ед..</th>}
                        {access.canSee('fields', 'col_total_cost') && <th className="px-4 py-4 text-right bg-blue-100/20">Общая себест.</th>}
                        {access.canSee('fields', 'col_sales_price') && <th className="px-4 py-4 text-right w-24 bg-emerald-50/20 text-emerald-600">Цена Пр. ед.</th>}
                        {access.canSee('fields', 'col_revenue') && <th className="px-4 py-4 text-right w-28 bg-emerald-100/20 font-black text-emerald-800">Выручка</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {products.map(p => {
                        const breakdown = getDetailedBreakdown(p.id);
                        if (breakdown.length === 0) return null;

                        return (
                            <StockRow 
                                key={p.id}
                                product={p}
                                breakdown={breakdown}
                                isExpanded={expandedRowId === p.id}
                                onToggle={() => setExpandedRowId(expandedRowId === p.id ? null : p.id)}
                                access={access}
                            />
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};
