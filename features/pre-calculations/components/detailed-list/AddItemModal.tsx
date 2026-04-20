import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ApiService as api } from '../../../../services/api';
import { useStore } from '../../../system/context/GlobalStore';
import { PricingService } from '../../../../services/PricingService';
import { Search, X, Check, Box, Filter, CheckCircle2 } from 'lucide-react';
import { Product, Currency, OptionVariant, OptionType, ProductType, PricingProfile, SalesOrder, SalesOrderItem, PlannedPayment } from '../../../../types';
import { OrderModeModal } from './modes/OrderModeModal';
import { MachineModeModal } from './modes/MachineModeModal';

interface AddItemModalProps {
  isOpen: boolean;
  mode: 'MACHINE' | 'PART' | 'ORDER';
  onClose: () => void;
  onAddItem: (item: any) => void;
  initialProductId?: string;
  initialOptions?: Record<string, string[]>;
  editMode?: boolean;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, mode, onClose, onAddItem, initialProductId, initialOptions, editMode }) => {
  const { state } = useStore();
  const {
    products: allProductsFromStore = [],
    optionTypes = [],
    optionVariants = [],
    exchangeRates = {} as Record<string, number>,
    suppliers = [],
    manufacturers = [],
    categories = [],
    pricingProfiles = [],
    salesOrders = [],
    plannedPayments = [],
    hscodes = []
  } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ supplierId: '', manufacturer: '', categoryId: '', compatibleMachineId: '' });
  const [visibleCount, setVisibleCount] = useState(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const lastInitializedIdRef = useRef<string | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<Record<string, { order: SalesOrder; item: SalesOrderItem }>>({});

  const selectedProduct = useMemo(() =>
    allProductsFromStore.find(p => p.id === selectedProductId),
    [allProductsFromStore, selectedProductId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(initialProductId ?? null);
      setSelectedOptions(initialOptions ?? {});
      setSelectedOrderItems({});
      setSearchTerm('');
      setVisibleCount(30);
      // Mark as initialized so the defaults-init effect doesn't overwrite pre-populated options
      lastInitializedIdRef.current = initialProductId ?? null;
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedProductId && selectedProductId !== lastInitializedIdRef.current) {
      const product = allProductsFromStore.find(p => p.id === selectedProductId);
      if (product && product.type === ProductType.MACHINE) {
        const defaults: Record<string, string[]> = {};
        product.machineConfig?.forEach(c => {
          if (c.defaultVariantIds && c.defaultVariantIds.length > 0) defaults[c.typeId] = c.defaultVariantIds;
          else if (c.defaultVariantId) defaults[c.typeId] = [c.defaultVariantId];
        });
        setSelectedOptions(defaults);
        lastInitializedIdRef.current = selectedProductId;
      }
    } else if (!selectedProductId) {
      lastInitializedIdRef.current = null;
    }
  }, [selectedProductId, allProductsFromStore]);

  const filteredProducts = useMemo(() => allProductsFromStore.filter(p => {
    const matchesType = mode === 'MACHINE' ? p.type === ProductType.MACHINE : p.type === ProductType.PART;
    if (!matchesType) return false;
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    const matchesSupplier = !filters.supplierId || p.supplierId === filters.supplierId;
    const matchesManufacturer = !filters.manufacturer || p.manufacturer === filters.manufacturer;
    const matchesCategory = !filters.categoryId || p.categoryId === filters.categoryId;
    const matchesCompatible = !filters.compatibleMachineId || (p.compatibleMachineCategoryIds && p.compatibleMachineCategoryIds.includes(filters.compatibleMachineId));
    return matchesSupplier && matchesManufacturer && matchesCategory && matchesCompatible;
  }), [allProductsFromStore, mode, searchTerm, filters]);

  const filteredOrders = useMemo(() => {
    if (mode !== 'ORDER') return [];
    return salesOrders.filter(o =>
      !searchTerm || o.id.toLowerCase().includes(searchTerm.toLowerCase()) || (o.clientName && o.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [salesOrders, mode, searchTerm]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) setVisibleCount(prev => prev + 30);
  }, []);

  const toggleOption = (typeId: string, variantId: string, isSingle: boolean, isRequired: boolean) => {
    setSelectedOptions(prev => {
      const current = prev[typeId] || [];
      const isSelected = current.includes(variantId);
      if (isSingle) {
        if (isSelected) return isRequired ? prev : { ...prev, [typeId]: [] };
        return { ...prev, [typeId]: [variantId] };
      } else {
        if (isSelected) {
          const next = current.filter(id => id !== variantId);
          return isRequired && next.length === 0 ? prev : { ...prev, [typeId]: next };
        }
        return { ...prev, [typeId]: [...current, variantId] };
      }
    });
  };

  const toggleOrderItem = (order: SalesOrder, item: SalesOrderItem) => {
    const key = `${order.id}_${item.id}`;
    setSelectedOrderItems(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = { order, item };
      return next;
    });
  };

  const getOrderPaidAmount = useCallback((orderId: string) =>
    plannedPayments.filter(p => p.sourceDocId === orderId).reduce((sum, p) => sum + (p.amountPaid || 0), 0),
    [plannedPayments]);

  const recoverVariantIds = useCallback((product: Product, configStrings: string[]): string[] => {
    if (!configStrings?.length || !product.machineConfig) return [];
    const allAllowedIds = product.machineConfig.flatMap(mc => mc.allowedVariantIds || []);
    return configStrings.map(str => {
      if (optionVariants.some(v => v.id === str)) return str;
      return optionVariants.find(v => allAllowedIds.includes(v.id) && v.name.toLowerCase().trim() === str.toLowerCase().trim())?.id;
    }).filter(Boolean) as string[];
  }, [optionVariants]);

  const getOptionNames = useCallback((product: Product | undefined, config: string[]) => {
    if (!config?.length) return '';
    return config.map(str => optionVariants.find(v => v.id === str)?.name || str).join(', ');
  }, [optionVariants]);

  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const bundleTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    return PricingService.calculateBundlePurchasePrice(selectedProduct, Object.values(selectedOptions).flat(), optionVariants, exchangeRates as any);
  }, [selectedProduct, selectedOptions, optionVariants, exchangeRates]);

  const bundleVolume = useMemo(() => {
    if (!selectedProduct) return 0;
    return PricingService.calculateBundleVolume(selectedProduct, Object.values(selectedOptions).flat(), optionVariants);
  }, [selectedProduct, selectedOptions, optionVariants]);

  const smartPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const profile = PricingService.findProfile(selectedProduct, pricingProfiles as PricingProfile[]);
    return PricingService.calculateSmartPrice(selectedProduct, profile, exchangeRates as any, bundleVolume, bundleTotal).finalPrice;
  }, [selectedProduct, bundleTotal, bundleVolume, pricingProfiles, exchangeRates]);

  const computePriceBreakdown = (product: Product, selectedVariantIds: string[]): Record<string, number> => {
    const b: Record<string, number> = {};
    const baseCurrency = product.currency || 'USD';
    b[baseCurrency] = (b[baseCurrency] || 0) + (Number(product.basePrice) || 0);
    if (!product.machineConfig) return b;
    product.machineConfig.forEach(group => {
      if (!group?.typeId) return;
      const defaultIds = Array.from(new Set([group.defaultVariantId, ...(group.defaultVariantIds || [])].filter(Boolean) as string[]));
      defaultIds.forEach(defId => {
        const v = optionVariants.find(av => av.id === defId);
        if (!v) return;
        b[v.currency] = (b[v.currency] || 0) - (Number(group.priceOverrides?.[defId] ?? v.price) || 0);
      });
      selectedVariantIds.filter(vid => optionVariants.find(av => av.id === vid)?.typeId === group.typeId).forEach(vid => {
        const v = optionVariants.find(av => av.id === vid);
        if (!v) return;
        b[v.currency] = (b[v.currency] || 0) + (Number(group.priceOverrides?.[vid] ?? v.price) || 0);
      });
    });
    return b;
  };

  const handleAdd = () => {
    if (mode === 'ORDER') {
      Object.values(selectedOrderItems).forEach(({ order, item }) => {
        const product = allProductsFromStore.find(p => p.id === item.productId);
        if (!product) return;
        const isMachine = product.type === ProductType.MACHINE;
        const configOptionIds = isMachine ? recoverVariantIds(product, item.configuration || []) : [];
        const purchasePrice = isMachine
          ? PricingService.calculateBundlePurchasePrice(product, configOptionIds, optionVariants, exchangeRates as any)
          : (product.basePrice || 0);
        const volume = isMachine
          ? PricingService.calculateBundleVolume(product, configOptionIds, optionVariants)
          : (product.workingVolumeM3 || (product.packages || []).reduce((acc, p) => acc + (p.volumeM3 || 0), 0));
        const configOptions = configOptionIds.map(vid => {
          const variant = optionVariants.find(v => v.id === vid);
          const type = optionTypes.find(t => t.id === variant?.typeId);
          return { typeId: type?.id || '', typeName: type?.name || '', variantId: variant?.id || '', variantName: variant?.name || '' };
        });
        const breakdown = isMachine ? computePriceBreakdown(product, configOptionIds) : undefined;
        const hsCodeObj = hscodes.find(h => h.id === product.hsCodeId);
        onAddItem({
          productId: product.id, orderId: order.id, clientName: order.clientName,
          name: product.name, supplierName: product.supplierProductName || product.name,
          sku: product.sku || '', type: isMachine ? 'MACHINE' : 'PART',
          quantity: item.quantity, purchasePrice, purchasePriceCurrency: product.currency || 'USD',
          purchasePriceBreakdown: breakdown, revenueKzt: item.priceKzt, isRevenueConfirmed: true,
          prepaymentKzt: getOrderPaidAmount(order.id) ? (getOrderPaidAmount(order.id) * (item.totalKzt / order.totalAmount)) : 0,
          isPrepaymentConfirmed: true, volumeM3: volume || 0,
          weightKg: (product.packages || []).reduce((acc: number, p: any) => acc + (p.weightKg || 0), 0),
          options: configOptions, taxRegime: 'Общ.', ignoreDimensions: !isMachine,
          manufacturer: product.manufacturer || '', hsCode: hsCodeObj?.code || '',
          deliveryUrumqiAlmatyKzt: 0, deliveryChinaDomesticKzt: 0, deliveryAlmatyKaragandaPerItemKzt: 0,
          svhPerItemKzt: 0, brokerPerItemKzt: 0, customsFeesPerItemKzt: 0,
          customsNdsKzt: 0, totalNdsKzt: 0, ndsDifferenceKzt: 0, kpnKzt: 0,
          salesBonusKzt: 0, preSaleCostKzt: 0, fullCostKzt: 0, profitKzt: 0
        });
      });
    } else {
      const product = selectedProduct || allProductsFromStore.find(p => p.id === selectedProductId);
      if (!product) return;
      const isMachine = product.type === ProductType.MACHINE;
      const selectedVariantIds = Object.values(selectedOptions).flat();
      const configOptions = selectedVariantIds.map(vid => {
        const variant = optionVariants.find(v => v.id === vid);
        const type = optionTypes.find(t => t.id === variant?.typeId);
        return { typeId: type?.id || '', typeName: type?.name || '', variantId: variant?.id || '', variantName: variant?.name || '' };
      });
      const volume = isMachine ? bundleVolume : (product.workingVolumeM3 || (product.packages || []).reduce((acc, p) => acc + (p.volumeM3 || 0), 0));
      const weight = (product.packages || []).reduce((acc: number, p: any) => acc + (p.weightKg || 0), 0);
      const hsCodeObj = hscodes.find(h => h.id === product.hsCodeId);
      const breakdown = isMachine ? computePriceBreakdown(product, selectedVariantIds) : undefined;
      onAddItem({
        productId: product.id, name: product.name, supplierName: product.supplierProductName || product.name,
        sku: product.sku || '', type: isMachine ? 'MACHINE' : 'PART', quantity: 1,
        purchasePrice: isMachine ? bundleTotal : (product.basePrice || 0),
        purchasePriceCurrency: product.currency || 'USD', purchasePriceBreakdown: breakdown, purchasePriceKzt: 0,
        revenueKzt: isMachine ? smartPrice : (product.salesPrice || 0), isRevenueConfirmed: false,
        prepaymentKzt: 0, isPrepaymentConfirmed: false, volumeM3: volume || 0, weightKg: weight || 0,
        packages: (product.packages || []).map((p: any) => ({ lengthMm: p.lengthMm || 0, widthMm: p.widthMm || 0, heightMm: p.heightMm || 0 })),
        ignoreDimensions: !isMachine, manufacturer: product.manufacturer || '', hsCode: hsCodeObj?.code || '',
        options: configOptions,
        deliveryUrumqiAlmatyKzt: 0, deliveryAlmatyKaragandaPerItemKzt: 0, svhPerItemKzt: 0,
        brokerPerItemKzt: 0, customsFeesPerItemKzt: 0, customsNdsKzt: 0, totalNdsKzt: 0,
        ndsDifferenceKzt: 0, kpnKzt: 0, salesBonusKzt: 0, preSaleCostKzt: 0, fullCostKzt: 0, profitKzt: 0
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  const ProductImage = ({ product, className }: { product: Product; className?: string }) => (
    <div className={`shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center ${className}`}>
      {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Box size={16} className="text-slate-300" />}
    </div>
  );

  if (mode === 'ORDER') {
    return (
      <OrderModeModal
        filteredOrders={filteredOrders}
        selectedOrderItems={selectedOrderItems}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onToggleOrderItem={toggleOrderItem}
        getOrderPaidAmount={getOrderPaidAmount}
        getOptionNames={getOptionNames}
        allProducts={allProductsFromStore}
        optionVariants={optionVariants}
        optionTypes={optionTypes}
        onClose={onClose}
        onAdd={handleAdd}
      />
    );
  }

  if (mode === 'MACHINE') {
    return (
      <MachineModeModal
        visibleProducts={visibleProducts}
        selectedProductId={selectedProductId}
        selectedProduct={selectedProduct}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        onSelectProduct={setSelectedProductId}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isFilterOpen={isFilterOpen}
        onToggleFilter={() => setIsFilterOpen(v => !v)}
        filters={{ supplierId: filters.supplierId, categoryId: filters.categoryId }}
        onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        suppliers={suppliers}
        categories={categories}
        supplierMap={supplierMap}
        optionTypes={optionTypes}
        optionVariants={optionVariants}
        selectedOptions={selectedOptions}
        onToggleOption={toggleOption}
        onClearOptionType={typeId => setSelectedOptions(prev => ({ ...prev, [typeId]: [] }))}
        bundleTotal={bundleTotal}
        bundleVolume={bundleVolume}
        smartPrice={smartPrice}
        onClose={onClose}
        onAdd={handleAdd}
        editMode={editMode}
      />
    );
  }

  // ── PART mode ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm"><Box size={14} /></div>
            <div>
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Добавить запчасть</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Выберите необходимые позиции для добавления в предрасчет</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"><X size={18} /></button>
        </div>
        <div className="bg-white border-b border-slate-100 p-3 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
              <input type="text" placeholder="Поиск..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner" />
            </div>
            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-[9px] font-black uppercase transition-all ${isFilterOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              <Filter size={12} /> Фильтры
            </button>
          </div>
          {isFilterOpen && (
            <div className="grid grid-cols-4 gap-2 animate-in slide-in-from-top-1">
              <select value={filters.supplierId} onChange={e => setFilters({ ...filters, supplierId: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Поставщик</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={filters.manufacturer} onChange={e => setFilters({ ...filters, manufacturer: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Производитель</option>{manufacturers.map((m: any) => <option key={m.id || m} value={m.name || m}>{m.name || m}</option>)}</select>
              <select value={filters.categoryId} onChange={e => setFilters({ ...filters, categoryId: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Категория</option>{categories.filter(c => c.type === ProductType.PART).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select value={filters.compatibleMachineId} onChange={e => setFilters({ ...filters, compatibleMachineId: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Станок</option>{categories.filter(c => c.type === ProductType.MACHINE).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          )}
        </div>
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
          <div className="grid grid-cols-2 gap-3 pb-8">
            {visibleProducts.map(p => (
              <button key={p.id} onClick={() => setSelectedProductId(p.id)} className={`group flex items-start gap-3 p-2.5 rounded-[1.2rem] border-2 transition-all text-left relative min-h-[70px] ${selectedProductId === p.id ? 'bg-white border-blue-500 shadow-lg' : 'bg-white border-white hover:border-slate-100 shadow-sm'}`}>
                <ProductImage product={p} className="w-12 h-12 rounded-xl border border-slate-100 shadow-sm" />
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className={`text-[10px] font-black leading-snug line-clamp-2 uppercase tracking-tight mb-1 ${selectedProductId === p.id ? 'text-blue-700' : 'text-slate-800'}`}>{p.name}</h4>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                    <span className="text-[8px] font-mono font-bold text-slate-400">{p.sku || 'No SKU'}</span>
                    <div className="ml-auto flex items-baseline gap-1">
                      <span className="text-[11px] font-black text-slate-900 font-mono">{(p.basePrice || 0).toLocaleString()}</span>
                      <span className="text-[8px] font-bold text-slate-400">{p.currency}</span>
                    </div>
                  </div>
                </div>
                {selectedProductId === p.id && <div className="absolute right-3 top-3"><CheckCircle2 size={18} fill="currentColor" className="text-blue-500" /></div>}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-3 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-[9px] font-black uppercase text-slate-400">Отмена</button>
          <button onClick={handleAdd} disabled={!selectedProductId} className="px-12 py-3 bg-blue-600 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all active:scale-95">
            Добавить <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
