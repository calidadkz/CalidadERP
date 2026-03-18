
export interface TaxSettings {
    id: string; // Singleton ID, e.g., 'default'
    intercompanyMarkupPercent: number;
    citRateStandard: number;
    citRateSimplified: number;
}
