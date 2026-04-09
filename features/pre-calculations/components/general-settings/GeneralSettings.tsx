import React from 'react';
import { GeneralSettings as GeneralSettingsType, ChinaDomesticRateMethod } from '@/types/pre-calculations';
import {
  Truck,
  Globe,
  Banknote,
  Percent,
  Zap,
  BarChart3,
  DollarSign,
  ShieldAlert,
  Target,
  GanttChartSquare,
  ArrowRightLeft,
  Briefcase,
  Coins,
  Info,
  Package
} from 'lucide-react';

interface GeneralSettingsProps {
  settings: GeneralSettingsType;
  onSettingChange: (key: keyof GeneralSettingsType, value: number) => void;
}

const SettingRow = ({ label, icon: Icon, value, onChange, unit = "" }: any) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors px-2 rounded-lg group">
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="p-1.5 bg-slate-100 rounded-md group-hover:bg-white transition-colors flex-shrink-0">
        {Icon && <Icon size={14} className="text-slate-500" />}
      </div>
      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-tight truncate" title={label}>
        {label}
      </label>
    </div>
    <div className="relative flex-shrink-0">
      <input 
        type="number" 
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 sm:w-28 bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-xs font-black text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-right shadow-inner"
      />
      {unit && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors uppercase">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const SettingsCard = ({ title, icon: Icon, children, colorClass = "text-blue-500" }: any) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow h-fit">
    <div className="flex items-center gap-2.5 mb-1">
      <div className={`p-2 rounded-xl bg-slate-50 ${colorClass} shadow-inner`}>
        <Icon size={16} />
      </div>
      <h3 className="font-black uppercase text-[10px] tracking-widest text-slate-400">{title}</h3>
    </div>
    <div className="flex flex-col gap-0.5">
      {children}
    </div>
  </div>
);

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onSettingChange }) => {
  return (
    <div className="max-w-full mx-auto px-4 py-2 animate-in fade-in duration-500 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

        {/* Logistics & Customs */}
        <SettingsCard title="Логистика" icon={Truck} colorClass="text-blue-500">
          <SettingRow
            label="Доставка Урумчи–Алматы (за м³)"
            icon={Globe}
            value={settings.shippingChinaUsdPerM3}
            onChange={(v: number) => onSettingChange('shippingChinaUsdPerM3', v)}
            unit="$"
          />
          <SettingRow
            label="Курс логистики"
            icon={ArrowRightLeft}
            value={settings.exchangeRateForShipping}
            onChange={(v: number) => onSettingChange('exchangeRateForShipping', v)}
            unit="₸"
          />
          <SettingRow
            label="Доставка Алматы–Кар. (за м³)"
            icon={Truck}
            value={settings.deliveryAlmatyKaragandaKztPerM3}
            onChange={(v: number) => onSettingChange('deliveryAlmatyKaragandaKztPerM3', v)}
            unit="₸/м³"
          />
          <SettingRow
            label="СВХ"
            icon={Briefcase}
            value={settings.svhKzt}
            onChange={(v: number) => onSettingChange('svhKzt', v)}
            unit="₸"
          />
          <SettingRow
            label="Брокер"
            icon={Briefcase}
            value={settings.brokerKzt}
            onChange={(v: number) => onSettingChange('brokerKzt', v)}
            unit="₸"
          />
          <SettingRow
            label="Тамож. сборы"
            icon={ArrowRightLeft}
            value={settings.customsFeesKzt}
            onChange={(v: number) => onSettingChange('customsFeesKzt', v)}
            unit="₸"
          />
        </SettingsCard>

        {/* China domestic delivery */}
        <SettingsCard title="Доставка по Китаю" icon={Package} colorClass="text-sky-500">
          <div className="flex flex-col gap-1.5 py-2 border-b border-slate-50 px-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Метод расчёта</span>
            <div className="flex gap-1.5">
              {([
                { value: 'volume', label: 'Объём' },
                { value: 'weight', label: 'Вес' },
                { value: 'fixed',  label: 'Фикс.' },
              ] as { value: ChinaDomesticRateMethod; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onSettingChange('chinaDomesticRateMethod', opt.value as any)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                    settings.chinaDomesticRateMethod === opt.value
                      ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-sky-300 hover:text-sky-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {settings.chinaDomesticRateMethod === 'volume' && (
            <SettingRow
              label="Рейт за м³"
              icon={Package}
              value={settings.chinaDomesticRatePerM3Usd}
              onChange={(v: number) => onSettingChange('chinaDomesticRatePerM3Usd', v)}
              unit="$"
            />
          )}
          {settings.chinaDomesticRateMethod === 'weight' && (
            <SettingRow
              label="Рейт за тонну"
              icon={Package}
              value={settings.chinaDomesticRatePerTonUsd}
              onChange={(v: number) => onSettingChange('chinaDomesticRatePerTonUsd', v)}
              unit="$"
            />
          )}
          {settings.chinaDomesticRateMethod === 'fixed' && (
            <SettingRow
              label="Цена за ед."
              icon={Package}
              value={settings.chinaDomesticFixedKztPerUnit}
              onChange={(v: number) => onSettingChange('chinaDomesticFixedKztPerUnit', v)}
              unit="₸"
            />
          )}
          <div className="px-2 pt-1 pb-1">
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Курс пересчёта — тот же что у Урумчи–Алматы.<br/>
              Включается в себестоимость и НДС (таможня).
            </p>
          </div>
        </SettingsCard>

        {/* Financial Rates */}
        <SettingsCard title="Валюты" icon={Coins} colorClass="text-emerald-500">
          <SettingRow 
            label="Курс USD" 
            icon={ArrowRightLeft} 
            value={settings.exchangeRateUsd} 
            onChange={(v: number) => onSettingChange('exchangeRateUsd', v)}
            unit="₸" 
          />
          <SettingRow 
            label="Курс CNY" 
            icon={ArrowRightLeft} 
            value={settings.exchangeRateCny} 
            onChange={(v: number) => onSettingChange('exchangeRateCny', v)}
            unit="₸" 
          />
        </SettingsCard>

        {/* Taxes */}
        <SettingsCard title="Налоги" icon={ShieldAlert} colorClass="text-orange-500">
          <SettingRow 
            label="НДС" 
            icon={ShieldAlert} 
            value={settings.ndsRate} 
            onChange={(v: number) => onSettingChange('ndsRate', v)}
            unit="%" 
          />
          <SettingRow 
            label="КПН (Общий)" 
            icon={BarChart3} 
            value={settings.kpn20Rate} 
            onChange={(v: number) => onSettingChange('kpn20Rate', v)}
            unit="%" 
          />
          <SettingRow 
            label="КПН (Упр.)" 
            icon={BarChart3} 
            value={settings.kpn4Rate} 
            onChange={(v: number) => onSettingChange('kpn4Rate', v)}
            unit="%" 
          />
        </SettingsCard>

        {/* Commercial */}
        <div className="space-y-4">
          <SettingsCard title="Коммерция" icon={Target} colorClass="text-purple-500">
            <SettingRow 
              label="Наценка (ресейл)" 
              icon={Target} 
              value={settings.resaleMarkup} 
              onChange={(v: number) => onSettingChange('resaleMarkup', v)}
              unit="%" 
            />
            <SettingRow 
              label="Бонус ОП" 
              icon={Briefcase} 
              value={settings.salesBonusRate} 
              onChange={(v: number) => onSettingChange('salesBonusRate', v)}
              unit="%" 
            />
          </SettingsCard>

          <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg border border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Info size={14} className="text-white" />
              </div>
              <h4 className="font-black uppercase text-[9px] tracking-widest text-blue-400">Информация</h4>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Изменения применяются мгновенно ко всем позициям партии.</p>
          </div>
        </div>

      </div>
    </div>
  );
};
