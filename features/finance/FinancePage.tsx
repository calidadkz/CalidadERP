
import React, { useState } from 'react';
import { PlannedPayment } from '@/types';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useStore } from '../system/context/GlobalStore';
import { PaymentsCalendar } from './tabs/PaymentsCalendar';
import { BankStatements } from './tabs/BankStatements';
import { TreasuryAccounts } from './tabs/TreasuryAccounts';
import { PaymentModal } from './components/PaymentModal';
import { ManualPlanModal } from './components/ManualPlanModal';
import { useFinanceModals } from './hooks/useFinanceModals';

interface FinancePageProps {
    initialView?: 'plan' | 'fact' | 'treasury';
}

export const FinancePage: React.FC<FinancePageProps> = ({ initialView = 'plan' }) => {
    const { state, actions } = useStore();
    const { bankAccounts, clients, suppliers } = state;
    const [view, setView] = useState<'plan' | 'fact' | 'treasury'>(initialView);
    const [directionFilter, setDirectionFilter] = useState<'All' | 'Outgoing' | 'Incoming'>('All');
  
    const {
        paymentModal,
        openPaymentModal,
        closePaymentModal,
        manualPlanModal,
        openManualPlanModal,
        closeManualPlanModal
    } = useFinanceModals();

    return (
        <div className="space-y-6 relative">
            {/* Top Navigation */}
            <div className="flex justify-between items-center">
                <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit shadow-inner">
                    <button onClick={() => setView('plan')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'plan' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300/50'}`}>Календарь платежей</button>
                    <button onClick={() => setView('fact')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'fact' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300/50'}`}>Выписки (IP)</button>
                    <button onClick={() => setView('treasury')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'treasury' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300/50'}`}>Наши счета</button>
                </div>
                
                {view !== 'treasury' && (
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setDirectionFilter('All')} className={`px-3 py-1 text-xs rounded transition-all ${directionFilter === 'All' ? 'bg-white shadow font-bold' : 'text-gray-500'}`}>Все</button>
                        <button onClick={() => setDirectionFilter('Outgoing')} className={`flex items-center px-3 py-1 text-xs rounded transition-all ${directionFilter === 'Outgoing' ? 'bg-white shadow text-red-600 font-bold' : 'text-gray-500'}`}><ArrowUpRight size={14} className="mr-1"/> Исходящие</button>
                        <button onClick={() => setDirectionFilter('Incoming')} className={`flex items-center px-3 py-1 text-xs rounded transition-all ${directionFilter === 'Incoming' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-500'}`}><ArrowDownLeft size={14} className="mr-1"/> Входящие</button>
                    </div>
                )}
            </div>

            {/* Dynamic View Rendering */}
            <div className="animate-in fade-in duration-300">
                {view === 'plan' && (
                    <PaymentsCalendar 
                        directionFilter={directionFilter} 
                        onOpenPaymentModal={openPaymentModal}
                        onOpenManualPlanModal={openManualPlanModal}
                    />
                )}

                {view === 'fact' && (
                    <BankStatements 
                        directionFilter={directionFilter} 
                        onOpenPaymentModal={openPaymentModal}
                    />
                )}

                {view === 'treasury' && (
                    <TreasuryAccounts />
                )}
            </div>

            {/* Modals */}
            {paymentModal.isOpen && (
                <PaymentModal 
                    direction={paymentModal.direction}
                    plan={paymentModal.plan}
                    bankAccounts={bankAccounts}
                    clients={clients}
                    suppliers={suppliers}
                    onClose={closePaymentModal}
                    onSubmit={(p) => { 
                        actions.executePayment(p); 
                        closePaymentModal(); 
                    }}
                />
            )}

            {manualPlanModal && (
                <ManualPlanModal 
                    onClose={closeManualPlanModal}
                    onSubmit={async (p) => { 
                        await actions.addPlannedPayment(p); 
                        closeManualPlanModal(); 
                    }}
                />
            )}
        </div>
    );
};
