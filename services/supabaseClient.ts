
import { createClient } from '@supabase/supabase-js';

/**
 * Получение конфигурации из окружения.
 * Сначала проверяем билд-переменные Vite, затем глобальный процесс (для серверной среды)
 */
// FIX: Cast import.meta to any to resolve TypeScript error regarding missing 'env' property on ImportMeta type
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 
                     (window as any).process?.env?.VITE_SUPABASE_URL || 
                     'https://umtlyxasirwpxizxcfbp.supabase.co';

// FIX: Cast import.meta to any to resolve TypeScript error regarding missing 'env' property on ImportMeta type
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
                          (window as any).process?.env?.VITE_SUPABASE_ANON_KEY || 
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdGx5eGFzaXJ3cHhpenhjZmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDY4NDcsImV4cCI6MjA4Mzg4Mjg0N30.HoAI6K-8FDI8l1u7gS-3C1f9xhC4IItkcNhFvIZt5oQ';

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
    console.error('[SUPABASE] Project URL is missing or invalid. Check environment variables.');
}

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);