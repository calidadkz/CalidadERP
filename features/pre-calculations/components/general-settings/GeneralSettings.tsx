import React from 'react';
import type { GeneralSettings as IGeneralSettings } from '@/types/pre-calculations';

interface GeneralSettingsProps {
  settings: IGeneralSettings;
  onSettingChange: (key: keyof IGeneralSettings, value: number | string) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onSettingChange,
}) => {
  return (
    <div className="p-4 border rounded shadow-md">
      <h2 className="text-xl font-semibold mb-4">Общие настройки партии</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Тариф доставки по Китаю (USD/куб.м)</label>
          <input
            type="number"
            value={settings.shippingChinaUsdPerM3}
            onChange={(e) => onSettingChange('shippingChinaUsdPerM3', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Курс валюты для доставки</label>
          <input
            type="number"
            value={settings.exchangeRateForShipping}
            onChange={(e) => onSettingChange('exchangeRateForShipping', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Доставка Алмата-Караганда (KZT)</label>
          <input
            type="number"
            value={settings.deliveryAlmatyKaragandaKzt}
            onChange={(e) => onSettingChange('deliveryAlmatyKaragandaKzt', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">СВХ (KZT)</label>
          <input
            type="number"
            value={settings.svhKzt}
            onChange={(e) => onSettingChange('svhKzt', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Брокер (KZT)</label>
          <input
            type="number"
            value={settings.brokerKzt}
            onChange={(e) => onSettingChange('brokerKzt', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Таможенные сборы (KZT)</label>
          <input
            type="number"
            value={settings.customsFeesKzt}
            onChange={(e) => onSettingChange('customsFeesKzt', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">НДС (%)</label>
          <input
            type="number"
            value={settings.ndsRate}
            onChange={(e) => onSettingChange('ndsRate', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">КПН 20% (Общеустановленный режим)</label>
          <input
            type="number"
            value={settings.kpn20Rate}
            onChange={(e) => onSettingChange('kpn20Rate', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">КПН 4% (Упрощенный режим)</label>
          <input
            type="number"
            value={settings.kpn4Rate}
            onChange={(e) => onSettingChange('kpn4Rate', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Наценка при перепродаже (%)</label>
          <input
            type="number"
            value={settings.resaleMarkup}
            onChange={(e) => onSettingChange('resaleMarkup', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Бонус Отделу продаж (%)</label>
          <input
            type="number"
            value={settings.salesBonusRate}
            onChange={(e) => onSettingChange('salesBonusRate', parseFloat(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>
      </div>
    </div>
  );
};
