
import React, { useState } from 'react';
import { SupplierOrder, PlannedPayment, Currency, OrderStatus } from '@/types';
import { Save } from 'lucide-react';
import { OrderItemsTab } from './OrderItemsTab';
import { OrderPaymentsTab } from './OrderPaymentsTab';
import { useOrderFormState } from '../hooks/useOrderFormState';

interface OrderFormProps {
    initialOrder: SupplierOrder | null;
    initialPayments: PlannedPayment[];
    state: any;
    actions: any;
    onCancel: () => void;
    onSubmit: (order: SupplierOrder, plans: PlannedPayment[]) => void;
    onError: (msg: string) => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
    initialOrder, initialPayments, state, actions, onCancel, onSubmit, onError
}) => {
    const {
        supplierId, setSupplierId,
        orderCurrency, setOrderCurrency,
        exchangeRateToKZT, setExchangeRateToKZT,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        totalAmountForeign,
        unallocatedAmount,
        calculateCrossRate,
        handleAddPaymentStep,
        validateForm
    } = useOrderFormState(initialOrder, initialPayments, state.exchangeRates, state.cashFlowItems, state.suppliers);

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const handleFormSubmit = () => {
        const error = validateForm();
        if (error) {
            onError(error);
            return;
        }

        const sup = state.suppliers.find((s: any) => s.id === supplierId);
        const orderId = initialOrder?.id || `ORDER-${Date.now()}`;
        
        const order: SupplierOrder = {
          id: orderId,
          date: initialOrder?.date || new Date().toISOString().split('T')[0],
          supplierId,
          supplierName: sup?.name || 'Unknown',
          buyerId: 'Admin',
          currency: orderCurrency,
          items: items.map(i => ({...i, supplierOrderId: orderId})),
          status: initialOrder?.status || OrderStatus.CONFIRMED,
          totalAmountForeign,
          totalAmountKZT_Est: totalAmountForeign * exchangeRateToKZT,
          paidAmountForeign: initialOrder?.paidAmountForeign || 0,
          totalPaidKZT: initialOrder?.totalPaidKZT || 0,
          receivedItemCount: initialOrder?.receivedItemCount || 0,
          totalItemCount: items.reduce((s, i) => s + i.quantity, 0)
        };

        const plans: PlannedPayment[] = formPayments.map(p => ({
          id: p.id || `PLAN-${Date.now()}`,
          direction: 'Outgoing',
          sourceDocId: orderId,
          sourceDocType: 'Order',
          counterpartyId: supplierId,
          counterpartyName: sup?.name || 'Unknown',
          amountDue: p.amountDue || 0,
          currency: orderCurrency,
          dueDate: p.dueDate || new Date().toISOString().split('T')[0],
          amountPaid: p.amountPaid || 0,
          isPaid: (p.amountPaid || 0) >= (p.amountDue || 0) - 0.01,
          cashFlowItemId: p.cashFlowItemId || ''
        }));

        onSubmit(order, plans);
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden relative">
           <div className="flex-none bg-white border-b px-8 py-3 flex justify-between items-center z-30">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    <button onClick={() => setActiveFormTab('items')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${activeFormTab === 'items' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>1. Состав инвойса</button>
                    <button onClick={() => setActiveFormTab('payments')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${activeFormTab === 'payments' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>2. График оплат (IPP)</button>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="px-4 py-2 font-bold text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase tracking-widest">Отмена</button>
                    <button onClick={handleFormSubmit} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-black shadow-lg flex items-center text-xs uppercase tracking-[0.1em] transition-all"><Save size={16} className="mr-2"/> {initialOrder ? 'Обновить' : 'Провести'}</button>
                </div>
           </div>

           <div className="flex-none px-8 py-4 border-b flex gap-6 items-center bg-slate-50/20">
                <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Поставщик</label><select className="w-56 border border-slate-200 p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10" value={supplierId} onChange={e => { setSupplierId(e.target.value); setItems([]); }}><option value="">-- Выберите --</option>{state.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.country})</option>)}</select></div>
                <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Валюта (ВПл)</label><select className="w-24 border border-slate-200 p-2 rounded-xl bg-white font-black text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10" value={orderCurrency} onChange={e => setOrderCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Курс / KZT</label><input type="number" step="0.01" className="w-24 border border-slate-200 p-2 rounded-xl bg-white font-bold text-blue-600 text-xs outline-none" value={exchangeRateToKZT} onChange={e => setExchangeRateToKZT(parseFloat(e.target.value) || 0)} /></div>
                <div className="h-10 w-px bg-slate-200 mx-1"/><div className="flex flex-col justify-center"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Итого инвойс</div><div className="text-2xl font-black text-blue-600 leading-none tracking-tighter">{f(totalAmountForeign)} <span className="text-sm font-light opacity-40">{orderCurrency}</span></div></div>
           </div>

           <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                {activeFormTab === 'items' ? (
                    <OrderItemsTab products={state.products} categories={state.categories} stockMovements={state.stockMovements} supplierId={supplierId} orderCurrency={orderCurrency} calculateCrossRate={calculateCrossRate} items={items} setItems={setItems} />
                ) : (
                    <OrderPaymentsTab unallocatedAmount={unallocatedAmount} orderCurrency={orderCurrency} formPayments={formPayments} setFormPayments={setFormPayments} handleAddPaymentStep={handleAddPaymentStep} cashFlowItems={state.cashFlowItems} />
                )}
           </div>
        </div>
    );
};
