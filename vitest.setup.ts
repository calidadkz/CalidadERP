import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking any global things if needed
// Example: Mocking supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  }),
}));
