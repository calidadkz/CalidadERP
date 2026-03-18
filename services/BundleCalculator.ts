
import { Currency, OptionVariant, Product } from '../types';

export class BundleCalculator {
  static getVariantRawInfo(variant: OptionVariant, machine?: Product) {
    let price = variant.price;
    if (machine && machine.machineConfig) {
      const typeConfig = machine.machineConfig.find(mc => mc.typeId === variant.typeId);
      if (typeConfig && typeConfig.priceOverrides && typeConfig.priceOverrides[variant.id] !== undefined) {
        price = typeConfig.priceOverrides[variant.id];
      }
    }
    return { price, currency: variant.currency };
  }

  static getRelativePrice(
    typeId: string, 
    variant: OptionVariant, 
    optionVariants: OptionVariant[], 
    machine?: Product
  ) {
    if (!machine) return { diff: 0, currency: variant.currency };

    const typeConfig = machine.machineConfig?.find(mc => mc.typeId === typeId);
    const defaultVarId = typeConfig?.defaultVariantId;
    
    const currentRaw = this.getVariantRawInfo(variant, machine);

    if (!defaultVarId) {
      return { diff: currentRaw.price, currency: currentRaw.currency };
    }

    const defaultVariant = optionVariants.find(v => v.id === defaultVarId);
    const defaultRaw = defaultVariant ? this.getVariantRawInfo(defaultVariant, machine) : { price: 0, currency: Currency.USD };

    // Упрощение: предполагаем одну валюту внутри группы для расчета разницы. 
    // Если валюты разные, нужно привести к базовой валюте станка через exchangeRates (передается извне)
    return { diff: currentRaw.price - defaultRaw.price, currency: currentRaw.currency };
  }

  static calculateTotals(
    machine: Product, 
    selectedOptions: Record<string, string[]>, 
    optionVariants: OptionVariant[],
    exchangeRates: Record<Currency, number>
  ) {
    let totalPurchaseInBase = machine.basePrice;
    
    const getCrossRate = (from: Currency, to: Currency) => {
        if (from === to) return 1;
        return (exchangeRates[from] || 1) / (exchangeRates[to] || 1);
    };

    const machineVolume = machine.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0;
    let totalVolumeM3 = machineVolume;

    Object.entries(selectedOptions).forEach(([typeId, variantIds]) => {
      const config = machine.machineConfig?.find(mc => mc.typeId === typeId);
      const defaultVarId = config?.defaultVariantId;

      variantIds.forEach(varId => {
        const variant = optionVariants.find(v => v.id === varId);
        if (!variant) return;

        totalVolumeM3 += variant.volumeM3 || 0;

        const raw = this.getVariantRawInfo(variant, machine);
        const rateToMachine = getCrossRate(raw.currency, machine.currency);
        const varCostInBase = raw.price * rateToMachine;

        if (defaultVarId) {
          if (varId !== defaultVarId) {
            const defVar = optionVariants.find(v => v.id === defaultVarId);
            const defRaw = defVar ? this.getVariantRawInfo(defVar, machine) : { price: 0, currency: Currency.USD };
            const defRateToMachine = getCrossRate(defRaw.currency, machine.currency);
            const defCostInBase = defRaw.price * defRateToMachine;
            totalPurchaseInBase += (varCostInBase - defCostInBase);
          }
        } else {
          totalPurchaseInBase += varCostInBase;
        }
      });
    });

    const rateToKZT = exchangeRates[machine.currency] || 1;
    const salesTotal = Math.round(totalPurchaseInBase * rateToKZT * (1 + (machine.markupPercentage || 30) / 100));
    
    return { purchaseTotal: totalPurchaseInBase, salesTotal, totalVolumeM3 };
  }
}
