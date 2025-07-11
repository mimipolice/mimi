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
  if (process.stdout.isTTY) {
    // 只有在有終端機支援時才清除並重繪
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
  } else {
    // 非終端環境，改用換行輸出
    console.log(); // 換行
  }

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
