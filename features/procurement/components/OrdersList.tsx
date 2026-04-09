
import React, { useState, useMemo } from 'react';
import { SupplierOrder, PlannedPayment, OrderStatus, Batch } from '@/types';
import { Pencil, Filter, Search, ArrowUpDown, Trash2, Layers } from 'lucide-react';

interface OrdersListProps {
    orders: SupplierOrder[];
    suppliers: any[];
    supplierFilter: string;
    setSupplierFilter: (val: string) => void;
    plannedPayments: PlannedPayment[];
    onEdit: (order: SupplierOrder) => void;
    onDelete?: (order: SupplierOrder) => void;
    batches?: Batch[];
}

type SortField = 'date' | 'id' | 'supplierName' | 'totalAmountForeign' | 'status' | 'name';
type SortOrder = 'asc' | 'desc';

export const OrdersList: React.FC<OrdersListProps> = ({
    orders, suppliers, supplierFilter, setSupplierFilter, plannedPayments, onEdit, onDelete, batches = []
}) => {
    // Индекс: orderId → batch для быстрого поиска
    const orderBatchMap = useMemo(() => {
        const m: Record<string, Batch> = {};
        batches.forEach(b => {
            (b.supplierOrderIds || []).forEach(ordId => { m[ordId] = b; });
        });
        return m;
    }, [batches]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const filteredAndSortedOrders = useMemo(() => {
        // Исключаем помеченные на удаление
        let result = orders.filter(o => !o.isDeleted);

        // Фильтр по поставщику
        if (supplierFilter) {
            result = result.filter(o => o.supplierId === supplierFilter);
        }

        // Поиск
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(o => 
                o.id.toLowerCase().includes(lowSearch) || 
                o.supplierName.toLowerCase().includes(lowSearch) ||
                (o.name && o.name.toLowerCase().includes(lowSearch))
            );
        }

        // Фильтр по статусу
        if (statusFilter !== 'all') {
            result = result.filter(o => o.status === statusFilter);
        }

        // Сортировка
        result.sort((a, b) => {
            let valA: any = a[sortField as keyof SupplierOrder] || '';
            let valB: any = b[sortField as keyof SupplierOrder] || '';

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [orders, supplierFilter, searchTerm, sortField, sortOrder, statusFilter]);

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

    const getOrderMetrics = (orderId: string, totalAmount: number) => {
        const relatedPayments = (plannedPayments || []).filter(p => p.sourceDocId === orderId);
        const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
        const paymentPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        return { paidAmount, paymentPercent };
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Поиск по ID, поставщику или названию..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-400" />
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            value={supplierFilter}
                            onChange={e => setSupplierFilter(e.target.value)}
                        >
                            <option value="">Все поставщики</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Все статусы</option>
                            <option value="CONFIRMED">Подтвержден</option>
                            <option value="DRAFT">Черновик</option>
                        </select>
                    </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Найдено: {filteredAndSortedOrders.length}
                </div>
            </div>

            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100/50" onClick={() => toggleSort('date')}>
                                Дата / ID <SortIcon field="date" />
                            </th>
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100/50" onClick={() => toggleSort('name')}>
                                Название <SortIcon field="name" />
                            </th>
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100/50" onClick={() => toggleSort('supplierName')}>
                                Поставщик <SortIcon field="supplierName" />
                            </th>
                            <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50" onClick={() => toggleSort('totalAmountForeign')}>
                                Сумма <SortIcon field="totalAmountForeign" />
                            </th>
                            <th className="px-6 py-4 text-center">Принято</th>
                            <th className="px-6 py-4 text-center w-24">Оплата</th>
                            <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50" onClick={() => toggleSort('status')}>
                                Статус <SortIcon field="status" />
                            </th>
                            <th className="px-6 py-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {filteredAndSortedOrders.length === 0 ? (
                            <tr><td colSpan={8} className="p-12 text-center text-gray-400 italic text-sm">Заказы не найдены</td></tr>
                        ) : filteredAndSortedOrders.map(o => {
                            const { paidAmount, paymentPercent } = getOrderMetrics(o.id, o.totalAmountForeign);
                            const linkedBatch = orderBatchMap[o.id];
                            return (
                                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-slate-700">{o.date}</div>
                                        <div className="text-[10px] text-slate-300 font-mono">#{o.id.slice(-6).toUpperCase()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-700 truncate max-w-[180px]" title={o.name || 'Без названия'}>
                                            {o.name || <span className="text-slate-300 italic">Без названия</span>}
                                        </div>
                                        {linkedBatch && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] font-black uppercase tracking-tight">
                                                    <Layers size={8}/> {linkedBatch.name}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{o.supplierName}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                        {f(o.totalAmountForeign)} {o.currency}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`text-[11px] font-black ${o.receivedItemCount >= o.totalItemCount ? 'text-emerald-600' : 'text-slate-700'}`}>{o.receivedItemCount}/{o.totalItemCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center">
                                            <div className="text-[10px] font-black text-slate-500 mb-1">{paymentPercent}%</div>
                                            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                                <div className={`h-full transition-all duration-700 ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, paymentPercent)}%` }}/>
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">{paidAmount.toLocaleString('ru-RU', {maximumFractionDigits: 0})} / {(o.totalAmountForeign || 0).toLocaleString('ru-RU', {maximumFractionDigits: 0})} {o.currency}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border bg-blue-50 text-blue-600 border-blue-100`}>{o.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEdit(o)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-all"><Pencil size={14}/></button>
                                            {onDelete && (<button onClick={() => onDelete(o)} className="p-1.5 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={14}/></button>)}
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
