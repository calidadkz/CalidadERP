import { useState, useCallback, useEffect, useMemo } from 'react';
import { GeneralSettings, PreCalculationItem, PackingListItem, PreCalculationDocument } from '@/types/pre-calculations';
import { api } from '@/services';

const DEFAULT_SETTINGS: GeneralSettings = {
    shippingChinaUsdPerM3: 150,
    exchangeRateForShipping: 500,
    deliveryAlmatyKaragandaKztPerM3: 15000, 
    svhKzt: 100000,
    brokerKzt: 104000,
    customsFeesKzt: 52000,
    exchangeRateUsd: 500,
    exchangeRateCny: 75,
    ndsRate: 16,
    kpn20Rate: 0, 
    kpn4Rate: 4,
    resaleMarkup: 25,
    salesBonusRate: 3 
};

export const usePreCalculations = (id?: string) => {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<PreCalculationItem[]>([]);
  const [packingList, setPackingList] = useState<PackingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [preCalculation, setPreCalculation] = useState<PreCalculationDocument | null>(null);

  const loadPreCalculation = useCallback(async (docId: string) => {
    if (!docId || docId === 'new') return;
    
    setIsLoading(true);
    try {
      const docData = await api.fetchOne<any>('pre_calculations', docId);
      if (!docData) {
          setPreCalculation(null);
          return;
      }

      const rates = await api.fetchAll<{currency: string, rate: number}>('exchange_rates');
      const usdRate = rates.find(r => r.currency === 'USD')?.rate || 500;
      const cnyRate = rates.find(r => r.currency === 'CNY')?.rate || 75;

      const itemsData = await api.fetchAll<any>('pre_calculation_items', { preCalculationId: docId });
      const packagesData = await api.fetchAll<any>('pre_calculation_packages', { preCalculationId: docId });

      const settings: GeneralSettings = {
          shippingChinaUsdPerM3: Number(docData.shippingChinaUsd) || 150,
          exchangeRateForShipping: Number(docData.exchangeRateShipping || docData.exchangeRateUsdKzt) || usdRate,
          deliveryAlmatyKaragandaKztPerM3: Number(docData.deliveryAlmatyKaragandaKztPerM3) || 15000, 
          svhKzt: Number(docData.svhKzt) || 100000,
          brokerKzt: Number(docData.brokerKzt) || 104000,
          customsFeesKzt: Number(docData.customsFeesKzt) || 52000,
          exchangeRateUsd: Number(docData.exchangeRateUsdKzt) || usdRate,
          exchangeRateCny: Number(docData.exchangeRateCnyKzt) || cnyRate,
          ndsRate: Number(docData.vatRate) || 16,
          kpn20Rate: Number(docData.citRateStandard) || 0,
          kpn4Rate: Number(docData.citRateSimplified) || 4,
          resaleMarkup: Number(docData.intercompanyMarkupPercent) || 25,
          salesBonusRate: Number(docData.salesBonusRate) || 3
      };

      const mappedItems: PreCalculationItem[] = itemsData.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          name: item.productName || '',
          sku: item.sku || '',
          type: item.type || 'PART',
          quantity: Number(item.quantity) || 0,
          purchasePrice: Number(item.supplierPriceUsd) || 0,
          purchasePriceCurrency: item.purchaseCurrency || 'USD',
          revenueKzt: Number(item.sellingPriceKzt) || 0,
          pnrKzt: Number(item.pnrKzt) || 0,
          deliveryLocalKzt: Number(item.deliveryLocalKzt) || 0,
          volumeM3: Number(item.volumeM3) || 0,
          weightKg: Number(item.weightKg) || 0,
          marginPercentage: Number(item.marginPercent) || 0,
          taxRegime: item.taxRegime || 'Общ.',
          useDimensions: item.useDimensions !== undefined ? !!item.useDimensions : true,
          isRevenueConfirmed: !!item.isRevenueConfirmed || !!item.orderId,
          orderId: item.orderId,
          clientName: item.clientName,
          supplierName: item.supplierName,
          hsCode: item.hsCode,
          manufacturer: item.manufacturer,
          purchasePriceKzt: Number(item.purchaseKzt) || 0,
          packages: item.packages || [],
          options: item.options || [], 
          deliveryChinaKzt: Number(item.deliveryChinaKzt) || 0,
          deliveryAlmatyKaragandaPerItemKzt: Number(item.logisticsLocalKzt) || 0,
          svhPerItemKzt: 0,
          brokerPerItemKzt: 0,
          customsFeesPerItemKzt: 0,
          customsNdsKzt: Number(item.customsNdsKzt) || 0,
          totalNdsKzt: Number(item.totalNdsKzt) || 0,
          ndsDifferenceKzt: Number(item.ndsDifferenceKzt) || 0,
          kpnKzt: Number(item.kpnKzt) || 0,
          salesBonusKzt: Number(item.salesBonusKzt) || 0,
          preSaleCostKzt: 0,
          fullCostKzt: Number(item.fullCostKzt) || 0,
          profitKzt: Number(item.profitKzt) || 0
      }));

      const mappedPacking: PackingListItem[] = packagesData.map((pkg: any) => ({
          id: pkg.id,
          description: pkg.description || '',
          placeNumber: pkg.packageNumber,
          lengthMm: Number(pkg.lengthMm) || 0,
          widthMm: Number(pkg.widthMm) || 0,
          heightMm: Number(pkg.heightMm) || 0,
          weightKg: Number(pkg.weightKg) || 0,
          volumeM3: Number(pkg.volumeM3) || 0,
          items: pkg.items || []
      }));

      const fullDoc: PreCalculationDocument = {
          id: docData.id,
          name: docData.name,
          date: docData.date,
          status: docData.status === 'Draft' ? 'draft' : 'finalized',
          settings,
          items: mappedItems,
          packingList: mappedPacking
      };

      setPreCalculation(fullDoc);
      setGeneralSettings(settings);
      setItems(mappedItems);
      setPackingList(mappedPacking);

    } catch (error) {
      console.error("Failed to load pre-calculation:", error);
      setPreCalculation(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNew = useCallback(async () => {
    setIsLoading(true);
    try {
        const rates = await api.fetchAll<{currency: string, rate: number}>('exchange_rates');
        const usdRate = rates.find(r => r.currency === 'USD')?.rate || 450;
        const cnyRate = rates.find(r => r.currency === 'CNY')?.rate || 63;

        const newDoc: PreCalculationDocument = {
            id: 'new',
            name: 'Новый предрасчет',
            date: new Date().toISOString(),
            status: 'draft',
            settings: { 
                ...DEFAULT_SETTINGS, 
                exchangeRateUsd: usdRate, 
                exchangeRateCny: cnyRate,
                exchangeRateForShipping: usdRate 
            },
            items: [],
            packingList: [],
        };
        
        setPreCalculation(newDoc);
        setGeneralSettings(newDoc.settings);
        setItems([]);
        setPackingList([]);
        return newDoc;
    } catch (error) {
        console.error("Failed to init new pre-calculation:", error);
        return null;
    } finally {
        setIsLoading(false);
    }
  }, []);

  const updateMetadata = (updates: Partial<PreCalculationDocument>) => {
    setPreCalculation(prev => prev ? { ...prev, ...updates } : null);
  };

  useEffect(() => {
    if (id && id !== 'new' && id !== preCalculation?.id) {
        loadPreCalculation(id);
    }
  }, [id, loadPreCalculation, preCalculation?.id]);

  const calculatedItemsResult = useMemo(() => {
    const totalEffectiveVolumeM3 = items.reduce((total, item) => {
        const volumePerItem = item.useDimensions ? (Number(item.volumeM3) || 0) : 0;
        return total + (volumePerItem * (Number(item.quantity) || 0));
    }, 0);

    return items.map(item => {
      const newItem = { ...item };
      const qty = Number(newItem.quantity) || 0;
      
      const purchaseRate = newItem.purchasePriceCurrency === 'CNY' ? Number(generalSettings.exchangeRateCny) || 63 : Number(generalSettings.exchangeRateUsd) || 450;
      newItem.purchasePriceKzt = (Number(newItem.purchasePrice) || 0) * purchaseRate;

      const effectiveVolumePerItem = newItem.useDimensions ? (Number(newItem.volumeM3) || 0) : 0;

      // Расчет доставки из Китая за единицу товара
      newItem.deliveryChinaKzt = effectiveVolumePerItem * (Number(generalSettings.shippingChinaUsdPerM3) || 0) * (Number(generalSettings.exchangeRateForShipping) || 0);
      
      // Расчет доставки Алматы-Караганда за единицу товара (цена за м3 * объем товара)
      newItem.deliveryAlmatyKaragandaPerItemKzt = (Number(generalSettings.deliveryAlmatyKaragandaKztPerM3) || 0) * effectiveVolumePerItem;
      
      // Расчет SVH, Брокера, Таможенных сборов на единицу товара (пропорционально объему)
      const shareOfTotalVolume = totalEffectiveVolumeM3 > 0 ? (effectiveVolumePerItem * qty) / totalEffectiveVolumeM3 : 0; // Доля текущего товара в общем объеме партии

      newItem.svhPerItemKzt = (Number(generalSettings.svhKzt || 0) * shareOfTotalVolume);
      newItem.brokerPerItemKzt = (Number(generalSettings.brokerKzt || 0) * shareOfTotalVolume);
      newItem.customsFeesPerItemKzt = (Number(generalSettings.customsFeesKzt || 0) * shareOfTotalVolume);

      const localLogisticsPerRowKzt = (newItem.deliveryAlmatyKaragandaPerItemKzt * qty) + 
                                       (newItem.svhPerItemKzt) + 
                                       (newItem.brokerPerItemKzt) + 
                                       (newItem.customsFeesPerItemKzt);

      const ndsRate = Number(generalSettings.ndsRate) || 16;
      const revenue = Number(newItem.revenueKzt) || 0;
      
      newItem.customsNdsKzt = (newItem.purchasePriceKzt + (newItem.deliveryChinaKzt * 0.6)) * (ndsRate / 100);

      let totalNds = 0, kpn = 0;
      const inclusiveVatFactor = ndsRate / (100 + ndsRate);

      if (newItem.taxRegime === 'Упр.') {
        const resalePriceGrossKzt = newItem.purchasePriceKzt * (1 + (Number(generalSettings.resaleMarkup || 0) / 100));
        totalNds = resalePriceGrossKzt * inclusiveVatFactor;
        kpn = revenue * (Number(generalSettings.kpn4Rate || 0) / 100);
      } else {
        totalNds = revenue * inclusiveVatFactor;
        const salesBonus = revenue * (Number(generalSettings.salesBonusRate || 0) / 100);
        const costsBeforeTax = newItem.purchasePriceKzt + newItem.deliveryChinaKzt + localLogisticsPerRowKzt + salesBonus;
        const profitBeforeKPN = (revenue - totalNds) - costsBeforeTax;
        kpn = profitBeforeKPN > 0 ? profitBeforeKPN * (Number(generalSettings.kpn20Rate || 0) / 100) : 0;
      }

      newItem.totalNdsKzt = totalNds;
      newItem.ndsDifferenceKzt = totalNds - newItem.customsNdsKzt;
      newItem.kpnKzt = kpn;
      newItem.salesBonusKzt = revenue * (Number(generalSettings.salesBonusRate || 0) / 100);

      const otherCostsTotalKzt = (Number(newItem.pnrKzt) || 0) + (Number(newItem.deliveryLocalKzt) || 0);

      newItem.fullCostKzt = newItem.purchasePriceKzt + newItem.totalNdsKzt + newItem.deliveryChinaKzt + localLogisticsPerRowKzt + newItem.salesBonusKzt + kpn + otherCostsTotalKzt;
      newItem.preSaleCostKzt = newItem.purchasePriceKzt + (newItem.taxRegime === 'Упр.' ? newItem.totalNdsKzt : newItem.customsNdsKzt) + newItem.deliveryChinaKzt + localLogisticsPerRowKzt;
      newItem.profitKzt = revenue - newItem.fullCostKzt;
      newItem.marginPercentage = revenue > 0 ? (newItem.profitKzt / revenue) * 100 : 0;

      return newItem;
    });
  }, [items, generalSettings]);

  const updateGeneralSetting = (key: keyof GeneralSettings, value: any) => {
    setGeneralSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateItem = useCallback((itemId: string, key: keyof PreCalculationItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, [key]: value };
      })
    );
  }, []);

  const updateItemsBatch = useCallback((updates: Array<{ id: string, updates: Partial<PreCalculationItem> }>) => {
    setItems((prev) => {
      const newItems = [...prev];
      updates.forEach(({ id, updates }) => {
        const index = newItems.findIndex(i => i.id === id);
        if (index !== -1) {
          newItems[index] = { ...newItems[index], ...updates };
        }
      });
      return newItems;
    });
  }, []);

  const addItem = (item: Omit<PreCalculationItem, 'id'>) => {
    const useDimensions = item.type === 'MACHINE';
    const newItem = { 
        ...item, 
        useDimensions, 
        pnrKzt: 0, 
        deliveryLocalKzt: 0,
        id: api.generateId('PCI') 
    } as PreCalculationItem;
    setItems(prev => [...prev, newItem]);
  };

  const deleteItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const addPackingItem = useCallback(() => {
    const newItem: PackingListItem = {
      id: api.generateId('PLI'),
      description: '',
      placeNumber: packingList.length + 1,
      lengthMm: 0,
      widthMm: 0,
      heightMm: 0,
      weightKg: 0,
      volumeM3: 0,
      items: []
    };
    setPackingList(prev => [...prev, newItem]);
  }, [packingList.length]);

  const updatePackingItem = useCallback((id: string, key: keyof PackingListItem, value: any) => {
    setPackingList(prev => prev.map(item => item.id === id ? { ...item, [key]: value } : item));
  }, []);

  const deletePackingItem = useCallback((id: string) => {
    setPackingList(prev => prev.filter(item => item.id !== id));
  }, []);

  const savePreCalculation = useCallback(async () => {
    if (!preCalculation) return;
    
    setIsLoading(true);
    try {
      const realId = preCalculation.id === 'new' ? api.generateId('PC') : preCalculation.id;

      const dbDoc = {
          id: realId,
          name: preCalculation.name,
          date: preCalculation.date || new Date().toISOString(),
          status: preCalculation.status === 'draft' ? 'Draft' : 'Finalized',
          shippingChinaUsd: Number(generalSettings.shippingChinaUsdPerM3) || 0,
          exchangeRateShipping: Number(generalSettings.exchangeRateForShipping) || 0,
          deliveryAlmatyKaragandaKztPerM3: Number(generalSettings.deliveryAlmatyKaragandaKztPerM3) || 0, 
          svhKzt: Number(generalSettings.svhKzt) || 0,
          brokerKzt: Number(generalSettings.brokerKzt) || 0,
          customsFeesKzt: Number(generalSettings.customsFeesKzt) || 0,
          exchangeRateUsdKzt: Number(generalSettings.exchangeRateUsd) || 0,
          exchangeRateCnyKzt: Number(generalSettings.exchangeRateCny) || 0,
          vatRate: Number(generalSettings.ndsRate) || 0,
          citRateStandard: Number(generalSettings.kpn20Rate) || 0,
          citRateSimplified: Number(generalSettings.kpn4Rate) || 0,
          intercompanyMarkupPercent: Number(generalSettings.resaleMarkup) || 0,
          salesBonusRate: Number(generalSettings.salesBonusRate) || 0
      };
      await api.upsert('pre_calculations', dbDoc, 'id');

      await api.deleteByField('pre_calculation_items', 'preCalculationId', realId);
      
      if (calculatedItemsResult.length > 0) {
        const itemsToSave = calculatedItemsResult.map(item => ({
            id: item.id,
            preCalculationId: realId, 
            productId: item.productId,
            orderId: item.orderId,
            clientName: item.clientName,
            productName: item.name,
            sku: item.sku,
            type: item.type,
            manufacturer: item.manufacturer,
            hsCode: item.hsCode,
            quantity: Number(item.quantity) || 0,
            supplierName: item.supplierName,
            supplierPriceUsd: Number(item.purchasePrice) || 0,
            purchaseCurrency: item.purchasePriceCurrency,
            sellingPriceKzt: Number(item.revenueKzt) || 0,
            isRevenueConfirmed: !!item.isRevenueConfirmed,
            pnrKzt: Number(item.pnrKzt) || 0,
            deliveryLocalKzt: Number(item.deliveryLocalKzt) || 0,
            marginPercent: Number(item.marginPercentage) || 0,
            taxRegime: item.taxRegime,
            volumeM3: Number(item.volumeM3) || 0,
            weightKg: Number(item.weightKg) || 0,
            useDimensions: !!item.useDimensions,
            options: item.options,
            purchaseKzt: Number(item.purchasePriceKzt) || 0,
            deliveryChinaKzt: Number(item.deliveryChinaKzt) || 0,
            logisticsLocalKzt: Number(item.deliveryAlmatyKaragandaPerItemKzt) || 0,
            customsNdsKzt: Number(item.customsNdsKzt) || 0,
            totalNdsKzt: Number(item.totalNdsKzt) || 0,
            ndsDifferenceKzt: Number(item.ndsDifferenceKzt) || 0,
            kpnKzt: Number(item.kpnKzt) || 0,
            salesBonusKzt: Number(item.salesBonusKzt) || 0,
            fullCostKzt: Number(item.fullCostKzt) || 0,
            profitKzt: Number(item.profitKzt) || 0
        }));
        await api.createMany('pre_calculation_items', itemsToSave);
      }

      await api.deleteByField('pre_calculation_packages', 'preCalculationId', realId);
      if (packingList.length > 0) {
        const packagesToSave = packingList.map(pkg => ({
            id: pkg.id,
            preCalculationId: realId,
            packageNumber: pkg.placeNumber,
            description: pkg.description,
            lengthMm: Number(pkg.lengthMm) || 0,
            widthMm: Number(pkg.widthMm) || 0,
            heightMm: Number(pkg.heightMm) || 0,
            weightKg: Number(pkg.weightKg) || 0,
            volumeM3: Number(pkg.volumeM3) || 0,
            items: pkg.items
        }));
        await api.createMany('pre_calculation_packages', packagesToSave);
      }

      setPreCalculation(prev => prev ? { ...prev, id: realId } : null);
      return realId;

    } catch (error) {
      console.error("Failed to save pre-calculation:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [preCalculation, generalSettings, calculatedItemsResult, packingList]);

  return {
    preCalculation,
    generalSettings,
    items: calculatedItemsResult,
    packingList,
    isLoading,
    savePreCalculation,
    updateGeneralSetting,
    updateMetadata,
    addItem,
    updateItem,
    updateItemsBatch,
    deleteItem,
    addPackingItem,
    updatePackingItem,
    deletePackingItem,
    createNew,
    setDetailedListItems: setItems,
    setPackingListItems: setPackingList
  };
};
