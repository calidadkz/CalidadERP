
import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
    SalesOrder, 
    SalesOrderItem, 
    PlannedPayment, 
    Client, 
    Product, 
    OrderStatus, 
    Currency,
    OrderDocument,
    CashFlowItem
} from '@/types';
import { ApiService } from '@/services/api';

export const useSalesOrderFormState = (
    initialOrder: SalesOrder | null,
    initialPayments: PlannedPayment[],
    clients: Client[],
    pricingProfiles: any[],
    exchangeRates: Record<Currency, number>,
    cashFlowItems: CashFlowItem[]
) => {
    // Генерируем уникальный ID сразу при открытии формы
    const [orderId] = useState(initialOrder?.id || `SALES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const [orderName, setOrderName] = useState(initialOrder?.name || ''); // Новое поле: Название заказа

    const [selectedClientId, setSelectedClientId] = useState(initialOrder?.clientId || '');
    const [items, setItems] = useState<SalesOrderItem[]>(initialOrder?.items.map(i => ({...i})) || []);
    const [formPayments, setFormPayments] = useState<Partial<PlannedPayment>[]>(initialPayments.map(p => ({...p})) || []);
    const [activeFormTab, setActiveFormTab] = useState<'items' | 'payments'>('items');

    const [contractUrl, setContractUrl] = useState(initialOrder?.contractUrl || '');
    const [contractName, setContractName] = useState(initialOrder?.contractName || '');
    const [contractDeliveryDate, setContractDeliveryDate] = useState(initialOrder?.contractDeliveryDate || '');
    const [additionalDocuments, setAdditionalDocuments] = useState<OrderDocument[]>(initialOrder?.additionalDocuments || []);

    const totalOrderAmount = useMemo(() => items.reduce((sum, i) => sum + (Number(i.totalKzt) || 0), 0), [items]);
    const allocatedPaymentSum = useMemo(() => formPayments.reduce((sum, p) => sum + (Number(p.amountDue) || 0), 0), [formPayments]);
    const unallocatedAmount = totalOrderAmount - allocatedPaymentSum;

    const handleAddPaymentStep = useCallback(() => {
        // Улучшенный поиск статьи: игнорируем регистр и пробелы
        const normalizedTargetName = 'продажа товара'.toLowerCase().replace(/\s/g, '');
        const defaultArticle = cashFlowItems.find(i => 
            i.type === 'Income' && 
            i.name.toLowerCase().replace(/\s/g, '').includes(normalizedTargetName)
        );

        if (!defaultArticle) {
            console.warn("Статья доходов 'Продажа товара' (тип Income) не найдена в списке CashFlowItems. Установите вручную.");
        }

        setFormPayments(prev => [...prev, { 
            id: ApiService.generateId(), 
            amountDue: Math.max(0, unallocatedAmount), 
            dueDate: new Date().toISOString().split('T')[0], 
            currency: Currency.Kzt, 
            amountPaid: 0, 
            isPaid: false,
            cashFlowItemId: defaultArticle?.id // Устанавливаем найденный ID или undefined
        }]);
    }, [unallocatedAmount, cashFlowItems]);

    const validateForm = useCallback(() => {
        if (!selectedClientId) return "Выберите клиента";
        if (items.length === 0) return "Добавьте товары в заказ";
        if (Math.abs(unallocatedAmount) > 0.1) return "Сумма в графике оплат должна соответствовать сумме заказа.";
        if (formPayments.some(p => !p.cashFlowItemId)) return "Для всех траншей должна быть выбрана статья ДДС";
        if (contractUrl && !contractDeliveryDate) return "Укажите крайнюю дату поставки по договору";
        return null;
    }, [selectedClientId, items, unallocatedAmount, formPayments, contractUrl, contractDeliveryDate]);

    return {
        orderId,
        orderName, setOrderName, // Возвращаем состояние названия заказа
        selectedClientId, setSelectedClientId,
        items, setItems,
        formPayments, setFormPayments,
        activeFormTab, setActiveFormTab,
        contractUrl, setContractUrl,
        contractName, setContractName,
        contractDeliveryDate, setContractDeliveryDate,
        additionalDocuments, setAdditionalDocuments,
        totalOrderAmount,
        unallocatedAmount,
        handleAddPaymentStep,
        validateForm
    };
};
