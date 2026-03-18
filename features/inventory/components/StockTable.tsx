
import React, { useState } from 'react';
import { Product, ProductType } from '@/types';
import { ChevronDown, ChevronRight, Cpu, Settings } from 'lucide-react';

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
  const f = (val: number) => Math.round(val).toLocaleString();
  const aggStock = breakdown.reduce((s, b) => s + b.stock, 0);
  const aggIncoming = breakdown.reduce((s, b) => s + b.incoming, 0);
  const aggReserved = breakdown.reduce((s, b) => s + b.reserved, 0);
  const aggValue = breakdown.reduce((s, b) => s + b.totalValueKZT, 0);
  const aggSalesValue = breakdown.reduce((s, b) => s + b.totalSalesValueKZT, 0);
  const free = aggStock + aggIncoming - aggReserved;
  const canExpand = product.type === ProductType.MACHINE || breakdown.length > 1;

  return (
    <React.Fragment>
        <tr 
            className={`group transition-all hover:bg-slate-50/30 ${canExpand ? 'cursor-pointer' : 'cursor-default'}`} 
            onClick={() => canExpand && onToggle()}
        >
            <td className="text-center">
                {canExpand ? (isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : null}
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center">
                    {product.type === ProductType.MACHINE ? <Cpu size={16} className="text-blue-500 mr-2"/> : <Settings size={16} className="text-orange-500 mr-2"/>}
                    <div>
                        <div className="text-xs font-bold text-slate-700">{product.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{product.sku}</div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-4 text-right font-mono font-bold text-xs">{f(aggStock)}</td>
            <td className="px-4 py-4 text-right font-mono text-xs text-orange-600">{f(aggIncoming)}</td>
            <td className="px-4 py-4 text-right font-mono text-xs text-red-500">{f(aggReserved)}</td>
            <td className={`px-4 py-4 text-right font-mono font-black text-xs ${free < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{f(free)}</td>
            <PriceCell value={aggStock > 0 ? aggValue / aggStock : 0} color="text-slate-500" bg="bg-blue-50/10" />
            <PriceCell value={aggValue} color="text-blue-700" bg="bg-blue-100/10" />
            <PriceCell value={aggStock > 0 ? aggSalesValue / aggStock : 0} color="text-emerald-600" bg="bg-emerald-50/10" />
            <PriceCell value={aggSalesValue} color="text-emerald-800" bg="bg-emerald-100/10" />
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
                <PriceCell value={conf.stock > 0 ? conf.totalValueKZT / conf.stock : 0} color="text-slate-400" bg="bg-blue-50/5" />
                <PriceCell value={conf.totalValueKZT} color="text-blue-600" bg="bg-blue-100/5" />
                <PriceCell value={conf.stock > 0 ? conf.totalSalesValueKZT / conf.stock : 0} color="text-emerald-600" bg="bg-emerald-50/5" />
                <PriceCell value={conf.totalSalesValueKZT} color="text-emerald-800" bg="bg-emerald-100/5" />
            </tr>
        ))}
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
                        {access.canSee('fields', 'col_cost') && <th className="px-4 py-4 text-right w-24 bg-blue-50/20">Себест. ед.</th>}
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
