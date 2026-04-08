import React, { useState } from 'react';
import { Layers, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, ChevronRight, FileText, PlusCircle, CheckCircle2, MoreVertical, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBatches } from './hooks/useBatches';
import { BatchEconomyTab } from './components/BatchEconomyTab';
import { BatchExpensesTab } from './components/BatchExpensesTab';
import { BatchDocumentsTab } from './components/BatchDocumentsTab';

type TabType = 'ECONOMY' | 'EXPENSES' | 'DOCUMENTS';

export const BatchDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('ECONOMY');

    const {
        batch,
        preCalculation,
        expenses,
        documents,
        itemActuals,
        plannedPayments,
        actualPayments,
        isLoading,
        stats,
        addExpense,
        deleteExpense,
        uploadDocument,
        deleteDocument
    } = useBatches(id);

    const formatCurrency = (val?: number) => 
        (val || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₸';

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
                <button onClick={() => navigate('/batches')} className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline">Вернуться к списку</button>
            </div>
        );
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'ECONOMY':
                return preCalculation ? <BatchEconomyTab preCalculation={preCalculation} itemActuals={itemActuals} /> : null;
            case 'EXPENSES':
                return <BatchExpensesTab expenses={expenses} plannedPayments={plannedPayments} actualPayments={actualPayments} onAddExpense={addExpense} onDeleteExpense={deleteExpense} />;
            case 'DOCUMENTS':
                return <BatchDocumentsTab documents={documents} onUpload={uploadDocument} onDelete={deleteDocument} />;
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-white px-8 py-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex-none">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/batches')}
                        className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 group">
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{batch?.name}</h1>
                            {batch?.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Основание: Предрасчет от {batch?.date ? new Date(batch.date).toLocaleDateString() : '—'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <nav className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl mr-4" aria-label="Tabs">
                        <button 
                            onClick={() => setActiveTab('ECONOMY')}
                            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'ECONOMY' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Экономика
                        </button>
                        <button 
                            onClick={() => setActiveTab('EXPENSES')}
                            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'EXPENSES' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Расходы
                        </button>
                        <button 
                            onClick={() => setActiveTab('DOCUMENTS')}
                            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'DOCUMENTS' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Документы
                        </button>
                    </nav>
                    <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
                        Завершить партию
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex gap-6">
                {/* Main Tab View */}
                <div className="flex-[3] bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col p-8">
                    {renderTabContent()}
                </div>

                {/* Right Side: Dashboard Stats */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* Actual Profit Card */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/40 border border-slate-800 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-all" />
                        <div className="relative z-10">
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                <DollarSign size={12} className="text-blue-500" /> Итоговая прибыль (Фактич.)
                            </div>
                            <div className="text-4xl font-black tabular-nums tracking-tighter mb-2 text-blue-400">
                                {formatCurrency(stats?.actualProfit).replace(' ₸', '')} <span className="text-lg opacity-40">₸</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                <span className={`flex items-center gap-1 ${stats?.profitDiffPercent && stats.profitDiffPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {stats?.profitDiffPercent && stats.profitDiffPercent >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                    {stats?.profitDiffPercent?.toFixed(1)}%
                                </span>
                                <span className="text-slate-600">от прогноза</span>
                            </div>
                        </div>
                    </div>

                    {/* Expenses breakdown */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl flex-1 flex flex-col">
                         <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                            <Tag size={12} className="text-amber-500" /> Расходы по статьям
                         </div>
                         <div className="space-y-4 flex-1 overflow-auto custom-scrollbar pr-2">
                             {[
                                { key: 'logistics_urumqi_almaty', label: 'Урумчи–Алматы' },
                                { key: 'logistics_almaty_karaganda', label: 'Алматы–Кар.' },
                                { key: 'logistics_china_domestic', label: 'По Китаю' },
                                { key: 'customs', label: 'Таможня' },
                                { key: 'customs_vat', label: 'НДС Там.' },
                                { key: 'broker', label: 'Брокер' },
                                { key: 'svh', label: 'СВХ' },
                                { key: 'pnr', label: 'ПНР' },
                                { key: 'delivery_local', label: 'До клиента' }
                             ].map((item) => {
                                const amount = stats?.expensesByCategory?.[item.key] || 0;
                                const percentage = stats?.totalActualExpenses && stats.totalActualExpenses > 0 
                                    ? (amount / stats.totalActualExpenses) * 100 
                                    : 0;

                                return (
                                    <div key={item.key} className="flex flex-col gap-1.5 p-1">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black uppercase text-slate-700 tracking-tighter">{item.label}</span>
                                            <span className="text-[10px] font-bold text-slate-500 tabular-nums">{formatCurrency(amount)}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-amber-400 rounded-full transition-all duration-1000" 
                                                style={{ width: `${percentage}%` }} 
                                            />
                                        </div>
                                    </div>
                                );
                             })}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
