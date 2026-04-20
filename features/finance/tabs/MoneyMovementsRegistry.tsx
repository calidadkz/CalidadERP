import React, { useMemo, useState } from 'react';
import { MoneyMovement, Currency } from '@/types';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, X } from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { formatDateDMY } from '@/utils/formatDate';
import { ColumnFilter } from '@/components/ui/ColumnFilter';

const f = (v: number) => v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const MoneyMovementsRegistry: React.FC = () => {
    const { state } = useStore();
    const { moneyMovements, bankAccounts, cashFlowItems } = state;

    const [filters, setFilters] = useState<Record<string, string>>({});
    const [sortField, setSortField] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const setFilter = (key: string, val: string) =>
        setFilters(f => val ? { ...f, [key]: val } : Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)));
    const hasFilters = Object.keys(filters).length > 0;

    const toggleSort = (field: string) => {
        const sf = field as typeof sortField;
        if (sortField === sf) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(sf); setSortOrder('asc'); }
    };

    // Сводка по счетам: входящие − исходящие = итог
    const accountSummary = useMemo(() => {
        const map: Record<string, { inKzt: number; outKzt: number }> = {};
        for (const m of moneyMovements) {
            if (!m.bankAccountId) continue;
            if (!map[m.bankAccountId]) map[m.bankAccountId] = { inKzt: 0, outKzt: 0 };
            if (m.direction === 'In') map[m.bankAccountId].inKzt += Number(m.amountKzt) || 0;
            else map[m.bankAccountId].outKzt += Number(m.amountKzt) || 0;
        }
        return map;
    }, [moneyMovements]);

    // Предложения для фильтров
    const accountSuggestions = useMemo(() =>
        bankAccounts.map(a => a.name), [bankAccounts]);
    const dateSuggestions = useMemo(() =>
        [...new Set(moneyMovements.map(m => formatDateDMY(m.date)))].sort().reverse(),
    [moneyMovements]);
    const typeSuggestions = ['Payment', 'Reversal', 'Transfer'];
    const counterpartySuggestions = useMemo(() =>
        [...new Set(moneyMovements.filter(m => m.counterpartyName).map(m => m.counterpartyName!))].sort(),
    [moneyMovements]);

    const filtered = useMemo(() => {
        let result = [...moneyMovements];

        if (filters.account) {
            const q = filters.account.toLowerCase();
            result = result.filter(m => {
                const acc = bankAccounts.find(a => a.id === m.bankAccountId);
                return (acc?.name || '').toLowerCase().includes(q);
            });
        }
        if (filters.date) {
            const q = filters.date.toLowerCase();
            result = result.filter(m => formatDateDMY(m.date).toLowerCase().includes(q));
        }
        if (filters.counterparty) {
            const q = filters.counterparty.toLowerCase();
            result = result.filter(m => (m.counterpartyName || '').toLowerCase().includes(q));
        }
        if (filters.type) {
            const q = filters.type.toLowerCase();
            result = result.filter(m => m.type.toLowerCase().includes(q));
        }

        result = [...result].sort((a, b) => {
            let valA: any, valB: any;
            if (sortField === 'amount') { valA = Number(a.amountKzt); valB = Number(b.amountKzt); }
            else { valA = a.date; valB = b.date; }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [moneyMovements, filters, sortField, sortOrder, bankAccounts]);

    // Итоги по отфильтрованным строкам
    const totals = useMemo(() => {
        const inKzt = filtered.filter(m => m.direction === 'In').reduce((s, m) => s + (Number(m.amountKzt) || 0), 0);
        const outKzt = filtered.filter(m => m.direction === 'Out').reduce((s, m) => s + (Number(m.amountKzt) || 0), 0);
        return { inKzt, outKzt, netKzt: inKzt - outKzt };
    }, [filtered]);

    return (
        <div className="space-y-4">
            {/* Сводка по счетам */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {bankAccounts.map(acc => {
                    const s = accountSummary[acc.id] || { inKzt: 0, outKzt: 0 };
                    const net = s.inKzt - s.outKzt;
                    return (
                        <div key={acc.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{acc.name}</div>
                            <div className="text-[9px] text-slate-400 mb-2">{acc.bank} · {acc.currency}</div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-emerald-600 font-bold">+{f(s.inKzt)}</span>
                                <span className="text-red-500 font-bold">−{f(s.outKzt)}</span>
                            </div>
                            <div className={`text-sm font-black ${net >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                                {net >= 0 ? '+' : ''}{f(net)} ₸
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Таблица движений */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Реестр движений денежных средств</h3>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-emerald-600 font-bold">+{f(totals.inKzt)} ₸</span>
                        <span className="text-xs text-red-500 font-bold">−{f(totals.outKzt)} ₸</span>
                        <span className={`text-xs font-black ${totals.netKzt >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                            = {totals.netKzt >= 0 ? '+' : ''}{f(totals.netKzt)} ₸
                        </span>
                        {!hasFilters && (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {filtered.length} записей
                            </span>
                        )}
                    </div>
                </div>

                {hasFilters && (
                    <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            Найдено: {filtered.length}
                        </span>
                        <button
                            onClick={() => setFilters({})}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-red-500 transition-colors"
                        >
                            <X size={10}/> Сбросить фильтры
                        </button>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left">
                                    <ColumnFilter
                                        label="Дата"
                                        sortKey="date"
                                        currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                        filterValue={filters.date || ''} onFilterChange={v => setFilter('date', v)}
                                        suggestions={dateSuggestions}
                                    />
                                </th>
                                <th className="px-4 py-3 text-left w-16">Напр.</th>
                                <th className="px-4 py-3 text-left">
                                    <ColumnFilter
                                        label="Контрагент"
                                        filterValue={filters.counterparty || ''} onFilterChange={v => setFilter('counterparty', v)}
                                        suggestions={counterpartySuggestions}
                                    />
                                </th>
                                <th className="px-4 py-3 text-left">
                                    <ColumnFilter
                                        label="Счёт"
                                        filterValue={filters.account || ''} onFilterChange={v => setFilter('account', v)}
                                        suggestions={accountSuggestions}
                                    />
                                </th>
                                <th className="px-4 py-3 text-left">Статья ДДС</th>
                                <th className="px-4 py-3 text-right">
                                    <ColumnFilter
                                        label="Сумма"
                                        sortKey="amount"
                                        currentSortKey={sortField} sortOrder={sortOrder} onSort={toggleSort}
                                        align="right"
                                    />
                                </th>
                                <th className="px-4 py-3 text-right">KZT</th>
                                <th className="px-4 py-3 text-center">
                                    <ColumnFilter
                                        label="Тип"
                                        filterValue={filters.type || ''} onFilterChange={v => setFilter('type', v)}
                                        suggestions={typeSuggestions}
                                        align="center"
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="p-20 text-center text-slate-300 italic">Движений не найдено</td></tr>
                            ) : filtered.map(m => {
                                const acc = bankAccounts.find(a => a.id === m.bankAccountId);
                                const cfItem = cashFlowItems.find(c => c.id === m.cashFlowItemId);
                                const isReversal = m.type === 'Reversal';
                                const isIn = m.direction === 'In';

                                return (
                                    <tr key={m.id} className={`hover:bg-gray-50/50 transition-colors ${isReversal ? 'opacity-60' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold text-slate-600">{formatDateDMY(m.date)}</div>
                                            <div className="text-[10px] font-mono text-slate-400">{m.id.slice(-8)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {isIn
                                                ? <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"><ArrowDownLeft size={9}/> IN</span>
                                                : <span className="flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100"><ArrowUpRight size={9}/> OUT</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold">{m.counterpartyName || '—'}</div>
                                            {m.note && <div className="text-[10px] text-slate-400 italic truncate max-w-[200px]">{m.note}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-bold text-slate-600">{acc?.name || '—'}</div>
                                            <div className="text-[10px] text-slate-400">{acc?.bank}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {cfItem
                                                ? <span className="text-[9px] font-black px-2 py-0.5 rounded border text-blue-600 bg-blue-50 border-blue-100">{cfItem.name}</span>
                                                : <span className="text-[10px] text-slate-300 italic">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-black">
                                            <span className={isIn ? 'text-emerald-600' : 'text-red-500'}>
                                                {isIn ? '+' : '−'}{f(Number(m.amount))} {m.currency}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                                            {m.currency !== Currency.Kzt
                                                ? <>{isIn ? '+' : '−'}{f(Number(m.amountKzt))} ₸</>
                                                : <span className="text-slate-300">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {isReversal
                                                ? <span className="flex items-center justify-center gap-1 text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit mx-auto"><RotateCcw size={9}/> Сторно</span>
                                                : <span className="text-[9px] font-black text-slate-400">Платёж</span>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
