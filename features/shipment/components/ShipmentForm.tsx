
import React from 'react';
import { ShipmentItem, ProductType, SalesOrder, Product } from '@/types';
import { Package, CheckCircle } from 'lucide-react';
import { useShipmentLogic } from '../hooks/useShipmentLogic';
import { ShipmentSummary } from './ShipmentSummary';

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

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const totalShipmentValue = shipItems.reduce((sum, i) => sum + (i.qtyShipped * (i.priceKZT || 0)), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Состав накладной</h2>
                </div>
                <div className="flex gap-3">
                    {canDraft && <button onClick={() => onSubmit('Draft')} className="px-5 py-2.5 font-bold text-slate-400 hover:text-slate-600 text-xs uppercase tracking-widest">В черновик</button>}
                    {canPost && (<button onClick={() => onSubmit('Posted')} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-black shadow-lg flex items-center gap-2 uppercase text-xs tracking-widest transition-all active:scale-95"><CheckCircle size={18}/> Провести</button>)}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                        <table className="w-full">
                            <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-3 text-left">Товар (Комплектация)</th>
                                    {showStockInfo && <th className="px-6 py-3 text-center w-24">На складе</th>}
                                    <th className="px-6 py-3 text-center w-24">Заказано</th>
                                    <th className="px-6 py-3 text-center w-28">Отгрузить</th>
                                    {showPriceInfo && <th className="px-6 py-3 text-right">Цена (ед.)</th>}
                                    {showPriceInfo && <th className="px-6 py-3 text-right">Итого строка</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {shipItems.map((item, idx) => {
                                    const stock = getSpecificStock(item.productId, item.configuration || []);
                                    const alreadyShipped = getAlreadyShippedForOrder(order.id, item.productId, item.configuration || []);
                                    const normConfig = [...(item.configuration || [])].sort().join('|') || 'BASE';
                                    const orderItem = order.items.find(oi => oi.productId === item.productId && ([...(oi.configuration || [])].sort().join('|') || 'BASE') === normConfig);
                                    const orderedQty = orderItem?.quantity || 0;
                                    const limitExceeded = (alreadyShipped + item.qtyShipped) > orderedQty;

                                    return (
                                        <tr key={idx} className={`hover:bg-blue-50/20 transition-colors group ${limitExceeded ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-800 text-sm leading-tight">{item.productName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-1">{item.sku}</div>
                                                {(item.configuration || []).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">{(item.configuration || []).map((c, i) => (<span key={i} className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black border border-blue-100">{c}</span>))}</div>
                                                )}
                                            </td>
                                            {showStockInfo && (<td className="px-6 py-3 text-center"><span className={`font-mono text-sm font-black ${stock < item.qtyShipped ? 'text-red-600' : 'text-slate-400'}`}>{stock}</span></td>)}
                                            <td className="px-6 py-3 text-center"><div className="text-[11px] font-bold text-slate-500">{orderedQty}</div><div className="text-[8px] text-slate-400 uppercase">из ЗК</div></td>
                                            <td className="px-6 py-3 text-center"><input type="number" className={`w-16 border-none p-2 rounded-xl text-center font-black outline-none focus:ring-2 ${limitExceeded ? 'bg-red-100 text-red-700 focus:ring-red-400' : 'bg-blue-50 text-blue-700 focus:ring-blue-400'}`} value={item.qtyShipped} onChange={e => { const u = [...shipItems]; u[idx].qtyShipped = parseFloat(e.target.value) || 0; setShipItems(u); }} />{limitExceeded && <div className="text-[7px] font-black text-red-500 uppercase mt-1">Превышен лимит</div>}</td>
                                            {showPriceInfo && (<td className="px-6 py-3 text-right font-mono text-xs font-bold text-slate-600">{f(item.priceKZT || 0)}</td>)}
                                            {showPriceInfo && (<td className="px-6 py-3 text-right font-mono text-sm font-black text-slate-900 bg-slate-50/30">{f((item.priceKZT || 0) * item.qtyShipped)} ₸</td>)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="col-span-12 lg:col-span-4">
                    <ShipmentSummary clientName={order.clientName} totalQty={shipItems.reduce((s, i) => s + i.qtyShipped, 0)} totalValue={totalShipmentValue} showPriceInfo={showPriceInfo} onCancel={onCancel} />
                </div>
            </div>
        </div>
    );
};
