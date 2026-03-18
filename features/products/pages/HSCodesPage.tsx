
import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { HSCode } from '@/types';
import { 
    Hash, Plus, Search, Download, Upload, Loader2, 
    Trash2, Pencil, X, Save, FileText, Percent,
    CheckCircle, AlertCircle
} from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { ApiService } from '@/services/api';

export const HSCodesPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('hscodes');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const { hscodes } = state;
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const initialFormState: Partial<HSCode> = { 
        code: '', 
        name: '', 
        description: '', 
        explanation: '', // Новое поле
        dutyPercentage: 0, 
        dutyWtoPercentage: 0, 
        permits: '' 
    };
    const [formData, setFormData] = useState<Partial<HSCode>>(initialFormState);
    
    const [confirmDelete, setConfirmDelete] = useState<{ show: boolean, id: string, name: string }>({ 
        show: false, id: '', name: '' 
    });

    const [importStatus, setImportStatus] = useState<{ 
        show: boolean, msg: string, type: 'loading' | 'success' | 'error', details?: string 
    }>({ show: false, msg: '', type: 'loading' });

    const canCreate = access.canWrite('actions', 'create');
    const canEdit = access.canWrite('actions', 'edit');
    const canDelete = access.canWrite('actions', 'delete');
    const canImportExport = access.canWrite('actions', 'import_export');

    const handleOpenModal = (item?: HSCode) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                ...initialFormState,
                ...item
            });
        } else {
            setEditingId(null);
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.code || !formData.name) return;
        
        try {
            const payload = {
                ...formData,
                dutyPercentage: Number(formData.dutyPercentage) || 0,
                dutyWtoPercentage: Number(formData.dutyWtoPercentage) || 0
            };

            // Проверка на уникальность сочетания Код + Наименование
            // Исключаем текущую редактируемую запись из проверки
            const isDuplicate = hscodes.some(h => 
                h.code === formData.code && 
                h.name.toLowerCase().trim() === formData.name?.toLowerCase().trim() &&
                h.id !== editingId
            );

            if (isDuplicate) {
                alert(`Запись с кодом "${formData.code}" и наименованием "${formData.name}" уже существует.`);
                return;
            }

            if (editingId) {
                await actions.updateHSCode({ ...payload, id: editingId } as HSCode);
            } else {
                await actions.addHSCode({ ...payload, id: ApiService.generateId() } as HSCode);
            }
            setIsModalOpen(false);
        } catch (e: any) {
            alert(`Ошибка сохранения: ${e.message}`);
        }
    };

    const handleDeleteRequest = (item: HSCode) => {
        if (!canDelete) return;
        setConfirmDelete({ show: true, id: item.id, name: `${item.code} (${item.name})` });
    };

    const executeDelete = async () => {
        if (confirmDelete.id) {
            await actions.deleteHSCode(confirmDelete.id);
            setConfirmDelete({ show: false, id: '', name: '' });
        }
    };

    const handleExportCSV = () => {
        const headers = ['Код ТНВЭД', 'Наименование', 'Пошлина (%)', 'Пошлина ВТО (%)', 'Описание', 'Пояснение', 'Разрешительные документы'];
        const rows = hscodes.map(h => [
            `"${h.code}"`,
            `"${h.name.replace(/"/g, '""')}"`,
            (h.dutyPercentage || 0).toString(),
            (h.dutyWtoPercentage || 0).toString(),
            `"${(h.description || '').replace(/"/g, '""')}"`,
            `"${(h.explanation || '').replace(/"/g, '""')}"`,
            `"${(h.permits || '').replace(/"/g, '""')}"`
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `hscodes_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        actions.addLog('Export', 'ТНВЭД', 'All', `Экспорт справочника ТНВЭД`);
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
                if (lines.length < 2) throw new Error("Файл пуст или некорректен");

                const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
                let added = 0; let updated = 0; let errors = 0;

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row: any = {}; 
                    headers.forEach((h, idx) => row[h] = values[idx]);

                    const code = row['Код ТНВЭД'];
                    const name = row['Наименование'];
                    
                    if (!code || !name) { errors++; continue; }

                    const duty = parseFloat(row['Пошлина (%)']?.replace(',', '.') || '0');
                    const dutyWTO = parseFloat(row['Пошлина ВТО (%)']?.replace(',', '.') || '0');
                    const desc = row['Описание'] || row['Пояснение'] || ''; // Fallback for old templates
                    const explanation = row['Пояснение'] || '';
                    const permits = row['Разрешительные документы'] || '';

                    // Ищем по уникальной связке Code + Name
                    const existing = hscodes.find(h => 
                        h.code === code && 
                        h.name.toLowerCase().trim() === name.toLowerCase().trim()
                    );

                    const payload = {
                        code, name, 
                        description: desc,
                        explanation: explanation,
                        dutyPercentage: isNaN(duty) ? 0 : duty,
                        dutyWtoPercentage: isNaN(dutyWTO) ? 0 : dutyWTO,
                        permits
                    };

                    if (existing) {
                        await actions.updateHSCode({ ...existing, ...payload });
                        updated++;
                    } else {
                        await actions.addHSCode({
                            id: ApiService.generateId(),
                            ...payload
                        });
                        added++;
                    }
                }

                setImportStatus({ 
                    show: true, type: 'success', msg: 'Импорт завершен',
                    details: `Добавлено: ${added}\nОбновлено: ${updated}\nОшибок: ${errors}`
                });
            } catch (err: any) {
                setImportStatus({ show: true, msg: `Ошибка: ${err.message}`, type: 'error' });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const filteredCodes = useMemo(() => {
        return hscodes
            .filter(h => 
                !searchTerm || 
                h.code.includes(searchTerm) || 
                h.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [hscodes, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Hash className="mr-3 text-indigo-600" size={28} /> Коды ТНВЭД
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Справочник товарной номенклатуры, пошлин и разрешительных документов</p>
                </div>
                <div className="flex items-center gap-3">
                    {canImportExport && (
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button onClick={handleExportCSV} className="p-2 text-slate-400 hover:text-blue-600 transition-all rounded-lg hover:bg-slate-50" title="Экспорт"><Download size={18}/></button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-orange-600 transition-all border-l border-slate-100 rounded-lg hover:bg-slate-50" title="Импорт"><Upload size={18}/></button>
                        </div>
                    )}
                    {canCreate && (
                        <button 
                            onClick={() => handleOpenModal()} 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center shadow-lg font-bold transition-all active:scale-95"
                        >
                            <Plus size={20} className="mr-2"/> Добавить код
                        </button>
                    )}
                </div>
            </div>

            <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-3 text-slate-400" size={18}/>
                <input 
                    type="text" 
                    placeholder="Поиск по коду или наименованию..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm shadow-sm transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* TABLE CONTAINER */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex flex-col">
                <div className="overflow-x-auto rounded-[2rem]">
                    <table className="w-full divide-y divide-slate-100 table-fixed">
                        <thead className="bg-slate-50/50">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left w-28">Код ТНВЭД</th>
                                <th className="px-4 py-4 text-left w-[20%]">Наименование</th>
                                <th className="px-4 py-4 text-left w-24">Пошлины</th>
                                <th className="px-4 py-4 text-left w-[15%]">Пояснение</th>
                                <th className="px-4 py-4 text-left w-40">Документы</th>
                                <th className="px-4 py-4 text-left w-auto">Описание</th>
                                {/* Sticky Action Header */}
                                <th className="px-4 py-4 text-right w-16 sticky right-0 bg-slate-50 z-10 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.05)]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {filteredCodes.length === 0 ? (
                                <tr><td colSpan={7} className="p-20 text-center text-slate-300 italic font-medium">Коды не найдены</td></tr>
                            ) : filteredCodes.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-4 py-3 font-mono font-black text-xs text-blue-600 align-top break-all">{h.code}</td>
                                    <td className="px-4 py-3 font-black text-slate-800 text-xs align-top break-words leading-tight">{h.name}</td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-1">
                                            <span className="w-fit px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">{h.dutyPercentage}%</span>
                                            {h.dutyWtoPercentage !== undefined && h.dutyWtoPercentage > 0 && (
                                                <span className="w-fit px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded text-[10px] font-bold" title="ВТО">{h.dutyWtoPercentage}%</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="text-[10px] text-slate-400 italic line-clamp-4 break-words leading-tight">
                                            {h.explanation || '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        {h.permits ? (
                                            <div className="flex items-start gap-1.5">
                                                <FileText size={12} className="text-orange-500 mt-0.5 flex-shrink-0"/>
                                                <span className="text-[10px] text-slate-600 font-medium leading-tight line-clamp-4 break-words">{h.permits}</span>
                                            </div>
                                        ) : <span className="text-[9px] text-slate-300 uppercase font-bold">Нет</span>}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="text-[10px] text-slate-600 font-medium line-clamp-4 break-words leading-tight">
                                            {h.description || '—'}
                                        </div>
                                    </td>
                                    {/* Sticky Action Cell */}
                                    <td className="px-4 py-3 text-right align-top w-16 whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 z-10 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.05)] transition-colors">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canEdit && <button onClick={() => handleOpenModal(h)} className="p-1.5 text-slate-300 hover:text-blue-600 transition-all"><Pencil size={16}/></button>}
                                            {canDelete && <button onClick={() => handleDeleteRequest(h)} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: CREATE / EDIT */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                                    {editingId ? <Pencil size={24}/> : <Plus size={24}/>}
                                </div>
                                <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">
                                    {editingId ? 'Редактирование' : 'Новый код ТНВЭД'}
                                </h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-600 p-2"><X size={28}/></button>
                        </div>
                        
                        <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Код ТНВЭД <span className="text-red-500">*</span></label>
                                    <input 
                                        className="w-full border border-slate-200 rounded-2xl p-3.5 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-mono font-black text-blue-600 bg-slate-50/50 focus:bg-white text-lg" 
                                        placeholder="0000000000" 
                                        value={formData.code} 
                                        onChange={e => setFormData({...formData, code: e.target.value.replace(/[^0-9]/g, '')})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Наименование <span className="text-red-500">*</span></label>
                                    <input 
                                        className="w-full border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-slate-700 bg-slate-50/50 focus:bg-white" 
                                        placeholder="Краткое название..." 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1"><Percent size={12}/> Пошлина (Основная)</label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="w-full border border-slate-200 rounded-2xl p-3 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-black text-slate-800 bg-white" 
                                        placeholder="0" 
                                        value={formData.dutyPercentage} 
                                        onChange={e => setFormData({...formData, dutyPercentage: parseFloat(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1"><Percent size={12}/> Пошлина (ВТО)</label>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="w-full border border-slate-200 rounded-2xl p-3 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-black text-purple-700 bg-white" 
                                        placeholder="0" 
                                        value={formData.dutyWtoPercentage} 
                                        onChange={e => setFormData({...formData, dutyWtoPercentage: parseFloat(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1"><FileText size={12}/> Разрешительные документы</label>
                                <input 
                                    className="w-full border border-orange-100 rounded-2xl p-4 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all text-sm font-medium text-slate-700 bg-orange-50/30 focus:bg-white" 
                                    placeholder="Сертификат соответствия, Декларация..." 
                                    value={formData.permits} 
                                    onChange={e => setFormData({...formData, permits: e.target.value})}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Описание (основное)</label>
                                    <textarea 
                                        className="w-full border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium text-slate-700 bg-slate-50/50 focus:bg-white resize-none h-24" 
                                        placeholder="Полное описание для декларации..." 
                                        value={formData.description} 
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Пояснение (примечание)</label>
                                    <textarea 
                                        className="w-full border border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium text-slate-600 bg-slate-50/50 focus:bg-white resize-none h-24 italic" 
                                        placeholder="Дополнительные заметки..." 
                                        value={formData.explanation} 
                                        onChange={e => setFormData({...formData, explanation: e.target.value})}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleSave} 
                                disabled={!formData.code || !formData.name}
                                className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Save size={20}/> {editingId ? 'Сохранить изменения' : 'Создать запись'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: CUSTOM CONFIRM DELETE */}
            {confirmDelete.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 animate-in zoom-in-95">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">Удалить код?</h3>
                            <p className="text-slate-500 font-medium mb-8 leading-relaxed">Вы уверены, что хотите переместить <b>{confirmDelete.name}</b> в корзину?</p>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={executeDelete}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-200 transition-all active:scale-95"
                                >
                                    Да, удалить
                                </button>
                                <button 
                                    onClick={() => setConfirmDelete({ show: false, id: '', name: '' })}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all"
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT STATUS OVERLAY */}
            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 duration-200">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" /> : importStatus.type === 'success' ? <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" /> : <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />}
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                        {importStatus.details && <div className="text-left bg-slate-50 p-4 rounded-xl mb-6 font-mono text-xs whitespace-pre-wrap text-slate-600 border">{importStatus.details}</div>}
                        {importStatus.type !== 'loading' && <button onClick={() => setImportStatus({ ...importStatus, show: false })} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold uppercase tracking-widest">ОК</button>}
                    </div>
                </div>
            )}
        </div>
    );
};
