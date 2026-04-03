import { Currency } from '../types';
import * as XLSX from 'xlsx';

export interface ParsedStatementRow {
    documentNumber: string;
    date: string;
    expense: number;
    income: number;
    counterpartyName: string;
    counterpartyBinIin: string;
    counterpartyIik: string;
    counterpartyBik: string;
    counterpartyBankName: string; 
    knp: string;
    purpose: string;
    rawInfo: string;
}

export interface ParseResult {
    rows: ParsedStatementRow[];
    accountNumber?: string;
    currency?: string;
    error?: string;
    debugInfo?: string[];
}

export class StatementParser {

    /**
     * Очистка строки от технических символов и лишних пробелов
     */
    private static cleanString(s: any): string {
        if (s === null || s === undefined) return '';
        return String(s).replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Парсинг Kaspi Pay (Excel/CSV)
     */
    static async parseKaspi(file: File): Promise<ParseResult> {
        const allLines = await this.readTo2DArray(file);
        if (allLines.length === 0) return { rows: [], error: "Файл пуст" };

        let accountNumber = '';
        let currency = '';

        // 1. Поиск метаданных (счет и валюта)
        for (let i = 0; i < Math.min(25, allLines.length); i++) {
            const row = allLines[i];
            const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
            
            if (rowStr.includes('текущий счет')) {
                // Ищем IBAN (KZ + 18 символов)
                const found = row.find((c: any) => /KZ[A-Z0-9]{18}/i.test(String(c || '').trim()));
                if (found) {
                    accountNumber = String(found).trim().toUpperCase();
                }
            }
            if (rowStr.includes('валюта счета')) {
                const vals = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
                if (vals.length > 1) currency = String(vals[vals.length - 1]).trim();
            }
        }

        // 2. Поиск заголовка таблицы
        const headerIndex = allLines.findIndex(row => {
            const rowStr = row.map(c => this.cleanString(c).toLowerCase()).join(' ');
            return rowStr.includes('№ документа') && rowStr.includes('дата операции') && rowStr.includes('дебет') && rowStr.includes('кредит');
        });

        if (headerIndex === -1) {
            return { rows: [], error: "Не найден заголовок таблицы Kaspi (№ документа, Дата операции, Дебет, Кредит)" };
        }

        const dataRows = allLines.slice(headerIndex + 2);
        const rows: ParsedStatementRow[] = [];

        for (const row of dataRows) {
            if (!row || row.length < 9) continue; 
            if (!row[0] && !row[1] && !row[2] && !row[3]) continue;

            const rowStr = row.map(c => this.cleanString(c).toLowerCase()).join(' ');
            if (rowStr.includes('итого')) break;

            // Kaspi specific logic: name and bin/iin are often mixed in one column
            const rawCounterpartyAndBin = String(row[4] || ''); 
            const { name, binIin } = this.extractNameAndBin(rawCounterpartyAndBin);

            const expense = this.parseAmount(row[2]); 
            const income = this.parseAmount(row[3]);  

            if (expense === 0 && income === 0) continue;

            rows.push({
                documentNumber: this.cleanString(row[0]),
                date: this.cleanString(row[1]),
                expense,
                income,
                counterpartyName: name,
                counterpartyBinIin: binIin,
                counterpartyIik: this.cleanString(row[5]), 
                counterpartyBik: this.cleanString(row[6]), 
                counterpartyBankName: "Kaspi Bank", 
                knp: this.cleanString(row[7]),
                purpose: this.cleanString(row[8]),
                rawInfo: row.map(c => String(c || '')).join(' | ')
            });
        }

        return { 
            rows, 
            accountNumber: accountNumber.replace(/\s/g, ''), 
            currency: currency.toUpperCase() 
        };
    }

    /**
     * Парсинг Halyk Bank (Excel/CSV)
     */
    static async parseHalyk(file: File): Promise<ParseResult> {
        const allLines = await this.readTo2DArray(file);
        if (allLines.length === 0) return { rows: [], error: "Файл пуст" };

        let accountNumber = '';
        let currency = '';

        // 1. Поиск метаданных Halyk
        for (let i = 0; i < Math.min(20, allLines.length); i++) {
            const row = allLines[i];
            const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');

            if (rowStr.startsWith('счет') || rowStr.includes('номер счета')) {
                const found = row.find((c: any) => /KZ[A-Z0-9]{18}/i.test(String(c || '').trim()));
                if (found) accountNumber = String(found).trim().toUpperCase();
            }
            if (rowStr.startsWith('валюта')) {
                const vals = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
                if (vals.length > 1) currency = String(vals[vals.length - 1]).trim();
            }
        }

        // 2. Поиск заголовка
        const headerIndex = allLines.findIndex(row => {
            const rowStr = row.map(c => this.cleanString(c).toLowerCase()).join(' ');
            return rowStr.includes('дата валютирования') || (rowStr.includes('номер документа') && rowStr.includes('контрагент'));
        });

        if (headerIndex === -1) return { rows: [], error: "Не найден заголовок Halyk Bank" };

        const headerRow = allLines[headerIndex].map(h => this.cleanString(h).toLowerCase());
        const colMap: any = {};
        headerRow.forEach((h, idx) => {
            if (h.includes('дата валютирования') || h.includes('дата операции')) colMap.date = idx;
            if (h.includes('номер документа')) colMap.documentNumber = idx;
            if (h.includes('бик банка контрагента')) colMap.bik = idx; 
            if (h.includes('банк контрагента')) colMap.bankName = idx; 
            if (h === 'контрагент') colMap.counterparty = idx;
            if (h === 'бин контрагента') colMap.bin = idx;
            if (h === 'счет контрагента') colMap.iik = idx;
            if (h.includes('дебет')) colMap.expense = idx;
            if (h.includes('кредит')) colMap.income = idx;
            if (h.includes('назначение платежа')) colMap.purpose = idx; 
        });

        const dataRows = allLines.slice(headerIndex + 1);
        const rows: ParsedStatementRow[] = [];

        // Регулярное выражение для проверки даты в формате ДД.ММ.ГГГГ
        const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;

        for (const row of dataRows) {
            if (row.every((s: any) => !s)) continue;
            
            // ПРОВЕРКА: Если в колонке даты нет даты, это техническая строка (например, Итого), пропускаем ее.
            const dateVal = colMap.date !== undefined ? this.cleanString(row[colMap.date]) : '';
            if (!dateRegex.test(dateVal)) continue;

            const expense = colMap.expense !== undefined ? this.parseAmount(row[colMap.expense]) : 0;
            const income = colMap.income !== undefined ? this.parseAmount(row[colMap.income]) : 0;
            
            if (expense === 0 && income === 0) continue;

            const rawCounterpartyVal = colMap.counterparty !== undefined ? this.cleanString(row[colMap.counterparty]) : '';
            const rawBinVal = colMap.bin !== undefined ? this.cleanString(row[colMap.bin]) : '';
            const rawIikVal = colMap.iik !== undefined ? this.cleanString(row[colMap.iik]) : '';
            const rawBikVal = colMap.bik !== undefined ? this.cleanString(row[colMap.bik]) : '';
            const rawBankNameVal = colMap.bankName !== undefined ? this.cleanString(row[colMap.bankName]) : '';
            const rawPurposeVal = colMap.purpose !== undefined ? this.cleanString(row[colMap.purpose]) : '';

            let finalCounterpartyName = rawCounterpartyVal; 
            let finalCounterpartyBinIin = rawBinVal; 
            let finalCounterpartyIik = rawIikVal;     
            let finalCounterpartyBik = rawBikVal;
            let finalCounterpartyBankName = rawBankNameVal;

            if (!finalCounterpartyBinIin && rawCounterpartyVal) {
                const { binIin: extractedBinFromCounterparty } = this.extractNameAndBin(rawCounterpartyVal);
                if (extractedBinFromCounterparty) {
                    finalCounterpartyBinIin = extractedBinFromCounterparty;
                }
            }
            
            rows.push({
                documentNumber: colMap.documentNumber !== undefined ? this.cleanString(row[colMap.documentNumber]) : '',
                date: dateVal,
                expense,
                income,
                counterpartyName: finalCounterpartyName,
                counterpartyBinIin: finalCounterpartyBinIin,
                counterpartyIik: finalCounterpartyIik, 
                counterpartyBik: finalCounterpartyBik,
                counterpartyBankName: finalCounterpartyBankName, 
                knp: '', 
                purpose: rawPurposeVal,
                rawInfo: row.map(c => String(c || '')).join(' | ')
            });
        }

        return { 
            rows,
            accountNumber: accountNumber.replace(/\s/g, ''), 
            currency: currency.toUpperCase(),
        };
    }

    private static async readTo2DArray(file: File): Promise<any[][]> {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        
        if (isExcel) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target?.result as ArrayBuffer);
                        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                        resolve(json as any[][]);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error("Ошибка чтения Excel"));
                reader.readAsArrayBuffer(file);
            });
        } else {
            return new Promise(async (resolve) => {
                const buffer = await file.arrayBuffer();
                const utf8Decoder = new TextDecoder('utf-8');
                const utf8Text = utf8Decoder.decode(buffer);
                const hasCyrillic = /[а-яА-Я]/.test(utf8Text);
                
                if (utf8Text.includes('Период') || hasCyrillic) { 
                    resolve(this.parseCSV(utf8Text));
                } else {
                    const winDecoder = new TextDecoder('windows-1251');
                    const winText = winDecoder.decode(buffer);
                    resolve(this.parseCSV(winText));
                }
            });
        }
    }

    private static parseCSV(text: string): string[][] {
        if (!text) return [];
        const linesArr = text.split(/\r?\n/);
        let firstWithContent = linesArr.find(l => l.includes(';') || l.includes(','));
        const delimiter = (firstWithContent && firstWithContent.includes(';')) ? ';' : ',';
        
        const lines: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') { currentField += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                currentRow.push(currentField.trim()); currentField = '';
            } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
                currentRow.push(currentField.trim());
                if (currentRow.length > 0 || currentField) lines.push(currentRow);
                currentRow = []; currentField = ''; if (char === '\r') i++;
            } else currentField += char;
        }
        if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); lines.push(currentRow); }
        return lines;
    }

    private static extractNameAndBin(raw: string): { name: string, binIin: string } {
        if (!raw) return { name: '', binIin: '' };
        
        const normalized = raw.replace(/\r\n|\r/g, '\n').trim();
        const binMatch = normalized.match(/(\d{12})/);
        const binIin = binMatch ? binMatch[1] : '';
        
        let name = normalized.split('\n')[0].trim();
        name = name
            .replace(/ИИН\/БИН|БИН|ИИН/gi, '')
            .replace(binIin, '')
            .trim();
        
        name = name.replace(/^["'\s,.-]+|["'\s,.-]+$/g, '').trim();
        
        return { name: name || normalized.split('\n')[0], binIin };
    }

    private static extractNameFromPurpose(purpose: string): string {
        if (!purpose) return '';
        const lowerPurpose = purpose.toLowerCase();
        
        let match = lowerPurpose.match(/(?:от|за|поставщик|получатель|плательщик|перевод|оплата)[:\s]*([«»"']?(?:тоо|ип|ао|нао)\s+[^,;.\(\)\[\]]{3,})/i);
        if (match && match[1]) {
            let namePart = match[1].replace(/["»«']/g, '').trim();
            if (namePart.length > 3) return namePart.toUpperCase();
        }
        
        match = lowerPurpose.match(/["«»]([^"«»]{5,})["»]/);
        if (match && match[1]) {
            let namePart = match[1].trim();
            if (!['цель', 'оплата', 'услуги', 'товары', 'прочее'].includes(namePart.toLowerCase()) && namePart.length > 5) {
                return namePart.toUpperCase();
            }
        }

        return '';
    }
   

    private static parseAmount(val: any): number {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;
        const clean = String(val)
            .replace(/\s/g, '')
            .replace(/\u00A0/g, '')
            .replace(',', '.')
            .replace(/"/g, '');
        return parseFloat(clean) || 0;
    }
}
