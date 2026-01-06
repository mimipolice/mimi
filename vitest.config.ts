import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 測試環境
    environment: 'node',

    // 全域設定（讓 describe, it, expect 等不需要 import）
    globals: true,

    // 測試檔案匹配模式
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],

    // 排除項目
    exclude: ['node_modules', 'dist', 'tests/fixtures/**'],

    // 覆蓋率設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/services/**', 'src/repositories/**', 'src/utils/**'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/types/**',
        'src/locales/**',
      ],
      thresholds: {
        // 第一階段目標
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },

    // 設定檔案（全域 mock、擴展等）
    setupFiles: ['./tests/setup.ts'],

    // 超時設定
    testTimeout: 10000,
    hookTimeout: 10000,

    // Mock 重置策略
    mockReset: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
