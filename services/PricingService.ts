
import { PricingProfile, Product, Currency, ProductType, OptionVariant } from '../types';
import { ApiService } from './api';

export class PricingService {
    /**
     * Пытается найти подходящий профиль для товара.
     */
    static findProfile(product: Product, profiles: PricingProfile[]): PricingProfile | null {
        if (!product || (product.type !== ProductType.MACHINE && product.type !== ProductType.PART)) return null;

        if (product.pricingProfileId) {
            const match = (profiles || []).find(p => p.id === product.pricingProfileId);
            if (match) return match;
        }

        return (profiles || []).find(p => {
            const matchSupplier = !p.supplierId || p.supplierId === product.supplierId;
            const matchCategory = !p.applicableCategoryIds?.length || p.applicableCategoryIds.includes(product.categoryId || '');
            return matchSupplier && matchCategory;
        }) || null;
    }

    /**
     * Рассчитывает общую закупочную стоимость конфигурации.
     */
    static calculateBundlePurchasePrice(
        machine: Product,
        selectedVariantIds: string[],
        allVariants: OptionVariant[],
        exchangeRates: Record<Currency, number>
    ): number {
        let totalPurchaseInMachineCurrency = Number(machine.basePrice) || 0;
        const machineRate = exchangeRates[machine.currency] || 1;

        if (!machine.machineConfig || machine.machineConfig.length === 0) {
            return totalPurchaseInMachineCurrency;
        }

        machine.machineConfig.forEach(group => {
            const defaultIds = [
                group.defaultVariantId,
                ...(group.defaultVariantIds || [])
            ].filter((id): id is string => !!id);
            
            const selectedInGroup = selectedVariantIds.filter(vid => {
                const v = allVariants.find(av => av.id === vid);
                return v && v.typeId === group.typeId;
            });

            let baselinePriceInMachineCurrency = 0;
            
            defaultIds.forEach(defId => {
                const defV = allVariants.find(v => v.id === defId);
                if (defV) {
                    const price = group.priceOverrides[defId] ?? defV.price;
                    const defRate = exchangeRates[defV.currency] || 1;
                    baselinePriceInMachineCurrency += (Number(price) || 0) * (defRate / machineRate);
                }
            });

            if (selectedInGroup.length > 0) {
                selectedInGroup.forEach((vid, index) => {
                    const v = allVariants.find(av => av.id === vid);
                    if (!v) return;

                    const price = group.priceOverrides[vid] ?? v.price;
                    const vRate = exchangeRates[v.currency] || 1;
                    const currentPriceInMachineCurrency = (Number(price) || 0) * (vRate / machineRate);

                    if (index === 0 && defaultIds.length > 0) {
                        totalPurchaseInMachineCurrency += (currentPriceInMachineCurrency - baselinePriceInMachineCurrency);
                    } else {
                        totalPurchaseInMachineCurrency += currentPriceInMachineCurrency;
                    }
                });
            } else if (defaultIds.length > 0) {
                totalPurchaseInMachineCurrency -= baselinePriceInMachineCurrency;
            }
        });

        return isNaN(totalPurchaseInMachineCurrency) ? 0 : totalPurchaseInMachineCurrency;
    }

    /**
     * Рассчитывает финальную цену продажи.
     */
    static calculateSmartPrice(
        product: Product,
        profile: PricingProfile | null,
        exchangeRates: Record<Currency, number>,
        configVolumeM3?: number,
        configPurchaseForeign?: number,
        marginOverridePercent?: number
    ) {
        const productRate = exchangeRates[product.currency as Currency] || 1;
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

        const usdRate = exchangeRates[Currency.USD] || 1;
        const productVolume = product.packages?.reduce((sum, p) => sum + (Number(p.volumeM3) || 0), 0) || 0;
        const volume = configVolumeM3 ?? productVolume;
        
        const batchVolume = Number(profile.batchVolumeM3) || 0;

        const logisticsCnKzt = (Number(profile.logisticsRateUSD) || 0) * volume * usdRate;
        const volumeRatio = batchVolume > 0 ? (volume / batchVolume) : 0;
        
        const logisticsKrKzt = volumeRatio * (Number(profile.batchShippingCostKZT) || 0);
        const svhKzt = volumeRatio * (Number(profile.batchSvhCostKZT) || 0);
        const brokerKzt = volumeRatio * (Number(profile.brokerCostKZT) || 0);
        const feesKzt = volumeRatio * (Number(profile.customsFeesKZT) || 0);
        
        const pnrKzt = Number(profile.pnrCostKZT) || 0;
        const deliveryLocalKzt = Number(profile.deliveryKZT) || 0;
        
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
            const profile = this.findProfile(p, profiles);
            const pricing = this.calculateSmartPrice(p, profile, rates);
            return {
                id: p.id,
                salesPrice: pricing.finalPrice
            };
        });

        for (const up of updates) {
            await ApiService.update('products', up.id, { salesPrice: up.salesPrice });
        }
    }
}
