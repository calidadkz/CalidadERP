
import React, { useState, useMemo } from 'react';
import { SupplierOrder, PlannedPayment, Batch } from '@/types';
import { Pencil, Trash2, Layers, X } from 'lucide-react';
import { ColumnFilter } from '@/components/ui/ColumnFilter';
import { formatDateDMY } from '@/utils/formatDate';

interface OrdersListProps {
    orders: SupplierOrder[];
    suppliers: any[];
    supplierFilter?: string;
    setSupplierFilter?: (val: string) => void;
    plannedPayments: PlannedPayment[];
    onEdit: (order: SupplierOrder) => void;
    onDelete?: (order: SupplierOrder) => void;
    batches?: Batch[];
}

type SortField = 'date' | 'name' | 'supplierName' | 'totalAmountForeign' | 'status';
type SortOrder = 'asc' | 'desc';

export const OrdersList: React.FC<OrdersListProps> = ({
    orders, plannedPayments, onEdit, onDelete, batches = []
}) => {
    // Индекс: orderId → batch
    const orderBatchMap = useMemo(() => {
        const m: Record<string, Batch> = {};
        batches.forEach(b => {
            (b.supplierOrderIds || []).forEach(id => { m[id] = b; });
        });
        return m;
    }, [batches]);

    const [filters, setFilters] = useState<Record<string, string>>({});
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const setFilter = (key: string, val: string) =>
        setFilters(f => val ? { ...f, [key]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)));

    const hasFilters = Object.keys(filters).length > 0;

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const active = useMemo(() => orders.filter(o => !o.isDeleted), [orders]);

    // ── Подсказки для колонок ──
    const dateSuggestions = useMemo(() =>
        [...new Set(active.map(o => formatDateDMY(o.date)))].sort().reverse(),
    [active]);
    const nameSuggestions = useMemo(() =>
        [...new Set(active.filter(o => o.name).map(o => o.name!))].sort(),
    [active]);
    const supplierSuggestions = useMemo(() =>
        [...new Set(active.filter(o => o.supplierName).map(o => o.supplierName))].sort(),
    [active]);
    const statusSuggestions = useMemo(() =>
        [...new Set(active.map(o => o.status))].sort(),
    [active]);

    const filteredAndSortedOrders = useMemo(() => {
        let result = active;

        if (filters.date) {
            const q = filters.date.toLowerCase();
            result = result.filter(o =>
                formatDateDMY(o.date).toLowerCase().includes(q) ||
                o.id.toLowerCase().includes(q)
            );
        }
        if (filters.name) {
            const q = filters.name.toLowerCase();
            result = result.filter(o =>
                (o.name || '').toLowerCase().includes(q) ||
                o.id.toLowerCase().includes(q)
            );
        }
        if (filters.supplierName) {
            const q = filters.supplierName.toLowerCase();
            result = result.filter(o => o.supplierName.toLowerCase().includes(q));
        }
        if (filters.status) {
            const q = filters.status.toLowerCase();
            result = result.filter(o => o.status.toLowerCase().includes(q));
        }

        result = [...result].sort((a, b) => {
            const valA: any = a[sortField as keyof SupplierOrder] || '';
            const valB: any = b[sortField as keyof SupplierOrder] || '';
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [active, filters, sortField, sortOrder]);

    const toggleSort = (field: string) => {
        const sf = field as SortField;
        if (sortField === sf) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(sf); setSortOrder('asc'); }
    };

    const getOrderMetrics = (orderId: string, totalAmount: number) => {
        const rel = (plannedPayments || []).filter(p => p.sourceDocId === orderId);
        const paidAmount = rel.reduce((s, p) => s + (p.amountPaid || 0), 0);
        const paymentPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        return { paidAmount, paymentPercent };
    };

    return (
        <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
            {/* Полоса сброса фильтров */}
            {hasFilters && (
                <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                        Найдено: {filteredAndSortedOrders.length}
                    </span>
                    <button
                        onClick={() => setFilters({})}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-red-500 transition-colors"
                    >
                        <X size={10} /> Сбросить фильтры
                    </button>
                </div>
            )}

            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                    <tr>
                        <th className="px-3 py-3 text-left">
                            <ColumnFilter
                                label="Дата / ID"
                                sortKey="date"
                                currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                filterValue={filters.date || ''} onFilterChange={v => setFilter('date', v)}
                                suggestions={dateSuggestions}
                            />
                        </th>
                        <th className="px-3 py-3 text-left">
                            <ColumnFilter
                                label="Название"
                                sortKey="name"
                                currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                filterValue={filters.name || ''} onFilterChange={v => setFilter('name', v)}
                                suggestions={nameSuggestions}
                            />
                        </th>
                        <th className="px-3 py-3 text-left">
                            <ColumnFilter
                                label="Поставщик"
                                sortKey="supplierName"
                                currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                filterValue={filters.supplierName || ''} onFilterChange={v => setFilter('supplierName', v)}
                                suggestions={supplierSuggestions}
                            />
                        </th>
                        <th className="px-3 py-3 text-right">
                            <ColumnFilter
                                label="Сумма"
                                sortKey="totalAmountForeign"
                                currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                align="right"
                            />
                        </th>
                        <th className="px-3 py-3 text-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Принято</span>
                        </th>
                        <th className="px-3 py-3 text-center w-20">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Оплата</span>
                        </th>
                        <th className="px-3 py-3 text-center">
                            <ColumnFilter
                                label="Статус"
                                sortKey="status"
                                currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                filterValue={filters.status || ''} onFilterChange={v => setFilter('status', v)}
                                suggestions={statusSuggestions}
                                align="center"
                            />
                        </th>
                        <th className="px-3 py-3 w-14" />
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                    {filteredAndSortedOrders.length === 0 ? (
                        <tr><td colSpan={8} className="p-12 text-center text-gray-400 italic text-sm">Заказы не найдены</td></tr>
                    ) : filteredAndSortedOrders.map(o => {
                        const { paidAmount, paymentPercent } = getOrderMetrics(o.id, o.totalAmountForeign);
                        const linkedBatch = orderBatchMap[o.id];
                        return (
                            <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-3 py-3">
                                    <div className="text-xs font-bold text-slate-700 whitespace-nowrap">{formatDateDMY(o.date)}</div>
                                    <div className="text-[10px] text-slate-300 font-mono">#{o.id.slice(-6).toUpperCase()}</div>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="text-xs font-medium text-slate-700 truncate max-w-[160px]" title={o.name || 'Без названия'}>
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
                                <td className="px-3 py-3">
                                    <div className="text-xs font-bold text-slate-700 truncate max-w-[140px]" title={o.supplierName}>{o.supplierName}</div>
                                </td>
                                <td className="px-3 py-3 text-xs text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                    {f(o.totalAmountForeign)} {o.currency}
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className={`text-[11px] font-black ${o.receivedItemCount >= o.totalItemCount ? 'text-emerald-600' : 'text-slate-700'}`}>{o.receivedItemCount}/{o.totalItemCount}</span>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-col items-center">
                                        <div className="text-[10px] font-black text-slate-500 mb-1">{paymentPercent}%</div>
                                        <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                            <div className={`h-full transition-all duration-700 ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, paymentPercent)}%` }}/>
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">{paidAmount.toLocaleString('ru-RU', {maximumFractionDigits: 0})} / {(o.totalAmountForeign || 0).toLocaleString('ru-RU', {maximumFractionDigits: 0})} {o.currency}</div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border bg-blue-50 text-blue-600 border-blue-100">{o.status}</span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                    <div className="flex justify-end gap-0.5">
                                        <button onClick={() => onEdit(o)} className="p-1.5 text-slate-300 hover:text-blue-500 transition-all rounded-lg hover:bg-blue-50"><Pencil size={13}/></button>
                                        {onDelete && (<button onClick={() => onDelete(o)} className="p-1.5 text-slate-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>)}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                {!hasFilters && (
                    <tfoot>
                        <tr>
                            <td colSpan={8} className="px-4 py-2 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                Всего: {active.length}
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
};
