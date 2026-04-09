
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
    COUNTERPARTIES = 'counterparties', 
    COUNTERPARTY_ACCOUNTS = 'counterparty_accounts', 
    LOGS = 'logs',
    PRODUCT_CATEGORIES = 'product_categories',
    OPTION_TYPES = 'option_types',
    OPTION_VARIANTS = 'option_variants',
    BUNDLES = 'bundles',
    EXCHANGE_RATES = 'exchange_rates',
    TRASH = 'trash',
    PRICING_PROFILES = 'pricing_profiles',
    CASH_FLOW_ITEMS = 'cash_flow_items',
    CASH_FLOW_TAGS = 'cash_flow_tags',
    CASH_FLOW_ITEM_TYPES = 'cash_flow_item_types',
    HS_CODES = 'hscodes',
    MANUFACTURERS = 'manufacturers',
    OUR_COMPANIES = 'our_companies',
    EMPLOYEES = 'employees',
    PRE_CALCULATIONS = 'pre_calculations',
    PRE_CALCULATION_ITEMS = 'pre_calculation_items',
    PRE_CALCULATION_PACKAGES = 'pre_calculation_packages',
    BATCHES = 'batches',
    BATCH_EXPENSES = 'batch_expenses',
    BATCH_DOCUMENTS = 'batch_documents',
    BATCH_ITEM_ACTUALS = 'batch_item_actuals',
    INVENTORY_SUMMARY = 'v_inventory_summary',
    STOCK_WRITEOFFS = 'stock_writeoffs',
    WRITEOFF_REASON_TYPES = 'writeoff_reason_types'
}

export const KZT_RATES: Record<Currency, number> = {
    [Currency.Usd]: 450,
    [Currency.Eur]: 490,
    [Currency.Cny]: 63,
    [Currency.Rub]: 5,
    [Currency.Kzt]: 1
};

export const EXCHANGE_RATES_TO_USD: Record<Currency, number> = {
    [Currency.Usd]: 1,
    [Currency.Eur]: 1.08,
    [Currency.Cny]: 0.14,
    [Currency.Rub]: 0.011,
    [Currency.Kzt]: 0.0022
};

// Google Drive Integration
export const GOOGLE_DRIVE_CONFIG = {
    API_KEY: 'AIzaSyDy_m-s6sN402WHOn90D-8QTnehrkVnOu8',
    CLIENT_ID: '43671301159-6l2pab639ojq93jnkqqojf2brm0fi6qd.apps.googleusercontent.com',
    APP_ID: '43671301159' // ID проекта из GCC (начало Client ID)
};
