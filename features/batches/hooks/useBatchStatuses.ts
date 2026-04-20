import { useState, useEffect } from 'react';
import { BatchStatusRecord } from '@/types';
import { api } from '@/services';
import { TableNames } from '@/constants';

// Цвета Tailwind для каждого color-slug из БД
const COLOR_CLASSES: Record<string, { badge: string; icon: string }> = {
    blue:   { badge: 'bg-blue-50 text-blue-600 border-blue-100',     icon: 'text-blue-400' },
    violet: { badge: 'bg-violet-50 text-violet-600 border-violet-100', icon: 'text-violet-400' },
    amber:  { badge: 'bg-amber-50 text-amber-600 border-amber-100',   icon: 'text-amber-400' },
    orange: { badge: 'bg-orange-50 text-orange-600 border-orange-100', icon: 'text-orange-400' },
    red:    { badge: 'bg-red-50 text-red-600 border-red-100',         icon: 'text-red-400' },
    teal:   { badge: 'bg-teal-50 text-teal-600 border-teal-100',      icon: 'text-teal-400' },
    indigo: { badge: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: 'text-indigo-400' },
    emerald:{ badge: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: 'text-emerald-400' },
    slate:  { badge: 'bg-slate-100 text-slate-500 border-slate-200',  icon: 'text-slate-400' },
};

export const getStatusColors = (color: string) =>
    COLOR_CLASSES[color] ?? COLOR_CLASSES['slate'];

export const useBatchStatuses = () => {
    const [statuses, setStatuses] = useState<BatchStatusRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.fetchAll<BatchStatusRecord>(TableNames.BATCH_STATUSES, 'sort_order')
            .then(setStatuses)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const getStatus = (id: string) =>
        statuses.find(s => s.id === id) ?? { id, label: id, sortOrder: 0, color: 'slate' } as BatchStatusRecord;

    return { statuses, isLoading, getStatus };
};
