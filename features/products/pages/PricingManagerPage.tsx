
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { PricingProfile, ProductCategory } from '@/types/product';
import { Currency } from '@/types/currency';
import { ProductType } from '@/types/enums';
import { Plus, Save, Trash2, Pencil, X, Calculator as CalcIcon, RefreshCw, Loader2, CheckCircle, Download, Upload, AlertCircle, Truck, Users, Percent, Target, Info, Landmark, Factory, Search, ChevronDown } from 'lucide-react';
import { PricingService } from '@/services/PricingService';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';

// Main Page Component
export const PricingManagerPage: React.FC = () => {
    const { state, actions } = useStore();
    const access = useAccess('pricing');
    const { 
        pricingProfiles = [], 
        suppliers = [], 
        categories = [], 
        products = [], 
        exchangeRates
    } = state;
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [importStatus, setImportStatus] = useState<{ added: number, updated: number, errors: number, total: number } | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [recalcingId, setRecalcingId] = useState<string | null>(null);
    const [recalcResult, setRecalcResult] = useState<{ profileId: string; count: number } | null>(null);

    const handleAddNew = () => {
        setEditingId(null);
        setIsModalOpen(true);
    };

    const handleEdit = (id: string) => {
        setEditingId(id);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить этот ценовой профиль?')) {
            await actions.deletePricingProfile(id);
        }
    };
    
    const handleRecalculateAll = async () => {
        if (!window.confirm('Пересчитать цены для ВСЕХ товаров? Это перезапишет текущие цены продажи.')) return;
        try {
            const count = await PricingService.recalculateAndSaveAllPrices(products, pricingProfiles, exchangeRates);
            alert(`Цены пересчитаны: ${count} товаров обновлено.`);
        } catch (error) {
            console.error('Ошибка при массовом пересчёте:', error);
            alert('Произошла ошибка. Подробности в консоли.');
        }
    };

    const handleRecalculateProfile = async (profile: PricingProfile) => {
        setRecalcingId(profile.id);
        setRecalcResult(null);
        try {
            const count = await PricingService.recalculateProfilePrices(profile, pricingProfiles, products, exchangeRates);
            setRecalcResult({ profileId: profile.id, count });
            setTimeout(() => setRecalcResult(null), 4000);
        } catch (error) {
            console.error('Ошибка при пересчёте профиля:', error);
        } finally {
            setRecalcingId(null);
        }
    };
    
    const handleExport = () => {
        if (!pricingProfiles) return;
        const dataToExport = pricingProfiles.map(p => ({
            name: p.name,
            applicableCategoryIds: p.applicableCategoryIds.join(','),
            supplierId: p.supplierId || '',
            logisticsRateUsd: p.logisticsRateUsd,
            batchVolumeM3: p.batchVolumeM3,
            batchShippingCostKzt: p.batchShippingCostKzt,
            batchSvhCostKzt: p.batchSvhCostKzt,
            brokerCostKzt: p.brokerCostKzt,
            customsFeesKzt: p.customsFeesKzt,
            vatRate: p.vatRate,
            citRate: p.citRate,
            salesBonusRate: p.salesBonusRate,
            pnrCostKzt: p.pnrCostKzt,
            deliveryKzt: p.deliveryKzt,
            targetNetMarginPercent: p.targetNetMarginPercent,
        }));

        const csv = [ 
            Object.keys(dataToExport[0]).join(';'),
            ...dataToExport.map(row => Object.values(row).join(';'))
        ].join('\n');

        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pricing_profiles_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };
    
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportStatus(null);
        
        const text = await file.text();
        const rows = text.split('\n').slice(1);
        
        let added = 0, updated = 0, errors = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            const [name, applicableCategoryIds, supplierId, logisticsRateUsd, batchVolumeM3, batchShippingCostKzt, batchSvhCostKzt, brokerCostKzt, customsFeesKzt, vatRate, citRate, salesBonusRate, pnrCostKzt, deliveryKzt, targetNetMarginPercent] = row.split(';');
            
            const profileName = name.trim();
            if (!profileName) {
                errors++;
                continue;
            }
            
            const profileData = {
                name: profileName,
                applicableCategoryIds: applicableCategoryIds.split(',').map(id => id.trim()).filter(Boolean),
                supplierId: supplierId.trim() || undefined,
                logisticsRateUsd: parseFloat(logisticsRateUsd) || 0,
                batchVolumeM3: parseFloat(batchVolumeM3) || 0,
                batchShippingCostKzt: parseFloat(batchShippingCostKzt) || 0,
                batchSvhCostKzt: parseFloat(batchSvhCostKzt) || 0,
                brokerCostKzt: parseFloat(brokerCostKzt) || 0,
                customsFeesKzt: parseFloat(customsFeesKzt) || 0,
                vatRate: parseFloat(vatRate) || 0,
                citRate: parseFloat(citRate) || 0,
                salesBonusRate: parseFloat(salesBonusRate) || 0,
                pnrCostKzt: parseFloat(pnrCostKzt) || 0,
                deliveryKzt: parseFloat(deliveryKzt) || 0,
                targetNetMarginPercent: parseFloat(targetNetMarginPercent) || 0,
            };

            const existing = pricingProfiles.find(p => p.name.toLowerCase() === profileName.toLowerCase());
            
            try {
                if (existing) {
                    await actions.updatePricingProfile({ ...existing, ...profileData } as any);
                } else {
                    await actions.addPricingProfile(profileData as any);
                }
            } catch (err: any) { 
                console.error(`Error importing row ${i}:`, err);
                errors++; 
            }
        }
        
        setImportStatus({ added, updated, errors, total: rows.length });
        setIsImporting(false);
        event.target.value = '';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><CalcIcon/>Ценообразование</h1>
                    <p className="text-slate-500 font-medium">Управление ценовыми профилями и массовый пересчет цен</p>
                </div>
                <div className="flex items-center gap-2">
                    {access.canWrite('actions', 'recalculate') && (
                        <button onClick={handleRecalculateAll} className="flex items-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-200">
                            <RefreshCw size={14}/>Пересчитать все
                        </button>
                    )}
                    {access.canWrite('actions', 'create') && (
                        <button onClick={handleAddNew} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                            <Plus size={18} />Новый профиль
                        </button>
                    )}
                </div>
            </div>

            { isImporting && (
                 <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4">
                     <Loader2 className="animate-spin text-blue-500"/>
                     <div>
                         <p className="font-bold text-blue-800">Идет импорт...</p>
                         <p className="text-xs text-blue-600">Пожалуйста, подождите, пока данные обрабатываются.</p>
                     </div>
                 </div>
            )}

            { importStatus && (
                <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${importStatus.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    {importStatus.errors > 0 ? <AlertCircle className="text-red-500 mt-0.5"/> : <CheckCircle className="text-emerald-500 mt-0.5"/>}
                    <div>
                        <p className={`font-black ${importStatus.errors > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                           {importStatus.errors > 0 ? 'Импорт завершен с ошибками' : 'Импорт успешно завершен'}
                        </p>
                        <p className={`text-xs mt-1 ${importStatus.errors > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                           Всего строк: <b>{importStatus.total}</b>. 
                           Добавлено: <b>{importStatus.added}</b>. 
                           Обновлено: <b>{importStatus.updated}</b>. 
                           Ошибок: <b className={importStatus.errors > 0 ? 'text-red-700 font-black' : ''}>{importStatus.errors}</b>. 
                           {importStatus.errors > 0 && 'Проверьте консоль для детальной информации.'}
                        </p>
                        <button onClick={() => setImportStatus(null)} className="text-xs font-bold mt-2 hover:underline">Скрыть</button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-end gap-3">
                     <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".csv" />
                     {access.canWrite('actions', 'import') && <button onClick={handleImportClick} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-slate-100 transition-all border border-slate-200">
                         <Upload size={14}/>Импорт
                     </button>}
                     {access.canSee('actions', 'export') && <button onClick={handleExport} disabled={!pricingProfiles || pricingProfiles.length === 0} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold uppercase text-[9px] tracking-widest hover:bg-slate-100 transition-all border border-slate-200 disabled:opacity-50">
                         <Download size={14}/>Экспорт
                     </button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Название</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Тип</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Поставщик</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Производитель</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Категории</th>
                                <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Маржа</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pricingProfiles.map(p => (
                                <tr key={p.id} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-700 flex items-center gap-2">{p.name} <span title={`ID: ${p.id}`}><Info size={12} className="text-slate-400"/></span></div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit ${p.type === ProductType.MACHINE ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                                            {p.type === ProductType.MACHINE ? <Truck size={12}/> : <Users size={12}/>} {p.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                        {p.supplierId ? (suppliers.find(s => s.id === p.supplierId)?.name || '-') : <span className="text-slate-400 italic font-medium">Все</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                        {p.applicableManufacturer || <span className="text-slate-400 italic font-medium">Все</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                        {p.applicableCategoryIds.length > 0 ? p.applicableCategoryIds.map(id => categories.find(c => c.id === id)?.name || id).join(', ') : <span className="text-slate-400 italic font-medium">Все</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="font-black text-emerald-600 flex items-center gap-1 justify-end"><Target size={12}/> {p.targetNetMarginPercent}%</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {recalcResult?.profileId === p.id && (
                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                                    ✓ {recalcResult.count} товаров
                                                </span>
                                            )}
                                            {access.canWrite('actions', 'recalculate') && (
                                                <button
                                                    onClick={() => handleRecalculateProfile(p)}
                                                    disabled={recalcingId === p.id}
                                                    title="Пересчитать цены для этого профиля"
                                                    className="p-2 text-slate-400 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                >
                                                    {recalcingId === p.id ? <Loader2 size={15} className="animate-spin text-amber-500"/> : <RefreshCw size={15}/>}
                                                </button>
                                            )}
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                {access.canWrite('actions', 'update') && <button onClick={() => handleEdit(p.id)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={16}/></button>}
                                                {access.canWrite('actions', 'delete') && <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <PricingProfileModal 
                    profileId={editingId} 
                    onClose={handleCloseModal} 
                />
            )}
        </div>
    );
};


// --- MODAL --- //

interface FormCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    color?: 'blue' | 'orange' | 'purple';
}

const FormCard: React.FC<FormCardProps> = ({ title, icon, children, className, color = 'blue' }) => {
    const colorClasses = {
        blue: 'text-blue-600',
        orange: 'text-orange-600',
        purple: 'text-purple-600',
    };

    return (
        <div className={`bg-white/70 p-4 rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>
            <h3 className={`text-xs font-black flex items-center gap-2 mb-4 uppercase tracking-wider ${colorClasses[color]}`}>{icon} {title}</h3>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
};

interface PricingProfileModalProps {
    profileId: string | null;
    onClose: () => void;
}

const PricingProfileModal: React.FC<PricingProfileModalProps> = ({ profileId, onClose }) => {
    const { state, actions } = useStore();
    const { pricingProfiles, suppliers, categories, products = [] } = state;
    const [profile, setProfile] = useState<Partial<PricingProfile> | null>(null);
    const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);

    // Производитель — дропдаун с поиском
    const [isManufOpen, setIsManufOpen] = useState(false);
    const [manufSearch, setManufSearch] = useState('');
    const manufRef = useRef<HTMLDivElement>(null);

    // Поставщик — дропдаун с поиском
    const [isSupplierOpen, setIsSupplierOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const supplierRef = useRef<HTMLDivElement>(null);

    const availableManufacturers = useMemo(() => {
        return Array.from(new Set(
            products.filter(p => p.manufacturer).map(p => p.manufacturer as string)
        )).sort((a, b) => a.localeCompare(b, 'ru'));
    }, [products]);

    const filteredManufacturers = useMemo(() =>
        availableManufacturers.filter(m => !manufSearch || m.toLowerCase().includes(manufSearch.toLowerCase())),
        [availableManufacturers, manufSearch]
    );

    const filteredSuppliers = useMemo(() =>
        suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())),
        [suppliers, supplierSearch]
    );

    const selectedSupplierName = useMemo(() =>
        suppliers.find(s => s.id === profile?.supplierId)?.name || '',
        [suppliers, profile?.supplierId]
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (manufRef.current && !manufRef.current.contains(e.target as Node)) setIsManufOpen(false);
            if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setIsSupplierOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (profileId) {
            const existingProfile = pricingProfiles.find(p => p.id === profileId);
            if (existingProfile) {
                let derivedType = ProductType.MACHINE;
                if (existingProfile.applicableCategoryIds && existingProfile.applicableCategoryIds.length > 0) {
                    const firstCategory = categories.find(c => c.id === existingProfile.applicableCategoryIds[0]);
                    if (firstCategory) {
                        derivedType = firstCategory.type;
                    }
                }
                setProfile({ ...existingProfile, type: derivedType });
            }
        } else {
            setProfile({
                name: '', type: ProductType.MACHINE, applicableCategoryIds: [],
                logisticsRateUsd: 150, batchVolumeM3: 20, batchShippingCostKzt: 1200000,
                batchSvhCostKzt: 100000, brokerCostKzt: 104000, customsFeesKzt: 52000,
                vatRate: 16, citRate: 0, salesBonusRate: 3, pnrCostKzt: 0,
                deliveryKzt: 0, targetNetMarginPercent: 25
            });
        }
    }, [profileId, pricingProfiles, categories]);

    useEffect(() => {
        if (profile?.type) {
            const newAvailable = categories.filter(c => c.type === profile.type);
            setAvailableCategories(newAvailable);
            const availableIds = newAvailable.map(c => c.id);
            const filteredSelected = (profile.applicableCategoryIds || []).filter(id => availableIds.includes(id));
            if ((profile.applicableCategoryIds || []).length !== filteredSelected.length) {
                handleChange('applicableCategoryIds', filteredSelected);
            }
        }
    }, [profile?.type, categories]);

    const handleChange = (field: keyof PricingProfile, value: any) => {
        // Если это числовое поле и значение NaN, превращаем его в 0 для стейта
        if (typeof value === 'number' && isNaN(value)) {
            value = 0;
        }
        if (profile) setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!profile || !profile.name) {
            alert('Название профиля не может быть пустым.');
            return;
        }
    
        // Ensure all numeric fields are present and valid numbers (not NaN)
        const profileWithDefaults = {
            ...profile,
            logisticsRateUsd: Number(profile.logisticsRateUsd) || 0,
            batchVolumeM3: Number(profile.batchVolumeM3) || 0,
            batchShippingCostKzt: Number(profile.batchShippingCostKzt) || 0,
            batchSvhCostKzt: Number(profile.batchSvhCostKzt) || 0,
            brokerCostKzt: Number(profile.brokerCostKzt) || 0,
            customsFeesKzt: Number(profile.customsFeesKzt) || 0,
            vatRate: Number(profile.vatRate) || 0,
            citRate: Number(profile.citRate) || 0,
            salesBonusRate: Number(profile.salesBonusRate) || 0,
            pnrCostKzt: Number(profile.pnrCostKzt) || 0,
            deliveryKzt: Number(profile.deliveryKzt) || 0,
            targetNetMarginPercent: Number(profile.targetNetMarginPercent) || 0,
            applicableCategoryIds: profile.applicableCategoryIds || []
        };

        // type — UI-поле, не хранится в БД
        const { type, ...profileToSave } = profileWithDefaults;

        if (profileId) {
            await actions.updatePricingProfile(profileToSave as PricingProfile);
        } else {
            const { id, ...newProfileData } = profileToSave;
            await actions.addPricingProfile(newProfileData as any);
        }
        onClose();
    };
    
    const handleCategoryToggle = (catId: string) => {
        if (!profile) return;
        const current = profile.applicableCategoryIds || [];
        const newSelection = current.includes(catId) ? current.filter(id => id !== catId) : [...current, catId];
        handleChange('applicableCategoryIds', newSelection);
    };

    const renderContent = () => {
        if (!profile) {
            return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;
        }

        return (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                <div className="w-full max-w-6xl mx-auto space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                        <div className="md:col-span-2">
                            <StyledSelect label="Тип профиля" value={profile.type || ''} onChange={e => handleChange('type', e.target.value as ProductType)} options={Object.values(ProductType)} />
                        </div>
                        <div className="md:col-span-3">
                            <StyledInput label="Название профиля" value={profile.name || ''} onChange={e => handleChange('name', e.target.value)} placeholder="Лазеры JK" />
                        </div>

                        {/* Поставщик — дропдаун с поиском */}
                        <div className="md:col-span-2 relative" ref={supplierRef}>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Truck size={11}/> Поставщик</label>
                            <div
                                className={`w-full flex items-center justify-between border rounded-lg py-2 px-3 text-sm font-bold cursor-pointer transition-all bg-white shadow-sm ${isSupplierOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-300/70'}`}
                                onClick={() => { setIsSupplierOpen(v => !v); setSupplierSearch(''); }}
                            >
                                <span className={selectedSupplierName ? 'text-slate-800' : 'text-slate-400 italic font-medium text-sm'}>
                                    {selectedSupplierName || 'Все'}
                                </span>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${isSupplierOpen ? 'rotate-180' : ''}`}/>
                            </div>
                            {isSupplierOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[200] animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
                                    <div className="p-2 border-b bg-slate-50">
                                        <div className="relative">
                                            <Search size={11} className="absolute left-2.5 top-2 text-slate-400"/>
                                            <input autoFocus className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400" placeholder="Начните ввод..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}/>
                                        </div>
                                    </div>
                                    <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                                        <div onClick={() => { handleChange('supplierId', ''); setIsSupplierOpen(false); setSupplierSearch(''); }} className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${!profile.supplierId ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-400 italic'}`}>
                                            <span className="font-bold">— Все поставщики —</span>
                                            {!profile.supplierId && <CheckCircle size={12} className="text-blue-500"/>}
                                        </div>
                                        {filteredSuppliers.map(s => (
                                            <div key={s.id} onClick={() => { handleChange('supplierId', s.id); setIsSupplierOpen(false); setSupplierSearch(''); }} className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${profile.supplierId === s.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                                <span className="font-bold">{s.name}</span>
                                                {profile.supplierId === s.id && <CheckCircle size={12} className="text-blue-500"/>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Производитель — дропдаун с поиском */}
                        <div className="md:col-span-2 relative" ref={manufRef}>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Factory size={11}/> Производитель</label>
                            <div
                                className={`w-full flex items-center justify-between border rounded-lg py-2 px-3 text-sm font-bold cursor-pointer transition-all bg-white shadow-sm ${isManufOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-300/70'}`}
                                onClick={() => { setIsManufOpen(v => !v); setManufSearch(''); }}
                            >
                                <span className={profile.applicableManufacturer ? 'text-slate-800' : 'text-slate-400 italic font-medium text-sm'}>
                                    {profile.applicableManufacturer || 'Все'}
                                </span>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ${isManufOpen ? 'rotate-180' : ''}`}/>
                            </div>
                            {isManufOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[200] animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
                                    <div className="p-2 border-b bg-slate-50">
                                        <div className="relative">
                                            <Search size={11} className="absolute left-2.5 top-2 text-slate-400"/>
                                            <input autoFocus className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400" placeholder="Начните ввод..." value={manufSearch} onChange={e => setManufSearch(e.target.value)}/>
                                        </div>
                                    </div>
                                    <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                                        <div onClick={() => { handleChange('applicableManufacturer', ''); setIsManufOpen(false); setManufSearch(''); }} className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${!profile.applicableManufacturer ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-400 italic'}`}>
                                            <span className="font-bold">— Все производители —</span>
                                            {!profile.applicableManufacturer && <CheckCircle size={12} className="text-blue-500"/>}
                                        </div>
                                        {filteredManufacturers.map(m => (
                                            <div key={m} onClick={() => { handleChange('applicableManufacturer', m); setIsManufOpen(false); setManufSearch(''); }} className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${profile.applicableManufacturer === m ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                                <span className="font-bold">{m}</span>
                                                {profile.applicableManufacturer === m && <CheckCircle size={12} className="text-blue-500"/>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Категории</label>
                            <div className="flex flex-wrap gap-2 p-2.5 bg-white rounded-lg border border-slate-300/70 min-h-[5.5rem] max-h-48 overflow-y-auto shadow-sm">
                                {availableCategories.map(cat => (
                                    <button key={cat.id} onClick={() => handleCategoryToggle(cat.id)} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${(profile.applicableCategoryIds || []).includes(cat.id) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <FormCard title="Логистика" icon={<Truck size={16}/>} color="blue">
                            <StyledInput label="Доставка Урумчи-Алматы ($/м³)" value={profile.logisticsRateUsd ?? ''} onChange={e => handleChange('logisticsRateUsd', parseFloat(e.target.value))} type="number" />
                            <div className="grid grid-cols-2 gap-3">
                                <StyledInput label="Объем партии (m³)" value={profile.batchVolumeM3 ?? ''} onChange={e => handleChange('batchVolumeM3', parseFloat(e.target.value))} type="number" />
                                <StyledInput label="Доставка КРГ (₸)" value={profile.batchShippingCostKzt ?? ''} onChange={e => handleChange('batchShippingCostKzt', parseFloat(e.target.value))} type="number" />
                            </div>
                            <StyledInput label="Терминал/СВХ (₸)" value={profile.batchSvhCostKzt ?? ''} onChange={e => handleChange('batchSvhCostKzt', parseFloat(e.target.value))} type="number" />
                        </FormCard>

                        <FormCard title="Налоги / Таможня" icon={<Landmark size={16}/>} color="orange">
                            <div className="grid grid-cols-2 gap-3">
                                <StyledInput label="Брокер (₸)" value={profile.brokerCostKzt ?? ''} onChange={e => handleChange('brokerCostKzt', parseFloat(e.target.value))} type="number" />
                                <StyledInput label="Сборы (₸)" value={profile.customsFeesKzt ?? ''} onChange={e => handleChange('customsFeesKzt', parseFloat(e.target.value))} type="number"/>
                            </div>
                            <div className="grid grid-cols-2 gap-3 p-2 bg-orange-50/50 rounded-lg">
                                <StyledInput label="НДС (%)" value={profile.vatRate ?? ''} onChange={e => handleChange('vatRate', parseFloat(e.target.value))} type="number" />
                                <StyledInput label="КПН (%)" value={profile.citRate ?? ''} onChange={e => handleChange('citRate', parseFloat(e.target.value))} type="number" />
                            </div>
                            <StyledInput label="Бонус Менеджера (%)" value={profile.salesBonusRate ?? ''} onChange={e => handleChange('salesBonusRate', parseFloat(e.target.value))} type="number" />
                        </FormCard>
                        
                        <div className="space-y-5">
                            <FormCard title="Сервис и Цель" icon={<Users size={16}/>} color="purple">
                                 <div className="grid grid-cols-2 gap-3">
                                    <StyledInput label="ПНР (₸)" value={profile.pnrCostKzt ?? ''} onChange={e => handleChange('pnrCostKzt', parseFloat(e.target.value))} type="number" />
                                    <StyledInput label="Доставка до клиента (₸)" value={profile.deliveryKzt ?? ''} onChange={e => handleChange('deliveryKzt', parseFloat(e.target.value))} type="number" />
                                </div>
                            </FormCard>
                            <div className="bg-emerald-50/80 p-4 rounded-2xl border-2 border-emerald-300/50 shadow-sm text-center">
                                 <h3 className="text-xs font-black text-emerald-800 flex items-center justify-center gap-2 mb-2 uppercase tracking-wider"><Target size={14}/> Рентабельность</h3>
                                 <div className="relative flex items-center justify-center">
                                     <input type="number" value={profile.targetNetMarginPercent ?? ''} onChange={e => handleChange('targetNetMarginPercent', parseFloat(e.target.value))} className="text-5xl font-black text-emerald-700 bg-transparent text-center w-full outline-none pr-10" placeholder="0" />
                                     <span className="text-4xl font-bold text-emerald-500/80">%</span>
                                 </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 bg-blue-100/50 border border-blue-200/50 rounded-xl flex items-center gap-3 text-sm text-blue-800">
                        <Info size={20} className="flex-shrink-0" />
                        <span>Профили гарантируют маржинальность за счет обратного расчета цены с учетом всех налогов и логистики.</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-100 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
                 <div className="p-4 border-b border-slate-300/50 flex justify-between items-center bg-[#1A233A] text-white rounded-t-2xl">
                    <h2 className="text-base font-bold uppercase tracking-wider flex items-center gap-3"><CalcIcon size={18}/> {profileId ? 'Настройка профиля' : 'Новый профиль'}</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
                </div>
                {renderContent()}
                <div className="p-4 bg-white/50 border-t border-slate-200 flex justify-end gap-4 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 font-bold text-slate-600 hover:bg-slate-200/70 rounded-lg uppercase text-xs tracking-widest transition-colors">ОТМЕНА</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-500/20 uppercase tracking-widest text-xs transition-all hover:bg-blue-700 active:scale-95 flex items-center gap-2">
                        <Save size={14}/>СОХРАНИТЬ ИЗМЕНЕНИЯ
                    </button>
                </div>
            </div>
        </div>
    );
};

// Styled Components for inputs
const StyledInput: React.FC<any> = ({ label, ...props }) => (
    <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{label}</label>
        <input 
            {...props} 
            value={typeof props.value === 'number' && isNaN(props.value) ? '' : props.value}
            className="w-full bg-white border border-slate-300/70 py-2 px-3 rounded-lg text-base font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-0 shadow-sm" 
        />
    </div>
);

const StyledSelect: React.FC<any> = ({ label, options, ...props }) => (
     <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{label}</label>
        <select {...props} className="w-full bg-white border border-slate-300/70 py-2.5 px-3 rounded-lg text-base font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-0 appearance-none shadow-sm">
            {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);
