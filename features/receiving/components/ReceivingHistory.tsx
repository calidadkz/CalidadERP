
import React from 'react';
import { Reception, SupplierOrder } from '@/types';
import { Calendar, Filter } from 'lucide-react';

interface ReceivingHistoryProps {
    receptions: Reception[];
    orders: SupplierOrder[];
}

export const ReceivingHistory: React.FC<ReceivingHistoryProps> = ({ receptions, orders }) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const getBusinessDisplayId = (id: string) => id.includes('-') ? `#${id.slice(-6).toUpperCase()}` : id;

    return (
        <div className="mt-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1"><Calendar size={14}/> Журнал поступлений</h3>
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-left">ID / Дата</th>
                            <th className="px-6 py-4 text-left">Заказ / Склад</th>
                            <th className="px-6 py-4 text-right">Позиций</th>
                            <th className="px-6 py-4 text-right">База (Вал)</th>
                            <th className="px-6 py-4 text-right">Доп (₸)</th>
                            <th className="px-6 py-4 text-right bg-blue-50/30 text-blue-600">Итого (₸)</th>
                            <th className="px-6 py-4 text-center">Статус</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {receptions.map(r => {
                            const order = orders.find(o => o.id === r.orderId);
                            const totalQty = (r.items || []).reduce((s, i) => s + (Number(i.qtyFact) || 0), 0);
                            const baseSumForeign = (r.items || []).reduce((s, i) => s + (Number(i.priceForeign) * (Number(i.qtyFact) || 0)), 0);
                            const totalExpensesKzt = (r.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                            const finalValueKzt = (r.items || []).reduce((s, i) => s + (Number(i.finalCostUnitKZT) * (Number(i.qtyFact) || 0)), 0);
                            
                            return (
                              <tr key={r.id} className="hover:bg-slate-50/50 transition-all group">
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
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
