
import React, { useMemo, useState } from 'react';
import { PlannedPayment } from '@/types';
import { Link2, Plus, ArrowUpRight, ArrowDownLeft, Receipt, X, CalendarPlus } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ColumnFilter } from '@/components/ui/ColumnFilter';
import { formatDateDMY } from '@/utils/formatDate';

interface PaymentsCalendarProps {
    directionFilter?: 'All' | 'Outgoing' | 'Incoming';
    onOpenPaymentModal: (dir: 'Incoming' | 'Outgoing', plan?: PlannedPayment) => void;
    onOpenManualPlanModal: () => void;
}

type SortField = 'dueDate' | 'counterpartyName' | 'amountDue' | 'isPaid';
type SortOrder = 'asc' | 'desc';

export const PaymentsCalendar: React.FC<PaymentsCalendarProps> = ({
    directionFilter = 'All',
    onOpenPaymentModal,
    onOpenManualPlanModal
}) => {
    const { state } = useStore();
    const { plannedPayments } = state;

    const [filters, setFilters] = useState<Record<string, string>>({});
    const [sortField, setSortField] = useState<SortField>('dueDate');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const setFilter = (key: string, val: string) =>
        setFilters(f => val ? { ...f, [key]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)));

    const hasFilters = Object.keys(filters).length > 0;

    const getBusinessDisplayId = (id: string, type: string) => {
        if (type === 'Manual') return 'РУЧНОЙ ПЛАН';
        return id ? `#${id.slice(-6).toUpperCase()}` : '—';
    };

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const active = useMemo(() =>
        plannedPayments.filter(p => !p.isDeleted && (directionFilter === 'All' || p.direction === directionFilter)),
    [plannedPayments, directionFilter]);

    // ── Подсказки ──
    const dateSuggestions = useMemo(() =>
        [...new Set(active.map(p => formatDateDMY(p.dueDate)))].sort().reverse(),
    [active]);
    const counterpartySuggestions = useMemo(() =>
        [...new Set(active.filter(p => p.counterpartyName).map(p => p.counterpartyName!))].sort(),
    [active]);
    const cfItemSuggestions = useMemo(() => {
        const names = active
            .map(p => state.cashFlowItems.find(i => i.id === p.cashFlowItemId)?.name)
            .filter(Boolean) as string[];
        return [...new Set(names)].sort();
    }, [active, state.cashFlowItems]);
    const statusSuggestions = ['Оплачено', 'Ожидание'];

    const filteredAndSorted = useMemo(() => {
        let result = active;

        if (filters.dueDate) {
            const q = filters.dueDate.toLowerCase();
            result = result.filter(p => formatDateDMY(p.dueDate).toLowerCase().includes(q));
        }
        if (filters.counterpartyName) {
            const q = filters.counterpartyName.toLowerCase();
            result = result.filter(p => (p.counterpartyName || '').toLowerCase().includes(q));
        }
        if (filters.cfItem) {
            const q = filters.cfItem.toLowerCase();
            result = result.filter(p => {
                const name = state.cashFlowItems.find(i => i.id === p.cashFlowItemId)?.name || '';
                return name.toLowerCase().includes(q);
            });
        }
        if (filters.status) {
            const q = filters.status.toLowerCase();
            result = result.filter(p => {
                const label = p.isPaid ? 'оплачено' : 'ожидание';
                return label.includes(q);
            });
        }

        result = [...result].sort((a, b) => {
            let valA: any, valB: any;
            if (sortField === 'isPaid') {
                valA = a.isPaid ? 1 : 0;
                valB = b.isPaid ? 1 : 0;
            } else {
                valA = a[sortField as keyof PlannedPayment] || '';
                valB = b[sortField as keyof PlannedPayment] || '';
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [active, filters, sortField, sortOrder, state.cashFlowItems]);

    const toggleSort = (field: string) => {
        const sf = field as SortField;
        if (sortField === sf) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(sf); setSortOrder('asc'); }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Receipt size={18} className="text-indigo-500"/> Календарь платежей
                </h3>
                <div className="flex gap-2">
                    <button onClick={onOpenManualPlanModal} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black uppercase text-[10px] tracking-widest">
                        <CalendarPlus size={14}/> Запланировать
                    </button>
                    <button onClick={() => onOpenPaymentModal('Outgoing')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-md font-black uppercase text-[10px] tracking-widest">
                        <ArrowUpRight size={14}/> Расход
                    </button>
                    <button onClick={() => onOpenPaymentModal('Incoming')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md font-black uppercase text-[10px] tracking-widest">
                        <ArrowDownLeft size={14}/> Приход
                    </button>
                </div>
            </div>

            {/* Полоса сброса фильтров */}
            {hasFilters && (
                <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                        Найдено: {filteredAndSorted.length}
                    </span>
                    <button
                        onClick={() => setFilters({})}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-red-500 transition-colors"
                    >
                        <X size={10} /> Сбросить фильтры
                    </button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-12 text-center px-2 py-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Тип</span>
                            </th>
                            <th className="px-4 py-3 text-left">
                                <ColumnFilter
                                    label="Дата"
                                    sortKey="dueDate"
                                    currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                    filterValue={filters.dueDate || ''} onFilterChange={v => setFilter('dueDate', v)}
                                    suggestions={dateSuggestions}
                                />
                            </th>
                            <th className="px-4 py-3 text-left">
                                <ColumnFilter
                                    label="Контрагент"
                                    sortKey="counterpartyName"
                                    currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                    filterValue={filters.counterpartyName || ''} onFilterChange={v => setFilter('counterpartyName', v)}
                                    suggestions={counterpartySuggestions}
                                />
                            </th>
                            <th className="px-4 py-3 text-left">
                                <ColumnFilter
                                    label="Основание / Статья"
                                    filterValue={filters.cfItem || ''} onFilterChange={v => setFilter('cfItem', v)}
                                    suggestions={cfItemSuggestions}
                                />
                            </th>
                            <th className="px-4 py-3 text-right">
                                <ColumnFilter
                                    label="Оплачено / План"
                                    sortKey="amountDue"
                                    currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                    align="right"
                                />
                            </th>
                            <th className="px-4 py-3 text-center">
                                <ColumnFilter
                                    label="Статус"
                                    sortKey="isPaid"
                                    currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                    filterValue={filters.status || ''} onFilterChange={v => setFilter('status', v)}
                                    suggestions={statusSuggestions}
                                    align="center"
                                />
                            </th>
                            <th className="px-4 py-3 w-28" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredAndSorted.length === 0 ? (
                            <tr><td colSpan={7} className="p-20 text-center text-gray-400 italic">Нет запланированных траншей</td></tr>
                        ) : (
                            filteredAndSorted.map(pp => {
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
                                        <td className="px-4 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">
                                            {formatDateDMY(pp.dueDate)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{pp.counterpartyName}</div>
                                            <div className={`text-[8px] font-black uppercase tracking-widest ${isOutgoing ? 'text-red-400' : 'text-emerald-500'}`}>
                                                {isOutgoing ? 'Расход' : 'Приход'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-mono text-blue-600 font-bold">{getBusinessDisplayId(pp.sourceDocId, pp.sourceDocType)}</div>
                                            <div className="text-[10px] text-gray-500 font-bold flex items-center gap-1.5 mt-0.5">
                                                <span className={cfItem ? 'text-slate-700' : 'text-red-300 italic'}>
                                                    {cfItem?.name || 'Без статьи ДДС'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="text-xs font-black text-slate-800">
                                                    {f(pp.amountPaid || 0)} <span className="text-[9px] text-slate-400">/ {f(pp.amountDue)} {pp.currency}</span>
                                                </div>
                                                <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden border border-slate-200/50">
                                                    <div className={`h-full transition-all duration-500 ${isOutgoing ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}/>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${pp.isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                {pp.isPaid ? 'Оплачено' : 'Ожидание'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
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
                    {!hasFilters && (
                        <tfoot>
                            <tr>
                                <td colSpan={7} className="px-4 py-2 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    Всего: {active.length}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};
