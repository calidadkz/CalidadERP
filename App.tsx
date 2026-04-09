
import React, { lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { StoreProvider } from './features/system/context/GlobalStore';
import { Layout } from './components/system/Layout';
import { AuthProvider, useAuth } from './features/system/context/AuthContext';
import { LoginPage } from './features/auth/components/LoginPage';
import { PermissionsService } from './services/PermissionsService';
import { ShieldAlert, ArrowLeft, RefreshCw, LogOut, AlertTriangle, Loader2 } from 'lucide-react';

// Lazy-loaded Pages
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage').then(module => ({ default: module.InventoryPage })));
const NomenclaturePage = lazy(() => import('./features/nomenclature/NomenclaturePage').then(module => ({ default: module.NomenclaturePage })));
const FinancePage = lazy(() => import('./features/finance/FinancePage').then(module => ({ default: module.FinancePage })));
const FinanceCategoriesPage = lazy(() => import('./features/finance/FinanceCategoriesPage').then(module => ({ default: module.FinanceCategoriesPage })));
const ProcurementPage = lazy(() => import('./features/procurement/ProcurementPage').then(module => ({ default: module.ProcurementPage })));
const SalesPage = lazy(() => import('./features/sales/SalesPage').then(module => ({ default: module.SalesPage })));
const ReceivingPage = lazy(() => import('./features/receiving/ReceivingPage').then(module => ({ default: module.ReceivingPage })));
const ShipmentPage = lazy(() => import('./features/shipment/ShipmentPage').then(module => ({ default: module.ShipmentPage })));
const BundlesPage = lazy(() => import('./features/bundles/BundlesPage').then(module => ({ default: module.BundlesPage })));
const PreCalculationsRouter = lazy(() => import('./features/pre-calculations/PreCalculationsRouter').then(module => ({ default: module.PreCalculationsRouter })));
const BatchesPage = lazy(() => import('./features/batches/BatchesPage').then(module => ({ default: module.BatchesPage })));
const BatchDetailPage = lazy(() => import('./features/batches/BatchDetailPage').then(module => ({ default: module.BatchDetailPage })));
const HSCodesPage = lazy(() => import('./features/products/pages/HSCodesPage').then(module => ({ default: module.HSCodesPage })));
const CurrencyRatesPage = lazy(() => import('./features/finance/pages/CurrencyRatesPage').then(module => ({ default: module.CurrencyRatesPage })));
const CounterpartyManagerPage = lazy(() => import('./features/counterparties/pages/CounterpartyManagerPage').then(module => ({ default: module.CounterpartyManagerPage })));
const CategoriesPage = lazy(() => import('./features/products/pages/CategoriesPage').then(module => ({ default: module.CategoriesPage })));
const DiscrepancyPage = lazy(() => import('./features/warehouse/pages/DiscrepancyPage').then(module => ({ default: module.DiscrepancyPage })));
const WriteOffPage = lazy(() => import('./features/warehouse/pages/WriteOffPage').then(module => ({ default: module.WriteOffPage })));
const HistoryPage = lazy(() => import('./features/history/pages/HistoryPage').then(module => ({ default: module.HistoryPage })));
const RecycleBinPage = lazy(() => import('./features/system/pages/RecycleBinPage').then(module => ({ default: module.RecycleBinPage })));
const PricingManagerPage = lazy(() => import('./features/products/pages/PricingManagerPage').then(module => ({ default: module.PricingManagerPage })));
const PermissionsManager = lazy(() => import('./components/system/PermissionsManager').then(module => ({ default: module.PermissionsManager })));

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

const ModuleLoader = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white/50 animate-in fade-in duration-500">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32}/>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Загрузка модуля...</p>
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
                <Suspense fallback={<ModuleLoader />}>
                    <Routes>
                        <Route path="/inventory/*" element={<InventoryPage />} />
                        <Route path="/nomenclature" element={<NomenclaturePage />} />
                        <Route path="/hscodes" element={<HSCodesPage />} />
                        <Route path="/bundles" element={<BundlesPage />} />
                        <Route path="/options" element={<BundlesPage />} />
                        <Route path="/categories" element={<CategoriesPage />} />
                        <Route path="/pre-calculations/*" element={<PreCalculationsRouter />} />
                        <Route path="/batches" element={<BatchesPage />} />
                        <Route path="/batches/:id" element={<BatchDetailPage />} />
                        <Route path="/procurement" element={<ProcurementPage />} />
                        <Route path="/receiving" element={<ReceivingPage />} />
                        <Route path="/sales" element={<SalesPage />} />
                        <Route path="/shipment" element={<ShipmentPage />} />
                        <Route path="/discrepancy" element={<WriteOffPage />} />
                        <Route path="/finance_calendar" element={<FinancePage view="plan" />} />
                        <Route path="/finance_statements" element={<FinancePage view="fact" />} />
                        <Route path="/finance_accounts" element={<FinancePage view="treasury" />} />
                        <Route path="/finance_categories" element={<FinanceCategoriesPage />} />
                        <Route path="/rates" element={<CurrencyRatesPage />} />
                        <Route path="/counterparties" element={<CounterpartyManagerPage />} />
                        <Route path="/pricing" element={<PricingManagerPage />} />
                        <Route path="/permissions" element={<PermissionsManager />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/recycle_bin" element={<RecycleBinPage />} />
                        <Route path="*" element={<Navigate to="/inventory" replace />} />
                    </Routes>
                </Suspense>
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
