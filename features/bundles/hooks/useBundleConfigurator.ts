
import { useState, useCallback } from 'react';

export const useBundleConfigurator = (initialBaseId: string = '') => {
  const [categoryId, setCategoryId] = useState('');
  const [baseMachineId, setBaseMachineId] = useState(initialBaseId);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [expandedTypeIds, setExpandedTypeIds] = useState<string[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');

  const toggleOption = useCallback((typeId: string, variantId: string, isSingle: boolean, isRequired: boolean) => {
    setSelectedOptions(prev => {
      const current = prev[typeId] || [];
      if (isSingle) {
        if (current.includes(variantId)) {
          // Если опция обязательная и это единственный выбор - ничего не делаем
          if (isRequired && current.length === 1) return prev;
          // В остальных случаях - снимаем выбор
          return { ...prev, [typeId]: [] };
        } else {
          // Если не выбрана - просто выбираем
          return { ...prev, [typeId]: [variantId] };
        }
      } else {
        if (current.includes(variantId)) return { ...prev, [typeId]: current.filter(id => id !== variantId) };
        return { ...prev, [typeId]: [...current, variantId] };
      }
    });
  }, []);

  const toggleAccordion = useCallback((id: string) => {
    setExpandedTypeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const resetSelection = useCallback((newBaseId: string) => {
    setBaseMachineId(newBaseId);
    setSelectedOptions({});
    setExpandedTypeIds([]);
    setBundleName('');
    setBundleDescription('');
  }, []);

  return {
    categoryId, setCategoryId,
    baseMachineId, setBaseMachineId,
    selectedOptions, setSelectedOptions,
    expandedTypeIds, setExpandedTypeIds,
    bundleName, setBundleName,
    bundleDescription, setBundleDescription,
    toggleOption, toggleAccordion, resetSelection
  };
};
