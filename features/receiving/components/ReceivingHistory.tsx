
import React, { useState } from 'react';
import { Reception, SupplierOrder } from '@/types';
import { Calendar, ChevronDown, Package, Wallet } from 'lucide-react';

interface ReceivingHistoryProps {
    receptions: Reception[];
    orders: SupplierOrder[];
}

export const ReceivingHistory: React.FC<ReceivingHistoryProps> = ({ receptions, orders }) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const getBusinessDisplayId = (id: string) => id.includes('-') ? `#${id.slice(-6).toUpperCase()}` : id;

    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="mt-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1"><Calendar size={14}/> Журнал поступлений</h3>
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-4 py-4 text-left w-8"></th>
                            <th className="px-6 py-4 text-left">ID / Дата</th>
                            <th className="px-6 py-4 text-left">Заказ / Склад</th>
                            <th className="px-6 py-4 text-right">Позиций</th>
                            <th className="px-6 py-4 text-right">База (Вал)</th>
                            <th className="px-6 py-4 text-right">Доп (₸)</th>
                            <th className="px-6 py-4 text-right bg-blue-50/30 text-blue-600">Итого (₸)</th>
                            <th className="px-6 py-4 text-center">Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receptions.map(r => {
                            const order = orders.find(o => o.id === r.orderId);
                            const totalQty = (r.items || []).reduce((s, i) => s + (Number(i.qtyFact) || 0), 0);
                            const baseSumForeign = (r.items || []).reduce((s, i) => s + (Number(i.priceForeign) * (Number(i.qtyFact) || 0)), 0);
                            const totalExpensesKzt = (r.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                            const finalValueKzt = (r.items || []).reduce((s, i) => s + (Number(i.finalCostUnitKzt) * (Number(i.qtyFact) || 0)), 0);
                            const isExpanded = expandedId === r.id;

                            return (
                                <React.Fragment key={r.id}>
                                    {/* Основная строка */}
                                    <tr
                                        className={`transition-all group cursor-pointer divide-y divide-slate-50 border-b border-slate-50 ${isExpanded ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}
                                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                    >
                                        <td className="px-4 py-4 text-center">
                                            <ChevronDown
                                                size={14}
                                                className={`text-slate-300 transition-transform duration-200 group-hover:text-blue-400 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-black text-blue-600 font-mono">#{r.id.slice(-8).toUpperCase()}</div>
                                            <div className="text-[10px] text-slate-400">{r.date}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-700">{getBusinessDisplayId(r.orderId)}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{r.warehouseName}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-xs font-black text-slate-900">{r.items?.length || 0} поз.</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{totalQty} шт.</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-600">
                                            {f(baseSumForeign)} {order?.currency || '?'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-xs font-black text-orange-600">
                                            +{f(totalExpensesKzt)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-sm font-black text-blue-700 bg-blue-50/10">
                                            {f(Math.round(Number(finalValueKzt) || 0))} ₸
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${r.status === 'Posted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {r.status === 'Posted' ? 'Оприходовано' : 'Черновик'}
                                            </span>
                                        </td>
                                    </tr>

                                    {/* Раскрывающаяся детализация */}
                                    <tr className={`border-b border-slate-100 ${isExpanded ? '' : 'hidden'}`}>
                                        <td colSpan={8} className="p-0">
                                            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[700px]' : 'max-h-0'}`}>
                                                <div className="px-8 py-5 bg-gradient-to-b from-blue-50/30 to-slate-50/10">

                                                    {/* Товары */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Package size={12} className="text-blue-400"/>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Состав поступления</span>
                                                    </div>
                                                    <table className="w-full mb-4">
                                                        <thead>
                                                            <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                                                <th className="pb-2 text-left">Товар</th>
                                                                <th className="pb-2 text-left text-slate-300">SKU</th>
                                                                <th className="pb-2 text-right">План</th>
                                                                <th className="pb-2 text-right">Факт</th>
                                                                <th className="pb-2 text-right">Цена (вал.)</th>
                                                                <th className="pb-2 text-right">Себест. ед., ₸</th>
                                                                <th className="pb-2 text-right">Итого, ₸</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {(r.items || []).map((item, idx) => {
                                                                const lineTotal = Number(item.finalCostUnitKzt) * Number(item.qtyFact);
                                                                const hasDiff = Number(item.qtyFact) !== Number(item.qtyPlan);
                                                                return (
                                                                    <tr key={idx} className="text-xs">
                                                                        <td className="py-2 pr-4">
                                                                            <div className="font-bold text-slate-800 text-[11px]">{item.productName}</div>
                                                                            {item.configuration && item.configuration.length > 0 && (
                                                                                <div className="text-[9px] text-slate-400 mt-0.5 italic">{item.configuration.join(', ')}</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2 pr-4">
                                                                            <span className="text-[9px] font-mono text-slate-400">{item.sku}</span>
                                                                        </td>
                                                                        <td className="py-2 text-right text-slate-400 font-mono text-[10px]">{item.qtyPlan}</td>
                                                                        <td className="py-2 text-right font-black">
                                                                            <span className={hasDiff ? 'text-orange-600' : 'text-slate-700'}>
                                                                                {item.qtyFact}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 text-right font-mono text-slate-600 text-[10px]">
                                                                            {f(Number(item.priceForeign))} {order?.currency || ''}
                                                                        </td>
                                                                        <td className="py-2 text-right font-mono text-slate-600 text-[10px]">
                                                                            {f(Number(item.finalCostUnitKzt))}
                                                                        </td>
                                                                        <td className="py-2 text-right font-black font-mono text-slate-800 text-[11px]">
                                                                            {f(Math.round(lineTotal))}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="border-t-2 border-slate-200">
                                                                <td colSpan={3} className="pt-2 text-[9px] font-black text-slate-400 uppercase">Итого</td>
                                                                <td className="pt-2 text-right font-black text-slate-700">{totalQty} шт.</td>
                                                                <td className="pt-2 text-right font-mono text-slate-600 text-[10px]">{f(baseSumForeign)} {order?.currency || ''}</td>
                                                                <td></td>
                                                                <td className="pt-2 text-right font-black text-blue-600 font-mono">{f(Math.round(finalValueKzt))} ₸</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>

                                                    {/* Доп. расходы */}
                                                    {(r.expenses || []).length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2 mt-1">
                                                                <Wallet size={12} className="text-orange-400"/>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Доп. расходы</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {r.expenses.map((exp, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5">
                                                                        <span className="text-[9px] font-bold text-slate-600">{exp.type}</span>
                                                                        <span className="text-[9px] font-black text-orange-600 font-mono">{f(Number(exp.amount))} ₸</span>
                                                                    </div>
                                                                ))}
                                                                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Всего</span>
                                                                    <span className="text-[9px] font-black text-slate-700 font-mono">{f(totalExpensesKzt)} ₸</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
