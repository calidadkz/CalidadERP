
import React, { useState, useMemo } from 'react';
import { SalesOrder, PlannedPayment } from '@/types';
import { Pencil, Trash2, ArrowUpDown, Search, Filter } from 'lucide-react';

interface SalesOrdersListProps {
    salesOrders: SalesOrder[];
    plannedPayments: PlannedPayment[];
    showColClient: boolean;
    showColAmount: boolean;
    showColPayment: boolean;
    showColShipment: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (order: SalesOrder) => void;
    onDelete: (order: SalesOrder) => void;
}

type SortField = 'date' | 'id' | 'clientName' | 'totalAmount' | 'status' | 'name';
type SortOrder = 'asc' | 'desc';

export const SalesOrdersList: React.FC<SalesOrdersListProps> = ({
    salesOrders, plannedPayments, showColClient, showColAmount, showColPayment, showColShipment, canEdit, canDelete, onEdit, onDelete
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const filteredAndSortedOrders = useMemo(() => {
        // Исключаем помеченные на удаление из основного списка
        let result = salesOrders.filter(o => !o.isDeleted);

        // Поиск
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(o => 
                o.id.toLowerCase().includes(lowSearch) || 
                o.clientName.toLowerCase().includes(lowSearch) ||
                (o.name && o.name.toLowerCase().includes(lowSearch))
            );
        }

        // Фильтр по статусу
        if (statusFilter !== 'all') {
            result = result.filter(o => {
                const relatedPayments = plannedPayments.filter(p => p.sourceDocId === o.id);
                const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                const isFullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
                const isFullyPaid = paidAmount >= (o.totalAmount - 0.1);
                const currentStatus = (isFullyShipped && isFullyPaid) ? 'Реализован' : o.status;
                return currentStatus === statusFilter;
            });
        }

        // Сортировка
        result.sort((a, b) => {
            let valA: any = a[sortField as keyof SalesOrder] || '';
            let valB: any = b[sortField as keyof SalesOrder] || '';

            if (sortField === 'status') {
                const getStatus = (o: SalesOrder) => {
                    const relatedPayments = plannedPayments.filter(p => p.sourceDocId === o.id);
                    const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                    const isFullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
                    const isFullyPaid = paidAmount >= (o.totalAmount - 0.1);
                    return (isFullyShipped && isFullyPaid) ? 'Реализован' : o.status;
                };
                valA = getStatus(a);
                valB = getStatus(b);
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [salesOrders, searchTerm, sortField, sortOrder, statusFilter, plannedPayments]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => (
        <ArrowUpDown size={12} className={`inline ml-1 transition-colors ${sortField === field ? 'text-blue-600' : 'text-slate-300'}`} />
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Поиск по ID, клиенту или названию..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Все статусы</option>
                            <option value="CONFIRMED">Подтвержден</option>
                            <option value="Реализован">Реализован</option>
                        </select>
                    </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Найдено: {filteredAndSortedOrders.length}
                </div>
            </div>

            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('date')}>
                                Дата / ID <SortIcon field="date" />
                            </th>
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('name')}>
                                Название <SortIcon field="name" />
                            </th>
                            {showColClient && (
                                <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('clientName')}>
                                    Клиент <SortIcon field="clientName" />
                                </th>
                            )}
                            {showColAmount && (
                                <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('totalAmount')}>
                                    Сумма <SortIcon field="totalAmount" />
                                </th>
                            )}
                            <th className="px-6 py-4 text-center">Отгр.</th>
                            {showColPayment && <th className="px-6 py-4 text-center w-24">Оплата</th>}
                            {showColShipment && (
                                <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('status')}>
                                    Статус <SortIcon field="status" />
                                </th>
                            )}
                            <th className="px-6 py-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {filteredAndSortedOrders.length === 0 ? (
                            <tr><td colSpan={showColClient ? 8 : 7} className="p-12 text-center text-gray-400 italic text-sm">Заказы не найдены</td></tr>
                        ) : filteredAndSortedOrders.map(o => {
                            const relatedPayments = plannedPayments.filter(p => p.sourceDocId === o.id);
                            const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                            const paymentPercent = o.totalAmount > 0 ? Math.round((paidAmount / o.totalAmount) * 100) : 0;
                            const isFullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
                            const isFullyPaid = paidAmount >= (o.totalAmount - 0.1);
                            const statusLabel = (isFullyShipped && isFullyPaid) ? 'Реализован' : o.status;

                            return (
                                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-slate-700">{o.date}</div>
                                        <div className="text-[10px] text-slate-300 font-mono">#{o.id.slice(-6).toUpperCase()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-700 truncate max-w-[200px]" title={o.name || 'Без названия'}>
                                            {o.name || <span className="text-slate-300 italic">Без названия</span>}
                                        </div>
                                    </td>
                                    {showColClient && (
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-700">{o.clientName}</div>
                                        </td>
                                    )}
                                    {showColAmount && (
                                        <td className="px-6 py-4 text-sm text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                            {f(o.totalAmount)} ₸
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-[11px] font-black ${isFullyShipped ? 'text-emerald-600' : 'text-slate-700'}`}>{o.shippedItemCount}/{o.totalItemCount}</span>
                                        </div>
                                    </td>
                                    {showColPayment && (
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center">
                                                <div className="text-[10px] font-black text-slate-500 mb-1">{paymentPercent}%</div>
                                                <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                                    <div className={`h-full transition-all duration-700 ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, paymentPercent)}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                    {showColShipment && (
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border ${statusLabel === 'Реализован' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{statusLabel}</span>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canEdit && (<button onClick={() => onEdit(o)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-all"><Pencil size={14}/></button>)}
                                            {canDelete && (<button onClick={() => onDelete(o)} className="p-1.5 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={14}/></button>)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
