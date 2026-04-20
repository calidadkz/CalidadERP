import React, { useMemo } from 'react';
import { SlidersHorizontal, RotateCcw, Zap } from 'lucide-react';
import { ExpenseCategory } from '@/types';
import { CashFlowItem } from '@/types/finance';
import { CategoryCashFlowMap } from '../hooks/useBatchCategoryMap';
import { CalidadSelect } from '@/components/ui/CalidadSelect';

interface CategoryDef {
    key: ExpenseCategory;
    label: string;
    group: string;
}

const CATEGORIES: CategoryDef[] = [
    // Логистика
    { key: 'logistics_urumqi_almaty',    label: 'Доставка Урумчи–Алматы',      group: 'Логистика' },
    { key: 'logistics_almaty_karaganda', label: 'Доставка Алматы–Кар.',         group: 'Логистика' },
    { key: 'logistics_china_domestic',   label: 'Доставка по Китаю',            group: 'Логистика' },
    { key: 'delivery_local',             label: 'Доставка до клиента',          group: 'Логистика' },
    // Таможня
    { key: 'svh',                        label: 'СВХ',                          group: 'Таможня' },
    { key: 'broker',                     label: 'Брокер',                       group: 'Таможня' },
    { key: 'customs',                    label: 'Таможенные сборы',             group: 'Таможня' },
    // Налоги
    { key: 'customs_vat',                label: 'НДС Таможенный',               group: 'Налоги' },
    { key: 'sales_vat',                  label: 'НДС итог. при продаже',        group: 'Налоги' },
    { key: 'resale_vat',                 label: 'НДС перепродажи (Упр.)',       group: 'Налоги' },
    { key: 'kpn_simplified',             label: 'КПН (Упр.)',                   group: 'Налоги' },
    { key: 'kpn_standard',               label: 'КПН20',                        group: 'Налоги' },
    // Прочее
    { key: 'pnr',                        label: 'Пусконаладка',                 group: 'Прочее' },
    { key: 'other',                      label: 'Прочее',                       group: 'Прочее' },
];

interface BatchCategoryMappingTabProps {
    categoryMap: CategoryCashFlowMap;
    cashFlowItems: CashFlowItem[];
    onUpdate: (category: ExpenseCategory, cashFlowItemId: string | null) => void;
    onReset: () => void;
}

export const BatchCategoryMappingTab: React.FC<BatchCategoryMappingTabProps> = ({
    categoryMap,
    cashFlowItems,
    onUpdate,
    onReset,
}) => {
    const mappedCount = Object.keys(categoryMap).length;

    const cfiOptions = useMemo(() =>
        cashFlowItems
            .filter(c => !c.isGroup)
            .map(c => ({ id: c.id, label: c.name })),
        [cashFlowItems]
    );

    // Группируем категории
    const groups = CATEGORIES.reduce<Record<string, CategoryDef[]>>((acc, cat) => {
        if (!acc[cat.group]) acc[cat.group] = [];
        acc[cat.group].push(cat);
        return acc;
    }, {});

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6 space-y-6 max-w-2xl mx-auto">

                {/* Заголовок */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <SlidersHorizontal size={16} className="text-slate-500" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">
                                Приоритеты статей ДДС
                            </h2>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed max-w-md">
                            Для каждого вида расхода укажите статью ДДС. Аллокации по этой статье будут
                            показаны первыми при внесении реального расхода по любой партии.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            {mappedCount} / {CATEGORIES.length}
                        </span>
                        {mappedCount > 0 && (
                            <button
                                onClick={onReset}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 border border-red-100 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                            >
                                <RotateCcw size={10} /> Сбросить всё
                            </button>
                        )}
                    </div>
                </div>

                {/* Таблица по группам */}
                {Object.entries(groups).map(([groupName, cats]) => (
                    <div key={groupName} className="rounded-2xl border border-slate-200">
                        {/* Заголовок группы */}
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {groupName}
                            </span>
                        </div>

                        {/* Строки */}
                        <div className="divide-y divide-slate-50">
                            {cats.map(cat => {
                                const selectedId = categoryMap[cat.key] || '';
                                const selectedItem = cashFlowItems.find(c => c.id === selectedId);
                                const hasPriority = !!selectedId;

                                return (
                                    <div key={cat.key} className="flex items-center gap-4 px-5 py-3">
                                        {/* Индикатор */}
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            hasPriority ? 'bg-violet-500' : 'bg-slate-200'
                                        }`} />

                                        {/* Категория расхода */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-black text-slate-700">{cat.label}</div>
                                            <div className="text-[8px] font-mono text-slate-300 uppercase">{cat.key}</div>
                                        </div>

                                        {/* Индикатор приоритета */}
                                        {hasPriority && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Zap size={9} className="text-violet-400" />
                                            </div>
                                        )}

                                        {/* Дропдаун статьи — CalidadSelect */}
                                        <div className="w-56 shrink-0">
                                            <CalidadSelect
                                                options={cfiOptions}
                                                value={selectedId}
                                                onChange={v => onUpdate(cat.key, v || null)}
                                                placeholder="— не задано —"
                                                nullLabel="— не задано —"
                                                dropdownMinWidth="280px"
                                                zIndex="z-[200]"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Подсказка */}
                <div className="flex items-start gap-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">Справка</span>
                    <p className="text-[9px] text-slate-500 font-bold leading-relaxed">
                        Настройка применяется ко всем партиям и сохраняется в базе данных.
                    </p>
                </div>
            </div>
        </div>
    );
};
