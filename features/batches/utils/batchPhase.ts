import { BatchStatus } from '@/types';

/**
 * Фаза партии определяет права редактирования:
 * - 'open'          : Предрасчёт редактируемый, Партия отражает изменения
 * - 'manufacturing' : Партия — центральный объект (добавление/мягкое удаление позиций),
 *                     Предрасчёт только для чтения
 * - 'locked'        : Оба модуля заблокированы; только привязка заказов к позициям без заказа
 */
export type BatchPhase = 'open' | 'manufacturing' | 'locked';

export function getBatchPhase(status: BatchStatus): BatchPhase {
    if (status === 'open') return 'open';
    if (status === 'manufacturing') return 'manufacturing';
    return 'locked';
}

export const BATCH_PHASE_LABELS: Record<BatchPhase, string> = {
    open: 'Открыта',
    manufacturing: 'Изготовление',
    locked: 'Заблокирована',
};
