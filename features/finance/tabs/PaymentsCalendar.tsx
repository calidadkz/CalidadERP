
import React, { useMemo } from 'react';
import { PlannedPayment } from '@/types';
import { Link2, Plus, Tag, ArrowUpRight, ArrowDownLeft, Receipt } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';

interface PaymentsCalendarProps {
    directionFilter?: 'All' | 'Outgoing' | 'Incoming';
    onOpenPaymentModal: (dir: 'Incoming' | 'Outgoing', plan?: PlannedPayment) => void;
    onOpenManualPlanModal: () => void;
}

export const PaymentsCalendar: React.FC<PaymentsCalendarProps> = ({ 
    directionFilter = 'All',
    onOpenPaymentModal,
    onOpenManualPlanModal
}) => {
    const { state } = useStore();
    const { plannedPayments } = state;
    
    const getBusinessDisplayId = (id: string, type: string) => {
        if (type === 'Manual') return 'РУЧНОЙ ПЛАН';
        return id ? `#${id.slice(-6).toUpperCase()}` : '—';
    };

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    
    const filteredPlans = useMemo(() => {
        return plannedPayments
            .filter(p => !p.isDeleted) // Исключаем помеченные на удаление
            .filter(p => directionFilter === 'All' || p.direction === directionFilter)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }, [plannedPayments, directionFilter]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Receipt size={18} className="text-indigo-500"/> Календарь платежей
                </h3>
                <div className="flex space-x-2">
                    <button onClick={onOpenManualPlanModal} className="flex items-center text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 transition-all font-medium shadow-sm">
                        <Plus size={14} className="mr-1 text-blue-500"/> Запланировать
                    </button>
                    <button onClick={() => onOpenPaymentModal('Outgoing')} className="flex items-center text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 shadow-sm font-bold">
                        <ArrowUpRight size={14} className="mr-1"/> Создать расход
                    </button>
                    <button onClick={() => onOpenPaymentModal('Incoming')} className="flex items-center text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 shadow-sm font-bold">
                        <ArrowDownLeft size={14} className="mr-1"/> Создать приход
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="w-12 text-center">Тип</th>
                            <th className="px-4 py-3 text-left">Дата</th>
                            <th className="px-6 py-3 text-left">Контрагент</th>
                            <th className="px-6 py-3 text-left">Основание / Статья</th>
                            <th className="px-6 py-3 text-right">Оплачено / План</th>
                            <th className="px-6 py-3 text-center">Статус</th>
                            <th className="px-6 py-3 w-32"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredPlans.length === 0 ? (
                            <tr><td colSpan={7} className="p-20 text-center text-gray-400 italic">Нет запланированных траншей</td></tr>
                        ) : (
                            filteredPlans.map(pp => {
                                const progress = Math.min(100, Math.round(((pp.amountPaid || 0) / pp.amountDue) * 100));
                                const cfItem = state.cashFlowItems.find(i => i.id === pp.cashFlowItemId);
                                const isOutgoing = pp.direction === 'Outgoing';

                                return (
                                    <tr key={pp.id} className={`hover:bg-gray-50/50 transition-colors group border-l-4 ${isOutgoing ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
                                        <td className="py-4 text-center">
                                            <div className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center ${isOutgoing ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {isOutgoing ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{pp.dueDate}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{pp.counterpartyName}</div>
                                            <div className={`text-[8px] font-black uppercase tracking-widest ${isOutgoing ? 'text-red-400' : 'text-emerald-500'}`}>
                                                {isOutgoing ? 'Расход' : 'Приход'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-mono text-blue-600 font-bold">{getBusinessDisplayId(pp.sourceDocId, pp.sourceDocType)}</div>
                                            <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 mt-0.5">
                                                <Tag size={10} className="text-slate-300"/> 
                                                <span className={cfItem ? 'text-slate-700' : 'text-red-300 italic'}>
                                                    {cfItem?.name || 'Без статьи ДДС'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="text-xs font-black text-slate-800">
                                                    {f(pp.amountPaid || 0)} <span className="text-[9px] text-slate-400">/ {f(pp.amountDue)} {pp.currency}</span>
                                                </div>
                                                <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden border border-slate-200/50">
                                                    <div className={`h-full transition-all duration-500 ${isOutgoing ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}/>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${pp.isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                {pp.isPaid ? 'Оплачено' : 'Ожидание'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!pp.isPaid && (
                                                <button 
                                                    onClick={() => onOpenPaymentModal(pp.direction, pp)} 
                                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 active:scale-95"
                                                >
                                                    <Link2 size={12}/> Разнести
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
