
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { useAuth } from '@/features/system/context/AuthContext';
import { AppRole, RolePermissions, AccessLevel } from '@/types';
import { Shield, Save, EyeOff, BookOpen, Edit3, ChevronRight, Layout, Database, MousePointer2 as MousePointer, CheckSquare, Square, Lock, Loader2, CheckCircle, AlertCircle, RefreshCw, Download, Upload, X as XIcon } from 'lucide-react';
import { ApiService } from '@/services/api';
import { SystemRegistry } from '@/services/SystemRegistry';

export const PermissionsManager: React.FC = () => {
    const { actions } = useStore();
    const { refreshProfile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [selectedRole, setSelectedRole] = useState<AppRole>(AppRole.MANAGER);
    const [permissions, setPermissions] = useState<RolePermissions>({});
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
    const [selectedModuleId, setSelectedModuleId] = useState<string>(Object.keys(SystemRegistry)[0]);
    
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Маппинг ролей для UI
    const roleLabels: Record<AppRole, string> = {
        [AppRole.ADMIN]: 'Админ',
        [AppRole.MANAGER]: 'Менеджер',
        [AppRole.ROP]: 'РОП',
        [AppRole.ACCOUNTANT]: 'Бухгалтер',
        [AppRole.PROCUREMENT]: 'Снабженец',
        [AppRole.TECHNICIAN]: 'Техник',
        [AppRole.LOGISTICS]: 'Логист',
        [AppRole.WAREHOUSE]: 'Складской работник',
        [AppRole.GUEST]: 'Гость'
    };

    // Состояние импорта
    const [importStatus, setImportStatus] = useState<{ 
        show: boolean, 
        msg: string, 
        progress: number, 
        total: number,
        success: number,
        partial: number,
        errors: number,
        type: 'loading' | 'success' | 'error'
    }>({ show: false, msg: '', progress: 0, total: 0, success: 0, partial: 0, errors: 0, type: 'loading' });

    const loadPermissions = async () => {
        setIsLoading(true);
        setStatus(null);
        setIsDirty(false);
        try {
            const allPerms = await ApiService.fetchAll<any>('role_permissions');
            const roleMatch = allPerms.find(p => p.role === selectedRole);
            setPermissions(roleMatch?.matrix || {});
            setCurrentRecordId(roleMatch?.id || null);
        } catch (e) {
            console.error("Failed to load permissions", e);
            setStatus({ type: 'error', msg: 'Ошибка загрузки данных из БД' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadPermissions(); }, [selectedRole]);

    const setAccessLevel = (module: string, type: 'tabs' | 'fields' | 'actions', key: string, level: AccessLevel) => {
        const newPerms = { ...permissions };
        if (!newPerms[module]) newPerms[module] = {};
        if (!newPerms[module][type]) newPerms[module][type] = {};
        
        newPerms[module][type]![key] = level;
        setPermissions(newPerms);
        setIsDirty(true);
        if (status) setStatus(null);
    };

    const toggleModuleAccess = (moduleId: string) => {
        const current = permissions[moduleId]?.tabs?.main;
        const isEnabled = current === 'read' || current === 'write';
        const newLevel: AccessLevel = isEnabled ? 'none' : 'read';
        setAccessLevel(moduleId, 'tabs', 'main', newLevel);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatus(null);
        try {
            const payload: any = {
                role: selectedRole,
                matrix: permissions,
                updatedAt: new Date().toISOString()
            };

            if (currentRecordId) {
                payload.id = currentRecordId;
            }

            const result = await ApiService.upsert<any>('role_permissions', payload, 'role');
            if (result && result.id) {
                setCurrentRecordId(result.id);
            }

            await actions.addLog('Update', 'Система', selectedRole, `Обновлены права доступа`);
            await refreshProfile();

            setIsDirty(false);
            setStatus({ type: 'success', msg: 'Права успешно сохранены' });
            setTimeout(() => setStatus(null), 3000);
        } catch (e: any) {
            console.error("Save error:", e);
            setStatus({ type: 'error', msg: `Ошибка записи: ${e.message || 'Связь прервана'}` });
        } finally {
            setIsSaving(false);
        }
    };

    // --- ЭКСПОРТ CSV ---
    const handleExportCSV = async () => {
        try {
            const allPerms = await ApiService.fetchAll<any>('role_permissions');
            const headers = ['Роль', 'Модуль', 'Тип объекта', 'Элемент', 'Доступ'];
            const rows: string[][] = [];

            const accessMap: Record<AccessLevel, string> = {
                'none': 'Скрыто',
                'read': 'Просмотр',
                'write': 'Правка'
            };

            allPerms.forEach(roleRecord => {
                const role = roleRecord.role;
                const matrix = roleRecord.matrix as RolePermissions;

                Object.entries(SystemRegistry).forEach(([modId, mod]) => {
                    Object.entries(mod.tabs || {}).forEach(([tabId, tab]) => {
                        const level = matrix[modId]?.tabs?.[tabId] || 'none';
                        rows.push([role, mod.label, 'Раздел', tab.label, accessMap[level]]);
                    });
                    Object.entries(mod.fields || {}).forEach(([fieldId, field]) => {
                        const level = matrix[modId]?.fields?.[fieldId] || 'none';
                        rows.push([role, mod.label, 'Данные', field.label, accessMap[level]]);
                    });
                    Object.entries(mod.actions || {}).forEach(([actId, action]) => {
                        const level = matrix[modId]?.actions?.[actId] || 'none';
                        rows.push([role, mod.label, 'Действие', action.label, accessMap[level]]);
                    });
                });
            });

            const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `permissions_export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } catch (e) {
            console.error("Export failed", e);
        }
    };

    // --- ИМПОРТ CSV ---
    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 2) return;

            const total = lines.length - 1;
            setImportStatus({ show: true, msg: 'Загрузка прав...', progress: 0, total, success: 0, partial: 0, errors: 0, type: 'loading' });

            const accessReverseMap: Record<string, AccessLevel> = {
                'скрыто': 'none', 'просмотр': 'read', 'правка': 'write'
            };

            const typeMap: Record<string, string> = {
                'раздел': 'tabs', 'данные': 'fields', 'действие': 'actions'
            };

            const rolesUpdate: Record<string, RolePermissions> = {};

            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
                if (vals.length < 5) {
                    setImportStatus(prev => ({ ...prev, progress: i, errors: prev.errors + 1 }));
                    continue;
                }

                const [roleName, modLabel, typeLabel, elemLabel, accessLabel] = vals;
                const role = roleName.toLowerCase() as AppRole;
                const level = accessReverseMap[accessLabel.toLowerCase()] || 'none';
                const typeKey = typeMap[typeLabel.toLowerCase()];

                if (!rolesUpdate[role]) rolesUpdate[role] = {};

                const modEntry = Object.entries(SystemRegistry).find(([_, mod]) => mod.label === modLabel);
                if (!modEntry || !typeKey) {
                    setImportStatus(prev => ({ ...prev, progress: i, errors: prev.errors + 1 }));
                    continue;
                }

                const modId = modEntry[0];
                const modData = modEntry[1];
                if (!rolesUpdate[role][modId]) rolesUpdate[role][modId] = {};
                if (!rolesUpdate[role][modId][typeKey as 'tabs' | 'fields' | 'actions']) {
                    rolesUpdate[role][modId][typeKey as 'tabs' | 'fields' | 'actions'] = {};
                }

                let elementKey: string | undefined;
                const registrySection = (modData as any)[typeKey];
                if (registrySection) {
                    const match = Object.entries(registrySection).find(([_, data]: any) => data.label === elemLabel);
                    if (match) elementKey = match[0];
                }

                if (elementKey) {
                    (rolesUpdate[role][modId] as any)[typeKey][elementKey] = level;
                    setImportStatus(prev => ({ ...prev, progress: i, success: prev.success + 1 }));
                } else {
                    setImportStatus(prev => ({ ...prev, progress: i, partial: prev.partial + 1 }));
                }
            }

            try {
                for (const [role, matrix] of Object.entries(rolesUpdate)) {
                    await ApiService.upsert('role_permissions', {
                        role: role,
                        matrix: matrix,
                        updatedAt: new Date().toISOString()
                    }, 'role');
                }
                setImportStatus(prev => ({ ...prev, type: 'success', msg: 'Импорт завершен' }));
                loadPermissions();
            } catch (err) {
                setImportStatus(prev => ({ ...prev, type: 'error', msg: 'Ошибка при записи в БД' }));
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const handleRoleChange = (role: AppRole) => {
        if (isDirty) {
            setStatus({ type: 'error', msg: 'У вас есть несохраненные изменения!' });
            return;
        }
        setSelectedRole(role);
    };

    const selectedModule = SystemRegistry[selectedModuleId];
    const isModuleEnabled = permissions[selectedModuleId]?.tabs?.main === 'read' || 
                            permissions[selectedModuleId]?.tabs?.main === 'write';

    const renderAccessToggle = (module: string, type: 'tabs' | 'fields' | 'actions', key: string) => {
        const current = permissions[module]?.[type]?.[key] || 'none';
        
        return (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner w-fit">
                <button 
                    onClick={() => setAccessLevel(module, type, key, 'none')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${current === 'none' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <EyeOff size={12}/> Скрыто
                </button>
                <button 
                    onClick={() => setAccessLevel(module, type, key, 'read')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${current === 'read' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <BookOpen size={12}/> Чтение
                </button>
                <button 
                    onClick={() => setAccessLevel(module, type, key, 'write')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${current === 'write' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Edit3 size={12}/> Запись
                </button>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col gap-6 max-w-6xl mx-auto relative">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportCSV} />

            {importStatus.show && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in-95 border border-slate-100">
                        {importStatus.type === 'loading' ? <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" /> : <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />}
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{importStatus.msg}</h3>
                        {importStatus.type !== 'loading' && (
                            <button onClick={() => setImportStatus({ ...importStatus, show: false })} className="w-full mt-8 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95">Понятно</button>
                        )}
                    </div>
                </div>
            )}

            {status && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
                    <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border pointer-events-auto ${status.type === 'success' ? 'bg-white border-emerald-100 text-emerald-600' : 'bg-white border-red-100 text-red-600'}`}>
                        {status.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                        <span className="font-black uppercase text-[10px] tracking-widest">{status.msg}</span>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center flex-none">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Shield className="mr-3 text-indigo-600" size={28} /> Права доступа
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Гранулярная настройка ролей: {roleLabels[selectedRole]}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm mr-2">
                        <button onClick={handleExportCSV} title="Экспорт матрицы" className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all"><Download size={20}/></button>
                        <button onClick={() => fileInputRef.current?.click()} title="Импорт матрицы" className="p-2 text-slate-400 hover:text-orange-600 border-l border-slate-100 rounded-xl hover:bg-slate-50 transition-all"><Upload size={20}/></button>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto max-w-[500px] custom-scrollbar">
                        {Object.values(AppRole).map(role => (
                            <button 
                                key={role}
                                onClick={() => handleRoleChange(role)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all whitespace-nowrap ${selectedRole === role ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {roleLabels[role]}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || isLoading || !isDirty}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl flex items-center gap-3 uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-30 flex-none"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                        {isSaving ? 'Запись...' : 'Сохранить'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                <div className="w-80 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Разделы системы</span>
                        <button onClick={loadPermissions} className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors">
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-40 opacity-20"><Loader2 size={32} className="animate-spin mb-2"/><span className="text-[10px] font-bold uppercase">Загрузка...</span></div>
                        ) : Object.entries(SystemRegistry).map(([id, module]) => {
                            const currentAccess = permissions[id]?.tabs?.main;
                            const isEnabled = currentAccess === 'read' || currentAccess === 'write';
                            return (
                                <div key={id} className="flex items-center gap-2">
                                    <button onClick={() => toggleModuleAccess(id)} className={`flex-none p-2 rounded-xl transition-all ${isEnabled ? 'text-blue-600 bg-blue-50 border border-blue-100' : 'text-slate-300 bg-slate-50 border border-transparent'}`} disabled={isSaving}>
                                        {isEnabled ? <CheckSquare size={20}/> : <Square size={20}/>}
                                    </button>
                                    <button onClick={() => setSelectedModuleId(id)} className={`flex-1 flex items-center justify-between p-3 rounded-2xl transition-all ${selectedModuleId === id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-700 hover:bg-slate-50 font-bold'}`}>
                                        <div className="flex items-center gap-3">
                                            {module.icon && <module.icon size={16} className={selectedModuleId === id ? 'text-white' : isEnabled ? 'text-blue-500' : 'text-slate-300'} />}
                                            <span className={`text-[11px] font-black uppercase tracking-tight ${selectedModuleId === id ? 'text-white' : isEnabled ? 'text-slate-700' : 'text-slate-400'}`}>{module.label}</span>
                                        </div>
                                        <ChevronRight size={16} className={selectedModuleId === id ? 'text-white/50' : 'text-slate-200'}/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    {selectedModule ? (
                        <div className="flex flex-col h-full overflow-hidden relative">
                            {!isModuleEnabled && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-12">
                                    <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl mb-6 scale-110"><Lock size={48} className="text-blue-400"/></div>
                                    <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Раздел выключен</h4>
                                </div>
                            )}
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{selectedModule.label}</h3>
                            </div>
                            <div className={`flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-white ${!isModuleEnabled ? 'grayscale pointer-events-none opacity-50' : ''}`}>
                                {selectedModule.tabs && Object.keys(selectedModule.tabs).length > 0 && (
                                    <section>
                                        <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Layout size={14}/> Вкладки и Режимы</h4>
                                        <div className="space-y-3">
                                            {Object.entries(selectedModule.tabs).map(([id, tab]) => (
                                                <div key={id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                    <span className="text-sm font-bold text-slate-700">{tab.label}</span>
                                                    {renderAccessToggle(selectedModuleId, 'tabs', id)}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {selectedModule.fields && Object.keys(selectedModule.fields).length > 0 && (
                                    <section>
                                        <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Database size={14}/> Поля и Данные</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            {Object.entries(selectedModule.fields).map(([id, field]) => (
                                                <div key={id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{field.label}</span>
                                                        {field.group && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{field.group}</span>}
                                                    </div>
                                                    {renderAccessToggle(selectedModuleId, 'fields', id)}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {selectedModule.actions && Object.keys(selectedModule.actions).length > 0 && (
                                    <section>
                                        <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><MousePointer size={14}/> Действия (Кнопки)</h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            {Object.entries(selectedModule.actions).map(([id, action]) => (
                                                <div key={id} className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800 transition-all shadow-lg">
                                                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{action.label}</span>
                                                    {renderAccessToggle(selectedModuleId, 'actions', id)}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-30"><Shield size={64} className="mb-4"/><p className="font-black uppercase tracking-widest text-xs">Выберите раздел слева</p></div>
                    )}
                </div>
            </div>
        </div>
    );
};
