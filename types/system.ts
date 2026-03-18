export type TrashItemType = 'Product' | 'Counterparty' | 'Category' | 'Order' | 'SalesOrder' | 'User' | 'CashFlowItem' | 'HSCode' | 'OptionType' | 'OptionVariant' | 'Bundle' | 'Manufacturer' | 'OurCompany' | 'Employee' | 'Other';

export interface TrashItem {
    id: string;
    originalId: string;
    deletedAt: string;
    type: TrashItemType;
    name: string;
    data: any;
}

export type ActionType = 'Create' | 'Update' | 'Delete' | 'Post' | 'Transaction' | 'Export' | 'Import' | 'Login' | 'Logout';

export interface LogEntry {
    id: string;
    timestamp: string;
    user: string;
    action: ActionType;
    entity: string;
    entityId: string;
    details: string;
    documentType?: string;
    documentId?: string;
    description?: string;
}

// Alias for compatibility
export type LogItem = LogEntry;
