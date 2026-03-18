import React from 'react';
import { ProductPackage } from '@/types';
import { Trash2 } from 'lucide-react';

export const DimensionInput = ({ label, value, onChange }: { label: string, value: number, onChange: (value: string) => void }) => (
    <div>
        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 text-center">{label}</label>
        <input 
            type="number" 
            className="w-full border border-slate-200 rounded-lg py-1 px-2 text-xs text-center font-bold outline-none"
            value={value || ''} 
            onChange={e => onChange(e.target.value)}
        />
    </div>
);

export const PackageInputRow = ({ pkg, index, onPackageChange, onRemovePackage }: { pkg: ProductPackage, index: number, onPackageChange: (index: number, field: keyof ProductPackage, value: any) => void, onRemovePackage: (index: number) => void }) => (
    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 relative group">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black text-slate-400 uppercase">Место #{index + 1}</span>
            <button onClick={() => onRemovePackage(index)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-1">
            <input type="number" placeholder="Д" className="w-full p-1 rounded border border-slate-200 text-[10px] font-bold text-center outline-none" value={pkg.lengthMm || ''} onChange={e => onPackageChange(index, 'lengthMm', e.target.value)}/>
            <input type="number" placeholder="Ш" className="w-full p-1 rounded border border-slate-200 text-[10px] font-bold text-center outline-none" value={pkg.widthMm || ''} onChange={e => onPackageChange(index, 'widthMm', e.target.value)}/>
            <input type="number" placeholder="В" className="w-full p-1 rounded border border-slate-200 text-[10px] font-bold text-center outline-none" value={pkg.heightMm || ''} onChange={e => onPackageChange(index, 'heightMm', e.target.value)}/>
            <input type="number" placeholder="Вес" className="w-full p-1 rounded border border-slate-200 text-[10px] font-bold text-center outline-none" value={pkg.weightKg || ''} onChange={e => onPackageChange(index, 'weightKg', e.target.value)}/>
        </div>
        <div className="text-right text-[9px] font-bold text-slate-400">
            {(pkg.volumeM3 || 0).toFixed(3)} м³
        </div>
    </div>
);