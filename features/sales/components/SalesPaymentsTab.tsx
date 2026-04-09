
import React from 'react';
import { PlannedPayment, Counterparty } from '@/types';
import { Trash2, ArrowRight } from 'lucide-react';
import { CashFlowSelector } from '@/components/ui/CashFlowSelector';

interface SalesPaymentsTabProps {
    unallocatedAmount: number;
    formPayments: Partial<PlannedPayment>[];
    setFormPayments: React.Dispatch<React.SetStateAction<Partial<PlannedPayment>[]>>;
    handleAddPaymentStep: () => void;
    cashFlowItems?: any; // оставлен для совместимости, не используется
    isFormWriteable: boolean;
    intermediaries?: Counterparty[];
}

export const SalesPaymentsTab: React.FC<SalesPaymentsTabProps> = ({
    unallocatedAmount, formPayments, setFormPayments, handleAddPaymentStep, isFormWriteable, intermediaries = []
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const updatePayment = (idx: number, key: keyof Partial<PlannedPayment>, value: any) => {
        if (!isFormWriteable) return;
        const updated = [...formPayments];
        (updated[idx] as any)[key] = value;
        setFormPayments(updated);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className={`p-5 rounded-2xl flex justify-between items-center mb-6 border transition-colors ${Math.abs(unallocatedAmount) > 0.1 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div>
                    <div className={`text-[9px] font-black uppercase tracking-widest ${Math.abs(unallocatedAmount) > 0.1 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {unallocatedAmount > 0.1 ? 'Остаток к распределению' : unallocatedAmount < -0.1 ? 'Превышение суммы' : 'График полностью сформирован'}
                    </div>
                    <div className={`text-xl font-black ${unallocatedAmount < -0.1 ? 'text-red-600' : 'text-slate-800'}`}>{f(Math.abs(unallocatedAmount))} ₸</div>
                </div>
                {isFormWriteable && <button onClick={handleAddPaymentStep} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 active:scale-95">+ Добавить транш</button>}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-3 text-left">Дата</th>
                            <th className="px-6 py-3 text-left">Статья ДДС</th>
                            <th className="px-6 py-3 text-right">Сумма (KZT)</th>
                            {intermediaries.length > 0 && (
                                <th className="px-6 py-3 text-left">
                                    <span className="flex items-center gap-1">
                                        <ArrowRight size={9}/> Посредник
                                    </span>
                                </th>
                            )}
                            <th className="w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {formPayments.map((p, idx) => (
                            <tr key={idx} className="animate-in slide-in-from-right-2">
                                <td className="px-6 py-3">
                                    <input
                                        type="date"
                                        className="w-full border-none bg-slate-50 p-1.5 rounded-lg font-bold text-slate-700 outline-none text-xs disabled:opacity-70"
                                        value={p.dueDate}
                                        onChange={e => updatePayment(idx, 'dueDate', e.target.value)}
                                        disabled={!isFormWriteable}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <CashFlowSelector
                                        value={p.cashFlowItemId || ''}
                                        onChange={id => updatePayment(idx, 'cashFlowItemId', id)}
                                        direction="Incoming"
                                        disabled={!isFormWriteable}
                                        dropdownMinWidth={240}
                                    />
                                </td>
                                <td className="px-6 py-3">
                                    <input
                                        type="number"
                                        className="w-full border-none bg-slate-50 p-1.5 rounded-lg font-black text-slate-800 text-right outline-none disabled:opacity-70 text-sm"
                                        value={p.amountDue}
                                        onChange={e => updatePayment(idx, 'amountDue', parseFloat(e.target.value))}
                                        disabled={!isFormWriteable}
                                    />
                                </td>
                                {intermediaries.length > 0 && (
                                    <td className="px-6 py-3">
                                        <select
                                            className={`w-full border-none p-1.5 rounded-lg font-bold text-xs outline-none disabled:opacity-70 ${p.paymentCounterpartyId ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-400'}`}
                                            value={p.paymentCounterpartyId || ''}
                                            onChange={e => {
                                                const cp = intermediaries.find(c => c.id === e.target.value);
                                                updatePayment(idx, 'paymentCounterpartyId', e.target.value || undefined);
                                                updatePayment(idx, 'paymentCounterpartyName', cp?.name || undefined);
                                            }}
                                            disabled={!isFormWriteable}
                                            title="Если оплата придёт через посредника (Kaspi, маркетплейс) — укажите его здесь"
                                        >
                                            <option value="">— Прямая оплата —</option>
                                            {intermediaries.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                )}
                                <td className="px-4 py-3 text-center">
                                    {isFormWriteable && (
                                        <button
                                            onClick={() => setFormPayments(formPayments.filter((_, i) => i !== idx))}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {intermediaries.length > 0 && formPayments.some(p => p.paymentCounterpartyId) && (
                <div className="flex items-start gap-2 px-2 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-700 font-bold">
                    <ArrowRight size={14} className="shrink-0 mt-0.5"/>
                    Транши с посредником будут отображаться в разноске выписки даже если имя контрагента в банке отличается от имени клиента в заказе.
                </div>
            )}
        </div>
    );
};
