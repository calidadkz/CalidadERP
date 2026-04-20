
import { useMemo, useCallback } from 'react';
import { 
    SupplierOrder, 
    PlannedPayment, 
    ActualPayment, 
    ReceptionItem, 
    ReceptionExpense, 
    ExpenseAllocationMethod, 
    Currency,
    Product
} from '@/types';

export const useReceivingLogic = (
    selectedOrderId: string,
    orders: SupplierOrder[],
    plannedPayments: PlannedPayment[],
    actualPayments: ActualPayment[],
    exchangeRates: Record<Currency, number>,
    products: Product[],
    items: ReceptionItem[],
    expenses: ReceptionExpense[]
) => {
    const effectiveInfo = useMemo(() => {
        const order = orders.find(o => o.id === selectedOrderId);
        if (!order) return { rate: 1, type: 'market' as const, totalKzt: 0 };
        
        const relatedPlans = plannedPayments.filter(p => p.sourceDocId === order.id);
        const planIds = relatedPlans.map(p => p.id);
        
        let actualPaidKzt = 0;
        let actualPaidForeign = 0;

        actualPayments.forEach(ap => {
            ap.allocations?.forEach(al => {
                if (planIds.includes(al.plannedPaymentId)) {
                    const apAmount = Number(ap.amount) || 0;
                    const alAmount = Number(al.amountCovered) || 0;
                    const apTotalKzt = Number(ap.totalCostKzt) || 0;
                    const apRate = Number(ap.exchangeRate) || 1;

                    if (apTotalKzt > 0) {
                        const ratio = apAmount > 0 ? alAmount / apAmount : 0;
                        actualPaidKzt += (apTotalKzt * ratio);
                    } else {
                        actualPaidKzt += (alAmount * apRate);
                    }
                    actualPaidForeign += alAmount;
                }
            });
        });

        const orderTotalForeign = Number(order.totalAmountForeign) || 0;
        const remainingForeign = Math.max(0, orderTotalForeign - actualPaidForeign);
        
        if (remainingForeign < 0.01 && orderTotalForeign > 0) {
            const finalRate = actualPaidKzt / orderTotalForeign;
            return { rate: finalRate, type: 'fact' as const, totalKzt: actualPaidKzt };
        } else {
            const marketRate = Number(exchangeRates[order.currency]) || 1;
            const totalEstimatedKzt = actualPaidKzt + (remainingForeign * marketRate);
            const blendedRate = orderTotalForeign > 0 ? totalEstimatedKzt / orderTotalForeign : marketRate;
            
            return { 
                rate: blendedRate, 
                type: actualPaidForeign > 0 ? 'blended' as const : 'market' as const,
                totalKzt: totalEstimatedKzt
            };
        }
    }, [selectedOrderId, orders, actualPayments, plannedPayments, exchangeRates]);

    const currentFinalItems = useMemo(() => {
        const currentRate = effectiveInfo.rate;
        
        return items.map(item => {
            const costBaseKzt = Number(item.priceForeign) * currentRate;
            let allocated = 0;
            
            expenses.forEach(exp => {
                const expInKzt = Number(exp.amount) || 0; 
                const qtyFact = Number(item.qtyFact) || 1;
                
                if (exp.allocationMethod === ExpenseAllocationMethod.SPECIFIC_ITEM) {
                    if (exp.targetItemId === item.id) {
                        allocated += expInKzt / (qtyFact || 1);
                    }
                } else if (exp.allocationMethod === ExpenseAllocationMethod.BY_VOLUME) {
                    const totalVol = items.reduce((s, i) => {
                        const product = products.find(p => p.id === i.productId);
                        const productVolume = product?.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0;
                        return s + (productVolume * Number(i.qtyFact));
                    }, 0);
                    const product = products.find(p => p.id === item.productId);
                    const productVolume = product?.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0;
                    if (totalVol > 0) allocated += (expInKzt * (productVolume * qtyFact / totalVol)) / qtyFact;
                } else if (exp.allocationMethod === ExpenseAllocationMethod.BY_VALUE) {
                    const totalVal = items.reduce((s, i) => s + (Number(i.priceForeign) * currentRate * Number(i.qtyFact)), 0);
                    if (totalVal > 0) allocated += (expInKzt * (costBaseKzt * qtyFact / totalVal)) / qtyFact;
                } else if (exp.allocationMethod === ExpenseAllocationMethod.BY_QUANTITY) {
                    const totalQty = items.reduce((s, i) => s + Number(i.qtyFact), 0);
                    if (totalQty > 0) allocated += (expInKzt * (qtyFact / totalQty)) / qtyFact;
                } else if (exp.allocationMethod === ExpenseAllocationMethod.BY_EQUAL) {
                    // Поровну: каждая позиция (строка) получает равную долю независимо от кол-ва
                    const nItems = items.filter(i => Number(i.qtyFact) > 0).length || 1;
                    allocated += (expInKzt / nItems) / qtyFact;
                }
            });
            
            return { 
                ...item, 
                costBaseKzt: costBaseKzt,
                allocatedExpenseKzt: allocated, 
                finalCostUnitKzt: costBaseKzt + allocated 
            };
        });
    }, [items, expenses, effectiveInfo.rate, products]);

    return { effectiveInfo, currentFinalItems };
};
