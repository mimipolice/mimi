/**
 * Redis 模組單元測試
 *
 * 測試範圍：
 * - ensureRedisConnected(): Lazy initialization 邏輯
 * - isRedisConnected(): 連線狀態檢查
 * - closeRedis(): 優雅關閉連線
 *
 * 注意：使用 vi.unmock 繞過全域 setup.ts 中的 redis mock
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 取消全域 mock 並使用我們自己的 mock
vi.unmock('../../../src/shared/redis.js');

// Mock redis 套件 (這個會在 redis.ts 中被使用)
const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    set: vi.fn(),
    on: vi.fn(),
    isReady: true,
    isOpen: true,
};

const mockCreateClient = vi.fn(() => mockClient);

vi.mock('redis', () => ({
    createClient: mockCreateClient,
}));

// Mock logger
const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

vi.mock('../../../src/utils/logger.js', () => ({
    default: mockLogger,
}));

describe('Redis Module', () => {
    // 儲存原始環境變數
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        // 重置 mock client 的預設狀態
        mockClient.isReady = true;
        mockClient.isOpen = true;
        mockClient.connect.mockResolvedValue(undefined);
        mockClient.quit.mockResolvedValue('OK');
        // 預設啟用 Redis
        process.env.REDIS_ENABLED = 'true';
        process.env.REDIS_URL = 'redis://localhost:6379';
    });

    afterEach(() => {
        // 還原環境變數
        process.env = { ...originalEnv };
        vi.resetModules();
    });

    describe('ensureRedisConnected()', () => {
        it('should return null when REDIS_ENABLED is not true', async () => {
            // Arrange
            process.env.REDIS_ENABLED = 'false';
            vi.resetModules();
            const { ensureRedisConnected } = await import('../../../src/shared/redis.js');

            // Act
            const result = await ensureRedisConnected();

            // Assert
            expect(result).toBeNull();
            expect(mockCreateClient).not.toHaveBeenCalled();
        });

        it('should create client and connect when first called', async () => {
            // Arrange
            mockClient.isOpen = false;
            vi.resetModules();
            const { ensureRedisConnected } = await import('../../../src/shared/redis.js');

            // Act
            const result = await ensureRedisConnected();

            // Assert
            expect(mockCreateClient).toHaveBeenCalled();
            expect(mockClient.connect).toHaveBeenCalled();
            expect(result).toBe(mockClient);
        });

        it('should return null when connection fails', async () => {
            // Arrange
            mockClient.isReady = false;
            mockClient.isOpen = false;
            mockClient.connect.mockRejectedValue(new Error('Connection refused'));
            vi.resetModules();
            const { ensureRedisConnected } = await import('../../../src/shared/redis.js');

            // Act
            const result = await ensureRedisConnected();

            // Assert
            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to connect to Redis:',
                expect.any(Error)
            );
        });

        it('should register event handlers on client creation', async () => {
            // Arrange
            mockClient.isOpen = false;
            vi.resetModules();
            const { ensureRedisConnected } = await import('../../../src/shared/redis.js');

            // Act
            await ensureRedisConnected();

            // Assert
            expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith('ready', expect.any(Function));
            expect(mockClient.on).toHaveBeenCalledWith('end', expect.any(Function));
        });
    });

    describe('isRedisConnected()', () => {
        it('should return false when client is null', async () => {
            // Arrange
            process.env.REDIS_ENABLED = 'false';
            vi.resetModules();
            const { isRedisConnected } = await import('../../../src/shared/redis.js');

            // Act
            const result = isRedisConnected();

            // Assert
            expect(result).toBe(false);
        });

        it('should return true when client is ready', async () => {
            // Arrange
            mockClient.isOpen = false;
            vi.resetModules();
            const { ensureRedisConnected, isRedisConnected } = await import('../../../src/shared/redis.js');
            await ensureRedisConnected();

            // Act
            const result = isRedisConnected();

            // Assert
            expect(result).toBe(true);
        });
    });

    describe('closeRedis()', () => {
        it('should close connection when client is open', async () => {
            // Arrange
            mockClient.isOpen = false; // Start not open so connect will be called
            vi.resetModules();
            const { ensureRedisConnected, closeRedis } = await import('../../../src/shared/redis.js');
            await ensureRedisConnected();
            mockClient.isOpen = true; // Now set to open

            // Act
            await closeRedis();

            // Assert
            expect(mockClient.quit).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Redis connection closed gracefully.'
            );
        });

        it('should do nothing when client is not initialized', async () => {
            // Arrange
            process.env.REDIS_ENABLED = 'false';
            vi.resetModules();
            const { closeRedis } = await import('../../../src/shared/redis.js');

            // Act
            await closeRedis();

            // Assert
            expect(mockClient.quit).not.toHaveBeenCalled();
        });
    });
});
