import { BatchExpense, BatchItemActuals, PreCalculationDocument } from "../types";

export interface BatchStats {
    plannedProfit: number;
    actualProfit: number;
    actualRevenue: number;
    totalActualExpenses: number;
    expensesByCategory: Record<string, number>;
    profitDiffPercent: number;
}

/**
 * Вычисляет статистику партии на основе предрасчета, фактических доходов и расходов.
 */
export const calculateBatchStats = (
    preCalculation: PreCalculationDocument | null,
    itemActuals: BatchItemActuals[],
    expenses: BatchExpense[]
): BatchStats | null => {
    if (!preCalculation) return null;

    // 1. Плановая прибыль (сумма прибыли по всем айтемам в предрасчете)
    const plannedProfit = preCalculation.items.reduce((sum, item) => sum + (item.profitKzt || 0), 0);

    // 2. Фактическая выручка (сумма из таблицы фактических показателей по айтемам)
    const actualRevenue = itemActuals.reduce((sum, act) => sum + (act.actualRevenueKzt || 0), 0);

    // 3. Расходы по категориям
    const actualExpensesByCategory = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + (exp.amountKzt || 0);
        return acc;
    }, {} as Record<string, number>);

    // 4. Общие фактические расходы
    const totalActualExpenses = expenses.reduce((sum, exp) => sum + (exp.amountKzt || 0), 0);

    // 5. Фактическая прибыль = Выручка - Расходы
    const actualProfit = actualRevenue - totalActualExpenses;

    // 6. Разница в процентах
    const profitDiffPercent = plannedProfit !== 0 
        ? ((actualProfit - plannedProfit) / Math.abs(plannedProfit)) * 100 
        : 0;

    return {
        plannedProfit,
        actualProfit,
        actualRevenue,
        totalActualExpenses,
        expensesByCategory: actualExpensesByCategory,
        profitDiffPercent
    };
};
