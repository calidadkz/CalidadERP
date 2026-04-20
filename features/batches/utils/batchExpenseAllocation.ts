import { PreCalculationItem } from '@/types/pre-calculations';
import { BatchExpense, ChinaDeliveryDistribution } from '@/types/batch';

// Ключи колонок расходов, которые участвуют в распределении в таблице позиций
export type ExpenseColKey =
    | 'logistics_urumqi_almaty'
    | 'logistics_china_domestic'
    | 'logistics_almaty_karaganda'
    | 'customs_vat'
    | 'kpn_standard'
    | 'svh'
    | 'broker'
    | 'customs'
    | 'pnr'
    | 'delivery_local'
    | 'sales_bonus'
    | 'other';

export interface ExpenseColMeta {
    category: ExpenseColKey;
    planField?: keyof PreCalculationItem;  // undefined = распределять по объёму (нет планового поля)
}

export const EXPENSE_COL_METAS: ExpenseColMeta[] = [
    { category: 'logistics_urumqi_almaty',    planField: 'deliveryUrumqiAlmatyKzt' },
    { category: 'logistics_china_domestic',   planField: 'deliveryChinaDomesticKzt' },
    { category: 'logistics_almaty_karaganda', planField: 'deliveryAlmatyKaragandaPerItemKzt' },
    { category: 'svh',                        planField: 'svhPerItemKzt' },
    { category: 'broker',                     planField: 'brokerPerItemKzt' },
    { category: 'customs',                    planField: 'customsFeesPerItemKzt' },
    { category: 'customs_vat',                planField: 'customsNdsKzt' },
    { category: 'kpn_standard',               planField: 'kpnKzt' },
    { category: 'pnr',                        planField: 'pnrKzt' },
    { category: 'delivery_local',             planField: 'deliveryLocalKzt' },
    { category: 'sales_bonus',                planField: 'salesBonusKzt' },
    { category: 'other' },  // нет плана — распределяется по объёму
];

/** Долевое распределение позиций по объёму или весу */
export function computeShares(
    items: PreCalculationItem[],
    targetIds: string[],
    method: 'volume' | 'weight',
): Record<string, number> {
    const targets = targetIds.length > 0 ? items.filter(i => targetIds.includes(i.id)) : items;
    const total = targets.reduce((s, i) => {
        const val = method === 'volume' ? (i.volumeM3 || 0) : (i.weightKg || 0);
        return s + val * (i.quantity || 1);
    }, 0);
    const shares: Record<string, number> = {};
    targets.forEach(i => {
        const val = method === 'volume' ? (i.volumeM3 || 0) : (i.weightKg || 0);
        shares[i.id] = total > 0 ? (val * (i.quantity || 1)) / total : 1 / targets.length;
    });
    return shares;
}

/**
 * Аллоцирует фактические расходы партии на позиции предрасчёта.
 * - logistics_china_domestic: использует ChinaDeliveryDistribution каждого расхода
 * - Остальные: пропорционально плановым суммам (фоллбэк — по объёму)
 * Возвращает result[itemId][category] = KZT
 */
export function allocateExpensesToItems(
    items: PreCalculationItem[],
    expenses: BatchExpense[],
): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};
    items.forEach(i => { result[i.id] = {}; });

    EXPENSE_COL_METAS.forEach(meta => {
        const colExpenses = expenses.filter(e => e.category === meta.category);
        if (colExpenses.length === 0) return;

        if (meta.category === 'logistics_china_domestic') {
            colExpenses.forEach(exp => {
                const dist: ChinaDeliveryDistribution | undefined = exp.chinaDistribution;

                if (dist?.method === 'manual' && dist.manualAmounts) {
                    Object.entries(dist.manualAmounts).forEach(([itemId, amt]) => {
                        if (result[itemId] !== undefined) {
                            result[itemId][meta.category] = (result[itemId][meta.category] || 0) + amt;
                        }
                    });
                } else if (dist?.method === 'weight') {
                    const shares = computeShares(items, dist.targetItemIds, 'weight');
                    Object.entries(shares).forEach(([itemId, share]) => {
                        result[itemId][meta.category] = (result[itemId][meta.category] || 0) + exp.amountKzt * share;
                    });
                } else {
                    // volume (default) или нет distribution
                    const targetIds = dist?.targetItemIds ?? [];
                    const shares = computeShares(items, targetIds, 'volume');
                    Object.entries(shares).forEach(([itemId, share]) => {
                        result[itemId][meta.category] = (result[itemId][meta.category] || 0) + exp.amountKzt * share;
                    });
                }
            });
        } else {
            const total = colExpenses.reduce((s, e) => s + e.amountKzt, 0);
            if (meta.planField) {
                const planTotals = items.map(i => ((i[meta.planField!] as number) || 0) * (i.quantity || 1));
                const grandPlan = planTotals.reduce((s, v) => s + v, 0);
                if (grandPlan > 0) {
                    items.forEach((item, idx) => {
                        result[item.id][meta.category] = total * (planTotals[idx] / grandPlan);
                    });
                } else {
                    const shares = computeShares(items, [], 'volume');
                    items.forEach(item => {
                        result[item.id][meta.category] = total * (shares[item.id] || 0);
                    });
                }
            } else {
                // Нет планового поля — распределяем по объёму
                const shares = computeShares(items, [], 'volume');
                items.forEach(item => {
                    result[item.id][meta.category] = total * (shares[item.id] || 0);
                });
            }
        }
    });

    return result;
}
