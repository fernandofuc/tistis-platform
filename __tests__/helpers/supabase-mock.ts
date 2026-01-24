// =====================================================
// TIS TIS PLATFORM - Supabase Mock Helper
// Reusable chainable mock for Supabase client in tests
// =====================================================
//
// USAGE:
// import { createSupabaseMock, mockSupabaseModule } from '@/__tests__/helpers/supabase-mock';
//
// beforeEach(() => {
//   const mock = createSupabaseMock();
//   mock.setQueryResult({ data: [...], error: null });
//   vi.mock('@/src/shared/lib/supabase', () => mockSupabaseModule(mock));
// });
// =====================================================

import { vi, type Mock } from 'vitest';

// ======================
// TYPES
// ======================

export interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

export interface SupabaseMockConfig {
  defaultQueryResult?: QueryResult;
  defaultAuthSession?: {
    access_token: string;
    user?: { id: string; email?: string };
  } | null;
}

export interface ChainableQueryMock {
  // Query builder methods - all return chainable
  from: Mock<(table: string) => ChainableQueryMock>;
  select: Mock<(columns?: string) => ChainableQueryMock>;
  insert: Mock<(values: unknown) => ChainableQueryMock>;
  update: Mock<(values: unknown) => ChainableQueryMock>;
  upsert: Mock<(values: unknown) => ChainableQueryMock>;
  delete: Mock<() => ChainableQueryMock>;

  // Filters - all return chainable
  eq: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  neq: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  gt: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  gte: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  lt: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  lte: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  like: Mock<(column: string, pattern: string) => ChainableQueryMock>;
  ilike: Mock<(column: string, pattern: string) => ChainableQueryMock>;
  is: Mock<(column: string, value: unknown) => ChainableQueryMock>;
  in: Mock<(column: string, values: unknown[]) => ChainableQueryMock>;
  not: Mock<(column: string, operator: string, value: unknown) => ChainableQueryMock>;
  or: Mock<(filters: string) => ChainableQueryMock>;
  filter: Mock<(column: string, operator: string, value: unknown) => ChainableQueryMock>;

  // Modifiers - all return chainable
  order: Mock<(column: string, options?: { ascending?: boolean }) => ChainableQueryMock>;
  limit: Mock<(count: number) => ChainableQueryMock>;
  range: Mock<(from: number, to: number) => ChainableQueryMock>;
  single: Mock<() => ChainableQueryMock>;
  maybeSingle: Mock<() => ChainableQueryMock>;

  // Promise-like interface
  then: Mock<(
    resolve: (value: QueryResult) => void,
    reject?: (error: unknown) => void
  ) => Promise<QueryResult>>;

  // Internal state
  _result: QueryResult;
  _table: string | null;
}

export interface SupabaseMock {
  // Main query builder
  query: ChainableQueryMock;

  // Auth mock
  auth: {
    getSession: Mock<() => Promise<{ data: { session: unknown }; error: null }>>;
    getUser: Mock<() => Promise<{ data: { user: unknown }; error: null }>>;
    signIn: Mock;
    signOut: Mock;
    onAuthStateChange: Mock;
  };

  // Realtime mock
  channel: Mock<(name: string) => {
    on: Mock;
    subscribe: Mock;
    unsubscribe: Mock;
  }>;
  removeChannel: Mock;

  // Storage mock
  storage: {
    from: Mock<(bucket: string) => {
      upload: Mock;
      download: Mock;
      getPublicUrl: Mock;
      remove: Mock;
    }>;
  };

  // Configuration methods
  setQueryResult: (result: QueryResult) => void;
  setAuthSession: (session: unknown) => void;
  reset: () => void;

  // Get the mock as Supabase client (for vi.mock)
  asClient: () => ChainableQueryMock & {
    auth: SupabaseMock['auth'];
    channel: SupabaseMock['channel'];
    removeChannel: SupabaseMock['removeChannel'];
    storage: SupabaseMock['storage'];
  };
}

// ======================
// FACTORY FUNCTION
// ======================

export function createSupabaseMock(config: SupabaseMockConfig = {}): SupabaseMock {
  // Default results
  let currentQueryResult: QueryResult = config.defaultQueryResult || { data: [], error: null };
  let currentAuthSession = config.defaultAuthSession || {
    access_token: 'test-token',
    user: { id: 'user-001', email: 'test@test.com' },
  };

  // Create chainable query mock
  const createChainableQuery = (): ChainableQueryMock => {
    const chain: ChainableQueryMock = {
      _result: currentQueryResult,
      _table: null,

      // Query methods
      from: vi.fn((table: string) => {
        chain._table = table;
        return chain;
      }),
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      upsert: vi.fn(() => chain),
      delete: vi.fn(() => chain),

      // Filters
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      gt: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lt: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      like: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      is: vi.fn(() => chain),
      in: vi.fn(() => chain),
      not: vi.fn(() => chain),
      or: vi.fn(() => chain),
      filter: vi.fn(() => chain),

      // Modifiers
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      range: vi.fn(() => chain),
      single: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),

      // Promise-like - THIS IS KEY
      then: vi.fn((resolve, reject) => {
        return Promise.resolve(chain._result).then(resolve, reject);
      }),
    };

    // Make each method return a fresh chain that's also thenable
    const methods = [
      'from', 'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
      'is', 'in', 'not', 'or', 'filter',
      'order', 'limit', 'range', 'single', 'maybeSingle',
    ] as const;

    methods.forEach((method) => {
      const originalMock = chain[method] as Mock;
      (chain[method] as Mock) = vi.fn((...args: unknown[]) => {
        originalMock(...args);
        // Return chain that maintains result
        return chain;
      });
    });

    return chain;
  };

  // Create the main query chain
  const query = createChainableQuery();

  // Auth mock
  const auth = {
    getSession: vi.fn().mockResolvedValue({
      data: { session: currentAuthSession },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: currentAuthSession?.user },
      error: null,
    }),
    signIn: vi.fn().mockResolvedValue({ data: { session: currentAuthSession }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  };

  // Realtime mock
  const realtimeChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  };
  const channel = vi.fn().mockReturnValue(realtimeChannel);
  const removeChannel = vi.fn();

  // Storage mock
  const storageBucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/file' } }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const storage = {
    from: vi.fn().mockReturnValue(storageBucket),
  };

  // The mock object
  const mock: SupabaseMock = {
    query,
    auth,
    channel,
    removeChannel,
    storage,

    setQueryResult: (result: QueryResult) => {
      currentQueryResult = result;
      query._result = result;
    },

    setAuthSession: (session: unknown) => {
      currentAuthSession = session as typeof currentAuthSession;
      auth.getSession.mockResolvedValue({
        data: { session: currentAuthSession },
        error: null,
      });
      auth.getUser.mockResolvedValue({
        data: { user: currentAuthSession?.user },
        error: null,
      });
    },

    reset: () => {
      vi.clearAllMocks();
      currentQueryResult = config.defaultQueryResult || { data: [], error: null };
      query._result = currentQueryResult;
    },

    asClient: () => {
      return {
        ...query,
        auth,
        channel,
        removeChannel,
        storage,
      };
    },
  };

  return mock;
}

// ======================
// MODULE MOCK HELPER
// ======================

/**
 * Creates a mock module for vi.mock('@/src/shared/lib/supabase', ...)
 */
export function mockSupabaseModule(mock: SupabaseMock) {
  const client = mock.asClient();

  return {
    supabase: client,
    createServerClient: () => client,
    isSupabaseConfigured: () => true,
    getSupabaseUrl: () => 'https://test.supabase.co',
    DEFAULT_TENANT_ID: 'test-tenant-001',
    ESVA_TENANT_ID: 'test-tenant-001',
    getUserTenantId: vi.fn().mockResolvedValue({
      tenantId: 'test-tenant-001',
      userId: 'user-001',
      error: null,
    }),
    validateUserTenantAccess: vi.fn().mockResolvedValue({
      hasAccess: true,
      userId: 'user-001',
      error: null,
    }),
    subscribeToTable: vi.fn().mockReturnValue({
      channel: mock.channel('test'),
      unsubscribe: vi.fn(),
    }),
  };
}

// ======================
// PRESET MOCKS
// ======================

/**
 * Creates a simple mock for common test scenarios
 */
export function createSimpleSupabaseMock() {
  const mock = createSupabaseMock();

  return {
    mock,
    // Shorthand methods
    mockSuccess: <T>(data: T) => {
      mock.setQueryResult({ data, error: null });
    },
    mockError: (message: string, code?: string) => {
      mock.setQueryResult({ data: null, error: { message, code } });
    },
    mockEmpty: () => {
      mock.setQueryResult({ data: [], error: null });
    },
    mockSingle: <T>(data: T) => {
      mock.setQueryResult({ data, error: null });
    },
  };
}

// ======================
// FETCH MOCK HELPER
// ======================

/**
 * Creates a mock for global.fetch that returns JSON responses
 */
export function createFetchMock() {
  const mockFetch = vi.fn();

  return {
    mock: mockFetch,
    mockSuccess: <T>(data: T) => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data }),
      });
    },
    mockError: (message: string, status = 500) => {
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        json: () => Promise.resolve({ success: false, error: message }),
      });
    },
    mockSequence: (responses: Array<{ ok: boolean; status?: number; data?: unknown; error?: string }>) => {
      responses.forEach((response, index) => {
        if (index === 0) {
          mockFetch.mockResolvedValueOnce({
            ok: response.ok,
            status: response.status || (response.ok ? 200 : 500),
            json: () => Promise.resolve(
              response.ok
                ? { success: true, data: response.data }
                : { success: false, error: response.error }
            ),
          });
        } else {
          mockFetch.mockResolvedValueOnce({
            ok: response.ok,
            status: response.status || (response.ok ? 200 : 500),
            json: () => Promise.resolve(
              response.ok
                ? { success: true, data: response.data }
                : { success: false, error: response.error }
            ),
          });
        }
      });
    },
    install: () => {
      global.fetch = mockFetch;
    },
    reset: () => {
      mockFetch.mockClear();
    },
  };
}
