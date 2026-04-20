
import React, { useState } from 'react';
import { ReceptionItem, ReceptionExpense, SupplierOrder, PreCalculationItem } from '@/types';
import { Package, Save, Layers } from 'lucide-react';
import { ExpenseForm } from './ExpenseForm';
import { EconomySummary } from './EconomySummary';
import { useReceivingLogic } from '../hooks/useReceivingLogic';

interface ReceivingFormProps {
    order: SupplierOrder;
    state: any;
    actions: any;
    onCancel: () => void;
    onSave: (reception: any) => void;
    batchId?: string;
    batchName?: string;
    preCalcItems?: PreCalculationItem[];
}

export const ReceivingForm: React.FC<ReceivingFormProps> = ({
    order, state, actions, onCancel, onSave, batchId, batchName, preCalcItems
}) => {
    const [items, setItems] = useState<ReceptionItem[]>(order.items.map(i => {
        const product = state.products.find((p: any) => p.id === i.productId);
        const productVolume = product?.packages?.reduce((sum: number, p: any) => sum + (p.volumeM3 || 0), 0) || 0;
        return {
            id: `RI-${Date.now()}-${i.productId}`,
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            volumeM3: productVolume,
            qtyPlan: Number(i.quantity) || 0,
            qtyFact: Number(i.quantity) || 0,
            priceForeign: Number(i.priceForeign) || 0,
            costBaseKzt: 0,
            allocatedExpenseKzt: 0,
            finalCostUnitKzt: 0,
            configuration: i.configuration || []
        };
    }));
    const [expenses, setExpenses] = useState<ReceptionExpense[]>([]);
    const [warehouse] = useState('Главный склад');
    const [recDate] = useState(new Date().toISOString().split('T')[0]);

    const { effectiveInfo, currentFinalItems } = useReceivingLogic(
        order.id, state.orders, state.plannedPayments, state.actualPayments, state.exchangeRates, state.products, items, expenses
    );

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const totalExpensesKzt = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const finalTotalKzt = currentFinalItems.reduce((s, i) => s + (Number(i.finalCostUnitKzt) * (Number(i.qtyFact) || 0)), 0);
    const totalQty = currentFinalItems.reduce((s, i) => s + (Number(i.qtyFact) || 0), 0);

    return (
        <div className="space-y-6">
            {/* Баннер привязки к партии */}
            {batchId && (
                <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 flex-none">
                        <Layers size={16}/>
                    </div>
                    <div>
                        <div className="text-[11px] font-black text-indigo-800 uppercase tracking-widest">
                            Приёмка привязана к партии: {batchName || batchId}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-500 mt-0.5">
                            Расходы этой приёмки автоматически попадут в партию как фактические затраты
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm flex items-center gap-2"><Package size={18} className="text-blue-500"/> Состав поступления</h3>
                        </div>
                        <table className="w-full">
                            <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-3 text-left">Товар</th>
                                    <th className="px-6 py-3 text-center w-20">План</th>
                                    <th className="px-6 py-3 text-center w-24">Факт</th>
                                    <th className="px-6 py-3 text-right">База (KZT)</th>
                                    <th className="px-6 py-3 text-right">Доп. Расходы</th>
                                    <th className="px-6 py-3 text-right">Итого ед.</th>
                                    <th className="px-6 py-3 text-right">Итого строка</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {currentFinalItems.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-black text-slate-800 text-sm">{item.productName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                                        </td>
                                        <td className="px-6 py-3 text-center font-bold text-slate-400">{item.qtyPlan}</td>
                                        <td className="px-6 py-3 text-center">
                                            <input type="number" className="w-16 bg-blue-50 border-none p-2 rounded-xl text-center font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-400" value={item.qtyFact} onChange={e => {
                                                const u = [...items]; u[idx].qtyFact = parseFloat(e.target.value) || 0; setItems(u);
                                            }}/>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-xs font-bold text-slate-600">
                                            {f(Math.round(item.costBaseKzt))}
                                            <div className="text-[8px] text-slate-400">{f(item.priceForeign)} {order.currency}</div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-xs font-black text-orange-600">+{f(Math.round(item.allocatedExpenseKzt))}</td>
                                        <td className="px-6 py-4 text-right font-mono text-sm font-black text-slate-900 bg-slate-50/30">{f(Math.round(item.finalCostUnitKzt))} ₸</td>
                                        <td className="px-6 py-4 text-right font-mono text-sm font-black text-blue-600">{f(Math.round(item.finalCostUnitKzt * item.qtyFact))} ₸</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <ExpenseForm
                        expenses={expenses}
                        setExpenses={setExpenses}
                        items={currentFinalItems}
                        batchId={batchId}
                        preCalcItems={preCalcItems}
                        actualPayments={state.actualPayments}
                        plannedPayments={state.plannedPayments}
                        orderId={order.id}
                    />
                </div>
                <div className="col-span-12 lg:col-span-4">
                    <EconomySummary effectiveInfo={effectiveInfo} totalExpensesKzt={totalExpensesKzt} finalTotalKzt={finalTotalKzt} totalQty={totalQty} />
                    <div className="mt-6 flex flex-col gap-3">
                        <button onClick={() => onSave({ id: `REC-${Date.now()}`, orderId: order.id, warehouseName: warehouse, date: recDate, exchangeRate: effectiveInfo.rate, items: currentFinalItems, expenses: expenses, status: 'Posted', closeOrder: true })} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 uppercase text-sm tracking-widest transition-all active:scale-95"><Save size={20}/> Оприходовать</button>
                        <button onClick={() => onSave({ id: `REC-${Date.now()}`, orderId: order.id, warehouseName: warehouse, date: recDate, exchangeRate: effectiveInfo.rate, items: currentFinalItems, expenses: expenses, status: 'Draft', closeOrder: true })} className="w-full bg-white border border-slate-200 text-slate-400 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all">Сохранить черновик</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
