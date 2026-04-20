import { useState, useEffect, useCallback } from 'react';
import { ExpenseCategory } from '@/types';
import { supabase } from '@/services/supabaseClient';

export type CategoryCashFlowMap = Partial<Record<ExpenseCategory, string>>;

const TABLE = 'batch_category_defaults';

export const useBatchCategoryMap = () => {
    const [map, setMap] = useState<CategoryCashFlowMap>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase
            .from(TABLE)
            .select('category, cash_flow_item_id')
            .then(({ data, error }) => {
                if (error) { console.error(error); return; }
                const result: CategoryCashFlowMap = {};
                (data ?? []).forEach((row: any) => {
                    result[row.category as ExpenseCategory] = row.cash_flow_item_id;
                });
                setMap(result);
            })
            .then(() => setIsLoading(false), () => setIsLoading(false));
    }, []);

    const update = useCallback(async (category: ExpenseCategory, cashFlowItemId: string | null) => {
        if (cashFlowItemId) {
            const { error } = await supabase
                .from(TABLE)
                .upsert({ category, cash_flow_item_id: cashFlowItemId }, { onConflict: 'category' });
            if (error) { console.error(error); return; }
            setMap(prev => ({ ...prev, [category]: cashFlowItemId }));
        } else {
            const { error } = await supabase
                .from(TABLE)
                .delete()
                .eq('category', category);
            if (error) { console.error(error); return; }
            setMap(prev => {
                const next = { ...prev };
                delete next[category];
                return next;
            });
        }
    }, []);

    const reset = useCallback(async () => {
        const { error } = await supabase.from(TABLE).delete().neq('category', '');
        if (error) { console.error(error); return; }
        setMap({});
    }, []);

    return { map, isLoading, update, reset };
};
