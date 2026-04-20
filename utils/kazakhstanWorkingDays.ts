/**
 * Расчёт рабочих дней с учётом выходных и праздников Республики Казахстан.
 *
 * Список праздников — Трудовой кодекс РК (фиксированные даты, ежегодные):
 *   1-2 янв  — Новый год
 *   7 янв    — Православное Рождество
 *   8 мар    — Международный женский день
 *   21-23 мар — Наурыз мейрамы
 *   1 май    — Праздник единства народа Казахстана
 *   7 май    — День защитника Отечества
 *   9 май    — День Победы
 *   6 июл    — День столицы (Астана)
 *   30 авг   — День Конституции
 *   25 окт   — День Республики (с 2022 г.)
 *   16-17 дек — День Независимости
 */

// [месяц (1-12), день]
const KZ_FIXED_HOLIDAYS: [number, number][] = [
    [1, 1],
    [1, 2],
    [1, 7],
    [3, 8],
    [3, 21],
    [3, 22],
    [3, 23],
    [5, 1],
    [5, 7],
    [5, 9],
    [7, 6],
    [8, 30],
    [10, 25],
    [12, 16],
    [12, 17],
];

function isKzHoliday(date: Date): boolean {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return KZ_FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === d);
}

function isWorkingDay(date: Date): boolean {
    const dow = date.getDay(); // 0=Вс, 6=Сб
    return dow !== 0 && dow !== 6 && !isKzHoliday(date);
}

/**
 * Прибавить N рабочих дней к дате startDateStr (YYYY-MM-DD).
 * Возвращает дату в формате YYYY-MM-DD.
 * Если startDateStr пустой или days <= 0 — возвращает ''.
 */
export function addWorkingDays(startDateStr: string, days: number): string {
    if (!startDateStr || days <= 0) return '';
    // Разбираем без перевода в UTC, чтобы не было сдвига на день
    const [y, m, d] = startDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    let count = 0;
    while (count < days) {
        date.setDate(date.getDate() + 1);
        if (isWorkingDay(date)) count++;
    }
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/**
 * Форматировать дату YYYY-MM-DD в человекочитаемую строку (ru-KZ).
 */
export function formatDateRu(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('ru-KZ', { day: 'numeric', month: 'long', year: 'numeric' });
}
