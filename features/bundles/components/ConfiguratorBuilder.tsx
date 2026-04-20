
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductType, Bundle, Product, OptionVariant, OptionType, MachineConfigEntry, Currency } from '@/types';
import { Box, ChevronDown, ChevronRight, CheckCircle, Circle, Calculator, Save, ShieldCheck, Tag, PieChart, Settings, Search, X, ListFilter, Star, Download, Factory, Truck, Copy, ClipboardList } from 'lucide-react';
import { useBundleConfigurator } from '@/features/bundles/hooks/useBundleConfigurator';
import { PricingService } from '@/services/PricingService';
import { BundleCalculator } from '@/services/BundleCalculator';
import { BundleExporter } from '@/services/BundleExporter';
import { ApiService } from '@/services/api';
import { useAccess } from '@/features/auth/hooks/useAccess';
import { CalidadSelect } from '@/components/ui/CalidadSelect';

interface ConfiguratorBuilderProps {
  onSaved: () => void;
  editingBundle?: Bundle | null;
}

export const ConfiguratorBuilder: React.FC<ConfiguratorBuilderProps> = ({ onSaved, editingBundle }) => {
  const { state, actions } = useStore();
  const access = useAccess('bundles');
  const { products, optionTypes, optionVariants, exchangeRates, pricingProfiles, categories, suppliers = [] } = state;
  const config = useBundleConfigurator();

  const [modelSearch, setModelSearch] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Фильтр по поставщику
  const [supplierFilterId, setSupplierFilterId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  // Фильтр по производителю
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [manufacturerSearch, setManufacturerSearch] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const manufacturerRef = useRef<HTMLDivElement>(null);

  const machine = products.find(p => p.id === config.baseMachineId);
  const canSave = access.canWrite('actions', 'save_template');
  const showEconomy = access.canSee('fields', 'economy_details');

  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [userMargin, setUserMargin] = useState<number | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const filteredModels = useMemo(() => {
    return products.filter(p => {
      const isMachine = p.type === ProductType.MACHINE;
      const matchesCategory = !config.categoryId || p.categoryId === config.categoryId;
      const matchesSupplier = !supplierFilterId || p.supplierId === supplierFilterId;
      const matchesManufacturer = !manufacturerFilter || (p.manufacturer || '') === manufacturerFilter;
      const matchesSearch = !modelSearch ||
                           p.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                           p.sku.toLowerCase().includes(modelSearch.toLowerCase());
      return isMachine && matchesCategory && matchesSupplier && matchesManufacturer && matchesSearch;
    });
  }, [products, config.categoryId, supplierFilterId, manufacturerFilter, modelSearch]);

  const availableSuppliers = useMemo(() => {
    const machineSupplierIds = new Set(products.filter(p => p.type === ProductType.MACHINE).map(p => p.supplierId).filter(Boolean));
    return suppliers.filter(s => machineSupplierIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [products, suppliers]);

  const filteredSuppliers = useMemo(() =>
    availableSuppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())),
    [availableSuppliers, supplierSearch]
  );

  const availableManufacturers = useMemo(() => {
    const names = Array.from(new Set(
      products.filter(p => p.type === ProductType.MACHINE && p.manufacturer).map(p => p.manufacturer as string)
    )).sort((a, b) => a.localeCompare(b, 'ru'));
    return names;
  }, [products]);

  const filteredManufacturers = useMemo(() =>
    availableManufacturers.filter(m => !manufacturerSearch || m.toLowerCase().includes(manufacturerSearch.toLowerCase())),
    [availableManufacturers, manufacturerSearch]
  );

  const selectedSupplierName = useMemo(() =>
    suppliers.find(s => s.id === supplierFilterId)?.name || '',
    [suppliers, supplierFilterId]
  );

  const selectedVariants = useMemo(() => {
    return (Object.values(config.selectedOptions) as string[][])
      .flat()
      .map(vid => optionVariants.find(v => v.id === vid))
      .filter(Boolean) as OptionVariant[];
  }, [config.selectedOptions, optionVariants]);

  useEffect(() => {
    if (editingBundle) {
        const baseProd = products.find(p => p.id === editingBundle.baseProductId);
        if (baseProd?.categoryId) config.setCategoryId(baseProd.categoryId);
        
        config.setBaseMachineId(editingBundle.baseProductId);
        config.setBundleName(editingBundle.name);
        config.setBundleDescription(editingBundle.description || '');
        const restoredOptions: Record<string, string[]> = {};
        editingBundle.selectedVariantIds.forEach(vid => {
            const variant = optionVariants.find(v => v.id === vid);
            if (variant) {
                if (!restoredOptions[variant.typeId]) restoredOptions[variant.typeId] = [];
                restoredOptions[variant.typeId].push(vid);
            }
        });
        config.setSelectedOptions(restoredOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBundle]);

  useEffect(() => {
    if (machine && machine.machineConfig && !editingBundle) {
      const defaults: Record<string, string[]> = {};
      const allTypeIds: string[] = [];
      machine.machineConfig.forEach(c => {
        allTypeIds.push(c.typeId);
        const defaultIds = BundleCalculator.getDefaultIds(c);
        if (defaultIds.length > 0) {
            defaults[c.typeId] = defaultIds;
        }
      });
      config.setSelectedOptions(defaults);
      config.setExpandedTypeIds(allTypeIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine?.id]);

  useEffect(() => {
    setUserMargin(null);
  }, [machine?.id]);

  const defaultMargin = useMemo(() => {
    if (!machine) return null;
    const profile = PricingService.findProfile(machine, pricingProfiles);
    return profile ? profile.targetNetMarginPercent : (machine.markupPercentage || null);
  }, [machine, pricingProfiles]);

  const marginOverride = userMargin ?? defaultMargin;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (supplierRef.current && !supplierRef.current.contains(event.target as Node)) {
        setIsSupplierOpen(false);
      }
      if (manufacturerRef.current && !manufacturerRef.current.contains(event.target as Node)) {
        setIsManufacturerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bundleTotals = useMemo(() => {
    if (!machine) return { purchaseTotal: 0, totalVolume: 0 };
    const totals = BundleCalculator.calculateTotals(machine, config.selectedOptions, optionVariants, exchangeRates as any);
    return { purchaseTotal: totals.purchaseTotal, totalVolume: totals.totalVolumeM3 };
  }, [machine, config.selectedOptions, optionVariants, exchangeRates]);


  const economy = useMemo(() => {
    if (!machine) return null;
    const profile = PricingService.findProfile(machine, pricingProfiles);
    const data = PricingService.calculateSmartPrice(machine, profile, exchangeRates, bundleTotals.totalVolume, bundleTotals.purchaseTotal, marginOverride ?? undefined);
    return { profile, data, purchaseForeign: bundleTotals.purchaseTotal, totalVolume: bundleTotals.totalVolume };
  }, [machine, pricingProfiles, exchangeRates, marginOverride, bundleTotals]);

  const handleSave = async () => {
    if (!machine || !canSave) return;

    const finalName = config.bundleName.trim();

    const bundleData: Bundle = {
      id: editingBundle?.id || ApiService.generateId(),
      name: finalName,
      baseProductId: machine.id,
      baseProductName: machine.name,
      selectedVariantIds: (Object.values(config.selectedOptions) as string[][]).flat(),
      totalPurchasePrice: economy?.purchaseForeign || 0,
      totalPrice: economy?.data?.finalPrice || 0,
      isTemplate: true,
      description: config.bundleDescription
    };
    
    if (editingBundle) await actions.updateBundle(bundleData);
    else await actions.addBundle(bundleData);
    onSaved();
  };

  const handleExport = () => {
    if (!machine) return;
    BundleExporter.exportToCsv(
      {
        name: config.bundleName || machine.name,
        baseProductId: machine.id,
        selectedVariantIds: (Object.values(config.selectedOptions) as string[][]).flat(),
        totalPrice: economy?.data?.finalPrice || 0,
        description: config.bundleDescription
      },
      products,
      optionVariants,
      optionTypes,
      (module, sub, id, msg) => actions.addLog(module, sub, id, msg)
    );
  };

  const showCopyToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 1800);
  };

  const handleCopyOur = () => {
    if (!machine) return;
    const parts = [machine.name, ...selectedVariants.map(v => v.name)];
    navigator.clipboard.writeText(parts.join(', '));
    showCopyToast('Скопировано (наши названия)');
  };

  const handleCopySupplier = () => {
    if (!machine) return;
    const baseName = machine.supplierProductName || machine.name;
    const variantNames = selectedVariants.map(v => v.supplierProductName || v.name);
    const parts = [baseName, ...variantNames];
    navigator.clipboard.writeText(parts.join(', '));
    showCopyToast('Скопировано (для поставщика)');
  };

  const f = (val: number) => Math.round(val).toLocaleString();

  return (
    <div className="flex h-full gap-5 overflow-hidden">
      {/* LEFT COLUMN: SELECTION & OPTIONS */}
      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex-none space-y-2.5">
          {/* Строка фильтров */}
          <div className="grid grid-cols-3 gap-2.5 items-end">
            {/* Категория */}
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5">
                <ListFilter size={10}/> КАТЕГОРИЯ
              </label>
              <CalidadSelect
                options={categories.filter(c => c.type === ProductType.MACHINE).map(c => ({ id: c.id, label: c.name }))}
                value={config.categoryId}
                onChange={id => { config.setCategoryId(id); config.setBaseMachineId(''); setModelSearch(''); }}
                nullLabel="Все категории"
                placeholder="Все категории"
                disabled={!!editingBundle}
                zIndex="z-[110]"
              />
            </div>

            {/* Поставщик */}
            <div className="relative" ref={supplierRef}>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5">
                <Truck size={10}/> ПОСТАВЩИК
              </label>
              <div
                className={`w-full flex items-center justify-between border rounded-lg py-1.5 px-2.5 text-xs font-bold cursor-pointer transition-all ${
                  isSupplierOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white' : 'border-slate-200 bg-slate-50'
                } ${editingBundle ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => { setIsSupplierOpen(v => !v); setSupplierSearch(''); }}
              >
                <span className={selectedSupplierName ? 'text-slate-800' : 'text-slate-400 italic'}>
                  {selectedSupplierName || 'Все поставщики'}
                </span>
                <ChevronDown size={13} className={`text-slate-300 transition-transform flex-shrink-0 ${isSupplierOpen ? 'rotate-180' : ''}`}/>
              </div>
              {isSupplierOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[110] animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
                  <div className="p-2 border-b bg-slate-50">
                    <div className="relative">
                      <Search size={11} className="absolute left-2.5 top-2 text-slate-400"/>
                      <input
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400"
                        placeholder="Начните ввод..."
                        value={supplierSearch}
                        onChange={e => setSupplierSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                    <div
                      onClick={() => { setSupplierFilterId(''); setIsSupplierOpen(false); setSupplierSearch(''); }}
                      className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${
                        !supplierFilterId ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-400 italic'
                      }`}
                    >
                      <span className="font-bold">— Все поставщики —</span>
                      {!supplierFilterId && <CheckCircle size={12} className="text-blue-500"/>}
                    </div>
                    {filteredSuppliers.map(s => (
                      <div
                        key={s.id}
                        onClick={() => { setSupplierFilterId(s.id); setIsSupplierOpen(false); setSupplierSearch(''); config.setBaseMachineId(''); setModelSearch(''); }}
                        className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${
                          supplierFilterId === s.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span className="font-bold">{s.name}</span>
                        {supplierFilterId === s.id && <CheckCircle size={12} className="text-blue-500"/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Производитель */}
            <div className="relative" ref={manufacturerRef}>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5">
                <Factory size={10}/> ПРОИЗВОДИТЕЛЬ
              </label>
              <div
                className={`w-full flex items-center justify-between border rounded-lg py-1.5 px-2.5 text-xs font-bold cursor-pointer transition-all ${
                  isManufacturerOpen ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white' : 'border-slate-200 bg-slate-50'
                } ${editingBundle ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => { setIsManufacturerOpen(v => !v); setManufacturerSearch(''); }}
              >
                <span className={manufacturerFilter ? 'text-slate-800' : 'text-slate-400 italic'}>
                  {manufacturerFilter || 'Все производители'}
                </span>
                <ChevronDown size={13} className={`text-slate-300 transition-transform flex-shrink-0 ${isManufacturerOpen ? 'rotate-180' : ''}`}/>
              </div>
              {isManufacturerOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[110] animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
                  <div className="p-2 border-b bg-slate-50">
                    <div className="relative">
                      <Search size={11} className="absolute left-2.5 top-2 text-slate-400"/>
                      <input
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:border-blue-400"
                        placeholder="Начните ввод..."
                        value={manufacturerSearch}
                        onChange={e => setManufacturerSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
                    <div
                      onClick={() => { setManufacturerFilter(''); setIsManufacturerOpen(false); setManufacturerSearch(''); }}
                      className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${
                        !manufacturerFilter ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-400 italic'
                      }`}
                    >
                      <span className="font-bold">— Все производители —</span>
                      {!manufacturerFilter && <CheckCircle size={12} className="text-blue-500"/>}
                    </div>
                    {filteredManufacturers.map(m => (
                      <div
                        key={m}
                        onClick={() => { setManufacturerFilter(m); setIsManufacturerOpen(false); setManufacturerSearch(''); config.setBaseMachineId(''); setModelSearch(''); }}
                        className={`px-3 py-2 rounded-lg cursor-pointer text-[11px] flex items-center justify-between transition-all ${
                          manufacturerFilter === m ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span className="font-bold">{m}</span>
                        {manufacturerFilter === m && <CheckCircle size={12} className="text-blue-500"/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Строка выбора модели */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5">
              <Box size={10}/> МОДЕЛЬ СТАНКА
            </label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-300 pointer-events-none"/>
              <input
                type="text"
                className={`w-full border border-slate-200 pl-8 pr-10 py-1.5 rounded-lg text-xs font-black outline-none transition-all focus:ring-2 focus:ring-blue-500/10 ${
                  !modelSearch && machine ? 'text-blue-600 bg-blue-50/30' : 'text-slate-800 bg-white'
                } placeholder:text-slate-300 disabled:opacity-75`}
                placeholder={machine ? machine.name : "Начните вводить название..."}
                value={modelSearch || (!isModelDropdownOpen && machine ? machine.name : '')}
                onFocus={() => setIsModelDropdownOpen(true)}
                onChange={e => { setModelSearch(e.target.value); setIsModelDropdownOpen(true); }}
                disabled={!!editingBundle}
              />
              {machine && !editingBundle && (
                <button onClick={() => { config.setBaseMachineId(''); setModelSearch(''); }} className="absolute right-2 top-2 p-0.5 text-slate-300 hover:text-red-500 transition-colors"><X size={14}/></button>
              )}
            </div>

            {isModelDropdownOpen && !editingBundle && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-[100] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                {filteredModels.length > 0 ? (
                  filteredModels.map(p => (
                    <div
                      key={p.id}
                      onClick={() => { config.resetSelection(p.id); setIsModelDropdownOpen(false); setModelSearch(''); }}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-xs font-bold text-slate-700 border-b last:border-0 flex justify-between items-center group"
                    >
                      <span className="group-hover:text-blue-600 transition-colors">{p.name}</span>
                      <span className="text-[9px] font-mono text-slate-300 uppercase">{p.sku}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase italic">Модели не найдены</div>
                )}
              </div>
            )}
          </div>

          {/* Блок идентичности: База + Опции + Кнопки копирования */}
          {machine && (
            <div className="relative">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 flex flex-wrap items-center gap-1.5 min-h-[36px]">
                <span className="text-[11px] font-black text-slate-700">{machine.name}</span>
                <span className="text-[9px] font-mono text-slate-400">{machine.sku}</span>
                {selectedVariants.length > 0 && <span className="w-px h-3 bg-slate-300 mx-0.5 flex-none"/>}
                {selectedVariants.map(v => (
                  <span key={v.id} className="px-1.5 py-0.5 bg-blue-50 text-[9px] font-bold text-blue-600 rounded-md border border-blue-100">{v.name}</span>
                ))}
                <div className="ml-auto flex items-center gap-0.5 flex-none">
                  <button
                    onClick={handleCopyOur}
                    title="Скопировать наши названия"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Copy size={13}/>
                  </button>
                  <button
                    onClick={handleCopySupplier}
                    title="Скопировать для поставщика"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <ClipboardList size={13}/>
                  </button>
                </div>
              </div>
              {copyToast && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in duration-150">
                  {copyToast}
                </div>
              )}
            </div>
          )}

          {/* Название сборки — необязательное */}
          <div className="relative">
            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5">
              <Tag size={10}/> НАЗВАНИЕ СБОРКИ <span className="normal-case font-medium text-slate-300">(необязательно)</span>
            </label>
            <input
              className={`w-full border py-1.5 px-3 rounded-lg text-xs font-black outline-none transition-all placeholder:text-slate-300 placeholder:italic ${
                config.bundleName ? 'border-blue-300 bg-blue-50/40 text-blue-700 focus:ring-2 focus:ring-blue-500/10' : 'border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/10'
              }`}
              placeholder="Введите название комплектации..."
              value={config.bundleName}
              onChange={e => config.setBundleName(e.target.value)}
              disabled={!machine}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-2.5">
          {!machine ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white rounded-3xl border-2 border-dashed border-slate-100 opacity-50">
               <Box size={40} className="mb-3 text-slate-200"/>
               <p className="text-[9px] font-black uppercase tracking-widest text-center">Выберите модель станка<br/>чтобы начать сборку</p>
            </div>
          ) : (
            <>
              {machine.machineConfig && optionTypes
                .filter(ot => {
                  const configEntry = machine.machineConfig?.find(mc => mc.typeId === ot.id);
                  return configEntry && configEntry.allowedVariantIds && configEntry.allowedVariantIds.length > 0;
                })
                .map(type => {
                const isExpanded = config.expandedTypeIds.includes(type.id);
                const selectedVars = config.selectedOptions[type.id] || [];
                const configEntry = machine.machineConfig?.find(mc => mc.typeId === type.id);
                const allowedVarIds = configEntry?.allowedVariantIds || [];
                const variants = optionVariants.filter(v => v.typeId === type.id && allowedVarIds.includes(v.id));

                return (
                  <div key={type.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                    <div className={`p-2.5 flex justify-between items-center cursor-pointer hover:bg-slate-50 ${isExpanded ? 'border-b bg-slate-50/30' : ''}`} onClick={() => config.toggleAccordion(type.id)}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${selectedVars.length > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Settings size={12}/></div>
                        <span className="font-black text-xs uppercase text-slate-700 tracking-tight">{type.name}</span>
                        {selectedVars.length > 0 && <span className="bg-blue-50 text-blue-600 text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase">Выбрано</span>}
                      </div>
                      {isExpanded ? <ChevronDown size={14} className="text-slate-300"/> : <ChevronRight size={14} className="text-slate-300"/>}
                    </div>
                    {isExpanded && (
                      <div className="p-2.5 grid grid-cols-2 lg:grid-cols-3 gap-2 bg-slate-50/20">
                        {variants.map(v => 
                            <OptionCard key={v.id} type={type} v={v} machine={machine} configEntry={configEntry} selectedVars={selectedVars} exchangeRates={exchangeRates} access={access} config={config} f={f} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="w-[320px] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex-none h-full">
        {machine && economy ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex-none flex flex-col items-center justify-center border-b border-white/5 relative">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Итоговая цена продажи</div>
              <div className="text-2xl font-black font-mono tracking-tight flex items-baseline gap-1">
                {f(economy.data?.finalPrice || 0)} <span className="text-[11px] font-medium text-blue-400 uppercase">KZT</span>
              </div>
              <button 
                onClick={handleExport}
                className="absolute top-3 right-3 p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title="Скачать комплектацию"
              >
                <Download size={18}/>
              </button>
              <div className={`mt-2 grid text-center divide-x divide-white/10 w-full ${showEconomy ? 'grid-cols-3' : 'grid-cols-1'}`}>
                <div className="px-2">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Объем</div>
                  <div className="text-sm font-black font-mono text-white">{economy.totalVolume.toFixed(2)} <span className="text-[9px] text-slate-300">m³</span></div>
                </div>
                {showEconomy && <>
                  <div className="px-2">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Базовая закупка</div>
                    <div className="text-sm font-black font-mono text-cyan-300">{f(machine.basePrice)} <span className="text-[9px] text-cyan-500">{machine.currency}</span></div>
                  </div>
                  <div className="px-2">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Итоговая закупка</div>
                    <div className="text-sm font-black font-mono text-amber-300">{f(economy.purchaseForeign)} <span className="text-[9px] text-amber-500">{machine.currency}</span></div>
                  </div>
                </>}
              </div>
            </div>

            <div onClick={() => setIsDescExpanded(false)} className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-3.5 cursor-default">
              {showEconomy ? (
                <>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <ShieldCheck size={12} className="text-blue-500 flex-shrink-0"/>
                        <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-tight">{economy.profile?.name || 'Ручная наценка'}</span>
                    </div>
                    <input 
                        type="number" 
                        className="w-20 bg-white border border-slate-200 rounded text-center text-[10px] font-black uppercase text-slate-700 p-1 outline-none focus:ring-2 ring-blue-500/20"
                        value={userMargin ?? ''}
                        onChange={(e) => setUserMargin(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder={`${defaultMargin ?? 0}%`}
                    />
                  </div>

                  <div className="border-l-2 border-blue-500 pl-2.5 space-y-1">
                      <DetailRow label="Цена закупки" value={economy.data.purchaseKzt} bold color="text-slate-900" />
                      <DetailRow label="Логистика (Китай)" value={economy.data.logisticsCn} />
                      <DetailRow label="Логистика (Местная)" value={economy.data.logisticsLocal} />
                  </div>

                  <div className="border-l-2 border-orange-500 pl-2.5 space-y-1">
                      <DetailRow label="Склад / Терминал" value={economy.data.svh} />
                      <DetailRow label="Таможня / Брокер" value={economy.data.customsFees + economy.data.brokerFees} />
                  </div>

                  <div className="border-l-2 border-purple-500 pl-2.5 space-y-1">
                      <DetailRow label="Пусконаладка" value={economy.data.pnr} />
                      <DetailRow label="Доставка клиенту" value={economy.data.deliveryLocal} />
                      <DetailRow label="Бонус отдела продаж" value={economy.data.bonus} color="text-purple-600" />
                  </div>

                  <div className="border-l-2 border-red-500 pl-2.5 space-y-1">
                      <DetailRow label={`НДС (${economy.profile?.vatRate || 12}%)`} value={economy.data.vat} />
                      <DetailRow label={`КПН (${economy.profile?.citRate || 20}%)`} value={economy.data.cit} />
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-slate-500 px-1">
                          <span className="text-[10px] font-black uppercase tracking-widest">Всего расходов:</span>
                          <span className="text-xs font-black font-mono">{f(economy.data.totalExpenses)} ₸</span>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex justify-between items-center">
                          <div className="flex items-center gap-1">
                              <PieChart size={12} className="text-emerald-500"/>
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Прибыль:</span>
                          </div>
                          <span className="text-sm font-black text-emerald-700 font-mono">+{f(economy.data.netProfit)} ₸</span>
                      </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className={`p-3.5 border-t bg-slate-50 flex-none space-y-2.5 transition-all duration-300 ${isDescExpanded ? 'bg-white pt-4' : ''}`}>
              <div className="space-y-1">
                <label className="block text-[7px] font-black text-slate-400 uppercase ml-1 tracking-widest">Описание сборки</label>
                <textarea 
                  onFocus={() => setIsDescExpanded(true)}
                  className={`w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-slate-600 resize-none outline-none transition-all duration-300 shadow-sm ${isDescExpanded ? 'h-32 ring-2 ring-blue-500/5 border-blue-200' : 'h-10'}`}
                  placeholder="Особенности сборки..." 
                  value={config.bundleDescription} 
                  onChange={e => config.setBundleDescription(e.target.value)}
                />
              </div>
              {canSave && (
                <button 
                  onClick={handleSave} 
                  disabled={!machine}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:grayscale text-white py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={12}/> {editingBundle ? 'ОБНОВИТЬ ШАБЛОН' : 'СОХРАНИТЬ ШАБЛОН'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30">
            <Calculator size={32} className="text-slate-300 mb-3 animate-pulse"/>
            <p className="text-[8px] font-black uppercase tracking-widest leading-relaxed">Выберите модель<br/>для расчетов</p>
          </div>
        )}
      </div>
    </div>
  );
};


interface OptionCardProps {
    type: OptionType;
    v: OptionVariant;
    machine: Product;
    configEntry: MachineConfigEntry | undefined;
    selectedVars: string[];
    exchangeRates: Record<Currency, number>;
    access: any; 
    config: any; 
    f: (val: number) => string;
}

const OptionCard: React.FC<OptionCardProps> = ({ type, v, machine, configEntry, selectedVars, exchangeRates, access, config, f }) => {
    const machineCatId = machine.categoryId ?? '';
    const effectiveSingle = type.categoryOverrides?.[machineCatId]?.isSingleSelect ?? type.isSingleSelect;
    const effectiveRequired = type.categoryOverrides?.[machineCatId]?.isRequired ?? type.isRequired;

    const priceFromSource = useMemo(() => {
        return configEntry?.priceOverrides?.[v.id] ?? v.price;
    }, [v, configEntry]);
    
    const isDefault = BundleCalculator.getDefaultIds(configEntry).includes(v.id);

    return (
        <div 
            key={v.id} 
            onClick={() => config.toggleOption(type.id, v.id, effectiveSingle, effectiveRequired)}
            className={`p-2 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[48px] ${selectedVars.includes(v.id) ? 'border-blue-500 bg-white shadow-sm shadow-blue-100' : 'border-slate-100 bg-white hover:border-blue-200'}`}>
            <div className="flex justify-between items-start gap-1.5">
                <span className={`text-xs font-bold leading-tight uppercase ${selectedVars.includes(v.id) ? 'text-blue-900' : 'text-slate-600'}`}>{v.name}</span>
                {selectedVars.includes(v.id) ? <CheckCircle size={12} className="text-blue-600"/> : <Circle size={12} className="text-slate-100"/>}
            </div>
            {access.canSee('fields', 'option_purchase_price') && (
                <div className="text-[10px] font-black font-mono text-slate-400 mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className={isDefault ? "text-blue-500" : ""}>
                            {f(priceFromSource)} {v.currency}
                        </span>
                        {isDefault && (
                            <div className="flex items-center gap-0.5 bg-blue-50 text-blue-500 px-1 rounded text-[7px] font-black uppercase tracking-tighter">
                                <Star size={6} fill="currentColor"/> БАЗА
                            </div>
                        )}
                    </div>
                    {v.volumeM3 > 0 && (
                        <span className="text-blue-400 font-bold">+{v.volumeM3.toFixed(2)} м³</span>
                    )}
                </div>
            )}
        </div>
    );
};

const DetailRow = ({ label, value, bold = false, color = "text-slate-700" }: { label: string, value: number, bold?: boolean, color?: string }) => (
    <div className="flex justify-between items-center text-[11px]">
        <span className="text-slate-500 font-medium truncate pr-2">{label}:</span>
        <span className={`font-mono ${bold ? 'font-black' : 'font-bold'} ${color} whitespace-nowrap`}>{Math.round(value).toLocaleString()} ₸</span>
    </div>
);
