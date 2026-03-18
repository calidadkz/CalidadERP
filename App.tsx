import React from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { StoreProvider } from './features/system/context/GlobalStore';
import { Layout } from './components/system/Layout';
import { AuthProvider, useAuth } from './features/system/context/AuthContext';
import { LoginPage } from './features/auth/components/LoginPage';
import { PermissionsService } from './services/PermissionsService';
import { ShieldAlert, ArrowLeft, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';

// Pages
import { InventoryPage } from './features/inventory/InventoryPage';
import { NomenclaturePage } from './features/nomenclature/NomenclaturePage';
import { FinancePage } from './features/finance/FinancePage';
import { FinanceCategoriesPage } from './features/finance/FinanceCategoriesPage';
import { ProcurementPage } from './features/procurement/ProcurementPage';
import { SalesPage } from './features/sales/SalesPage';
import { ReceivingPage } from './features/receiving/ReceivingPage';
import { ShipmentPage } from './features/shipment/ShipmentPage';
import { BundlesPage } from './features/bundles/BundlesPage';
import { PreCalculationsPage } from './features/pre-calculations/PreCalculationsPage';
import { HSCodesPage } from './features/products/pages/HSCodesPage';
import { CurrencyRatesPage } from './features/finance/pages/CurrencyRatesPage';
import { CounterpartyManagerPage } from './features/counterparties/pages/CounterpartyManagerPage';
import { CategoriesPage } from './features/products/pages/CategoriesPage';
import { DiscrepancyPage } from './features/warehouse/pages/DiscrepancyPage';
import { HistoryPage } from './features/history/pages/HistoryPage';
import { RecycleBinPage } from './features/system/pages/RecycleBinPage';
import { PricingManagerPage } from './features/products/pages/PricingManagerPage';
import { PermissionsManager } from './components/system/PermissionsManager';

const NoAccessStub = ({ onBack }: { onBack: () => void }) => (
    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-xl shadow-red-100 animate-bounce">
            <ShieldAlert size={48} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">Доступ ограничен</h2>
        <p className="text-slate-500 font-medium max-w-md leading-relaxed mb-8">
            У вашей учетной записи недостаточно прав для просмотра этого раздела. 
            Пожалуйста, свяжитесь с администратором системы для изменения уровня доступа.
        </p>
        <button 
            onClick={onBack}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
        >
            <ArrowLeft size={16}/> Вернуться на главную
        </button>
    </div>
);

const InitErrorScreen = ({ message, onRetry, onSignOut }: { message: string, onRetry: () => void, onSignOut: () => void }) => (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mb-6 border border-amber-500/20">
            <AlertTriangle size={40} />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-3">Ошибка подключения</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-8 leading-relaxed">
            {message}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
                onClick={onRetry}
                className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-50 transition-all active:scale-95 shadow-xl shadow-blue-900/20"
            >
                <RefreshCw size={16}/> Повторить попытку
            </button>
            <button 
                onClick={onSignOut}
                className="flex items-center justify-center gap-2 w-full py-4 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-700 transition-all active:scale-95"
            >
                <LogOut size={16}/> Выйти из системы
            </button>
        </div>
    </div>
);

const AppContent = () => {
    const { session, user, isLoading, isFirstLoad, initError, retryInit, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const loadingScreen = (
        <div className="h-screen bg-slate-950 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-blue-500 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Инициализация CALIDAD ERP...</p>
        </div>
    );

    if (isFirstLoad && isLoading) return loadingScreen;
    if (initError && !session) return <InitErrorScreen message={initError} onRetry={retryInit} onSignOut={signOut} />;
    if (!session) return <LoginPage />;
    if (!user && isLoading) return loadingScreen;

    if (!user && !isLoading) {
        return (
            <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6">
                    <ShieldAlert className="text-red-500" size={32}/>
                </div>
                <h3 className="text-white font-black uppercase tracking-tight mb-2">Профиль не настроен</h3>
                <p className="text-slate-400 text-sm max-w-xs mb-8">Ваша учетная запись существует, но данные профиля отсутствуют в базе ERP.</p>
                <button onClick={signOut} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest">Выйти и войти снова</button>
            </div>
        );
    }

    const activeTab = location.pathname.split('/')[1] || 'inventory';
    const hasAccess = PermissionsService.canSee(user, activeTab, 'tabs', 'main');

    return (
        <Layout activeTab={activeTab} onTabChange={(path) => navigate('/' + path)}>
            {!hasAccess ? (
                <NoAccessStub onBack={() => navigate('/inventory')} />
            ) : (
                <React.Suspense fallback={<div className="p-12 text-center text-slate-400 animate-pulse">Загрузка модуля...</div>}>
                    <Routes>
                        <Route path="/inventory/*" element={<InventoryPage />} />
                        <Route path="/nomenclature" element={<NomenclaturePage />} />
                        <Route path="/hscodes" element={<HSCodesPage />} />
                        <Route path="/bundles" element={<BundlesPage />} />
                        <Route path="/options" element={<BundlesPage />} />
                        <Route path="/categories" element={<CategoriesPage />} />
                        <Route path="/pre-calculations" element={<PreCalculationsPage />} />
                        <Route path="/procurement" element={<ProcurementPage />} />
                        <Route path="/receiving" element={<ReceivingPage />} />
                        <Route path="/sales" element={<SalesPage />} />
                        <Route path="/shipment" element={<ShipmentPage />} />
                        <Route path="/discrepancy" element={<DiscrepancyPage />} />
                        <Route path="/finance_calendar" element={<FinancePage initialView="plan" />} />
                        <Route path="/finance_statements" element={<FinancePage initialView="fact" />} />
                        <Route path="/finance_accounts" element={<FinancePage initialView="treasury" />} />
                        <Route path="/finance_categories" element={<FinanceCategoriesPage />} />
                        <Route path="/rates" element={<CurrencyRatesPage />} />
                        <Route path="/counterparties" element={<CounterpartyManagerPage />} />
                        <Route path="/pricing" element={<PricingManagerPage />} />
                        <Route path="/permissions" element={<PermissionsManager />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/recycle_bin" element={<RecycleBinPage />} />
                        <Route path="*" element={<Navigate to="/inventory" replace />} />
                    </Routes>
                </React.Suspense>
            )}
        </Layout>
    );
};

const App = () => (
    <AuthProvider>
        <StoreProvider>
            <AppContent />
        </StoreProvider>
    </AuthProvider>
);

export default App;
