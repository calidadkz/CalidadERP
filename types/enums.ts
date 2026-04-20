export enum ProductType {
    MACHINE = 'Станок',
    PART = 'Запчасть',
    SERVICE = 'Услуга'
}

export enum PricingMethod {
    MARKUP_WITHOUT_VAT = 'Наценка (без НДС)',
    MARKUP_WITH_VAT = 'Наценка (с НДС)',
    PROFILE = 'Ценовой профиль'
}

export enum OrderStatus {
    CONFIRMED = 'Подтвержден',
    PARTIALLY_RECEIVED = 'Частично получен',
    CLOSED = 'Закрыт',
    CANCELLED = 'Отменен'
}

export type MovementStatus = 'Physical' | 'Incoming' | 'Reserved';

export enum ExpenseAllocationMethod {
    BY_VOLUME = 'По объему',
    BY_VALUE = 'По стоимости',
    BY_QUANTITY = 'По количеству',
    BY_EQUAL = 'Поровну',
    SPECIFIC_ITEM = 'На позицию'
}

export enum DiscrepancyResolution {
    WRITE_OFF = 'Списать',
    REPAIR = 'Ремонт',
    NEXT_SHIPMENT = 'Дослать позже'
}

export type TransactionType = 'Transfer' | 'Exchange';

export enum TaxRegime {
    STANDARD = 'Общеустановленный',
    SIMPLIFIED = 'Упрощенка'
}
