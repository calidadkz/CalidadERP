import { PreCalculationDocument } from "./pre-calculations";

export type BatchStatus = 'active' | 'completed' | 'closed';
export type ExpenseCategory = 'logistics_china' | 'logistics_local' | 'customs' | 'broker' | 'svh' | 'other' | 'revenue';

export interface Batch {
  id: string;
  preCalculationId: string;
  name: string;
  status: BatchStatus;
  date: string;
  updatedAt: string;
  totalPlannedProfit?: number;
  totalActualProfit?: number;
}

export interface BatchItemActuals {
  id: string;
  batchId: string;
  preCalculationItemId: string;
  actualRevenueKzt: number;
  actualPurchaseKzt: number;
}

export interface BatchExpense {
  id: string;
  batchId: string;
  category: ExpenseCategory;
  description: string;
  amountKzt: number;
  date: string;
  paymentId?: string; // Связь с таблицей actual_payments (Выписка)
  plannedPaymentId?: string; // Связь с таблицей planned_payments (Календарь)
  documentIds?: string[]; // Список ID документов из batch_documents
}

export interface BatchDocument {
  id: string;
  batchId: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
}
