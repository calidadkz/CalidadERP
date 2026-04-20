import React, { useMemo } from 'react';
import { ArrowLeft, Calendar, Banknote, TrendingUp, Package, Cpu, Tag, User } from 'lucide-react';
import { PlannedPayment, SalesOrder } from '@/types';
import { PreCalculationItem } from '@/types/pre-calculations';
import { fmt } from './types';

interface RevenueSidebarPanelProps {
    /** 'overview' — клик на заголовок колонки Выручка; 'item' — клик на ячейку конкретной строки */
    mode: 'overview' | 'item';
    /** ID позиции предрасчёта (только для mode='item') */
    itemId?: string;
    incomingPlannedPayments: PlannedPayment[];
    salesOrders: SalesOrder[];
    preCalculationItems: PreCalculationItem[];
    onBack?: () => void;
}

// Вычисляет для позиции: какая сумма разнесена на неё из каждого ПП
function calcItemAllocations(
    item: PreCalculationItem,
    salesOrders: SalesOrder[],
    plannedPayments: PlannedPayment[],
): { order: SalesOrder | null; pps: Array<{ pp: PlannedPayment; allocatedKzt: number }>; totalAllocated: number; itemRevenue: number; sharePercent: number } {
    const itemRevenue = (item.revenueKzt || 0) * (item.quantity || 1);
    if (!item.orderId) {
        return { order: null, pps: [], totalAllocated: 0, itemRevenue, sharePercent: 0 };
    }
    const order = salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase()) ?? null;
    if (!order || !order.totalAmount || order.totalAmount === 0) {
        return { order, pps: [], totalAllocated: 0, itemRevenue, sharePercent: 0 };
    }
    const ratio = itemRevenue / order.totalAmount;
    const sharePercent = ratio * 100;
    const pps = plannedPayments
        .filter(p => p.sourceDocId === order.id && (p.amountPaid || 0) > 0)
        .map(pp => ({
            pp,
            allocatedKzt: Math.round((pp.amountPaid || 0) * ratio),
        }));
    const totalAllocated = pps.reduce((s, x) => s + x.allocatedKzt, 0);
    return { order, pps, totalAllocated, itemRevenue, sharePercent };
}

const fmtPct = (v: number) => `${v.toFixed(0)}%`;

// ── Overview (заголовок колонки) ──────────────────────────────────────────────

export const RevenueSidebarPanel: React.FC<RevenueSidebarPanelProps> = ({
    mode,
    itemId,
    incomingPlannedPayments,
    salesOrders,
    preCalculationItems,
    onBack,
}) => {
    if (mode === 'item' && itemId) {
        return (
            <RevenueItemPanel
                itemId={itemId}
                incomingPlannedPayments={incomingPlannedPayments}
                salesOrders={salesOrders}
                preCalculationItems={preCalculationItems}
                onBack={onBack}
            />
        );
    }
    return (
        <RevenueOverviewPanel
            incomingPlannedPayments={incomingPlannedPayments}
            salesOrders={salesOrders}
            preCalculationItems={preCalculationItems}
        />
    );
};

// ── Overview: все заказы партии, итог разнесения ──────────────────────────────

const RevenueOverviewPanel: React.FC<{
    incomingPlannedPayments: PlannedPayment[];
    salesOrders: SalesOrder[];
    preCalculationItems: PreCalculationItem[];
}> = ({ incomingPlannedPayments, salesOrders, preCalculationItems }) => {
    // Группируем позиции по orderId
    const orderGroups = useMemo(() => {
        const groups: Record<string, PreCalculationItem[]> = {};
        preCalculationItems.forEach(item => {
            const key = item.orderId || '__none__';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [preCalculationItems]);

    const grandTotal = useMemo(() => {
        return preCalculationItems.reduce((s, item) => {
            const alloc = calcItemAllocations(item, salesOrders, incomingPlannedPayments);
            return s + alloc.totalAllocated;
        }, 0);
    }, [preCalculationItems, salesOrders, incomingPlannedPayments]);

    const totalPlanned = useMemo(() =>
        preCalculationItems.reduce((s, i) => s + (i.revenueKzt || 0) * (i.quantity || 1), 0),
        [preCalculationItems]
    );

    const orderIds = Object.keys(orderGroups).filter(k => k !== '__none__');
    const noOrderItems = orderGroups['__none__'] || [];

    if (orderIds.length === 0 && noOrderItems.length === 0) {
        return (
            <div className="p-6 text-center py-10">
                <Banknote size={28} className="mx-auto text-slate-200 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Нет позиций</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* Итоговая строка сверху */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Итого разнесено на партию</div>
                <div className="text-[18px] font-black font-mono text-emerald-700">{fmt(grandTotal)}</div>
                <div className="text-[9px] text-slate-500 font-bold">
                    из плановой выручки {fmt(totalPlanned)}
                    {totalPlanned > 0 && (
                        <span className="ml-1 text-emerald-600">
                            ({fmtPct((grandTotal / totalPlanned) * 100)})
                        </span>
                    )}
                </div>
                {totalPlanned > 0 && (
                    <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden mt-1">
                        <div
                            className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (grandTotal / totalPlanned) * 100)}%` }}
                        />
                    </div>
                )}
            </div>

            {/* По каждому заказу */}
            {orderIds.map(orderId => {
                const items = orderGroups[orderId];
                const order = salesOrders.find(o => o.id?.toLowerCase() === orderId.toLowerCase());
                const orderPPs = incomingPlannedPayments.filter(p => p.sourceDocId === orderId);
                const totalPaid = orderPPs.reduce((s, p) => s + (p.amountPaid || 0), 0);
                const allocatedFromOrder = items.reduce((s, item) => {
                    return s + calcItemAllocations(item, salesOrders, incomingPlannedPayments).totalAllocated;
                }, 0);

                return (
                    <div key={orderId} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Заголовок заказа */}
                        <div className="bg-indigo-50/60 px-3 py-2 flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <Tag size={10} className="text-indigo-500 shrink-0" />
                                    <span className="text-[10px] font-black text-slate-800 truncate">
                                        {order?.name || orderId.slice(0, 16).toUpperCase()}
                                    </span>
                                </div>
                                {order?.clientName && (
                                    <div className="flex items-center gap-1 ml-3.5 mt-0.5">
                                        <User size={9} className="text-slate-400 shrink-0" />
                                        <span className="text-[9px] font-bold text-slate-500 truncate">{order.clientName}</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[9px] text-slate-400 font-bold">Оплачено</div>
                                <div className="text-[10px] font-black font-mono text-emerald-600">{fmt(totalPaid)}</div>
                                {order?.totalAmount ? (
                                    <div className="text-[8px] text-slate-400 font-bold">
                                        из {fmt(order.totalAmount)}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Позиции этого заказа */}
                        <div className="divide-y divide-slate-100">
                            {items.map(item => {
                                const alloc = calcItemAllocations(item, salesOrders, incomingPlannedPayments);
                                return (
                                    <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            {item.type === 'MACHINE'
                                                ? <Cpu size={9} className="text-amber-400 shrink-0" />
                                                : <Package size={9} className="text-blue-300 shrink-0" />
                                            }
                                            <span className="text-[9px] font-bold text-slate-600 truncate">{item.name}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] font-black font-mono text-emerald-600">
                                                {fmt(alloc.totalAllocated)}
                                            </div>
                                            <div className="text-[8px] text-slate-400 font-bold">
                                                {fmtPct(alloc.sharePercent)} от заказа
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Итог по заказу */}
                        <div className="bg-slate-50 px-3 py-1.5 flex items-center justify-between border-t border-slate-100">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                Разнесено с заказа на партию
                            </span>
                            <span className="text-[10px] font-black font-mono text-emerald-600">{fmt(allocatedFromOrder)}</span>
                        </div>
                    </div>
                );
            })}

            {/* Позиции без заказа */}
            {noOrderItems.length > 0 && (
                <div className="border border-slate-100 rounded-xl overflow-hidden opacity-50">
                    <div className="bg-slate-50 px-3 py-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Без заказа — {noOrderItems.length} поз.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Per-item: детали ПП для конкретной позиции ────────────────────────────────

const RevenueItemPanel: React.FC<{
    itemId: string;
    incomingPlannedPayments: PlannedPayment[];
    salesOrders: SalesOrder[];
    preCalculationItems: PreCalculationItem[];
    onBack?: () => void;
}> = ({ itemId, incomingPlannedPayments, salesOrders, preCalculationItems, onBack }) => {
    const item = preCalculationItems.find(i => i.id === itemId);

    const alloc = useMemo(() => {
        if (!item) return null;
        return calcItemAllocations(item, salesOrders, incomingPlannedPayments);
    }, [item, salesOrders, incomingPlannedPayments]);

    if (!item) {
        return <div className="p-4 text-slate-400 text-[10px]">Позиция не найдена</div>;
    }

    return (
        <div className="p-4 space-y-4">
            {/* Кнопка назад */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
                >
                    <ArrowLeft size={11} /> Все позиции
                </button>
            )}

            {/* Карточка позиции */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                    {item.type === 'MACHINE'
                        ? <Cpu size={12} className="text-amber-400 shrink-0" />
                        : <Package size={12} className="text-blue-300 shrink-0" />
                    }
                    <span className="text-[11px] font-black text-slate-800">{item.name}</span>
                </div>
                {item.sku && <div className="text-[9px] font-mono text-blue-400 font-bold ml-5">{item.sku}</div>}
                <div className="ml-5 flex items-center gap-3 mt-1">
                    <div>
                        <div className="text-[8px] text-slate-400 font-bold uppercase">Плановая выручка</div>
                        <div className="text-[11px] font-black font-mono text-slate-700">{fmt((item.revenueKzt || 0) * (item.quantity || 1))}</div>
                    </div>
                    <div>
                        <div className="text-[8px] text-emerald-600 font-bold uppercase">Факт</div>
                        <div className="text-[11px] font-black font-mono text-emerald-600">{fmt(alloc?.totalAllocated || 0)}</div>
                    </div>
                </div>
            </div>

            {/* Нет заказа */}
            {!item.orderId && (
                <div className="py-6 text-center">
                    <Banknote size={24} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Заказ не привязан</p>
                </div>
            )}

            {/* Заказ есть, но не найден в системе */}
            {item.orderId && !alloc?.order && (
                <div className="py-4 text-center text-[9px] text-slate-400 font-bold">
                    Заказ {item.orderId} не найден
                </div>
            )}

            {/* Детали заказа */}
            {alloc?.order && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-500">
                        <TrendingUp size={10} /> Заказ покупателя
                    </div>
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <Tag size={10} className="text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-black text-slate-800">{alloc.order.name || alloc.order.id}</span>
                        </div>
                        {alloc.order.clientName && (
                            <div className="flex items-center gap-1.5">
                                <User size={9} className="text-slate-400 shrink-0" />
                                <span className="text-[9px] font-bold text-slate-500">{alloc.order.clientName}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-2 text-[9px]">
                            <div>
                                <div className="text-slate-400 font-bold uppercase">Сумма заказа</div>
                                <div className="font-black font-mono text-slate-700">{fmt(alloc.order.totalAmount || 0)}</div>
                            </div>
                            <div>
                                <div className="text-slate-400 font-bold uppercase">Доля позиции</div>
                                <div className="font-black font-mono text-indigo-600">{fmtPct(alloc.sharePercent)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Плановые платежи */}
            {alloc?.pps && alloc.pps.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                        <Calendar size={10} /> Платёжные документы (ПП)
                    </div>
                    {alloc.pps.map(({ pp, allocatedKzt }) => (
                        <div key={pp.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] font-black text-slate-800 truncate">
                                        {pp.counterpartyName || 'Без контрагента'}
                                    </div>
                                    <div className="text-[8px] text-slate-400 font-bold mt-0.5">
                                        {pp.dueDate} · {pp.sourceDocId?.slice(0, 12).toUpperCase()}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                                <div>
                                    <div className="text-slate-400 font-bold uppercase">Оплачено по ПП</div>
                                    <div className="font-black font-mono text-slate-700">{fmt(pp.amountPaid || 0)}</div>
                                </div>
                                <div>
                                    <div className="text-emerald-600 font-bold uppercase">На эту позицию</div>
                                    <div className="font-black font-mono text-emerald-600">{fmt(allocatedKzt)}</div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Итог по позиции */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Итого на позицию</span>
                        <span className="text-[14px] font-black font-mono text-emerald-700">{fmt(alloc.totalAllocated)}</span>
                    </div>
                </div>
            )}

            {/* Нет платежей */}
            {alloc?.order && alloc.pps.length === 0 && (
                <div className="py-4 text-center">
                    <Banknote size={22} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Платежей ещё нет</p>
                    <p className="text-[8px] text-slate-300 mt-1">Ожидается оплата по заказу</p>
                </div>
            )}
        </div>
    );
};
