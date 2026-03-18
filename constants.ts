
import { Currency } from './types';

// Table Names Mapping
export enum TableNames {
    PRODUCTS = 'products',
    STOCK_MOVEMENTS = 'stock_movements',
    SUPPLIER_ORDERS = 'supplier_orders',
    SUPPLIER_ORDER_ITEMS = 'supplier_order_items',
    SALES_ORDERS = 'sales_orders',
    SALES_ORDER_ITEMS = 'sales_order_items',
    SHIPMENTS = 'shipments',
    SHIPMENT_ITEMS = 'shipment_items',
    RECEPTIONS = 'receptions',
    RECEPTION_ITEMS = 'reception_items',
    RECEPTION_EXPENSES = 'reception_expenses',
    PLANNED_PAYMENTS = 'planned_payments',
    ACTUAL_PAYMENTS = 'actual_payments',
    PAYMENT_ALLOCATIONS = 'payment_allocations',
    INTERNAL_TRANSACTIONS = 'internal_transactions',
    BANK_ACCOUNTS = 'bank_accounts',
    CURRENCY_LOTS = 'currency_lots',
    DISCREPANCIES = 'discrepancies',
    COUNTERPARTIES = 'counterparties', // <-- ADDED
    COUNTERPARTY_ACCOUNTS = 'counterparty_accounts', // <-- ADDED
    LOGS = 'logs',
    PRODUCT_CATEGORIES = 'product_categories',
    OPTION_TYPES = 'option_types',
    OPTION_VARIANTS = 'option_variants',
    BUNDLES = 'bundles',
    EXCHANGE_RATES = 'exchange_rates',
    TRASH = 'trash',
    PRICING_PROFILES = 'pricing_profiles',
    CASH_FLOW_ITEMS = 'cash_flow_items',
    HS_CODES = 'hscodes',
    MANUFACTURERS = 'manufacturers',
    OUR_COMPANIES = 'our_companies',
    EMPLOYEES = 'employees',
    PRE_CALCULATIONS = 'pre_calculations',
    PRE_CALCULATION_ITEMS = 'pre_calculation_items',
    PRE_CALCULATION_PACKAGES = 'pre_calculation_packages'
}

export const KZT_RATES: Record<Currency, number> = {
    [Currency.USD]: 450,
    [Currency.EUR]: 490,
    [Currency.CNY]: 63,
    [Currency.RUB]: 5,
    [Currency.KZT]: 1
};

export const EXCHANGE_RATES_TO_USD: Record<Currency, number> = {
    [Currency.USD]: 1,
    [Currency.EUR]: 1.08,
    [Currency.CNY]: 0.14,
    [Currency.RUB]: 0.011,
    [Currency.KZT]: 0.0022
};
