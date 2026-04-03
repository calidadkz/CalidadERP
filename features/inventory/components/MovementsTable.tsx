
import React from 'react';
import { StockMovement } from '@/types';
import { X } from 'lucide-react';

interface MovementsTableProps {
    movements: StockMovement[];
    access: any;
    actions: any;
}

export const MovementsTable: React.FC<MovementsTableProps> = ({ movements, access, actions }) => {
    const f = (val: number) => Math.round(val).toLocaleString();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <tr>
                        <th className="px-6 py-4 text-left">Дата</th>
                        <th className="px-6 py-4 text-left">Товар</th>
                        <th className="px-6 py-4 text-left">Тип / Статус</th>
                        <th className="px-6 py-4 text-right">Кол-во</th>
                        {access.canSee('fields', 'col_cost') && <th className="px-6 py-4 text-right">Себест. ед.</th>}
                        {access.canSee('fields', 'col_sales_price') && <th className="px-6 py-4 text-right text-emerald-600">Цена Пр. ед.</th>}
                        <th className="px-6 py-4 text-left">Документ</th>
                        <th className="px-6 py-4 text-right"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {movements.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/30">
                            <td className="px-6 py-4 text-xs text-slate-500">{(m.date || '').split('T')[0]}</td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-medium">{m.productName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{m.sku}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit ${m.type === 'In' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                        {m.type === 'In' ? 'Приход' : 'Расход'}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">
                                        {m.statusType === 'Physical' ? 'Склад' : 
                                         m.statusType === 'Incoming' ? 'Путь' : 
                                         m.statusType === 'Reserved' ? 'Резерв' : m.statusType}
                                    </span>
                                </div>
                            </td>
                            <td className={`px-6 py-4 text-right font-mono font-bold text-sm ${m.type === 'In' ? 'text-emerald-700' : 'text-red-700'}`}>
                                {m.type === 'In' ? '+' : '-'}{m.quantity}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-black">{f(m.unitCostKzt)}</td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-black text-emerald-600">{f(m.salesPriceKzt || 0)}</td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-slate-500 font-bold">{m.documentType} #{m.documentId ? m.documentId.slice(-6) : '---'}</div>
                                <div className="text-[10px] text-slate-400 italic">{m.description}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {m.documentType === 'Adjustment' && 
                                 m.description?.startsWith('Ввод остатков') && 
                                 !movements.some(rev => rev.description?.includes(`(исходный док: ${m.id})`)) && (
                                    <button 
                                        onClick={() => actions.revertInitialStockEntry(m.id)}
                                        className="p-1 text-slate-300 hover:text-red-500 transition-all"
                                        title="Отменить ввод остатков"
                                    >
                                        <X size={14}/>
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {movements.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-20 text-center text-slate-300 italic">История движений пуста</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
