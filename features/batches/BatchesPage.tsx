import React from 'react';
import { PlusCircle, Layers, Calendar, ArrowRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const BatchesPage: React.FC = () => {
    const navigate = useNavigate();
    
    // Заглушка данных. Позже заменим на useBatches()
    const batches = [];

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
                        <div className="text-xl font-black text-indigo-600 tabular-nums">0</div>
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
                {batches.length === 0 ? (
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
                    <div className="overflow-auto custom-scrollbar p-6">
                        {/* Здесь будет таблица списка */}
                    </div>
                )}
            </div>
        </div>
    );
};
