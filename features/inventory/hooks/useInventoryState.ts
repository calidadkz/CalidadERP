
import { useState } from 'react';
import { Product, StockMovement, Discrepancy, TrashItem, Currency, OptionVariant, PricingProfile } from '@/types';
import { WriteOff } from '@/types/inventory';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';
import { InventoryMediator } from '@/services/InventoryMediator';

export const useInventoryState = (
    addLog: (action: any, entity: string, entityId: string, details: string) => void, 
    moveToTrash: (originalId: string, type: TrashItem['type'], name: string, data: any) => Promise<any>
) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
    const [writeoffs, setWriteoffs] = useState<WriteOff[]>([]);

    const addProduct = async (p: Product) => {
        try {
            const productToSave = { ...p, id: p.id || ApiService.generateId() };
            const created = await ApiService.create<Product>(TableNames.PRODUCTS, productToSave);
            setProducts(prev => [...prev, created]);
            addLog('Create', 'Товар', created.sku, `Создан товар: ${created.name}`);
        } catch(e) { 
            console.error("[INVENTORY_HOOK] Add product error:", e);
            throw e; 
        }
    };

    const updateProduct = async (p: Product) => {
        try {
            const updated = await ApiService.update<Product>(TableNames.PRODUCTS, p.id, p);
            setProducts(prev => prev.map(prod => prod.id === p.id ? updated : prod));
            addLog('Update', 'Товар', p.sku, 'Обновление данных');
        } catch(e) {
            console.error("[INVENTORY_HOOK] Update product error:", e);
            throw e;
        }
    };

    const updateProductsBulk = async (productsToUpdate: Product[]) => {
        if (!productsToUpdate.length) return;
        try {
            const updated = await ApiService.upsertMany<Product>(TableNames.PRODUCTS, productsToUpdate);
            const updatedMap = new Map(updated.map(p => [p.id, p]));
            setProducts(prev => prev.map(prod => updatedMap.get(prod.id) ?? prod));
        } catch(e) {
            console.error("[INVENTORY_HOOK] Bulk update products error:", e);
            throw e;
        }
    };

    const deleteProduct = async (id: string) => {
        const p = products.find(x => x.id === id);
        if(!p) return;
        try {
            await moveToTrash(id, 'Product', p.name, p);
            await ApiService.delete(TableNames.PRODUCTS, id);
            setProducts(prev => prev.filter(x => x.id !== id));
        } catch(e) { 
            console.error("Failed to delete product", e);
        }
    };

    const adjustStock = async (
        productId: string, 
        qty: number, 
        totalCost: number, 
        desc: string, 
        config?: string[], 
        salesPriceKzt: number = 0,
        optionVariants: OptionVariant[] = [],
        pricingProfiles: PricingProfile[] = [],
        exchangeRates: Record<Currency, number> = {} as Record<Currency, number>
    ) => {
        const p = products.find(x => x.id === productId);
        if(!p) return;
        
        const unitCost = qty !== 0 ? Math.abs(totalCost / qty) : 0;
        const docData = {
            id: `ADJ-${Date.now()}`,
            productId,
            quantity: qty,
            unitCostKzt: unitCost,
            salesPriceKzt: salesPriceKzt,
            configuration: config,
            description: desc
        };

        await InventoryMediator.processEvent(
            'Adjustment', 
            'Adjustment', 
            docData, 
            products, 
            optionVariants, 
            pricingProfiles, 
            exchangeRates, 
            stockMovements, 
            (newMvs) => setStockMovements(prev => [...newMvs, ...prev])
        );

        addLog('Update', 'Склад', productId, `${desc}: ${qty > 0 ? '+' : ''}${qty}`);
    };

    const revertInitialStockEntry = async (movementId: string) => {
        const movementToRevert = stockMovements.find(m => m.id === movementId);
        if (!movementToRevert || movementToRevert.documentType !== 'Adjustment' || !movementToRevert.description?.startsWith('Ввод остатков')) {
            console.error("Можно отменить только движение 'Ввод начальных остатков'.");
            return;
        }

        const existingReversal = stockMovements.find(m => m.description?.includes(`(исходный док: ${movementId})`));
        if (existingReversal) {
            console.error("Это движение уже было отменено.");
            return;
        }

        const reversalMovement: StockMovement = {
            ...movementToRevert,
            id: ApiService.generateId(),
            date: new Date().toISOString(),
            type: 'Out',
            quantity: movementToRevert.quantity,
            totalCostKzt: movementToRevert.totalCostKzt,
            totalSalesPriceKzt: (movementToRevert.totalSalesPriceKzt || 0),
            description: `Отмена ввода остатков (исходный док: ${movementToRevert.id})`,
        };

        const createdMovement = await ApiService.create<StockMovement>(TableNames.STOCK_MOVEMENTS, reversalMovement);
        setStockMovements(prev => [...prev, createdMovement]);
        addLog('Delete', 'Склад', movementToRevert.productId, `Отмена ввода остатков для ${movementToRevert.productName}`);
    };

    const updateDiscrepancy = async (d: Discrepancy) => {
        const updated = await ApiService.update<Discrepancy>(TableNames.DISCREPANCIES, d.id, d);
        setDiscrepancies(prev => prev.map(x => x.id === d.id ? updated : x));
    };

    const writeOffDiscrepancy = async (d: Discrepancy) => {
         const p = products.find(prod => prod.id === d.productId);
         if(p) {
             await adjustStock(p.id, -d.missingQty, 0, `Списание брака: ${d.reason}`, [], 0);
         }
    };

    // ───── Списания ─────

    const createWriteOff = async (
        writeoff: WriteOff,
        optionVariants: OptionVariant[] = [],
        pricingProfiles: PricingProfile[] = [],
        exchangeRates: Record<Currency, number> = {} as Record<Currency, number>
    ): Promise<WriteOff> => {
        const p = products.find(x => x.id === writeoff.productId);
        if (!p) throw new Error('Товар не найден');

        // 1. Создаём движение Out через InventoryMediator
        const docData = {
            id: writeoff.id,
            productId: writeoff.productId,
            quantity: -writeoff.quantity,
            unitCostKzt: writeoff.unitCostKzt,
            configuration: undefined,
            description: `Списание: ${writeoff.reasonNote || 'без причины'}`
        };

        let movementId = '';
        let actualUnitCostKzt = writeoff.unitCostKzt;
        await InventoryMediator.processEvent(
            'WriteOff',
            'Adjustment',
            docData,
            products,
            optionVariants,
            pricingProfiles,
            exchangeRates,
            stockMovements,
            (newMvs) => {
                movementId = newMvs[0]?.id || '';
                // Берём реальную себестоимость из движения (InventoryMediator считает FIFO)
                if (newMvs[0]?.unitCostKzt) {
                    actualUnitCostKzt = newMvs[0].unitCostKzt;
                }
                setStockMovements(prev => [...newMvs, ...prev]);
            }
        );

        // 2. Сохраняем запись списания
        const toSave: WriteOff = { ...writeoff, movementId, unitCostKzt: actualUnitCostKzt };
        const created = await ApiService.create<WriteOff>(TableNames.STOCK_WRITEOFFS, toSave);
        setWriteoffs(prev => [created, ...prev]);
        addLog('Create', 'Списание', writeoff.productId, `Списание ${writeoff.quantity} шт. ${writeoff.productName}`);
        return created;
    };

    const deleteWriteOff = async (wo: WriteOff) => {
        // Удаляем движение-сторно
        if (wo.movementId) {
            const mv = stockMovements.find(m => m.id === wo.movementId);
            if (mv) {
                const reversalMovement: StockMovement = {
                    ...mv,
                    id: ApiService.generateId(),
                    date: new Date().toISOString(),
                    type: 'In',
                    quantity: wo.quantity,
                    description: `Отмена списания (исходный: ${wo.id})`,
                    statusType: 'Physical' as const,
                };
                const created = await ApiService.create<StockMovement>(TableNames.STOCK_MOVEMENTS, reversalMovement);
                setStockMovements(prev => [created, ...prev]);
            }
        }
        await ApiService.delete(TableNames.STOCK_WRITEOFFS, wo.id);
        setWriteoffs(prev => prev.filter(x => x.id !== wo.id));
        addLog('Delete', 'Списание', wo.productId, `Удаление списания ${wo.quantity} шт. ${wo.productName}`);
    };

    return {
        products, setProducts,
        stockMovements, setStockMovements,
        discrepancies, setDiscrepancies,
        writeoffs, setWriteoffs,
        addProduct, updateProduct, updateProductsBulk, deleteProduct, adjustStock, revertInitialStockEntry,
        updateDiscrepancy, writeOffDiscrepancy,
        createWriteOff, deleteWriteOff,
    };
};
