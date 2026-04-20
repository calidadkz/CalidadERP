import React, { useState, useMemo } from 'react';
import { Calendar, FileText, CreditCard } from 'lucide-react';
import { BatchExpense, PlannedPayment, ActualPayment } from '@/types';
import { CashFlowItem } from '@/types/finance';
import { AddState, SourceType, EnrichedAllocation } from './types';
import { AllocationPanel } from './AllocationPanel';

interface AddExpensePanelProps {
    batchId: string;
    adding: AddState;
    setAdding: React.Dispatch<React.SetStateAction<AddState>>;
    saving: boolean;
    categoryExpenses: BatchExpense[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    cashFlowItems: CashFlowItem[];
    priorityCashFlowItemId?: string;
    onSelectPlanned: (pp: PlannedPayment) => void;
    onSelectActual: (ap: ActualPayment) => void;
    onSelectAllocation: (alloc: EnrichedAllocation) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
}

export const AddExpensePanel: React.FC<AddExpensePanelProps> = ({
    batchId, adding, setAdding, saving, categoryExpenses,
    plannedPayments, actualPayments, cashFlowItems,
    priorityCashFlowItemId,
    onSelectPlanned, onSelectActual, onSelectAllocation, onSubmit, onCancel,
}) => {
    const fmtAmt = (v: number) => v > 0 ? v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸' : '—';

    const [filterCounterparty, setFilterCounterparty] = useState('');
    const [filterCashFlowItemId, setFilterCashFlowItemId] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [selectedAllocId, setSelectedAllocId] = useState<string | null>(null);

    // Обогащённые аллокации из всех выписок.
    // Показываем только те, что свободны (batchId нет) ИЛИ уже привязаны к ЭТОЙ партии.
    const allAllocations = useMemo<EnrichedAllocation[]>(() => {
        const ppMap = new Map(plannedPayments.map(p => [p.id, p]));
        return actualPayments.flatMap(ap =>
            (ap.allocations || [])
                .filter(alloc => !alloc.batchId || alloc.batchId === batchId)
                .map(alloc => ({
                    id: alloc.id,
                    actualPaymentId: alloc.actualPaymentId,
                    plannedPaymentId: alloc.plannedPaymentId,
                    cashFlowItemId: alloc.cashFlowItemId,
                    batchId: alloc.batchId,
                    amountCovered: alloc.amountCovered,
                    description: alloc.description,
                    ap,
                    pp: alloc.plannedPaymentId ? ppMap.get(alloc.plannedPaymentId) : undefined,
                }))
        );
    }, [actualPayments, plannedPayments, batchId]);

    const counterpartyOptions = useMemo(() => {
        const seen = new Map<string, string>();
        allAllocations.forEach(a => {
            if (!seen.has(a.ap.counterpartyId)) seen.set(a.ap.counterpartyId, a.ap.counterpartyName);
        });
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [allAllocations]);

    const usedCashFlowItems = useMemo(() => {
        const usedIds = new Set(allAllocations.map(a => a.cashFlowItemId));
        return cashFlowItems.filter(c => usedIds.has(c.id));
    }, [allAllocations, cashFlowItems]);

    const filteredAllocations = useMemo(() =>
        allAllocations.filter(a => {
            if (filterCounterparty && a.ap.counterpartyId !== filterCounterparty) return false;
            if (filterCashFlowItemId && a.cashFlowItemId !== filterCashFlowItemId) return false;
            if (filterDate && a.ap.date !== filterDate) return false;
            return true;
        }),
        [allAllocations, filterCounterparty, filterCashFlowItemId, filterDate]
    );

    const cashFlowItemMap = useMemo(() =>
        new Map(cashFlowItems.map(c => [c.id, c])),
        [cashFlowItems]
    );

    const handleAllocClick = (alloc: EnrichedAllocation) => {
        setSelectedAllocId(alloc.id);
        onSelectAllocation(alloc);
    };

    const SOURCES: { key: SourceType; label: string }[] = [
        { key: 'manual', label: 'Вручную' },
        { key: 'calendar', label: 'Календарь' },
        { key: 'statement', label: 'Выписка' },
        { key: 'allocation', label: 'Аллокации' },
    ];

    return (
        <div className="p-4 space-y-4">
            {/* Переключатель источника */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
                {SOURCES.map(s => (
                    <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                            setAdding(prev => ({ ...prev, source: s.key }));
                            setSelectedAllocId(null);
                        }}
                        className={`px-1.5 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            adding.source === s.key ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {s.label}
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

            {/* Список из аллокаций */}
            {adding.source === 'allocation' && (
                <AllocationPanel
                    batchId={batchId}
                    allocations={filteredAllocations}
                    allAllocationsCount={allAllocations.length}
                    counterpartyOptions={counterpartyOptions}
                    cashFlowItemOptions={usedCashFlowItems}
                    cashFlowItemMap={cashFlowItemMap}
                    filterCounterparty={filterCounterparty}
                    filterCashFlowItemId={filterCashFlowItemId}
                    filterDate={filterDate}
                    selectedAllocId={selectedAllocId}
                    priorityCashFlowItemId={priorityCashFlowItemId}
                    onFilterCounterparty={setFilterCounterparty}
                    onFilterCashFlowItem={setFilterCashFlowItemId}
                    onFilterDate={setFilterDate}
                    onSelect={handleAllocClick}
                />
            )}

            {/* Форма (скрыта для allocation пока не выбрана) */}
            {(adding.source !== 'allocation' || selectedAllocId) && (
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
                        <div className="flex gap-1.5 flex-wrap">
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
                            {adding.allocationId && (
                                <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-[8px] font-black uppercase border border-violet-100 flex items-center gap-1">
                                    <CreditCard size={8}/> Аллокация
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
            )}

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
                                    <div className="text-[10px] font-bold text-slate-700 truncate max-w-[180px]">{exp.description}</div>
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
