
import React from 'react';
import { Calculator } from 'lucide-react';

interface EconomySummaryProps {
    effectiveInfo: { rate: number, type: string, totalKzt: number };
    totalExpensesKzt: number;
    finalTotalKzt: number;
    totalQty: number;
}

export const EconomySummary: React.FC<EconomySummaryProps> = ({
    effectiveInfo, totalExpensesKzt, finalTotalKzt, totalQty
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 sticky top-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl"><Calculator size={24}/></div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Экономика приемки</h3>
            </div>
            <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Эффективный курс (FIFO)</span>
                    <div className="text-right">
                        <span className="text-xl font-black text-blue-700">{Number(effectiveInfo.rate).toFixed(2)} ₸</span>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                            {effectiveInfo.type === 'fact' ? 'По фактическим оплатам' : 'Смешанный курс'}
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-50 text-orange-600">
                    <span className="text-[10px] font-black uppercase tracking-widest">Доп. Расходы (KZT)</span>
                    <span className="text-xl font-black">{f(totalExpensesKzt)} ₸</span>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Итоговая ценность поставки</span>
                    <div className="text-3xl font-black font-mono">
                        {f(Math.round(finalTotalKzt))} <span className="text-sm font-light opacity-50">₸</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest flex justify-between">
                        <span>Всего товаров:</span>
                        <span className="text-white font-black">{totalQty} шт.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
