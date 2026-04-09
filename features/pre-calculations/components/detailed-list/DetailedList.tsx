import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PreCalculationItem } from '@/types/pre-calculations';
import { AddItemModal } from './AddItemModal';
import {
  Package, Trash2, Cpu, ShoppingCart, MoreVertical, PlusCircle, FileText, X, Check, ChevronDown, Square, CheckSquare, Info, Truck, Wrench, User, Tag, Loader2,
  Zap, Layers, Box
} from 'lucide-react';
import { useStore } from '../../../system/context/GlobalStore';
import { useAccess } from '../../../auth/hooks/useAccess';
import { SalesOrderForm } from '../../../../features/sales/components/SalesOrderForm';
import { SalesOrder, PlannedPayment, OrderStatus, Currency, SalesOrderItem } from '@/types';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';

interface SalesOrderItemWithSource extends SalesOrderItem {
  preCalcItemId?: string;
}

interface DetailedListProps {
  items: PreCalculationItem[];
  preCalculationName?: string; 
  onAddItem: (item: Omit<PreCalculationItem, 'id'>) => void;
  onUpdateItem: (id: string, key: keyof PreCalculationItem, value: any) => void;
  onUpdateItemsBatch?: (updates: Array<{ id: string, updates: Partial<PreCalculationItem> }>) => void;
  onDeleteItem: (id: string) => void;
}

const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
    <div className="relative group/tooltip flex items-center justify-center w-full h-full">
      {children}
      <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-medium rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-100 whitespace-nowrap pointer-events-none shadow-xl border border-slate-700/50">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
      </div>
    </div>
);

const COL_WIDTHS = {
  name: 400,
  manufacturer: 180,
  qty: 60,
  purchaseTotal: 120,
  order: 140,
  revenue: 120,
  paid: 100,
  profit: 100,
  margin: 70,
  volume: 80,
  china: 100,
  chinaDom: 120,
  karaganda: 80,
  svh: 80,
  broker: 80,
  fees: 80,
  regime: 120,
  vatTotal: 90,
  vatCustoms: 90,
  vatDiff: 90,
  cit: 90,
  pnr: 110,
  deliveryLocal: 110,
  bonus: 90,
  costFull: 90,
  costPreSale: 90,
  actions: 50
};
const TOTAL_TABLE_WIDTH = Object.values(COL_WIDTHS).reduce((sum, w) => sum + w, 0);

export const DetailedList: React.FC<DetailedListProps> = ({ items, preCalculationName, onAddItem, onUpdateItem, onUpdateItemsBatch, onDeleteItem }) => {
  const { state, actions } = useStore();
  const { salesOrders = [], plannedPayments = [], categories = [], suppliers = [], manufacturers = [], hscodes = [] } = state;
  const salesAccess = useAccess('sales');
  
  useEffect(() => { actions.refreshOperationalData(); }, []);

  const [modalMode, setModalMode] = useState<{ isOpen: boolean, type: 'MACHINE' | 'PART' | 'ORDER' }>({ isOpen: false, type: 'MACHINE' });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isAssemblyMode, setIsAssemblyMode] = useState(false);
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [isMassEditMode, setIsMassEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [massEditValues, setMassEditValues] = useState({
    supplierName: '', manufacturer: '', categoryId: '', hsCode: '',
    pricingMethod: '', markupPercentage: ''
  });
  const [massEditEnabled, setMassEditEnabled] = useState<Record<string, boolean>>({});
  const [orderFormConfig, setOrderFormConfig] = useState<{ isOpen: boolean; initialOrder: SalesOrder | null; initialPayments: PlannedPayment[]; targetItemIds: string[]; }>({ isOpen: false, initialOrder: null, initialPayments: [], targetItemIds: [] });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setActiveMenuId(null); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCurrency = (val?: number) => (val || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatNumber = (val?: number, decimals: number = 2) => (val || 0).toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // ЭФФЕКТ ДЛЯ СИНХРОНИЗАЦИИ: берем актуальные данные из заказов
  const syncedItems = useMemo(() => {
    return items.map(item => {
      if (!item.orderId) return item;
      
      const order = salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase());
      if (!order) return item;

      // Ищем конкретный итем в заказе, который ссылается на этот PCI
      const orderItem = order.items?.find((oi: any) => oi.preCalcItemId === item.id);
      
      return {
        ...item,
        // Если нашли в заказе - берем цену оттуда, иначе оставляем текущую
        revenueKzt: orderItem ? (Number(orderItem.priceKzt) || item.revenueKzt) : item.revenueKzt,
        clientName: order.clientName || item.clientName
      };
    });
  }, [items, salesOrders]);

  const getItemPaidAmount = (item: PreCalculationItem) => {
    if (!item.orderId) return 0;
    const order = salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase());
    if (!order || !order.totalAmount || order.totalAmount === 0) return 0;
    const orderPaidAmount = plannedPayments
      .filter(p => p.sourceDocId === order.id)
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const itemTotalRevenue = (item.revenueKzt || 0) * (item.quantity || 1);
    const ratio = itemTotalRevenue / order.totalAmount;
    return Math.round(orderPaidAmount * ratio);
  };

  const totals = {
    qty: syncedItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
    purchaseKzt: syncedItems.reduce((sum, i) => sum + (i.purchasePriceKzt * i.quantity), 0),
    revenueKzt: syncedItems.reduce((sum, i) => sum + (i.revenueKzt || 0), 0),
    paidKzt: syncedItems.reduce((sum, i) => sum + getItemPaidAmount(i), 0),
    profitKzt: syncedItems.reduce((sum, i) => sum + (i.profitKzt || 0), 0),
    bonusKzt: syncedItems.reduce((sum, i) => sum + (i.salesBonusKzt || 0), 0),
    volume: syncedItems.reduce((sum, i) => sum + (i.useDimensions ? (i.volumeM3 || 0) * (i.quantity || 1) : 0), 0),
    chinaKzt: syncedItems.reduce((sum, i) => sum + (i.deliveryUrumqiAlmatyKzt || 0), 0),
    chinaDomKzt: syncedItems.reduce((sum, i) => sum + ((i.deliveryChinaDomesticKzt || 0) * (i.quantity || 1)), 0),
    karagandaKzt: syncedItems.reduce((sum, i) => sum + (i.deliveryAlmatyKaragandaPerItemKzt * i.quantity || 0), 0),
    svhKzt: syncedItems.reduce((sum, i) => sum + (i.svhPerItemKzt * i.quantity || 0), 0),
    brokerKzt: syncedItems.reduce((sum, i) => sum + (i.brokerPerItemKzt * i.quantity || 0), 0),
    feesKzt: syncedItems.reduce((sum, i) => sum + (i.customsFeesPerItemKzt * i.quantity || 0), 0),
    vatTotalKzt: syncedItems.reduce((sum, i) => sum + (i.totalNdsKzt || 0), 0),
    vatCustomsKzt: syncedItems.reduce((sum, i) => sum + (i.customsNdsKzt || 0), 0),
    kpnKzt: syncedItems.reduce((sum, i) => sum + (i.kpnKzt || 0), 0),
    pnrKzt: syncedItems.reduce((sum, i) => sum + (i.pnrKzt || 0), 0),
    deliveryLocalKzt: syncedItems.reduce((sum, i) => sum + (i.deliveryLocalKzt || 0), 0),
    costFullKzt: syncedItems.reduce((sum, i) => sum + (i.fullCostKzt || 0), 0),
    costPreSaleKzt: syncedItems.reduce((sum, i) => sum + (i.preSaleCostKzt || 0), 0),
  };

  const handleConfirmAssembly = () => {
    const validItems = syncedItems.filter(i => selectedIds.has(i.id) && !i.orderId);
    if (validItems.length === 0) return;
    
    const uniqueSuffix = Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
    const orderId = `ZK-${uniqueSuffix}`;
    
    const orderItems: SalesOrderItemWithSource[] = validItems.map(item => ({
      id: ApiService.generateId(), salesOrderId: orderId, productId: item.productId || '', productName: item.name, sku: item.sku || '', quantity: item.quantity, priceKzt: item.revenueKzt || 0, totalKzt: (item.revenueKzt || 0) * item.quantity, configuration: item.options?.map(opt => opt.variantName) || [], preCalcItemId: item.id
    }));
    
    const initialOrder: SalesOrder = { 
        id: orderId, 
        name: '', 
        date: new Date().toISOString().split('T')[0], 
        clientId: '', 
        clientName: '', 
        items: orderItems as any, 
        status: OrderStatus.CONFIRMED, 
        totalAmount: orderItems.reduce((sum, i) => sum + i.totalKzt, 0), 
        paidAmount: 0, 
        shippedItemCount: 0, 
        totalItemCount: orderItems.reduce((sum, i) => sum + i.quantity, 0) 
    };
    setOrderFormConfig({ isOpen: true, initialOrder, initialPayments: [], targetItemIds: validItems.map(i => i.id) });
  };

  const handleOrderSubmit = async (order: SalesOrder, plans: PlannedPayment[]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await actions.createSalesOrder(order, plans);
      
      const updates = order.items.map((orderItem: any) => {
        if (!orderItem.preCalcItemId) return null;
        return { 
            id: orderItem.preCalcItemId, 
            updates: { 
                orderId: order.id, 
                clientName: order.clientName, 
                revenueKzt: orderItem.priceKzt, 
                isRevenueConfirmed: true 
            } 
        };
      }).filter(Boolean) as any;

      if (onUpdateItemsBatch) onUpdateItemsBatch(updates);
      
      await actions.refreshOperationalData();
      
      setOrderFormConfig({ ...orderFormConfig, isOpen: false }); 
      setIsAssemblyMode(false); 
      setSelectedIds(new Set());
    } catch (error: any) { 
        console.error("Order submit failed:", error);
        alert(`Ошибка при создании заказа: ${error.message || 'Неизвестная ошибка'}`); 
    } finally {
        setIsSubmitting(false);
    }
  };

  const getItemPricingMethod = (item: PreCalculationItem) => {
    if (item.orderId) return 'order';
    if (item.isRevenueConfirmed) return 'manual';
    return 'markup';
  };

  const handleUpdatePackageDim = (item: PreCalculationItem, field: 'lengthMm' | 'widthMm' | 'heightMm', value: number) => {
    if (!item.packages || item.packages.length !== 1) return;
    onUpdateItem(item.id, 'packages', [{ ...item.packages[0], [field]: value }]);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === syncedItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(syncedItems.map(i => i.id)));
  };

  const handleMassApply = async () => {
    const selectedItems = syncedItems.filter(i => selectedIds.has(i.id));
    const updates = selectedItems.map(item => {
      const upd: Partial<PreCalculationItem> = {};
      if (massEditEnabled.supplierName && massEditValues.supplierName) upd.supplierName = massEditValues.supplierName;
      if (massEditEnabled.manufacturer && massEditValues.manufacturer) upd.manufacturer = massEditValues.manufacturer;
      if (massEditEnabled.hsCode && massEditValues.hsCode) upd.hsCode = massEditValues.hsCode;
      if (massEditEnabled.pricingMethod) {
        if (massEditValues.pricingMethod === 'manual') upd.isRevenueConfirmed = true;
        if (massEditValues.pricingMethod === 'markup') {
          upd.isRevenueConfirmed = false;
          if (massEditEnabled.markupPercentage && massEditValues.markupPercentage)
            upd.marginPercentage = parseFloat(massEditValues.markupPercentage);
        }
      }
      return { id: item.id, updates: upd };
    });
    if (onUpdateItemsBatch) onUpdateItemsBatch(updates);

    if (massEditEnabled.categoryId && massEditValues.categoryId) {
      const withProduct = selectedItems.filter(i => i.productId);
      await Promise.all(withProduct.map(i =>
        ApiService.update(TableNames.PRODUCTS, i.productId!, { categoryId: massEditValues.categoryId })
      ));
    }

    setIsMassEditMode(false);
    setSelectedIds(new Set());
    setMassEditEnabled({});
  };

  const enterMassEdit = () => { setIsMassEditMode(true); setIsAssemblyMode(false); setIsQuickEditMode(false); setSelectedIds(new Set()); };
  const exitMassEdit = () => { setIsMassEditMode(false); setSelectedIds(new Set()); setMassEditEnabled({}); };
  const enterQuickEdit = () => { setIsQuickEditMode(true); setIsAssemblyMode(false); setIsMassEditMode(false); };

  return (
    <div className="flex flex-col h-full space-y-3 animate-in fade-in duration-500 font-sans text-slate-900">
      <div className="flex justify-between items-center px-1 flex-none">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            {!isAssemblyMode && !isMassEditMode ? (
              <>
                <button onClick={() => setModalMode({ isOpen: true, type: 'MACHINE' })} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-amber-200/50"><Cpu size={14} className="text-slate-400 group-hover:text-amber-500"/> + СТАНOК</button>
                <button onClick={() => setModalMode({ isOpen: true, type: 'PART' })} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-blue-200/50"><Package size={14} className="text-slate-400 group-hover:text-blue-500"/> + ЗАПЧАСТЬ</button>
                <div className="w-px h-6 bg-slate-200 mx-1" /><button onClick={() => setModalMode({ isOpen: true, type: 'ORDER' })} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-indigo-200/50"><ShoppingCart size={14} className="text-slate-400 group-hover:text-indigo-500"/> + ИЗ ЗАКАЗА</button>
                <div className="w-px h-6 bg-slate-200 mx-1" /><button onClick={() => { setIsAssemblyMode(true); setIsQuickEditMode(false); setIsMassEditMode(false); setSelectedIds(new Set()); }} className="group flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 shadow-md"><PlusCircle size={14}/> Создать заказ</button>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                <button onClick={() => isQuickEditMode ? setIsQuickEditMode(false) : enterQuickEdit()} className={`group flex items-center gap-2 px-4 py-2 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border ${isQuickEditMode ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border-transparent hover:border-amber-200/50'}`}>
                  <Zap size={14} className={isQuickEditMode ? 'text-white' : 'text-slate-400 group-hover:text-amber-500'}/> Быстрое ред.
                </button>
                <button onClick={enterMassEdit} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-blue-200/50"><Layers size={14} className="text-slate-400 group-hover:text-blue-500"/> Массовое</button>
              </>
            ) : isAssemblyMode ? (
              <div className="flex items-center gap-3 animate-in slide-in-from-left-2"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest pl-2">Режим сборки заказа: {selectedIds.size} выбрано</span><button onClick={handleConfirmAssembly} disabled={selectedIds.size === 0} className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all shadow-md disabled:opacity-50"><Check size={14}/> Подтвердить выбор</button><button onClick={() => setIsAssemblyMode(false)} className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all">Отмена</button></div>
            ) : (
              <div className="flex items-center gap-3 animate-in slide-in-from-left-2">
                <Layers size={14} className="text-blue-600 ml-2" />
                <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Массовое редактирование: {selectedIds.size} выбрано</span>
                <button onClick={handleSelectAll} className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">{selectedIds.size === syncedItems.length ? 'Снять всё' : 'Выбрать все'}</button>
                <button onClick={handleMassApply} disabled={selectedIds.size === 0 || !Object.values(massEditEnabled).some(Boolean)} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all shadow-md disabled:opacity-50"><Check size={14}/> Применить</button>
                <button onClick={exitMassEdit} className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all">Отмена</button>
              </div>
            )}
        </div>
        <div className="flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-2xl text-white shadow-lg flex-none border border-slate-700"><div className="flex items-center gap-2 border-r border-slate-800 pr-4"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Закуп:</span><span className="text-xs font-bold font-mono">{formatCurrency(totals.purchaseKzt)} <span className="text-[9px] text-slate-500">₸</span></span></div><div className="flex items-center gap-2 border-r border-slate-800 pr-4"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Выручка:</span><span className="text-xs font-bold font-mono text-blue-400">{formatCurrency(totals.revenueKzt)} <span className="text-[9px] text-blue-700">₸</span></span></div><div className="flex items-center gap-2"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Прибыль:</span><span className="text-xs font-bold font-mono text-emerald-400">{formatCurrency(totals.profitKzt)} <span className="text-[9px] text-emerald-600">₸</span></span></div></div>
      </div>
      {isMassEditMode && (
        <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-2 mb-3">
            {([
              { key: 'supplierName', label: 'Поставщик', type: 'text', width: 'w-32' },
              { key: 'manufacturer', label: 'Производитель', type: 'text', width: 'w-36' },
              { key: 'hsCode', label: 'Код ТНВЭД', type: 'text', width: 'w-28' },
            ] as const).map(f => (
              <label key={f.key} className={`flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2 transition-all ${massEditEnabled[f.key] ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
                <input type="checkbox" checked={!!massEditEnabled[f.key]} onChange={e => setMassEditEnabled(p => ({ ...p, [f.key]: e.target.checked }))} className="w-3.5 h-3.5 rounded accent-blue-600" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{f.label}:</span>
                <input type={f.type} value={(massEditValues as any)[f.key]} onChange={e => setMassEditValues(p => ({ ...p, [f.key]: e.target.value }))} disabled={!massEditEnabled[f.key]} placeholder="новое значение" className={`${f.width} bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-40 transition-all`} />
              </label>
            ))}

            <label className={`flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2 transition-all ${massEditEnabled.categoryId ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
              <input type="checkbox" checked={!!massEditEnabled.categoryId} onChange={e => setMassEditEnabled(p => ({ ...p, categoryId: e.target.checked }))} className="w-3.5 h-3.5 rounded accent-blue-600" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Категория:</span>
              <select value={massEditValues.categoryId} onChange={e => setMassEditValues(p => ({ ...p, categoryId: e.target.value }))} disabled={!massEditEnabled.categoryId} className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-40 transition-all max-w-[160px]">
                <option value="">— выберите —</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <label className={`flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2 transition-all ${massEditEnabled.pricingMethod ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
              <input type="checkbox" checked={!!massEditEnabled.pricingMethod} onChange={e => setMassEditEnabled(p => ({ ...p, pricingMethod: e.target.checked }))} className="w-3.5 h-3.5 rounded accent-blue-600" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Метод цены:</span>
              <select value={massEditValues.pricingMethod} onChange={e => setMassEditValues(p => ({ ...p, pricingMethod: e.target.value }))} disabled={!massEditEnabled.pricingMethod} className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-40 transition-all">
                <option value="">— выберите —</option>
                <option value="markup">Наценка (авто)</option>
                <option value="manual">Вручную</option>
              </select>
            </label>

            {massEditValues.pricingMethod === 'markup' && (
              <label className={`flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2 transition-all ${massEditEnabled.markupPercentage ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
                <input type="checkbox" checked={!!massEditEnabled.markupPercentage} onChange={e => setMassEditEnabled(p => ({ ...p, markupPercentage: e.target.checked }))} className="w-3.5 h-3.5 rounded accent-blue-600" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Наценка %:</span>
                <input type="number" value={massEditValues.markupPercentage} onChange={e => setMassEditValues(p => ({ ...p, markupPercentage: e.target.value }))} disabled={!massEditEnabled.markupPercentage} className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-40 transition-all text-right" />
              </label>
            )}
          </div>

          {massEditEnabled.categoryId && (
            <p className="text-[9px] text-amber-600 font-medium mb-2">* Категория обновится только у позиций с привязанным товаром ({syncedItems.filter(i => selectedIds.has(i.id) && i.productId).length} из {selectedIds.size})</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl flex flex-col flex-1 overflow-hidden relative">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <table className="border-collapse text-left table-fixed w-max" style={{ minWidth: `${TOTAL_TABLE_WIDTH}px` }}>
            <colgroup>{Object.values(COL_WIDTHS).map((w, i) => (<col key={i} style={{width: `${w}px`}}/>))}</colgroup>
            <thead className="sticky top-0 z-40 shadow-sm whitespace-nowrap text-sans">
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[9px] font-bold uppercase tracking-[0.2em]"><th colSpan={4} className="px-4 py-2 border-r border-slate-800 text-center">ТОВАР И ЗАКУП</th><th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-center bg-blue-950/40 text-blue-400/70">ПРОДАЖА</th><th colSpan={2} className="px-4 py-2 border-r border-slate-800 text-center bg-emerald-950/40 text-emerald-400/70">ИТОГИ</th><th colSpan={7} className="px-4 py-2 border-r border-slate-800 text-center bg-amber-950/40 text-amber-400/70">ЛОГИСТИКА</th><th colSpan={5} className="px-4 py-2 border-r border-slate-800 text-center bg-slate-900/60 text-slate-400/70">НАЛОГИ</th><th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-center bg-rose-950/40 text-rose-400/70">ПРОЧИЕ РАСХОДЫ</th><th colSpan={2} className="px-4 py-2 text-center text-slate-400/70">СЕБЕСТОИМОСТЬ</th><th className="bg-slate-950"></th></tr>
              <tr className="bg-slate-800 text-white/90 border-b border-slate-700 text-[9px] font-bold uppercase tracking-wider"><th className="px-4 py-3">Наименование</th><th className="px-3 py-3 text-center">Производитель</th><th className="px-3 py-3 text-center">Кол</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-slate-700/30">Закуп Всего</th><th className="px-4 py-3">Заказ / Контрагент</th><th className="px-3 py-3 text-right text-blue-200">Выручка</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-blue-800/20 text-blue-200">Оплачено</th><th className="px-3 py-3 text-right text-emerald-300 bg-emerald-800/20">Прибыль</th><th className="px-3 py-3 text-center text-emerald-300 border-r border-slate-700">Рент%</th><th className="px-3 py-3 text-center text-amber-200">Объем</th><th className="px-3 py-3 text-right text-amber-200">Урум.-Алм.</th><th className="px-3 py-3 text-right text-sky-300">По Китаю</th><th className="px-3 py-3 text-right text-amber-200">Алм.-Кар.</th>
<th className="px-3 py-3 text-right text-amber-200">СВХ</th><th className="px-3 py-3 text-right text-amber-200">Брок</th><th className="px-3 py-2 text-right border-r border-slate-700 bg-amber-800/20 text-amber-200">Сбор</th><th className="px-3 py-3 text-center">Режим</th><th className="px-3 py-3 text-right">НДС Итог</th><th className="px-3 py-3 text-right">НДС Тамож</th><th className="px-3 py-3 text-right">Разн</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-slate-700/30">КПН</th><th className="px-3 py-3 text-right text-rose-200 bg-rose-800/20">ПНР</th><th className="px-3 py-3 text-right text-rose-200 bg-rose-800/20">Дост</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-rose-800/20 text-rose-200">Бонус ОП</th><th className="px-3 py-3 text-right font-bold bg-slate-700/30">Полная</th><th className="px-3 py-3 text-right font-bold border-r border-slate-700">ДОПРОД</th><th></th></tr>
              <tr className="bg-white text-slate-900 border-b-2 border-blue-500/50 text-[10px] font-bold font-mono shadow-[0_4px_10px_-4px_rgba(0,0,0,0.1)] sticky top-[72px] z-30"><td className="px-4 py-2.5 text-[8px] uppercase tracking-tighter text-blue-600 bg-blue-50/50">ИТОГО ПО СПИСКУ:</td><td className="px-3 py-2.5 bg-blue-50/50"></td><td className="px-3 py-2.5 text-center bg-blue-50/50 text-slate-700">{totals.qty}</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-blue-50/50 text-blue-700">{formatCurrency(totals.purchaseKzt)} ₸</td><td className="px-3 py-2.5 bg-indigo-50/30"></td><td className="px-3 py-2.5 text-right text-blue-600 bg-indigo-50/30">{formatCurrency(totals.revenueKzt)} ₸</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-indigo-50/30 text-indigo-500">{formatCurrency(totals.paidKzt)} ₸</td><td className="px-3 py-2.5 text-right text-emerald-600 bg-emerald-50/50">{formatCurrency(totals.profitKzt)} ₸</td><td className="px-3 py-2.5 text-center text-emerald-600 bg-emerald-50/50 border-r border-slate-200">{totals.revenueKzt > 0 ? ((totals.profitKzt / totals.revenueKzt) * 100).toFixed(1) : '0.0'}%</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatNumber(totals.volume, 3)} м³</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.chinaKzt)}</td><td className="px-3 py-2.5 text-right text-sky-600 bg-sky-50/50">{formatCurrency(totals.chinaDomKzt)}</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.karagandaKzt)}</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.svhKzt)}</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.brokerKzt)}</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-amber-50/50 text-amber-600">{formatCurrency(totals.feesKzt)}</td><td className="px-3 py-2.5"></td><td className="px-3 py-2.5 text-right text-slate-900">{formatCurrency(totals.vatTotalKzt)}</td><td className="px-3 py-2.5 text-right text-slate-400">{formatCurrency(totals.vatCustomsKzt)}</td><td className="px-3 py-2.5 text-right text-amber-700">{formatCurrency(totals.vatTotalKzt - totals.vatCustomsKzt)}</td><td className="px-3 py-2.5 text-right border-r border-slate-200">{formatCurrency(totals.kpnKzt)}</td><td className="px-3 py-2.5 text-right text-rose-700 bg-rose-50/50">{formatCurrency(totals.pnrKzt)}</td><td className="px-3 py-2.5 text-right text-rose-700 bg-rose-50/50">{formatCurrency(totals.deliveryLocalKzt)}</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-rose-50/50 text-rose-700">{formatCurrency(totals.bonusKzt)}</td><td className="px-3 py-2.5 text-right font-black text-slate-900 bg-slate-50">{formatCurrency(totals.costFullKzt)}</td><td className="px-3 py-2.5 text-right text-slate-500 border-r border-slate-200 bg-slate-50">{formatCurrency(totals.costPreSaleKzt)}</td><td></td></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
              {syncedItems.map((item) => {
                const itemPaid = getItemPaidAmount(item);
                const itemTotalRevenue = (item.revenueKzt || 0) * (item.quantity || 1);
                const payPercent = itemTotalRevenue > 0 ? (itemPaid / itemTotalRevenue) * 100 : 0;
                
                const relatedOrder = item.orderId ? salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase()) : null;
                const orderPaidAmountTotal = relatedOrder ? plannedPayments.filter(p => p.sourceDocId === relatedOrder.id).reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0) : 0;
                
                return (
                <React.Fragment key={item.id}>
                <tr className={`hover:bg-blue-50/20 transition-all duration-75 group text-[11px] ${isAssemblyMode && item.orderId ? 'opacity-40 grayscale' : ''}`}>
                  <td className="px-4 py-2 align-middle relative">
                    <div className="flex items-center gap-2">
                        {(isAssemblyMode || isMassEditMode) ? (
                            <button disabled={isAssemblyMode && !!item.orderId} onClick={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className={`p-1 rounded-lg transition-all ${selectedIds.has(item.id) ? (isMassEditMode ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white') : 'text-slate-300 hover:text-indigo-600'} ${isAssemblyMode && item.orderId ? 'cursor-not-allowed opacity-50' : ''}`}>
                                {selectedIds.has(item.id) ? <CheckSquare size={20}/> : <Square size={20}/>}
                            </button>
                        ) : (
                            <div className="relative" ref={activeMenuId === item.id ? menuRef : null}>
                                <button onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)} className={`p-1 rounded-lg transition-all ${activeMenuId === item.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                                    <MoreVertical size={16} />
                                </button>
                                {activeMenuId === item.id && (
                                    <div className="absolute left-full top-0 ml-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] py-2 animate-in fade-in slide-in-from-left-2 duration-150 overflow-hidden">
                                        <div className="px-4 py-1.5 mb-1 border-b border-slate-50"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Действия</span></div>
                                        <button onClick={() => { onDeleteItem(item.id); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14}/> Удалить</button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col gap-1 w-full overflow-hidden">
                            <div className="flex items-baseline gap-2">
                                <span className="font-bold text-slate-900 text-[12px] leading-snug break-words" title={item.name}>{item.name}</span>
                                <span className="text-[9px] font-mono text-slate-400 shrink-0 font-medium">#{item.id.slice(-4)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-w-full">
                                {item.options?.map((opt, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-blue-100/50 text-blue-800 rounded text-[9px] font-bold border border-blue-200/30 whitespace-nowrap">{opt.variantName}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle border-l border-slate-100 overflow-hidden"><div className="flex flex-col gap-1 leading-tight w-full"><div className="text-slate-800 font-bold break-words">{item.manufacturer || '—'}</div><div className="text-[9px] text-slate-500 break-words font-mono font-medium mt-0.5">SKU: {item.sku || '—'}</div><div className="flex items-center gap-1.5 text-[10px] text-indigo-700 font-mono font-bold mt-0.5"><span className="opacity-60 uppercase text-[8px]">ТНВЭД:</span><span>{item.hsCode || '—'}</span></div></div></td>
                  <td className="px-2 py-2 align-middle"><input type="number" value={item.quantity} onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-sans text-center font-mono"/></td>
                  <td className="px-3 py-2 align-middle border-r border-slate-200 bg-slate-50/40 text-right font-mono"><div className="font-bold text-blue-700 text-[11px]">{formatCurrency(item.purchasePriceKzt * item.quantity)} <span className="text-[9px] font-medium text-blue-400">₸</span></div><div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">{formatNumber(item.purchasePrice)} {item.purchasePriceCurrency}</div></td>
                  
                  <td className="px-4 py-2 align-middle border-r border-slate-100">
                    {relatedOrder ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <Tag size={12} className="text-indigo-600 shrink-0" />
                          <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none truncate" title={relatedOrder.name || relatedOrder.id}>
                            {relatedOrder.name || relatedOrder.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3.5">
                          <User size={10} className="text-slate-500 shrink-0" />
                          <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-tighter truncate">
                            {relatedOrder.clientName || item.clientName || 'Без контрагента'}
                          </span>
                        </div>
                      </div>
                    ) : item.orderId ? (
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                                <FileText size={12} className="text-amber-600 shrink-0" />
                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{item.orderId}</span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-3.5">
                                <User size={10} className="text-slate-400 shrink-0" />
                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tighter truncate">
                                    {item.clientName || 'Без контрагента'}
                                </span>
                            </div>
                        </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-1 py-0.5 bg-slate-50 rounded-md border border-slate-100 w-fit">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Свободный склад</span>
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-2 align-middle"><input type="number" value={item.revenueKzt} onChange={(e) => onUpdateItem(item.id, 'revenueKzt', parseFloat(e.target.value))} disabled={item.isRevenueConfirmed} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-sans text-right font-mono"/></td>
                  <td className={`px-3 py-2 align-middle text-right border-r border-slate-200 bg-blue-50/20 font-mono font-bold text-[11px] ${itemPaid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Tooltip text={relatedOrder ? `Заказ ${relatedOrder.id}: Оплачено ${formatCurrency(orderPaidAmountTotal)} из ${formatCurrency(relatedOrder.totalAmount)}. Доля этой позиции: ${payPercent.toFixed(1)}%` : 'Нет привязанного заказа'}>
                      <div className="flex flex-col items-end leading-none">
                        <span>{formatCurrency(itemPaid)}</span>
                        {itemPaid > 0 && <span className="text-[8px] opacity-60 mt-0.5">{payPercent.toFixed(0)}%</span>}
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 align-middle text-right bg-emerald-50/10 text-emerald-700 font-bold font-mono text-[11px]">{formatCurrency(item.profitKzt)}</td>
                  <td className="px-3 py-2 align-middle text-center bg-emerald-50/10 font-mono border-r border-slate-200"><span className="text-[11px] font-bold text-emerald-700">{item.marginPercentage?.toFixed(1)}%</span></td>
                  <td className="px-3 py-2 align-middle text-right font-mono"><div className="flex items-center justify-end gap-1.5"><span className="text-slate-700 font-bold text-[11px]">{formatNumber(item.volumeM3 * item.quantity, 3)}</span><input type="checkbox" checked={item.useDimensions} onChange={(e) => onUpdateItem(item.id, 'useDimensions', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-0 shadow-sm transition-all"/></div></td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-slate-700 font-bold">{formatCurrency(item.deliveryUrumqiAlmatyKzt * item.quantity)}</td>
                  <td className="px-2 py-2 align-middle">
                    <div className="flex flex-col gap-0.5">
                      {item.customChinaDomestic ? (
                        <input
                          type="number"
                          value={item.deliveryChinaDomesticKzt || 0}
                          onChange={e => onUpdateItem(item.id, 'deliveryChinaDomesticKzt', parseFloat(e.target.value) || 0)}
                          className="w-full bg-sky-50 border border-sky-300 rounded-lg px-2 py-1 text-[11px] font-bold text-sky-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-mono text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-right font-mono text-sky-700 font-bold text-[11px] pr-1 block">{formatCurrency((item.deliveryChinaDomesticKzt || 0) * item.quantity)}</span>
                      )}
                      <label className="flex items-center gap-1 cursor-pointer self-end" title="Свой расчёт доставки по Китаю">
                        <input
                          type="checkbox"
                          checked={!!item.customChinaDomestic}
                          onChange={e => onUpdateItem(item.id, 'customChinaDomestic', e.target.checked)}
                          className="w-3 h-3 rounded border-sky-300 text-sky-600 cursor-pointer focus:ring-0 accent-sky-600"
                        />
                        <span className="text-[8px] font-bold text-sky-400 uppercase tracking-wide">свой</span>
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-slate-700 font-bold">{formatCurrency(item.deliveryAlmatyKaragandaPerItemKzt * item.quantity)}</td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-slate-700 font-bold">{formatCurrency(item.svhPerItemKzt * item.quantity)}</td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-slate-700 font-bold">{formatCurrency(item.brokerPerItemKzt * item.quantity)}</td>
                  <td className="px-3 py-2 align-middle text-right border-r border-slate-200 bg-amber-50/10 font-mono text-slate-700 font-bold">{formatCurrency(item.customsFeesPerItemKzt * item.quantity)}</td>
                  <td className="px-2 py-2 align-middle"><select value={item.taxRegime} onChange={(e) => onUpdateItem(item.id, 'taxRegime', e.target.value as 'Общ.' | 'Упр.')} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1 text-[10px] font-bold uppercase tracking-tighter outline-none focus:border-blue-500 cursor-pointer transition-all font-sans"><option value="Общ.">Общ. (ОУР)</option><option value="Упр.">Упр. (КПН4)</option></select></td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-slate-800 font-bold text-[11px]">{formatCurrency(item.totalNdsKzt)}</td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-slate-500 font-bold text-[10px]">{formatCurrency(item.customsNdsKzt)}</td>
                  <td className="px-3 py-2 align-middle text-right font-mono text-amber-800 font-bold text-[10px]">{formatCurrency(item.ndsDifferenceKzt)}</td>
                  <td className="px-3 py-2 align-middle text-right border-r border-slate-200 bg-slate-100/30 font-mono font-bold">{formatCurrency(item.kpnKzt)}</td>
                  <td className="px-2 py-2 align-middle bg-rose-50/10"><input type="number" value={item.pnrKzt} onChange={(e) => onUpdateItem(item.id, 'pnrKzt', parseFloat(e.target.value))} className="w-full bg-rose-50/30 border border-rose-100 rounded-lg px-2 py-1 text-[11px] font-bold text-rose-700 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all font-mono text-right"/></td>
                  <td className="px-2 py-2 align-middle bg-rose-50/10"><input type="number" value={item.deliveryLocalKzt} onChange={(e) => onUpdateItem(item.id, 'deliveryLocalKzt', parseFloat(e.target.value))} className="w-full bg-rose-50/30 border border-rose-100 rounded-lg px-2 py-1 text-[11px] font-bold text-rose-700 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all font-mono text-right"/></td>
                  <td className="px-3 py-2 align-middle text-right border-r border-slate-200 bg-rose-50/10 font-mono text-rose-600 font-bold">{formatCurrency(item.salesBonusKzt)}</td>
                  <td className="px-3 py-2 align-middle text-right font-mono font-bold text-slate-900 bg-slate-50/50 text-[11px]">{formatCurrency(item.fullCostKzt)}</td>
                  <td className="px-3 py-2 align-middle text-right font-mono font-bold text-slate-600 text-[10px] border-r border-slate-200">{formatCurrency(item.preSaleCostKzt)}</td>
                  <td className="px-3 py-2 align-middle text-center">{!isAssemblyMode && !isMassEditMode && (<button onClick={() => onDeleteItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"><Trash2 size={16} /></button>)}</td>
                </tr>
                {isQuickEditMode && (
                  <tr key={`qe-${item.id}`} className="bg-amber-50/20">
                    <td colSpan={26} className="px-5 py-2.5 border-b border-amber-100/60">
                      <div className="flex items-start gap-3 flex-wrap">
                        {/* Поставщик */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Поставщик</span>
                          <input type="text" value={item.supplierName || ''} onChange={e => onUpdateItem(item.id, 'supplierName', e.target.value)} placeholder="введите поставщика" className="w-36 bg-white border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all" />
                        </div>

                        {/* ТНВЭД */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Код ТНВЭД</span>
                          <input type="text" value={item.hsCode || ''} onChange={e => onUpdateItem(item.id, 'hsCode', e.target.value)} placeholder="ХХХХ ХХХХ" className="w-28 bg-white border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold font-mono text-indigo-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all" />
                        </div>

                        {/* Метод ценообразования */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Метод цены</span>
                          <select value={getItemPricingMethod(item)} onChange={e => { if (e.target.value === 'manual') onUpdateItem(item.id, 'isRevenueConfirmed', true); else if (e.target.value === 'markup') onUpdateItem(item.id, 'isRevenueConfirmed', false); }} disabled={!!item.orderId} className="bg-white border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                            <option value="markup">Наценка (авто)</option>
                            <option value="manual">Вручную</option>
                            {item.orderId && <option value="order">Из заказа</option>}
                          </select>
                        </div>

                        {/* Наценка + расч. цена */}
                        {getItemPricingMethod(item) === 'markup' && (
                          <>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Наценка %</span>
                              <input type="number" value={item.marginPercentage || 0} onChange={e => onUpdateItem(item.id, 'marginPercentage', parseFloat(e.target.value) || 0)} className="w-20 bg-white border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all text-right font-mono" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Расч. цена</span>
                              <div className="h-[30px] flex items-center px-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                <span className="text-[11px] font-black text-emerald-700 font-mono">{formatCurrency(item.revenueKzt)} ₸</span>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Габариты транспортные */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Габариты (Д×Ш×В, мм)</span>
                          {(!item.packages || item.packages.length === 0) ? (
                            <span className="h-[30px] flex items-center text-[10px] text-slate-400 italic">нет данных — добавьте в карточке</span>
                          ) : item.packages.length === 1 ? (
                            <div className="flex items-center gap-1.5">
                              <input type="number" value={item.packages[0]?.lengthMm || 0} onChange={e => handleUpdatePackageDim(item, 'lengthMm', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-amber-200 rounded-lg px-1.5 py-1 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-amber-400 text-center" />
                              <span className="text-[9px] text-slate-400 font-bold">×</span>
                              <input type="number" value={item.packages[0]?.widthMm || 0} onChange={e => handleUpdatePackageDim(item, 'widthMm', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-amber-200 rounded-lg px-1.5 py-1 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-amber-400 text-center" />
                              <span className="text-[9px] text-slate-400 font-bold">×</span>
                              <input type="number" value={item.packages[0]?.heightMm || 0} onChange={e => handleUpdatePackageDim(item, 'heightMm', parseFloat(e.target.value) || 0)} className="w-16 bg-white border border-amber-200 rounded-lg px-1.5 py-1 text-[10px] font-mono text-slate-700 focus:outline-none focus:border-amber-400 text-center" />
                            </div>
                          ) : (
                            <div className="h-[30px] flex items-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-black text-blue-700">
                                <Box size={11} /> {item.packages.length} мест — откройте карточку
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <AddItemModal isOpen={modalMode.isOpen} mode={modalMode.type} onClose={() => setModalMode({ ...modalMode, isOpen: false })} onAddItem={onAddItem}/>
      {orderFormConfig.isOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-300"><div className="w-full max-w-7xl h-full flex flex-col relative animate-in zoom-in-95 duration-200"><div className="absolute -top-12 right-0 flex items-center gap-3"><div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl border border-white/20 shadow-xl"><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Оформление заказа на основании предрасчета</p></div><button onClick={() => setOrderFormConfig({ ...orderFormConfig, isOpen: false })} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all border border-white/20 shadow-xl active:scale-95"><X size={24} /></button></div><div className="flex-1 overflow-hidden">{isSubmitting ? (
            <div className="w-full h-full bg-white/80 flex flex-col items-center justify-center rounded-[2rem]">
                <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                <p className="text-lg font-black text-slate-800 uppercase tracking-widest">Создаем заказ...</p>
            </div>
        ) : (
            <SalesOrderForm initialOrder={orderFormConfig.initialOrder} initialPayments={orderFormConfig.initialPayments} state={state} actions={actions} access={salesAccess} onCancel={() => setOrderFormConfig({ ...orderFormConfig, isOpen: false })} onSubmit={handleOrderSubmit} />
        )}</div></div></div>
      )}
    </div>
  );
};
