import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { PreCalculationItem, PreCalculationItemOption } from '@/types/pre-calculations';
import { BatchTimeline } from '@/types/batch';
import { PreCalculationList } from '../components/list/PreCalculationList';
import { GeneralSettings } from '../components/general-settings/GeneralSettings';
import { DetailedList } from '../components/detailed-list/DetailedList';
import { BatchTimelineTab, ContractDeadline } from '../../batches/components/BatchTimelineTab';
import { ArrowLeft, Save, List, Settings, Loader2, AlertTriangle, Edit3, Layers, CalendarClock, Calendar, Lock, ExternalLink } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePreCalculations } from '../hooks/usePreCalculations';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { Batch } from '@/types';
import { getBatchPhase } from '../../batches/utils/batchPhase';

export const PreCalculationEditorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'DETAILED_LIST' | 'SETTINGS' | 'TIMELINE'>('DETAILED_LIST');
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { state } = useStore();
    const salesOrders = state.salesOrders;
    const plannedPayments = state.plannedPayments || [];

    const {
        preCalculation,
        generalSettings,
        items,
        isLoading,
        savePreCalculation,
        updateGeneralSetting,
        updateMetadata,
        addItem,
        updateItem,
        updateItemsBatch,
        deleteItem,
        createNew
    } = usePreCalculations(id);

    const isNew = id === 'new';

    // Связанная партия — нужна для определения режима read-only
    const [linkedBatch, setLinkedBatch] = useState<Batch | null>(null);

    useEffect(() => {
        if (!id || id === 'new') return;
        api.fetchAll<Batch>(TableNames.BATCHES, { preCalculationId: id })
            .then(batches => setLinkedBatch(batches[0] ?? null))
            .catch(() => setLinkedBatch(null));
    }, [id]);

    const batchPhase = linkedBatch ? getBatchPhase(linkedBatch.status) : null;
    // Предрасчёт нельзя редактировать когда партия в manufacturing или заблокирована
    const isReadOnly = batchPhase === 'manufacturing' || batchPhase === 'locked';

    // Дедлайны по договорам для всех позиций предрасчёта
    const contractDeadlines = useMemo((): ContractDeadline[] => {
        const seen = new Set<string>();
        const result: ContractDeadline[] = [];
        for (const item of items) {
            if (!item.orderId) continue;
            const order = salesOrders.find(o => o.id === item.orderId);
            if (!order?.contractDeliveryDate) continue;
            if (seen.has(item.orderId)) continue;
            seen.add(item.orderId);
            result.push({
                orderId: item.orderId,
                date: order.contractDeliveryDate,
                clientName: item.clientName || order.clientName,
            });
        }
        return result;
    }, [items, salesOrders]);

    const earliestDeadline = useMemo(() => {
        const dates = contractDeadlines.map(d => d.date);
        return dates.length > 0 ? dates.sort()[0] : undefined;
    }, [contractDeadlines]);

    const handleSaveTimeline = useCallback(async (timeline: BatchTimeline) => {
        updateMetadata({ timeline });
        await savePreCalculation();
    }, [updateMetadata, savePreCalculation]);
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (isNew && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            createNew();
        }
    }, [isNew, createNew]);

    const handleSave = async () => {
        try {
            const savedId = await savePreCalculation();
            if (isNew && savedId) {
                navigate(`/pre-calculations/${savedId}`, { replace: true });
            }
        } catch (error) {
            console.error("Save failed:", error);
        }
    };

    const handleCreateBatch = async () => {
        if (!preCalculation || isNew) return;

        try {
            await savePreCalculation();

            // Плановые показатели из позиций
            const plannedRevenueKzt = items.reduce((s, i) => s + (i.revenueKzt || 0), 0);
            const plannedPurchaseKzt = items.reduce((s, i) => s + (i.purchasePriceKzt || 0), 0);
            const plannedProfit = items.reduce((s, i) => s + (i.profitKzt || 0), 0);

            // Плановые расходы из generalSettings (суммируем по всем позициям)
            const plannedLogisticsUrumqiAlmatyKzt = items.reduce((s, i) => s + (i.deliveryUrumqiAlmatyKzt || 0), 0);
            const plannedLogisticsAlmatyKaragandaKzt = items.reduce((s, i) => s + (i.deliveryAlmatyKaragandaPerItemKzt || 0), 0);
            const plannedSvhKzt = items.reduce((s, i) => s + (i.svhPerItemKzt || 0), 0);
            const plannedBrokerKzt = items.reduce((s, i) => s + (i.brokerPerItemKzt || 0), 0);
            const plannedCustomsKzt = items.reduce((s, i) => s + (i.customsFeesPerItemKzt || 0), 0);

            const batchId = api.generateId('B');
            const newBatch = {
                id: batchId,
                preCalculationId: preCalculation.id,
                name: `Партия: ${preCalculation.name}`,
                status: 'open',
                date: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                supplierOrderIds: [],
                plannedRevenueKzt: plannedRevenueKzt,
                plannedPurchaseKzt,
                plannedLogisticsUrumqiAlmatyKzt,
                plannedLogisticsAlmatyKaragandaKzt,
                plannedLogisticsChinaDomesticKzt: items.reduce((s, i) => s + ((i.deliveryChinaDomesticKzt || 0) * (i.quantity || 1)), 0),
                plannedSvhKzt,
                plannedBrokerKzt,
                plannedCustomsKzt,
                totalPlannedProfit: plannedProfit,
            };

            await api.create(TableNames.BATCHES, newBatch);

            const itemActuals = items.map(item => {
                let actualRevenueKzt = 0;
                if (item.orderId) {
                    const order = salesOrders.find(o => o.id === item.orderId);
                    if (order && (order.totalAmount || 0) > 0) {
                        const orderPaid = plannedPayments
                            .filter(p => p.sourceDocId === order.id && p.direction === 'Incoming')
                            .reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
                        const itemRevShare = ((item.revenueKzt || 0) * (item.quantity || 1)) / order.totalAmount;
                        actualRevenueKzt = Math.round(orderPaid * itemRevShare);
                    }
                }
                return {
                    id: api.generateId('BIA'),
                    batchId: batchId,
                    preCalculationItemId: item.id,
                    actualRevenueKzt,
                    actualPurchaseKzt: 0,
                };
            });

            await api.createMany(TableNames.BATCH_ITEM_ACTUALS, itemActuals);

            navigate(`/batches/${batchId}`);

        } catch (error) {
            console.error("Failed to create batch:", error);
            alert("Ошибка при создании партии");
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Обработка данных...</p>
                </div>
            );
        }

        if (!isNew && !preCalculation && !isLoading) {
            return (
                <div className="p-12 text-center text-red-500">
                    <AlertTriangle className="mx-auto h-8 w-8" />
                    <h2 className="mt-4 text-base font-bold uppercase tracking-tight">Предрасчет не найден</h2>
                    <button 
                        onClick={() => navigate('/pre-calculations')}
                        className="mt-6 text-blue-600 font-black uppercase text-[10px] hover:underline flex items-center justify-center gap-2 mx-auto tracking-widest"
                    >
                        <ArrowLeft size={14} /> К списку
                    </button>
                </div>
            );
        }

        switch (activeTab) {
            case 'DETAILED_LIST':
                return (
                    <DetailedList
                        items={items}
                        preCalculationName={preCalculation?.name}
                        onAddItem={addItem}
                        onUpdateItem={updateItem}
                        onUpdateItemsBatch={updateItemsBatch}
                        onDeleteItem={deleteItem}
                        readOnly={isReadOnly}
                    />
                );
            case 'SETTINGS':
                return <GeneralSettings settings={generalSettings} onSettingChange={updateGeneralSetting} readOnly={isReadOnly} />;
            case 'TIMELINE':
                return (
                    <BatchTimelineTab
                        timeline={preCalculation?.timeline}
                        earliestDeadline={earliestDeadline}
                        contractDeadlines={contractDeadlines}
                        onSave={handleSaveTimeline}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-[calc(100vh-2.5rem)] xl:h-[calc(100vh-3rem)] flex flex-col space-y-3 overflow-hidden">

            {/* Баннер read-only когда партия заблокировала предрасчёт */}
            {isReadOnly && linkedBatch && (
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border flex-none ${
                    batchPhase === 'manufacturing'
                        ? 'bg-violet-50 border-violet-200 text-violet-700'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}>
                    <Lock size={14} className="shrink-0" />
                    <p className="text-[11px] font-black uppercase tracking-widest flex-1">
                        {batchPhase === 'manufacturing'
                            ? 'Партия в статусе «Изготовление» — предрасчёт только для просмотра. Управление позициями перешло в партию.'
                            : 'Предрасчёт заблокирован — партия завершена или в финальном статусе.'}
                    </p>
                    <button
                        onClick={() => navigate(`/batches/${linkedBatch.id}`)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                            batchPhase === 'manufacturing'
                                ? 'bg-violet-100 border-violet-300 hover:bg-violet-200'
                                : 'bg-slate-200 border-slate-300 hover:bg-slate-300'
                        }`}
                    >
                        <ExternalLink size={11} /> Открыть партию
                    </button>
                </div>
            )}
            <div className="flex flex-wrap justify-between items-center gap-2 bg-white px-4 xl:px-5 py-3 rounded-2xl border border-slate-200 flex-none shadow-sm">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                        onClick={() => navigate('/pre-calculations')}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shrink-0 active:scale-95"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 group">
                            <input
                                type="text"
                                value={preCalculation?.name || ''}
                                onChange={(e) => !isReadOnly && updateMetadata({ name: e.target.value })}
                                readOnly={isReadOnly}
                                placeholder="Введите название предрасчета..."
                                className={`text-sm font-black text-slate-800 uppercase tracking-tight leading-none bg-transparent border-none outline-none rounded px-1 -ml-1 w-full max-w-[400px] xl:max-w-[500px] placeholder:text-slate-400 ${isReadOnly ? 'cursor-default' : 'focus:ring-2 focus:ring-blue-100'}`}
                            />
                            {!isReadOnly && <Edit3 size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-slate-400 font-bold tracking-widest uppercase">
                                {isNew ? 'Новый документ' : `ID: ${id?.slice(-8).toUpperCase()}`}
                            </span>
                            {!isNew && preCalculation?.date && (
                                <>
                                    <span className="text-slate-300 text-[10px]">•</span>
                                    <span className="text-[11px] text-slate-400 font-bold tracking-widest uppercase">
                                        {new Date(preCalculation.date).toLocaleDateString('ru-RU')}
                                    </span>
                                </>
                            )}
                            {earliestDeadline && (
                                <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                    <Calendar size={10}/>
                                    Дедлайн: {new Date(earliestDeadline).toLocaleDateString('ru-RU')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {!isNew && !isReadOnly && (
                        <button
                            onClick={handleCreateBatch}
                            className="flex items-center gap-2 px-4 xl:px-5 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-100"
                        >
                            <Layers size={13} /> Создать партию
                        </button>
                    )}

                    <nav className="flex gap-0.5 bg-slate-100 p-1 rounded-xl" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('DETAILED_LIST')}
                            className={`flex items-center gap-1.5 px-3 xl:px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'DETAILED_LIST' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <List size={12} /> <span className="hidden xl:inline">Список</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('SETTINGS')}
                            className={`flex items-center gap-1.5 px-3 xl:px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'SETTINGS' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Settings size={12} /> <span className="hidden xl:inline">Настройки</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('TIMELINE')}
                            className={`flex items-center gap-1.5 px-3 xl:px-4 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'TIMELINE' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <CalendarClock size={12} /> <span className="hidden xl:inline">Сроки</span>
                            {earliestDeadline && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5"/>}
                        </button>
                    </nav>

                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={isLoading || !preCalculation?.name}
                            className="flex items-center gap-2 px-5 xl:px-6 py-2 bg-blue-600 text-white rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {isNew ? 'Создать' : 'Сохранить'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>
        </div>
    );
};
