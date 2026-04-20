
import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, Search, X, Pencil, Trash2, ArrowLeft, Package, CreditCard } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { SalesOrder, PlannedPayment } from '@/types';
import { MobileSalesOrderForm } from './MobileSalesOrderForm';
import { formatDateDMY } from '@/utils/formatDate';


const STATUS_LABELS = ['Все', 'Новый', 'В работе', 'Реализован', 'Закрыт'];

const statusColor = (label: string) => {
    if (label === 'Реализован') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (label === 'Закрыт') return 'bg-slate-100 text-slate-400 border-slate-200';
    if (label === 'В работе') return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
};

export const MobileSalesView: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('sales');

    const canCreate = access.canWrite('actions', 'create');
    const canEdit   = access.canSee('actions', 'edit');
    const canDelete = access.canWrite('actions', 'delete');
    const showAmount   = access.canSee('fields', 'col_amount');
    const showClient   = access.canSee('fields', 'col_client');
    const showPayment  = access.canSee('fields', 'col_payment');
    const showShipment = access.canSee('fields', 'col_shipment');

    const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
    const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
    const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
    const [search, setSearch]     = useState('');
    const [statusFilter, setStatusFilter] = useState('Все');
    const [deleteTarget, setDeleteTarget] = useState<SalesOrder | null>(null);

    const active = useMemo(() => state.salesOrders.filter(o => !o.isDeleted), [state.salesOrders]);

    const getStatusLabel = (o: SalesOrder) => {
        const paid = state.plannedPayments
            .filter((p: PlannedPayment) => p.sourceDocId === o.id)
            .reduce((s: number, p: PlannedPayment) => s + (p.amountPaid || 0), 0);
        const fullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
        const fullyPaid = paid >= (o.totalAmount - 0.1);
        return (fullyShipped && fullyPaid) ? 'Реализован' : o.status;
    };

    const filtered = useMemo(() => {
        let list = active;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(o =>
                o.id.toLowerCase().includes(q) ||
                (o.name || '').toLowerCase().includes(q) ||
                o.clientName.toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'Все') {
            list = list.filter(o => getStatusLabel(o) === statusFilter);
        }
        return [...list].sort((a, b) => b.date.localeCompare(a.date));
    }, [active, search, statusFilter, state.plannedPayments]);

    const editingPayments = editingOrder
        ? state.plannedPayments.filter((p: PlannedPayment) => p.sourceDocId === editingOrder.id)
        : [];

    const handleSubmit = (order: SalesOrder, plans: PlannedPayment[]) => {
        if (editingOrder) actions.updateSalesOrder(order, plans);
        else actions.createSalesOrder(order, plans);
        setView('list');
        setEditingOrder(null);
    };

    const handleDelete = (o: SalesOrder) => {
        actions.deleteSalesOrder(o.id);
        setDeleteTarget(null);
    };

    const f = (val: number) => val.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

    // ── Детальный просмотр ─────────────────────────────────────────────
    if (view === 'detail' && detailOrder) {
        const dItems = detailOrder.items || [];
        const dPayments = state.plannedPayments.filter((p: PlannedPayment) => p.sourceDocId === detailOrder.id);
        const paidAmt = dPayments.reduce((s: number, p: PlannedPayment) => s + (p.amountPaid || 0), 0);
        const statusLabel = getStatusLabel(detailOrder);

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
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border ${statusColor(statusLabel)}`}>
                        {statusLabel}
                    </span>
                    {canEdit && (
                        <button
                            onClick={() => { setEditingOrder(detailOrder); setDetailOrder(null); setView('form'); }}
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 active:scale-95 transition-all"
                        >
                            <Pencil size={15}/>
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* Итоги */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            {showAmount && (
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Сумма</p>
                                    <p className="text-sm font-black text-slate-800 font-mono leading-none">{f(detailOrder.totalAmount)} ₸</p>
                                </div>
                            )}
                            {showPayment && (
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Оплачено</p>
                                    <p className="text-sm font-black text-emerald-600 font-mono leading-none">{f(paidAmt)} ₸</p>
                                </div>
                            )}
                            {showShipment && (
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Отгружено</p>
                                    <p className={`text-sm font-black font-mono leading-none ${detailOrder.shippedItemCount >= detailOrder.totalItemCount && detailOrder.totalItemCount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                        {detailOrder.shippedItemCount}/{detailOrder.totalItemCount}
                                    </p>
                                </div>
                            )}
                        </div>
                        {showClient && (
                            <p className="text-center text-[11px] font-bold text-slate-500 mt-3 pt-3 border-t border-slate-50">
                                {detailOrder.clientName}
                            </p>
                        )}
                    </div>

                    {/* Состав заказа */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                            <Package size={13} className="text-blue-400"/>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Состав заказа · {dItems.length} поз.
                            </h3>
                        </div>
                        {dItems.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[11px] text-slate-300 font-black uppercase tracking-widest">
                                Нет позиций
                            </div>
                        ) : dItems.map((item, idx) => (
                            <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${idx > 0 ? 'border-t border-slate-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-black text-slate-800 leading-tight">{item.productName}</p>
                                    <p className="text-[9px] font-black text-slate-300 font-mono mt-0.5">{item.sku}</p>
                                    {item.configuration && item.configuration.length > 0 && (
                                        <p className="text-[9px] text-slate-400 mt-0.5 truncate">{item.configuration.join(', ')}</p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    {showAmount && <p className="text-[12px] font-black text-slate-800 font-mono">{f(item.totalKzt)} ₸</p>}
                                    <p className="text-[9px] text-slate-400 font-mono">{item.quantity} × {f(item.priceKzt)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Транши оплат */}
                    {showPayment && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                                <CreditCard size={13} className="text-blue-400"/>
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
                                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">К оплате: {f(p.amountDue)} ₸</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[12px] font-black text-emerald-600 font-mono">{f(p.amountPaid || 0)} ₸</p>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${p.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {p.isPaid ? 'Оплачен' : 'Ожидает'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="h-4"/>
                </div>
            </div>
        );
    }

    // ── Форма ──────────────────────────────────────────────────────────
    if (view === 'form') {
        return (
            <MobileSalesOrderForm
                initialOrder={editingOrder}
                initialPayments={editingPayments}
                onCancel={() => { setView('list'); setEditingOrder(null); }}
                onSubmit={handleSubmit}
            />
        );
    }

    // ── Список ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col bg-slate-50">

            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
                            <ShoppingCart size={18}/>
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">Заказы клиентов</h1>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5 leading-none">ЗК • {active.length}</p>
                        </div>
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => { setEditingOrder(null); setView('form'); }}
                            className="flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-lg active:scale-95 transition-all"
                        >
                            <Plus size={14}/> Новый
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по ID, названию, клиенту..."
                        className="w-full pl-8 pr-8 py-2 text-[13px] bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-400"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300">
                            <X size={13}/>
                        </button>
                    )}
                </div>

                {/* Status chips */}
                <div className="overflow-x-auto -mx-4 px-4">
                    <div className="flex gap-1.5 w-max pb-1">
                        {STATUS_LABELS.map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all whitespace-nowrap ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-300">
                        <ShoppingCart size={32}/>
                        <p className="text-[11px] font-black uppercase tracking-widest">Заказы не найдены</p>
                    </div>
                ) : filtered.map(o => {
                    const relPay = state.plannedPayments.filter((p: PlannedPayment) => p.sourceDocId === o.id);
                    const paidAmt = relPay.reduce((s: number, p: PlannedPayment) => s + (p.amountPaid || 0), 0);
                    const payPct = o.totalAmount > 0 ? Math.round((paidAmt / o.totalAmount) * 100) : 0;
                    const isFullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
                    const statusLabel = getStatusLabel(o);

                    return (
                        <div
                            key={o.id}
                            className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm active:bg-slate-50 cursor-pointer"
                            onClick={() => { setDetailOrder(o); setView('detail'); }}
                        >
                            {/* Top row */}
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
                                        {showClient && (
                                            <p className="text-[11px] text-slate-500 font-bold truncate mt-0.5">{o.clientName}</p>
                                        )}
                                    </div>
                                    {showAmount && (
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-black text-slate-900 font-mono">{f(o.totalAmount)} ₸</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Metrics row */}
                            <div className="border-t border-slate-50 px-4 py-2 flex items-center gap-4">
                                {/* Отгрузка */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Отгр.</span>
                                    <span className={`text-[11px] font-black ${isFullyShipped ? 'text-emerald-600' : 'text-slate-700'}`}>
                                        {o.shippedItemCount}/{o.totalItemCount}
                                    </span>
                                </div>

                                {/* Оплата */}
                                {showPayment && (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Опл.</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-0.5">
                                                <span className="text-[9px] font-black text-slate-500">{payPct}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${payPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, payPct)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Статус */}
                                {showShipment && (
                                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border ${statusColor(statusLabel)}`}>
                                        {statusLabel}
                                    </span>
                                )}

                                {/* Actions */}
                                <div className="flex gap-1 ml-auto shrink-0">
                                    {canEdit && (
                                        <button
                                            onClick={e => { e.stopPropagation(); setEditingOrder(o); setView('form'); }}
                                            className="p-1.5 text-slate-300 hover:text-blue-500 rounded-lg active:bg-blue-50"
                                        >
                                            <Pencil size={14}/>
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={e => { e.stopPropagation(); setDeleteTarget(o); }}
                                            className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg active:bg-red-50"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
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
                            «{deleteTarget.name || deleteTarget.id}» будет перемещён в корзину вместе со связанными ПП.
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
