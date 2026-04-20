
import React, { useState } from 'react';
import { Truck, RotateCcw, Trash2, ArrowLeft, AlertCircle, Package, ShoppingCart, ArrowRight, FileText, ChevronDown, Pencil } from 'lucide-react';
import { Shipment, ShipmentItem } from '@/types';
import { useStore } from '@/features/system/context/GlobalStore';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { useShipmentLogic } from '../hooks/useShipmentLogic';
import { ShipmentForm } from './ShipmentForm';
import { ApiService } from '@/services/api';

type Tab = 'pending' | 'history';

export const MobileShipmentView: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('shipment');
    const { getSpecificStock, getAlreadyShippedForOrder } = useShipmentLogic(state.products, state.stockMovements, state.shipments, null);

    const [tab, setTab]                   = useState<Tab>('pending');
    const [view, setView]                 = useState<'list' | 'form'>('list');
    const [editingId, setEditingId]       = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [shipItems, setShipItems]       = useState<ShipmentItem[]>([]);
    const [shipDate, setShipDate]         = useState(new Date().toISOString().split('T')[0]);

    const [stornoTarget, setStornoTarget] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [errorModal, setErrorModal]     = useState<{ title: string; msg: string } | null>(null);
    const [expandedId, setExpandedId]     = useState<string | null>(null);

    const f = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

    // ── Pending orders ─────────────────────────────────────────────────
    const eligibleOrders = state.salesOrders.filter((o: any) => {
        if (o.status === 'Закрыт' || o.isDeleted) return false;
        const totalOrdered = o.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
        const totalShipped = state.shipments
            .filter((s: Shipment) => s.salesOrderId === o.id && s.status === 'Posted')
            .reduce((acc: number, s: Shipment) => acc + (s.items || []).reduce((sum: number, i) => sum + (Number(i.qtyShipped) || 0), 0), 0);
        return totalOrdered > totalShipped;
    });

    const handleOrderSelect = (orderId: string) => {
        const order = state.salesOrders.find((o: any) => o.id === orderId);
        if (!order) return;
        setSelectedOrderId(orderId);
        const items: ShipmentItem[] = order.items.map((i: any) => {
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
    };

    const handleEditDraft = (shipment: Shipment) => {
        setEditingId(shipment.id);
        setSelectedOrderId(shipment.salesOrderId);
        setShipDate(shipment.date);
        setShipItems(shipment.items.map(i => ({ ...i })));
        setView('form');
    };

    const handleSubmitShipment = (targetStatus: 'Draft' | 'Posted') => {
        const order = state.salesOrders.find((o: any) => o.id === selectedOrderId);
        if (!order) return;

        if (targetStatus === 'Posted') {
            for (const item of shipItems) {
                const stock = getSpecificStock(item.productId, item.configuration || []);
                if (stock < item.qtyShipped) {
                    setErrorModal({ title: 'Ошибка склада', msg: `Недостаточно "${item.productName}" на складе! В наличии: ${stock}, Требуется: ${item.qtyShipped}` });
                    return;
                }
                const normConfig = [...(item.configuration || [])].sort().join('|') || 'BASE';
                const orderItem = order.items.find((oi: any) => oi.productId === item.productId && ([...(oi.configuration || [])].sort().join('|') || 'BASE') === normConfig);
                if (orderItem) {
                    const alreadyShipped = getAlreadyShippedForOrder(order.id, item.productId, item.configuration || []);
                    if ((alreadyShipped + item.qtyShipped) > Number(orderItem.quantity)) {
                        setErrorModal({ title: 'Превышение заказа', msg: `"${item.productName}": вы пытаетесь отгрузить больше, чем заказано.` });
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

    const sortedShipments = [...state.shipments].sort(
        (a: Shipment, b: Shipment) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // ── Форма отгрузки ─────────────────────────────────────────────────
    if (view === 'form') {
        const order = state.salesOrders.find((o: any) => o.id === selectedOrderId);
        if (!order) { setView('list'); return null; }

        return (
            <>
                {errorModal && (
                    <div className="fixed inset-0 z-[400] bg-slate-900/80 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center border border-slate-100">
                            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={28}/>
                            </div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">{errorModal.title}</h3>
                            <p className="text-slate-500 text-[13px] mb-6 leading-relaxed">{errorModal.msg}</p>
                            <button onClick={() => setErrorModal(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all">Понятно</button>
                        </div>
                    </div>
                )}
                <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50 overflow-hidden">
                    {/* Form header */}
                    <div className="bg-white border-b border-slate-100 px-4 py-3 shrink-0 flex items-center gap-3">
                        <button onClick={() => { setView('list'); setEditingId(null); }} className="p-2 bg-slate-100 text-slate-500 rounded-xl active:scale-95 transition-all">
                            <ArrowLeft size={18}/>
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{editingId ? 'Изменение накладной' : 'Новая отгрузка'}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">{order.clientName}</p>
                        </div>
                        <input
                            type="date"
                            value={shipDate}
                            onChange={e => setShipDate(e.target.value)}
                            className="text-[11px] font-black text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <ShipmentForm
                            order={order}
                            shipItems={shipItems}
                            setShipItems={setShipItems}
                            products={state.products}
                            stockMovements={state.stockMovements}
                            shipments={state.shipments}
                            showStockInfo={access.canSee('fields', 'col_stock_info')}
                            showPriceInfo={access.canSee('fields', 'col_price')}
                            canDraft={access.canWrite('actions', 'draft')}
                            canPost={access.canWrite('actions', 'post')}
                            onCancel={() => { setView('list'); setEditingId(null); }}
                            onSubmit={handleSubmitShipment}
                        />
                    </div>
                </div>
            </>
        );
    }

    // ── Список ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col bg-slate-50">

            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-0 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-50 text-orange-600 rounded-xl">
                            <Truck size={18}/>
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Отгрузка</h1>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 leading-none">Накладных: {state.shipments.length}</p>
                        </div>
                    </div>
                </div>
                {/* Tab bar */}
                <div className="flex border-b border-slate-100">
                    {(['pending', 'history'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${tab === t ? 'text-orange-600 border-orange-500' : 'text-slate-400 border-transparent'}`}
                        >
                            {t === 'pending' ? `К отгрузке (${eligibleOrders.length})` : `История (${state.shipments.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">

                {/* ── Pending tab ── */}
                {tab === 'pending' && (
                    <div className="space-y-2">
                        {eligibleOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
                                <Package size={32}/>
                                <p className="text-[11px] font-black uppercase tracking-widest">Нет активных заказов</p>
                            </div>
                        ) : eligibleOrders.map((o: any) => {
                            const totalQty = o.items.reduce((s: number, i: any) => s + Number(i.quantity), 0);
                            const shippedQty = state.shipments
                                .filter((s: Shipment) => s.salesOrderId === o.id && s.status === 'Posted')
                                .reduce((acc: number, s: Shipment) => acc + (s.items || []).reduce((sum: number, i) => sum + Number(i.qtyShipped), 0), 0);
                            const progress = totalQty > 0 ? (shippedQty / totalQty) * 100 : 0;

                            return (
                                <div
                                    key={o.id}
                                    onClick={() => handleOrderSelect(o.id)}
                                    className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-xl shrink-0">
                                                <ShoppingCart size={14}/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-black text-slate-800 truncate leading-tight">{o.clientName}</p>
                                                <p className="text-[9px] text-slate-300 font-mono">#{o.id.slice(-6).toUpperCase()} • {new Date(o.date).toLocaleDateString('ru-RU')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[12px] font-black text-orange-600 font-mono">{f(Number(o.totalAmount))} ₸</span>
                                            <ArrowRight size={14} className="text-slate-300"/>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Прогресс: {shippedQty}/{totalQty}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }}/>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── History tab ── */}
                {tab === 'history' && (
                    <div className="space-y-2">
                        {sortedShipments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
                                <FileText size={32}/>
                                <p className="text-[11px] font-black uppercase tracking-widest">Накладных нет</p>
                            </div>
                        ) : sortedShipments.map((s: Shipment) => {
                            const isExpanded = expandedId === s.id;
                            const totalAmt = s.items.reduce((sum, i) => sum + (Number(i.priceKzt) * Number(i.qtyShipped)), 0);

                            return (
                                <div key={s.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <div
                                        className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'Posted' ? 'bg-emerald-500' : 'bg-amber-400'}`}/>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-800 font-mono">#{s.id.slice(-6).toUpperCase()}</span>
                                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded border ${s.status === 'Posted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {s.status === 'Posted' ? 'Проведено' : 'Черновик'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5">{s.clientName}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            {access.canSee('fields', 'col_amount') && (
                                                <p className="text-[11px] font-black text-slate-900 font-mono">{f(totalAmt)} ₸</p>
                                            )}
                                            <p className="text-[9px] text-slate-300">{new Date(s.date).toLocaleDateString('ru-RU')}</p>
                                        </div>
                                        <ChevronDown size={14} className={`text-slate-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}/>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-slate-50 px-4 py-3 space-y-3">
                                            {/* Items */}
                                            <div className="space-y-1.5">
                                                {s.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-[11px]">
                                                        <span className="text-slate-600 truncate flex-1 mr-2">{item.productName}</span>
                                                        <span className="font-black text-slate-700 shrink-0">{item.qtyShipped} шт.</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Action buttons */}
                                            <div className="flex gap-2 pt-1">
                                                {s.status === 'Draft' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleEditDraft(s)}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 active:scale-95 transition-all"
                                                        >
                                                            <Pencil size={14}/>
                                                        </button>
                                                        {access.canWrite('actions', 'delete') && (
                                                            <button
                                                                onClick={() => setDeleteTarget(s.id)}
                                                                className="p-2 bg-red-50 text-red-500 rounded-xl border border-red-100 active:scale-95 transition-all"
                                                            >
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {s.status === 'Posted' && access.canWrite('actions', 'storno') && (
                                                    <button
                                                        onClick={() => setStornoTarget(s.id)}
                                                        className="flex items-center gap-1.5 py-2 px-4 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded-xl border border-orange-100 active:scale-95 transition-all"
                                                    >
                                                        <RotateCcw size={12}/> Сторно
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div className="h-4"/>
                    </div>
                )}
            </div>

            {/* Storno confirm */}
            {stornoTarget && (
                <div className="fixed inset-0 z-[300] bg-slate-900/60 flex flex-col justify-end">
                    <div className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '95dvh' }}>
                        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5"/>
                        <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <RotateCcw size={24}/>
                        </div>
                        <h3 className="text-base font-black text-slate-800 text-center uppercase tracking-tight mb-1">Сторно?</h3>
                        <p className="text-[12px] text-slate-500 text-center mb-6 leading-relaxed">Товар вернётся на склад, накладная станет черновиком.</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => { actions.revertShipment(stornoTarget); setStornoTarget(null); }}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                            >
                                Да, отменить отгрузку
                            </button>
                            <button onClick={() => setStornoTarget(null)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase tracking-widest text-xs">
                                Назад
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[300] bg-slate-900/60 flex flex-col justify-end">
                    <div className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '95dvh' }}>
                        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5"/>
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24}/>
                        </div>
                        <h3 className="text-base font-black text-slate-800 text-center uppercase tracking-tight mb-1">Удалить черновик?</h3>
                        <p className="text-[12px] text-slate-500 text-center mb-6 leading-relaxed">Черновик накладной будет удалён безвозвратно.</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => { actions.deleteShipment(deleteTarget); setDeleteTarget(null); }}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                            >
                                Удалить
                            </button>
                            <button onClick={() => setDeleteTarget(null)} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase tracking-widest text-xs">
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
