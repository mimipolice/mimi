/**
 * 快取管理器
 * 提供記憶體快取功能，減少重複的檔案讀取和 API 請求
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttlCache = new Map(); // 存儲過期時間
  }

  /**
   * 設置快取項目
   * @param {string} key - 快取鍵
   * @param {*} value - 快取值
   * @param {number} ttl - 存活時間（毫秒），0 表示永不過期
   */
  set(key, value, ttl = 0) {
    this.cache.set(key, value);
    
    if (ttl > 0) {
      const expireTime = Date.now() + ttl;
      this.ttlCache.set(key, expireTime);
    } else {
      this.ttlCache.delete(key);
    }
  }

  /**
   * 獲取快取項目
   * @param {string} key - 快取鍵
   * @returns {*} 快取值，如果不存在或已過期則返回 undefined
   */
  get(key) {
    // 檢查是否過期
    if (this.ttlCache.has(key)) {
      const expireTime = this.ttlCache.get(key);
      if (Date.now() > expireTime) {
        this.delete(key);
        return undefined;
      }
    }
    
    return this.cache.get(key);
  }

  /**
   * 檢查快取是否存在且未過期
   * @param {string} key - 快取鍵
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * 刪除快取項目
   * @param {string} key - 快取鍵
   */
  delete(key) {
    this.cache.delete(key);
    this.ttlCache.delete(key);
  }

  /**
   * 清空所有快取
   */
  clear() {
    this.cache.clear();
    this.ttlCache.clear();
  }

  /**
   * 獲取或設置快取（如果不存在則執行函數並快取結果）
   * @param {string} key - 快取鍵
   * @param {Function} fn - 獲取數據的函數
   * @param {number} ttl - 存活時間（毫秒）
   * @returns {Promise<*>} 快取值或函數執行結果
   */
  async getOrSet(key, fn, ttl = 0) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await fn();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 清理過期的快取項目
   */
  cleanup() {
    const now = Date.now();
    for (const [key, expireTime] of this.ttlCache.entries()) {
      if (now > expireTime) {
        this.delete(key);
      }
    }
  }

  /**
   * 獲取快取統計資訊
   * @returns {Object} 快取統計
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const expireTime of this.ttlCache.values()) {
      if (now > expireTime) {
        expiredCount++;
      }
    }
    
    return {
      totalItems: this.cache.size,
      expiredItems: expiredCount,
      activeItems: this.cache.size - expiredCount,
    };
  }
}

/**
 * 全域快取實例
 */
const globalCache = new CacheManager();

// 定期清理過期快取（每5分鐘）
setInterval(() => {
  globalCache.cleanup();
}, 5 * 60 * 1000);

/**
 * 快取裝飾器
 * @param {string} keyPrefix - 快取鍵前綴
 * @param {number} ttl - 存活時間（毫秒）
 * @returns {Function} 裝飾器函數
 */
function cached(keyPrefix, ttl = 5 * 60 * 1000) {
  return function(target, propertyName, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
      
      return await globalCache.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        ttl
      );
    };
    
    return descriptor;
  };
}

/**
 * 檔案快取工具
 */
class FileCache {
  constructor(cacheManager = globalCache) {
    this.cache = cacheManager;
  }

  /**
   * 快取檔案內容
   * @param {string} filePath - 檔案路徑
   * @param {Function} readFn - 讀取檔案的函數
   * @param {number} ttl - 快取時間（毫秒）
   * @returns {Promise<*>} 檔案內容
   */
  async getFileContent(filePath, readFn, ttl = 30 * 1000) {
    const fs = require('fs');
    const cacheKey = `file:${filePath}`;
    
    // 檢查檔案是否被修改
    try {
      const stats = fs.statSync(filePath);
      const modifiedTime = stats.mtime.getTime();
      const cachedData = this.cache.get(cacheKey);
      
      if (cachedData && cachedData.modifiedTime === modifiedTime) {
        return cachedData.content;
      }
      
      // 檔案被修改或不在快取中，重新讀取
      const content = await readFn();
      this.cache.set(cacheKey, {
        content,
        modifiedTime
      }, ttl);
      
      return content;
    } catch (error) {
      // 檔案不存在或讀取失敗，嘗試從快取獲取
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return cachedData.content;
      }
      throw error;
    }
  }

  /**
   * 清除檔案快取
   * @param {string} filePath - 檔案路徑
   */
  clearFileCache(filePath) {
    this.cache.delete(`file:${filePath}`);
  }
}

module.exports = {
  CacheManager,
  globalCache,
  cached,
  FileCache,
};
