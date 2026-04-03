import React from 'react';
import { PreCalculationItem, BatchItemActuals, PreCalculationDocument } from '@/types';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface BatchEconomyTabProps {
    preCalculation: PreCalculationDocument;
    itemActuals: BatchItemActuals[];
}

export const BatchEconomyTab: React.FC<BatchEconomyTabProps> = ({ preCalculation, itemActuals }) => {
    const formatCurrency = (val: number) => 
        val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

    const getActualForItem = (itemId: string) => {
        return itemActuals.find(a => a.preCalculationItemId === itemId);
    };

    const calculateVariance = (fact: number, plan: number) => {
        const diff = fact - plan;
        const percent = plan !== 0 ? (diff / Math.abs(plan)) * 100 : 0;
        return { diff, percent };
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Экономический анализ позиций</h3>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-blue-100">
                        <Info size={12} /> Сравнение с предрасчетом
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                <table className="w-full border-collapse text-left table-fixed">
                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-100 shadow-sm">
                        <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                            <th className="px-6 py-4 w-1/3">Наименование товара</th>
                            <th className="px-6 py-4 text-right">Выручка (Пл/Фк)</th>
                            <th className="px-6 py-4 text-right">Закуп (Пл/Фк)</th>
                            <th className="px-6 py-4 text-right">Прибыль (Прогноз)</th>
                            <th className="px-6 py-4 text-right">Отклонение</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {preCalculation.items.map((item) => {
                            const actual = getActualForItem(item.id);
                            const revenueVar = calculateVariance(actual?.actualRevenueKzt || 0, item.revenueKzt);
                            const purchaseVar = calculateVariance(actual?.actualPurchaseKzt || 0, item.purchasePriceKzt);
                            
                            // Расчет прибыли для строки: Факт.Выручка - (Все факт.расходы не делятся тут, поэтому показываем маржинальность)
                            // Для простоты в этой таблице сравниваем только прямые доходы и расходы закупа
                            const plannedProfit = item.profitKzt;
                            const currentFactProfit = (actual?.actualRevenueKzt || 0) - (actual?.actualPurchaseKzt || 0);

                            return (
                                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-snug">{item.name}</div>
                                            <div className="text-[9px] font-bold text-blue-500 font-mono flex items-center gap-1">
                                                ID: {item.id.slice(-6)} <span className="text-slate-300">•</span> SKU: {item.sku || '—'}
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-5 text-right">
                                        <div className="text-[10px] font-bold text-slate-400 tabular-nums mb-0.5">{formatCurrency(item.revenueKzt)}</div>
                                        <div className={`text-[12px] font-black tabular-nums ${revenueVar.diff < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                            {formatCurrency(actual?.actualRevenueKzt || 0)}
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 text-right">
                                        <div className="text-[10px] font-bold text-slate-400 tabular-nums mb-0.5">{formatCurrency(item.purchasePriceKzt)}</div>
                                        <div className={`text-[12px] font-black tabular-nums ${purchaseVar.diff > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                                            {formatCurrency(actual?.actualPurchaseKzt || 0)}
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 text-right">
                                        <div className="text-[10px] font-bold text-slate-400 tabular-nums mb-0.5">{formatCurrency(plannedProfit)}</div>
                                        <div className="text-[12px] font-black text-emerald-600 tabular-nums">
                                            {/* Тут показываем расчетную прибыль на основе текущих фактов по строке */}
                                            {formatCurrency(currentFactProfit)}
                                        </div>
                                    </td>

                                    <td className="px-6 py-5 text-right">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${
                                            revenueVar.diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                        }`}>
                                            {revenueVar.diff >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                            {Math.abs(revenueVar.percent).toFixed(1)}%
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                            {revenueVar.diff >= 0 ? '+' : ''}{formatCurrency(revenueVar.diff)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="space-y-1">
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Итого по плану (Прибыль)</div>
                            <div className="text-xl font-black text-white tabular-nums">
                                {formatCurrency(preCalculation.items.reduce((sum, i) => sum + i.profitKzt, 0))}
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-800" />
                        <div className="space-y-1">
                            <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Текущий факт (Прибыль)</div>
                            <div className="text-xl font-black text-blue-400 tabular-nums">
                                {formatCurrency(itemActuals.reduce((sum, act) => sum + (act.actualRevenueKzt - act.actualPurchaseKzt), 0))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Глобальное отклонение</div>
                        <div className="flex items-center justify-end gap-2 text-2xl font-black text-emerald-400 tabular-nums tracking-tighter">
                            <TrendingUp size={24} /> 0%
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
