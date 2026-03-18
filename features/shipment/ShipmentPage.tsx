
import React, { useState } from 'react';
import { Shipment, ShipmentItem, SalesOrder } from '@/types';
import { useStore } from '../system/context/GlobalStore';
import { Truck, RotateCcw, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';
import { useShipmentLogic } from './hooks/useShipmentLogic';
import { PendingShipments } from './components/PendingShipments';
import { ShipmentHistory } from './components/ShipmentHistory';
import { ShipmentForm } from './components/ShipmentForm';
import { ApiService } from '@/services/api';

export const ShipmentPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('shipment');
    const { getSpecificStock, getAlreadyShippedForOrder } = useShipmentLogic(state.products, state.stockMovements, state.shipments, null);

    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [shipItems, setShipItems] = useState<ShipmentItem[]>([]);
    const [shipDate, setShipDate] = useState(new Date().toISOString().split('T')[0]);

    const [stornoConfirmId, setStornoConfirmId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [errorModal, setErrorModal] = useState<{title: string, msg: string} | null>(null);

    const handleOrderSelect = (orderId: string) => {
        const order = state.salesOrders.find(o => o.id === orderId);
        if (order) {
            setSelectedOrderId(orderId);
            const items: ShipmentItem[] = order.items.map(i => {
                const alreadyShipped = getAlreadyShippedForOrder(order.id, i.productId, i.configuration || []);
                return {
                    productId: i.productId, 
                    productName: i.productName, 
                    sku: i.sku,
                    qtyShipped: Math.max(0, i.quantity - alreadyShipped),
                    priceKZT: i.priceKZT || 0,
                    configuration: i.configuration || []
                };
            });
            setShipItems(items.filter(i => i.qtyShipped > 0));
            setView('form');
        }
    };

    const handleEditDraft = (shipment: Shipment) => {
        setEditingId(shipment.id);
        setSelectedOrderId(shipment.salesOrderId);
        setShipDate(shipment.date);
        setShipItems(shipment.items.map(i => ({ ...i })));
        setView('form');
    };

    const handleSubmitShipment = (targetStatus: 'Draft' | 'Posted') => {
        const order = state.salesOrders.find(o => o.id === selectedOrderId);
        if (!order) return;

        if (targetStatus === 'Posted') {
            for (const item of shipItems) {
                const stock = getSpecificStock(item.productId, item.configuration || []);
                if (stock < item.qtyShipped) {
                    setErrorModal({ title: 'Ошибка склада', msg: `Недостаточно товара "${item.productName}" на складе! В наличии: ${stock}, Требуется: ${item.qtyShipped}` });
                    return;
                }
                const normConfig = [...(item.configuration || [])].sort().join('|') || 'BASE';
                const orderItem = order.items.find(oi => oi.productId === item.productId && ([...(oi.configuration || [])].sort().join('|') || 'BASE') === normConfig);
                if (orderItem) {
                    const alreadyShipped = getAlreadyShippedForOrder(order.id, item.productId, item.configuration || []);
                    if ((alreadyShipped + item.qtyShipped) > orderItem.quantity) {
                        setErrorModal({ title: 'Превышение заказа', msg: `Позиция "${item.productName}": вы пытаетесь отгрузить больше, чем заказано.` });
                        return;
                    }
                }
            }
        }

        const shipment: Shipment = {
            id: editingId || ApiService.generateId('SH'),
            date: shipDate, 
            salesOrderId: selectedOrderId, 
            clientName: order?.clientName || '',
            items: shipItems.filter(i => i.qtyShipped > 0), 
            status: targetStatus
        };
        actions.saveShipment(shipment);
        setView('list');
        setEditingId(null);
    };

    const getBusinessDisplayId = (id: string) => id ? `#${id.slice(-6).toUpperCase()}` : '—';

    if (view === 'form') {
        const order = state.salesOrders.find(o => o.id === selectedOrderId);
        if (!order) { setView('list'); return null; }

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400"><ArrowLeft size={24}/></button>
                    <div><h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">{editingId ? 'Изменение накладной' : 'Новая отгрузка'}</h2><p className="text-slate-500 text-sm font-medium mt-1">Основание: {getBusinessDisplayId(selectedOrderId)}</p></div>
                </div>
                <ShipmentForm 
                    order={order} shipItems={shipItems} setShipItems={setShipItems} products={state.products} stockMovements={state.stockMovements} shipments={state.shipments}
                    showStockInfo={access.canSee('fields', 'col_stock_info')} showPriceInfo={access.canSee('fields', 'col_price')}
                    canDraft={access.canWrite('actions', 'draft')} canPost={access.canWrite('actions', 'post')}
                    onCancel={() => setView('list')} onSubmit={handleSubmitShipment}
                />
                {errorModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 text-center border-4 border-red-500/20"><AlertCircle size={64} className="text-red-600 mx-auto mb-4"/><h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{errorModal.title}</h3><p className="text-slate-600 font-medium mb-8 leading-relaxed">{errorModal.msg}</p><button onClick={() => setErrorModal(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg">Понятно</button></div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-slate-800 flex items-center"><Truck className="mr-3 text-orange-600" size={28}/> Отгрузка</h2><p className="text-slate-500 text-sm font-medium mt-1">Управление физическим отпуском товаров со склада</p></div>
            </div>

            <PendingShipments orders={state.salesOrders} shipments={state.shipments} onSelect={handleOrderSelect} />
            
            <ShipmentHistory 
                shipments={state.shipments} 
                showColClient={access.canSee('fields', 'col_client')} showColOrder={access.canSee('fields', 'col_order')} showColAmount={access.canSee('fields', 'col_amount')} showColStatus={access.canSee('fields', 'col_status')}
                canStorno={access.canWrite('actions', 'storno')} canDeleteDraft={access.canWrite('actions', 'delete')}
                onEdit={handleEditDraft} onDeleteConfirm={(id) => setDeleteConfirmId(id)} onStornoConfirm={(id) => setStornoConfirmId(id)}
            />

            {stornoConfirmId && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-8 text-center"><div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6"><RotateCcw size={40}/></div><h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Подтвердите Сторно</h3><p className="text-slate-500 font-medium mb-8 leading-relaxed">Отмена накладной вернет товар на склад и переведет документ в статус Черновик.</p><div className="flex flex-col gap-3"><button onClick={() => { actions.revertShipment(stornoConfirmId); setStornoConfirmId(null); }} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">Да, отменить отгрузку</button><button onClick={() => setStornoConfirmId(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold uppercase tracking-widest">Отмена</button></div></div>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95"><div className="p-8 text-center"><div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div><h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Удалить черновик?</h3><p className="text-slate-500 font-medium mb-8 leading-relaxed">Вы действительно хотите безвозвратно удалить черновик накладной?</p><div className="flex flex-col gap-3"><button onClick={() => { actions.deleteShipment(deleteConfirmId); setDeleteConfirmId(null); }} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">Удалить документ</button><button onClick={() => setDeleteConfirmId(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold uppercase tracking-widest">Отмена</button></div></div></div>
                </div>
            )}
        </div>
    );
};
