import React from 'react';
import { GeneralSettings } from '@/features/pre-calculations/components/general-settings/GeneralSettings';
import { DetailedList } from '@/features/pre-calculations/components/detailed-list/DetailedList';
import { PackingList } from '@/features/pre-calculations/components/packing-list/PackingList';
import { usePreCalculations } from '@/features/pre-calculations/hooks/usePreCalculations';

export const PreCalculationsPage: React.FC = () => {
  const {
    generalSettings,
    detailedListItems,
    packingListItems,
    updateGeneralSetting,
    addDetailedListItem,
    updateDetailedListItem,
    deleteDetailedListItem,
    addPackingListItem,
    updatePackingListItem,
    deletePackingListItem,
    calculateAll,
  } = usePreCalculations();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Предрасчет</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-1">
          <GeneralSettings settings={generalSettings} onSettingChange={updateGeneralSetting} />
        </div>
        <div className="md:col-span-2">
          <DetailedList
            items={detailedListItems}
            onAddItem={addDetailedListItem}
            onUpdateItem={updateDetailedListItem}
            onDeleteItem={deleteDetailedListItem}
          />
        </div>
      </div>

      <div className="mb-4">
        <PackingList
          items={packingListItems}
          onAddItem={addPackingListItem}
          onUpdateItem={updatePackingListItem}
          onDeleteItem={deletePackingListItem}
        />
      </div>

      <button
        onClick={calculateAll}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Пересчитать все
      </button>
    </div>
  );
};
