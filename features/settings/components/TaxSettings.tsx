
import React from 'react';
import { useStore } from '@/features/system/context/GlobalStore';
import { Percent, Save } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { GeneralSettings } from '@/types';

type TaxFormData = Pick<GeneralSettings, 'ndsRate' | 'kpn20Rate' | 'kpn4Rate' | 'resaleMarkup'>;

const SettingsInput = ({ id, label, helpText, control, name, unit, disabled }: any) => (
    <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
        <div className="md:col-span-2">
            <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}</label>
            <p className="text-xs text-slate-500 mt-1">{helpText}</p>
        </div>
        <div className="relative">
            <Controller
                name={name}
                control={control}
                render={({ field: { value, onChange, onBlur } }) => (
                    <input
                        id={id}
                        type="number"
                        step="0.1"
                        value={value ?? ''}
                        onBlur={onBlur}
                        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                        className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-mono text-right pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={disabled}
                    />
                )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono">{unit}</span>
        </div>
    </div>
);

export const TaxSettings: React.FC = () => {
    const { state, actions } = useStore();
    const { generalSettings } = state;

    const { control, handleSubmit, formState: { isDirty, isSubmitting }, reset } = useForm<TaxFormData>({
        defaultValues: {
            ndsRate: generalSettings?.ndsRate ?? 12,
            kpn20Rate: generalSettings?.kpn20Rate ?? 20,
            kpn4Rate: generalSettings?.kpn4Rate ?? 3,
            resaleMarkup: generalSettings?.resaleMarkup ?? 1,
        }
    });

    // Обновляем форму, если системные настройки подгрузились позже
    React.useEffect(() => {
        if (generalSettings) {
            reset({
                ndsRate: generalSettings.ndsRate,
                kpn20Rate: generalSettings.kpn20Rate,
                kpn4Rate: generalSettings.kpn4Rate,
                resaleMarkup: generalSettings.resaleMarkup,
            });
        }
    }, [generalSettings, reset]);

    const onSubmit = async (data: TaxFormData) => {
        try {
            // В GlobalStore updateGeneralSetting обновляет по одному ключу
            Object.entries(data).forEach(([key, value]) => {
                actions.updateGeneralSetting(key as keyof GeneralSettings, value);
            });
            
            // Здесь должна быть логика сохранения в БД, если GlobalStore это делает сам при вызове updateGeneralSetting
            // В текущей реализации GlobalStore.tsx сохранение в БД при вызове updateGeneralSetting не реализовано (только локальное состояние)
            // Но в StoreProvider.load() настройки грузятся из PRE_CALCULATIONS
            
            alert('Настройки налогов обновлены локально. Не забудьте сохранить проект (если требуется).');
        } catch (error) {
            console.error("Error saving tax settings:", error);
            alert('Ошибка при сохранении настроек.');
        }
    };

    const canWrite = true; // Можно добавить проверку прав через useAccess

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Percent size={18} className="text-blue-600" />
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">Налоги и Сборы</h3>
                </div>
                {canWrite && (
                    <button 
                        onClick={handleSubmit(onSubmit)} 
                        disabled={!isDirty || isSubmitting}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black uppercase tracking-widest rounded-xl shadow-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        <Save size={14} className="mr-2" />
                        Сохранить
                    </button>
                )}
            </div>
            <div className="p-6 space-y-6">
                <SettingsInput
                    id="nds-rate"
                    name="ndsRate"
                    label="Ставка НДС"
                    helpText="Основная ставка налога на добавленную стоимость для ОСН."
                    control={control}
                    unit="%"
                    disabled={!canWrite}
                />
                 <SettingsInput
                    id="kpn20-rate"
                    name="kpn20Rate"
                    label="КПН ОСН (20%)"
                    helpText="Корпоративный подоходный налог для общеустановленного режима от прибыли."
                    control={control}
                    unit="%"
                    disabled={!canWrite}
                />
                <SettingsInput
                    id="kpn4-rate"
                    name="kpn4Rate"
                    label="Налог на Упрощенном режиме"
                    helpText="Единый налог (КПН/ИПН) от всей выручки для упрощенного режима."
                    control={control}
                    unit="%"
                    disabled={!canWrite}
                />
                <SettingsInput
                    id="resale-markup"
                    name="resaleMarkup"
                    label="Наценка при перепродаже"
                    helpText="Наценка при продаже товара между своими компаниями (напр. с ОСН на УСН)."
                    control={control}
                    unit="%"
                    disabled={!canWrite}
                />
            </div>
        </div>
    );
};
