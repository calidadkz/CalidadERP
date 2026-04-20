
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
            await ApiService.delete(TableNames.PRODUCTS, id);
        } catch(e: any) {
            if (e?.code === '23503') {
                const detail: string = e?.details || '';
                const tableMatch = detail.match(/table "([^"]+)"/);
                const tableName = tableMatch ? tableMatch[1] : 'другой таблице';
                throw new Error(`Невозможно удалить: товар используется в "${tableName}". Удалите или архивируйте связанные записи.`);
            }
            throw e;
        }
        await moveToTrash(id, 'Product', p.name, p);
        setProducts(prev => prev.filter(x => x.id !== id));
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

    // Этап 1: создаёт черновик заявки — без движения по складу
    const createWriteOff = async (writeoff: WriteOff): Promise<WriteOff> => {
        const p = products.find(x => x.id === writeoff.productId);
        if (!p) throw new Error('Товар не найден');

        const toSave: WriteOff = {
            ...writeoff,
            status: 'Draft',
            movementId: undefined,
            unitCostKzt: 0,
        };
        const created = await ApiService.create<WriteOff>(TableNames.STOCK_WRITEOFFS, toSave);
        setWriteoffs(prev => [created, ...prev]);
        addLog('Create', 'Списание (черновик)', writeoff.productId, `Черновик ${writeoff.quantity} шт. ${writeoff.productName}`);
        return created;
    };

    // Этап 2: проводит движение Out по складу, переводит статус в Posted
    const postWriteOff = async (wo: WriteOff, inventorySummary: any[]): Promise<void> => {
        const p = products.find(x => x.id === wo.productId);
        if (!p) throw new Error('Товар не найден');

        // Находим остаток из view (без конфигурации — простой товар)
        const summaryEntry = inventorySummary.find(e =>
            e.productId === wo.productId &&
            (!e.configuration || e.configuration.length === 0)
        );
        const physicalQty = Number(summaryEntry?.stock) || 0;
        if (physicalQty < wo.quantity) {
            throw new Error(
                `Недостаточно товара на складе: есть ${physicalQty} шт., требуется ${wo.quantity} шт.`
            );
        }

        // Средняя себестоимость из view
        const totalValue = Number(summaryEntry?.totalValueKzt) || 0;
        const avgUnitCost = physicalQty > 0 ? totalValue / physicalQty : 0;

        // Создаём движение Out / Physical с documentType = 'WriteOff'
        const movement: StockMovement = {
            id: ApiService.generateUUID(),
            date: new Date().toISOString(),
            productId: wo.productId,
            sku: wo.sku,
            productName: wo.productName,
            type: 'Out',
            quantity: wo.quantity,
            unitCostKzt: avgUnitCost,
            totalCostKzt: avgUnitCost * wo.quantity,
            statusType: 'Physical',
            documentType: 'WriteOff',
            documentId: wo.id,
            description: `Списание: ${wo.reasonNote || 'без причины'}`,
        };
        const createdMv = await ApiService.create<StockMovement>(TableNames.STOCK_MOVEMENTS, movement);
        setStockMovements(prev => [createdMv, ...prev]);

        // Обновляем запись списания
        const updated = await ApiService.update<WriteOff>(TableNames.STOCK_WRITEOFFS, wo.id, {
            status: 'Posted',
            movementId: createdMv.id,
            unitCostKzt: avgUnitCost,
        });
        setWriteoffs(prev => prev.map(x => x.id === wo.id ? { ...x, ...updated } : x));
        addLog('Update', 'Списание', wo.productId, `Проведено ${wo.quantity} шт. ${wo.productName}, сумма потерь: ${Math.round(avgUnitCost * wo.quantity).toLocaleString()} ₸`);
    };

    const deleteWriteOff = async (wo: WriteOff) => {
        // Для проведённых — создаём сторно-движение
        if (wo.status === 'Posted' && wo.movementId) {
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
        createWriteOff, postWriteOff, deleteWriteOff,
    };
};
