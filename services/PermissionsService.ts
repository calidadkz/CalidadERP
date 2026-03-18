
import { AccessLevel, AppRole, UserProfile } from '@/types';

export class PermissionsService {
    static getAccess(
        user: UserProfile | null,
        module: string,
        type: 'tabs' | 'fields' | 'actions',
        key: string
    ): AccessLevel {
        if (user?.role === AppRole.ADMIN) return 'write';
        if (!user || !user.permissions) return 'none';

        const modulePerms = user.permissions[module];
        if (!modulePerms) return 'none';

        const level = modulePerms[type]?.[key];
        return level || 'none';
    }

    static canSee(user: UserProfile | null, module: string, type: 'tabs' | 'fields' | 'actions', key: string): boolean {
        return this.getAccess(user, module, type, key) !== 'none';
    }

    static canWrite(user: UserProfile | null, module: string, type: 'tabs' | 'fields' | 'actions', key: string): boolean {
        return this.getAccess(user, module, type, key) === 'write';
    }
}
