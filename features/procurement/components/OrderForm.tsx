
import React, { useState } from 'react';
import { SupplierOrder, PlannedPayment, Currency, OrderStatus, CashFlowCategory, OrderDocument } from '@/types';
import { Save, Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { OrderItemsTab } from './OrderItemsTab';
import { OrderPaymentsTab } from './OrderPaymentsTab';
import { useOrderFormState } from '../hooks/useOrderFormState';
import { FileUpload } from '@/components/ui/FileUpload';

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
        orderId,
        orderName, setOrderName, // Новое поле
        supplierId, setSupplierId,
        orderCurrency, setOrderCurrency,
        exchangeRateToKzt, setExchangeRateToKzt,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        contractUrl, setContractUrl,
        contractName, setContractName,
        additionalDocuments, setAdditionalDocuments,
        totalAmountForeign,
        unallocatedAmount,
        calculateCrossRate,
        handleAddPaymentStep,
        validateForm
    } = useOrderFormState(initialOrder, initialPayments, state.exchangeRates, state.cashFlowItems, state.suppliers);

    const [isDocsOpen, setIsDocsOpen] = useState(false);

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const handleFormSubmit = () => {
        const error = validateForm();
        if (error) {
            onError(error);
            return;
        }

        const sup = state.suppliers.find((s: any) => s.id === supplierId);
        
        const order: SupplierOrder = {
          id: orderId,
          name: orderName, // Сохраняем название
          date: initialOrder?.date || new Date().toISOString().split('T')[0],
          supplierId,
          supplierName: sup?.name || 'Unknown',
          buyerId: 'Admin',
          currency: orderCurrency,
          items: items.map(i => ({...i, supplierOrderId: orderId})),
          status: initialOrder?.status || OrderStatus.CONFIRMED,
          totalAmountForeign,
          totalAmountKztEst: totalAmountForeign * exchangeRateToKzt,
          paidAmountForeign: initialOrder?.paidAmountForeign || 0,
          totalPaidKzt: initialOrder?.totalPaidKzt || 0,
          receivedItemCount: initialOrder?.receivedItemCount || 0,
          totalItemCount: items.reduce((s, i) => s + i.quantity, 0),
          contractUrl,
          contractName,
          additionalDocuments
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
        } as PlannedPayment));

        onSubmit(order, plans);
    };

    const handleAddDoc = (url: string, name: string) => {
        const newDoc: OrderDocument = {
            name,
            url,
            uploadedAt: new Date().toISOString()
        };
        setAdditionalDocuments(prev => [...prev, newDoc]);
    };

    const handleRemoveDoc = (index: number) => {
        setAdditionalDocuments(prev => prev.filter((_, i) => i !== index));
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

           <div className="flex-none px-8 py-4 border-b flex flex-col gap-4 bg-slate-50/20">
                <div className="flex gap-6 items-center">
                    <div className="flex flex-col">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Название заказа</label>
                        <input 
                            type="text"
                            placeholder="Напр: Инвойс #25 от производителя"
                            className="w-56 border border-slate-200 p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10"
                            value={orderName}
                            onChange={e => setOrderName(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Поставщик</label><select className="w-56 border border-slate-200 p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10" value={supplierId} onChange={e => { setSupplierId(e.target.value); setItems([]); }}><option value="">-- Выберите --</option>{state.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.country})</option>)}</select></div>
                    <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Валюта (ВПл)</label><select className="w-24 border border-slate-200 p-2 rounded-xl bg-white font-black text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10" value={orderCurrency} onChange={e => setOrderCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Курс / KZT</label><input type="number" step="0.01" className="w-24 border border-slate-200 p-2 rounded-xl bg-white font-bold text-blue-600 text-xs outline-none" value={exchangeRateToKzt} onChange={e => setExchangeRateToKzt(parseFloat(e.target.value) || 0)} /></div>
                    
                    <div className="h-10 w-px bg-slate-200 mx-1"/>
                    
                    <div className="flex-1 max-w-xs">
                        <FileUpload 
                            label="Договор заказа"
                            value={contractUrl}
                            fileName={contractName}
                            onUpload={(url, name) => { setContractUrl(url); setContractName(name); }}
                            onRemove={() => { setContractUrl(''); setContractName(''); }}
                            folder={`contracts/supplier-orders/${orderId}`}
                            isContract
                        />
                    </div>

                    <div className="flex flex-col justify-center min-w-[120px] items-end">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Итого инвойс</div>
                        <div className="text-2xl font-black text-blue-600 leading-none tracking-tighter">{f(totalAmountForeign)} <span className="text-sm font-light opacity-40">{orderCurrency}</span></div>
                    </div>
                </div>

                <div className="border-t pt-3">
                    <button 
                        onClick={() => setIsDocsOpen(!isDocsOpen)}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <div className="p-1 rounded bg-slate-100">
                            {isDocsOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                            Дополнительные документы ({additionalDocuments.length})
                            {additionalDocuments.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>}
                        </span>
                    </button>

                    {isDocsOpen && (
                        <div className="grid grid-cols-4 gap-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {additionalDocuments.map((doc, idx) => (
                                <FileUpload 
                                    key={idx}
                                    label={`Документ ${idx + 1}`}
                                    value={doc.url}
                                    fileName={doc.name}
                                    onUpload={() => {}} 
                                    onRemove={() => handleRemoveDoc(idx)}
                                    folder={`documents/supplier-orders/${orderId}`}
                                />
                            ))}
                            {additionalDocuments.length < 8 && (
                                <FileUpload 
                                    label="Добавить файл"
                                    onUpload={handleAddDoc}
                                    onRemove={() => {}}
                                    folder={`documents/supplier-orders/${orderId}`}
                                />
                            )}
                        </div>
                    )}
                </div>
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
