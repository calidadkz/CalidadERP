import React, { useEffect, useState } from 'react';
import { PlusCircle, Layers, ArrowRight, TrendingUp, TrendingDown, Loader2, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Batch } from '@/types';
import { api } from '@/services';
import { TableNames } from '@/constants';
import { useBatchStatuses, getStatusColors } from './hooks/useBatchStatuses';
import { useBatchCategoryMap } from './hooks/useBatchCategoryMap';
import { BatchCategoryMappingTab } from './components/BatchCategoryMappingTab';
import { useStore } from '@/features/system/context/GlobalStore';

const fmt = (val?: number) =>
    (val || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

type Tab = 'LIST' | 'PRIORITIES';

export const BatchesPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('LIST');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { getStatus } = useBatchStatuses();
    const { map: categoryMap, update: updateCategoryMap, reset: resetCategoryMap } = useBatchCategoryMap();
    const { state } = useStore();
    const cashFlowItems = state.cashFlowItems;

    useEffect(() => {
        api.fetchAll<Batch>(TableNames.BATCHES)
            .then(data => setBatches(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const activeBatches = batches.filter(b => b.status !== 'completed');

    return (
        <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-3 bg-white px-5 py-4 xl:px-8 xl:py-5 rounded-[1.5rem] xl:rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 xl:w-12 xl:h-12 bg-indigo-600 text-white rounded-xl xl:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/20 flex-none">
                        <Layers size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg xl:text-xl font-black text-slate-900 uppercase tracking-tight">Партии</h1>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">Учет фактических расходов и логистики</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Переключатель вкладок */}
                    <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('LIST')}
                            className={`flex items-center gap-1.5 px-3 xl:px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'LIST' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Layers size={12} /> Партии
                        </button>
                        <button
                            onClick={() => setActiveTab('PRIORITIES')}
                            className={`flex items-center gap-1.5 px-3 xl:px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                activeTab === 'PRIORITIES' ? 'bg-white shadow text-violet-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <SlidersHorizontal size={12} /> Приоритеты ДДС
                        </button>
                    </nav>

                    {activeTab === 'LIST' && (
                        <>
                            <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 hidden xl:block">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Активных партий</div>
                                <div className="text-lg font-black text-indigo-600 tabular-nums">{activeBatches.length}</div>
                            </div>
                            <button
                                onClick={() => navigate('/pre-calculations')}
                                className="flex items-center gap-2 px-5 xl:px-7 py-3 bg-indigo-600 text-white rounded-xl xl:rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
                            >
                                <PlusCircle size={16} /> Создать из предрасчета
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Контент */}
            {activeTab === 'PRIORITIES' ? (
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
                    <BatchCategoryMappingTab
                        categoryMap={categoryMap}
                        cashFlowItems={cashFlowItems}
                        onUpdate={updateCategoryMap}
                        onReset={resetCategoryMap}
                    />
                </div>
            ) : (
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-indigo-600" size={40} />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Загрузка партий...</p>
                        </div>
                    ) : batches.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6 border border-slate-100">
                                <Layers size={48} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Партии не найдены</h3>
                            <p className="text-slate-400 text-sm font-medium max-w-xs mb-8 leading-relaxed">
                                Создайте новую партию на основании готового предрасчета, чтобы начать учет факта.
                            </p>
                            <button
                                onClick={() => navigate('/pre-calculations')}
                                className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline flex items-center gap-2"
                            >
                                Перейти к предрасчетам <ArrowRight size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-auto flex-1">
                            <table className="w-full border-collapse text-left">
                                <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                                    <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        <th className="px-5 xl:px-8 py-3 xl:py-4">Партия</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4">Статус</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4 hidden xl:table-cell">Дата создания</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4 hidden xl:table-cell">Ожид. приход</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4 text-right">Пл. выручка</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4 text-right">Пл. прибыль</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4 text-right">Факт. прибыль</th>
                                        <th className="px-4 xl:px-6 py-3 xl:py-4 text-right">Откл.</th>
                                        <th className="px-4 py-3 xl:py-4 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {batches.map(batch => {
                                        const statusRec = getStatus(batch.status);
                                        const statusColors = getStatusColors(statusRec.color);
                                        const planned = batch.totalPlannedProfit || 0;
                                        const actual = batch.totalActualProfit || 0;
                                        const diffPct = planned !== 0 ? ((actual - planned) / Math.abs(planned)) * 100 : null;
                                        const isPositive = diffPct !== null && diffPct >= 0;

                                        return (
                                            <tr
                                                key={batch.id}
                                                onClick={() => navigate(`/batches/${batch.id}`)}
                                                className="group hover:bg-slate-50/70 cursor-pointer transition-colors"
                                            >
                                                <td className="px-5 xl:px-8 py-3 xl:py-4">
                                                    <div className="font-black text-sm text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                                                        {batch.name}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-400 mt-0.5 font-mono">
                                                        {batch.id}
                                                    </div>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${statusColors.badge}`}>
                                                        {statusRec.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4 hidden xl:table-cell">
                                                    <div className="text-xs font-bold text-slate-600 font-mono">
                                                        {new Date(batch.date).toLocaleDateString('ru-RU')}
                                                    </div>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4 hidden xl:table-cell">
                                                    <div className="text-xs font-bold text-slate-600 font-mono">
                                                        {batch.expectedArrivalDate
                                                            ? new Date(batch.expectedArrivalDate).toLocaleDateString('ru-RU')
                                                            : <span className="text-slate-400">—</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4 text-right">
                                                    <div className="text-xs font-black text-slate-700 tabular-nums font-mono">
                                                        {fmt(batch.plannedRevenueKzt)}
                                                    </div>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4 text-right">
                                                    <div className="text-xs font-black text-slate-700 tabular-nums font-mono">
                                                        {fmt(planned)}
                                                    </div>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4 text-right">
                                                    <div className={`text-xs font-black tabular-nums font-mono ${actual > 0 ? 'text-emerald-600' : actual < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {actual !== 0 ? fmt(actual) : '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 xl:px-6 py-3 xl:py-4 text-right">
                                                    {diffPct !== null && actual !== 0 ? (
                                                        <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                            {Math.abs(diffPct).toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px] font-black">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 xl:py-4">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ArrowRight size={16} className="text-indigo-400" />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
