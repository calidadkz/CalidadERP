import { describe, it, expect } from 'vitest';
import { calculateBatchStats } from './BatchCalculator';
import { PreCalculationDocument, BatchItemActuals, BatchExpense } from '../types';

describe('calculateBatchStats', () => {
  const mockPreCalc: Partial<PreCalculationDocument> = {
    items: [
      { id: '1', name: 'Product 1', sku: 'SKU1', quantity: 10, profitKzt: 1000, revenueKzt: 5000, purchasePriceKzt: 2000, deliveryChinaKzt: 500, localLogisticsKzt: 500, customsNdsKzt: 500, totalNdsKzt: 500, kpnKzt: 0, fullCostKzt: 4000 } as any,
      { id: '2', name: 'Product 2', sku: 'SKU2', quantity: 5, profitKzt: 500, revenueKzt: 3000, purchasePriceKzt: 1500, deliveryChinaKzt: 300, localLogisticsKzt: 300, customsNdsKzt: 200, totalNdsKzt: 200, kpnKzt: 0, fullCostKzt: 2500 } as any
    ]
  };

  const mockItemActuals: BatchItemActuals[] = [
    { id: 'a1', batchId: 'b1', preCalculationItemId: '1', actualRevenueKzt: 6000, actualPurchaseKzt: 2000 },
    { id: 'a2', batchId: 'b1', preCalculationItemId: '2', actualRevenueKzt: 2500, actualPurchaseKzt: 1500 }
  ];

  const mockExpenses: BatchExpense[] = [
    { id: 'e1', batchId: 'b1', category: 'logistics_urumqi_almaty', description: 'Logistics', amountKzt: 1000, date: '2024-01-01' },
    { id: 'e2', batchId: 'b1', category: 'customs', description: 'Customs', amountKzt: 800, date: '2024-01-01' },
    { id: 'e3', batchId: 'b1', category: 'other', description: 'Broker', amountKzt: 200, date: '2024-01-01' }
  ];

  it('should return null if no precalculation provided', () => {
    const stats = calculateBatchStats(null, [], []);
    expect(stats).toBeNull();
  });

  it('should calculate correct stats based on input', () => {
    const stats = calculateBatchStats(mockPreCalc as PreCalculationDocument, mockItemActuals, mockExpenses);

    expect(stats).not.toBeNull();
    if (stats) {
      // Planned profit: 1000 + 500 = 1500
      expect(stats.plannedProfit).toBe(1500);

      // Actual revenue: 6000 + 2500 = 8500
      expect(stats.actualRevenue).toBe(8500);

      // Total actual expenses: 1000 + 800 + 200 = 2000
      expect(stats.totalActualExpenses).toBe(2000);

      // Actual profit: 8500 - 2000 = 6500
      expect(stats.actualProfit).toBe(6500);

      // Profit difference percent: ((6500 - 1500) / 1500) * 100 = 333.33%
      expect(stats.profitDiffPercent).toBeCloseTo(333.33, 1);
    }
  });

  it('should correctly group expenses by category', () => {
    const stats = calculateBatchStats(mockPreCalc as PreCalculationDocument, mockItemActuals, mockExpenses);

    expect(stats?.expensesByCategory).toEqual({
      logistics_china: 1000,
      customs: 800,
      other: 200
    });
  });

  it('should handle zero planned profit without division by zero', () => {
    const zeroProfitPreCalc: Partial<PreCalculationDocument> = {
      items: [{ profitKzt: 0 } as any]
    };
    const stats = calculateBatchStats(zeroProfitPreCalc as PreCalculationDocument, mockItemActuals, mockExpenses);
    expect(stats?.profitDiffPercent).toBe(0);
  });
});
