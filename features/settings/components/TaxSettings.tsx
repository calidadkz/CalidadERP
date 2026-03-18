
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Percent, Save } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';

interface TaxSettingsData {
    vatRate: number;
    simplifiedTaxRate: number;
}

const SettingsInput = ({ id, label, helpText, control, name, unit, disabled }: any) => (
    <div className="grid grid-cols-3 items-center gap-4">
        <div className="col-span-2">
            <Label htmlFor={id} className="font-semibold">{label}</Label>
            <p className="text-xs text-slate-500 mt-1">{helpText}</p>
        </div>
        <div className="relative">
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <Input
                        {...field}
                        id={id}
                        type="number"
                        className="font-mono text-right pr-8"
                        disabled={disabled}
                    />
                )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono">{unit}</span>
        </div>
    </div>
);

export const TaxSettings: React.FC = () => {
    const { control, handleSubmit, formState: { isDirty, isSubmitting } } = useForm<TaxSettingsData>({
        // Здесь должны быть значения по умолчанию, загруженные из API
        defaultValues: {
            vatRate: 12,
            simplifiedTaxRate: 3,
        }
    });

    const onSubmit = (data: TaxSettingsData) => {
        console.log("Saving tax settings:", data);
        // Здесь будет логика сохранения данных
    };

    // В реальном приложении, права на запись будут проверяться через useAccess
    const canWrite = true; 

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Percent size={18} className="text-slate-500" />
                            Налоги и Сборы
                        </CardTitle>
                    </div>
                    {canWrite && (
                         <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={!isDirty || isSubmitting}>
                            <Save size={14} className="mr-2" />
                            Сохранить
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                <SettingsInput
                    id="vat-rate"
                    name="vatRate"
                    label="Ставка НДС"
                    helpText="Основная ставка налога на добавленную стоимость."
                    control={control}
                    unit="%"
                    disabled={!canWrite}
                />
                 <SettingsInput
                    id="simplified-tax-rate"
                    name="simplifiedTaxRate"
                    label="Ставка Упрощенного режима"
                    helpText="Единый налог для упрощенного режима налогообложения."
                    control={control}
                    unit="%"
                    disabled={!canWrite}
                />
            </CardContent>
        </Card>
    );
};
