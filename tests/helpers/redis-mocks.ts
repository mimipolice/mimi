/**
 * Redis Mock 工廠
 *
 * 提供 Redis 客戶端的 Mock 實作，支援記憶體內儲存。
 * 讓測試可以模擬 Redis 操作而不需要真實的 Redis 連線。
 *
 * 使用方式：
 * ```typescript
 * const mockRedis = createMockRedisClient();
 * await mockRedis.set('key', 'value');
 * const value = await mockRedis.get('key'); // 'value'
 *
 * // 或預設資料
 * const mockRedis = createMockRedisClient({ 'key': 'value' });
 * ```
 */

import { vi } from 'vitest';

// ============================================
// 類型定義
// ============================================

export interface MockRedisClient {
  // 基本操作
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  ttl: ReturnType<typeof vi.fn>;

  // 批次操作
  mGet: ReturnType<typeof vi.fn>;
  mSet: ReturnType<typeof vi.fn>;

  // Hash 操作
  hGet: ReturnType<typeof vi.fn>;
  hSet: ReturnType<typeof vi.fn>;
  hGetAll: ReturnType<typeof vi.fn>;
  hDel: ReturnType<typeof vi.fn>;

  // Set 操作
  sAdd: ReturnType<typeof vi.fn>;
  sRem: ReturnType<typeof vi.fn>;
  sMembers: ReturnType<typeof vi.fn>;
  sIsMember: ReturnType<typeof vi.fn>;

  // List 操作
  lPush: ReturnType<typeof vi.fn>;
  rPush: ReturnType<typeof vi.fn>;
  lPop: ReturnType<typeof vi.fn>;
  rPop: ReturnType<typeof vi.fn>;
  lRange: ReturnType<typeof vi.fn>;

  // 管理操作
  flushDb: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;

  // 連線管理
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;

  // 狀態
  isReady: boolean;
  isOpen: boolean;

  // 測試輔助
  _store: Map<string, string>;
  _clear: () => void;
}

export interface SetOptions {
  EX?: number;
  PX?: number;
  NX?: boolean;
  XX?: boolean;
}

// ============================================
// Mock Redis Client 工廠
// ============================================

/**
 * 建立功能完整的 Mock Redis 客戶端
 *
 * 使用記憶體內 Map 來模擬 Redis 儲存，
 * 支援基本的 get/set/del 操作。
 *
 * @param initialData - 初始資料
 * @returns Mock Redis 客戶端
 */
export function createMockRedisClient(
  initialData: Record<string, string> = {}
): MockRedisClient {
  const store = new Map<string, string>(Object.entries(initialData));
  const hashStore = new Map<string, Map<string, string>>();
  const setStore = new Map<string, Set<string>>();
  const listStore = new Map<string, string[]>();

  const mockClient: MockRedisClient = {
    // ============================================
    // 基本操作
    // ============================================

    get: vi.fn().mockImplementation(async (key: string) => {
      return store.get(key) ?? null;
    }),

    set: vi
      .fn()
      .mockImplementation(
        async (key: string, value: string, _options?: SetOptions) => {
          store.set(key, value);
          return 'OK';
        }
      ),

    del: vi.fn().mockImplementation(async (keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      let deleted = 0;
      keyArray.forEach((key) => {
        if (store.delete(key)) deleted++;
        hashStore.delete(key);
        setStore.delete(key);
        listStore.delete(key);
      });
      return deleted;
    }),

    exists: vi.fn().mockImplementation(async (keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      return keyArray.filter((key) => store.has(key)).length;
    }),

    expire: vi.fn().mockImplementation(async (key: string, _seconds: number) => {
      return store.has(key) ? 1 : 0;
    }),

    ttl: vi.fn().mockImplementation(async (key: string) => {
      return store.has(key) ? -1 : -2; // -1 = 無過期, -2 = 不存在
    }),

    // ============================================
    // 批次操作
    // ============================================

    mGet: vi.fn().mockImplementation(async (keys: string[]) => {
      return keys.map((key) => store.get(key) ?? null);
    }),

    mSet: vi
      .fn()
      .mockImplementation(async (entries: Record<string, string>) => {
        Object.entries(entries).forEach(([key, value]) => {
          store.set(key, value);
        });
        return 'OK';
      }),

    // ============================================
    // Hash 操作
    // ============================================

    hGet: vi.fn().mockImplementation(async (key: string, field: string) => {
      const hash = hashStore.get(key);
      return hash?.get(field) ?? null;
    }),

    hSet: vi
      .fn()
      .mockImplementation(
        async (key: string, field: string, value: string) => {
          if (!hashStore.has(key)) {
            hashStore.set(key, new Map());
          }
          const hash = hashStore.get(key)!;
          const isNew = !hash.has(field);
          hash.set(field, value);
          return isNew ? 1 : 0;
        }
      ),

    hGetAll: vi.fn().mockImplementation(async (key: string) => {
      const hash = hashStore.get(key);
      if (!hash) return {};
      return Object.fromEntries(hash.entries());
    }),

    hDel: vi
      .fn()
      .mockImplementation(async (key: string, fields: string | string[]) => {
        const hash = hashStore.get(key);
        if (!hash) return 0;
        const fieldArray = Array.isArray(fields) ? fields : [fields];
        let deleted = 0;
        fieldArray.forEach((field) => {
          if (hash.delete(field)) deleted++;
        });
        return deleted;
      }),

    // ============================================
    // Set 操作
    // ============================================

    sAdd: vi
      .fn()
      .mockImplementation(async (key: string, members: string | string[]) => {
        if (!setStore.has(key)) {
          setStore.set(key, new Set());
        }
        const set = setStore.get(key)!;
        const memberArray = Array.isArray(members) ? members : [members];
        let added = 0;
        memberArray.forEach((member) => {
          if (!set.has(member)) {
            set.add(member);
            added++;
          }
        });
        return added;
      }),

    sRem: vi
      .fn()
      .mockImplementation(async (key: string, members: string | string[]) => {
        const set = setStore.get(key);
        if (!set) return 0;
        const memberArray = Array.isArray(members) ? members : [members];
        let removed = 0;
        memberArray.forEach((member) => {
          if (set.delete(member)) removed++;
        });
        return removed;
      }),

    sMembers: vi.fn().mockImplementation(async (key: string) => {
      const set = setStore.get(key);
      return set ? [...set] : [];
    }),

    sIsMember: vi
      .fn()
      .mockImplementation(async (key: string, member: string) => {
        const set = setStore.get(key);
        return set?.has(member) ? 1 : 0;
      }),

    // ============================================
    // List 操作
    // ============================================

    lPush: vi
      .fn()
      .mockImplementation(async (key: string, elements: string | string[]) => {
        if (!listStore.has(key)) {
          listStore.set(key, []);
        }
        const list = listStore.get(key)!;
        const elementArray = Array.isArray(elements) ? elements : [elements];
        list.unshift(...elementArray);
        return list.length;
      }),

    rPush: vi
      .fn()
      .mockImplementation(async (key: string, elements: string | string[]) => {
        if (!listStore.has(key)) {
          listStore.set(key, []);
        }
        const list = listStore.get(key)!;
        const elementArray = Array.isArray(elements) ? elements : [elements];
        list.push(...elementArray);
        return list.length;
      }),

    lPop: vi.fn().mockImplementation(async (key: string) => {
      const list = listStore.get(key);
      return list?.shift() ?? null;
    }),

    rPop: vi.fn().mockImplementation(async (key: string) => {
      const list = listStore.get(key);
      return list?.pop() ?? null;
    }),

    lRange: vi
      .fn()
      .mockImplementation(async (key: string, start: number, stop: number) => {
        const list = listStore.get(key);
        if (!list) return [];
        const end = stop === -1 ? undefined : stop + 1;
        return list.slice(start, end);
      }),

    // ============================================
    // 管理操作
    // ============================================

    flushDb: vi.fn().mockImplementation(async () => {
      store.clear();
      hashStore.clear();
      setStore.clear();
      listStore.clear();
      return 'OK';
    }),

    keys: vi.fn().mockImplementation(async (pattern: string) => {
      // 簡單的 pattern 匹配（只支援 * 萬用字元）
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      return [...store.keys()].filter((key) => regex.test(key));
    }),

    // ============================================
    // 連線管理
    // ============================================

    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),

    // ============================================
    // 狀態
    // ============================================

    isReady: true,
    isOpen: true,

    // ============================================
    // 測試輔助
    // ============================================

    _store: store,

    _clear: () => {
      store.clear();
      hashStore.clear();
      setStore.clear();
      listStore.clear();
    },
  };

  return mockClient;
}

// ============================================
// 失敗的 Redis Client
// ============================================

/**
 * 建立會拋出錯誤的 Mock Redis 客戶端
 *
 * 用於測試 Redis 不可用時的錯誤處理邏輯。
 *
 * @param errorMessage - 錯誤訊息
 * @returns 會拋出錯誤的 Mock Redis 客戶端
 */
export function createFailingRedisClient(
  errorMessage: string = 'Redis connection error'
): MockRedisClient {
  const error = new Error(errorMessage);

  return {
    // 所有操作都會失敗
    get: vi.fn().mockRejectedValue(error),
    set: vi.fn().mockRejectedValue(error),
    del: vi.fn().mockRejectedValue(error),
    exists: vi.fn().mockRejectedValue(error),
    expire: vi.fn().mockRejectedValue(error),
    ttl: vi.fn().mockRejectedValue(error),

    mGet: vi.fn().mockRejectedValue(error),
    mSet: vi.fn().mockRejectedValue(error),

    hGet: vi.fn().mockRejectedValue(error),
    hSet: vi.fn().mockRejectedValue(error),
    hGetAll: vi.fn().mockRejectedValue(error),
    hDel: vi.fn().mockRejectedValue(error),

    sAdd: vi.fn().mockRejectedValue(error),
    sRem: vi.fn().mockRejectedValue(error),
    sMembers: vi.fn().mockRejectedValue(error),
    sIsMember: vi.fn().mockRejectedValue(error),

    lPush: vi.fn().mockRejectedValue(error),
    rPush: vi.fn().mockRejectedValue(error),
    lPop: vi.fn().mockRejectedValue(error),
    rPop: vi.fn().mockRejectedValue(error),
    lRange: vi.fn().mockRejectedValue(error),

    flushDb: vi.fn().mockRejectedValue(error),
    keys: vi.fn().mockRejectedValue(error),

    connect: vi.fn().mockRejectedValue(error),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),

    isReady: false,
    isOpen: false,

    _store: new Map(),
    _clear: () => {},
  };
}

// ============================================
// Null Redis Client（模擬未啟用狀態）
// ============================================

/**
 * 建立 null Redis 客戶端
 *
 * 用於模擬 Redis 未啟用的情況。
 * 在專案中，當 REDIS_ENABLED=false 時，redisClient 為 null。
 */
export const nullRedisClient = null;

// ============================================
// 匯出
// ============================================

export const redisMocks = {
  createMockRedisClient,
  createFailingRedisClient,
  nullRedisClient,
};
