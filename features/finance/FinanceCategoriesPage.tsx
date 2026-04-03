
import React, { useState, useRef } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { CashFlowItem, CashFlowCategory } from '@/types';
import { Plus, Trash2, Tag, ArrowDownCircle, ArrowUpCircle, X, Check, ShieldAlert, Download, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAccess } from '../auth/hooks/useAccess';
import { ApiService } from '@/services/api';

export const FinanceCategoriesPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('finance_categories');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const { cashFlowItems } = state;
    // activeType используется только для UI-переключателя, фильтрация идёт по реальным значениям 'Income'/'Expense'
    const [activeType, setActiveType] = useState<'Expense' | 'Income'>('Expense');
    const [newName, setNewName] = useState('');
    
    const [importStatus, setImportStatus] = useState<{ show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string }>({ show: false, msg: '', type: 'loading' });
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const canCreate = access.canWrite('actions', 'create');
    const canDelete = access.canWrite('actions', 'delete');

    const handleAdd = () => {
        if(!canCreate || !newName.trim()) return;
        const newItem: CashFlowItem = {
            id: ApiService.generateUUID(),
            name: newName.trim(),
            type: activeType as 'Income' | 'Expense',
            category: CashFlowCategory.OPERATING
        };
        actions.addCashFlowItem(newItem);
        setNewName('');
    };

    const handleDelete = (id: string) => {
        if (!canDelete) return;
        actions.deleteCashFlowItem(id);
        setConfirmDeleteId(null);
    };

    const handleExportCSV = () => {
        const headers = ['Название', 'Направление'];
        const rows = cashFlowItems.map(c => [
            `"${c.name.replace(/"/g, '""')}"`,
            c.type === 'Incoming' ? 'Доход' : 'Расход'
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cash_flow_items_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        actions.addLog('Export', 'Система', 'FinanceCategories', `Экспорт статей ДДС (${cashFlowItems.length} поз.)`);
    };

    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportStatus({ show: true, msg: 'Анализ файла...', type: 'loading' });
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length < 2) throw new Error("Файл пуст или содержит только заголовки");

                const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
                let added = 0; let skipped = 0; let errors = 0;

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row: any = {}; 
                    headers.forEach((h, idx) => row[h] = values[idx]);

                    const name = row['Название'];
                    const dirStr = row['Направление'];

                    if (!name || !dirStr) { errors++; continue; }

                    const type: 'Incoming' | 'Outgoing' | null = dirStr.toLowerCase() === 'доход' ? 'Incoming' : dirStr.toLowerCase() === 'расход' ? 'Outgoing' : null;
                    if (!type) { errors++; continue; }

                    const exists = cashFlowItems.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === type);
                    if (exists) { skipped++; continue; }

                    await actions.addCashFlowItem({
                        id: ApiService.generateUUID(),
                        name: name,
                        type: type as 'Income' | 'Expense',
                        category: CashFlowCategory.OPERATING
                    });
                    added++;
                }

                setImportStatus({ 
                    show: true, type: 'success', msg: 'Импорт завершен',
                    details: `Добавлено: ${added}\nПропущено (дубликаты): ${skipped}\nОшибок: ${errors}`
                });
            } catch (err: any) {
                setImportStatus({ show: true, msg: `Ошибка: ${err.message}`, type: 'error' });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const filteredItems = cashFlowItems.filter(c => c.type === activeType);
    // activeType: 'Expense' | 'Income' — совпадает с реальным CashFlowItem.type

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />

            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" /> : importStatus.type === 'success' ? <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" /> : <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />}
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                        {importStatus.details && (
                            <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-600 border border-slate-100">
                                {importStatus.details}
                            </div>
                        )}
                        {importStatus.type !== 'loading' && <button onClick={() => setImportStatus({ ...importStatus, show: false })} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors">Понятно</button>}
                    </div>
                </div>
            )}

            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                            <Tag className="mr-3 text-indigo-600" size={28} /> Статьи ДДС
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Классификация доходов и расходов для детальной финансовой аналитики</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm mr-2">
                            <button onClick={handleExportCSV} className="p-2 text-slate-400 hover:text-blue-600 transition-all rounded-lg hover:bg-slate-50" title="Экспорт"><Download size={18}/></button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-orange-600 transition-all border-l border-slate-100 rounded-lg hover:bg-slate-50" title="Импорт"><Upload size={18}/></button>
                        </div>
                    </div>
                </div>
                
                <div className="flex bg-white p-1.5 rounded-[1.25rem] shadow-sm border border-slate-200 w-fit">
                    <button
                        onClick={() => { setActiveType('Expense'); setConfirmDeleteId(null); }}
                        className={`flex items-center px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeType === 'Expense' ? 'bg-red-600 text-white shadow-red-200 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ArrowDownCircle size={14} className="mr-2"/> Расходы
                    </button>
                    <button
                        onClick={() => { setActiveType('Income'); setConfirmDeleteId(null); }}
                        className={`flex items-center px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeType === 'Income' ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ArrowUpCircle size={14} className="mr-2"/> Доходы
                    </button>
                </div>

                {canCreate ? (
                    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200 flex gap-4 items-center animate-in slide-in-from-top-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 whitespace-nowrap">Новая статья:</div>
                        <input 
                            className="flex-1 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300" 
                            placeholder={`Название статьи ${activeType === 'Expense' ? 'расхода' : 'дохода'}...`}
                            value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                        <button 
                            onClick={handleAdd} 
                            disabled={!newName.trim()}
                            className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                        >
                            <Plus size={18} className="mr-2 inline-block"/> Добавить
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-100/50 p-4 rounded-2xl border border-dashed border-slate-200 flex items-center gap-3 text-slate-400">
                        <ShieldAlert size={18}/>
                        <span className="text-xs font-bold uppercase tracking-widest">У вас нет прав на создание новых статей</span>
                    </div>
                )}

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Название статьи</th>
                                <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Системный ID</th>
                                <th className="w-48"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.length === 0 ? (
                                <tr><td colSpan={3} className="p-20 text-center text-slate-300 italic font-medium">В этом разделе пока нет статей</td></tr>
                            ) : (
                                filteredItems.map(c => {
                                    const isConfirming = confirmDeleteId === c.id;
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50/30 transition-all group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${activeType === 'Outgoing' ? 'bg-red-500' : 'bg-emerald-500'}`}/>
                                                    <span className="font-black text-slate-800 text-sm tracking-tight">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right text-[10px] font-mono font-bold text-slate-300 group-hover:text-slate-400 transition-colors uppercase">{c.id.slice(0, 8)}</td>
                                            <td className="px-8 py-5 text-right">
                                                {isConfirming ? (
                                                    <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-2">
                                                        <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter mr-2">Удалить?</span>
                                                        <button 
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-md transition-all active:scale-90"
                                                        >
                                                            <Check size={16}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-90"
                                                        >
                                                            <X size={16}/>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    canDelete && (
                                                        <button 
                                                            onClick={() => setConfirmDeleteId(c.id)} 
                                                            className="text-slate-200 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={18}/>
                                                        </button>
                                                    )
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
        </>
    );
};
