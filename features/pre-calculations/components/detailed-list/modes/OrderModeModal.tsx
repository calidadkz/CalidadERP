import * as React from 'react';
import { Search, X, Check, ShoppingCart, Calendar, User } from 'lucide-react';
import { SalesOrder, SalesOrderItem } from '../../../../../types';
import { Product, OptionType, OptionVariant } from '../../../../../types';

interface Props {
  filteredOrders: SalesOrder[];
  selectedOrderItems: Record<string, { order: SalesOrder; item: SalesOrderItem }>;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  onToggleOrderItem: (order: SalesOrder, item: SalesOrderItem) => void;
  getOrderPaidAmount: (orderId: string) => number;
  getOptionNames: (product: Product | undefined, config: string[]) => string;
  allProducts: Product[];
  optionVariants: OptionVariant[];
  optionTypes: OptionType[];
  onClose: () => void;
  onAdd: () => void;
}

const ProductImage: React.FC<{ product: Product; className?: string }> = ({ product, className }) => (
  <div className={`shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center ${className}`}>
    {product.imageUrl
      ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      : <div className="text-slate-300 text-[8px]">📦</div>}
  </div>
);

export const OrderModeModal: React.FC<Props> = ({
  filteredOrders, selectedOrderItems, searchTerm, onSearchChange,
  onToggleOrderItem, getOrderPaidAmount, getOptionNames, allProducts,
  optionVariants, optionTypes, onClose, onAdd,
}) => {
  const selectedCount = Object.keys(selectedOrderItems).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Шапка */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm"><ShoppingCart size={14} /></div>
            <div>
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Добавить из заказов</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Выберите позиции из существующих заказов клиентов</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400"><X size={18} /></button>
        </div>

        {/* Поиск */}
        <div className="bg-white border-b border-slate-100 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Поиск по ID заказа или клиенту..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Список заказов */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30 space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20 text-center">
              <ShoppingCart size={48} className="mb-4" />
              <h4 className="text-sm font-black uppercase">Заказы не найдены</h4>
            </div>
          ) : filteredOrders.map(order => {
            const paidAmount = getOrderPaidAmount(order.id);
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                      <span className="text-[10px] font-black text-indigo-600">#{order.id}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-900 uppercase truncate">
                        <User size={10} className="text-slate-400" /> {order.clientName || 'Без имени'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 opacity-60">
                        <span className="flex items-center gap-1 text-[8px] font-bold uppercase"><Calendar size={8} /> {new Date(order.date).toLocaleDateString()}</span>
                        <span className="text-[8px] font-bold uppercase">• {order.totalItemCount || 0} поз.</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] font-black text-slate-900 leading-none">{(order.totalAmount || 0).toLocaleString()} ₸</div>
                    <div className={`text-[7px] font-bold uppercase mt-0.5 ${paidAmount >= order.totalAmount ? 'text-emerald-500' : 'text-blue-500'}`}>
                      Оплачено: {paidAmount.toLocaleString()} ₸
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {order.items?.map(item => {
                    const isSelected = !!selectedOrderItems[`${order.id}_${item.id}`];
                    const product = allProducts.find(p => p.id === item.productId);
                    const optionNames = getOptionNames(product, item.configuration || []);
                    return (
                      <div
                        key={item.id}
                        onClick={() => onToggleOrderItem(order, item)}
                        className={`px-4 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                            {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
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
                                <p className="text-[7px] text-slate-400 italic truncate max-w-[400px]">{optionNames}</p>
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
          })}
        </div>

        {/* Футер */}
        <div className="px-5 py-3 border-t bg-white flex justify-between items-center">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Выбрано: <span className="text-indigo-600">{selectedCount} поз.</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 text-[9px] font-black uppercase text-slate-400">Отмена</button>
            <button
              onClick={onAdd}
              disabled={selectedCount === 0}
              className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[9px] shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
            >
              Добавить в расчет <Check size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
