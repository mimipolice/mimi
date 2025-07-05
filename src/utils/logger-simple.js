// 簡化狀態儲存
let lastUpdateTime = null;
let isRunning = false;

function logStockStatus(type, text) {
  if (!isRunning) {
    console.log("✅ 股票監控啟動");
    isRunning = true;
  }

  lastUpdateTime = new Date().toLocaleTimeString();
  redrawStockStatus();
}

function redrawStockStatus() {
  // 清除當前行並重新輸出
  process.stdout.clearLine();
  process.stdout.cursorTo(0);

  process.stdout.write(`✅ 股票監控正常運行 (最後更新: ${lastUpdateTime})`);
}

function logDirect(message) {
  // 換行顯示特殊訊息
  console.log("\n" + message);
}

module.exports = {
  logStockStatus,
  logDirect,
};
