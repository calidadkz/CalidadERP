import { Currency } from "./currency";
import { OrderStatus, ProductType } from "./enums";

export interface OrderItem {
    productId: string;
    productName: string;
    sku: string;
    productType: ProductType;
    quantity: number;
    productBasePrice: number;
    productCurrency: Currency;
    exchange_rate_to_order_currency: number;
    priceForeign: number;
    totalForeign: number;
    configuration?: string[];
    supplierOrderId?: string;
}

export interface SupplierOrder {
    id: string;
    date: string;
    supplierId: string;
    supplierName: string;
    buyerId: string;
    currency: Currency;
    status: OrderStatus;
    items: OrderItem[];
    totalAmountForeign: number;
    totalAmountKZT_Est: number;
    paidAmountForeign: number;
    totalPaidKZT: number;
    receivedItemCount: number;
    totalItemCount: number;
}

export interface SalesOrderItem {
    id: string;
    salesOrderId?: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    priceKZT: number;
    totalKZT: number;
    configuration?: string[];
}

export interface SalesOrder {
    id: string;
    date: string;
    clientId: string;
    clientName: string;
    items: SalesOrderItem[];
    status: OrderStatus;
    total_amount?: number; 
    totalAmount: number;
    paidAmount: number;
    shippedItem_count?: number; 
    shippedItemCount: number;
    totalItemCount: number;
}
