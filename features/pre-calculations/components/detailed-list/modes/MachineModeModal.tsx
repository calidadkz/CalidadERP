import * as React from 'react';
import { Search, X, Check, Filter, Layers, CheckCircle2, Calculator, Box, User, Factory } from 'lucide-react';
import { Product, OptionType, OptionVariant, ProductType } from '../../../../../types';

interface Props {
  // Список продуктов
  visibleProducts: Product[];
  selectedProductId: string | null;
  selectedProduct: Product | undefined;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onSelectProduct: (id: string) => void;

  // Поиск / фильтры
  searchTerm: string;
  onSearchChange: (v: string) => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  filters: { supplierId: string; categoryId: string };
  onFilterChange: (key: 'supplierId' | 'categoryId', value: string) => void;
  suppliers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: ProductType }>;
  supplierMap: Map<string, { id: string; name: string }>;

  // Опции
  optionTypes: OptionType[];
  optionVariants: OptionVariant[];
  selectedOptions: Record<string, string[]>;
  onToggleOption: (typeId: string, variantId: string, isSingle: boolean, isRequired: boolean) => void;
  onClearOptionType: (typeId: string) => void;

  // Расчёт
  bundleTotal: number;
  bundleVolume: number;
  smartPrice: number;

  onClose: () => void;
  onAdd: () => void;
  editMode?: boolean;
}

const ProductImage: React.FC<{ product: Product; className?: string }> = ({ product, className }) => (
  <div className={`shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center ${className}`}>
    {product.imageUrl
      ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      : <Box size={16} className="text-slate-300" />}
  </div>
);

export const MachineModeModal: React.FC<Props> = ({
  visibleProducts, selectedProductId, selectedProduct, scrollRef, onScroll, onSelectProduct,
  searchTerm, onSearchChange, isFilterOpen, onToggleFilter, filters, onFilterChange,
  suppliers, categories, supplierMap,
  optionTypes, optionVariants, selectedOptions, onToggleOption, onClearOptionType,
  bundleTotal, bundleVolume, smartPrice,
  onClose, onAdd, editMode,
}) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-6 animate-in fade-in duration-200">
    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">

      {/* Шапка */}
      <div className="px-5 py-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 ${editMode ? 'bg-blue-600' : 'bg-amber-500'} text-white rounded-lg shadow-sm`}><Layers size={14} /></div>
          <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{editMode ? 'Изменить комплектацию' : 'Подбор комплектации'}</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"><X size={18} /></button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Левая панель — список станков */}
        <div className="w-[360px] border-r border-slate-100 flex flex-col bg-slate-50/20">
          <div className="p-2.5 space-y-2">
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1.5 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={searchTerm}
                  onChange={e => onSearchChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg py-1 pl-7 pr-3 text-[10px] font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
              <button
                onClick={onToggleFilter}
                className={`p-1 rounded-lg border transition-all ${isFilterOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                <Filter size={12} />
              </button>
            </div>
            {isFilterOpen && (
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
                <select
                  value={filters.supplierId}
                  onChange={e => onFilterChange('supplierId', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-[9px] font-bold"
                >
                  <option value="">Поставщик: Все</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select
                  value={filters.categoryId}
                  onChange={e => onFilterChange('categoryId', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-[9px] font-bold"
                >
                  <option value="">Категория: Все</option>
                  {categories.filter(c => c.type === ProductType.MACHINE).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {visibleProducts.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectProduct(p.id)}
                className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedProductId === p.id
                    ? 'bg-white border-blue-500 shadow-md shadow-blue-50 ring-1 ring-blue-500/10'
                    : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
              >
                <ProductImage product={p} className="w-10 h-10 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <h4 className={`text-[10px] font-black leading-tight break-words ${selectedProductId === p.id ? 'text-blue-700' : 'text-slate-700'}`}>{p.name}</h4>
                  <div className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 truncate">{p.manufacturer || 'Китай'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Правая панель — конфигуратор */}
        <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
          {!selectedProduct ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20">
              <Layers size={32} className="text-slate-200 mb-3" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Выберите модель</h4>
            </div>
          ) : (
            <>
              {/* Заголовок выбранного продукта */}
              <div className="px-5 py-2.5 bg-white border-b flex items-center justify-between flex-none">
                <div className="flex items-center gap-5 min-w-0">
                  <ProductImage product={selectedProduct} className="w-12 h-12 rounded-xl border border-slate-100 shadow-sm" />
                  <div className="min-w-0 leading-none">
                    <span className="text-[7px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1 block leading-none">Выбранная база</span>
                    <h2 className="text-sm font-black text-slate-900 leading-tight tracking-tight truncate max-w-[350px]">{selectedProduct.name}</h2>
                    <div className="flex gap-3 mt-1.5">
                      <div className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500 uppercase">
                        БАЗОВАЯ ЦЕНА: {selectedProduct.basePrice?.toLocaleString()} {selectedProduct.currency}
                      </div>
                      <div className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500 uppercase">
                        ОБЪЕМ БАЗЫ: {selectedProduct.workingVolumeM3 || 0} м³
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-slate-900 rounded-xl pl-3 pr-2 py-1.5 flex items-center gap-3 shadow-lg border border-white/5 shrink-0">
                    <div className="text-right">
                      <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block leading-none mb-0.5">Итого EXW</span>
                      <div className="text-base font-black text-white leading-none font-mono">
                        {bundleTotal.toLocaleString()} <span className="text-[9px] font-light opacity-50">{selectedProduct.currency}</span>
                      </div>
                    </div>
                    <div className="p-1.5 bg-white/10 rounded-lg"><Calculator size={14} className="text-blue-400" /></div>
                  </div>
                  <div className="bg-blue-600 rounded-xl px-3 py-1.5 flex flex-col shadow-lg border border-blue-500">
                    <span className="text-[7px] font-black text-blue-100 uppercase tracking-widest leading-none mb-0.5">Цена продажи</span>
                    <div className="text-base font-black text-white leading-none font-mono">
                      {smartPrice.toLocaleString()} <span className="text-[9px] font-light opacity-50">₸</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Группы опций */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                {optionTypes
                  .filter(ot => selectedProduct.machineConfig?.some(mc => mc.typeId === ot.id))
                  .map(type => {
                    const configEntry = selectedProduct.machineConfig?.find(mc => mc.typeId === type.id);
                    const allowedVarIds = configEntry?.allowedVariantIds || [];
                    const currentSelections = selectedOptions[type.id] || [];
                    const machineCatId = selectedProduct.categoryId ?? '';
                    const effectiveSingle = type.categoryOverrides?.[machineCatId]?.isSingleSelect ?? type.isSingleSelect;
                    const effectiveRequired = type.categoryOverrides?.[machineCatId]?.isRequired ?? type.isRequired;
                    return (
                      <div key={type.id} className="space-y-1.5">
                        <div className="flex items-center justify-between pl-0.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
                              <Layers size={10} />
                            </div>
                            <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{type.name}</h4>
                            <div className="flex gap-1">
                              {effectiveRequired && <span className="text-[6px] font-black text-red-500 uppercase bg-red-50 px-1 py-0.5 rounded border border-red-100">Обязательно</span>}
                              {effectiveSingle && <span className="text-[6px] font-black text-amber-600 uppercase bg-amber-50 px-1 py-0.5 rounded border border-amber-100">Одиночный</span>}
                            </div>
                          </div>
                          {!effectiveRequired && currentSelections.length > 0 && (
                            <button
                              onClick={() => onClearOptionType(type.id)}
                              className="text-[7px] font-black text-slate-400 hover:text-red-500 uppercase tracking-tighter transition-colors"
                            >
                              Отключить все
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {optionVariants
                            .filter(v => v.typeId === type.id && allowedVarIds.includes(v.id))
                            .map(variant => {
                              const isSelected = currentSelections.includes(variant.id);
                              const price = configEntry?.priceOverrides?.[variant.id] ?? variant.price;
                              const defId = configEntry?.defaultVariantId;
                              const defPrice = defId ? (configEntry?.priceOverrides?.[defId] ?? optionVariants.find(v => v.id === defId)?.price ?? 0) : 0;
                              const delta = price - defPrice;
                              const sup = supplierMap.get(variant.supplierId || '');
                              return (
                                <div
                                  key={variant.id}
                                  onClick={() => onToggleOption(type.id, variant.id, effectiveSingle, effectiveRequired)}
                                  className={`px-2.5 py-1.5 rounded-xl border-2 transition-all flex flex-col gap-1 cursor-pointer group min-h-[54px] ${
                                    isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-white hover:border-slate-200 bg-white'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold leading-tight line-clamp-2 ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{variant.name}</span>
                                    {isSelected && <CheckCircle2 size={12} className="text-blue-500 shrink-0 ml-1.5" />}
                                  </div>
                                  {(sup || variant.manufacturer) && (
                                    <div className="flex flex-wrap gap-1">
                                      {sup && (
                                        <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded border border-indigo-100 uppercase tracking-tight flex items-center gap-0.5 max-w-full truncate">
                                          <User size={8} /> {sup.name}
                                        </span>
                                      )}
                                      {variant.manufacturer && (
                                        <span className="text-[7px] font-black bg-purple-50 text-purple-600 px-1 py-0.5 rounded border border-purple-100 uppercase tracking-tight flex items-center gap-0.5 max-w-full truncate">
                                          <Factory size={8} /> {variant.manufacturer}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[8px] font-mono font-bold text-slate-400 leading-none">{price.toLocaleString()}</span>
                                    {delta !== 0 && (
                                      <span className={`text-[7px] font-black px-1 rounded leading-none ${delta > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                        {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Футер */}
              <div className="px-5 py-2.5 border-t bg-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-[8px] font-black text-blue-400 uppercase leading-none">Общий объем:</span>
                  <span className="text-xs font-black text-blue-700 leading-none">{bundleVolume.toFixed(3)} м³</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">Отмена</button>
                  <button
                    onClick={onAdd}
                    className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[9px] shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
                  >
                    {editMode ? 'Сохранить' : 'Добавить'} <Check size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
);
