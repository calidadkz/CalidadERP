
import React, { useState, useMemo } from 'react';
import { ActualPayment, PaymentAllocation, PlannedPayment, CashFlowItem } from '@/types';
import { ChevronDown, ChevronRight, Link, X, CheckSquare, Square, Loader2, ArrowUpRight, ArrowDownLeft, Search, Filter, Tag, Info, Landmark, Layers, AlertCircle, PlusCircle, ArrowRightLeft } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { StatementImportModal } from '@/components/ui/StatementImportModal';
import { ApiService } from '@/services/api';

interface BankStatementsProps {
    directionFilter?: 'All' | 'Outgoing' | 'Incoming';
    onOpenPaymentModal: (dir: 'Incoming' | 'Outgoing', plan?: PlannedPayment) => void;
}

export const BankStatements: React.FC<BankStatementsProps> = ({ 
    directionFilter = 'All',
    onOpenPaymentModal
}) => {
    const { state, actions } = useStore();
    const { actualPayments, plannedPayments, cashFlowItems, bankAccounts } = state;
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [allocatingTarget, setAllocatingTarget] = useState<ActualPayment | null>(null);
    
    // Новые состояния для гибкой разноски
    const [allocationMode, setAllocationMode] = useState<'Plan' | 'Manual' | 'Internal'>('Plan');
    const [draft, setDraft] = useState<Record<string, number>>({});
    const [manualDraft, setManualDraft] = useState<Array<{ id: string, cfId: string, amount: number, targetBankAccountId?: string }>>([]);
    
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const f = (val: number) => val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const getBusinessDisplayId = (id: string) => id.includes('-') && id.length > 20 ? `#${id.slice(-6).toUpperCase()}` : id;

    const filteredActuals = useMemo(() => {
        return actualPayments
            .filter(p => {
                const matchesSearch = !searchQuery || p.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesDirection = directionFilter === 'All' || p.direction === directionFilter;
                return matchesSearch && matchesDirection;
            })
            .sort((a, b) => {
                // Сначала нераспределенные
                const unallocA = (Number(a.amount) || 0) - (a.allocations || []).reduce((sum, al) => sum + (Number(al.amountCovered) || 0), 0);
                const unallocB = (Number(b.amount) || 0) - (b.allocations || []).reduce((sum, al) => sum + (Number(al.amountCovered) || 0), 0);
                
                if (unallocA > 0.01 && unallocB <= 0.01) return -1;
                if (unallocA <= 0.01 && unallocB > 0.01) return 1;
                
                return b.date.localeCompare(a.date);
            });
    }, [actualPayments, searchQuery, directionFilter]);

    const unallocatedPool = useMemo<number>(() => {
        if (!allocatingTarget) return 0;
        const totalAmount = Number(allocatingTarget.amount) || 0;
        const alreadyAllocated = (allocatingTarget.allocations || []).reduce((sum: number, a: PaymentAllocation) => sum + (Number(a.amountCovered) || 0), 0);
        
        const inPlanDraft = Object.values(draft).reduce((sum, amt) => sum + amt, 0);
        const inManualDraft = manualDraft.reduce((sum, m) => sum + m.amount, 0);
        
        return Math.max(0, totalAmount - alreadyAllocated - inPlanDraft - inManualDraft);
    }, [allocatingTarget, draft, manualDraft]);

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
        if (!allocatingTarget) return;
        
        // 1. Аллокации из календаря
        const planAllocations: PaymentAllocation[] = Object.entries(draft).map(([id, amt]) => {
            const pp = plannedPayments.find(p => p.id === id);
            return {
                id: ApiService.generateId('AL'),
                actualPaymentId: allocatingTarget.id,
                plannedPaymentId: id,
                cashFlowItemId: pp?.cashFlowItemId || '',
                amountCovered: Number(amt)
            };
        });

        // 2. Ручные аллокации и переводы
        const manualAllocations: PaymentAllocation[] = manualDraft
            .filter(m => (m.cfId || m.targetBankAccountId) && m.amount > 0)
            .map(m => ({
                id: ApiService.generateId('AL'),
                actualPaymentId: allocatingTarget.id,
                cashFlowItemId: m.cfId || 'INTERNAL_TRANSFER',
                amountCovered: Number(m.amount),
                targetBankAccountId: m.targetBankAccountId
            }));

        const allAllocations = [...planAllocations, ...manualAllocations];
        if (allAllocations.length === 0) return;

        setIsSaving(true);
        try {
            await actions.allocatePayment(allocatingTarget.id, allAllocations);
            setAllocatingTarget(null);
            setDraft({});
            setManualDraft([]);
        } catch (e: any) {
            alert("Ошибка при сохранении: " + e.message);
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
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Filter size={12}/> Сортировка: Сначала нераспределенные</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <tr>
                                <th className="w-10"></th>
                                <th className="px-6 py-3 text-left">Дата</th>
                                <th className="px-6 py-3 text-left">Контрагент / Счет</th>
                                <th className="px-6 py-3 text-left">Статьи / Источники</th>
                                <th className="px-6 py-3 text-right">Сумма</th>
                                <th className="px-6 py-3 text-center">Разноска</th>
                                <th className="px-6 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredActuals.length === 0 ? (
                                <tr><td colSpan={7} className="p-20 text-center text-slate-300 italic">Платежи не найдены</td></tr>
                            ) : filteredActuals.map(ap => {
                                const isExp = expandedId === ap.id;
                                const totalAllocated = (ap.allocations || []).reduce((sum, a) => sum + (Number(a.amountCovered) || 0), 0);
                                const apAmount = Number(ap.amount) || 0;
                                const unallocated = Math.max(0, apAmount - totalAllocated);
                                const hasAllocations = ap.allocations && ap.allocations.length > 0;

                                const allocatedItems = (ap.allocations || []).map(al => {
                                    const cf = cashFlowItems.find(i => i.id === al.cashFlowItemId);
                                    const pp = plannedPayments.find(p => p.id === al.plannedPaymentId);
                                    const targetAcc = bankAccounts.find(a => a.id === al.targetBankAccountId);
                                    
                                    let label = cf?.name || 'Без статьи';
                                    if (al.targetBankAccountId) label = `Перевод на ${targetAcc?.name || 'счет'}`;

                                    return {
                                        itemName: label,
                                        isTransfer: !!al.targetBankAccountId,
                                        source: pp ? (pp.sourceDocType === 'Manual' ? 'План' : `${pp.sourceDocType} ${getBusinessDisplayId(pp.sourceDocId)}`) : null
                                    };
                                });

                                return (
                                    <React.Fragment key={ap.id}>
                                        <tr className={`hover:bg-gray-50/50 transition-colors group ${isExp ? 'bg-slate-50/30' : ''} ${unallocated > 0.01 ? 'bg-amber-50/20' : ''}`}>
                                            <td className="text-center pl-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : ap.id)}>
                                                {hasAllocations ? (isExp ? <ChevronDown size={14} className="text-blue-500"/> : <ChevronRight size={14} className="text-gray-300"/>) : null}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-600">{ap.date}</div>
                                                <div className="text-[9px] font-black text-slate-300 font-mono tracking-tighter uppercase">{ap.id.slice(-8)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">{ap.counterpartyName}</div>
                                                <div className="text-[10px] text-gray-500 font-medium">{ap.fromAccount}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                                    {allocatedItems.length > 0 ? (
                                                        allocatedItems.map((item, idx) => (
                                                            <div key={idx} className="flex flex-col">
                                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter w-fit ${item.isTransfer ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
                                                                    {item.itemName}
                                                                </span>
                                                                {item.source && (
                                                                    <span className="text-[8px] text-slate-400 font-bold uppercase flex items-center gap-0.5 mt-0.5">
                                                                        <Link size={8}/> {item.source}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-amber-600 font-bold uppercase flex items-center gap-1 italic"><AlertCircle size={10}/> Не распределено</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-black">
                                                <div className={ap.direction === 'Outgoing' ? 'text-red-600' : 'text-emerald-600'}>
                                                    {ap.direction === 'Outgoing' ? '-' : '+'}{f(apAmount)} {ap.currency}
                                                </div>
                                                <div className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${ap.direction === 'Outgoing' ? 'text-red-400' : 'text-emerald-500'}`}>{ap.direction === 'Outgoing' ? 'Списание' : 'Пополнение'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {unallocated > 0.01 ? (
                                                    <button onClick={() => { setDraft({}); setManualDraft([]); setAllocatingTarget(ap); setAllocationMode('Plan'); }} className="text-[10px] font-black text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-600 hover:text-white transition-all shadow-sm">Разнести {f(unallocated)}</button>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 uppercase tracking-tighter">ОК</span>
                                                        {ap.allocations.length > 1 && <span className="text-[8px] text-slate-400 font-bold uppercase">{ap.allocations.length} части</span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4"></td>
                                        </tr>
                                        {isExp && (
                                            <>
                                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                                    <td colSpan={3}></td>
                                                    <td colSpan={3} className="px-6 py-3">
                                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Info size={12}/> Детали операции</div>
                                                                {ap.documentNumber && <span className="text-[10px] font-mono font-bold text-slate-500 tracking-tighter">№ {ap.documentNumber}</span>}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {ap.knp && (<div><div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">КНП</div><div className="text-xs font-bold text-slate-700">{ap.knp}</div></div>)}
                                                                {ap.counterpartyBinIin && (<div><div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">БИН/ИИН</div><div className="text-xs font-bold text-slate-700">{ap.counterpartyBinIin}</div></div>)}
                                                                {ap.counterpartyIik && (<div><div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">ИИК</div><div className="text-xs font-mono font-bold text-slate-700">{ap.counterpartyIik}</div></div>)}
                                                                {ap.purpose && (
                                                                    <div className="col-span-2">
                                                                        <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">Назначение</div>
                                                                        <div className="text-xs font-medium text-slate-600 italic leading-relaxed">"{ap.purpose}"</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td></td>
                                                </tr>
                                                {ap.allocations.map((al, idx) => {
                                                    const pp = plannedPayments.find(p => p.id === al.plannedPaymentId);
                                                    const cfItem = cashFlowItems.find(i => i.id === al.cashFlowItemId);
                                                    const targetAcc = bankAccounts.find(a => a.id === al.targetBankAccountId);
                                                    
                                                    return (
                                                        <tr key={idx} className="bg-slate-50 border-b border-slate-100">
                                                            <td colSpan={3}></td>
                                                            <td className="px-6 py-2.5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter ${al.targetBankAccountId ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-blue-600 bg-blue-50 border-blue-100'}`}>
                                                                                {al.targetBankAccountId ? `Внутренний перевод -> ${targetAcc?.name || '??'}` : (cfItem?.name || 'Без статьи')}
                                                                            </span>
                                                                        </div>
                                                                        {pp && (
                                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
                                                                                <Link size={10}/> {pp.sourceDocType === 'Manual' ? 'Ручное планирование' : `${pp.sourceDocType} ${getBusinessDisplayId(pp.sourceDocId)}`}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-2.5 text-right font-mono text-[11px] font-black text-slate-900">
                                                                {f(Number(al.amountCovered))} {ap.currency}
                                                            </td>
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

            {/* Расширенная Модалка Разноски */}
            {allocatingTarget && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg uppercase flex items-center gap-2 tracking-tighter"><Link size={20}/> Умная разноска</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{allocatingTarget.counterpartyName}</p>
                            </div>
                            <button onClick={() => setAllocatingTarget(null)} className="text-slate-500 hover:text-white transition-colors" disabled={isSaving}><X size={24}/></button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Сумма выписки</div><div className="text-2xl font-black text-slate-800 tabular-nums">{f(Number(allocatingTarget.amount))} {allocatingTarget.currency}</div></div>
                                <div className={`flex-1 p-4 rounded-2xl border transition-all ${unallocatedPool < 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}><div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${unallocatedPool < 0.01 ? 'text-emerald-500' : 'text-blue-500'}`}>Остаток</div><div className={`text-2xl font-black tabular-nums ${unallocatedPool < 0.01 ? 'text-emerald-700' : 'text-blue-700'}`}>{f(Math.max(0, unallocatedPool))} {allocatingTarget.currency}</div></div>
                            </div>

                            {/* Селектор режимов */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button onClick={() => setAllocationMode('Plan')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${allocationMode === 'Plan' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>По календарю</button>
                                <button onClick={() => setAllocationMode('Manual')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${allocationMode === 'Manual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>На статью</button>
                                <button onClick={() => setAllocationMode('Internal')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${allocationMode === 'Internal' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Перевод</button>
                            </div>

                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar min-h-[120px]">
                                {allocationMode === 'Plan' && (
                                    <>
                                        {plannedPayments.filter(pp => !pp.isPaid && pp.counterpartyId === allocatingTarget.counterpartyId).map(pp => {
                                            const isSelected = !!draft[pp.id];
                                            const needed = (Number(pp.amountDue) || 0) - (Number(pp.amountPaid) || 0);
                                            const cfItem = cashFlowItems.find(i => i.id === pp.cashFlowItemId);
                                            return (
                                                <div key={pp.id} onClick={() => !isSaving && toggleAllocation(pp)} className={`p-4 border-2 rounded-2xl cursor-pointer transition-all flex items-center justify-between group ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-200 bg-white'}`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-1 rounded-md transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}</div>
                                                        <div>
                                                            <div className="text-xs font-black text-slate-700 uppercase tracking-tight">{pp.dueDate} • {getBusinessDisplayId(pp.sourceDocId)}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{cfItem?.name || 'Без статьи'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-mono font-black text-slate-900">{f(needed)} {pp.currency}</div>
                                                        {isSelected && <div className="text-[10px] font-bold text-blue-600 mt-0.5">Разнести {f(draft[pp.id])}</div>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {plannedPayments.filter(pp => !pp.isPaid && pp.counterpartyId === allocatingTarget.counterpartyId).length === 0 && (
                                            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-widest">Планов не найдено</div>
                                        )}
                                    </>
                                )}

                                {allocationMode === 'Manual' && (
                                    <div className="space-y-3">
                                        {manualDraft.filter(m => !m.targetBankAccountId).map(row => (
                                            <div key={row.id} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 items-center">
                                                <div className="flex-1">
                                                    <select 
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                                        value={row.cfId}
                                                        onChange={e => setManualDraft(prev => prev.map(m => m.id === row.id ? {...m, cfId: e.target.value} : m))}
                                                    >
                                                        <option value="">Выберите статью...</option>
                                                        {cashFlowItems.filter(i => i.type === (allocatingTarget.direction === 'Incoming' ? 'Income' : 'Expense')).map(cf => <option key={cf.id} value={cf.id}>{cf.name}</option>)}
                                                    </select>
                                                </div>
                                                <input type="number" className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-black" value={row.amount} onChange={e => setManualDraft(prev => prev.map(m => m.id === row.id ? {...m, amount: Number(e.target.value)} : m))}/>
                                                <button onClick={() => setManualDraft(prev => prev.filter(m => m.id !== row.id))} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => setManualDraft([...manualDraft, {id: ApiService.generateId('T'), cfId: '', amount: unallocatedPool}])} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-blue-600 hover:border-blue-200 transition-all">+ Добавить статью</button>
                                    </div>
                                )}

                                {allocationMode === 'Internal' && (
                                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Куда переводим (Целевой счет)</label>
                                            <select 
                                                className="w-full bg-white border-2 border-indigo-100 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 outline-none"
                                                onChange={(e) => setManualDraft([{id: 'INT', amount: unallocatedPool, cfId: '', targetBankAccountId: e.target.value}])}
                                            >
                                                <option value="">-- Выберите наш счет --</option>
                                                {bankAccounts.filter(a => a.id !== allocatingTarget.bankAccountId).map(a => <option key={a.id} value={a.id}>{a.bank} • {a.name} ({a.currency})</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3 text-indigo-600 bg-white/50 p-4 rounded-2xl border border-indigo-50">
                                            <Info size={20} className="shrink-0" />
                                            <p className="text-[9px] font-bold leading-tight uppercase tracking-tight">Это создаст транзакцию внутреннего перевода. Баланс изменится только по факту обработки обеих выписок.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleConfirm} disabled={(Object.keys(draft).length === 0 && manualDraft.length === 0) || isSaving} className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2 transition-all active:scale-95">
                                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <ArrowRightLeft size={20} />}
                                {isSaving ? 'Сохранение...' : 'Подтвердить разноску'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isImportModalOpen && <StatementImportModal onClose={() => setIsImportModalOpen(false)} />}
        </div>
    );
};
