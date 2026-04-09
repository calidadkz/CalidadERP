
import { useState, useMemo} from 'react';
import { Product, ProductType, ProductCategory } from '@/types';

export type InventorySortKey = 'name' | 'totalCost' | 'unitCost' | 'salesPrice' | 'revenue';

export const useInventoryFilters = (products: Product[], categories: ProductCategory[]) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: InventorySortKey; direction: 'asc' | 'desc' } | null>(null);
    const [activeType, setActiveType] = useState<ProductType>(ProductType.PART);
    const [machineFilter, setMachineFilter] = useState<string | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

    const machineCategories = useMemo(() => categories.filter(c => c.type === ProductType.MACHINE).sort((a, b) => a.name.localeCompare(b.name, 'ru')), [categories]);

    const displayedCategories = useMemo(() => {
        const base = categories.filter(c => c.type === activeType);
        if (activeType === ProductType.MACHINE) return base;
        if (machineFilter === 'all') return base;
        return base.filter(cat => products.some(p => p.type === activeType && p.categoryId === cat.id && (p.compatibleMachineCategoryIds || []).includes(machineFilter)));
    }, [categories, activeType, machineFilter, products]);

    const handleSort = (key: InventorySortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return {
        searchTerm, setSearchTerm,
        sortConfig, handleSort,
        activeType, setActiveType,
        machineFilter, setMachineFilter,
        categoryFilter, setCategoryFilter,
        machineCategories,
        displayedCategories
    };
};
