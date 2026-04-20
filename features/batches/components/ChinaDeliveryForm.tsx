import React, { useState, useMemo } from 'react';
import { Package, Weight, Pencil, Filter, ExternalLink, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { BatchExpense, ChinaDeliveryDistribution } from '@/types/batch';
import { PreCalculationItem } from '@/types/pre-calculations';
import { ActualPayment, PlannedPayment } from '@/types';
import { CashFlowItem } from '@/types/finance';
import { EnrichedAllocation } from '../components/sidebar/types';
import { computeShares } from '../utils/batchExpenseAllocation';

const fmtKzt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type SourceMode = 'allocation' | 'calendar' | 'manual';

const METHOD_LABELS = { volume: 'По объёму', weight: 'По весу', manual: 'Вручную' } as const;
const METHOD_COLORS = {
    volume: 'bg-sky-100 text-sky-700 border-sky-200',
    weight: 'bg-violet-100 text-violet-700 border-violet-200',
    manual: 'bg-amber-100 text-amber-700 border-amber-200',
} as const;

const EXPENSE_METHOD_LABELS = { volume: 'По объёму', weight: 'По весу', manual: 'Вручную', fixed: 'По объёму' } as const;
const EXPENSE_METHOD_COLORS = {
    volume: 'bg-sky-100 text-sky-700 border-sky-200',
    weight: 'bg-violet-100 text-violet-700 border-violet-200',
    manual: 'bg-amber-100 text-amber-700 border-amber-200',
    fixed: 'bg-sky-100 text-sky-700 border-sky-200',
} as const;

interface ChinaDeliveryFormProps {
    items: PreCalculationItem[];
    batchId: string;
    actualPayments: ActualPayment[];
    plannedPayments: PlannedPayment[];
    cashFlowItems: CashFlowItem[];
    chinaExpenses: BatchExpense[];
    onSave: (expense: Omit<BatchExpense, 'id' | 'batchId'>) => Promise<any>;
    onDelete?: (id: string) => Promise<any>;
    onOpenPayment?: (paymentId: string) => void;
    onCancel: () => void;
}

interface FormState {
    description: string;
    amountKzt: number | '';
    date: string;
    paymentId?: string;
    plannedPaymentId?: string;
    allocationId?: string;
    method: 'volume' | 'weight' | 'manual';
    targetItemIds: string[];
    manualAmounts: Record<string, number | ''>;
}

const emptyForm = (items: PreCalculationItem[]): FormState => ({
    description: '',
    amountKzt: '',
    date: new Date().toISOString().split('T')[0],
    method: 'volume',
    targetItemIds: [],
    manualAmounts: Object.fromEntries(items.map(i => [i.id, ''])),
});

export const ChinaDeliveryForm: React.FC<ChinaDeliveryFormProps> = ({
    items, batchId, actualPayments, plannedPayments, cashFlowItems,
    chinaExpenses, onSave, onDelete, onOpenPayment, onCancel,
}) => {
    const [source, setSource] = useState<SourceMode>('allocation');
    const [form, setForm] = useState<FormState>(() => emptyForm(items));
    const [saving, setSaving] = useState(false);
    const [allocFilter, setAllocFilter] = useState('');
    const [expandedAllocId, setExpandedAllocId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // ── Аллокации ──────────────────────────────────────────────────────────────
    const allAllocations = useMemo<EnrichedAllocation[]>(() => {
        const ppMap = new Map(plannedPayments.map(p => [p.id, p]));
        return actualPayments.flatMap(ap =>
            (ap.allocations || [])
                .filter(a => !a.batchId || a.batchId === batchId)
                .map(a => ({
                    id: a.id,
                    actualPaymentId: a.actualPaymentId,
                    plannedPaymentId: a.plannedPaymentId,
                    cashFlowItemId: a.cashFlowItemId,
                    batchId: a.batchId,
                    amountCovered: a.amountCovered,
                    description: a.description,
                    ap,
                    pp: a.plannedPaymentId ? ppMap.get(a.plannedPaymentId) : undefined,
                }))
        );
    }, [actualPayments, plannedPayments, batchId]);

    const filteredAllocs = useMemo(() => {
        const q = allocFilter.toLowerCase();
        return allAllocations.filter(a =>
            !q ||
            a.ap.counterpartyName?.toLowerCase().includes(q) ||
            a.description?.toLowerCase().includes(q)
        );
    }, [allAllocations, allocFilter]);

    const selectAlloc = (alloc: EnrichedAllocation) => {
        setForm(prev => ({
            ...prev,
            description: alloc.description || alloc.ap.counterpartyName || '',
            amountKzt: alloc.amountCovered,
            date: alloc.ap.date,
            paymentId: alloc.actualPaymentId,
            plannedPaymentId: alloc.plannedPaymentId,
            allocationId: alloc.id,
        }));
    };

    const selectPlanned = (pp: PlannedPayment) => {
        setForm(prev => ({
            ...prev,
            description: pp.counterpartyName || '',
            amountKzt: (pp.amountDue || 0) - (pp.amountPaid || 0),
            date: pp.dueDate || prev.date,
            plannedPaymentId: pp.id,
            paymentId: undefined,
            allocationId: undefined,
        }));
    };

    // ── Позиции / предпросмотр ─────────────────────────────────────────────────
    const effectiveTargets = useMemo(() =>
        form.targetItemIds.length === 0 ? items : items.filter(i => form.targetItemIds.includes(i.id)),
        [items, form.targetItemIds]
    );

    const previewAmounts = useMemo((): Record<string, number> => {
        const amt = typeof form.amountKzt === 'number' ? form.amountKzt : 0;
        if (amt === 0 || effectiveTargets.length === 0) return {};
        if (form.method === 'manual') {
            return Object.fromEntries(
                effectiveTargets.map(i => [i.id, typeof form.manualAmounts[i.id] === 'number' ? form.manualAmounts[i.id] as number : 0])
            );
        }
        const shares = computeShares(effectiveTargets, [], form.method);
        return Object.fromEntries(effectiveTargets.map(i => [i.id, amt * (shares[i.id] || 0)]));
    }, [form, effectiveTargets]);

    const manualTotal = useMemo(() =>
        Object.values(form.manualAmounts).reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0),
        [form.manualAmounts]
    );

    const toggleItem = (id: string) => setForm(prev => ({
        ...prev,
        targetItemIds: prev.targetItemIds.includes(id)
            ? prev.targetItemIds.filter(x => x !== id)
            : [...prev.targetItemIds, id],
    }));

    const canSave = form.description && typeof form.amountKzt === 'number' && form.amountKzt > 0;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const chinaDistribution: ChinaDeliveryDistribution = {
                method: form.method,
                targetItemIds: form.targetItemIds,
                ...(form.method === 'manual' ? {
                    manualAmounts: Object.fromEntries(
                        Object.entries(form.manualAmounts)
                            .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
                            .map(([k, v]) => [k, v as number])
                    ),
                } : {}),
            };
            await onSave({
                category: 'logistics_china_domestic',
                description: form.description,
                amountKzt: form.amountKzt as number,
                date: form.date,
                paymentId: form.paymentId,
                plannedPaymentId: form.plannedPaymentId,
                allocationId: form.allocationId,
                chinaDistribution,
            });
            setForm(emptyForm(items));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!onDelete) return;
        setDeletingId(id);
        try { await onDelete(id); }
        finally { setDeletingId(null); }
    };

    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* ═══ ЛЕВЫЙ САЙДБАР — источник платежа ═══════════════════════════ */}
            <div className="w-72 flex-none flex flex-col border-r border-slate-100 bg-slate-50/50">

                {/* Вкладки */}
                <div className="flex-none px-3 pt-3 pb-2">
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                        {([
                            { key: 'allocation', label: 'Аллокации' },
                            { key: 'calendar',   label: 'Календарь' },
                            { key: 'manual',     label: 'Вручную' },
                        ] as { key: SourceMode; label: string }[]).map(s => (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => setSource(s.key)}
                                className={`py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    source === s.key ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Фильтр (только аллокации) */}
                {source === 'allocation' && (
                    <div className="flex-none px-3 pb-2">
                        <div className="relative">
                            <Filter size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={allocFilter}
                                onChange={e => setAllocFilter(e.target.value)}
                                placeholder="Фильтр по контрагенту..."
                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-medium focus:outline-none focus:border-sky-400"
                            />
                        </div>
                    </div>
                )}

                {/* Список */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">

                    {/* ── Аллокации ── */}
                    {source === 'allocation' && (
                        <>
                            {filteredAllocs.length === 0 && (
                                <p className="text-[10px] text-slate-400 text-center py-6">Нет доступных аллокаций</p>
                            )}
                            {filteredAllocs.map(alloc => {
                                const isSelected = form.allocationId === alloc.id;
                                const isExpanded = expandedAllocId === alloc.id;
                                const ap = alloc.ap;
                                return (
                                    <div
                                        key={alloc.id}
                                        className={`rounded-2xl border transition-all ${
                                            isSelected ? 'bg-sky-50 border-sky-300' : 'bg-white border-slate-200'
                                        }`}
                                    >
                                        {/* Основная строка */}
                                        <button
                                            type="button"
                                            onClick={() => selectAlloc(alloc)}
                                            className="w-full flex items-start gap-2 p-2.5 text-left"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[11px] font-black text-slate-800 truncate leading-tight">
                                                    {ap.counterpartyName}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-medium mt-0.5 truncate">
                                                    {alloc.description || ap.purpose || '—'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-[9px] text-slate-400 font-mono">{ap.date}</span>
                                                    {ap.fromAccount && (
                                                        <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{ap.fromAccount}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[12px] font-black text-sky-700 tabular-nums">
                                                        {fmtKzt(alloc.amountCovered)} ₸
                                                    </span>
                                                    {ap.amount !== alloc.amountCovered && (
                                                        <span className="text-[9px] text-slate-400 tabular-nums">
                                                            из {fmtKzt(ap.amount)} ₸
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>

                                        {/* Кнопки действий */}
                                        <div className="flex items-center gap-1 px-2.5 pb-2 pt-0">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedAllocId(isExpanded ? null : alloc.id)}
                                                className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                Детали
                                            </button>
                                            {onOpenPayment && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPayment(alloc.actualPaymentId)}
                                                    className="flex items-center gap-1 text-[9px] font-bold text-sky-500 hover:text-sky-700 transition-colors ml-2"
                                                >
                                                    <ExternalLink size={10} />
                                                    Платёж
                                                </button>
                                            )}
                                        </div>

                                        {/* Расширенная инфо */}
                                        {isExpanded && (
                                            <div className="px-2.5 pb-2.5 space-y-1 border-t border-slate-100 pt-2">
                                                {ap.documentNumber && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[9px] text-slate-400">Документ</span>
                                                        <span className="text-[9px] font-bold text-slate-600">{ap.documentNumber}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-[9px] text-slate-400">Направление</span>
                                                    <span className={`text-[9px] font-bold ${ap.direction === 'Incoming' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {ap.direction === 'Incoming' ? 'Приход' : 'Расход'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[9px] text-slate-400">Сумма платежа</span>
                                                    <span className="text-[9px] font-bold text-slate-700 tabular-nums">
                                                        {fmtKzt(ap.amount)} {ap.currency}
                                                    </span>
                                                </div>
                                                {ap.knp && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[9px] text-slate-400">КНП</span>
                                                        <span className="text-[9px] font-bold text-slate-600">{ap.knp}</span>
                                                    </div>
                                                )}
                                                {ap.purpose && (
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 block">Назначение</span>
                                                        <span className="text-[9px] text-slate-600 leading-tight block mt-0.5">{ap.purpose}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* ── Календарь ── */}
                    {source === 'calendar' && (
                        <>
                            {plannedPayments.filter(p => !p.isPaid).length === 0 && (
                                <p className="text-[10px] text-slate-400 text-center py-6">Нет неоплаченных ПП</p>
                            )}
                            {plannedPayments.filter(p => !p.isPaid).map(pp => {
                                const remaining = (pp.amountDue || 0) - (pp.amountPaid || 0);
                                const isSelected = form.plannedPaymentId === pp.id;
                                return (
                                    <button
                                        key={pp.id}
                                        type="button"
                                        onClick={() => selectPlanned(pp)}
                                        className={`w-full rounded-2xl border text-left p-2.5 transition-all ${
                                            isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        <div className="text-[11px] font-black text-slate-800 truncate leading-tight">
                                            {pp.counterpartyName}
                                        </div>
                                        {pp.paymentCounterpartyName && (
                                            <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                                                через {pp.paymentCounterpartyName}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[9px] text-slate-400 font-mono">{pp.dueDate}</span>
                                            <span className="text-[12px] font-black text-indigo-700 tabular-nums">
                                                {fmtKzt(remaining)} {pp.currency}
                                            </span>
                                        </div>
                                        {pp.amountPaid > 0 && (
                                            <div className="text-[9px] text-slate-400 mt-0.5 text-right">
                                                оплачено {fmtKzt(pp.amountPaid)} из {fmtKzt(pp.amountDue)}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* ── Вручную ── */}
                    {source === 'manual' && (
                        <div className="py-6 text-center">
                            <div className="text-[10px] text-slate-400 leading-relaxed">
                                Заполните описание,<br />сумму и дату вручную
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ ПРАВАЯ ПАНЕЛЬ — форма + позиции ═══════════════════════════ */}
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                <div className="p-5 flex flex-col gap-4 flex-1">

                    {/* Внесённые расходы */}
                    {chinaExpenses.length > 0 && (
                        <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Внесено</div>
                            <div className="space-y-1.5">
                                {chinaExpenses.map(exp => {
                                    const dist = exp.chinaDistribution;
                                    const method = dist?.method ?? 'volume';
                                    const targets = dist?.targetItemIds?.length
                                        ? items.filter(i => dist.targetItemIds.includes(i.id))
                                        : items;
                                    return (
                                        <div key={exp.id} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[11px] font-black text-slate-800">{exp.description}</span>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${EXPENSE_METHOD_COLORS[method]}`}>
                                                        {EXPENSE_METHOD_LABELS[method]}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-[12px] font-black text-sky-700 tabular-nums">{fmtKzt(exp.amountKzt)} ₸</span>
                                                    <span className="text-[9px] text-slate-400">{exp.date}</span>
                                                    <span className="text-[9px] text-slate-400">
                                                        {dist?.targetItemIds?.length
                                                            ? `${targets.length} из ${items.length} поз.`
                                                            : `все ${items.length} поз.`}
                                                    </span>
                                                </div>
                                            </div>
                                            {onDelete && (
                                                <button
                                                    onClick={() => handleDelete(exp.id)}
                                                    disabled={deletingId === exp.id}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-none"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Описание / сумма / дата */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Описание</label>
                            <input
                                type="text"
                                value={form.description}
                                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Поставщик / рейс"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium focus:outline-none focus:border-sky-400"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Сумма, ₸</label>
                            <input
                                type="number"
                                value={form.amountKzt}
                                onChange={e => setForm(prev => ({ ...prev, amountKzt: e.target.value ? Number(e.target.value) : '' }))}
                                placeholder="0"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold font-mono focus:outline-none focus:border-sky-400"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Дата</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-medium focus:outline-none focus:border-sky-400"
                            />
                        </div>
                    </div>

                    {/* Метод распределения */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Метод распределения</label>
                        <div className="flex gap-2">
                            {(['volume', 'weight', 'manual'] as const).map(m => (
                                <button key={m} type="button" onClick={() => setForm(prev => ({ ...prev, method: m }))}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                                        form.method === m ? METHOD_COLORS[m] + ' border-current shadow-sm' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                    }`}>
                                    {m === 'volume' && <Package size={11} />}
                                    {m === 'weight' && <Weight size={11} />}
                                    {m === 'manual' && <Pencil size={11} />}
                                    {METHOD_LABELS[m]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Позиции */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Позиции ({form.targetItemIds.length === 0 ? `все ${items.length}` : `${form.targetItemIds.length} из ${items.length}`})
                            </label>
                            {form.targetItemIds.length > 0 && (
                                <button type="button" onClick={() => setForm(prev => ({ ...prev, targetItemIds: [] }))}
                                    className="text-[9px] font-bold text-sky-500 hover:text-sky-700 underline">
                                    Выбрать все
                                </button>
                            )}
                        </div>
                        <div className="overflow-y-auto space-y-1 pr-0.5" style={{ maxHeight: '280px' }}>
                            {items.map(item => {
                                const isSelected = form.targetItemIds.length === 0 || form.targetItemIds.includes(item.id);
                                const preview = previewAmounts[item.id];
                                return (
                                    <label key={item.id}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer border transition-all ${
                                            isSelected ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-transparent opacity-50'
                                        }`}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleItem(item.id)}
                                            className="accent-sky-500 flex-none"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-bold text-slate-800 truncate">{item.name}</div>
                                            <div className="text-[9px] text-slate-400 font-mono flex gap-2">
                                                <span>{item.volumeM3?.toFixed(3)} м³</span>
                                                <span>{item.weightKg?.toFixed(1)} кг</span>
                                                <span>×{item.quantity}</span>
                                            </div>
                                        </div>
                                        {preview != null && preview > 0 && (
                                            <span className="text-[10px] font-black text-sky-700 tabular-nums flex-none">
                                                {fmtKzt(Math.round(preview))} ₸
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Ручные суммы */}
                    {form.method === 'manual' && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Суммы по позициям</label>
                                <span className={`text-[10px] font-bold ${
                                    typeof form.amountKzt === 'number' && manualTotal !== form.amountKzt ? 'text-red-500' : 'text-emerald-600'
                                }`}>
                                    {fmtKzt(manualTotal)} / {fmtKzt(typeof form.amountKzt === 'number' ? form.amountKzt : 0)} ₸
                                </span>
                            </div>
                            <div className="space-y-1">
                                {effectiveTargets.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-xl">
                                        <div className="flex-1 text-[11px] font-medium text-slate-700 truncate">{item.name}</div>
                                        <input
                                            type="number"
                                            value={form.manualAmounts[item.id] ?? ''}
                                            onChange={e => setForm(prev => ({
                                                ...prev,
                                                manualAmounts: { ...prev.manualAmounts, [item.id]: e.target.value ? Number(e.target.value) : '' },
                                            }))}
                                            placeholder="0 ₸"
                                            className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-right focus:outline-none focus:border-amber-400"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Кнопки */}
                    <div className="flex gap-2 pt-1 justify-end mt-auto">
                        <button type="button" onClick={onCancel}
                            className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                            Отмена
                        </button>
                        <button type="button" onClick={handleSave}
                            disabled={saving || !canSave}
                            className="px-5 py-2 text-[10px] font-black text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all">
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
