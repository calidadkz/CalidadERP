import { useState, useEffect } from 'react';
import { GeneralSettings, DetailedListItem, PackingListItem } from '../../../types/pre-calculations';
import { v4 as uuidv4 } from 'uuid';

export const usePreCalculations = () => {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    shippingChinaUsdPerM3: 150,
    exchangeRateForShipping: 450, // Default from exchange rates section (placeholder)
    deliveryAlmatyKaragandaKzt: 200000,
    svhKzt: 100000,
    brokerKzt: 104000,
    customsFeesKzt: 52000,
    ndsRate: 16,
    kpn20Rate: 0,
    kpn4Rate: 4,
    resaleMarkup: 25,
    salesBonusRate: 0,
  });

  const [detailedListItems, setDetailedListItems] = useState<DetailedListItem[]>([]);
  const [packingListItems, setPackingListItems] = useState<PackingListItem[]>([]);

  useEffect(() => {
    calculateAll();
  }, [generalSettings, detailedListItems, packingListItems]);

  const updateGeneralSetting = (key: keyof GeneralSettings, value: number | string) => {
    setGeneralSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const addDetailedListItem = () => {
    const newItem: DetailedListItem = {
      id: uuidv4(),
      name: 'Новый товар',
      supplierName: 'Поставщик',
      manufacturer: 'Производитель',
      hsCode: 'Код ТНВЭД',
      quantity: 1,
      volumeM3: 0,
      ignoreDimensions: false,
      lengthMm: 0,
      widthMm: 0,
      heightMm: 0,
      weightKg: 0,
      deliveryToClientKzt: 0,
      revenueKzt: 0,
      isRevenueConfirmed: false,
      prepaymentKzt: 0,
      isPrepaymentConfirmed: false,
      taxRegime: 'Общ.',
      deliveryChinaKzt: 0,
      deliveryAlmatyKaragandaPerItemKzt: 0,
      svhPerItemKzt: 0,
      brokerPerItemKzt: 0,
      customsFeesPerItemKzt: 0,
      totalNdsKzt: 0,
      customsNdsKzt: 0,
      ndsDifferenceKzt: 0,
      kpnKzt: 0,
      profitKzt: 0,
      marginPercentage: 0,
      fullCostKzt: 0,
      preSaleCostKzt: 0,
      salesBonusKzt: 0,
      commissioningKzt: 0,
    };
    setDetailedListItems((prev) => [...prev, newItem]);
  };

  const updateDetailedListItem = (id: string, key: keyof DetailedListItem, value: any) => {
    setDetailedListItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  };

  const deleteDetailedListItem = (id: string) => {
    setDetailedListItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addPackingListItem = () => {
    const newItem: PackingListItem = {
      id: uuidv4(),
      placeNumber: packingListItems.length + 1,
      lengthMm: 0,
      widthMm: 0,
      heightMm: 0,
      weightKg: 0,
      volumeM3: 0,
      items: [],
    };
    setPackingListItems((prev) => [...prev, newItem]);
  };

  const updatePackingListItem = (id: string, key: keyof PackingListItem, value: any) => {
    setPackingListItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  };

  const deletePackingListItem = (id: string) => {
    setPackingListItems((prev) => prev.filter((item) => item.id !== id));
  };

  const calculateAll = () => {
    // This is where the complex calculation logic will go.
    // For now, let's just update some placeholder calculated values.
    setDetailedListItems((prevItems) => {
      return prevItems.map((item) => {
        const updatedItem = { ...item };

        // Example calculation: deliveryChinaKzt
        updatedItem.deliveryChinaKzt = item.volumeM3 * generalSettings.shippingChinaUsdPerM3 * generalSettings.exchangeRateForShipping;

        // Example calculation: totalNdsKzt (simplified)
        if (item.taxRegime === 'Общ.') {
          updatedItem.totalNdsKzt = item.revenueKzt * (generalSettings.ndsRate / 100);
        } else {
          // For 'Упр.' regime, NDs is from resale price, which is not directly available yet
          // Placeholder: will implement when resale price logic is clearer
          updatedItem.totalNdsKzt = 0;
        }

        return updatedItem;
      });
    });
  };

  return {
    generalSettings,
    detailedListItems,
    packingListItems,
    updateGeneralSetting,
    addDetailedListItem,
    updateDetailedListItem,
    deleteDetailedListItem,
    addPackingListItem,
    updatePackingListItem,
    deletePackingListItem,
    calculateAll,
  };
};
