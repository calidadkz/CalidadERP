import { useState, useCallback, useEffect, useMemo } from 'react';
import { Batch, BatchExpense, BatchDocument, BatchItemActuals, BatchTimeline, PreCalculationDocument, PlannedPayment, ActualPayment, Reception } from '@/types';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from '@/services/firebase';

export const useBatches = (id?: string) => {
    const [batch, setBatch] = useState<Batch | null>(null);
    const [preCalculation, setPreCalculation] = useState<PreCalculationDocument | null>(null);
    const [expenses, setExpenses] = useState<BatchExpense[]>([]);
    const [documents, setDocuments] = useState<BatchDocument[]>([]);
    const [itemActuals, setItemActuals] = useState<BatchItemActuals[]>([]);
    const [receptions, setReceptions] = useState<Reception[]>([]);

    // Справочники для привязки
    const [plannedPayments, setPlannedPayments] = useState<PlannedPayment[]>([]);
    const [actualPayments, setActualPayments] = useState<ActualPayment[]>([]);

    const [isLoading, setIsLoading] = useState(false);

    const loadBatchData = useCallback(async (batchId: string) => {
        setIsLoading(true);
        try {
            // 1. Партия
            const batchData = await api.fetchOne<Batch>(TableNames.BATCHES, batchId);
            if (!batchData) return;
            setBatch(batchData);

            // 2. Предрасчёт — полный маппинг всех полей
            const preCalcData = await api.fetchOne<any>(TableNames.PRE_CALCULATIONS, batchData.preCalculationId);
            if (preCalcData) {
                const items = await api.fetchAll<any>(TableNames.PRE_CALCULATION_ITEMS, { pre_calculation_id: preCalcData.id });
                setPreCalculation({
                    ...preCalcData,
                    items: items.map((item: any) => ({
                        id: item.id,
                        name: item.productName,
                        sku: item.sku,
                        quantity: item.quantity,
                        type: item.type || 'MACHINE',
                        supplierName: item.supplierName || '',
                        // Выручка
                        revenueKzt: item.sellingPriceKzt || 0,
                        isRevenueConfirmed: item.isRevenueConfirmed || false,
                        // Закупочная цена
                        purchasePrice: item.purchasePrice || 0,
                        purchasePriceCurrency: item.purchasePriceCurrency || 'USD',
                        purchasePriceKzt: item.purchaseKzt || 0,
                        // Логистика
                        deliveryUrumqiAlmatyKzt: item.deliveryUrumqiAlmatyKzt || 0,
                        deliveryChinaDomesticKzt: item.deliveryChinaDomesticKzt || 0,
                        deliveryAlmatyKaragandaPerItemKzt: item.deliveryAlmatyKaragandaPerItemKzt || item.logisticsAlmatyKaragandaKzt || 0,
                        // Таможня
                        svhPerItemKzt: item.svhPerItemKzt || 0,
                        brokerPerItemKzt: item.brokerPerItemKzt || 0,
                        customsFeesPerItemKzt: item.customsFeesPerItemKzt || 0,
                        // Налоги
                        customsNdsKzt: item.customsNdsKzt || 0,
                        totalNdsKzt: item.totalNdsKzt || 0,
                        ndsDifferenceKzt: item.ndsDifferenceKzt || 0,
                        kpnKzt: item.kpnKzt || 0,
                        // Прочие расходы
                        pnrKzt: item.pnrKzt || 0,
                        deliveryLocalKzt: item.deliveryLocalKzt || 0,
                        salesBonusKzt: item.salesBonusKzt || 0,
                        // Итог
                        preSaleCostKzt: item.preSaleCostKzt || 0,
                        fullCostKzt: item.fullCostKzt || 0,
                        profitKzt: item.profitKzt || 0,
                        marginPercentage: item.marginPercentage || 0,
                        taxRegime: item.taxRegime || 'Общ.',
                        // Габариты
                        volumeM3: item.volumeM3 || 0,
                        weightKg: item.weightKg || 0,
                        packages: item.packages || [],
                        useDimensions: item.useDimensions || false,
                    }))
                } as PreCalculationDocument);
            }

            // 3. Факты по позициям
            const actuals = await api.fetchAll<BatchItemActuals>(TableNames.BATCH_ITEM_ACTUALS, { batch_id: batchId });
            setItemActuals(actuals);

            // 4. Расходы
            const batchExpenses = await api.fetchAll<BatchExpense>(TableNames.BATCH_EXPENSES, { batch_id: batchId });
            setExpenses(batchExpenses);

            // 5. Документы
            const batchDocs = await api.fetchAll<BatchDocument>(TableNames.BATCH_DOCUMENTS, { batch_id: batchId });
            setDocuments(batchDocs);

            // 6. Приёмки, связанные с этой партией
            const linkedReceptions = await api.fetchAll<Reception>(TableNames.RECEPTIONS, { batch_id: batchId });
            setReceptions(linkedReceptions);

            // 7. Платежи для выбора при ручном добавлении расходов
            const [planned, actual] = await Promise.all([
                api.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS, { direction: 'Outgoing' }),
                api.fetchAll<ActualPayment>(TableNames.ACTUAL_PAYMENTS, { direction: 'Outgoing' })
            ]);
            setPlannedPayments(planned);
            setActualPayments(actual);

        } catch (error) {
            console.error("Failed to load batch data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (id && id !== 'new') {
            loadBatchData(id);
        }
    }, [id, loadBatchData]);

    const addExpense = async (expense: Omit<BatchExpense, 'id' | 'batchId'>) => {
        if (!id) return;
        const newExpense = await api.create<BatchExpense>(TableNames.BATCH_EXPENSES, {
            ...expense,
            batchId: id,
            id: api.generateId('BE')
        });
        setExpenses(prev => [...prev, newExpense]);
        return newExpense;
    };

    const deleteExpense = async (expenseId: string) => {
        await api.delete(TableNames.BATCH_EXPENSES, expenseId);
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
    };

    // Обновить/создать факт по позиции предрасчёта
    const updateItemActuals = async (preCalcItemId: string, data: { actualRevenueKzt?: number; actualPurchaseKzt?: number }) => {
        if (!id) return;
        const existing = itemActuals.find(a => a.preCalculationItemId === preCalcItemId);
        if (existing) {
            const updated = await api.update<BatchItemActuals>(TableNames.BATCH_ITEM_ACTUALS, existing.id, data);
            setItemActuals(prev => prev.map(a => a.id === existing.id ? { ...a, ...data } : a));
            return updated;
        } else {
            const created = await api.create<BatchItemActuals>(TableNames.BATCH_ITEM_ACTUALS, {
                id: api.generateId('BIA'),
                batchId: id,
                preCalculationItemId: preCalcItemId,
                actualRevenueKzt: data.actualRevenueKzt ?? 0,
                actualPurchaseKzt: data.actualPurchaseKzt ?? 0,
            });
            setItemActuals(prev => [...prev, created]);
            return created;
        }
    };

    const uploadDocument = async (file: File) => {
        if (!id) return;
        const fileId = api.generateId('BD');
        const storageRef = ref(storage, `batches/${id}/${fileId}_${file.name}`);
        try {
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            const newDoc = await api.create<BatchDocument>(TableNames.BATCH_DOCUMENTS, {
                id: fileId,
                batchId: id,
                name: file.name,
                url: url,
                type: file.type,
                size: file.size,
                uploadedAt: new Date().toISOString()
            });
            setDocuments(prev => [...prev, newDoc]);
            return newDoc;
        } catch (error) {
            console.error("File upload failed:", error);
            throw error;
        }
    };

    const updateTimeline = async (timeline: BatchTimeline) => {
        if (!id || !batch) return;
        await api.update<Batch>(TableNames.BATCHES, id, { timeline } as any);
        setBatch(prev => prev ? { ...prev, timeline } : null);
    };

    const deleteDocument = async (doc: BatchDocument) => {
        try {
            const storageRef = ref(storage, doc.url);
            await deleteObject(storageRef);
            await api.delete(TableNames.BATCH_DOCUMENTS, doc.id);
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
        } catch (error) {
            console.error("Failed to delete document:", error);
        }
    };

    const stats = useMemo(() => {
        if (!preCalculation) return null;
        const plannedProfit = preCalculation.items.reduce((sum, item) => sum + (item.profitKzt || 0), 0);
        const plannedRevenue = preCalculation.items.reduce((sum, item) => sum + ((item.revenueKzt || 0) * (item.quantity || 1)), 0);
        const plannedExpenses = preCalculation.items.reduce((sum, item) => sum + (
            ((item.purchasePriceKzt || 0) +
             (item.deliveryUrumqiAlmatyKzt || 0) +
             (item.deliveryChinaDomesticKzt || 0) +
             (item.deliveryAlmatyKaragandaPerItemKzt || 0) +
             (item.svhPerItemKzt || 0) +
             (item.brokerPerItemKzt || 0) +
             (item.customsFeesPerItemKzt || 0) +
             (item.customsNdsKzt || 0) +
             (item.kpnKzt || 0) +
             (item.pnrKzt || 0) +
             (item.deliveryLocalKzt || 0)) * (item.quantity || 1)
        ), 0);
        const actualRevenue = itemActuals.reduce((sum, act) => sum + (act.actualRevenueKzt || 0), 0);
        const actualExpensesByCategory = expenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amountKzt;
            return acc;
        }, {} as Record<string, number>);
        const totalActualExpenses = expenses.reduce((sum, exp) => sum + exp.amountKzt, 0);
        const actualProfit = actualRevenue - totalActualExpenses;
        return {
            plannedProfit,
            plannedRevenue,
            plannedExpenses,
            actualProfit,
            actualRevenue,
            totalActualExpenses,
            expensesByCategory: actualExpensesByCategory,
            profitDiffPercent: plannedProfit !== 0 ? ((actualProfit - plannedProfit) / Math.abs(plannedProfit)) * 100 : 0,
            revenueProgress: plannedRevenue > 0 ? (actualRevenue / plannedRevenue) * 100 : 0,
        };
    }, [preCalculation, itemActuals, expenses]);

    return {
        batch,
        preCalculation,
        expenses,
        documents,
        itemActuals,
        receptions,
        plannedPayments,
        actualPayments,
        isLoading,
        stats,
        addExpense,
        deleteExpense,
        updateItemActuals,
        updateTimeline,
        uploadDocument,
        deleteDocument,
        refresh: () => id && loadBatchData(id)
    };
};
