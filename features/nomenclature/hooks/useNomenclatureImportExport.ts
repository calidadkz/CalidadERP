
import { useState, useRef } from 'react';
import { Product, ProductType, Currency, PricingMethod, MachineConfigEntry } from '@/types';
import { useStore } from '@/features/system/context/GlobalStore';
import { api, ApiService } from '@/services/api';
import { TableNames } from '@/constants';

export const useNomenclatureImportExport = (selectedType: ProductType) => {
    const { state, actions } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [importStatus, setImportStatus] = useState<{
        show: boolean;
        msg: string;
        type: 'loading' | 'success' | 'error';
        details?: string;
        progress?: number;
        total?: number;
    }>({ show: false, msg: '', type: 'loading' });

    // ─── EXPORT ──────────────────────────────────────────────────────────────

    const handleExportCSV = (filteredProducts: Product[]) => {
        if (filteredProducts.length === 0) {
            alert('Нет данных для экспорта с текущими фильтрами');
            return;
        }

        const headers = [
            'SKU', 'Наименование', 'Название для поставщика', 'Тип', 'Категория', 'Поставщик', 'Производитель',
            'Код ТНВЭД', 'Метод расчета цены', 'Цена закупа', 'Валюта', 'Наценка %', 'Цена продажи',
            'Упаковочные места (ДxШxВxВес)',
            'Рабочая длина', 'Рабочая ширина', 'Рабочая высота', 'Рабочий вес',
            'Описание', 'Опции (Тип:Вариант[=цена][*];...)', 'Привязка к станкам',
        ];

        const esc = (cell: string | number | null | undefined) => {
            if (cell === null || cell === undefined) return '""';
            const str = String(cell);
            return `"${str.replace(/"/g, '""')}"`;
        };

        const rows = filteredProducts.map(p => {
            const cat   = state.categories.find(c => c.id === p.categoryId)?.name || '';
            const sup   = state.counterparties.find(s => s.id === p.supplierId)?.name || '';
            const hs    = state.hscodes.find(h => h.id === p.hsCodeId)?.code || '';
            const compat = (p.compatibleMachineCategoryIds || [])
                .map(id => state.categories.find(c => c.id === id)?.name)
                .filter(Boolean).join(', ');

            let methodLabel: string = p.pricingMethod || PricingMethod.MARKUP_WITHOUT_VAT;
            if (p.pricingMethod === PricingMethod.PROFILE && p.pricingProfileId) {
                const profile = state.pricingProfiles.find(prof => prof.id === p.pricingProfileId);
                if (profile) methodLabel = profile.name;
            }

            // Options: TypeName:VariantName[=priceOverride][*];... | TypeName2:...
            // * marks defaults; =price marks a custom price override for this machine
            let optionsStr = '';
            if (p.type === ProductType.MACHINE && p.machineConfig) {
                optionsStr = p.machineConfig.map(conf => {
                    const optType = state.optionTypes.find(ot => ot.id === conf.typeId);
                    if (!optType) return '';

                    const variantParts = (conf.allowedVariantIds || []).map(vid => {
                        const ov = state.optionVariants.find(v => v.id === vid);
                        if (!ov) return null;

                        const isDefault = vid === conf.defaultVariantId ||
                            (conf.defaultVariantIds || []).includes(vid);
                        const override = conf.priceOverrides?.[vid];

                        // Format: VariantName[=override][*]
                        let part = ov.name;
                        if (override !== undefined && override !== ov.price) {
                            part += `=${override}`;
                        }
                        if (isDefault) part += '*';
                        return part;
                    }).filter(Boolean);

                    return `${optType.name}:${variantParts.join(';')}`;
                }).filter(Boolean).join('|');
            }

            const packagesStr = (p.packages || [])
                .map(pkg => `${pkg.lengthMm || 0}x${pkg.widthMm || 0}x${pkg.heightMm || 0}x${pkg.weightKg || 0}`)
                .join('|');

            return [
                esc(p.sku),
                esc(p.name),
                esc(p.supplierProductName || ''),
                esc(p.type),
                esc(cat),
                esc(sup),
                esc(p.manufacturer || ''),
                esc(hs),
                esc(methodLabel),
                esc(p.basePrice),
                esc(p.currency),
                esc(p.markupPercentage),
                esc(p.salesPrice ?? ''),
                esc(packagesStr),
                esc(p.workingLengthMm ?? ''),
                esc(p.workingWidthMm ?? ''),
                esc(p.workingHeightMm ?? ''),
                esc(p.workingWeightKg ?? ''),
                esc(p.description || ''),
                esc(optionsStr),
                esc(compat),
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `nomenclature_${selectedType}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // ─── IMPORT ──────────────────────────────────────────────────────────────

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportStatus({ show: true, msg: 'Анализ файла...', type: 'loading', progress: 0, total: 100 });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;

                // ── CSV parser ──────────────────────────────────────────────
                const parseCSV = (raw: string): string[][] => {
                    const firstLine = raw.split('\n')[0] || '';
                    const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
                    const result: string[][] = [];
                    let row: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < raw.length; i++) {
                        const ch = raw[i];
                        const next = raw[i + 1];
                        if (inQuotes) {
                            if (ch === '"' && next === '"') { current += '"'; i++; }
                            else if (ch === '"') inQuotes = false;
                            else current += ch;
                        } else {
                            if (ch === '"') inQuotes = true;
                            else if (ch === delimiter) { row.push(current); current = ''; }
                            else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                                row.push(current); result.push(row); row = []; current = '';
                                if (ch === '\r') i++;
                            } else current += ch;
                        }
                    }
                    if (current !== '' || row.length > 0) { row.push(current); result.push(row); }
                    return result.filter(r => r.some(c => c.trim() !== ''));
                };

                const lines = parseCSV(text);
                if (lines.length < 2) throw new Error('Файл пуст или некорректен');

                const headersLine = lines[0].map(h => h.trim().replace(/^\uFEFF/, ''));
                const dataRows = lines.slice(1);
                const totalLines = dataRows.length;

                const col = (names: string[]) => {
                    for (const name of names) {
                        const i = headersLine.indexOf(name);
                        if (i > -1) return i;
                    }
                    return -1;
                };

                // Map all exported columns to indices
                const h = {
                    sku:           col(['SKU']),
                    name:          col(['Наименование']),
                    supplierName:  col(['Название для поставщика']),
                    type:          col(['Тип']),
                    category:      col(['Категория']),
                    supplier:      col(['Поставщик']),
                    manufacturer:  col(['Производитель']),
                    hsCode:        col(['Код ТНВЭД']),
                    pricingMethod: col(['Метод расчета цены']),
                    basePrice:     col(['Цена закупа']),
                    currency:      col(['Валюта']),
                    markup:        col(['Наценка %']),
                    // salesPrice intentionally skipped — it's a computed field
                    packages:      col(['Упаковочные места (ДxШxВxВес)']),
                    workingLength: col(['Рабочая длина']),
                    workingWidth:  col(['Рабочая ширина']),
                    workingHeight: col(['Рабочая высота']),
                    workingWeight: col(['Рабочий вес']),
                    description:   col(['Описание']),
                    options:       col(['Опции (Тип:Варианты)', 'Опции (Тип:Вариант[=цена][*];...)']),
                    compat:        col(['Привязка к станкам']),
                };

                if (h.sku === -1 || h.name === -1) {
                    throw new Error('Обязательные колонки SKU и Наименование не найдены');
                }

                const preparedProducts: Product[] = [];

                for (let i = 0; i < dataRows.length; i++) {
                    const row = dataRows[i];
                    setImportStatus({ show: true, msg: 'Обработка данных...', type: 'loading', progress: i + 1, total: totalLines });

                    const sku = row[h.sku]?.trim();
                    if (!sku) continue;

                    const existingProduct = state.products.find(p => p.sku === sku);
                    const product: Product = existingProduct ? { ...existingProduct } : {
                        id: ApiService.generateUUID(),
                        sku,
                        name: row[h.name] || '',
                        type: selectedType,
                        currency: Currency.Kzt,
                        basePrice: 0,
                        salesPrice: 0,
                        markupPercentage: 0,
                        stock: 0,
                        reserved: 0,
                        incoming: 0,
                        minStock: 0,
                    };

                    // ── Basic string fields ───────────────────────────────
                    if (h.name > -1)         product.name = row[h.name] || product.name;
                    if (h.supplierName > -1) product.supplierProductName = row[h.supplierName] || undefined;
                    if (h.manufacturer > -1) product.manufacturer = row[h.manufacturer] || undefined;
                    if (h.description > -1)  product.description  = row[h.description]  || undefined;

                    // ── Lookups ───────────────────────────────────────────
                    if (h.category > -1 && row[h.category]) {
                        const cat = state.categories.find(c => c.name.toLowerCase() === row[h.category].toLowerCase());
                        if (cat) product.categoryId = cat.id;
                    }

                    if (h.supplier > -1 && row[h.supplier]) {
                        const sup = state.counterparties.find(c => c.name.toLowerCase() === row[h.supplier].toLowerCase());
                        if (sup) product.supplierId = sup.id;
                    }

                    if (h.hsCode > -1 && row[h.hsCode]) {
                        const hs = state.hscodes.find(c => c.code === row[h.hsCode]);
                        if (hs) product.hsCodeId = hs.id;
                    }

                    // ── Currency ──────────────────────────────────────────
                    if (h.currency > -1 && row[h.currency]) {
                        const cur = row[h.currency].toUpperCase() as Currency;
                        if (Object.values(Currency).includes(cur)) product.currency = cur;
                    }

                    // ── Numeric fields ────────────────────────────────────
                    if (h.basePrice > -1 && row[h.basePrice])
                        product.basePrice = parseFloat(row[h.basePrice].replace(',', '.')) || 0;
                    if (h.markup > -1 && row[h.markup])
                        product.markupPercentage = parseFloat(row[h.markup].replace(',', '.')) || 0;

                    if (h.workingLength > -1 && row[h.workingLength])
                        product.workingLengthMm = parseFloat(row[h.workingLength].replace(',', '.')) || undefined;
                    if (h.workingWidth > -1 && row[h.workingWidth])
                        product.workingWidthMm  = parseFloat(row[h.workingWidth].replace(',', '.'))  || undefined;
                    if (h.workingHeight > -1 && row[h.workingHeight])
                        product.workingHeightMm = parseFloat(row[h.workingHeight].replace(',', '.')) || undefined;
                    if (h.workingWeight > -1 && row[h.workingWeight])
                        product.workingWeightKg = parseFloat(row[h.workingWeight].replace(',', '.')) || undefined;

                    // ── Pricing method / profile ──────────────────────────
                    if (h.pricingMethod > -1 && row[h.pricingMethod]) {
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

                    // ── Packages ──────────────────────────────────────────
                    if (h.packages > -1 && row[h.packages]) {
                        const pkgs = row[h.packages].split('|')
                            .map(pkgStr => {
                                const parts = pkgStr.split('x').map(v => parseFloat(v) || 0);
                                const [l = 0, w = 0, ht = 0, wt = 0] = parts;
                                return {
                                    id: ApiService.generateUUID(),
                                    lengthMm: l,
                                    widthMm:  w,
                                    heightMm: ht,
                                    weightKg: wt,
                                    volumeM3: (l * w * ht) / 1_000_000_000,
                                };
                            })
                            .filter(pkg => pkg.lengthMm || pkg.widthMm || pkg.heightMm || pkg.weightKg);
                        if (pkgs.length > 0) product.packages = pkgs;
                    }

                    // ── Compatible machine categories (for parts) ─────────
                    if (h.compat > -1 && row[h.compat]) {
                        const names = row[h.compat].split(',').map(n => n.trim()).filter(Boolean);
                        const ids = names
                            .map(name => state.categories.find(c => c.name === name)?.id)
                            .filter(Boolean) as string[];
                        if (ids.length > 0) product.compatibleMachineCategoryIds = ids;
                    }

                    // ── Machine options (the critical part) ───────────────
                    // Format: TypeName:VariantName[=priceOverride][*];... | TypeName2:...
                    // * = default variant for the machine
                    // =price = custom price override for this machine (differs from variant base price)
                    if (h.options > -1 && row[h.options] && product.type === ProductType.MACHINE) {
                        const optionsRaw = row[h.options].trim();
                        if (optionsRaw) {
                            const machineConfig: MachineConfigEntry[] = [];

                            const typeGroups = optionsRaw.split('|').filter(Boolean);
                            for (const group of typeGroups) {
                                const colonIdx = group.indexOf(':');
                                if (colonIdx === -1) continue;

                                const typeName    = group.substring(0, colonIdx).trim();
                                const variantsStr = group.substring(colonIdx + 1);

                                const optType = state.optionTypes.find(ot => ot.name === typeName);
                                if (!optType) continue; // unknown option type — skip

                                const allowedVariantIds: string[] = [];
                                const priceOverrides: Record<string, number> = {};
                                const defaultVariantIds: string[] = [];

                                for (let vPart of variantsStr.split(';').filter(Boolean)) {
                                    // Strip default marker
                                    const isDefault = vPart.endsWith('*');
                                    if (isDefault) vPart = vPart.slice(0, -1);

                                    // Split off price override: VariantName=12345
                                    let variantName = vPart;
                                    let priceOverride: number | null = null;
                                    const eqIdx = vPart.lastIndexOf('=');
                                    if (eqIdx > -1) {
                                        variantName = vPart.substring(0, eqIdx).trim();
                                        const parsed = parseFloat(vPart.substring(eqIdx + 1));
                                        if (!isNaN(parsed)) priceOverride = parsed;
                                    }

                                    const optVariant = state.optionVariants.find(
                                        v => v.typeId === optType.id && v.name === variantName
                                    );
                                    if (!optVariant) continue; // variant not found by name — skip

                                    allowedVariantIds.push(optVariant.id);
                                    if (priceOverride !== null) {
                                        priceOverrides[optVariant.id] = priceOverride;
                                    }
                                    if (isDefault) {
                                        defaultVariantIds.push(optVariant.id);
                                    }
                                }

                                if (allowedVariantIds.length > 0) {
                                    machineConfig.push({
                                        typeId: optType.id,
                                        allowedVariantIds,
                                        priceOverrides,
                                        defaultVariantIds,
                                        defaultVariantId: defaultVariantIds[0], // legacy single-default field
                                    });
                                }
                            }

                            // Only overwrite if we actually parsed something
                            if (machineConfig.length > 0) {
                                product.machineConfig = machineConfig;
                            }
                        }
                    }

                    preparedProducts.push(product);
                }

                if (preparedProducts.length > 0) {
                    await api.upsertMany(TableNames.PRODUCTS, preparedProducts, 'sku');
                }

                const freshProducts = await api.fetchAll<Product>(TableNames.PRODUCTS);
                (actions as any).setProducts(freshProducts);

                setImportStatus({
                    show: true,
                    type: 'success',
                    msg: 'Импорт завершен',
                    details: `Всего обработано: ${totalLines}`,
                });
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                setImportStatus({ show: true, msg: 'Ошибка импорта', type: 'error', details: errorMessage });
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };

        // Export produces UTF-8 with BOM — read as UTF-8
        reader.readAsText(file, 'UTF-8');
    };

    return {
        fileInputRef,
        importStatus,
        setImportStatus,
        handleExportCSV,
        handleFileImport,
    };
};
