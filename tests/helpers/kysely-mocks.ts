/**
 * Kysely Mock 工廠
 *
 * 提供 Kysely ORM 的 Mock 實作，支援鏈式呼叫的查詢建構器。
 * 讓測試可以模擬資料庫操作而不需要真實的資料庫連線。
 *
 * 使用方式：
 * ```typescript
 * const mockDb = createMockKysely();
 * mockDb._setResult({ id: 1, name: 'test' });
 *
 * // 或使用特定的查詢結果設定
 * setupRepositoryMocks(mockDb, {
 *   findResult: { id: 1, name: 'test' },
 * });
 * ```
 */

import { vi } from 'vitest';
import type { Kysely, Transaction } from 'kysely';
import type { MimiDLCDB } from '../../src/shared/database/types.js';

// ============================================
// 類型定義
// ============================================

export interface MockQueryBuilder {
  selectFrom: ReturnType<typeof vi.fn>;
  selectAll: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  whereRef: ReturnType<typeof vi.fn>;
  orWhere: ReturnType<typeof vi.fn>;
  andWhere: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  having: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  rightJoin: ReturnType<typeof vi.fn>;
  insertInto: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflict: ReturnType<typeof vi.fn>;
  updateTable: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  deleteFrom: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  returningAll: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  executeTakeFirstOrThrow: ReturnType<typeof vi.fn>;
}

export interface MockKyselyInstance<T = MimiDLCDB> extends Kysely<T> {
  _mockQueryBuilder: MockQueryBuilder;
  _setResult: (result: unknown) => void;
  _setExecuteResult: (result: unknown[]) => void;
}

// ============================================
// Mock Query Builder 工廠
// ============================================

/**
 * 建立可鏈式呼叫的 Mock 查詢建構器
 *
 * @param result - 預設的查詢結果
 * @returns Mock 查詢建構器物件
 */
export function createMockQueryBuilder<T = unknown>(
  result?: T
): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    // SELECT 相關
    selectFrom: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),

    // WHERE 子句
    where: vi.fn().mockReturnThis(),
    whereRef: vi.fn().mockReturnThis(),
    orWhere: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),

    // 排序與分頁
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),

    // 分組
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),

    // JOIN
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),

    // INSERT
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockImplementation((callback) => {
      const onConflictBuilder = {
        column: vi.fn().mockReturnThis(),
        columns: vi.fn().mockReturnThis(),
        doUpdateSet: vi.fn().mockReturnValue(builder),
        doNothing: vi.fn().mockReturnValue(builder),
      };
      if (typeof callback === 'function') {
        callback(onConflictBuilder);
      }
      return builder;
    }),

    // UPDATE
    updateTable: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),

    // DELETE
    deleteFrom: vi.fn().mockReturnThis(),

    // RETURNING
    returning: vi.fn().mockReturnThis(),
    returningAll: vi.fn().mockReturnThis(),

    // 執行
    execute: vi.fn().mockResolvedValue(result !== undefined ? [result] : []),
    executeTakeFirst: vi.fn().mockResolvedValue(result),
    executeTakeFirstOrThrow: vi
      .fn()
      .mockResolvedValue(result ?? { id: 1 }),
  };

  return builder;
}

// ============================================
// Mock Kysely 實例工廠
// ============================================

/**
 * 建立 Mock Kysely 實例
 *
 * @returns Mock Kysely 實例，包含輔助方法
 */
export function createMockKysely<
  T = MimiDLCDB,
>(): MockKyselyInstance<T> {
  const queryBuilder = createMockQueryBuilder();

  const mockDb = {
    // 查詢入口點
    selectFrom: vi.fn().mockReturnValue(queryBuilder),
    insertInto: vi.fn().mockReturnValue(queryBuilder),
    updateTable: vi.fn().mockReturnValue(queryBuilder),
    deleteFrom: vi.fn().mockReturnValue(queryBuilder),

    // 交易
    transaction: vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        // 建立交易專用的 query builder
        const trxQueryBuilder = createMockQueryBuilder();
        const trx = {
          selectFrom: vi.fn().mockReturnValue(trxQueryBuilder),
          insertInto: vi.fn().mockReturnValue(trxQueryBuilder),
          updateTable: vi.fn().mockReturnValue(trxQueryBuilder),
          deleteFrom: vi.fn().mockReturnValue(trxQueryBuilder),
          _mockQueryBuilder: trxQueryBuilder,
        };
        return callback(trx as unknown as Transaction<T>);
      }),
    }),

    // Schema（較少用於測試）
    schema: {
      createTable: vi.fn().mockReturnThis(),
      dropTable: vi.fn().mockReturnThis(),
      alterTable: vi.fn().mockReturnThis(),
    },

    // 內部輔助方法
    _mockQueryBuilder: queryBuilder,

    /**
     * 設定單一結果（用於 executeTakeFirst）
     */
    _setResult: (result: unknown) => {
      queryBuilder.execute.mockResolvedValue(
        Array.isArray(result) ? result : [result]
      );
      queryBuilder.executeTakeFirst.mockResolvedValue(result);
      queryBuilder.executeTakeFirstOrThrow.mockResolvedValue(result);
    },

    /**
     * 設定陣列結果（用於 execute）
     */
    _setExecuteResult: (results: unknown[]) => {
      queryBuilder.execute.mockResolvedValue(results);
      queryBuilder.executeTakeFirst.mockResolvedValue(results[0] ?? undefined);
      queryBuilder.executeTakeFirstOrThrow.mockResolvedValue(
        results[0] ?? { id: 1 }
      );
    },
  } as unknown as MockKyselyInstance<T>;

  return mockDb;
}

// ============================================
// Repository Mock 輔助函數
// ============================================

export interface RepositoryMockSetup {
  /** 用於 executeTakeFirst 的單一結果 */
  findResult?: unknown;
  /** 用於 execute 的陣列結果 */
  findAllResult?: unknown[];
  /** 用於 INSERT 操作的結果 */
  createResult?: unknown;
  /** 用於 UPDATE 操作的結果 */
  updateResult?: unknown;
  /** 用於 DELETE 操作的結果 */
  deleteResult?: { numDeletedRows: bigint };
}

/**
 * 設定 Repository 測試常用的 Mock 回傳值
 *
 * @param mockDb - Mock Kysely 實例
 * @param setup - Mock 設定選項
 */
export function setupRepositoryMocks(
  mockDb: MockKyselyInstance,
  setup: RepositoryMockSetup
): void {
  const qb = mockDb._mockQueryBuilder;

  if (setup.findResult !== undefined) {
    qb.executeTakeFirst.mockResolvedValue(setup.findResult);
  }

  if (setup.findAllResult !== undefined) {
    qb.execute.mockResolvedValue(setup.findAllResult);
  }

  if (setup.createResult !== undefined) {
    qb.executeTakeFirst.mockResolvedValue(setup.createResult);
    qb.execute.mockResolvedValue([setup.createResult]);
  }

  if (setup.updateResult !== undefined) {
    qb.executeTakeFirst.mockResolvedValue(setup.updateResult);
    qb.execute.mockResolvedValue([setup.updateResult]);
  }

  if (setup.deleteResult !== undefined) {
    qb.executeTakeFirst.mockResolvedValue(setup.deleteResult);
  }
}

// ============================================
// 錯誤模擬輔助函數
// ============================================

/**
 * 設定查詢拋出錯誤
 *
 * @param mockDb - Mock Kysely 實例
 * @param error - 要拋出的錯誤
 */
export function setupQueryError(
  mockDb: MockKyselyInstance,
  error: Error
): void {
  const qb = mockDb._mockQueryBuilder;
  qb.execute.mockRejectedValue(error);
  qb.executeTakeFirst.mockRejectedValue(error);
  qb.executeTakeFirstOrThrow.mockRejectedValue(error);
}

/**
 * 建立 PostgreSQL 錯誤（用於測試特定資料庫錯誤處理）
 *
 * @param code - PostgreSQL 錯誤碼（如 '23503' 為 FK 違規）
 * @param message - 錯誤訊息
 */
export function createPostgresError(
  code: string,
  message: string = 'Database error'
): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

// ============================================
// 常用 PostgreSQL 錯誤碼
// ============================================

export const PG_ERROR_CODES = {
  /** 唯一約束違規 */
  UNIQUE_VIOLATION: '23505',
  /** 外鍵約束違規 */
  FOREIGN_KEY_VIOLATION: '23503',
  /** NOT NULL 約束違規 */
  NOT_NULL_VIOLATION: '23502',
  /** CHECK 約束違規 */
  CHECK_VIOLATION: '23514',
  /** 連線失敗 */
  CONNECTION_FAILURE: '08006',
} as const;

// ============================================
// 匯出
// ============================================

export const kyselyMocks = {
  createMockQueryBuilder,
  createMockKysely,
  setupRepositoryMocks,
  setupQueryError,
  createPostgresError,
  PG_ERROR_CODES,
};
