
import { supabase } from './supabaseClient';
import { Counterparty, CounterpartyAccount, Currency } from '@/types';
import { TableNames } from '@/constants';

/**
 * Выбрасывается когда запись была изменена другим пользователем
 * до того, как текущий пользователь успел сохранить.
 * Передай expectedUpdatedAt в ApiService.update() чтобы включить проверку.
 */
export class ConflictError extends Error {
    constructor(tableName: string) {
        super(`Запись в "${tableName}" была изменена другим пользователем. Обновите страницу и повторите.`);
        this.name = 'ConflictError';
    }
}

const toCamel = (s: string) => {
    return s.replace(/_([a-z0-9])/g, g => g[1].toUpperCase());
};

const toSnake = (s: string) => {
    if (s.includes('_') && s === s.toLowerCase()) return s;
    let res = s.replace(/([A-Z])/g, '_$1').toLowerCase();
    res = res.replace(/__/g, '_').replace(/^_/, "");
    if (s.endsWith('M3')) {
        res = res.replace(/_m_3$/, '_m3');
    }
    return res;
};

const PROTECTED_JSON_FIELDS = [
    'matrix',
    'machineConfig',
    'priceOverrides',
    'internalComposition',
    'composition',
    'configuration',
    'settings',
    'items',
    'packingList',
    'options',
    'timeline'
];

export class ApiService {
    static get(arg0: string): { data: any; } | PromiseLike<{ data: any; }> {
        throw new Error('Method not implemented.');
    }
    static generateId(prefix?: string): string {
        const id = Math.random().toString(36).substring(2, 9).toUpperCase();
        return prefix ? `${prefix}-${id}` : id;
    }

    static generateUUID(): string {
        return crypto.randomUUID();
    }

    static keysToCamel(o: any): any {
        if (!o || typeof o !== 'object') return o;
        if (Array.isArray(o)) return o.map(i => this.keysToCamel(i));
        
        const n: any = {};
        Object.keys(o).forEach(k => {
            const camelKey = toCamel(k);
            if (PROTECTED_JSON_FIELDS.includes(camelKey)) {
                n[camelKey] = o[k];
            } else {
                n[camelKey] = this.keysToCamel(o[k]);
            }
        });
        return n;
    }

    static keysToSnake(o: any): any {
        if (!o || typeof o !== 'object') return o;
        if (Array.isArray(o)) return o.map(i => this.keysToSnake(i));
        
        const n: any = {};
        Object.keys(o).forEach(k => {
            const snakeKey = toSnake(k);
            const camelKey = toCamel(k);
            if (PROTECTED_JSON_FIELDS.includes(camelKey) || PROTECTED_JSON_FIELDS.includes(snakeKey)) {
                n[snakeKey] = o[k];
            } else {
                n[snakeKey] = this.keysToSnake(o[k]);
            }
        });
        return n;
    }

    static async fetchAll<T>(tableName: string, options?: string | Record<string, any>, retries = 3): Promise<T[]> {
        const CHUNK_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        let to = CHUNK_SIZE - 1;
        let hasMore = true;
    
        const orderBy = typeof options === 'string' ? options : null;
        const filters = typeof options === 'object' ? options : null;
    
        // УЛУЧШЕННАЯ ЛОГИКА ОПРЕДЕЛЕНИЯ ПОЛЯ ДЛЯ СОРТИРОВКИ
        let effectiveOrderBy = orderBy;
        if (!effectiveOrderBy) {
            if (tableName === TableNames.EXCHANGE_RATES) effectiveOrderBy = 'currency';
            else if (tableName === TableNames.INVENTORY_SUMMARY) effectiveOrderBy = 'product_id';
            else effectiveOrderBy = 'id';
        }
    
        while (hasMore) {
            let chunk: any[] | null = null;
            for (let i = 0; i < retries; i++) {
                try {
                    let query = supabase
                        .from(tableName)
                        .select('*')
                        .range(from, to);
    
                    if (filters) {
                        Object.entries(filters).forEach(([key, value]) => {
                            query = query.eq(toSnake(key), value);
                        });
                    }

                    if (effectiveOrderBy) {
                        query = query.order(effectiveOrderBy, { ascending: true });
                    }
    
                    const { data, error: fetchError } = await query;
    
                    if (fetchError) {
                        console.error(`[API] Error fetching ${tableName} chunk ${from}-${to} (attempt ${i + 1}):`, fetchError.message);
                        if (i === retries - 1) throw fetchError;
                        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                        continue;
                    }
                    chunk = data;
                    break;
                } catch (e: any) {
                    console.error(`[API] Network error fetching ${tableName} chunk ${from}-${to} (attempt ${i + 1}):`, e.message || e);
                    if (i === retries - 1) throw e;
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                }
            }
    
            if (chunk && chunk.length > 0) {
                allData = [...allData, ...chunk];
                if (chunk.length < CHUNK_SIZE) {
                    hasMore = false;
                } else {
                    from += CHUNK_SIZE;
                    to += CHUNK_SIZE;
                }
            } else {
                hasMore = false;
            }
        }
    
        return this.keysToCamel(allData);
    }

    static async fetchOne<T>(tableName: string, id: string): Promise<T | null> {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return this.keysToCamel(data);
    }

    static async createCounterpartyWithAccount(
        counterpartyData: Partial<Counterparty>,
        accountData: Partial<CounterpartyAccount>
    ): Promise<{ saved: Counterparty; newAccount: CounterpartyAccount | null }> {
        const saved = await this.create<Counterparty>('counterparties', counterpartyData);
        let newAccount: CounterpartyAccount | null = null;
        
        if (saved && accountData.iik) {
            const dataToSend = {
                ...accountData,
                counterpartyId: saved.id
            };
            try {
                newAccount = await this.create<CounterpartyAccount>('counterparty_accounts', dataToSend);
            } catch (accError) {
                console.error(`CRITICAL: Counterparty ${saved.id} was created, but failed to create its account.`, accError);
            }
        }
        
        return { saved, newAccount };
    }

    static async updateCounterpartyWithAccounts(
        counterpartyData: Counterparty,
        accountsData: CounterpartyAccount[]
    ): Promise<{ updated: Counterparty, newAccounts: CounterpartyAccount[] }> {
        const updated = await this.update<Counterparty>('counterparties', counterpartyData.id, counterpartyData);
        
        await this.deleteByField('counterparty_accounts', 'counterpartyId', counterpartyData.id);
        
        const accountsToCreate = accountsData
            .filter(acc => acc.iik)
            .map(acc => ({ ...acc, counterpartyId: counterpartyData.id }));

        if (accountsToCreate.length === 0) {
            return { updated, newAccounts: [] };
        }
        
        const newAccounts = await this.createMany<CounterpartyAccount>('counterparty_accounts', accountsToCreate);
        
        return { updated, newAccounts };
    }

    static async create<T>(tableName: string, data: Partial<T>): Promise<T> {
        if (!data) throw new Error(`[API] No data provided`);
        const snakeData = this.keysToSnake(data);
        const { data: created, error } = await supabase.from(tableName).insert(snakeData).select().single();
        if (error) {
            console.error(`[API] Error creating in ${tableName}:`, error.message);
            throw error;
        }
        return this.keysToCamel(created);
    }

    /**
     * @param expectedUpdatedAt  Если передан — проверяет что запись не была изменена
     *   другим пользователем. Получи значение из поля updatedAt при загрузке записи.
     *   При несовпадении выбрасывает ConflictError.
     */
    static async update<T>(tableName: string, id: string, data: Partial<T>, expectedUpdatedAt?: string): Promise<T> {
        const snakeData = this.keysToSnake(data);
        let query = supabase.from(tableName).update(snakeData).eq('id', id);
        if (expectedUpdatedAt) {
            query = query.eq('updated_at', expectedUpdatedAt);
        }
        const { data: updated, error } = await query.select().single();
        if (error) {
            // PGRST116 = 0 rows matched → запись уже изменена другим пользователем
            if (error.code === 'PGRST116' && expectedUpdatedAt) {
                throw new ConflictError(tableName);
            }
            console.error(`[API] Error updating ${tableName}:`, error.message);
            throw error;
        }
        return this.keysToCamel(updated);
    }

    static async delete(tableName: string, id: string): Promise<void> {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw error;
    }

    static async createMany<T>(tableName: string, data: Partial<T>[]): Promise<T[]> {
        if (!data || data.length === 0) return [];
        const snakeData = data.map(i => this.keysToSnake(i));
        const { data: created, error } = await supabase.from(tableName).insert(snakeData).select();
        if (error) {
            console.error(`[API] Error createMany in ${tableName}:`, error.message);
            throw error;
        }
        return this.keysToCamel(created || []);
    }

    static async upsert<T>(tableName: string, data: Partial<T>, onConflict: string = 'id'): Promise<T> {
        const snakeData = this.keysToSnake(data);
        const { data: upserted, error } = await supabase
            .from(tableName)
            .upsert(snakeData, { onConflict: toSnake(onConflict) })
            .select()
            .single();
            
        if (error) {
            console.error(`[API] Upsert Error in ${tableName}:`, error.message);
            throw error;
        }
        return this.keysToCamel(upserted);
    }

    static async upsertMany<T>(tableName: string, data: Partial<T>[], onConflict: string = 'id'): Promise<T[]> {
        if (!data || data.length === 0) return [];
        const snakeData = data.map(i => this.keysToSnake(i));
        const { data: upserted, error = null } = await supabase
            .from(tableName)
            .upsert(snakeData, { onConflict: toSnake(onConflict) })
            .select();
            
        if (error) {
            console.error(`[API] Bulk Upsert Error in ${tableName}:`, error.message);
            throw error;
        }
        return this.keysToCamel(upserted || []);
    }

    static async deleteByField(tableName: string, field: string, value: string | number): Promise<void> {
        const { error } = await supabase.from(tableName).delete().eq(toSnake(field), value);
        if (error) throw error;
    }

    static async updateExchangeRate(currency: Currency, rate: number): Promise<void> {
        await this.upsert(TableNames.EXCHANGE_RATES, { currency, rate }, 'currency');
    }

    generateId(prefix?: string): string { return ApiService.generateId(prefix); }
    generateUUID(): string { return ApiService.generateUUID(); }
    keysToCamel(o: any): any { return ApiService.keysToCamel(o); }
    keysToSnake(o: any): any { return ApiService.keysToSnake(o); }
    async fetchAll<T>(t: string, o?: string | Record<string, any>): Promise<T[]> { return ApiService.fetchAll<T>(t, o); }
    async fetchOne<T>(t: string, id: string): Promise<T | null> { return ApiService.fetchOne<T>(t, id); }
    async create<T>(t: string, d: Partial<T>): Promise<T> { return ApiService.create<T>(t, d); }
    async update<T>(t: string, id: string, d: Partial<T>, expectedUpdatedAt?: string): Promise<T> { return ApiService.update<T>(t, id, d, expectedUpdatedAt); }
    async delete(t: string, id: string): Promise<void> { return ApiService.delete(t, id); }
    async createMany<T>(t: string, d: Partial<T>[]): Promise<T[]> { return ApiService.createMany<T>(t, d); }
    async upsert<T>(t: string, d: Partial<T>, c: string = 'id'): Promise<T> { return ApiService.upsert<T>(t, d, c); }
    async upsertMany<T>(t: string, d: Partial<T>[], c: string = 'id'): Promise<T[]> { return ApiService.upsertMany<T>(t, d, c); }
    async deleteByField(t: string, f: string, v: string | number): Promise<void> { return ApiService.deleteByField(t, f, v); }
}

export const api = new ApiService();
