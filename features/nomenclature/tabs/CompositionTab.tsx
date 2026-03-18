
import React, { useState } from 'react';
import { Product, ProductType } from '@/types';
import { Wrench, Trash2 } from 'lucide-react';
import { useAccess } from '@/features/auth/hooks/useAccess';

interface CompositionTabProps {
    formData: Partial<Product>;
    products: Product[];
    setFormData: (data: Partial<Product>) => void;
}

export const CompositionTab: React.FC<CompositionTabProps> = ({ formData, products, setFormData }) => {
    const access = useAccess('nomenclature');
    const canWrite = access.canWrite('actions', 'edit');

    const [compProductId, setCompProductId] = useState('');
    const [compQty, setCompQty] = useState(1);

    const handleAdd = () => {
        if(!canWrite || !compProductId) return;
        const exists = (formData.internalComposition || []).find(c => c.productId === compProductId);
        let updatedComp = [];
        if(exists) {
            updatedComp = (formData.internalComposition || []).map(c => c.productId === compProductId ? {...c, quantity: c.quantity + compQty} : c);
        } else {
            updatedComp = [...(formData.internalComposition || []), { productId: compProductId, quantity: compQty }];
        }
        setFormData({...formData, internalComposition: updatedComp});
        setCompProductId(''); setCompQty(1);
    };

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Состав изделия (BOM)</h3>
                    <p className="text-sm text-slate-500">Укажите, из каких других номенклатурных позиций состоит данный станок. Это используется для автоматического резервирования и списания комплектующих при продаже станка.</p>
                </div>

                {canWrite && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-end gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Компонент</label>
                            <select 
                                value={compProductId}
                                onChange={e => setCompProductId(e.target.value)}
                                className="w-full mt-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">- Выберите компонент -</option>
                                {products.filter(p => p.type === ProductType.PART).map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Кол-во</label>
                            <input 
                                type="number"
                                value={compQty}
                                onChange={e => setCompQty(Number(e.target.value))}
                                className="w-full mt-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="1"
                            />
                        </div>
                        <button onClick={handleAdd} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-blue-700 transition-colors">Добавить</button>
                    </div>
                )}

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Наименование</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Артикул</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Количество</th>
                                {canWrite && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"></th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {(formData.internalComposition || []).length > 0 ? (
                                (formData.internalComposition || []).map(comp => {
                                    const product = products.find(p => p.id === comp.productId);
                                    if(!product) return null;
                                    return (
                                        <tr key={comp.productId}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{product.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{product.sku}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-bold text-center">{comp.quantity}</td>
                                            {canWrite && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button 
                                                        onClick={() => {
                                                            const updated = (formData.internalComposition || []).filter(c => c.productId !== comp.productId);
                                                            setFormData({...formData, internalComposition: updated});
                                                        }}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={canWrite ? 4 : 3} className="text-center py-10 text-slate-400 italic">
                                        <Wrench className="mx-auto mb-2" size={24}/>
                                        Нет компонентов в составе
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
