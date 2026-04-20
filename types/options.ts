import { Currency } from './currency';

export interface OptionTypeCategoryOverride {
    isRequired?: boolean;
    isSingleSelect?: boolean;
}

export interface OptionType {
    id: string;
    name: string;
    isRequired: boolean;
    isSingleSelect: boolean;
    categoryId?: string;
    supplierId?: string;
    manufacturer?: string;
    categoryOverrides?: Record<string, OptionTypeCategoryOverride>;
    variants?: OptionVariant[];
}

export interface OptionVariant {
    id: string;
    typeId: string;
    name: string;
    supplierProductName?: string;
    description?: string;
    price: number;
    currency: Currency;
    categoryId?: string; 
    supplierId?: string; 
    manufacturer?: string;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    volumeM3?: number;
    composition?: { productId: string; quantity: number }[];
    imageUrl?: string;
}
