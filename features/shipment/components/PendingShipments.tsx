
import React from 'react';
import { SalesOrder, Shipment, OrderStatus } from '@/types';
import { ShoppingCart, User, Package, Calendar, ArrowRight } from 'lucide-react';

interface PendingShipmentsProps {
    orders: SalesOrder[];
    shipments: Shipment[];
    onSelect: (orderId: string) => void;
}

export const PendingShipments: React.FC<PendingShipmentsProps> = ({ orders, shipments, onSelect }) => {
    const f = (val: number) => val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const eligibleOrders = orders.filter(o => {
        if (o.status === OrderStatus.CLOSED || o.isDeleted) return false;
        const totalOrdered = o.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
        const totalShipped = shipments
           .filter(s => s.salesOrderId === o.id && s.status === 'Posted')
           .reduce((acc, s) => acc + (s.items || []).reduce((sum, i) => sum + (Number(i.qtyShipped) || 0), 0), 0);
        return totalOrdered > totalShipped;
    });

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Ожидают отгрузки ({eligibleOrders.length})
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {eligibleOrders.map(o => {
                    const totalQty = o.items.reduce((s, i) => s + Number(i.quantity), 0);
                    const shippedQty = shipments
                        .filter(s => s.salesOrderId === o.id && s.status === 'Posted')
                        .reduce((acc, s) => acc + (s.items || []).reduce((sum, i) => sum + (Number(i.qtyShipped) || 0), 0), 0);
                    
                    const progress = totalQty > 0 ? (shippedQty / totalQty) * 100 : 0;
                    
                    return (
                      <div 
                        key={o.id} 
                        onClick={() => onSelect(o.id)} 
                        className="group bg-white p-3 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer relative overflow-hidden flex flex-col gap-2"
                      >
                          <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                                      <ShoppingCart size={14}/>
                                  </div>
                                  <div className="min-w-0">
                                      <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-tight truncate leading-none" title={o.clientName}>
                                          {o.clientName}
                                      </h3>
                                      <span className="text-[8px] font-black text-slate-300 uppercase font-mono tracking-tighter">
                                          #{o.id.slice(-6).toUpperCase()} • {new Date(o.date).toLocaleDateString()}
                                      </span>
                                  </div>
                              </div>
                              <div className="text-right shrink-0">
                                  <div className="text-[11px] font-black text-blue-600 tracking-tighter">{f(Number(o.totalAmount))} ₸</div>
                              </div>
                          </div>

                          <div className="space-y-1.5">
                              <div className="flex justify-between items-end px-0.5">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Прогресс: {shippedQty} / {totalQty}</span>
                                  <ArrowRight size={10} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                              </div>
                              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                      className="h-full bg-blue-500 transition-all duration-500 group-hover:bg-blue-600" 
                                      style={{ width: `${progress}%` }}
                                  />
                              </div>
                          </div>
                      </div>
                    );
                })}
                {eligibleOrders.length === 0 && (
                    <div className="col-span-full py-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center gap-2">
                        <Package size={24} className="text-slate-200" />
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Нет активных заказов</p>
                    </div>
                )}
            </div>
        </div>
    );
};
