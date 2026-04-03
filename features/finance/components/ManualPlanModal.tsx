
import React, { useState } from 'react';
import { PlannedPayment, Currency, CashFlowCategory } from '@/types';
import { Plus, X, AlertCircle } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ApiService } from '@/services/api';

interface ManualPlanModalProps {
    onClose: () => void;
    onSubmit: (p: PlannedPayment) => void;
}

export const ManualPlanModal: React.FC<ManualPlanModalProps> = ({ onClose, onSubmit }) => {
    const { state } = useStore();
    const [direction, setDirection] = useState<'Incoming' | 'Outgoing'>('Outgoing');
    const [cpId, setCpId] = useState('');
    const [amt, setAmt] = useState(0);
    const [curr, setCurr] = useState(Currency.Kzt);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [cfId, setCfId] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        setError(null);
        if (!cpId) { setError("Выберите контрагента"); return; }
        if (amt <= 0) { setError("Укажите сумму"); return; }
        if (!cfId) { setError("Укажите статью ДДС"); return; }
        
        const cp = state.counterparties.find(x => x.id === cpId);
        const cashFlowItem = state.cashFlowItems.find(item => item.id === cfId);

        const p: PlannedPayment = {
            id: ApiService.generateUUID(),
            direction: direction,
            sourceDocId: 'MANUAL',
            sourceDocType: 'Manual',
            counterpartyId: cpId,
            counterpartyName: cp?.name || 'Unknown',
            amountDue: amt,
            amountPaid: 0,
            currency: curr,
            dueDate: date,
            isPaid: false,
            cashFlowItemId: cfId,
            // Удалено: cashFlowCategory
        } as PlannedPayment;
        onSubmit(p);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Plus size={20}/></div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">Запланировать вручную</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 text-red-600 text-[10px] font-black uppercase">
                            <AlertCircle size={16}/> {error}
                        </div>
                    )}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => { setDirection('Outgoing'); setCfId(''); }} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${direction === 'Outgoing' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}>Расход</button>
                        <button onClick={() => { setDirection('Incoming'); setCfId(''); }} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${direction === 'Incoming' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>Доход</button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Контрагент</label>
                            <select className="w-full border border-slate-200 p-3 rounded-xl text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={cpId} onChange={e => setCpId(e.target.value)}>
                                <option value="">-- Выберите контрагента --</option>
                                {state.counterparties.sort((a,b)=>a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Сумма</label>
                                <input type="number" className="w-full border border-slate-200 p-3 rounded-xl text-sm font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={amt || ''} onChange={e => setAmt(parseFloat(e.target.value) || 0)}/>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Валюта</label>
                                <select className="w-full border border-slate-200 p-3 rounded-xl text-xs font-black bg-slate-50 outline-none" value={curr} onChange={e => setCurr(e.target.value as Currency)}>
                                    {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Дата платежа</label>
                                <input type="date" className="w-full border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={date} onChange={e => setDate(e.target.value)}/>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-blue-500 uppercase mb-1.5 ml-1 tracking-widest flex items-center gap-1">Статья ДДС <span className="text-red-500">*</span></label>
                                <select className="w-full border border-blue-100 p-3 rounded-xl text-[10px] font-black bg-blue-50/30 text-blue-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={cfId} onChange={e => setCfId(e.target.value)}>
                                    <option value="">-- ВЫБЕРИТЕ СТАТЬЮ --</option>
                                    {state.cashFlowItems.filter(i => i.type === (direction === 'Outgoing' ? 'Expense' : 'Income')).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSubmit} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-95 mt-4">Добавить в календарь</button>
                </div>
            </div>
        </div>
    );
};
