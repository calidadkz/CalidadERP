
import React from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { TaxSettings } from '@/types';
import { Save, Percent } from 'lucide-react';
import { InputField } from '@/components/ui/InputField';

export const TaxSettingsManager: React.FC = () => {
    const { state, actions } = useStore();
    
    const settings = state.taxSettings || {
        id: 'default',
        intercompanyMarkupPercent: 1,
        citRateStandard: 0,
        citRateSimplified: 4
    };

    const setSettings = (newSettings: Partial<TaxSettings>) => {
        actions.updateTaxSettings({ ...settings, ...newSettings });
    };

    const handleSave = () => {
        actions.updateTaxSettings(settings);
        alert('Настройки налогов сохранены!');
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                    <Percent size={20}/> Настройки налогообложения
                </h3>
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                >
                    <Save size={14}/> Сохранить
                </button>
            </div>

            <p className="text-sm text-slate-500 mb-6">Здесь настраиваются параметры для расчета налогов в предрасчетах, включая схему работы через компанию на упрощенном режиме.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputField 
                    label="Наценка для перепродажи (%)"
                    type="number"
                    value={settings.intercompanyMarkupPercent || ''}
                    onChange={e => setSettings({ intercompanyMarkupPercent: parseFloat(e.target.value) || 0 })}
                    helpText="Наценка при внутренней продаже со стандартного режима на упрощенный."
                />
                <InputField 
                    label="КПН для ОУР (% от прибыли)"
                    type="number"
                    value={settings.citRateStandard || ''}
                    onChange={e => setSettings({ citRateStandard: parseFloat(e.target.value) || 0 })}
                    helpText="Корпоративный подоходный налог для общеустановленного режима."
                />
                <InputField 
                    label="КПН для Упрощенки (% от выручки)"
                    type="number"
                    value={settings.citRateSimplified || ''}
                    onChange={e => setSettings({ citRateSimplified: parseFloat(e.target.value) || 0 })}
                    helpText="Единый налог для упрощенного режима налогообложения."
                />
            </div>
        </div>
    );
};
