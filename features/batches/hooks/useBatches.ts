import { useState, useCallback, useEffect, useMemo } from 'react';
import { Batch, BatchExpense, BatchDocument, BatchItemActuals, BatchStatus, BatchTimeline, PreCalculationDocument, PlannedPayment, ActualPayment, Reception, PaymentAllocation } from '@/types';
import { PreCalculationItem } from '@/types/pre-calculations';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from '@/services/firebase';
import { supabase } from '@/services/supabaseClient';

export const useBatches = (id?: string) => {
    const [batch, setBatch] = useState<Batch | null>(null);
    const [preCalculation, setPreCalculation] = useState<PreCalculationDocument | null>(null);
    const [expenses, setExpenses] = useState<BatchExpense[]>([]);
    const [documents, setDocuments] = useState<BatchDocument[]>([]);
    const [itemActuals, setItemActuals] = useState<BatchItemActuals[]>([]);
    const [receptions, setReceptions] = useState<Reception[]>([]);

    // Справочники для добавления расходов (исходящие)
    const [plannedPayments, setPlannedPayments] = useState<PlannedPayment[]>([]);
    const [actualPayments, setActualPayments] = useState<ActualPayment[]>([]);

    // Входящие платежи по заказам, привязанным в предрасчёте (для выручки)
    const [incomingPlannedPayments, setIncomingPlannedPayments] = useState<PlannedPayment[]>([]);
    const [incomingActualPayments, setIncomingActualPayments] = useState<ActualPayment[]>([]);

    const [isLoading, setIsLoading] = useState(false);

    const loadBatchData = useCallback(async (batchId: string) => {
        setIsLoading(true);
        try {
            // 1. Партия
            const batchData = await api.fetchOne<Batch>(TableNames.BATCHES, batchId);
            if (!batchData) return;
            setBatch({ ...batchData, deletedItemIds: batchData.deletedItemIds ?? [] });

            // 2. Предрасчёт — полный маппинг всех полей
            let preCalcItems: any[] = [];
            const preCalcData = await api.fetchOne<any>(TableNames.PRE_CALCULATIONS, batchData.preCalculationId);
            if (preCalcData) {
                preCalcItems = await api.fetchAll<any>(TableNames.PRE_CALCULATION_ITEMS, { pre_calculation_id: preCalcData.id });
                const items = preCalcItems;
                setPreCalculation({
                    ...preCalcData,
                    items: items.map((item: any) => ({
                        id: item.id,
                        name: item.productName,
                        sku: item.sku,
                        quantity: item.quantity,
                        type: item.type || 'MACHINE',
                        supplierName: item.supplierName || '',
                        // Привязка к заказу клиента
                        orderId: item.orderId || null,
                        clientName: item.clientName || '',
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

            // 7. Исходящие платежи + аллокации для привязки расходов
            const [planned, actualRaw, allAllocationsRaw] = await Promise.all([
                api.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS, { direction: 'Outgoing' }),
                api.fetchAll<ActualPayment>(TableNames.ACTUAL_PAYMENTS, { direction: 'Outgoing' }),
                api.fetchAll<PaymentAllocation>(TableNames.PAYMENT_ALLOCATIONS),
            ]);
            setPlannedPayments(planned);
            // Джойним аллокации к платежам
            const actual = actualRaw.map(ap => ({
                ...ap,
                allocations: allAllocationsRaw.filter(a => a.actualPaymentId === ap.id),
            }));
            setActualPayments(actual);

            // 8. Входящие платежи по заказам из предрасчёта + по самому предрасчёту
            const orderIds = preCalcItems
                .map((i: any) => i.orderId)
                .filter((id: any): id is string => !!id);

            // Ищем платежи по: id заказов ИЗ позиций предрасчёта + id самого предрасчёта
            const sourceDocIds = [...new Set([...orderIds, batchData.preCalculationId])];

            const [allIncomingPP, allIncomingAP] = await Promise.all([
                api.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS, { direction: 'Incoming' }),
                api.fetchAll<ActualPayment>(TableNames.ACTUAL_PAYMENTS, { direction: 'Incoming' }),
            ]);

            const linkedPP = allIncomingPP.filter(p => sourceDocIds.includes(p.sourceDocId));
            setIncomingPlannedPayments(linkedPP);

            const linkedPPIds = new Set(linkedPP.map(p => p.id));
            // Actual payments: те, у которых аллокации ссылаются на найденные плановые платежи
            const linkedActual = allIncomingAP.filter(ap =>
                ap.allocations?.some(alloc => linkedPPIds.has(alloc.plannedPaymentId || ''))
            );
            setIncomingActualPayments(linkedActual);

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
        // Если расход создан из аллокации — помечаем аллокацию как занятую этой партией
        if (expense.allocationId) {
            await supabase
                .from('payment_allocations')
                .update({ batch_id: id })
                .eq('id', expense.allocationId);
            // Обновляем локальный state платежей
            setActualPayments(prev => prev.map(ap => ({
                ...ap,
                allocations: ap.allocations?.map(alloc =>
                    alloc.id === expense.allocationId ? { ...alloc, batchId: id } : alloc
                ) ?? [],
            })));
        }
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

    const updateStatus = async (status: BatchStatus) => {
        if (!id) return;
        await api.update<Batch>(TableNames.BATCHES, id, { status } as any);
        setBatch(prev => prev ? { ...prev, status } : null);
    };

    const deleteBatch = async () => {
        if (!id) return;
        await api.delete(TableNames.BATCHES, id);
    };

    // ── Управление позициями (только в статусе manufacturing) ────────────────

    // Привязать заказ к позиции (только обновляет orderId в pre_calculation_items)
    const attachOrderToItem = async (itemId: string, orderId: string, clientName?: string) => {
        await api.update(TableNames.PRE_CALCULATION_ITEMS, itemId, { orderId, clientName: clientName || null } as any);
        setPreCalculation(prev => prev
            ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, orderId, clientName: clientName || i.clientName } : i) }
            : null);
    };

    const markItemForDeletion = async (itemId: string) => {
        if (!id || !batch) return;
        const newIds = [...new Set([...(batch.deletedItemIds ?? []), itemId])];
        await api.update<Batch>(TableNames.BATCHES, id, { deletedItemIds: newIds } as any);
        setBatch(prev => prev ? { ...prev, deletedItemIds: newIds } : null);
    };

    const unmarkItemForDeletion = async (itemId: string) => {
        if (!id || !batch) return;
        const newIds = (batch.deletedItemIds ?? []).filter(i => i !== itemId);
        await api.update<Batch>(TableNames.BATCHES, id, { deletedItemIds: newIds } as any);
        setBatch(prev => prev ? { ...prev, deletedItemIds: newIds } : null);
    };

    const permanentDeleteItem = async (itemId: string) => {
        if (!id || !batch) return;
        await api.delete(TableNames.PRE_CALCULATION_ITEMS, itemId);
        // Убираем из списка помеченных
        const newIds = (batch.deletedItemIds ?? []).filter(i => i !== itemId);
        await api.update<Batch>(TableNames.BATCHES, id, { deletedItemIds: newIds } as any);
        setBatch(prev => prev ? { ...prev, deletedItemIds: newIds } : null);
        // Убираем из preCalculation
        setPreCalculation(prev => prev
            ? { ...prev, items: prev.items.filter(i => i.id !== itemId) }
            : null);
    };

    // Добавить позицию к партии (создаёт pre_calculation_item напрямую в БД)
    const addItemToBatch = async (item: Omit<PreCalculationItem, 'id'>) => {
        if (!id || !batch) return;
        const newId = api.generateId('PCI');
        const dbItem = {
            id: newId,
            preCalculationId: batch.preCalculationId,
            productId: item.productId,
            orderId: item.orderId || null,
            clientName: item.clientName || null,
            productName: item.name,
            sku: item.sku || null,
            type: item.type || 'PART',
            manufacturer: item.manufacturer || null,
            hsCode: item.hsCode || null,
            quantity: Number(item.quantity) || 1,
            supplierName: item.supplierName || null,
            supplierPriceUsd: Number(item.purchasePrice) || 0,
            purchaseCurrency: item.purchasePriceCurrency || 'USD',
            sellingPriceKzt: Number(item.revenueKzt) || 0,
            isRevenueConfirmed: !!item.isRevenueConfirmed,
            pnrKzt: Number(item.pnrKzt) || 0,
            deliveryLocalKzt: Number(item.deliveryLocalKzt) || 0,
            marginPercent: Number(item.marginPercentage) || 0,
            taxRegime: item.taxRegime || 'Общ.',
            volumeM3: Number(item.volumeM3) || 0,
            weightKg: Number(item.weightKg) || 0,
            useDimensions: item.type === 'MACHINE',
            options: item.options || [],
            purchaseKzt: Number(item.purchasePriceKzt) || 0,
            deliveryUrumqiAlmatyKzt: 0,
            deliveryChinaDomesticKzt: 0,
            logisticsAlmatyKaragandaKzt: 0,
            svhPerItemKzt: 0,
            brokerPerItemKzt: 0,
            customsFeesPerItemKzt: 0,
            customsNdsKzt: 0,
            totalNdsKzt: 0,
            ndsDifferenceKzt: 0,
            kpnKzt: 0,
            salesBonusKzt: 0,
            fullCostKzt: 0,
            profitKzt: 0,
        };
        await api.create(TableNames.PRE_CALCULATION_ITEMS, dbItem);
        // Добавляем в локальный state preCalculation
        const newItem: PreCalculationItem = {
            id: newId,
            productId: item.productId,
            name: item.name,
            sku: item.sku || '',
            type: item.type || 'PART',
            quantity: Number(item.quantity) || 1,
            purchasePrice: Number(item.purchasePrice) || 0,
            purchasePriceCurrency: item.purchasePriceCurrency || 'USD',
            purchasePriceKzt: Number(item.purchasePriceKzt) || 0,
            revenueKzt: Number(item.revenueKzt) || 0,
            isRevenueConfirmed: !!item.isRevenueConfirmed,
            orderId: item.orderId || undefined,
            clientName: item.clientName || '',
            supplierName: item.supplierName || '',
            volumeM3: Number(item.volumeM3) || 0,
            weightKg: Number(item.weightKg) || 0,
            useDimensions: item.type === 'MACHINE',
            taxRegime: item.taxRegime || 'Общ.',
            pnrKzt: 0,
            deliveryLocalKzt: 0,
            marginPercentage: 0,
            deliveryUrumqiAlmatyKzt: 0,
            deliveryChinaDomesticKzt: 0,
            deliveryAlmatyKaragandaPerItemKzt: 0,
            svhPerItemKzt: 0,
            brokerPerItemKzt: 0,
            customsFeesPerItemKzt: 0,
            customsNdsKzt: 0,
            totalNdsKzt: 0,
            ndsDifferenceKzt: 0,
            kpnKzt: 0,
            salesBonusKzt: 0,
            preSaleCostKzt: 0,
            fullCostKzt: 0,
            profitKzt: 0,
            options: item.options || [],
            packages: [],
        };
        setPreCalculation(prev => prev
            ? { ...prev, items: [...prev.items, newItem] }
            : null);
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
        incomingPlannedPayments,
        incomingActualPayments,
        isLoading,
        stats,
        addExpense,
        deleteExpense,
        updateItemActuals,
        updateTimeline,
        updateStatus,
        deleteBatch,
        uploadDocument,
        deleteDocument,
        markItemForDeletion,
        unmarkItemForDeletion,
        permanentDeleteItem,
        addItemToBatch,
        attachOrderToItem,
        refresh: () => id && loadBatchData(id)
    };
};
