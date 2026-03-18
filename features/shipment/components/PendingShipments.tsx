
import React from 'react';
import { SalesOrder, Shipment, OrderStatus } from '@/types';
import { ShoppingCart, ChevronDown } from 'lucide-react';

interface PendingShipmentsProps {
    orders: SalesOrder[];
    shipments: Shipment[];
    onSelect: (orderId: string) => void;
}

export const PendingShipments: React.FC<PendingShipmentsProps> = ({ orders, shipments, onSelect }) => {
    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const eligibleOrders = orders.filter(o => {
        if (o.status === OrderStatus.CLOSED) return false;
        const totalOrdered = o.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const totalShipped = shipments
           .filter(s => s.salesOrderId === o.id && s.status === 'Posted')
           .reduce((acc, s) => acc + (s.items || []).reduce((sum, i) => sum + (i.qtyShipped || 0), 0), 0);
        return totalOrdered > totalShipped;
    });

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                <ShoppingCart size={14}/> Ожидают отгрузки
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {eligibleOrders.map(o => {
                    const totalQty = o.items.reduce((s, i) => s + Number(i.quantity), 0);
                    const shippedQty = shipments
                        .filter(s => s.salesOrderId === o.id && s.status === 'Posted')
                        .reduce((acc, s) => acc + (s.items || []).reduce((sum, i) => sum + (i.qtyShipped || 0), 0), 0);
                    
                    return (
                      <div key={o.id} onClick={() => onSelect(o.id)} className="bg-white p-3.5 rounded-2xl border border-slate-100 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                          <div className="flex justify-between items-start">
                              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><ShoppingCart size={14}/></div>
                              <span className="text-[8px] font-black text-slate-400 uppercase font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">#{o.id.slice(-6).toUpperCase()}</span>
                          </div>
                          <div className="mt-2">
                              <h3 className="font-black text-slate-800 text-xs truncate leading-tight mb-0.5" title={o.clientName}>{o.clientName}</h3>
                              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                  <span>{shippedQty} / {totalQty} шт.</span>
                                  <span className="w-0.5 h-0.5 bg-slate-300 rounded-full"></span>
                                  <span className="text-blue-600 font-black">В процессе</span>
                              </div>
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-50">
                              <div className="text-xs font-black text-slate-900 tracking-tight">{f(Number(o.totalAmount))} <span className="text-[9px] font-medium opacity-40">₸</span></div>
                              <ChevronDown className="-rotate-90 text-slate-200 group-hover:text-blue-500 transition-all group-hover:translate-x-0.5" size={14}/>
                          </div>
                      </div>
                    );
                })}
                {eligibleOrders.length === 0 && (
                    <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-widest">Нет заказов, готовых к отгрузке</div>
                )}
            </div>
        </div>
    );
};
