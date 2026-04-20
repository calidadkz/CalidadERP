export type AccessLevel = 'none' | 'read' | 'write';

export enum AppRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    ROP = 'rop',
    ACCOUNTANT = 'accountant',
    PROCUREMENT = 'procurement',
    TECHNICIAN = 'technician',
    LOGISTICS = 'logistics',
    WAREHOUSE = 'warehouse',
    GUEST = 'guest'
}

export interface RolePermissions {
    [module: string]: {
        tabs?: { [key: string]: AccessLevel };
        fields?: { [key: string]: AccessLevel };
        actions?: { [key: string]: AccessLevel };
    };
}

export interface UserProfile {
    id: string;
    email: string;
    fullName?: string;
    role: AppRole;
    permissions: RolePermissions;
    employeeId?: string;  // Привязка к сотруднику (для фильтрации заказов)
}
