import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ApiService as api } from '../../../../services/api';
import { useStore } from '../../../system/context/GlobalStore';
import { PricingService } from '../../../../services/PricingService';
import { 
    Loader2, Search, X, Check, Box, Cpu, Filter, Layers, Calculator, CheckCircle2, ChevronRight, ShoppingCart, Calendar, User, DollarSign, Wallet
} from 'lucide-react';
import { Product, Currency, OptionVariant, OptionType, ProductType, PricingProfile, SalesOrder, SalesOrderItem, PlannedPayment } from '../../../../types';

interface AddItemModalProps {
  isOpen: boolean;
  mode: 'MACHINE' | 'PART' | 'ORDER';
  onClose: () => void;
  onAddItem: (item: any) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, mode, onClose, onAddItem }) => {
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
  const [filters, setFilters] = useState({
    supplierId: '',
    manufacturer: '',
    categoryId: '',
    compatibleMachineId: ''
  });

  const [visibleCount, setVisibleCount] = useState(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const lastInitializedIdRef = useRef<string | null>(null);
  
  // State for multi-selection in ORDER mode
  // key: orderId_itemId
  const [selectedOrderItems, setSelectedOrderItems] = useState<Record<string, { order: SalesOrder, item: SalesOrderItem }>>({});

  const selectedProduct = useMemo(() => 
    allProductsFromStore.find(p => p.id === selectedProductId), 
  [allProductsFromStore, selectedProductId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(null);
      setSelectedOptions({});
      setSelectedOrderItems({});
      setSearchTerm('');
      setVisibleCount(30);
      lastInitializedIdRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProductId && selectedProductId !== lastInitializedIdRef.current) {
      const product = allProductsFromStore.find(p => p.id === selectedProductId);
      if (product && product.type === ProductType.MACHINE) {
        const defaults: Record<string, string[]> = {};
        product.machineConfig?.forEach(c => {
          if (c.defaultVariantIds && c.defaultVariantIds.length > 0) {
            defaults[c.typeId] = c.defaultVariantIds;
          } else if (c.defaultVariantId) {
            defaults[c.typeId] = [c.defaultVariantId];
          }
        });
        setSelectedOptions(defaults);
        lastInitializedIdRef.current = selectedProductId;
      }
    } else if (!selectedProductId) {
      lastInitializedIdRef.current = null;
    }
  }, [selectedProductId, allProductsFromStore]);

  const filteredProducts = useMemo(() => {
    return allProductsFromStore.filter(p => {
        const matchesType = mode === 'MACHINE' 
          ? (p.type === ProductType.MACHINE) 
          : (p.type === ProductType.PART);
          
        if (!matchesType) return false;

        const matchesSearch = !searchTerm || 
                             p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (!matchesSearch) return false;

        const matchesSupplier = !filters.supplierId || p.supplierId === filters.supplierId;
        const matchesManufacturer = !filters.manufacturer || p.manufacturer === filters.manufacturer;
        const matchesCategory = !filters.categoryId || p.categoryId === filters.categoryId;
        const matchesCompatible = !filters.compatibleMachineId || 
                                (p.compatibleMachineCategoryIds && p.compatibleMachineCategoryIds.includes(filters.compatibleMachineId));
        
        return matchesSupplier && matchesManufacturer && matchesCategory && matchesCompatible;
    });
  }, [allProductsFromStore, mode, searchTerm, filters]);

  const filteredOrders = useMemo(() => {
    if (mode !== 'ORDER') return [];
    return salesOrders.filter(o => {
        const matchesSearch = !searchTerm || 
                             o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (o.clientName && o.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [salesOrders, mode, searchTerm]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      setVisibleCount(prev => prev + 30);
    }
  }, []);

  const toggleOption = (typeId: string, variantId: string, isSingle: boolean, isRequired: boolean) => {
    setSelectedOptions(prev => {
        const current = prev[typeId] || [];
        const isSelected = current.includes(variantId);

        if (isSingle) {
            if (isSelected) {
                // Already selected. If not required, we can deselect it.
                if (!isRequired) {
                    return { ...prev, [typeId]: [] };
                }
                // If required, we must keep it selected
                return prev;
            } else {
                // Not selected, select it (replaces others in single mode)
                return { ...prev, [typeId]: [variantId] };
            }
        } else {
            // Multi-select mode
            if (isSelected) {
                const next = current.filter(id => id !== variantId);
                // If required and this was the last one, prevent deselection
                if (isRequired && next.length === 0) return prev;
                return { ...prev, [typeId]: next };
            } else {
                // Add new variant to the list
                return { ...prev, [typeId]: [...current, variantId] };
            }
        }
    });
  };

  const toggleOrderItem = (order: SalesOrder, item: SalesOrderItem) => {
    const key = `${order.id}_${item.id}`;
    setSelectedOrderItems(prev => {
        const newItems = { ...prev };
        if (newItems[key]) delete newItems[key];
        else newItems[key] = { order, item };
        return newItems;
    });
  };

  const getOrderPaidAmount = useCallback((orderId: string) => {
      return plannedPayments
          .filter(p => p.sourceDocId === orderId)
          .reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }, [plannedPayments]);

  // SMART RECOVERY LOGIC
  const recoverVariantIds = useCallback((product: Product, configStrings: string[]) => {
      if (!configStrings || configStrings.length === 0 || !product.machineConfig) return [];
      
      const allAllowedIds = product.machineConfig.flatMap(mc => mc.allowedVariantIds || []);
      
      return configStrings.map(str => {
          // 1. Try to find by ID first (in case it's already an ID)
          if (optionVariants.some(v => v.id === str)) return str;
          
          // 2. Try to find by NAME within allowed variants for THIS machine
          const variant = optionVariants.find(v => 
              allAllowedIds.includes(v.id) && 
              v.name.toLowerCase().trim() === str.toLowerCase().trim()
          );
          
          return variant?.id;
      }).filter(Boolean) as string[];
  }, [optionVariants]);

  const getOptionNames = useCallback((product: Product | undefined, config: string[]) => {
      if (!config || config.length === 0) return '';
      
      // If config contains IDs, find names. If it contains names, use them directly.
      return config.map(str => {
          const v = optionVariants.find(v => v.id === str);
          if (v) return v.name;
          return str; // Return the string itself if no variant found (likely it's already a name)
      }).join(', ');
  }, [optionVariants]);

  const bundleTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    const selectedVariantIds = Object.values(selectedOptions).flat();
    return PricingService.calculateBundlePurchasePrice(selectedProduct, selectedVariantIds, optionVariants, exchangeRates as any);
  }, [selectedProduct, selectedOptions, optionVariants, exchangeRates]);

  const bundleVolume = useMemo(() => {
    if (!selectedProduct) return 0;
    const selectedVariantIds = Object.values(selectedOptions).flat();
    return PricingService.calculateBundleVolume(selectedProduct, selectedVariantIds, optionVariants);
  }, [selectedProduct, selectedOptions, optionVariants]);

  const smartPrice = useMemo(() => {
      if (!selectedProduct) return 0;
      const profile = PricingService.findProfile(selectedProduct, pricingProfiles as PricingProfile[]);
      return PricingService.calculateSmartPrice(selectedProduct, profile, exchangeRates as any, bundleVolume, bundleTotal).finalPrice;
  }, [selectedProduct, bundleTotal, bundleVolume, pricingProfiles, exchangeRates]);

  // Вычисляет разбивку закупочной цены по валютам для мультивалютных конфигураций станков.
  // Возвращает { USD: X, CNY: Y, ... } — суммы в каждой валюте ДО конвертации в KZT.
  const computePriceBreakdown = (product: Product, selectedVariantIds: string[]): Record<string, number> => {
    const b: Record<string, number> = {};
    const baseCurrency = product.currency || 'USD';
    b[baseCurrency] = (b[baseCurrency] || 0) + (Number(product.basePrice) || 0);

    if (!product.machineConfig) return b;

    product.machineConfig.forEach(group => {
      if (!group?.typeId) return;

      const defaultIds = Array.from(new Set(
        [group.defaultVariantId, ...(group.defaultVariantIds || [])].filter(Boolean) as string[]
      ));

      // Вычитаем стоимость дефолтных вариантов
      defaultIds.forEach(defId => {
        const v = optionVariants.find(av => av.id === defId);
        if (!v) return;
        const price = group.priceOverrides?.[defId] ?? v.price;
        b[v.currency] = (b[v.currency] || 0) - (Number(price) || 0);
      });

      // Добавляем стоимость выбранных вариантов
      const selectedInGroup = selectedVariantIds.filter(vid =>
        optionVariants.find(av => av.id === vid)?.typeId === group.typeId
      );
      selectedInGroup.forEach(vid => {
        const v = optionVariants.find(av => av.id === vid);
        if (!v) return;
        const price = group.priceOverrides?.[vid] ?? v.price;
        b[v.currency] = (b[v.currency] || 0) + (Number(price) || 0);
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
            const rawConfig = item.configuration || [];

            // SMART RECOVERY of IDs
            const configOptionIds = isMachine ? recoverVariantIds(product, rawConfig) : [];

            // Calculate purchase price and volume based on RECOVERED configuration
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
            const actualOrderPaid = getOrderPaidAmount(order.id);
            const hsCodeObj = hscodes.find(h => h.id === product.hsCodeId);

            onAddItem({
                productId: product.id,
                orderId: order.id,
                clientName: order.clientName,
                name: product.name,
                supplierName: product.supplierProductName || product.name,
                sku: product.sku || '',
                type: isMachine ? 'MACHINE' : 'PART',
                quantity: item.quantity,
                purchasePrice: purchasePrice,
                purchasePriceCurrency: product.currency || 'USD',
                purchasePriceBreakdown: breakdown,
                revenueKzt: item.priceKzt,
                isRevenueConfirmed: true,
                prepaymentKzt: actualOrderPaid ? (actualOrderPaid * (item.totalKzt / order.totalAmount)) : 0,
                isPrepaymentConfirmed: true,
                volumeM3: volume || 0,
                weightKg: (product.packages || []).reduce((acc: number, p: any) => acc + (p.weightKg || 0), 0),
                options: configOptions,
                taxRegime: 'Общ.',
                ignoreDimensions: !isMachine,
                manufacturer: product.manufacturer || '',
                hsCode: hsCodeObj?.code || '',
                deliveryUrumqiAlmatyKzt: 0, deliveryChinaDomesticKzt: 0, deliveryAlmatyKaragandaPerItemKzt: 0, svhPerItemKzt: 0, brokerPerItemKzt: 0,
                customsFeesPerItemKzt: 0, customsNdsKzt: 0, totalNdsKzt: 0, ndsDifferenceKzt: 0, kpnKzt: 0,
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
            productId: product.id,
            name: product.name,
            supplierName: product.supplierProductName || product.name,
            sku: product.sku || '',
            type: isMachine ? 'MACHINE' : 'PART',
            quantity: 1,
            purchasePrice: isMachine ? bundleTotal : (product.basePrice || 0),
            purchasePriceCurrency: product.currency || 'USD',
            purchasePriceBreakdown: breakdown,
            purchasePriceKzt: 0,
            revenueKzt: isMachine ? smartPrice : (product.salesPrice || 0),
            isRevenueConfirmed: false,
            prepaymentKzt: 0,
            isPrepaymentConfirmed: false,
            volumeM3: volume || 0,
            weightKg: weight || 0,
            packages: (product.packages || []).map((p: any) => ({ lengthMm: p.lengthMm || 0, widthMm: p.widthMm || 0, heightMm: p.heightMm || 0 })),
            ignoreDimensions: !isMachine,
            manufacturer: product.manufacturer || '',
            hsCode: hsCodeObj?.code || '',
            options: configOptions,
            deliveryUrumqiAlmatyKzt: 0, deliveryAlmatyKaragandaPerItemKzt: 0, svhPerItemKzt: 0, brokerPerItemKzt: 0,
            customsFeesPerItemKzt: 0, customsNdsKzt: 0, totalNdsKzt: 0, ndsDifferenceKzt: 0, kpnKzt: 0,
            salesBonusKzt: 0, preSaleCostKzt: 0, fullCostKzt: 0, profitKzt: 0
        });
    }
    onClose();
  };

  if (!isOpen) return null;

  const ProductImage = ({ product, className }: { product: Product, className?: string }) => (
    <div className={`shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center ${className}`}>
        {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Box size={16} className="text-slate-300" />}
    </div>
  );

  // ORDER MODE
  if (mode === 'ORDER') {
    const selectedCount = Object.keys(selectedOrderItems).length;
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm"><ShoppingCart size={14}/></div>
                        <div>
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Добавить из заказов</h3>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Выберите позиции из существующих заказов клиентов</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"><X size={18}/></button>
                </div>

                <div className="bg-white border-b border-slate-100 p-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 text-slate-400" size={14}/>
                        <input type="text" placeholder="Поиск по ID заказа или клиенту..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 space-y-4">
                    {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 text-center"><ShoppingCart size={48} className="mb-4"/><h4 className="text-sm font-black uppercase">Заказы не найдены</h4></div>
                    ) : (
                        filteredOrders.map(order => {
                            const calculatedPaidAmount = getOrderPaidAmount(order.id);
                            return (
                                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                    {/* Order Header */}
                                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                                                <span className="text-[10px] font-black text-indigo-600">#{order.id}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-900 uppercase truncate">
                                                    <User size={10} className="text-slate-400"/> {order.clientName || 'Без имени'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 opacity-60">
                                                    <span className="flex items-center gap-1 text-[8px] font-bold uppercase"><Calendar size={8}/> {new Date(order.date).toLocaleDateString()}</span>
                                                    <span className="text-[8px] font-bold uppercase">• {order.totalItemCount || 0} поз.</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <div className="text-[9px] font-black text-slate-900 leading-none">{(order.totalAmount || 0).toLocaleString()} ₸</div>
                                                <div className={`text-[7px] font-bold uppercase mt-0.5 ${calculatedPaidAmount >= order.totalAmount ? 'text-emerald-500' : 'text-blue-500'}`}>
                                                    Оплачено: {calculatedPaidAmount.toLocaleString()} ₸
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Order Items */}
                                    <div className="divide-y divide-slate-50">
                                        {order.items?.map(item => {
                                            const isSelected = !!selectedOrderItems[`${order.id}_${item.id}`];
                                            const product = allProductsFromStore.find(p => p.id === item.productId);
                                            const optionNames = getOptionNames(product, item.configuration || []);
                                            
                                            return (
                                                <div key={item.id} onClick={() => toggleOrderItem(order, item)} 
                                                    className={`px-4 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                                                            {isSelected && <Check size={10} className="text-white" strokeWidth={4}/>}
                                                        </div>
                                                        {product && <ProductImage product={product} className="w-8 h-8 rounded-lg border border-slate-100" />}
                                                        <div className="min-w-0">
                                                            <h4 className={`text-[10px] font-bold leading-tight truncate ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{item.productName}</h4>
                                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[8px] font-mono text-slate-400">{item.sku}</span>
                                                                    {item.configuration && item.configuration.length > 0 && (
                                                                        <span className="text-[7px] bg-slate-100 text-slate-500 px-1 rounded font-bold uppercase tracking-tighter">С опциями</span>
                                                                    )}
                                                                </div>
                                                                {optionNames && (
                                                                    <p className="text-[7px] text-slate-400 italic truncate max-w-[400px]">
                                                                        {optionNames}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-[9px] font-black text-slate-900">{item.quantity} шт. × {(item.priceKzt || 0).toLocaleString()} ₸</div>
                                                        <div className="text-[9px] font-black text-indigo-600">{(item.totalKzt || 0).toLocaleString()} ₸</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="px-5 py-3 border-t bg-white flex justify-between items-center">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Выбрано: <span className="text-indigo-600">{selectedCount} поз.</span></div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-[9px] font-black uppercase text-slate-400">Отмена</button>
                        <button onClick={handleAdd} disabled={selectedCount === 0} 
                            className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[9px] shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2">
                            Добавить в расчет <Check size={16}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // MACHINE MODE (already optimized)
  if (mode === 'MACHINE') {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-6 animate-in fade-in duration-200">
        <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2"><div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm"><Cpu size={14}/></div><h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Подбор комплектации</h3></div>
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"><X size={18}/></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-[360px] border-r border-slate-100 flex flex-col bg-slate-50/20">
                    <div className="p-2.5 space-y-2">
                        <div className="flex gap-1"><div className="relative flex-1"><Search className="absolute left-2.5 top-1.5 text-slate-400" size={12}/><input type="text" placeholder="Поиск..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg py-1 pl-7 pr-3 text-[10px] font-bold outline-none focus:border-blue-500 transition-all shadow-sm" /></div><button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`p-1 rounded-lg border transition-all ${isFilterOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Filter size={12}/></button></div>
                        {isFilterOpen && (
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
                                <select value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-[9px] font-bold"><option value="">Поставщик: Все</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                <select value={filters.categoryId} onChange={e => setFilters({...filters, categoryId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-[9px] font-bold"><option value="">Категория: Все</option>{categories.filter(c => c.type === ProductType.MACHINE).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                            </div>
                        )}
                    </div>
                    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                        {visibleProducts.map(p => (
                            <button key={p.id} onClick={() => setSelectedProductId(p.id)} className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-3 ${selectedProductId === p.id ? 'bg-white border-blue-500 shadow-md shadow-blue-50 ring-1 ring-blue-500/10' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                <ProductImage product={p} className="w-10 h-10 rounded-lg" />
                                <div className="min-w-0 flex-1"><h4 className={`text-[10px] font-black leading-tight break-words ${selectedProductId === p.id ? 'text-blue-700' : 'text-slate-700'}`}>{p.name}</h4><div className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 truncate">{p.manufacturer || 'Китай'}</div></div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
                    {!selectedProduct ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20"><Layers size={32} className="text-slate-200 mb-3" /><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Выберите модель</h4></div>
                    ) : (
                        <>
                            <div className="px-5 py-2.5 bg-white border-b flex items-center justify-between flex-none">
                                <div className="flex items-center gap-5 min-w-0">
                                    <ProductImage product={selectedProduct} className="w-12 h-12 rounded-xl border border-slate-100 shadow-sm" />
                                    <div className="min-w-0 leading-none">
                                        <span className="text-[7px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1 block leading-none">Выбранная база</span>
                                        <h2 className="text-sm font-black text-slate-900 leading-tight tracking-tight truncate max-w-[350px]">{selectedProduct.name}</h2>
                                        <div className="flex gap-3 mt-1.5"><div className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500 uppercase">БАЗОВАЯ ЦЕНА: {selectedProduct.basePrice?.toLocaleString()} {selectedProduct.currency}</div><div className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500 uppercase">ОБЪЕМ БАЗЫ: {selectedProduct.workingVolumeM3 || 0} м³</div></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-900 rounded-xl pl-3 pr-2 py-1.5 flex items-center gap-3 shadow-lg border border-white/5 shrink-0"><div className="text-right"><span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block leading-none mb-0.5">Итого EXW</span><div className="text-base font-black text-white leading-none font-mono">{bundleTotal.toLocaleString()} <span className="text-[9px] font-light opacity-50">{selectedProduct.currency}</span></div></div><div className="p-1.5 bg-white/10 rounded-lg"><Calculator size={14} className="text-blue-400" /></div></div>
                                    <div className="bg-blue-600 rounded-xl px-3 py-1.5 flex flex-col shadow-lg border border-blue-500"><span className="text-[7px] font-black text-blue-100 uppercase tracking-widest leading-none mb-0.5">Цена продажи</span><div className="text-base font-black text-white leading-none font-mono">{smartPrice.toLocaleString()} <span className="text-[9px] font-light opacity-50">₸</span></div></div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                                {optionTypes.filter(ot => selectedProduct.machineConfig?.some(mc => mc.typeId === ot.id)).map(type => {
                                    const configEntry = selectedProduct.machineConfig?.find(mc => mc.typeId === type.id);
                                    const allowedVarIds = configEntry?.allowedVariantIds || [];
                                    const currentSelections = selectedOptions[type.id] || [];
                                    return (
                                        <div key={type.id} className="space-y-1.5">
                                            <div className="flex items-center justify-between pl-0.5 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm"><Layers size={10}/></div>
                                                    <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{type.name}</h4>
                                                    <div className="flex gap-1">
                                                        {type.isRequired && <span className="text-[6px] font-black text-red-500 uppercase bg-red-50 px-1 py-0.5 rounded border border-red-100">Обязательно</span>}
                                                        {type.isSingleSelect && <span className="text-[6px] font-black text-amber-600 uppercase bg-amber-50 px-1 py-0.5 rounded border border-amber-100">Одиночный</span>}
                                                    </div>
                                                </div>
                                                {!type.isRequired && currentSelections.length > 0 && (
                                                    <button 
                                                        onClick={() => setSelectedOptions(prev => ({ ...prev, [type.id]: [] }))}
                                                        className="text-[7px] font-black text-slate-400 hover:text-red-500 uppercase tracking-tighter transition-colors"
                                                    >
                                                        Отключить все
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                                {optionVariants.filter(v => v.typeId === type.id && allowedVarIds.includes(v.id)).map(variant => {
                                                    const isSelected = currentSelections.includes(variant.id);
                                                    const price = configEntry?.priceOverrides?.[variant.id] ?? variant.price;
                                                    const delta = price - (configEntry?.defaultVariantId ? (configEntry?.priceOverrides?.[configEntry.defaultVariantId] ?? optionVariants.find(v => v.id === configEntry.defaultVariantId)?.price ?? 0) : 0);
                                                    return (
                                                        <div key={variant.id} onClick={() => toggleOption(type.id, variant.id, !!type.isSingleSelect, !!type.isRequired)} className={`px-2.5 py-1.5 rounded-xl border-2 transition-all flex flex-col justify-between cursor-pointer group min-h-[54px] ${isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-white hover:border-slate-200 bg-white'}`}><div className="flex justify-between items-start"><span className={`text-[10px] font-bold leading-tight line-clamp-2 ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{variant.name}</span>{isSelected && <CheckCircle2 size={12} className="text-blue-500 shrink-0 ml-1.5"/>}</div><div className="flex items-center justify-between mt-auto"><span className="text-[8px] font-mono font-bold text-slate-400 leading-none">{price.toLocaleString()}</span>{delta !== 0 && <span className={`text-[7px] font-black px-1 rounded leading-none ${delta > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>{delta > 0 ? '+' : ''}{delta.toLocaleString()}</span>}</div></div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="px-5 py-2.5 border-t bg-white flex justify-between items-center shrink-0"><div className="flex items-center gap-2 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100"><span className="text-[8px] font-black text-blue-400 uppercase leading-none">Общий объем:</span><span className="text-xs font-black text-blue-700 leading-none">{bundleVolume.toFixed(3)} м³</span></div><div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 text-[9px] font-black uppercase text-slate-400">Отмена</button><button onClick={handleAdd} className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[9px] shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95">Добавить <Check size={14}/></button></div></div>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // SPARE PART MODE
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-6 animate-in fade-in duration-200">
        <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2"><div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm"><Box size={14}/></div><div><h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Добавить запчасть</h3><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Выберите необходимые позиции для добавления в предрасчет</p></div></div>
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"><X size={18}/></button>
            </div>
            <div className="bg-white border-b border-slate-100 p-3 space-y-2">
                <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-2.5 top-2 text-slate-400" size={14}/><input type="text" placeholder="Поиск..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner" /></div><button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-[9px] font-black uppercase transition-all ${isFilterOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><Filter size={12}/> Фильтры</button></div>
                {isFilterOpen && (
                    <div className="grid grid-cols-4 gap-2 animate-in slide-in-from-top-1">
                        <select value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Поставщик</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        <select value={filters.manufacturer} onChange={e => setFilters({...filters, manufacturer: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Производитель</option>{manufacturers.map((m: any) => <option key={m.id || m} value={m.name || m}>{m.name || m}</option>)}</select>
                        <select value={filters.categoryId} onChange={e => setFilters({...filters, categoryId: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Категория</option>{categories.filter(c => c.type === ProductType.PART).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        <select value={filters.compatibleMachineId} onChange={e => setFilters({...filters, compatibleMachineId: e.target.value})} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold"><option value="">Станок</option>{categories.filter(c => c.type === ProductType.MACHINE).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
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
                                <div className="flex flex-wrap gap-x-2 gap-y-1 items-center"><span className="text-[8px] font-mono font-bold text-slate-400">{p.sku || 'No SKU'}</span><div className="ml-auto flex items-baseline gap-1"><span className="text-[11px] font-black text-slate-900 font-mono">{(p.basePrice || 0).toLocaleString()}</span><span className="text-[8px] font-bold text-slate-400">{p.currency}</span></div></div>
                            </div>
                            {selectedProductId === p.id && <div className="absolute right-3 top-3"><CheckCircle2 size={18} fill="currentColor" className="text-blue-500"/></div>}
                        </button>
                    ))}
                </div>
            </div>
            <div className="px-5 py-3 border-t bg-white flex justify-end gap-3">
                <button onClick={onClose} className="px-5 py-2 text-[9px] font-black uppercase text-slate-400">Отмена</button>
                <button onClick={handleAdd} disabled={!selectedProductId} className="px-12 py-3 bg-blue-600 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all active:scale-95">Добавить <Check size={16}/></button>
            </div>
        </div>
    </div>
  );
};
