import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { PreCalculationItem, PreCalculationItemOption, PackingListItem } from '@/types/pre-calculations';
import { PreCalculationList } from '../components/list/PreCalculationList';
import { GeneralSettings } from '../components/general-settings/GeneralSettings';
import { PackingList } from '../components/packing-list/PackingList';
import { DetailedList } from '../components/detailed-list/DetailedList';
import { ArrowLeft, Save, List, Settings, Package, Loader2, AlertTriangle, Edit3, Layers } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePreCalculations } from '../hooks/usePreCalculations';
import { api } from '@/services';
import { TableNames } from '@/constants';

export const PreCalculationEditorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'DETAILED_LIST' | 'SETTINGS' | 'PACKING_LIST'>('DETAILED_LIST');
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { 
        preCalculation, 
        generalSettings, 
        items, 
        packingList, 
        isLoading, 
        savePreCalculation,
        updateGeneralSetting,
        updateMetadata,
        addItem,
        updateItem,
        updateItemsBatch,
        deleteItem,
        addPackingItem,
        updatePackingItem,
        deletePackingItem,
        createNew
    } = usePreCalculations(id);

    const isNew = id === 'new';
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
                status: 'active',
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

            const itemActuals = items.map(item => ({
                id: api.generateId('BIA'),
                batchId: batchId,
                preCalculationItemId: item.id,
                actualRevenueKzt: 0,
                actualPurchaseKzt: 0,
            }));

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
                    />
                );
            case 'SETTINGS':
                return <GeneralSettings settings={generalSettings} onSettingChange={updateGeneralSetting} />;
            case 'PACKING_LIST':
                return <PackingList items={packingList} onAddItem={addPackingItem} onUpdateItem={updatePackingItem} onDeleteItem={deletePackingItem} />;
            default:
                return null;
        }
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col space-y-3 p-3 overflow-hidden">
            <div className="flex justify-between items-center bg-white px-4 py-3 rounded-2xl border border-slate-200 flex-none shadow-sm">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button 
                        onClick={() => navigate('/pre-calculations')}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shrink-0 active:scale-95"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 group">
                            <input 
                                type="text"
                                value={preCalculation?.name || ''}
                                onChange={(e) => updateMetadata({ name: e.target.value })}
                                placeholder="Введите название предрасчета..."
                                className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 rounded px-1 -ml-1 w-full max-w-[500px] placeholder:text-slate-300"
                            />
                            <Edit3 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                                {isNew ? 'Создание нового документа' : `ID: ${id}`}
                            </span>
                            {!isNew && preCalculation?.date && (
                                <>
                                    <span className="text-slate-200 text-[8px]">•</span>
                                    <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                                        {new Date(preCalculation.date).toLocaleDateString()}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                    {!isNew && (
                        <button 
                            onClick={handleCreateBatch}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-100 transition-all active:scale-95 mr-2 border border-indigo-100"
                        >
                            <Layers size={14} /> Создать партию
                        </button>
                    )}

                    <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl mr-4" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('DETAILED_LIST')}
                            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'DETAILED_LIST' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <List size={12} /> Список
                        </button>
                        <button
                            onClick={() => setActiveTab('SETTINGS')}
                            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'SETTINGS' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Settings size={12} /> Настройки
                        </button>
                        <button
                            onClick={() => setActiveTab('PACKING_LIST')}
                            className={`flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'PACKING_LIST' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Package size={12} /> Упаковка
                        </button>
                    </nav>

                    <button 
                        onClick={handleSave}
                        disabled={isLoading || !preCalculation?.name}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isNew ? 'Создать' : 'Сохранить'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>
        </div>
    );
};
