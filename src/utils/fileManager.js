const fs = require("fs");
const path = require("path");

/**
 * 統一的檔案操作工具類
 */
class FileManager {
  /**
   * 確保目錄存在
   * @param {string} filePath - 檔案路徑
   */
  static ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 安全讀取 JSON 檔案
   * @param {string} filePath - 檔案路徑
   * @param {*} defaultValue - 預設值
   * @returns {*} 解析後的 JSON 或預設值
   */
  static readJsonFile(filePath, defaultValue = {}) {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`讀取檔案失敗 ${filePath}:`, error.message);
      return defaultValue;
    }
  }

  /**
   * 安全寫入 JSON 檔案
   * @param {string} filePath - 檔案路徑
   * @param {*} data - 要寫入的資料
   * @param {boolean} createDir - 是否自動創建目錄
   */
  static writeJsonFile(filePath, data, createDir = true) {
    try {
      if (createDir) {
        this.ensureDirectoryExists(filePath);
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
      console.error(`寫入檔案失敗 ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * 備份檔案
   * @param {string} filePath - 原檔案路徑
   * @param {string} backupSuffix - 備份後綴，預設為時間戳
   */
  static backupFile(filePath, backupSuffix = null) {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const suffix = backupSuffix || new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup.${suffix}`;
      
      fs.copyFileSync(filePath, backupPath);
      return backupPath;
    } catch (error) {
      console.error(`備份檔案失敗 ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * 檢查檔案是否存在且可讀
   * @param {string} filePath - 檔案路徑
   * @returns {boolean}
   */
  static isFileAccessible(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { FileManager };
