export enum CounterpartyType {
    CLIENT = 'Client',
    SUPPLIER = 'Supplier',
    EMPLOYEE = 'Employee',
    OUR_COMPANY = 'OurCompany',
    MANUFACTURER = 'Manufacturer',
}

export interface Counterparty {
    id: string;
    type: CounterpartyType; // Оставляем для совместимости (первая роль)
    roles?: CounterpartyType[]; // Новое поле для множественных ролей
    name: string;
    // Contacts
    contactPerson?: string;
    phone?: string;
    legalEmail?: string;
    // Legal & Requisites
    legalAddress?: string;
    binIin?: string;
    director?: string;
    country?: string; 
    // Bank Details
    iik?: string;
    bik?: string;
    kbe?: string;
    bankName?: string;
    // Other
    description?: string;
    isPaymentIntermediary?: boolean; // Kaspi Bank, маркетплейсы и т.д.
}

export type Supplier = Counterparty;
export type Client = Counterparty;
export type OurCompany = Counterparty;
export type Employee = Counterparty;
export type Manufacturer = Counterparty;
