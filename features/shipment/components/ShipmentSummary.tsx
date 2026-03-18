
import React from 'react';
import { PackageMinus, CreditCard } from 'lucide-react';

interface ShipmentSummaryProps {
    clientName: string;
    totalQty: number;
    totalValue: number;
    showPriceInfo: boolean;
    onCancel: () => void;
}

export const ShipmentSummary: React.FC<ShipmentSummaryProps> = ({
    clientName, totalQty, totalValue, showPriceInfo, onCancel
}) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white sticky top-6 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><PackageMinus size={120}/></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-900/40"><CreditCard size={24}/></div>
                    <h3 className="font-black text-white uppercase tracking-tight">Резюме накладной</h3>
                </div>
                
                <div className="space-y-6 flex-1">
                    <div className="pb-6 border-b border-white/10">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 block">Клиент</span>
                        <div className="text-xl font-black">{clientName || '—'}</div>
                    </div>
                    
                    <div className="pb-6 border-b border-white/10 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Всего товаров</span>
                        <span className="text-xl font-black">{totalQty} шт.</span>
                    </div>

                    <div className="pt-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Сумма к списанию</span>
                        {showPriceInfo ? (
                            <div className="text-4xl font-black tracking-tighter font-mono">{f(totalValue)} <span className="text-xl font-light opacity-50">₸</span></div>
                        ) : (
                            <div className="text-2xl font-bold text-slate-500 uppercase italic">Цены скрыты</div>
                        )}
                    </div>
                </div>

                <div className="mt-12 flex flex-col gap-3">
                    <button onClick={onCancel} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] hover:text-white transition-colors">Вернуться в журнал</button>
                </div>
            </div>
        </div>
    );
};
