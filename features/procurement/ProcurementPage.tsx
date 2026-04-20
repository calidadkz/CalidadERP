
import React, { useState, useEffect, Suspense } from 'react';

const MobileProcurementView = React.lazy(() =>
    import('./components/MobileProcurementView').then(m => ({ default: m.MobileProcurementView }))
);
import { useStore } from '@/features/system/context/GlobalStore';
import { SupplierOrder, PlannedPayment, ProductType, Batch } from '@/types';
import { ShoppingCart, Plus, AlertCircle } from 'lucide-react';
import { OrdersList } from './components/OrdersList';
import { OrderForm } from './components/OrderForm';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { useIsMobile } from '@/hooks/useIsMobile';

export const ProcurementPage: React.FC = () => {
    const isMobile = useIsMobile();
    if (isMobile) return <Suspense fallback={null}><MobileProcurementView /></Suspense>;

    const { state, actions } = useStore();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [batches, setBatches] = useState<Batch[]>([]);

    useEffect(() => {
        api.fetchAll<Batch>(TableNames.BATCHES).then(setBatches).catch(() => {});
    }, []);
    const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
    const [supplierFilter, setSupplierFilter] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleEditOrder = (order: SupplierOrder) => {
        setEditingOrder(order);
        setView('form');
    };

    const handleCreateNew = () => {
        setEditingOrder(null);
        setView('form');
    };

    const handleSubmit = (order: SupplierOrder, plans: PlannedPayment[]) => {
        if (editingOrder) {
            actions.updateOrder(order, plans);
        } else {
            actions.createOrder(order, plans);
        }
        setView('list');
    };

    const handleDeleteOrder = (order: SupplierOrder) => {
        if (confirm(`Вы уверены, что хотите переместить заказ "${order.name || order.id}" в корзину? Все связанные ПП также будут помечены на удаление.`)) {
            actions.deleteOrder(order.id);
        }
    };

    const editingPayments = editingOrder 
        ? state.plannedPayments.filter(p => p.sourceDocId === editingOrder.id)
        : [];

    return (
        <div className="space-y-6">
            {errorMsg && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center border-4 border-red-500/20">
                        <AlertCircle size={48} className="text-red-600 mx-auto mb-4"/>
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">Ошибка</h3>
                        <p className="text-slate-600 font-medium mb-6">{errorMsg}</p>
                        <button onClick={() => setErrorMsg(null)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase">ОК</button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <ShoppingCart className="mr-3 text-blue-600" size={28} /> Заказы поставщикам
                </h2>
                {view === 'list' && (
                    <button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center shadow-lg font-bold transition-all">
                        <Plus size={20} className="mr-2"/> Новый заказ (ЗП)
                    </button>
                )}
            </div>

            {view === 'list' ? (
                <OrdersList
                    orders={state.orders}
                    suppliers={state.suppliers}
                    supplierFilter={supplierFilter}
                    setSupplierFilter={setSupplierFilter}
                    plannedPayments={state.plannedPayments}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteOrder}
                    batches={batches}
                />
            ) : (
                <OrderForm 
                    initialOrder={editingOrder} 
                    initialPayments={editingPayments}
                    state={state}
                    actions={actions}
                    onCancel={() => setView('list')}
                    onSubmit={handleSubmit}
                    onError={setErrorMsg}
                />
            )}
        </div>
    );
};
