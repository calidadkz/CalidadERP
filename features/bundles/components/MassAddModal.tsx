
import React, { useState, useMemo, memo } from 'react';
import { Product, OptionVariant, ProductType } from '@/types';
import { X, Search, Check, ArrowRight } from 'lucide-react';

interface MassAddModalProps {
    selectedVariantsToApply: string[];
    variantMap: Map<string, OptionVariant>;
    machines: Product[];
    onClose: () => void;
    onConfirm: (
        selectedMachineIds: string[],
        priceOverrides: Record<string, Record<string, number | ''>>
    ) => Promise<void>;
}

export const MassAddModal: React.FC<MassAddModalProps> = memo(({
    selectedVariantsToApply,
    variantMap,
    machines,
    onClose,
    onConfirm,
}) => {
    const [massAddSearch, setMassAddSearch] = useState('');
    const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
    const [machinePriceOverrides, setMachinePriceOverrides] = useState<Record<string, Record<string, number | ''>>>({});
    const [isConfirming, setIsConfirming] = useState(false);

    const firstVariant = variantMap.get(selectedVariantsToApply[0]);
    const targetCategoryId = firstVariant?.categoryId;

    const filteredMachines = useMemo(() => {
        return machines.filter(p => {
            if (targetCategoryId && p.categoryId !== targetCategoryId) return false;
            const allAllowedVariantIds = (p.machineConfig || []).flatMap(c => c.allowedVariantIds || []);
            const hasMissingOptions = selectedVariantsToApply.some(vId => !allAllowedVariantIds.includes(vId));
            if (!hasMissingOptions) return false;
            const s = massAddSearch.toLowerCase();
            return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
        });
    }, [machines, selectedVariantsToApply, targetCategoryId, massAddSearch]);

    const handleConfirm = async () => {
        if (!selectedMachines.length || isConfirming) return;
        setIsConfirming(true);
        try {
            await onConfirm(selectedMachines, machinePriceOverrides);
        } finally {
            setIsConfirming(false);
        }
    };

    const toggleMachine = (mId: string) => {
        setSelectedMachines(prev =>
            prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
        );
    };

    const toggleAll = (checked: boolean) => {
        setSelectedMachines(checked ? filteredMachines.map(m => m.id) : []);
    };

    const setPriceOverride = (mId: string, vId: string, val: number | '') => {
        setMachinePriceOverrides(prev => ({
            ...prev,
            [mId]: { ...(prev[mId] || {}), [vId]: val },
        }));
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-5 border-b bg-slate-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Массовое добавление опций</h3>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                            Выбрано опций: <span className="text-blue-600">{selectedVariantsToApply.length}</span>. Отметьте станки и при необходимости скорректируйте цены.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <X size={20}/>
                    </button>
                </div>

                <div className="p-4 bg-white border-b shrink-0 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                            placeholder="Поиск станков по названию или артикулу..."
                            value={massAddSearch}
                            onChange={e => setMassAddSearch(e.target.value)}
                        />
                    </div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Найдено: {filteredMachines.length}</div>
                </div>

                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50/30">
                    <table className="w-full border-separate border-spacing-y-1.5 min-w-max">
                        <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="px-3 py-2 text-left w-10 sticky left-0 bg-slate-50/90 z-10">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300"
                                        checked={selectedMachines.length === filteredMachines.length && filteredMachines.length > 0}
                                        onChange={e => toggleAll(e.target.checked)}
                                    />
                                </th>
                                <th className="px-3 py-2 text-left min-w-[200px] sticky left-10 bg-slate-50/90 z-10">Станок</th>
                                {selectedVariantsToApply.map(vId => {
                                    const v = variantMap.get(vId);
                                    return (
                                        <th key={vId} className="px-3 py-2 text-center min-w-[130px]">
                                            <div className="font-black text-slate-600 truncate max-w-[120px]">{v?.name}</div>
                                            <div className="font-mono text-slate-400 text-[8px] normal-case">{v?.price.toLocaleString()} {v?.currency}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMachines.map(m => {
                                const isSelected = selectedMachines.includes(m.id);
                                const rowBg = isSelected ? 'rgb(239 246 255 / 0.9)' : 'white';
                                return (
                                    <tr key={m.id} className={`transition-all ${isSelected ? 'bg-blue-50/70' : 'bg-white hover:bg-slate-50/70'} shadow-sm`}>
                                        <td className="px-3 py-3 rounded-l-xl sticky left-0 z-10" style={{ background: rowBg }}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => toggleMachine(m.id)}
                                            />
                                        </td>
                                        <td
                                            className="px-3 py-3 sticky left-10 z-10 cursor-pointer"
                                            style={{ background: rowBg }}
                                            onClick={() => toggleMachine(m.id)}
                                        >
                                            <div className="text-xs font-bold text-slate-700">{m.name}</div>
                                            <div className="text-[9px] font-mono text-slate-400 uppercase">{m.sku}</div>
                                        </td>
                                        {selectedVariantsToApply.map(vId => {
                                            const v = variantMap.get(vId);
                                            const currentVal = machinePriceOverrides[m.id]?.[vId];
                                            const displayVal = currentVal !== undefined ? currentVal : (v?.price ?? '');
                                            const isModified = currentVal !== undefined && currentVal !== v?.price;
                                            return (
                                                <td key={vId} className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        className={`w-28 px-2 py-1.5 rounded-lg text-xs font-black text-right outline-none border transition-all ${isModified ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}
                                                        value={displayVal}
                                                        onChange={e => {
                                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                                                            setPriceOverride(m.id, vId, val);
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            {filteredMachines.length === 0 && (
                                <tr>
                                    <td colSpan={selectedVariantsToApply.length + 2} className="py-20 text-center text-slate-400 italic font-medium">
                                        Станки не найдены или уже имеют все выбранные опции
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-5 border-t bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="text-xs font-bold text-slate-500">
                        Выбрано станков: <span className="text-blue-600">{selectedMachines.length}</span>
                        <span className="ml-3 text-[10px] text-slate-400 italic">Цены подсвечены синим если изменены относительно базовой</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">
                            Отмена
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedMachines.length === 0 || isConfirming}
                            className="px-10 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                        >
                            <Check size={16}/> Применить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

MassAddModal.displayName = 'MassAddModal';
