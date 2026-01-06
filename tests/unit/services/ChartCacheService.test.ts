/**
 * ChartCacheService 單元測試
 *
 * 測試範圍：
 * - getChartPath(): 產生快取檔案路徑
 * - saveChart(): 儲存圖表到快取
 * - getChart(): 從快取讀取圖表
 * - delChart(): 刪除快取圖表
 * - ensureCacheDirExists(): constructor 建立快取目錄
 *
 * Mock 策略：
 * - fs/promises: mock mkdir, writeFile, readFile, unlink
 * - logger: mock debug, error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockMkdir,
  mockWriteFile,
  mockReadFile,
  mockUnlink,
  mockLoggerDebug,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockReadFile: vi.fn(),
  mockUnlink: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockLoggerError: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  unlink: mockUnlink,
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  default: {
    debug: mockLoggerDebug,
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// ============================================
// Import after mocks
// ============================================

import { ChartCacheService } from '../../../src/services/ChartCacheService.js';

describe('ChartCacheService', () => {
  let service: ChartCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from('test'));
    mockUnlink.mockResolvedValue(undefined);

    service = new ChartCacheService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Constructor 測試
  // ============================================

  describe('constructor', () => {
    it('should create cache directory on initialization', () => {
      // Assert - mkdir should be called with recursive option
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.cache'),
        { recursive: true }
      );
    });

    it('should handle mkdir error gracefully', async () => {
      // Arrange
      mockMkdir.mockRejectedValueOnce(new Error('Permission denied'));

      // Act - create new instance
      new ChartCacheService();

      // Wait for async mkdir to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - should log error but not throw
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create cache directory'),
        expect.any(Error)
      );
    });
  });

  // ============================================
  // getChartPath() 測試
  // ============================================

  describe('getChartPath()', () => {
    it('should return correct path with .png extension', () => {
      // Act
      const path = service.getChartPath('test-chart');

      // Assert
      expect(path).toContain('.cache');
      expect(path).toContain('charts');
      expect(path.endsWith('test-chart.png')).toBe(true);
    });

    it('should handle special characters in key', () => {
      // Act
      const path = service.getChartPath('chart-ODOG-7d-2024');

      // Assert
      expect(path.endsWith('chart-ODOG-7d-2024.png')).toBe(true);
    });

    it('should return consistent path for same key', () => {
      // Act
      const path1 = service.getChartPath('same-key');
      const path2 = service.getChartPath('same-key');

      // Assert
      expect(path1).toBe(path2);
    });
  });

  // ============================================
  // saveChart() 測試
  // ============================================

  describe('saveChart()', () => {
    it('should save buffer to file and return path', async () => {
      // Arrange
      const buffer = Buffer.from('fake png data');

      // Act
      const result = await service.saveChart('test-key', buffer);

      // Assert
      expect(result).not.toBeNull();
      expect(result.endsWith('test-key.png')).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('test-key.png'),
        buffer
      );
    });

    it('should log debug message on success', async () => {
      // Arrange
      const buffer = Buffer.from('data');

      // Act
      await service.saveChart('my-chart', buffer);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('SAVED chart for key: my-chart')
      );
    });

    it('should return null on write error', async () => {
      // Arrange
      mockWriteFile.mockRejectedValueOnce(new Error('Disk full'));
      const buffer = Buffer.from('data');

      // Act
      const result = await service.saveChart('failing-key', buffer);

      // Assert
      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error saving chart for key failing-key'),
        expect.any(Error)
      );
    });

    it('should handle empty buffer', async () => {
      // Arrange
      const emptyBuffer = Buffer.alloc(0);

      // Act
      const result = await service.saveChart('empty-chart', emptyBuffer);

      // Assert
      expect(result).not.toBeNull();
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        emptyBuffer
      );
    });

    it('should handle large buffer', async () => {
      // Arrange
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      // Act
      const result = await service.saveChart('large-chart', largeBuffer);

      // Assert
      expect(result).not.toBeNull();
    });
  });

  // ============================================
  // getChart() 測試
  // ============================================

  describe('getChart()', () => {
    it('should return buffer on cache hit', async () => {
      // Arrange
      const expectedData = Buffer.from('cached chart data');
      mockReadFile.mockResolvedValueOnce(expectedData);

      // Act
      const result = await service.getChart('cached-key');

      // Assert
      expect(result).toEqual(expectedData);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('HIT for chart key: cached-key')
      );
    });

    it('should return null on cache miss (ENOENT)', async () => {
      // Arrange
      const enoentError = new Error('File not found') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockReadFile.mockRejectedValueOnce(enoentError);

      // Act
      const result = await service.getChart('missing-key');

      // Assert
      expect(result).toBeNull();
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('MISS for chart key: missing-key')
      );
    });

    it('should log error for non-ENOENT errors', async () => {
      // Arrange
      const permError = new Error('Permission denied') as NodeJS.ErrnoException;
      permError.code = 'EPERM';
      mockReadFile.mockRejectedValueOnce(permError);

      // Act
      const result = await service.getChart('error-key');

      // Assert
      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error GET for chart key error-key'),
        expect.any(Error)
      );
    });

    it('should call readFile with correct path', async () => {
      // Act
      await service.getChart('specific-chart');

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('specific-chart.png')
      );
    });
  });

  // ============================================
  // delChart() 測試
  // ============================================

  describe('delChart()', () => {
    it('should delete file and log success', async () => {
      // Act
      await service.delChart('delete-me');

      // Assert
      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining('delete-me.png')
      );
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('DELETED chart for key: delete-me')
      );
    });

    it('should ignore ENOENT error (file already deleted)', async () => {
      // Arrange
      const enoentError = new Error('File not found') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockUnlink.mockRejectedValueOnce(enoentError);

      // Act
      await service.delChart('already-gone');

      // Assert
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('should log error for non-ENOENT errors', async () => {
      // Arrange
      const permError = new Error('Permission denied') as NodeJS.ErrnoException;
      permError.code = 'EPERM';
      mockUnlink.mockRejectedValueOnce(permError);

      // Act
      await service.delChart('perm-error-key');

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error DEL chart for key perm-error-key'),
        expect.any(Error)
      );
    });

    it('should complete without throwing on any error', async () => {
      // Arrange
      mockUnlink.mockRejectedValueOnce(new Error('Random error'));

      // Act & Assert - should not throw
      await expect(service.delChart('any-key')).resolves.toBeUndefined();
    });
  });

  // ============================================
  // 整合場景測試
  // ============================================

  describe('integration scenarios', () => {
    it('should save and retrieve chart correctly', async () => {
      // Arrange
      const chartData = Buffer.from('chart-image-data');
      mockReadFile.mockResolvedValueOnce(chartData);

      // Act - save
      const savePath = await service.saveChart('integration-test', chartData);
      expect(savePath).not.toBeNull();

      // Act - retrieve
      const retrieved = await service.getChart('integration-test');

      // Assert
      expect(retrieved).toEqual(chartData);
    });

    it('should return null after deleting chart', async () => {
      // Arrange
      const enoentError = new Error('Not found') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';

      // Act - delete
      await service.delChart('to-delete');

      // Setup mock for subsequent get
      mockReadFile.mockRejectedValueOnce(enoentError);

      // Act - try to retrieve
      const result = await service.getChart('to-delete');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ============================================
  // 快取鍵格式測試
  // ============================================

  describe('cache key patterns', () => {
    it('should handle typical chart cache key format', () => {
      const key = 'ODOG-7d-1hour-2024-01-01';
      const path = service.getChartPath(key);

      expect(path).toContain(key);
      expect(path.endsWith('.png')).toBe(true);
    });

    it('should handle keys with underscores', () => {
      const key = 'asset_ODOG_timeframe_7d';
      const path = service.getChartPath(key);

      expect(path).toContain(key);
    });

    it('should handle uuid-style keys', () => {
      const key = '550e8400-e29b-41d4-a716-446655440000';
      const path = service.getChartPath(key);

      expect(path).toContain(key);
    });
  });
});
