
import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    Currency, 
    OrderItem, 
    PlannedPayment, 
    Product, 
    SupplierOrder, 
    ProductType, 
    OrderStatus 
} from '@/types';
import { ApiService } from '@/services/api';

export const useOrderFormState = (
    initialOrder: SupplierOrder | null, 
    initialPayments: PlannedPayment[],
    exchangeRates: Record<Currency, number>,
    cashFlowItems: any[],
    suppliers: any[]
) => {
    const [supplierId, setSupplierId] = useState(initialOrder?.supplierId || '');
    const [orderCurrency, setOrderCurrency] = useState<Currency>(initialOrder?.currency || Currency.USD);
    const [exchangeRateToKZT, setExchangeRateToKZT] = useState(initialOrder?.totalAmountKZT_Est && initialOrder?.totalAmountForeign ? initialOrder.totalAmountKZT_Est / initialOrder.totalAmountForeign : (exchangeRates[Currency.USD] || 1));
    const [items, setItems] = useState<OrderItem[]>(initialOrder?.items.map(i => ({...i})) || []);
    const [formPayments, setFormPayments] = useState<Partial<PlannedPayment>[]>(initialPayments.map(p => ({...p})) || []);
    const [activeFormTab, setActiveFormTab] = useState<'items' | 'payments'>('items');

    useEffect(() => {
        if (!initialOrder) {
            setExchangeRateToKZT(exchangeRates[orderCurrency] || 1);
        }
    }, [orderCurrency, exchangeRates, initialOrder]);

    const totalAmountForeign = useMemo(() => items.reduce((sum, i) => sum + i.totalForeign, 0), [items]);
    const allocatedPaymentSum = useMemo(() => formPayments.reduce((sum, p) => sum + (p.amountDue || 0), 0), [formPayments]);
    const unallocatedAmount = totalAmountForeign - allocatedPaymentSum;

    const calculateCrossRate = useCallback((productCurrency: Currency) => {
        const rateToKZT = exchangeRates[productCurrency] || 1;
        return rateToKZT / (exchangeRateToKZT || 1);
    }, [exchangeRates, exchangeRateToKZT]);

    const handleAddPaymentStep = useCallback(() => {
        const defaultArticleId = cashFlowItems.find(i => i.name === 'Оплата за товар' && i.type === 'Expense')?.id;
        setFormPayments(prev => [...prev, { 
            id: ApiService.generateId(),
            amountDue: Math.max(0, unallocatedAmount), 
            dueDate: new Date().toISOString().split('T')[0], 
            currency: orderCurrency,
            amountPaid: 0,
            isPaid: false,
            cashFlowItemId: defaultArticleId
        }]);
    }, [unallocatedAmount, orderCurrency, cashFlowItems]);

    const validateForm = useCallback(() => {
        if (!supplierId) return "Выберите поставщика";
        if (items.length === 0) return "Добавьте товары в заказ";
        if (allocatedPaymentSum > totalAmountForeign + 0.01) return "Сумма траншей превышает сумму заказа.";
        if (formPayments.some(p => !p.cashFlowItemId)) return "Для всех траншей должна быть выбрана статья ДДС";
        return null;
    }, [supplierId, items, allocatedPaymentSum, totalAmountForeign, formPayments]);

    return {
        supplierId, setSupplierId,
        orderCurrency, setOrderCurrency,
        exchangeRateToKZT, setExchangeRateToKZT,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        totalAmountForeign,
        unallocatedAmount,
        calculateCrossRate,
        handleAddPaymentStep,
        validateForm
    };
};
