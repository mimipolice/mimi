// 單一狀態儲存
const stockStatus = {
  send: false,
  record: false,
  save: false,
};

function logStockStatus(type, text) {
  if (!(type in stockStatus)) return;
  stockStatus[type] = true;
  redrawStockStatus();
}

function redrawStockStatus() {
  // 清除當前行並重新輸出
  process.stdout.clearLine();
  process.stdout.cursorTo(0);

  const status = [];
  if (stockStatus.send) status.push("📤 已發送 /stock 指令");
  if (stockStatus.record) status.push("📊 已記錄 11 支股票資訊");
  if (stockStatus.save) status.push("🗄️ 已儲存到資料庫");

  process.stdout.write(status.join(" | "));
}

function logDirect(message) {
  // 換行顯示特殊訊息
  console.log("\n" + message);
}

module.exports = {
  logStockStatus,
  logDirect,
};
