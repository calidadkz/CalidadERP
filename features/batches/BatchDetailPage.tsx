import React, { useState } from 'react';
import {
    ArrowLeft, CheckCircle2, Loader2, AlertTriangle,
    DollarSign, TrendingUp, TrendingDown, BarChart3, FileText, Layers
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBatches } from './hooks/useBatches';
import { BatchMainListTab } from './components/BatchMainListTab';
import { BatchExpensesTab } from './components/BatchExpensesTab';
import { BatchComparisonTab } from './components/BatchComparisonTab';
import { BatchDocumentsTab } from './components/BatchDocumentsTab';
import { BatchSidebar, SidebarContext } from './components/BatchSidebar';

type TabType = 'LIST' | 'EXPENSES' | 'COMPARISON' | 'DOCUMENTS';

const fmtShort = (v?: number) => {
    if (!v && v !== 0) return '—';
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' млн ₸';
    if (abs >= 1_000) return (v / 1_000).toFixed(0) + ' тыс ₸';
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₸';
};

export const BatchDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('LIST');
    const [sidebarCtx, setSidebarCtx] = useState<SidebarContext>({ type: 'summary' });

    const {
        batch,
        preCalculation,
        expenses,
        documents,
        itemActuals,
        receptions,
        plannedPayments,
        actualPayments,
        isLoading,
        stats,
        addExpense,
        deleteExpense,
        uploadDocument,
        deleteDocument,
    } = useBatches(id);

    const handleColumnClick = (ctx: SidebarContext) => {
        setSidebarCtx(ctx);
    };

    const closeSidebar = () => {
        setSidebarCtx({ type: 'summary' });
    };

    // ── Loading / Error states ────────────────────────────────────────────────

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
                <button onClick={() => navigate('/batches')} className="text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:underline">
                    Вернуться к списку
                </button>
            </div>
        );
    }

    const profitPositive = (stats?.actualProfit ?? 0) >= 0;
    const profitDiffPositive = (stats?.profitDiffPercent ?? 0) >= 0;

    return (
        <div className="h-full flex flex-col gap-4 animate-in fade-in duration-300">

            {/* ── Action Bar ───────────────────────────────────────────── */}
            <div className="flex justify-between items-center bg-white px-6 py-4 rounded-[2rem] border border-slate-200 shadow-sm flex-none">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/batches')}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">{batch?.name}</h1>
                            {batch?.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500" />}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Основание: предрасчёт от {batch?.date ? new Date(batch.date).toLocaleDateString('ru-RU') : '—'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Навигация по вкладкам */}
                    <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl" aria-label="Tabs">
                        {([
                            { id: 'LIST', label: 'Позиции', icon: Layers },
                            { id: 'EXPENSES', label: 'Расходы', icon: DollarSign },
                            { id: 'COMPARISON', label: 'Сравнение', icon: BarChart3 },
                            { id: 'DOCUMENTS', label: 'Документы', icon: FileText },
                        ] as const).map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-white shadow text-blue-600'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <Icon size={12} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>

                    <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
                        <CheckCircle2 size={14}/> Завершить партию
                    </button>
                </div>
            </div>

            {/* ── KPI Bar ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3 flex-none">
                <KpiCard
                    label="Выручка (факт)"
                    value={fmtShort(stats?.actualRevenue)}
                    sub={`план: ${fmtShort(stats?.plannedRevenue)}`}
                    progress={stats?.revenueProgress}
                    color="text-emerald-600"
                />
                <KpiCard
                    label="Расходы (факт)"
                    value={fmtShort(stats?.totalActualExpenses)}
                    sub={`план: ${fmtShort(stats?.plannedExpenses)}`}
                    color="text-amber-600"
                />
                <KpiCard
                    label="Прибыль (факт)"
                    value={fmtShort(stats?.actualProfit)}
                    sub={stats?.profitDiffPercent != null
                        ? `${profitDiffPositive ? '+' : ''}${stats.profitDiffPercent.toFixed(1)}% от прогноза`
                        : `план: ${fmtShort(stats?.plannedProfit)}`}
                    color={profitPositive ? 'text-blue-600' : 'text-red-500'}
                />
                <KpiCard
                    label="Позиций"
                    value={`${preCalculation?.items.length ?? 0} шт.`}
                    sub={`${receptions.length} приёмок · ${expenses.length} расходов`}
                    color="text-slate-700"
                />
            </div>

            {/* ── Основная область: контент + сайдбар ─────────────────── */}
            <div className="flex-1 min-h-0 flex gap-4">
                {/* Контент вкладки */}
                <div className="flex-1 min-w-0 bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col p-6">
                    {activeTab === 'LIST' && preCalculation && (
                        <BatchMainListTab
                            preCalculation={preCalculation}
                            itemActuals={itemActuals}
                            expenses={expenses}
                            onColumnHeaderClick={handleColumnClick}
                        />
                    )}
                    {activeTab === 'EXPENSES' && (
                        <BatchExpensesTab
                            expenses={expenses}
                            onDeleteExpense={deleteExpense}
                            onOpenSidebar={handleColumnClick}
                        />
                    )}
                    {activeTab === 'COMPARISON' && preCalculation && (
                        <BatchComparisonTab
                            preCalculation={preCalculation}
                            itemActuals={itemActuals}
                            expenses={expenses}
                        />
                    )}
                    {activeTab === 'DOCUMENTS' && (
                        <BatchDocumentsTab
                            documents={documents}
                            onUpload={uploadDocument}
                            onDelete={deleteDocument}
                        />
                    )}
                    {!preCalculation && (activeTab === 'LIST' || activeTab === 'COMPARISON') && (
                        <div className="flex-1 flex items-center justify-center text-slate-300">
                            <div className="text-center">
                                <Layers size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Предрасчёт не найден</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Сайдбар — всегда видим */}
                <BatchSidebar
                    context={sidebarCtx}
                    onClose={closeSidebar}
                    stats={stats}
                    expenses={expenses}
                    receptions={receptions}
                    plannedPayments={plannedPayments}
                    actualPayments={actualPayments}
                    onAddExpense={addExpense}
                />
            </div>
        </div>
    );
};

// ── KPI карточка ─────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    label: string;
    value: string;
    sub: string;
    color: string;
    progress?: number;
}> = ({ label, value, sub, color, progress }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</div>
        <div className={`text-xl font-black tabular-nums tracking-tighter ${color}`}>{value}</div>
        <div className="text-[9px] font-bold text-slate-400 mt-1">{sub}</div>
        {progress != null && (
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, progress)}%` }}
                />
            </div>
        )}
    </div>
);
