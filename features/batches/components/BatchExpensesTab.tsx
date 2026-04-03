import React, { useState, useMemo } from 'react';
import { BatchExpense, ExpenseCategory, PlannedPayment, ActualPayment } from '@/types';
import { PlusCircle, Trash2, Calendar, Tag, DollarSign, FileText, AlertCircle, Link as LinkIcon, Search } from 'lucide-react';

interface BatchExpensesTabProps {
    expenses: BatchExpense[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    onAddExpense: (expense: Omit<BatchExpense, 'id' | 'batchId'>) => Promise<any>;
    onDeleteExpense: (id: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    logistics_china: 'Логистика Китай',
    logistics_local: 'Логистика Локальная',
    customs: 'Таможня',
    broker: 'Брокер',
    svh: 'СВХ',
    other: 'Прочее',
    revenue: 'Выручка'
};

export const BatchExpensesTab: React.FC<BatchExpensesTabProps> = ({ 
    expenses, 
    plannedPayments, 
    actualPayments, 
    onAddExpense, 
    onDeleteExpense 
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [sourceType, setSourceType] = useState<'manual' | 'calendar' | 'statement'>('manual');
    
    const [newExpense, setNewExpense] = useState<Omit<BatchExpense, 'id' | 'batchId'>>({
        category: 'other',
        description: '',
        amountKzt: 0,
        date: new Date().toISOString().split('T')[0],
        plannedPaymentId: undefined,
        paymentId: undefined
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newExpense.amountKzt <= 0 || !newExpense.description) return;
        
        await onAddExpense(newExpense);
        resetForm();
    };

    const resetForm = () => {
        setNewExpense({
            category: 'other',
            description: '',
            amountKzt: 0,
            date: new Date().toISOString().split('T')[0],
            plannedPaymentId: undefined,
            paymentId: undefined
        });
        setSourceType('manual');
        setIsAdding(false);
    };

    const handleSelectPlanned = (pp: PlannedPayment) => {
        setNewExpense({
            ...newExpense,
            description: `[Календарь] ${pp.counterpartyName}: ${pp.sourceDocId || ''}`,
            amountKzt: pp.amountDue - pp.amountPaid,
            date: pp.dueDate || new Date().toISOString().split('T')[0],
            plannedPaymentId: pp.id,
            paymentId: undefined
        });
        setSourceType('manual'); // После выбора переключаем в "ручной" режим для финализации описания
    };

    const handleSelectActual = (ap: ActualPayment) => {
        setNewExpense({
            ...newExpense,
            description: `[Выписка] ${ap.counterpartyName}: ${ap.purpose || ''}`,
            amountKzt: ap.totalCostKzt || ap.amount,
            date: ap.date,
            paymentId: ap.id,
            plannedPaymentId: undefined
        });
        setSourceType('manual');
    };

    const formatCurrency = (val: number) => val.toLocaleString('ru-RU') + ' ₸';

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Журнал фактических расходов</h3>
                <div className="flex gap-2">
                    {!isAdding && (
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-md"
                        >
                            <PlusCircle size={14} /> Новый расход
                        </button>
                    )}
                </div>
            </div>

            {isAdding && (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-4 mb-6 border-b border-slate-200 pb-4">
                        <button 
                            onClick={() => setSourceType('manual')}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${sourceType === 'manual' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-200'}`}
                        >
                            Вручную
                        </button>
                        <button 
                            onClick={() => setSourceType('calendar')}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${sourceType === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-200'}`}
                        >
                            Из Календаря
                        </button>
                        <button 
                            onClick={() => setSourceType('statement')}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${sourceType === 'statement' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-200'}`}
                        >
                            Из Выписок
                        </button>
                    </div>

                    {sourceType === 'manual' ? (
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Категория</label>
                                    <select 
                                        value={newExpense.category}
                                        onChange={e => setNewExpense({...newExpense, category: e.target.value as ExpenseCategory})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Описание / Назначение</label>
                                    <input 
                                        type="text"
                                        value={newExpense.description}
                                        onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                                        placeholder="Например: Оплата логистики ООО 'Вектор'"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Сумма (KZT)</label>
                                    <input 
                                        type="number"
                                        value={newExpense.amountKzt || ''}
                                        onChange={e => setNewExpense({...newExpense, amountKzt: parseFloat(e.target.value) || 0})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-6">
                                <div className="flex items-center gap-2">
                                    {newExpense.plannedPaymentId && (
                                        <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase border border-indigo-100">
                                            <LinkIcon size={10} /> Связано с календарем
                                        </span>
                                    )}
                                    {newExpense.paymentId && (
                                        <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase border border-blue-100">
                                            <LinkIcon size={10} /> Связано с выпиской
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={resetForm} className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Отмена</button>
                                    <button type="submit" className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-lg">Сохранить расход</button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="max-h-[400px] overflow-auto custom-scrollbar space-y-2">
                            {sourceType === 'calendar' ? (
                                plannedPayments.filter(p => !p.isPaid).map(pp => (
                                    <button 
                                        key={pp.id}
                                        onClick={() => handleSelectPlanned(pp)}
                                        className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-md transition-all text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                                <Calendar size={18} />
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{pp.counterpartyName}</div>
                                                <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{pp.sourceDocId} • Срок: {pp.dueDate}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(pp.amountDue - pp.amountPaid)}</div>
                                            <div className="text-[9px] font-bold text-indigo-500 uppercase mt-1">Выбрать</div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                actualPayments.map(ap => (
                                    <button 
                                        key={ap.id}
                                        onClick={() => handleSelectActual(ap)}
                                        className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{ap.counterpartyName}</div>
                                                <div className="text-[9px] font-bold text-slate-400 mt-1 truncate">{ap.purpose || 'Без назначения'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-xs font-black text-slate-900 tabular-nums">{formatCurrency(ap.totalCostKzt || ap.amount)}</div>
                                            <div className="text-[9px] font-bold text-blue-500 uppercase mt-1">Выбрать</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar bg-white rounded-3xl border border-slate-100 shadow-sm">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                        <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                            <th className="px-6 py-4">Дата</th>
                            <th className="px-6 py-4">Категория</th>
                            <th className="px-6 py-4">Описание</th>
                            <th className="px-6 py-4 text-right">Сумма</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {expenses.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center opacity-20">
                                        <FileText size={48} className="mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Нет записей о расходах</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            expenses.map((exp) => (
                                <tr key={exp.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 font-mono">
                                            <Calendar size={12} /> {new Date(exp.date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                                            {CATEGORY_LABELS[exp.category]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-[11px] font-bold text-slate-700">{exp.description}</div>
                                            <div className="flex gap-1.5">
                                                {exp.plannedPaymentId && (
                                                    <span className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded border border-indigo-100">Календарь</span>
                                                )}
                                                {exp.paymentId && (
                                                    <span className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded border border-blue-100">Выписка</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-[12px] font-black text-slate-900 tabular-nums font-mono">
                                            {formatCurrency(exp.amountKzt)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => onDeleteExpense(exp.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
