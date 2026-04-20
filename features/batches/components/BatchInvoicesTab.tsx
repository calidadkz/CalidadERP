import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    Download, FileText, Package, Receipt,
    Plus, Trash2, RotateCcw, ChevronUp, ChevronDown, X, FileDown,
    Settings2, ChevronRight, Upload,
} from 'lucide-react';
import { PreCalculationDocument, PreCalculationItem, GeneralSettings } from '@/types/pre-calculations';
import { Batch } from '@/types/batch';
import { OptionVariant, HSCode } from '@/types';

// ══════════════════════════════════════════════════════════════════════════════
// Типы
// ══════════════════════════════════════════════════════════════════════════════

type CurrencyLabel   = 'CNY' | 'RMB';
type CustomsCurrency = 'USD' | 'CNY' | 'EUR';
type InvoiceSection  = 'draft' | 'customs' | 'packing';

interface CustomsRow {
    id: string;
    hsCodeCode: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
}

interface PackingRow {
    id: string;
    customsRowIds: string[];
    model: string;
    description: string;
    numBoxes: number;
    qtyPerBox: number;
    netWeightPerBox: number;
    grossWeightPerBox: number;
    volumeM3: number;
}

interface InvoiceSettings {
    // Поставщик
    sellerName: string;
    sellerFrom: string;
    sellerAddress: string;
    sellerTrademark: string;
    sellerManufacturer: string;
    bankIntermediary: string;
    bankBeneficiary: string;
    bankAccountNo: string;
    // Покупатель
    buyerName: string;
    buyerRegion: string;
    buyerAttn: string;
    buyerPhone: string;
    buyerFax: string;
    buyerWebsite: string;
    buyerAddress: string;
    // Документ
    invoiceNo: string;
    invoiceDate: string;
    contractNo: string;
    contractDate: string;
    validity: string;
    paymentTerm: string;
    // Условия
    termsOfShipment: string;
    deliveryTime: string;
    warranty: string;
    remark: string;
    note: string;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
    sellerName: 'LIAOCHENG DEVELOPMENT ZONE JINGKE LASER EQUIPMENT CO,LTD.',
    sellerFrom: 'LIAOCHENG',
    sellerAddress: '60METERS TO THE SOUTH AND 200METERS TO THE INTERSECTION OF ZHONGHUA ROAD AND HUNAN ROAD',
    sellerTrademark: 'LIAOCHENG DEVELOPMENT ZONE JINGKE LASER EQUIPMENT CO,LTD.',
    sellerManufacturer: 'LIAOCHENG DEVELOPMENT ZONE JINGKE LASER EQUIPMENT CO,LTD.',
    bankIntermediary: 'CITIUS33 CITIBANK NA., NEW YORK',
    bankBeneficiary: 'JNSHCNBN QILU BANK CO., LTD',
    bankAccountNo: '86612004199628800012',
    buyerName: "TOO Калидад «CALIDAD»Kazakhstan, сity Karaganda, St. Respublika Kazakhstan Karagandinskaya oblast', gorod Saran' ulica Timiryazeva 8/1, БИН: 161140001283",
    buyerRegion: 'Kazakhstan',
    buyerAttn: 'Mr. Khurashvili Evgeniy',
    buyerPhone: '+77079202820',
    buyerFax: '',
    buyerWebsite: 'http://calidad.kz/',
    buyerAddress: "Kazakhstan, сity Karaganda, St. Respublika Kazakhstan Karagandinskaya oblast', gorod Saran' ulica Timiryazeva 8/1, БИН: 161140001283",
    invoiceNo: '',
    invoiceDate: new Date().toLocaleDateString('ru-RU'),
    contractNo: '',
    contractDate: '',
    validity: '',
    paymentTerm: '100% T/T payment before delivery',
    termsOfShipment: 'EXW (Liaocheng)',
    deliveryTime: 'Inform when confirm the PO, normally 25 workdays.',
    warranty: '',
    remark: 'Wooden case packing',
    note: '',
};

// ══════════════════════════════════════════════════════════════════════════════
// Утилиты
// ══════════════════════════════════════════════════════════════════════════════

const fmtNum = (v: number) =>
    v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const uid = () => Math.random().toString(36).slice(2, 9);

function safeFileName(base: string, ext: string) {
    return `${base.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
}

function convertPrice(
    price: number, fromCur: string, toCur: CustomsCurrency, settings: GeneralSettings,
): number {
    if (fromCur === toCur) return price;
    const rateUsd = settings.exchangeRateUsd || 1;
    const rateCny = settings.exchangeRateCny || 1;
    const rateFrom = fromCur === 'USD' ? rateUsd : fromCur === 'CNY' ? rateCny : 1;
    const rateTo   = toCur   === 'USD' ? rateUsd : toCur   === 'CNY' ? rateCny : 1;
    return Math.round(price * (rateFrom / rateTo) * 100) / 100;
}

function buildCustomsRows(
    items: PreCalculationItem[], hscodes: HSCode[],
    currency: CustomsCurrency, settings: GeneralSettings,
): CustomsRow[] {
    const hsMap = new Map(hscodes.map(h => [h.code, h]));
    return items.map(item => {
        const hs = item.hsCode ? hsMap.get(item.hsCode) : undefined;
        const price = convertPrice(item.purchasePrice || 0, item.purchasePriceCurrency || 'USD', currency, settings);
        return {
            id: item.id,
            hsCodeCode: item.hsCode || '',
            name: hs?.name || item.supplierName?.trim() || item.name,
            description: hs?.description || hs?.explanation || '',
            quantity: item.quantity || 1,
            unitPrice: price,
        };
    });
}

function buildPackingRows(cRows: CustomsRow[], preCalcItems: PreCalculationItem[]): PackingRow[] {
    const itemMap = new Map(preCalcItems.map(i => [i.id, i]));
    return cRows.map(cr => {
        const item = itemMap.get(cr.id);
        const qty = cr.quantity || 1;
        return {
            id: uid(),
            customsRowIds: [cr.id],
            model: cr.name,
            description: cr.description,
            numBoxes: 1,
            qtyPerBox: qty,
            netWeightPerBox:   Math.round((item?.weightKg || 0) * qty * 10) / 10,
            grossWeightPerBox: Math.round((item?.weightKg || 0) * qty * 1.1 * 10) / 10,
            volumeM3:          Math.round((item?.volumeM3 || 0) * qty * 1000) / 1000,
        };
    });
}

function downloadCsv(rows: (string | number | null)[][], filename: string) {
    const csv = rows.map(r =>
        r.map(c => {
            const s = String(c ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── Число прописью (English) ──────────────────────────────────────────────────
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numWords(n: number): string {
    if (n === 0) return 'zero';
    const h = (x: number): string => {
        if (x < 20) return ONES[x];
        if (x < 100) return TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : '');
        if (x < 1000) return ONES[Math.floor(x / 100)] + ' hundred' + (x % 100 ? ' ' + h(x % 100) : '');
        if (x < 1_000_000) return h(Math.floor(x / 1000)) + ' thousand' + (x % 1000 ? ' ' + h(x % 1000) : '');
        return h(Math.floor(x / 1_000_000)) + ' million' + (x % 1_000_000 ? ' ' + h(x % 1_000_000) : '');
    };
    const int = Math.floor(n);
    const cents = Math.round((n - int) * 100);
    let res = h(int).toUpperCase();
    if (cents > 0) res += ` AND ${h(cents).toUpperCase()} CENTS`;
    return res;
}

// ══════════════════════════════════════════════════════════════════════════════
// Excel builders
// ══════════════════════════════════════════════════════════════════════════════

type AoaRow = (string | number | null)[];

function buildCustomsSheet(
    rows: CustomsRow[], currency: CustomsCurrency, s: InvoiceSettings,
): XLSX.WorkSheet {
    const aoa: AoaRow[] = [];
    const cur = currency;

    aoa.push(['', '', '', '', ' Invoice', '', '', '', '', '']);
    aoa.push([`SELLER:BENEFICIARY'S NAME：${s.sellerName}`, '', '', '', `Region: ${s.buyerRegion}`, '', '', '', '', '']);
    aoa.push(['', '', '', '', `Validity: ${s.validity}`, '', '', '', '', '']);
    aoa.push([]);
    aoa.push([`BUYER: ${s.buyerName}`, '', '', '', `From: ${s.sellerFrom}`, '', '', '', '', '']);
    aoa.push([`Attn: ${s.buyerAttn}`, '', '', '', `Invoice No.: ${s.invoiceNo}`, '', '', '', '', '']);
    aoa.push([`Tel:  ${s.buyerPhone}`, '', '', '', `Invoice Date: ${s.invoiceDate}`, '', '', '', '', '']);
    aoa.push([`Fax:  ${s.buyerFax}                                   ${s.buyerWebsite}`, '', '', '', `Contract No.:  ${s.contractNo}`, '', '', '', '', '']);
    aoa.push([`Payment term:  ${s.paymentTerm}`, '', '', '', `Contract Date: ${s.contractDate}`, '', '', '', '', '']);
    aoa.push([`Adress:  ${s.buyerAddress}`, '', '', '', '', '', '', '', '', '']);
    aoa.push(['Item', 'Model', 'Description/Спецификация', 'Код', 'Quantity Кол-во', `Unit Price(${cur})`, `Sub Total (${cur})`, '', '', '']);

    let totalQty = 0, totalAmount = 0;
    rows.forEach((row, i) => {
        const amt = Math.round(row.unitPrice * row.quantity * 100) / 100;
        totalQty += row.quantity;
        totalAmount += amt;
        aoa.push([i + 1, row.name, row.description, row.hsCodeCode || '', row.quantity, row.unitPrice, amt, '', '', '']);
    });

    aoa.push(['', '', 'Total', '', totalQty, '', Math.round(totalAmount * 100) / 100, '', '', '']);
    aoa.push([`SAY ${cur} ${numWords(totalAmount)} ONLY`, '', '', '', '', '', '', '', '', '']);
    aoa.push([`Note: ${s.note}`, '', '', '', '', '', '', '', '', '']);
    aoa.push([
        `56A: Intermediary Bank's Name SWIFT BIC: ${s.bankIntermediary}\n57A: Beneficiary's Bank's Name SWIFT BIC: ${s.bankBeneficiary}\n59: Beneficiary's Account No,Name and Address :\nAccount Number: ${s.bankAccountNo}\nName: ${s.sellerName}\nAddress: ${s.sellerAddress}`,
        '', '', '', '', '', '', '', '', '',
    ]);
    aoa.push([`Trademark/Торговая марка`, '', `${s.sellerTrademark}`, '', '', '', '', '', '', '']);
    aoa.push([`Manufacturer/Производитель`, '', `${s.sellerManufacturer}`, '', '', '', '', '', '', '']);
    aoa.push(['Terms & Conditions:', '', '', '', '', '', '', '', '', '']);
    aoa.push([`Terms of Shipment: ${s.termsOfShipment}`, '', '', '', '', '', '', '', '', '']);
    aoa.push([`Delivery time: ${s.deliveryTime}`, '', '', '', '', '', '', '', '', '']);
    aoa.push([`Warranty: ${s.warranty}`, '', '', '', '', '', '', '', '', '']);
    aoa.push([`Remark: ${s.remark}`, '', '', '', '', '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 70 }, { wch: 25 }, { wch: 50 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 4 }, { wch: 4 }, { wch: 4 }];
    return ws;
}

function buildDraftSheet(
    items: PreCalculationItem[], currencyLabel: CurrencyLabel, s: InvoiceSettings,
    getModelName: (i: PreCalculationItem) => string,
    getOptions: (i: PreCalculationItem) => string[],
): XLSX.WorkSheet {
    const aoa: AoaRow[] = [];
    const cur = currencyLabel;

    aoa.push(['', '', '', 'Proforma Invoice', '', '', '']);
    aoa.push([`${s.sellerName}\nAdd: ${s.sellerAddress}\nTel: ${s.buyerPhone}`, '', '', `Region: ${s.buyerRegion}`, '', '', '']);
    aoa.push(['', '', '', `Validity: ${s.validity}`, '', '', '']);
    aoa.push([]);
    aoa.push([`To: ${s.buyerName}`, '', '', `From: ${s.sellerFrom}`, '', '', '']);
    aoa.push([`Attn: ${s.buyerAttn}`, '', '', `Invoice No.: ${s.invoiceNo}`, '', '', '']);
    aoa.push([`Tel:  ${s.buyerPhone}`, '', '', `Invoice Date: ${s.invoiceDate}`, '', '', '']);
    aoa.push([`Fax:  ${s.buyerFax}                                   ${s.buyerWebsite}`, '', '', `Contract No.:  ${s.contractNo}`, '', '', '']);
    aoa.push([`Payment term:  ${s.paymentTerm}`, '', '', `Contract Date: ${s.contractDate}`, '', '', '']);
    aoa.push([`Adress:  ${s.buyerAddress}`, '', '', '', '', '', '']);
    aoa.push(['Item', 'Model', 'Description', 'Quantity', `Unit Price(${cur})\nEXW (Liaocheng)`, `Sub Total (${cur})\nEXW (Liaocheng)`, '']);

    let totalQty = 0, totalAmount = 0;
    items.forEach((item, i) => {
        const opts = getOptions(item).join(', ');
        const desc = opts ? `${item.name}${opts ? '. ' + opts : ''}` : item.name;
        const qty = item.quantity || 1;
        const price = item.purchasePrice || 0;
        const amt = Math.round(price * qty * 100) / 100;
        totalQty += qty;
        totalAmount += amt;
        aoa.push([i + 1, getModelName(item), desc, qty, price, amt, '']);
    });

    aoa.push(['', '', 'Total', totalQty, '', Math.round(totalAmount * 100) / 100, '']);
    aoa.push([]);
    aoa.push([`Note: ${s.note}`, '', '', '', '', '', '']);
    aoa.push([]);
    aoa.push(['Terms & Conditions:', '', '', '', '', '', '']);
    aoa.push([`Terms of Shipment: ${s.termsOfShipment}`, '', '', '', '', '', '']);
    aoa.push([`Delivery time: ${s.deliveryTime}`, '', '', '', '', '', '']);
    aoa.push([`Warranty: ${s.warranty}`, '', '', '', '', '', '']);
    aoa.push([`Remark: ${s.remark}`, '', '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 60 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 4 }];
    return ws;
}

function buildPackingSheet(rows: PackingRow[], s: InvoiceSettings): XLSX.WorkSheet {
    const aoa: AoaRow[] = [];

    // Header block
    aoa.push([`SELLER:BENEFICIARY'S NAME：${s.sellerName}`, '', '', '', '', '', '', '', '', '', '', '', '']);
    aoa.push([]);
    aoa.push(['', '', '', '', '', `Invoice Date: ${s.invoiceDate}`, '', `Invoice No.: ${s.invoiceNo}`, '', '', '', '', '']);
    aoa.push(['', '', '', '', '', `Contract No.:  ${s.contractNo}`, '', '', '', '', '', '', '']);
    aoa.push(['', '', '', '', '', `Contract Date: ${s.contractDate}`, '', '', '', '', '', '', '']);
    aoa.push([]);
    aoa.push([`BUYER: ${s.buyerName}`, '', '', '', '', '', '', '', '', '', '', '', '']);
    aoa.push([`Attn: ${s.buyerAttn}`, '', '', '', '', '', '', '', '', '', '', '', '']);
    aoa.push([`地址Add: ${s.buyerAddress}`, '', '', '', '', '', '', '', '', '', '', '', '']);
    aoa.push([`From:  ${s.sellerFrom}`, '', `To:   ${s.buyerRegion}`, '', '', '', '', '', '', '', '', '', '']);
    aoa.push([]);

    // 3-row table header (rows 12–14 in template)
    aoa.push([
        'Model', 'Description/Спецификация',
        'Кол-во мест\nWooden box\n箱数',
        'Кол-во штук\nQuantity (per box)\n数量/箱',
        'Weight/Box 重量/箱 (kg)', '',
        'Итого вес нетто\nSub-total net weight',
        'Итого вес брутто\nSub-total gross weight',
        'Итоговый размер\nSub-total dimension', '', '', '', '',
    ]);
    aoa.push(['', '', '', '', 'Вес нетто Net/Box\n净重/箱', 'Вес Брутто Gross/Box', '', '', '', '', '', '', '']);
    aoa.push(['', '', '', '', '', '', '小计净重\nkg', '小计毛重\nkg', 'Объем в М3 小计体积CMB', '', '', '', '']);

    // Data rows
    let totalBoxes = 0, totalQty = 0, totalNet = 0, totalGross = 0;
    rows.forEach(r => {
        const subNet   = Math.round(r.numBoxes * r.netWeightPerBox * 10) / 10;
        const subGross = Math.round(r.numBoxes * r.grossWeightPerBox * 10) / 10;
        totalBoxes += r.numBoxes;
        totalQty   += r.numBoxes * r.qtyPerBox;
        totalNet   += subNet;
        totalGross += subGross;
        aoa.push([
            r.model, r.description,
            r.numBoxes, r.qtyPerBox,
            r.netWeightPerBox, r.grossWeightPerBox,
            subNet, subGross,
            r.volumeM3, '', '', '', '',
        ]);
    });

    // Totals row
    aoa.push([
        '', `Итого Кол-во мест`,
        totalBoxes, totalQty,
        '', '',
        Math.round(totalNet * 10) / 10,
        Math.round(totalGross * 10) / 10,
        '', '', '', '', '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 20 }, { wch: 50 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
    ];
    return ws;
}

// ── Импорт ────────────────────────────────────────────────────────────────────

function parseCustomsFile(file: File): Promise<{ rows: CustomsRow[]; partial: Partial<InvoiceSettings> }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const aoa: AoaRow[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as AoaRow[];

                const partial: Partial<InvoiceSettings> = {};
                const rows: CustomsRow[] = [];

                aoa.forEach((row, ri) => {
                    const r0 = String(row[0] || '');
                    const r4 = String(row[4] || '');
                    if (r0.includes('BUYER:')) partial.buyerName = r0.replace('BUYER:', '').trim();
                    if (r0.startsWith('Attn:')) partial.buyerAttn = r0.replace('Attn:', '').trim();
                    if (r0.startsWith('Tel:')) partial.buyerPhone = r0.replace('Tel:', '').trim();
                    if (r0.startsWith('Payment term:')) partial.paymentTerm = r0.replace('Payment term:', '').trim();
                    if (r0.startsWith('Adress:')) partial.buyerAddress = r0.replace('Adress:', '').trim();
                    if (r0.startsWith('Terms of Shipment:')) partial.termsOfShipment = r0.replace('Terms of Shipment:', '').trim();
                    if (r0.startsWith('Delivery time:')) partial.deliveryTime = r0.replace('Delivery time:', '').trim();
                    if (r0.startsWith('Warranty:')) partial.warranty = r0.replace('Warranty:', '').trim();
                    if (r0.startsWith('Remark:')) partial.remark = r0.replace('Remark:', '').trim();
                    if (r0.startsWith('Note:')) partial.note = r0.replace('Note:', '').trim();
                    if (r4.startsWith('Invoice No.:')) partial.invoiceNo = r4.replace('Invoice No.:', '').trim();
                    if (r4.startsWith('Invoice Date:')) partial.invoiceDate = r4.replace('Invoice Date:', '').trim();
                    if (r4.startsWith('Contract No.:')) partial.contractNo = r4.replace('Contract No.:', '').trim();
                    if (r4.startsWith('Contract Date:')) partial.contractDate = r4.replace('Contract Date:', '').trim();

                    // Строки данных: первая колонка — число (номер строки)
                    const itemNo = Number(row[0]);
                    if (!isNaN(itemNo) && itemNo > 0 && row.length >= 6) {
                        const qty = Number(row[4]);
                        const price = Number(row[5]);
                        if (qty > 0 && !isNaN(price)) {
                            rows.push({
                                id: uid(),
                                name: String(row[1] || ''),
                                description: String(row[2] || ''),
                                hsCodeCode: String(row[3] || ''),
                                quantity: qty,
                                unitPrice: price,
                            });
                        }
                    }
                });

                resolve({ rows, partial });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function parsePackingFile(file: File): Promise<PackingRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const aoa: AoaRow[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as AoaRow[];
                const rows: PackingRow[] = [];

                aoa.forEach(row => {
                    const model = String(row[0] || '');
                    const desc  = String(row[1] || '');
                    const boxes = Number(row[2]);
                    const qty   = Number(row[3]);
                    const net   = Number(row[4]);
                    const gross = Number(row[5]);
                    const vol   = Number(row[8]);

                    if (model && model !== 'Model' && !model.startsWith('Итого') && boxes >= 0) {
                        rows.push({
                            id: uid(),
                            customsRowIds: [],
                            model,
                            description: desc,
                            numBoxes: boxes || 1,
                            qtyPerBox: qty || 1,
                            netWeightPerBox: net || 0,
                            grossWeightPerBox: gross || 0,
                            volumeM3: vol || 0,
                        });
                    }
                });

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface Props {
    preCalculation: PreCalculationDocument;
    batch: Batch;
    optionVariants: OptionVariant[];
    hscodes: HSCode[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Главный компонент
// ══════════════════════════════════════════════════════════════════════════════

export const BatchInvoicesTab: React.FC<Props> = ({ preCalculation, batch, optionVariants, hscodes }) => {
    const [activeSection, setActiveSection] = useState<InvoiceSection>('draft');
    const [showSettings, setShowSettings] = useState(false);

    // InvoiceSettings — persist в localStorage по batchId
    const storageKey = `inv_settings_${batch.id}`;
    const [settings, setSettings] = useState<InvoiceSettings>(() => {
        try {
            const s = localStorage.getItem(storageKey);
            if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
        } catch {}
        return DEFAULT_SETTINGS;
    });

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(settings));
    }, [settings, storageKey]);

    const updS = (key: keyof InvoiceSettings, val: string) =>
        setSettings(prev => ({ ...prev, [key]: val }));

    // Draft invoice state
    const [currencyLabel, setCurrencyLabel] = useState<CurrencyLabel>('CNY');

    // Customs invoice state
    const [customsCurrency, setCustomsCurrency] = useState<CustomsCurrency>('USD');
    const [customsRows, setCustomsRows] = useState<CustomsRow[]>(() =>
        buildCustomsRows(
            preCalculation.items.filter(i => !batch.deletedItemIds?.includes(i.id)),
            hscodes, 'USD', preCalculation.settings,
        )
    );

    // Packing list state
    const [packingRows, setPackingRows] = useState<PackingRow[]>(() => {
        const cRows = buildCustomsRows(
            preCalculation.items.filter(i => !batch.deletedItemIds?.includes(i.id)),
            hscodes, 'USD', preCalculation.settings,
        );
        return buildPackingRows(cRows, preCalculation.items);
    });

    const variantMap = useMemo(() => new Map(optionVariants.map(v => [v.id, v])), [optionVariants]);

    const activeItems = useMemo(() =>
        preCalculation.items.filter(item => !batch.deletedItemIds?.includes(item.id)),
        [preCalculation.items, batch.deletedItemIds]
    );

    const getSupplierModelName = (item: PreCalculationItem) =>
        item.supplierName?.trim() || item.name;

    const getSupplierOptions = useCallback((item: PreCalculationItem): string[] => {
        if (item.type !== 'MACHINE' || !item.options?.length) return [];
        return item.options.map(opt => {
            const v = variantMap.get(opt.variantId);
            return v?.supplierProductName?.trim() || opt.variantName;
        });
    }, [variantMap]);

    const getCurrencyDisplay = (c: string) => c === 'CNY' ? currencyLabel : c;

    const draftTotals = useMemo(() => {
        const map: Record<string, number> = {};
        activeItems.forEach(item => {
            const cur = item.purchasePriceCurrency || 'USD';
            map[cur] = (map[cur] || 0) + (item.purchasePrice || 0) * (item.quantity || 1);
        });
        return map;
    }, [activeItems]);

    // ── Export handlers ───────────────────────────────────────────────────────

    const handleExportDraftXlsx = () => {
        const ws = buildDraftSheet(activeItems, currencyLabel, settings, getSupplierModelName, getSupplierOptions);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Proforma Invoice (${currencyLabel})`);
        XLSX.writeFile(wb, safeFileName(`Черновой_инвойс_${batch.name}`, 'xlsx'));
    };

    const handleExportDraftCsv = () => {
        const rows: AoaRow[] = [
            ['Item', 'Model', 'Description', 'Quantity', `Unit Price(${currencyLabel})`, `Sub Total (${currencyLabel})`],
        ];
        let totalQty = 0, totalAmt = 0;
        activeItems.forEach((item, i) => {
            const opts = getSupplierOptions(item).join(', ');
            const qty = item.quantity || 1;
            const price = item.purchasePrice || 0;
            const amt = Math.round(price * qty * 100) / 100;
            totalQty += qty; totalAmt += amt;
            rows.push([i + 1, getSupplierModelName(item), opts ? `${item.name}. ${opts}` : item.name, qty, price, amt]);
        });
        rows.push(['', '', 'Total', totalQty, '', Math.round(totalAmt * 100) / 100]);
        downloadCsv(rows, safeFileName(`Черновой_инвойс_${batch.name}`, 'csv'));
    };

    const handleExportCustomsXlsx = () => {
        const ws = buildCustomsSheet(customsRows, customsCurrency, settings);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Invoice`);
        XLSX.writeFile(wb, safeFileName(`Таможенный_инвойс_${batch.name}`, 'xlsx'));
    };

    const handleExportCustomsCsv = () => {
        const headers: AoaRow = ['Item', 'Model', 'Description', 'Код ТН ВЭД', 'Quantity', `Unit Price(${customsCurrency})`, `Sub Total (${customsCurrency})`];
        const dataRows: AoaRow[] = customsRows.map((r, i) => [i + 1, r.name, r.description, r.hsCodeCode, r.quantity, r.unitPrice, Math.round(r.unitPrice * r.quantity * 100) / 100]);
        const total = customsRows.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
        dataRows.push(['', '', 'Total', '', customsRows.reduce((s, r) => s + r.quantity, 0), '', Math.round(total * 100) / 100]);
        downloadCsv([headers, ...dataRows], safeFileName(`Таможенный_инвойс_${batch.name}`, 'csv'));
    };

    const handleExportPackingXlsx = () => {
        const ws = buildPackingSheet(packingRows, settings);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Packing List');
        XLSX.writeFile(wb, safeFileName(`Упаковочный_лист_${batch.name}`, 'xlsx'));
    };

    const handleExportPackingCsv = () => {
        const headers: AoaRow = ['Model', 'Description', 'Кол-во мест', 'Шт/место', 'Нетто/место', 'Брутто/место', 'Нетто итого', 'Брутто итого', 'Объём м³'];
        const dataRows: AoaRow[] = packingRows.map(r => [r.model, r.description, r.numBoxes, r.qtyPerBox, r.netWeightPerBox, r.grossWeightPerBox, Math.round(r.numBoxes * r.netWeightPerBox * 10) / 10, Math.round(r.numBoxes * r.grossWeightPerBox * 10) / 10, r.volumeM3]);
        downloadCsv([headers, ...dataRows], safeFileName(`Упаковочный_лист_${batch.name}`, 'csv'));
    };

    // ── Import handlers ───────────────────────────────────────────────────────

    const customsImportRef = useRef<HTMLInputElement>(null);
    const packingImportRef = useRef<HTMLInputElement>(null);

    const handleImportCustoms = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const { rows, partial } = await parseCustomsFile(file);
            if (rows.length > 0) setCustomsRows(rows);
            if (Object.keys(partial).length > 0)
                setSettings(prev => ({ ...prev, ...partial }));
        } catch { alert('Не удалось прочитать файл'); }
        e.target.value = '';
    };

    const handleImportPacking = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const rows = await parsePackingFile(file);
            if (rows.length > 0) setPackingRows(rows);
        } catch { alert('Не удалось прочитать файл'); }
        e.target.value = '';
    };

    // ── Sections nav ──────────────────────────────────────────────────────────

    const sections: { id: InvoiceSection; label: string; icon: React.ElementType }[] = [
        { id: 'draft',   label: 'Черновой инвойс',   icon: FileText },
        { id: 'customs', label: 'Таможенный инвойс', icon: Receipt  },
        { id: 'packing', label: 'Упаковочный лист',  icon: Package  },
    ];

    return (
        <div className="flex flex-col h-full gap-3">

            {/* ── Шапка: субнав + кнопка реквизитов ──────────────────── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {sections.map(s => {
                        const Icon = s.icon;
                        return (
                            <button key={s.id} onClick={() => setActiveSection(s.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    activeSection === s.id
                                        ? 'bg-white shadow text-blue-600'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <Icon size={12} />{s.label}
                            </button>
                        );
                    })}
                </div>
                <button onClick={() => setShowSettings(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                        showSettings
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                >
                    <Settings2 size={13} /> Реквизиты
                    <ChevronRight size={11} className={`transition-transform ${showSettings ? 'rotate-90' : ''}`} />
                </button>
            </div>

            {/* ── Форма реквизитов (collapsible) ──────────────────────── */}
            {showSettings && (
                <RequisitesForm settings={settings} onChange={updS} />
            )}

            {/* ── Контент секции ──────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {activeSection === 'draft' && (
                    <DraftInvoiceSection
                        items={activeItems}
                        currencyLabel={currencyLabel}
                        onCurrencyChange={setCurrencyLabel}
                        getSupplierModelName={getSupplierModelName}
                        getSupplierOptions={getSupplierOptions}
                        getCurrencyDisplay={getCurrencyDisplay}
                        totals={draftTotals}
                        onExportXlsx={handleExportDraftXlsx}
                        onExportCsv={handleExportDraftCsv}
                    />
                )}
                {activeSection === 'customs' && (
                    <CustomsInvoiceSection
                        activeItems={activeItems}
                        hscodes={hscodes}
                        settings={preCalculation.settings}
                        currency={customsCurrency}
                        rows={customsRows}
                        onCurrencyChange={setCustomsCurrency}
                        onRowsChange={setCustomsRows}
                        onExportXlsx={handleExportCustomsXlsx}
                        onExportCsv={handleExportCustomsCsv}
                        onImport={() => customsImportRef.current?.click()}
                    />
                )}
                {activeSection === 'packing' && (
                    <PackingListSection
                        customsRows={customsRows}
                        preCalcItems={activeItems}
                        rows={packingRows}
                        onRowsChange={setPackingRows}
                        onResetFromInvoice={() => setPackingRows(buildPackingRows(customsRows, activeItems))}
                        onExportXlsx={handleExportPackingXlsx}
                        onExportCsv={handleExportPackingCsv}
                        onImport={() => packingImportRef.current?.click()}
                    />
                )}
            </div>

            {/* hidden file inputs */}
            <input ref={customsImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportCustoms} />
            <input ref={packingImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportPacking} />
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// Форма реквизитов
// ══════════════════════════════════════════════════════════════════════════════

interface RequisitesFormProps {
    settings: InvoiceSettings;
    onChange: (key: keyof InvoiceSettings, val: string) => void;
}

type FieldDef = { key: keyof InvoiceSettings; label: string; textarea?: boolean; span?: boolean };

const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
    {
        title: 'Документ',
        fields: [
            { key: 'invoiceNo',    label: '№ инвойса' },
            { key: 'invoiceDate',  label: 'Дата инвойса' },
            { key: 'contractNo',   label: '№ контракта' },
            { key: 'contractDate', label: 'Дата контракта' },
            { key: 'validity',     label: 'Validity (срок действия)' },
            { key: 'paymentTerm',  label: 'Условия оплаты' },
        ],
    },
    {
        title: 'Поставщик (Seller)',
        fields: [
            { key: 'sellerName',        label: 'Полное наименование', span: true },
            { key: 'sellerFrom',        label: 'From: (краткое)' },
            { key: 'sellerAddress',     label: 'Адрес отгрузки', span: true },
            { key: 'sellerTrademark',   label: 'Торговая марка', span: true },
            { key: 'sellerManufacturer',label: 'Производитель', span: true },
            { key: 'bankIntermediary',  label: 'SWIFT банк-посредник (56A)', span: true },
            { key: 'bankBeneficiary',   label: 'SWIFT банк-получатель (57A)', span: true },
            { key: 'bankAccountNo',     label: 'Счёт получателя', span: true },
        ],
    },
    {
        title: 'Покупатель (Buyer)',
        fields: [
            { key: 'buyerName',    label: 'Полное наименование', span: true },
            { key: 'buyerRegion',  label: 'Регион доставки' },
            { key: 'buyerAttn',    label: 'Контактное лицо (Attn)' },
            { key: 'buyerPhone',   label: 'Телефон' },
            { key: 'buyerFax',     label: 'Факс' },
            { key: 'buyerWebsite', label: 'Сайт' },
            { key: 'buyerAddress', label: 'Адрес (English)', span: true },
        ],
    },
    {
        title: 'Условия',
        fields: [
            { key: 'termsOfShipment', label: 'Terms of Shipment', span: true },
            { key: 'deliveryTime',    label: 'Delivery time', span: true },
            { key: 'warranty',        label: 'Warranty', span: true },
            { key: 'remark',          label: 'Remark', span: true },
            { key: 'note',            label: 'Note', span: true },
        ],
    },
];

const RequisitesForm: React.FC<RequisitesFormProps> = ({ settings, onChange }) => {
    const inp = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400/40 placeholder:text-slate-300';

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-5">
            {FIELD_GROUPS.map(group => (
                <div key={group.title}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{group.title}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {group.fields.map(f => (
                            <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                                <label className="block text-[10px] font-bold text-slate-400 mb-0.5">{f.label}</label>
                                {f.textarea ? (
                                    <textarea value={settings[f.key]} onChange={e => onChange(f.key, e.target.value)}
                                        rows={2} className={`${inp} resize-none`} />
                                ) : (
                                    <input type="text" value={settings[f.key]}
                                        onChange={e => onChange(f.key, e.target.value)} className={inp} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// Черновой инвойс
// ══════════════════════════════════════════════════════════════════════════════

interface DraftInvoiceSectionProps {
    items: PreCalculationItem[];
    currencyLabel: CurrencyLabel;
    onCurrencyChange: (c: CurrencyLabel) => void;
    getSupplierModelName: (i: PreCalculationItem) => string;
    getSupplierOptions: (i: PreCalculationItem) => string[];
    getCurrencyDisplay: (cur: string) => string;
    totals: Record<string, number>;
    onExportXlsx: () => void;
    onExportCsv: () => void;
}

const DraftInvoiceSection: React.FC<DraftInvoiceSectionProps> = ({
    items, currencyLabel, onCurrencyChange, getSupplierModelName, getSupplierOptions,
    getCurrencyDisplay, totals, onExportXlsx, onExportCsv,
}) => (
    <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Валюта:</span>
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                    {(['CNY', 'RMB'] as CurrencyLabel[]).map(c => (
                        <button key={c} onClick={() => onCurrencyChange(c)}
                            className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${
                                currencyLabel === c ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >{c}</button>
                    ))}
                </div>
            </div>
            <ExportButtons onXlsx={onExportXlsx} onCsv={onExportCsv} disabled={items.length === 0} />
        </div>

        {items.length === 0 ? <EmptyState text="Нет позиций" /> : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {['#', 'Модель', 'Описание / Опции', 'Кол-во', 'Цена за шт.', 'Сумма'].map(h => (
                                <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            const options = getSupplierOptions(item);
                            const cur = getCurrencyDisplay(item.purchasePriceCurrency || 'USD');
                            const price = item.purchasePrice || 0;
                            const qty = item.quantity || 1;
                            return (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-[11px] font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-[13px] font-bold text-slate-800">{getSupplierModelName(item)}</span>
                                        {item.type === 'MACHINE' && <span className="ml-2 text-[10px] font-black uppercase text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">станок</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {options.length > 0
                                            ? <ul className="space-y-0.5">{options.map((o, i) => <li key={i} className="text-[12px] text-slate-600 font-medium">{o}</li>)}</ul>
                                            : <span className="text-slate-300 text-[11px]">—</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-[13px] font-bold text-slate-700">{qty}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-[13px] font-bold text-slate-700 tabular-nums">{fmtNum(price)}</span>
                                        <span className="ml-1 text-[10px] font-black text-slate-400">{cur}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-[13px] font-black text-slate-900 tabular-nums">{fmtNum(price * qty)}</span>
                                        <span className="ml-1 text-[10px] font-black text-slate-400">{cur}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td colSpan={5} className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-slate-500">Итого:</td>
                            <td className="px-4 py-3">
                                {Object.entries(totals).map(([cur, sum]) => (
                                    <div key={cur} className="flex items-baseline gap-1">
                                        <span className="text-[14px] font-black text-slate-900 tabular-nums">{fmtNum(sum)}</span>
                                        <span className="text-[10px] font-black text-slate-400">{cur}</span>
                                    </div>
                                ))}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        )}
    </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Таможенный инвойс
// ══════════════════════════════════════════════════════════════════════════════

const CUSTOMS_CURRENCIES: CustomsCurrency[] = ['USD', 'CNY', 'EUR'];

interface CustomsInvoiceSectionProps {
    activeItems: PreCalculationItem[];
    hscodes: HSCode[];
    settings: GeneralSettings;
    currency: CustomsCurrency;
    rows: CustomsRow[];
    onCurrencyChange: (c: CustomsCurrency) => void;
    onRowsChange: (rows: CustomsRow[]) => void;
    onExportXlsx: () => void;
    onExportCsv: () => void;
    onImport: () => void;
}

const CustomsInvoiceSection: React.FC<CustomsInvoiceSectionProps> = ({
    activeItems, hscodes, settings, currency, rows,
    onCurrencyChange, onRowsChange, onExportXlsx, onExportCsv, onImport,
}) => {
    const hsMap = useMemo(() => new Map(hscodes.map(h => [h.code, h])), [hscodes]);
    const hsSorted = useMemo(() => [...hscodes].sort((a, b) => a.code.localeCompare(b.code)), [hscodes]);

    const updateRow = useCallback(<K extends keyof CustomsRow>(id: string, key: K, val: CustomsRow[K]) =>
        onRowsChange(rows.map(r => r.id === id ? { ...r, [key]: val } : r)),
        [rows, onRowsChange]
    );

    const handleHsChange = useCallback((id: string, code: string) => {
        const hs = hsMap.get(code);
        onRowsChange(rows.map(r => r.id === id
            ? { ...r, hsCodeCode: code, name: hs?.name || r.name, description: hs?.description || hs?.explanation || r.description }
            : r
        ));
    }, [rows, hsMap, onRowsChange]);

    const addRow = () => onRowsChange([...rows, { id: uid(), hsCodeCode: '', name: '', description: '', quantity: 1, unitPrice: 0 }]);
    const removeRow = (id: string) => onRowsChange(rows.filter(r => r.id !== id));

    const resetPrices = () => {
        const itemMap = new Map(activeItems.map(i => [i.id, i]));
        onRowsChange(rows.map(r => {
            const src = itemMap.get(r.id);
            return src ? { ...r, unitPrice: convertPrice(src.purchasePrice || 0, src.purchasePriceCurrency || 'USD', currency, settings) } : r;
        }));
    };

    const handleCurrencyChange = (c: CustomsCurrency) => {
        onCurrencyChange(c);
        const itemMap = new Map(activeItems.map(i => [i.id, i]));
        onRowsChange(rows.map(r => {
            const src = itemMap.get(r.id);
            return src ? { ...r, unitPrice: convertPrice(src.purchasePrice || 0, src.purchasePriceCurrency || 'USD', c, settings) } : r;
        }));
    };

    const total = useMemo(() => rows.reduce((s, r) => s + r.unitPrice * r.quantity, 0), [rows]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Валюта платежа:</span>
                    <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                        {CUSTOMS_CURRENCIES.map(c => (
                            <button key={c} onClick={() => handleCurrencyChange(c)}
                                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${
                                    currency === c ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >{c}</button>
                        ))}
                    </div>
                    <button onClick={resetPrices}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all"
                    >
                        <RotateCcw size={11} /> Сбросить цены
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onImport}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                    >
                        <Upload size={12} /> Импорт
                    </button>
                    <button onClick={addRow}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                    >
                        <Plus size={12} /> Строку
                    </button>
                    <ExportButtons onXlsx={onExportXlsx} onCsv={onExportCsv} disabled={rows.length === 0} />
                </div>
            </div>

            {rows.length === 0 ? <EmptyState text="Нет строк" /> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left w-8">#</th>
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left w-44">Код ТН ВЭД</th>
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Наименование</th>
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Описание</th>
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center w-20">Кол-во</th>
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-36 whitespace-nowrap">Цена/шт. ({currency})</th>
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-32 whitespace-nowrap">Сумма ({currency})</th>
                                <th className="w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <CustomsRowEditor key={row.id} row={row} idx={idx} hsSorted={hsSorted} currency={currency}
                                    onHsChange={handleHsChange} onUpdate={updateRow} onRemove={removeRow} />
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 border-t-2 border-slate-200">
                                <td colSpan={6} className="px-3 py-3 text-right text-[11px] font-black uppercase tracking-widest text-slate-500">Итого:</td>
                                <td className="px-3 py-3 text-right">
                                    <span className="text-[14px] font-black text-slate-900 tabular-nums">{fmtNum(total)}</span>
                                    <span className="ml-1 text-[10px] font-black text-slate-400">{currency}</span>
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

// ── Строка таможенного инвойса ────────────────────────────────────────────────

interface CustomsRowEditorProps {
    row: CustomsRow; idx: number; hsSorted: HSCode[]; currency: CustomsCurrency;
    onHsChange: (id: string, code: string) => void;
    onUpdate: <K extends keyof CustomsRow>(id: string, key: K, val: CustomsRow[K]) => void;
    onRemove: (id: string) => void;
}

const ci = 'w-full bg-transparent border-0 outline-none text-[12px] font-medium text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-1 focus:ring-blue-400/40 focus:rounded px-1 py-0.5 transition-all';

const CustomsRowEditor: React.FC<CustomsRowEditorProps> = ({ row, idx, hsSorted, currency, onHsChange, onUpdate, onRemove }) => (
    <tr className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors group">
        <td className="px-3 py-2 text-[11px] font-bold text-slate-400 text-center">{idx + 1}</td>
        <td className="px-2 py-2">
            <select value={row.hsCodeCode} onChange={e => onHsChange(row.id, e.target.value)}
                className="w-full bg-transparent border-0 outline-none text-[12px] font-mono font-bold text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-400/40 focus:rounded px-1 py-0.5 cursor-pointer"
            >
                <option value="">— не указан —</option>
                {hsSorted.map(h => <option key={h.id} value={h.code}>{h.code} — {h.name}</option>)}
            </select>
        </td>
        <td className="px-2 py-2 min-w-[160px]">
            <input type="text" value={row.name} placeholder="Наименование" onChange={e => onUpdate(row.id, 'name', e.target.value)} className={ci} />
        </td>
        <td className="px-2 py-2 min-w-[160px]">
            <input type="text" value={row.description} placeholder="Описание" onChange={e => onUpdate(row.id, 'description', e.target.value)} className={`${ci} text-slate-500`} />
        </td>
        <td className="px-2 py-2">
            <input type="number" min={0} value={row.quantity} onChange={e => onUpdate(row.id, 'quantity', Number(e.target.value) || 0)} className={`${ci} text-right`} />
        </td>
        <td className="px-2 py-2">
            <div className="flex items-center gap-1 justify-end">
                <input type="number" min={0} step="0.01" value={row.unitPrice} onChange={e => onUpdate(row.id, 'unitPrice', Number(e.target.value) || 0)} className={`${ci} text-right`} />
                <span className="text-[10px] font-black text-slate-400 shrink-0">{currency}</span>
            </div>
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
            <span className="text-[13px] font-black text-slate-800 tabular-nums">{fmtNum(row.unitPrice * row.quantity)}</span>
            <span className="ml-1 text-[10px] font-black text-slate-400">{currency}</span>
        </td>
        <td className="px-2 py-2">
            <button onClick={() => onRemove(row.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all rounded">
                <Trash2 size={13} />
            </button>
        </td>
    </tr>
);

// ══════════════════════════════════════════════════════════════════════════════
// Упаковочный лист
// ══════════════════════════════════════════════════════════════════════════════

interface PackingListSectionProps {
    customsRows: CustomsRow[];
    preCalcItems: PreCalculationItem[];
    rows: PackingRow[];
    onRowsChange: (rows: PackingRow[]) => void;
    onResetFromInvoice: () => void;
    onExportXlsx: () => void;
    onExportCsv: () => void;
    onImport: () => void;
}

const PackingListSection: React.FC<PackingListSectionProps> = ({
    customsRows, preCalcItems, rows, onRowsChange,
    onResetFromInvoice, onExportXlsx, onExportCsv, onImport,
}) => {
    const customsMap = useMemo(() => new Map(customsRows.map(r => [r.id, r])), [customsRows]);

    const updateRow = useCallback(<K extends keyof PackingRow>(id: string, key: K, val: PackingRow[K]) =>
        onRowsChange(rows.map(r => r.id === id ? { ...r, [key]: val } : r)),
        [rows, onRowsChange]
    );

    const addRow = () => onRowsChange([...rows, { id: uid(), customsRowIds: [], model: '', description: '', numBoxes: 1, qtyPerBox: 1, netWeightPerBox: 0, grossWeightPerBox: 0, volumeM3: 0 }]);
    const removeRow = (id: string) => onRowsChange(rows.filter(r => r.id !== id));
    const moveRow = (id: string, dir: -1 | 1) => {
        const arr = [...rows];
        const idx = arr.findIndex(r => r.id === id);
        const ni = idx + dir;
        if (ni < 0 || ni >= arr.length) return;
        [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
        onRowsChange(arr);
    };

    const toggleCustomsItem = (rowId: string, customsId: string) => {
        onRowsChange(rows.map(r => {
            if (r.id !== rowId) return r;
            const has = r.customsRowIds.includes(customsId);
            const newIds = has ? r.customsRowIds.filter(id => id !== customsId) : [...r.customsRowIds, customsId];
            const newModel = r.customsRowIds.length === 0 && !has ? (customsMap.get(customsId)?.name || r.model) : r.model;
            return { ...r, customsRowIds: newIds, model: newModel };
        }));
    };

    const totalBoxes = rows.reduce((s, r) => s + r.numBoxes, 0);
    const totalNet   = Math.round(rows.reduce((s, r) => s + r.numBoxes * r.netWeightPerBox, 0) * 10) / 10;
    const totalGross = Math.round(rows.reduce((s, r) => s + r.numBoxes * r.grossWeightPerBox, 0) * 10) / 10;
    const totalVol   = Math.round(rows.reduce((s, r) => s + r.numBoxes * r.volumeM3, 0) * 1000) / 1000;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <button onClick={onResetFromInvoice}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all"
                    >
                        <RotateCcw size={11} /> Из инвойса
                    </button>
                    <button onClick={onImport}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                    >
                        <Upload size={12} /> Импорт
                    </button>
                    <button onClick={addRow}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                    >
                        <Plus size={12} /> Место
                    </button>
                </div>
                <ExportButtons onXlsx={onExportXlsx} onCsv={onExportCsv} disabled={rows.length === 0} />
            </div>

            {rows.length > 0 && (
                <div className="flex gap-4 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500 flex-wrap">
                    <span>Мест: <strong className="text-slate-800">{totalBoxes}</strong></span>
                    <span>Нетто: <strong className="text-slate-800">{totalNet} кг</strong></span>
                    <span>Брутто: <strong className="text-slate-800">{totalGross} кг</strong></span>
                    <span>Объём: <strong className="text-slate-800">{totalVol} м³</strong></span>
                </div>
            )}

            {rows.length === 0 ? <EmptyState text="Нажмите «Из инвойса» или добавьте место вручную" /> : (
                <div className="flex flex-col gap-2">
                    {rows.map((row, idx) => (
                        <PackingRowCard key={row.id} row={row} idx={idx} total={rows.length}
                            customsRows={customsRows} onUpdate={updateRow}
                            onRemove={removeRow} onMove={moveRow} onToggleItem={toggleCustomsItem} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Карточка места ────────────────────────────────────────────────────────────

interface PackingRowCardProps {
    row: PackingRow; idx: number; total: number; customsRows: CustomsRow[];
    onUpdate: <K extends keyof PackingRow>(id: string, key: K, val: PackingRow[K]) => void;
    onRemove: (id: string) => void;
    onMove: (id: string, dir: -1 | 1) => void;
    onToggleItem: (rowId: string, customsId: string) => void;
}

const PackingRowCard: React.FC<PackingRowCardProps> = ({
    row, idx, total, customsRows, onUpdate, onRemove, onMove, onToggleItem,
}) => {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const ni = 'bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400/40 tabular-nums text-right w-full';

    return (
        <div className="group flex gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-3 hover:border-slate-300 transition-all">
            <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                <button onClick={() => onMove(row.id, -1)} disabled={idx === 0} className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-all"><ChevronUp size={14} /></button>
                <span className="text-[11px] font-black text-slate-400 tabular-nums">{idx + 1}</span>
                <button onClick={() => onMove(row.id, 1)} disabled={idx === total - 1} className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-all"><ChevronDown size={14} /></button>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-2">
                {/* Позиции инвойса */}
                <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1.5 shrink-0">Позиции:</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                        {row.customsRowIds.map(cid => {
                            const cr = customsRows.find(r => r.id === cid);
                            return (
                                <span key={cid} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-indigo-200">
                                    {cr?.hsCodeCode && <span className="font-mono opacity-70 text-[10px]">{cr.hsCodeCode}</span>}
                                    <span className="truncate max-w-[150px]">{cr?.name || cid}</span>
                                    <button onClick={() => onToggleItem(row.id, cid)} className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors"><X size={11} /></button>
                                </span>
                            );
                        })}
                        <div className="relative" ref={pickerRef}>
                            <button onClick={() => setShowPicker(v => !v)}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider rounded-lg border border-dashed border-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                            >
                                <Plus size={11} /> Добавить
                            </button>
                            {showPicker && (
                                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[260px] max-h-64 overflow-y-auto">
                                    {customsRows.map(cr => {
                                        const selected = row.customsRowIds.includes(cr.id);
                                        return (
                                            <button key={cr.id} onClick={() => onToggleItem(row.id, cr.id)}
                                                className={`w-full text-left px-4 py-2 text-[11px] font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 ${selected ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
                                            >
                                                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[9px] ${selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>{selected && '✓'}</span>
                                                <span className="font-mono text-slate-400 text-[10px]">{cr.hsCodeCode || '—'}</span>
                                                <span className="truncate">{cr.name}</span>
                                                <span className="ml-auto text-slate-400 shrink-0">×{cr.quantity}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Наименование + описание */}
                <div className="flex gap-2">
                    <input type="text" value={row.model} placeholder="Наименование (для экспорта)"
                        onChange={e => onUpdate(row.id, 'model', e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400/40 placeholder:text-slate-300"
                    />
                    <input type="text" value={row.description} placeholder="Описание (опционально)"
                        onChange={e => onUpdate(row.id, 'description', e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400/40 placeholder:text-slate-300"
                    />
                </div>

                {/* Числовые поля */}
                <div className="grid grid-cols-5 gap-2">
                    {([
                        { key: 'numBoxes',           label: 'Мест',         unit: 'шт' },
                        { key: 'qtyPerBox',          label: 'Шт/место',     unit: 'шт' },
                        { key: 'netWeightPerBox',    label: 'Нетто/место',  unit: 'кг' },
                        { key: 'grossWeightPerBox',  label: 'Брутто/место', unit: 'кг' },
                        { key: 'volumeM3',           label: 'Объём/место',  unit: 'м³' },
                    ] as const).map(({ key, label, unit }) => (
                        <div key={key} className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                            <div className="flex items-center gap-1">
                                <input type="number" min={0} step={key === 'volumeM3' ? '0.001' : '0.1'} value={row[key]}
                                    onChange={e => onUpdate(row.id, key, Number(e.target.value) || 0)} className={ni} />
                                <span className="text-[10px] font-black text-slate-400 shrink-0">{unit}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {row.numBoxes > 1 && (
                    <div className="flex gap-4 text-[11px] text-slate-400 font-bold">
                        <span>Нетто итого: <strong className="text-slate-600">{fmtNum(row.numBoxes * row.netWeightPerBox)} кг</strong></span>
                        <span>Брутто итого: <strong className="text-slate-600">{fmtNum(row.numBoxes * row.grossWeightPerBox)} кг</strong></span>
                        <span>Объём итого: <strong className="text-slate-600">{fmtNum(row.numBoxes * row.volumeM3)} м³</strong></span>
                    </div>
                )}
            </div>

            <button onClick={() => onRemove(row.id)}
                className="opacity-0 group-hover:opacity-100 self-start mt-1 p-1.5 text-slate-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 shrink-0">
                <Trash2 size={14} />
            </button>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// Общие компоненты
// ══════════════════════════════════════════════════════════════════════════════

const ExportButtons: React.FC<{ onXlsx: () => void; onCsv: () => void; disabled?: boolean }> = ({ onXlsx, onCsv, disabled }) => (
    <div className="flex gap-1.5">
        <button onClick={onXlsx} disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-black uppercase text-[11px] tracking-widest hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-40"
        >
            <Download size={13} /> .xlsx
        </button>
        <button onClick={onCsv} disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 font-black uppercase text-[11px] tracking-widest hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-40"
        >
            <FileDown size={13} /> .csv
        </button>
    </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-center justify-center py-20">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center max-w-xs">{text}</p>
    </div>
);
