
import React, { useState } from 'react';
import { Shipment, ShipmentItem } from '@/types';
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
                    qtyShipped: Math.max(0, (Number(i.quantity) || 0) - alreadyShipped),
                    priceKzt: Number(i.priceKzt) || 0,
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
                    if ((alreadyShipped + item.qtyShipped) > Number(orderItem.quantity)) {
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

    if (view === 'form') {
        const order = state.salesOrders.find(o => o.id === selectedOrderId);
        if (!order) { setView('list'); return null; }

        return (
            <div className="h-[calc(100vh-2rem)] flex flex-col space-y-3 p-3 bg-slate-50/50 overflow-hidden">
                <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                    <button onClick={() => setView('list')} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl transition-all active:scale-95"><ArrowLeft size={18}/></button>
                    <div className="flex-1">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{editingId ? 'Изменение накладной' : 'Новая отгрузка'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{order.clientName}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} className="text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none focus:border-blue-500" />
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    <ShipmentForm 
                        order={order} shipItems={shipItems} setShipItems={setShipItems} products={state.products} stockMovements={state.stockMovements} shipments={state.shipments}
                        showStockInfo={access.canSee('fields', 'col_stock_info')} showPriceInfo={access.canSee('fields', 'col_price')}
                        canDraft={access.canWrite('actions', 'draft')} canPost={access.canWrite('actions', 'post')}
                        onCancel={() => setView('list')} onSubmit={handleSubmitShipment}
                    />
                </div>
                {errorModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8 text-center border border-slate-100 animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{errorModal.title}</h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed text-[13px]">{errorModal.msg}</p>
                            <button onClick={() => setErrorModal(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs">Понятно</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col space-y-4 p-2 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                        <Truck size={20}/>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Отгрузка</h2>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Ожидающие и история</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-right">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Накладных</span>
                        <span className="text-sm font-black text-slate-700 leading-none">{state.shipments.length}</span>
                    </div>
                </div>
            </div>

            <PendingShipments orders={state.salesOrders} shipments={state.shipments} onSelect={handleOrderSelect} />
            
            <ShipmentHistory 
                shipments={state.shipments} 
                showColClient={access.canSee('fields', 'col_client')} showColOrder={access.canSee('fields', 'col_order')} showColAmount={access.canSee('fields', 'col_amount')} showColStatus={access.canSee('fields', 'col_status')}
                canStorno={access.canWrite('actions', 'storno')} canDeleteDraft={access.canWrite('actions', 'delete')}
                onEdit={handleEditDraft} onDeleteConfirm={(id) => setDeleteConfirmId(id)} onStornoConfirm={(id) => setStornoConfirmId(id)}
            />

            {stornoConfirmId && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <RotateCcw size={32}/>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Сторно?</h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed text-[13px]">Товар вернется на склад, накладная станет черновиком.</p>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => { actions.revertShipment(stornoConfirmId); setStornoConfirmId(null); }} className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs">Да, отменить отгрузку</button>
                                <button onClick={() => setStornoConfirmId(null)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all text-xs">Назад</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Удалить черновик?</h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed text-[13px]">Черновик накладной будет удален безвозвратно.</p>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => { actions.deleteShipment(deleteConfirmId); setDeleteConfirmId(null); }} className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs">Удалить</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all text-xs">Отмена</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
