const fs = require("fs");
const path = require("path");
const keywordsPath = path.resolve(__dirname, "../../data/json/keywords.json");

function loadKeywords() {
  if (!fs.existsSync(keywordsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(keywordsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveKeywords(keywords) {
  fs.writeFileSync(keywordsPath, JSON.stringify(keywords, null, 2));
}

async function Keyword(message) {
  const content = message.content.trim();
  if (content.startsWith("&addkw ")) {
    const match = content.match(/^&addkw\s+(\S+)\s+([\s\S]+)/);
    if (!match) {
      message.reply("格式錯誤，請用 &addkw 關鍵字 回覆內容");
      return;
    }
    const [, keyword, reply] = match;
    const keywords = loadKeywords();
    keywords[keyword] = { reply, include: false };
    saveKeywords(keywords);
    message.reply(`已新增關鍵字：${keyword}\n-# by <@${message.author.id}>`);
    return;
  }
  if (content.startsWith("&addkwinclude ")) {
    const match = content.match(/^&addkwinclude\s+(\S+)\s+([\s\S]+)/);
    if (!match) {
      message.reply("格式錯誤，請用 &addkwinclude 關鍵字 回覆內容");
      return;
    }
    const [, keyword, reply] = match;
    const keywords = loadKeywords();
    keywords[keyword] = { reply, include: true };
    saveKeywords(keywords);
    message.reply(
      `已新增包含關鍵字：${keyword}\n-# by <@${message.author.id}>`
    );
    return;
  }
  if (content.startsWith("&delkw ")) {
    const match = content.match(/^&delkw\s+(\S+)/);
    if (!match) {
      message.reply("格式錯誤，請用 &delkw 關鍵字");
      return;
    }
    const [, keyword] = match;
    const keywords = loadKeywords();
    if (keywords[keyword]) {
      delete keywords[keyword];
      saveKeywords(keywords);
      message.reply(`已刪除關鍵字：${keyword}\n-# by <@${message.author.id}>`);
    } else {
      message.reply(`找不到關鍵字：${keyword}`);
    }
    return;
  }
  if (content === "&listkw") {
    const keywords = loadKeywords();
    if (Object.keys(keywords).length === 0) {
      message.reply("目前沒有設定任何關鍵字");
      return;
    }
    let msg = "**已設定關鍵字：**\n";
    for (const k in keywords) {
      const keywordData = keywords[k];
      const type = keywordData.include ? "[包含]" : "[完全匹配]";
      const reply =
        typeof keywordData === "string" ? keywordData : keywordData.reply;
      msg += `• ${k} ${type} → \`\`\`\\n${reply}\`\`\`\n-# by <@${message.author.id}>\m`;
    }
    message.reply(msg);
    return;
  }

  // 檢查是否觸發任何關鍵字
  checkKeywords(message);
}

function checkKeywords(message) {
  const content = message.content.trim();
  const keywords = loadKeywords();

  for (const keyword in keywords) {
    const keywordData = keywords[keyword];
    let shouldTrigger = false;

    if (typeof keywordData === "string") {
      // 舊格式：完全匹配
      shouldTrigger = content === keyword;
    } else {
      // 新格式：根據 include 設定決定匹配方式
      if (keywordData.include) {
        // 包含模式：訊息包含關鍵字就觸發
        shouldTrigger = content.includes(keyword);
      } else {
        // 完全匹配模式：訊息必須完全等於關鍵字
        shouldTrigger = content === keyword;
      }
    }

    if (shouldTrigger) {
      const reply =
        typeof keywordData === "string" ? keywordData : keywordData.reply;
      message.reply(reply);
      return; // 只觸發第一個匹配的關鍵字
    }
  }
}

module.exports = {
  Keyword,
};
