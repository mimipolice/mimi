async function Help(message) {
  const content = message.content.trim();
  const args = content.split(/\s+/);

  // 指令總覽
  if (args.length === 1) {
    let msg = "**可用指令列表**\n-# []選填 <>必填\n";
    msg += "> `&help <指令>`：顯示該指令詳細說明\n";
    msg += "> `&r`, `&report <股票代碼> [區間]`：查詢股票歷史分析\n";
    msg += "> `&odog [日期|all]`：查詢歐氣排行\n";
    msg += "> `&zz [1d|7d]`：爬取歐氣歷史紀錄\n";
    msg += "> `&addkw <關鍵字> <回覆>`：新增自動回覆\n";
    msg += "> `&listkw`：列出所有關鍵字\n";
    msg += "> `&ar`：顯示當前設定\n";
    msg += "> `&ar <emoji> <channel>`：新增設定\n";
    msg += "> `&ar remove <channelId>`：移除設定\n";
    msg += "\n輸入 `&help <指令>` 來查看詳細用法，例如 `&help report`";
    await message.reply(msg);
    return;
  }

  // 細則說明
  const sub = args[1].toLowerCase();
  let detail = "";
  if (sub === "report" || sub === "r") {
    detail = "**&report <股票代碼> [區間]**（亦可使用`&r`, 與`&report`相同）\n";
    detail += "查詢指定股票的歷史分析報告。\n";
    detail += "範例：\n";
    detail += "> `&report APPLG`（查詢全部歷史）\n";
    detail += "> `&report APPLG 1d`（查詢近一天）\n";
    detail += "> `&report APPLG 7d`（查詢近七天）\n";
    detail += "> `&report list`（顯示可查詢股票列表）\n";
    detail += "\n區間參數支援：`1d`、`7d`、`1m`、`5h` ...";
  } else if (sub === "odog") {
    detail = "**&odog [日期|all]**\n";
    detail += "查詢歐氣排行。\n";
    detail += "> `&odog`：查詢今日排行\n";
    detail += "> `&odog all`：查詢總排行\n";
    detail += "> `&odog YYYY-MM-DD`：查詢指定日期排行";
  } else if (sub === "zz") {
    detail = "**&zz [1d|7d]**\n";
    detail += "爬取歐氣歷史紀錄。\n";
    detail += "> `&zz`：全部\n";
    detail += "> `&zz 1d`：今日 12:00 以後 `壞了`\n";
    detail += "> `&zz 7d`：過去 7 天 `不知道有沒有壞`";
  } else if (sub === "addkw") {
    detail = "**&addkw <關鍵字> <回覆>**\n新增自動回覆。";
  } else if (sub === "listkw") {
    detail = "**&listkw**\n列出所有關鍵字。";
  } else if (sub === "ar") {
    detail = "**&ar**\n顯示當前設定。\n";
    detail += "> `&ar <emoji> <channel>`：新增設定\n";
    detail += "> `&ar remove <channelId>`：移除設定\n";
    detail += "\n支援格式：\n";
    detail += "> `<:emoji:emojiId> <channelId>`\n";
    detail += "> `<:emoji:emojiId> <#channelId>`\n";
    detail += "> `emojiId <#channelId>`";
  } else {
    detail = "查無此指令，請輸入 `&help` 查看所有指令。";
  }
  await message.reply(detail);
}

module.exports = {
  Help,
};
