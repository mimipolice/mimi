// 進度條風格狀態儲存
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
    // 只有在終端機環境下，清除當前行並重繪
    process.stdout.clearLine();
    process.stdout.cursorTo(0);

    const sendIcon = stockStatus.send ? "📤" : "⏳";
    const recordIcon = stockStatus.record ? "📊" : "⏳";
    const saveIcon = stockStatus.save ? "🗄️" : "⏳";

    process.stdout.write(
      `[${sendIcon}] [${recordIcon}] [${saveIcon}] 股票監控運行中...`
    );
  } else {
    // 非終端環境，直接換行輸出狀態文字
    const sendIcon = stockStatus.send ? "📤" : "⏳";
    const recordIcon = stockStatus.record ? "📊" : "⏳";
    const saveIcon = stockStatus.save ? "🗄️" : "⏳";

    console.log(
      `[${sendIcon}] [${recordIcon}] [${saveIcon}] 股票監控運行中...`
    );
  }
}

function logDirect(message) {
  // 換行顯示特殊訊息
  console.log("\n" + message);
}

module.exports = {
  logStockStatus,
  logDirect,
};
