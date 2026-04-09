
import React, { useState, useMemo } from 'react';
import {
    AlertTriangle, Plus, Trash2, FileText, Settings2, Search, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { useStore } from '@/features/system/context/GlobalStore';
import { WriteOff, WriteOffReasonType } from '@/types/inventory';
import { WriteOffModal } from '../components/WriteOffModal';
import { ReasonTypesModal } from '../components/ReasonTypesModal';

const COLOR_BADGE: Record<string, string> = {
    red:    'bg-red-100 text-red-700 border-red-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    amber:  'bg-amber-100 text-amber-700 border-amber-200',
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    green:  'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    slate:  'bg-slate-100 text-slate-600 border-slate-200',
};

const f = (v: number) => Math.round(v).toLocaleString();
const fDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const WriteOffPage: React.FC = () => {
    const { state, actions } = useStore();
    const { writeoffs, writeoffReasonTypes, products } = state;

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReasonTypesModal, setShowReasonTypesModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const reasonTypesMap = useMemo(
        () => new Map<string, WriteOffReasonType>(writeoffReasonTypes.map(rt => [rt.id, rt])),
        [writeoffReasonTypes]
    );

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        let result = writeoffs.filter(wo =>
            !term ||
            wo.productName.toLowerCase().includes(term) ||
            wo.sku.toLowerCase().includes(term) ||
            wo.id.toLowerCase().includes(term)
        );
        result = [...result].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return sortDir === 'desc' ? db - da : da - db;
        });
        return result;
    }, [writeoffs, searchTerm, sortDir]);

    const totals = useMemo(() => ({
        count: filtered.length,
        qty: filtered.reduce((s, w) => s + w.quantity, 0),
        value: filtered.reduce((s, w) => s + w.quantity * w.unitCostKzt, 0),
    }), [filtered]);

    const handleDelete = async (wo: WriteOff) => {
        if (!confirm(`Отменить списание ${wo.quantity} шт. ${wo.productName}?\nВ Движения будет добавлено сторно.`)) return;
        await actions.deleteWriteOff(wo);
    };

    return (
        <div className="space-y-6">
            {/* Заголовок */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <AlertTriangle className="mr-3 text-red-500" size={28}/>
                        Списание и брак
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Прямые списания товара со склада — потери, поломки, инвентаризационные разницы
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowReasonTypesModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Settings2 size={14}/> Типы
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow transition-all"
                    >
                        <Plus size={14}/> Новое списание
                    </button>
                </div>
            </div>

            {/* KPI плашки */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Всего записей</div>
                    <div className="text-2xl font-black text-slate-800">{totals.count}</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Кол-во списано</div>
                    <div className="text-2xl font-black text-orange-600">{f(totals.qty)} шт.</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Сумма потерь</div>
                    <div className="text-2xl font-black text-red-600">{f(totals.value)} ₸</div>
                </div>
            </div>

            {/* Фильтры */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-[9px] text-slate-400"/>
                    <input
                        type="text"
                        className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="Поиск по товару / SKU..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all"
                >
                    Дата {sortDir === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>}
                </button>
            </div>

            {/* Таблица */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-left w-10"></th>
                            <th className="px-6 py-4 text-left">ID / Дата</th>
                            <th className="px-6 py-4 text-left">Товар</th>
                            <th className="px-4 py-4 text-right w-20">Кол-во</th>
                            <th className="px-4 py-4 text-right w-32 bg-red-50/30 text-red-400">Сумма потерь</th>
                            <th className="px-4 py-4 text-left">Тип / Причина</th>
                            <th className="px-4 py-4 text-center w-16">Файлы</th>
                            <th className="px-4 py-4 text-center w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-16 text-center text-slate-400 text-sm font-medium">
                                    Нет записей о списаниях
                                </td>
                            </tr>
                        )}
                        {filtered.map(wo => {
                            const rt = wo.reasonTypeId ? reasonTypesMap.get(wo.reasonTypeId) : undefined;
                            const isExpanded = expandedId === wo.id;
                            const hasDocs = wo.documents && wo.documents.length > 0;

                            return (
                                <React.Fragment key={wo.id}>
                                    <tr
                                        className={`hover:bg-slate-50/40 transition-colors ${hasDocs || wo.reasonNote ? 'cursor-pointer' : ''}`}
                                        onClick={() => (hasDocs || wo.reasonNote) && setExpandedId(isExpanded ? null : wo.id)}
                                    >
                                        <td className="px-6 py-3 text-center text-slate-300">
                                            {(hasDocs || wo.reasonNote) && (
                                                isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="font-mono text-[11px] font-bold text-red-500">{wo.id}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{fDate(wo.date)}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="text-xs font-bold text-slate-700">{wo.productName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{wo.sku}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-black text-sm text-orange-600">
                                            −{f(wo.quantity)}
                                        </td>
                                        <td className="px-4 py-3 text-right bg-red-50/10">
                                            <span className="font-mono text-[11px] font-black text-red-600">
                                                {wo.unitCostKzt > 0 ? f(wo.quantity * wo.unitCostKzt) : '—'}
                                            </span>
                                            {wo.unitCostKzt > 0 && (
                                                <div className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">KZT</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {rt && (
                                                <span className={`inline-block px-2 py-0.5 rounded-lg border text-[10px] font-bold ${COLOR_BADGE[rt.color] || COLOR_BADGE.slate}`}>
                                                    {rt.name}
                                                </span>
                                            )}
                                            {!rt && wo.reasonNote && (
                                                <span className="text-[10px] text-slate-500 italic line-clamp-1">{wo.reasonNote}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {hasDocs && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                                                    <FileText size={12}/> {wo.documents.length}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleDelete(wo)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Отменить списание (сторно)"
                                            >
                                                <Trash2 size={13}/>
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-slate-50/40 border-b">
                                            <td></td>
                                            <td colSpan={7} className="px-6 py-3 space-y-2">
                                                {wo.reasonNote && (
                                                    <div>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Причина: </span>
                                                        <span className="text-xs text-slate-600 font-medium">{wo.reasonNote}</span>
                                                    </div>
                                                )}
                                                {hasDocs && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {wo.documents.map((doc, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={doc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                                            >
                                                                <Download size={11}/>
                                                                {doc.name || `Файл ${idx + 1}`}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showCreateModal && (
                <WriteOffModal
                    products={products}
                    reasonTypes={writeoffReasonTypes}
                    onSubmit={actions.createWriteOff}
                    onClose={() => setShowCreateModal(false)}
                />
            )}

            {showReasonTypesModal && (
                <ReasonTypesModal
                    reasonTypes={writeoffReasonTypes}
                    onAdd={actions.addWriteoffReasonType}
                    onUpdate={actions.updateWriteoffReasonType}
                    onDelete={actions.deleteWriteoffReasonType}
                    onClose={() => setShowReasonTypesModal(false)}
                />
            )}
        </div>
    );
};
