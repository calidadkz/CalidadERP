
import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Plus, Search, X, Pencil, Trash2, Layers, ArrowLeft, Package, CreditCard } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { SupplierOrder, PlannedPayment, Batch, OrderItem } from '@/types';
import { OrderForm } from './OrderForm';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { formatDateDMY } from '@/utils/formatDate';

const statusColor = (status: string) => {
    if (status === 'Закрыт') return 'bg-slate-100 text-slate-400 border-slate-200';
    if (status === 'Выполнен') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};

export const MobileProcurementView: React.FC = () => {
    const { state, actions } = useStore();

    const [view, setView]             = useState<'list' | 'form' | 'detail'>('list');
    const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
    const [detailOrder, setDetailOrder] = useState<SupplierOrder | null>(null);
    const [search, setSearch]         = useState('');
    const [deleteTarget, setDeleteTarget] = useState<SupplierOrder | null>(null);
    const [errorMsg, setErrorMsg]     = useState<string | null>(null);
    const [batches, setBatches]       = useState<Batch[]>([]);

    useEffect(() => {
        api.fetchAll<Batch>(TableNames.BATCHES).then(setBatches).catch(() => {});
    }, []);

    const orderBatchMap = useMemo(() => {
        const m: Record<string, Batch> = {};
        batches.forEach(b => {
            (b.supplierOrderIds || []).forEach(id => { m[id] = b; });
        });
        return m;
    }, [batches]);

    const active = useMemo(() => state.orders.filter((o: SupplierOrder) => !o.isDeleted), [state.orders]);

    const filtered = useMemo(() => {
        let list = active;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter((o: SupplierOrder) =>
                o.id.toLowerCase().includes(q) ||
                (o.name || '').toLowerCase().includes(q) ||
                o.supplierName.toLowerCase().includes(q)
            );
        }
        return [...list].sort((a: SupplierOrder, b: SupplierOrder) => b.date.localeCompare(a.date));
    }, [active, search]);

    const editingPayments = editingOrder
        ? state.plannedPayments.filter((p: PlannedPayment) => p.sourceDocId === editingOrder.id)
        : [];

    const getMetrics = (orderId: string, totalAmount: number) => {
        const rel = state.plannedPayments.filter((p: PlannedPayment) => p.sourceDocId === orderId);
        const paidAmount = rel.reduce((s: number, p: PlannedPayment) => s + (p.amountPaid || 0), 0);
        const payPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        return { paidAmount, payPct };
    };

    const handleSubmit = (order: SupplierOrder, plans: PlannedPayment[]) => {
        if (editingOrder) actions.updateOrder(order, plans);
        else actions.createOrder(order, plans);
        setView('list');
        setEditingOrder(null);
    };

    const handleDelete = (o: SupplierOrder) => {
        actions.deleteOrder(o.id);
        setDeleteTarget(null);
    };

    const f = (val: number) => val.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

    // ── Детальный просмотр ─────────────────────────────────────────────
    if (view === 'detail' && detailOrder) {
        const dItems: OrderItem[] = detailOrder.items || [];
        const dPayments = state.plannedPayments.filter((p: PlannedPayment) => p.sourceDocId === detailOrder.id);
        const paidAmt = dPayments.reduce((s: number, p: PlannedPayment) => s + (p.amountPaid || 0), 0);
        const linkedBatch = orderBatchMap[detailOrder.id];
        const isFullyReceived = detailOrder.receivedItemCount >= detailOrder.totalItemCount && detailOrder.totalItemCount > 0;

        return (
            <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50">
                {/* Header */}
                <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2.5 shrink-0 flex items-center gap-3">
                    <button
                        onClick={() => { setDetailOrder(null); setView('list'); }}
                        className="p-2 text-slate-400 active:text-slate-600 rounded-xl active:bg-slate-50"
                    >
                        <ArrowLeft size={18}/>
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-black text-slate-800 truncate leading-tight">
                            {detailOrder.name || <span className="text-slate-400 italic font-normal text-xs">Без названия</span>}
                        </p>
                        <p className="text-[9px] font-black text-slate-300 font-mono">
                            #{detailOrder.id.slice(-6).toUpperCase()} · {formatDateDMY(detailOrder.date)}
                        </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border ${statusColor(detailOrder.status)}`}>
                        {detailOrder.status}
                    </span>
                    <button
                        onClick={() => { setEditingOrder(detailOrder); setDetailOrder(null); setView('form'); }}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 active:scale-95 transition-all"
                    >
                        <Pencil size={15}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* Итоги */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        {linkedBatch && (
                            <div className="flex justify-center mb-3">
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] font-black uppercase">
                                    <Layers size={8}/> {linkedBatch.name}
                                </span>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Сумма</p>
                                <p className="text-sm font-black text-slate-800 font-mono leading-none">
                                    {(detailOrder.totalAmountForeign || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} {detailOrder.currency}
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Оплачено</p>
                                <p className="text-sm font-black text-emerald-600 font-mono leading-none">{f(paidAmt)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Принято</p>
                                <p className={`text-sm font-black font-mono leading-none ${isFullyReceived ? 'text-emerald-600' : 'text-slate-700'}`}>
                                    {detailOrder.receivedItemCount}/{detailOrder.totalItemCount}
                                </p>
                            </div>
                        </div>
                        <p className="text-center text-[11px] font-bold text-slate-500 mt-3 pt-3 border-t border-slate-50">
                            {detailOrder.supplierName}
                        </p>
                    </div>

                    {/* Состав инвойса */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                            <Package size={13} className="text-indigo-400"/>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Состав инвойса · {dItems.length} поз.
                            </h3>
                        </div>
                        {dItems.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[11px] text-slate-300 font-black uppercase tracking-widest">
                                Нет позиций
                            </div>
                        ) : dItems.map((item, idx) => (
                            <div key={`${item.productId}-${idx}`} className={`px-4 py-3 flex items-start gap-3 ${idx > 0 ? 'border-t border-slate-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-black text-slate-800 leading-tight">{item.productName}</p>
                                    <p className="text-[9px] font-black text-slate-300 font-mono mt-0.5">{item.sku}</p>
                                    {item.configuration && item.configuration.length > 0 && (
                                        <p className="text-[9px] text-slate-400 mt-0.5 truncate">{item.configuration.join(', ')}</p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[12px] font-black text-slate-800 font-mono">
                                        {f(item.totalForeign)} {detailOrder.currency}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-mono">{item.quantity} × {f(item.priceForeign)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Транши оплат */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                            <CreditCard size={13} className="text-indigo-400"/>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Транши оплат · {dPayments.length}
                            </h3>
                        </div>
                        {dPayments.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[11px] text-slate-300 font-black uppercase tracking-widest">
                                Транши не запланированы
                            </div>
                        ) : dPayments.map((p: PlannedPayment, idx: number) => (
                            <div key={p.id} className={`px-4 py-3 flex items-center gap-3 ${idx > 0 ? 'border-t border-slate-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-black text-slate-700">{formatDateDMY(p.dueDate)}</p>
                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                        К оплате: {f(p.amountDue)} {p.currency}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[12px] font-black text-emerald-600 font-mono">{f(p.amountPaid || 0)}</p>
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${p.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {p.isPaid ? 'Оплачен' : 'Ожидает'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="h-4"/>
                </div>
            </div>
        );
    }

    // ── Форма ──────────────────────────────────────────────────────────
    if (view === 'form') {
        return (
            <>
                {errorMsg && (
                    <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                            <h3 className="text-base font-black text-slate-800 uppercase mb-2">Ошибка</h3>
                            <p className="text-slate-500 text-sm mb-6">{errorMsg}</p>
                            <button onClick={() => setErrorMsg(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs">ОК</button>
                        </div>
                    </div>
                )}
                <div className="fixed inset-0 z-[200] flex flex-col bg-white">
                    <OrderForm
                        initialOrder={editingOrder}
                        initialPayments={editingPayments}
                        state={state}
                        actions={actions}
                        onCancel={() => { setView('list'); setEditingOrder(null); }}
                        onSubmit={handleSubmit}
                        onError={setErrorMsg}
                        isMobile={true}
                    />
                </div>
            </>
        );
    }

    // ── Список ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col bg-slate-50">

            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <ShoppingBag size={18}/>
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Заказы поставщикам</h1>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 leading-none">ЗП • {active.length}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditingOrder(null); setView('form'); }}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                        <Plus size={14}/> Новый ЗП
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по ID, названию, поставщику..."
                        className="w-full pl-8 pr-8 py-2 text-[13px] bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-indigo-400"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300">
                            <X size={13}/>
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
                        <ShoppingBag size={32}/>
                        <p className="text-[11px] font-black uppercase tracking-widest">Заказы не найдены</p>
                    </div>
                ) : filtered.map((o: SupplierOrder) => {
                    const { payPct } = getMetrics(o.id, o.totalAmountForeign);
                    const linkedBatch = orderBatchMap[o.id];
                    const isFullyReceived = o.receivedItemCount >= o.totalItemCount && o.totalItemCount > 0;

                    return (
                        <div
                            key={o.id}
                            className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm active:bg-slate-50 cursor-pointer"
                            onClick={() => { setDetailOrder(o); setView('detail'); }}
                        >
                            <div className="px-4 pt-3 pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[9px] font-black text-slate-300 font-mono">#{o.id.slice(-6).toUpperCase()}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{formatDateDMY(o.date)}</span>
                                        </div>
                                        <p className="text-[13px] font-black text-slate-800 truncate leading-tight">
                                            {o.name || <span className="text-slate-300 italic font-normal text-xs">Без названия</span>}
                                        </p>
                                        <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5">{o.supplierName}</p>
                                        {linkedBatch && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] font-black uppercase">
                                                    <Layers size={8}/> {linkedBatch.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-sm font-black text-slate-900 font-mono">
                                            {(o.totalAmountForeign || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} {o.currency}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="border-t border-slate-50 px-4 py-2 flex items-center gap-4">
                                {/* Принято */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Прин.</span>
                                    <span className={`text-[11px] font-black ${isFullyReceived ? 'text-emerald-600' : 'text-slate-700'}`}>
                                        {o.receivedItemCount}/{o.totalItemCount}
                                    </span>
                                </div>

                                {/* Оплата */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Опл.</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-[9px] font-black text-slate-500">{payPct}%</span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${payPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${Math.min(100, payPct)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Статус */}
                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border ${statusColor(o.status)}`}>
                                    {o.status}
                                </span>

                                {/* Actions */}
                                <div className="flex gap-1 ml-auto shrink-0">
                                    <button
                                        onClick={e => { e.stopPropagation(); setEditingOrder(o); setView('form'); }}
                                        className="p-1.5 text-slate-300 hover:text-indigo-500 rounded-lg active:bg-indigo-50"
                                    >
                                        <Pencil size={14}/>
                                    </button>
                                    <button
                                        onClick={e => { e.stopPropagation(); setDeleteTarget(o); }}
                                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg active:bg-red-50"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="h-4"/>
            </div>

            {/* Delete confirm */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[300] bg-slate-900/60 flex flex-col justify-end">
                    <div className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '95dvh' }}>
                        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5"/>
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24}/>
                        </div>
                        <h3 className="text-base font-black text-slate-800 text-center uppercase tracking-tight mb-1">Удалить заказ?</h3>
                        <p className="text-[12px] text-slate-500 text-center mb-6 leading-relaxed">
                            «{deleteTarget.name || deleteTarget.id}» будет перемещён в корзину.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleDelete(deleteTarget)}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                            >
                                Да, удалить
                            </button>
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-bold uppercase tracking-widest text-xs"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
