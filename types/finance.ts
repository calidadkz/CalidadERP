import { Currency } from "./currency";
import { TransactionType } from "./enums";

export enum CashFlowCategory {
    OPERATING = 'Operating',
    INVESTING = 'Investing',
    FINANCIAL = 'Financial',
}

export interface CounterpartyAccount {
    id: string;
    counterpartyId: string;
    bankName: string;
    iik: string;
    bik: string;
    currency: Currency;
    isDefault: boolean;
}

export interface BankAccount {
    id: string;
    name: string;
    bank: string;
    number: string;
    currency: Currency;
    balance: number;
}

export interface CashFlowItem {
    id: string;
    name: string;
    type: 'Income' | 'Expense';
    category: CashFlowCategory;
}

export interface CurrencyLot {
    id: string;
    date: string;
    currency: Currency;
    amountOriginal: number;
    amountRemaining: number;
    costInKzt: number;
    rate: number;
}

export interface ActualPayment {
    id: string;
    date: string;
    direction: 'Incoming' | 'Outgoing';
    counterpartyId: string;
    counterpartyName: string;
    amount: number;
    currency: Currency;
    bankAccountId: string;
    fromAccount: string;
    exchangeRate: number;
    totalCostKzt?: number;
    allocations: PaymentAllocation[];
    documentNumber?: string;
    knp?: string;
    purpose?: string;
    counterpartyBinIin?: string;
    counterpartyIik?: string;
    counterpartyBik?: string;
    counterpartyBankName?: string;
    isInternalTransfer?: boolean;          // true = исключать из P&L-анализа
    pairedInternalTxId?: string;           // ссылка на InternalTransaction
}

export interface PaymentAllocation {
    id: string;
    actualPaymentId: string;
    plannedPaymentId?: string;
    cashFlowItemId: string;
    batchId?: string;
    amountCovered: number;
    description?: string;
    targetBankAccountId?: string;      // ID нашего счета для внутренних переводов
    existingInternalTxId?: string;     // При привязке второй стороны перевода — ID существующей InternalTransaction
}

export interface PlannedPayment {
    id: string;
    direction: 'Incoming' | 'Outgoing';
    sourceDocId: string;
    sourceDocType: 'Order' | 'SalesOrder' | 'Manual';
    counterpartyId: string;
    counterpartyName: string;
    amountDue: number;
    amountPaid: number;
    currency: Currency;
    dueDate: string;
    isPaid: boolean;
    cashFlowItemId: string;
    cashFlowCategory?: CashFlowCategory;
    isDeleted?: boolean;                    // Пометка на удаление
    paymentCounterpartyId?: string;         // Посредник (Kaspi Bank, маркетплейс) — кто будет в выписке
    paymentCounterpartyName?: string;       // Денормализованное имя посредника
}

export interface InternalTransaction {
    id: string;
    date: string;
    type: TransactionType;
    fromAccountId: string;
    toAccountId: string;
    amountSent: number;
    amountReceived: number;
    fee: number;
    rate: number;
    actualPaymentOutId?: string;           // actual_payment для исходящей стороны выписки
    actualPaymentInId?: string;            // actual_payment для входящей стороны выписки
    isFullyReconciled?: boolean;           // true когда обе стороны выписки обработаны
}
