import React, { useState } from 'react';
import { Filter, FileText, Calendar, CreditCard, X, ChevronRight, ExternalLink, Check } from 'lucide-react';
import { CashFlowItem } from '@/types/finance';
import { EnrichedAllocation, fmt } from './types';

interface AllocationPanelProps {
    batchId: string;
    allocations: EnrichedAllocation[];
    allAllocationsCount: number;
    counterpartyOptions: { id: string; name: string }[];
    cashFlowItemOptions: CashFlowItem[];
    cashFlowItemMap: Map<string, CashFlowItem>;
    filterCounterparty: string;
    filterCashFlowItemId: string;
    filterDate: string;
    selectedAllocId: string | null;
    priorityCashFlowItemId?: string;
    onFilterCounterparty: (v: string) => void;
    onFilterCashFlowItem: (v: string) => void;
    onFilterDate: (v: string) => void;
    onSelect: (alloc: EnrichedAllocation) => void;
}

export const AllocationPanel: React.FC<AllocationPanelProps> = ({
    batchId,
    allocations,
    allAllocationsCount,
    counterpartyOptions,
    cashFlowItemOptions,
    cashFlowItemMap,
    filterCounterparty,
    filterCashFlowItemId,
    filterDate,
    selectedAllocId,
    priorityCashFlowItemId,
    onFilterCounterparty,
    onFilterCashFlowItem,
    onFilterDate,
    onSelect,
}) => {
    const hasFilter = filterCounterparty || filterCashFlowItemId || filterDate;
    const [paymentViewer, setPaymentViewer] = useState<EnrichedAllocation | null>(null);

    // Приоритетные аллокации — вверх, затем по дате (новые первыми)
    const sorted = [...allocations].sort((a, b) => {
        const aP = a.cashFlowItemId === priorityCashFlowItemId ? 0 : 1;
        const bP = b.cashFlowItemId === priorityCashFlowItemId ? 0 : 1;
        if (aP !== bP) return aP - bP;
        return b.ap.date.localeCompare(a.ap.date);
    });

    const clearFilters = () => {
        onFilterCounterparty('');
        onFilterCashFlowItem('');
        onFilterDate('');
    };

    return (
        <>
            <div className="space-y-2">
                {/* Фильтры */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                            <Filter size={9} /> Фильтры
                        </div>
                        {hasFilter && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="text-[8px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Сбросить
                            </button>
                        )}
                    </div>

                    <div className="space-y-0.5">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Контрагент</label>
                        <select
                            value={filterCounterparty}
                            onChange={e => onFilterCounterparty(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-2 focus:ring-violet-500/20 outline-none focus:border-violet-400"
                        >
                            <option value="">Все контрагенты</option>
                            {counterpartyOptions.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-0.5">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Статья</label>
                        <select
                            value={filterCashFlowItemId}
                            onChange={e => onFilterCashFlowItem(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-2 focus:ring-violet-500/20 outline-none focus:border-violet-400"
                        >
                            <option value="">Все статьи</option>
                            {cashFlowItemOptions.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-0.5">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Дата платежа</label>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => onFilterDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-2 focus:ring-violet-500/20 outline-none focus:border-violet-400"
                        />
                    </div>
                </div>

                {/* Индикатор приоритета */}
                {priorityCashFlowItemId && !filterCashFlowItemId && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
                        <span className="text-[8px] font-black uppercase tracking-widest text-amber-600">★</span>
                        <span className="text-[8px] font-bold text-amber-700 truncate">
                            Приоритет: {cashFlowItemMap.get(priorityCashFlowItemId)?.name ?? priorityCashFlowItemId}
                        </span>
                    </div>
                )}

                {/* Счётчик */}
                <div className="px-1">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                        {hasFilter
                            ? `Найдено: ${sorted.length} из ${allAllocationsCount}`
                            : `Доступно: ${allAllocationsCount}`}
                    </span>
                </div>

                {/* Список */}
                <div className="max-h-72 overflow-auto space-y-1.5">
                    {sorted.length === 0 && (
                        <div className="py-8 text-center">
                            <CreditCard size={20} className="mx-auto text-slate-200 mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                                {hasFilter ? 'Нет совпадений' : 'Нет доступных аллокаций'}
                            </p>
                            <p className="text-[8px] text-slate-300 mt-1">
                                Аллокации, занятые другими партиями, скрыты
                            </p>
                        </div>
                    )}
                    {sorted.map(alloc => {
                        const cfItem = cashFlowItemMap.get(alloc.cashFlowItemId);
                        const isSelected = selectedAllocId === alloc.id;
                        const isPriority = !!priorityCashFlowItemId && alloc.cashFlowItemId === priorityCashFlowItemId;
                        const isOwnBatch = alloc.batchId === batchId;

                        return (
                            <div
                                key={alloc.id}
                                className={`rounded-xl border transition-all p-3 space-y-2 ${
                                    isSelected
                                        ? 'border-violet-400 bg-violet-50 shadow-sm'
                                        : isPriority
                                        ? 'border-amber-300 bg-amber-50/60'
                                        : 'border-slate-200 bg-white'
                                }`}
                            >
                                {/* Шапка: статья + сумма */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                            {isPriority && (
                                                <span className="text-[7px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-1 py-0.5 rounded">
                                                    ★ приоритет
                                                </span>
                                            )}
                                            {isOwnBatch && (
                                                <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                    <Check size={7}/> уже в этой партии
                                                </span>
                                            )}
                                            {cfItem && (
                                                <span className="text-[8px] font-black uppercase tracking-widest text-violet-600 truncate">
                                                    {cfItem.name}
                                                </span>
                                            )}
                                        </div>
                                        {alloc.description && (
                                            <div className="text-[10px] font-bold text-slate-700 truncate">{alloc.description}</div>
                                        )}
                                    </div>
                                    <div className="font-black font-mono text-violet-700 text-[12px] shrink-0">
                                        {fmt(alloc.amountCovered)}
                                    </div>
                                </div>

                                {/* Выписка — кликабельная */}
                                <button
                                    type="button"
                                    onClick={() => setPaymentViewer(alloc)}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                                >
                                    <FileText size={9} className="text-blue-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[9px] font-black text-blue-700 truncate">{alloc.ap.counterpartyName}</div>
                                        <div className="text-[8px] text-blue-400 font-bold">
                                            {alloc.ap.date}{alloc.ap.purpose ? ' · ' + alloc.ap.purpose : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <div className="text-[9px] font-black font-mono text-blue-600">
                                            {fmt(alloc.ap.totalCostKzt || alloc.ap.amount || 0)}
                                        </div>
                                        <ExternalLink size={8} className="text-blue-400" />
                                    </div>
                                </button>

                                {/* Плановый платёж (если есть) */}
                                {alloc.pp && (
                                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 rounded-lg">
                                        <Calendar size={9} className="text-indigo-400 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[9px] font-black text-indigo-700 truncate">{alloc.pp.counterpartyName}</div>
                                            <div className="text-[8px] text-indigo-400 font-bold">
                                                {alloc.pp.dueDate} · {alloc.pp.sourceDocId?.slice(0, 12).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="text-[9px] font-black font-mono text-indigo-600 shrink-0">
                                            {fmt(alloc.pp.amountDue || 0)}
                                        </div>
                                    </div>
                                )}

                                {/* Кнопка выбора */}
                                <button
                                    type="button"
                                    onClick={() => onSelect(alloc)}
                                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                        isSelected
                                            ? 'bg-violet-600 text-white shadow'
                                            : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200'
                                    }`}
                                >
                                    {isSelected ? (
                                        <><Check size={10}/> Выбрана</>
                                    ) : (
                                        <><ChevronRight size={10}/> Выбрать</>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Модальник просмотра платежа */}
            {paymentViewer && (
                <PaymentViewerModal
                    alloc={paymentViewer}
                    cashFlowItemMap={cashFlowItemMap}
                    onClose={() => setPaymentViewer(null)}
                />
            )}
        </>
    );
};

// ── Просмотр платежа (readonly) ───────────────────────────────────────────────

interface PaymentViewerModalProps {
    alloc: EnrichedAllocation;
    cashFlowItemMap: Map<string, CashFlowItem>;
    onClose: () => void;
}

const PaymentViewerModal: React.FC<PaymentViewerModalProps> = ({ alloc, cashFlowItemMap, onClose }) => {
    const ap = alloc.ap;
    const totalAllocated = (ap.allocations || []).reduce((s, a) => s + a.amountCovered, 0);
    const unallocated = (ap.totalCostKzt || ap.amount || 0) - totalAllocated;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 animate-in zoom-in-95">
                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Платёж из выписки</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Основные реквизиты */}
                    <div className="space-y-2">
                        <Row label="Контрагент" value={ap.counterpartyName} />
                        <Row label="Дата" value={ap.date} />
                        {ap.documentNumber && <Row label="Номер документа" value={ap.documentNumber} />}
                        {ap.purpose && <Row label="Назначение" value={ap.purpose} mono />}
                        {ap.knp && <Row label="КНП" value={ap.knp} />}
                    </div>

                    {/* Суммы */}
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Сумма платежа</span>
                            <span className="text-[13px] font-black font-mono text-slate-900">{fmt(ap.totalCostKzt || ap.amount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Разнесено (всего)</span>
                            <span className="text-[11px] font-black font-mono text-violet-600">{fmt(totalAllocated)}</span>
                        </div>
                        {unallocated > 0.01 && (
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Не разнесено</span>
                                <span className="text-[11px] font-black font-mono text-amber-600">{fmt(unallocated)}</span>
                            </div>
                        )}
                    </div>

                    {/* Все аллокации платежа */}
                    {(ap.allocations || []).length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Разбивка по статьям</div>
                            {ap.allocations!.map((a, idx) => {
                                const cfItem = cashFlowItemMap.get(a.cashFlowItemId);
                                const isThis = a.id === alloc.id;
                                return (
                                    <div key={a.id || idx} className={`flex items-center justify-between px-3 py-2 rounded-lg ${isThis ? 'bg-violet-50 border border-violet-200' : 'bg-slate-50'}`}>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-[9px] font-bold truncate ${isThis ? 'text-violet-700' : 'text-slate-600'}`}>
                                                {cfItem?.name ?? a.cashFlowItemId}
                                                {isThis && <span className="ml-1.5 text-[7px] font-black uppercase text-violet-500">← эта</span>}
                                            </div>
                                            {a.description && (
                                                <div className="text-[8px] text-slate-400 truncate">{a.description}</div>
                                            )}
                                        </div>
                                        <div className="font-black font-mono text-[10px] text-slate-700 shrink-0 ml-2">{fmt(a.amountCovered)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Плановый платёж */}
                    {alloc.pp && (
                        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-1">
                                <Calendar size={9}/> Плановый платёж
                            </div>
                            <Row label="Контрагент" value={alloc.pp.counterpartyName} />
                            <Row label="Плановая дата" value={alloc.pp.dueDate} />
                            <Row label="Заказ" value={alloc.pp.sourceDocId?.slice(0, 16).toUpperCase()} mono />
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">К оплате</span>
                                <span className="font-black font-mono text-[11px] text-indigo-700">{fmt(alloc.pp.amountDue || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Оплачено</span>
                                <span className="font-black font-mono text-[11px] text-emerald-600">{fmt(alloc.pp.amountPaid || 0)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Row: React.FC<{ label: string; value?: string; mono?: boolean }> = ({ label, value, mono }) => (
    <div className="flex items-start justify-between gap-3">
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 shrink-0">{label}</span>
        <span className={`text-[10px] font-bold text-slate-800 text-right truncate max-w-[200px] ${mono ? 'font-mono text-[9px]' : ''}`}>
            {value ?? '—'}
        </span>
    </div>
);
