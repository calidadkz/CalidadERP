
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, ProductType, Currency, Supplier, ProductCategory, PricingProfile, HSCode, PricingMethod, Manufacturer, ProductPackage } from '@/types';
import { Info, Package, Zap, Calculator, Search, ChevronDown, CheckCircle, Monitor, AlignLeft, Factory, Hash, Plus } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { PackageInputRow } from './PackageComponents';

interface GeneralTabProps {
    formData: Partial<Product>;
    suppliers: Supplier[];
    categories: ProductCategory[];
    hscodes: HSCode[];
    pricingProfiles: PricingProfile[];
    manufacturers: Manufacturer[];
    modalMode: 'create' | 'edit';
    onChange: (field: keyof Product, value: any) => void;
    economyData?: any;
    appliedProfile?: PricingProfile | null;
    onShowDetails?: () => void;
    onPackageChange: (index: number, field: keyof ProductPackage, value: any) => void;
    onAddPackage: () => void;
    onRemovePackage: (index: number) => void;
    showDetails?: boolean;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ 
    formData, suppliers = [], categories = [], hscodes = [], pricingProfiles = [], manufacturers = [], modalMode, onChange, onPackageChange, onAddPackage, onRemovePackage, economyData, appliedProfile, onShowDetails, showDetails = false 
}) => {
    const access = useAccess('nomenclature');
    const [isCatOpen, setIsCatOpen] = useState(false);
    const [catSearch, setCatSearch] = useState('');
    const [dimMode, setDimMode] = useState<'transport' | 'working'>('transport');
    const catRef = useRef<HTMLDivElement>(null);

    const [isHSOpen, setIsHSOpen] = useState(false);
    const [hsSearch, setHSSearch] = useState('');
    const hsRef = useRef<HTMLDivElement>(null);

    const [isMethodOpen, setIsMethodOpen] = useState(false);
    const methodRef = useRef<HTMLDivElement>(null);

    const canWriteField = (key: string) => access.canWrite('fields', key);

    const isSidebarActuallyOpen = useMemo(() => {
        return showDetails && !!appliedProfile && access.canSee('fields', 'pricingDetails');
    }, [showDetails, appliedProfile, access]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (catRef.current && !catRef.current.contains(event.target as Node)) setIsCatOpen(false);
            if (hsRef.current && !hsRef.current.contains(event.target as Node)) setIsHSOpen(false);
            if (methodRef.current && !methodRef.current.contains(event.target as Node)) setIsMethodOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNumChange = (field: keyof Product, val: string) => {
        const num = parseFloat(val);
        onChange(field, isNaN(num) ? 0 : num);
    };

    const filteredCategories = useMemo(() => {
        return categories
            .filter(c => c.type === formData.type)
            .filter(c => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [categories, formData.type, catSearch]);

    const filteredHSCodes = useMemo(() => {
        return hscodes
            .filter(h => !hsSearch || h.code.includes(hsSearch) || h.name.toLowerCase().includes(hsSearch.toLowerCase()))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [hscodes, hsSearch]);

    const availableProfiles = useMemo(() => {
        if (!formData.supplierId) return [];
        return pricingProfiles.filter(p => {
            const matchSupplier = p.supplierId === formData.supplierId;
            const matchType = (p.type || ProductType.MACHINE) === formData.type;
            if (formData.type === ProductType.MACHINE) {
                const matchCategory = !p.applicableCategoryIds?.length || p.applicableCategoryIds.includes(formData.categoryId || '');
                return matchSupplier && matchType && matchCategory;
            }
            return matchSupplier && matchType;
        }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [pricingProfiles, formData.categoryId, formData.supplierId, formData.type]);

    useEffect(() => {
        if (formData.pricingMethod === PricingMethod.PROFILE && formData.pricingProfileId) {
            const stillValid = availableProfiles.some(p => p.id === formData.pricingProfileId);
            if (!stillValid && modalMode !== 'edit') { 
                 onChange('pricingMethod', PricingMethod.MARKUP_WITHOUT_VAT);
                 onChange('pricingProfileId', null);
            }
        }
    }, [formData.supplierId, formData.categoryId, availableProfiles]);

    const machineCategories = useMemo(() => {
        return categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [categories]);

    const currentCategory = useMemo(() => 
        categories.find(c => c.id === formData.categoryId), 
    [categories, formData.categoryId]);

    const currentHSCode = useMemo(() => 
        hscodes.find(h => h.id === formData.hsCodeId),
    [hscodes, formData.hsCodeId]);

    const currentMethodLabel = useMemo(() => {
        if (formData.pricingMethod === PricingMethod.PROFILE && formData.pricingProfileId) {
            const profile = pricingProfiles.find(p => p.id === formData.pricingProfileId);
            if (profile) return profile.name;
        }
        return formData.pricingMethod === PricingMethod.MARKUP_WITH_VAT ? 'Наценка (с НДС)' : 'Наценка (без НДС)';
    }, [formData.pricingMethod, formData.pricingProfileId, pricingProfiles]);

    const toggleMachineCompatibility = (catId: string) => {
        if (!canWriteField('actions')) return; 
        const current = formData.compatibleMachineCategoryIds || [];
        const updated = current.includes(catId) ? current.filter(id => id !== catId) : [...current, catId];
        onChange('compatibleMachineCategoryIds', updated);
    };

    const calculatedProfit = useMemo(() => {
        if (!economyData) return 0;
        if (formData.pricingMethod === PricingMethod.PROFILE) return economyData.netProfit || 0;
        const purchaseKzt = economyData.purchaseKzt || 0;
        const salesKzt = formData.salesPrice || 0;
        if (formData.pricingMethod === PricingMethod.MARKUP_WITH_VAT) return (salesKzt / 1.16) - purchaseKzt;
        return salesKzt - purchaseKzt;
    }, [formData.pricingMethod, formData.salesPrice, economyData]);

    const handleMethodSelect = (method: PricingMethod, profileId?: string) => {
        onChange('pricingMethod', method);
        onChange('pricingProfileId', profileId || null);
        setIsMethodOpen(false);
    };

    const totalVolume = useMemo(() => formData.packages?.reduce((sum, p) => sum + (p.volumeM3 || 0), 0) || 0, [formData.packages]);
    const totalWeight = useMemo(() => formData.packages?.reduce((sum, p) => sum + (p.weightKg || 0), 0) || 0, [formData.packages]);

    return (
        <div className="p-4 h-full overflow-y-auto custom-scrollbar relative bg-gray-50/30">
            <div className="max-w-7xl mx-auto space-y-3">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center pb-1.5 border-b">
                        <Info size={14} className="mr-2 text-blue-500"/> Основная информация
                    </h4>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                        <div className="col-span-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Тип товара</label>
                            <select 
                                className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs bg-slate-50 font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-70" 
                                value={formData.type} 
                                onChange={e => onChange('type', e.target.value)} 
                                disabled={modalMode === 'edit' || !canWriteField('type')}
                            >
                                {Object.values(ProductType).map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
                            </select>
                        </div>

                        <div className="col-span-1 relative" ref={catRef}>
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Категория (Своя)</label>
                            <div className="relative">
                                <div 
                                    className={`w-full flex items-center justify-between border rounded-lg py-1.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                                        isCatOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white' : 'border-slate-200 bg-white'
                                    } ${!canWriteField('categoryId') ? 'opacity-70 pointer-events-none' : ''}`}
                                    onClick={() => setIsCatOpen(!isCatOpen)}
                                >
                                    <span className={currentCategory ? 'text-slate-800' : 'text-slate-400 italic'}>
                                        {currentCategory ? currentCategory.name : 'Поиск...'}
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-300 transition-transform ${isCatOpen ? 'rotate-180' : ''}`}/>
                                </div>

                                {isCatOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] animate-in fade-in slide-in-from-top-1 overflow-hidden">
                                        <div className="p-2 border-b bg-slate-50">
                                            <div className="relative">
                                                <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                                                <input 
                                                    autoFocus
                                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400"
                                                    placeholder="Начните ввод..."
                                                    value={catSearch}
                                                    onChange={e => setCatSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto p-1 custom-scrollbar">
                                            {filteredCategories.map(c => (
                                                <div 
                                                    key={c.id}
                                                    onClick={() => { onChange('categoryId', c.id); setIsCatOpen(false); setCatSearch(''); }}
                                                    className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between group transition-all ${
                                                        formData.categoryId === c.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    <span className="font-bold">{c.name}</span>
                                                    {formData.categoryId === c.id && <CheckCircle size={12} className="text-blue-500"/>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Поставщик</label>
                            <select 
                                className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-70" 
                                value={formData.supplierId || ''} 
                                onChange={e => onChange('supplierId', e.target.value)}
                                disabled={!canWriteField('supplierId')}
                            >
                                <option value="">-- Не указан --</option>
                                {[...suppliers].sort((a,b) => a.name.localeCompare(b.name, 'ru')).map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-1">
                                <Factory size={10} className="text-blue-500"/> Производитель
                            </label>
                            <select 
                                className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold bg-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-70" 
                                value={formData.manufacturer || ''} 
                                onChange={e => onChange('manufacturer', e.target.value)}
                                disabled={!canWriteField('name')}
                            >
                                <option value="">-- Не указан --</option>
                                {[...manufacturers].sort((a,b) => a.name.localeCompare(b.name, 'ru')).map(m => (
                                    <option key={m.id} value={m.name}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="w-[40%]">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Название для поставщика</label>
                            <input 
                                className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-black font-mono focus:ring-4 focus:ring-blue-500/10 transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500" 
                                value={formData.supplierProductName || ''} 
                                onChange={e => onChange('supplierProductName', e.target.value)} 
                                placeholder="Part-001..."
                                disabled={!canWriteField('sku')}
                            />
                        </div>
                        <div className="w-[60%]">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Наименование</label>
                            <input 
                                className="w-full border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500" 
                                value={formData.name || ''} 
                                onChange={e => onChange('name', e.target.value)} 
                                placeholder="Полное название товара"
                                disabled={!canWriteField('name')}
                            />
                        </div>
                    </div>
                </div>

                {(formData.type === ProductType.PART || formData.type === ProductType.SERVICE) && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center pb-1.5 border-b">
                            <Monitor size={14} className="mr-2 text-indigo-500"/> Совместимость с оборудованием
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {machineCategories.length > 0 ? (
                                machineCategories.map(cat => {
                                    const isSelected = (formData.compatibleMachineCategoryIds || []).includes(cat.id);
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => toggleMachineCompatibility(cat.id)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight border transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                                                isSelected 
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200' 
                                                : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'
                                            }`}
                                        >
                                            {isSelected ? <CheckCircle size={12}/> : <div className="w-3 h-3 rounded-full border border-current opacity-30"/>}
                                            {cat.name}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center w-full bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Категории оборудования не найдены</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-3 pb-1 border-b">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                                <Package size={14} className={`${isSidebarActuallyOpen ? 'mr-0' : 'mr-2'} text-orange-500`}/>
                                {!isSidebarActuallyOpen && <span>Габариты</span>}
                            </h4>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner">
                                <button onClick={() => setDimMode('transport')} className={`px-3 py-1 text-[8px] font-black uppercase rounded-md transition-all ${dimMode === 'transport' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>{isSidebarActuallyOpen ? 'Т' : 'Транспортные'}</button>
                                <button onClick={() => setDimMode('working')} className={`px-3 py-1 text-[8px] font-black uppercase rounded-md transition-all ${dimMode === 'working' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>{isSidebarActuallyOpen ? 'Р' : 'Рабочие'}</button>
                            </div>
                        </div>
                        {dimMode === 'working' ? (
                            <>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">Длина (мм)</label><input type="number" className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs text-center font-bold outline-none" value={formData.workingLengthMm || ''} onChange={e => handleNumChange('workingLengthMm', e.target.value)}/></div>
                                    <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">Ширина (мм)</label><input type="number" className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs text-center font-bold outline-none" value={formData.workingWidthMm || ''} onChange={e => handleNumChange('workingWidthMm', e.target.value)}/></div>
                                    <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">Высота (мм)</label><input type="number" className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs text-center font-bold outline-none" value={formData.workingHeightMm || ''} onChange={e => handleNumChange('workingHeightMm', e.target.value)}/></div>
                                </div>
                                <div className="flex gap-3 items-center p-3 rounded-xl border transition-all bg-indigo-50/50 border-indigo-100">
                                    <div className="flex-1">
                                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Объем</div>
                                        <div className="text-lg font-black text-slate-800 font-mono">{formData.workingVolumeM3 || 0} <span className="text-[10px] font-bold text-slate-400">м³</span></div>
                                    </div>
                                    <div className="w-px h-6 bg-slate-200"/>
                                    <div className="flex-1">
                                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Вес (кг)</label>
                                        <input type="number" className="w-full bg-transparent p-0 text-lg font-black text-slate-800 outline-none font-mono border-b border-transparent focus:border-blue-500" value={formData.workingWeightKg || ''} onChange={e => handleNumChange('workingWeightKg', e.target.value)}/>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {formData.packages?.map((pkg, index) => (
                                        <PackageInputRow 
                                            key={pkg.id || index}
                                            pkg={pkg} 
                                            index={index} 
                                            onPackageChange={onPackageChange} 
                                            onRemovePackage={onRemovePackage} 
                                        />
                                    ))}
                                    {(formData.packages?.length || 0) < 5 && (
                                        <button onClick={onAddPackage} className="w-full py-1.5 border border-dashed border-blue-300 text-blue-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-1">
                                            <Plus size={12}/> Добавить место
                                        </button>
                                    )}
                                </div>
                                <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-xl mt-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] font-black uppercase text-slate-400">Итого Объем</span>
                                        <span className="text-sm font-black text-slate-800 font-mono">{totalVolume.toFixed(3)} <span className="text-[10px] text-slate-400">м³</span></span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black uppercase text-slate-400">Итого Вес</span>
                                        <span className="text-sm font-black text-slate-800 font-mono">{totalWeight.toFixed(2)} <span className="text-[10px] text-slate-400">кг</span></span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="col-span-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b relative" ref={methodRef}>
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                                <Zap size={14} className={`${isSidebarActuallyOpen ? 'mr-0' : 'mr-2'} text-green-500`}/> 
                                {!isSidebarActuallyOpen && <span>Цены</span>}
                            </h4>
                            <div 
                                onClick={() => setIsMethodOpen(!isMethodOpen)}
                                className="flex items-center gap-2 border border-slate-200 rounded-lg py-0.5 px-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-all"
                            >
                                <span className="text-[9px] font-black uppercase text-blue-600 truncate max-w-[120px]">{currentMethodLabel}</span>
                                <ChevronDown size={12} className={`text-slate-400 transition-transform ${isMethodOpen ? 'rotate-180' : ''}`}/>
                            </div>

                            {isMethodOpen && (
                                <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[120] w-[200px] animate-in fade-in slide-in-from-top-1 overflow-hidden">
                                    <div className="p-1">
                                        <div 
                                            onClick={() => handleMethodSelect(PricingMethod.MARKUP_WITHOUT_VAT)}
                                            className={`px-3 py-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase hover:bg-slate-50 transition-all ${formData.pricingMethod === PricingMethod.MARKUP_WITHOUT_VAT ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}
                                        >
                                            Наценка (без НДС)
                                        </div>
                                        <div 
                                            onClick={() => handleMethodSelect(PricingMethod.MARKUP_WITH_VAT)}
                                            className={`px-3 py-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase hover:bg-slate-50 transition-all ${formData.pricingMethod === PricingMethod.MARKUP_WITH_VAT ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}
                                        >
                                            Наценка (с НДС)
                                        </div>
                                        {(formData.type === ProductType.MACHINE || formData.type === ProductType.PART) && (
                                            <>
                                                <div className="px-3 pt-2 pb-1 text-[8px] font-black text-slate-400 uppercase tracking-widest border-t mt-1">Ценовые профили</div>
                                                {availableProfiles.length > 0 ? (
                                                    availableProfiles.map(p => (
                                                        <div 
                                                            key={p.id}
                                                            onClick={() => handleMethodSelect(PricingMethod.PROFILE, p.id)}
                                                            className={`px-3 py-2 rounded-lg cursor-pointer text-[10px] font-bold uppercase hover:bg-slate-50 transition-all ${formData.pricingProfileId === p.id ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}
                                                        >
                                                            {p.name}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-2 text-[9px] text-slate-400 italic">Нет подходящих профилей (совпадение Пост+Кат)</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="flex flex-col">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Закуп (ВЦП)</label>
                                <div className="flex h-[34px]">
                                    <input type="number" className="w-full border border-slate-200 rounded-l-lg px-2 text-sm font-black font-mono outline-none focus:ring-4 focus:ring-green-500/10" value={formData.basePrice || ''} onChange={e => handleNumChange('basePrice', e.target.value)}/>
                                    <select className="w-14 border border-l-0 border-slate-200 rounded-r-lg bg-slate-100 font-black text-[9px] outline-none" value={formData.currency} onChange={e => onChange('currency', e.target.value as Currency)}>
                                        {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Наценка %</label>
                                <div className="relative h-[34px]">
                                    <input 
                                        type="number" 
                                        className={`w-full h-full border rounded-lg px-2 text-sm font-black font-mono outline-none transition-all ${formData.pricingMethod === PricingMethod.PROFILE ? 'bg-slate-50 border-slate-100 text-slate-400' : 'border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500/10'}`} 
                                        value={formData.markupPercentage || ''} 
                                        onChange={e => formData.pricingMethod !== PricingMethod.PROFILE && handleNumChange('markupPercentage', e.target.value)}
                                        readOnly={formData.pricingMethod === PricingMethod.PROFILE}
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">%</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="flex flex-col">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Цена продажи</label>
                                <div className={`flex items-center justify-between h-[34px] border rounded-lg px-2 shadow-inner transition-all ${formData.pricingMethod === PricingMethod.PROFILE ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className={`text-sm font-black font-mono truncate ${formData.pricingMethod === PricingMethod.PROFILE ? 'text-blue-700' : 'text-slate-700'}`}>{(formData.salesPrice || 0).toLocaleString()}</span>
                                    <span className={`text-[9px] font-black uppercase ml-1 flex-shrink-0 ${formData.pricingMethod === PricingMethod.PROFILE ? 'text-blue-400' : 'text-slate-400'}`}>₸</span>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Прибыль</label>
                                <div className="flex items-center justify-between h-[34px] border border-slate-100 rounded-lg px-2 bg-emerald-50/30">
                                    <span className="text-sm font-black font-mono text-emerald-600 truncate">
                                        {(Math.round(calculatedProfit)).toLocaleString()}
                                    </span>
                                    <span className="text-[9px] font-black uppercase text-emerald-400 ml-1 flex-shrink-0">₸</span>
                                </div>
                            </div>
                        </div>

                        {formData.pricingMethod === PricingMethod.PROFILE && (
                            <button onClick={onShowDetails} className="w-full py-1.5 bg-slate-900 text-white rounded-lg font-black uppercase text-[8px] tracking-widest flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-all">
                                <Calculator size={10}/> Детализация
                            </button>
                        )}
                    </div>

                    <div className="col-span-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center pb-1.5 border-b">
                            <Hash size={14} className={`${isSidebarActuallyOpen ? 'mr-0' : 'mr-2'} text-indigo-500`}/> 
                            {!isSidebarActuallyOpen && <span>Таможня</span>}
                        </h4>
                        <div className="space-y-3">
                            <div className="relative" ref={hsRef}>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Код ТНВЭД</label>
                                <div 
                                    className={`w-full flex items-center justify-between border rounded-lg py-1.5 px-3 text-xs font-mono font-black transition-all cursor-pointer ${
                                        isHSOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-700'
                                    }`}
                                    onClick={() => setIsHSOpen(!isHSOpen)}
                                >
                                    <span>{currentHSCode ? currentHSCode.code : 'Выберите код...'}</span>
                                    <ChevronDown size={14} className={`text-slate-300 transition-transform ${isHSOpen ? 'rotate-180' : ''}`}/>
                                </div>

                                {isHSOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] animate-in fade-in slide-in-from-top-1 overflow-hidden">
                                        <div className="p-2 border-b bg-slate-50">
                                            <div className="relative">
                                                <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                                                <input 
                                                    autoFocus
                                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400"
                                                    placeholder="Начните ввод..."
                                                    value={hsSearch}
                                                    onChange={e => setHSSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto p-1 custom-scrollbar">
                                            {filteredHSCodes.map(h => (
                                                <div 
                                                    key={h.id}
                                                    onClick={() => { onChange('hsCodeId', h.id); setIsHSOpen(false); setHSSearch(''); }}
                                                    className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] border-b last:border-0 transition-all ${
                                                        formData.hsCodeId === h.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    <div className="font-black font-mono">{h.code}</div>
                                                    <div className="text-[9px] font-bold opacity-60 line-clamp-1">{h.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 ml-1">Наименование</label>
                                <div className="w-full border border-slate-100 rounded-lg py-2 px-3 text-[10px] font-bold text-slate-600 bg-slate-50/50 min-h-[34px] leading-tight">
                                    {currentHSCode ? currentHSCode.name : '—'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <label className="block text-[7px] font-black text-slate-400 uppercase mb-0.5">Пошлина</label>
                                    <div className="text-sm font-black text-slate-700">
                                        {currentHSCode?.dutyPercentage ?? 0}%
                                    </div>
                                </div>
                                <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                                    <label className="block text-[7px] font-black text-purple-400 uppercase mb-0.5">ВТО</label>
                                    <div className="text-sm font-black text-purple-700">
                                        {currentHSCode?.dutyWtoPercentage ?? 0}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center pb-1.5 border-b">
                        <AlignLeft size={14} className="mr-2 text-slate-500"/> Описание товара
                    </h4>
                    <textarea 
                        className="w-full border border-slate-200 rounded-xl p-3 text-xs font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none min-h-[100px] placeholder:text-slate-300"
                        placeholder="Введите описание..."
                        value={formData.description || ''}
                        onChange={e => onChange('description', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};
