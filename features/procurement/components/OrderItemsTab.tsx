
import React, { useState, useMemo } from 'react';
import { Product, ProductType, Currency, OrderItem, ProductCategory, StockMovement } from '@/types';
import { Search, Box, Zap, Briefcase, Monitor, Tags, Trash2 } from 'lucide-react';
import { InventoryService } from '@/services/InventoryService';
import { ConfiguratorModal } from '@/features/bundles/components/ConfiguratorModal';

interface OrderItemsTabProps {
    products: Product[];
    categories: ProductCategory[];
    stockMovements: StockMovement[];
    supplierId: string;
    orderCurrency: Currency;
    calculateCrossRate: (cur: Currency) => number;
    items: OrderItem[];
    setItems: React.Dispatch<React.SetStateAction<OrderItem[]>>;
}

export const OrderItemsTab: React.FC<OrderItemsTabProps> = ({
    products, categories, stockMovements, supplierId, orderCurrency, calculateCrossRate, items, setItems
}) => {
    const [activeType, setActiveType] = useState<ProductType>(ProductType.MACHINE);
    const [machineTypeFilter, setMachineTypeFilter] = useState<string | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
    const [productInput, setProductInput] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [itemQty, setItemQty] = useState(1);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [configMachine, setConfigMachine] = useState<Product | null>(null);

    const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')), [categories]);

    const displayedCategories = useMemo(() => {
        const base = categories.filter(c => c.type === activeType);
        if (activeType === ProductType.MACHINE) return base;
        if (machineTypeFilter === 'all') return base;
        return base.filter(cat => products.some(p => p.type === activeType && p.categoryId === cat.id && (p.compatibleMachineCategoryIds || []).includes(machineTypeFilter)));
    }, [categories, activeType, machineTypeFilter, products]);

    const checkMachineDeficit = (productId: string, movements: StockMovement[]) => {
        const configs: Record<string, { physical: number, incoming: number, reserved: number }> = {};
        movements.filter(m => m.productId === productId).forEach(m => {
            const key = (m.configuration || []).sort().join('|') || 'BASE';
            if (!configs[key]) configs[key] = { physical: 0, incoming: 0, reserved: 0 };
            const change = m.type === 'In' ? m.quantity : -m.quantity;
            if (m.statusType === 'Physical') configs[key].physical += change;
            else if (m.statusType === 'Incoming') configs[key].incoming += change;
            else if (m.statusType === 'Reserved') configs[key].reserved += change;
        });
        return Object.values(configs).some(c => (c.physical + c.incoming - c.reserved) < 0);
    };

    const availableProducts = useMemo(() => {
        const filtered = products.filter(p => {
            const matchSup = !supplierId || p.supplierId === supplierId;
            const matchType = p.type === activeType;
            const matchMachine = activeType === ProductType.MACHINE || machineTypeFilter === 'all' || (p.compatibleMachineCategoryIds || []).includes(machineTypeFilter);
            const matchCat = categoryFilter === 'all' || p.categoryId === categoryFilter;
            const matchSearch = !productInput || p.name.toLowerCase().includes(productInput.toLowerCase()) || p.sku.toLowerCase().includes(productInput.toLowerCase());
            return matchSup && matchType && matchMachine && matchCat && matchSearch;
        });
        return [...filtered].sort((a, b) => {
            const isDeficitA = a.type === ProductType.MACHINE ? checkMachineDeficit(a.id, stockMovements) : InventoryService.getProductBalance(a.id, stockMovements).free < 0;
            const isDeficitB = b.type === ProductType.MACHINE ? checkMachineDeficit(b.id, stockMovements) : InventoryService.getProductBalance(b.id, stockMovements).free < 0;
            if (isDeficitA && !isDeficitB) return -1;
            if (!isDeficitA && isDeficitB) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [products, supplierId, activeType, machineTypeFilter, categoryFilter, productInput, stockMovements]);

    const handleAddItemToOrder = (customData?: { name: string, price: number, currency: Currency, config?: string[] }) => {
        if (!customData) {
            const p = products.find(prod => prod.name === productInput || prod.sku === productInput);
            if (!p) return;
            const crossRate = calculateCrossRate(p.currency);
            setItems(prev => [...prev, {
                productId: p.id, productName: p.name, sku: p.sku, productType: p.type, quantity: itemQty,
                productBasePrice: p.basePrice, productCurrency: p.currency, exchange_rate_to_order_currency: crossRate,
                priceForeign: p.basePrice * crossRate, totalForeign: p.basePrice * crossRate * itemQty, configuration: []
            }]);
        } else {
            if (!configMachine) return;
            const crossRate = calculateCrossRate(customData.currency);
            setItems(prev => [...prev, {
                productId: configMachine.id, productName: configMachine.name, sku: configMachine.sku, productType: ProductType.MACHINE,
                quantity: itemQty, productBasePrice: customData.price, productCurrency: customData.currency,
                exchange_rate_to_order_currency: crossRate, priceForeign: customData.price * crossRate,
                totalForeign: customData.price * crossRate * itemQty, configuration: customData.config || []
            }]);
        }
        setIsConfiguring(false); setProductInput(''); setItemQty(1); setIsDropdownOpen(false);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            <div className="bg-blue-50/20 p-5 rounded-[2rem] border border-blue-100/50 shadow-sm space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center gap-6">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex-none">
                        {[ProductType.MACHINE, ProductType.PART, ProductType.SERVICE].map(type => (
                            <button key={type} onClick={() => { setActiveType(type); setMachineTypeFilter('all'); setCategoryFilter('all'); setProductInput(''); }} className={`flex items-center gap-2 px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeType === type ? (type === ProductType.MACHINE ? 'bg-blue-600' : type === ProductType.PART ? 'bg-orange-600' : 'bg-purple-600') + ' text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{type === ProductType.MACHINE ? <Box size={14}/> : type === ProductType.PART ? <Zap size={14}/> : <Briefcase size={14}/>} {type === ProductType.MACHINE ? 'Станки' : type === ProductType.PART ? 'Запчасти' : 'Услуги'}</button>
                        ))}
                    </div>
                    <div className="flex flex-1 justify-end gap-3">
                        {activeType !== ProductType.MACHINE && (
                            <div className="w-56">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5"><Monitor size={10} className="text-blue-500"/> Совместимость</label>
                                <select className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={machineTypeFilter} onChange={e => { setMachineTypeFilter(e.target.value); setCategoryFilter('all'); }} disabled={!supplierId}><option value="all">Любое оборудование</option>{machineCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select>
                            </div>
                        )}
                        <div className="w-56">
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest flex items-center gap-1.5"><Tags size={10} className={activeType === ProductType.MACHINE ? "text-blue-600" : "text-orange-500"}/> Категория</label>
                            <select className="w-full bg-white border border-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} disabled={!supplierId}><option value="all">Все категории</option>{displayedCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                        <label className="block text-[8px] font-black text-blue-500 uppercase mb-1.5 ml-1 tracking-widest flex items-center gap-1.5"><Search size={10} className="text-blue-500"/> Наименование или Артикул</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-4 top-3 text-slate-300"/><input type="text" className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-blue-400 outline-none text-sm font-bold shadow-sm disabled:opacity-50" placeholder={supplierId ? "Начните вводить..." : "Сначала выберите поставщика"} value={productInput} onFocus={() => setIsDropdownOpen(true)} onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} onChange={e => setProductInput(e.target.value)} disabled={!supplierId} />
                        </div>
                        {isDropdownOpen && supplierId && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[100] max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                                {availableProducts.length > 0 ? availableProducts.map(p => {
                                    const balance = InventoryService.getProductBalance(p.id, stockMovements);
                                    const hasDeficit = p.type === ProductType.MACHINE ? checkMachineDeficit(p.id, stockMovements) : balance.free < 0;
                                    return (
                                        <div key={p.id} className="px-5 py-3 hover:bg-blue-50 cursor-pointer text-xs border-b last:border-0 flex justify-between items-center group transition-colors" onClick={() => { setProductInput(p.name); setIsDropdownOpen(false); if(p.type === ProductType.MACHINE) { setConfigMachine(p); setIsConfiguring(true); } else handleAddItemToOrder(); }}>
                                            <div className="flex-1 min-w-0 pr-4"><div className="font-black text-slate-700 group-hover:text-blue-700 truncate flex items-center gap-1.5">{p.name}{hasDeficit && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase">Дефицит</span>}</div><div className="text-[10px] text-slate-400 font-mono tracking-tighter mt-0.5">{p.sku}</div></div>
                                            <div className="text-right flex items-center gap-4"><div className="text-right min-w-[50px]"><div className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Склад</div><div className="text-[11px] font-black text-slate-700">{balance.physical}</div></div><div className="text-right min-w-[50px]"><div className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Свободно</div><div className={`text-[11px] font-black ${balance.free <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{balance.free}</div></div><div className="text-right min-w-[80px]"><div className="text-[11px] font-black text-blue-700">{f(p.basePrice)} {p.currency}</div><div className="text-[7px] text-slate-400 uppercase font-black tracking-tighter">Прайс</div></div></div>
                                        </div>
                                    );
                                }) : (<div className="p-10 text-center text-slate-400 italic text-[10px] font-bold uppercase tracking-widest">Товары не найдены</div>)}
                            </div>
                        )}
                    </div>
                    <div className="w-20"><label className="block text-[8px] font-black text-blue-500 uppercase mb-1 text-center tracking-widest">Кол-во</label><input type="number" className="w-full bg-white border border-slate-200 px-1 py-3 rounded-2xl text-center font-black text-sm shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5" value={itemQty} onChange={e => setItemQty(parseInt(e.target.value))} min={1}/></div>
                    <button onClick={() => handleAddItemToOrder()} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 h-[50px]">Добавить</button>
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <tr><th className="px-6 py-3 text-left">Товар</th><th className="px-4 py-3 text-right w-20">Кол-во</th><th className="px-4 py-3 text-right w-32">Прайс (ВЦП)</th><th className="px-4 py-3 text-center w-20 text-blue-500">Курс</th><th className="px-4 py-3 text-right w-40">Инвойс (ВПл)</th><th className="px-6 py-3 text-right w-40">Итого</th><th className="w-12"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-6 py-3"><div className="font-black text-slate-800 text-xs leading-tight">{item.productName}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">{item.sku}</div>{item.configuration && item.configuration.length > 0 && (<div className="flex flex-wrap gap-1 mt-1">{item.configuration.map((c, i) => <span key={i} className="text-[8px] bg-blue-50 px-1 py-0.5 rounded-[4px] text-blue-600 border border-blue-100 font-bold">{c}</span>)}</div>)}</td>
                                <td className="px-4 py-3 text-right"><input type="number" className="w-14 bg-slate-50 border-none p-1.5 rounded-lg text-right font-black text-slate-700 outline-none text-xs" value={item.quantity} onChange={e => { const u = [...items]; u[idx].quantity = parseInt(e.target.value) || 1; u[idx].totalForeign = u[idx].quantity * u[idx].priceForeign; setItems(u); }} /></td>
                                <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-400 font-bold">{f(item.productBasePrice)} {item.productCurrency}</td>
                                <td className="px-4 py-3 text-center"><div className="text-[10px] font-mono font-black text-blue-600 bg-blue-50 py-0.5 px-1.5 rounded-lg border border-blue-100">{item.exchange_rate_to_order_currency.toFixed(4)}</div></td>
                                <td className="px-4 py-3 text-right"><input type="number" step="0.01" className="w-28 bg-slate-50 border-none p-1.5 rounded-lg text-right font-mono font-bold text-slate-800 text-xs" value={item.priceForeign} onChange={e => { const u = [...items]; const newPriceForeign = parseFloat(e.target.value) || 0; u[idx].priceForeign = newPriceForeign; u[idx].totalForeign = u[idx].quantity * newPriceForeign; if (u[idx].productBasePrice > 0) u[idx].exchange_rate_to_order_currency = newPriceForeign / u[idx].productBasePrice; setItems(u); }} /></td>
                                <td className="px-6 py-3 text-right font-black text-slate-900 font-mono text-base">{f(item.totalForeign)} <span className="text-[9px] opacity-40">{orderCurrency}</span></td>
                                <td className="px-4 py-3 text-center"><button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>
                            </tr>
                        ))}
                        {items.length === 0 && (<tr><td colSpan={7} className="py-10 text-center text-slate-300 italic text-xs uppercase font-bold tracking-widest">Список товаров пуст</td></tr>)}
                    </tbody>
                </table>
            </div>

            {isConfiguring && configMachine && (
                <ConfiguratorModal isOpen={isConfiguring} onClose={() => setIsConfiguring(false)} mode="procurement" baseMachine={configMachine} onApply={handleAddItemToOrder} />
            )}
        </div>
    );
};
