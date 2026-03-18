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
    knp: string;
    purpose: string;
    rawInfo: string;
}

export interface ParseResult {
    rows: ParsedStatementRow[];
    error?: string;
    debugInfo?: string[];
}

export class StatementParser {

    /**
     * Парсинг Kaspi Pay (Excel или CSV)
     */
    static async parseKaspi(file: File): Promise<ParseResult> {
        const allLines = await this.readTo2DArray(file);
        if (allLines.length === 0) return { rows: [], error: "Файл пуст" };

        // Умный поиск заголовка: ищем строку, где есть "№", "дата" и "дебет/кредит" или "операц"
        const headerIndex = allLines.findIndex(row => {
            const rowStr = row.map(c => String(c ?? '').toLowerCase()).join(' ');
            const hasDoc = rowStr.includes('№') || rowStr.includes('номер') || rowStr.includes('документ');
            const hasDate = rowStr.includes('дата');
            const hasKaspiMarkers = rowStr.includes('операц') || rowStr.includes('бенефициар');
            return hasDoc && hasDate && hasKaspiMarkers;
        });

        if (headerIndex === -1) {
            return { rows: [], error: "Не найден заголовок Kaspi Pay. Убедитесь, что в файле есть столбцы: № документа, Дата операции, Дебет, Кредит." };
        }

        const dataRows = allLines.slice(headerIndex + 1);
        const rows: ParsedStatementRow[] = [];

        for (const row of dataRows) {
            const rowStrings = row.map(cell => String(cell ?? '').trim());
            
            // Если строка пустая или это итоги — пропускаем
            if (!rowStrings[0] && !rowStrings[1] && !rowStrings[4]) continue;
            if (rowStrings.some(s => s.toLowerCase().includes('итого'))) break;

            // В Kaspi строгий порядок: 0-№, 1-Дата, 2-Расход, 3-Приход, 4-Контрагент...
            const { name, binIin } = this.extractNameAndBin(rowStrings[4]);

            // Валидация: должна быть либо дата, либо сумма
            if (!rowStrings[1] || (this.parseAmount(rowStrings[2]) === 0 && this.parseAmount(rowStrings[3]) === 0)) {
                continue;
            }

            rows.push({
                documentNumber: rowStrings[0],
                date: rowStrings[1],
                expense: this.parseAmount(rowStrings[2]),
                income: this.parseAmount(rowStrings[3]),
                counterpartyName: name,
                counterpartyBinIin: binIin,
                counterpartyIik: rowStrings[5] || '',
                counterpartyBik: rowStrings[6] || '',
                knp: rowStrings[7] || '',
                purpose: rowStrings[8] || '',
                rawInfo: rowStrings.join(' | ')
            });
        }

        if (rows.length === 0) {
            return { rows: [], error: "В файле Kaspi найден заголовок, но не обнаружено строк с операциями." };
        }

        return { rows };
    }

    /**
     * Парсинг Halyk Bank (Excel или CSV)
     */
    static async parseHalyk(file: File): Promise<ParseResult> {
        const allLines = await this.readTo2DArray(file);
        if (allLines.length === 0) return { rows: [], error: "Файл пуст" };

        const headerIndex = allLines.findIndex(row => {
            const rowStr = row.map(c => String(c ?? '').toLowerCase()).join(' ');
            return rowStr.includes('дата') && rowStr.includes('номер документа') && (rowStr.includes('дебет') || rowStr.includes('кредит'));
        });

        if (headerIndex === -1) return { rows: [], error: "Не найден заголовок Halyk Bank (Дата, Номер документа, Дебет/Кредит)" };

        const headerRow = allLines[headerIndex].map(h => String(h).toLowerCase());
        const colMap: any = {};
        headerRow.forEach((h, idx) => {
            if (h.includes('дата')) colMap.date = idx;
            if (h.includes('номер документа')) colMap.documentNumber = idx;
            if (h.includes('дебет')) colMap.expense = idx;
            if (h.includes('кредит')) colMap.income = idx;
            if (h.includes('контрагент')) colMap.counterparty = idx;
            if (h.includes('детали платежа')) colMap.purpose = idx;
        });

        const dataRows = allLines.slice(headerIndex + 1);
        const rows: ParsedStatementRow[] = [];

        for (const row of dataRows) {
            const rowStrings = row.map(cell => String(cell ?? '').trim());
            if (rowStrings.every(s => !s) || rowStrings.some(s => s.toLowerCase().includes('итого'))) continue;

            const rawName = colMap.counterparty !== undefined ? rowStrings[colMap.counterparty] : '';
            if (!rawName && !rowStrings[colMap.date]) continue;

            const { name, binIin } = this.extractNameAndBin(rawName);

            rows.push({
                documentNumber: colMap.documentNumber !== undefined ? rowStrings[colMap.documentNumber] : '',
                date: colMap.date !== undefined ? rowStrings[colMap.date] : '',
                expense: colMap.expense !== undefined ? this.parseAmount(rowStrings[colMap.expense]) : 0,
                income: colMap.income !== undefined ? this.parseAmount(rowStrings[colMap.income]) : 0,
                counterpartyName: name,
                counterpartyBinIin: binIin,
                counterpartyIik: '', 
                counterpartyBik: '',
                knp: '',
                purpose: colMap.purpose !== undefined ? rowStrings[colMap.purpose] : '',
                rawInfo: rowStrings.join(' | ')
            });
        }

        return { rows };
    }

    private static async readTo2DArray(file: File): Promise<any[][]> {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        
        if (isExcel) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target?.result as ArrayBuffer);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(worksheet, { header: 1 }));
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error("Ошибка чтения Excel"));
                reader.readAsArrayBuffer(file);
            });
        } else {
            // CSV: Сначала пробуем UTF-8, если там нет кириллицы или есть ошибки — Windows-1251
            return new Promise(async (resolve) => {
                const buffer = await file.arrayBuffer();
                
                // Пробуем UTF-8
                const utf8Decoder = new TextDecoder('utf-8');
                const utf8Text = utf8Decoder.decode(buffer);
                let rows = this.parseCSV(utf8Text);
                
                // Проверка: если в UTF-8 нет русских букв, а в файле они должны быть, или есть спец-символы ""
                const hasCyrillic = /[а-яА-Я]/.test(utf8Text);
                if (utf8Text.includes('') || !hasCyrillic) {
                    const winDecoder = new TextDecoder('windows-1251');
                    const winText = winDecoder.decode(buffer);
                    resolve(this.parseCSV(winText));
                } else {
                    resolve(rows);
                }
            });
        }
    }

    private static parseCSV(text: string): string[][] {
        if (!text) return [];
        // Определяем разделитель
        const firstLine = text.split('\n')[0] || '';
        const delimiter = firstLine.includes(';') ? ';' : ',';
        
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
                if (currentRow.length > 0) lines.push(currentRow);
                currentRow = []; currentField = ''; if (char === '\r') i++;
            } else currentField += char;
        }
        if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); lines.push(currentRow); }
        return lines;
    }

    private static extractNameAndBin(raw: string): { name: string, binIin: string } {
        if (!raw) return { name: '', binIin: '' };
        // Очистка от переносов строк сразу
        const cleanRaw = raw.replace(/\r?\n|\r/g, ' ').trim();
        const binMatch = cleanRaw.match(/(?:ИИН\/БИН|БИН|ИИН)?\s*(\d{12})/i);
        const binIin = binMatch ? binMatch[1] : '';
        
        let name = cleanRaw;
        if (binMatch) name = cleanRaw.replace(binMatch[0], '');
        
        // Удаляем мусор по краям
        name = name.replace(/^["'\s,.-]+|["'\s,.-]+$/g, '').replace(/""/g, '"').trim();
        
        return { name: name || cleanRaw, binIin };
    }

    private static parseAmount(val: any): number {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;
        const sVal = String(val);
        // Убираем все пробелы (включая неразрывные) и меняем запятую на точку
        const clean = sVal.replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.').replace(/"/g, '');
        return parseFloat(clean) || 0;
    }
}
