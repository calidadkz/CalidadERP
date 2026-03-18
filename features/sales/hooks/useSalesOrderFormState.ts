
import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    SalesOrder, 
    SalesOrderItem, 
    PlannedPayment, 
    Client, 
    Product, 
    OrderStatus, 
    Currency 
} from '@/types';
import { ApiService } from '@/services/api';
import { PricingService } from '@/services/PricingService';

export const useSalesOrderFormState = (
    initialOrder: SalesOrder | null,
    initialPayments: PlannedPayment[],
    clients: Client[],
    pricingProfiles: any[],
    exchangeRates: Record<Currency, number>,
    cashFlowItems: any[]
) => {
    const [selectedClientId, setSelectedClientId] = useState(initialOrder?.clientId || '');
    const [items, setItems] = useState<SalesOrderItem[]>(initialOrder?.items.map(i => ({...i})) || []);
    const [formPayments, setFormPayments] = useState<Partial<PlannedPayment>[]>(initialPayments.map(p => ({...p})) || []);
    const [activeFormTab, setActiveFormTab] = useState<'items' | 'payments'>('items');

    const totalOrderAmount = useMemo(() => items.reduce((sum, i) => sum + (Number(i.totalKZT) || 0), 0), [items]);
    const allocatedPaymentSum = useMemo(() => formPayments.reduce((sum, p) => sum + (Number(p.amountDue) || 0), 0), [formPayments]);
    const unallocatedAmount = totalOrderAmount - allocatedPaymentSum;

    const handleAddPaymentStep = useCallback(() => {
        const defaultArticleId = cashFlowItems.find(i => i.name === 'Выручка от продаж' && i.type === 'Income')?.id;
        setFormPayments(prev => [...prev, { 
            id: ApiService.generateId(), 
            amountDue: Math.max(0, unallocatedAmount), 
            dueDate: new Date().toISOString().split('T')[0], 
            currency: Currency.KZT, 
            amountPaid: 0, 
            isPaid: false,
            cashFlowItemId: defaultArticleId
        }]);
    }, [unallocatedAmount, cashFlowItems]);

    const validateForm = useCallback(() => {
        if (!selectedClientId) return "Выберите клиента";
        if (items.length === 0) return "Добавьте товары в заказ";
        if (Math.abs(unallocatedAmount) > 0.1) return "Сумма в графике оплат должна соответствовать сумме заказа.";
        if (formPayments.some(p => !p.cashFlowItemId)) return "Для всех траншей должна быть выбрана статья ДДС";
        return null;
    }, [selectedClientId, items, unallocatedAmount, formPayments]);

    return {
        selectedClientId, setSelectedClientId,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        totalOrderAmount,
        unallocatedAmount,
        handleAddPaymentStep,
        validateForm
    };
};
