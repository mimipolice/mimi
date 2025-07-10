/**
 * 統一錯誤處理工具
 */
class ErrorHandler {
  /**
   * 包裝異步函數，提供統一的錯誤處理
   * @param {Function} fn - 要包裝的異步函數
   * @param {string} context - 錯誤上下文描述
   * @returns {Function} 包裝後的函數
   */
  static wrapAsync(fn, context = "操作") {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error(`[${context}] 錯誤:`, error.message);
        throw new AppError(`${context}失敗: ${error.message}`, error.code || 'UNKNOWN_ERROR');
      }
    };
  }

  /**
   * 安全執行異步函數，不拋出錯誤
   * @param {Function} fn - 要執行的異步函數
   * @param {*} defaultValue - 發生錯誤時的預設返回值
   * @param {string} context - 錯誤上下文描述
   * @returns {Promise<*>} 執行結果或預設值
   */
  static async safeExecute(fn, defaultValue = null, context = "操作") {
    try {
      return await fn();
    } catch (error) {
      console.error(`[${context}] 錯誤 (已忽略):`, error.message);
      return defaultValue;
    }
  }

  /**
   * 重試機制
   * @param {Function} fn - 要重試的函數
   * @param {number} maxRetries - 最大重試次數
   * @param {number} delay - 重試間隔（毫秒）
   * @param {string} context - 錯誤上下文描述
   * @returns {Promise<*>} 執行結果
   */
  static async retry(fn, maxRetries = 3, delay = 1000, context = "操作") {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.warn(`[${context}] 第 ${attempt} 次嘗試失敗:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`[${context}] ${delay}ms 後重試...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new AppError(`${context}在 ${maxRetries} 次嘗試後仍然失敗`, 'RETRY_EXHAUSTED', lastError);
  }

  /**
   * 處理 Discord 訊息錯誤
   * @param {Error} error - 錯誤對象
   * @param {Object} message - Discord 訊息對象
   * @param {string} operation - 操作描述
   */
  static async handleDiscordError(error, message, operation = "操作") {
    console.error(`[Discord ${operation}] 錯誤:`, error);
    
    try {
      // 根據錯誤類型提供不同的用戶友好訊息
      let userMessage = "操作失敗，請稍後再試。";
      
      if (error.code === 50013) {
        userMessage = "權限不足，無法執行此操作。";
      } else if (error.code === 50001) {
        userMessage = "缺少訪問權限。";
      } else if (error.code === 10008) {
        userMessage = "訊息不存在或已被刪除。";
      } else if (error.message.includes("timeout")) {
        userMessage = "操作超時，請稍後再試。";
      }
      
      await message.reply(`❌ ${userMessage}`);
    } catch (replyError) {
      console.error(`[Discord 回覆錯誤] 無法發送錯誤訊息:`, replyError);
    }
  }

  /**
   * 處理 API 錯誤
   * @param {Error} error - 錯誤對象
   * @param {string} apiName - API 名稱
   * @param {Object} requestInfo - 請求資訊
   */
  static handleApiError(error, apiName = "API", requestInfo = {}) {
    const errorInfo = {
      api: apiName,
      error: error.message,
      code: error.code,
      request: requestInfo,
      timestamp: new Date().toISOString()
    };
    
    console.error(`[${apiName} 錯誤]`, errorInfo);
    
    // 可以在這裡添加錯誤報告邏輯，例如發送到監控系統
    return errorInfo;
  }
}

/**
 * 自定義應用程式錯誤類
 */
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', originalError = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * 常見錯誤代碼
 */
const ERROR_CODES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  API_ERROR: 'API_ERROR',
  DISCORD_ERROR: 'DISCORD_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
};

module.exports = {
  ErrorHandler,
  AppError,
  ERROR_CODES,
};
