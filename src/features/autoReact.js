const fs = require("fs");
const path = require("path");
const { logDirect } = require("../utils/logger");
const AUTO_REACT_PATH = path.resolve(
  __dirname,
  "../../data/json/auto_react.json"
);

function loadAutoReact() {
  if (!fs.existsSync(AUTO_REACT_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(AUTO_REACT_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveAutoReact(config) {
  fs.writeFileSync(AUTO_REACT_PATH, JSON.stringify(config, null, 2));
}

function parseEmojiAndChannel(content) {
  const args = content.trim().split(/\s+/);

  // 移除 &ar 指令
  if (args[0] === "&ar") {
    args.shift();
  }

  if (args.length !== 2) {
    return { error: "格式錯誤，需要提供 emoji 和頻道" };
  }

  let emojiId = null;
  let channelId = null;

  // 解析第一個參數 (emoji)
  const emojiArg = args[0];

  // 格式1: <:frogfire:1390753587444977714>
  const emojiMatch1 = emojiArg.match(/^<:(\w+):(\d+)>$/);
  if (emojiMatch1) {
    emojiId = emojiMatch1[2];
  }
  // 格式2: 純數字 ID
  else if (/^\d+$/.test(emojiArg)) {
    emojiId = emojiArg;
  }

  // 解析第二個參數 (頻道)
  const channelArg = args[1];

  // 格式1: <#1372931999701926001>
  const channelMatch1 = channelArg.match(/^<#(\d+)>$/);
  if (channelMatch1) {
    channelId = channelMatch1[1];
  }
  // 格式2: 純數字 ID
  else if (/^\d+$/.test(channelArg)) {
    channelId = channelArg;
  }

  if (!emojiId) {
    return { error: "無法解析 emoji ID，請使用 <:name:id> 或純數字 ID 格式" };
  }

  if (!channelId) {
    return { error: "無法解析頻道 ID，請使用 <#id> 或純數字 ID 格式" };
  }

  return { emojiId, channelId };
}

async function handleAutoReactCommand(message, client) {
  const content = message.content.trim();

  if (!content.startsWith("&ar")) {
    return false;
  }

  const args = content.split(/\s+/);

  // 顯示當前設定
  if (args.length === 1) {
    const config = loadAutoReact();
    if (Object.keys(config).length === 0) {
      message.reply("目前沒有設定自動回應");
      return true;
    }

    let msg = "**當前自動回應設定**\n";
    msg += "─".repeat(30) + "\n";
    for (const channelId in config) {
      const emojiId = config[channelId];
      try {
        const channel = client.channels.cache.get(channelId);
        msg += `頻道: **<#${channelId}>**\n`;
        msg += `Emoji: <:emoji:${emojiId}>\n\n`;
      } catch (e) {
        msg += `頻道: **${channelId}** (無法取得名稱)\n`;
        msg += `Emoji: <:emoji:${emojiId}>\n\n`;
      }
    }
    message.reply(msg);
    return true;
  }

  // 移除設定
  if (args[1] === "remove" && args.length === 3) {
    let channelId = args[2];

    // 支援 <#channelId> 格式
    const channelMatch = channelId.match(/^<#(\d+)>$/);
    if (channelMatch) {
      channelId = channelMatch[1];
    }

    const config = loadAutoReact();

    if (!config[channelId]) {
      const reply = await message.reply("該頻道沒有設定自動回應");
      setTimeout(() => {
        reply.delete();
      }, 5000); //然後刪除自己
      return true;
    }

    delete config[channelId];
    saveAutoReact(config);

    try {
      const channel = client.channels.cache.get(channelId);
      message.reply(
        `已移除頻道 **<#${channelId}>** 的自動回應設定\n-# by <@${message.author.id}>`
      );
    } catch (e) {
      message.reply(
        `已移除頻道 **${channelId}** 的自動回應設定\n-# by <@${message.author.id}>`
      );
    }
    return true;
  }

  // 新增設定
  if (args.length === 3) {
    const parseResult = parseEmojiAndChannel(content);

    if (parseResult.error) {
      message.reply(parseResult.error);
      return true;
    }

    const { emojiId, channelId } = parseResult;

    // 驗證頻道是否存在
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      message.reply("找不到指定的頻道");
      return true;
    }

    // 儲存設定
    const config = loadAutoReact();
    config[channelId] = emojiId;
    saveAutoReact(config);

    message.reply(
      `已設定對頻道 **<#${channelId}>** 自動回應 <:emoji:${emojiId}>`
    );
    return true;
  }

  message.reply(
    "用法：\n• `&ar` - 顯示當前設定\n• `&ar <emoji> <channel>` - 新增設定\n• `&ar remove <channelId>` - 移除設定\n\n支援格式：\n• `<:frogfire:1390753587444977714> 1372931999701926001`\n• `<:frogfire:1390753587444977714> <#1372931999701926001>`\n• `1390753587444977714 <#1372931999701926001>`"
  );
  return true;
}

async function handleAutoReactMessage(message, client) {
  // 跳過自己的訊息
  if (message.author.id === client.user.id) return;

  const config = loadAutoReact();
  const channelId = message.channelId;

  if (!config[channelId]) return;

  const emojiId = config[channelId];

  try {
    await message.react(emojiId);
    logDirect(`[AUTO REACT] 已對訊息 ${message.id} 回應 ${emojiId}`);
  } catch (error) {
    logDirect(`[AUTO REACT] 回應失敗: ${error}`);
  }
}

async function applyAutoReactToHistory(channel, client) {
  const config = loadAutoReact();
  const channelId = channel.id;

  if (!config[channelId]) return;

  const emojiId = config[channelId];
  let before = undefined;
  let processedCount = 0;

  logDirect(`[AUTO REACT] 開始處理頻道 <#${channelId}> 的歷史訊息`);

  while (true) {
    const options = { limit: 100 };
    if (before) options.before = before;

    try {
      const messages = await channel.messages.fetch(options);
      if (!messages.size) break;

      for (const msg of messages.values()) {
        // 跳過自己的訊息
        if (msg.author.id === client.user.id) continue;

        // 檢查是否已經回應過
        const hasReacted = msg.reactions.cache.has(emojiId);
        if (!hasReacted) {
          try {
            await msg.react(emojiId);
            processedCount++;
            logDirect(`[AUTO REACT] 歷史訊息 ${msg.id} 已回應`);
            await new Promise((resolve) => setTimeout(resolve, 100)); // 避免 API 限制
          } catch (error) {
            logDirect(`[AUTO REACT] 歷史訊息回應失敗: ${error}`);
          }
        }
      }

      before = messages.last().id;
      if (messages.size < 100) break;

      await new Promise((resolve) => setTimeout(resolve, 500)); // 避免 API 過載
    } catch (error) {
      logDirect(`[AUTO REACT] 取得歷史訊息失敗: ${error}`);
      break;
    }
  }

  logDirect(
    `[AUTO REACT] 頻道 ${channel.name} 處理完成，共回應 ${processedCount} 則訊息`
  );
}

module.exports = {
  loadAutoReact,
  saveAutoReact,
  handleAutoReactCommand,
  handleAutoReactMessage,
  applyAutoReactToHistory,
  parseEmojiAndChannel,
};
