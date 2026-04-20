import React, { useMemo } from 'react';
import { Batch, PreCalculationDocument, PreCalculationItem, BatchItemActuals, BatchExpense, ExpenseCategory } from '@/types';
import { SalesOrder, PlannedPayment } from '@/types';
import { SidebarContext } from './BatchSidebar';
import { allocateExpensesToItems } from '../utils/batchExpenseAllocation';
import { getBatchPhase } from '../utils/batchPhase';
import { Cpu, Package, Tag, User, FileText, Trash2, RotateCcw, PlusCircle, Link } from 'lucide-react';

interface BatchMainListTabProps {
    batch: Batch;
    preCalculation: PreCalculationDocument;
    itemActuals: BatchItemActuals[];
    expenses: BatchExpense[];
    salesOrders: SalesOrder[];
    incomingPlannedPayments: PlannedPayment[];
    onColumnHeaderClick: (ctx: SidebarContext) => void;
    onChinaClick: () => void;
    onOpenOrder: (order: SalesOrder) => void;
    /** Открыть сайдбар выручки по конкретной позиции */
    onRevenueItemClick?: (itemId: string) => void;
    /** Открыть форму создания заказа для позиции без заказа (manufacturing / locked) */
    onCreateOrderForItem?: (item: PreCalculationItem) => void;
    /** Пометить позицию на удаление (manufacturing) */
    onMarkDelete?: (itemId: string) => void;
    /** Снять пометку удаления (manufacturing) */
    onUnmarkDelete?: (itemId: string) => void;
    /** Удалить навсегда (manufacturing — из корзины) */
    onPermanentDelete?: (itemId: string) => void;
    /** Открыть модал добавления позиции (manufacturing) */
    onRequestAddItem?: () => void;
}

interface ExpenseColDef {
    category: ExpenseCategory;
    label: string;
    short: string;
    headerColor: string;
    planField: keyof PreCalculationItem | null;  // null = нет плана (Прочее)
    groupColor: string;
    inlineBgClass: string;  // цвет ячейки в строке итогов (thead, белый фон)
}

const EXPENSE_COLS: ExpenseColDef[] = [
    { category: 'logistics_urumqi_almaty',    label: 'Дост. Урумчи–Алматы', short: 'Урумчи–Алм.', headerColor: 'bg-blue-800/60 hover:bg-blue-700/80 text-blue-200',         planField: 'deliveryUrumqiAlmatyKzt',             groupColor: 'bg-blue-950/40 text-blue-300/70',    inlineBgClass: 'bg-blue-50/50 text-blue-700' },
    { category: 'logistics_china_domestic',   label: 'Дост. по Китаю',       short: 'По Китаю',    headerColor: 'bg-sky-900/70 hover:bg-sky-800/80 text-sky-200',            planField: 'deliveryChinaDomesticKzt',            groupColor: 'bg-blue-950/40 text-blue-300/70',    inlineBgClass: 'bg-sky-50/50 text-sky-700' },
    { category: 'logistics_almaty_karaganda', label: 'Дост. Алматы–Кар.',    short: 'Алм.–Кар.',   headerColor: 'bg-blue-800/60 hover:bg-blue-700/80 text-blue-200',         planField: 'deliveryAlmatyKaragandaPerItemKzt',   groupColor: 'bg-blue-950/40 text-blue-300/70',    inlineBgClass: 'bg-blue-50/40 text-blue-700' },
    { category: 'svh',                        label: 'СВХ',                  short: 'СВХ',         headerColor: 'bg-amber-900/60 hover:bg-amber-800/80 text-amber-200',      planField: 'svhPerItemKzt',                      groupColor: 'bg-amber-950/40 text-amber-300/70',  inlineBgClass: 'bg-amber-50/50 text-amber-700' },
    { category: 'broker',                     label: 'Брокер',               short: 'Брокер',      headerColor: 'bg-amber-900/60 hover:bg-amber-800/80 text-amber-200',      planField: 'brokerPerItemKzt',                   groupColor: 'bg-amber-950/40 text-amber-300/70',  inlineBgClass: 'bg-amber-50/50 text-amber-700' },
    { category: 'customs',                    label: 'Тамож. сборы',         short: 'Тамож.',      headerColor: 'bg-amber-900/60 hover:bg-amber-800/80 text-amber-200',      planField: 'customsFeesPerItemKzt',              groupColor: 'bg-amber-950/40 text-amber-300/70',  inlineBgClass: 'bg-amber-50/50 text-amber-700' },
    { category: 'customs_vat',                label: 'НДС Тамож.',           short: 'НДС Там.',    headerColor: 'bg-violet-900/60 hover:bg-violet-800/80 text-violet-200',   planField: 'customsNdsKzt',                      groupColor: 'bg-violet-950/40 text-violet-300/70', inlineBgClass: 'bg-violet-50/50 text-violet-700' },
    { category: 'kpn_standard',               label: 'КПН',                  short: 'КПН',         headerColor: 'bg-rose-900/60 hover:bg-rose-800/80 text-rose-200',         planField: 'kpnKzt',                             groupColor: 'bg-rose-950/40 text-rose-300/70',    inlineBgClass: 'bg-rose-50/50 text-rose-700' },
    { category: 'pnr',                        label: 'ПНР',                  short: 'ПНР',         headerColor: 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200',planField: 'pnrKzt',                             groupColor: 'bg-emerald-950/40 text-emerald-300/70', inlineBgClass: 'bg-emerald-50/40 text-emerald-700' },
    { category: 'delivery_local',             label: 'До клиента',           short: 'До клиента',  headerColor: 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200',planField: 'deliveryLocalKzt',                   groupColor: 'bg-emerald-950/40 text-emerald-300/70', inlineBgClass: 'bg-emerald-50/40 text-emerald-700' },
    { category: 'sales_bonus',                label: 'Бонус ОП',             short: 'Бонус ОП',    headerColor: 'bg-orange-900/60 hover:bg-orange-800/80 text-orange-200',   planField: 'salesBonusKzt',                      groupColor: 'bg-orange-950/40 text-orange-400/60',  inlineBgClass: 'bg-orange-50/40 text-orange-700' },
    { category: 'other',                      label: 'Прочее',               short: 'Прочее',      headerColor: 'bg-slate-700/80 hover:bg-slate-600/80 text-slate-300',      planField: null,                                 groupColor: 'bg-slate-800/60 text-slate-400/70',  inlineBgClass: 'bg-slate-50/40 text-slate-600' },
];

const fmtKzt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Всего колонок: Позиция + Кол + Заказ + Выручка + Прибыль + Закуп + 12 расходов = 18
const TOTAL_COLS = 3 + 2 + 1 + EXPENSE_COLS.length;

export const BatchMainListTab: React.FC<BatchMainListTabProps> = ({
    batch, preCalculation, itemActuals, expenses, salesOrders, incomingPlannedPayments,
    onColumnHeaderClick, onChinaClick, onOpenOrder, onRevenueItemClick, onCreateOrderForItem,
    onMarkDelete, onUnmarkDelete, onPermanentDelete, onRequestAddItem,
}) => {
    const phase = getBatchPhase(batch.status);
    const isManufacturing = phase === 'manufacturing';
    const isLocked = phase === 'locked';
    const canAttachOrder = isManufacturing || isLocked;

    const deletedIds = new Set(batch.deletedItemIds ?? []);
    const allItems = preCalculation.items;
    const activeItems = useMemo(() => allItems.filter(i => !deletedIds.has(i.id)), [allItems, batch.deletedItemIds]);
    const trashItems = useMemo(() => allItems.filter(i => deletedIds.has(i.id)), [allItems, batch.deletedItemIds]);

    // Для совместимости с остальными расчётами используем только активные позиции
    const items = activeItems;

    const actualsMap = useMemo(() => {
        const m: Record<string, BatchItemActuals> = {};
        itemActuals.forEach(a => { m[a.preCalculationItemId] = a; });
        return m;
    }, [itemActuals]);

    const expenseTotals = useMemo(() => {
        const m: Partial<Record<ExpenseCategory, number>> = {};
        expenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amountKzt; });
        return m;
    }, [expenses]);

    const chinaCount = useMemo(() =>
        expenses.filter(e => e.category === 'logistics_china_domestic').length,
        [expenses]
    );

    const allocated = useMemo(() =>
        allocateExpensesToItems(items, expenses),
        [items, expenses]
    );

    const planTotals = useMemo(() => ({
        revenue:  items.reduce((s, i) => s + (i.revenueKzt || 0) * (i.quantity || 1), 0),
        purchase: items.reduce((s, i) => s + (i.purchasePriceKzt || 0) * (i.quantity || 1), 0),
        profit:   items.reduce((s, i) => s + (i.profitKzt || 0) * (i.quantity || 1), 0),
    }), [items]);

    // Пропорциональная оплата по позиции: % оплаты заказа × выручка позиции
    // Мемоизируем для всех активных позиций сразу (чтобы factTotals был стабильным)
    const itemPaidAmounts = useMemo(() => {
        const result: Record<string, { paid: number; percent: number }> = {};
        items.forEach(item => {
            if (!item.orderId) { result[item.id] = { paid: 0, percent: 0 }; return; }
            const order = salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase());
            if (!order || !order.totalAmount || order.totalAmount === 0) {
                result[item.id] = { paid: 0, percent: 0 }; return;
            }
            const orderPaidAmount = incomingPlannedPayments
                .filter(p => p.sourceDocId === order.id)
                .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
            const itemRevenue = (item.revenueKzt || 0) * (item.quantity || 1);
            const ratio = itemRevenue / order.totalAmount;
            const paid = Math.round(orderPaidAmount * ratio);
            const percent = itemRevenue > 0 ? (paid / itemRevenue) * 100 : 0;
            result[item.id] = { paid, percent };
        });
        return result;
    }, [items, salesOrders, incomingPlannedPayments]);

    const factTotals = useMemo(() => {
        // Выручка — вычисляется из оплат по заказам (не из BatchItemActuals)
        const revenue = items.reduce((s, item) => s + (itemPaidAmounts[item.id]?.paid || 0), 0);
        const purchase = itemActuals.reduce((s, a) => s + (a.actualPurchaseKzt || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + e.amountKzt, 0);
        return { revenue, purchase, totalExpenses, profit: revenue - purchase - totalExpenses };
    }, [items, itemPaidAmounts, itemActuals, expenses]);

    // Разделение: станки сверху, запчасти снизу
    const { machines, parts, hasBothTypes } = useMemo(() => {
        const machines = items.filter(i => i.type === 'MACHINE');
        const parts = items.filter(i => i.type !== 'MACHINE');
        return { machines, parts, hasBothTypes: machines.length > 0 && parts.length > 0 };
    }, [items]);
    const groupedItems = useMemo(() => [...machines, ...parts], [machines, parts]);

    // ── Кнопка-заголовок колонки расхода ────────────────────────────────────
    const headerBtn = (col: ExpenseColDef) => {
        const isChinaDomestic = col.category === 'logistics_china_domestic';
        return (
            <th key={col.category} className="px-0 py-0 min-w-[80px]">
                <button
                    onClick={isChinaDomestic ? onChinaClick : () => onColumnHeaderClick({ type: 'addExpense', category: col.category, categoryLabel: col.label })}
                    title={isChinaDomestic ? 'Управление доставкой по Китаю' : `Внести факт: ${col.label}`}
                    className={`w-full h-full px-2 py-3 text-[9px] font-bold uppercase tracking-wider transition-all text-center active:scale-[0.97] hover:brightness-125 ${col.headerColor}`}
                >
                    {col.short}
                </button>
            </th>
        );
    };

    // Пересчёт TOTAL_COLS с учётом колонки действий (manufacturing)
    const ACTUAL_TOTAL_COLS = isManufacturing ? TOTAL_COLS + 1 : TOTAL_COLS;

    return (
        <div className="flex flex-col h-full gap-0">

            {/* Тулбар (manufacturing: добавление позиций) */}
            {isManufacturing && (
                <div className="flex items-center gap-3 px-2 pb-2 flex-none">
                    <button
                        onClick={onRequestAddItem}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-700 transition-all active:scale-95 shadow-lg shadow-violet-500/20"
                    >
                        <PlusCircle size={13} /> Добавить позицию
                    </button>
                    <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">
                        Партия в изготовлении — управление позициями здесь
                    </span>
                </div>
            )}

            {/* Легенда */}
            <div className="flex items-center gap-4 px-2 py-2 flex-none flex-wrap">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-slate-300" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Прогноз</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-300" />
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Факт</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400">· Заголовки расходов = кнопка внесения факта</div>
            </div>

            {/* Таблица */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 shadow-xl">
                <table className="border-collapse text-left" style={{ minWidth: '1600px' }}>
                    <thead className="sticky top-0 z-20">

                        {/* Строка 1: Группы */}
                        <tr className="bg-slate-950 text-[9px] font-black uppercase tracking-[0.2em]">
                            <th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-slate-400 text-left sticky left-0 z-30 bg-slate-950">
                                ТОВАР
                            </th>
                            {isManufacturing && <th className="px-2 py-2 text-slate-600 w-[40px]" />}
                            <th colSpan={2} className="px-4 py-2 border-r border-slate-800 text-center bg-emerald-950/40 text-emerald-400/80">
                                ПРОДАЖА
                            </th>
                            <th className="px-4 py-2 border-r border-slate-800 text-center bg-slate-800/60 text-slate-400/70">
                                ЗАКУП
                            </th>
                            <th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-center bg-blue-950/40 text-blue-400/70">
                                ДОСТАВКА
                            </th>
                            <th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-center bg-amber-950/40 text-amber-400/70">
                                ТАМОЖНЯ
                            </th>
                            <th colSpan={2} className="px-4 py-2 border-r border-slate-800 text-center bg-violet-950/40 text-violet-400/70">
                                НАЛОГИ
                            </th>
                            <th colSpan={4} className="px-4 py-2 text-center bg-emerald-950/30 text-emerald-400/60">
                                ПРОЧИЕ РАСХОДЫ
                            </th>
                        </tr>

                        {/* Строка 2: Колонки */}
                        <tr className="bg-slate-800 text-white/90 text-[9px] font-bold uppercase tracking-wider">
                            {/* ТОВАР */}
                            <th className="sticky left-0 z-30 bg-slate-800 px-3 py-3 min-w-[220px] text-left border-r border-slate-700">
                                Позиция
                            </th>
                            <th className="px-2 py-3 text-center min-w-[40px] border-r border-slate-700">
                                Кол.
                            </th>
                            <th className="px-3 py-3 min-w-[150px] border-r border-slate-700 text-indigo-200">
                                Заказ / Контрагент
                            </th>
                            {isManufacturing && (
                                <th className="px-2 py-3 w-[40px] text-center text-slate-500 border-r border-slate-700">
                                    <Trash2 size={11} />
                                </th>
                            )}

                            {/* ПРОДАЖА */}
                            <th className="px-0 py-0 min-w-[100px]">
                                <button
                                    onClick={() => onColumnHeaderClick({ type: 'revenue' })}
                                    className="w-full h-full px-2 py-3 text-[9px] font-bold uppercase tracking-wider bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 transition-all text-center active:scale-[0.97] hover:brightness-125"
                                >
                                    Выручка
                                </button>
                            </th>
                            <th className="px-2 py-3 text-right min-w-[90px] border-r border-slate-700 bg-emerald-950/30 text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
                                Прибыль
                            </th>

                            {/* ЗАКУП */}
                            <th className="px-0 py-0 min-w-[90px] border-r border-slate-700">
                                <button
                                    onClick={() => onColumnHeaderClick({ type: 'addExpense', category: 'other', categoryLabel: 'Закупочная цена' })}
                                    className="w-full h-full px-2 py-3 text-[9px] font-bold uppercase tracking-wider bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 transition-all text-center active:scale-[0.97] hover:brightness-125"
                                >
                                    Закуп
                                </button>
                            </th>

                            {/* РАСХОДЫ */}
                            {EXPENSE_COLS.map(headerBtn)}
                        </tr>

                        {/* Строка 3: Итоги (sticky) */}
                        <tr className="bg-white text-slate-900 border-b-2 border-blue-500/50 text-[10px] font-bold font-mono shadow-[0_4px_10px_-4px_rgba(0,0,0,0.1)] sticky top-[72px] z-10">
                            <td className="sticky left-0 z-20 bg-blue-50/50 px-3 py-2 text-[8px] uppercase tracking-tighter text-blue-600 border-r border-slate-200">
                                ИТОГО ПО СПИСКУ:
                            </td>
                            <td className="px-2 py-2 text-center text-slate-700 border-r border-slate-200 bg-blue-50/50">
                                {items.reduce((s, i) => s + (i.quantity || 1), 0)}
                            </td>
                            <td className="px-3 py-2 border-r border-slate-200 bg-indigo-50/30" />
                            <FooterCell plan={planTotals.revenue} fact={factTotals.revenue > 0 ? factTotals.revenue : undefined} highlight="emerald" inline bgClass="bg-emerald-50/50" />
                            <FooterCell plan={planTotals.profit} fact={factTotals.profit !== 0 ? factTotals.profit : undefined} highlight="blue" borderRight inline bgClass="bg-emerald-50/30" />
                            <FooterCell plan={planTotals.purchase} fact={factTotals.purchase > 0 ? factTotals.purchase : undefined} borderRight inline bgClass="bg-slate-50/50" />
                            {EXPENSE_COLS.map(col => (
                                <FooterCell
                                    key={col.category}
                                    plan={col.planField ? items.reduce((s, i) => s + ((i[col.planField!] as number) || 0) * (i.quantity || 1), 0) : 0}
                                    fact={expenseTotals[col.category] || undefined}
                                    inline
                                    bgClass={col.inlineBgClass}
                                />
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                        {groupedItems.map((item, idx) => {
                            const actual = actualsMap[item.id];
                            const qty = item.quantity || 1;
                            const itemAlloc = allocated[item.id] || {};
                            const factPurchase = actual?.actualPurchaseKzt;
                            // Выручка вычисляется из % оплаты заказа × продажная стоимость позиции
                            const { paid: itemPaid, percent: payPercent } = itemPaidAmounts[item.id] || { paid: 0, percent: 0 };
                            const factRevenue = itemPaid > 0 ? itemPaid : undefined;
                            const totalAllocated = EXPENSE_COLS.reduce((s, col) => s + (itemAlloc[col.category] || 0), 0);
                            const planProfit = (item.profitKzt || 0) * qty;
                            const factProfit = factRevenue != null && factPurchase != null
                                ? factRevenue - factPurchase - totalAllocated
                                : null;

                            const relatedOrder = item.orderId
                                ? salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase())
                                : null;

                            const isFirstMachine = hasBothTypes && item.type === 'MACHINE' && idx === 0;
                            const isSeparatorRow = hasBothTypes && item.type !== 'MACHINE' && (idx === 0 || groupedItems[idx - 1].type === 'MACHINE');

                            return (
                                <React.Fragment key={item.id}>
                                {isFirstMachine && (
                                    <tr className="bg-amber-50/40 border-b border-amber-100/60">
                                        <td colSpan={ACTUAL_TOTAL_COLS} className="px-4 py-1.5 sticky left-0">
                                            <div className="flex items-center gap-2">
                                                <Cpu size={11} className="text-amber-500 shrink-0" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-500/80">Станки и оборудование</span>
                                                <div className="flex-1 h-px bg-amber-200/50" />
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {isSeparatorRow && (
                                    <tr className="bg-blue-50/40 border-t-2 border-blue-200/50 border-b border-blue-100/60">
                                        <td colSpan={ACTUAL_TOTAL_COLS} className="px-4 py-1.5 sticky left-0">
                                            <div className="flex items-center gap-2">
                                                <Package size={11} className="text-blue-400 shrink-0" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-400/80">Запчасти и комплектующие</span>
                                                <div className="flex-1 h-px bg-blue-200/50" />
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                <tr className="group hover:bg-blue-50/20 transition-colors duration-75 text-[11px]">
                                    {/* Позиция */}
                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/20 px-3 py-2.5 border-r border-slate-100 transition-colors">
                                        <div className="flex items-start gap-2">
                                            {item.type === 'MACHINE'
                                                ? <Cpu size={12} className="text-amber-400 shrink-0 mt-0.5" />
                                                : <Package size={12} className="text-blue-300 shrink-0 mt-0.5" />
                                            }
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 text-[12px] leading-snug break-words" title={item.name}>{item.name}</div>
                                                <div className="text-[9px] font-mono text-blue-400 font-bold mt-0.5">{item.sku || '—'}</div>
                                                {item.options && item.options.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                                                        {item.options.map((opt, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 bg-blue-100/50 text-blue-800 rounded text-[9px] font-bold border border-blue-200/30 whitespace-nowrap">{opt.variantName}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Кол. */}
                                    <td className="px-2 py-2.5 text-center border-r border-slate-100">
                                        <span className="text-[12px] font-black text-slate-700 tabular-nums">{qty}</span>
                                    </td>

                                    {/* Заказ / Контрагент */}
                                    <td className="px-3 py-2.5 border-r border-slate-100">
                                        {relatedOrder ? (
                                            <button
                                                onClick={() => onOpenOrder(relatedOrder)}
                                                className="flex flex-col gap-0.5 w-full text-left group/order rounded-lg px-1 py-0.5 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                title="Открыть заказ"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <Tag size={12} className="text-indigo-500 shrink-0 group-hover/order:text-indigo-700 transition-colors" />
                                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none truncate group-hover/order:text-indigo-800 transition-colors underline-offset-2 group-hover/order:underline decoration-indigo-300">
                                                        {relatedOrder.name || relatedOrder.id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 ml-3.5">
                                                    <User size={10} className="text-slate-400 shrink-0 group-hover/order:text-indigo-500 transition-colors" />
                                                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-tighter truncate group-hover/order:text-indigo-800 transition-colors">
                                                        {relatedOrder.clientName || item.clientName || 'Без контрагента'}
                                                    </span>
                                                </div>
                                                {/* % оплаты заказа (сумма теперь в колонке Выручка) */}
                                                {payPercent > 0 && (
                                                    <div className="flex items-center gap-1 ml-3.5 mt-0.5">
                                                        <div className="w-14 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-emerald-400 rounded-full transition-all"
                                                                style={{ width: `${Math.min(100, payPercent)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-black text-emerald-600 font-mono">
                                                            {payPercent.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        ) : item.orderId ? (
                                            <div className="flex flex-col gap-0.5 px-1">
                                                <div className="flex items-center gap-1.5">
                                                    <FileText size={12} className="text-amber-600 shrink-0" />
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{item.orderId}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 ml-3.5">
                                                    <User size={10} className="text-slate-400 shrink-0" />
                                                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tighter truncate">
                                                        {item.clientName || 'Без контрагента'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : canAttachOrder ? (
                                            <button
                                                onClick={() => onCreateOrderForItem?.(item)}
                                                className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors group/attach"
                                                title="Привязать заказ к позиции"
                                            >
                                                <Link size={11} className="text-indigo-400 group-hover/attach:text-indigo-600 shrink-0" />
                                                <span className="text-[9px] font-black text-indigo-500 group-hover/attach:text-indigo-700 uppercase tracking-widest">Привязать заказ</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-1 py-0.5 bg-slate-50 rounded-md border border-slate-100 w-fit">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Под склад</span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Кнопка удаления (только manufacturing) */}
                                    {isManufacturing && (
                                        <td className="px-1 py-2.5 text-center border-r border-slate-100 w-[40px]">
                                            <button
                                                onClick={() => onMarkDelete?.(item.id)}
                                                title="Пометить на удаление"
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    )}

                                    {/* Выручка — кликабельна, открывает детали ПП по позиции */}
                                    <FactPlanCell
                                        plan={(item.revenueKzt || 0) * qty}
                                        fact={factRevenue}
                                        higherIsBad={false}
                                        highlightColor="text-emerald-600"
                                        onClick={onRevenueItemClick ? () => onRevenueItemClick(item.id) : undefined}
                                    />
                                    {/* Прибыль */}
                                    <FactPlanCell plan={planProfit} fact={factProfit ?? undefined} higherIsBad={false} highlightColor="text-blue-600" borderRight />

                                    {/* Закуп */}
                                    <FactPlanCell plan={(item.purchasePriceKzt || 0) * qty} fact={factPurchase} higherIsBad borderRight />

                                    {/* Расходы */}
                                    {EXPENSE_COLS.map(col => (
                                        <FactPlanCell
                                            key={col.category}
                                            plan={col.planField ? ((item[col.planField] as number) || 0) * qty : 0}
                                            fact={itemAlloc[col.category] > 0 ? itemAlloc[col.category] : undefined}
                                            higherIsBad
                                        />
                                    ))}
                                </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>

                </table>
            </div>

            {/* ── Корзина (manufacturing: позиции помечены на удаление) ──────── */}
            {isManufacturing && trashItems.length > 0 && (
                <div className="flex-none mt-3 border border-red-200 rounded-2xl overflow-hidden bg-red-50/40">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-100/60 border-b border-red-200">
                        <Trash2 size={13} className="text-red-500 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
                            Корзина — помечено на удаление: {trashItems.length} поз.
                        </span>
                        <span className="text-[10px] text-red-400 font-bold ml-auto">Подтвердите удаление или восстановите позиции</span>
                    </div>
                    <div className="divide-y divide-red-100">
                        {trashItems.map(item => (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                                <div className="flex items-center gap-2 flex-1 min-w-0 opacity-60">
                                    {item.type === 'MACHINE'
                                        ? <Cpu size={12} className="text-amber-400 shrink-0" />
                                        : <Package size={12} className="text-blue-300 shrink-0" />
                                    }
                                    <div className="min-w-0">
                                        <span className="text-[11px] font-bold text-slate-600 line-through truncate block">{item.name}</span>
                                        <span className="text-[9px] font-mono text-slate-400">{item.sku || '—'} · {item.quantity || 1} шт.</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => onUnmarkDelete?.(item.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                        title="Восстановить позицию"
                                    >
                                        <RotateCcw size={11} /> Восстановить
                                    </button>
                                    <button
                                        onClick={() => onPermanentDelete?.(item.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all"
                                        title="Удалить позицию навсегда"
                                    >
                                        <Trash2 size={11} /> Удалить навсегда
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Ячейка план/факт ──────────────────────────────────────────────────────────

interface FactPlanCellProps {
    plan: number;
    fact?: number;
    higherIsBad: boolean;
    highlightColor?: string;
    borderRight?: boolean;
    onClick?: () => void;
}

const FactPlanCell: React.FC<FactPlanCellProps> = ({ plan, fact, higherIsBad, highlightColor, borderRight, onClick }) => {
    const hasFact = fact != null && fact !== 0;
    const diff = hasFact ? fact! - plan : null;
    const isGood = diff != null ? (higherIsBad ? diff <= 0 : diff >= 0) : null;

    return (
        <td
            className={`px-2 py-2 text-right ${borderRight ? 'border-r border-slate-100' : 'border-r border-slate-50'} last:border-0 ${onClick ? 'cursor-pointer hover:bg-emerald-50/40 transition-colors' : ''}`}
            onClick={onClick}
        >
            {!hasFact && plan === 0 ? (
                <span className="text-[10px] text-slate-200 font-bold">—</span>
            ) : (
                <div className="flex flex-col items-end gap-0.5">
                    {hasFact ? (
                        <>
                            <span className="text-[9px] text-slate-300 tabular-nums">{fmtKzt(plan)}</span>
                            <span className={`text-[11px] font-black tabular-nums ${highlightColor || (isGood ? 'text-emerald-500' : 'text-red-500')}`}>
                                {fmtKzt(fact!)}
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] font-bold text-slate-400 tabular-nums">{fmtKzt(plan)}</span>
                    )}
                </div>
            )}
        </td>
    );
};

interface FooterCellProps {
    plan: number;
    fact?: number;
    highlight?: 'emerald' | 'blue';
    borderRight?: boolean;
    inline?: boolean;
    bgClass?: string;
}

const FooterCell: React.FC<FooterCellProps> = ({ plan, fact, highlight, borderRight, inline, bgClass }) => {
    const hasFact = fact != null && fact !== 0;
    const factColor = highlight === 'emerald' ? 'text-emerald-400' : highlight === 'blue' ? 'text-blue-400' : 'text-slate-300';
    // Если bgClass содержит text-xxx — используем его для факта, иначе дефолтные цвета
    const inlineFactColor = bgClass?.match(/text-\S+/)?.[0]
        ?? (highlight === 'emerald' ? 'text-emerald-600' : highlight === 'blue' ? 'text-blue-600' : 'text-slate-700');

    if (inline) {
        return (
            <td className={`px-2 py-2 text-right font-mono font-bold ${borderRight ? 'border-r border-slate-200' : ''} ${bgClass || ''}`}>
                <div className="flex flex-col items-end gap-0.5">
                    {hasFact ? (
                        <>
                            <span className="text-[8px] text-slate-400 tabular-nums">{fmtKzt(plan)}</span>
                            <span className={`text-[10px] font-black tabular-nums ${inlineFactColor}`}>{fmtKzt(fact!)} ₸</span>
                        </>
                    ) : (
                        <span className="text-[10px] font-black text-slate-500 tabular-nums">{fmtKzt(plan)} ₸</span>
                    )}
                </div>
            </td>
        );
    }

    return (
        <td className={`px-2 py-3 text-right ${borderRight ? 'border-r border-slate-800' : 'border-r border-slate-800/50'} last:border-0`}>
            <div className="flex flex-col items-end gap-0.5">
                {hasFact ? (
                    <>
                        <span className="text-[8px] text-slate-500 tabular-nums">{fmtKzt(plan)}</span>
                        <span className={`text-[11px] font-black tabular-nums ${factColor}`}>{fmtKzt(fact!)}</span>
                    </>
                ) : (
                    <span className="text-[11px] font-black text-slate-400 tabular-nums">{fmtKzt(plan)}</span>
                )}
            </div>
        </td>
    );
};
