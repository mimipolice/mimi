/**
 * 資料驗證工具
 */
class Validator {
  /**
   * 驗證字串是否非空
   * @param {string} value - 要驗證的值
   * @param {string} fieldName - 欄位名稱
   * @throws {Error} 如果驗證失敗
   */
  static validateNonEmptyString(value, fieldName = "值") {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName}不能為空`);
    }
  }

  /**
   * 驗證數字範圍
   * @param {number} value - 要驗證的值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @param {string} fieldName - 欄位名稱
   * @throws {Error} 如果驗證失敗
   */
  static validateNumberRange(value, min, max, fieldName = "數值") {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${fieldName}必須是有效數字`);
    }
    if (value < min || value > max) {
      throw new Error(`${fieldName}必須在 ${min} 到 ${max} 之間`);
    }
  }

  /**
   * 驗證陣列是否非空
   * @param {Array} value - 要驗證的陣列
   * @param {string} fieldName - 欄位名稱
   * @throws {Error} 如果驗證失敗
   */
  static validateNonEmptyArray(value, fieldName = "陣列") {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${fieldName}不能為空陣列`);
    }
  }

  /**
   * 驗證物件是否包含必要屬性
   * @param {Object} obj - 要驗證的物件
   * @param {Array<string>} requiredFields - 必要欄位列表
   * @param {string} objectName - 物件名稱
   * @throws {Error} 如果驗證失敗
   */
  static validateRequiredFields(obj, requiredFields, objectName = "物件") {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`${objectName}必須是有效物件`);
    }
    
    for (const field of requiredFields) {
      if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
        throw new Error(`${objectName}缺少必要欄位: ${field}`);
      }
    }
  }

  /**
   * 驗證 Discord 訊息格式
   * @param {Object} message - Discord 訊息物件
   * @throws {Error} 如果驗證失敗
   */
  static validateDiscordMessage(message) {
    if (!message) {
      throw new Error("訊息物件不能為空");
    }
    
    if (!message.content && (!message.embeds || message.embeds.length === 0)) {
      throw new Error("訊息必須包含內容或嵌入");
    }
    
    if (!message.author) {
      throw new Error("訊息必須包含作者資訊");
    }
  }

  /**
   * 驗證股票資料格式
   * @param {Object} stockData - 股票資料
   * @throws {Error} 如果驗證失敗
   */
  static validateStockData(stockData) {
    this.validateRequiredFields(stockData, ['symbol', 'name'], '股票資料');
    this.validateNonEmptyString(stockData.symbol, '股票代碼');
    this.validateNonEmptyString(stockData.name, '股票名稱');
    
    if (stockData.price !== null && stockData.price !== undefined) {
      if (typeof stockData.price !== 'number' || stockData.price < 0) {
        throw new Error("股票價格必須是非負數");
      }
    }
    
    if (stockData.volume !== null && stockData.volume !== undefined) {
      if (typeof stockData.volume !== 'number' || stockData.volume < 0) {
        throw new Error("成交量必須是非負數");
      }
    }
  }

  /**
   * 驗證關鍵字資料
   * @param {string} keyword - 關鍵字
   * @param {string} reply - 回覆內容
   * @throws {Error} 如果驗證失敗
   */
  static validateKeywordData(keyword, reply) {
    this.validateNonEmptyString(keyword, '關鍵字');
    this.validateNonEmptyString(reply, '回覆內容');
    
    // 檢查關鍵字長度
    if (keyword.length > 100) {
      throw new Error("關鍵字長度不能超過 100 個字符");
    }
    
    // 檢查回覆內容長度
    if (reply.length > 2000) {
      throw new Error("回覆內容長度不能超過 2000 個字符");
    }
    
    // 檢查是否包含特殊字符
    if (keyword.includes('\n') || keyword.includes('\r')) {
      throw new Error("關鍵字不能包含換行符");
    }
  }

  /**
   * 驗證 ODOG 統計資料
   * @param {Object} statsData - 統計資料
   * @throws {Error} 如果驗證失敗
   */
  static validateOdogStats(statsData) {
    if (!statsData || typeof statsData !== 'object') {
      throw new Error("統計資料必須是有效物件");
    }
    
    for (const [date, userStats] of Object.entries(statsData)) {
      // 驗證日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`無效的日期格式: ${date}`);
      }
      
      if (!userStats || typeof userStats !== 'object') {
        throw new Error(`日期 ${date} 的統計資料格式錯誤`);
      }
      
      for (const [username, rarityStats] of Object.entries(userStats)) {
        this.validateNonEmptyString(username, '用戶名稱');
        this.validateRequiredFields(rarityStats, ['EX', 'LR', 'UR', 'SSR'], '稀有度統計');
        
        for (const [rarity, count] of Object.entries(rarityStats)) {
          if (typeof count !== 'number' || count < 0) {
            throw new Error(`用戶 ${username} 的 ${rarity} 統計必須是非負數`);
          }
        }
      }
    }
  }

  /**
   * 安全驗證（不拋出錯誤，返回驗證結果）
   * @param {Function} validationFn - 驗證函數
   * @param {...any} args - 驗證函數的參數
   * @returns {Object} 驗證結果 { isValid: boolean, error: string|null }
   */
  static safeValidate(validationFn, ...args) {
    try {
      validationFn.apply(this, args);
      return { isValid: true, error: null };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }
}

/**
 * 驗證裝飾器
 * @param {Function} validationFn - 驗證函數
 * @returns {Function} 裝飾器函數
 */
function validate(validationFn) {
  return function(target, propertyName, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      validationFn(...args);
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

module.exports = {
  Validator,
  validate,
};
