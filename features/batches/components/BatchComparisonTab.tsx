import React, { useMemo } from 'react';
import { PreCalculationDocument, BatchItemActuals, BatchExpense } from '@/types';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface BatchComparisonTabProps {
    preCalculation: PreCalculationDocument;
    itemActuals: BatchItemActuals[];
    expenses: BatchExpense[];
}

const fmt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

const DiffBadge: React.FC<{ plan: number; fact: number; higherIsBad?: boolean }> = ({
    plan, fact, higherIsBad = false
}) => {
    if (fact === 0) return <span className="text-slate-300 text-[10px] font-bold">—</span>;
    const diff = fact - plan;
    const pct = plan !== 0 ? (diff / Math.abs(plan)) * 100 : 0;
    const isGood = higherIsBad ? diff <= 0 : diff >= 0;
    const Icon = Math.abs(pct) < 0.5 ? Minus : isGood ? TrendingUp : TrendingDown;

    return (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
            isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
        }`}>
            <Icon size={10}/>
            {diff > 0 ? '+' : ''}{pct.toFixed(1)}%
        </div>
    );
};

export const BatchComparisonTab: React.FC<BatchComparisonTabProps> = ({
    preCalculation,
    itemActuals,
    expenses,
}) => {
    const items = preCalculation.items;

    const actualsMap = useMemo(() => {
        const m: Record<string, BatchItemActuals> = {};
        itemActuals.forEach(a => { m[a.preCalculationItemId] = a; });
        return m;
    }, [itemActuals]);

    // Суммы расходов по категориям
    const expenseByCategory = useMemo(() => {
        const m: Record<string, number> = {};
        expenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amountKzt; });
        return m;
    }, [expenses]);

    // Плановые суммарные значения
    const planSums = useMemo(() => ({
        revenue:          items.reduce((s, i) => s + (i.revenueKzt || 0) * (i.quantity || 1), 0),
        purchase:         items.reduce((s, i) => s + (i.purchasePriceKzt || 0) * (i.quantity || 1), 0),
        chinaLogistics:   items.reduce((s, i) => s + (i.deliveryUrumqiAlmatyKzt || 0) * (i.quantity || 1), 0),
        chinaDomestic:    items.reduce((s, i) => s + (i.deliveryChinaDomesticKzt || 0) * (i.quantity || 1), 0),
        karaLogistics:    items.reduce((s, i) => s + (i.deliveryAlmatyKaragandaPerItemKzt || 0) * (i.quantity || 1), 0),
        svh:              items.reduce((s, i) => s + (i.svhPerItemKzt || 0) * (i.quantity || 1), 0),
        broker:           items.reduce((s, i) => s + (i.brokerPerItemKzt || 0) * (i.quantity || 1), 0),
        customs:          items.reduce((s, i) => s + (i.customsFeesPerItemKzt || 0) * (i.quantity || 1), 0),
        customsVat:       items.reduce((s, i) => s + (i.customsNdsKzt || 0) * (i.quantity || 1), 0),
        kpn:              items.reduce((s, i) => s + (i.kpnKzt || 0) * (i.quantity || 1), 0),
        pnr:              items.reduce((s, i) => s + (i.pnrKzt || 0) * (i.quantity || 1), 0),
        deliveryLocal:    items.reduce((s, i) => s + (i.deliveryLocalKzt || 0) * (i.quantity || 1), 0),
        profit:           items.reduce((s, i) => s + (i.profitKzt || 0) * (i.quantity || 1), 0),
        fullCost:         items.reduce((s, i) => s + (i.fullCostKzt || 0) * (i.quantity || 1), 0),
    }), [items]);

    // Фактические значения
    const factRevenue = itemActuals.reduce((s, a) => s + (a.actualRevenueKzt || 0), 0);
    const factPurchase = itemActuals.reduce((s, a) => s + (a.actualPurchaseKzt || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amountKzt, 0);
    const factProfit = factRevenue - factPurchase - totalExpenses;

    type CompRow = {
        label: string;
        plan: number;
        fact: number;
        higherIsBad?: boolean;
        isSeparator?: boolean;
        isTotal?: boolean;
    };

    const rows: CompRow[] = [
        { label: 'ВЫРУЧКА', plan: planSums.revenue, fact: factRevenue, higherIsBad: false, isTotal: true },
        { isSeparator: true, label: '', plan: 0, fact: 0 },
        { label: 'Закупочная цена', plan: planSums.purchase, fact: factPurchase, higherIsBad: true },
        { label: 'Доставка Урумчи–Алматы', plan: planSums.chinaLogistics, fact: expenseByCategory['logistics_urumqi_almaty'] || 0, higherIsBad: true },
        { label: 'Доставка по Китаю', plan: planSums.chinaDomestic, fact: expenseByCategory['logistics_china_domestic'] || 0, higherIsBad: true },
        { label: 'Доставка Алматы–Кар.', plan: planSums.karaLogistics, fact: expenseByCategory['logistics_almaty_karaganda'] || 0, higherIsBad: true },
        { label: 'СВХ', plan: planSums.svh, fact: expenseByCategory['svh'] || 0, higherIsBad: true },
        { label: 'Брокер', plan: planSums.broker, fact: expenseByCategory['broker'] || 0, higherIsBad: true },
        { label: 'Таможенные сборы', plan: planSums.customs, fact: expenseByCategory['customs'] || 0, higherIsBad: true },
        { label: 'НДС Таможенный', plan: planSums.customsVat, fact: expenseByCategory['customs_vat'] || 0, higherIsBad: true },
        { label: 'КПН', plan: planSums.kpn, fact: (expenseByCategory['kpn_standard'] || 0) + (expenseByCategory['kpn_simplified'] || 0), higherIsBad: true },
        { label: 'ПНР', plan: planSums.pnr, fact: expenseByCategory['pnr'] || 0, higherIsBad: true },
        { label: 'Доставка до клиента', plan: planSums.deliveryLocal, fact: expenseByCategory['delivery_local'] || 0, higherIsBad: true },
        { label: 'Прочие расходы', plan: 0, fact: expenseByCategory['other'] || 0, higherIsBad: true },
        { isSeparator: true, label: '', plan: 0, fact: 0 },
        { label: 'ИТОГО РАСХОДЫ', plan: planSums.fullCost - planSums.profit, fact: totalExpenses, higherIsBad: true, isTotal: true },
        { isSeparator: true, label: '', plan: 0, fact: 0 },
        { label: 'ПРИБЫЛЬ', plan: planSums.profit, fact: factProfit, higherIsBad: false, isTotal: true },
    ];

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Инфо-баннер */}
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-2xl border border-blue-100">
                <Info size={14} className="text-blue-500 flex-none" />
                <p className="text-[10px] font-bold text-blue-600">
                    Сравнение плановых показателей из предрасчёта с фактическими данными по партии.
                    Подробности по расходам — во вкладке «Расходы».
                </p>
            </div>

            {/* Таблица */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-100 shadow-sm bg-white">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-950">
                        <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <th className="px-6 py-4 text-left w-1/2">Показатель</th>
                            <th className="px-6 py-4 text-right">Прогноз</th>
                            <th className="px-6 py-4 text-right">Факт</th>
                            <th className="px-6 py-4 text-right">Отклонение</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            if (row.isSeparator) {
                                return <tr key={idx}><td colSpan={4} className="h-px bg-slate-100" /></tr>;
                            }

                            const hasFact = row.fact > 0;
                            const isTotal = row.isTotal;

                            return (
                                <tr key={idx} className={`${isTotal ? 'bg-slate-50' : 'hover:bg-slate-50/50'} transition-colors`}>
                                    <td className={`px-6 py-3 ${isTotal ? 'font-black text-slate-800 uppercase tracking-tight text-[11px]' : 'font-bold text-slate-600 text-[11px]'}`}>
                                        {row.label}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className={`tabular-nums ${isTotal ? 'text-sm font-black text-slate-800' : 'text-xs font-bold text-slate-500'}`}>
                                            {row.plan > 0 ? fmt(row.plan) : '—'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {hasFact ? (
                                            <span className={`tabular-nums ${isTotal ? 'text-sm font-black' : 'text-xs font-black'} ${
                                                row.higherIsBad ? 'text-amber-600' : 'text-blue-600'
                                            }`}>
                                                {fmt(row.fact)}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-300">не внесено</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {hasFact ? (
                                            <DiffBadge plan={row.plan} fact={row.fact} higherIsBad={row.higherIsBad} />
                                        ) : (
                                            <span className="text-slate-200 text-[10px]">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Сводные KPI-карточки */}
            <div className="grid grid-cols-3 gap-4 flex-none">
                <KpiCard
                    label="Прогноз прибыли"
                    value={planSums.profit}
                    subLabel="из предрасчёта"
                    colorClass="text-slate-600"
                />
                <KpiCard
                    label="Факт. прибыль"
                    value={factProfit}
                    subLabel={factRevenue > 0 ? 'рассчитано' : 'нет данных'}
                    colorClass={factProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}
                />
                <KpiCard
                    label="Отклонение"
                    value={factRevenue > 0 ? factProfit - planSums.profit : null}
                    subLabel={factRevenue > 0 && planSums.profit !== 0
                        ? `${((factProfit - planSums.profit) / Math.abs(planSums.profit) * 100).toFixed(1)}% от прогноза`
                        : 'нет данных'}
                    colorClass={factProfit >= planSums.profit ? 'text-emerald-600' : 'text-red-500'}
                />
            </div>
        </div>
    );
};

const KpiCard: React.FC<{ label: string; value: number | null; subLabel: string; colorClass: string }> = ({
    label, value, subLabel, colorClass
}) => (
    <div className="bg-slate-900 rounded-2xl p-5">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</div>
        <div className={`text-xl font-black tabular-nums tracking-tighter ${colorClass}`}>
            {value != null
                ? value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸'
                : '—'}
        </div>
        <div className="text-[9px] font-bold text-slate-600 mt-1">{subLabel}</div>
    </div>
);
