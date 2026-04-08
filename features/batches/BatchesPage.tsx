import React, { useEffect, useState } from 'react';
import { PlusCircle, Layers, ArrowRight, TrendingUp, TrendingDown, CheckCircle2, Clock, Archive, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Batch, BatchStatus } from '@/types';
import { api } from '@/services';
import { TableNames } from '@/constants';

const STATUS_CONFIG: Record<BatchStatus, { label: string; icon: React.ReactNode; className: string }> = {
    active:    { label: 'Активная',   icon: <Clock size={12} />,        className: 'bg-blue-50 text-blue-600 border-blue-100' },
    completed: { label: 'Завершена',  icon: <CheckCircle2 size={12} />, className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    closed:    { label: 'Закрыта',    icon: <Archive size={12} />,      className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const fmt = (val?: number) =>
    (val || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

export const BatchesPage: React.FC = () => {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.fetchAll<Batch>(TableNames.BATCHES)
            .then(data => setBatches(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const activeBatches = batches.filter(b => b.status === 'active');

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white px-8 py-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
                        <Layers size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Партии</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Учет фактических расходов и логистики</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 hidden md:block">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Активных партий</div>
                        <div className="text-xl font-black text-indigo-600 tabular-nums">{activeBatches.length}</div>
                    </div>
                    <button
                        onClick={() => navigate('/pre-calculations')}
                        className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-900/20"
                    >
                        <PlusCircle size={18} /> Создать из предрасчета
                    </button>
                </div>
            </div>

            {/* List */}
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
                                <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    <th className="px-8 py-5">Партия</th>
                                    <th className="px-6 py-5">Статус</th>
                                    <th className="px-6 py-5">Дата создания</th>
                                    <th className="px-6 py-5">Ожид. приход</th>
                                    <th className="px-6 py-5 text-right">Пл. выручка</th>
                                    <th className="px-6 py-5 text-right">Пл. прибыль</th>
                                    <th className="px-6 py-5 text-right">Факт. прибыль</th>
                                    <th className="px-6 py-5 text-right">Откл.</th>
                                    <th className="px-6 py-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {batches.map(batch => {
                                    const statusCfg = STATUS_CONFIG[batch.status];
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
                                            <td className="px-8 py-5">
                                                <div className="font-black text-[13px] text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                                                    {batch.name}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-400 mt-0.5 font-mono">
                                                    {batch.id}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${statusCfg.className}`}>
                                                    {statusCfg.icon} {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="text-[11px] font-bold text-slate-600 font-mono">
                                                    {new Date(batch.date).toLocaleDateString('ru-RU')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="text-[11px] font-bold text-slate-600 font-mono">
                                                    {batch.expectedArrivalDate
                                                        ? new Date(batch.expectedArrivalDate).toLocaleDateString('ru-RU')
                                                        : <span className="text-slate-300">—</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="text-[12px] font-black text-slate-700 tabular-nums font-mono">
                                                    {fmt(batch.plannedRevenueKzt)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="text-[12px] font-black text-slate-700 tabular-nums font-mono">
                                                    {fmt(planned)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className={`text-[12px] font-black tabular-nums font-mono ${actual > 0 ? 'text-emerald-600' : actual < 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                                    {actual !== 0 ? fmt(actual) : '—'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                {diffPct !== null && actual !== 0 ? (
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                        {Math.abs(diffPct).toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-200 text-[10px] font-black">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
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
        </div>
    );
};
