
import React, { useState } from 'react';
import { Discrepancy } from '@/types/inventory';
import { DiscrepancyResolution } from '@/types/enums';
import { AlertOctagon, Save, Pencil, X, Check, Trash2 } from 'lucide-react';

import { useStore } from '@/features/system/context/GlobalStore';

export const DiscrepancyPage: React.FC = () => {
  const { state, actions } = useStore();
  const { discrepancies } = state;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Discrepancy | null>(null);

  const startEditing = (disc: Discrepancy) => {
      setEditingId(disc.id);
      setDraft({ ...disc });
  };

  const cancelEditing = () => {
      setEditingId(null);
      setDraft(null);
  };

  const saveEditing = () => {
      if (draft) {
          actions.updateDiscrepancy(draft);
          setEditingId(null);
          setDraft(null);
      }
  };

  const handleDraftChange = (field: keyof Discrepancy, value: string) => {
      if (draft) {
          setDraft({ ...draft, [field]: value });
      }
  };

  const handleExecuteWriteOff = (disc: Discrepancy) => {
      if (confirm(`Списать со склада ${disc.missingQty} шт. товара ${disc.sku}?`)) {
          actions.writeOffDiscrepancy(disc);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <AlertOctagon className="mr-2 text-red-600" size={28} /> Брак, потери и несоответствия
            </h2>
            <p className="text-gray-500 text-sm mt-1">
                Список позиций, по которым были зафиксированы расхождения при закрытии приемок.
            </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата / ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Документы</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Не хватает</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Причина</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/5">Решение</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Действия</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
                {discrepancies.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">Нет зафиксированных несоответствий</td></tr>
                ) : discrepancies.map(disc => {
                    const isEditing = editingId === disc.id;
                    const data = isEditing && draft ? draft : disc;

                    return (
                    <tr key={disc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">
                            <div className="font-bold text-red-600">{disc.id}</div>
                            <div className="text-xs text-gray-500">{new Date(disc.date).toLocaleDateString('ru-RU')}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                            <div>Пр: <span className="font-mono text-xs">{disc.receptionId}</span></div>
                            <div>Зак: <span className="font-mono text-xs">{disc.orderId}</span></div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                            <div className="font-medium text-gray-900">{disc.productName}</div>
                            <div className="text-xs text-gray-400">{disc.sku}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-red-600">
                            -{disc.missingQty} шт.
                        </td>
                        <td className="px-6 py-4 text-sm">
                            {isEditing ? (
                                <textarea 
                                    className="w-full border rounded p-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                    rows={2}
                                    placeholder="Укажите причину..."
                                    value={data.reason}
                                    onChange={(e) => handleDraftChange('reason', e.target.value)}
                                />
                            ) : (
                                <span className="text-gray-700">{data.reason || '—'}</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                            {isEditing ? (
                                <select 
                                    className={`w-full border rounded p-1 text-sm font-medium ${
                                        data.resolution === DiscrepancyResolution.WRITE_OFF ? 'text-red-700 bg-red-50' :
                                        data.resolution === DiscrepancyResolution.REPAIR ? 'text-orange-700 bg-orange-50' :
                                        data.resolution === DiscrepancyResolution.NEXT_SHIPMENT ? 'text-blue-700 bg-blue-50' : 
                                        'text-gray-700 bg-gray-50'
                                    }`}
                                    value={data.resolution}
                                    onChange={(e) => handleDraftChange('resolution', e.target.value)}
                                >
                                    {Object.values(DiscrepancyResolution).map(res => (
                                        <option key={res} value={res}>{res}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="flex flex-col items-start gap-1">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            data.resolution === DiscrepancyResolution.WRITE_OFF ? 'text-red-700 bg-red-100' :
                                            data.resolution === DiscrepancyResolution.REPAIR ? 'text-orange-700 bg-orange-100' :
                                            data.resolution === DiscrepancyResolution.NEXT_SHIPMENT ? 'text-blue-700 bg-blue-100' : 
                                            'text-gray-700 bg-gray-100'
                                        }`}>
                                        {data.resolution}
                                    </span>
                                    {/* Action Button for Write Off */}
                                    {data.resolution === DiscrepancyResolution.WRITE_OFF && !isEditing && (
                                        <button 
                                            onClick={() => actions.writeOffDiscrepancy(disc)}
                                            className="text-[10px] text-red-600 underline hover:text-red-800 flex items-center"
                                        >
                                            <Trash2 size={10} className="mr-1"/> Провести списание
                                        </button>
                                    )}
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4 text-center">
                            {isEditing ? (
                                <div className="flex justify-center space-x-2">
                                    <button onClick={saveEditing} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                                        <Check size={16}/>
                                    </button>
                                    <button onClick={cancelEditing} className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-gray-200">
                                        <X size={16}/>
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => startEditing(disc)} className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded">
                                    <Pencil size={16}/>
                                </button>
                            )}
                        </td>
                    </tr>
                )})}
            </tbody>
        </table>
      </div>
    </div>
  );
};
