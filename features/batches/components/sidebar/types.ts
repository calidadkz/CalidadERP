import { ActualPayment, PlannedPayment } from '@/types';
import { ExpenseCategory } from '@/types/batch';

export interface SidebarContext {
    type: 'summary' | 'addExpense' | 'revenue' | 'revenueItem';
    category?: ExpenseCategory;
    categoryLabel?: string;
    /** ID позиции предрасчёта (для режима revenueItem) */
    itemId?: string;
}

export interface BatchStats {
    plannedRevenue: number;
    plannedExpenses: number;
    plannedProfit: number;
    actualRevenue: number;
    totalActualExpenses: number;
    actualProfit: number;
    profitDiffPercent: number;
    revenueProgress: number;
}

export type SourceType = 'manual' | 'calendar' | 'statement' | 'allocation';

export interface AddState {
    source: SourceType;
    description: string;
    amountKzt: number;
    date: string;
    plannedPaymentId?: string;
    paymentId?: string;
    allocationId?: string;
}

/** Аллокация, обогащённая данными родительских документов */
export interface EnrichedAllocation {
    id: string;
    actualPaymentId: string;
    plannedPaymentId?: string;
    cashFlowItemId: string;
    batchId?: string;     // если задан — аллокация занята этой партией
    amountCovered: number;
    description?: string;
    ap: ActualPayment;    // родительская выписка
    pp?: PlannedPayment;  // плановый платёж (если есть)
}

// ── Форматирование ────────────────────────────────────────────────────────────

export const fmt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

export const fmtShort = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' млн ₸';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + ' тыс ₸';
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸';
};
