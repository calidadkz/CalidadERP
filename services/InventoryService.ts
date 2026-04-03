
import { StockMovement, MovementStatus } from '../types';
import { MoneyMath } from './MoneyMath';
import { ApiService } from './api';

export interface StockLot {
    unitCostKzt: number;
    salesPriceKzt: number;
    quantityRemaining: number;
    date: string;
    configKey: string;
}

export class InventoryService {
    /**
     * Рассчитывает агрегированный баланс продукта по всем комплектациям.
     */
    static getProductBalance(productId: string, movements: StockMovement[]) {
        const pMovements = movements.filter(m => m.productId === productId);
        
        const physical = pMovements
            .filter(m => m.statusType === 'Physical')
            .reduce((acc, m) => acc + (m.type === 'In' ? m.quantity : -m.quantity), 0);
            
        const incoming = pMovements
            .filter(m => m.statusType === 'Incoming')
            .reduce((acc, m) => acc + (m.type === 'In' ? m.quantity : -m.quantity), 0);
            
        const reserved = pMovements
            .filter(m => m.statusType === 'Reserved')
            .reduce((acc, m) => acc + (m.type === 'In' ? m.quantity : -m.quantity), 0);

        return {
            physical,
            incoming,
            reserved,
            free: physical + incoming - reserved
        };
    }

    static calculateNewWeightedAverageCost(
        currentStock: number,
        currentAvgCost: number,
        incomingQty: number,
        incomingUnitCost: number
    ): number {
        const newTotalStock = MoneyMath.add(currentStock, incomingQty);
        if (newTotalStock <= 0) return currentAvgCost || 0;
        const totalValue = MoneyMath.add(
            MoneyMath.multiply(currentStock, currentAvgCost || 0),
            MoneyMath.multiply(incomingQty, incomingUnitCost)
        );
        return MoneyMath.divide(totalValue, newTotalStock);
    }

    static createMovement(
        type: 'In' | 'Out',
        docType: StockMovement['documentType'],
        docId: string,
        item: { productId: string; sku: string; productName: string; qty: number; configuration?: string[] },
        statusType: MovementStatus = 'Physical',
        unitCostKzt: number = 0,
        description?: string,
        salesPriceKzt: number = 0
    ): StockMovement {
        return {
            id: ApiService.generateUUID(),
            date: new Date().toISOString().split('T')[0],
            productId: item.productId,
            sku: item.sku,
            productName: item.productName,
            type,
            quantity: item.qty,
            unitCostKzt,
            totalCostKzt: MoneyMath.multiply(item.qty, unitCostKzt),
            salesPriceKzt,
            statusType,
            documentType: docType,
            documentId: docId,
            description,
            configuration: item.configuration
        };
    }

    /**
     * Возвращает список доступных "лотов" ТМЦ на основе истории физических движений.
     */
    static getAvailableLots(productId: string, movements: StockMovement[], config?: string[]): StockLot[] {
        const targetConfigKey = (config || []).sort().join('|') || 'BASE';
        
        const ins = movements
            .filter(m => m.productId === productId && m.type === 'In' && m.statusType === 'Physical')
            .sort((a, b) => a.date.localeCompare(b.date));
        
        const lots: StockLot[] = ins.map(m => ({
            unitCostKzt: Number(m.unitCostKzt) || 0,
            salesPriceKzt: Number(m.salesPriceKzt) || 0,
            quantityRemaining: Number(m.quantity) || 0,
            date: m.date,
            configKey: (m.configuration || []).sort().join('|') || 'BASE'
        })).filter(l => l.configKey === targetConfigKey);

        const outs = movements
            .filter(m => m.productId === productId && m.type === 'Out' && m.statusType === 'Physical')
            .filter(m => ((m.configuration || []).sort().join('|') || 'BASE') === targetConfigKey)
            .sort((a, b) => a.date.localeCompare(b.date));

        outs.forEach(out => {
            let toRemove = Number(out.quantity) || 0;
            for (const lot of lots) {
                if (toRemove <= 0) break;
                if (lot.quantityRemaining > 0) {
                    const take = Math.min(lot.quantityRemaining, toRemove);
                    lot.quantityRemaining -= take;
                    toRemove -= take;
                }
            }
        });

        return lots.filter(l => l.quantityRemaining > 0.0001);
    }

    /**
     * Рассчитывает финансовые параметры расхода по FIFO.
     */
    static calculateFIFODeduction(productId: string, qty: number, movements: StockMovement[], config?: string[]) {
        const lots = this.getAvailableLots(productId, movements, config);
        let remainingToShip = qty;
        let totalCostKzt = 0;
        let totalSalesKzt = 0;

        for (const lot of lots) {
            if (remainingToShip <= 0) break;
            const take = Math.min(lot.quantityRemaining, remainingToShip);
            
            totalCostKzt = MoneyMath.add(totalCostKzt, MoneyMath.multiply(take, lot.unitCostKzt));
            totalSalesKzt = MoneyMath.add(totalSalesKzt, MoneyMath.multiply(take, lot.salesPriceKzt));
            
            remainingToShip -= take;
        }

        if (remainingToShip > 0.001) {
            console.warn(`FIFO: Not enough lots for product ${productId}. Remaining: ${remainingToShip}`);
        }

        const avgCost = qty > 0 ? totalCostKzt / qty : 0;
        const avgSale = qty > 0 ? totalSalesKzt / qty : 0;

        return {
            totalCostKzt,
            totalSalesKzt,
            unitCostKzt: avgCost,
            unitSalesKzt: avgSale
        };
    }
}
