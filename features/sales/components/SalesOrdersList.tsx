
import React from 'react';
import { SalesOrder, PlannedPayment } from '@/types';
import { Pencil, Trash2 } from 'lucide-react';

interface SalesOrdersListProps {
    salesOrders: SalesOrder[];
    plannedPayments: PlannedPayment[];
    showColClient: boolean;
    showColAmount: boolean;
    showColPayment: boolean;
    showColShipment: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (order: SalesOrder) => void;
    onDelete: (order: SalesOrder) => void;
}

export const SalesOrdersList: React.FC<SalesOrdersListProps> = ({
    salesOrders, plannedPayments, showColClient, showColAmount, showColPayment, showColShipment, canEdit, canDelete, onEdit, onDelete
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <tr>
                        <th className="px-6 py-4 text-left">ID / Дата</th>
                        {showColClient && <th className="px-6 py-4 text-left">Клиент</th>}
                        {showColAmount && <th className="px-6 py-4 text-right">Сумма (KZT)</th>}
                        <th className="px-6 py-4 text-center">Отгружено</th>
                        {showColPayment && <th className="px-6 py-4 text-center">Оплата</th>}
                        {showColShipment && <th className="px-6 py-4 text-center">Статус</th>}
                        <th className="px-6 py-4"></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                    {salesOrders.length === 0 ? (
                        <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Заказы не найдены</td></tr>
                    ) : salesOrders.map(o => {
                        const relatedPayments = plannedPayments.filter(p => p.sourceDocId === o.id);
                        const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                        const paymentPercent = o.totalAmount > 0 ? Math.round((paidAmount / o.totalAmount) * 100) : 0;
                        const isFullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
                        const isFullyPaid = paidAmount >= (o.totalAmount - 0.1);
                        const statusLabel = (isFullyShipped && isFullyPaid) ? 'Реализован' : o.status;

                        return (
                            <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-black text-blue-600 font-mono">#{o.id.slice(-6).toUpperCase()}</div>
                                    <div className="text-[10px] text-slate-400">{o.date}</div>
                                </td>
                                {showColClient && <td className="px-6 py-4 text-sm font-bold text-slate-700">{o.clientName}</td>}
                                {showColAmount && <td className="px-6 py-4 text-sm text-right font-mono font-black text-slate-900">{f(o.totalAmount)} ₸</td>}
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className={`text-[11px] font-black ${isFullyShipped ? 'text-emerald-600' : 'text-slate-700'}`}>{o.shippedItemCount} / {o.totalItemCount}</span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">единиц</span>
                                    </div>
                                </td>
                                {showColPayment && (
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center">
                                            <div className="flex justify-between w-32 mb-1"><span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{paymentPercent}%</span><span className="text-[9px] font-mono font-black text-slate-700">{f(paidAmount)} ₸</span></div>
                                            <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300/30"><div className={`h-full transition-all duration-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, paymentPercent)}%` }} /></div>
                                        </div>
                                    </td>
                                )}
                                {showColShipment && (
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border ${statusLabel === 'Реализован' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{statusLabel}</span>
                                    </td>
                                )}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1">
                                        {canEdit && (<button onClick={() => onEdit(o)} className="p-2 text-slate-300 hover:text-blue-500 transition-all"><Pencil size={18}/></button>)}
                                        {canDelete && (<button onClick={() => onDelete(o)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={18}/></button>)}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
