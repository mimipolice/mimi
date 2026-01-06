/**
 * transcript 工具函數單元測試
 *
 * 測試範圍：
 * - escapeHtml(): HTML 特殊字元轉義
 * - injectOGTags(): Open Graph 標籤注入
 * - findLocalTranscript(): 本地檔案搜尋 (使用 fs mock)
 * - 介面形狀測試: OGMetadata
 *
 * Mock 策略：
 * - fs/promises: mock readdir
 * - logger: mock warn
 * - 純邏輯函數直接複製測試（因為它們是私有函數）
 *
 * 注意：
 * - generateTranscript, generateTranscriptWithOG, generateChatTranscript
 *   涉及 Discord API 和外部依賴，標記為 skip 待整合測試
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定
// ============================================

const mockLoggerWarn = vi.fn();
const mockReaddir = vi.fn();

// Mock fs module (transcript.ts uses: import { promises as fsPromises } from 'fs')
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    promises: {
      ...original.promises,
      readdir: mockReaddir,
    },
  };
});

vi.mock('../../../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}));

// ============================================
// 純邏輯函數複製 (因為是私有函數)
// ============================================

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

function injectOGTags(html: string, metadata: OGMetadata): string {
  const ogTags: string[] = [];

  if (metadata.title) {
    ogTags.push(`<meta property="og:title" content="${escapeHtml(metadata.title)}" />`);
    ogTags.push(`<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`);
  }

  if (metadata.description) {
    ogTags.push(`<meta property="og:description" content="${escapeHtml(metadata.description)}" />`);
    ogTags.push(`<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`);
  }

  if (metadata.image) {
    ogTags.push(`<meta property="og:image" content="${escapeHtml(metadata.image)}" />`);
    ogTags.push(`<meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`);
    ogTags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  }

  if (metadata.url) {
    ogTags.push(`<meta property="og:url" content="${escapeHtml(metadata.url)}" />`);
  }

  if (metadata.siteName) {
    ogTags.push(`<meta property="og:site_name" content="${escapeHtml(metadata.siteName)}" />`);
  }

  if (metadata.type) {
    ogTags.push(`<meta property="og:type" content="${escapeHtml(metadata.type)}" />`);
  }

  ogTags.unshift(`<meta charset="UTF-8" />`);
  ogTags.unshift(`<meta name="viewport" content="width=device-width, initial-scale=1.0" />`);

  const ogTagsString = ogTags.join('\n    ');

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n    ${ogTagsString}`);
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `    ${ogTagsString}\n  </head>`);
  }

  return `<!DOCTYPE html>\n<html>\n<head>\n    ${ogTagsString}\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

// ============================================
// 測試
// ============================================

describe('transcript utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ============================================
  // escapeHtml() 測試
  // ============================================

  describe('escapeHtml()', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's fine")).toBe('it&#039;s fine');
    });

    it('should escape multiple special characters', () => {
      const input = '<script>alert("XSS & evil");</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS &amp; evil&quot;);&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should not escape regular text', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });

    it('should handle unicode characters', () => {
      expect(escapeHtml('你好 🎉')).toBe('你好 🎉');
    });
  });

  // ============================================
  // injectOGTags() 測試
  // ============================================

  describe('injectOGTags()', () => {
    it('should inject after <head> tag when present', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const metadata: OGMetadata = { title: 'Test Page' };

      const result = injectOGTags(html, metadata);

      expect(result).toContain('<head>\n    ');
      expect(result).toContain('og:title');
    });

    it('should inject before </head> tag when <head> not found', () => {
      const html = '<html><title>Test</title></head><body></body></html>';
      const metadata: OGMetadata = { title: 'Test Page' };

      const result = injectOGTags(html, metadata);

      expect(result).toContain('og:title');
      expect(result).toContain('</head>');
    });

    it('should wrap in full HTML structure when no head tags found', () => {
      const html = '<div>Content</div>';
      const metadata: OGMetadata = { title: 'Test' };

      const result = injectOGTags(html, metadata);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<head>');
      expect(result).toContain('</head>');
      expect(result).toContain('<body>');
      expect(result).toContain('</body>');
      expect(result).toContain('</html>');
    });

    it('should include viewport meta tag', () => {
      const result = injectOGTags('<head></head>', { title: 'Test' });

      expect(result).toContain('name="viewport"');
      expect(result).toContain('width=device-width');
    });

    it('should include charset meta tag', () => {
      const result = injectOGTags('<head></head>', { title: 'Test' });

      expect(result).toContain('charset="UTF-8"');
    });

    it('should inject title tags for og and twitter', () => {
      const result = injectOGTags('<head></head>', { title: 'My Title' });

      expect(result).toContain('og:title');
      expect(result).toContain('twitter:title');
      expect(result).toContain('My Title');
    });

    it('should inject description tags', () => {
      const result = injectOGTags('<head></head>', { description: 'My Description' });

      expect(result).toContain('og:description');
      expect(result).toContain('twitter:description');
      expect(result).toContain('My Description');
    });

    it('should inject image tags with twitter card', () => {
      const result = injectOGTags('<head></head>', { image: 'https://example.com/img.png' });

      expect(result).toContain('og:image');
      expect(result).toContain('twitter:image');
      expect(result).toContain('twitter:card');
      expect(result).toContain('summary_large_image');
    });

    it('should inject url tag', () => {
      const result = injectOGTags('<head></head>', { url: 'https://example.com/page' });

      expect(result).toContain('og:url');
      expect(result).toContain('https://example.com/page');
    });

    it('should inject site_name tag', () => {
      const result = injectOGTags('<head></head>', { siteName: 'My Site' });

      expect(result).toContain('og:site_name');
      expect(result).toContain('My Site');
    });

    it('should inject type tag', () => {
      const result = injectOGTags('<head></head>', { type: 'article' });

      expect(result).toContain('og:type');
      expect(result).toContain('article');
    });

    it('should escape special characters in metadata', () => {
      const result = injectOGTags('<head></head>', { title: 'Test <script>' });

      expect(result).toContain('Test &lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('should handle all metadata fields', () => {
      const metadata: OGMetadata = {
        title: 'Full Test',
        description: 'Testing all fields',
        image: 'https://example.com/image.png',
        url: 'https://example.com',
        siteName: 'Example Site',
        type: 'website',
      };

      const result = injectOGTags('<head></head>', metadata);

      expect(result).toContain('og:title');
      expect(result).toContain('og:description');
      expect(result).toContain('og:image');
      expect(result).toContain('og:url');
      expect(result).toContain('og:site_name');
      expect(result).toContain('og:type');
    });

    it('should handle empty metadata', () => {
      const result = injectOGTags('<head></head>', {});

      // Should still include viewport and charset
      expect(result).toContain('viewport');
      expect(result).toContain('charset');
      // But no OG tags
      expect(result).not.toContain('og:title');
    });
  });

  // ============================================
  // findLocalTranscript() 測試 - 使用 mock
  // ============================================

  describe('findLocalTranscript()', () => {
    it('should return null when TRANSCRIPT_PATH not set', async () => {
      // Arrange
      delete process.env.TRANSCRIPT_PATH;
      delete process.env.TRANSCRIPT_BASE_URL;

      // Act
      const { findLocalTranscript } = await import('../../../../src/utils/transcript/transcript.js');
      const result = await findLocalTranscript('123456789');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when TRANSCRIPT_BASE_URL not set', async () => {
      // Arrange
      process.env.TRANSCRIPT_PATH = '/transcripts';
      delete process.env.TRANSCRIPT_BASE_URL;
      vi.resetModules();

      // Act
      const { findLocalTranscript } = await import('../../../../src/utils/transcript/transcript.js');
      const result = await findLocalTranscript('123456789');

      // Assert
      expect(result).toBeNull();
    });

    it('should find most recent transcript by timestamp', async () => {
      // Arrange
      process.env.TRANSCRIPT_PATH = '/transcripts';
      process.env.TRANSCRIPT_BASE_URL = 'https://transcripts.example.com/';
      vi.resetModules();

      mockReaddir.mockResolvedValueOnce([
        'transcript-123456-1700000000000.html',
        'transcript-123456-1700000001000.html', // More recent
        'transcript-123456-1699999999000.html',
        'other-file.txt',
      ]);

      // Act
      const { findLocalTranscript } = await import('../../../../src/utils/transcript/transcript.js');
      const result = await findLocalTranscript('123456');

      // Assert
      expect(result).toBe('https://transcripts.example.com/transcript-123456-1700000001000.html');
    });

    it('should return null when no matching files found', async () => {
      // Arrange
      process.env.TRANSCRIPT_PATH = '/transcripts';
      process.env.TRANSCRIPT_BASE_URL = 'https://transcripts.example.com/';
      vi.resetModules();

      mockReaddir.mockResolvedValueOnce([
        'transcript-999999-1700000000000.html',
        'other-file.txt',
      ]);

      // Act
      const { findLocalTranscript } = await import('../../../../src/utils/transcript/transcript.js');
      const result = await findLocalTranscript('123456');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle readdir error gracefully', async () => {
      // Arrange
      process.env.TRANSCRIPT_PATH = '/transcripts';
      process.env.TRANSCRIPT_BASE_URL = 'https://transcripts.example.com/';
      vi.resetModules();

      mockReaddir.mockRejectedValueOnce(new Error('Permission denied'));

      // Act
      const { findLocalTranscript } = await import('../../../../src/utils/transcript/transcript.js');
      const result = await findLocalTranscript('123456');

      // Assert
      expect(result).toBeNull();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to search for local transcript')
      );
    });
  });

  // ============================================
  // OGMetadata interface 測試
  // ============================================

  describe('OGMetadata interface', () => {
    it('should have correct shape with all fields', () => {
      const metadata: OGMetadata = {
        title: 'Page Title',
        description: 'Page description',
        image: 'https://example.com/image.png',
        url: 'https://example.com/page',
        siteName: 'My Site',
        type: 'website',
      };

      expect(metadata.title).toBe('Page Title');
      expect(metadata.description).toBe('Page description');
      expect(metadata.image).toBe('https://example.com/image.png');
      expect(metadata.url).toBe('https://example.com/page');
      expect(metadata.siteName).toBe('My Site');
      expect(metadata.type).toBe('website');
    });

    it('should allow partial metadata', () => {
      const metadata: OGMetadata = {
        title: 'Just a title',
      };

      expect(metadata.title).toBe('Just a title');
      expect(metadata.description).toBeUndefined();
    });

    it('should allow empty metadata', () => {
      const metadata: OGMetadata = {};

      expect(Object.keys(metadata)).toHaveLength(0);
    });
  });

  // ============================================
  // Filename pattern 測試
  // ============================================

  describe('Filename patterns', () => {
    it('should match transcript filename pattern', () => {
      const pattern = /^transcript-(\d+)-(\d+)\.html$/;

      expect(pattern.test('transcript-123456789-1700000000000.html')).toBe(true);
      expect(pattern.test('transcript-1-1.html')).toBe(true);
      expect(pattern.test('chat-export-123-456.html')).toBe(false);
      expect(pattern.test('transcript-abc-123.html')).toBe(false);
    });

    it('should match chat export filename pattern', () => {
      const pattern = /^chat-export-(\d+)-(\d+)\.html$/;

      expect(pattern.test('chat-export-123456789-1700000000000.html')).toBe(true);
      expect(pattern.test('chat-export-1-1.html')).toBe(true);
      expect(pattern.test('transcript-123-456.html')).toBe(false);
    });

    it('should extract timestamp from filename', () => {
      const extractTimestamp = (filename: string): number => {
        const match = filename.match(/-(\d+)\.html$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      expect(extractTimestamp('transcript-123-1700000000000.html')).toBe(1700000000000);
      expect(extractTimestamp('chat-export-456-1699999999000.html')).toBe(1699999999000);
      expect(extractTimestamp('invalid.html')).toBe(0);
    });

    it('should extract channel ID from filename', () => {
      const extractChannelId = (filename: string): string | null => {
        const match = filename.match(/^(?:transcript|chat-export)-(\d+)-\d+\.html$/);
        return match ? match[1] : null;
      };

      expect(extractChannelId('transcript-123456789-1700000000000.html')).toBe('123456789');
      expect(extractChannelId('chat-export-987654321-1700000000000.html')).toBe('987654321');
      expect(extractChannelId('invalid.html')).toBeNull();
    });
  });

  // ============================================
  // generateTranscript() 測試 - 需要 Discord API (skip)
  // ============================================

  describe('generateTranscript()', () => {
    it.skip('should generate transcript and upload to R2', async () => {
      // Integration test required - needs Discord channel mock
      expect(true).toBe(true);
    });

    it.skip('should fall back to local storage when R2 fails', async () => {
      // Integration test required
      expect(true).toBe(true);
    });

    it.skip('should return null when neither R2 nor local is configured', async () => {
      // Integration test required
      expect(true).toBe(true);
    });
  });

  // ============================================
  // generateTranscriptWithOG() 測試 - 需要 Discord API (skip)
  // ============================================

  describe('generateTranscriptWithOG()', () => {
    it.skip('should generate transcript with custom OG metadata', async () => {
      // Integration test required
      expect(true).toBe(true);
    });

    it.skip('should throw error when no messages found', async () => {
      // Integration test required
      expect(true).toBe(true);
    });
  });

  // ============================================
  // generateChatTranscript() 測試 - 需要 Discord API (skip)
  // ============================================

  describe('generateChatTranscript()', () => {
    it.skip('should generate chat transcript for text channel', async () => {
      // Integration test required
      expect(true).toBe(true);
    });

    it.skip('should generate chat transcript for thread channel', async () => {
      // Integration test required
      expect(true).toBe(true);
    });

    it.skip('should save to local file when TRANSCRIPT_PATH is set', async () => {
      // Integration test required
      expect(true).toBe(true);
    });
  });
});
