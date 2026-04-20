import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BatchExpense, PlannedPayment, ActualPayment, Reception, SalesOrder } from '@/types';
import { CashFlowItem } from '@/types/finance';
import { PreCalculationItem } from '@/types/pre-calculations';
import { CategoryCashFlowMap } from '../hooks/useBatchCategoryMap';

import { SidebarContext, BatchStats, AddState, EnrichedAllocation } from './sidebar/types';
import { SummaryPanel } from './sidebar/SummaryPanel';
import { RevenueSidebarPanel } from './sidebar/RevenueSidebarPanel';
import { AddExpensePanel } from './sidebar/AddExpensePanel';

export type { SidebarContext };

interface BatchSidebarProps {
    batchId: string;
    context: SidebarContext;
    onClose: () => void;
    stats: BatchStats | null;
    expenses: BatchExpense[];
    receptions: Reception[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    incomingPlannedPayments: PlannedPayment[];
    incomingActualPayments: ActualPayment[];
    preCalculationItems: PreCalculationItem[];
    salesOrders: SalesOrder[];
    cashFlowItems: CashFlowItem[];
    categoryMap: CategoryCashFlowMap;
    onAddExpense: (expense: Omit<BatchExpense, 'id' | 'batchId'>) => Promise<any>;
    onUpdateItemRevenue: (preCalcItemId: string, data: { actualRevenueKzt: number }) => Promise<any>;
}

export const BatchSidebar: React.FC<BatchSidebarProps> = ({
    batchId,
    context,
    onClose,
    stats,
    expenses,
    receptions,
    plannedPayments,
    actualPayments,
    incomingPlannedPayments,
    incomingActualPayments,
    preCalculationItems,
    salesOrders,
    cashFlowItems,
    categoryMap,
    onAddExpense,
    onUpdateItemRevenue,
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
            description: pp.counterpartyName || '',
            amountKzt: (pp.amountDue || 0) - (pp.amountPaid || 0),
            date: pp.dueDate || prev.date,
            plannedPaymentId: pp.id,
            paymentId: undefined,
            allocationId: undefined,
        }));
    };

    const handleSelectActual = (ap: ActualPayment) => {
        setAdding(prev => ({
            ...prev,
            description: `${ap.counterpartyName || ''}${ap.purpose ? ': ' + ap.purpose : ''}`,
            amountKzt: ap.totalCostKzt || ap.amount || 0,
            date: ap.date,
            paymentId: ap.id,
            plannedPaymentId: undefined,
            allocationId: undefined,
        }));
    };

    const handleSelectAllocation = (alloc: EnrichedAllocation) => {
        setAdding(prev => ({
            ...prev,
            description: alloc.description || alloc.ap.counterpartyName || '',
            amountKzt: alloc.amountCovered,
            date: alloc.ap.date,
            paymentId: alloc.actualPaymentId,
            plannedPaymentId: alloc.plannedPaymentId,
            allocationId: alloc.id,
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
                allocationId: adding.allocationId,
            });
            setAdding({ source: 'manual', description: '', amountKzt: 0, date: new Date().toISOString().split('T')[0] });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const categoryExpenses = context.category
        ? expenses.filter(e => e.category === context.category)
        : [];

    return (
        <div className="w-72 lg:w-80 xl:w-96 flex-none flex flex-col bg-white rounded-[1.5rem] xl:rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            {/* Шапка */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {context.type === 'summary' ? 'Сводка по партии'
                        : context.type === 'revenue' ? 'Выручка — все заказы'
                        : context.type === 'revenueItem' ? 'Выручка — позиция'
                        : `Внести: ${context.categoryLabel}`}
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
                        batchId={batchId}
                        adding={adding}
                        setAdding={setAdding}
                        saving={saving}
                        categoryExpenses={categoryExpenses}
                        plannedPayments={plannedPayments}
                        actualPayments={actualPayments}
                        cashFlowItems={cashFlowItems}
                        priorityCashFlowItemId={categoryMap[context.category]}
                        onSelectPlanned={handleSelectPlanned}
                        onSelectActual={handleSelectActual}
                        onSelectAllocation={handleSelectAllocation}
                        onSubmit={handleSubmit}
                        onCancel={onClose}
                    />
                )}

                {(context.type === 'revenue' || context.type === 'revenueItem') && (
                    <RevenueSidebarPanel
                        mode={context.type === 'revenueItem' ? 'item' : 'overview'}
                        itemId={context.itemId}
                        incomingPlannedPayments={incomingPlannedPayments}
                        salesOrders={salesOrders}
                        preCalculationItems={preCalculationItems}
                        onBack={context.type === 'revenueItem' ? () => onClose() : undefined}
                    />
                )}
            </div>
        </div>
    );
};
