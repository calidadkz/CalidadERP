
import { useState, useRef } from 'react';
import { Product, ProductType, Currency, PricingMethod } from '@/types';
import { useStore } from '@/features/system/context/GlobalStore';
import { ApiService } from '@/services/api';
import { TableNames } from '@/constants';

export const useNomenclatureImportExport = (selectedType: ProductType) => {
    const { state, actions } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [importStatus, setImportStatus] = useState<{ 
        show: boolean, 
        msg: string, 
        type: 'loading' | 'success' | 'error', 
        details?: string,
        progress?: number,
        total?: number
    }>({ show: false, msg: '', type: 'loading' });

    const handleExportCSV = (filteredProducts: Product[]) => {
        const dataToExport = filteredProducts;
        
        if (dataToExport.length === 0) {
            alert("Нет данных для экспорта с текущими фильтрами");
            return;
        }

        const headers = [
            'SKU', 'Наименование', 'Название для поставщика', 'Тип', 'Категория', 'Поставщик', 'Производитель',
            'Код ТНВЭД', 'Метод расчета цены', 'Цена закупа', 'Валюта', 'Наценка %', 'Цена продажи', 
            'Упаковочные места (ДxШxВxВес)',
            'Рабочая длина', 'Рабочая ширина', 'Рабочая высота', 'Рабочий вес', 
            'Описание', 'Опции (Тип:Варианты)', 'Привязка к станкам'
        ];

        const escapeCsv = (cell: string | number | null | undefined) => {
            if (cell === null || cell === undefined) return '""';
            const str = String(cell);
            return `"${str.replace(/"/g, '""')}"`;
        };

        const rows = dataToExport.map(p => {
            const cat = state.categories.find(c => c.id === p.categoryId)?.name || '';
            const sup = state.counterparties.find(s => s.id === p.supplierId)?.name || '';
            const hs = state.hscodes.find(h => h.id === p.hsCodeId)?.code || '';
            const compat = (p.compatibleMachineCategoryIds || []).map(id => state.categories.find(c => c.id === id)?.name).filter(Boolean).join(', ');
            
            let methodLabel: string = p.pricingMethod || PricingMethod.MARKUP_WITHOUT_VAT;
            if (p.pricingMethod === PricingMethod.PROFILE && p.pricingProfileId) {
                const profile = state.pricingProfiles.find(prof => prof.id === p.pricingProfileId);
                if (profile) methodLabel = profile.name;
            }

            let optionsStr = '';
            if (p.type === ProductType.MACHINE && p.machineConfig) {
                optionsStr = p.machineConfig.map(conf => {
                    const type = state.optionTypes.find(ot => ot.id === conf.typeId);
                    const variants = (conf.allowedVariantIds || []).map(vid => {
                        const ov = state.optionVariants.find(v => v.id === vid);
                        if (!ov) return null;
                        const isDefault = vid === conf.defaultVariantId || (conf.defaultVariantIds || []).includes(vid);
                        return isDefault ? `${ov.name}*` : ov.name;
                    }).filter(Boolean);
                    return type ? `${type.name}:${variants.join(';')}` : '';
                }).filter(Boolean).join('|');
            }
            
            const packagesStr = (p.packages || []).map(pkg => 
                `${pkg.lengthMm || 0}x${pkg.widthMm || 0}x${pkg.heightMm || 0}x${pkg.weightKg || 0}`
            ).join('|');

            return [
                escapeCsv(p.sku), 
                escapeCsv(p.name), 
                escapeCsv(p.supplierProductName || ''),
                escapeCsv(p.type), 
                escapeCsv(cat), 
                escapeCsv(sup), 
                escapeCsv(p.manufacturer || ''),
                escapeCsv(hs), 
                escapeCsv(methodLabel),
                escapeCsv(p.basePrice), 
                escapeCsv(p.currency), 
                escapeCsv(p.markupPercentage), 
                escapeCsv(p.salesPrice), 
                escapeCsv(packagesStr), 
                escapeCsv(p.workingLengthMm || 0),
                escapeCsv(p.workingWidthMm || 0),
                escapeCsv(p.workingHeightMm || 0),
                escapeCsv(p.workingWeightKg || 0),
                escapeCsv(p.description || ''),
                escapeCsv(optionsStr),
                escapeCsv(compat)
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `nomenclature_${selectedType}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportStatus({ show: true, msg: 'Анализ файла...', type: 'loading', progress: 0, total: 100 });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                
                const parseCSV = (text: string): string[][] => {
                    const firstLine = text.split('\n')[0] || '';
                    const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
                    const result: string[][] = [];
                    let row: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const nextChar = text[i + 1];
                        if (inQuotes) {
                            if (char === '"' && nextChar === '"') { current += '"'; i++; } 
                            else if (char === '"') inQuotes = false;
                            else current += char;
                        } else {
                            if (char === '"') inQuotes = true;
                            else if (char === delimiter) { row.push(current); current = ''; }
                            else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                                row.push(current); result.push(row); row = []; current = '';
                                if (char === '\r') i++;
                            } else current += char;
                        }
                    }
                    if (current !== '' || row.length > 0) { row.push(current); result.push(row); }
                    return result.filter(r => r.some(c => c.trim() !== ''));
                };

                const lines = parseCSV(text);
                if (lines.length < 2) throw new Error("Файл пуст или некорректен");

                const headersLine = lines[0].map(h => h.trim().replace(/^\uFEFF/, ''));
                const dataRows = lines.slice(1);
                const totalLines = dataRows.length;
                
                const getHeaderIndex = (headers: string[], possibleNames: string[]): number => {
                    for (const name of possibleNames) {
                        const index = headers.indexOf(name);
                        if (index > -1) return index;
                    }
                    return -1;
                };
                
                const h = {
                    sku: getHeaderIndex(headersLine, ['SKU']),
                    name: getHeaderIndex(headersLine, ['Наименование']),
                    supplierName: getHeaderIndex(headersLine, ['Название для поставщика']),
                    type: getHeaderIndex(headersLine, ['Тип']),
                    category: getHeaderIndex(headersLine, ['Категория']),
                    supplier: getHeaderIndex(headersLine, ['Поставщик']),
                    manufacturer: getHeaderIndex(headersLine, ['Производитель']),
                    hsCode: getHeaderIndex(headersLine, ['Код ТНВЭД']),
                    pricingMethod: getHeaderIndex(headersLine, ['Метод расчета цены']),
                    basePrice: getHeaderIndex(headersLine, ['Цена закупа']),
                    currency: getHeaderIndex(headersLine, ['Валюта']),
                    markup: getHeaderIndex(headersLine, ['Наценка %']),
                };

                if (h.sku === -1 || h.name === -1) {
                    throw new Error("Обязательные колонки SKU и Наименование не найдены");
                }

                const preparedProducts: Product[] = [];

                for (let i = 0; i < dataRows.length; i++) {
                    const row = dataRows[i];
                    setImportStatus({ show: true, msg: 'Обработка данных...', type: 'loading', progress: i + 1, total: totalLines });

                    const sku = row[h.sku];
                    if (!sku) continue;

                    const existingProduct = state.products.find(p => p.sku === sku);
                    const product: Product = existingProduct ? { ...existingProduct } : {
                        id: new ApiService().generateUUID(),
                        sku: sku,
                        name: row[h.name],
                        type: selectedType,
                        currency: Currency.KZT,
                        basePrice: 0,
                        salesPrice: 0,
                    };
                    
                    if (h.name > -1) product.name = row[h.name];
                    if (h.supplierName > -1) product.supplierProductName = row[h.supplierName];
                    if (h.manufacturer > -1) product.manufacturer = row[h.manufacturer];
                    
                    if (h.category > -1) {
                        const categoryName = row[h.category];
                        const cat = state.categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
                        if (cat) product.categoryId = cat.id;
                    }

                    if (h.supplier > -1) {
                        const supplierName = row[h.supplier];
                        const sup = state.counterparties.find(c => c.name.toLowerCase() === supplierName.toLowerCase());
                        if (sup) product.supplierId = sup.id;
                    }

                    if (h.hsCode > -1) {
                        const hsCodeValue = row[h.hsCode];
                        const hs = state.hscodes.find(c => c.code === hsCodeValue);
                        if (hs) product.hsCodeId = hs.id;
                    }

                    if (h.currency > -1) {
                        const currencyValue = row[h.currency].toUpperCase() as Currency;
                        if (Object.values(Currency).includes(currencyValue)) {
                            product.currency = currencyValue;
                        }
                    }

                    if (h.basePrice > -1) product.basePrice = parseFloat(row[h.basePrice].replace(',', '.')) || 0;
                    if (h.markup > -1) product.markupPercentage = parseFloat(row[h.markup].replace(',', '.')) || 0;

                    if (h.pricingMethod > -1) {
                        const methodValue = row[h.pricingMethod];
                        const profile = state.pricingProfiles.find(p => p.name === methodValue);
                        if (profile) {
                            product.pricingMethod = PricingMethod.PROFILE;
                            product.pricingProfileId = profile.id;
                        } else if (Object.values(PricingMethod).includes(methodValue as PricingMethod)) {
                            product.pricingMethod = methodValue as PricingMethod;
                            product.pricingProfileId = undefined;
                        }
                    }

                    preparedProducts.push(product);
                }

                if (preparedProducts.length > 0) {
                    await new ApiService().upsertMany(TableNames.PRODUCTS, preparedProducts, 'sku');
                }
                
                const freshProducts = await new ApiService().fetchAll<Product>(TableNames.PRODUCTS);
                (actions as any).setProducts(freshProducts);

                setImportStatus({ show: true, type: 'success', msg: 'Импорт завершен', details: `Всего обработано: ${totalLines}` });
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                setImportStatus({ show: true, msg: `Ошибка импорта`, type: 'error', details: errorMessage });
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file, 'windows-1251');
    };

    return {
        fileInputRef,
        importStatus,
        setImportStatus,
        handleExportCSV,
        handleFileImport,
    };
};
