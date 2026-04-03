import { DiscrepancyResolution, ExpenseAllocationMethod, MovementStatus } from "./enums";

export interface StockMovement {
    id: string;
    date: string;
    productId: string;
    sku: string;
    productName: string;
    type: 'In' | 'Out';
    quantity: number;
    unitCostKzt: number;
    totalCostKzt: number;
    salesPriceKzt?: number;
    totalSalesPriceKzt?: number;
    statusType: MovementStatus;
    documentType: 'Order' | 'SalesOrder' | 'Reception' | 'Shipment' | 'Adjustment';
    documentId: string;
    description?: string;
    configuration?: string[];
}

export interface Reception {
    id: string;
    orderId: string;
    warehouseName: string;
    date: string;
    exchangeRate: number;
    items: ReceptionItem[];
    expenses: ReceptionExpense[];
    status: 'Draft' | 'Posted';
    closeOrder?: boolean;
}

export interface ReceptionItem {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    volumeM3: number;
    qtyPlan: number;
    qtyFact: number;
    priceForeign: number;
    costBaseKzt: number;
    allocatedExpenseKzt: number;
    finalCostUnitKzt: number;
    configuration?: string[];
    receptionId?: string;
}

export interface ReceptionExpense {
    id: string;
    type: string;
    amount: number;
    currency: any;
    exchangeRateToKzt: number;
    allocationMethod: ExpenseAllocationMethod;
    targetItemId?: string;
    receptionId?: string;
}

export interface Shipment {
    id: string;
    date: string;
    salesOrderId: string;
    clientName: string;
    items: ShipmentItem[];
    status: 'Draft' | 'Posted';
}

export interface ShipmentItem {
    productId: string;
    productName: string;
    sku: string;
    qtyShipped: number;
    priceKzt: number;
    configuration?: string[];
    shipmentId?: string;
}

export interface Discrepancy {
    id: string;
    date: string;
    receptionId: string;
    orderId: string;
    productId: string;
    productName: string;
    sku: string;
    missingQty: number;
    reason: string;
    resolution: DiscrepancyResolution;
}
