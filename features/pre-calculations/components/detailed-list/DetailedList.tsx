import React, { useState } from 'react';
import { DetailedListItem } from '@/types/pre-calculations';
import { AddItemModal } from './AddItemModal';

interface DetailedListProps {
  items: DetailedListItem[];
  onAddItem: (item: Omit<DetailedListItem, 'deliveryChinaKzt' | 'deliveryAlmatyKaragandaPerItemKzt' | 'svhPerItemKzt' | 'brokerPerItemKzt' | 'customsFeesPerItemKzt' | 'totalNdsKzt' | 'customsNdsKzt' | 'ndsDifferenceKzt' | 'kpnKzt' | 'profitKzt' | 'marginPercentage' | 'fullCostKzt' | 'preSaleCostKzt' | 'salesBonusKzt' | 'commissioningKzt'>) => void;
  onUpdateItem: (id: string, key: keyof DetailedListItem, value: any) => void;
  onDeleteItem: (id: string) => void;
}

export const DetailedList: React.FC<DetailedListProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddItem = (item: Omit<DetailedListItem, 'deliveryChinaKzt' | 'deliveryAlmatyKaragandaPerItemKzt' | 'svhPerItemKzt' | 'brokerPerItemKzt' | 'customsFeesPerItemKzt' | 'totalNdsKzt' | 'customsNdsKzt' | 'ndsDifferenceKzt' | 'kpnKzt' | 'profitKzt' | 'marginPercentage' | 'fullCostKzt' | 'preSaleCostKzt' | 'salesBonusKzt' | 'commissioningKzt'>) => {
    onAddItem(item);
  };

  return (
    <div className="p-4 border rounded shadow-md">
      <h2 className="text-xl font-semibold mb-4">Список с подробностями</h2>
      <button
        onClick={handleOpenModal}
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
      >
        Добавить товар
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Опции</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название для поставщика</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Производитель</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Код ТНВЭД</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Объем (м³)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Не учитывать габариты</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Габариты (ДхШхВ, Вес)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доставка Китай (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доставка Алмата-Караганда (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доставка до клиента (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заказ / Клиент</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Выручка (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Предоплата (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Налоговый режим</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">НДС Итоговый (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">НДС Таможенный (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">НДС Разница (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">КПН (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Прибыль (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рентабельность (%)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Себестоимость полная (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Себестоимость допродажная (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бонус ОП (KZT)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пусконаладка (KZT)</th>
              <th className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.options?.join(', ')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    value={item.supplierName}
                    onChange={(e) => onUpdateItem(item.id, 'supplierName', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{item.manufacturer}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.hsCode}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{item.volumeM3}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={item.ignoreDimensions}
                    onChange={(e) => onUpdateItem(item.id, 'ignoreDimensions', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{item.lengthMm}x{item.widthMm}x{item.heightMm} ({item.weightKg} кг)</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.deliveryChinaKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.deliveryAlmatyKaragandaPerItemKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    value={item.deliveryToClientKzt}
                    onChange={(e) => onUpdateItem(item.id, 'deliveryToClientKzt', parseFloat(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{item.orderId ? `${item.orderId} / ${item.clientName}` : 'Под склад'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    value={item.revenueKzt}
                    onChange={(e) => onUpdateItem(item.id, 'revenueKzt', parseFloat(e.target.value))}
                    className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 ${item.isRevenueConfirmed ? 'bg-gray-100' : ''}`}
                    disabled={item.isRevenueConfirmed}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    value={item.prepaymentKzt}
                    onChange={(e) => onUpdateItem(item.id, 'prepaymentKzt', parseFloat(e.target.value))}
                    className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 ${item.isPrepaymentConfirmed ? 'bg-gray-100' : ''}`}
                    disabled={item.isPrepaymentConfirmed}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={item.taxRegime}
                    onChange={(e) => onUpdateItem(item.id, 'taxRegime', e.target.value as 'Общ.' | 'Упр.')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  >
                    <option value="Общ.">Общ.</option>
                    <option value="Упр.">Упр.</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{item.totalNdsKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.customsNdsKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.ndsDifferenceKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.kpnKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.profitKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    value={item.marginPercentage}
                    onChange={(e) => onUpdateItem(item.id, 'marginPercentage', parseFloat(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{item.fullCostKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.preSaleCostKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.salesBonusKzt}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    value={item.commissioningKzt}
                    onChange={(e) => onUpdateItem(item.id, 'commissioningKzt', parseFloat(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="text-red-600 hover:text-red-900 ml-2"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddItemModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAddItem={handleAddItem}
      />
    </div>
  );
};
