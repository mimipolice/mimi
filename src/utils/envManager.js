require('dotenv').config();

/**
 * 環境變數管理器
 */
class EnvManager {
  constructor() {
    this.requiredVars = new Set();
    this.optionalVars = new Map(); // key: varName, value: defaultValue
    this.validators = new Map(); // key: varName, value: validatorFunction
  }

  /**
   * 註冊必要的環境變數
   * @param {string} varName - 環境變數名稱
   * @param {Function} validator - 驗證函數（可選）
   */
  require(varName, validator = null) {
    this.requiredVars.add(varName);
    if (validator) {
      this.validators.set(varName, validator);
    }
    return this;
  }

  /**
   * 註冊可選的環境變數
   * @param {string} varName - 環境變數名稱
   * @param {*} defaultValue - 預設值
   * @param {Function} validator - 驗證函數（可選）
   */
  optional(varName, defaultValue, validator = null) {
    this.optionalVars.set(varName, defaultValue);
    if (validator) {
      this.validators.set(varName, validator);
    }
    return this;
  }

  /**
   * 驗證所有環境變數
   * @throws {Error} 如果有必要的環境變數缺失或驗證失敗
   */
  validate() {
    const errors = [];

    // 檢查必要的環境變數
    for (const varName of this.requiredVars) {
      const value = process.env[varName];
      
      if (value === undefined || value === '') {
        errors.push(`必要的環境變數 ${varName} 未設置`);
        continue;
      }

      // 執行自定義驗證
      const validator = this.validators.get(varName);
      if (validator) {
        try {
          validator(value);
        } catch (error) {
          errors.push(`環境變數 ${varName} 驗證失敗: ${error.message}`);
        }
      }
    }

    // 驗證可選的環境變數（如果有設置的話）
    for (const [varName, defaultValue] of this.optionalVars) {
      const value = process.env[varName];
      
      if (value !== undefined && value !== '') {
        const validator = this.validators.get(varName);
        if (validator) {
          try {
            validator(value);
          } catch (error) {
            errors.push(`環境變數 ${varName} 驗證失敗: ${error.message}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`環境變數驗證失敗:\n${errors.join('\n')}`);
    }
  }

  /**
   * 獲取環境變數值
   * @param {string} varName - 環境變數名稱
   * @returns {string} 環境變數值
   */
  get(varName) {
    const value = process.env[varName];
    
    if (value !== undefined && value !== '') {
      return value;
    }
    
    if (this.optionalVars.has(varName)) {
      return this.optionalVars.get(varName);
    }
    
    if (this.requiredVars.has(varName)) {
      throw new Error(`必要的環境變數 ${varName} 未設置`);
    }
    
    return undefined;
  }

  /**
   * 獲取布林值環境變數
   * @param {string} varName - 環境變數名稱
   * @returns {boolean} 布林值
   */
  getBoolean(varName) {
    const value = this.get(varName);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return false;
  }

  /**
   * 獲取數字環境變數
   * @param {string} varName - 環境變數名稱
   * @returns {number} 數字值
   */
  getNumber(varName) {
    const value = this.get(varName);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`環境變數 ${varName} 不是有效數字: ${value}`);
      }
      return num;
    }
    return 0;
  }

  /**
   * 獲取陣列環境變數（逗號分隔）
   * @param {string} varName - 環境變數名稱
   * @returns {Array<string>} 字串陣列
   */
  getArray(varName) {
    const value = this.get(varName);
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    return [];
  }

  /**
   * 列出所有環境變數配置
   * @returns {Object} 環境變數配置摘要
   */
  summary() {
    const summary = {
      required: {},
      optional: {},
      missing: [],
      invalid: []
    };

    // 檢查必要變數
    for (const varName of this.requiredVars) {
      const value = process.env[varName];
      if (value === undefined || value === '') {
        summary.missing.push(varName);
      } else {
        summary.required[varName] = this.maskSensitiveValue(varName, value);
      }
    }

    // 檢查可選變數
    for (const [varName, defaultValue] of this.optionalVars) {
      const value = process.env[varName] || defaultValue;
      summary.optional[varName] = this.maskSensitiveValue(varName, value);
    }

    return summary;
  }

  /**
   * 遮罩敏感資訊
   * @param {string} varName - 變數名稱
   * @param {string} value - 變數值
   * @returns {string} 遮罩後的值
   */
  maskSensitiveValue(varName, value) {
    const sensitivePatterns = ['TOKEN', 'PASSWORD', 'SECRET', 'KEY', 'API'];
    const isSensitive = sensitivePatterns.some(pattern => 
      varName.toUpperCase().includes(pattern)
    );
    
    if (isSensitive && value && value.length > 4) {
      return value.substring(0, 4) + '*'.repeat(value.length - 4);
    }
    
    return value;
  }
}

// 常用驗證器
const validators = {
  /**
   * 驗證 Discord Token 格式
   */
  discordToken: (value) => {
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      throw new Error('Discord Token 格式無效');
    }
  },

  /**
   * 驗證 URL 格式
   */
  url: (value) => {
    try {
      new URL(value);
    } catch {
      throw new Error('URL 格式無效');
    }
  },

  /**
   * 驗證正整數
   */
  positiveInteger: (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      throw new Error('必須是正整數');
    }
  },

  /**
   * 驗證端口號
   */
  port: (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 65535) {
      throw new Error('端口號必須在 1-65535 之間');
    }
  },

  /**
   * 驗證日誌等級
   */
  logLevel: (value) => {
    const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    if (!validLevels.includes(value.toUpperCase())) {
      throw new Error(`日誌等級必須是: ${validLevels.join(', ')}`);
    }
  }
};

// 創建應用程式環境管理器
const appEnv = new EnvManager()
  .require('TOKEN', validators.discordToken)
  .optional('CHANNEL_ID', '1390554923862720572')
  .optional('API_URL', 'https://cwds.taivs.tp.edu.tw/~cbs21/db/api.php', validators.url)
  .optional('STOCK_STORAGE_MODE', 'both')
  .optional('LOG_LEVEL', 'INFO', validators.logLevel)
  .optional('ENABLE_FILE_LOGGING', 'false')
  .optional('ENABLE_CONSOLE_LOGGING', 'true')
  .optional('MAX_RETRIES', '3', validators.positiveInteger)
  .optional('API_TIMEOUT', '10000', validators.positiveInteger);

module.exports = {
  EnvManager,
  validators,
  appEnv,
};
