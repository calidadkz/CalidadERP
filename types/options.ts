import { Currency } from './currency';

export interface OptionType {
    id: string;
    name: string;
    isRequired: boolean;
    isSingleSelect: boolean;
    categoryId?: string; 
    supplierId?: string; 
    manufacturer?: string; 
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
}
