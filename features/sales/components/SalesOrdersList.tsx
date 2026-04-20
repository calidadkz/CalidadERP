
import React, { useState, useMemo } from 'react';
import { SalesOrder, PlannedPayment } from '@/types';
import { Pencil, Trash2, X } from 'lucide-react';
import { ColumnFilter } from '@/components/ui/ColumnFilter';
import { formatDateDMY } from '@/utils/formatDate';

interface SalesOrdersListProps {
    salesOrders: SalesOrder[];
    plannedPayments: PlannedPayment[];
    showColClient: boolean;
    showColAmount: boolean;
    showColPayment: boolean;
    showColShipment: boolean;
    showColResponsible: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (order: SalesOrder) => void;
    onDelete: (order: SalesOrder) => void;
}

type SortField = 'date' | 'id' | 'clientName' | 'totalAmount' | 'status' | 'name';
type SortOrder = 'asc' | 'desc';

export const SalesOrdersList: React.FC<SalesOrdersListProps> = ({
    salesOrders, plannedPayments, showColClient, showColAmount, showColPayment, showColShipment, showColResponsible, canEdit, canDelete, onEdit, onDelete
}) => {
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const setFilter = (key: string, val: string) =>
        setFilters(f => val ? { ...f, [key]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)));

    const hasFilters = Object.keys(filters).length > 0;

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const active = useMemo(() => salesOrders.filter(o => !o.isDeleted), [salesOrders]);

    const getStatusLabel = (o: SalesOrder) => {
        const rel = plannedPayments.filter(p => p.sourceDocId === o.id);
        const paid = rel.reduce((s, p) => s + (p.amountPaid || 0), 0);
        const fullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
        const fullyPaid = paid >= (o.totalAmount - 0.1);
        return (fullyShipped && fullyPaid) ? 'Реализован' : o.status;
    };

    // ── Подсказки для колонок ──
    const dateSuggestions = useMemo(() =>
        [...new Set(active.map(o => formatDateDMY(o.date)))].sort().reverse(),
    [active]);
    const nameSuggestions = useMemo(() =>
        [...new Set(active.filter(o => o.name).map(o => o.name!))].sort(),
    [active]);
    const clientSuggestions = useMemo(() =>
        [...new Set(active.filter(o => o.clientName).map(o => o.clientName))].sort(),
    [active]);
    const statusSuggestions = useMemo(() =>
        [...new Set(active.map(o => getStatusLabel(o)))].sort(),
    [active, plannedPayments]);

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
        if (filters.clientName) {
            const q = filters.clientName.toLowerCase();
            result = result.filter(o => o.clientName.toLowerCase().includes(q));
        }
        if (filters.status) {
            const q = filters.status.toLowerCase();
            result = result.filter(o => getStatusLabel(o).toLowerCase().includes(q));
        }

        result = [...result].sort((a, b) => {
            let valA: any, valB: any;
            if (sortField === 'status') {
                valA = getStatusLabel(a);
                valB = getStatusLabel(b);
            } else {
                valA = a[sortField as keyof SalesOrder] || '';
                valB = b[sortField as keyof SalesOrder] || '';
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [active, filters, sortField, sortOrder, plannedPayments]);

    const toggleSort = (field: string) => {
        const f = field as SortField;
        if (sortField === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(f); setSortOrder('asc'); }
    };

    const colSpan = 4 + (showColClient ? 1 : 0) + (showColAmount ? 1 : 0) + (showColPayment ? 1 : 0) + (showColShipment ? 1 : 0) + (showColResponsible ? 1 : 0);

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
                        {showColClient && (
                            <th className="px-3 py-3 text-left">
                                <ColumnFilter
                                    label="Клиент"
                                    sortKey="clientName"
                                    currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                    filterValue={filters.clientName || ''} onFilterChange={v => setFilter('clientName', v)}
                                    suggestions={clientSuggestions}
                                />
                            </th>
                        )}
                        {showColAmount && (
                            <th className="px-3 py-3 text-right">
                                <ColumnFilter
                                    label="Сумма"
                                    sortKey="totalAmount"
                                    currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                    align="right"
                                />
                            </th>
                        )}
                        <th className="px-3 py-3 text-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Отгр.</span>
                        </th>
                        {showColPayment && (
                            <th className="px-3 py-3 text-center w-20">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Оплата</span>
                            </th>
                        )}
                        {showColShipment && (
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
                        )}
                        {showColResponsible && (
                            <th className="px-3 py-3 text-left">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ответственный</span>
                            </th>
                        )}
                        <th className="px-3 py-3 w-14" />
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                    {filteredAndSortedOrders.length === 0 ? (
                        <tr><td colSpan={colSpan} className="p-12 text-center text-gray-400 italic text-sm">Заказы не найдены</td></tr>
                    ) : filteredAndSortedOrders.map(o => {
                        const relatedPayments = plannedPayments.filter(p => p.sourceDocId === o.id);
                        const paidAmount = relatedPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
                        const paymentPercent = o.totalAmount > 0 ? Math.round((paidAmount / o.totalAmount) * 100) : 0;
                        const isFullyShipped = o.shippedItemCount >= o.totalItemCount && o.totalItemCount > 0;
                        const isFullyPaid = paidAmount >= (o.totalAmount - 0.1);
                        const statusLabel = (isFullyShipped && isFullyPaid) ? 'Реализован' : o.status;

                        return (
                            <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-3 py-3">
                                    <div className="text-xs font-bold text-slate-700 whitespace-nowrap">{formatDateDMY(o.date)}</div>
                                    <div className="text-[10px] text-slate-300 font-mono">#{o.id.slice(-6).toUpperCase()}</div>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="text-xs font-medium text-slate-700 truncate max-w-[180px]" title={o.name || 'Без названия'}>
                                        {o.name || <span className="text-slate-300 italic">Без названия</span>}
                                    </div>
                                </td>
                                {showColClient && (
                                    <td className="px-3 py-3">
                                        <div className="text-xs font-bold text-slate-700 truncate max-w-[140px]" title={o.clientName}>{o.clientName}</div>
                                    </td>
                                )}
                                {showColAmount && (
                                    <td className="px-3 py-3 text-xs text-right font-mono font-black text-slate-900 whitespace-nowrap">
                                        {f(o.totalAmount)} ₸
                                    </td>
                                )}
                                <td className="px-3 py-3 text-center">
                                    <span className={`text-[11px] font-black ${isFullyShipped ? 'text-emerald-600' : 'text-slate-700'}`}>{o.shippedItemCount}/{o.totalItemCount}</span>
                                </td>
                                {showColPayment && (
                                    <td className="px-3 py-3">
                                        <div className="flex flex-col items-center">
                                            <div className="text-[10px] font-black text-slate-500 mb-1">{paymentPercent}%</div>
                                            <div className="w-14 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                                <div className={`h-full transition-all duration-700 ${paymentPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, paymentPercent)}%` }} />
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">{paidAmount.toLocaleString('ru-RU', {maximumFractionDigits: 0})} / {o.totalAmount.toLocaleString('ru-RU', {maximumFractionDigits: 0})} ₸</div>
                                        </div>
                                    </td>
                                )}
                                {showColShipment && (
                                    <td className="px-3 py-3 text-center">
                                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border ${statusLabel === 'Реализован' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{statusLabel}</span>
                                    </td>
                                )}
                                {showColResponsible && (
                                    <td className="px-3 py-3">
                                        <div className="text-[11px] font-bold text-slate-600 truncate max-w-[120px]">
                                            {o.responsibleEmployeeName || <span className="text-slate-300 italic">—</span>}
                                        </div>
                                    </td>
                                )}
                                <td className="px-3 py-3 text-right">
                                    <div className="flex justify-end gap-0.5">
                                        {canEdit && (<button onClick={() => onEdit(o)} className="p-1.5 text-slate-300 hover:text-blue-500 transition-all rounded-lg hover:bg-blue-50"><Pencil size={13}/></button>)}
                                        {canDelete && (<button onClick={() => onDelete(o)} className="p-1.5 text-slate-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"><Trash2 size={13}/></button>)}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                {!hasFilters && (
                    <tfoot>
                        <tr>
                            <td colSpan={colSpan} className="px-4 py-2 text-right text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                Всего: {active.length}
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
};
