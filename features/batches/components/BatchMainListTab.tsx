import React, { useMemo } from 'react';
import { PreCalculationDocument, PreCalculationItem, BatchItemActuals, BatchExpense, ExpenseCategory } from '@/types';
import { SidebarContext } from './BatchSidebar';
import { ChevronDown, Layers } from 'lucide-react';

interface BatchMainListTabProps {
    preCalculation: PreCalculationDocument;
    itemActuals: BatchItemActuals[];
    expenses: BatchExpense[];
    onColumnHeaderClick: (ctx: SidebarContext) => void;
}

// Определение колонок расходов — ключ, метка, цвет заголовка, поле в PreCalculationItem
interface ExpenseColDef {
    category: ExpenseCategory;
    label: string;
    short: string;
    headerColor: string;     // цвет заголовка
    planField: keyof PreCalculationItem; // поле для плановой суммы (за единицу)
}

const EXPENSE_COLS: ExpenseColDef[] = [
    { category: 'logistics_urumqi_almaty',    label: 'Дост. Урумчи–Алматы',  short: 'Урумчи–Алм.', headerColor: 'bg-blue-700 hover:bg-blue-600',      planField: 'deliveryUrumqiAlmatyKzt' },
    { category: 'logistics_china_domestic',   label: 'Дост. по Китаю',        short: 'По Китаю',    headerColor: 'bg-sky-700 hover:bg-sky-600',        planField: 'deliveryChinaDomesticKzt' },
    { category: 'logistics_almaty_karaganda', label: 'Дост. Алматы–Кар.',     short: 'Алм.–Кар.',   headerColor: 'bg-blue-700 hover:bg-blue-600',      planField: 'deliveryAlmatyKaragandaPerItemKzt' },
    { category: 'svh',                        label: 'СВХ',                   short: 'СВХ',         headerColor: 'bg-amber-700 hover:bg-amber-600',    planField: 'svhPerItemKzt' },
    { category: 'broker',                     label: 'Брокер',                short: 'Брокер',      headerColor: 'bg-amber-700 hover:bg-amber-600',    planField: 'brokerPerItemKzt' },
    { category: 'customs',                    label: 'Тамож. сборы',          short: 'Тамож.',      headerColor: 'bg-amber-700 hover:bg-amber-600',    planField: 'customsFeesPerItemKzt' },
    { category: 'customs_vat',                label: 'НДС Тамож.',            short: 'НДС Там.',    headerColor: 'bg-violet-700 hover:bg-violet-600',  planField: 'customsNdsKzt' },
    { category: 'kpn_standard',               label: 'КПН',                   short: 'КПН',         headerColor: 'bg-rose-700 hover:bg-rose-600',      planField: 'kpnKzt' },
    { category: 'pnr',                        label: 'ПНР',                   short: 'ПНР',         headerColor: 'bg-emerald-700 hover:bg-emerald-600',planField: 'pnrKzt' },
    { category: 'delivery_local',             label: 'До клиента',            short: 'До клиента',  headerColor: 'bg-emerald-700 hover:bg-emerald-600',planField: 'deliveryLocalKzt' },
    { category: 'other',                      label: 'Прочее',                short: 'Прочее',      headerColor: 'bg-slate-600 hover:bg-slate-500',    planField: 'salesBonusKzt' },
];

const fmtKzt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Аллоцировать batch-level расходы на позиции пропорционально плановым значениям
function allocateExpensesToItems(
    items: PreCalculationItem[],
    expenses: BatchExpense[],
): Record<string, Record<string, number>> {
    // result[itemId][category] = allocated KZT
    const result: Record<string, Record<string, number>> = {};
    items.forEach(i => { result[i.id] = {}; });

    EXPENSE_COLS.forEach(col => {
        const total = expenses
            .filter(e => e.category === col.category)
            .reduce((s, e) => s + e.amountKzt, 0);
        if (total === 0) return;

        // Аллоцируем пропорционально плановым суммам по этой статье
        const planTotals = items.map(i => {
            const perUnit = (i[col.planField] as number) || 0;
            return perUnit * (i.quantity || 1);
        });
        const grandPlan = planTotals.reduce((s, v) => s + v, 0);

        items.forEach((item, idx) => {
            const share = grandPlan > 0 ? planTotals[idx] / grandPlan : 1 / items.length;
            result[item.id][col.category] = total * share;
        });
    });

    return result;
}

export const BatchMainListTab: React.FC<BatchMainListTabProps> = ({
    preCalculation,
    itemActuals,
    expenses,
    onColumnHeaderClick,
}) => {
    const items = preCalculation.items;

    // Факт по каждой позиции
    const actualsMap = useMemo(() => {
        const m: Record<string, BatchItemActuals> = {};
        itemActuals.forEach(a => { m[a.preCalculationItemId] = a; });
        return m;
    }, [itemActuals]);

    // Суммы расходов по категориям (факт)
    const expenseTotals = useMemo(() => {
        const m: Partial<Record<ExpenseCategory, number>> = {};
        expenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amountKzt; });
        return m;
    }, [expenses]);

    // Аллоцированные расходы по позициям
    const allocated = useMemo(() => allocateExpensesToItems(items, expenses), [items, expenses]);

    // Итоги по плану
    const planTotals = useMemo(() => {
        const revenue = items.reduce((s, i) => s + (i.revenueKzt || 0) * (i.quantity || 1), 0);
        const purchase = items.reduce((s, i) => s + (i.purchasePriceKzt || 0) * (i.quantity || 1), 0);
        const profit = items.reduce((s, i) => s + (i.profitKzt || 0) * (i.quantity || 1), 0);
        return { revenue, purchase, profit };
    }, [items]);

    // Итоги по факту
    const factTotals = useMemo(() => {
        const revenue = itemActuals.reduce((s, a) => s + (a.actualRevenueKzt || 0), 0);
        const purchase = itemActuals.reduce((s, a) => s + (a.actualPurchaseKzt || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + e.amountKzt, 0);
        const profit = revenue - purchase - totalExpenses;
        return { revenue, purchase, totalExpenses, profit };
    }, [itemActuals, expenses]);

    const headerBtn = (col: ExpenseColDef) => (
        <th key={col.category} className="px-0 py-0 min-w-[90px]">
            <button
                onClick={() => onColumnHeaderClick({ type: 'addExpense', category: col.category, categoryLabel: col.label })}
                title={`Внести факт: ${col.label}`}
                className={`w-full h-full px-2 py-3 text-[8px] font-black uppercase tracking-widest text-white transition-all flex flex-col items-center gap-1 ${col.headerColor}`}
            >
                <span>{col.short}</span>
                {expenseTotals[col.category] ? (
                    <span className="text-[7px] opacity-70 font-bold normal-case tracking-normal">
                        {fmtKzt(expenseTotals[col.category]!)} ₸
                    </span>
                ) : (
                    <span className="text-[7px] opacity-30 font-bold">нажми ↑</span>
                )}
            </button>
        </th>
    );

    return (
        <div className="flex flex-col h-full gap-0">
            {/* Легенда */}
            <div className="flex items-center gap-4 px-2 py-2 flex-none">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-slate-200" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Прогноз</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-200" />
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Факт внесён</span>
                </div>
                <div className="text-[9px] font-bold text-slate-400">· Заголовки колонок = кнопка внесения факта</div>
            </div>

            {/* Таблица */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-100 shadow-sm">
                <table className="border-collapse text-left" style={{ minWidth: '1600px' }}>
                    <thead className="sticky top-0 z-20">
                        <tr>
                            {/* Фиксированные заголовки */}
                            <th className="sticky left-0 z-30 bg-slate-950 px-4 py-3 min-w-[260px] text-left">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Позиция</span>
                            </th>
                            <th className="bg-slate-950 px-3 py-3 min-w-[50px]">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Кол.</span>
                            </th>

                            {/* Закупочная цена */}
                            <th className="px-0 py-0 min-w-[100px]">
                                <button
                                    onClick={() => onColumnHeaderClick({ type: 'addExpense', category: 'other', categoryLabel: 'Закупочная цена' })}
                                    className="w-full h-full px-2 py-3 text-[8px] font-black uppercase tracking-widest bg-slate-700 hover:bg-slate-600 text-white transition-all"
                                >
                                    Закуп
                                </button>
                            </th>

                            {/* Колонки расходов — кликабельные */}
                            {EXPENSE_COLS.map(headerBtn)}

                            {/* Выручка */}
                            <th className="bg-emerald-800 px-3 py-3 min-w-[110px]">
                                <span className="text-[8px] font-black uppercase tracking-widest text-white">Выручка</span>
                            </th>

                            {/* Прибыль */}
                            <th className="bg-slate-800 px-3 py-3 min-w-[100px]">
                                <span className="text-[8px] font-black uppercase tracking-widest text-white">Прибыль</span>
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-50">
                        {items.map(item => {
                            const actual = actualsMap[item.id];
                            const qty = item.quantity || 1;
                            const itemAlloc = allocated[item.id] || {};

                            // Факт закупа
                            const factPurchase = actual?.actualPurchaseKzt;
                            const planPurchase = (item.purchasePriceKzt || 0) * qty;

                            // Факт выручки
                            const factRevenue = actual?.actualRevenueKzt;
                            const planRevenue = (item.revenueKzt || 0) * qty;

                            // Факт прибыли (выручка - закуп - все расходы аллоцированные)
                            const totalAllocated = EXPENSE_COLS.reduce((s, col) => s + (itemAlloc[col.category] || 0), 0);
                            const planProfit = (item.profitKzt || 0) * qty;
                            const factProfit = factRevenue != null && factPurchase != null
                                ? factRevenue - factPurchase - totalAllocated
                                : null;

                            return (
                                <tr key={item.id} className="group hover:bg-slate-50/80 transition-colors">
                                    {/* Позиция */}
                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/80 px-4 py-3 border-r border-slate-100">
                                        <div className="font-black text-slate-900 text-[11px] uppercase tracking-tight leading-snug truncate max-w-[240px]">{item.name}</div>
                                        <div className="text-[9px] font-bold text-blue-400 font-mono mt-0.5">{item.sku || '—'}</div>
                                    </td>

                                    {/* Количество */}
                                    <td className="px-3 py-3 text-center">
                                        <span className="text-[12px] font-black text-slate-700 tabular-nums">{qty}</span>
                                    </td>

                                    {/* Закупочная цена */}
                                    <FactPlanCell
                                        plan={planPurchase}
                                        fact={factPurchase != null ? factPurchase : undefined}
                                        higherIsBad={true}
                                    />

                                    {/* Расходы */}
                                    {EXPENSE_COLS.map(col => {
                                        const planVal = ((item[col.planField] as number) || 0) * qty;
                                        const factVal = itemAlloc[col.category]; // аллоцированный факт
                                        return (
                                            <FactPlanCell
                                                key={col.category}
                                                plan={planVal}
                                                fact={factVal > 0 ? factVal : undefined}
                                                higherIsBad={true}
                                            />
                                        );
                                    })}

                                    {/* Выручка */}
                                    <FactPlanCell
                                        plan={planRevenue}
                                        fact={factRevenue != null ? factRevenue : undefined}
                                        higherIsBad={false}
                                        highlightColor="text-emerald-600"
                                    />

                                    {/* Прибыль */}
                                    <FactPlanCell
                                        plan={planProfit}
                                        fact={factProfit != null ? factProfit : undefined}
                                        higherIsBad={false}
                                        highlightColor="text-blue-600"
                                    />
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* Итоги */}
                    <tfoot className="sticky bottom-0 z-20">
                        <tr className="bg-slate-950 border-t-2 border-slate-800">
                            <td className="sticky left-0 z-10 bg-slate-950 px-4 py-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">ИТОГО</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                                <span className="text-[11px] font-black text-slate-400 tabular-nums">
                                    {items.reduce((s, i) => s + (i.quantity || 1), 0)}
                                </span>
                            </td>
                            {/* Закуп итого */}
                            <FooterCell plan={planTotals.purchase} fact={factTotals.purchase > 0 ? factTotals.purchase : undefined} />
                            {/* Расходы итого */}
                            {EXPENSE_COLS.map(col => (
                                <FooterCell
                                    key={col.category}
                                    plan={items.reduce((s, i) => s + ((i[col.planField] as number) || 0) * (i.quantity || 1), 0)}
                                    fact={expenseTotals[col.category] || undefined}
                                />
                            ))}
                            {/* Выручка итого */}
                            <FooterCell plan={planTotals.revenue} fact={factTotals.revenue > 0 ? factTotals.revenue : undefined} />
                            {/* Прибыль итого */}
                            <FooterCell plan={planTotals.profit} fact={factTotals.profit !== 0 ? factTotals.profit : undefined} />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// ── Ячейка план/факт ──────────────────────────────────────────────────────────

interface FactPlanCellProps {
    plan: number;
    fact?: number;
    higherIsBad: boolean;
    highlightColor?: string;
}

const FactPlanCell: React.FC<FactPlanCellProps> = ({ plan, fact, higherIsBad, highlightColor }) => {
    const hasFact = fact != null && fact !== 0;
    const diff = hasFact ? fact! - plan : null;
    const isGood = diff != null ? (higherIsBad ? diff <= 0 : diff >= 0) : null;

    // Показываем план если нет факта, факт если есть
    const displayValue = hasFact ? fact! : plan;
    const isEstimated = !hasFact && plan === 0;

    return (
        <td className="px-2 py-2 text-right border-r border-slate-50 last:border-0">
            {isEstimated ? (
                <span className="text-[10px] text-slate-200 font-bold">—</span>
            ) : (
                <div className="flex flex-col items-end gap-0.5">
                    {hasFact ? (
                        <>
                            {/* Плановое значение — мелкое серое */}
                            <span className="text-[9px] text-slate-300 tabular-nums line-through">
                                {fmtKzt(plan)}
                            </span>
                            {/* Фактическое — крупное, подсвечено */}
                            <span className={`text-[11px] font-black tabular-nums ${highlightColor || (isGood ? 'text-emerald-500' : 'text-red-500')}`}>
                                {fmtKzt(displayValue)}
                            </span>
                        </>
                    ) : (
                        /* Только план — обычный цвет */
                        <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                            {fmtKzt(plan)}
                        </span>
                    )}
                </div>
            )}
        </td>
    );
};

// ── Ячейка итогов ─────────────────────────────────────────────────────────────

const FooterCell: React.FC<{ plan: number; fact?: number }> = ({ plan, fact }) => {
    const hasFact = fact != null && fact !== 0;
    return (
        <td className="px-2 py-3 text-right border-r border-slate-800 last:border-0">
            <div className="flex flex-col items-end gap-0.5">
                {hasFact ? (
                    <>
                        <span className="text-[8px] text-slate-500 tabular-nums">{fmtKzt(plan)}</span>
                        <span className="text-[11px] font-black text-blue-400 tabular-nums">{fmtKzt(fact!)}</span>
                    </>
                ) : (
                    <span className="text-[11px] font-black text-slate-400 tabular-nums">{fmtKzt(plan)}</span>
                )}
            </div>
        </td>
    );
};
