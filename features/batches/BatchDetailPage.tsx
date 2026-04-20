import React, { useState, useMemo } from 'react';
import {
    ArrowLeft, Loader2, AlertTriangle,
    DollarSign, BarChart3, FileText, Layers, CalendarClock, Calendar,
    ChevronDown, Trash2, X, ScrollText
} from 'lucide-react';
import { PreCalculationItem } from '@/types/pre-calculations';
import { SalesOrder, PlannedPayment } from '@/types';
import { useNavigate, useParams } from 'react-router-dom';
import { useBatches } from './hooks/useBatches';
import { useBatchStatuses, getStatusColors } from './hooks/useBatchStatuses';
import { getBatchPhase } from './utils/batchPhase';
import { AddItemModal } from '../pre-calculations/components/detailed-list/AddItemModal';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { BatchMainListTab } from './components/BatchMainListTab';
import { BatchExpensesTab } from './components/BatchExpensesTab';
import { BatchComparisonTab } from './components/BatchComparisonTab';
import { BatchDocumentsTab } from './components/BatchDocumentsTab';
import { BatchInvoicesTab } from './components/BatchInvoicesTab';
import { BatchTimelineTab } from './components/BatchTimelineTab';
import { BatchSidebar, SidebarContext } from './components/BatchSidebar';
import { ChinaDeliveryModal } from './components/ChinaDeliveryModal';
import { useBatchCategoryMap } from './hooks/useBatchCategoryMap';
import { useStore } from '@/features/system/context/GlobalStore';
import { SalesOrderForm } from '@/features/sales/components/SalesOrderForm';
import { useAccess } from '@/features/auth/hooks/useAccess';

type TabType = 'LIST' | 'EXPENSES' | 'COMPARISON' | 'DOCUMENTS' | 'TIMELINE' | 'INVOICES';

const fmtShort = (v?: number) => {
    if (!v && v !== 0) return '—';
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' млн ₸';
    if (abs >= 1_000) return (v / 1_000).toFixed(0) + ' тыс ₸';
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸';
};

export const BatchDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('LIST');
    const [sidebarCtx, setSidebarCtx] = useState<SidebarContext>({ type: 'summary' });
    const [statusOpen, setStatusOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showChinaModal, setShowChinaModal] = useState(false);

    const { state, actions } = useStore();
    const salesOrders = state.salesOrders;
    const cashFlowItems = state.cashFlowItems;
    const salesAccess = useAccess('sales');

    const [orderModal, setOrderModal] = useState<{ order: SalesOrder; payments: PlannedPayment[] } | null>(null);
    const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);
    const [addItemModal, setAddItemModal] = useState<{ isOpen: boolean; mode: 'MACHINE' | 'PART' | 'ORDER' }>({ isOpen: false, mode: 'PART' });
    // Позиция, к которой нужно привязать новый заказ (из кнопки "Привязать заказ")
    const [attachOrderItemId, setAttachOrderItemId] = useState<string | null>(null);

    const {
        batch,
        preCalculation,
        expenses,
        documents,
        itemActuals,
        receptions,
        plannedPayments,
        actualPayments,
        incomingPlannedPayments,
        incomingActualPayments,
        isLoading,
        stats,
        addExpense,
        deleteExpense,
        updateItemActuals,
        updateTimeline,
        updateStatus,
        deleteBatch,
        uploadDocument,
        deleteDocument,
        markItemForDeletion,
        unmarkItemForDeletion,
        permanentDeleteItem,
        addItemToBatch,
        attachOrderToItem,
        refresh: refreshBatchData,
    } = useBatches(id);

    const { statuses, getStatus } = useBatchStatuses();
    const { map: categoryMap } = useBatchCategoryMap();

    const handleOpenOrder = (order: SalesOrder) => {
        // Входящие плановые платежи по заказу (не outgoing расходы партии)
        const orderPayments = incomingPlannedPayments.filter(p => p.sourceDocId === order.id);
        setOrderModal({ order, payments: orderPayments });
    };

    const handleOrderSubmit = async (order: SalesOrder, plans: PlannedPayment[]) => {
        if (isOrderSubmitting) return;
        setIsOrderSubmitting(true);
        try {
            if (!order.id && attachOrderItemId) {
                // Новый заказ для привязки к позиции:
                // создаём напрямую через api чтобы получить ID
                const { items: orderItems = [], ...orderData } = order as any;
                const newOrderId = api.generateId('SO');
                const created = await api.create<SalesOrder>(TableNames.SALES_ORDERS, {
                    ...orderData,
                    id: newOrderId,
                    totalItemCount: orderItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0),
                    shippedItemCount: 0,
                });
                if (orderItems.length > 0) {
                    await api.createMany(TableNames.SALES_ORDER_ITEMS,
                        orderItems.map((i: any) => ({ ...i, id: api.generateId('SOI'), salesOrderId: created.id })));
                }
                if (plans.length > 0) {
                    await api.createMany(TableNames.PLANNED_PAYMENTS,
                        plans.map(p => ({ ...p, sourceDocId: created.id })));
                }
                await attachOrderToItem(attachOrderItemId, created.id, order.clientName);
                setAttachOrderItemId(null);
            } else if (!order.id) {
                await actions.createSalesOrder(order, plans);
            } else {
                await actions.updateSalesOrder(order, plans);
            }
            await Promise.all([
                actions.refreshOperationalData(),
                refreshBatchData?.(),
            ]);
            setOrderModal(null);
        } catch (err: any) {
            alert(`Ошибка при сохранении заказа: ${err.message || 'Неизвестная ошибка'}`);
        } finally {
            setIsOrderSubmitting(false);
        }
    };

    // Добавление позиции в партию (manufacturing)
    const handleAddItemToBatch = async (item: Omit<PreCalculationItem, 'id'>) => {
        await addItemToBatch(item);
        setAddItemModal(prev => ({ ...prev, isOpen: false }));
    };

    // Привязка заказа к позиции без заказа (manufacturing / locked)
    // Открываем форму заказа; при сохранении — если attachOrderItemId установлен,
    // обновляем orderId у позиции через attachOrderToItem
    const handleCreateOrderForItem = (item: PreCalculationItem) => {
        setAttachOrderItemId(item.id);
        const templateOrder: SalesOrder = {
            id: '', name: '', status: 'active' as any,
            clientId: '', clientName: item.clientName || '',
            totalAmount: (item.revenueKzt || 0) * (item.quantity || 1),
            currency: 'KZT' as any, notes: '',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [],
        } as any;
        setOrderModal({ order: templateOrder, payments: [] });
    };

    // Самая ранняя крайняя дата поставки по договору среди позиций предрасчёта
    const earliestDeadline = useMemo(() => {
        if (!preCalculation) return undefined;
        const orderIds = preCalculation.items.map(i => i.orderId).filter(Boolean) as string[];
        const dates = orderIds
            .map(oid => salesOrders.find(o => o.id === oid)?.contractDeliveryDate)
            .filter(Boolean) as string[];
        if (dates.length === 0) return undefined;
        return dates.sort()[0];
    }, [preCalculation, salesOrders]);

    const handleColumnClick = (ctx: SidebarContext) => {
        setSidebarCtx(ctx);
    };

    const closeSidebar = () => {
        setSidebarCtx({ type: 'summary' });
    };


    // ── Loading / Error states ────────────────────────────────────────────────

    if (isLoading && !batch) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Загрузка данных партии...</p>
            </div>
        );
    }

    if (!batch && !isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
                    <AlertTriangle size={40} />
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Партия не найдена</h2>
                <button onClick={() => navigate('/batches')} className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline">
                    Вернуться к списку
                </button>
            </div>
        );
    }

    const profitPositive = (stats?.actualProfit ?? 0) >= 0;
    const profitDiffPositive = (stats?.profitDiffPercent ?? 0) >= 0;

    return (
        <div className="h-full flex flex-col gap-3 xl:gap-4 animate-in fade-in duration-300">

            {/* ── Action Bar ───────────────────────────────────────────── */}
            <div className="flex flex-wrap justify-between items-center gap-3 bg-white px-4 xl:px-6 py-3 xl:py-4 rounded-[1.5rem] xl:rounded-[2rem] border border-slate-200 shadow-sm flex-none">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/batches')}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base xl:text-lg font-black text-slate-900 uppercase tracking-tight">{batch?.name}</h1>
                        </div>
                        <div className="flex items-center gap-2 xl:gap-3 mt-0.5 flex-wrap">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                Предрасчёт от {batch?.date ? new Date(batch.date).toLocaleDateString('ru-RU') : '—'}
                            </p>
                            {earliestDeadline && (
                                <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                    <Calendar size={10}/>
                                    Дедлайн: {new Date(earliestDeadline).toLocaleDateString('ru-RU')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Дропдаун статуса */}
                    {batch && (
                        <div className="relative">
                            <button
                                onClick={() => setStatusOpen(v => !v)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${getStatusColors(getStatus(batch.status).color).badge}`}
                            >
                                {getStatus(batch.status).label}
                                <ChevronDown size={11} />
                            </button>
                            {statusOpen && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 min-w-[200px]">
                                    {statuses.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={async () => {
                                                await updateStatus(s.id);
                                                setStatusOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors ${
                                                batch.status === s.id ? 'text-indigo-600' : 'text-slate-600'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Удалить (только для Открытой) */}
                    {batch?.status === 'open' && (
                        deleteConfirm ? (
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black uppercase tracking-widest text-red-500">Удалить?</span>
                                <button
                                    onClick={async () => {
                                        await deleteBatch();
                                        navigate('/batches');
                                    }}
                                    className="px-3 py-2 bg-red-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all"
                                >
                                    Да
                                </button>
                                <button
                                    onClick={() => setDeleteConfirm(false)}
                                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Нет
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setDeleteConfirm(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-xl border border-red-100 text-[11px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                            >
                                <Trash2 size={12} /> Удалить
                            </button>
                        )
                    )}

                    {/* Навигация по вкладкам */}
                    <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl" aria-label="Tabs">
                        {([
                            { id: 'LIST',      label: 'Позиции',   icon: Layers       },
                            { id: 'EXPENSES',  label: 'Расходы',   icon: DollarSign   },
                            { id: 'COMPARISON',label: 'Сравнение', icon: BarChart3     },
                            { id: 'TIMELINE',  label: 'Сроки',     icon: CalendarClock },
                            { id: 'DOCUMENTS', label: 'Документы', icon: FileText      },
                            { id: 'INVOICES',  label: 'Инвойсы',   icon: ScrollText   },
                        ] as const).map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    title={tab.label}
                                    className={`flex items-center gap-1.5 px-2 xl:px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-white shadow text-blue-600'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <Icon size={12} />
                                    <span className="hidden lg:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                </div>
            </div>

            {/* ── KPI Bar ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 xl:gap-3 flex-none">
                <KpiCard
                    label="Выручка (факт)"
                    value={fmtShort(stats?.actualRevenue)}
                    sub={`план: ${fmtShort(stats?.plannedRevenue)}`}
                    progress={stats?.revenueProgress}
                    color="text-emerald-600"
                />
                <KpiCard
                    label="Расходы (факт)"
                    value={fmtShort(stats?.totalActualExpenses)}
                    sub={`план: ${fmtShort(stats?.plannedExpenses)}`}
                    color="text-amber-600"
                />
                <KpiCard
                    label="Прибыль (факт)"
                    value={fmtShort(stats?.actualProfit)}
                    sub={stats?.profitDiffPercent != null
                        ? `${profitDiffPositive ? '+' : ''}${stats.profitDiffPercent.toFixed(1)}% от прогноза`
                        : `план: ${fmtShort(stats?.plannedProfit)}`}
                    color={profitPositive ? 'text-blue-600' : 'text-red-500'}
                />
                <KpiCard
                    label="Позиций"
                    value={`${preCalculation?.items.length ?? 0} шт.`}
                    sub={`${receptions.length} приёмок · ${expenses.length} расходов`}
                    color="text-slate-700"
                />
            </div>

            {/* ── Основная область: контент + сайдбар ─────────────────── */}
            <div className="flex-1 min-h-0 flex gap-3 xl:gap-4">
                {/* Контент вкладки */}
                <div className="flex-1 min-w-0 bg-white rounded-[1.5rem] xl:rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col p-4 xl:p-6">
                    {activeTab === 'LIST' && preCalculation && batch && (
                        <BatchMainListTab
                            batch={batch}
                            preCalculation={preCalculation}
                            itemActuals={itemActuals}
                            expenses={expenses}
                            salesOrders={salesOrders}
                            incomingPlannedPayments={incomingPlannedPayments}
                            onColumnHeaderClick={handleColumnClick}
                            onChinaClick={() => setShowChinaModal(true)}
                            onOpenOrder={handleOpenOrder}
                            onRevenueItemClick={(itemId) => setSidebarCtx({ type: 'revenueItem', itemId })}
                            onCreateOrderForItem={handleCreateOrderForItem}
                            onMarkDelete={markItemForDeletion}
                            onUnmarkDelete={unmarkItemForDeletion}
                            onPermanentDelete={permanentDeleteItem}
                            onRequestAddItem={() => setAddItemModal({ isOpen: true, mode: 'PART' })}
                        />
                    )}
                    {activeTab === 'EXPENSES' && (
                        <BatchExpensesTab
                            expenses={expenses}
                            onDeleteExpense={deleteExpense}
                            onOpenSidebar={handleColumnClick}
                        />
                    )}
                    {activeTab === 'COMPARISON' && preCalculation && (
                        <BatchComparisonTab
                            preCalculation={preCalculation}
                            itemActuals={itemActuals}
                            expenses={expenses}
                        />
                    )}
                    {activeTab === 'DOCUMENTS' && (
                        <BatchDocumentsTab
                            documents={documents}
                            onUpload={uploadDocument}
                            onDelete={deleteDocument}
                        />
                    )}
                    {activeTab === 'TIMELINE' && (
                        <BatchTimelineTab
                            timeline={batch?.timeline}
                            earliestDeadline={earliestDeadline}
                            onSave={updateTimeline}
                        />
                    )}
                    {activeTab === 'INVOICES' && preCalculation && batch && (
                        <BatchInvoicesTab
                            preCalculation={preCalculation}
                            batch={batch}
                            optionVariants={state.optionVariants ?? []}
                            hscodes={state.hscodes ?? []}
                        />
                    )}
{!preCalculation && (activeTab === 'LIST' || activeTab === 'COMPARISON') && (
                        <div className="flex-1 flex items-center justify-center text-slate-300">
                            <div className="text-center">
                                <Layers size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Предрасчёт не найден</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Сайдбар — всегда видим */}
                <BatchSidebar
                    batchId={id!}
                    context={sidebarCtx}
                    onClose={closeSidebar}
                    stats={stats}
                    expenses={expenses}
                    receptions={receptions}
                    plannedPayments={plannedPayments}
                    actualPayments={actualPayments}
                    incomingPlannedPayments={incomingPlannedPayments}
                    incomingActualPayments={incomingActualPayments}
                    preCalculationItems={preCalculation?.items ?? []}
                    salesOrders={salesOrders}
                    cashFlowItems={cashFlowItems}
                    categoryMap={categoryMap}
                    onAddExpense={addExpense}
                    onUpdateItemRevenue={updateItemActuals}
                />
            </div>

            {/* Модал просмотра/редактирования заказа */}
            {orderModal && (
                <div className="fixed inset-0 z-[10000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-300">
                    <div className="w-full max-w-7xl h-full flex flex-col relative animate-in zoom-in-95 duration-200">
                        <div className="absolute -top-12 right-0 flex items-center gap-3">
                            <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl border border-white/20 shadow-xl">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    Заказ: {orderModal.order.name || orderModal.order.id}
                                </p>
                            </div>
                            <button onClick={() => setOrderModal(null)} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all border border-white/20 shadow-xl active:scale-95">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {isOrderSubmitting ? (
                                <div className="w-full h-full bg-white/80 flex flex-col items-center justify-center rounded-[2rem]">
                                    <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                                    <p className="text-lg font-black text-slate-800 uppercase tracking-widest">Сохраняем заказ...</p>
                                </div>
                            ) : (
                                <SalesOrderForm
                                    initialOrder={orderModal.order}
                                    initialPayments={orderModal.payments}
                                    state={state}
                                    actions={actions}
                                    access={salesAccess}
                                    onCancel={() => setOrderModal(null)}
                                    onSubmit={handleOrderSubmit}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Модал добавления позиции (manufacturing) */}
            <AddItemModal
                isOpen={addItemModal.isOpen}
                mode={addItemModal.mode}
                onClose={() => setAddItemModal(prev => ({ ...prev, isOpen: false }))}
                onAddItem={handleAddItemToBatch}
            />

            {/* Модал доставки по Китаю */}
            {showChinaModal && preCalculation && (
                <ChinaDeliveryModal
                    items={preCalculation.items}
                    batchId={id!}
                    chinaExpenses={expenses.filter(e => e.category === 'logistics_china_domestic')}
                    actualPayments={actualPayments}
                    plannedPayments={plannedPayments}
                    cashFlowItems={cashFlowItems}
                    onAdd={addExpense}
                    onDelete={deleteExpense}
                    onOpenPayment={(paymentId) => {
                        setShowChinaModal(false);
                        navigate('/finance_statements', { state: { highlightPaymentId: paymentId } });
                    }}
                    onClose={() => setShowChinaModal(false)}
                />
            )}
        </div>
    );
};

// ── KPI карточка ─────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    label: string;
    value: string;
    sub: string;
    color: string;
    progress?: number;
}> = ({ label, value, sub, color, progress }) => (
    <div className="bg-white rounded-xl xl:rounded-2xl border border-slate-200 shadow-sm px-3 xl:px-5 py-3 xl:py-4">
        <div className="text-[10px] xl:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5 xl:mb-2">{label}</div>
        <div className={`text-base xl:text-xl font-black tabular-nums tracking-tighter ${color}`}>{value}</div>
        <div className="text-[10px] xl:text-[11px] font-bold text-slate-400 mt-1">{sub}</div>
        {progress != null && (
            <div className="mt-1.5 xl:mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, progress)}%` }}
                />
            </div>
        )}
    </div>
);
