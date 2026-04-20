/**
 * Форматирует дату из ISO-строки (YYYY-MM-DD или ISO datetime) в формат ДД.ММ.ГГГГ
 */
export function formatDateDMY(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const s = dateStr.slice(0, 10); // берём только дату
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return dateStr;
    return `${d}.${m}.${y}`;
}
