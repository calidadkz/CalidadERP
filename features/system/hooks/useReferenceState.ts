
import { useState } from 'react';
import { Counterparty, CounterpartyAccount, Manufacturer, OurCompany, Employee, LogEntry, ProductCategory, OptionType, OptionVariant, Bundle, TrashItem, ActionType, Currency, CashFlowItem, CashFlowTag, CashFlowItemType, HSCode } from '@/types';
import { WriteOffReasonType } from '@/types/inventory';
import { ApiService } from '@/services/api';
import { TableNames, KZT_RATES } from '@/constants';

export const useReferenceState = () => {
    const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
    const [counterpartyAccounts, setCounterpartyAccounts] = useState<CounterpartyAccount[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [ourCompanies, setOurCompanies] = useState<OurCompany[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [cashFlowItems, setCashFlowItems] = useState<CashFlowItem[]>([]);
    const [cashFlowTags, setCashFlowTags] = useState<CashFlowTag[]>([]);
    const [cashFlowItemTypes, setCashFlowItemTypes] = useState<CashFlowItemType[]>([]);
    const [hscodes, setHscodes] = useState<HSCode[]>([]);
    const [optionTypes, setOptionTypes] = useState<OptionType[]>([]);
    const [optionVariants, setOptionVariants] = useState<OptionVariant[]>([]);
    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [trash, setTrash] = useState<TrashItem[]>([]);
    const [exchangeRates, setExchangeRates] = useState<Record<Currency, number>>(KZT_RATES);
    const [writeoffReasonTypes, setWriteoffReasonTypes] = useState<WriteOffReasonType[]>([]);

    const addLog = async (action: ActionType, entity: string, entityId: string, details: string) => {
        const newLog: any = {
            id: ApiService.generateId('LOG'),
            timestamp: new Date().toISOString(),
            user: 'Admin',
            action,
            documentType: entity,
            documentId: entityId,
            description: details
        };
        try {
            const savedLog = await ApiService.create<LogEntry>(TableNames.LOGS, newLog);
            setLogs(prev => [savedLog, ...prev]);
        } catch (e) {
            console.error("Failed to save log:", e);
        }
    };

    const moveToTrash = async (businessLogicId: string, objectType: TrashItem['type'], displayName: string, sourceData: any) => {
        try {
            const cleanData = JSON.parse(JSON.stringify(sourceData));
            
            const existing = await ApiService.fetchAll<TrashItem>(TableNames.TRASH, { originalId: businessLogicId, type: objectType });
            if (existing && existing.length > 0) return existing[0];

            const initialEntry = {
                id: ApiService.generateUUID(),
                originalId: businessLogicId,
                type: objectType,
                name: displayName,
                data: cleanData,
                deletedAt: new Date().toISOString()
            };

            const createdRecord = await ApiService.create<TrashItem>(TableNames.TRASH, initialEntry);
            setTrash(prev => [createdRecord, ...prev]);
            addLog('Delete', objectType, businessLogicId, 'Перемещено в корзину');
            
            return createdRecord;
        } catch (e) {
            console.error("MoveToTrash Error:", e);
            throw e;
        }
    };

    const restoreFromTrash = async (trashRecord: TrashItem): Promise<void> => {
        try {
            // Для OptionVariant, если он не удален физически, просто убираем запись из корзины
            if (trashRecord.type === 'OptionVariant') {
                const existing = optionVariants.find(v => v.id === trashRecord.originalId);
                if (existing) {
                    await ApiService.delete(TableNames.TRASH, trashRecord.id);
                    setTrash(prev => prev.filter(item => item.id !== trashRecord.id));
                    addLog('Update', trashRecord.type, trashRecord.originalId, 'Восстановлено (снята пометка)');
                    return;
                }
            }

            const reconstructedObject = { ...trashRecord.data };
            reconstructedObject.id = trashRecord.originalId;

            if (['Order', 'SalesOrder', 'PlannedPayment'].includes(trashRecord.type)) {
                let tableName = '';
                if (trashRecord.type === 'Order') tableName = TableNames.SUPPLIER_ORDERS;
                else if (trashRecord.type === 'SalesOrder') tableName = TableNames.SALES_ORDERS;
                else tableName = TableNames.PLANNED_PAYMENTS;

                await ApiService.update(tableName, trashRecord.originalId, { isDeleted: false });
                await ApiService.delete(TableNames.TRASH, trashRecord.id);
                setTrash(prev => prev.filter(item => item.id !== trashRecord.id));
                addLog('Create', trashRecord.type, trashRecord.originalId, 'Восстановлено (снята пометка)');
                return;
            }

            let tableName = '';
            switch (trashRecord.type) {
                case 'Product': tableName = TableNames.PRODUCTS; break;
                case 'Category': tableName = TableNames.PRODUCT_CATEGORIES; break;
                case 'CashFlowItem': tableName = TableNames.CASH_FLOW_ITEMS; break;
                case 'HSCode': tableName = TableNames.HS_CODES; break;
                case 'OptionType': tableName = TableNames.OPTION_TYPES; break;
                case 'OptionVariant': tableName = TableNames.OPTION_VARIANTS; break;
                case 'Bundle': tableName = TableNames.BUNDLES; break;
                case 'Manufacturer': tableName = TableNames.MANUFACTURERS; break;
                case 'Counterparty': tableName = TableNames.COUNTERPARTIES; break;
                case 'OurCompany': tableName = TableNames.OUR_COMPANIES; break;
                case 'Employee': tableName = TableNames.EMPLOYEES; break;
                default: throw new Error(`Unknown type: ${trashRecord.type}`);
            }
            
            const restored = await ApiService.create(tableName, reconstructedObject);
            
            if (trashRecord.type === 'Category') setCategories(prev => [...prev, restored as any]);
            if (trashRecord.type === 'CashFlowItem') setCashFlowItems(prev => [...prev, restored as any]);
            if (trashRecord.type === 'HSCode') setHscodes(prev => [...prev, restored as any]);
            if (trashRecord.type === 'OptionType') setOptionTypes(prev => [...prev, { ...restored as any, variants: [] }]);
            if (trashRecord.type === 'OptionVariant') setOptionVariants(prev => [...prev, restored as any]);
            if (trashRecord.type === 'Bundle') setBundles(prev => [...prev, restored as any]);
            if (trashRecord.type === 'Manufacturer') setManufacturers(prev => [...prev, restored as any]);
            if (trashRecord.type === 'Counterparty') setCounterparties(prev => [...prev, restored as any]);
            if (trashRecord.type === 'OurCompany') setOurCompanies(prev => [...prev, restored as any]);
            if (trashRecord.type === 'Employee') setEmployees(prev => [...prev, restored as any]);

            await ApiService.delete(TableNames.TRASH, trashRecord.id);
            setTrash(prev => prev.filter(item => item.id !== trashRecord.id));
            addLog('Create', trashRecord.type, trashRecord.originalId, 'Восстановлено из корзины');
        } catch (e: any) {
            console.error("Restore Error:", e);
            throw e;
        }
    };

    const permanentlyDelete = async (trashRecord: TrashItem) => {
        try {
            if (['Order', 'SalesOrder', 'PlannedPayment', 'OptionVariant'].includes(trashRecord.type)) {
                if (trashRecord.type === 'Order') {
                    await ApiService.deleteByField(TableNames.SUPPLIER_ORDER_ITEMS, 'supplierOrderId', trashRecord.originalId);
                    await ApiService.delete(TableNames.SUPPLIER_ORDERS, trashRecord.originalId);
                } else if (trashRecord.type === 'SalesOrder') {
                    await ApiService.deleteByField(TableNames.SALES_ORDER_ITEMS, 'salesOrderId', trashRecord.originalId);
                    await ApiService.delete(TableNames.SALES_ORDERS, trashRecord.originalId);
                } else if (trashRecord.type === 'PlannedPayment') {
                    await ApiService.delete(TableNames.PLANNED_PAYMENTS, trashRecord.originalId);
                } else if (trashRecord.type === 'OptionVariant') {
                    await ApiService.delete(TableNames.OPTION_VARIANTS, trashRecord.originalId);
                    setOptionVariants(prev => prev.filter(v => v.id !== trashRecord.originalId));
                }
            }

            await ApiService.delete(TableNames.TRASH, trashRecord.id);
            setTrash(prev => prev.filter(item => item.id !== trashRecord.id));
            addLog('Delete', 'Permanent', trashRecord.originalId, `Удалено навсегда: ${trashRecord.name}`);
        } catch (e: any) {
            throw e;
        }
    };

    const addCounterparty = async (c: Counterparty, account?: Partial<CounterpartyAccount>) => {
        const { saved, newAccount } = await ApiService.createCounterpartyWithAccount(c, account || {});
        setCounterparties(prev => [...prev, saved]);
        if (newAccount) {
            setCounterpartyAccounts(prev => [...prev, newAccount]);
        }
        addLog('Create', 'Контрагент', saved.id, `Создан контрагент: ${saved.name}`);
        return saved;
    };
    
    const updateCounterparty = async (c: Counterparty, accounts: CounterpartyAccount[]) => {
        const { updated, newAccounts } = await ApiService.updateCounterpartyWithAccounts(c, accounts);
        setCounterparties(prev => prev.map(x => (x.id === c.id ? updated : x)));
        const otherAccounts = counterpartyAccounts.filter(acc => acc.counterpartyId !== c.id);
        setCounterpartyAccounts([...otherAccounts, ...newAccounts]);
        addLog('Update', 'Контрагент', c.id, `Обновлен контрагент: ${c.name}`);
        return updated;
    };

    const patchCounterpartyCashFlowItems = async (id: string, cashFlowItemIds: string[]) => {
        await ApiService.update(TableNames.COUNTERPARTIES, id, { cashFlowItemIds });
        setCounterparties(prev => prev.map(c => c.id === id ? { ...c, cashFlowItemIds } : c));
    };

    const deleteCounterparty = async (id: string) => {
        const item = counterparties.find(x => x.id === id);
        if (item) {
            await moveToTrash(id, 'Counterparty', item.name, item);
            await ApiService.delete(TableNames.COUNTERPARTIES, id);
            await ApiService.deleteByField(TableNames.COUNTERPARTY_ACCOUNTS, 'counterpartyId', id);
            setCounterparties(prev => prev.filter(x => x.id !== id));
            setCounterpartyAccounts(prev => prev.filter(acc => acc.counterpartyId !== id));
        }
    };

    const addManufacturer = async (m: Manufacturer) => {
        const newMan = { ...m, id: m.id || ApiService.generateId() };
        const saved = await ApiService.create<Manufacturer>(TableNames.MANUFACTURERS, newMan);
        setManufacturers(prev => [...prev, saved]);
        addLog('Create', 'Производитель', saved.id, `Создан производитель: ${saved.name}`);
        return saved;
    };

    const updateManufacturer = async (m: Manufacturer) => {
        const saved = await ApiService.update<Manufacturer>(TableNames.MANUFACTURERS, m.id, m);
        setManufacturers(prev => prev.map(x => x.id === m.id ? saved : x));
        return saved;
    };

    const addOurCompany = async (oc: OurCompany) => {
        const newOC = { ...oc, id: oc.id || ApiService.generateId() };
        const saved = await ApiService.create<OurCompany>(TableNames.OUR_COMPANIES, newOC);
        setOurCompanies(prev => [...prev, saved]);
        addLog('Create', 'Наши компании', saved.id, `Создана компания: ${saved.name}`);
        return saved;
    };

    const updateOurCompany = async (oc: OurCompany) => {
        const saved = await ApiService.update<OurCompany>(TableNames.OUR_COMPANIES, oc.id, oc);
        setOurCompanies(prev => prev.map(x => x.id === oc.id ? saved : x));
        return saved;
    };

    const addEmployee = async (e: Employee) => {
        const newEmp = { ...e, id: e.id || ApiService.generateId() };
        const saved = await ApiService.create<Employee>(TableNames.EMPLOYEES, newEmp);
        setEmployees(prev => [...prev, saved]);
        addLog('Create', 'Сотрудник', saved.id, `Создан сотрудник: ${saved.name}`);
        return saved;
    };

    const updateEmployee = async (e: Employee) => {
        const saved = await ApiService.update<Employee>(TableNames.EMPLOYEES, e.id, e);
        setEmployees(prev => prev.map(x => x.id === e.id ? saved : x));
        return saved;
    };

    const deleteManufacturerFromRef = async (id: string) => {
        const item = manufacturers.find(x => x.id === id);
        if (item) {
            await moveToTrash(id, 'Manufacturer', item.name, item);
            await ApiService.delete(TableNames.MANUFACTURERS, id);
            setManufacturers(prev => prev.filter(x => x.id !== id));
        }
    };

    const deleteOurCompanyFromRef = async (id: string) => {
        const item = ourCompanies.find(x => x.id === id);
        if (item) {
            await moveToTrash(id, 'OurCompany', item.name, item);
            await ApiService.delete(TableNames.OUR_COMPANIES, id);
            setOurCompanies(prev => prev.filter(x => x.id !== id));
        }
    };

    const deleteEmployeeFromRef = async (id: string) => {
        const item = employees.find(x => x.id === id);
        if (item) {
            await moveToTrash(id, 'Employee', item.name, item);
            await ApiService.delete(TableNames.EMPLOYEES, id);
            setEmployees(prev => prev.filter(x => x.id !== id));
        }
    };

    const addHSCode = async (h: HSCode) => {
        const saved = await ApiService.create<HSCode>(TableNames.HS_CODES, h);
        setHscodes(prev => [...prev, saved]);
        addLog('Create', 'Код ТНВЭД', saved.code, `Создан код: ${saved.code}`);
        return saved;
    };

    const updateHSCode = async (h: HSCode) => {
        const saved = await ApiService.update<HSCode>(TableNames.HS_CODES, h.id, h);
        setHscodes(prev => prev.map(x => x.id === h.id ? saved : x));
        addLog('Update', 'Код ТНВЭД', saved.code, 'Изменение данных');
        return saved;
    };

    const deleteHSCode = async (id: string) => {
        const h = hscodes.find(x => x.id === id);
        if (h) {
            await moveToTrash(id, 'HSCode', h.code, h);
            await ApiService.delete(TableNames.HS_CODES, id);
            setHscodes(prev => prev.filter(x => x.id !== id));
        }
    };

    const addCategory = async (c: ProductCategory) => {
        const saved = await ApiService.create<ProductCategory>(TableNames.PRODUCT_CATEGORIES, c);
        setCategories(prev => [...prev, saved]);
        return saved;
    };

    const updateCategory = async (c: ProductCategory) => {
        const saved = await ApiService.update<ProductCategory>(TableNames.PRODUCT_CATEGORIES, c.id, c);
        setCategories(prev => prev.map(x => x.id === c.id ? saved : x));
        addLog('Update', 'Категория', c.id, `Обновлена категория: ${c.name}`);
        return saved;
    };

    const addCategoriesBulk = async (cats: ProductCategory[]) => {
        if (cats.length === 0) return [];
        const saved = await ApiService.createMany<ProductCategory>(TableNames.PRODUCT_CATEGORIES, cats);
        setCategories(prev => [...prev, ...saved]);
        return saved;
    };

    const deleteCategory = async (id: string) => {
        const c = categories.find(x => x.id === id);
        if (c) {
            await moveToTrash(id, 'Category', c.name, c);
            await ApiService.delete(TableNames.PRODUCT_CATEGORIES, id);
            setCategories(prev => prev.filter(x => x.id !== id));
        }
    };

    const addCashFlowItem = async (c: CashFlowItem) => {
        const data = { ...c } as any;
        delete data.id;
        delete data.category; // no category column in DB
        const saved = await ApiService.create<CashFlowItem>(TableNames.CASH_FLOW_ITEMS, data);
        setCashFlowItems(prev => [...prev, { ...saved, isGroup: saved.isGroup ?? false, sortOrder: saved.sortOrder ?? 0, tagIds: saved.tagIds ?? [] }]);
        addLog('Create', 'Статья ДДС', saved.id, `Создана статья: ${saved.name}`);
        return saved;
    };

    const updateCashFlowItem = async (id: string, data: Partial<CashFlowItem>) => {
        const payload = { ...data } as any;
        delete payload.category;
        const saved = await ApiService.update<CashFlowItem>(TableNames.CASH_FLOW_ITEMS, id, payload);
        setCashFlowItems(prev => prev.map(x => x.id === id ? { ...x, ...saved, isGroup: saved.isGroup ?? x.isGroup, tagIds: saved.tagIds ?? x.tagIds } : x));
        return saved;
    };

    const deleteCashFlowItem = async (id: string) => {
        const item = cashFlowItems.find(x => x.id === id);
        if (item) {
            // Переносим дочерние статьи в корень (снимаем parentId)
            const children = cashFlowItems.filter(x => x.parentId === id);
            await Promise.all(children.map(ch => ApiService.update(TableNames.CASH_FLOW_ITEMS, ch.id, { parentId: null })));
            if (children.length > 0) {
                setCashFlowItems(prev => prev.map(x => x.parentId === id ? { ...x, parentId: undefined } : x));
            }
            await moveToTrash(id, 'CashFlowItem', item.name, item);
            await ApiService.delete(TableNames.CASH_FLOW_ITEMS, id);
            setCashFlowItems(prev => prev.filter(x => x.id !== id));
        }
    };

    // --- Теги ДДС ---
    const addCashFlowTag = async (tag: Omit<CashFlowTag, 'id'>) => {
        const saved = await ApiService.create<CashFlowTag>(TableNames.CASH_FLOW_TAGS, tag);
        setCashFlowTags(prev => [...prev, saved]);
        addLog('Create', 'Тег ДДС', saved.id, `Создан тег: ${saved.name}`);
        return saved;
    };

    const updateCashFlowTag = async (id: string, data: Partial<CashFlowTag>) => {
        const saved = await ApiService.update<CashFlowTag>(TableNames.CASH_FLOW_TAGS, id, data);
        setCashFlowTags(prev => prev.map(x => x.id === id ? { ...x, ...saved } : x));
        return saved;
    };

    // --- Типы статей ДДС ---
    const addCashFlowItemType = async (type: Omit<CashFlowItemType, 'id'>) => {
        const saved = await ApiService.create<CashFlowItemType>(TableNames.CASH_FLOW_ITEM_TYPES, type);
        setCashFlowItemTypes(prev => [...prev, saved]);
        addLog('Create', 'Тип статьи ДДС', saved.id, `Создан тип: ${saved.name}`);
        return saved;
    };

    const updateCashFlowItemType = async (id: string, data: Partial<CashFlowItemType>) => {
        const saved = await ApiService.update<CashFlowItemType>(TableNames.CASH_FLOW_ITEM_TYPES, id, data);
        setCashFlowItemTypes(prev => prev.map(x => x.id === id ? { ...x, ...saved } : x));
        return saved;
    };

    const deleteCashFlowItemType = async (id: string) => {
        // Снимаем тип со всех статей
        const affected = cashFlowItems.filter(x => x.itemTypeId === id);
        await Promise.all(affected.map(item =>
            ApiService.update(TableNames.CASH_FLOW_ITEMS, item.id, { itemTypeId: null })
        ));
        if (affected.length > 0) {
            setCashFlowItems(prev => prev.map(x =>
                x.itemTypeId === id ? { ...x, itemTypeId: null } : x
            ));
        }
        await ApiService.delete(TableNames.CASH_FLOW_ITEM_TYPES, id);
        setCashFlowItemTypes(prev => prev.filter(x => x.id !== id));
        addLog('Delete', 'Тип статьи ДДС', id, 'Удалён тип');
    };

    const deleteCashFlowTag = async (id: string) => {
        // Снимаем тег со всех статей
        const affected = cashFlowItems.filter(x => x.tagIds?.includes(id));
        await Promise.all(affected.map(item =>
            ApiService.update(TableNames.CASH_FLOW_ITEMS, item.id, { tagIds: item.tagIds.filter(t => t !== id) })
        ));
        if (affected.length > 0) {
            setCashFlowItems(prev => prev.map(x =>
                x.tagIds?.includes(id) ? { ...x, tagIds: x.tagIds.filter(t => t !== id) } : x
            ));
        }
        await ApiService.delete(TableNames.CASH_FLOW_TAGS, id);
        setCashFlowTags(prev => prev.filter(x => x.id !== id));
        addLog('Delete', 'Тег ДДС', id, 'Удалён тег');
    };

    const addOptionType = async (ot: OptionType) => {
        const otData = { ...ot };
        delete (otData as any).variants;
        const saved = await ApiService.create<OptionType>(TableNames.OPTION_TYPES, otData);
        const result = { ...saved, variants: [] };
        setOptionTypes(prev => [...prev, result]);
        return result;
    };

    const addOptionTypesBulk = async (types: OptionType[]) => {
        if (types.length === 0) return [];
        const data = types.map(t => {
            const otData = { ...t };
            delete (otData as any).variants;
            return otData;
        });
        const saved = await ApiService.createMany<OptionType>(TableNames.OPTION_TYPES, data);
        const results = saved.map(s => ({ ...s, variants: [] }));
        setOptionTypes(prev => [...prev, ...results]);
        return results;
    };

    const updateOptionType = async (ot: OptionType) => {
        const otData = { ...ot };
        delete (otData as any).variants;
        const saved = await ApiService.update<OptionType>(TableNames.OPTION_TYPES, ot.id, otData);
        setOptionTypes(prev => prev.map(x => x.id === ot.id ? { ...saved, variants: x.variants } : x));
        return saved;
    };

    const deleteOptionType = async (id: string) => {
        const ot = optionTypes.find(x => x.id === id);
        if (ot) {
            await moveToTrash(id, 'OptionType', ot.name, ot);
            await ApiService.delete(TableNames.OPTION_TYPES, id);
            setOptionTypes(prev => prev.filter(x => x.id !== id));
        }
    };

    const addOptionVariant = async (ov: OptionVariant) => {
        const saved = await ApiService.create<OptionVariant>(TableNames.OPTION_VARIANTS, ov);
        setOptionVariants(prev => [...prev, saved]);
        return saved;
    };

    const upsertOptionVariantsBulk = async (variants: OptionVariant[]) => {
        if (variants.length === 0) return [];
        const saved = await ApiService.upsertMany<OptionVariant>(TableNames.OPTION_VARIANTS, variants);
        setOptionVariants(prev => {
            const newMap = new Map(prev.map(v => [v.id, v]));
            saved.forEach(s => newMap.set(s.id, s));
            return Array.from(newMap.values());
        });
        return saved;
    };

    const updateOptionVariant = async (ov: OptionVariant) => {
        const saved = await ApiService.update<OptionVariant>(TableNames.OPTION_VARIANTS, ov.id, ov);
        setOptionVariants(prev => prev.map(x => x.id === ov.id ? saved : x));
        return saved;
    };

    const deleteOptionVariant = async (id: string) => {
        const ov = optionVariants.find(x => x.id === id);
        if (ov) {
            // Мягкое удаление: только в корзину, оригинал оставляем для подсветки
            await moveToTrash(id, 'OptionVariant', ov.name, ov);
        }
    };

    const addBundle = async (b: Bundle) => {
        const saved = await ApiService.create<Bundle>(TableNames.BUNDLES, b);
        setBundles(prev => [...prev, saved]);
        return saved;
    };

    const updateBundle = async (b: Bundle) => {
        const saved = await ApiService.update<Bundle>(TableNames.BUNDLES, b.id, b);
        setBundles(prev => prev.map(x => x.id === b.id ? saved : x));
        return saved;
    };

    const deleteBundle = async (id: string) => {
        const b = bundles.find(x => x.id === id);
        if (b) {
            await moveToTrash(id, 'Bundle', b.name, b);
            await ApiService.delete(TableNames.BUNDLES, id);
            setBundles(prev => prev.filter(x => x.id !== id));
        }
    };

    const updateExchangeRate = async (c: Currency, rate: number) => {
        try {
            await ApiService.updateExchangeRate(c, rate);
            setExchangeRates(prev => ({ ...prev, [c]: rate }));
        } catch (e) {
            console.error(`Failed to sync rate for ${c} to DB:`, e);
            throw e;
        }
    };

    // ───── Типы причин списания ─────
    const addWriteoffReasonType = async (rt: Omit<WriteOffReasonType, 'id' | 'createdAt'>) => {
        const saved = await ApiService.create<WriteOffReasonType>(TableNames.WRITEOFF_REASON_TYPES, rt);
        setWriteoffReasonTypes(prev => [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder));
        return saved;
    };

    const updateWriteoffReasonType = async (id: string, data: Partial<WriteOffReasonType>) => {
        const saved = await ApiService.update<WriteOffReasonType>(TableNames.WRITEOFF_REASON_TYPES, id, data);
        setWriteoffReasonTypes(prev => prev.map(x => x.id === id ? { ...x, ...saved } : x).sort((a, b) => a.sortOrder - b.sortOrder));
        return saved;
    };

    const deleteWriteoffReasonType = async (id: string) => {
        await ApiService.delete(TableNames.WRITEOFF_REASON_TYPES, id);
        setWriteoffReasonTypes(prev => prev.filter(x => x.id !== id));
    };

    return {
        counterparties, setCounterparties, counterpartyAccounts, setCounterpartyAccounts,
        manufacturers, setManufacturers,
        ourCompanies, setOurCompanies, employees, setEmployees,
        categories, setCategories,
        cashFlowItems, setCashFlowItems, addCashFlowItem, updateCashFlowItem, deleteCashFlowItem,
        cashFlowTags, setCashFlowTags, addCashFlowTag, updateCashFlowTag, deleteCashFlowTag,
        cashFlowItemTypes, setCashFlowItemTypes, addCashFlowItemType, updateCashFlowItemType, deleteCashFlowItemType,
        hscodes, setHscodes, addHSCode, updateHSCode, deleteHSCode,
        optionTypes, setOptionTypes, optionVariants, setOptionVariants,
        bundles, setBundles, logs, setLogs, trash, setTrash,
        exchangeRates, setExchangeRates, addCounterparty, updateCounterparty, deleteCounterparty, patchCounterpartyCashFlowItems,
        addManufacturer, updateManufacturer, deleteManufacturer: deleteManufacturerFromRef, addOurCompany, updateOurCompany, deleteOurCompany: deleteOurCompanyFromRef, addEmployee, updateEmployee, deleteEmployee: deleteEmployeeFromRef,
        addCategory, updateCategory, addCategoriesBulk, deleteCategory, addOptionType, addOptionTypeBulk: addOptionType, addOptionTypesBulk, updateOptionType, deleteOptionType,
        addOptionVariant, upsertOptionVariantsBulk, updateOptionVariant, deleteOptionVariant,
        addBundle, updateBundle, deleteBundle, moveToTrash, restoreFromTrash, permanentlyDelete,
        updateExchangeRate, addLog,
        writeoffReasonTypes, setWriteoffReasonTypes,
        addWriteoffReasonType, updateWriteoffReasonType, deleteWriteoffReasonType,
    };
};
