
import { useCallback } from 'react';
import { Product, StockMovement, Shipment } from '@/types';

export const useShipmentLogic = (
    products: Product[],
    stockMovements: StockMovement[],
    shipments: Shipment[],
    editingId: string | null
) => {
    const getSpecificStock = useCallback((productId: string, config: string[]) => {
        const p = products.find(prod => prod.id === productId);
        if (!p) return 0;
        const normTargetConfig = [...(config || [])].sort().join('|') || 'BASE';
        return stockMovements
            .filter(m => m.productId === productId && m.statusType === 'Physical')
            .reduce((acc, m) => {
                const mConfig = [...(m.configuration || [])].sort().join('|') || 'BASE';
                if (mConfig === normTargetConfig) {
                    return acc + (m.type === 'In' ? m.quantity : -m.quantity);
                }
                return acc;
            }, 0);
    }, [products, stockMovements]);

    const getAlreadyShippedForOrder = useCallback((orderId: string, productId: string, config: string[]) => {
        const normConfig = [...(config || [])].sort().join('|') || 'BASE';
        return (shipments || [])
            .filter(s => s.salesOrderId === orderId && s.status === 'Posted' && s.id !== editingId)
            .reduce((acc, s) => {
                const item = s.items.find(i => 
                    i.productId === productId && 
                    ([...(i.configuration || [])].sort().join('|') || 'BASE') === normConfig
                );
                return acc + (item?.qtyShipped || 0);
            }, 0);
    }, [shipments, editingId]);

    return { getSpecificStock, getAlreadyShippedForOrder };
};
