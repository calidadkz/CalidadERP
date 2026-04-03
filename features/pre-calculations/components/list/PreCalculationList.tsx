import React from 'react';
import { FileText, Calendar, Package, AlertTriangle, CheckCircle, Trash2, TrendingUp, Truck } from 'lucide-react';

interface PreCalculationInList {
  id: string;
  name: string;
  date: string;
  status: string;
  itemCount?: number;
  totalQty?: number;
  totalRevenue?: number;
  totalCost?: number;
  profit?: number;
  margin?: number;
  totalVolume?: number;
  totalWeight?: number;
}

interface PreCalculationListProps {
  preCalculations: PreCalculationInList[];
  onRowClick: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export const PreCalculationList: React.FC<PreCalculationListProps> = ({ preCalculations, onRowClick, onDelete }) => {
  const f = (val: number = 0) => val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Партия / Дата</th>
              <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Статус</th>
              <th className="text-center px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Кол-во</th>
              <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Габариты</th>
              <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Выручка</th>
              <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Себест.</th>
              <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Маржа %</th>
              <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Чистая прибыль</th>
              <th className="px-8 py-5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {preCalculations.map((preCalc) => (
              <tr key={preCalc.id} onClick={() => onRowClick(preCalc.id)} className="hover:bg-slate-50/30 transition-all group cursor-pointer">
                <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" />
                            <span className="font-black text-slate-800 text-sm tracking-tight">{preCalc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-5">
                            <Calendar size={12} />
                            <span>{preCalc.date ? new Date(preCalc.date).toLocaleDateString('ru-RU') : '—'}</span>
                        </div>
                    </div>
                </td>
                <td className="px-8 py-5">
                    {preCalc.status?.toLowerCase() === 'draft' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                            <AlertTriangle size={12} /> Черновик
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                            <CheckCircle size={12} /> Завершен
                        </span>
                    )}
                </td>
                <td className="px-8 py-5 text-center">
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-slate-700">{preCalc.totalQty || 0}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">ед. ({preCalc.itemCount || 0} поз.)</span>
                    </div>
                </td>
                <td className="px-8 py-5">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Truck size={12} className="text-slate-400"/>
                            <span>{(preCalc.totalVolume || 0).toFixed(2)} м³</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium ml-5">
                            {(preCalc.totalWeight || 0).toFixed(1)} кг
                        </div>
                    </div>
                </td>
                <td className="px-8 py-5 text-right">
                    <span className="text-sm font-black text-slate-700">{f(preCalc.totalRevenue)} ₸</span>
                </td>
                <td className="px-8 py-5 text-right">
                    <span className="text-sm font-bold text-slate-500">{f(preCalc.totalCost)} ₸</span>
                </td>
                <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                        <TrendingUp size={12} className={ (preCalc.margin || 0) > 15 ? 'text-emerald-500' : 'text-amber-500'} />
                        <span className={`text-sm font-black ${ (preCalc.margin || 0) > 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {(preCalc.margin || 0).toFixed(1)}%
                        </span>
                    </div>
                </td>
                <td className="px-8 py-5 text-right">
                    <div className="bg-slate-50 px-3 py-2 rounded-xl inline-block">
                        <span className="text-sm font-black text-blue-700">{f(preCalc.profit)} ₸</span>
                    </div>
                </td>
                <td className="px-8 py-5 text-right">
                    <button 
                        onClick={(e) => onDelete(e, preCalc.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 size={16} />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
