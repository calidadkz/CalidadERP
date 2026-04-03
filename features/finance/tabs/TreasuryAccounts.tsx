import React, { useState } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Currency } from '@/types';
import { Plus, Trash2, Building2, Landmark, History, ArrowRightLeft, ShieldCheck, Search, Filter, Info, AlertCircle, X, Check, ArrowRight, Loader2, Calculator } from 'lucide-react';
import { MoneyMath } from '@/services/MoneyMath';
import { ApiService } from '@/services/api';

export const TreasuryAccounts: React.FC = () => {
    const { state, actions } = useStore();
    const { bankAccounts, isProcessing, currencyStacks } = state;

    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [newAcc, setNewAcc] = useState({ name: '', bank: '', number: '', currency: Currency.Kzt, balance: 0, initialRate: 1 });

    const [txType, setTxType] = useState<'Transfer' | 'Exchange'>('Transfer');
    const [fromAccId, setFromAccId] = useState('');
    const [toAccId, setToAccId] = useState('');
    const [txAmtSent, setTxAmtSent] = useState(0);
    const [txAmtRecv, setTxAmtRecv] = useState(0);
    const [txFee, setTxFee] = useState(0);

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const fromAcc = bankAccounts.find(a => a.id === fromAccId);
    const toAcc = bankAccounts.find(a => a.id === toAccId);

    const handleCreateAccount = async () => {
        if (!newAcc.name || !newAcc.bank || isProcessing) return;

        const payload = {
            id: ApiService.generateId('BA'),
            name: newAcc.name,
            bank: newAcc.bank,
            number: newAcc.number || 'N/A',
            currency: newAcc.currency,
            balance: newAcc.balance
        };

        try {
            await actions.addBankAccount(payload, newAcc.initialRate);
            setIsAddingAccount(false);
            setNewAcc({ name: '', bank: '', number: '', currency: Currency.Kzt, balance: 0, initialRate: 1 });
        } catch (e) {
            // Error handled by store/api
        }
    };

    const handleTransaction = () => {
        if (!fromAccId || !toAccId || txAmtSent <= 0 || isProcessing) return;

        if (!fromAcc || fromAcc.balance < (txAmtSent + txFee)) {
            alert("Недостаточно средств на счете списания");
            return;
        }

        const tx = {
            id: ApiService.generateId('INT'),
            date: new Date().toISOString().split('T')[0],
            type: txType,
            fromAccountId: fromAccId,
            toAccountId: toAccId,
            amountSent: txAmtSent,
            amountReceived: txType === 'Exchange' ? txAmtRecv : txAmtSent,
            fee: txFee,
            rate: txType === 'Exchange' ? (txAmtSent / txAmtRecv) : 1
        };

        actions.addInternalTransaction(tx);

        // Reset
        setTxAmtSent(0);
        setTxAmtRecv(0);
        setTxFee(0);
        setFromAccId('');
        setToAccId('');
    };

    const selectedAcc = bankAccounts.find(a => a.id === selectedAccountId);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Наши счета</h3>
                <button 
                    disabled={isProcessing}
                    onClick={() => setIsAddingAccount(!isAddingAccount)}
                    className="flex items-center px-3 py-1.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-md font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                >
                    {isAddingAccount ? <X size={14} className="mr-1.5" /> : <Plus size={14} className="mr-1.5" />}
                    {isAddingAccount ? 'Закрыть' : 'Новый счет'}
                </button>
            </div>

            {isAddingAccount && (
                <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100 grid grid-cols-12 gap-3 items-end animate-in slide-in-from-top-2 shadow-inner">
                    <div className="col-span-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase mb-1 ml-1 block tracking-widest">Название</label>
                        <input className="w-full p-2 rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 font-bold bg-white text-xs" placeholder="Напр. Основной" value={newAcc.name} onChange={e => setNewAcc({...newAcc, name: e.target.value})}/>
                    </div>
                    <div className="col-span-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase mb-1 ml-1 block tracking-widest">Банк</label>
                        <input className="w-full p-2 rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 font-bold bg-white text-xs" placeholder="Kaspi..." value={newAcc.bank} onChange={e => setNewAcc({...newAcc, bank: e.target.value})}/>
                    </div>
                    <div className="col-span-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase mb-1 ml-1 block tracking-widest">№ Счета</label>
                        <input className="w-full p-2 rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 font-bold bg-white font-mono text-xs" placeholder="KZ..." value={newAcc.number} onChange={e => setNewAcc({...newAcc, number: e.target.value})}/>
                    </div>
                    <div className="col-span-1">
                        <label className="text-[9px] font-black text-blue-400 uppercase mb-1 ml-1 block tracking-widest">Валюта</label>
                        <select className="w-full p-2 rounded-lg border border-blue-200 font-bold bg-white outline-none focus:ring-2 focus:ring-blue-400 text-xs" value={newAcc.currency} onChange={e => setNewAcc({...newAcc, currency: e.target.value as Currency})}>
                            {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase mb-1 ml-1 block tracking-widest">Баланс</label>
                        <input type="number" className="w-full p-2 rounded-lg border border-blue-200 font-black text-slate-800 bg-white text-xs" value={newAcc.balance} onChange={e => setNewAcc({...newAcc, balance: parseFloat(e.target.value)})}/>
                    </div>
                    {newAcc.currency !== Currency.Kzt && (
                        <div className="col-span-1">
                            <label className="text-[9px] font-black text-orange-400 uppercase mb-1 ml-1 block tracking-widest">Курс (₸)</label>
                            <input type="number" step="0.01" className="w-full p-2 rounded-lg border border-orange-200 font-bold bg-orange-50 outline-none focus:ring-2 focus:ring-orange-400 text-xs" value={newAcc.initialRate} onChange={e => setNewAcc({...newAcc, initialRate: parseFloat(e.target.value)})}/>
                        </div>
                    )}
                    <div className="col-span-2">
                        <button 
                            disabled={!newAcc.name || !newAcc.bank || isProcessing}
                            onClick={handleCreateAccount}
                            className="w-full p-2 bg-blue-600 text-white rounded-lg font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : null}
                            Создать
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {bankAccounts.map(acc => {
                    const isActive = selectedAccountId === acc.id;
                    return (
                        <div 
                            key={acc.id} 
                            onClick={() => setSelectedAccountId(isActive ? null : acc.id)}
                            className={`bg-white p-3 rounded-2xl border-2 transition-all cursor-pointer group relative flex flex-col justify-between min-h-[100px] ${
                                isActive 
                                ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg scale-[1.01]' 
                                : 'border-slate-100 hover:border-blue-200 hover:shadow-sm'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                    <Building2 size={14} />
                                </div>
                                <span className="text-[7px] font-black text-slate-400 uppercase bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {acc.currency}
                                </span>
                            </div>
                            
                            <div className="mb-2">
                                <h4 className="font-black text-slate-800 text-[11px] leading-tight truncate">{acc.name}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter truncate">{acc.bank}</span>
                                    <span className="w-0.5 h-0.5 bg-slate-200 rounded-full"></span>
                                    <span className="text-[8px] text-slate-400 font-mono tracking-tighter truncate opacity-60">*{acc.number.slice(-4)}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-50 flex justify-between items-end">
                                <div className="text-sm font-black text-slate-900 tracking-tighter leading-none">{f(acc.balance)}</div>
                                <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Баланс</div>
                            </div>

                            {isActive && (
                                <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white p-0.5 rounded-full shadow-md z-10">
                                    <ShieldCheck size={10} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-12 gap-5">
                {/* Operations Panel */}
                <div className="col-span-12 lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <ArrowRightLeft size={18} />
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Внутренние операции</h3>
                    </div>

                    <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-5">
                        <button 
                            onClick={() => { setTxType('Transfer'); setToAccId(''); }}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${txType === 'Transfer' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Перевод
                        </button>
                        <button 
                            onClick={() => { setTxType('Exchange'); setToAccId(''); }}
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${txType === 'Exchange' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                        >
                            Обмен
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 block tracking-widest">Источник списания</label>
                            <select 
                                className="w-full border-none bg-slate-50 p-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                value={fromAccId}
                                onChange={e => { setFromAccId(e.target.value); setToAccId(''); }}
                            >
                                <option value="">-- Выберите счет --</option>
                                {bankAccounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({f(a.balance)} {a.currency})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 block tracking-widest">Счет зачисления</label>
                            <select 
                                className="w-full border-none bg-slate-50 p-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                value={toAccId}
                                onChange={e => setToAccId(e.target.value)}
                                disabled={!fromAccId}
                            >
                                <option value="">-- Выберите счет --</option>
                                {bankAccounts
                                    .filter(a => a.id !== fromAccId)
                                    .filter(a => {
                                        if (!fromAcc) return true;
                                        return txType === 'Transfer' ? a.currency === fromAcc.currency : a.currency !== fromAcc.currency;
                                    })
                                    .map(a => (
                                        <option key={a.id} value={a.id}>{a.name} ({f(a.balance)} {a.currency})</option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="bg-red-50/50 p-3 rounded-xl border border-red-100">
                                <label className="text-[8px] font-black text-red-400 uppercase mb-1 block">Сумма списания</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent border-none p-0 text-lg font-black text-red-600 outline-none"
                                    placeholder="0.00"
                                    value={txAmtSent || ''}
                                    onChange={e => setTxAmtSent(parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                <label className="text-[8px] font-black text-emerald-400 uppercase mb-1 block">
                                    {txType === 'Exchange' ? 'Сумма получения' : 'Комиссия (Kzt)'}
                                </label>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent border-none p-0 text-lg font-black text-emerald-600 outline-none"
                                    placeholder="0.00"
                                    value={txType === 'Exchange' ? (txAmtRecv || '') : (txFee || '')}
                                    onChange={e => txType === 'Exchange' ? setTxAmtRecv(parseFloat(e.target.value)) : setTxFee(parseFloat(e.target.value))}
                                />
                            </div>
                        </div>

                        {txType === 'Exchange' && txAmtSent > 0 && txAmtRecv > 0 && (
                            <div className="flex justify-between items-center px-3 py-1.5 bg-indigo-50 rounded-lg text-[9px] font-bold text-indigo-600 border border-indigo-100">
                                <span>Расчетный курс:</span>
                                <span>1 {toAcc?.currency} = {(txAmtSent / txAmtRecv).toFixed(2)} {fromAcc?.currency}</span>
                            </div>
                        )}

                        <button 
                            onClick={handleTransaction}
                            disabled={!fromAccId || !toAccId || txAmtSent <= 0 || isProcessing}
                            className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 text-xs bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 mt-2"
                        >
                            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                            Провести операцию
                        </button>
                    </div>
                </div>

                {/* FIFO Lots Panel */}
                <div className="col-span-12 lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                <Search size={18} />
                            </div>
                            <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Валютные лоты (FIFO)</h3>
                        </div>

                        {selectedAcc && (
                            <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                                <Building2 size={12} className="text-blue-500" />
                                <span className="text-[9px] font-black text-blue-700 truncate max-w-[120px]">{selectedAcc.name}</span>
                                <button onClick={() => setSelectedAccountId(null)} className="text-blue-300 hover:text-blue-600 ml-1">
                                    <X size={10} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                        {currencyStacks
                            .filter(stack => stack.amountRemaining > 1e-4)
                            .filter(stack => {
                                if (!selectedAcc) return true;
                                // Если есть выбранный счет, показываем лоты, либо привязанные к нему, 
                                // либо бесхозные в той же валюте (если нет других счетов в этой валюте)
                                return stack.id.includes(selectedAcc.id) || (stack.currency === selectedAcc.currency && !bankAccounts.some(a => a.id !== selectedAcc.id && a.currency === selectedAcc.currency));
                            })
                            .sort((a, b) => {
                                const dateCompare = a.date.localeCompare(b.date);
                                if (dateCompare !== 0) return dateCompare;
                                return a.id.localeCompare(b.id);
                            })
                            .map(stack => {
                                const progress = Math.round((stack.amountRemaining / stack.amountOriginal) * 100);
                                const dateOnly = stack.date.split('T')[0];
                                
                                return (
                                    <div key={stack.id} className="p-3.5 border-2 rounded-xl transition-all relative overflow-hidden bg-white border-slate-50 hover:border-blue-100 hover:shadow-sm">
                                        <div className="flex justify-between items-start mb-2.5 relative z-10">
                                            <div>
                                                <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                                                    {dateOnly} {stack.id.startsWith('LOT-INIT') && <ShieldCheck size={10} className="text-blue-300" />}
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-base font-black text-slate-800 leading-none">{f(stack.amountRemaining)}</span>
                                                    <span className="text-[10px] font-bold text-slate-300">/ {f(stack.amountOriginal)} {stack.currency}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Себест.</div>
                                                <div className="text-sm font-black text-blue-600 font-mono leading-none mt-1">
                                                    {stack.rate.toFixed(2)} <span className="text-[9px]">₸</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative h-1.5 w-full bg-slate-50 rounded-full overflow-hidden shadow-inner">
                                            <div 
                                                className="absolute top-0 left-0 h-full transition-all duration-1000 bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.3)]"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>

                                        <div className="mt-2 flex justify-between items-center text-[8px] font-bold uppercase tracking-tight text-slate-400">
                                            <span>Доступный остаток</span>
                                            <span className="text-blue-500 font-black">{progress}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        }

                        {currencyStacks.filter(s => s.amountRemaining > 1e-4 && (!selectedAcc || s.id.includes(selectedAcc.id))).length === 0 && (
                            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                                <Calculator size={32} className="mx-auto mb-2 text-slate-200" />
                                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em]">Нет активных резервов</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
