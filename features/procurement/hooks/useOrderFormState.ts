
import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    Currency, 
    OrderItem, 
    PlannedPayment, 
    Product, 
    SupplierOrder, 
    ProductType, 
    OrderStatus,
    CashFlowCategory,
    OrderDocument
} from '@/types';
import { ApiService } from '@/services/api';

export const useOrderFormState = (
    initialOrder: SupplierOrder | null, 
    initialPayments: PlannedPayment[],
    exchangeRates: Record<Currency, number>,
    cashFlowItems: any[],
    suppliers: any[]
) => {
    // Генерируем ID сразу, если это новый заказ
    const [orderId] = useState(initialOrder?.id || `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const [orderName, setOrderName] = useState(initialOrder?.name || ''); // Новое поле: Название заказа
    
    const [supplierId, setSupplierId] = useState(initialOrder?.supplierId || '');
    const [orderCurrency, setOrderCurrency] = useState<Currency>(initialOrder?.currency || Currency.Usd);
    const [exchangeRateToKzt, setExchangeRateToKzt] = useState(initialOrder?.totalAmountKztEst && initialOrder?.totalAmountForeign ? initialOrder.totalAmountKztEst / initialOrder.totalAmountForeign : (exchangeRates[Currency.Usd] || 1));
    const [items, setItems] = useState<OrderItem[]>(initialOrder?.items.map(i => ({...i})) || []);
    const [formPayments, setFormPayments] = useState<Partial<PlannedPayment>[]>(initialPayments.map(p => ({...p})) || []);
    const [activeFormTab, setActiveFormTab] = useState<'items' | 'payments'>('items');

    const [contractUrl, setContractUrl] = useState(initialOrder?.contractUrl || '');
    const [contractName, setContractName] = useState(initialOrder?.contractName || '');
    const [additionalDocuments, setAdditionalDocuments] = useState<OrderDocument[]>(initialOrder?.additionalDocuments || []);

    useEffect(() => {
        if (!initialOrder) {
            setExchangeRateToKzt(exchangeRates[orderCurrency] || 1);
        }
    }, [orderCurrency, exchangeRates, initialOrder]);

    const totalAmountForeign = useMemo(() => items.reduce((sum, i) => sum + i.totalForeign, 0), [items]);
    const allocatedPaymentSum = useMemo(() => formPayments.reduce((sum, p) => sum + (p.amountDue || 0), 0), [formPayments]);
    const unallocatedAmount = totalAmountForeign - allocatedPaymentSum;

    const calculateCrossRate = useCallback((productCurrency: Currency) => {
        const rateToKzt = exchangeRates[productCurrency] || 1;
        return rateToKzt / (exchangeRateToKzt || 1);
    }, [exchangeRates, exchangeRateToKzt]);

    const handleAddPaymentStep = useCallback(() => {
        const defaultArticle = cashFlowItems.find(i => i.name === 'Оплата за товар' && i.type === 'Expense');
        setFormPayments(prev => [...prev, { 
            id: ApiService.generateId(),
            amountDue: Math.max(0, unallocatedAmount), 
            dueDate: new Date().toISOString().split('T')[0], 
            currency: orderCurrency,
            amountPaid: 0,
            isPaid: false,
            cashFlowItemId: defaultArticle?.id,
            cashFlowCategory: CashFlowCategory.OPERATING
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
        orderId,
        orderName, setOrderName, // Возвращаем состояние названия заказа
        supplierId, setSupplierId,
        orderCurrency, setOrderCurrency,
        exchangeRateToKzt, setExchangeRateToKzt,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        contractUrl, setContractUrl,
        contractName, setContractName,
        additionalDocuments, setAdditionalDocuments,
        totalAmountForeign,
        unallocatedAmount,
        calculateCrossRate,
        handleAddPaymentStep,
        validateForm
    };
};
