import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filename = 'Выписка_по_счету_KZ86722S000048735071 Kaspi.xlsx';
if (fs.existsSync(filename)) {
    const buf = fs.readFileSync(filename);
    const workbook = XLSX.read(buf, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(JSON.stringify(data.slice(0, 20), null, 2));
} else {
    console.log('File not found');
}
