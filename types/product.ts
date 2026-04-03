import { Currency } from './currency';
import { PricingMethod, ProductType } from './enums';

export interface ProductPackage {
    id: string;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    weightKg: number;
    volumeM3: number;
    description?: string;
}

export interface MachineConfigEntry {
    typeId: string;
    allowedVariantIds: string[];
    priceOverrides: Record<string, number>;
    defaultVariantId?: string;
    defaultVariantIds?: string[];
}

export interface Product {
    id: string;
    sku: string;
    supplierProductName?: string; 
    name: string;
    type: ProductType;
    categoryId?: string;
    supplierId?: string;
    manufacturer?: string; 
    hsCodeId?: string; 
    basePrice: number;
    currency: Currency;
    markupPercentage: number;
    pricingMethod?: PricingMethod; 
    salesPrice?: number;
    packages?: ProductPackage[]; 
    workingLengthMm?: number;
    workingWidthMm?: number;
    workingHeightMm?: number;
    workingVolumeM3?: number;
    workingWeightKg?: number;
    stock: number;
    reserved: number;
    incoming: number;
    minStock: number;
    description?: string;
    pricingProfileId?: string;
    machineConfig?: MachineConfigEntry[];
    internalComposition?: {
        productId: string;
        quantity: number;
    }[];
    compatibleMachineCategoryIds?: string[];
    volumeM3?: number;
    imageUrl?: string; // URL or path to image in storage
}

export interface ProductCategory {
    id: string;
    name: string;
    type: ProductType;
}

export interface PricingProfile {
    id: string;
    name: string;
    type: ProductType;
    supplierId: string;
    applicableCategoryIds: string[];
    logisticsRateUsd: number;
    batchVolumeM3: number;
    batchShippingCostKzt: number;
    batchSvhCostKzt: number;
    brokerCostKzt: number;
    customsFeesKzt: number;
    vatRate: number;
    citRate: number;
    salesBonusRate: number;
    pnrCostKzt: number;
    deliveryKzt: number;
    targetNetMarginPercent: number;
}
