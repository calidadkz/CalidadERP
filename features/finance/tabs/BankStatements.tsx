import React, { useState, useMemo } from 'react';
import { ActualPayment, PaymentAllocation, PlannedPayment, InternalTransaction, SalesOrder, Currency, OrderStatus } from '@/types';
import {
    ChevronDown, ChevronRight, ChevronUp, Link, X, Loader2, ArrowUpRight, ArrowDownLeft,
    Landmark, AlertCircle, ArrowRightLeft, Layers,
    GitMerge, Receipt, Plus, Tag, Paperclip, Trash2
} from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { StatementImportModal } from '@/components/ui/StatementImportModal';
import { ApiService } from '@/services/api';
import { ColumnFilter } from '@/components/ui/ColumnFilter';
import { formatDateDMY } from '@/utils/formatDate';

interface BankStatementsProps {
    directionFilter?: 'All' | 'Outgoing' | 'Incoming';
    onOpenPaymentModal: (dir: 'Incoming' | 'Outgoing', plan?: PlannedPayment) => void;
}

// ---------- Тип строки аллокации (только для UI) ----------
type AllocLineType = 'plan' | 'category' | 'transfer';
interface AllocLine {
    id: string;
    type: AllocLineType;
    plannedPaymentId?: string;
    cashFlowItemId?: string;
    targetBankAccountId?: string;
    existingInternalTxId?: string;
    amount: number;
}

// ---------- Состояние быстрого создания заказа ----------
interface QuickOrderState {
    counterpartyId: string;
    cashFlowItemId: string;
    date: string;
}

export const BankStatements: React.FC<BankStatementsProps> = ({ directionFilter = 'All', onOpenPaymentModal }) => {
    const { state, actions } = useStore();
    const { actualPayments, plannedPayments, cashFlowItems, bankAccounts, internalTransactions, clients, suppliers } = state;

    // --- удаление платежа ---
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDeletePayment = async (ap: ActualPayment) => {
        const dirLabel = ap.direction === 'Outgoing' ? 'расход' : 'приход';
        const confirmed = window.confirm(
            `Удалить платёж?\n\n${ap.counterpartyName}\n${ap.direction === 'Outgoing' ? '−' : '+'}${Number(ap.amount).toLocaleString('ru-RU')} ${ap.currency} · ${ap.date}\n\nБаланс счёта будет скорректирован, аллокации отвязаны.`
        );
        if (!confirmed) return;
        setDeletingId(ap.id);
        try {
            await actions.deleteActualPayment(ap.id);
        } catch (e: any) {
            alert('Ошибка удаления платежа: ' + e.message);
        } finally {
            setDeletingId(null);
        }
    };

    // --- список ---
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [sortField, setSortField] = useState<'date' | 'counterpartyName' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const setFilter = (key: string, val: string) =>
        setFilters(f => val ? { ...f, [key]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)));
    const hasFilters = Object.keys(filters).length > 0;

    const toggleSort = (field: string) => {
        const sf = field as typeof sortField;
        if (sortField === sf) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(sf); setSortOrder('asc'); }
    };

    // --- модалка разноски ---
    const [allocatingTarget, setAllocatingTarget] = useState<ActualPayment | null>(null);
    const [lines, setLines] = useState<AllocLine[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // --- быстрое создание заказа ---
    const [showCreateOrder, setShowCreateOrder] = useState(false);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [quickOrder, setQuickOrder] = useState<QuickOrderState>({
        counterpartyId: '', cashFlowItemId: '', date: new Date().toISOString().split('T')[0]
    });

    const f = (v: number) => v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const getDisplayId = (id: string) => id.includes('-') && id.length > 20 ? `#${id.slice(-6).toUpperCase()}` : id;

    // ---- вычисляемые значения ----
    const unreconciledTxs = useMemo<InternalTransaction[]>(() =>
        internalTransactions.filter(tx => !tx.isFullyReconciled), [internalTransactions]);

    const cfItemSuggestions = useMemo(() =>
        [...new Set(cashFlowItems.map(i => i.name))].sort(),
    [cashFlowItems]);

    const counterpartySuggestions = useMemo(() =>
        [...new Set(actualPayments.filter(p => p.counterpartyName).map(p => p.counterpartyName!))].sort(),
    [actualPayments]);

    const dateSuggestions = useMemo(() =>
        [...new Set(actualPayments.map(p => formatDateDMY(p.date)))].sort().reverse(),
    [actualPayments]);

    const statusSuggestions = ['Распределено', 'Не распределено', 'Внутренний перевод'];

    const filteredActuals = useMemo(() => {
        let result = actualPayments.filter(p => {
            const matchDir = directionFilter === 'All' || p.direction === directionFilter;
            return matchDir;
        });

        if (filters.date) {
            const q = filters.date.toLowerCase();
            result = result.filter(p => formatDateDMY(p.date).toLowerCase().includes(q));
        }
        if (filters.counterpartyName) {
            const q = filters.counterpartyName.toLowerCase();
            result = result.filter(p => (p.counterpartyName || '').toLowerCase().includes(q));
        }
        if (filters.cfItem) {
            const q = filters.cfItem.toLowerCase();
            result = result.filter(p =>
                p.isInternalTransfer
                    ? 'внутренний перевод'.includes(q)
                    : (p.allocations || []).some(al => {
                        const cf = cashFlowItems.find(c => c.id === al.cashFlowItemId);
                        return (cf?.name || '').toLowerCase().includes(q);
                    })
            );
        }
        if (filters.status) {
            const q = filters.status.toLowerCase();
            result = result.filter(p => {
                if (p.isInternalTransfer) return 'внутренний перевод'.includes(q);
                const apAmount = Number(p.amount) || 0;
                const totalAlloc = (p.allocations || []).reduce((s, a) => s + Number(a.amountCovered), 0);
                const unalloc = apAmount - totalAlloc;
                const label = unalloc > 0.01 ? 'не распределено' : 'распределено';
                return label.includes(q);
            });
        }

        // Сортировка: если задана колонка — по ней; иначе дефолт (нераспределённые вверху)
        if (filters.date || filters.counterpartyName || sortField !== 'date') {
            result = [...result].sort((a, b) => {
                let valA: any, valB: any;
                if (sortField === 'counterpartyName') {
                    valA = a.counterpartyName || '';
                    valB = b.counterpartyName || '';
                } else if (sortField === 'amount') {
                    valA = Number(a.amount) || 0;
                    valB = Number(b.amount) || 0;
                } else {
                    valA = a.date || '';
                    valB = b.date || '';
                }
                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Дефолтный порядок: нераспределённые вверху, внутренние переводы вниз, затем по дате
            result = [...result].sort((a, b) => {
                if (a.isInternalTransfer && !b.isInternalTransfer) return 1;
                if (!a.isInternalTransfer && b.isInternalTransfer) return -1;
                const ua = (Number(a.amount) || 0) - (a.allocations || []).reduce((s, al) => s + Number(al.amountCovered), 0);
                const ub = (Number(b.amount) || 0) - (b.allocations || []).reduce((s, al) => s + Number(al.amountCovered), 0);
                if (ua > 0.01 && ub <= 0.01) return -1;
                if (ua <= 0.01 && ub > 0.01) return 1;
                return b.date.localeCompare(a.date);
            });
        }

        return result;
    }, [actualPayments, directionFilter, filters, sortField, sortOrder, cashFlowItems]);

    // Доступные планы для allocatingTarget (Kaspi-кейс: через посредника тоже)
    const matchingPlans = useMemo(() => {
        if (!allocatingTarget) return [];
        return plannedPayments.filter(pp =>
            !pp.isPaid && (
                pp.counterpartyId === allocatingTarget.counterpartyId ||
                pp.paymentCounterpartyId === allocatingTarget.counterpartyId
            )
        );
    }, [plannedPayments, allocatingTarget]);

    // Остаток к распределению
    const alreadyAllocated = useMemo(() => {
        if (!allocatingTarget) return 0;
        return (allocatingTarget.allocations || []).reduce((s, a) => s + Number(a.amountCovered), 0);
    }, [allocatingTarget]);

    const lineTotal = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines]);
    const remaining = useMemo(() => {
        if (!allocatingTarget) return 0;
        return Math.max(0, Number(allocatingTarget.amount) - alreadyAllocated - lineTotal);
    }, [allocatingTarget, alreadyAllocated, lineTotal]);

    // ---- открыть модалку ----
    const openAllocModal = (ap: ActualPayment) => {
        setAllocatingTarget(ap);
        setLines([]);
        setShowCreateOrder(false);
        setIsCreatingOrder(false);
    };

    // ---- добавить строку ----
    const addLine = (type: AllocLineType) => {
        const id = ApiService.generateId('AL');
        setLines(prev => [...prev, { id, type, amount: remaining }]);
    };

    const updateLine = (id: string, patch: Partial<AllocLine>) => {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l;
            const updated = { ...l, ...patch };
            // Автозаполнение статьи ДДС из ПП
            if (patch.plannedPaymentId) {
                const pp = plannedPayments.find(p => p.id === patch.plannedPaymentId);
                if (pp) updated.cashFlowItemId = pp.cashFlowItemId;
            }
            return updated;
        }));
    };

    const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

    // ---- быстрое создание заказа ----
    const handleQuickCreateOrder = async () => {
        if (!allocatingTarget || !quickOrder.counterpartyId || !quickOrder.cashFlowItemId) return;
        setIsCreatingOrder(true);
        // Тип заказа определяется автоматически по направлению платежа
        const docType: 'SalesOrder' | 'Order' = allocatingTarget.direction === 'Incoming' ? 'SalesOrder' : 'Order';
        try {
            const counterparties = [...clients, ...suppliers];
            const cp = counterparties.find(c => c.id === quickOrder.counterpartyId);
            const orderId = ApiService.generateId(docType === 'SalesOrder' ? 'SO' : 'PO');
            const ppId = ApiService.generateId('PP');

            const pp: PlannedPayment = {
                id: ppId,
                direction: allocatingTarget.direction === 'Incoming' ? 'Incoming' : 'Outgoing',
                sourceDocId: orderId,
                sourceDocType: docType,
                counterpartyId: quickOrder.counterpartyId,
                counterpartyName: cp?.name || '—',
                amountDue: remaining,
                amountPaid: 0,
                currency: allocatingTarget.currency as Currency,
                dueDate: quickOrder.date,
                isPaid: false,
                cashFlowItemId: quickOrder.cashFlowItemId,
            };

            if (docType === 'SalesOrder') {
                const order: SalesOrder = {
                    id: orderId,
                    name: `Быстрый заказ от ${allocatingTarget.date}`,
                    date: quickOrder.date,
                    clientId: quickOrder.counterpartyId,
                    clientName: cp?.name || '—',
                    items: [],
                    status: OrderStatus.CONFIRMED,
                    totalAmount: 0,
                    paidAmount: 0,
                    shippedItemCount: 0,
                    totalItemCount: 0,
                };
                await actions.createSalesOrder(order, [pp]);
            } else {
                const order = {
                    id: orderId,
                    name: `Быстрый заказ от ${allocatingTarget.date}`,
                    date: quickOrder.date,
                    supplierId: quickOrder.counterpartyId,
                    supplierName: cp?.name || '—',
                    currency: allocatingTarget.currency as Currency,
                    status: OrderStatus.CONFIRMED,
                    items: [],
                    totalAmountForeign: 0,
                    totalAmountKztEst: 0,
                    receivedItemCount: 0,
                    totalItemCount: 0,
                    paidAmountForeign: 0,
                    totalPaidKzt: 0,
                } as any;
                await actions.addOrder(order, [pp]);
            }

            // Добавить строку-план с остатком к распределению
            setLines(prev => [...prev, {
                id: ApiService.generateId('AL'),
                type: 'plan',
                plannedPaymentId: ppId,
                cashFlowItemId: quickOrder.cashFlowItemId,
                amount: remaining,
            }]);
            setShowCreateOrder(false);
            setQuickOrder({ counterpartyId: '', cashFlowItemId: '', date: new Date().toISOString().split('T')[0] });
        } catch (e: any) {
            alert('Ошибка создания заказа: ' + e.message);
        } finally {
            setIsCreatingOrder(false);
        }
    };

    // ---- подтвердить разноску ----
    const handleConfirm = async () => {
        if (!allocatingTarget || lines.length === 0) return;
        const valid = lines.every(l =>
            l.amount > 0 &&
            (l.type === 'plan' ? !!l.plannedPaymentId : l.type === 'category' ? !!l.cashFlowItemId : !!l.targetBankAccountId)
        );
        if (!valid) { alert('Заполните все поля и суммы'); return; }

        setIsSaving(true);
        try {
            const allocations: PaymentAllocation[] = lines.map(l => ({
                id: ApiService.generateId('AL'),
                actualPaymentId: allocatingTarget.id,
                plannedPaymentId: l.plannedPaymentId || undefined,
                cashFlowItemId: l.cashFlowItemId || (l.type === 'transfer' ? 'INTERNAL_TRANSFER' : ''),
                amountCovered: l.amount,
                targetBankAccountId: l.targetBankAccountId,
                existingInternalTxId: l.existingInternalTxId,
            }));
            await actions.allocatePayment(allocatingTarget.id, allocations);
            setAllocatingTarget(null);
            setLines([]);
        } catch (e: any) {
            alert('Ошибка: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const canConfirm = lines.length > 0 && lines.every(l =>
        l.amount > 0 &&
        (l.type === 'plan' ? !!l.plannedPaymentId : l.type === 'category' ? !!l.cashFlowItemId : !!l.targetBankAccountId)
    );

    // ---- рендер строки аллокации ----
    const renderAllocLine = (line: AllocLine) => {
        const isTransfer = line.type === 'transfer';
        const isPlan = line.type === 'plan';

        const badge = isPlan
            ? <span className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase"><Receipt size={9}/> К плану</span>
            : isTransfer
                ? <span className="flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase"><ArrowRightLeft size={9}/> Перевод</span>
                : <span className="flex items-center gap-1 text-[9px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded uppercase"><Tag size={9}/> По статье</span>;

        return (
            <div key={line.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="shrink-0">{badge}</div>

                <div className="flex-1 min-w-0">
                    {isPlan && (
                        <select
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={line.plannedPaymentId || ''}
                            onChange={e => updateLine(line.id, { plannedPaymentId: e.target.value })}
                        >
                            <option value="">— Выберите план —</option>
                            {matchingPlans.map(pp => {
                                const viaIntermediary = pp.paymentCounterpartyId === allocatingTarget?.counterpartyId && pp.counterpartyId !== allocatingTarget?.counterpartyId;
                                const needed = (Number(pp.amountDue) || 0) - (Number(pp.amountPaid) || 0);
                                return (
                                    <option key={pp.id} value={pp.id}>
                                        {getDisplayId(pp.sourceDocId)} • {pp.counterpartyName} • {f(needed)} {pp.currency}
                                        {viaIntermediary ? ` (через ${pp.paymentCounterpartyName || 'посредника'})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                    )}
                    {line.type === 'category' && (
                        <select
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                            value={line.cashFlowItemId || ''}
                            onChange={e => updateLine(line.id, { cashFlowItemId: e.target.value })}
                        >
                            <option value="">— Выберите статью ДДС —</option>
                            {cashFlowItems
                                .filter(i => i.type === (allocatingTarget?.direction === 'Incoming' ? 'Income' : 'Expense'))
                                .map(cf => <option key={cf.id} value={cf.id}>{cf.name}</option>)}
                        </select>
                    )}
                    {isTransfer && (
                        <div className="space-y-1.5">
                            <select
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={line.targetBankAccountId || ''}
                                onChange={e => updateLine(line.id, { targetBankAccountId: e.target.value, existingInternalTxId: undefined })}
                            >
                                <option value="">— Целевой счёт (первая сторона) —</option>
                                {bankAccounts.filter(a => a.id !== allocatingTarget?.bankAccountId).map(a =>
                                    <option key={a.id} value={a.id}>{a.bank} • {a.name} ({a.currency})</option>)}
                            </select>
                            {unreconciledTxs.length > 0 && (
                                <select
                                    className="w-full bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-700 outline-none"
                                    value={line.existingInternalTxId || ''}
                                    onChange={e => {
                                        const tx = unreconciledTxs.find(t => t.id === e.target.value);
                                        updateLine(line.id, {
                                            existingInternalTxId: e.target.value || undefined,
                                            targetBankAccountId: tx ? (allocatingTarget?.direction === 'Incoming' ? tx.fromAccountId : tx.toAccountId) : line.targetBankAccountId,
                                        });
                                    }}
                                >
                                    <option value="">— Или привязать к существующему переводу —</option>
                                    {unreconciledTxs.map(tx => {
                                        const from = bankAccounts.find(a => a.id === tx.fromAccountId);
                                        const to = bankAccounts.find(a => a.id === tx.toAccountId);
                                        return <option key={tx.id} value={tx.id}>{tx.date} | {from?.name || '?'} → {to?.name || '?'} | {f(tx.amountSent)}</option>;
                                    })}
                                </select>
                            )}
                        </div>
                    )}
                </div>

                <input
                    type="number"
                    className="w-28 shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-black text-right outline-none"
                    value={line.amount || ''}
                    onChange={e => updateLine(line.id, { amount: parseFloat(e.target.value) || 0 })}
                />
                <button onClick={() => removeLine(line.id)} className="shrink-0 text-slate-300 hover:text-red-500 transition-colors">
                    <X size={16}/>
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 justify-end bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <button onClick={() => setIsImportModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black uppercase text-[10px] tracking-widest"><Landmark size={14}/> Импорт выписки</button>
                <button onClick={() => onOpenPaymentModal('Outgoing')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-md font-black uppercase text-[10px] tracking-widest"><ArrowUpRight size={14}/> Расход</button>
                <button onClick={() => onOpenPaymentModal('Incoming')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md font-black uppercase text-[10px] tracking-widest"><ArrowDownLeft size={14}/> Приход</button>
            </div>

            {/* Таблица платежей */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Журнал фактических платежей</h3>
                    {!hasFilters && (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Всего: {filteredActuals.length}
                        </span>
                    )}
                </div>
                {/* Полоса сброса фильтров */}
                {hasFilters && (
                    <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            Найдено: {filteredActuals.length}
                        </span>
                        <button
                            onClick={() => setFilters({})}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-red-500 transition-colors"
                        >
                            <X size={10} /> Сбросить фильтры
                        </button>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="w-10"/>
                                <th className="px-4 py-3 text-left">
                                    <ColumnFilter
                                        label="Дата"
                                        sortKey="date"
                                        currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                        filterValue={filters.date || ''} onFilterChange={v => setFilter('date', v)}
                                        suggestions={dateSuggestions}
                                    />
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <ColumnFilter
                                        label="Контрагент"
                                        sortKey="counterpartyName"
                                        currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                        filterValue={filters.counterpartyName || ''} onFilterChange={v => setFilter('counterpartyName', v)}
                                        suggestions={counterpartySuggestions}
                                    />
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <ColumnFilter
                                        label="Разноска"
                                        filterValue={filters.cfItem || ''} onFilterChange={v => setFilter('cfItem', v)}
                                        suggestions={cfItemSuggestions}
                                    />
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <ColumnFilter
                                        label="Сумма"
                                        sortKey="amount"
                                        currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                        align="right"
                                    />
                                </th>
                                <th className="px-4 py-3 text-center">
                                    <ColumnFilter
                                        label="Статус"
                                        filterValue={filters.status || ''} onFilterChange={v => setFilter('status', v)}
                                        suggestions={statusSuggestions}
                                        align="center"
                                    />
                                </th>
                                <th className="w-8"/>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredActuals.length === 0 ? (
                                <tr><td colSpan={7} className="p-20 text-center text-slate-300 italic">Платежи не найдены</td></tr>
                            ) : filteredActuals.map(ap => {
                                const isExp = expandedId === ap.id;
                                const totalAlloc = (ap.allocations || []).reduce((s, a) => s + Number(a.amountCovered), 0);
                                const apAmount = Number(ap.amount) || 0;
                                const unalloc = Math.max(0, apAmount - totalAlloc);
                                const isInternal = ap.isInternalTransfer;

                                return (
                                    <React.Fragment key={ap.id}>
                                        <tr className={`group hover:bg-gray-50/50 transition-colors ${isInternal ? 'bg-indigo-50/20' : unalloc > 0.01 ? 'bg-amber-50/20' : ''}`}>
                                            <td className="pl-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : ap.id)}>
                                                {ap.allocations?.length > 0
                                                    ? (isExp ? <ChevronDown size={14} className="text-blue-500"/> : <ChevronRight size={14} className="text-gray-300"/>)
                                                    : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-bold text-slate-600">{formatDateDMY(ap.date)}</div>
                                                <div className="text-[10px] font-mono text-slate-400">{ap.id.slice(-8)}</div>
                                                {ap.receiptUrl && (
                                                    <a href={ap.receiptUrl} target="_blank" rel="noopener noreferrer"
                                                       className="flex items-center gap-0.5 text-[9px] font-bold text-blue-500 hover:text-blue-700 mt-0.5 w-fit"
                                                       title="Открыть документ" onClick={e => e.stopPropagation()}>
                                                        <Paperclip size={9}/> чек
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-bold">{ap.counterpartyName}</div>
                                                <div className="text-[10px] text-gray-400">{ap.fromAccount}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isInternal ? (
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded border text-indigo-600 bg-indigo-50 border-indigo-100 flex items-center gap-1 w-fit">
                                                        <ArrowRightLeft size={9}/> Внутренний перевод
                                                    </span>
                                                ) : ap.allocations?.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {ap.allocations.map((al, i) => {
                                                            const cf = cashFlowItems.find(c => c.id === al.cashFlowItemId);
                                                            const pp = plannedPayments.find(p => p.id === al.plannedPaymentId);
                                                            const tgt = bankAccounts.find(a => a.id === al.targetBankAccountId);
                                                            const label = al.targetBankAccountId
                                                                ? `→ ${tgt?.name || '?'}`
                                                                : cf?.name || 'Без статьи';
                                                            const via = pp?.paymentCounterpartyId === ap.counterpartyId && pp?.counterpartyId !== ap.counterpartyId;
                                                            return (
                                                                <div key={i} className="flex flex-col">
                                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded border text-blue-600 bg-blue-50 border-blue-100 uppercase tracking-tighter w-fit">{label}</span>
                                                                    {pp && <span className="text-[8px] text-slate-400 flex items-center gap-0.5 mt-0.5"><Link size={7}/> {getDisplayId(pp.sourceDocId)}{via && <span className="text-amber-500 ml-1">↔ {pp.paymentCounterpartyName}</span>}</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 italic"><AlertCircle size={10}/> Не распределено</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-black">
                                                <div className={ap.direction === 'Outgoing' ? 'text-red-600' : 'text-emerald-600'}>
                                                    {ap.direction === 'Outgoing' ? '-' : '+'}{f(apAmount)} {ap.currency}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isInternal && !ap.pairedInternalTxId ? (
                                                    <button onClick={() => openAllocModal(ap)} className="text-[10px] font-black text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-all">
                                                        Закрыть перевод
                                                    </button>
                                                ) : isInternal ? (
                                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1 justify-center w-fit mx-auto">
                                                        <GitMerge size={10}/> Сведён
                                                    </span>
                                                ) : unalloc > 0.01 ? (
                                                    <button onClick={() => openAllocModal(ap)} className="text-[10px] font-black text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                                                        Разнести {f(unalloc)}
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">ОК</span>
                                                )}
                                            </td>
                                            <td className="pr-3 text-center">
                                                {deletingId === ap.id ? (
                                                    <Loader2 size={14} className="animate-spin text-slate-300 mx-auto"/>
                                                ) : !isInternal ? (
                                                    <button
                                                        onClick={() => handleDeletePayment(ap)}
                                                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                                        title="Удалить платёж"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        {isExp && ap.allocations?.map((al, idx) => {
                                            const cf = cashFlowItems.find(c => c.id === al.cashFlowItemId);
                                            const pp = plannedPayments.find(p => p.id === al.plannedPaymentId);
                                            const tgt = bankAccounts.find(a => a.id === al.targetBankAccountId);
                                            return (
                                                <tr key={idx} className="bg-slate-50/60">
                                                    <td colSpan={3}/>
                                                    <td className="px-6 py-2 text-xs">
                                                        <span className={`font-bold ${al.targetBankAccountId ? 'text-indigo-600' : 'text-blue-600'}`}>
                                                            {al.targetBankAccountId ? `→ ${tgt?.name || '?'}` : cf?.name || '—'}
                                                        </span>
                                                        {pp && <span className="text-slate-400 ml-2">/ {pp.sourceDocType} {getDisplayId(pp.sourceDocId)}</span>}
                                                        {ap.purpose && idx === 0 && <div className="text-[10px] text-slate-400 italic mt-0.5">"{ap.purpose}"</div>}
                                                    </td>
                                                    <td className="px-6 py-2 text-right font-mono text-xs font-black">{f(Number(al.amountCovered))} {ap.currency}</td>
                                                    <td/>
                                                </tr>
                                            );
                                        })}
                                        {isExp && ap.documentNumber && (
                                            <tr className="bg-slate-50/30">
                                                <td colSpan={3}/>
                                                <td colSpan={3} className="px-6 py-2">
                                                    <div className="flex gap-4 text-[10px] text-slate-400">
                                                        {ap.documentNumber && <span><b>№</b> {ap.documentNumber}</span>}
                                                        {ap.knp && <span><b>КНП</b> {ap.knp}</span>}
                                                        {ap.counterpartyBinIin && <span><b>БИН</b> {ap.counterpartyBinIin}</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ======= МОДАЛКА РАЗНОСКИ ======= */}
            {allocatingTarget && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Шапка */}
                        <div className="p-5 bg-slate-800 text-white flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${allocatingTarget.direction === 'Incoming' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {allocatingTarget.direction === 'Incoming' ? 'Поступление' : 'Списание'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-bold">{allocatingTarget.date}</span>
                                </div>
                                <div className="font-black text-lg">{allocatingTarget.counterpartyName}</div>
                                <div className="text-slate-400 text-xs">{allocatingTarget.fromAccount}</div>
                            </div>
                            <button onClick={() => setAllocatingTarget(null)} disabled={isSaving} className="text-slate-500 hover:text-white mt-1"><X size={22}/></button>
                        </div>

                        {/* Баланс */}
                        <div className="flex border-b border-slate-100 shrink-0">
                            <div className="flex-1 p-4 border-r border-slate-100">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Сумма</div>
                                <div className="text-xl font-black text-slate-800">{f(Number(allocatingTarget.amount))} <span className="text-sm text-slate-400">{allocatingTarget.currency}</span></div>
                            </div>
                            <div className="flex-1 p-4 border-r border-slate-100">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Размечено</div>
                                <div className="text-xl font-black text-slate-600">{f(lineTotal + alreadyAllocated)} <span className="text-sm text-slate-400">{allocatingTarget.currency}</span></div>
                            </div>
                            <div className={`flex-1 p-4 ${remaining < 0.01 ? 'bg-emerald-50' : ''}`}>
                                <div className={`text-[9px] font-black uppercase tracking-widest ${remaining < 0.01 ? 'text-emerald-500' : 'text-amber-500'}`}>Остаток</div>
                                <div className={`text-xl font-black ${remaining < 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>{f(remaining)} <span className="text-sm">{allocatingTarget.currency}</span></div>
                            </div>
                        </div>

                        {/* Строки аллокации */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-[80px]">
                            {lines.length === 0 && (
                                <div className="text-center py-6 text-slate-300 text-[11px] font-bold uppercase tracking-widest">
                                    Добавьте строки разноски ниже
                                </div>
                            )}
                            {lines.map(renderAllocLine)}
                        </div>

                        {/* Кнопки добавления */}
                        <div className="px-5 pb-2 shrink-0">
                            <div className="flex gap-2 mb-3">
                                <button onClick={() => addLine('plan')} className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all">
                                    <Plus size={13}/> К плану
                                </button>
                                <button onClick={() => addLine('category')} className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-violet-200 text-violet-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-50 transition-all">
                                    <Plus size={13}/> По статье
                                </button>
                                <button onClick={() => addLine('transfer')} className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                                    <Plus size={13}/> Перевод
                                </button>
                            </div>

                            {/* Создать заказ — сворачиваемая панель */}
                            <div className="border border-slate-100 rounded-2xl overflow-hidden mb-3">
                                <button
                                    onClick={() => setShowCreateOrder(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                                >
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Layers size={12} className="text-slate-400"/> Создать заказ и план
                                    </span>
                                    {showCreateOrder ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                                </button>

                                {showCreateOrder && (
                                    <div className="p-4 space-y-3 bg-white border-t border-slate-100">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            {allocatingTarget.direction === 'Incoming' ? 'ЗК — Заказ клиента' : 'ЗП — Заказ поставщику'}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">
                                                    {allocatingTarget.direction === 'Incoming' ? 'Клиент' : 'Поставщик'}
                                                </label>
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                                                    value={quickOrder.counterpartyId}
                                                    onChange={e => setQuickOrder(p => ({ ...p, counterpartyId: e.target.value }))}
                                                >
                                                    <option value="">— Выберите —</option>
                                                    {(allocatingTarget.direction === 'Incoming' ? clients : suppliers).map(c =>
                                                        <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Статья ДДС</label>
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                                                    value={quickOrder.cashFlowItemId}
                                                    onChange={e => setQuickOrder(p => ({ ...p, cashFlowItemId: e.target.value }))}
                                                >
                                                    <option value="">— Выберите —</option>
                                                    {cashFlowItems
                                                        .filter(i => i.type === (allocatingTarget.direction === 'Incoming' ? 'Income' : 'Expense'))
                                                        .map(cf => <option key={cf.id} value={cf.id}>{cf.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Дата</label>
                                                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                                                    value={quickOrder.date} onChange={e => setQuickOrder(p => ({ ...p, date: e.target.value }))}/>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleQuickCreateOrder}
                                            disabled={isCreatingOrder || !quickOrder.counterpartyId || !quickOrder.cashFlowItemId}
                                            className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center gap-2 transition-all"
                                        >
                                            {isCreatingOrder ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                                            Создать заказ и привязать
                                        </button>
                                        <p className="text-[9px] text-slate-400 text-center">Состав заказа можно заполнить позже в разделе Продажи / Закупки</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Подтвердить */}
                        <div className="px-5 pb-5 shrink-0">
                            <button
                                onClick={handleConfirm}
                                disabled={!canConfirm || isSaving}
                                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin"/> : <ArrowRightLeft size={18}/>}
                                {isSaving ? 'Сохранение...' : 'Подтвердить разноску'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImportModalOpen && <StatementImportModal onClose={() => setIsImportModalOpen(false)}/>}
        </div>
    );
};
