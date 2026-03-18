
import React, { useState, useMemo } from 'react';
import { ActualPayment, PaymentAllocation, PlannedPayment } from '@/types';
import { ChevronDown, ChevronRight, Link, X, CheckSquare, Square, Loader2, ArrowUpRight, ArrowDownLeft, Search, Filter, Tag, Info, Landmark } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { StatementImportModal } from '@/components/ui/StatementImportModal';

interface BankStatementsProps {
    directionFilter?: 'All' | 'Outgoing' | 'Incoming';
    onOpenPaymentModal: (dir: 'Incoming' | 'Outgoing', plan?: PlannedPayment) => void;
}

export const BankStatements: React.FC<BankStatementsProps> = ({ 
    directionFilter = 'All',
    onOpenPaymentModal
}) => {
    const { state, actions } = useStore();
    const { actualPayments, plannedPayments } = state;
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [allocatingTarget, setAllocatingTarget] = useState<ActualPayment | null>(null);
    const [draft, setDraft] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const getBusinessDisplayId = (id: string) => id.includes('-') && id.length > 20 ? `#${id.slice(-6).toUpperCase()}` : id;

    const filteredActuals = useMemo(() => {
        return actualPayments
            .filter(p => {
                const matchesSearch = !searchQuery || p.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesDirection = directionFilter === 'All' || p.direction === directionFilter;
                return matchesSearch && matchesDirection;
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [actualPayments, searchQuery, directionFilter]);

    const unallocatedPool = useMemo<number>(() => {
        if (!allocatingTarget) return 0;
        const totalAmount = Number(allocatingTarget.amount) || 0;
        const alreadyAllocated = (allocatingTarget.allocations || []).reduce((sum: number, a: PaymentAllocation) => sum + (Number(a.amountCovered) || 0), 0);
        const inDraft = Object.keys(draft).reduce((sum: number, key: string) => sum + (Number(draft[key]) || 0), 0);
        return Math.max(0, totalAmount - alreadyAllocated - inDraft);
    }, [allocatingTarget, draft]);

    const toggleAllocation = (pp: PlannedPayment) => {
        if (draft[pp.id]) {
            const newDraft = { ...draft };
            delete newDraft[pp.id];
            setDraft(newDraft);
        } else {
            if (unallocatedPool <= 0.01) return;
            const needed = (Number(pp.amountDue) || 0) - (Number(pp.amountPaid) || 0);
            const canTake = Math.min(unallocatedPool, needed);
            if (canTake > 0) setDraft({ ...draft, [pp.id]: canTake });
        }
    };

    const handleConfirm = async () => {
        if (!allocatingTarget || Object.keys(draft).length === 0) return;
        setIsSaving(true);
        try {
            const allocations: PaymentAllocation[] = Object.entries(draft).map(([id, amt]) => ({
                plannedPaymentId: id,
                actualPaymentId: allocatingTarget.id,
                amountCovered: Number(amt)
            }));
            await actions.allocatePayment(allocatingTarget.id, allocations);
            setAllocatingTarget(null);
            setDraft({});
        } catch (e: any) {
            alert("Ошибка при сохранении разноской: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Поиск по контрагенту..." 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm transition-all"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black uppercase text-[10px] tracking-widest transition-all"><Landmark size={14}/> Импорт выписки</button>
                    <button onClick={() => onOpenPaymentModal('Outgoing')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-md font-black uppercase text-[10px] tracking-widest transition-all"><ArrowUpRight size={14}/> Создать платеж</button>
                    <button onClick={() => onOpenPaymentModal('Incoming')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md font-black uppercase text-[10px] tracking-widest transition-all"><ArrowDownLeft size={14}/> Принять оплату</button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Журнал фактических платежей (Выписки)</h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Filter size={12}/> Сортировка: По дате (новые сверху)</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <tr>
                                <th className="w-10"></th>
                                <th className="px-6 py-3 text-left">Дата</th>
                                <th className="px-6 py-3 text-left">ID</th>
                                <th className="px-6 py-3 text-left">Контрагент</th>
                                <th className="px-6 py-3 text-left">Счет</th>
                                <th className="px-6 py-3 text-right">Сумма</th>
                                <th className="px-6 py-3 text-center">Статус разноски</th>
                                <th className="px-6 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredActuals.length === 0 ? (
                                <tr><td colSpan={8} className="p-20 text-center text-slate-300 italic">Платежи не найдены</td></tr>
                            ) : filteredActuals.map(ap => {
                                const isExp = expandedId === ap.id;
                                const totalAllocated = (ap.allocations || []).reduce((sum, a) => sum + (Number(a.amountCovered) || 0), 0);
                                const apAmount = Number(ap.amount) || 0;
                                const unallocated = Math.max(0, apAmount - totalAllocated);
                                return (
                                    <React.Fragment key={ap.id}>
                                        <tr className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="text-center pl-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : ap.id)}>{(ap.allocations && ap.allocations.length > 0) ? (isExp ? <ChevronDown size={14} className="text-blue-500"/> : <ChevronRight size={14} className="text-gray-300"/>) : null}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-600">{ap.date}</td>
                                            <td className="px-6 py-4 text-xs font-black text-slate-400 font-mono tracking-tighter uppercase">{ap.id.slice(-8)}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">{ap.counterpartyName}</div>
                                                <div className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${ap.direction === 'Outgoing' ? 'text-red-400' : 'text-emerald-500'}`}>{ap.direction === 'Outgoing' ? 'Списание' : 'Пополнение'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-500 font-medium">{ap.fromAccount}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-black"><span className={ap.direction === 'Outgoing' ? 'text-red-600' : 'text-emerald-600'}>{ap.direction === 'Outgoing' ? '-' : '+'}{f(apAmount)} {ap.currency}</span></td>
                                            <td className="px-6 py-4 text-center">{unallocated > 0.01 ? <button onClick={() => { setDraft({}); setAllocatingTarget(ap); }} className="text-[10px] font-black text-orange-600 border border-orange-200 px-2 py-1 rounded bg-orange-50 hover:bg-orange-600 hover:text-white transition-all shadow-sm">Разнести {f(Math.round(unallocated))}</button> : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Разнесено</span>}</td>
                                            <td className="px-6 py-4"></td>
                                        </tr>
                                        {isExp && (
                                            <>
                                                {(ap.knp || ap.purpose || ap.documentNumber || ap.counterpartyIik || ap.counterpartyBik) && (
                                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                                        <td colSpan={3}></td>
                                                        <td colSpan={4} className="px-6 py-3">
                                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Info size={12}/> Детали банковской операции</div>{ap.documentNumber && <span className="text-[10px] font-mono font-bold text-slate-500">№ {ap.documentNumber}</span>}</div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    {ap.knp && (<div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">КНП</div><div className="text-xs font-bold text-slate-700">{ap.knp}</div></div>)}
                                                                    {ap.counterpartyBinIin && (<div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">БИН/ИИН Контрагента</div><div className="text-xs font-bold text-slate-700">{ap.counterpartyBinIin}</div></div>)}
                                                                    {ap.counterpartyIik && (<div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ИИК (Счет) Контрагента</div><div className="text-xs font-mono font-bold text-slate-700">{ap.counterpartyIik}</div></div>)}
                                                                    {ap.counterpartyBik && (<div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">БИК Банка Контрагента</div><div className="text-xs font-mono font-bold text-slate-700">{ap.counterpartyBik}</div></div>)}
                                                                </div>
                                                                {ap.purpose && (<div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Назначение платежа</div><div className="text-xs font-medium text-slate-600 leading-relaxed italic">"{ap.purpose}"</div></div>)}
                                                            </div>
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                )}
                                                {ap.allocations && ap.allocations.map((al, idx) => {
                                                    const source = plannedPayments.find(p => p.id === al.plannedPaymentId);
                                                    const cfItem = state.cashFlowItems.find(i => i.id === source?.cashFlowItemId);
                                                    return (
                                                        <tr key={idx} className="bg-slate-50 border-b border-slate-100">
                                                            <td colSpan={3}></td>
                                                            <td className="px-6 py-2">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{source ? (source.sourceDocType === 'Manual' ? 'Ручное' : `${source.sourceDocType === 'Order' ? 'ЗП' : 'ЗК'} ${getBusinessDisplayId(source.sourceDocId)}`) : 'План не найден'}</div>
                                                                <div className="text-[9px] text-blue-600 font-black uppercase mt-0.5 flex items-center gap-1"><Tag size={10} className="text-blue-300"/> {cfItem?.name || 'Без статьи'}</div>
                                                            </td>
                                                            <td className="px-6 py-2 text-right font-mono text-[11px] font-bold text-blue-600" colSpan={2}>{f(Number(al.amountCovered))} {ap.currency}</td>
                                                            <td colSpan={2}></td>
                                                        </tr>
                                                    )
                                                })}
                                            </>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {allocatingTarget && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                            <div><h3 className="font-black text-lg uppercase flex items-center gap-2 tracking-tighter"><Link size={20}/> Умная разноска выписки</h3><p className="text-[10px] text-slate-400 font-bold uppercase">{allocatingTarget.counterpartyName} • {allocatingTarget.currency}</p></div>
                            <button onClick={() => setAllocatingTarget(null)} className="text-slate-500 hover:text-white transition-colors" disabled={isSaving}><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Сумма выписки</div><div className="text-2xl font-black text-slate-800">{f(Number(allocatingTarget.amount))} {allocatingTarget.currency}</div></div>
                                <div className={`flex-1 p-4 rounded-2xl border transition-all ${unallocatedPool < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}><div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${unallocatedPool < 0.01 ? 'text-emerald-500' : 'text-blue-500'}`}>Доступно</div><div className={`text-2xl font-black ${unallocatedPool < 0.01 ? 'text-emerald-700' : 'text-blue-700'}`}>{f(Math.max(0, unallocatedPool))} {allocatingTarget.currency}</div></div>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {plannedPayments.filter(pp => !pp.isPaid && pp.counterpartyId === allocatingTarget.counterpartyId).map(pp => {
                                        const isSelected = !!draft[pp.id];
                                        const needed = (Number(pp.amountDue) || 0) - (Number(pp.amountPaid) || 0);
                                        const draftAmt = draft[pp.id] || 0;
                                        const cfItem = state.cashFlowItems.find(i => i.id === pp.cashFlowItemId);
                                        return (
                                            <div key={pp.id} onClick={() => !isSaving && toggleAllocation(pp)} className={`p-4 border-2 rounded-2xl cursor-pointer transition-all flex items-center justify-between group ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-200 bg-white'}`}>
                                                <div className="flex items-center gap-4"><div className={`p-1 rounded-md transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}</div><div><div className="text-xs font-black text-slate-700">{pp.dueDate} • {pp.sourceDocType === 'Manual' ? 'Ручное' : getBusinessDisplayId(pp.sourceDocId)}</div><div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5"><span>{pp.sourceDocType} • {pp.currency}</span><span className="w-1 h-1 bg-slate-200 rounded-full"></span><span className="text-blue-500">{cfItem?.name || 'Без статьи'}</span></div></div></div>
                                                <div className="text-right"><div className="text-xs font-mono font-black text-slate-900">{f(needed)} {pp.currency}</div>{isSelected && <div className="text-[10px] font-bold text-blue-600 mt-0.5">Разнести {f(draftAmt)}</div>}</div>
                                            </div>
                                        );
                                })}
                                {plannedPayments.filter(pp => !pp.isPaid && pp.counterpartyId === allocatingTarget.counterpartyId).length === 0 && (<div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 uppercase text-xs font-bold">Нет открытых траншей по этому контрагенту</div>)}
                            </div>
                            <button onClick={handleConfirm} disabled={Object.keys(draft).length === 0 || isSaving} className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2 transition-all active:scale-95">{isSaving && <Loader2 size={20} className="animate-spin" />}{isSaving ? 'Сохранение...' : 'Подтвердить разноску'}</button>
                        </div>
                    </div>
                </div>
            )}
            {isImportModalOpen && <StatementImportModal onClose={() => setIsImportModalOpen(false)} />}
        </div>
    );
};
