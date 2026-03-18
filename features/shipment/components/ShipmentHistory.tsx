
import React from 'react';
import { Shipment } from '@/types';
import { Calendar, Pencil, Trash2, RotateCcw } from 'lucide-react';

interface ShipmentHistoryProps {
    shipments: Shipment[];
    showColClient: boolean;
    showColOrder: boolean;
    showColAmount: boolean;
    showColStatus: boolean;
    canStorno: boolean;
    canDeleteDraft: boolean;
    onEdit: (shipment: Shipment) => void;
    onDeleteConfirm: (id: string) => void;
    onStornoConfirm: (id: string) => void;
}

export const ShipmentHistory: React.FC<ShipmentHistoryProps> = ({
    shipments, showColClient, showColOrder, showColAmount, showColStatus, canStorno, canDeleteDraft, onEdit, onDeleteConfirm, onStornoConfirm
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const getBusinessDisplayId = (id: string) => id ? `#${id.slice(-6).toUpperCase()}` : '—';

    return (
        <div className="mt-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1"><Calendar size={14}/> Журнал отгрузок</h3>
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-left">ID / Дата</th>
                            {showColClient && <th className="px-6 py-4 text-left">Клиент</th>}
                            {showColOrder && <th className="px-6 py-4 text-left">Заказ-основание</th>}
                            <th className="px-6 py-4 text-right">Позиций</th>
                            {showColAmount && <th className="px-6 py-4 text-right">Сумма (KZT)</th>}
                            {showColStatus && <th className="px-6 py-4 text-center">Статус</th>}
                            <th className="px-6 py-4 text-right w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {shipments.map(s => {
                            const totalVal = (s.items || []).reduce((sum, i) => sum + (i.qtyShipped * (i.priceKZT || 0)), 0);
                            const totalQty = (s.items || []).reduce((sum, i) => sum + i.qtyShipped, 0);
                            return (
                              <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                                  <td className="px-6 py-4">
                                      <div className="text-sm font-black text-blue-600 font-mono uppercase tracking-tighter">#{s.id.slice(-8).toUpperCase()}</div>
                                      <div className="text-[10px] text-slate-400">{s.date}</div>
                                  </td>
                                  {showColClient && <td className="px-6 py-4"><div className="text-sm font-bold text-slate-700">{s.clientName}</div></td>}
                                  {showColOrder && (<td className="px-6 py-4"><div className="text-xs font-black text-blue-500 font-mono bg-blue-50 px-2 py-1 rounded w-fit border border-blue-100">{getBusinessDisplayId(s.salesOrderId)}</div></td>)}
                                  <td className="px-6 py-4 text-right">
                                      <div className="text-xs font-black text-slate-900">{s.items?.length || 0} поз.</div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{totalQty} шт.</div>
                                  </td>
                                  {showColAmount && <td className="px-6 py-4 text-right font-mono text-sm font-black text-slate-900">{f(totalVal)} ₸</td>}
                                  {showColStatus && (<td className="px-6 py-4 text-center"><span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase border ${s.status === 'Posted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{s.status === 'Posted' ? 'Проведено' : 'Черновик'}</span></td>)}
                                  <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {s.status === 'Draft' && (
                                              <>
                                                  <button onClick={() => onEdit(s)} className="p-2 text-slate-300 hover:text-blue-500"><Pencil size={16}/></button>
                                                  {canDeleteDraft && <button onClick={() => onDeleteConfirm(s.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>}
                                              </>
                                          )}
                                          {s.status === 'Posted' && canStorno && (<button onClick={() => onStornoConfirm(s.id)} className="p-2 text-slate-300 hover:text-red-500" title="Сторно"><RotateCcw size={16}/></button>)}
                                      </div>
                                  </td>
                              </tr>
                            );
                        })}
                        {shipments.length === 0 && (
                            <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic font-medium">Журнал отгрузок пуст</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
