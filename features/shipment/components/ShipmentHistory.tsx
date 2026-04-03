
import React from 'react';
import { Shipment } from '@/types';
import { Calendar, Pencil, Trash2, RotateCcw, FileText, User, ShoppingBag } from 'lucide-react';

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
    const f = (val: number) => val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const getBusinessDisplayId = (id: string) => id ? `#${id.slice(-6).toUpperCase()}` : '—';

    const sortedShipments = [...shipments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <FileText size={14}/> Журнал отгрузок
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-3 text-left">Накладная</th>
                                {showColClient && <th className="px-4 py-3 text-left">Контрагент</th>}
                                {showColOrder && <th className="px-4 py-3 text-left">Заказ</th>}
                                <th className="px-4 py-3 text-center">Состав</th>
                                {showColAmount && <th className="px-4 py-3 text-right">Сумма</th>}
                                {showColStatus && <th className="px-4 py-3 text-center">Статус</th>}
                                <th className="px-4 py-3 text-right w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedShipments.map(s => {
                                const totalVal = (s.items || []).reduce((sum, i) => sum + (Number(i.qtyShipped) * (Number(i.priceKzt) || 0)), 0);
                                const totalQty = (s.items || []).reduce((sum, i) => sum + Number(i.qtyShipped), 0);
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50/30 transition-all group">
                                      <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                              <div className={`p-1.5 rounded-lg ${s.status === 'Posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                  <FileText size={14} />
                                              </div>
                                              <div>
                                                  <div className="text-[11px] font-black text-slate-800 font-mono uppercase tracking-tighter">#{s.id.slice(-6).toUpperCase()}</div>
                                                  <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold">
                                                      <Calendar size={10} />
                                                      {new Date(s.date).toLocaleDateString()}
                                                  </div>
                                              </div>
                                          </div>
                                      </td>
                                      {showColClient && (
                                          <td className="px-4 py-3">
                                              <div className="flex items-center gap-2">
                                                  <User size={10} className="text-slate-300" />
                                                  <div className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[150px]">{s.clientName}</div>
                                              </div>
                                          </td>
                                      )}
                                      {showColOrder && (
                                          <td className="px-4 py-3">
                                              <div className="flex items-center gap-1.5 text-blue-600">
                                                  <ShoppingBag size={10} />
                                                  <div className="text-[9px] font-black font-mono tracking-tighter">{getBusinessDisplayId(s.salesOrderId)}</div>
                                              </div>
                                          </td>
                                      )}
                                      <td className="px-4 py-3 text-center">
                                          <div className="text-[10px] font-black text-slate-800">{totalQty} ед.</div>
                                          <div className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">{s.items?.length || 0} поз.</div>
                                      </td>
                                      {showColAmount && (
                                          <td className="px-4 py-3 text-right">
                                              <div className="text-[11px] font-black text-slate-900 font-mono tracking-tighter">
                                                  {f(totalVal)} ₸
                                              </div>
                                          </td>
                                      )}
                                      {showColStatus && (
                                          <td className="px-4 py-3 text-center">
                                              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                                                  s.status === 'Posted' 
                                                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                      : 'bg-slate-50 text-slate-400 border-slate-200'
                                              }`}>
                                                  {s.status === 'Posted' ? 'ОК' : 'Draft'}
                                              </span>
                                          </td>
                                      )}
                                      <td className="px-4 py-3 text-right">
                                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                              {s.status === 'Draft' && (
                                                  <>
                                                      <button onClick={() => onEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                          <Pencil size={14}/>
                                                      </button>
                                                      {canDeleteDraft && (
                                                          <button onClick={() => onDeleteConfirm(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                              <Trash2 size={14}/>
                                                          </button>
                                                      )}
                                                  </>
                                              )}
                                              {s.status === 'Posted' && canStorno && (
                                                  <button onClick={() => onStornoConfirm(s.id)} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Сторно">
                                                      <RotateCcw size={14}/>
                                                  </button>
                                              )}
                                          </div>
                                      </td>
                                  </tr>
                                );
                            })}
                            {shipments.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-slate-300 italic font-medium">Журнал пуст</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
