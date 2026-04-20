import { useState, useCallback, useEffect, useMemo } from 'react';
import { GeneralSettings, PreCalculationItem, PreCalculationDocument } from '@/types/pre-calculations';
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
    salesBonusRate: 3,
    chinaDomesticRateMethod: 'volume',
    chinaDomesticRatePerM3Usd: 0,
    chinaDomesticRatePerTonUsd: 0,
    chinaDomesticFixedKztTotal: 0,
};

export const usePreCalculations = (id?: string) => {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<PreCalculationItem[]>([]);
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
          salesBonusRate: Number(docData.salesBonusRate) || 3,
          chinaDomesticRateMethod: (docData.chinaDomesticRateMethod as any) || 'volume',
          chinaDomesticRatePerM3Usd: Number(docData.chinaDomesticRatePerM3Usd) || 0,
          chinaDomesticRatePerTonUsd: Number(docData.chinaDomesticRatePerTonUsd) || 0,
          chinaDomesticFixedKztTotal: Number(docData.chinaDomesticFixedKztTotal ?? docData.chinaDomesticFixedKztPerUnit) || 0,
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
          options: (() => {
            const raw = item.options;
            // Поддержка нового формата: { variants: [...], breakdown: {...} }
            if (Array.isArray(raw)) return raw;
            return (raw as any)?.variants || [];
          })(),
          purchasePriceBreakdown: (() => {
            const raw = item.options;
            if (Array.isArray(raw)) return undefined;
            return (raw as any)?.breakdown || undefined;
          })(),
          deliveryUrumqiAlmatyKzt: Number(item.deliveryUrumqiAlmatyKzt) || 0,
          deliveryChinaDomesticKzt: Number(item.deliveryChinaDomesticKzt) || 0,
          deliveryAlmatyKaragandaPerItemKzt: Number(item.logisticsAlmatyKaragandaKzt) || 0,
          svhPerItemKzt: Number(item.svhPerItemKzt) || 0,
          brokerPerItemKzt: Number(item.brokerPerItemKzt) || 0,
          customsFeesPerItemKzt: Number(item.customsFeesPerItemKzt) || 0,
          customsNdsKzt: Number(item.customsNdsKzt) || 0,
          totalNdsKzt: Number(item.totalNdsKzt) || 0,
          ndsDifferenceKzt: Number(item.ndsDifferenceKzt) || 0,
          kpnKzt: Number(item.kpnKzt) || 0,
          salesBonusKzt: Number(item.salesBonusKzt) || 0,
          preSaleCostKzt: 0,
          fullCostKzt: Number(item.fullCostKzt) || 0,
          profitKzt: Number(item.profitKzt) || 0
      }));

      const fullDoc: PreCalculationDocument = {
          id: docData.id,
          name: docData.name,
          date: docData.date,
          status: docData.status === 'Draft' ? 'draft' : 'finalized',
          settings,
          items: mappedItems,
          packingList: [],
          timeline: docData.timeline ?? undefined,
      };

      setPreCalculation(fullDoc);
      setGeneralSettings(settings);
      setItems(mappedItems);

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
      
      // Мультивалютный пересчёт: если есть разбивка по валютам — применяем курсы предрасчёта к каждой части.
      // Это гарантирует, что CNY-опции пересчитываются по exchangeRateCny, а не "растворяются" в USD.
      if (newItem.purchasePriceBreakdown && Object.keys(newItem.purchasePriceBreakdown).length > 0) {
        const b = newItem.purchasePriceBreakdown;
        const usdRate = Number(generalSettings.exchangeRateUsd) || 450;
        const cnyRate = Number(generalSettings.exchangeRateCny) || 63;
        newItem.purchasePriceKzt = Object.entries(b).reduce((sum, [cur, amt]) => {
          const rate = cur === 'CNY' ? cnyRate : usdRate; // USD и прочие валюты → USD курс
          return sum + (Number(amt) || 0) * rate;
        }, 0);
      } else {
        const purchaseRate = newItem.purchasePriceCurrency === 'CNY' ? Number(generalSettings.exchangeRateCny) || 63 : Number(generalSettings.exchangeRateUsd) || 450;
        newItem.purchasePriceKzt = (Number(newItem.purchasePrice) || 0) * purchaseRate;
      }

      const effectiveVolumePerItem = newItem.useDimensions ? (Number(newItem.volumeM3) || 0) : 0;

      // Расчет доставки Урумчи–Алматы за единицу товара
      newItem.deliveryUrumqiAlmatyKzt = effectiveVolumePerItem * (Number(generalSettings.shippingChinaUsdPerM3) || 0) * (Number(generalSettings.exchangeRateForShipping) || 0);

      // Расчет доставки по Китаю за единицу товара (3 метода)
      // Пропускаем если включён ручной ввод для этой позиции
      if (!newItem.customChinaDomestic) {
        const method = generalSettings.chinaDomesticRateMethod || 'volume';
        const shippingRate = Number(generalSettings.exchangeRateForShipping) || 0;
        if (method === 'volume') {
          newItem.deliveryChinaDomesticKzt = effectiveVolumePerItem * (Number(generalSettings.chinaDomesticRatePerM3Usd) || 0) * shippingRate;
        } else if (method === 'weight') {
          const weightTons = (Number(newItem.weightKg) || 0) / 1000;
          newItem.deliveryChinaDomesticKzt = weightTons * (Number(generalSettings.chinaDomesticRatePerTonUsd) || 0) * shippingRate;
        } else {
          // Фикс. сумма на всю партию: распределяем пропорционально объёму позиции.
          // Позиции с useDimensions=false (effectiveVolumePerItem=0) получают 0.
          const fixedTotal = Number(generalSettings.chinaDomesticFixedKztTotal) || 0;
          if (totalEffectiveVolumeM3 > 0 && effectiveVolumePerItem > 0) {
            newItem.deliveryChinaDomesticKzt = fixedTotal * effectiveVolumePerItem / totalEffectiveVolumeM3;
          } else {
            newItem.deliveryChinaDomesticKzt = 0;
          }
        }
      }

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
      
      newItem.customsNdsKzt = (newItem.purchasePriceKzt + ((newItem.deliveryUrumqiAlmatyKzt + newItem.deliveryChinaDomesticKzt) * 0.6)) * (ndsRate / 100);

      let totalNds = 0, kpn = 0;
      const inclusiveVatFactor = ndsRate / (100 + ndsRate);

      if (newItem.taxRegime === 'Упр.') {
        const resalePriceGrossKzt = newItem.purchasePriceKzt * (1 + (Number(generalSettings.resaleMarkup || 0) / 100));
        totalNds = resalePriceGrossKzt * inclusiveVatFactor;
        kpn = revenue * (Number(generalSettings.kpn4Rate || 0) / 100);
      } else {
        totalNds = revenue * inclusiveVatFactor;
        const salesBonus = revenue * (Number(generalSettings.salesBonusRate || 0) / 100);
        const costsBeforeTax = newItem.purchasePriceKzt + newItem.deliveryUrumqiAlmatyKzt + newItem.deliveryChinaDomesticKzt + localLogisticsPerRowKzt + salesBonus;
        const profitBeforeKPN = (revenue - totalNds) - costsBeforeTax;
        kpn = profitBeforeKPN > 0 ? profitBeforeKPN * (Number(generalSettings.kpn20Rate || 0) / 100) : 0;
      }

      newItem.totalNdsKzt = totalNds;
      newItem.ndsDifferenceKzt = totalNds - newItem.customsNdsKzt;
      newItem.kpnKzt = kpn;
      newItem.salesBonusKzt = revenue * (Number(generalSettings.salesBonusRate || 0) / 100);

      const otherCostsTotalKzt = (Number(newItem.pnrKzt) || 0) + (Number(newItem.deliveryLocalKzt) || 0);

      newItem.fullCostKzt = newItem.purchasePriceKzt + newItem.totalNdsKzt + newItem.deliveryUrumqiAlmatyKzt + newItem.deliveryChinaDomesticKzt + localLogisticsPerRowKzt + newItem.salesBonusKzt + kpn + otherCostsTotalKzt;
      newItem.preSaleCostKzt = newItem.purchasePriceKzt + (newItem.taxRegime === 'Упр.' ? newItem.totalNdsKzt : newItem.customsNdsKzt) + newItem.deliveryUrumqiAlmatyKzt + newItem.deliveryChinaDomesticKzt + localLogisticsPerRowKzt;
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
        // Ручное редактирование цены сбрасывает мультивалютную разбивку
        if (key === 'purchasePrice') {
          return { ...item, purchasePrice: value, purchasePriceBreakdown: undefined };
        }
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
          salesBonusRate: Number(generalSettings.salesBonusRate) || 0,
          chinaDomesticRateMethod: generalSettings.chinaDomesticRateMethod || 'volume',
          chinaDomesticRatePerM3Usd: Number(generalSettings.chinaDomesticRatePerM3Usd) || 0,
          chinaDomesticRatePerTonUsd: Number(generalSettings.chinaDomesticRatePerTonUsd) || 0,
          chinaDomesticFixedKztTotal: Number(generalSettings.chinaDomesticFixedKztTotal) || 0,
          timeline: preCalculation.timeline ?? null,
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
            // Упаковываем breakdown в options JSON для обратной совместимости (без новых колонок в БД)
            options: item.purchasePriceBreakdown
              ? { variants: item.options || [], breakdown: item.purchasePriceBreakdown }
              : (item.options || []),
            purchaseKzt: Number(item.purchasePriceKzt) || 0,
            deliveryUrumqiAlmatyKzt: Number(item.deliveryUrumqiAlmatyKzt) || 0,
            deliveryChinaDomesticKzt: Number(item.deliveryChinaDomesticKzt) || 0,
            logisticsAlmatyKaragandaKzt: Number(item.deliveryAlmatyKaragandaPerItemKzt) || 0,
            svhPerItemKzt: Number(item.svhPerItemKzt) || 0,
            brokerPerItemKzt: Number(item.brokerPerItemKzt) || 0,
            customsFeesPerItemKzt: Number(item.customsFeesPerItemKzt) || 0,
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

      setPreCalculation(prev => prev ? { ...prev, id: realId } : null);
      return realId;

    } catch (error) {
      console.error("Failed to save pre-calculation:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [preCalculation, generalSettings, calculatedItemsResult]);

  return {
    preCalculation,
    generalSettings,
    items: calculatedItemsResult,
    isLoading,
    savePreCalculation,
    updateGeneralSetting,
    updateMetadata,
    addItem,
    updateItem,
    updateItemsBatch,
    deleteItem,
    createNew,
    setDetailedListItems: setItems,
  };
};
