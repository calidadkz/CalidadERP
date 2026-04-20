
import React, { useState, Suspense, useMemo } from 'react';
import { useStore } from '../system/context/GlobalStore';
import { useAuth } from '../system/context/AuthContext';
import { SalesOrder, PlannedPayment, AppRole } from '@/types';
import { ShoppingCart, Plus } from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';
import { SalesOrdersList } from './components/SalesOrdersList';
import { SalesOrderForm } from './components/SalesOrderForm';
import { useIsMobile } from '@/hooks/useIsMobile';

const MobileSalesView = React.lazy(() =>
    import('./components/MobileSalesView').then(m => ({ default: m.MobileSalesView }))
);

export const SalesPage: React.FC = () => {
    const isMobile = useIsMobile();
    if (isMobile) return <Suspense fallback={null}><MobileSalesView /></Suspense>;

    const { state, actions } = useStore();
    const { user } = useAuth();
    const access = useAccess('sales');

    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);

    const canCreate = access.canWrite('actions', 'create');
    const canSeeResponsible = access.canSee('fields', 'col_responsible');

    // Менеджер видит только свои заказы (если привязан к сотруднику)
    const visibleOrders = useMemo(() => {
        if (user?.role === AppRole.MANAGER && user.employeeId) {
            return state.salesOrders.filter(o => o.responsibleEmployeeId === user.employeeId);
        }
        return state.salesOrders;
    }, [state.salesOrders, user]);

    const handleEditOrder = (order: SalesOrder) => {
        setEditingOrder(order);
        setView('form');
    };

    const handleCreateNew = () => {
        setEditingOrder(null);
        setView('form');
    };

    const handleSubmit = (order: SalesOrder, plans: PlannedPayment[]) => {
        if (editingOrder) {
            actions.updateSalesOrder(order, plans);
        } else {
            actions.createSalesOrder(order, plans);
        }
        setView('list');
    };

    const handleDeleteOrder = (order: SalesOrder) => {
        if (confirm(`Вы уверены, что хотите переместить заказ клиента "${order.name || order.id}" в корзину? Все связанные ПП также будут помечены на удаление.`)) {
            actions.deleteSalesOrder(order.id);
        }
    };

    const editingPayments = editingOrder 
        ? state.plannedPayments.filter(p => p.sourceDocId === editingOrder.id)
        : [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <ShoppingCart className="mr-3 text-blue-600" size={28} /> Заказы клиентов (ЗK)
                </h2>
                {view === 'list' && canCreate && (
                    <button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center shadow-lg font-bold transition-all">
                        <Plus size={20} className="mr-2"/> Новый заказ
                    </button>
                )}
            </div>

            {view === 'list' ? (
                <SalesOrdersList
                    salesOrders={visibleOrders}
                    plannedPayments={state.plannedPayments}
                    showColClient={access.canSee('fields', 'col_client')}
                    showColAmount={access.canSee('fields', 'col_amount')}
                    showColPayment={access.canSee('fields', 'col_payment')}
                    showColShipment={access.canSee('fields', 'col_shipment')}
                    showColResponsible={canSeeResponsible}
                    canEdit={access.canSee('actions', 'edit')}
                    canDelete={access.canWrite('actions', 'delete')}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteOrder}
                />
            ) : (
                <SalesOrderForm 
                    initialOrder={editingOrder} 
                    initialPayments={editingPayments}
                    state={state}
                    actions={actions}
                    access={access}
                    onCancel={() => setView('list')}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
};
