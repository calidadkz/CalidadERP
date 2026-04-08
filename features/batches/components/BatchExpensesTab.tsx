import React, { useState, useMemo } from 'react';
import { BatchExpense, ExpenseCategory, PlannedPayment, ActualPayment } from '@/types';
import { PlusCircle, Trash2, Calendar, FileText, X, ChevronDown, ChevronUp } from 'lucide-react';

interface BatchExpensesTabProps {
    expenses: BatchExpense[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    onAddExpense: (expense: Omit<BatchExpense, 'id' | 'batchId'>) => Promise<any>;
    onDeleteExpense: (id: string) => Promise<void>;
}

interface CategoryDef {
    key: ExpenseCategory;
    label: string;
    short: string;
    color: string; // tailwind bg для заголовка
}

const CATEGORIES: CategoryDef[] = [
    { key: 'logistics_urumqi_almaty',  label: 'Доставка Урумчи–Алматы',       short: 'Урумчи–Алм.',   color: 'bg-blue-50 text-blue-700' },
    { key: 'logistics_almaty_karaganda', label: 'Доставка Алматы–Кар.',        short: 'Алм.–Кар.',     color: 'bg-blue-50 text-blue-700' },
    { key: 'logistics_china_domestic', label: 'Доставка по Китаю',             short: 'По Китаю',      color: 'bg-sky-50 text-sky-700' },
    { key: 'svh',                      label: 'СВХ',                           short: 'СВХ',           color: 'bg-amber-50 text-amber-700' },
    { key: 'broker',                   label: 'Брокер',                        short: 'Брокер',        color: 'bg-amber-50 text-amber-700' },
    { key: 'customs',                  label: 'Таможенные сборы',              short: 'Тамож.',        color: 'bg-amber-50 text-amber-700' },
    { key: 'customs_vat',              label: 'НДС Таможенный',                short: 'НДС Там.',      color: 'bg-violet-50 text-violet-700' },
    { key: 'sales_vat',                label: 'НДС итог. при продаже',         short: 'НДС Пр.',       color: 'bg-violet-50 text-violet-700' },
    { key: 'resale_vat',               label: 'НДС перепродажи (Упр.)',        short: 'НДС Упр.',      color: 'bg-violet-50 text-violet-700' },
    { key: 'kpn_simplified',           label: 'КПН (Упр.)',                    short: 'КПН4',          color: 'bg-rose-50 text-rose-700' },
    { key: 'kpn_standard',             label: 'КПН20',                         short: 'КПН20',         color: 'bg-rose-50 text-rose-700' },
    { key: 'pnr',                      label: 'Пусконаладка',                  short: 'ПНР',           color: 'bg-emerald-50 text-emerald-700' },
    { key: 'delivery_local',           label: 'Доставка до клиента',           short: 'До клиента',    color: 'bg-emerald-50 text-emerald-700' },
    { key: 'other',                    label: 'Прочее',                        short: 'Прочее',        color: 'bg-slate-50 text-slate-600' },
];

type SourceType = 'manual' | 'calendar' | 'statement';

interface AddState {
    category: ExpenseCategory;
    source: SourceType;
    description: string;
    amountKzt: number;
    date: string;
    plannedPaymentId?: string;
    paymentId?: string;
}

const fmt = (v: number) => v > 0 ? v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸' : '—';

export const BatchExpensesTab: React.FC<BatchExpensesTabProps> = ({
    expenses,
    plannedPayments,
    actualPayments,
    onAddExpense,
    onDeleteExpense,
}) => {
    const [adding, setAdding] = useState<AddState | null>(null);
    const [search, setSearch] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

    const openAdd = (category: ExpenseCategory) => {
        setAdding({
            category,
            source: 'manual',
            description: '',
            amountKzt: 0,
            date: new Date().toISOString().split('T')[0],
        });
    };

    const handleSelectPlanned = (pp: PlannedPayment) => {
        if (!adding) return;
        setAdding({
            ...adding,
            source: 'manual',
            description: `${pp.counterpartyName}`,
            amountKzt: pp.amountDue - pp.amountPaid,
            date: pp.dueDate || adding.date,
            plannedPaymentId: pp.id,
            paymentId: undefined,
        });
    };

    const handleSelectActual = (ap: ActualPayment) => {
        if (!adding) return;
        setAdding({
            ...adding,
            source: 'manual',
            description: `${ap.counterpartyName}${ap.purpose ? ': ' + ap.purpose : ''}`,
            amountKzt: ap.totalCostKzt || ap.amount,
            date: ap.date,
            paymentId: ap.id,
            plannedPaymentId: undefined,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adding || adding.amountKzt <= 0 || !adding.description) return;
        await onAddExpense({
            category: adding.category,
            description: adding.description,
            amountKzt: adding.amountKzt,
            date: adding.date,
            plannedPaymentId: adding.plannedPaymentId,
            paymentId: adding.paymentId,
        });
        setAdding(null);
    };

    const catDef = (key: ExpenseCategory) => CATEGORIES.find(c => c.key === key);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <div className="flex flex-col h-full gap-4">

            {/* ── Таблица итогов по категориям ─────────────────────── */}
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
                        {/* Строка итогов + кнопки + */}
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
                                                onClick={() => openAdd(cat.key)}
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

            {/* ── Панель добавления ─────────────────────────────────── */}
            {adding && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between mb-4">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${catDef(adding.category)?.color}`}>
                            {catDef(adding.category)?.label}
                        </span>
                        <button onClick={() => setAdding(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Переключатель источника */}
                    <div className="flex gap-2 mb-4 border-b border-slate-200 pb-3">
                        {(['manual', 'calendar', 'statement'] as SourceType[]).map(s => (
                            <button
                                key={s}
                                onClick={() => setAdding({ ...adding, source: s })}
                                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    adding.source === s
                                        ? s === 'calendar' ? 'bg-indigo-600 text-white'
                                        : s === 'statement' ? 'bg-blue-600 text-white'
                                        : 'bg-slate-900 text-white'
                                        : 'text-slate-400 hover:bg-slate-200'
                                }`}
                            >
                                {s === 'manual' ? 'Вручную' : s === 'calendar' ? 'Из Календаря' : 'Из Выписок'}
                            </button>
                        ))}
                    </div>

                    {adding.source === 'calendar' && (
                        <div className="max-h-64 overflow-auto space-y-1.5 mb-2">
                            {plannedPayments.filter(p => !p.isPaid).length === 0 && (
                                <p className="text-[10px] text-slate-400 text-center py-4">Нет неоплаченных плановых платежей</p>
                            )}
                            {plannedPayments.filter(p => !p.isPaid).map(pp => (
                                <button key={pp.id} onClick={() => handleSelectPlanned(pp)}
                                    className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left">
                                    <div>
                                        <div className="text-[11px] font-black text-slate-800">{pp.counterpartyName}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{pp.sourceDocId} · {pp.dueDate}</div>
                                    </div>
                                    <span className="text-[11px] font-black font-mono text-slate-900 ml-4 whitespace-nowrap">
                                        {fmt(pp.amountDue - pp.amountPaid)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {adding.source === 'statement' && (
                        <div className="max-h-64 overflow-auto space-y-1.5 mb-2">
                            {actualPayments.length === 0 && (
                                <p className="text-[10px] text-slate-400 text-center py-4">Нет платежей в выписках</p>
                            )}
                            {actualPayments.map(ap => (
                                <button key={ap.id} onClick={() => handleSelectActual(ap)}
                                    className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all text-left">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-black text-slate-800 truncate">{ap.counterpartyName}</div>
                                        <div className="text-[9px] text-slate-400 font-bold truncate mt-0.5">{ap.purpose || 'Без назначения'}</div>
                                    </div>
                                    <span className="text-[11px] font-black font-mono text-slate-900 ml-4 whitespace-nowrap">
                                        {fmt(ap.totalCostKzt || ap.amount)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Форма ввода (всегда видна, заполняется из источника или вручную) */}
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Описание</label>
                                <input
                                    type="text"
                                    value={adding.description}
                                    onChange={e => setAdding({ ...adding, description: e.target.value })}
                                    placeholder="Контрагент / назначение"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Сумма (₸)</label>
                                <input
                                    type="number"
                                    value={adding.amountKzt || ''}
                                    onChange={e => setAdding({ ...adding, amountKzt: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                            <div className="flex gap-1.5">
                                {adding.plannedPaymentId && (
                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase border border-indigo-100">Календарь</span>
                                )}
                                {adding.paymentId && (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase border border-blue-100">Выписка</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setAdding(null)}
                                    className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700">
                                    Отмена
                                </button>
                                <button type="submit"
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-800 transition-all shadow">
                                    Сохранить
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Журнал расходов ───────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Журнал расходов</span>
                    <input
                        type="text"
                        placeholder="Поиск..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
                    />
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
