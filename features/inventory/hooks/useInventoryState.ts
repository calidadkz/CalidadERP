
import { useState } from 'react';
import { Product, StockMovement, Discrepancy, TrashItem, Currency, OptionVariant, PricingProfile } from '@/types';
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

    return {
        products, setProducts,
        stockMovements, setStockMovements,
        discrepancies, setDiscrepancies,
        addProduct, updateProduct, deleteProduct, adjustStock, revertInitialStockEntry,
        updateDiscrepancy, writeOffDiscrepancy
    };
};
