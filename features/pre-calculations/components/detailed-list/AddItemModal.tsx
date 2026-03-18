import React, { useState, useEffect, useMemo } from 'react';
import type { DetailedListItem } from '@/types/pre-calculations';
import type { Product, ProductCategory } from '@/types/product';
import type { OptionType, OptionVariant } from '@/types/options';
import { ProductType } from '@/types/enums'; // Import ProductType enum
import { Currency } from '@/types/currency'; // Import Currency enum
import { v4 as uuidv4 } from 'uuid';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: Omit<DetailedListItem, 'deliveryChinaKzt' | 'deliveryAlmatyKaragandaPerItemKzt' | 'svhPerItemKzt' | 'brokerPerItemKzt' | 'customsFeesPerItemKzt' | 'totalNdsKzt' | 'customsNdsKzt' | 'ndsDifferenceKzt' | 'kpnKzt' | 'profitKzt' | 'marginPercentage' | 'fullCostKzt' | 'preSaleCostKzt' | 'salesBonusKzt' | 'commissioningKzt'>) => void;
}

// Placeholder Data - In a real app, this would come from API calls
const mockProducts: Product[] = [
  {
    id: 'prod1', sku: 'SKU001', name: 'Токарный станок X1', type: ProductType.MACHINE, categoryId: 'cat1', supplierId: 'sup1', manufacturer: 'Manuf A', hsCodeId: 'hs1',
    basePrice: 10000, currency: Currency.USD, markupPercentage: 20, stock: 5, reserved: 2, incoming: 1, minStock: 1,
    workingVolumeM3: 2.5, workingWeightKg: 1200,
    machineConfig: [
      { typeId: 'optType1', allowedVariantIds: ['var1a', 'var1b'], priceOverrides: {}, defaultVariantId: 'var1a' },
      { typeId: 'optType2', allowedVariantIds: ['var2a', 'var2b'], priceOverrides: {}, defaultVariantId: 'var2a' },
    ],
  },
  {
    id: 'prod2', sku: 'SKU002', name: 'Фрезерный станок Y2', type: ProductType.MACHINE, categoryId: 'cat1', supplierId: 'sup1', manufacturer: 'Manuf B', hsCodeId: 'hs2',
    basePrice: 15000, currency: Currency.USD, markupPercentage: 25, stock: 3, reserved: 1, incoming: 0, minStock: 1,
    workingVolumeM3: 3.0, workingWeightKg: 1500,
    machineConfig: [
      { typeId: 'optType1', allowedVariantIds: ['var1a', 'var1b'], priceOverrides: {}, defaultVariantId: 'var1b' },
      { typeId: 'optType2', allowedVariantIds: ['var2a', 'var2b', 'var2c'], priceOverrides: {}, defaultVariantId: 'var2b' },
    ],
  },
  {
    id: 'prod3', sku: 'SKU003', name: 'Подшипник XYZ', type: ProductType.PART, categoryId: 'cat2', supplierId: 'sup2', manufacturer: 'Manuf C', hsCodeId: 'hs3',
    basePrice: 50, currency: Currency.CNY, markupPercentage: 30, stock: 100, reserved: 10, incoming: 20, minStock: 50,
    workingVolumeM3: 0.001, workingWeightKg: 0.5,
  },
  {
    id: 'prod4', sku: 'SKU004', name: 'Резцы комплект', type: ProductType.PART, categoryId: 'cat2', supplierId: 'sup2', manufacturer: 'Manuf D', hsCodeId: 'hs4',
    basePrice: 120, currency: Currency.CNY, markupPercentage: 25, stock: 50, reserved: 5, incoming: 10, minStock: 20,
    workingVolumeM3: 0.005, workingWeightKg: 1.2,
  },
];

const mockCategories: ProductCategory[] = [
  { id: 'cat1', name: 'Станки', type: ProductType.MACHINE },
  { id: 'cat2', name: 'Запчасти', type: ProductType.PART },
];

const mockOptionTypes: OptionType[] = [
  {
    id: 'optType1', name: 'Двигатель', isRequired: true, isSingleSelect: true,
    variants: [
      { id: 'var1a', typeId: 'optType1', name: 'Двигатель 5000 об/мин', price: 2000, currency: Currency.USD },
      { id: 'var1b', typeId: 'optType1', name: 'Двигатель 7000 об/мин', price: 3500, currency: Currency.USD },
    ],
  },
  {
    id: 'optType2', name: 'Система ЧПУ', isRequired: false, isSingleSelect: true,
    variants: [
      { id: 'var2a', typeId: 'optType2', name: 'ЧПУ Базовая', price: 1000, currency: Currency.USD },
      { id: 'var2b', typeId: 'optType2', name: 'ЧПУ Продвинутая', price: 2500, currency: Currency.USD },
      { id: 'var2c', typeId: 'optType2', name: 'ЧПУ Премиум', price: 4000, currency: Currency.USD },
    ],
  },
];

const mockBundles: DetailedListItem[] = [
  // Example of a template bundle
  {
    id: 'bundle1',
    name: 'Шаблон Токарного станка с усиленным двигателем',
    options: ['Двигатель 7000 об/мин', 'ЧПУ Продвинутая'],
    supplierName: 'Supplier',
    manufacturer: 'Manuf A',
    hsCode: 'hs1',
    quantity: 1,
    volumeM3: 2.5,
    ignoreDimensions: false,
    lengthMm: 0,
    widthMm: 0,
    heightMm: 0,
    weightKg: 0,
    deliveryToClientKzt: 0,
    revenueKzt: 0,
    isRevenueConfirmed: false,
    prepaymentKzt: 0,
    isPrepaymentConfirmed: false,
    taxRegime: 'Общ.',
    deliveryChinaKzt: 0,
    deliveryAlmatyKaragandaPerItemKzt: 0,
    svhPerItemKzt: 0,
    brokerPerItemKzt: 0,
    customsFeesPerItemKzt: 0,
    totalNdsKzt: 0,
    customsNdsKzt: 0,
    ndsDifferenceKzt: 0,
    kpnKzt: 0,
    profitKzt: 0,
    marginPercentage: 0,
    fullCostKzt: 0,
    preSaleCostKzt: 0,
    salesBonusKzt: 0,
    commissioningKzt: 0,
  },
];


export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
}) => {
  const [itemType, setItemType] = useState<ProductType>(ProductType.PART);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string | string[]>>({});
  const [optionsMode, setOptionsMode] = useState<'manual' | 'template' | 'stock'>('manual');
  const [selectedBundle, setSelectedBundle] = useState<DetailedListItem | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setItemType(ProductType.PART);
      setSearchTerm('');
      setSelectedCategory('');
      setSelectedProduct(null);
      setSelectedOptions({});
      setOptionsMode('manual');
      setSelectedBundle(null);
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    let products = mockProducts.filter(p => {
      const matchesType = p.type === itemType;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory ? p.categoryId === selectedCategory : true;
      return matchesType && matchesSearch && matchesCategory;
    });
    return products;
  }, [searchTerm, itemType, selectedCategory]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    if (product.type === ProductType.MACHINE && product.machineConfig) {
      const initialOptions: Record<string, string | string[]> = {};
      product.machineConfig.forEach(config => {
        const defaultVariantId = config.defaultVariantId || config.defaultVariantIds?.[0];
        if (defaultVariantId) {
          initialOptions[config.typeId] = defaultVariantId;
        }
      });
      setSelectedOptions(initialOptions);
    } else {
      setSelectedOptions({});
    }
  };

  const handleOptionChange = (optionTypeId: string, variantId: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionTypeId]: variantId,
    }));
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;

    let optionsDescription: string[] = [];
    if (itemType === ProductType.MACHINE && selectedProduct.machineConfig) {
      optionsDescription = Object.entries(selectedOptions).map(([typeId, variantId]) => {
        const optionType = mockOptionTypes.find(ot => ot.id === typeId);
        const variant = optionType?.variants?.find(v => v.id === variantId);
        return variant?.name || 'Unknown Option';
      });
    }

    const newItem: Omit<DetailedListItem, 'deliveryChinaKzt' | 'deliveryAlmatyKaragandaPerItemKzt' | 'svhPerItemKzt' | 'brokerPerItemKzt' | 'customsFeesPerItemKzt' | 'totalNdsKzt' | 'customsNdsKzt' | 'ndsDifferenceKzt' | 'kpnKzt' | 'profitKzt' | 'marginPercentage' | 'fullCostKzt' | 'preSaleCostKzt' | 'salesBonusKzt' | 'commissioningKzt'> = {
      id: uuidv4(),
      name: selectedProduct.name,
      options: optionsDescription.length > 0 ? optionsDescription : undefined,
      supplierName: selectedProduct.supplierProductName || selectedProduct.name + (optionsDescription.length > 0 ? ' ' + optionsDescription.join(' ') : ''), // Placeholder logic
      manufacturer: selectedProduct.manufacturer || 'N/A',
      hsCode: selectedProduct.hsCodeId || 'N/A',
      quantity: 1,
      volumeM3: selectedProduct.workingVolumeM3 || 0,
      ignoreDimensions: selectedProduct.type === ProductType.PART,
      lengthMm: selectedProduct.packages?.[0]?.lengthMm || 0,
      widthMm: selectedProduct.packages?.[0]?.widthMm || 0,
      heightMm: selectedProduct.packages?.[0]?.heightMm || 0,
      weightKg: selectedProduct.workingWeightKg || 0,
      deliveryToClientKzt: 0,
      revenueKzt: selectedProduct.salesPrice || selectedProduct.basePrice * (1 + selectedProduct.markupPercentage / 100),
      isRevenueConfirmed: false,
      prepaymentKzt: 0,
      isPrepaymentConfirmed: false,
      taxRegime: 'Общ.',
    };
    onAddItem(newItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="my-modal">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-bold mb-4">Добавить товар в список</h3>
        <div className="mb-4">
          <label className="inline-flex items-center mr-4">
            <input
              type="radio"
              className="form-radio"
              value={ProductType.PART}
              checked={itemType === ProductType.PART}
              onChange={() => { setItemType(ProductType.PART); setSelectedProduct(null); setSelectedCategory(''); setSearchTerm(''); }}
            />
            <span className="ml-2">Запчасть</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio"
              value={ProductType.MACHINE}
              checked={itemType === ProductType.MACHINE}
              onChange={() => { setItemType(ProductType.MACHINE); setSelectedProduct(null); setSelectedCategory(''); setSearchTerm(''); }}
            />
            <span className="ml-2">Станок (Комплектация)</span>
          </label>
        </div>

        {/* Product Search and Filters */}
        <div className="mb-4">
          <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">Поиск товара</label>
          <input
            type="text"
            id="searchTerm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Название или SKU"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="categoryFilter" className="block text-sm font-medium text-gray-700">Категория</label>
          <select
            id="categoryFilter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          >
            <option value="">Все категории</option>
            {mockCategories.filter(cat => cat.type === itemType).map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        {/* Product List */}
        <div className="mb-4 max-h-60 overflow-y-auto border rounded p-2">
          {filteredProducts.length === 0 ? (
            <p>Нет товаров, соответствующих критериям.</p>
          ) : (
            <ul>
              {filteredProducts.map(product => (
                <li
                  key={product.id}
                  className={`p-2 cursor-pointer hover:bg-blue-100 ${selectedProduct?.id === product.id ? 'bg-blue-200' : ''}`}
                  onClick={() => handleProductSelect(product)}
                >
                  {product.name} ({product.sku})
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedProduct && itemType === ProductType.MACHINE && (
          <div className="mb-4 p-3 border rounded bg-gray-50">
            <h4 className="font-semibold mb-2">Настройка опций для {selectedProduct.name}</h4>
            <div className="mb-2">
              <label className="inline-flex items-center mr-4">
                <input type="radio" className="form-radio" value="manual" checked={optionsMode === 'manual'} onChange={() => setOptionsMode('manual')} />
                <span className="ml-2">Вручную</span>
              </label>
              <label className="inline-flex items-center mr-4">
                <input type="radio" className="form-radio" value="template" checked={optionsMode === 'template'} onChange={() => setOptionsMode('template')} />
                <span className="ml-2">Из готовых шаблонов</span>
              </label>
              <label className="inline-flex items-center">
                <input type="radio" className="form-radio" value="stock" checked={optionsMode === 'stock'} onChange={() => setOptionsMode('stock')} />
                <span className="ml-2">Со склада</span>
              </label>
            </div>

            {optionsMode === 'manual' && selectedProduct.machineConfig && (
              <div className="space-y-3 mt-3">
                {selectedProduct.machineConfig.map(config => {
                  const optionType = mockOptionTypes.find(ot => ot.id === config.typeId);
                  if (!optionType) return null;
                  return (
                    <div key={optionType.id}>
                      <label className="block text-sm font-medium text-gray-700">{optionType.name} {optionType.isRequired && '*'}</label>
                      <select
                        value={selectedOptions[optionType.id] || ''}
                        onChange={(e) => handleOptionChange(optionType.id, e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      >
                        <option value="">Выберите...</option>
                        {optionType.variants?.filter(v => config.allowedVariantIds.includes(v.id)).map(variant => (
                          <option key={variant.id} value={variant.id}>{variant.name} ({variant.price} {variant.currency})</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            {optionsMode === 'template' && (
              <div className="mt-3">
                <label htmlFor="bundleTemplate" className="block text-sm font-medium text-gray-700">Выберите шаблон</label>
                <select
                  id="bundleTemplate"
                  value={selectedBundle?.id || ''}
                  onChange={(e) => {
                    const bundle = mockBundles.find(b => b.id === e.target.value);
                    setSelectedBundle(bundle || null);
                    // Populate selectedOptions based on bundle options if needed
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="">Без шаблона</option>
                  {mockBundles.map(bundle => (
                    <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
                  ))}
                </select>
              </div>
            )}

            {optionsMode === 'stock' && (
              <div className="mt-3 p-3 border rounded bg-yellow-50">
                <p className="text-sm text-gray-700">Функционал выбора опций со склада будет реализован позднее.</p>
              </div>
            )}

          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2"
          >
            Отмена
          </button>
          <button
            onClick={handleAddItem}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            disabled={!selectedProduct || (itemType === ProductType.MACHINE && selectedProduct.type === ProductType.MACHINE && optionsMode === 'manual' && selectedProduct.machineConfig?.some(config => {
              const optionType = mockOptionTypes.find(ot => ot.id === config.typeId);
              return optionType?.isRequired && !selectedOptions[config.typeId];
            }))}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
};
