
import { useMemo, useCallback } from 'react';
import { Product, ProductType } from '@/types';

/**
 * Хук для работы с остатками. 
 * ВНИМАНИЕ: Теперь он принимает готовые данные из View v_inventory_summary,
 * а не считает их из истории движений на фронтенде.
 */
export const useInventoryData = (products: Product[], inventorySummary: any[]) => {
  // Основной расчет мапы остатков на основе данных из View
  const stockDataMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    
    for (let i = 0; i < inventorySummary.length; i++) {
      const entry = inventorySummary[i];
      const productId = entry.productId;
      
      if (!map[productId]) map[productId] = {};
      
      // Конфигурация из View уже нормализована (массив строк)
      const configArray = entry.configuration || [];
      const key = configArray.length === 0 ? 'BASE' : configArray.sort().join('|');
      
      map[productId][key] = { 
        stock: Number(entry.stock) || 0, 
        reserved: Number(entry.reserved) || 0, 
        incoming: Number(entry.incoming) || 0, 
        optionsInfo: configArray, 
        totalValueKzt: Number(entry.totalValueKzt) || 0, 
        totalSalesValueKzt: Number(entry.totalSalesValueKzt) || 0 
      };
    }
    
    return map;
  }, [inventorySummary]);

  const getDetailedBreakdown = useCallback((productId: string) => {
    const productData = stockDataMap[productId];
    if (!productData) return [];
    return Object.values(productData);
  }, [stockDataMap]);

  const totals = useMemo(() => {
    let warehouseValue = 0; 
    let potentialRevenue = 0;
    
    const entries = inventorySummary;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.stock > 0) {
        warehouseValue += Number(entry.totalValueKzt) || 0;
        potentialRevenue += Number(entry.totalSalesValueKzt) || 0;
      }
    }
    
    return { warehouseValue, potentialRevenue };
  }, [inventorySummary]);

  return { stockDataMap, getDetailedBreakdown, totals };
};
