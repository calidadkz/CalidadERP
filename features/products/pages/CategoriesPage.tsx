import React, { useState, useRef, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductCategory, ProductType } from '@/types';
import { List, Plus, Trash2, Box, Zap, Briefcase, X, Check, AlertCircle, ShieldAlert, Download, Upload, Loader2, CheckCircle, Search } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { ApiService } from '@/services/api';

export const CategoriesPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('categories');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const { categories } = state;
    const [activeType, setActiveType] = useState<ProductType>(ProductType.MACHINE);
    const [newName, setNewName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [importStatus, setImportStatus] = useState<{ show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string }>({ show: false, msg: '', type: 'loading' });
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const canCreate = access.canWrite('actions', 'create');
    const canDelete = access.canWrite('actions', 'delete');

    const handleAdd = () => {
        if(!canCreate || !newName.trim()) return;
        
        const normalizedName = newName.trim().toLowerCase();
        const isDuplicate = categories.some(c => 
            c.type === activeType && 
            c.name.toLowerCase() === normalizedName
        );

        if (isDuplicate) {
            alert(`Категория "${newName.trim()}" уже существует в разделе "${activeType}"`);
            return;
        }

        const newCat: ProductCategory = {
            id: ApiService.generateId('CAT'),
            name: newName.trim(),
            type: activeType
        };
        actions.addCategory(newCat);
        setNewName('');
    };

    const handleDelete = (id: string) => {
        if (!canDelete) return;
        actions.deleteCategory(id);
        setConfirmDeleteId(null);
    };

    const handleExportCSV = () => {
        const headers = ['Название', 'Тип'];
        const rows = categories.map(c => [
            `"${c.name.replace(/"/g, '""')}"`,
            c.type
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `categories_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        actions.addLog('Export', 'Система', 'Categories', `Экспорт категорий (${categories.length} поз.)`);
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
                    const typeStr = row['Тип'];

                    if (!name || !typeStr) { errors++; continue; }

                    const typeMatch = Object.values(ProductType).includes(typeStr as ProductType);
                    if (!typeMatch) { errors++; continue; }

                    const exists = categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === typeStr);
                    if (exists) { skipped++; continue; }

                    await actions.addCategory({
                        id: ApiService.generateId('CAT'),
                        name: name,
                        type: typeStr as ProductType
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

    const processedCategories = useMemo(() => {
        return categories
            .filter(c => c.type === activeType)
            .filter(c => !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [categories, activeType, searchTerm]);

    const getTypeStyles = (type: ProductType) => {
        switch(type) {
            case ProductType.MACHINE: return 'bg-blue-600 shadow-blue-200 text-white';
            case ProductType.PART: return 'bg-orange-500 shadow-orange-200 text-white';
            case ProductType.SERVICE: return 'bg-indigo-600 shadow-indigo-200 text-white';
            default: return 'bg-white text-slate-600';
        }
    };

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />

            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
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
                            <List className="mr-3 text-indigo-600" size={28} /> Категории
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Классификация товаров для фильтрации и подбора опций</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm mr-2">
                            <button onClick={handleExportCSV} className="p-2 text-slate-400 hover:text-blue-600 transition-all rounded-lg hover:bg-slate-50" title="Экспорт"><Download size={18}/></button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-orange-600 transition-all border-l border-slate-100 rounded-lg hover:bg-slate-50" title="Импорт"><Upload size={18}/></button>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-200">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                            onClick={() => { setActiveType(ProductType.MACHINE); setConfirmDeleteId(null); }} 
                            className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.MACHINE ? getTypeStyles(ProductType.MACHINE) : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Box size={14} className="mr-2"/> Станки
                        </button>
                        <button 
                            onClick={() => { setActiveType(ProductType.PART); setConfirmDeleteId(null); }} 
                            className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.PART ? getTypeStyles(ProductType.PART) : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Zap size={14} className="mr-2"/> Запчасти
                        </button>
                        <button 
                            onClick={() => { setActiveType(ProductType.SERVICE); setConfirmDeleteId(null); }} 
                            className={`flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeType === ProductType.SERVICE ? getTypeStyles(ProductType.SERVICE) : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Briefcase size={14} className="mr-2"/> Услуги
                        </button>
                    </div>

                    <div className="relative w-full md:w-64 mr-2">
                        <Search className="absolute left-3 top-2 text-slate-400" size={16}/>
                        <input 
                            type="text" 
                            placeholder="Поиск..." 
                            className="w-full pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/5 font-bold text-xs transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {canCreate ? (
                    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200 flex gap-4 items-center animate-in slide-in-from-top-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 whitespace-nowrap">Новая категория:</div>
                        <input 
                            className="flex-1 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300" 
                            placeholder={`Название для типа ${activeType}...`}
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
                        <span className="text-xs font-bold uppercase tracking-widest">У вас нет прав на создание новых категорий</span>
                    </div>
                )}

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Название категории</th>
                                <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Системный ID</th>
                                <th className="w-48 text-right px-8 py-5">
                                    <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{processedCategories.length} поз.</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {processedCategories.length === 0 ? (
                                <tr><td colSpan={3} className="p-20 text-center text-slate-300 italic font-medium">В этом разделе пока нет категорий или ничего не найдено</td></tr>
                            ) : (
                                processedCategories.map(c => {
                                    const isConfirming = confirmDeleteId === c.id;
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50/30 transition-all group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${activeType === ProductType.MACHINE ? 'bg-blue-500' : activeType === ProductType.PART ? 'bg-orange-500' : 'bg-indigo-500'}`}/>
                                                    <span className="font-black text-slate-800 text-sm tracking-tight">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right text-[10px] font-mono font-bold text-slate-300 group-hover:text-slate-400 transition-colors uppercase">{c.id}</td>
                                            <td className="px-8 py-5 text-right">
                                                {isConfirming ? (
                                                    <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-2">
                                                        <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter mr-2">Удалить?</span>
                                                        <button 
                                                            onClick={() => handleDelete(c.id)}
                                                            className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-md transition-all active:scale-90"
                                                            title="Подтвердить"
                                                        >
                                                            <Check size={16}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-90"
                                                            title="Отмена"
                                                        >
                                                            <X size={16}/>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    canDelete && (
                                                        <button 
                                                            onClick={() => setConfirmDeleteId(c.id)} 
                                                            className="text-slate-200 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Удалить в корзину"
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
                
                {categories.length > 0 && (
                    <div className="flex items-start p-6 bg-blue-50/50 rounded-[2rem] text-blue-700 border border-blue-100 animate-in fade-in slide-in-from-bottom-2">
                        <AlertCircle size={20} className="mr-4 flex-shrink-0 mt-0.5 text-blue-500"/>
                        <div className="space-y-1">
                            <p className="text-xs font-black uppercase tracking-widest mb-1">Политика удаления</p>
                            <p className="text-xs font-medium leading-relaxed opacity-80 text-slate-600">Категории не удаляются безвозвратно, а перемещаются в <b>Корзину</b>. Связанные товары не будут удалены, но могут потребовать переназначения категории. Для окончательного удаления используйте раздел Корзина.</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
