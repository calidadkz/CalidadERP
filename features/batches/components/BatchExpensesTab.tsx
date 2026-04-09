import React, { useState, useMemo } from 'react';
import { BatchExpense, ExpenseCategory } from '@/types';
import { Trash2, Calendar, FileText, PlusCircle, PackageCheck } from 'lucide-react';
import { SidebarContext } from './BatchSidebar';

interface BatchExpensesTabProps {
    expenses: BatchExpense[];
    onDeleteExpense: (id: string) => Promise<void>;
    onOpenSidebar: (ctx: SidebarContext) => void;
}

interface CategoryDef {
    key: ExpenseCategory;
    label: string;
    short: string;
    color: string;
}

const CATEGORIES: CategoryDef[] = [
    { key: 'logistics_urumqi_almaty',    label: 'Доставка Урумчи–Алматы',     short: 'Урумчи–Алм.',  color: 'bg-blue-50 text-blue-700' },
    { key: 'logistics_almaty_karaganda', label: 'Доставка Алматы–Кар.',        short: 'Алм.–Кар.',    color: 'bg-blue-50 text-blue-700' },
    { key: 'logistics_china_domestic',   label: 'Доставка по Китаю',           short: 'По Китаю',     color: 'bg-sky-50 text-sky-700' },
    { key: 'svh',                        label: 'СВХ',                         short: 'СВХ',          color: 'bg-amber-50 text-amber-700' },
    { key: 'broker',                     label: 'Брокер',                      short: 'Брокер',       color: 'bg-amber-50 text-amber-700' },
    { key: 'customs',                    label: 'Таможенные сборы',            short: 'Тамож.',       color: 'bg-amber-50 text-amber-700' },
    { key: 'customs_vat',                label: 'НДС Таможенный',              short: 'НДС Там.',     color: 'bg-violet-50 text-violet-700' },
    { key: 'sales_vat',                  label: 'НДС итог. при продаже',       short: 'НДС Пр.',      color: 'bg-violet-50 text-violet-700' },
    { key: 'resale_vat',                 label: 'НДС перепродажи (Упр.)',      short: 'НДС Упр.',     color: 'bg-violet-50 text-violet-700' },
    { key: 'kpn_simplified',             label: 'КПН (Упр.)',                  short: 'КПН4',         color: 'bg-rose-50 text-rose-700' },
    { key: 'kpn_standard',               label: 'КПН20',                       short: 'КПН20',        color: 'bg-rose-50 text-rose-700' },
    { key: 'pnr',                        label: 'Пусконаладка',                short: 'ПНР',          color: 'bg-emerald-50 text-emerald-700' },
    { key: 'delivery_local',             label: 'Доставка до клиента',         short: 'До клиента',   color: 'bg-emerald-50 text-emerald-700' },
    { key: 'other',                      label: 'Прочее',                      short: 'Прочее',       color: 'bg-slate-50 text-slate-600' },
];

const fmt = (v: number) => v > 0 ? v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸' : '—';

export const BatchExpensesTab: React.FC<BatchExpensesTabProps> = ({
    expenses,
    onDeleteExpense,
    onOpenSidebar,
}) => {
    const [search, setSearch] = useState('');

    const totals = useMemo(() => {
        const map: Partial<Record<ExpenseCategory, number>> = {};
        for (const exp of expenses) {
            map[exp.category] = (map[exp.category] || 0) + exp.amountKzt;
        }
        return map;
    }, [expenses]);

    const grandTotal = expenses.reduce((s, e) => s + e.amountKzt, 0);

    const filteredExpenses = useMemo(() => {
        if (!search) return expenses;
        const q = search.toLowerCase();
        return expenses.filter(e =>
            e.description.toLowerCase().includes(q) ||
            CATEGORIES.find(c => c.key === e.category)?.label.toLowerCase().includes(q)
        );
    }, [expenses, search]);

    const catDef = (key: ExpenseCategory) => CATEGORIES.find(c => c.key === key);

    return (
        <div className="flex flex-col h-full gap-4">
            {/* ── Матрица по категориям ─────────────────────────────── */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm bg-white">
                <table className="w-max min-w-full border-collapse text-left">
                    <thead>
                        <tr className="bg-slate-950 text-[9px] font-black uppercase tracking-widest">
                            {CATEGORIES.map(cat => (
                                <th key={cat.key} className="px-3 py-2.5 whitespace-nowrap text-slate-400 border-r border-slate-800 last:border-0">
                                    {cat.short}
                                </th>
                            ))}
                            <th className="px-3 py-2.5 text-right text-slate-300 whitespace-nowrap">ИТОГО</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-100">
                            {CATEGORIES.map(cat => {
                                const amount = totals[cat.key] || 0;
                                return (
                                    <td key={cat.key} className="px-3 py-3 border-r border-slate-100 last:border-0 align-top">
                                        <div className="flex flex-col items-end gap-1.5 min-w-[80px]">
                                            <span className={`text-[11px] font-black tabular-nums font-mono ${amount > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                                                {amount > 0 ? amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸' : '—'}
                                            </span>
                                            <button
                                                onClick={() => onOpenSidebar({ type: 'addExpense', category: cat.key, categoryLabel: cat.label })}
                                                title={`Добавить: ${cat.label}`}
                                                className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all"
                                            >
                                                <PlusCircle size={9} /> Добавить
                                            </button>
                                        </div>
                                    </td>
                                );
                            })}
                            <td className="px-3 py-3 text-right align-top">
                                <span className="text-[13px] font-black tabular-nums font-mono text-slate-900">
                                    {grandTotal > 0 ? grandTotal.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸' : '—'}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Журнал расходов ───────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-none">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Журнал расходов</span>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            placeholder="Поиск..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
                        />
                        <button
                            onClick={() => onOpenSidebar({ type: 'addExpense', category: 'other', categoryLabel: 'Прочее' })}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                        >
                            <PlusCircle size={12} /> Добавить расход
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-5 py-3">Дата</th>
                                <th className="px-5 py-3">Категория</th>
                                <th className="px-5 py-3">Описание</th>
                                <th className="px-5 py-3 text-right">Сумма</th>
                                <th className="px-3 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center">
                                        <div className="flex flex-col items-center opacity-20">
                                            <FileText size={40} className="mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Нет записей</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredExpenses.map(exp => {
                                    const cat = catDef(exp.category);
                                    return (
                                        <tr key={exp.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 font-mono">
                                                    <Calendar size={10} />
                                                    {new Date(exp.date).toLocaleDateString('ru-RU')}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${cat?.color || 'bg-slate-100 text-slate-600'}`}>
                                                    {cat?.short || exp.category}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[11px] font-bold text-slate-700">{exp.description}</div>
                                                <div className="flex gap-1 mt-0.5">
                                                    {exp.receptionId && (
                                                        <span className="text-[7px] font-black uppercase px-1 py-0.5 bg-blue-50 text-blue-500 rounded border border-blue-100 flex items-center gap-0.5">
                                                            <PackageCheck size={7}/> Приёмка
                                                        </span>
                                                    )}
                                                    {exp.plannedPaymentId && (
                                                        <span className="text-[7px] font-black uppercase px-1 py-0.5 bg-indigo-50 text-indigo-500 rounded border border-indigo-100">Календарь</span>
                                                    )}
                                                    {exp.paymentId && (
                                                        <span className="text-[7px] font-black uppercase px-1 py-0.5 bg-blue-50 text-blue-500 rounded border border-blue-100">Выписка</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="text-[12px] font-black tabular-nums font-mono text-slate-900">
                                                    {exp.amountKzt.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => onDeleteExpense(exp.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
