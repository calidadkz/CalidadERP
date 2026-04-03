
import { PricingProfile, Product, Currency, ProductType, OptionVariant } from '../types';
import { ApiService } from './api';

export class PricingService {
    /**
     * Пытается найти подходящий профиль для товара.
     */
    static findProfile(product: Product, profiles: PricingProfile[]): PricingProfile | null {
        if (!product || (product.type !== ProductType.MACHINE && product.type !== ProductType.PART)) return null;

        if (product.pricingProfileId) {
            const match = (profiles || []).find(p => p && p.id === product.pricingProfileId);
            if (match) return match;
        }

        return (profiles || []).find(p => {
            if (!p) return false;
            const matchSupplier = !p.supplierId || p.supplierId === product.supplierId;
            const matchCategory = !p.applicableCategoryIds?.length || p.applicableCategoryIds.includes(product.categoryId || '');
            return matchSupplier && matchCategory;
        }) || null;
    }

    /**
     * Рассчитывает общую закупочную стоимость конфигурации.
     * Логика: Базовая цена станка + (Сумма цен выбранных вариантов - Сумма цен базовых вариантов)
     */
    static calculateBundlePurchasePrice(
        machine: Product,
        selectedVariantIds: string[],
        allVariants: OptionVariant[],
        exchangeRates: Record<string, number>
    ): number {
        if (!machine) return 0;
        
        let totalPurchaseInMachineCurrency = Number(machine.basePrice) || 0;
        const machineRate = (exchangeRates && exchangeRates[machine.currency]) || 1;

        if (!machine.machineConfig || !Array.isArray(machine.machineConfig)) {
            return totalPurchaseInMachineCurrency;
        }

        machine.machineConfig.forEach(group => {
            if (!group || !group.typeId) return;

            // 1. Считаем стоимость БАЗОВЫХ (дефолтных) опций для этой группы
            const defaultIds = Array.from(new Set([
                group.defaultVariantId,
                ...(group.defaultVariantIds || [])
            ].filter((id): id is string => !!id)));

            let groupBaseCostInMachineCurrency = 0;
            defaultIds.forEach(defId => {
                const defV = (allVariants || []).find(v => v && v.id === defId);
                if (defV) {
                    const price = group.priceOverrides?.[defId] ?? defV.price;
                    const defRate = (exchangeRates && exchangeRates[defV.currency]) || 1;
                    groupBaseCostInMachineCurrency += (Number(price) || 0) * (defRate / machineRate);
                }
            });

            // 2. Считаем стоимость ТЕКУЩИХ ВЫБРАННЫХ опций для этой группы
            const selectedInGroup = (selectedVariantIds || []).filter(vid => {
                const v = (allVariants || []).find(av => av && av.id === vid);
                return v && v.typeId === group.typeId;
            });

            let groupCurrentCostInMachineCurrency = 0;
            selectedInGroup.forEach(vid => {
                const v = (allVariants || []).find(av => av && av.id === vid);
                if (v) {
                    const price = group.priceOverrides?.[vid] ?? v.price;
                    const vRate = (exchangeRates && exchangeRates[v.currency]) || 1;
                    groupCurrentCostInMachineCurrency += (Number(price) || 0) * (vRate / machineRate);
                }
            });

            // 3. Добавляем разницу
            totalPurchaseInMachineCurrency += (groupCurrentCostInMachineCurrency - groupBaseCostInMachineCurrency);
        });

        return isNaN(totalPurchaseInMachineCurrency) ? 0 : totalPurchaseInMachineCurrency;
    }

    /**
     * Рассчитывает итоговый объем конфигурации.
     * Логика аналогична цене: Базовый объем + (Выбранные - Дефолтные)
     */
    static calculateBundleVolume(
        machine: Product,
        selectedVariantIds: string[],
        allVariants: OptionVariant[]
    ): number {
        if (!machine) return 0;
        
        // Базовый объем из workingVolumeM3 или суммы пакетов
        const packagesVolume = (machine.packages || []).reduce((sum, p) => sum + (Number(p.volumeM3) || 0), 0);
        let totalVolume = Number(machine.workingVolumeM3) || packagesVolume || 0;

        if (!machine.machineConfig || !Array.isArray(machine.machineConfig)) {
            return totalVolume;
        }

        machine.machineConfig.forEach(group => {
            const defaultIds = Array.from(new Set([
                group.defaultVariantId,
                ...(group.defaultVariantIds || [])
            ].filter((id): id is string => !!id)));

            let groupBaseVolume = 0;
            defaultIds.forEach(defId => {
                const defV = (allVariants || []).find(v => v && v.id === defId);
                if (defV) groupBaseVolume += (Number(defV.volumeM3) || 0);
            });

            const selectedInGroup = (selectedVariantIds || []).filter(vid => {
                const v = (allVariants || []).find(av => av && av.id === vid);
                return v && v.typeId === group.typeId;
            });

            let groupCurrentVolume = 0;
            selectedInGroup.forEach(vid => {
                const v = (allVariants || []).find(av => av && av.id === vid);
                if (v) groupCurrentVolume += (Number(v.volumeM3) || 0);
            });

            totalVolume += (groupCurrentVolume - groupBaseVolume);
        });

        return isNaN(totalVolume) ? 0 : Math.max(0, totalVolume);
    }

    /**
     * Рассчитывает финальную цену продажи.
     */
    static calculateSmartPrice(
        product: Product,
        profile: PricingProfile | null,
        exchangeRates: Record<string, number>,
        configVolumeM3?: number,
        configPurchaseForeign?: number,
        marginOverridePercent?: number
    ) {
        if (!product) return { finalPrice: 0, purchaseKzt: 0, logisticsCn: 0, logisticsLocal: 0, svh: 0, brokerFees: 0, customsFees: 0, customs: 0, pnr: 0, deliveryLocal: 0, vat: 0, cit: 0, taxes: 0, bonus: 0, landedCost: 0, totalExpenses: 0, netProfit: 0 };
        
        const rates = exchangeRates || {};
        const productRate = rates[product.currency as Currency] || 1;
        const basePrice = Number(configPurchaseForeign ?? product.basePrice) || 0;
        const purchaseKzt = basePrice * productRate;

        if (!profile) {
            const markup = Number(product.markupPercentage) || 0;
            const final = purchaseKzt * (1 + markup / 100);
            return {
                finalPrice: Math.round(isNaN(final) ? 0 : final),
                purchaseKzt: Math.round(purchaseKzt),
                logisticsCn: 0, logisticsLocal: 0, svh: 0, brokerFees: 0, customsFees: 0,
                customs: 0, pnr: 0, deliveryLocal: 0, vat: 0, cit: 0, taxes: 0, bonus: 0,
                landedCost: Math.round(purchaseKzt),
                totalExpenses: Math.round(purchaseKzt),
                netProfit: 0
            };
        }

        const usdRate = rates[Currency.Usd] || 1;
        const productVolume = (product.packages || []).reduce((sum, p) => sum + (Number(p?.volumeM3) || 0), 0) || product.workingVolumeM3 || 0;
        const volume = configVolumeM3 ?? productVolume;
        
        const batchVolume = Number(profile.batchVolumeM3) || 0;

        const logisticsCnKzt = (Number(profile.logisticsRateUsd) || 0) * volume * usdRate;
        const volumeRatio = batchVolume > 0 ? (volume / batchVolume) : 0;
        
        const logisticsKrKzt = volumeRatio * (Number(profile.batchShippingCostKzt) || 0);
        const svhKzt = volumeRatio * (Number(profile.batchSvhCostKzt) || 0);
        const brokerKzt = volumeRatio * (Number(profile.brokerCostKzt) || 0);
        const feesKzt = volumeRatio * (Number(profile.customsFeesKzt) || 0);
        
        const pnrKzt = Number(profile.pnrCostKzt) || 0;
        const deliveryLocalKzt = Number(profile.deliveryKzt) || 0;
        
        const directCosts = purchaseKzt + logisticsCnKzt + logisticsKrKzt + svhKzt + brokerKzt + feesKzt + pnrKzt + deliveryLocalKzt;

        const vatRate = Number(profile.vatRate) || 0;
        const bonusRate = Number(profile.salesBonusRate) || 0;
        const citRate = Number(profile.citRate) || 0;
        const targetMargin = Number(marginOverridePercent ?? profile.targetNetMarginPercent) || 0;

        const vatEff = vatRate / (100 + vatRate);
        const bonusEff = bonusRate / 100;
        const citEff = citRate / 100;
        const targetMarginEff = targetMargin / 100;
        
        const denominator = 1 - vatEff - bonusEff - (citEff > 0 ? (targetMarginEff / (1 - citEff)) : targetMarginEff);
        
        const finalPrice = denominator > 0.05 ? directCosts / denominator : directCosts / 0.5;

        const vatAmount = finalPrice * vatEff;
        const bonusAmount = finalPrice * bonusEff;
        const taxableProfit = (finalPrice - directCosts - vatAmount - bonusAmount) / (1 + citEff);
        const citAmount = taxableProfit * citEff;
        const netProfitAmount = taxableProfit - citAmount;
        
        const totalExpenses = finalPrice - netProfitAmount;
        const landedCostKzt = purchaseKzt + logisticsCnKzt + logisticsKrKzt + svhKzt + brokerKzt + feesKzt;

        const res = {
            finalPrice, purchaseKzt,
            logisticsCn: logisticsCnKzt,
            logisticsLocal: logisticsKrKzt,
            svh: svhKzt,
            brokerFees: brokerKzt,
            customsFees: feesKzt,
            customs: brokerKzt + feesKzt,
            pnr: pnrKzt,
            deliveryLocal: deliveryLocalKzt,
            vat: vatAmount,
            cit: citAmount,
            taxes: vatAmount + citAmount,
            bonus: bonusAmount,
            landedCost: landedCostKzt,
            totalExpenses: totalExpenses,
            netProfit: netProfitAmount
        };

        // Round all values and ensure no NaNs
        Object.keys(res).forEach(k => {
            const key = k as keyof typeof res;
            res[key] = Math.round(isNaN(res[key]) ? 0 : res[key]);
        });

        return res;
    }

    static async recalculateAndSaveAllPrices(
        products: Product[],
        profiles: PricingProfile[],
        rates: Record<Currency, number>
    ) {
        const updates = products.map(p => {
            if (!p) return null;
            const profile = this.findProfile(p, profiles);
            const pricing = this.calculateSmartPrice(p, profile, rates);
            return {
                id: p.id,
                salesPrice: pricing.finalPrice
            };
        }).filter((u): u is {id: string, salesPrice: number} => !!u);

        for (const up of updates) {
            await ApiService.update('products', up.id, { salesPrice: up.salesPrice });
        }
    }
}
