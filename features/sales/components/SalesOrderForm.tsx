
import React, { useState } from 'react';
import { SalesOrder, PlannedPayment, Client, Currency, OrderStatus } from '@/types';
import { Save, UserPlus } from 'lucide-react';
import { SalesItemsTab } from './SalesItemsTab';
import { SalesPaymentsTab } from './SalesPaymentsTab';
import { QuickClientModal } from './QuickClientModal';
import { useSalesOrderFormState } from '../hooks/useSalesOrderFormState';
import { ApiService } from '@/services/api';

interface SalesOrderFormProps {
    initialOrder: SalesOrder | null;
    initialPayments: PlannedPayment[];
    state: any;
    actions: any;
    access: any;
    onCancel: () => void;
    onSubmit: (order: SalesOrder, plans: PlannedPayment[]) => void;
}

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({
    initialOrder, initialPayments, state, actions, access, onCancel, onSubmit
}) => {
    const {
        selectedClientId, setSelectedClientId,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        totalOrderAmount,
        unallocatedAmount,
        handleAddPaymentStep,
        validateForm
    } = useSalesOrderFormState(initialOrder, initialPayments, state.clients, state.pricingProfiles, state.exchangeRates, state.cashFlowItems);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);

    const canSeeItems = access.canSee('tabs', 'items_tab');
    const canSeePayments = access.canSee('tabs', 'payments_tab');
    const canEditPrices = access.canWrite('fields', 'sales_prices');
    const canAddClient = access.canWrite('actions', 'add_client');
    const isFormWriteable = initialOrder ? access.canWrite('actions', 'edit') : access.canWrite('actions', 'create');

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const handleFormSubmit = () => {
        const error = validateForm();
        if (error) { alert(error); return; }

        const client = state.clients.find((c: any) => c.id === selectedClientId);
        const orderId = initialOrder?.id || ApiService.generateId();
        
        const orderData: SalesOrder = {
            id: orderId,
            date: initialOrder?.date || new Date().toISOString().split('T')[0],
            clientId: selectedClientId,
            clientName: client?.name || 'Unknown',
            items: items.map(i => ({ ...i, salesOrderId: orderId })),
            status: initialOrder?.status || OrderStatus.CONFIRMED,
            totalAmount: totalOrderAmount,
            paidAmount: initialOrder?.paidAmount || 0,
            shippedItemCount: initialOrder?.shippedItemCount || 0,
            totalItemCount: items.reduce((sum, i) => sum + (i.quantity || 0), 0)
        };

        const plans: PlannedPayment[] = formPayments.map(p => ({
            id: p.id || ApiService.generateId(),
            direction: 'Incoming',
            sourceDocId: orderId,
            sourceDocType: 'SalesOrder',
            counterpartyId: selectedClientId,
            counterpartyName: client?.name || 'Unknown',
            amountDue: Number(p.amountDue) || 0,
            currency: Currency.KZT,
            dueDate: p.dueDate || new Date().toISOString().split('T')[0],
            amountPaid: Number(p.amountPaid) || 0,
            isPaid: (Number(p.amountPaid) || 0) >= (Number(p.amountDue) || 0) - 0.01,
            cashFlowItemId: p.cashFlowItemId || ''
        }));

        onSubmit(orderData, plans);
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden relative">
            <div className="flex-none bg-white border-b px-8 py-3 flex justify-between items-center z-30">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    {canSeeItems && (<button onClick={() => setActiveFormTab('items')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${activeFormTab === 'items' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>1. Состав заказа</button>)}
                    {canSeePayments && (<button onClick={() => setActiveFormTab('payments')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${activeFormTab === 'payments' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>2. График оплат (IPP)</button>)}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="px-4 py-2 font-bold text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase tracking-widest">Отмена</button>
                    {isFormWriteable && (<button onClick={handleFormSubmit} className={`bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-black shadow-lg flex items-center text-xs uppercase tracking-[0.1em] transition-all ${Math.abs(unallocatedAmount) > 0.1 ? 'opacity-50 grayscale' : ''}`}><Save size={16} className="mr-2"/> {initialOrder ? 'Обновить' : 'Провести'}</button>)}
                </div>
            </div>

            <div className="flex-none px-8 py-4 border-b flex gap-6 items-center bg-slate-50/20">
                <div className="flex flex-col">
                    <label className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Клиент</label>
                    <div className="flex gap-2">
                        <select className="w-56 border border-slate-200 p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-70" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} disabled={!isFormWriteable}>
                            <option value="">-- Выберите клиента --</option>
                            {state.clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {canAddClient && <button onClick={() => setIsClientModalOpen(true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><UserPlus size={16}/></button>}
                    </div>
                </div>
                <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Валюта</label><div className="w-20 p-2 border border-slate-200 rounded-xl bg-slate-50 font-black text-slate-400 text-xs text-center">KZT</div></div>
                <div className="h-10 w-px bg-slate-200 mx-1"/><div className="flex flex-col justify-center"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Итого заказ</div><div className="text-2xl font-black text-blue-600 leading-none tracking-tighter">{f(totalOrderAmount)} <span className="text-sm font-light opacity-40">₸</span></div></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                {activeFormTab === 'items' ? (
                    <SalesItemsTab products={state.products} categories={state.categories} stockMovements={state.stockMovements} pricingProfiles={state.pricingProfiles} exchangeRates={state.exchangeRates} items={items} setItems={setItems} isFormWriteable={isFormWriteable} canEditPrices={canEditPrices} />
                ) : (
                    <SalesPaymentsTab unallocatedAmount={unallocatedAmount} formPayments={formPayments} setFormPayments={setFormPayments} handleAddPaymentStep={handleAddPaymentStep} cashFlowItems={state.cashFlowItems} isFormWriteable={isFormWriteable} />
                )}
            </div>

            {isClientModalOpen && (
                <QuickClientModal 
                    onClose={() => setIsClientModalOpen(false)} 
                    onSubmit={async (client) => { await actions.addClient(client); setSelectedClientId(client.id); setIsClientModalOpen(false); }} 
                />
            )}
        </div>
    );
};
