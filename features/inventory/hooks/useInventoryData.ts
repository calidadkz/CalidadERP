
import { useMemo, useCallback } from 'react';
import { Product, StockMovement, ProductType } from '@/types';
import { MoneyMath } from '@/services/MoneyMath';

const normalizeOptions = (opts?: string[]) => [...(opts || [])].sort((a, b) => a.localeCompare(b));

export const useInventoryData = (products: Product[], stockMovements: StockMovement[]) => {
  const stockDataMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    
    const sorted = [...stockMovements].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    sorted.forEach(m => {
      if (!map[m.productId]) map[m.productId] = {};
      
      const normOptions = normalizeOptions(m.configuration);
      const key = normOptions.length > 0 ? normOptions.join('|') : 'BASE';
      
      if (!map[m.productId][key]) {
        map[m.productId][key] = { 
          stock: 0, reserved: 0, incoming: 0, 
          optionsInfo: normOptions, 
          totalValueKZT: 0, totalSalesValueKZT: 0 
        };
      }
      
      const target = map[m.productId][key];
      const qty = Number(m.quantity) || 0;
      const movementCost = Number(m.totalCostKZT || (m as any).totalCostKzt) || (Number(m.unitCostKZT || (m as any).unitCostKzt) * qty) || 0;
      const movementSales = Number(m.totalSalesPriceKZT || (m as any).totalSalesPriceKzt) || (Number(m.salesPriceKZT || (m as any).salesPriceKzt) * qty) || 0;

      if (m.statusType === 'Physical') {
        if (m.type === 'In') {
          target.stock += qty;
          target.totalValueKZT = MoneyMath.add(target.totalValueKZT, movementCost);
          target.totalSalesValueKZT = MoneyMath.add(target.totalSalesValueKZT, movementSales);
        } else {
          target.stock -= qty;
          target.totalValueKZT = MoneyMath.subtract(target.totalValueKZT, movementCost);
          target.totalSalesValueKZT = MoneyMath.subtract(target.totalSalesValueKZT, movementSales);
        }
        if (target.stock < 0.0001) { target.totalValueKZT = 0; target.totalSalesValueKZT = 0; }
      } else if (m.statusType === 'Incoming') {
        target.incoming += (m.type === 'In' ? qty : -qty);
      } else if (m.statusType === 'Reserved') {
        target.reserved += (m.type === 'In' ? qty : -qty);
      }
    });
    
    return map;
  }, [stockMovements]);

  const getDetailedBreakdown = useCallback((productId: string) => {
    const productData = stockDataMap[productId];
    if (!productData) return [];
    return Object.values(productData).filter(c => 
      Math.abs(c.stock) > 0.0001 || Math.abs(c.reserved) > 0.0001 || Math.abs(c.incoming) > 0.0001
    );
  }, [stockDataMap]);

  const totals = useMemo(() => {
    let warehouseValue = 0; 
    let potentialRevenue = 0;
    
    Object.values(stockDataMap).forEach(productConfigs => {
      Object.values(productConfigs).forEach(conf => {
        if (conf.stock > 0) {
          warehouseValue += conf.totalValueKZT;
          potentialRevenue += conf.totalSalesValueKZT;
        }
      });
    });
    
    return { warehouseValue, potentialRevenue };
  }, [stockDataMap]);

  return { stockDataMap, getDetailedBreakdown, totals };
};
