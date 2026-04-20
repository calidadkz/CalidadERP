
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    ReceptionExpense, ExpenseAllocationMethod, ReceptionItem,
    Currency, PreCalculationItem, ActualPayment, PlannedPayment
} from '@/types';
import {
    Truck, Plus, Trash2, ChevronDown, ChevronRight,
    Layers, RotateCcw, CheckCircle2, Circle, PenLine
} from 'lucide-react';
import { ApiService } from '@/services/api';

const EAM = ExpenseAllocationMethod;
const fmtKzt = (v: number) => Math.round(v).toLocaleString('ru-RU');

// ── Все типы расходов ─────────────────────────────────────────────────────────
const ALL_EXPENSE_TYPES = [
    'Доставка по Китаю',
    'Доставка Урумчи-Алматы',
    'Доставка Алматы-Кар.',
    'СВХ',
    'Брокер',
    'Сборы',
    'НДС',
    'ПНР',
    'Доставка до клиента',
    'Прочее',
];

// ── Методы распределения ──────────────────────────────────────────────────────
const GENERAL_METHODS = [EAM.BY_VOLUME, EAM.BY_VALUE, EAM.BY_QUANTITY, EAM.BY_EQUAL];
const METHOD_LABELS: Record<string, string> = {
    [EAM.BY_VOLUME]:    'По объёму',
    [EAM.BY_VALUE]:     'По стоимости',
    [EAM.BY_QUANTITY]:  'По кол-ву',
    [EAM.BY_EQUAL]:     'Поровну',
    [EAM.SPECIFIC_ITEM]:'На позицию',
};

// ── Категории партии → поля предрасчёта ──────────────────────────────────────
type PCKey = 'deliveryChinaDomesticKzt' | 'deliveryUrumqiAlmatyKzt' |
    'deliveryAlmatyKaragandaPerItemKzt' | 'svhPerItemKzt' | 'brokerPerItemKzt' |
    'customsFeesPerItemKzt' | 'customsNdsKzt' | 'pnrKzt';

interface BatchCatDef { expType: string; label: string; key: PCKey; method: ExpenseAllocationMethod; }

const BATCH_CATS: BatchCatDef[] = [
    { expType: 'Доставка по Китаю',      label: 'Дост. по Китаю',  key: 'deliveryChinaDomesticKzt',         method: EAM.BY_VOLUME },
    { expType: 'Доставка Урумчи-Алматы', label: 'Урумчи–Алматы',  key: 'deliveryUrumqiAlmatyKzt',          method: EAM.BY_VOLUME },
    { expType: 'Доставка Алматы-Кар.',   label: 'Алматы–Кар.',     key: 'deliveryAlmatyKaragandaPerItemKzt',method: EAM.BY_VOLUME },
    { expType: 'СВХ',                    label: 'СВХ',             key: 'svhPerItemKzt',                    method: EAM.BY_VALUE  },
    { expType: 'Брокер',                 label: 'Брокер',          key: 'brokerPerItemKzt',                 method: EAM.BY_VALUE  },
    { expType: 'Сборы',                  label: 'Тамож. сборы',    key: 'customsFeesPerItemKzt',            method: EAM.BY_VALUE  },
    { expType: 'НДС',                    label: 'НДС',             key: 'customsNdsKzt',                    method: EAM.BY_VALUE  },
    { expType: 'ПНР',                    label: 'ПНР',             key: 'pnrKzt',                           method: EAM.BY_VALUE  },
];

interface BatchRow extends BatchCatDef {
    plannedTotal: number;
    actualAmount: number;
    enabled: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ExpenseFormProps {
    expenses: ReceptionExpense[];
    setExpenses: React.Dispatch<React.SetStateAction<ReceptionExpense[]>>;
    items: ReceptionItem[];
    batchId?: string;
    preCalcItems?: PreCalculationItem[];
    actualPayments?: ActualPayment[];
    plannedPayments?: PlannedPayment[];
    orderId?: string;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
    expenses, setExpenses, items,
    batchId, preCalcItems, actualPayments, plannedPayments, orderId
}) => {
    const hasBatch = !!batchId;
    const [tab, setTab] = useState<'batch' | 'manual'>(hasBatch ? 'batch' : 'manual');
    const [openSections, setOpenSections] = useState<Set<string>>(new Set(['general']));
    const [showBreakdown, setShowBreakdown] = useState(false);

    // ── Batch rows ────────────────────────────────────────────────────────────
    const [batchRows, setBatchRows] = useState<BatchRow[]>(() =>
        BATCH_CATS.map(c => ({ ...c, plannedTotal: 0, actualAmount: 0, enabled: false }))
    );
    const initialized = useRef(false);

    const computedBatchRows = useMemo<BatchRow[]>(() => {
        return BATCH_CATS.map(cat => {
            let total = 0;
            items.forEach(recItem => {
                const pc = preCalcItems?.find(p => p.productId === recItem.productId);
                if (pc) total += (Number(pc[cat.key]) || 0) * (Number(recItem.qtyFact) || 0);
            });
            return { ...cat, plannedTotal: total, actualAmount: total, enabled: total > 0 };
        });
    }, [preCalcItems, items]);

    useEffect(() => {
        if (!initialized.current && preCalcItems && preCalcItems.length > 0) {
            initialized.current = true;
            setBatchRows(computedBatchRows);
        }
    }, [computedBatchRows, preCalcItems]);

    const applyBatchExpenses = () => {
        const newBatch: ReceptionExpense[] = batchRows
            .filter(r => r.enabled && r.actualAmount > 0)
            .map(r => ({
                id: ApiService.generateId(),
                type: r.expType,
                amount: r.actualAmount,
                currency: Currency.Kzt,
                exchangeRateToKzt: 1,
                allocationMethod: r.method,
                sourceMode: 'batch' as const,
            }));
        setExpenses(prev => [...prev.filter(e => e.sourceMode !== 'batch'), ...newBatch]);
    };

    const resetToPlanned = () => {
        initialized.current = false;
        setBatchRows(computedBatchRows);
    };

    const batchAppliedCount = expenses.filter(e => e.sourceMode === 'batch').length;
    const batchActualTotal  = batchRows.filter(r => r.enabled).reduce((s, r) => s + r.actualAmount, 0);
    const batchPlannedTotal = batchRows.reduce((s, r) => s + r.plannedTotal, 0);

    // ── Per-item breakdown ────────────────────────────────────────────────────
    const itemBreakdown = useMemo(() =>
        items.map(recItem => {
            const pc = preCalcItems?.find(p => p.productId === recItem.productId);
            const cols: Record<PCKey, number> = {} as any;
            let total = 0;
            BATCH_CATS.forEach(c => {
                const v = pc ? (Number(pc[c.key]) || 0) * (Number(recItem.qtyFact) || 0) : 0;
                cols[c.key] = v;
                total += v;
            });
            return { item: recItem, cols, total };
        }),
    [preCalcItems, items]);

    // ── Manual expenses ───────────────────────────────────────────────────────
    const manualExp    = expenses.filter(e => e.sourceMode !== 'batch');
    const generalExp   = manualExp.filter(e => e.allocationMethod !== EAM.SPECIFIC_ITEM);
    const specificExp  = manualExp.filter(e => e.allocationMethod === EAM.SPECIFIC_ITEM);

    const updateExp = (id: string, patch: Partial<ReceptionExpense>) =>
        setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

    const deleteExp = (id: string) =>
        setExpenses(prev => prev.filter(e => e.id !== id));

    const addGeneral = () => setExpenses(prev => [...prev, {
        id: ApiService.generateId(), type: 'СВХ', amount: 0,
        currency: Currency.Kzt, exchangeRateToKzt: 1,
        allocationMethod: EAM.BY_VALUE, sourceMode: 'manual',
    }]);

    const addSpecific = () => setExpenses(prev => [...prev, {
        id: ApiService.generateId(), type: 'Прочее', amount: 0,
        currency: Currency.Kzt, exchangeRateToKzt: 1,
        allocationMethod: EAM.SPECIFIC_ITEM, targetItemId: items[0]?.id || '',
        sourceMode: 'manual',
    }]);

    const toggleSection = (k: string) => setOpenSections(prev => {
        const s = new Set(prev);
        s.has(k) ? s.delete(k) : s.add(k);
        return s;
    });

    // ── Document options ──────────────────────────────────────────────────────
    const docOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [];
        (actualPayments || []).slice(-50).forEach(p => {
            const d = new Date(p.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            opts.push({ value: `pay:${p.id}`, label: `Выписка ${d} · ${fmtKzt(Number(p.amount) || 0)} ${p.currency}` });
        });
        (plannedPayments || []).filter(p => !orderId || p.sourceDocId === orderId).forEach(p => {
            const amt = fmtKzt(Number(p.amountDue) || 0);
            opts.push({ value: `plan:${p.id}`, label: `ПП: ${p.counterpartyName || p.id.slice(-6)} · ${amt} ${p.currency}` });
        });
        return opts;
    }, [actualPayments, plannedPayments, orderId]);

    const getDocVal = (e: ReceptionExpense) =>
        e.paymentId ? `pay:${e.paymentId}` : e.plannedPaymentId ? `plan:${e.plannedPaymentId}` : '';

    const setDocVal = (id: string, val: string) => {
        if (val.startsWith('pay:'))  updateExp(id, { paymentId: val.slice(4), plannedPaymentId: undefined });
        else if (val.startsWith('plan:')) updateExp(id, { plannedPaymentId: val.slice(5), paymentId: undefined });
        else updateExp(id, { paymentId: undefined, plannedPaymentId: undefined });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">

            {/* ── Шапка с табами ─────────────────────────────────────────── */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight flex items-center gap-2">
                    <Truck size={15} className="text-orange-500"/> Дополнительные расходы
                    {expenses.length > 0 && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[9px] font-black">
                            {expenses.length} · {fmtKzt(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))} ₸
                        </span>
                    )}
                </h3>
                {hasBatch && (
                    <div className="flex bg-slate-200/60 rounded-xl p-0.5 gap-0.5">
                        <button
                            onClick={() => setTab('batch')}
                            className={`px-3 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                tab === 'batch' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Layers size={10}/> По партии
                        </button>
                        <button
                            onClick={() => setTab('manual')}
                            className={`px-3 py-1.5 rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                tab === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <PenLine size={10}/> Вручную
                        </button>
                    </div>
                )}
            </div>

            {/* ── Таб: По партии ─────────────────────────────────────────── */}
            {tab === 'batch' && (
                <div className="p-5 space-y-4">
                    {!preCalcItems || preCalcItems.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-xs font-bold">
                            {preCalcItems ? 'Позиции предрасчёта не найдены для этой партии.' : 'Загрузка данных предрасчёта...'}
                        </div>
                    ) : (
                        <>
                            {/* Таблица категорий */}
                            <div className="overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full border-collapse">
                                    <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        <tr>
                                            <th className="px-3 py-2.5 w-8"></th>
                                            <th className="px-3 py-2.5 text-left">Категория</th>
                                            <th className="px-3 py-2.5 text-right whitespace-nowrap">Плановая</th>
                                            <th className="px-3 py-2.5 text-right whitespace-nowrap min-w-[130px]">Фактическая</th>
                                            <th className="px-3 py-2.5 text-left min-w-[110px]">Распределение</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {batchRows.map((row, idx) => (
                                            <tr key={row.key} className={`transition-colors ${row.enabled ? '' : 'opacity-40'}`}>
                                                <td className="px-3 py-2.5 text-center">
                                                    <button
                                                        onClick={() => setBatchRows(p => p.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r))}
                                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        {row.enabled
                                                            ? <CheckCircle2 size={14} className="text-indigo-500"/>
                                                            : <Circle size={14}/>
                                                        }
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[11px] font-bold text-slate-700">{row.label}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                                    {row.plannedTotal > 0 ? fmtKzt(row.plannedTotal) + ' ₸' : '—'}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex justify-end">
                                                        <input
                                                            type="number"
                                                            disabled={!row.enabled}
                                                            className="w-32 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-[11px] font-black text-orange-600 text-right outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40"
                                                            value={row.actualAmount || ''}
                                                            placeholder="0"
                                                            onChange={e => setBatchRows(p => p.map((r, i) => i === idx ? { ...r, actualAmount: parseFloat(e.target.value) || 0 } : r))}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <select
                                                        disabled={!row.enabled}
                                                        className="bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40 w-full"
                                                        value={row.method}
                                                        onChange={e => setBatchRows(p => p.map((r, i) => i === idx ? { ...r, method: e.target.value as ExpenseAllocationMethod } : r))}
                                                    >
                                                        {GENERAL_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                                        <tr>
                                            <td colSpan={2} className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">ИТОГО</td>
                                            <td className="px-3 py-2 text-right font-mono text-[11px] font-bold text-slate-400 whitespace-nowrap">
                                                {batchPlannedTotal > 0 ? fmtKzt(batchPlannedTotal) + ' ₸' : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-sm font-black text-orange-600 whitespace-nowrap">
                                                {batchActualTotal > 0 ? fmtKzt(batchActualTotal) + ' ₸' : '—'}
                                            </td>
                                            <td/>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Разбивка по позициям */}
                            <div>
                                <button
                                    onClick={() => setShowBreakdown(p => !p)}
                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-colors"
                                >
                                    {showBreakdown ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                    Разбивка по позициям (из предрасчёта)
                                </button>
                                {showBreakdown && (
                                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                                        <table className="w-max border-collapse text-[10px]">
                                            <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                <tr>
                                                    <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 z-10">Позиция</th>
                                                    {BATCH_CATS.map(c => (
                                                        <th key={c.key} className="px-3 py-2 text-right whitespace-nowrap">{c.label}</th>
                                                    ))}
                                                    <th className="px-3 py-2 text-right font-black text-slate-600 whitespace-nowrap">Итого</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {itemBreakdown.map(({ item, cols, total }) => (
                                                    <tr key={item.id} className="hover:bg-blue-50/20">
                                                        <td className="px-3 py-2 sticky left-0 bg-white z-10">
                                                            <div className="font-bold text-slate-700 max-w-[110px] truncate">{item.productName}</div>
                                                            <div className="text-slate-400 font-mono text-[9px]">{item.sku}</div>
                                                        </td>
                                                        {BATCH_CATS.map(c => (
                                                            <td key={c.key} className={`px-3 py-2 text-right font-mono ${cols[c.key] > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                                                                {cols[c.key] > 0 ? fmtKzt(cols[c.key]) : '—'}
                                                            </td>
                                                        ))}
                                                        <td className="px-3 py-2 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                                            {total > 0 ? fmtKzt(total) + ' ₸' : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Кнопки действий */}
                            <div className="flex items-center justify-between pt-1">
                                <button
                                    onClick={resetToPlanned}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <RotateCcw size={11}/> Сбросить к плановым
                                </button>
                                <button
                                    onClick={applyBatchExpenses}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                                >
                                    <Layers size={12}/> Применить расходы партии
                                </button>
                            </div>

                            {batchAppliedCount > 0 && (
                                <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold">
                                    <CheckCircle2 size={12}/>
                                    {batchAppliedCount} {batchAppliedCount === 1 ? 'расход применён' : 'расходов применено'} из партии
                                    · итого {fmtKzt(expenses.filter(e => e.sourceMode === 'batch').reduce((s, e) => s + (Number(e.amount) || 0), 0))} ₸
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── Таб: Вручную ───────────────────────────────────────────── */}
            {tab === 'manual' && (
                <div className="p-5 space-y-3">

                    {/* Секция: На весь список */}
                    <AccordionSection
                        title="На весь список"
                        count={generalExp.length}
                        open={openSections.has('general')}
                        onToggle={() => toggleSection('general')}
                        onAdd={addGeneral}
                    >
                        {generalExp.length === 0 ? (
                            <p className="text-[10px] text-slate-400 py-3 text-center">
                                Общий расход — делится по всем позициям выбранным методом
                            </p>
                        ) : (
                            <div className="space-y-2 pt-1">
                                {generalExp.map(exp => (
                                    <GeneralExpenseRow
                                        key={exp.id}
                                        exp={exp}
                                        docOptions={docOptions}
                                        docVal={getDocVal(exp)}
                                        onUpdate={patch => updateExp(exp.id, patch)}
                                        onSetDoc={val => setDocVal(exp.id, val)}
                                        onDelete={() => deleteExp(exp.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </AccordionSection>

                    {/* Секция: На позицию */}
                    <AccordionSection
                        title="На позицию"
                        count={specificExp.length}
                        open={openSections.has('specific')}
                        onToggle={() => toggleSection('specific')}
                        onAdd={addSpecific}
                    >
                        {specificExp.length === 0 ? (
                            <p className="text-[10px] text-slate-400 py-3 text-center">
                                Расход будет зачислен целиком на выбранную позицию
                            </p>
                        ) : (
                            <div className="space-y-2 pt-1">
                                {specificExp.map(exp => (
                                    <SpecificExpenseRow
                                        key={exp.id}
                                        exp={exp}
                                        items={items}
                                        docOptions={docOptions}
                                        docVal={getDocVal(exp)}
                                        onUpdate={patch => updateExp(exp.id, patch)}
                                        onSetDoc={val => setDocVal(exp.id, val)}
                                        onDelete={() => deleteExp(exp.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </AccordionSection>
                </div>
            )}
        </div>
    );
};

// ── Строка "На весь список" ───────────────────────────────────────────────────
const GeneralExpenseRow: React.FC<{
    exp: ReceptionExpense;
    docOptions: { value: string; label: string }[];
    docVal: string;
    onUpdate: (p: Partial<ReceptionExpense>) => void;
    onSetDoc: (v: string) => void;
    onDelete: () => void;
}> = ({ exp, docOptions, docVal, onUpdate, onSetDoc, onDelete }) => (
    <div className="flex items-center gap-2 flex-wrap">
        <select
            className="flex-1 min-w-[130px] bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-400"
            value={exp.type}
            onChange={e => onUpdate({ type: e.target.value })}
        >
            {ALL_EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
            type="number"
            className="w-28 bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg text-[10px] font-black text-orange-600 text-right outline-none focus:ring-2 focus:ring-blue-400"
            value={exp.amount || ''}
            placeholder="0 ₸"
            onChange={e => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
        />
        <select
            className="w-[110px] bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-400"
            value={exp.allocationMethod}
            onChange={e => onUpdate({ allocationMethod: e.target.value as ExpenseAllocationMethod })}
        >
            {GENERAL_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </select>
        {docOptions.length > 0 && (
            <select
                className={`w-40 border px-2 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-400 ${
                    docVal ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
                value={docVal}
                onChange={e => onSetDoc(e.target.value)}
            >
                <option value="">📎 Документ</option>
                {docOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        )}
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-all flex-none">
            <Trash2 size={13}/>
        </button>
    </div>
);

// ── Строка "На позицию" ───────────────────────────────────────────────────────
const SpecificExpenseRow: React.FC<{
    exp: ReceptionExpense;
    items: ReceptionItem[];
    docOptions: { value: string; label: string }[];
    docVal: string;
    onUpdate: (p: Partial<ReceptionExpense>) => void;
    onSetDoc: (v: string) => void;
    onDelete: () => void;
}> = ({ exp, items, docOptions, docVal, onUpdate, onSetDoc, onDelete }) => (
    <div className="flex items-center gap-2 flex-wrap">
        <select
            className="flex-1 min-w-[160px] bg-blue-50 border border-blue-200 px-2 py-2 rounded-lg text-[10px] font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-400"
            value={exp.targetItemId || ''}
            onChange={e => onUpdate({ targetItemId: e.target.value })}
        >
            <option value="">— Выберите позицию —</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.sku} · {i.productName}</option>)}
        </select>
        <select
            className="w-[130px] bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-400"
            value={exp.type}
            onChange={e => onUpdate({ type: e.target.value })}
        >
            {ALL_EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
            type="number"
            className="w-28 bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg text-[10px] font-black text-orange-600 text-right outline-none focus:ring-2 focus:ring-blue-400"
            value={exp.amount || ''}
            placeholder="0 ₸"
            onChange={e => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
        />
        {docOptions.length > 0 && (
            <select
                className={`w-40 border px-2 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-400 ${
                    docVal ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
                value={docVal}
                onChange={e => onSetDoc(e.target.value)}
            >
                <option value="">📎 Документ</option>
                {docOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        )}
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-all flex-none">
            <Trash2 size={13}/>
        </button>
    </div>
);

// ── Аккордион-секция ──────────────────────────────────────────────────────────
const AccordionSection: React.FC<{
    title: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    onAdd: () => void;
    children: React.ReactNode;
}> = ({ title, count, open, onToggle, onAdd, children }) => (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 hover:bg-slate-100 transition-colors"
        >
            <div className="flex items-center gap-2">
                {open ? <ChevronDown size={12} className="text-slate-400"/> : <ChevronRight size={12} className="text-slate-400"/>}
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{title}</span>
                {count > 0 && (
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[9px] font-black">{count}</span>
                )}
            </div>
            <button
                onClick={e => { e.stopPropagation(); onAdd(); }}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
            >
                <Plus size={10}/> Добавить
            </button>
        </button>
        {open && <div className="px-4 pb-4">{children}</div>}
    </div>
);
