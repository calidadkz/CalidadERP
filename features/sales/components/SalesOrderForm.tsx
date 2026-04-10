
import React, { useState } from 'react';
import { SalesOrder, PlannedPayment, Client, Currency, OrderStatus, CounterpartyType, OrderDocument } from '@/types';
import { Save, UserPlus, FileText, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { SalesItemsTab } from './SalesItemsTab';
import { SalesPaymentsTab } from './SalesPaymentsTab';
import { CounterpartyCreateModal } from '../../counterparties/components/CounterpartyCreateModal';
import { useSalesOrderFormState } from '../hooks/useSalesOrderFormState';
import { ApiService } from '@/services/api';
import { FileUpload } from '@/components/ui/FileUpload';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'; // Импорт нового компонента

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
        orderId,
        orderName, setOrderName, // Используем новое поле
        selectedClientId, setSelectedClientId,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        contractUrl, setContractUrl,
        contractName, setContractName,
        contractDeliveryDate, setContractDeliveryDate,
        additionalDocuments, setAdditionalDocuments,
        totalOrderAmount,
        unallocatedAmount,
        handleAddPaymentStep,
        validateForm
    } = useSalesOrderFormState(initialOrder, initialPayments, state.clients, state.pricingProfiles, state.exchangeRates, state.cashFlowItems);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isDocsOpen, setIsDocsOpen] = useState(false);

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
        
        const orderData: SalesOrder = {
            id: orderId,
            name: orderName, // Сохраняем название
            date: initialOrder?.date || new Date().toISOString().split('T')[0],
            clientId: selectedClientId,
            clientName: client?.name || 'Unknown',
            items: items.map(i => ({ ...i, salesOrderId: orderId })),
            status: initialOrder?.status || OrderStatus.CONFIRMED,
            totalAmount: totalOrderAmount,
            paidAmount: initialOrder?.paidAmount || 0,
            shippedItemCount: initialOrder?.shippedItemCount || 0,
            totalItemCount: items.reduce((sum, i) => sum + (i.quantity || 0), 0),
            contractUrl,
            contractName,
            contractDeliveryDate: contractDeliveryDate || undefined,
            additionalDocuments
        };

        const plans: PlannedPayment[] = formPayments.map(p => {
            return {
                id: p.id || ApiService.generateId(),
                direction: 'Incoming',
                sourceDocId: orderId,
                sourceDocType: 'SalesOrder',
                counterpartyId: selectedClientId,
                counterpartyName: client?.name || 'Unknown',
                amountDue: Number(p.amountDue) || 0,
                currency: Currency.Kzt,
                dueDate: p.dueDate || new Date().toISOString().split('T')[0],
                amountPaid: Number(p.amountPaid) || 0,
                isPaid: (Number(p.amountPaid) || 0) >= (Number(p.amountDue) || 0) - 0.01,
                cashFlowItemId: p.cashFlowItemId || '',
                paymentCounterpartyId: p.paymentCounterpartyId || undefined,
                paymentCounterpartyName: p.paymentCounterpartyName || undefined,
            } as PlannedPayment;
        });

        onSubmit(orderData, plans);
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
                    {canSeeItems && (<button onClick={() => setActiveFormTab('items')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${activeFormTab === 'items' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>1. Состав заказа</button>)}
                    {canSeePayments && (<button onClick={() => setActiveFormTab('payments')} className={`px-6 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${activeFormTab === 'payments' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>2. График оплат (IPP)</button>)}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="px-4 py-2 font-bold text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase tracking-widest">Отмена</button>
                    {isFormWriteable && (<button onClick={handleFormSubmit} className={`bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-black shadow-lg flex items-center text-xs uppercase tracking-[0.1em] transition-all ${Math.abs(unallocatedAmount) > 0.1 ? 'opacity-50 grayscale' : ''}`}><Save size={16} className="mr-2"/> {initialOrder ? 'Обновить' : 'Провести'}</button>)}
                </div>
            </div>

            <div className="flex-none px-8 py-4 border-b flex flex-col gap-4 bg-slate-50/20">
                <div className="flex gap-6 items-center">
                    <div className="flex flex-col">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Название заказа</label>
                        <input 
                            type="text"
                            placeholder="Напр: Поставка станков для цеха №1"
                            className="w-64 border border-slate-200 p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10"
                            value={orderName}
                            onChange={e => setOrderName(e.target.value)}
                            disabled={!isFormWriteable}
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Клиент</label>
                        <div className="flex gap-2">
                            <SearchableDropdown
                                options={state.clients}
                                value={selectedClientId}
                                onChange={setSelectedClientId}
                                displayKey="name"
                                valueKey="id"
                                placeholder="-- Выберите клиента --"
                                disabled={!isFormWriteable}
                                className="w-56" 
                            />
                            {canAddClient && <button onClick={() => setIsClientModalOpen(true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><UserPlus size={16}/></button>}
                        </div>
                    </div>
                    <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Валюта</label><div className="w-20 p-2 border border-slate-200 rounded-xl bg-slate-50 font-black text-slate-400 text-xs text-center">KZT</div></div>
                    
                    <div className="h-10 w-px bg-slate-200 mx-1"/>
                    
                    <div className="flex items-end gap-3">
                        <div className="max-w-xs">
                            <FileUpload
                                label="Договор клиента"
                                value={contractUrl}
                                fileName={contractName}
                                onUpload={(url, name) => { setContractUrl(url); setContractName(name); }}
                                onRemove={() => { setContractUrl(''); setContractName(''); setContractDeliveryDate(''); }}
                                folder={`contracts/sales-orders/${orderId}`}
                                isContract
                            />
                        </div>
                        {contractUrl && (
                            <div className="flex flex-col">
                                <label className={`text-[9px] font-black uppercase mb-1.5 ml-1 tracking-widest flex items-center gap-1 ${!contractDeliveryDate ? 'text-red-500' : 'text-slate-400'}`}>
                                    {!contractDeliveryDate && <AlertCircle size={10}/>}
                                    Крайняя дата по договору
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={contractDeliveryDate}
                                    onChange={e => setContractDeliveryDate(e.target.value)}
                                    disabled={!isFormWriteable}
                                    className={`w-44 border p-2 rounded-xl bg-white font-bold text-slate-700 text-xs outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${
                                        !contractDeliveryDate
                                            ? 'border-red-300 bg-red-50 focus:ring-red-500/10'
                                            : 'border-slate-200'
                                    }`}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col justify-center min-w-[120px] items-end">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Итого заказ</div>
                        <div className="text-2xl font-black text-blue-600 leading-none tracking-tighter">{f(totalOrderAmount)} <span className="text-sm font-light opacity-40">₸</span></div>
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
                                    folder={`documents/sales-orders/${orderId}`}
                                />
                            ))}
                            {additionalDocuments.length < 8 && (
                                <FileUpload 
                                    label="Добавить файл"
                                    onUpload={handleAddDoc}
                                    onRemove={() => {}}
                                    folder={`documents/sales-orders/${orderId}`}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                {activeFormTab === 'items' ? (
                    <SalesItemsTab 
                        products={state.products} 
                        categories={state.categories} 
                        stockMovements={state.stockMovements} 
                        optionVariants={state.optionVariants}
                        pricingProfiles={state.pricingProfiles} 
                        exchangeRates={state.exchangeRates} 
                        items={items} 
                        setItems={setItems} 
                        isFormWriteable={isFormWriteable} 
                        canEditPrices={canEditPrices} 
                    />
                ) : (
                    <SalesPaymentsTab
                        unallocatedAmount={unallocatedAmount}
                        formPayments={formPayments}
                        setFormPayments={setFormPayments}
                        handleAddPaymentStep={handleAddPaymentStep}
                        cashFlowItems={state.cashFlowItems}
                        isFormWriteable={isFormWriteable}
                        intermediaries={state.counterparties.filter((c: any) => c.isPaymentIntermediary)}
                    />
                )}
            </div>

            {isClientModalOpen && (
                <CounterpartyCreateModal 
                    initialType={CounterpartyType.CLIENT}
                    onClose={() => setIsClientModalOpen(false)} 
                    onSubmit={async (counterparty, accounts) => { 
                        await actions.addCounterparty(counterparty, accounts[0]); 
                        setSelectedClientId(counterparty.id); 
                        setIsClientModalOpen(false); 
                    }} 
                />
            )}
        </div>
    );
};
