const { createCanvas } = require("canvas");
const dayjs = require("dayjs");

async function createSleepChart(analysis, showFullTimeAxis = false) {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext("2d");

  // 取得股票名稱與代碼
  const symbol = analysis.symbol || "?";
  const name = analysis.name || "?";

  // 背景
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, 800, 600);

  // 標題
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${symbol} - ${name} 區間價格走勢`, 400, 40);

  // 基本資訊
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.fillStyle = "#cccccc";
  const infoY = 70;
  ctx.fillText(
    `觀測時間: ${analysis.startTime} ~ ${analysis.endTime}`,
    50,
    infoY
  );
  ctx.fillText(`觀測時長: ${analysis.sleepDuration} 小時`, 50, infoY + 20);
  ctx.fillText(`數據點數: ${analysis.dataPoints} 個`, 50, infoY + 40);

  // 圖表區域
  const chartX = 60;
  const chartY = 130;
  const chartWidth = 680;
  const chartHeight = 300;

  // 圖表邊框
  ctx.strokeStyle = "#555555";
  ctx.lineWidth = 1;
  ctx.strokeRect(chartX, chartY, chartWidth, chartHeight);

  // 價格數據
  const prices = analysis.priceData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  if (priceRange > 0) {
    // 繪製價格線
    ctx.strokeStyle = analysis.totalChange >= 0 ? "#00ff88" : "#ff4444";
    ctx.lineWidth = 2;
    ctx.beginPath();

    analysis.priceData.forEach((point, index) => {
      const x = chartX + (index / (analysis.priceData.length - 1)) * chartWidth;
      const y =
        chartY +
        chartHeight -
        ((point.price - minPrice) / priceRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 標記最高點和最低點
    const highIndex = prices.findIndex(
      (p) => p === parseFloat(analysis.highPrice)
    );
    const lowIndex = prices.findIndex(
      (p) => p === parseFloat(analysis.lowPrice)
    );

    // 最高點
    const highX =
      chartX + (highIndex / (analysis.priceData.length - 1)) * chartWidth;
    const highY =
      chartY +
      chartHeight -
      ((parseFloat(analysis.highPrice) - minPrice) / priceRange) * chartHeight;
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(highX, highY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // 最低點
    const lowX =
      chartX + (lowIndex / (analysis.priceData.length - 1)) * chartWidth;
    const lowY =
      chartY +
      chartHeight -
      ((parseFloat(analysis.lowPrice) - minPrice) / priceRange) * chartHeight;
    ctx.fillStyle = "#4ecdc4";
    ctx.beginPath();
    ctx.arc(lowX, lowY, 4, 0, 2 * Math.PI);
    ctx.fill();

    // Y軸標籤 (價格)
    ctx.fillStyle = "#888888";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange * i) / 5;
      const y = chartY + chartHeight - (i / 5) * chartHeight;
      ctx.fillText(price.toFixed(2), chartX - 10, y + 4);

      // 網格線
      ctx.strokeStyle = "#333333";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();
    }
  }

  // 畫時間軸
  if (showFullTimeAxis && analysis.priceData.length > 1) {
    ctx.fillStyle = "#cccccc";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    const n = Math.min(6, analysis.priceData.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor((i * (analysis.priceData.length - 1)) / (n - 1));
      const t = dayjs(analysis.priceData[idx].time).format("HH:mm");
      const x = 60 + (idx / (analysis.priceData.length - 1)) * 680;
      ctx.fillText(t, x, 455);
    }
    ctx.textAlign = "left";
  }

  // 統計資訊
  const statsY = 490;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("統計數據", 50, statsY);

  ctx.font = "14px Arial";
  ctx.fillStyle = "#cccccc";
  const stats = [
    `起始價格: ${analysis.startPrice}`,
    `結束價格: ${analysis.endPrice}`,
    `最高價格: ${analysis.highPrice} (${analysis.highTime})`,
    `最低價格: ${analysis.lowPrice} (${analysis.lowTime})`,
    `總漲跌: ${analysis.totalChange} (${analysis.totalChangePercent}%)`,
    `平均價格: ${analysis.avgPrice}`,
    `波動幅度: ${analysis.volatility} (${analysis.volatilityPercent}%)`,
  ];

  stats.forEach((stat, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = 50 + col * 350;
    const y = statsY + 30 + row * 20;
    ctx.fillText(stat, x, y);
  });

  return canvas.toBuffer("image/png");
}

module.exports = { createSleepChart };
