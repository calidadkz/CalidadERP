import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { PreCalculationItem } from '@/types/pre-calculations';
import { AddItemModal } from './AddItemModal';
import {
  Package, Trash2, Cpu, ShoppingCart, MoreVertical, PlusCircle, FileText, X, Check, ChevronDown, Square, CheckSquare, Info, Truck, Wrench, User, Tag, Loader2, Box, Download
} from 'lucide-react';
import { useStore } from '../../../system/context/GlobalStore';
import { useAccess } from '../../../auth/hooks/useAccess';
import { SalesOrderForm } from '../../../../features/sales/components/SalesOrderForm';
import { SalesOrder, PlannedPayment, OrderStatus, Currency, SalesOrderItem } from '@/types';
import { ApiService } from '@/services/api';

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
  /** Когда true — только просмотр: скрывает кнопки добавления/удаления и inline-редактирование */
  readOnly?: boolean;
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

export const DetailedList: React.FC<DetailedListProps> = ({ items, preCalculationName, onAddItem, onUpdateItem, onUpdateItemsBatch, onDeleteItem, readOnly = false }) => {
  const { state, actions } = useStore();
  const { salesOrders = [], plannedPayments = [], categories = [], suppliers = [], manufacturers = [], hscodes = [] } = state;
  const salesAccess = useAccess('sales');
  
  useEffect(() => { actions.refreshOperationalData(); }, []);

  const [modalMode, setModalMode] = useState<{ isOpen: boolean, type: 'MACHINE' | 'PART' | 'ORDER' }>({ isOpen: false, type: 'MACHINE' });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editConfigItem, setEditConfigItem] = useState<PreCalculationItem | null>(null);
  const [editConfigInitialOptions, setEditConfigInitialOptions] = useState<Record<string, string[]>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const [isAssemblyMode, setIsAssemblyMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderFormConfig, setOrderFormConfig] = useState<{ isOpen: boolean; initialOrder: SalesOrder | null; initialPayments: PlannedPayment[]; targetItemIds: string[]; isNew: boolean; }>({ isOpen: false, initialOrder: null, initialPayments: [], targetItemIds: [], isNew: true });

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

  // Разделение: станки сверху, запчасти снизу
  const { machines, parts, hasBothTypes } = useMemo(() => {
    const machines = syncedItems.filter(i => i.type === 'MACHINE');
    const parts = syncedItems.filter(i => i.type !== 'MACHINE');
    return { machines, parts, hasBothTypes: machines.length > 0 && parts.length > 0 };
  }, [syncedItems]);
  const groupedItems = useMemo(() => [...machines, ...parts], [machines, parts]);

  const handleOpenExistingOrder = (order: SalesOrder) => {
    const orderPayments = plannedPayments.filter(p => p.sourceDocId === order.id);
    setOrderFormConfig({ isOpen: true, initialOrder: order, initialPayments: orderPayments, targetItemIds: [], isNew: false });
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
    setOrderFormConfig({ isOpen: true, initialOrder, initialPayments: [], targetItemIds: validItems.map(i => i.id), isNew: true });
  };

  const handleOrderSubmit = async (order: SalesOrder, plans: PlannedPayment[]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (orderFormConfig.isNew) {
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
        setIsAssemblyMode(false);
        setSelectedIds(new Set());
      } else {
        await actions.updateSalesOrder(order, plans);
      }

      await actions.refreshOperationalData();
      setOrderFormConfig({ ...orderFormConfig, isOpen: false });
    } catch (error: any) {
        console.error("Order submit failed:", error);
        alert(`Ошибка при сохранении заказа: ${error.message || 'Неизвестная ошибка'}`);
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

  const handleExportDraftInvoice = () => {
    const { optionVariants = [] } = state;
    const variantMap = new Map(optionVariants.map(v => [v.id, v]));

    const getOurOptions = (item: PreCalculationItem): string =>
      item.options?.map(opt => opt.variantName).join(', ') ?? '';

    const getSupplierOptions = (item: PreCalculationItem): string =>
      item.options?.map(opt => {
        const variant = variantMap.get(opt.variantId);
        return variant?.supplierProductName?.trim() || opt.variantName;
      }).join(', ') ?? '';

    const headers = ['Название для поставщика', 'Опции для поставщика', 'Валюта', 'Цена за шт.', 'Кол-во', 'Сумма'];

    const rows = syncedItems.map(item => {
      const currency = item.purchasePriceCurrency || 'USD';
      const pricePerUnit = item.purchasePrice || 0;
      const qty = item.quantity || 1;
      return [
        item.supplierName || item.name,
        getSupplierOptions(item),
        currency,
        pricePerUnit,
        qty,
        pricePerUnit * qty,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 40 }, // Название для поставщика
      { wch: 50 }, // Опции для поставщика
      { wch: 8 },  // Валюта
      { wch: 14 }, // Цена за шт.
      { wch: 8 },  // Кол-во
      { wch: 16 }, // Сумма
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Черновой инвойс');
    const fileName = preCalculationName
      ? `Инвойс_${preCalculationName.replace(/[\\/:*?"<>|]/g, '_')}.xlsx`
      : 'Черновой_инвойс.xlsx';
    XLSX.writeFile(wb, fileName);
  };

  const openEditConfig = (item: PreCalculationItem) => {
    const opts: Record<string, string[]> = {};
    item.options?.forEach(opt => {
      if (opt.typeId && opt.variantId) {
        opts[opt.typeId] = [...(opts[opt.typeId] || []), opt.variantId];
      }
    });
    setEditConfigInitialOptions(opts);
    setEditConfigItem(item);
    setActiveMenuId(null);
  };

  const handleEditConfigApply = async (newData: any) => {
    if (!editConfigItem) return;

    const updates: Partial<PreCalculationItem> = {
      options: newData.options,
      purchasePrice: newData.purchasePrice,
      purchasePriceBreakdown: newData.purchasePriceBreakdown,
      volumeM3: newData.volumeM3,
      weightKg: newData.weightKg,
      packages: newData.packages,
      // Если продукт сменили — обновляем базовые поля товара
      ...(newData.productId !== editConfigItem.productId ? {
        productId: newData.productId,
        name: newData.name,
        sku: newData.sku,
        manufacturer: newData.manufacturer,
        hsCode: newData.hsCode,
        supplierName: newData.supplierName,
      } : {}),
      // Продажная цена — только если нет привязанного заказа и не подтверждена вручную
      ...(!editConfigItem.orderId && !editConfigItem.isRevenueConfirmed ? { revenueKzt: newData.revenueKzt } : {}),
    };

    onUpdateItemsBatch?.([{ id: editConfigItem.id, updates }]);

    // Если позиция привязана к заказу — обновляем комплектацию товара в заказе
    if (editConfigItem.orderId) {
      const order = salesOrders.find(o => o.id?.toLowerCase() === editConfigItem.orderId?.toLowerCase());
      if (order) {
        const newConfiguration = newData.options?.map((opt: any) => opt.variantName) || [];
        const updatedItems = order.items.map((oi: any) => {
          if (oi.preCalcItemId === editConfigItem.id || oi.productId === editConfigItem.productId) {
            return { ...oi, configuration: newConfiguration };
          }
          return oi;
        });
        const existingPlans = plannedPayments.filter(p => p.sourceDocId === order.id);
        await actions.updateSalesOrder({ ...order, items: updatedItems }, existingPlans);
      }
    }

    setEditConfigItem(null);
  };

  return (
    <div className="flex flex-col h-full space-y-3 animate-in fade-in duration-500 font-sans text-slate-900">
      <div className="flex justify-between items-center px-1 flex-none">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            {!isAssemblyMode ? (
              <>
                {!readOnly && (
                  <>
                    <button onClick={() => setModalMode({ isOpen: true, type: 'MACHINE' })} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-amber-200/50"><Cpu size={14} className="text-slate-400 group-hover:text-amber-500"/> + СТАНOК</button>
                    <button onClick={() => setModalMode({ isOpen: true, type: 'PART' })} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-blue-200/50"><Package size={14} className="text-slate-400 group-hover:text-blue-500"/> + ЗАПЧАСТЬ</button>
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <button onClick={() => setModalMode({ isOpen: true, type: 'ORDER' })} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-indigo-200/50"><ShoppingCart size={14} className="text-slate-400 group-hover:text-indigo-500"/> + ИЗ ЗАКАЗА</button>
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <button onClick={() => { setIsAssemblyMode(true); setSelectedIds(new Set()); }} className="group flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 shadow-md"><PlusCircle size={14}/> Создать заказ</button>
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                  </>
                )}
                <button onClick={handleExportDraftInvoice} disabled={syncedItems.length === 0} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all duration-200 border border-transparent hover:border-emerald-200/50 disabled:opacity-40"><Download size={14} className="text-slate-400 group-hover:text-emerald-500"/> Инвойс .xlsx</button>
              </>
            ) : (
              <div className="flex items-center gap-3 animate-in slide-in-from-left-2"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest pl-2">Режим сборки заказа: {selectedIds.size} выбрано</span><button onClick={handleConfirmAssembly} disabled={selectedIds.size === 0} className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all shadow-md disabled:opacity-50"><Check size={14}/> Подтвердить выбор</button><button onClick={() => setIsAssemblyMode(false)} className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all">Отмена</button></div>
            )}
        </div>
        <div className="flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-2xl text-white shadow-lg flex-none border border-slate-700"><div className="flex items-center gap-2 border-r border-slate-800 pr-4"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Закуп:</span><span className="text-xs font-bold font-mono">{formatCurrency(totals.purchaseKzt)} <span className="text-[9px] text-slate-500">₸</span></span></div><div className="flex items-center gap-2 border-r border-slate-800 pr-4"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Выручка:</span><span className="text-xs font-bold font-mono text-blue-400">{formatCurrency(totals.revenueKzt)} <span className="text-[9px] text-blue-700">₸</span></span></div><div className="flex items-center gap-2"><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Прибыль:</span><span className="text-xs font-bold font-mono text-emerald-400">{formatCurrency(totals.profitKzt)} <span className="text-[9px] text-emerald-600">₸</span></span></div></div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl flex flex-col flex-1 overflow-hidden relative">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <table className="border-collapse text-left table-fixed w-max" style={{ minWidth: `${TOTAL_TABLE_WIDTH}px` }}>
            <colgroup>{Object.values(COL_WIDTHS).map((w, i) => (<col key={i} style={{width: `${w}px`}}/>))}</colgroup>
            <thead className="sticky top-0 z-40 shadow-sm whitespace-nowrap text-sans">
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[9px] font-bold uppercase tracking-[0.2em]"><th colSpan={4} className="px-4 py-2 border-r border-slate-800 text-center">ТОВАР И ЗАКУП</th><th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-center bg-blue-950/40 text-blue-400/70">ПРОДАЖА</th><th colSpan={2} className="px-4 py-2 border-r border-slate-800 text-center bg-emerald-950/40 text-emerald-400/70">ИТОГИ</th><th colSpan={7} className="px-4 py-2 border-r border-slate-800 text-center bg-amber-950/40 text-amber-400/70">ЛОГИСТИКА</th><th colSpan={5} className="px-4 py-2 border-r border-slate-800 text-center bg-slate-900/60 text-slate-400/70">НАЛОГИ</th><th colSpan={3} className="px-4 py-2 border-r border-slate-800 text-center bg-rose-950/40 text-rose-400/70">ПРОЧИЕ РАСХОДЫ</th><th colSpan={2} className="px-4 py-2 text-center text-slate-400/70">СЕБЕСТОИМОСТЬ</th><th className="bg-slate-950"></th></tr>
              <tr className="bg-slate-800 text-white/90 border-b border-slate-700 text-[9px] font-bold uppercase tracking-wider"><th className="px-4 py-3">Наименование</th><th className="px-3 py-3 text-center">Производитель</th><th className="px-3 py-3 text-center">Кол</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-slate-700/30">Закуп Всего</th><th className="px-4 py-3">Заказ / Контрагент</th><th className="px-3 py-3 text-right text-blue-200">Выручка</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-blue-800/20 text-blue-200">Оплачено</th><th className="px-3 py-3 text-right text-emerald-300 bg-emerald-800/20">Прибыль</th><th className="px-3 py-3 text-center text-emerald-300 border-r border-slate-700">Рент%</th><th className="px-3 py-3 text-center text-amber-200">Объем</th><th className="px-3 py-3 text-right text-amber-200">Урум.-Алм.</th><th className="px-3 py-3 text-right text-sky-300">По Китаю</th><th className="px-3 py-3 text-right text-amber-200">Алм.-Кар.</th>
<th className="px-3 py-3 text-right text-amber-200">СВХ</th><th className="px-3 py-3 text-right text-amber-200">Брок</th><th className="px-3 py-2 text-right border-r border-slate-700 bg-amber-800/20 text-amber-200">Сбор</th><th className="px-3 py-3 text-center">Режим</th><th className="px-3 py-3 text-right">НДС Итог</th><th className="px-3 py-3 text-right">НДС Тамож</th><th className="px-3 py-3 text-right">Разн</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-slate-700/30">КПН</th><th className="px-3 py-3 text-right text-rose-200 bg-rose-800/20">ПНР</th><th className="px-3 py-3 text-right text-rose-200 bg-rose-800/20">Дост.клиент</th><th className="px-3 py-3 text-right border-r border-slate-700 bg-rose-800/20 text-rose-200">Бонус ОП</th><th className="px-3 py-3 text-right font-bold bg-slate-700/30">Полная</th><th className="px-3 py-3 text-right font-bold border-r border-slate-700">ДОПРОД</th><th></th></tr>
              <tr className="bg-white text-slate-900 border-b-2 border-blue-500/50 text-[10px] font-bold font-mono shadow-[0_4px_10px_-4px_rgba(0,0,0,0.1)] sticky top-[72px] z-30"><td className="px-4 py-2.5 text-[8px] uppercase tracking-tighter text-blue-600 bg-blue-50/50">ИТОГО ПО СПИСКУ:</td><td className="px-3 py-2.5 bg-blue-50/50"></td><td className="px-3 py-2.5 text-center bg-blue-50/50 text-slate-700">{totals.qty}</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-blue-50/50 text-blue-700">{formatCurrency(totals.purchaseKzt)} ₸</td><td className="px-3 py-2.5 bg-indigo-50/30"></td><td className="px-3 py-2.5 text-right text-blue-600 bg-indigo-50/30">{formatCurrency(totals.revenueKzt)} ₸</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-indigo-50/30 text-indigo-500">{formatCurrency(totals.paidKzt)} ₸</td><td className="px-3 py-2.5 text-right text-emerald-600 bg-emerald-50/50">{formatCurrency(totals.profitKzt)} ₸</td><td className="px-3 py-2.5 text-center text-emerald-600 bg-emerald-50/50 border-r border-slate-200">{totals.revenueKzt > 0 ? ((totals.profitKzt / totals.revenueKzt) * 100).toFixed(1) : '0.0'}%</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatNumber(totals.volume, 3)} м³</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.chinaKzt)}</td><td className="px-3 py-2.5 text-right text-sky-600 bg-sky-50/50">{formatCurrency(totals.chinaDomKzt)}</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.karagandaKzt)}</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.svhKzt)}</td><td className="px-3 py-2.5 text-right text-amber-600 bg-amber-50/50">{formatCurrency(totals.brokerKzt)}</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-amber-50/50 text-amber-600">{formatCurrency(totals.feesKzt)}</td><td className="px-3 py-2.5"></td><td className="px-3 py-2.5 text-right text-slate-900">{formatCurrency(totals.vatTotalKzt)}</td><td className="px-3 py-2.5 text-right text-slate-400">{formatCurrency(totals.vatCustomsKzt)}</td><td className="px-3 py-2.5 text-right text-amber-700">{formatCurrency(totals.vatTotalKzt - totals.vatCustomsKzt)}</td><td className="px-3 py-2.5 text-right border-r border-slate-200">{formatCurrency(totals.kpnKzt)}</td><td className="px-3 py-2.5 text-right text-rose-700 bg-rose-50/50">{formatCurrency(totals.pnrKzt)}</td><td className="px-3 py-2.5 text-right text-rose-700 bg-rose-50/50">{formatCurrency(totals.deliveryLocalKzt)}</td><td className="px-3 py-2.5 text-right border-r border-slate-200 bg-rose-50/50 text-rose-700">{formatCurrency(totals.bonusKzt)}</td><td className="px-3 py-2.5 text-right font-black text-slate-900 bg-slate-50">{formatCurrency(totals.costFullKzt)}</td><td className="px-3 py-2.5 text-right text-slate-500 border-r border-slate-200 bg-slate-50">{formatCurrency(totals.costPreSaleKzt)}</td><td></td></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
              {groupedItems.map((item, idx) => {
                const itemPaid = getItemPaidAmount(item);
                const itemTotalRevenue = (item.revenueKzt || 0) * (item.quantity || 1);
                const payPercent = itemTotalRevenue > 0 ? (itemPaid / itemTotalRevenue) * 100 : 0;

                const relatedOrder = item.orderId ? salesOrders.find(o => o.id?.toLowerCase() === item.orderId?.toLowerCase()) : null;
                const orderPaidAmountTotal = relatedOrder ? plannedPayments.filter(p => p.sourceDocId === relatedOrder.id).reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0) : 0;

                // Сепараторы между секциями
                const isFirstMachine = hasBothTypes && item.type === 'MACHINE' && idx === 0;
                const isSeparatorRow = hasBothTypes && item.type !== 'MACHINE' && (idx === 0 || groupedItems[idx - 1].type === 'MACHINE');

                return (
                <React.Fragment key={item.id}>
                {isFirstMachine && (
                  <tr className="bg-amber-50/40 border-b border-amber-100/60">
                    <td colSpan={Object.keys(COL_WIDTHS).length} className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <Cpu size={11} className="text-amber-500 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-500/80">Станки и оборудование</span>
                        <div className="flex-1 h-px bg-amber-200/50" />
                      </div>
                    </td>
                  </tr>
                )}
                {isSeparatorRow && (
                  <tr className="bg-blue-50/40 border-t-2 border-blue-200/50 border-b border-blue-100/60">
                    <td colSpan={Object.keys(COL_WIDTHS).length} className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <Package size={11} className="text-blue-400 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-400/80">Запчасти и комплектующие</span>
                        <div className="flex-1 h-px bg-blue-200/50" />
                      </div>
                    </td>
                  </tr>
                )}
                <tr className={`hover:bg-blue-50/20 transition-all duration-75 group text-[11px] ${isAssemblyMode && item.orderId ? 'opacity-40 grayscale' : ''}`}>
                  <td className="px-4 py-2 align-middle relative">
                    <div className="flex items-center gap-2">
                        {isAssemblyMode ? (
                            <button disabled={!!item.orderId} onClick={() => { const n = new Set(selectedIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setSelectedIds(n); }} className={`p-1 rounded-lg transition-all ${selectedIds.has(item.id) ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-indigo-600'} ${item.orderId ? 'cursor-not-allowed opacity-50' : ''}`}>
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
                                        {item.type === 'MACHINE' && (
                                          <button onClick={() => openEditConfig(item)} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50 transition-colors"><Wrench size={14}/> Изм. комплектацию</button>
                                        )}
                                        {!readOnly && (
                                          <button onClick={() => { onDeleteItem(item.id); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14}/> Удалить</button>
                                        )}
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
                      <button
                        onClick={() => handleOpenExistingOrder(relatedOrder)}
                        className="flex flex-col gap-0.5 w-full text-left group/order rounded-lg px-1 py-0.5 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Открыть заказ"
                      >
                        <div className="flex items-center gap-1.5">
                          <Tag size={12} className="text-indigo-500 shrink-0 group-hover/order:text-indigo-700 transition-colors" />
                          <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none truncate group-hover/order:text-indigo-800 transition-colors underline-offset-2 group-hover/order:underline decoration-indigo-300">
                            {relatedOrder.name || relatedOrder.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3.5">
                          <User size={10} className="text-slate-400 shrink-0 group-hover/order:text-indigo-500 transition-colors" />
                          <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-tighter truncate group-hover/order:text-indigo-800 transition-colors">
                            {relatedOrder.clientName || item.clientName || 'Без контрагента'}
                          </span>
                        </div>
                      </button>
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
                  <td className="px-3 py-2 align-middle text-center">{!isAssemblyMode && !readOnly && (<button onClick={() => onDeleteItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"><Trash2 size={16} /></button>)}</td>
                </tr>
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <AddItemModal isOpen={modalMode.isOpen} mode={modalMode.type} onClose={() => setModalMode({ ...modalMode, isOpen: false })} onAddItem={onAddItem}/>
      {editConfigItem && (
        <AddItemModal
          isOpen={true}
          mode="MACHINE"
          onClose={() => setEditConfigItem(null)}
          onAddItem={handleEditConfigApply}
          initialProductId={editConfigItem.productId}
          initialOptions={editConfigInitialOptions}
          editMode={true}
        />
      )}
      {orderFormConfig.isOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-300"><div className="w-full max-w-7xl h-full flex flex-col relative animate-in zoom-in-95 duration-200"><div className="absolute -top-12 right-0 flex items-center gap-3"><div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl border border-white/20 shadow-xl"><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{orderFormConfig.isNew ? 'Оформление заказа на основании предрасчета' : `Заказ: ${orderFormConfig.initialOrder?.name || orderFormConfig.initialOrder?.id}`}</p></div><button onClick={() => setOrderFormConfig({ ...orderFormConfig, isOpen: false })} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all border border-white/20 shadow-xl active:scale-95"><X size={24} /></button></div><div className="flex-1 overflow-hidden">{isSubmitting ? (
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
