import React, { useState, useMemo, useEffect } from 'react';
import { ActualPayment, Currency, PlannedPayment, BankAccount, Client, Supplier, PaymentAllocation, CashFlowItem, Batch, Counterparty, CounterpartyAccount, CounterpartyType } from '@/types';
import { X, AlertCircle, Landmark, Wallet, Info, FileText, Plus, Trash2, Layers, Tag, UserPlus, Calendar, ChevronRight } from 'lucide-react';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';
import { CounterpartyCreateModal } from '@/features/counterparties/components/CounterpartyCreateModal';
import { useStore } from '@/features/system/context/GlobalStore';

interface PaymentModalProps {
    direction: 'Incoming' | 'Outgoing';
    plan?: PlannedPayment | null;
    bankAccounts: BankAccount[];
    clients: Client[];
    suppliers: Supplier[];
    onClose: () => void;
    onSubmit: (payment: ActualPayment) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
    direction, plan, bankAccounts, clients: initialClients, suppliers: initialSuppliers, onClose, onSubmit 
}) => {
    const { state } = useStore();
    const { plannedPayments, cashFlowItems: cfItemsDict } = state;

    const [counterpartyId, setCounterpartyId] = useState(plan?.counterpartyId || '');
    const [currency, setCurrency] = useState(plan?.currency || Currency.Usd);
    const [amount, setAmount] = useState(plan ? (plan.amountDue - (plan.amountPaid || 0)) : 0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState(bankAccounts.find(a => a.currency === (plan?.currency || Currency.Usd))?.id || '');
    
    // Bank Statement / Reference Fields
    const [docNum, setDocNum] = useState('');
    const [knp, setKnp] = useState('');
    const [purpose, setPurpose] = useState('');
    const [cpBin, setCpBin] = useState('');
    const [cpIik, setCpIik] = useState('');
    const [cpBik, setCpBik] = useState('');

    // Allocations State
    const [allocations, setAllocations] = useState<Partial<PaymentAllocation>[]>([]);
    
    // Dictionaries for selection
    const [batches, setBatches] = useState<Batch[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Local counterparties to handle newly created ones
    const [localClients, setLocalClients] = useState<Client[]>(initialClients);
    const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(initialSuppliers);
    const [isCounterpartyModalOpen, setIsCounterpartyModalOpen] = useState(false);

    // Filtered Planned Payments available for allocation
    const availablePlans = useMemo(() => {
        return plannedPayments.filter(p => 
            !p.isPaid && 
            p.direction === direction && 
            (counterpartyId ? p.counterpartyId === counterpartyId : true) &&
            p.currency === currency
        );
    }, [plannedPayments, direction, counterpartyId, currency]);

    // Sync local lists with props
    useEffect(() => { setLocalClients(initialClients); }, [initialClients]);
    useEffect(() => { setLocalSuppliers(initialSuppliers); }, [initialSuppliers]);

    // Initial load of dictionaries and default allocation
    useEffect(() => {
        const loadDicts = async () => {
            const activeBatches = await ApiService.fetchAll<Batch>(TableNames.BATCHES, { status: 'active' });
            setBatches(activeBatches);
        };
        loadDicts();

        if (plan) {
            setAllocations([{
                id: ApiService.generateId('AL'),
                plannedPaymentId: plan.id,
                cashFlowItemId: plan.cashFlowItemId,
                amountCovered: plan.amountDue - (plan.amountPaid || 0),
                description: `Оплата по плану: ${plan.sourceDocId}`
            }]);
        } else {
            setAllocations([{
                id: ApiService.generateId('AL'),
                cashFlowItemId: '',
                amountCovered: 0,
                description: ''
            }]);
        }
    }, [plan]);

    // If amount changes and there's only one allocation that IS NOT linked to a plan, sync it
    useEffect(() => {
        if (allocations.length === 1 && amount > 0 && !allocations[0].plannedPaymentId) {
            setAllocations(prev => [{ ...prev[0], amountCovered: amount }]);
        }
    }, [amount]);

    const handleAddAllocation = () => {
        setAllocations([...allocations, {
            id: ApiService.generateId('AL'),
            cashFlowItemId: '',
            amountCovered: 0,
            description: ''
        }]);
    };

    const handleRemoveAllocation = (index: number) => {
        if (allocations.length > 1) {
            setAllocations(allocations.filter((_, i) => i !== index));
        }
    };

    const updateAllocation = (index: number, key: keyof PaymentAllocation, value: any) => {
        const newAllocations = [...allocations];
        const current = { ...newAllocations[index], [key]: value };

        // If linking to a plan, auto-fill some fields
        if (key === 'plannedPaymentId' && value) {
            const p = plannedPayments.find(pp => pp.id === value);
            if (p) {
                current.cashFlowItemId = p.cashFlowItemId;
                current.amountCovered = p.amountDue - (p.amountPaid || 0);
                current.description = `Оплата по плану: ${p.sourceDocId}`;
                // If counterparty is not set, set it from the plan
                if (!counterpartyId) setCounterpartyId(p.counterpartyId);
            }
        }

        newAllocations[index] = current;
        setAllocations(newAllocations);
    };

    const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amountCovered) || 0), 0);
    const isBalanced = Math.abs(totalAllocated - amount) < 0.01;

    const handleSave = () => {
        setError(null);
        if (!counterpartyId) { setError("Укажите контрагента"); return; }
        if (!accountId) { setError("Выберите счет"); return; }
        if (amount <= 0) { setError("Укажите сумму"); return; }
        if (!isBalanced) { setError(`Сумма распределения (${totalAllocated.toFixed(2)}) не совпадает с суммой платежа (${amount})`); return; }
        
        const invalidAlloc = allocations.find(a => !a.cashFlowItemId);
        if (invalidAlloc) { setError("Выберите статью ДДС для всех частей платежа"); return; }

        const account = bankAccounts.find(a => a.id === accountId);
        if (!account) return;

        const cp = [...localClients, ...localSuppliers].find(c => c.id === counterpartyId);
        const combinedName = cp?.name || 'Unknown';

        onSubmit({
            id: ApiService.generateId('TX'), 
            direction, 
            date, 
            counterpartyId, 
            counterpartyName: combinedName, 
            amount, 
            currency,
            bankAccountId: account.id, 
            fromAccount: `${account.bank} ${account.number}`, 
            exchangeRate: 1, 
            allocations: allocations as PaymentAllocation[],
            documentNumber: docNum,
            knp,
            purpose,
            counterpartyBinIin: cpBin,
            counterpartyIik: cpIik,
            counterpartyBik: cpBik
        });
    };

    const handleCreateCounterparty = async (cp: Counterparty, accounts: CounterpartyAccount[]) => {
        const { saved } = await ApiService.createCounterpartyWithAccount(cp, accounts[0] || {});
        if (saved) {
            if (saved.type === CounterpartyType.CLIENT) {
                setLocalClients(prev => [...prev, saved as Client]);
            } else {
                setLocalSuppliers(prev => [...prev, saved as Supplier]);
            }
            setCounterpartyId(saved.id);
            setIsCounterpartyModalOpen(false);
        }
    };

    const f = (val: number) => val.toLocaleString('ru-RU');

    return (
        <>
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-[110] p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center flex-none">
                        <div className="flex items-center gap-3">
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${direction === 'Outgoing' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {direction === 'Outgoing' ? 'Расход' : 'Приход'}
                            </div>
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                                {plan ? 'Исполнение по плану' : 'Новый платеж'}
                            </h3>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        {error && (
                            <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                                <AlertCircle size={14}/> {error}
                            </div>
                        )}

                        <div className="grid grid-cols-12 gap-8">
                            {/* Left Column: Payment Details */}
                            <div className="col-span-4 space-y-6">
                                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5 ml-1">
                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Контрагент</label>
                                            {!plan && (
                                                <button 
                                                    onClick={() => setIsCounterpartyModalOpen(true)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Создать контрагента"
                                                >
                                                    <UserPlus size={14}/>
                                                </button>
                                            )}
                                        </div>
                                        <select 
                                            className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/5 disabled:bg-slate-100" 
                                            value={counterpartyId} 
                                            onChange={e => setCounterpartyId(e.target.value)} 
                                            disabled={!!plan}
                                        >
                                            <option value="">-- Выберите --</option>
                                            {(direction === 'Outgoing' ? localSuppliers : localClients).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Дата</label>
                                            <input type="date" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none" value={date} onChange={e => setDate(e.target.value)}/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Валюта</label>
                                            <select className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-black bg-white outline-none" value={currency} onChange={e => setCurrency(e.target.value as Currency)} disabled={!!plan}>
                                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Общая сумма ({currency})</label>
                                        <input 
                                            type="number" 
                                            className="w-full border border-slate-200 p-3 rounded-xl text-lg font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/5" 
                                            value={amount || ''} 
                                            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-[2rem] border border-slate-100 space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1.5">
                                        <Landmark size={12}/> Счет списания/зачисления
                                    </label>
                                    <div className="space-y-2">
                                        {bankAccounts.filter(a => a.currency === currency).map(a => (
                                            <div key={a.id} onClick={() => setAccountId(a.id)} 
                                                 className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${accountId === a.id ? 'border-blue-500 bg-blue-50/50' : 'border-slate-50 hover:border-slate-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${accountId === a.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Wallet size={14}/>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-black text-slate-700 truncate">{a.bank}</div>
                                                        <div className="text-[9px] text-slate-400 font-mono">{a.number}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[11px] font-black font-mono">{f(a.balance)}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {bankAccounts.filter(a => a.currency === currency).length === 0 && (
                                            <div className="p-4 text-center text-slate-400 text-[10px] font-bold uppercase italic border-2 border-dashed border-slate-100 rounded-2xl">
                                                Нет счетов в {currency}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Allocations */}
                            <div className="col-span-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Tag size={14} className="text-indigo-500"/> Распределение платежа
                                    </h4>
                                    <button 
                                        onClick={handleAddAllocation}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                                    >
                                        <Plus size={12}/> Добавить статью/план
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {allocations.map((alloc, idx) => (
                                        <div key={alloc.id} className="relative bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                            {allocations.length > 1 && (
                                                <button 
                                                    onClick={() => handleRemoveAllocation(idx)}
                                                    className="absolute -right-2 -top-2 p-1.5 bg-white text-red-400 hover:text-red-600 rounded-full border border-slate-100 shadow-sm transition-all z-10"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                            )}
                                            
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 flex items-center gap-4 mb-2 p-2 bg-slate-50/50 rounded-xl">
                                                    <div className="flex-1">
                                                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Планируемый платеж (из календаря)</label>
                                                        <select 
                                                            value={alloc.plannedPaymentId || ''} 
                                                            onChange={e => updateAllocation(idx, 'plannedPaymentId', e.target.value)}
                                                            className="w-full border border-slate-200 p-2 rounded-lg text-[10px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500/10"
                                                        >
                                                            <option value="">-- Без привязки к плану (прямой платеж) --</option>
                                                            {availablePlans.map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.sourceDocId} | {p.amountDue - p.amountPaid} {p.currency} | {p.counterpartyName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {alloc.plannedPaymentId && (
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg shadow-sm">
                                                            <Calendar size={14}/>
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Связан с планом</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="col-span-6">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Статья ДДС</label>
                                                    <select 
                                                        value={alloc.cashFlowItemId} 
                                                        onChange={e => updateAllocation(idx, 'cashFlowItemId', e.target.value)}
                                                        className="w-full border border-slate-100 p-2 rounded-xl text-[11px] font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/10"
                                                        disabled={!!alloc.plannedPaymentId}
                                                    >
                                                        <option value="">-- Выберите статью --</option>
                                                        {cfItemsDict.filter(i => (direction === 'Outgoing' ? i.type === 'Expense' : i.type === 'Income'))
                                                            .map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                                    </select>
                                                </div>

                                                <div className="col-span-6">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Партия (опц.)</label>
                                                    <select 
                                                        value={alloc.batchId} 
                                                        onChange={e => updateAllocation(idx, 'batchId', e.target.value)}
                                                        className="w-full border border-slate-100 p-2 rounded-xl text-[11px] font-bold bg-slate-50 outline-none"
                                                    >
                                                        <option value="">-- Без партии --</option>
                                                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                    </select>
                                                </div>

                                                <div className="col-span-4">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Сумма ({currency})</label>
                                                    <input 
                                                        type="number" 
                                                        value={alloc.amountCovered || ''} 
                                                        onChange={e => updateAllocation(idx, 'amountCovered', parseFloat(e.target.value) || 0)}
                                                        className="w-full border border-slate-100 p-2 rounded-xl text-[11px] font-black font-mono bg-slate-50 outline-none"
                                                    />
                                                </div>

                                                <div className="col-span-8">
                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Комментарий</label>
                                                    <input 
                                                        type="text" 
                                                        value={alloc.description || ''} 
                                                        onChange={e => updateAllocation(idx, 'description', e.target.value)}
                                                        className="w-full border border-slate-100 p-2 rounded-xl text-[11px] font-medium bg-slate-50 outline-none"
                                                        placeholder="Например: доплата по счету..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Balancing Footer */}
                                <div className={`p-5 rounded-[2rem] flex items-center justify-between border-2 transition-all ${isBalanced ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100 shadow-inner'}`}>
                                    <div className="flex flex-col">
                                        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-1">
                                            Контроль суммы
                                        </div>
                                        <div className="text-sm font-black text-slate-800">
                                            {f(totalAllocated)} / {f(amount)} <span className="text-[10px] text-slate-400 ml-1">{currency}</span>
                                        </div>
                                    </div>
                                    
                                    {!isBalanced && (
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Разница</div>
                                                <div className="text-sm font-black text-amber-600 font-mono">{f(amount - totalAllocated)}</div>
                                            </div>
                                            <div className="p-2 bg-amber-100 text-amber-600 rounded-full animate-pulse">
                                                <AlertCircle size={20}/>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {isBalanced && (
                                        <div className="flex items-center gap-3">
                                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-emerald-100 shadow-sm">
                                                Готово к сохранению
                                            </div>
                                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                                                <CheckCircle2 size={20}/>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Action */}
                    <div className="p-6 border-t bg-slate-50 flex justify-end flex-none">
                        <button 
                            onClick={handleSave} 
                            disabled={!isBalanced || amount <= 0}
                            className={`px-16 py-4 rounded-2xl text-white font-black uppercase text-sm tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 ${direction === 'Outgoing' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                            Провести платеж
                        </button>
                    </div>
                </div>
            </div>

            {isCounterpartyModalOpen && (
                <CounterpartyCreateModal 
                    onClose={() => setIsCounterpartyModalOpen(false)}
                    initialType={direction === 'Outgoing' ? CounterpartyType.SUPPLIER : CounterpartyType.CLIENT}
                    onSubmit={handleCreateCounterparty}
                />
            )}
        </>
    );
};

const CheckCircle2 = ({ size, className }: { size?: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
);
