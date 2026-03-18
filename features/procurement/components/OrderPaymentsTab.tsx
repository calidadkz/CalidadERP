
import React from 'react';
import { Currency, PlannedPayment, CashFlowItem } from '@/types';
import { Trash2 } from 'lucide-react';

interface OrderPaymentsTabProps {
    unallocatedAmount: number;
    orderCurrency: Currency;
    formPayments: Partial<PlannedPayment>[];
    setFormPayments: React.Dispatch<React.SetStateAction<Partial<PlannedPayment>[]>>;
    handleAddPaymentStep: () => void;
    cashFlowItems: CashFlowItem[];
}

export const OrderPaymentsTab: React.FC<OrderPaymentsTabProps> = ({
    unallocatedAmount, orderCurrency, formPayments, setFormPayments, handleAddPaymentStep, cashFlowItems
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex justify-between items-center mb-6">
                <div><div className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Остаток графика</div><div className={`text-xl font-black ${unallocatedAmount < -0.1 ? 'text-red-600' : 'text-amber-800'}`}>{f(unallocatedAmount)} {orderCurrency}</div></div>
                <button onClick={handleAddPaymentStep} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">+ Добавить транш</button>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                 <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <tr><th className="px-6 py-3 text-left">Дата</th><th className="px-6 py-3 text-left">Статья ДДС</th><th className="px-6 py-3 text-right">Сумма ({orderCurrency})</th><th className="w-12"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {formPayments.map((p, idx) => (
                            <tr key={idx} className="animate-in slide-in-from-right-2">
                                <td className="px-6 py-3"><input type="date" className="w-full border-none bg-slate-50 p-1.5 rounded-lg font-bold text-slate-700 outline-none text-xs" value={p.dueDate} onChange={e => { const u = [...formPayments]; u[idx].dueDate = e.target.value; setFormPayments(u); }}/></td>
                                <td className="px-6 py-3">
                                    <select className="w-full border-none bg-slate-50 p-1.5 rounded-lg font-bold text-slate-700 outline-none text-xs" value={p.cashFlowItemId || ''} onChange={e => { const u = [...formPayments]; u[idx].cashFlowItemId = e.target.value; setFormPayments(u); }}>
                                        <option value="">-- Выбрать статью --</option>
                                        {cashFlowItems.filter(i => i.type === 'Expense').sort((a,b) => a.name.localeCompare(b.name)).map(item => (<option key={item.id} value={item.id}>{item.name}</option>))}
                                    </select>
                                </td>
                                <td className="px-6 py-3"><input type="number" step="0.01" className="w-full border-none bg-slate-50 p-1.5 rounded-lg font-black text-slate-800 text-right outline-none text-sm" value={p.amountDue} onChange={e => { const u = [...formPayments]; u[idx].amountDue = parseFloat(e.target.value); setFormPayments(u); }}/></td>
                                <td className="px-4 py-3 text-center"><button onClick={() => setFormPayments(formPayments.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
        </div>
    );
};
