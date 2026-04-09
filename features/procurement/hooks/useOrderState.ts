
import React, { useState } from 'react';
import { SupplierOrder, OrderItem, SalesOrder, Reception, Shipment, PlannedPayment, OrderStatus, Product, StockMovement, ShipmentItem, ReceptionItem, ReceptionExpense, Currency, SalesOrderItem, OptionVariant, PricingProfile, TrashItem, ExpenseCategory } from '@/types';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';

// Маппинг типов расходов приёмки → категории партии
const RECEPTION_TO_BATCH_CATEGORY: Record<string, ExpenseCategory> = {
    'Доставка Китай':        'logistics_urumqi_almaty',
    'Доставка Алматы-Кар.':  'logistics_almaty_karaganda',
    'Доставка Алматы–Кар.':  'logistics_almaty_karaganda',
    'Доставка Алматы-Кар':   'logistics_almaty_karaganda',
    'СВХ':                   'svh',
    'Брокер':                'broker',
    'Сборы':                 'customs',
    'НДС':                   'customs_vat',
    'Прочее':                'other',
};
import { InventoryMediator } from '@/services/InventoryMediator';

export const useOrderState = (
    addLog: (a: any, b: any, c: any, d: any) => void,
    setPlannedPayments: React.Dispatch<React.SetStateAction<PlannedPayment[]>>,
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
    setStockMovements: React.Dispatch<React.SetStateAction<StockMovement[]>>,
    products: Product[],
    optionVariants: OptionVariant[] = [],
    pricingProfiles: PricingProfile[] = [],
    exchangeRates: Record<Currency, number> = {} as any,
    currentStockMovements: StockMovement[],
    moveToTrash: (id: string, type: TrashItem['type'], name: string, data: any) => Promise<any>
) => {
    const [orders, setOrders] = useState<SupplierOrder[]>([]);
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [receptions, setReceptions] = useState<Reception[]>([]);

    const handleNewMovements = (mvs: StockMovement[]) => {
        setStockMovements(prev => [...mvs, ...prev]);
    };

    // Helper to sync Pre-calculation items when Sales Order items are changed
    const syncPreCalcItems = async (salesOrder: SalesOrder, items: any[]) => {
        for (const i of items) {
            if (!i.preCalcItemId) continue;
            try {
                // Используем upsert вместо update, чтобы не падать, если итем еще не в БД
                // И не используем .single() через ApiService.update, если это вызывает проблемы
                await ApiService.update(TableNames.PRE_CALCULATION_ITEMS, i.preCalcItemId, {
                    orderId: salesOrder.id,
                    clientName: salesOrder.clientName,
                    sellingPriceKzt: Number(i.priceKzt) || 0,
                    isRevenueConfirmed: true
                });
            } catch (e) {
                console.warn(`Could not sync pre-calc item ${i.preCalcItemId}:`, e);
            }
        }
    };

    const addOrder = async (o: SupplierOrder, plans: PlannedPayment[]) => {
        try {
            const { items, ...orderData } = o;
            orderData.totalItemCount = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            
            const savedOrder = await ApiService.create<SupplierOrder>(TableNames.SUPPLIER_ORDERS, orderData);
            
            const orderItems = items.map(i => ({ 
                ...i, 
                id: ApiService.generateUUID(),
                supplierOrderId: savedOrder.id 
            }));
            const savedItems = await ApiService.createMany<OrderItem>(TableNames.SUPPLIER_ORDER_ITEMS, orderItems);
            
            const plansToSave = plans.map(p => ({ 
                ...p, 
                sourceDocId: savedOrder.id 
            }));
            const savedPlans = await ApiService.createMany<PlannedPayment>(TableNames.PLANNED_PAYMENTS, plansToSave);
            
            const fullOrder = { ...savedOrder, items: savedItems };
            await InventoryMediator.processEvent('Order', 'Confirmed', fullOrder, products, optionVariants, pricingProfiles, exchangeRates, currentStockMovements, handleNewMovements);
            
            setOrders(prev => [fullOrder, ...prev]);
            setPlannedPayments(prev => [...savedPlans, ...prev]);
            
            addLog('Create', 'Заказ поставщику', savedOrder.id, `Сумма: ${savedOrder.totalAmountForeign} ${savedOrder.currency}`);
        } catch (e: any) {
            console.error("[ORDER_STATE] Error adding supplier order:", e);
            alert("Ошибка создания заказа: " + e.message);
        }
    };

    const updateOrder = async (o: SupplierOrder, plans: PlannedPayment[]) => {
        try {
            if (o.isDeleted) throw new Error("Заказ помечен на удаление и недоступен для редактирования");

            const { items, ...orderData } = o;
            orderData.totalItemCount = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            
            const updatedOrder = await ApiService.update<SupplierOrder>(TableNames.SUPPLIER_ORDERS, o.id, orderData);
            
            await ApiService.deleteByField(TableNames.SUPPLIER_ORDER_ITEMS, 'supplierOrderId', o.id);
            const savedItems = await ApiService.createMany<OrderItem>(TableNames.SUPPLIER_ORDER_ITEMS, items.map(i => ({ 
                ...i, 
                id: ApiService.generateUUID(),
                supplierOrderId: o.id 
            })));
            
            await ApiService.deleteByField(TableNames.PLANNED_PAYMENTS, 'sourceDocId', o.id);
            const savedPlans = await ApiService.createMany<PlannedPayment>(TableNames.PLANNED_PAYMENTS, plans.map(p => ({ 
                ...p, 
                sourceDocId: o.id 
            })));

            setOrders(prev => prev.map(order => order.id === o.id ? { ...updatedOrder, items: savedItems } : order));
            setPlannedPayments(prev => [
                ...prev.filter(p => p.sourceDocId !== o.id),
                ...savedPlans
            ]);
            
            addLog('Update', 'Заказ поставщику', o.id, `Обновление данных`);
        } catch (e: any) {
            console.error("[ORDER_STATE] Error updating supplier order:", e);
            alert("Ошибка обновления заказа: " + e.message);
        }
    };

    const deleteOrder = async (id: string) => {
        try {
            const order = orders.find(o => o.id === id);
            if (!order) return;

            const hasPayments = order.paidAmountForeign > 0;
            if (hasPayments) {
                alert("Нельзя удалить заказ, по которому уже проведены фактические оплаты.");
                return;
            }

            await ApiService.update(TableNames.SUPPLIER_ORDERS, id, { isDeleted: true });
            
            const relatedPlans = await ApiService.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS, { sourceDocId: id });
            if (relatedPlans && relatedPlans.length > 0) {
                for (const p of relatedPlans) {
                    await ApiService.update(TableNames.PLANNED_PAYMENTS, p.id, { isDeleted: true });
                    await moveToTrash(p.id, 'PlannedPayment', `ПП от заказа ${id}`, p);
                }
            }

            await moveToTrash(id, 'Order', order.name || `Заказ ${id}`, order);

            setOrders(prev => prev.map(o => o.id === id ? { ...o, isDeleted: true } : o));
            setPlannedPayments(prev => prev.map(p => p.sourceDocId === id ? { ...p, isDeleted: true } : p));

            addLog('Delete', 'Order', id, 'Заказ и его ПП помечены на удаление');
        } catch (e: any) {
            console.error("[ORDER_STATE] Error deleting order:", e);
            alert("Ошибка при удалении заказа: " + e.message);
        }
    };

    const createSalesOrder = async (o: SalesOrder, plans: PlannedPayment[]) => {
         try {
            const { items, ...data } = o;
            data.totalItemCount = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            data.shippedItemCount = 0;

            const saved = await ApiService.create<SalesOrder>(TableNames.SALES_ORDERS, data);
            
            const salesItems = items.map(i => ({ 
                ...i, 
                id: ApiService.generateUUID(),
                salesOrderId: saved.id 
            }));
            const savedItems = await ApiService.createMany<SalesOrderItem>(TableNames.SALES_ORDER_ITEMS, salesItems);
            
            const plansToSave = plans.map(p => ({ 
                ...p, 
                sourceDocId: saved.id 
            }));
            const savedPlans = await ApiService.createMany<PlannedPayment>(TableNames.PLANNED_PAYMENTS, plansToSave);
            
            // SYNC PRE-CALC
            await syncPreCalcItems(saved, savedItems);

            const fullSalesOrder = { ...saved, items: savedItems };
            await InventoryMediator.processEvent('SalesOrder', 'Confirmed', fullSalesOrder, products, optionVariants, pricingProfiles, exchangeRates, currentStockMovements, handleNewMovements);
            
            setSalesOrders(prev => [fullSalesOrder, ...prev]);
            setPlannedPayments(prev => [...savedPlans, ...prev]);
            
            addLog('Create', 'Заказ клиента', saved.id, `Сумма: ${saved.totalAmount} Kzt`);
         } catch (e: any) {
             console.error("[ORDER_STATE] Error creating sales order:", e);
             throw e;
         }
    };

    const updateSalesOrder = async (o: SalesOrder, plans: PlannedPayment[]) => {
        try {
            if (o.isDeleted) throw new Error("Заказ помечен на удаление и недоступен для редактирования");

            const { items, ...data } = o;
            const updated = await ApiService.update<SalesOrder>(TableNames.SALES_ORDERS, o.id, data);
            
            await ApiService.deleteByField(TableNames.SALES_ORDER_ITEMS, 'salesOrderId', o.id);
            const salesItemsToSave = items.map(i => ({
                ...i, 
                id: ApiService.generateUUID(),
                salesOrderId: o.id
            }));
            const savedItems = await ApiService.createMany<SalesOrderItem>(TableNames.SALES_ORDER_ITEMS, salesItemsToSave);
            
            await ApiService.deleteByField(TableNames.PLANNED_PAYMENTS, 'sourceDocId', o.id);
            const savedPlans = await ApiService.createMany<PlannedPayment>(TableNames.PLANNED_PAYMENTS, plans.map(p => ({...p, sourceDocId: o.id})));

            // SYNC PRE-CALC
            await syncPreCalcItems(updated, savedItems);

            setSalesOrders(prev => prev.map(order => order.id === o.id ? { ...updated, items: savedItems } : order));
            setPlannedPayments(prev => [
                ...prev.filter(p => p.sourceDocId !== o.id),
                ...savedPlans
            ]);

            addLog('Update', 'Заказ клиента', o.id, `Обновление данных заказа`);
        } catch (e: any) {
            console.error("[ORDER_STATE] Error updating sales order:", e);
            alert("Ошибка обновления заказа: " + e.message);
        }
    };

    const deleteSalesOrder = async (id: string) => {
        try {
            const order = salesOrders.find(o => o.id === id);
            if (!order) return;

            if (order.paidAmount > 0) {
                alert("Нельзя удалить заказ клиента, по которому уже проведены фактические оплаты.");
                return;
            }

            await ApiService.update(TableNames.SALES_ORDERS, id, { isDeleted: true });
            
            const relatedPlans = await ApiService.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS, { sourceDocId: id });
            if (relatedPlans && relatedPlans.length > 0) {
                for (const p of relatedPlans) {
                    await ApiService.update(TableNames.PLANNED_PAYMENTS, p.id, { isDeleted: true });
                    await moveToTrash(p.id, 'PlannedPayment', `ПП от заказа клиента ${id}`, p);
                }
            }

            await moveToTrash(id, 'SalesOrder', order.name || `Заказ клиента ${id}`, order);

            setSalesOrders(prev => prev.map(o => o.id === id ? { ...o, isDeleted: true } : o));
            setPlannedPayments(prev => prev.map(p => p.sourceDocId === id ? { ...p, isDeleted: true } : p));

            addLog('Delete', 'SalesOrder', id, 'Заказ клиента и его ПП помечены на удаление');
        } catch (e: any) {
            console.error("[ORDER_STATE] Error deleting sales order:", e);
            alert("Ошибка при удалении заказа клиента: " + e.message);
        }
    };

    const saveReception = async (r: Reception) => {
        try {
            const { items, expenses, ...recData } = r;
            const existingReception = receptions.find(x => x.id === r.id);
            let finalReceptionId = r.id;
            
            if (!existingReception) {
                const created = await ApiService.create<Reception>(TableNames.RECEPTIONS, recData);
                finalReceptionId = created.id;
            } else {
                await ApiService.update(TableNames.RECEPTIONS, r.id, recData);
                await ApiService.deleteByField(TableNames.RECEPTION_ITEMS, 'receptionId', r.id);
                await ApiService.deleteByField(TableNames.RECEPTION_EXPENSES, 'receptionId', r.id);
            }

            const itemsToSave = items.map(i => ({ 
                ...i, 
                id: ApiService.generateUUID(), 
                receptionId: finalReceptionId 
            }));
            const savedItems = await ApiService.createMany<ReceptionItem>(TableNames.RECEPTION_ITEMS, itemsToSave);
            
            const expensesToSave = expenses.map(e => ({ 
                ...e, 
                id: ApiService.generateUUID(), 
                receptionId: finalReceptionId 
            }));
            const savedExpenses = await ApiService.createMany<ReceptionExpense>(TableNames.RECEPTION_EXPENSES, expensesToSave);
            
            const fullReception: Reception = { ...r, id: finalReceptionId, items: savedItems, expenses: savedExpenses };

            // Если приёмка привязана к партии — автоматически создаём BatchExpense записи
            if (r.batchId && savedExpenses.length > 0) {
                const batchExpensesToCreate = savedExpenses
                    .filter(e => Number(e.amount) > 0)
                    .map(e => {
                        const category: ExpenseCategory = RECEPTION_TO_BATCH_CATEGORY[e.type] ?? 'other';
                        return {
                            id: ApiService.generateId('BE'),
                            batchId: r.batchId!,
                            category,
                            description: `[Приёмка] ${e.type}${r.id ? ' · ' + r.id.slice(-6).toUpperCase() : ''}`,
                            amountKzt: Number(e.amount),
                            date: r.date,
                            receptionId: finalReceptionId,
                        };
                    });
                if (batchExpensesToCreate.length > 0) {
                    await ApiService.createMany(TableNames.BATCH_EXPENSES, batchExpensesToCreate);
                }
            }

            if (r.status === 'Posted') {
                await InventoryMediator.processEvent('Reception', 'Posted', fullReception, products, optionVariants, pricingProfiles, exchangeRates, currentStockMovements, handleNewMovements);
                const order = orders.find(o => o.id === r.orderId);
                if (order) {
                    const totalReceivedSoFar = (Number(order.receivedItemCount) || 0) + savedItems.reduce((s, i) => s + Number(i.qtyFact), 0);
                    const newStatus = totalReceivedSoFar >= order.totalItemCount ? OrderStatus.CLOSED : OrderStatus.PARTIALLY_RECEIVED;
                    
                    await ApiService.update(TableNames.SUPPLIER_ORDERS, order.id, { receivedItemCount: totalReceivedSoFar, status: newStatus });
                    setOrders(oPrev => oPrev.map(o => o.id === order.id ? { ...o, status: newStatus, receivedItemCount: totalReceivedSoFar } : o));
                }
            }
            setReceptions(prev => [fullReception, ...prev.filter(x => x.id !== finalReceptionId)]);
        } catch (e: any) {
            console.error("[ORDER_STATE] Error saving reception:", e);
            alert("Ошибка сохранения приемки: " + e.message);
        }
    };

    const saveShipment = async (s: Shipment) => {
        try {
            const { items, ...shData } = s;
            const existingShipment = shipments.find(x => x.id === s.id);
            let savedSh: Shipment;
            
            if (!existingShipment) {
                savedSh = await ApiService.create<Shipment>(TableNames.SHIPMENTS, shData);
            } else {
                savedSh = await ApiService.update<Shipment>(TableNames.SHIPMENTS, s.id, shData);
                await ApiService.deleteByField(TableNames.SHIPMENT_ITEMS, 'shipmentId', s.id);
            }

            const shipmentItems = items.map(i => ({ 
                ...i, 
                id: ApiService.generateUUID(), 
                shipmentId: savedSh.id 
            }));
            const shipmentItemsSaved = await ApiService.createMany<ShipmentItem>(TableNames.SHIPMENT_ITEMS, shipmentItems);
            
            const fullShipment = { ...savedSh, items: shipmentItemsSaved };

            if (s.status === 'Posted') {
                await InventoryMediator.processEvent('Shipment', 'Posted', fullShipment, products, optionVariants, pricingProfiles, exchangeRates, currentStockMovements, handleNewMovements);
                const order = salesOrders.find(o => o.id === s.salesOrderId);
                if (order) {
                    const totalShippedSoFar = (Number(order.shippedItemCount) || 0) + shipmentItemsSaved.reduce((sum, i) => sum + (Number(i.qtyShipped) || 0), 0);
                    const newStatus = totalShippedSoFar >= order.totalItemCount ? OrderStatus.CLOSED : OrderStatus.CONFIRMED;
                    
                    await ApiService.update(TableNames.SALES_ORDERS, order.id, { shippedItemCount: totalShippedSoFar, status: newStatus });
                    setSalesOrders(oPrev => oPrev.map(o => o.id === order.id ? { ...o, shippedItemCount: totalShippedSoFar, status: newStatus } : o));
                }
            }
            setShipments(prev => [fullShipment, ...prev.filter(x => x.id !== savedSh.id)]);
        } catch (e: any) {
            console.error("[ORDER_STATE] Error saving shipment:", e);
            alert("Ошибка отгрузки: " + e.message);
        }
    };

    const revertShipment = async (id: string) => {
        try {
            const shipment = shipments.find(s => s.id === id);
            if (!shipment || shipment.status !== 'Posted') return;

            await ApiService.deleteByField(TableNames.STOCK_MOVEMENTS, 'documentId', id);
            await ApiService.update<Shipment>(TableNames.SHIPMENTS, id, { status: 'Draft' });
            
            const order = salesOrders.find(o => o.id === shipment.salesOrderId);
            if (order) {
                const removedQty = shipment.items.reduce((sum, i) => sum + (Number(i.qtyShipped) || 0), 0);
                const newShippedCount = Math.max(0, (Number(order.shippedItemCount) || 0) - removedQty);
                await ApiService.update(TableNames.SALES_ORDERS, order.id, { shippedItemCount: newShippedCount, status: OrderStatus.CONFIRMED });
                setSalesOrders(oPrev => oPrev.map(o => o.id === order.id ? { ...o, shippedItemCount: newShippedCount, status: OrderStatus.CONFIRMED } : o));
            }

            setShipments(prev => prev.map(s => s.id === id ? { ...s, status: 'Draft' } : s));
            setStockMovements(prev => prev.filter(m => m.documentId !== id));
            
            addLog('Update', 'Отгрузка', id, `Сторно (возврат в черновик)`);
        } catch (e: any) {
            console.error("[ORDER_STATE] Error reverting shipment:", e);
            alert("Ошибка отмены отгрузки: " + e.message);
        }
    };

    return {
        orders, setOrders, salesOrders, setSalesOrders, shipments, setShipments, receptions, setReceptions,
        addOrder, updateOrder, deleteOrder, createSalesOrder, updateSalesOrder, deleteSalesOrder, saveReception, saveShipment, revertShipment,
        deleteShipment: async (id: string) => {
            await ApiService.delete(TableNames.SHIPMENTS, id);
            setShipments(prev => prev.filter(s => s.id !== id));
        }
    };
};
