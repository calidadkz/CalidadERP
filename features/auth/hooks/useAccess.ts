
import { useAuth } from '@/features/system/context/AuthContext';
import { PermissionsService } from '@/services/PermissionsService';
import { AccessLevel } from '@/types';
import { useMemo } from 'react';

export const useAccess = (module: string) => {
    const { user } = useAuth();

    // Оборачиваем в useMemo, чтобы UI пересчитывался только при изменении матрицы прав
    return useMemo(() => ({
        /** Проверить, может ли пользователь видеть элемент */
        canSee: (type: 'tabs' | 'fields' | 'actions', key: string) => 
            PermissionsService.canSee(user, module, type, key),

        /** Проверить, может ли пользователь редактировать элемент */
        canWrite: (type: 'tabs' | 'fields' | 'actions', key: string) => 
            PermissionsService.canWrite(user, module, type, key),

        /** Получить точный уровень доступа (none | read | write) */
        getLevel: (type: 'tabs' | 'fields' | 'actions', key: string): AccessLevel => 
            PermissionsService.getAccess(user, module, type, key)
    }), [user, module]);
};
