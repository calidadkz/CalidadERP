
import React from 'react';
import { SupplierOrder, PlannedPayment, OrderStatus } from '@/types';
import { Pencil, Filter } from 'lucide-react';

interface OrdersListProps {
    orders: SupplierOrder[];
    suppliers: any[];
    supplierFilter: string;
    setSupplierFilter: (val: string) => void;
    plannedPayments: PlannedPayment[];
    onEdit: (order: SupplierOrder) => void;
}

export const OrdersList: React.FC<OrdersListProps> = ({
    orders, suppliers, supplierFilter, setSupplierFilter, plannedPayments, onEdit
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const getOrderMetrics = (orderId: string, totalAmount: number) => {
        const relatedPayments = (plannedPayments || []).filter(p => p.sourceDocId === orderId);
        const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
        const paymentPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        return { paidAmount, paymentPercent };
    };

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <Filter size={18} className="text-slate-400"/>
                <select className="border border-slate-200 p-2 rounded-lg text-sm font-medium outline-none" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
                    <option value="">Все поставщики</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4 text-left">Бизнес ID / Дата</th>
                            <th className="px-6 py-4 text-left">Поставщик</th>
                            <th className="px-6 py-4 text-right">Сумма (ВПл)</th>
                            <th className="px-6 py-4 text-center">Принято</th>
                            <th className="px-6 py-4 text-center">Оплата</th>
                            <th className="px-6 py-4 text-center">Статус</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {orders.filter(o => !supplierFilter || o.supplierId === supplierFilter).map(o => {
                            const { paidAmount, paymentPercent } = getOrderMetrics(o.id, o.totalAmountForeign);
                            return (
                                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-black text-blue-600 font-mono">#{o.id.slice(-6).toUpperCase()}</div>
                                        <div className="text-[10px] text-slate-400">{o.date}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{o.supplierName}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-black text-slate-900">{f(o.totalAmountForeign)} {o.currency}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-[11px] font-black ${o.receivedItemCount >= o.totalItemCount ? 'text-emerald-600' : 'text-slate-700'}`}>{o.receivedItemCount} / {o.totalItemCount}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">единиц</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center">
                                            <div className="flex justify-between w-32 mb-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{paymentPercent}%</span>
                                                <span className="text-[9px] font-mono font-black text-slate-700">{f(paidAmount)} {o.currency}</span>
                                            </div>
                                            <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300/30">
                                                <div className={`h-full transition-all duration-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, paymentPercent)}%` }}/>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center"><span className={`px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold uppercase rounded-full`}>{o.status}</span></td>
                                    <td className="px-6 py-4 text-right"><button onClick={() => onEdit(o)} className="p-2 text-slate-400 hover:text-blue-500"><Pencil size={18}/></button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
