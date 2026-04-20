import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Tag, ChevronRight, PackageCheck } from 'lucide-react';
import { Reception } from '@/types';
import { BatchStats, fmt, fmtShort } from './types';

interface SummaryPanelProps {
    stats: BatchStats;
    receptions: Reception[];
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ stats, receptions }) => {
    const profitPositive = stats.actualProfit >= 0;
    const profitDiffPositive = stats.profitDiffPercent >= 0;

    return (
        <div className="p-5 space-y-4">
            {/* Прибыль — главная карточка */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-600/10 rounded-full blur-2xl" />
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <DollarSign size={10} className="text-blue-400" /> Факт. прибыль
                </div>
                <div className={`text-2xl font-black tabular-nums tracking-tighter ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtShort(stats.actualProfit)}
                </div>
                <div className={`text-[10px] font-black mt-1 flex items-center gap-1 ${profitDiffPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                    {profitDiffPositive ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                    {stats.profitDiffPercent > 0 ? '+' : ''}{stats.profitDiffPercent.toFixed(1)}% от прогноза
                </div>
            </div>

            {/* Выручка */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <TrendingUp size={10} className="text-emerald-500" /> Выручка
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Прогноз</div>
                        <div className="text-sm font-black text-slate-600 tabular-nums">{fmtShort(stats.plannedRevenue)}</div>
                    </div>
                    <ChevronRight size={14} className="text-slate-200 mx-2" />
                    <div className="text-right">
                        <div className="text-[9px] text-emerald-600 font-black uppercase">Факт</div>
                        <div className="text-sm font-black text-emerald-600 tabular-nums">{fmtShort(stats.actualRevenue)}</div>
                    </div>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, stats.revenueProgress)}%` }}
                    />
                </div>
                <div className="text-[8px] font-bold text-slate-400 text-right">{stats.revenueProgress.toFixed(0)}%</div>
            </div>

            {/* Расходы */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Tag size={10} className="text-amber-500" /> Расходы
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Прогноз</div>
                        <div className="text-sm font-black text-slate-600 tabular-nums">{fmtShort(stats.plannedExpenses)}</div>
                    </div>
                    <ChevronRight size={14} className="text-slate-200 mx-2" />
                    <div className="text-right">
                        <div className="text-[9px] text-amber-600 font-black uppercase">Факт</div>
                        <div className="text-sm font-black text-amber-600 tabular-nums">{fmtShort(stats.totalActualExpenses)}</div>
                    </div>
                </div>
            </div>

            {/* Прогноз прибыли */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Прогноз прибыли</span>
                <span className="text-sm font-black text-slate-700 tabular-nums">{fmtShort(stats.plannedProfit)}</span>
            </div>

            {/* Приёмки */}
            {receptions.length > 0 && (
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <PackageCheck size={10} className="text-blue-500" /> Приёмки ({receptions.length})
                    </div>
                    <div className="divide-y divide-slate-50">
                        {receptions.map(r => (
                            <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-black text-slate-700">
                                        {new Date(r.date).toLocaleDateString('ru-RU')}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-bold">{r.id.slice(-8).toUpperCase()}</div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                    r.status === 'Posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {r.status === 'Posted' ? 'Проведена' : 'Черновик'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
