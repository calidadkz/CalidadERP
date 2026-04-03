
import React from 'react';
import { ShipmentItem, SalesOrder, Product } from '@/types';
import { Package, CheckCircle, Box, AlertTriangle } from 'lucide-react';
import { useShipmentLogic } from '../hooks/useShipmentLogic';

interface ShipmentFormProps {
    order: SalesOrder;
    shipItems: ShipmentItem[];
    setShipItems: React.Dispatch<React.SetStateAction<ShipmentItem[]>>;
    products: Product[];
    stockMovements: any[];
    shipments: any[];
    showStockInfo: boolean;
    showPriceInfo: boolean;
    canDraft: boolean;
    canPost: boolean;
    onCancel: () => void;
    onSubmit: (status: 'Draft' | 'Posted') => void;
}

export const ShipmentForm: React.FC<ShipmentFormProps> = ({
    order, shipItems, setShipItems, products, stockMovements, shipments, showStockInfo, showPriceInfo, canDraft, canPost, onCancel, onSubmit
}) => {
    const { getSpecificStock, getAlreadyShippedForOrder } = useShipmentLogic(products, stockMovements, shipments, null);

    const f = (val: number) => val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const totalShipmentValue = shipItems.reduce((sum, i) => sum + (i.qtyShipped * (i.priceKzt || 0)), 0);
    const totalQty = shipItems.reduce((s, i) => s + i.qtyShipped, 0);

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header / Actions */}
            <div className="flex items-center justify-between bg-white p-4 rounded-t-2xl border-x border-t border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                        <Package size={20} />
                    </div>
                    <div>
                        <h2 className="text-[14px] font-black text-slate-800 uppercase tracking-tight leading-none">Состав накладной</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Основание: {order.name || order.id}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Итого к отгрузке</span>
                        <div className="flex items-center gap-4">
                            <span className="text-[14px] font-black text-slate-700">{totalQty} ед.</span>
                            {showPriceInfo && (
                                <span className="text-[14px] font-black text-blue-600 font-mono tracking-tighter">{f(totalShipmentValue)} ₸</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        {canDraft && (
                            <button 
                                onClick={() => onSubmit('Draft')} 
                                className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 text-[10px] uppercase tracking-widest transition-all border border-slate-200"
                            >
                                Черновик
                            </button>
                        )}
                        {canPost && (
                            <button 
                                onClick={() => onSubmit('Posted')} 
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 flex items-center gap-2 uppercase text-[10px] tracking-widest transition-all active:scale-95"
                            >
                                <CheckCircle size={14}/> Провести
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table Container */}
            <div className="flex-1 bg-white border-x border-b border-slate-200 rounded-b-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full border-collapse table-fixed">
                        <thead className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                <th className="px-6 py-3 text-left w-auto">Товар и комплектация</th>
                                {showStockInfo && <th className="px-2 py-3 text-center w-24">Склад</th>}
                                <th className="px-2 py-3 text-center w-24">Заказ</th>
                                <th className="px-2 py-3 text-center w-28">Кол-во</th>
                                {showPriceInfo && <th className="px-6 py-3 text-right w-44">Сумма</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {shipItems.map((item, idx) => {
                                const stock = getSpecificStock(item.productId, item.configuration || []);
                                const alreadyShipped = getAlreadyShippedForOrder(order.id, item.productId, item.configuration || []);
                                const normConfig = [...(item.configuration || [])].sort().join('|') || 'BASE';
                                const orderItem = order.items.find(oi => oi.productId === item.productId && ([...(oi.configuration || [])].sort().join('|') || 'BASE') === normConfig);
                                const orderedQty = orderItem?.quantity || 0;
                                const limitExceeded = (alreadyShipped + item.qtyShipped) > orderedQty;
                                const isOutOfStock = stock < item.qtyShipped;

                                return (
                                    <tr key={idx} className={`hover:bg-slate-50/30 transition-all group ${limitExceeded || isOutOfStock ? 'bg-red-50/10' : ''}`}>
                                        <td className="px-6 py-5 align-top">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 p-1 bg-slate-50 text-slate-300 rounded group-hover:bg-white transition-colors shrink-0 border border-slate-100">
                                                    <Box size={12} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-black text-slate-800 text-[12px] leading-snug uppercase tracking-tight break-words max-h-[5.5rem] overflow-hidden line-clamp-5">
                                                        {item.productName}
                                                    </div>
                                                    <div className="text-[9px] text-slate-300 font-mono mt-1 tracking-tighter uppercase mb-2">{item.sku}</div>
                                                    {(item.configuration || []).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {item.configuration?.map((conf, ci) => (
                                                                <span key={ci} className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-black uppercase border border-blue-100/50">
                                                                    {conf}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {showStockInfo && (
                                            <td className="px-2 py-5 text-center align-top">
                                                <div className="flex flex-col items-center">
                                                    <div className="h-8 flex items-center justify-center">
                                                        <span className={`font-mono text-[14px] font-black leading-none ${isOutOfStock ? 'text-red-600 bg-red-100 px-1.5 py-1 rounded-lg border border-red-100' : 'text-slate-800'}`}>
                                                            {stock}
                                                        </span>
                                                    </div>
                                                    <div className="h-3 flex items-start justify-center">
                                                        <span className="text-[7px] font-black text-slate-300 uppercase leading-none">остаток</span>
                                                    </div>
                                                </div>
                                            </td>
                                        )}

                                        <td className="px-2 py-5 text-center align-top">
                                            <div className="flex flex-col items-center">
                                                <div className="h-8 flex flex-col items-center justify-center">
                                                    <div className="text-[14px] font-black text-slate-800 leading-none">{orderedQty}</div>
                                                    {alreadyShipped > 0 && (
                                                        <div className="text-[7px] text-emerald-600 font-black uppercase tracking-tighter mt-0.5 leading-none">отгр:{alreadyShipped}</div>
                                                    )}
                                                </div>
                                                <div className="h-3 flex items-start justify-center">
                                                    <span className="text-[7px] font-black text-slate-300 uppercase leading-none">заказ</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-2 py-5 text-center align-top">
                                            <div className="flex flex-col items-center">
                                                <div className="h-8 flex items-center justify-center">
                                                    <div className="relative inline-block group/input">
                                                        <input 
                                                            type="number" 
                                                            className={`w-16 px-1 py-1 border-2 rounded-lg text-center font-black text-[14px] leading-none outline-none transition-all h-[28px] ${
                                                                limitExceeded ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-transparent hover:bg-white hover:border-blue-200 focus:bg-white focus:border-blue-500'
                                                            }`} 
                                                            value={item.qtyShipped} 
                                                            onChange={e => { const u = [...shipItems]; u[idx].qtyShipped = parseFloat(e.target.value) || 0; setShipItems(u); }} 
                                                        />
                                                        {limitExceeded && (
                                                            <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-0.5 rounded-full shadow-lg border-2 border-white">
                                                                <AlertTriangle size={8} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="h-3 flex items-start justify-center">
                                                    <span className="text-[7px] font-black text-slate-300 uppercase leading-none">отгрузка</span>
                                                </div>
                                            </div>
                                        </td>

                                        {showPriceInfo && (
                                            <td className="px-6 py-5 text-right align-top">
                                                <div className="flex flex-col items-end">
                                                    <div className="h-8 flex items-center justify-end">
                                                        <div className="text-[14px] font-black text-slate-800 font-mono tracking-tighter leading-none">
                                                            {f((item.priceKzt || 0) * item.qtyShipped)} ₸
                                                        </div>
                                                    </div>
                                                    <div className="h-3 flex items-start justify-end">
                                                        {/* No label here to keep it clean */}
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {/* Simple Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                    <button onClick={onCancel} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Отмена</button>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                             <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Клиент:</span>
                             <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{order.clientName}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
