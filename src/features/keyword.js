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
    keywords[keyword] = reply;
    saveKeywords(keywords);
    message.reply(`已新增關鍵字：${keyword}\n-# by <@${message.author.id}>`);
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
      msg += `• ${k} → ${keywords[k]}\n-# by <@${message.author.id}>`;
    }
    message.reply(msg);
    return;
  }
}

module.exports = {
  Keyword,
};
