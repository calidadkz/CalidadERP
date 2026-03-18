import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { TableNames } from '../../../constants';
import { ApiService } from '../../../services/api';
import { useAuth } from './AuthContext';
import { 
    Product, Counterparty, CounterpartyAccount, Manufacturer, ProductCategory, OptionType, OptionVariant, 
    Bundle, LogItem, TrashItem, Currency, PricingProfile, 
    SupplierOrder, SalesOrder, Reception, Shipment, PlannedPayment,
    ActualPayment, InternalTransaction, BankAccount, CurrencyLot, StockMovement, Discrepancy,
    OrderItem, SalesOrderItem, ReceptionItem, ReceptionExpense, ShipmentItem, PaymentAllocation,
    CashFlowItem, HSCode, ActionType, OurCompany, Employee, ProductType
} from '../../../types';
import { PreCalculation, PreCalculationItem, PreCalculationPackage, GeneralSettings, DetailedListItem, PackingListItem } from '../../../types/pre-calculations';
import { useReferenceState } from '../hooks/useReferenceState';
import { useInventoryState } from '../../inventory/hooks/useInventoryState';
import { useOrderState } from '../../procurement/hooks/useOrderState';
import { useFinanceState } from '../../finance/hooks/useFinanceState';
import { usePreCalculations } from '../../pre-calculations/hooks/usePreCalculations';

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
    isLoading: boolean;
    isProcessing: boolean;
    defaultCurrency: Currency;
    generalSettings: GeneralSettings;
    detailedListItems: DetailedListItem[];
    packingListItems: PackingListItem[];
}

interface AppActions {
    addProduct: (p: Product) => Promise<void>;
    updateProduct: (p: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    addCounterparty: (c: Counterparty, account?: Partial<CounterpartyAccount>) => Promise<Counterparty>;
    updateCounterparty: (c: Counterparty, accounts: CounterpartyAccount[]) => Promise<Counterparty>;
    deleteCounterparty: (id: string) => Promise<void>;
    addManufacturer: (m: Manufacturer) => Promise<Manufacturer>;
    updateManufacturer: (m: Manufacturer) => Promise<Manufacturer>;
    addOurCompany: (oc: OurCompany) => Promise<OurCompany>;
    updateOurCompany: (oc: OurCompany) => Promise<OurCompany>;
    addEmployee: (e: Employee) => Promise<Employee>;
    updateEmployee: (e: Employee) => Promise<Employee>;
    addCategory: (c: ProductCategory) => Promise<ProductCategory>;
    addCategoriesBulk: (cats: ProductCategory[]) => Promise<ProductCategory[]>;
    deleteCategory: (id: string) => Promise<void>;
    addCashFlowItem: (c: CashFlowItem) => Promise<CashFlowItem>;
    deleteCashFlowItem: (id: string) => Promise<void>;
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
    adjustStock: (pId: string, qty: number, cost: number, desc: string, config?: string[], salesPriceKZT?: number) => Promise<void>;
    revertInitialStockEntry: (movementId: string) => Promise<void>;
    saveReception: (r: Reception) => Promise<void>;
    saveShipment: (s: Shipment) => Promise<void>;
    deleteShipment: (id: string) => Promise<void>;
    revertShipment: (id: string) => Promise<void>;
    addOrder: (o: SupplierOrder, plans: PlannedPayment[]) => Promise<void>;
    createOrder: (o: SupplierOrder, plans: PlannedPayment[]) => Promise<void>;
    updateOrder: (o: SupplierOrder, plans: PlannedPayment[]) => Promise<void>;
    createSalesOrder: (o: SalesOrder, plans: PlannedPayment[]) => Promise<void>;
    updateSalesOrder: (o: SalesOrder, plans: PlannedPayment[]) => Promise<void>;
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
    updateGeneralSetting: (key: keyof GeneralSettings, value: string | number) => void;
    addDetailedListItem: () => void;
    updateDetailedListItem: (id: string, key: keyof DetailedListItem, value: any) => void;
    deleteDetailedListItem: (id: string) => void;
    addPackingListItem: () => void;
    updatePackingListItem: (id: string, key: keyof PackingListItem, value: any) => void;
    deletePackingListItem: (id: string) => void;
}

const StoreContext = createContext<{ state: AppState; actions: AppActions } | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const references = useReferenceState();
    const inventory = useInventoryState(references.addLog, references.moveToTrash);
    const finance = useFinanceState(references.addLog);
    const preCalculations = usePreCalculations(); 
    const [pricingProfiles, setPricingProfiles] = useState<PricingProfile[]>([]);
    
    const orders = useOrderState(
        references.addLog, 
        finance.setPlannedPayments, 
        inventory.setProducts, 
        inventory.setStockMovements, 
        inventory.products,
        references.optionVariants,
        pricingProfiles,
        references.exchangeRates,
        inventory.stockMovements
    );

    const [isLoading, setIsLoading] = useState(true);
    const isInitialLoading = React.useRef(false);

    const load = useCallback(async () => {
        if (!session || isInitialLoading.current) return;
        isInitialLoading.current = true;
        setIsLoading(true);
        try {
            const batch1 = await Promise.all([
                ApiService.fetchAll<Product>(TableNames.PRODUCTS),
                ApiService.fetchAll<Counterparty>(TableNames.COUNTERPARTIES),
                ApiService.fetchAll<CounterpartyAccount>(TableNames.COUNTERPARTY_ACCOUNTS),
                ApiService.fetchAll<Manufacturer>(TableNames.MANUFACTURERS),
                ApiService.fetchAll<OurCompany>(TableNames.OUR_COMPANIES),
                ApiService.fetchAll<Employee>(TableNames.EMPLOYEES),
                ApiService.fetchAll<ProductCategory>(TableNames.PRODUCT_CATEGORIES),
                ApiService.fetchAll<OptionType>(TableNames.OPTION_TYPES)
            ]);

            const batch2 = await Promise.all([
                ApiService.fetchAll<OptionVariant>(TableNames.OPTION_VARIANTS),
                ApiService.fetchAll<Bundle>(TableNames.BUNDLES),
                ApiService.fetchAll<LogItem>(TableNames.LOGS),
                ApiService.fetchAll<TrashItem>(TableNames.TRASH),
                ApiService.fetchAll<{ currency: Currency; rate: number }>(TableNames.EXCHANGE_RATES, 'currency'),
                ApiService.fetchAll<PricingProfile>(TableNames.PRICING_PROFILES)
            ]);

            const batch3 = await Promise.all([
                ApiService.fetchAll<any>('pricing_profile_categories', 'profile_id'),
                ApiService.fetchAll<SupplierOrder>(TableNames.SUPPLIER_ORDERS),
                ApiService.fetchAll<SalesOrder>(TableNames.SALES_ORDERS),
                ApiService.fetchAll<Reception>(TableNames.RECEPTIONS),
                ApiService.fetchAll<Shipment>(TableNames.SHIPMENTS),
                ApiService.fetchAll<PlannedPayment>(TableNames.PLANNED_PAYMENTS)
            ]);

            const batch4 = await Promise.all([
                ApiService.fetchAll<ActualPayment>(TableNames.ACTUAL_PAYMENTS),
                ApiService.fetchAll<InternalTransaction>(TableNames.INTERNAL_TRANSACTIONS),
                ApiService.fetchAll<BankAccount>(TableNames.BANK_ACCOUNTS),
                ApiService.fetchAll<CurrencyLot>(TableNames.CURRENCY_LOTS),
                ApiService.fetchAll<StockMovement>(TableNames.STOCK_MOVEMENTS),
                ApiService.fetchAll<Discrepancy>(TableNames.DISCREPANCIES)
            ]);

            const batch5 = await Promise.all([
                ApiService.fetchAll<OrderItem>(TableNames.SUPPLIER_ORDER_ITEMS, 'supplier_order_id'),
                ApiService.fetchAll<SalesOrderItem>(TableNames.SALES_ORDER_ITEMS),
                ApiService.fetchAll<ReceptionItem>(TableNames.RECEPTION_ITEMS),
                ApiService.fetchAll<ReceptionExpense>(TableNames.RECEPTION_EXPENSES),
                ApiService.fetchAll<ShipmentItem>(TableNames.SHIPMENT_ITEMS, 'shipment_id'),
                ApiService.fetchAll<PaymentAllocation>(TableNames.PAYMENT_ALLOCATIONS, 'actual_payment_id'),
                ApiService.fetchAll<CashFlowItem>(TableNames.CASH_FLOW_ITEMS),
                ApiService.fetchAll<HSCode>(TableNames.HS_CODES),
                ApiService.fetchAll<PreCalculation>(TableNames.PRE_CALCULATIONS) 
            ]);

            const batch6 = await Promise.all([
                ApiService.fetchAll<PreCalculationItem>(TableNames.PRE_CALCULATION_ITEMS),
                ApiService.fetchAll<PreCalculationPackage>(TableNames.PRE_CALCULATION_PACKAGES)
            ]);

            const [products, counterparties, counterpartyAccounts, manufacturers, ourCompanies, employees, categories, optionTypes] = batch1;
            const [optionVariants, bundles, logs, trash, exchangeRatesResult, fetchedPricingProfiles] = batch2; 
            const [pricingProfileCategories, supplierOrders, salesOrders, receptions, shipments, plannedPayments] = batch3;
            const [actualPayments, internalTransactions, bankAccounts, currencyLots, stockMovements, discrepancies] = batch4;
            const [supplierOrderItems, salesOrderItems, receptionItems, receptionExpenses, shipmentItems, paymentAllocations, cashFlowItems, hsCodes, fetchedPreCalculations] = batch5; 
            const [preCalculationItems, preCalculationPackages] = batch6;

            inventory.setProducts(products);
            references.setCounterparties(counterparties);
            references.setCounterpartyAccounts(counterpartyAccounts);
            references.setManufacturers(manufacturers);
            references.setOurCompanies(ourCompanies);
            references.setEmployees(employees);
            references.setCategories(categories);
            references.setCashFlowItems(cashFlowItems);
            references.setHscodes(hsCodes);
            references.setOptionTypes(optionTypes);
            references.setOptionVariants(optionVariants);
            references.setBundles(bundles);
            references.setLogs(logs);
            references.setTrash(trash);
            
            if (fetchedPricingProfiles) {
                const mapped = fetchedPricingProfiles.map(p => {
                    const profileCategories = pricingProfileCategories.filter((l: any) => l.profile_id === p.id).map((l: any) => l.category_id) || [];
                    let type = ProductType.MACHINE;
                    if (profileCategories.length > 0) {
                        const firstCat = categories.find(c => c.id === profileCategories[0]);
                        if (firstCat) type = firstCat.type;
                    }
                    return {
                        ...ApiService.keysToCamel(p),
                        applicableCategoryIds: profileCategories,
                        type
                    };
                });
                setPricingProfiles(mapped); 
            }

            orders.setOrders(supplierOrders.map(o => ({ ...o, items: supplierOrderItems.filter(i => i.supplierOrderId === o.id) })));
            orders.setSalesOrders(salesOrders.map(o => ({ ...o, items: salesOrderItems.filter(i => i.salesOrderId === o.id) })));
            orders.setReceptions(receptions.map(r => ({ ...r, items: receptionItems.filter(i => i.receptionId === r.id), expenses: receptionExpenses.filter(e => e.receptionId === r.id) })));
            orders.setShipments(shipments.map(s => ({ ...s, items: shipmentItems.filter(i => i.shipmentId === s.id) })));
            
            finance.setPlannedPayments(plannedPayments);
            finance.setActualPayments(actualPayments.map(p => {
                const acc = bankAccounts.find(a => a.id === p.bankAccountId);
                return { 
                    ...p, 
                    allocations: paymentAllocations.filter(a => a.actualPaymentId === p.id),
                    fromAccount: p.fromAccount || (acc ? `${acc.bank} ${acc.number}` : 'Unknown Account')
                };
            }));
            finance.setInternalTransactions(internalTransactions);
            finance.setBankAccounts(bankAccounts);
            finance.setCurrencyStacks(currencyLots);
            
            inventory.setStockMovements(stockMovements);
            inventory.setDiscrepancies(discrepancies);

            // Initialize preCalculations state using fetched data
            if (fetchedPreCalculations.length > 0) {
                const firstPreCalculation = fetchedPreCalculations[0];
                preCalculations.updateGeneralSetting('shippingChinaUsdPerM3', firstPreCalculation.shippingChinaUsd);
                preCalculations.updateGeneralSetting('exchangeRateForShipping', firstPreCalculation.exchangeRateUsdKzt);
                preCalculations.updateGeneralSetting('deliveryAlmatyKaragandaKzt', firstPreCalculation.shippingKaragandaKzt);
                preCalculations.updateGeneralSetting('svhKzt', firstPreCalculation.svhKzt);
                preCalculations.updateGeneralSetting('brokerKzt', firstPreCalculation.brokerKzt);
                preCalculations.updateGeneralSetting('customsFeesKzt', firstPreCalculation.customsFeesKzt);
                preCalculations.updateGeneralSetting('ndsRate', firstPreCalculation.vatRate || 0);
                preCalculations.updateGeneralSetting('kpn20Rate', firstPreCalculation.citRateStandard || 0);
                preCalculations.updateGeneralSetting('kpn4Rate', firstPreCalculation.citRateSimplified || 0);
                preCalculations.updateGeneralSetting('resaleMarkup', firstPreCalculation.intercompanyMarkupPercent || 0);
            }
            // Assuming that detailedListItems and packingListItems can be set directly
            preCalculations.setDetailedListItems(preCalculationItems);
            preCalculations.setPackingListItems(preCalculationPackages);

            if (exchangeRatesResult.length > 0) {
                const rates = exchangeRatesResult.reduce((acc, curr) => {
                    acc[curr.currency] = curr.rate;
                    return acc;
                }, {} as Record<Currency, number>);
                references.setExchangeRates(rates);
            }
        } catch (e) {
            console.error("CRITICAL LOAD ERROR", e);
        } finally {
            setIsLoading(false);
            isInitialLoading.current = false;
        }
    }, [
        session,
        setIsLoading,
        setPricingProfiles,
        references,
        inventory,
        finance,
        preCalculations.updateGeneralSetting, 
        preCalculations.setDetailedListItems,
        preCalculations.setPackingListItems,
        orders,
    ]);

    useEffect(() => { if (session) load(); else setIsLoading(false); }, [session, load]);

    const state: AppState = {
        products: inventory.products,
        counterparties: references.counterparties,
        clients: references.counterparties.filter(c => c.type === 'Client' as any),
        suppliers: references.counterparties.filter(c => c.type === 'Supplier' as any),
        counterpartyAccounts: references.counterpartyAccounts,
        manufacturers: references.manufacturers,
        ourCompanies: references.ourCompanies,
        employees: references.employees,
        categories: references.categories,
        cashFlowItems: references.cashFlowItems,
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
        isLoading: isLoading,
        isProcessing: finance.isProcessing,
        defaultCurrency: Currency.KZT,
        generalSettings: preCalculations.generalSettings,
        detailedListItems: preCalculations.detailedListItems,
        packingListItems: preCalculations.packingListItems,
    };

    const actions: AppActions = {
        addProduct: inventory.addProduct,
        updateProduct: inventory.updateProduct,
        deleteProduct: inventory.deleteProduct,
        addCounterparty: references.addCounterparty,
        updateCounterparty: references.updateCounterparty,
        deleteCounterparty: references.deleteCounterparty,
        addManufacturer: references.addManufacturer,
        updateManufacturer: references.updateManufacturer,
        addOurCompany: references.addOurCompany,
        updateOurCompany: references.updateOurCompany,
        addEmployee: references.addEmployee,
        updateEmployee: references.updateEmployee,
        addCategory: references.addCategory,
        addCategoriesBulk: references.addCategoriesBulk,
        deleteCategory: references.deleteCategory,
        addCashFlowItem: references.addCashFlowItem,
        deleteCashFlowItem: references.deleteCashFlowItem,
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
        adjustStock: inventory.adjustStock,
        revertInitialStockEntry: inventory.revertInitialStockEntry,
        saveReception: orders.saveReception,
        saveShipment: orders.saveShipment,
        deleteShipment: orders.deleteShipment,
        revertShipment: orders.revertShipment,
        addOrder: orders.addOrder,
        createOrder: orders.addOrder,
        updateOrder: orders.updateOrder,
        createSalesOrder: orders.createSalesOrder,
        updateSalesOrder: orders.updateSalesOrder,
        addPlannedPayment: finance.addPlannedPayment,
        executePayment: finance.executePayment,
        allocatePayment: finance.allocatePayment,
        addInternalTransaction: finance.addInternalTransaction,
        addBankAccount: finance.addBankAccount,
        updateDiscrepancy: inventory.updateDiscrepancy,
        writeOffDiscrepancy: inventory.writeOffDiscrepancy,
        writeOff: inventory.writeOffDiscrepancy,
        updateGeneralSetting: preCalculations.updateGeneralSetting,
        addDetailedListItem: preCalculations.addDetailedListItem,
        updateDetailedListItem: preCalculations.updateDetailedListItem,
        deleteDetailedListItem: preCalculations.deleteDetailedListItem,
        addPackingListItem: preCalculations.addPackingListItem,
        updatePackingListItem: preCalculations.updatePackingListItem,
        deletePackingListItem: preCalculations.deletePackingListItem,
        addPricingProfile: async (pp) => {
            const { applicableCategoryIds, type, ...data } = pp;
            const saved = await ApiService.create<Omit<PricingProfile, 'type'>>(TableNames.PRICING_PROFILES, data);
            if (applicableCategoryIds?.length) {
                await supabase.from('pricing_profile_categories').insert(applicableCategoryIds.map(cid => ({ profile_id: saved.id, category_id: cid })));
            }
            setPricingProfiles(prev => [...prev.filter(p => p.id !== saved.id), { ...saved, applicableCategoryIds: applicableCategoryIds || [], type: type || ProductType.MACHINE }]);
        },
        updatePricingProfile: async (pp) => {
            const { applicableCategoryIds, type, ...data } = pp;
            const updated = await ApiService.update<Omit<PricingProfile, 'type'>>(TableNames.PRICING_PROFILES, pp.id, data);
            await supabase.from('pricing_profile_categories').delete().eq('profile_id', pp.id);
            if (applicableCategoryIds?.length) {
                await supabase.from('pricing_profile_categories').insert(applicableCategoryIds.map(cid => ({ profile_id: pp.id, category_id: cid })));
            }
            setPricingProfiles(prev => prev.map(p => p.id === pp.id ? { ...updated, applicableCategoryIds, type } : p));
        },
        deletePricingProfile: async (id) => {
            await supabase.from('pricing_profile_categories').delete().eq('profile_id', id);
            await ApiService.delete(TableNames.PRICING_PROFILES, id);
            setPricingProfiles(prev => prev.filter(p => p.id !== id));
        }
    };

    return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used within StoreProvider');
    return context;
};
