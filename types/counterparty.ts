export enum CounterpartyType {
    CLIENT = 'Client',
    SUPPLIER = 'Supplier',
    EMPLOYEE = 'Employee',
    OUR_COMPANY = 'OurCompany',
    MANUFACTURER = 'Manufacturer',
}

export interface Counterparty {
    id: string;
    type: CounterpartyType;
    name: string;
    legalAddress?: string;
    binIin?: string;
    director?: string;
    legalEmail?: string;
    contactPerson?: string;
    phone?: string;
    country?: string; 
    description?: string;
}

export interface Supplier {
    id: string;
    name: string;
    country: string;
    legalAddress?: string;
    binIin?: string;
    iik?: string;
    bik?: string;
    kbe?: string;
    bankName?: string;
    director?: string;
    legalEmail?: string;
}

export interface Client {
    id: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    legalAddress?: string;
    binIin?: string;
    iik?: string;
    bik?: string;
    kbe?: string;
    bankName?: string;
    director?: string;
    legalEmail?: string;
}

export interface OurCompany {
    id: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    legalAddress?: string;
    binIin?: string;
    iik?: string;
    bik?: string;
    kbe?: string;
    bankName?: string;
    director?: string;
    legalEmail?: string;
}

export interface Employee {
    id: string;
    name: string;
    contactPerson?: string; 
    phone?: string;
    legalAddress?: string; 
    binIin?: string; 
    iik?: string;
    bik?: string;
    kbe?: string;
    bankName?: string;
    director?: string; 
    legalEmail?: string;
}

export interface Manufacturer {
    id: string;
    name: string;
    country: string;
    description?: string;
    legalAddress?: string;
    binIin?: string;
    iik?: string;
    bik?: string;
    kbe?: string;
    bankName?: string;
    director?: string;
    legalEmail?: string;
}
