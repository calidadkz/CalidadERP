import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { TableNames } from '../../../constants';
import { ApiService } from '../../../services/api';
import { useAuth } from './AuthContext';
import {
    Product, Counterparty, CounterpartyAccount, Manufacturer, OurCompany, Employee, ProductCategory, OptionType, OptionVariant,
    Bundle, LogItem, TrashItem, Currency, PricingProfile,
    SupplierOrder, SalesOrder, Reception, Shipment, PlannedPayment,
    ActualPayment, InternalTransaction, BankAccount, CurrencyLot, StockMovement, Discrepancy,
    OrderItem, SalesOrderItem, ReceptionItem, ReceptionExpense, ShipmentItem, PaymentAllocation,
    CashFlowItem, CashFlowTag, CashFlowItemType, HSCode, ActionType, ProductType
} from '../../../types';
import { WriteOff, WriteOffReasonType } from '../../../types/inventory';
import { PreCalculationDocument, PreCalculationItem, PackingListItem, GeneralSettings } from '../../../types/pre-calculations';
import { useReferenceState } from '../hooks/useReferenceState';
import { useInventoryState } from '../../inventory/hooks/useInventoryState';
import { useOrderState } from '../../procurement/hooks/useOrderState';
import { useFinanceState } from '../../finance/hooks/useFinanceState';
import { usePreCalculations } from '../../pre-calculations/hooks/usePreCalculations';

const DEFAULT_RATES: Record<Currency, number> = {
    [Currency.Kzt]: 1,
    [Currency.Usd]: 450,
    [Currency.Cny]: 63,
    [Currency.Eur]: 480,
    [Currency.Rub]: 5
};

interface AppState {
    products: Product[];
    counterparties: Counterparty[];
    clients: Counterparty[];
    suppliers: Counterparty[];
    counterpartyAccounts: CounterpartyAccount[];
    manufacturers: Manufacturer[];
    ourCompanies: OurCompany[];
    employees: Employee[];
    categories: ProductCategory[];
    cashFlowItems: CashFlowItem[];
    cashFlowTags: CashFlowTag[];
    cashFlowItemTypes: CashFlowItemType[];
    hscodes: HSCode[];
    optionTypes: OptionType[];
    optionVariants: OptionVariant[];
    bundles: Bundle[];
    logs: LogItem[];
    trash: TrashItem[];
    exchangeRates: Record<Currency, number>;
    pricingProfiles: PricingProfile[];
    orders: SupplierOrder[];
    salesOrders: SalesOrder[];
    receptions: Reception[];
    shipments: Shipment[];
    plannedPayments: PlannedPayment[];
    actualPayments: ActualPayment[];
    internalTransactions: InternalTransaction[];
    bankAccounts: BankAccount[];
    currencyLots: CurrencyLot[];
    currencyStacks: CurrencyLot[];
    stockMovements: StockMovement[];
    discrepancies: Discrepancy[];
    writeoffs: WriteOff[];
    writeoffReasonTypes: WriteOffReasonType[];
    isLoading: boolean;
    isProcessing: boolean;
    defaultCurrency: Currency;
    generalSettings: GeneralSettings;
    detailedListItems: PreCalculationItem[];
    packingListItems: PackingListItem[];
    inventorySummary: any[];
}

interface AppActions {
    addProduct: (p: Product) => Promise<void>;
    updateProduct: (p: Product) => Promise<void>;
    updateProductsBulk: (products: Product[]) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    addCounterparty: (c: Counterparty, account?: Partial<CounterpartyAccount>) => Promise<Counterparty>;
    updateCounterparty: (c: Counterparty, accounts: CounterpartyAccount[]) => Promise<Counterparty>;
    patchCounterpartyCashFlowItems: (id: string, cashFlowItemIds: string[]) => Promise<void>;
    deleteCounterparty: (id: string) => Promise<void>;
    addManufacturer: (m: Manufacturer) => Promise<Manufacturer>;
    updateManufacturer: (m: Manufacturer) => Promise<Manufacturer>;
    addOurCompany: (oc: OurCompany) => Promise<OurCompany>;
    updateOurCompany: (oc: OurCompany) => Promise<OurCompany>;
    addEmployee: (e: Employee) => Promise<Employee>;
    updateEmployee: (e: Employee) => Promise<Employee>;
    addCategory: (c: ProductCategory) => Promise<ProductCategory>;
    updateCategory: (c: ProductCategory) => Promise<ProductCategory>;
    addCategoriesBulk: (cats: ProductCategory[]) => Promise<ProductCategory[]>;
    deleteCategory: (id: string) => Promise<void>;
    addCashFlowItem: (c: CashFlowItem) => Promise<CashFlowItem>;
    updateCashFlowItem: (id: string, data: Partial<CashFlowItem>) => Promise<CashFlowItem>;
    deleteCashFlowItem: (id: string) => Promise<void>;
    addCashFlowTag: (tag: Omit<CashFlowTag, 'id'>) => Promise<CashFlowTag>;
    updateCashFlowTag: (id: string, data: Partial<CashFlowTag>) => Promise<CashFlowTag>;
    deleteCashFlowTag: (id: string) => Promise<void>;
    addCashFlowItemType: (type: Omit<CashFlowItemType, 'id'>) => Promise<CashFlowItemType>;
    updateCashFlowItemType: (id: string, data: Partial<CashFlowItemType>) => Promise<CashFlowItemType>;
    deleteCashFlowItemType: (id: string) => Promise<void>;
    addHSCode: (h: HSCode) => Promise<HSCode>;
    updateHSCode: (h: HSCode) => Promise<HSCode>;
    deleteHSCode: (id: string) => Promise<void>;
    addOptionType: (ot: OptionType) => Promise<OptionType>;
    addOptionTypesBulk: (types: OptionType[]) => Promise<OptionType[]>;
    addOptionVariant: (ov: OptionVariant) => Promise<OptionVariant>;
    upsertOptionVariantsBulk: (variants: OptionVariant[]) => Promise<OptionVariant[]>;
    updateOptionType: (ot: OptionType) => Promise<OptionType>;
    updateOptionVariant: (ov: OptionVariant) => Promise<OptionVariant>;
    deleteOptionType: (id: string) => Promise<void>;
    deleteOptionVariant: (id: string) => Promise<void>;
    addBundle: (b: Bundle) => Promise<Bundle>;
    updateBundle: (b: Bundle) => Promise<Bundle>;
    deleteBundle: (id: string) => Promise<void>;
    updateExchangeRate: (c: Currency, rate: number) => Promise<void>;
    addLog: (action: ActionType, docType: string, docId: string, desc: string) => Promise<void>;
    moveToTrash: (businessId: string, type: TrashItem['type'], name: string, data: unknown) => Promise<TrashItem>;
    restoreFromTrash: (item: TrashItem) => Promise<void>;
    permanentlyDelete: (item: TrashItem) => Promise<void>;
    adjustStock: (pId: string, qty: number, cost: number, desc: string, config?: string[], salesPriceKzt?: number) => Promise<void>;
    revertInitialStockEntry: (movementId: string) => Promise<void>;
    saveReception: (r: Reception) => Promise<void>;
    saveShipment: (s: Shipment) => Promise<void>;
    deleteShipment: (id: string) => Promise<void>;
    revertShipment: (id: string) => Promise<void>;
    addOrder: (o: SupplierOrder, plans: PlannedPayment[]) => Promise<void>;
    createOrder: (o: SupplierOrder, plans: PlannedPayment[]) => Promise<void>;
    updateOrder: (o: SupplierOrder, plans: PlannedPayment[]) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
    createSalesOrder: (o: SalesOrder, plans: PlannedPayment[]) => Promise<void>;
    updateSalesOrder: (o: SalesOrder, plans: PlannedPayment[]) => Promise<void>;
    deleteSalesOrder: (id: string) => Promise<void>;
    addPlannedPayment: (p: PlannedPayment) => Promise<void>;
    executePayment: (p: ActualPayment) => Promise<void>;
    allocatePayment: (pId: string, al: PaymentAllocation[]) => Promise<void>;
    addInternalTransaction: (tx: InternalTransaction) => Promise<void>;
    addBankAccount: (acc: BankAccount, rate?: number) => Promise<void>;
    updatePricingProfile: (pp: PricingProfile) => Promise<void>;
    addPricingProfile: (pp: PricingProfile) => Promise<void>;
    deletePricingProfile: (id: string) => Promise<void>;
    updateDiscrepancy: (d: Discrepancy) => Promise<void>;
    writeOffDiscrepancy: (d: Discrepancy) => Promise<void>;
    writeOff: (d: Discrepancy) => Promise<void>;
    createWriteOff: (wo: WriteOff) => Promise<WriteOff>;
    deleteWriteOff: (wo: WriteOff) => Promise<void>;
    addWriteoffReasonType: (rt: Omit<WriteOffReasonType, 'id' | 'createdAt'>) => Promise<WriteOffReasonType>;
    updateWriteoffReasonType: (id: string, data: Partial<WriteOffReasonType>) => Promise<WriteOffReasonType>;
    deleteWriteoffReasonType: (id: string) => Promise<void>;
    updateGeneralSetting: (key: keyof GeneralSettings, value: string | number) => void;
    addDetailedListItem: () => void;
    updateDetailedListItem: (id: string, key: keyof PreCalculationItem, value: any) => void;
    deleteDetailedListItem: (id: string) => void;
    addPackingListItem: () => void;
    updatePackingListItem: (id: string, key: keyof PackingListItem, value: any) => void;
    deletePackingListItem: (id: string) => void;
    deletePreCalculation: (id: string) => Promise<void>;
    refreshOperationalData: () => Promise<void>;
    refreshInventorySummary: () => Promise<void>;
}

const StoreContext = createContext<{ state: AppState; actions: AppActions } | null>(null);

const unique = <T extends { id: string | number }>(arr: T[]): T[] => {
    const seen = new Set();
    return arr.filter(item => {
        if (!item || !item.id) return false;
        const duplicate = seen.has(item.id);
        seen.add(item.id);
        return !duplicate;
    });
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const references = useReferenceState();
    const inventory = useInventoryState(references.addLog, references.moveToTrash);
    const finance = useFinanceState(references.addLog);
    const preCalculations = usePreCalculations(); 
    const [pricingProfiles, setPricingProfiles] = useState<PricingProfile[]>([]);
    const [inventorySummary, setInventorySummary] = useState<any[]>([]);
    
    const orders = useOrderState(
        references.addLog, 
        finance.setPlannedPayments, 
        inventory.setProducts, 
        inventory.setStockMovements, 
        inventory.products,
        references.optionVariants,
        pricingProfiles,
        references.exchangeRates,
        inventory.stockMovements,
        references.moveToTrash
    );

    const [isLoading, setIsLoading] = useState(true);
    const isInitialLoading = useRef(false);

    const loadInventorySummary = useCallback(async () => {
        try {
            const data = await ApiService.fetchAll<any>(TableNames.INVENTORY_SUMMARY, 'product_id');
            setInventorySummary(data || []);
        } catch (e) {
            console.error("FAILED TO LOAD INVENTORY SUMMARY", e);
        }
    }, []);

    // Стабилизируем сеттеры, чтобы они не вызывали бесконечный цикл
    const { setProducts, setDiscrepancies, setWriteoffs } = inventory;
    const { setCounterparties, setCounterpartyAccounts, setManufacturers, setOurCompanies, setEmployees, setCategories, setCashFlowItems, setCashFlowTags, setCashFlowItemTypes, setHscodes, setOptionTypes, setOptionVariants, setBundles, setExchangeRates, setTrash, setWriteoffReasonTypes } = references;
    const { setPlannedPayments, setActualPayments, setInternalTransactions, setBankAccounts, setCurrencyStacks } = finance;
    const { setOrders, setSalesOrders, setReceptions, setShipments } = orders;

    const loadReferences = useCallback(async () => {
        if (!session) return;
        try {
            const [
                products, counterparties, counterpartyAccounts,
                ourCompanies, employees, categories, optionTypes,
                optionVariants, bundles, exchangeRatesResult, fetchedPricingProfiles,
                pricingProfileCategories, hsCodes, cashFlowItems, cashFlowTags, cashFlowItemTypes, trashItems,
                writeoffReasonTypesData
            ] = await Promise.all([
                ApiService.fetchAll<Product>(TableNames.PRODUCTS),
                ApiService.fetchAll<Counterparty>(TableNames.COUNTERPARTIES),
                ApiService.fetchAll<CounterpartyAccount>(TableNames.COUNTERPARTY_ACCOUNTS),
                ApiService.fetchAll<OurCompany>(TableNames.OUR_COMPANIES),
                ApiService.fetchAll<Employee>(TableNames.EMPLOYEES),
                ApiService.fetchAll<ProductCategory>(TableNames.PRODUCT_CATEGORIES),
                ApiService.fetchAll<OptionType>(TableNames.OPTION_TYPES),
                ApiService.fetchAll<OptionVariant>(TableNames.OPTION_VARIANTS),
                ApiService.fetchAll<Bundle>(TableNames.BUNDLES),
                ApiService.fetchAll<{ currency: Currency; rate: number }>(TableNames.EXCHANGE_RATES, 'currency'),
                ApiService.fetchAll<PricingProfile>(TableNames.PRICING_PROFILES),
                ApiService.fetchAll<any>('pricing_profile_categories', 'profile_id'),
                ApiService.fetchAll<HSCode>(TableNames.HS_CODES),
                ApiService.fetchAll<CashFlowItem>(TableNames.CASH_FLOW_ITEMS),
                ApiService.fetchAll<CashFlowTag>(TableNames.CASH_FLOW_TAGS),
                ApiService.fetchAll<CashFlowItemType>(TableNames.CASH_FLOW_ITEM_TYPES),
                ApiService.fetchAll<TrashItem>(TableNames.TRASH),
                ApiService.fetchAll<WriteOffReasonType>(TableNames.WRITEOFF_REASON_TYPES, 'sort_order'),
            ]);

            setProducts(unique(products));
            setCounterparties(unique(counterparties));
            setCounterpartyAccounts(unique(counterpartyAccounts));
            setManufacturers([]); 
            setOurCompanies(unique(ourCompanies));
            setEmployees(unique(employees));
            setCategories(unique(categories));
            setCashFlowItems(unique(cashFlowItems.map(c => ({ isGroup: false, sortOrder: 0, tagIds: [], ...c }))));
            setCashFlowTags(unique(cashFlowTags));
            setCashFlowItemTypes(unique(cashFlowItemTypes));
            setHscodes(unique(hsCodes));
            setOptionTypes(unique(optionTypes));
            setOptionVariants(unique(optionVariants));
            setBundles(unique(bundles));
            setTrash(unique(trashItems));
            setWriteoffReasonTypes(unique(writeoffReasonTypesData));
            
            if (fetchedPricingProfiles) {
                const mapped = fetchedPricingProfiles.map(p => {
                    const profileCategories = pricingProfileCategories
                        .filter((l: any) => l.profileId === p.id)
                        .map((l: any) => l.categoryId) || [];
                        
                    let type = ProductType.MACHINE;
                    if (profileCategories.length > 0) {
                        const firstCat = (categories as any[]).find((c: any) => c.id === profileCategories[0]);
                        if (firstCat) type = (firstCat as any).type;
                    }
                    return {
                        ...ApiService.keysToCamel(p),
                        applicableCategoryIds: profileCategories,
                        type
                    };
                });
                setPricingProfiles(unique(mapped)); 
            }

            if (exchangeRatesResult.length > 0) {
                const rates = exchangeRatesResult.reduce((acc, curr) => {
                    acc[curr.currency] = curr.rate;
                    return acc;
                }, { ...DEFAULT_RATES } as Record<Currency, number>);
                setExchangeRates(rates);
            }
            
            await loadInventorySummary();
        } catch (e) {
            console.error("REFERENCE LOAD ERROR", e);
        }
    }, [session, setProducts, setCounterparties, setCounterpartyAccounts, setManufacturers, setOurCompanies, setEmployees, setCategories, setCashFlowItems, setCashFlowTags, setCashFlowItemTypes, setHscodes, setOptionTypes, setOptionVariants, setBundles, setExchangeRates, setTrash, loadInventorySummary]);

    const loadOperational = useCallback(async () => {
        if (!session) return;
        try {
            const [
                supplierOrders, salesOrders, receptions, shipments, plannedPayments,
                actualPayments, internalTransactions, bankAccounts, currencyLots,
                discrepancies, writeoffsData, supplierOrderItems, salesOrderItems,
                receptionItems, receptionExpenses, shipmentItems, paymentAllocations
            ] = await Promise.all([
                ApiService.fetchAll<SupplierOrder>(TableNames.SUPPLIER_ORDERS),
                ApiService.fetchAll<SalesOrder>(TableNames.SALES_ORDERS),
                ApiService.fetchAll<Reception>(TableNames.RECEPTIONS),
                ApiService.fetchAll<Shipment>(TableNames.SHIPMENTS),
                ApiService.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS),
                ApiService.fetchAll<ActualPayment>(TableNames.ACTUAL_PAYMENTS),
                ApiService.fetchAll<InternalTransaction>(TableNames.INTERNAL_TRANSACTIONS),
                ApiService.fetchAll<BankAccount>(TableNames.BANK_ACCOUNTS),
                ApiService.fetchAll<CurrencyLot>(TableNames.CURRENCY_LOTS),
                ApiService.fetchAll<Discrepancy>(TableNames.DISCREPANCIES),
                ApiService.fetchAll<WriteOff>(TableNames.STOCK_WRITEOFFS, 'created_at'),
                ApiService.fetchAll<OrderItem>(TableNames.SUPPLIER_ORDER_ITEMS, 'supplier_order_id'),
                ApiService.fetchAll<SalesOrderItem>(TableNames.SALES_ORDER_ITEMS),
                ApiService.fetchAll<ReceptionItem>(TableNames.RECEPTION_ITEMS),
                ApiService.fetchAll<ReceptionExpense>(TableNames.RECEPTION_EXPENSES),
                ApiService.fetchAll<ShipmentItem>(TableNames.SHIPMENT_ITEMS, 'shipment_id'),
                ApiService.fetchAll<PaymentAllocation>(TableNames.PAYMENT_ALLOCATIONS, 'actual_payment_id'),
            ]);

            setOrders(supplierOrders.map(o => ({ ...o, items: supplierOrderItems.filter(i => i.supplierOrderId === o.id) })));
            setSalesOrders(salesOrders.map(o => ({ ...o, items: salesOrderItems.filter(i => i.salesOrderId === o.id) })));
            setReceptions(receptions.map(r => ({ ...r, items: receptionItems.filter(i => i.receptionId === r.id), expenses: receptionExpenses.filter(e => e.receptionId === r.id) })));
            setShipments(shipments.map(s => ({ ...s, items: shipmentItems.filter(i => i.shipmentId === s.id) })));
            
            setPlannedPayments(unique(plannedPayments));
            setActualPayments(actualPayments.map(p => {
                const acc = (bankAccounts as BankAccount[]).find(a => a.id === p.bankAccountId);
                return { 
                    ...p, 
                    allocations: paymentAllocations.filter(a => a.actualPaymentId === p.id),
                    fromAccount: p.fromAccount || (acc ? `${acc.bank} ${acc.number}` : 'Unknown Account')
                };
            }));
            setInternalTransactions(unique(internalTransactions));
            setBankAccounts(unique(bankAccounts));
            setCurrencyStacks(unique(currencyLots));
            setDiscrepancies(unique(discrepancies));
            setWriteoffs(unique(writeoffsData));
        } catch (e) {
            console.error("OPERATIONAL LOAD ERROR", e);
        }
    }, [session, setOrders, setSalesOrders, setReceptions, setShipments, setPlannedPayments, setActualPayments, setInternalTransactions, setBankAccounts, setCurrencyStacks, setDiscrepancies, setWriteoffs]);

    const load = useCallback(async () => {
        if (!session || isInitialLoading.current) return;
        isInitialLoading.current = true;
        setIsLoading(true);
        await loadReferences();
        await loadOperational();
        setIsLoading(false);
        isInitialLoading.current = false;
    }, [session, loadReferences, loadOperational]);

    useEffect(() => { if (session) load(); else setIsLoading(false); }, [session, load]);

    const clients = useMemo(() => references.counterparties.filter(c => c.type === 'Client' as any), [references.counterparties]);
    const suppliers = useMemo(() => references.counterparties.filter(c => c.type === 'Supplier' as any), [references.counterparties]);
    
    // Manufacturers теперь вычисляются системно из Counterparties
    const manufacturers = useMemo(() => 
        references.counterparties.filter(c => c.roles?.includes('Manufacturer')), 
        [references.counterparties]
    );

    const state: AppState = useMemo(() => ({
        products: inventory.products,
        counterparties: references.counterparties,
        clients,
        suppliers,
        counterpartyAccounts: references.counterpartyAccounts,
        manufacturers,
        ourCompanies: references.ourCompanies,
        employees: references.employees,
        categories: references.categories,
        cashFlowItems: references.cashFlowItems,
        cashFlowTags: references.cashFlowTags,
        cashFlowItemTypes: references.cashFlowItemTypes,
        hscodes: references.hscodes,
        optionTypes: references.optionTypes,
        optionVariants: references.optionVariants,
        bundles: references.bundles,
        logs: references.logs,
        trash: references.trash,
        exchangeRates: references.exchangeRates,
        pricingProfiles: pricingProfiles,
        orders: orders.orders,
        salesOrders: orders.salesOrders,
        receptions: orders.receptions,
        shipments: orders.shipments,
        plannedPayments: finance.plannedPayments,
        actualPayments: finance.actualPayments,
        internalTransactions: finance.internalTransactions,
        bankAccounts: finance.bankAccounts,
        currencyLots: finance.currencyStacks,
        currencyStacks: finance.currencyStacks,
        stockMovements: inventory.stockMovements,
        discrepancies: inventory.discrepancies,
        writeoffs: inventory.writeoffs,
        writeoffReasonTypes: references.writeoffReasonTypes,
        isLoading: isLoading,
        isProcessing: finance.isProcessing,
        defaultCurrency: Currency.Kzt,
        generalSettings: preCalculations.generalSettings,
        detailedListItems: preCalculations.items,
        packingListItems: preCalculations.packingList,
        inventorySummary: inventorySummary
    }), [
        inventory.products, inventory.stockMovements, inventory.discrepancies, inventory.writeoffs,
        references.writeoffReasonTypes,
        references.counterparties, references.counterpartyAccounts, manufacturers,
        references.ourCompanies, references.employees, references.categories,
        references.cashFlowItems, references.cashFlowTags, references.cashFlowItemTypes, references.hscodes, references.optionTypes,
        references.optionVariants, references.bundles, references.logs, references.trash,
        references.exchangeRates, pricingProfiles, clients, suppliers,
        orders.orders, orders.salesOrders, orders.receptions, orders.shipments,
        finance.plannedPayments, finance.actualPayments, finance.internalTransactions,
        finance.bankAccounts, finance.currencyStacks,
        isLoading, finance.isProcessing,
        preCalculations.generalSettings, preCalculations.items, preCalculations.packingList,
        inventorySummary
    ]);

    const actions: AppActions = useMemo(() => ({
        addProduct: inventory.addProduct,
        updateProduct: inventory.updateProduct,
        updateProductsBulk: inventory.updateProductsBulk,
        deleteProduct: inventory.deleteProduct,
        addCounterparty: references.addCounterparty,
        updateCounterparty: references.updateCounterparty,
        patchCounterpartyCashFlowItems: references.patchCounterpartyCashFlowItems,
        deleteCounterparty: references.deleteCounterparty,
        addManufacturer: references.addManufacturer,
        updateManufacturer: references.updateManufacturer,
        addOurCompany: references.addOurCompany,
        updateOurCompany: references.updateOurCompany,
        addEmployee: references.addEmployee,
        updateEmployee: references.updateEmployee,
        addCategory: references.addCategory,
        updateCategory: references.updateCategory,
        addCategoriesBulk: references.addCategoriesBulk,
        deleteCategory: references.deleteCategory,
        addCashFlowItem: references.addCashFlowItem,
        updateCashFlowItem: references.updateCashFlowItem,
        deleteCashFlowItem: references.deleteCashFlowItem,
        addCashFlowTag: references.addCashFlowTag,
        updateCashFlowTag: references.updateCashFlowTag,
        deleteCashFlowTag: references.deleteCashFlowTag,
        addCashFlowItemType: references.addCashFlowItemType,
        updateCashFlowItemType: references.updateCashFlowItemType,
        deleteCashFlowItemType: references.deleteCashFlowItemType,
        addHSCode: references.addHSCode,
        updateHSCode: references.updateHSCode,
        deleteHSCode: references.deleteHSCode,
        addOptionType: references.addOptionType,
        addOptionTypesBulk: references.addOptionTypesBulk,
        addOptionVariant: references.addOptionVariant,
        upsertOptionVariantsBulk: references.upsertOptionVariantsBulk,
        updateOptionType: references.updateOptionType,
        updateOptionVariant: references.updateOptionVariant,
        deleteOptionType: references.deleteOptionType,
        deleteOptionVariant: references.deleteOptionVariant,
        addBundle: references.addBundle,
        updateBundle: references.updateBundle,
        deleteBundle: references.deleteBundle,
        updateExchangeRate: references.updateExchangeRate,
        addLog: references.addLog,
        moveToTrash: references.moveToTrash,
        restoreFromTrash: references.restoreFromTrash,
        permanentlyDelete: references.permanentlyDelete,
        adjustStock: (pId, qty, cost, desc, config, salesPriceKzt) => 
            inventory.adjustStock(pId, qty, cost, desc, config, salesPriceKzt, references.optionVariants, pricingProfiles, references.exchangeRates),
        revertInitialStockEntry: inventory.revertInitialStockEntry,
        saveReception: orders.saveReception,
        saveShipment: orders.saveShipment,
        deleteShipment: orders.deleteShipment,
        revertShipment: id => orders.revertShipment(id),
        addOrder: (o, p) => orders.addOrder(o, p),
        createOrder: (o, p) => orders.addOrder(o, p),
        updateOrder: (o, p) => orders.updateOrder(o, p),
        deleteOrder: id => orders.deleteOrder(id),
        createSalesOrder: (o, p) => orders.createSalesOrder(o, p),
        updateSalesOrder: (o, p) => orders.updateSalesOrder(o, p),
        deleteSalesOrder: id => orders.deleteSalesOrder(id),
        addPlannedPayment: p => finance.addPlannedPayment(p),
        executePayment: p => finance.executePayment(p),
        allocatePayment: (id, al) => finance.allocatePayment(id, al),
        addInternalTransaction: tx => finance.addInternalTransaction(tx),
        addBankAccount: (acc, rate) => finance.addBankAccount(acc, rate),
        updatePricingProfile: async (pp) => {
            const { applicableCategoryIds, ...dbData } = pp;
            const updated = await ApiService.update<PricingProfile>(TableNames.PRICING_PROFILES, pp.id, dbData);
            await ApiService.deleteByField('pricing_profile_categories', 'profile_id', pp.id);
            if (applicableCategoryIds && applicableCategoryIds.length > 0) {
                await ApiService.createMany('pricing_profile_categories', applicableCategoryIds.map(cId => ({ profile_id: pp.id, category_id: cId })));
            }
            setPricingProfiles(prev => prev.map(p => p.id === pp.id ? { ...updated, applicableCategoryIds: applicableCategoryIds || [] } : p));
        },
        addPricingProfile: async (pp) => {
            const { applicableCategoryIds, ...dbData } = pp;
            const created = await ApiService.create<PricingProfile>(TableNames.PRICING_PROFILES, dbData);
            if (applicableCategoryIds && applicableCategoryIds.length > 0) {
                await ApiService.createMany('pricing_profile_categories', applicableCategoryIds.map(cId => ({ profile_id: created.id, category_id: cId })));
            }
            setPricingProfiles(prev => [...prev, { ...created, applicableCategoryIds: applicableCategoryIds || [] }]);
        },
        deletePricingProfile: async (id) => {
            await ApiService.delete(TableNames.PRICING_PROFILES, id);
            await ApiService.deleteByField('pricing_profile_categories', 'profile_id', id);
            setPricingProfiles(prev => prev.filter(p => p.id !== id));
        },
        updateDiscrepancy: d => inventory.updateDiscrepancy(d),
        writeOffDiscrepancy: d => inventory.writeOffDiscrepancy(d),
        writeOff: d => inventory.writeOffDiscrepancy(d),
        createWriteOff: wo => inventory.createWriteOff(wo, references.optionVariants, pricingProfiles, references.exchangeRates),
        deleteWriteOff: wo => inventory.deleteWriteOff(wo),
        addWriteoffReasonType: rt => references.addWriteoffReasonType(rt),
        updateWriteoffReasonType: (id, data) => references.updateWriteoffReasonType(id, data),
        deleteWriteoffReasonType: id => references.deleteWriteoffReasonType(id),
        updateGeneralSetting: (k, v) => preCalculations.updateGeneralSetting(k, v),
        addDetailedListItem: () => preCalculations.addItem({} as any),
        updateDetailedListItem: (id, k, v) => preCalculations.updateItem(id, k, v),
        deleteDetailedListItem: id => preCalculations.deleteItem(id),
        addPackingListItem: () => preCalculations.addPackingItem(),
        updatePackingListItem: (id, k, v) => preCalculations.updatePackingItem(id, k, v),
        deletePackingListItem: id => preCalculations.deletePackingItem(id),
        deletePreCalculation: async (id) => {
            const pc = await ApiService.fetchOne<any>(TableNames.PRE_CALCULATIONS, id);
            if (pc) {
                const items = await ApiService.fetchAll<any>(TableNames.PRE_CALC_ITEMS, { preCalculationId: id });
                const packages = await ApiService.fetchAll<any>(TableNames.PRE_CALC_PACKAGES, { preCalculationId: id });
                const fullData = { ...pc, items, packages };
                await references.moveToTrash(id, 'PreCalculation' as any, pc.name, fullData);
                await ApiService.deleteByField(TableNames.PRE_CALC_ITEMS, 'preCalculationId', id);
                await ApiService.deleteByField(TableNames.PRE_CALC_PACKAGES, 'preCalculationId', id);
                await ApiService.delete(TableNames.PRE_CALCULATIONS, id);
                references.addLog('Delete', 'PreCalculation', id, `Предрасчет "${pc.name}" перемещен в корзину`);
            }
        },
        refreshOperationalData: loadOperational,
        refreshInventorySummary: loadInventorySummary
    }), [
        inventory, references, finance, preCalculations, orders, pricingProfiles, loadOperational, loadInventorySummary
    ]);

    return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used within StoreProvider');
    return context;
};
