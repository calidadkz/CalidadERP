import { Currency } from "./currency";
import { OrderStatus, ProductType } from "./enums";

export interface OrderDocument {
    name: string;
    url: string;
    uploadedAt: string;
}

export interface OrderItem {
    productId: string;
    productName: string;
    sku: string;
    productType: ProductType;
    quantity: number;
    productBasePrice: number;
    productCurrency: Currency;
    exchangeRateToOrderCurrency: number;
    priceForeign: number;
    totalForeign: number;
    configuration?: string[];
    supplierOrderId?: string;
}

export interface SupplierOrder {
    id: string;
    name?: string; // Название заказа
    date: string;
    supplierId: string;
    supplierName: string;
    buyerId: string;
    currency: Currency;
    status: OrderStatus;
    items: OrderItem[];
    totalAmountForeign: number;
    totalAmountKztEst: number;
    paidAmountForeign: number;
    totalPaidKzt: number;
    receivedItemCount: number;
    totalItemCount: number;
    contractUrl?: string;
    contractName?: string;
    additionalDocuments?: OrderDocument[];
    isDeleted?: boolean; // Пометка на удаление
}

export interface SalesOrderItem {
    id: string;
    salesOrderId?: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    priceKzt: number;
    totalKzt: number;
    configuration?: string[];
    preCalcItemId?: string; // Связь с позицией предрасчета
}

export interface SalesOrder {
    id: string;
    name?: string; // Название заказа
    date: string;
    clientId: string;
    clientName: string;
    items: SalesOrderItem[];
    status: OrderStatus;
    totalAmount: number;
    paidAmount: number;
    shippedItemCount: number;
    totalItemCount: number;
    contractUrl?: string;
    contractName?: string;
    contractDeliveryDate?: string; // Крайняя дата поставки по договору (обязательно если есть договор)
    additionalDocuments?: OrderDocument[];
    isDeleted?: boolean; // Пометка на удаление
}
