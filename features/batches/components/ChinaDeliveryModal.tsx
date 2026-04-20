import React from 'react';
import { X } from 'lucide-react';
import { BatchExpense } from '@/types/batch';
import { PreCalculationItem } from '@/types/pre-calculations';
import { ActualPayment, PlannedPayment } from '@/types';
import { CashFlowItem } from '@/types/finance';
import { ChinaDeliveryForm } from './ChinaDeliveryForm';

const fmtKzt = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface ChinaDeliveryModalProps {
    items: PreCalculationItem[];
    batchId: string;
    chinaExpenses: BatchExpense[];
    actualPayments: ActualPayment[];
    plannedPayments: PlannedPayment[];
    cashFlowItems: CashFlowItem[];
    onAdd: (expense: Omit<BatchExpense, 'id' | 'batchId'>) => Promise<any>;
    onDelete?: (id: string) => Promise<any>;
    onOpenPayment?: (paymentId: string) => void;
    onClose: () => void;
}

export const ChinaDeliveryModal: React.FC<ChinaDeliveryModalProps> = ({
    items, batchId, chinaExpenses,
    actualPayments, plannedPayments, cashFlowItems,
    onAdd, onDelete, onOpenPayment, onClose,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Шапка */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 flex-none">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Доставка по Китаю</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                            {chinaExpenses.length > 0
                                ? `${chinaExpenses.length} запис${chinaExpenses.length === 1 ? 'ь' : 'ей'} · итого ${fmtKzt(chinaExpenses.reduce((s, e) => s + e.amountKzt, 0))} ₸`
                                : 'Нет записей'}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Тело — двухколоночный лэйаут внутри ChinaDeliveryForm */}
                <div className="flex-1 min-h-0 flex overflow-hidden">
                    <ChinaDeliveryForm
                        items={items}
                        batchId={batchId}
                        actualPayments={actualPayments}
                        plannedPayments={plannedPayments}
                        cashFlowItems={cashFlowItems}
                        chinaExpenses={chinaExpenses}
                        onSave={onAdd}
                        onDelete={onDelete}
                        onOpenPayment={onOpenPayment}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
};
