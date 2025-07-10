const fs = require('fs');
const path = require('path');
const { APP_CONFIG } = require('../core/config');

/**
 * 日誌等級
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

/**
 * 進階日誌系統
 */
class AdvancedLogger {
  constructor(options = {}) {
    this.level = options.level || LOG_LEVELS.INFO;
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logDir = options.logDir || path.resolve(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.dateFormat = options.dateFormat || 'YYYY-MM-DD HH:mm:ss';
    
    // 確保日誌目錄存在
    if (this.enableFile) {
      this.ensureLogDirectory();
    }
    
    // 績效監控
    this.performanceMetrics = new Map();
  }

  /**
   * 確保日誌目錄存在
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 格式化時間戳
   */
  formatTimestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  /**
   * 格式化日誌訊息
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = this.formatTimestamp();
    const levelStr = Object.keys(LOG_LEVELS)[level].padEnd(5);
    
    let formatted = `[${timestamp}] ${levelStr} ${message}`;
    
    if (Object.keys(meta).length > 0) {
      formatted += ` ${JSON.stringify(meta)}`;
    }
    
    return formatted;
  }

  /**
   * 寫入檔案日誌
   */
  writeToFile(level, message, meta = {}) {
    if (!this.enableFile) return;
    
    try {
      const levelName = Object.keys(LOG_LEVELS)[level].toLowerCase();
      const filename = `${levelName}-${new Date().toISOString().slice(0, 10)}.log`;
      const filepath = path.join(this.logDir, filename);
      
      const formatted = this.formatMessage(level, message, meta) + '\n';
      
      // 檢查檔案大小並輪轉
      this.rotateLogFile(filepath);
      
      fs.appendFileSync(filepath, formatted, 'utf8');
    } catch (error) {
      console.error('寫入日誌檔案失敗:', error);
    }
  }

  /**
   * 日誌檔案輪轉
   */
  rotateLogFile(filepath) {
    try {
      if (!fs.existsSync(filepath)) return;
      
      const stats = fs.statSync(filepath);
      if (stats.size < this.maxFileSize) return;
      
      // 重命名當前檔案
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = filepath.replace('.log', `-${timestamp}.log`);
      fs.renameSync(filepath, rotatedPath);
      
      // 清理舊檔案
      this.cleanupOldLogs();
    } catch (error) {
      console.error('日誌輪轉失敗:', error);
    }
  }

  /**
   * 清理舊日誌檔案
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      // 保留最新的檔案，刪除超出限制的舊檔案
      if (files.length > this.maxFiles) {
        const filesToDelete = files.slice(this.maxFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.error('清理舊日誌失敗:', error);
    }
  }

  /**
   * 記錄日誌
   */
  log(level, message, meta = {}) {
    if (level > this.level) return;
    
    const formatted = this.formatMessage(level, message, meta);
    
    // 控制台輸出
    if (this.enableConsole) {
      const colors = {
        [LOG_LEVELS.ERROR]: '\x1b[31m', // 紅色
        [LOG_LEVELS.WARN]: '\x1b[33m',  // 黃色
        [LOG_LEVELS.INFO]: '\x1b[36m',  // 青色
        [LOG_LEVELS.DEBUG]: '\x1b[35m', // 紫色
        [LOG_LEVELS.TRACE]: '\x1b[37m', // 白色
      };
      
      const color = colors[level] || '';
      const reset = '\x1b[0m';
      console.log(`${color}${formatted}${reset}`);
    }
    
    // 檔案輸出
    this.writeToFile(level, message, meta);
  }

  /**
   * 錯誤日誌
   */
  error(message, meta = {}) {
    this.log(LOG_LEVELS.ERROR, message, meta);
  }

  /**
   * 警告日誌
   */
  warn(message, meta = {}) {
    this.log(LOG_LEVELS.WARN, message, meta);
  }

  /**
   * 資訊日誌
   */
  info(message, meta = {}) {
    this.log(LOG_LEVELS.INFO, message, meta);
  }

  /**
   * 除錯日誌
   */
  debug(message, meta = {}) {
    this.log(LOG_LEVELS.DEBUG, message, meta);
  }

  /**
   * 追蹤日誌
   */
  trace(message, meta = {}) {
    this.log(LOG_LEVELS.TRACE, message, meta);
  }

  /**
   * 開始性能監控
   */
  startTimer(label) {
    this.performanceMetrics.set(label, {
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage()
    });
  }

  /**
   * 結束性能監控
   */
  endTimer(label) {
    const metrics = this.performanceMetrics.get(label);
    if (!metrics) {
      this.warn(`性能監控標籤不存在: ${label}`);
      return;
    }
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - metrics.startTime) / 1000000; // 轉換為毫秒
    const memoryDiff = endMemory.heapUsed - metrics.startMemory.heapUsed;
    
    this.info(`性能監控 [${label}]`, {
      duration: `${duration.toFixed(2)}ms`,
      memoryDiff: `${(memoryDiff / 1024 / 1024).toFixed(2)}MB`
    });
    
    this.performanceMetrics.delete(label);
  }

  /**
   * 記錄 API 請求
   */
  logApiRequest(method, url, statusCode, duration, error = null) {
    const meta = {
      method,
      url,
      statusCode,
      duration: `${duration}ms`
    };
    
    if (error) {
      meta.error = error.message;
      this.error(`API 請求失敗: ${method} ${url}`, meta);
    } else if (statusCode >= 400) {
      this.warn(`API 請求警告: ${method} ${url}`, meta);
    } else {
      this.info(`API 請求成功: ${method} ${url}`, meta);
    }
  }

  /**
   * 記錄 Discord 事件
   */
  logDiscordEvent(event, details = {}) {
    this.info(`Discord 事件: ${event}`, details);
  }
}

// 創建全域日誌實例
const logger = new AdvancedLogger({
  level: process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO,
  enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
  enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
});

module.exports = {
  AdvancedLogger,
  LOG_LEVELS,
  logger,
};
