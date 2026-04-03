
import React from 'react';
import { ReceptionExpense, ExpenseAllocationMethod, ReceptionItem } from '@/types';
import { Truck, Plus, Trash2, Target } from 'lucide-react';
import { ApiService } from '@/services/api';
import { Currency } from '@/types';

const EXPENSE_TYPES = [
    'Доставка Китай',
    'Доставка Караганда',
    'СВХ',
    'Брокер',
    'Сборы',
    'НДС',
    'Прочее'
];

interface ExpenseFormProps {
    expenses: ReceptionExpense[];
    setExpenses: React.Dispatch<React.SetStateAction<ReceptionExpense[]>>;
    items: ReceptionItem[];
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ expenses, setExpenses, items }) => {
    const addExpenseRow = () => {
        setExpenses(prev => [...prev, { 
            id: ApiService.generateId(), 
            type: 'Доставка Китай', 
            amount: 0, 
            currency: Currency.Kzt, 
            exchangeRateToKzt: 1, 
            allocationMethod: ExpenseAllocationMethod.BY_VALUE 
        }]);
    };

    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight flex items-center gap-2">
                    <Truck size={16} className="text-orange-500"/> Дополнительные расходы
                </h3>
                <button onClick={addExpenseRow} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 px-4">
                    <Plus size={18}/> <span className="text-[10px] font-black uppercase tracking-widest">Добавить расход</span>
                </button>
            </div>

            <div className="space-y-4 pr-2">
                {expenses.map((exp, idx) => (
                    <div key={exp.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 group relative animate-in slide-in-from-right-2">
                        <button onClick={() => setExpenses(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 p-1.5 bg-white text-slate-300 hover:text-red-500 rounded-full shadow-sm border border-slate-100 transition-all opacity-0 group-hover:opacity-100 z-10">
                            <Trash2 size={12}/>
                        </button>
                        
                        <div className="grid grid-cols-4 gap-6 items-end">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Вид расхода</label>
                                <select className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400" value={exp.type} onChange={e => {
                                    const u = [...expenses]; u[idx].type = e.target.value; setExpenses(u);
                                }}>
                                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Сумма (KZT)</label>
                                <input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs font-black text-orange-600 outline-none focus:ring-2 focus:ring-blue-400" value={exp.amount || ''} placeholder="0.00" onChange={e => {
                                    const u = [...expenses]; u[idx].amount = parseFloat(e.target.value) || 0; setExpenses(u);
                                }}/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1">Тип распределения</label>
                                <select className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400" value={exp.allocationMethod} onChange={e => {
                                    const u = [...expenses]; u[idx].allocationMethod = e.target.value as ExpenseAllocationMethod; 
                                    if (e.target.value !== ExpenseAllocationMethod.SPECIFIC_ITEM) u[idx].targetItemId = undefined;
                                    setExpenses(u);
                                }}>
                                    <option value={ExpenseAllocationMethod.BY_VALUE}>По стоимости</option>
                                    <option value={ExpenseAllocationMethod.BY_VOLUME}>По объему</option>
                                    <option value={ExpenseAllocationMethod.BY_QUANTITY}>По кол-ву шт.</option>
                                    <option value={ExpenseAllocationMethod.SPECIFIC_ITEM}>На позицию</option>
                                </select>
                            </div>
                            <div>
                                {exp.allocationMethod === ExpenseAllocationMethod.SPECIFIC_ITEM ? (
                                    <>
                                        <label className="text-[10px] font-black text-blue-500 uppercase mb-2 block ml-1 flex items-center gap-1"><Target size={10}/> Конкретная цель</label>
                                        <select className="w-full bg-white border border-blue-200 p-3 rounded-xl text-[10px] font-bold outline-none text-blue-700" value={exp.targetItemId || ''} onChange={e => {
                                            const u = [...expenses]; u[idx].targetItemId = e.target.value; setExpenses(u);
                                        }}>
                                            <option value="">Выберите товар</option>
                                            {items.map(i => <option key={i.id} value={i.id}>{i.sku}</option>)}
                                        </select>
                                    </>
                                ) : (
                                    <div className="p-3 bg-slate-100/50 rounded-xl text-[9px] font-bold text-slate-400 text-center uppercase border border-dashed border-slate-200">
                                        Общее распределение
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
