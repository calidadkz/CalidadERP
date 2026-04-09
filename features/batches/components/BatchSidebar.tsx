import React, { useState } from 'react';
import {
    X, DollarSign, TrendingUp, TrendingDown, Tag, Calendar,
    FileText, PlusCircle, ChevronRight, Layers, PackageCheck
} from 'lucide-react';
import { BatchExpense, ExpenseCategory, PlannedPayment, ActualPayment, Reception } from '@/types';

export interface SidebarContext {
    type: 'summary' | 'addExpense';
    category?: ExpenseCategory;
    categoryLabel?: string;
}

interface BatchStats {
    plannedRevenue: number;
    plannedExpenses: number;
    plannedProfit: number;
    actualRevenue: number;
    totalActualExpenses: number;
    actualProfit: number;
    profitDiffPercent: number;
    revenueProgress: number;
}

interface BatchSidebarProps {
    context: SidebarContext;
    onClose: () => void;
    stats: BatchStats | null;
    expenses: BatchExpense[];
    receptions: Reception[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    onAddExpense: (expense: Omit<BatchExpense, 'id' | 'batchId'>) => Promise<any>;
}

const fmt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

const fmtShort = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' млн ₸';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + ' тыс ₸';
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸';
};

type SourceType = 'manual' | 'calendar' | 'statement';

interface AddState {
    source: SourceType;
    description: string;
    amountKzt: number;
    date: string;
    plannedPaymentId?: string;
    paymentId?: string;
}

export const BatchSidebar: React.FC<BatchSidebarProps> = ({
    context,
    onClose,
    stats,
    expenses,
    receptions,
    plannedPayments,
    actualPayments,
    onAddExpense,
}) => {
    const [adding, setAdding] = useState<AddState>({
        source: 'manual',
        description: '',
        amountKzt: 0,
        date: new Date().toISOString().split('T')[0],
    });
    const [saving, setSaving] = useState(false);

    // Сбросить форму при смене категории
    React.useEffect(() => {
        setAdding({ source: 'manual', description: '', amountKzt: 0, date: new Date().toISOString().split('T')[0] });
    }, [context.category]);

    const handleSelectPlanned = (pp: PlannedPayment) => {
        setAdding(prev => ({
            ...prev,
            source: 'manual',
            description: pp.counterpartyName || '',
            amountKzt: (pp.amountDue || 0) - (pp.amountPaid || 0),
            date: pp.dueDate || prev.date,
            plannedPaymentId: pp.id,
            paymentId: undefined,
        }));
    };

    const handleSelectActual = (ap: ActualPayment) => {
        setAdding(prev => ({
            ...prev,
            source: 'manual',
            description: `${ap.counterpartyName || ''}${ap.purpose ? ': ' + ap.purpose : ''}`,
            amountKzt: ap.totalCostKzt || ap.amount || 0,
            date: ap.date,
            paymentId: ap.id,
            plannedPaymentId: undefined,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!context.category || adding.amountKzt <= 0 || !adding.description) return;
        setSaving(true);
        try {
            await onAddExpense({
                category: context.category,
                description: adding.description,
                amountKzt: adding.amountKzt,
                date: adding.date,
                plannedPaymentId: adding.plannedPaymentId,
                paymentId: adding.paymentId,
            });
            setAdding({ source: 'manual', description: '', amountKzt: 0, date: new Date().toISOString().split('T')[0] });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    // Расходы по текущей категории (для истории)
    const categoryExpenses = context.category
        ? expenses.filter(e => e.category === context.category)
        : [];

    return (
        <div className="w-80 flex-none flex flex-col bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            {/* Шапка */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {context.type === 'summary' ? 'Сводка по партии' : `Внести: ${context.categoryLabel}`}
                </span>
                {context.type !== 'summary' && (
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {context.type === 'summary' && stats && (
                    <SummaryPanel stats={stats} receptions={receptions} />
                )}
                {context.type === 'summary' && !stats && (
                    <div className="p-6 text-center text-slate-300 text-xs">Данных нет</div>
                )}

                {context.type === 'addExpense' && context.category && (
                    <AddExpensePanel
                        adding={adding}
                        setAdding={setAdding}
                        saving={saving}
                        categoryExpenses={categoryExpenses}
                        plannedPayments={plannedPayments}
                        actualPayments={actualPayments}
                        onSelectPlanned={handleSelectPlanned}
                        onSelectActual={handleSelectActual}
                        onSubmit={handleSubmit}
                        onCancel={onClose}
                    />
                )}
            </div>
        </div>
    );
};

// ── Сводка ────────────────────────────────────────────────────────────────────

const SummaryPanel: React.FC<{ stats: BatchStats; receptions: Reception[] }> = ({ stats, receptions }) => {
    const profitPositive = stats.actualProfit >= 0;
    const profitDiffPositive = stats.profitDiffPercent >= 0;

    return (
        <div className="p-5 space-y-4">
            {/* Прибыль — главная карточка */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-600/10 rounded-full blur-2xl" />
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <DollarSign size={10} className="text-blue-400" /> Факт. прибыль
                </div>
                <div className={`text-2xl font-black tabular-nums tracking-tighter ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtShort(stats.actualProfit)}
                </div>
                <div className={`text-[10px] font-black mt-1 flex items-center gap-1 ${profitDiffPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                    {profitDiffPositive ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                    {stats.profitDiffPercent > 0 ? '+' : ''}{stats.profitDiffPercent.toFixed(1)}% от прогноза
                </div>
            </div>

            {/* Выручка */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <TrendingUp size={10} className="text-emerald-500" /> Выручка
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Прогноз</div>
                        <div className="text-sm font-black text-slate-600 tabular-nums">{fmtShort(stats.plannedRevenue)}</div>
                    </div>
                    <ChevronRight size={14} className="text-slate-200 mx-2" />
                    <div className="text-right">
                        <div className="text-[9px] text-emerald-600 font-black uppercase">Факт</div>
                        <div className="text-sm font-black text-emerald-600 tabular-nums">{fmtShort(stats.actualRevenue)}</div>
                    </div>
                </div>
                {/* Прогресс-бар */}
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, stats.revenueProgress)}%` }}
                    />
                </div>
                <div className="text-[8px] font-bold text-slate-400 text-right">{stats.revenueProgress.toFixed(0)}%</div>
            </div>

            {/* Расходы */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Tag size={10} className="text-amber-500" /> Расходы
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Прогноз</div>
                        <div className="text-sm font-black text-slate-600 tabular-nums">{fmtShort(stats.plannedExpenses)}</div>
                    </div>
                    <ChevronRight size={14} className="text-slate-200 mx-2" />
                    <div className="text-right">
                        <div className="text-[9px] text-amber-600 font-black uppercase">Факт</div>
                        <div className="text-sm font-black text-amber-600 tabular-nums">{fmtShort(stats.totalActualExpenses)}</div>
                    </div>
                </div>
            </div>

            {/* Прогноз прибыли */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Прогноз прибыли</span>
                <span className="text-sm font-black text-slate-700 tabular-nums">{fmtShort(stats.plannedProfit)}</span>
            </div>

            {/* Приёмки */}
            {receptions.length > 0 && (
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <PackageCheck size={10} className="text-blue-500" /> Приёмки ({receptions.length})
                    </div>
                    <div className="divide-y divide-slate-50">
                        {receptions.map(r => (
                            <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-black text-slate-700">
                                        {new Date(r.date).toLocaleDateString('ru-RU')}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-bold">{r.id.slice(-8).toUpperCase()}</div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                    r.status === 'Posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                }`}>{r.status === 'Posted' ? 'Проведена' : 'Черновик'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Форма добавления расхода ──────────────────────────────────────────────────

interface AddExpensePanelProps {
    adding: AddState;
    setAdding: React.Dispatch<React.SetStateAction<AddState>>;
    saving: boolean;
    categoryExpenses: BatchExpense[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    onSelectPlanned: (pp: PlannedPayment) => void;
    onSelectActual: (ap: ActualPayment) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
}

const AddExpensePanel: React.FC<AddExpensePanelProps> = ({
    adding, setAdding, saving, categoryExpenses,
    plannedPayments, actualPayments,
    onSelectPlanned, onSelectActual, onSubmit, onCancel,
}) => {
    const fmtAmt = (v: number) => v > 0 ? v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸' : '—';

    return (
        <div className="p-4 space-y-4">
            {/* Переключатель источника */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                {(['manual', 'calendar', 'statement'] as SourceType[]).map(s => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setAdding(prev => ({ ...prev, source: s }))}
                        className={`flex-1 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            adding.source === s ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {s === 'manual' ? 'Вручную' : s === 'calendar' ? 'Календарь' : 'Выписки'}
                    </button>
                ))}
            </div>

            {/* Список из календаря */}
            {adding.source === 'calendar' && (
                <div className="max-h-52 overflow-auto space-y-1.5 rounded-xl border border-slate-100 p-2 bg-slate-50">
                    {plannedPayments.filter(p => !p.isPaid).length === 0 && (
                        <p className="text-[10px] text-slate-400 text-center py-4">Нет неоплаченных ПП</p>
                    )}
                    {plannedPayments.filter(p => !p.isPaid).map(pp => (
                        <button key={pp.id} onClick={() => onSelectPlanned(pp)}
                            className="w-full flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 transition-all text-left">
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-black text-slate-800 truncate">{pp.counterpartyName}</div>
                                <div className="text-[8px] text-slate-400 font-bold">{pp.dueDate}</div>
                            </div>
                            <span className="text-[10px] font-black font-mono text-slate-900 ml-2 whitespace-nowrap">
                                {fmtAmt((pp.amountDue || 0) - (pp.amountPaid || 0))}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Список из выписок */}
            {adding.source === 'statement' && (
                <div className="max-h-52 overflow-auto space-y-1.5 rounded-xl border border-slate-100 p-2 bg-slate-50">
                    {actualPayments.length === 0 && (
                        <p className="text-[10px] text-slate-400 text-center py-4">Нет платежей</p>
                    )}
                    {actualPayments.map(ap => (
                        <button key={ap.id} onClick={() => onSelectActual(ap)}
                            className="w-full flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 transition-all text-left">
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-black text-slate-800 truncate">{ap.counterpartyName}</div>
                                <div className="text-[8px] text-slate-400 font-bold truncate">{ap.purpose || 'Без назначения'}</div>
                            </div>
                            <span className="text-[10px] font-black font-mono text-slate-900 ml-2 whitespace-nowrap">
                                {fmtAmt(ap.totalCostKzt || ap.amount || 0)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Форма */}
            <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Описание</label>
                    <input
                        type="text"
                        value={adding.description}
                        onChange={e => setAdding(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Контрагент / назначение"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none focus:border-indigo-400"
                        required
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Сумма (₸)</label>
                        <input
                            type="number"
                            value={adding.amountKzt || ''}
                            onChange={e => setAdding(prev => ({ ...prev, amountKzt: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none focus:border-indigo-400"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Дата</label>
                        <input
                            type="date"
                            value={adding.date}
                            onChange={e => setAdding(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none focus:border-indigo-400"
                        />
                    </div>
                </div>

                {/* Бейджи привязки */}
                {(adding.plannedPaymentId || adding.paymentId) && (
                    <div className="flex gap-1.5">
                        {adding.plannedPaymentId && (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black uppercase border border-indigo-100 flex items-center gap-1">
                                <Calendar size={8}/> Календарь
                            </span>
                        )}
                        {adding.paymentId && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase border border-blue-100 flex items-center gap-1">
                                <FileText size={8}/> Выписка
                            </span>
                        )}
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onCancel}
                        className="flex-1 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl transition-all">
                        Отмена
                    </button>
                    <button type="submit" disabled={saving}
                        className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-800 transition-all shadow disabled:opacity-50">
                        {saving ? 'Сохраняю...' : 'Сохранить'}
                    </button>
                </div>
            </form>

            {/* Уже внесённые по этой категории */}
            {categoryExpenses.length > 0 && (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 text-[8px] font-black uppercase tracking-widest text-slate-400">
                        Уже внесено по статье
                    </div>
                    <div className="divide-y divide-slate-50 max-h-40 overflow-auto">
                        {categoryExpenses.map(exp => (
                            <div key={exp.id} className="px-3 py-2 flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-700 truncate max-w-[140px]">{exp.description}</div>
                                    <div className="text-[8px] text-slate-400">
                                        {new Date(exp.date).toLocaleDateString('ru-RU')}
                                        {exp.receptionId && <span className="ml-1 text-blue-400">• Приёмка</span>}
                                        {exp.paymentId && <span className="ml-1 text-blue-400">• Выписка</span>}
                                    </div>
                                </div>
                                <span className="text-[11px] font-black font-mono text-slate-900 ml-2 whitespace-nowrap">
                                    {exp.amountKzt.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="px-3 py-2 bg-slate-50 flex justify-between">
                        <span className="text-[9px] font-black uppercase text-slate-400">Итого</span>
                        <span className="text-[11px] font-black font-mono text-slate-900">
                            {categoryExpenses.reduce((s, e) => s + e.amountKzt, 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
