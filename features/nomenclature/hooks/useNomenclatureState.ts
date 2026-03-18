
import { useState, useMemo, useEffect } from 'react';
import { Product, ProductType } from '@/types';
import { useStore } from '@/features/system/context/GlobalStore';

export const useNomenclatureState = () => {
    const { state } = useStore();

    const [selectedType, setSelectedType] = useState<ProductType>(ProductType.MACHINE);
    const [selectedMachineCatId, setSelectedMachineCatId] = useState<string | 'all'>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');

    const machineCategories = useMemo(() => {
        return (state.categories || []).filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [state.categories]);

    const subCategoriesWithCounts = useMemo(() => {
        const cats = (state.categories || []).filter(c => c.type === selectedType);
        const mapped = cats.map(cat => {
            const count = (state.products || []).filter(p => {
                const matchType = p.type === selectedType;
                const matchCategory = p.categoryId === cat.id;
                const matchMachine = selectedMachineCatId === 'all' || (p.compatibleMachineCategoryIds || []).includes(selectedMachineCatId);
                return matchType && matchCategory && matchMachine;
            }).length;
            return { ...cat, count };
        });
        return mapped.sort((a, b) => {
            if (a.count > 0 && b.count === 0) return -1;
            if (a.count === 0 && b.count > 0) return 1;
            return a.name.localeCompare(b.name, 'ru');
        });
    }, [state.categories, selectedType, selectedMachineCatId, state.products]);

    const displayedProducts = useMemo(() => {
        return (state.products || []).filter(p => {
            if (p.type !== selectedType) return false;
            if (selectedType === ProductType.MACHINE) {
                return selectedMachineCatId === 'all' || p.categoryId === selectedMachineCatId;
            } else {
                const matchMachine = selectedMachineCatId === 'all' || (p.compatibleMachineCategoryIds || []).includes(selectedMachineCatId);
                const matchCat = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
                return matchMachine && matchCat;
            }
        });
    }, [state.products, selectedType, selectedMachineCatId, selectedCategoryId]);

    const handleTypeChange = (type: ProductType) => {
        setSelectedType(type);
        setSelectedMachineCatId('all');
        setSelectedCategoryId('all');
    };

    return {
        selectedType,
        setSelectedType,
        selectedMachineCatId,
        setSelectedMachineCatId,
        selectedCategoryId,
        setSelectedCategoryId,
        machineCategories,
        subCategoriesWithCounts,
        displayedProducts,
        handleTypeChange,
    };
}; 
