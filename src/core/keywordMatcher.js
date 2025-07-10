const { APP_CONFIG } = require("./config");
const { FileManager } = require("../utils/fileManager");

/**
 * 關鍵字匹配器
 */
class KeywordMatcher {
  constructor() {
    this.keywords = null;
    this.loadKeywords();
  }

  /**
   * 載入關鍵字
   */
  loadKeywords() {
    this.keywords = FileManager.readJsonFile(APP_CONFIG.PATHS.KEYWORDS, {});
  }

  /**
   * 儲存關鍵字
   */
  saveKeywords() {
    FileManager.writeJsonFile(APP_CONFIG.PATHS.KEYWORDS, this.keywords);
  }

  /**
   * 新增關鍵字
   */
  addKeyword(keyword, reply) {
    this.keywords[keyword] = reply;
    this.saveKeywords();
  }

  /**
   * 刪除關鍵字
   */
  deleteKeyword(keyword) {
    if (this.keywords[keyword]) {
      delete this.keywords[keyword];
      this.saveKeywords();
      return true;
    }
    return false;
  }

  /**
   * 獲取所有關鍵字
   */
  getAllKeywords() {
    return { ...this.keywords };
  }

  /**
   * 檢查是否匹配關鍵字
   */
  isKeywordMatch(content, keyword) {
    // 僅比對完整詞彙，避免 &addkw 觸發 &ad
    // 1. 完全等於
    if (content === keyword) return true;
    
    // 2. 用非字元分隔（空白、標點、行首行尾）
    const pattern = new RegExp(
      `(^|\\s|[.,!?;:，。！？；：])${this.escapeRegExp(keyword)}($|\\s|[.,!?;:，。！？；：])`
    );
    return pattern.test(content);
  }

  /**
   * 轉義正則表達式特殊字符
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 尋找匹配的關鍵字
   */
  findMatch(content) {
    for (const keyword in this.keywords) {
      if (this.isKeywordMatch(content, keyword)) {
        return {
          keyword,
          reply: this.keywords[keyword]
        };
      }
    }
    return null;
  }

  /**
   * 重新載入關鍵字（用於外部修改後同步）
   */
  reload() {
    this.loadKeywords();
  }
}

module.exports = { KeywordMatcher };
