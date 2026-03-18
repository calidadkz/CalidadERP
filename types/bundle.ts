export interface Bundle {
    id: string;
    name: string;
    baseProductId: string;
    baseProductName: string;
    selectedVariantIds: string[];
    totalPurchasePrice: number;
    totalPrice: number;
    isTemplate: boolean;
    description?: string;
}
