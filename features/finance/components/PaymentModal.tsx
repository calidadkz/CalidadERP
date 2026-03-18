
import React, { useState, useMemo } from 'react';
import { ActualPayment, Currency, PlannedPayment, BankAccount, Client, Supplier, PaymentAllocation } from '@/types';
import { X, AlertCircle, Landmark, Wallet, Info, FileText } from 'lucide-react';

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
    direction, plan, bankAccounts, clients, suppliers, onClose, onSubmit 
}) => {
    const [counterpartyId, setCounterpartyId] = useState(plan?.counterpartyId || '');
    const [currency, setCurrency] = useState(plan?.currency || Currency.USD);
    const [amount, setAmount] = useState(plan ? (plan.amountDue - (plan.amountPaid || 0)) : 0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState(bankAccounts.find(a => a.currency === (plan?.currency || Currency.USD))?.id || '');
    
    // Bank Statement / Reference Fields
    const [docNum, setDocNum] = useState('');
    const [knp, setKnp] = useState('');
    const [purpose, setPurpose] = useState('');
    const [cpBin, setCpBin] = useState('');
    const [cpIik, setCpIik] = useState('');
    const [cpBik, setCpBik] = useState('');

    const [error, setError] = useState<string | null>(null);

    // Auto-fill counterparty details
    React.useEffect(() => {
        if (counterpartyId) {
            const cp = [...clients, ...suppliers].find(c => c.id === counterpartyId);
            if (cp) {
                setCpBin(cp.binIin || '');
                setCpIik(cp.iik || '');
                setCpBik(cp.bik || '');
            }
        }
    }, [counterpartyId, clients, suppliers]);

    const selectedAccount = useMemo(() => bankAccounts.find(a => a.id === accountId), [accountId, bankAccounts]);

    const handleSave = () => {
        setError(null);
        if (!counterpartyId) { setError("Укажите контрагента"); return; }
        if (!accountId) { setError("Выберите счет"); return; }
        if (amount <= 0) { setError("Укажите сумму"); return; }
        
        const account = selectedAccount;
        if (!account) return;

        if (direction === 'Outgoing' && amount > account.balance) {
            setError(`Недостаточно средств. Доступно: ${account.balance.toLocaleString()} ${account.currency}`);
            return;
        }
        
        const cp = [...clients, ...suppliers].find(c => c.id === counterpartyId);
        const combinedName = cpBin ? `${cp?.name || 'Unknown'}\nИИН/БИН ${cpBin}` : (cp?.name || 'Unknown');
        
        const allocations: PaymentAllocation[] = plan ? [{
            actualPaymentId: 'PENDING',
            plannedPaymentId: plan.id,
            amountCovered: amount
        }] : [];

        onSubmit({
            id: `TX-${Date.now()}`, 
            direction, 
            date, 
            counterpartyId, 
            counterpartyName: combinedName, 
            amount, 
            currency,
            bankAccountId: account.id, 
            fromAccount: `${account.bank} ${account.number}`, 
            exchangeRate: 1, 
            allocations,
            // New fields
            documentNumber: docNum,
            knp,
            purpose,
            counterpartyBinIin: cpBin,
            counterpartyIik: cpIik,
            counterpartyBik: cpBik
        });
    };

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* Compact Header */}
                <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${direction === 'Outgoing' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            {direction === 'Outgoing' ? 'Расход' : 'Приход'}
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                            {plan ? 'Исполнение по плану' : 'Новая выписка'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {error && (
                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold animate-in slide-in-from-top-1">
                            <AlertCircle size={14}/> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        {/* Section 1: Main Info */}
                        <div className="col-span-2 space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                                <Info size={14} className="text-blue-500"/> Основная информация
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="col-span-2">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Контрагент</label>
                                    <select 
                                        className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/5 disabled:bg-slate-50" 
                                        value={counterpartyId} 
                                        onChange={e => setCounterpartyId(e.target.value)} 
                                        disabled={!!plan}
                                    >
                                        <option value="">-- Выберите --</option>
                                        {(direction === 'Outgoing' ? suppliers : clients).sort((a,b)=>a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Дата</label>
                                    <input type="date" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/5" value={date} onChange={e => setDate(e.target.value)}/>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Валюта</label>
                                    <select className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-black bg-white outline-none" value={currency} onChange={e => { setCurrency(e.target.value as Currency); setAccountId(''); }} disabled={!!plan}>
                                        {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Сумма ({currency})</label>
                                    <input type="number" className="w-full border border-slate-200 p-3 rounded-xl text-sm font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-500/5" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)}/>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Counterparty Details (Functional) */}
                        <div className="col-span-2 space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                                <Wallet size={14} className="text-emerald-500"/> Реквизиты контрагента
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                                <div className="col-span-2">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">ИИН / БИН</label>
                                    <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none" value={cpBin} onChange={e => setCpBin(e.target.value)} placeholder="123456789012"/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">ИИК (Счет)</label>
                                    <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold bg-white outline-none" value={cpIik} onChange={e => setCpIik(e.target.value)} placeholder="KZ..."/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">БИК</label>
                                    <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold bg-white outline-none" value={cpBik} onChange={e => setCpBik(e.target.value)} placeholder="KASPKZ..."/>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Reference Data */}
                        <div className="col-span-2 space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                                <FileText size={14} className="text-amber-500"/> Справочные данные
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-amber-50/30 p-4 rounded-2xl border border-amber-100/50">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">№ Документа</label>
                                    <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none" value={docNum} onChange={e => setDocNum(e.target.value)}/>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">КНП</label>
                                    <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-bold bg-white outline-none" value={knp} onChange={e => setKnp(e.target.value)} placeholder="859"/>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Назначение платежа</label>
                                    <textarea className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium bg-white outline-none min-h-[60px]" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Оплата за товар..."/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex items-center gap-1.5">
                            <Landmark size={12}/> Выберите ваш счет
                        </label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {bankAccounts.filter(a => a.currency === currency).map(a => {
                                const isSelected = accountId === a.id;
                                const isLow = direction === 'Outgoing' && amount > a.balance;
                                return (
                                    <div key={a.id} onClick={() => setAccountId(a.id)} 
                                         className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <Wallet size={14}/>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold text-slate-700 leading-none mb-1">{a.name} — {a.bank}</div>
                                                <div className="text-[9px] text-slate-400 font-mono leading-none">{a.number}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs font-black font-mono ${isLow && isSelected ? 'text-red-500 underline' : 'text-slate-900'}`}>{f(a.balance)}</div>
                                            <div className="text-[8px] font-black text-slate-300 uppercase">Остаток</div>
                                        </div>
                                    </div>
                                );
                            })}
                            {bankAccounts.filter(a => a.currency === currency).length === 0 && (
                                <div className="p-6 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400 text-[10px] font-bold uppercase italic">Нет счетов в {currency}</div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={handleSave} 
                        className={`w-full py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 ${direction === 'Outgoing' ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}
                    >
                        Подтвердить оплату
                    </button>
                </div>
            </div>
        </div>
    );
};
