import { Product, OptionVariant, Currency, MachineConfigEntry } from '../types';

export class BundleCalculator {
  static getDefaultIds(configEntry: MachineConfigEntry | undefined): string[] {
    if (!configEntry) return [];
    return Array.from(new Set([
      configEntry.defaultVariantId,
      ...(configEntry.defaultVariantIds || [])
    ].filter((id): id is string => !!id)));
  }

  static calculateTotals(
    machine: Product,
    selectedOptions: Record<string, string[]>,
    allVariants: OptionVariant[],
    exchangeRates: Record<string, number>
  ) {
    if (!machine) return { purchaseTotal: 0, totalVolumeM3: 0 };

    let purchaseTotal = Number(machine.basePrice) || 0;
    const packagesVolume = (machine.packages || []).reduce((sum, p) => sum + (Number(p.volumeM3) || 0), 0);
    let totalVolumeM3 = Number(machine.workingVolumeM3) || packagesVolume || 0;

    const machineRate = (exchangeRates && exchangeRates[machine.currency]) || 1;

    if (machine.machineConfig && Array.isArray(machine.machineConfig)) {
      machine.machineConfig.forEach(group => {
        if (!group || !group.typeId) return;

        const defaultIds = this.getDefaultIds(group);
        let groupBaseCost = 0;
        let groupBaseVolume = 0;

        defaultIds.forEach(defId => {
          const defV = allVariants.find(v => v.id === defId);
          if (defV) {
            const price = group.priceOverrides?.[defId] ?? defV.price;
            const defRate = (exchangeRates && exchangeRates[defV.currency]) || 1;
            groupBaseCost += (Number(price) || 0) * (defRate / machineRate);
            groupBaseVolume += (Number(defV.volumeM3) || 0);
          }
        });

        const selectedInGroup = selectedOptions[group.typeId] || [];
        let groupCurrentCost = 0;
        let groupCurrentVolume = 0;

        selectedInGroup.forEach(vid => {
          const v = allVariants.find(av => av.id === vid);
          if (v) {
            const price = group.priceOverrides?.[vid] ?? v.price;
            const vRate = (exchangeRates && exchangeRates[v.currency]) || 1;
            groupCurrentCost += (Number(price) || 0) * (vRate / machineRate);
            groupCurrentVolume += (Number(v.volumeM3) || 0);
          }
        });

        purchaseTotal += (groupCurrentCost - groupBaseCost);
        totalVolumeM3 += (groupCurrentVolume - groupBaseVolume);
      });
    }

    return {
      purchaseTotal: isNaN(purchaseTotal) ? 0 : Math.max(0, purchaseTotal),
      totalVolumeM3: isNaN(totalVolumeM3) ? 0 : Math.max(0, totalVolumeM3)
    };
  }
}
