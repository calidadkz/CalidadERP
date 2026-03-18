
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { ProductType, Bundle, Product, OptionVariant, OptionType } from '@/types';
import { Search, RotateCcw, Box, Star, Trash2, ChevronRight, AlignLeft, ChevronDown, ChevronUp, Pencil, LayoutGrid, List, Monitor, Truck, X, Info, Download } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';

interface TemplatesGalleryProps {
  onLoad: (b: Bundle) => void;
}

export const TemplatesGallery: React.FC<TemplatesGalleryProps> = ({ onLoad }) => {
  const { state, actions } = useStore();
  const access = useAccess('bundles');
  const { bundles, products, optionVariants, optionTypes } = state;

  const [search, setSearch] = useState('');
  const [machineId, setMachineId] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [openDescriptionId, setOpenDescriptionId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if ((target as HTMLElement).closest('.desc-toggle-btn')) return;
      setOpenDescriptionId(null);
    };
    
    if (openDescriptionId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDescriptionId]);

  const canDelete = access.canWrite('actions', 'delete_template');
  const canEdit = access.canSee('actions', 'edit_template');
  const showName = access.canSee('fields', 'col_name');
  const showBaseModel = access.canSee('fields', 'col_base_model');
  const showComposition = access.canSee('fields', 'col_composition');
  const showPrice = access.canSee('fields', 'col_price');

  const handleExportBundle = (bundle: Bundle) => {
    const headers = ['Параметр', 'Значение'];
    const rows: string[][] = [['Название шаблона', bundle.name], ['Модель станка', bundle.baseProductName], ['Системный ID станка', bundle.baseProductId]];
    const baseProduct = products.find(p => p.id === bundle.baseProductId);
    const basePackages = baseProduct?.packages || [];
    const baseVolume = basePackages.reduce((sum, p) => sum + (p.volumeM3 || 0), 0);
    if (basePackages.length > 0) { rows.push(['Габариты базы (мест: ' + basePackages.length + ')', basePackages.map(p => `${p.lengthMm || 0}x${p.widthMm || 0}x${p.heightMm || 0} (${p.volumeM3 || 0} м³)`).join('; ')]); } else { rows.push(['Габариты базы', 'Не заданы']); }
    const groupedOptions: Record<string, string[]> = {}; const optionsWithDims: string[] = []; let optionsVolume = 0;
    bundle.selectedVariantIds.forEach(vid => { const variant = optionVariants.find(v => v.id === vid); if (variant) { const typeName = optionTypes.find(ot => ot.id === variant.typeId)?.name || 'Прочее'; if (!groupedOptions[typeName]) groupedOptions[typeName] = []; groupedOptions[typeName].push(variant.name); if ((variant.volumeM3 || 0) > 0) { optionsWithDims.push(`${variant.name}: ${variant.lengthMm || 0}x${variant.widthMm || 0}x${variant.heightMm || 0} (${variant.volumeM3 || 0} м³)`); optionsVolume += (variant.volumeM3 || 0); } } });
    Object.entries(groupedOptions).forEach(([typeName, variants]) => { rows.push([`Опция: ${typeName}`, variants.join(', ')]); });
    if (optionsWithDims.length > 0) { rows.push(['Габариты опций', optionsWithDims.join('; ')]); }
    rows.push(['Суммарный объем', `${(baseVolume + optionsVolume).toFixed(3)} м³`]);
    if (baseProduct && ((baseProduct.workingLengthMm || 0) > 0 || (baseProduct.workingWidthMm || 0) > 0 || (baseProduct.workingHeightMm || 0) > 0)) { rows.push(['Рабочие габариты', `${baseProduct.workingLengthMm || 0}x${baseProduct.workingWidthMm || 0}x${baseProduct.workingHeightMm || 0} (${baseProduct.workingVolumeM3 || 0} м³)`]); }
    rows.push(['Описание', bundle.description || '—']); rows.push(['Цена продажи (KZT)', bundle.totalPrice.toString()]); rows.push(['Дата экспорта', new Date().toLocaleString('ru-RU')]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `bundle_${bundle.name.replace(/[^a-z0-9а-яё]/gi, '_')}.csv`; link.click();
    actions.addLog('Export', 'Комплектации', bundle.id, `Экспорт комплектации "${bundle.name}" в CSV`);
  };

  const toggleDescription = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedDescriptions(prev => ({ ...prev, [id]: !prev[id] })); };

  const filtered = useMemo(() => {
    return bundles.filter(b => {
      if (!b.isTemplate) return false;
      const searchLower = search.toLowerCase();
      const matchBasic = !search || b.name.toLowerCase().includes(searchLower) || b.baseProductName.toLowerCase().includes(searchLower);
      const matchDesc = !search || (b.description || '').toLowerCase().includes(searchLower);
      const optionNames = b.selectedVariantIds.map(vid => optionVariants.find(ov => ov.id === vid)?.name.toLowerCase() || '').join(' ');
      const matchOptions = !search || optionNames.includes(searchLower);
      const matchSearch = matchBasic || matchDesc || matchOptions;
      const matchMachine = !machineId || b.baseProductId === machineId;
      const min = priceMin ? parseFloat(priceMin) : 0; const max = priceMax ? parseFloat(priceMax) : Infinity;
      const matchPrice = b.totalPrice >= min && b.totalPrice <= max;
      return matchSearch && matchMachine && matchPrice;
    });
  }, [bundles, search, machineId, priceMin, priceMax, optionVariants]);

  const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const DimensionsInfo = ({ bundle }: { bundle: Bundle }) => {
    const baseProduct = products.find(p => p.id === bundle.baseProductId); if (!baseProduct) return null;
    const basePackages = baseProduct.packages || [];
    const baseVolume = basePackages.reduce((sum, p) => sum + (p.volumeM3 || 0), 0);
    const optionsWithDims = bundle.selectedVariantIds.map(vid => optionVariants.find(ov => ov.id === vid)).filter(ov => ov && (ov.volumeM3 || 0) > 0);
    const optionsVolume = optionsWithDims.reduce((sum, ov) => sum + (ov!.volumeM3 || 0), 0);
    const totalVolume = baseVolume + optionsVolume;
    const hasWorkingDims = (baseProduct.workingLengthMm || 0) > 0 || (baseProduct.workingWidthMm || 0) > 0 || (baseProduct.workingHeightMm || 0) > 0;
    return (
      <div className="text-[10px] text-slate-600 font-mono space-y-1 w-full">
        {basePackages.length > 0 && (<div className="flex items-start gap-2"><span className="text-slate-400 text-[9px] w-14 shrink-0">База ({basePackages.length}):</span><div className="flex-1 space-y-0.5">{basePackages.map((pkg, i) => (<div key={i} className="flex justify-between items-center gap-2"><span className="truncate">{pkg.lengthMm || 0}x{pkg.widthMm || 0}x{pkg.heightMm || 0}</span><span className="opacity-60 text-[9px] text-right">{pkg.volumeM3 || 0} м³</span></div>))}</div></div>)}
        {optionsWithDims.length > 0 && (<div className="flex items-start gap-2 pt-1"><span className="text-slate-400 text-[9px] w-14 shrink-0">Опции ({optionsWithDims.length}):</span><div className="flex-1 space-y-0.5">{optionsWithDims.map((ov, i) => (<div key={i} className="flex justify-between items-center gap-2"><span className="text-slate-500 text-[10px] truncate" title={ov!.name}>{ov!.name}</span><span className="opacity-60 text-[9px] text-right">{ov!.volumeM3 || 0} м³</span></div>))}</div></div>)}
        <div className="mt-1 pt-1 border-t border-slate-100 flex justify-between items-center"><span className="text-[9px] font-black text-slate-500 uppercase">Объем:</span><span className="text-xs font-black text-slate-800 font-mono">{totalVolume.toFixed(3)} м³</span></div>
        {hasWorkingDims && (<div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1 pt-1 border-t border-slate-50"><Monitor size={12} className="text-slate-300"/><span className="text-slate-600 font-mono">{baseProduct.workingLengthMm || '0'}x{baseProduct.workingWidthMm || '0'}x{baseProduct.workingHeightMm || '0'}</span></div>)}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 mb-4 flex flex-col md:flex-row gap-4 items-end animate-in fade-in">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-10 gap-3.5 items-end w-full">
          <div className="md:col-span-3"><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Поиск по названию</label><div className="relative"><Search size={14} className="absolute left-2.5 top-2 text-slate-400"/><input className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-xs transition-all" placeholder="Название, опции..." value={search} onChange={e => setSearch(e.target.value)}/></div></div>
          <div className="md:col-span-3"><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Базовая модель</label><select className="w-full py-1.5 px-2 rounded-lg border border-slate-100 bg-slate-50 font-bold text-xs outline-none transition-all cursor-pointer" value={machineId} onChange={e => setMachineId(e.target.value)}><option value="">Все модели</option>{products.filter(p => p.type === ProductType.MACHINE).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="md:col-span-3"><label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">Диапазон цены (₸)</label><div className="flex gap-2 items-center"><div className="relative flex-1"><input type="number" className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white outline-none font-bold text-xs" placeholder="От" value={priceMin} onChange={e => setPriceMin(e.target.value)}/><span className="absolute left-2.5 top-2 text-[8px] font-black text-slate-300">₸</span></div><div className="w-1.5 h-px bg-slate-300"></div><div className="relative flex-1"><input type="number" className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white outline-none font-bold text-xs" placeholder="До" value={priceMax} onChange={e => setPriceMax(e.target.value)}/><span className="absolute left-2.5 top-2 text-[8px] font-black text-slate-300">₸</span></div></div></div>
          <div className="md:col-span-1"><button onClick={() => { setSearch(''); setMachineId(''); setPriceMin(''); setPriceMax(''); }} className="w-full py-1.5 bg-slate-100 text-slate-500 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 flex items-center justify-center transition-all" title="Сбросить фильтры"><RotateCcw size={14}/></button></div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200 flex-none h-fit"><button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Список"><List size={16}/></button><button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Плитка"><LayoutGrid size={16}/></button></div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar">
        {filtered.length === 0 ? (<div className="h-48 flex flex-col items-center justify-center text-slate-300 bg-white rounded-2xl border-2 border-dashed border-slate-100 animate-in zoom-in-95"><Star size={32} className="mb-3 opacity-20"/><p className="font-black uppercase text-[10px] tracking-widest">Шаблоны не найдены</p></div>) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">{filtered.map(b => { const isExpanded = expandedDescriptions[b.id]; return (<div key={b.id} className="bg-white rounded-[1.25rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-500/30 transition-all group overflow-hidden flex flex-col min-h-[300px]"><div className="p-4 flex-1 flex flex-col"><div className="flex justify-between items-start mb-0.5"><div className="flex-1">{showName ? (<h4 className="font-black text-slate-800 text-sm mb-0.5 leading-tight group-hover:text-blue-700 transition-colors">{b.name}</h4>) : (<div className="h-4 w-32 bg-slate-100 rounded animate-pulse mb-1"></div>)}{showBaseModel && <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{b.baseProductName}</div>}</div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2 flex-shrink-0"><button onClick={(e) => { e.stopPropagation(); handleExportBundle(b); }} className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors" title="Экспорт в CSV"><Download size={14}/></button>{canDelete && (<button onClick={(e) => { e.stopPropagation(); actions.deleteBundle(b.id); }} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14}/></button>)}</div></div>{showComposition && (<div className="mt-3 flex flex-wrap gap-1 mb-2">{b.selectedVariantIds.map(vid => { const v = optionVariants.find(ov => ov.id === vid); return v ? (<span key={vid} className="px-1.5 py-0.5 bg-blue-50 text-[8px] font-bold text-blue-600 rounded-md border border-blue-100 flex items-center gap-1"><div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div>{v.name}</span>) : null; })}</div>)}<DimensionsInfo bundle={b} /><div className="flex-1 my-3 relative">{b.description ? (<div className={`bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 transition-all relative ${b.description.length > 80 ? 'pb-5' : ''}`}><div className="flex items-start gap-1.5"><AlignLeft size={10} className="text-slate-300 mt-1 flex-shrink-0"/><p className={`text-[10px] text-slate-500 leading-relaxed italic ${isExpanded ? '' : 'line-clamp-2'}`}>{b.description}</p></div>{b.description.length > 80 && (<button onClick={(e) => toggleDescription(b.id, e)} className="absolute bottom-1.5 left-1/2 -translate-x-1/2 p-0.5 text-slate-400 hover:text-blue-600 transition-all rounded-full hover:bg-white shadow-sm">{isExpanded ? (<ChevronUp size={12}/>) : (<ChevronDown size={12}/>)}</button>)}</div>) : (<div className="h-full min-h-[30px] flex items-center justify-center border border-dashed border-slate-100 rounded-xl"><span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Без описания</span></div>)}</div><div className="flex justify-between items-end pt-2.5 border-t border-slate-50"><div><div className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Цена продажи</div>{showPrice ? (<div className="text-base font-black text-slate-900">{f(b.totalPrice)} <span className="text-[10px] font-light">₸</span></div>) : (<div className="text-[10px] font-bold text-slate-300 uppercase italic">Скрыто</div>)}</div>{canEdit && (<button onClick={() => onLoad(b)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all group-hover:bg-blue-50 group-hover:text-blue-600 shadow-sm flex items-center gap-1.5"><span className="text-[8px] font-black uppercase tracking-widest hidden group-hover:inline">Изменить</span><Pencil size={14}/></button>)}</div></div></div>); })}</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible mb-6">
              <table className="min-w-full divide-y divide-slate-100 table-fixed">
                  <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-6 py-4 text-left w-[55%]">Модель / Шаблон</th><th className="px-4 py-4 text-center w-[5%]">Инфо</th><th className="px-6 py-4 text-left w-[20%]">Габариты (Транспорт / Рабочие)</th><th className="px-6 py-4 text-right w-[10%]">Цена</th><th className="px-6 py-4 text-right w-[10%]"></th></tr></thead>
                  <tbody className="divide-y divide-slate-50">{filtered.map(b => { const isDescriptionOpen = openDescriptionId === b.id; return (<tr key={b.id} className="hover:bg-slate-50/30 transition-all group"><td className="px-6 py-4 align-top break-words"><div className="text-[10px] font-black text-slate-400 uppercase mb-0.5">{b.baseProductName}</div><div className="text-sm font-black text-slate-800">{b.name}</div><div className="flex flex-wrap gap-1 mt-2">{b.selectedVariantIds.map(vid => { const v = optionVariants.find(ov => ov.id === vid); return v ? (<span key={vid} className="px-1.5 py-0.5 bg-blue-50 text-[8px] font-bold text-blue-600 rounded border border-blue-100 uppercase tracking-tighter">{v.name}</span>) : null; })}</div></td><td className="px-4 py-4 text-center relative align-top">{b.description ? (<><button onClick={(e) => { e.stopPropagation(); setOpenDescriptionId(isDescriptionOpen ? null : b.id); }} className={`desc-toggle-btn p-2 rounded-xl transition-all shadow-sm ${isDescriptionOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`} title="Посмотреть описание"><AlignLeft size={16}/></button>{isDescriptionOpen && (<div ref={popoverRef} className="absolute top-full right-0 mt-2 z-50 w-72 p-4 bg-white rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] border border-indigo-100 animate-in slide-in-from-top-2 duration-200 text-left pointer-events-auto"><div className="flex justify-between items-start mb-2"><span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Описание сборки</span><button onClick={() => setOpenDescriptionId(null)} className="text-slate-300 hover:text-slate-500"><X size={14}/></button></div><div className="bg-slate-50/50 p-3 rounded-xl border border-slate-50"><p className="text-[11px] text-slate-600 leading-[18px] italic whitespace-pre-wrap max-h-[144px] overflow-y-auto custom-scrollbar">{b.description}</p></div></div>)}</>) : (<div className="p-2 text-slate-100"><AlignLeft size={16}/></div>)}</td><td className="px-6 py-4 align-top"><DimensionsInfo bundle={b} /></td><td className="px-6 py-4 text-right align-top">{showPrice ? (<div className="text-sm font-black text-slate-900 font-mono">{f(b.totalPrice)} ₸</div>) : (<div className="text-[9px] font-bold text-slate-300 uppercase">Скрыто</div>)}</td><td className="px-6 py-4 text-right align-top"><div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity flex-wrap"><button onClick={() => handleExportBundle(b)} className="p-2 text-slate-300 hover:text-blue-600 transition-all" title="Экспорт в CSV"><Download size={16}/></button>{canEdit && (<button onClick={() => onLoad(b)} className="p-2 text-slate-300 hover:text-blue-500 transition-all" title="Редактировать"><Pencil size={16}/></button>)}{canDelete && (<button onClick={() => actions.deleteBundle(b.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all" title="Удалить"><Trash2 size={16}/></button>)}</div></td></tr>); })}</tbody>
              </table>
          </div>
        )}
      </div>
    </div>
  );
};
