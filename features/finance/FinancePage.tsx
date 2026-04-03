
import React, { lazy, Suspense } from 'react';
import { ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../system/context/GlobalStore';
import { useFinanceModals } from './hooks/useFinanceModals';

// Lazy-loaded Tabs
const PaymentsCalendar = lazy(() => import('./tabs/PaymentsCalendar').then(m => ({ default: m.PaymentsCalendar })));
const BankStatements = lazy(() => import('./tabs/BankStatements').then(m => ({ default: m.BankStatements })));
const TreasuryAccounts = lazy(() => import('./tabs/TreasuryAccounts').then(m => ({ default: m.TreasuryAccounts })));

// Lazy-loaded Modals
const PaymentModal = lazy(() => import('./components/PaymentModal').then(m => ({ default: m.PaymentModal })));
const ManualPlanModal = lazy(() => import('./components/ManualPlanModal').then(m => ({ default: m.ManualPlanModal })));

interface FinancePageProps {
    view: 'plan' | 'fact' | 'treasury';
}

const TabLoader = () => (
    <div className="flex flex-col items-center justify-center p-24 bg-white/30 rounded-3xl border border-dashed border-slate-200 animate-in fade-in duration-500">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32}/>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Загрузка данных...</p>
    </div>
);

export const FinancePage: React.FC<FinancePageProps> = ({ view }) => {
    const { state, actions } = useStore();
    const navigate = useNavigate();
    const { bankAccounts, clients, suppliers } = state;
    const [directionFilter, setDirectionFilter] = React.useState<'All' | 'Outgoing' | 'Incoming'>('All');
  
    const {
        paymentModal,
        openPaymentModal,
        closePaymentModal,
        manualPlanModal,
        openManualPlanModal,
        closeManualPlanModal
    } = useFinanceModals();

    const handleViewChange = (newView: 'plan' | 'fact' | 'treasury') => {
        const routes = {
            plan: '/finance_calendar',
            fact: '/finance_statements',
            treasury: '/finance_accounts'
        };
        navigate(routes[newView]);
    };

    return (
        <div className="space-y-6 relative">
            {/* Top Navigation */}
            <div className="flex justify-between items-center">
                <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit shadow-inner">
                    <button 
                        onClick={() => handleViewChange('plan')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'plan' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300/50'}`}
                    >
                        Календарь платежей
                    </button>
                    <button 
                        onClick={() => handleViewChange('fact')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'fact' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300/50'}`}
                    >
                        Выписки (IP)
                    </button>
                    <button 
                        onClick={() => handleViewChange('treasury')} 
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${view === 'treasury' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300/50'}`}
                    >
                        Наши счета
                    </button>
                </div>
                
                {view !== 'treasury' && (
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setDirectionFilter('All')} className={`px-3 py-1 text-xs rounded transition-all ${directionFilter === 'All' ? 'bg-white shadow font-bold' : 'text-gray-500'}`}>Все</button>
                        <button onClick={() => setDirectionFilter('Outgoing')} className={`flex items-center px-3 py-1 text-xs rounded transition-all ${directionFilter === 'Outgoing' ? 'bg-white shadow text-red-600 font-bold' : 'text-gray-500'}`}><ArrowUpRight size={14} className="mr-1"/> Исходящие</button>
                        <button onClick={() => setDirectionFilter('Incoming')} className={`flex items-center px-3 py-1 text-xs rounded transition-all ${directionFilter === 'Incoming' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-500'}`}><ArrowDownLeft size={14} className="mr-1"/> Входящие</button>
                    </div>
                )}
            </div>

            {/* Dynamic View Rendering with Suspense */}
            <div className="animate-in fade-in duration-300">
                <Suspense fallback={<TabLoader />}>
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
                </Suspense>
            </div>

            {/* Modals with Suspense */}
            <Suspense fallback={null}>
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
            </Suspense>
        </div>
    );
};
