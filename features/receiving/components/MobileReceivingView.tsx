
import React, { useState, useEffect } from 'react';
import { PackageCheck, ArrowLeft, Truck, ShoppingBag, ChevronDown, ChevronRight, Package, Calendar, Wallet } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { SupplierOrder, Reception, Batch, PreCalculationItem } from '@/types';
import { ReceivingForm } from './ReceivingForm';
import { api } from '@/services';
import { TableNames } from '@/constants';

export const MobileReceivingView: React.FC = () => {
    const { state, actions } = useStore();

    const [view, setView]             = useState<'list' | 'form'>('list');
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();
    const [batches, setBatches]       = useState<Batch[]>([]);
    const [preCalcItems, setPreCalcItems] = useState<PreCalculationItem[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        api.fetchAll<Batch>(TableNames.BATCHES).then(setBatches).catch(() => {});
    }, []);

    const getDisplayId = (id: string) => id.includes('-') ? `#${id.slice(-6).toUpperCase()}` : id;
    const f = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

    const pendingOrders = state.orders.filter((o: SupplierOrder) => o.status !== 'Закрыт' && !o.isDeleted);
    const sortedReceptions = [...state.receptions].sort(
        (a: Reception, b: Reception) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const handleOrderSelect = (orderId: string) => {
        const linkedBatch = batches.find(b =>
            Array.isArray(b.supplierOrderIds) && b.supplierOrderIds.includes(orderId)
        );
        setSelectedOrderId(orderId);
        setSelectedBatchId(linkedBatch?.id);
        setPreCalcItems([]);

        if (linkedBatch?.preCalculationId) {
            api.fetchAll<PreCalculationItem>(
                TableNames.PRE_CALCULATION_ITEMS,
                { preCalculationId: linkedBatch.preCalculationId }
            ).then(setPreCalcItems).catch(() => {});
        }

        setView('form');
    };

    const handleSaveReception = (reception: any) => {
        actions.saveReception({ ...reception, batchId: selectedBatchId });
        setView('list');
        setSelectedOrderId('');
        setSelectedBatchId(undefined);
    };

    // ── Форма приёмки ──────────────────────────────────────────────────
    if (view === 'form') {
        const order = state.orders.find((o: SupplierOrder) => o.id === selectedOrderId);
        if (!order) { setView('list'); return null; }
        const linkedBatch = selectedBatchId ? batches.find(b => b.id === selectedBatchId) : undefined;

        return (
            <div className="fixed inset-0 z-[200] bg-white overflow-y-auto">
                {/* Form header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 z-10 flex items-center gap-3">
                    <button
                        onClick={() => { setView('list'); setSelectedOrderId(''); setSelectedBatchId(undefined); }}
                        className="p-2 bg-slate-100 text-slate-500 rounded-xl active:scale-95 transition-all shrink-0"
                    >
                        <ArrowLeft size={18}/>
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none">Новая приёмка</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {getDisplayId(selectedOrderId)}
                            {linkedBatch && <span className="ml-2 text-indigo-500">• {linkedBatch.name}</span>}
                        </p>
                    </div>
                </div>
                <div className="p-4">
                    <ReceivingForm
                        order={order}
                        state={state}
                        actions={actions}
                        batchId={selectedBatchId}
                        batchName={linkedBatch?.name}
                        preCalcItems={preCalcItems}
                        onCancel={() => { setView('list'); setSelectedOrderId(''); setSelectedBatchId(undefined); }}
                        onSave={handleSaveReception}
                    />
                </div>
            </div>
        );
    }

    // ── Список ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col bg-slate-50">

            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
                        <PackageCheck size={18}/>
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Приёмка</h1>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 leading-none">Оприходование товаров на склад</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">

                {/* ── Ожидают поступления ── */}
                <div>
                    <div className="flex items-center gap-2 px-1 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Ожидают поступления ({pendingOrders.length})
                        </span>
                    </div>

                    {pendingOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-300 bg-white rounded-2xl border border-slate-100">
                            <Truck size={24}/>
                            <p className="text-[10px] font-black uppercase tracking-widest">Нет активных заказов</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pendingOrders.map((o: SupplierOrder) => {
                                const totalQty = o.items.reduce((s: number, i: any) => s + Number(i.quantity), 0);
                                return (
                                    <div
                                        key={o.id}
                                        onClick={() => handleOrderSelect(o.id)}
                                        className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-3 cursor-pointer active:bg-slate-50 transition-colors"
                                    >
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                                            <ShoppingBag size={16}/>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black text-slate-800 truncate leading-tight">{o.supplierName}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] font-black text-slate-300 font-mono">{getDisplayId(o.id)}</span>
                                                <span className="text-[9px] text-slate-400">{o.items.length} поз. • {totalQty} шт.</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[12px] font-black text-slate-900 font-mono">
                                                {(o.totalAmountForeign || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} {o.currency}
                                            </p>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-300 shrink-0"/>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Журнал приёмок ── */}
                <div>
                    <div className="flex items-center gap-2 px-1 mb-2">
                        <Calendar size={12} className="text-slate-400"/>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Журнал поступлений ({state.receptions.length})
                        </span>
                    </div>

                    {sortedReceptions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-300 bg-white rounded-2xl border border-slate-100">
                            <Package size={24}/>
                            <p className="text-[10px] font-black uppercase tracking-widest">Нет записей</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sortedReceptions.map((r: Reception) => {
                                const order = state.orders.find((o: SupplierOrder) => o.id === r.orderId);
                                const totalQty = (r.items || []).reduce((s: number, i: any) => s + (Number(i.qtyFact) || 0), 0);
                                const totalExpenses = (r.expenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
                                const finalValueKzt = (r.items || []).reduce((s: number, i: any) => s + (Number(i.finalCostUnitKzt) * (Number(i.qtyFact) || 0)), 0);
                                const isExpanded = expandedId === r.id;

                                return (
                                    <div key={r.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                        <div
                                            className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-blue-600 font-mono">#{r.id.slice(-8).toUpperCase()}</span>
                                                    <span className="text-[9px] text-slate-400">{r.date}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5">
                                                    {order ? order.supplierName : r.orderId}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[12px] font-black text-slate-900 font-mono">{f(finalValueKzt)} ₸</p>
                                                <p className="text-[9px] text-slate-400">{totalQty} шт.</p>
                                            </div>
                                            <ChevronDown size={14} className={`text-slate-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}/>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-slate-50 px-4 py-3 space-y-2">
                                                {/* Items summary */}
                                                {(r.items || []).slice(0, 5).map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-[11px]">
                                                        <span className="text-slate-600 truncate flex-1 mr-2">{item.productName}</span>
                                                        <span className="font-black text-slate-700 shrink-0">{item.qtyFact} шт.</span>
                                                    </div>
                                                ))}
                                                {(r.items || []).length > 5 && (
                                                    <p className="text-[10px] text-slate-400 italic">+ ещё {(r.items || []).length - 5} позиций</p>
                                                )}

                                                {/* Expenses */}
                                                {totalExpenses > 0 && (
                                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                                                        <Wallet size={12} className="text-slate-400"/>
                                                        <span className="text-[10px] text-slate-500">Доп. расходы:</span>
                                                        <span className="text-[10px] font-black text-slate-700 font-mono">{f(totalExpenses)} ₸</span>
                                                    </div>
                                                )}

                                                {/* Status */}
                                                <div className="flex justify-between items-center pt-1">
                                                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-lg border ${r.status === 'Posted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                        {r.status === 'Posted' ? 'Проведено' : r.status}
                                                    </span>
                                                    <span className="text-[9px] font-black text-blue-600 font-mono">Итого: {f(finalValueKzt)} ₸</span>
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
            </div>
        </div>
    );
};
